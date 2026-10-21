/*
 * 33-export.js: The menu, backups, export, and saving files
 *
 * Export makes Word (.docx), PDF, EPUB, Markdown and plain text, all in the page: Word and EPUB files are built with
 * a small zip writer (zip, crc32), PDF goes to the desktop's PDF maker or the browser's print window. Word and PDF
 * follow standard manuscript format, for sending to agents and editors. saveFile() saves a file the right way for
 * each environment. The ⋯ menu (renderMenu, bindMenu) is here too.
 */
// A title as a safe file name: "The Lantern Tide" → "the-lantern-tide".
function slug(s) {
  return (
    (s || 'novel')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'novel'
  );
}
// Saves a file for the writer: a save dialog on the desktop, the artifact's downloads in Claude, a download in a
// browser.
async function saveFile(name, data) {
  if (DESK) {
    try {
      const at = await DESK.saveFile(name, data);
      if (at) toast('Saved to ' + at, { plain: true });
    } catch (e) {
      toast('Could not save the file.', { plain: true });
    }
    return;
  }
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl) {
      await dl.save({ filename: name, data });
      return;
    }
  } catch (e) {
    if (!e || e.code !== 'declined') toast('Could not save the file.', { plain: true });
    return;
  }
  // a plain browser: an ordinary download
  const u = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' })),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
// Saves the whole project, with every picture inside it, as a .json backup.
async function doBackup() {
  const imgs = await collectImages();
  saveFile(
    slug(S.meta.title) + '-backup.json',
    JSON.stringify(Object.assign({ app: 'inkling', appVersion: APP_VERSION }, snapshot(), { imgs }), null, 1)
  );
}
/* ---------- export: Word, PDF, EPUB, Markdown, plain text ---------- */
// Word and PDF follow standard manuscript format: 12 pt Times or Courier, double spaced, 1" margins, indented paragraphs,
// a "Surname / TITLE / page" header, and a title page with contact details and a rounded word count.
// In the text, each line is a paragraph and *words* or _words_ are italic.
const EXP_FMTS = {
  docx: ['Word', '.docx'],
  pdf: ['PDF', '.pdf'],
  epub: ['EPUB ebook', '.epub'],
  md: ['Markdown', '.md'],
  txt: ['Plain text', '.txt']
};
// Checks the export choices.
function normExp(x) {
  x = x && typeof x === 'object' ? x : {};
  return {
    fmt: EXP_FMTS[x.fmt] ? x.fmt : 'docx',
    byline: String(x.byline || '').slice(0, 120),
    contact: String(x.contact || '').slice(0, 600),
    font: x.font === 'courier' ? 'courier' : 'times',
    page: x.page === 'a4' ? 'a4' : 'letter',
    title: x.title !== false,
    chNew: x.chNew !== false,
    brk: String(x.brk == null ? '#' : x.brk).slice(0, 12),
    uid: /^[\w-]{8,64}$/.test(x.uid || '') ? x.uid : ''
  };
}
// The book to export: chapters with their scenes as paragraphs (one chapter, or all).
function expBook(scope) {
  return S.meta.chapters
    .filter(c => scope === 'all' || c.id === scope)
    .map(c => ({
      title: c.title,
      scenes: c.scenes
        .map(id =>
          String(S.sc[id].text || '')
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
        )
        .filter(x => x.length)
    }));
}
// One paragraph of stored text as runs of text with their styles: [[text, styles]] (1 bold, 2 italic, 4 underline).
function runs(p) {
  // one line of stored text → [[text, styles]] (1 bold, 2 italic, 4 underline)
  const P = fmtParse(p);
  if (!P.flags) return P.vis ? [[P.vis, 0]] : [];
  const out = [];
  for (let i = 0; i < P.vis.length; ) {
    const f = P.flags[i];
    let j = i;
    while (j < P.vis.length && P.flags[j] === f) j++;
    out.push([P.vis.slice(i, j), f]);
    i = j;
  }
  return out;
}
// Makes text safe for XML (Word and EPUB files).
const xe = s =>
  String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// A word count rounded the way manuscripts state it ("about 80,000 words").
const roundWords = n =>
  n < 1000
    ? Math.max(100, Math.round(n / 100) * 100)
    : n < 10000
      ? Math.round(n / 500) * 500
      : Math.round(n / 1000) * 1000;
// Everything the export formats need: the book, word count, author, byline, header and font.
function expInfo(scope) {
  const m = S.meta,
    o = m.exp,
    book = expBook(scope),
    words = book.reduce((a, c) => a + c.scenes.reduce((b, x) => b + x.reduce((d, l) => d + wc(l), 0), 0), 0);
  const author = String(m.author || '').trim(),
    byline = o.byline.trim() || author;
  return {
    m,
    o,
    book,
    words,
    author,
    byline,
    title: m.title,
    surname: byline.split(/\s+/).pop() || '',
    contact: o.contact
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean),
    head: (
      (byline.split(/\s+/).pop() || '') +
      ' / ' +
      m.title.toUpperCase().split(/\s+/).slice(0, 4).join(' ')
    ).replace(/^ \/ /, ''),
    font: o.font === 'courier' ? 'Courier New' : 'Times New Roman',
    full: scope === 'all'
  };
}
// A minimal zip writer (stored, no compression), enough for .docx and .epub.
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
// The CRC-32 checksum a zip file needs for each file.
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// Packs files into a zip (stored, not compressed), as a Uint8Array.
function zip(files) {
  const te = new TextEncoder(),
    parts = [],
    cen = [],
    d = new Date();
  let off = 0;
  const dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  for (const [name, data] of files) {
    const nb = te.encode(name),
      b = typeof data === 'string' ? te.encode(data) : data,
      crc = crc32(b);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(10, tm, true);
    h.setUint16(12, dt, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, b.length, true);
    h.setUint32(22, b.length, true);
    h.setUint16(26, nb.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(12, tm, true);
    c.setUint16(14, dt, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, b.length, true);
    c.setUint32(24, b.length, true);
    c.setUint16(28, nb.length, true);
    c.setUint32(42, off, true);
    parts.push(new Uint8Array(h.buffer), nb, b);
    cen.push(new Uint8Array(c.buffer), nb);
    off += 30 + nb.length + b.length;
  }
  const size = cen.reduce((a, x) => a + x.length, 0),
    e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, size, true);
  e.setUint32(16, off, true);
  const all = parts.concat(cen, [new Uint8Array(e.buffer)]),
    out = new Uint8Array(all.reduce((a, x) => a + x.length, 0));
  let p = 0;
  all.forEach(x => {
    out.set(x, p);
    p += x.length;
  });
  return out;
}
// The manuscript as a Word document.
function expDocx(scope) {
  const I = expInfo(scope),
    o = I.o,
    a4 = o.page === 'a4',
    pw = a4 ? 11906 : 12240,
    ph = a4 ? 16838 : 15840,
    tw = pw - 2880;
  const W =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const run = (t, f) =>
    '<w:r>' +
    (f
      ? '<w:rPr>' +
        (f & 1 ? '<w:b/>' : '') +
        (f & 2 ? '<w:i/>' : '') +
        (f & 4 ? '<w:u w:val="single"/>' : '') +
        '</w:rPr>'
      : '') +
    '<w:t xml:space="preserve">' +
    xe(t) +
    '</w:t></w:r>';
  const para = (t, pp) =>
    '<w:p>' +
    (pp ? '<w:pPr>' + pp + '</w:pPr>' : '') +
    runs(t)
      .map(r => run(r[0], r[1]))
      .join('') +
    '</w:p>';
  const flat = '<w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/>',
    mid = '<w:jc w:val="center"/><w:ind w:firstLine="0"/>';
  const sect = first =>
    '<w:sectPr>' +
    (first ? '' : '<w:headerReference w:type="default" r:id="rIdH"/>') +
    '<w:pgSz w:w="' +
    pw +
    '" w:h="' +
    ph +
    '"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>' +
    (first ? '' : o.title ? '<w:pgNumType w:start="1"/>' : '') +
    '</w:sectPr>';
  let body = '';
  if (o.title) {
    const lines = I.contact.length ? I.contact : [I.author || I.byline || ' '];
    lines.forEach((l, i) => {
      body +=
        '<w:p><w:pPr>' +
        flat +
        '<w:tabs><w:tab w:val="right" w:pos="' +
        tw +
        '"/></w:tabs></w:pPr>' +
        run(l) +
        (i === 0
          ? '<w:r><w:tab/></w:r>' + run('about ' + roundWords(I.words).toLocaleString('en-US') + ' words')
          : '') +
        '</w:p>';
    });
    body +=
      '<w:p><w:pPr>' +
      mid +
      '<w:spacing w:before="' +
      (4320 - lines.length * 240) +
      '"/></w:pPr>' +
      run(I.title) +
      '</w:p>';
    if (I.byline) body += para('by ' + I.byline, mid);
    body +=
      '<w:p><w:pPr>' + sect(true).replace('<w:sectPr>', '<w:sectPr><w:type w:val="nextPage"/>') + '</w:pPr></w:p>';
  }
  I.book.forEach((c, ci) => {
    body +=
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/>' +
      (ci > 0 && o.chNew ? '<w:pageBreakBefore/>' : '') +
      '</w:pPr>' +
      run(c.title) +
      '</w:p>';
    c.scenes.forEach((x, si) => {
      if (si) body += para(o.brk || ' ', mid);
      x.forEach(l => {
        body += para(l);
      });
    });
  });
  if (I.full) body += para('END', '<w:jc w:val="center"/><w:ind w:firstLine="0"/><w:spacing w:before="480"/>');
  const doc =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' +
    W +
    '><w:body>' +
    body +
    sect(false) +
    '</w:body></w:document>';
  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' +
    W +
    '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' +
    I.font +
    '" w:hAnsi="' +
    I.font +
    '" w:cs="' +
    I.font +
    '" w:eastAsia="' +
    I.font +
    '"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="480" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:widowControl/><w:ind w:firstLine="720"/></w:pPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="2880" w:after="480"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="right"/></w:pPr></w:style></w:styles>';
  const header =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' +
    W +
    '><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr>' +
    run(I.head + ' / ') +
    '<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:hdr>';
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return zip([
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'
    ],
    [
      'docProps/core.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' +
        xe(I.title) +
        '</dc:title><dc:creator>' +
        xe(I.byline) +
        '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' +
        now +
        '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' +
        now +
        '</dcterms:modified></cp:coreProperties>'
    ],
    [
      'word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>'
    ],
    ['word/document.xml', doc],
    ['word/styles.xml', styles],
    ['word/header1.xml', header]
  ]);
}
// One paragraph as HTML with its bold, italic and underline.
const htmlRuns = l =>
  runs(l)
    .map(r => {
      let t = xe(r[0]);
      if (r[1] & 4) t = '<u>' + t + '</u>';
      if (r[1] & 2) t = '<em>' + t + '</em>';
      if (r[1] & 1) t = '<strong>' + t + '</strong>';
      return t;
    })
    .join('');
// The manuscript as a printable HTML page, for PDF.
function expPdfHtml(scope) {
  const I = expInfo(scope),
    o = I.o,
    fam = I.font === 'Courier New' ? "'Courier New',Courier,monospace" : "'Times New Roman',Times,serif";
  let h =
    '<!doctype html><html><head><meta charset="utf-8"><title>' +
    xe(I.title) +
    '</title><style>@page{size:' +
    (o.page === 'a4' ? 'A4' : 'letter') +
    ';margin:1in}' +
    'html,body{margin:0;background:#fff;color:#000}body{font-family:' +
    fam +
    ';font-size:12pt;line-height:2}p{margin:0;text-indent:.5in;orphans:2;widows:2}' +
    '.c{text-align:center;text-indent:0}.tp{page-break-after:always;line-height:1.15}.tp .wc{float:right}.tp .t{margin-top:3.2in;text-align:center;line-height:2}' +
    'h1{font-size:12pt;font-weight:normal;text-align:center;margin:2in 0 .35in;break-after:avoid}h1.nb{page-break-before:always}</style></head><body>';
  if (o.title) {
    const lines = I.contact.length ? I.contact : [I.author || I.byline || ''];
    h +=
      '<div class="tp"><div class="wc">about ' +
      roundWords(I.words).toLocaleString('en-US') +
      ' words</div>' +
      lines.map(l => '<div>' + xe(l) + '</div>').join('') +
      '<div class="t">' +
      xe(I.title) +
      (I.byline ? '<br>by ' + xe(I.byline) : '') +
      '</div></div>';
  }
  I.book.forEach((c, ci) => {
    h += '<h1' + (ci > 0 && o.chNew ? ' class="nb"' : '') + '>' + xe(c.title) + '</h1>';
    c.scenes.forEach((x, si) => {
      if (si) h += '<p class="c">' + xe(o.brk || ' ') + '</p>';
      h += x.map(l => '<p>' + htmlRuns(l) + '</p>').join('');
    });
  });
  if (I.full) h += '<p class="c" style="margin-top:1em">END</p>';
  return { html: h + '</body></html>', I };
}
// The manuscript as an EPUB ebook.
function expEpub(scope) {
  const I = expInfo(scope),
    o = I.o,
    m = S.meta,
    lang = xe((navigator.language || 'en').split(',')[0]);
  if (!o.uid) {
    o.uid = uid('bk') + uid('');
    dirty('meta');
  }
  const page = (title, body) =>
    '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="' +
    lang +
    '" xml:lang="' +
    lang +
    '"><head><meta charset="utf-8"/><title>' +
    xe(title) +
    '</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>' +
    body +
    '</body></html>';
  const files = [
    ['mimetype', 'application/epub+zip'],
    [
      'META-INF/container.xml',
      '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    ],
    [
      'OEBPS/style.css',
      'body{margin:0 5%;line-height:1.5}p{margin:0;text-indent:1.5em}h1+p,p.brk+p,p.first{text-indent:0}p.brk{text-align:center;text-indent:0;margin:1em 0}h1{text-align:center;font-weight:normal;margin:3em 0 2em;page-break-before:always}.title{text-align:center;margin-top:30%}.title h1{font-size:2em;margin:0 0 1em}.title p{text-indent:0}'
    ]
  ];
  const items = [],
    nav = [];
  if (o.title) {
    files.push([
      'OEBPS/title.xhtml',
      page(
        I.title,
        '<section class="title" epub:type="titlepage"><h1>' +
          xe(I.title) +
          '</h1>' +
          (I.byline ? '<p>' + xe(I.byline) + '</p>' : '') +
          '</section>'
      )
    ]);
    items.push('title');
  }
  I.book.forEach((c, i) => {
    const id = 'ch' + (i + 1);
    files.push([
      'OEBPS/' + id + '.xhtml',
      page(
        c.title,
        '<section epub:type="chapter"><h1>' +
          xe(c.title) +
          '</h1>' +
          c.scenes
            .map(x => x.map(l => '<p>' + htmlRuns(l) + '</p>').join(''))
            .join('<p class="brk">' + xe(o.brk || '*') + '</p>') +
          '</section>'
      )
    ]);
    items.push(id);
    nav.push('<li><a href="' + id + '.xhtml">' + xe(c.title) + '</a></li>');
  });
  files.push([
    'OEBPS/nav.xhtml',
    page('Contents', '<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>' + nav.join('') + '</ol></nav>')
  ]);
  const mod = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  files.push([
    'OEBPS/content.opf',
    '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="' +
      lang +
      '"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      '<dc:identifier id="uid">urn:inkling:' +
      xe(o.uid) +
      '</dc:identifier><dc:title>' +
      xe(I.title) +
      '</dc:title>' +
      (I.byline ? '<dc:creator>' + xe(I.byline) + '</dc:creator>' : '') +
      '<dc:language>' +
      lang +
      '</dc:language><meta property="dcterms:modified">' +
      mod +
      '</meta></metadata><manifest>' +
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>' +
      items.map(id => '<item id="' + id + '" href="' + id + '.xhtml" media-type="application/xhtml+xml"/>').join('') +
      '</manifest><spine>' +
      items.map(id => '<itemref idref="' + id + '"/>').join('') +
      '</spine></package>'
  ]);
  return zip(files);
}
// The manuscript as Markdown.
function manuscriptMd(scope) {
  const I = expInfo(scope || 'all');
  let out = '# ' + I.title + '\n\n' + (I.byline ? 'by ' + I.byline + '\n\n' : '');
  I.book.forEach(c => {
    out +=
      '## ' +
      c.title +
      '\n\n' +
      c.scenes.map(x => x.join('\n\n')).join('\n\n' + (I.o.brk || '* * *') + '\n\n') +
      '\n\n';
  });
  return out.trim() + '\n';
}
// The manuscript as plain text.
function manuscriptTxt(scope) {
  const I = expInfo(scope);
  let out = I.title + '\n' + (I.byline ? 'by ' + I.byline + '\n' : '') + '\n\n';
  I.book.forEach(c => {
    out +=
      c.title +
      '\n\n' +
      c.scenes.map(x => x.map(plainText).join('\n\n')).join('\n\n' + (I.o.brk || '#') + '\n\n') +
      '\n\n\n';
  });
  return out.trim() + '\n';
}
// Opens the browser's print window for a page (the writer chooses Save as PDF).
async function printHtml(html) {
  // the browser's print window; the writer chooses "Save as PDF"
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  f.setAttribute('aria-hidden', 'true');
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write(html);
  d.close();
  await new Promise(r => setTimeout(r, 250));
  try {
    f.contentWindow.focus();
    f.contentWindow.print();
  } catch (e) {
    toast('Printing is blocked here. Export to Word instead, then save that as a PDF.', { plain: true });
  }
  setTimeout(() => f.remove(), 60000);
}
// Exports in a format: builds the file and saves it.
async function doExport(fmt, scope) {
  const m = S.meta,
    ch = scope !== 'all' && m.chapters.find(c => c.id === scope),
    base = slug(m.title) + (ch ? '-' + slug(ch.title) : ''),
    name = base + EXP_FMTS[fmt][1];
  if (fmt === 'docx') return saveFile(name, expDocx(scope));
  if (fmt === 'epub') return saveFile(name, expEpub(scope));
  if (fmt === 'md') return saveFile(name, manuscriptMd(scope));
  if (fmt === 'txt') return saveFile(name, manuscriptTxt(scope));
  const r = expPdfHtml(scope);
  if (DESK) {
    try {
      const at = await DESK.pdf(r.html, {
        pageSize: m.exp.page === 'a4' ? 'A4' : 'Letter',
        header: r.I.head,
        font: r.I.font,
        name
      });
      if (at) toast('Saved to ' + at, { plain: true });
    } catch (e) {
      toast('Could not make the PDF.', { plain: true });
    }
    return;
  }
  printHtml(r.html);
}
// The Export dialog: format, what to include, and the manuscript details.
function openExport() {
  const m = S.meta,
    o = m.exp;
  let scope = m.chapters.some(c => c.id === ui.expScope) ? ui.expScope : 'all';
  const ov = document.createElement('div');
  ov.className = 'pj-ov';
  const close = () => {
    ov.remove();
    document.removeEventListener('keydown', key, true);
  };
  const key = e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  const draw = () => {
    const ms = o.fmt === 'docx' || o.fmt === 'pdf',
      words = expInfo(scope).words;
    ov.innerHTML =
      '<div class="pj-dlg ex" role="dialog" aria-modal="true" aria-labelledby="exH"><header><h2 id="exH">' +
      ico('book', 20) +
      'Export</h2><button class="ibtn" data-x="close" aria-label="Close">' +
      ico('x') +
      '</button></header>' +
      '<span class="sec-l">Format</span><div class="seg">' +
      Object.keys(EXP_FMTS)
        .map(
          k => '<button data-fmt="' + k + '"' + (o.fmt === k ? ' class="on"' : '') + '>' + EXP_FMTS[k][0] + '</button>'
        )
        .join('') +
      '</div>' +
      '<p class="fine">' +
      {
        docx: 'Standard manuscript format, ready to send to agents and editors, or to keep editing in Word, Google Docs or Pages.',
        pdf: DESK
          ? 'Standard manuscript format as a PDF.'
          : 'Standard manuscript format. Your browser’s print window opens: choose “Save as PDF”.',
        epub: 'An ebook for Kindle, Apple Books and other readers, to read your draft like a book.',
        md: 'Plain text with headings, for other writing apps.',
        txt: 'Just the words.'
      }[o.fmt] +
      '</p>' +
      '<div class="two"><label class="f">Include<select data-e="scope"><option value="all">The whole book</option>' +
      m.chapters
        .map(
          c => '<option value="' + c.id + '"' + (scope === c.id ? ' selected' : '') + '>' + esc(c.title) + '</option>'
        )
        .join('') +
      '</select></label>' +
      '<label class="f">Scene break<input data-e="brk" value="' +
      esc(o.brk) +
      '" maxlength="12" placeholder="#"></label></div>' +
      '<div class="two"><label class="f">Your name<input data-e="author" value="' +
      esc(m.author || '') +
      '" maxlength="120" placeholder="Your legal name"></label>' +
      '<label class="f">Byline (pen name)<input data-e="byline" value="' +
      esc(o.byline) +
      '" maxlength="120" placeholder="Same as your name"></label></div>' +
      (ms
        ? '<label class="f">Contact details for the title page<textarea data-e="contact" rows="4" maxlength="600" placeholder="Name\nStreet address\nCity, State ZIP\nemail@example.com · phone">' +
          esc(o.contact) +
          '</textarea></label>' +
          '<div class="two"><div><span class="sec-l">Font</span><div class="seg"><button data-o="font" data-v="times"' +
          (o.font === 'times' ? ' class="on"' : '') +
          '>Times New Roman</button><button data-o="font" data-v="courier"' +
          (o.font === 'courier' ? ' class="on"' : '') +
          '>Courier</button></div></div>' +
          '<div><span class="sec-l">Page size</span><div class="seg"><button data-o="page" data-v="letter"' +
          (o.page === 'letter' ? ' class="on"' : '') +
          '>Letter</button><button data-o="page" data-v="a4"' +
          (o.page === 'a4' ? ' class="on"' : '') +
          '>A4</button></div></div></div>'
        : '') +
      (o.fmt === 'md' || o.fmt === 'txt'
        ? ''
        : '<label class="ck"><input type="checkbox" data-e="title"' +
          (o.title ? ' checked' : '') +
          '>Title page' +
          (ms ? ' with word count (about ' + roundWords(words).toLocaleString() + ')' : '') +
          '</label>') +
      (ms
        ? '<label class="ck"><input type="checkbox" data-e="chNew"' +
          (o.chNew ? ' checked' : '') +
          '>Start each chapter on a new page</label>'
        : '') +
      '<p class="fine">Bold, italics and underlining from your scenes come through in Word, PDF and EPUB. Each line you type is a paragraph.</p>' +
      '<div class="ask-btns" style="margin-top:14px"><button class="btn" data-x="close">Cancel</button><button class="btn pri" data-x="go">' +
      ico('down', 14) +
      '<span>Export ' +
      EXP_FMTS[o.fmt][0] +
      '</span></button></div></div>';
  };
  ov.addEventListener('click', e => {
    if (e.target === ov) return close();
    const b = e.target.closest('[data-fmt],[data-o],[data-x]');
    if (!b) return;
    if (b.dataset.fmt) {
      o.fmt = b.dataset.fmt;
      dirty('meta');
      draw();
    } else if (b.dataset.o) {
      o[b.dataset.o] = b.dataset.v;
      dirty('meta');
      draw();
    } else if (b.dataset.x === 'close') close();
    else if (b.dataset.x === 'go') {
      close();
      doExport(o.fmt, scope);
    }
  });
  ov.addEventListener('input', e => {
    const k = e.target.dataset.e;
    if (!k || e.target.type === 'checkbox' || k === 'scope') return;
    if (k === 'author') m.author = e.target.value.slice(0, 120);
    else o[k] = e.target.value;
    dirty('meta');
  });
  ov.addEventListener('change', e => {
    const k = e.target.dataset.e;
    if (!k) return;
    if (k === 'scope') {
      scope = ui.expScope = e.target.value;
      draw();
      return;
    }
    if (e.target.type === 'checkbox') {
      o[k] = e.target.checked;
      dirty('meta');
    }
  });
  document.addEventListener('keydown', key, true);
  draw();
  document.body.appendChild(ov);
  $('[data-fmt].on', ov).focus();
}
// Fills the ⋯ menu for this environment (desktop or browser).
function renderMenu() {
  const cf = ui.confirm,
    el = $('#menu');
  const winItems = () =>
    '<hr><small class="m-h">Window</small>' +
    item('layout', 'Project settings…') +
    item('tBinder', (loHidden('binder') ? 'Show' : 'Hide') + ' the binder') +
    item('tInsp', (loHidden('insp') ? 'Show' : 'Hide') + ' the Inkling panel') +
    item('split', ui.split ? 'Close side by side' : 'Side by side') +
    item('focus', ui.focus ? 'Leave focus mode' : 'Focus mode') +
    '<hr>';
  const item = (m, label, cls) =>
    '<button data-m="' + m + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</button>';
  if (DESK) {
    el.innerHTML =
      item('save', 'Save') +
      item('projects', 'Projects…') +
      item('share', 'Share this project…') +
      '<hr>' +
      item('export', 'Export… (Word, PDF, EPUB)') +
      item('json', 'Back up this project (.json)') +
      item('import', 'Import a backup as a new project…') +
      '<hr>' +
      item('find', 'Find and replace…') +
      item('cont', 'Continuity check') +
      item('story', 'Story insights') +
      item('world', 'Calendars & money') +
      item('series', 'Series bible') +
      item('qs', 'Go to… (' + MODK + '+P)') +
      item('search', 'Search everything…') +
      item('sessions', 'Writing sessions') +
      item('plan', 'Deadline planner') +
      item('trash', 'Trash') +
      item('prefs', 'Settings') +
      winItems() +
      item('help', 'How sharing works') +
      item('keys', 'Keyboard shortcuts') +
      item('tour', 'Show the tour') +
      '<hr>' +
      item('reveal', 'Show projects folder') +
      '<small>Saved on this computer as you write. Each project folder also keeps automatic backups.</small>';
    return;
  }
  el.innerHTML =
    item('save', 'Save now') +
    '<hr>' +
    item('export', 'Export… (Word, PDF, EPUB)') +
    item('json', 'Back up project (.json)') +
    item('restore', 'Restore from a backup…') +
    '<hr>' +
    item('find', 'Find and replace…') +
    item('cont', 'Continuity check') +
    item('story', 'Story insights') +
    item('world', 'Calendars & money') +
    item('series', 'Series bible') +
    item('qs', 'Go to… (' + MODK + '+P)') +
    item('search', 'Search everything…') +
    item('sessions', 'Writing sessions') +
    item('plan', 'Deadline planner') +
    item('trash', 'Trash') +
    item('prefs', 'Settings') +
    winItems() +
    item('help', 'How sharing works') +
    item('keys', 'Keyboard shortcuts') +
    item('tour', 'Show the tour') +
    '<hr>' +
    item(
      'sample',
      cf === 'm-sample' ? 'Replace everything with the sample? Click again' : 'Load the sample project',
      'warn'
    ) +
    item(
      'blank',
      cf === 'm-blank' ? 'Replace everything with a blank project? Click again' : 'Start a blank project',
      'warn'
    ) +
    '<small>' +
    (P.db
      ? 'Your project saves automatically to your Claude account, private to you. A new project comes with its own Inky; your daily goal and timer settings carry over.'
      : 'Your project saves on this device only. Back it up from here when you can.') +
    '</small>';
}
// Makes the ⋯ menu and the restore-from-backup file picker work.
function bindMenu() {
  $('#menuBtn').innerHTML = ico('dots', 18);
  $('#menuBtn').addEventListener('click', e => {
    e.stopPropagation();
    ui.menu = !ui.menu;
    ui.confirm = null;
    $('#menu').hidden = !ui.menu;
    if (ui.menu) renderMenu();
  });
  $('#menu').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    const a = b.dataset.m;
    if (a === 'md' || a === 'export') {
      closeMenu();
      openExport();
    } else if (a === 'find') {
      closeMenu();
      openFind();
    } else if (a === 'prefs') {
      closeMenu();
      go({ k: 'prefs' });
    } else if (a === 'tour') {
      closeMenu();
      startTour(true);
    } else if (a === 'save') {
      closeMenu();
      saveNow();
    } else if (a === 'cont') {
      closeMenu();
      go({ k: 'cont' });
    } else if (a === 'share') {
      closeMenu();
      openShare();
    } else if (a === 'help') {
      closeMenu();
      go({ k: 'help' });
    } else if (a === 'json') {
      closeMenu();
      doBackup();
    } else if (a === 'projects') {
      closeMenu();
      openProjects();
    } else if (a === 'import') {
      closeMenu();
      deskImportPick();
    } else if (a === 'reveal') {
      closeMenu();
      DESK.reveal();
    } else if (a === 'sessions') {
      closeMenu();
      go({ k: 'ss' });
    } else if (
      [
        'layout',
        'tBinder',
        'tInsp',
        'focus',
        'keys',
        'plan',
        'story',
        'world',
        'series',
        'search',
        'trash',
        'split',
        'qs'
      ].includes(a)
    ) {
      closeMenu();
      winAct(a);
    } else if (a === 'restore') {
      closeMenu();
      $('#fileIn').value = '';
      $('#fileIn').click();
    } else if (a === 'sample')
      confirmDo(
        'm-sample',
        () => {
          closeMenu();
          replaceProject(normalize(sampleProject()), true);
        },
        renderMenu
      );
    else if (a === 'blank')
      confirmDo(
        'm-blank',
        () => {
          closeMenu();
          replaceProject(normalize(blankProject()), true);
        },
        renderMenu
      );
  });
  $('#fileIn').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      let o, np;
      try {
        o = JSON.parse(r.result);
        if (!o || !o.meta || !Array.isArray(o.meta.chapters)) throw 0;
        np = normalize(o);
      } catch (x) {
        toast(
          x && x.code === 'newer'
            ? 'That backup was made by a newer version of Inkling. Update Inkling to open it.'
            : 'That file is not an Inkling backup.',
          { plain: true }
        );
        return;
      }
      await adoptImages(np, o.imgs, null);
      replaceProject(np, false);
      toast('Backup restored.', { plain: true });
    };
    r.readAsText(f);
  });
}
// Saving already happens as you write; this saves anything pending right away and says so.
async function saveNow() {
  if (ui.locked) {
    toast('This project is read-only here: it was saved by a newer Inkling.', { plain: true });
    return;
  }
  try {
    clearTimeout(P.timer);
    P.dirty.add('meta');
    if (DESK) await deskFlush();
    else await flush();
  } catch (e) {}
  if ($('#saveSt').dataset.s === 'error') toast('Could not save just now. Inkling keeps trying.', { plain: true });
  else
    toast(
      DESK
        ? 'Saved to this computer.'
        : P.db
          ? 'Saved to your account.'
          : 'Saved in this browser. Back up now and then from the menu.',
      { plain: true }
    );
}
// Closes the ⋯ menu.
function closeMenu() {
  ui.menu = false;
  ui.confirm = null;
  $('#menu').hidden = true;
}
