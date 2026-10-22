// Shared helpers for the Inkling tests.
const path = require('path');
const zlib = require('zlib');

const APP_URL = 'file://' + path.join(__dirname, '..', 'index.html');

// Opens the app in a plain browser (localStorage saving). The tour is skipped unless `tour` is set.
async function openApp(page, { tour = false, project = null, clock = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  if (clock) await page.clock.install();
  await page.addInitScript(
    ({ tour, project }) => {
      if (sessionStorage.getItem('seeded')) return; // only before the first load, so reloads keep what the app saved
      sessionStorage.setItem('seeded', '1');
      if (!tour) localStorage.setItem('inkling:tour', '1');
      if (project) localStorage.setItem('inkling:project', JSON.stringify(project));
    },
    { tour, project }
  );
  await page.goto(APP_URL);
  await page.waitForSelector('#binder .sc-btn');
  return errors;
}

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('inkling:project') || 'null'));
// Waits for the app's debounced save to reach localStorage (up to 15 s: a busy CI machine can be slow).
async function waitSaved(page, test) {
  for (let i = 0; i < 100; i++) {
    const p = await saved(page);
    if (p && test(p)) return p;
    await page.waitForTimeout(150);
  }
  throw new Error('The project was not saved as expected');
}

// Reads a zip (stored or deflated entries) into {name: Buffer}.
function unzip(buf) {
  const out = {};
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Not a zip file');
  let p = buf.readUInt32LE(end + 16);
  const n = buf.readUInt16LE(end + 10);
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad central directory');
    const method = buf.readUInt16LE(p + 10),
      size = buf.readUInt32LE(p + 20),
      nl = buf.readUInt16LE(p + 28),
      xl = buf.readUInt16LE(p + 30),
      cl = buf.readUInt16LE(p + 32),
      off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    const lnl = buf.readUInt16LE(off + 26),
      lxl = buf.readUInt16LE(off + 28),
      data = buf.subarray(off + 30 + lnl + lxl, off + 30 + lnl + lxl + size);
    out[name] = method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
    out[name].firstOffset = off;
    p += 46 + nl + xl + cl;
  }
  return out;
}

// Writes a zip with deflated entries (as Word does) from {name: string}.
function zipDeflate(files) {
  const parts = [],
    cen = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const nb = Buffer.from(name),
      raw = Buffer.from(text),
      data = zlib.deflateRawSync(raw),
      crc = zlib.crc32(raw);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(raw.length, 22);
    h.writeUInt16LE(nb.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(raw.length, 24);
    c.writeUInt16LE(nb.length, 28);
    c.writeUInt32LE(off, 42);
    parts.push(h, nb, data);
    cen.push(c, nb);
    off += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(cen),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(cen.length / 2, 8);
  end.writeUInt16LE(cen.length / 2, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
// A Word document (.docx) from paragraphs, written the way Word writes them. Each paragraph is a string (plain text),
// or {style, runs: [[text, 'biu'], …], xml} where xml is raw WordprocessingML to put in the paragraph or, with
// style 'raw', in the body. Styles: Title, Heading1, Heading2 and a character style Emphasis (italic).
function makeDocx(paras, { title = '' } = {}) {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const run = ([t, f = '']) =>
    '<w:r><w:rPr>' +
    (f.includes('b') ? '<w:b/>' : '') +
    (f.includes('i') ? '<w:i/>' : '') +
    (f.includes('u') ? '<w:u w:val="single"/>' : '') +
    (f.includes('e') ? '<w:rStyle w:val="Emphasis"/>' : '') +
    '</w:rPr><w:t xml:space="preserve">' +
    esc(t) +
    '</w:t></w:r>';
  const body = paras
    .map(p => {
      if (typeof p === 'string') p = { runs: [[p]] };
      if (p.style === 'raw') return p.xml;
      return (
        '<w:p><w:pPr>' +
        (p.style ? '<w:pStyle w:val="' + p.style + '"/>' : '') +
        (p.pageBreak ? '<w:pageBreakBefore/>' : '') +
        '</w:pPr>' +
        (p.runs || []).map(run).join('') +
        (p.xml || '') +
        '</w:p>'
      );
    })
    .join('');
  const style = (id, name, type, extra) =>
    '<w:style w:type="' +
    type +
    '" w:styleId="' +
    id +
    '"><w:name w:val="' +
    name +
    '"/>' +
    (extra || '') +
    '</w:style>';
  return zipDeflate({
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': '<?xml version="1.0"?><w:document ' + W + '><w:body>' + body + '</w:body></w:document>',
    'word/styles.xml':
      '<?xml version="1.0"?><w:styles ' +
      W +
      '>' +
      style('Normal', 'Normal', 'paragraph') +
      style('Title', 'Title', 'paragraph', '<w:basedOn w:val="Normal"/>') +
      style('Heading1', 'heading 1', 'paragraph', '<w:basedOn w:val="Normal"/><w:rPr><w:b/></w:rPr>') +
      style('Heading2', 'heading 2', 'paragraph', '<w:basedOn w:val="Heading1"/>') +
      style('Emphasis', 'Emphasis', 'character', '<w:rPr><w:i/></w:rPr>') +
      '</w:styles>',
    'docProps/core.xml':
      '<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' +
      esc(title) +
      '</dc:title><dc:creator>Jane Writer</dc:creator></cp:coreProperties>'
  });
}

module.exports = { APP_URL, openApp, saved, waitSaved, unzip, makeDocx };
