/*
 * 34-import.js: Word (.docx) import
 *
 * A .docx file is a zip of XML files. unzipFiles() reads the ones needed (stored or deflated, using the browser's own
 * DecompressionStream), and docxRead() turns word/document.xml into a list of paragraphs: their text with Inkling's
 * bold, italic and underline markers (fmtSerialize), their heading level (from the paragraph's style in
 * word/styles.xml, or its outline level) and whether a page break comes before them. Deleted tracked changes, field
 * codes, footnote marks, drawings and text boxes are left out; tables are read cell by cell.
 *
 * docxPlan() finds the book in those paragraphs. Chapters start at Heading 1 (or Heading 2, with Heading 1 then marking
 * parts), at lines like "Chapter 3", "Prologue" or "Part One", or at page breaks, whichever the document uses
 * (DOCX_MODES; "auto" picks). "Chapter 3" followed by a heading or a short title line becomes "Chapter 3: Title".
 * Scenes start at ornament lines (* * *, #, ⁂ …), at a horizontal line or picture on its own, at headings below the
 * chapter level, and, if chosen, at blank lines.
 * Parts and prologues get their chapter kind. The import dialog (openDocxImport) shows what was found, lets the writer
 * change how chapters are found, and makes a new project (docxProject) or adds the chapters to this one (docxAppend).
 * Imported words are not counted as today's writing.
 */
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
// How chapters can be found: [key, name].
const DOCX_MODES = [
  ['auto', 'Automatically'],
  ['h1', 'At Heading 1'],
  ['h2', 'At Heading 2 (Heading 1 starts a part)'],
  ['words', 'At lines like “Chapter 3” or “Prologue”'],
  ['page', 'At page breaks'],
  ['none', 'Don’t split: one chapter']
];
// A line that starts a chapter by its words: Chapter 3, Part One, Prologue, or a bare number.
const DOCX_CH_RE =
  /^(?:(?:chapter|ch\.|part|book|prologue|epilogue|interlude|afterword|foreword|preface|introduction)\b|\d{1,3}\.?$|[IVXLC]{1,7}\.?$|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)$)/i;
// A line of only ornaments, used as a scene break: * * *, #, ~, ⁂, ❧ and the like.
const DOCX_SEP_RE = /^[\s*#~•·⁂❧❦✦◆◇■□○●\-–—_=+.]{1,30}$/;

// Reads files out of a zip (stored or deflated) as {name: Uint8Array}. only: the names wanted.
async function unzipFiles(bytes, only) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    td = new TextDecoder(),
    out = {};
  let e = bytes.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; // the end of the central directory
  if (e < 0) throw { code: 'notzip' };
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  for (let i = 0; i < count && dv.getUint32(p, true) === 0x02014b50; i++) {
    const method = dv.getUint16(p + 10, true),
      size = dv.getUint32(p + 20, true),
      nlen = dv.getUint16(p + 28, true),
      local = dv.getUint32(p + 42, true),
      name = td.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    if (only && !only.includes(name)) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true),
      data = bytes.subarray(start, start + size);
    if (method === 0) out[name] = data;
    else if (method === 8)
      out[name] = new Uint8Array(
        await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()
      );
  }
  return out;
}

// The paragraphs of a Word document: {paras: [{text, plain, level, brk}], title, author}. level is 0 for body text,
// 1–9 for a heading, 'title' or 'sub' for the Title and Subtitle styles; brk: a page break comes first.
async function docxRead(buf) {
  const files = await unzipFiles(new Uint8Array(buf), ['word/document.xml', 'word/styles.xml', 'docProps/core.xml']);
  if (!files['word/document.xml']) throw { code: 'notdocx' };
  const xml = n =>
    files[n] ? new DOMParser().parseFromString(new TextDecoder().decode(files[n]), 'application/xml') : null;
  const doc = xml('word/document.xml'),
    styles = xml('word/styles.xml'),
    core = xml('docProps/core.xml');
  const kid = (el, n) => (el ? [...el.children].find(c => c.localName === n) : null),
    val = el => (el ? el.getAttributeNS(W_NS, 'val') : null),
    // a switch like <w:i/> or <w:i w:val="0"/>: null when not set
    flag = el => (el ? !['0', 'false', 'off', 'none'].includes(val(el) || '') : null);

  // styles: their names, levels and character formatting, following "based on"
  const sm = {};
  if (styles)
    [...styles.getElementsByTagNameNS(W_NS, 'style')].forEach(s => {
      const rPr = kid(s, 'rPr'),
        pPr = kid(s, 'pPr');
      sm[s.getAttributeNS(W_NS, 'styleId')] = {
        name: (val(kid(s, 'name')) || '').toLowerCase(),
        based: val(kid(s, 'basedOn')),
        ol: val(kid(pPr, 'outlineLvl')),
        b: flag(kid(rPr, 'b')),
        i: flag(kid(rPr, 'i')),
        u: flag(kid(rPr, 'u'))
      };
    });
  const chain = id => {
    const out = [];
    for (let k = 0; id && sm[id] && k < 12; k++, id = sm[id].based) out.push(sm[id]);
    return out;
  };
  const levelOf = id => {
    for (const s of chain(id)) {
      const h = s.name.match(/^heading\s*([1-9])$/);
      if (h) return +h[1];
      if (s.name === 'title') return 'title';
      if (s.name === 'subtitle') return 'sub';
      if (s.ol != null && +s.ol < 9) return +s.ol + 1;
    }
    return 0;
  };
  const styleFlag = (id, k) => {
    for (const s of chain(id)) if (s[k] != null) return s[k];
    return false;
  };

  const paras = [],
    SKIP = new Set([
      'del',
      'moveFrom',
      'pPr',
      'rPr',
      'drawing',
      'pict',
      'AlternateContent',
      'object',
      'footnoteReference',
      'endnoteReference',
      'commentReference',
      'instrText',
      'fldChar'
    ]);
  // one paragraph (a line break inside it starts a new one, as each line is a paragraph in Inkling)
  const para = p => {
    const pPr = kid(p, 'pPr'),
      sid = val(kid(pPr, 'pStyle'));
    let level = levelOf(sid);
    const ol = val(kid(pPr, 'outlineLvl'));
    if (ol != null && +ol < 9) level = +ol + 1;
    let brk = !!flag(kid(pPr, 'pageBreakBefore')),
      chars = [];
    const base = { b: styleFlag(sid, 'b'), i: styleFlag(sid, 'i'), u: styleFlag(sid, 'u') };
    // a paragraph holding only a horizontal line, a border or a picture is a scene break
    const rule =
      !!kid(pPr, 'pBdr') ||
      [...p.getElementsByTagName('*')].some(x => x.localName === 'pict' || x.localName === 'drawing');
    const push = () => {
      const plain = chars.map(c => c[0]).join(''),
        text = level ? plain.trim() : fmtSerialize(chars).trim();
      paras.push({ text, plain: plain.trim(), level, brk, sep: rule && !plain.trim() });
      chars = [];
      brk = false;
    };
    const run = r => {
      const rPr = kid(r, 'rPr'),
        cs = val(kid(rPr, 'rStyle')),
        get = k => {
          const d = flag(kid(rPr, k));
          return d != null ? d : cs && styleFlag(cs, k) ? true : base[k];
        },
        f = (get('b') ? 1 : 0) | (get('i') ? 2 : 0) | (get('u') ? 4 : 0);
      for (const c of r.children) {
        const n = c.localName;
        if (n === 't') for (const ch of c.textContent) chars.push([ch, f]);
        else if (n === 'tab') chars.push(['\t', f]);
        else if (n === 'noBreakHyphen') chars.push(['-', f]);
        else if (n === 'br' || n === 'cr') {
          const type = c.getAttributeNS(W_NS, 'type');
          if (type === 'page' || type === 'column') {
            if (chars.some(x => x[0].trim())) push();
            brk = true;
          } else push();
        }
      }
    };
    const walk = el => {
      for (const c of el.children) {
        if (SKIP.has(c.localName)) continue;
        if (c.localName === 'r') run(c);
        else walk(c); // hyperlinks, insertions, smart tags, fields
      }
    };
    walk(p);
    push();
  };
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
  const blocks = el => {
    for (const c of el.children) {
      if (c.localName === 'p') para(c);
      else if (['tbl', 'tr', 'tc', 'sdt', 'sdtContent', 'customXml', 'ins', 'smartTag'].includes(c.localName))
        blocks(c);
    }
  };
  if (body) blocks(body);
  // tidy each paragraph: no indenting tabs or spaces, single spaces inside
  paras.forEach(x => {
    x.text = x.text.replace(/\t+/g, ' ').replace(/ {2,}/g, ' ');
    x.plain = x.plain.replace(/\s+/g, ' ');
  });
  const dc = n => {
    const el = core && core.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', n)[0];
    return el ? el.textContent.trim() : '';
  };
  return { paras, title: dc('title'), author: dc('creator') };
}

// How many words a paragraph list holds.
const docxWords = list => list.reduce((a, p) => a + wc(p.plain), 0);
// Whether a line looks like it starts a chapter by its words (Chapter 3, Prologue, Part One, IV).
const docxChLine = p => !!p.plain && p.plain.split(' ').length <= 10 && DOCX_CH_RE.test(p.plain);
// Whether a paragraph is a scene-break ornament line.
const docxSep = p => p.sep || (!!p.plain && DOCX_SEP_RE.test(p.plain) && !/[\p{L}\p{N}]/u.test(p.plain));

// Finds the book in a document's paragraphs. o: {mode, blank (blank lines start scenes), front (keep the text before
// the first chapter)}. Returns {mode (what auto chose), title, sub, author, chapters: [{title, kind, scenes: [{title,
// lines}]}], words, pre (words before the first chapter)}.
function docxPlan(d, o) {
  const P = d.paras.slice(),
    count = f => P.filter(f).length;
  // a manuscript's closing "END" marker (standard manuscript format) is not part of the story
  for (let k = P.length - 1; k >= 0; k--) {
    if (!P[k].plain) continue;
    if (/^(?:THE )?END\.?$/.test(P[k].plain)) P.splice(k, 1);
    break;
  }
  let mode = o.mode;
  if (mode === 'auto')
    mode =
      count(p => p.level === 1 && p.plain) >= 2
        ? 'h1'
        : count(p => p.level === 2 && p.plain) >= 2
          ? 'h2'
          : count(docxChLine) >= 2
            ? 'words'
            : count(p => p.brk && p.plain) >= 2
              ? 'page'
              : 'none';
  const chLevel = mode === 'h1' ? 1 : mode === 'h2' ? 2 : 0;
  const starts = p =>
    !!p.plain &&
    (mode === 'h1'
      ? p.level === 1
      : mode === 'h2'
        ? p.level === 1 || p.level === 2
        : mode === 'words'
          ? docxChLine(p)
          : mode === 'page'
            ? p.brk && p.plain.split(' ').length <= 12
            : false);
  const kindOf = (t, p) =>
    (mode === 'h2' && p.level === 1) || /^part\b/i.test(t)
      ? 'part'
      : /^(?:prologue|epilogue|interlude|afterword|foreword|preface|introduction)\b/i.test(t)
        ? 'un'
        : '';
  let title = '',
    sub = '',
    cur = null,
    scene = null,
    gap = false;
  const chapters = [],
    pre = [];
  const newScene = t => {
    scene = { title: t || '', lines: [] };
    cur.scenes.push(scene);
    gap = false;
  };
  const newChapter = (t, kind) => {
    cur = { title: t, kind, scenes: [] };
    chapters.push(cur);
    newScene('');
  };
  if (mode === 'none') newChapter('', '');
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (p.level === 'title') {
      if (!title) title = p.plain;
      continue;
    }
    if (p.level === 'sub') {
      if (!sub) sub = p.plain;
      continue;
    }
    if (starts(p)) {
      let t = p.plain;
      // "Chapter 3" and its title on the next line become "Chapter 3: Title"
      if (/^(?:chapter|part|book)\s+\S+\.?$|^\d{1,3}\.?$|^[IVXLC]{1,7}\.?$/i.test(t)) {
        let j = i + 1;
        while (j < P.length && !P[j].plain) j++;
        const n = P[j];
        if (
          n &&
          !starts(n) &&
          !docxSep(n) &&
          (n.level ? typeof n.level === 'number' : mode !== 'h1' && mode !== 'h2') &&
          n.plain.split(' ').length <= 8 &&
          !/[.?!,;:"“”]$/.test(n.plain) &&
          !/^["“‘']/.test(n.plain)
        ) {
          t = t.replace(/\.$/, '') + ': ' + n.plain;
          i = j;
        }
      }
      newChapter(t, kindOf(t, p));
      continue;
    }
    if (!cur) {
      if (p.plain) pre.push(p);
      continue;
    }
    if (docxSep(p) || (chLevel && typeof p.level === 'number' && p.level > chLevel && p.plain)) {
      if (scene.lines.length || scene.title) newScene(docxSep(p) ? '' : p.plain);
      else if (!docxSep(p)) scene.title = p.plain;
      continue;
    }
    if (!p.plain) {
      if (o.blank && scene.lines.length) gap = true;
      continue;
    }
    if (gap) newScene('');
    scene.lines.push(p.text);
  }
  // the text before the first chapter: a chapter of its own when kept
  if (pre.length && o.front && mode !== 'none') {
    chapters.unshift({ title: 'Opening pages', kind: 'un', scenes: [{ title: '', lines: pre.map(p => p.text) }] });
  }
  chapters.forEach((c, ci) => {
    c.scenes = c.scenes.filter(s => s.lines.length || s.title);
    if (!c.scenes.length) c.scenes.push({ title: '', lines: [] });
    c.scenes.forEach((s, k) => (s.title = s.title || 'Scene ' + (k + 1)));
    if (!c.title) c.title = mode === 'none' ? title || 'Chapter 1' : 'Chapter ' + (ci + 1);
  });
  const words = chapters.reduce(
    (a, c) => a + c.scenes.reduce((b, s) => b + s.lines.reduce((x, l) => x + wc(plainText(l)), 0), 0),
    0
  );
  return { mode, title: title || d.title, sub, author: d.author, chapters, words, pre: docxWords(pre) };
}

// A new project made from a plan (its words are not counted as today's writing).
function docxProject(plan, title, author) {
  const np = blankProject(),
    m = np.meta;
  m.title = (title || 'Untitled novel').slice(0, 90);
  m.author = (author || '').slice(0, 120);
  m.target = Math.max(80000, Math.ceil(plan.words / 10000) * 10000);
  m.chapters = [];
  m.scenes = {};
  np.sc = {};
  docxAdd(np, plan);
  if (plan.sub) m.book = { subtitle: plan.sub };
  return np;
}
// Puts a plan's chapters and scenes at the end of a project. Returns the ids of the new scenes.
function docxAdd(pj, plan) {
  const ids = [];
  plan.chapters.forEach(c => {
    const ch = { id: uid('c_'), title: c.title.slice(0, 120), open: false, scenes: [] };
    if (c.kind) ch.kind = c.kind;
    c.scenes.forEach(s => {
      const id = uid('s_'),
        text = s.lines.join('\n');
      ch.scenes.push(id);
      pj.meta.scenes[id] = { title: s.title.slice(0, 100), status: 'draft', words: wc(plainText(text)) };
      pj.sc[id] = { text, synopsis: '', notes: '', stickies: [] };
      ids.push(id);
    });
    pj.meta.chapters.push(ch);
  });
  if (pj.meta.chapters[0]) pj.meta.chapters[0].open = true;
  return ids;
}
// Adds the chapters of a plan to the open project, after its own chapters.
function docxAppend(plan) {
  const ids = docxAdd(S, plan);
  ids.forEach(id => dirty('sc_' + id));
  dirty('meta');
  linker = buildLinker();
  renderAll();
  if (ids[0]) go({ k: 'scene', id: ids[0] });
}

/* ---------- choosing a file and the import dialog ---------- */
// Opens the file picker for a Word document.
function docxPick() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (f) openDocxImport(f.name, await f.arrayBuffer());
  };
  inp.click();
}
// The import dialog: what was found in the document, how to find chapters, the title, and where it goes.
async function openDocxImport(name, buf) {
  let d;
  try {
    d = await docxRead(buf);
  } catch (e) {
    toast(
      /\.doc$/i.test(name)
        ? 'That is an older .doc file. Open it in Word and use Save As › Word Document (.docx), then import that.'
        : 'That file could not be read as a Word document (.docx).',
      { plain: true }
    );
    return;
  }
  const o = { mode: 'auto', blank: false, front: false, where: 'new' };
  let plan = docxPlan(d, o);
  o.front = plan.pre > 300; // a long opening is probably story, not a title page
  plan = docxPlan(d, o);
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
  const fileTitle = name.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ');
  const listHtml = () => {
    const ch = plan.chapters,
      n = ch.reduce((a, c) => a + c.scenes.length, 0),
      how = DOCX_MODES.find(x => x[0] === plan.mode)[1].toLowerCase();
    return (
      '<p class="dx-sum"><b>' +
      fmt(ch.length) +
      ' chapter' +
      (ch.length === 1 ? '' : 's') +
      '</b>, ' +
      fmt(n) +
      ' scene' +
      (n === 1 ? '' : 's') +
      ' and ' +
      fmt(plan.words) +
      ' words' +
      (o.mode === 'auto' ? ' (chapters found ' + esc(how) + ')' : '') +
      '.</p><ol class="dx-list">' +
      ch
        .slice(0, 300)
        .map(
          c =>
            '<li><span class="dx-t">' +
            esc(c.title) +
            (c.kind ? ' <i class="ch-kind">' + (c.kind === 'part' ? 'Part' : 'Unnumbered') + '</i>' : '') +
            '</span><small class="muted">' +
            c.scenes.length +
            ' scene' +
            (c.scenes.length === 1 ? '' : 's') +
            ' · ' +
            fmt(c.scenes.reduce((a, s) => a + s.lines.reduce((b, l) => b + wc(plainText(l)), 0), 0)) +
            ' words</small></li>'
        )
        .join('') +
      (ch.length > 300 ? '<li class="muted">and ' + (ch.length - 300) + ' more</li>' : '') +
      '</ol>'
    );
  };
  ov.innerHTML =
    '<div class="pj-dlg dx" role="dialog" aria-modal="true" aria-labelledby="dxH"><header><h2 id="dxH">' +
    ico('upload', 20) +
    'Import from Word</h2><button class="ibtn" data-x="close" aria-label="Close">' +
    ico('x') +
    '</button></header><p class="fine">' +
    esc(name) +
    ' · your Word file is not changed.</p>' +
    '<div class="two"><label class="f">Title<input data-dx="title" maxlength="90" value="' +
    esc(plan.title || fileTitle) +
    '"></label><label class="f">Your name<input data-dx="author" maxlength="120" value="' +
    esc(plan.author || S.meta.author || '') +
    '"></label></div>' +
    '<div class="two"><label class="f">Find chapters<select data-dx="mode">' +
    DOCX_MODES.map(x => '<option value="' + x[0] + '">' + x[1] + '</option>').join('') +
    '</select></label><label class="f">Put it<select data-dx="where"><option value="new">In a new project</option><option value="add">At the end of this project</option></select></label></div>' +
    '<label class="ck"><input type="checkbox" data-dx="blank">A blank line also starts a new scene</label>' +
    (plan.pre
      ? '<label class="ck"><input type="checkbox" data-dx="front"' +
        (o.front ? ' checked' : '') +
        '>Keep the ' +
        fmt(plan.pre) +
        ' words before the first chapter (a title page, copyright…) as a chapter</label>'
      : '') +
    '<div class="dx-found" id="dxFound">' +
    listHtml() +
    '</div>' +
    '<p class="fine">Italics, bold and underlining come through. Imported words don’t count towards today’s goal.</p>' +
    '<div class="ask-btns"><button class="btn" data-x="close">Cancel</button><button class="btn pri" data-x="go">' +
    ico('upload', 14) +
    '<span>Import</span></button></div></div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown', key, true);
  ov.addEventListener('change', e => {
    const k = e.target.dataset.dx;
    if (!k || k === 'title' || k === 'author') return;
    o[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    plan = docxPlan(d, o);
    $('#dxFound', ov).innerHTML = listHtml();
  });
  ov.addEventListener('click', async e => {
    if (e.target === ov) return close();
    const b = e.target.closest('[data-x]');
    if (!b) return;
    if (b.dataset.x === 'close') return close();
    const title = $('[data-dx="title"]', ov).value.trim() || fileTitle,
      author = $('[data-dx="author"]', ov).value.trim();
    close();
    await docxFinish(plan, o.where, title, author);
  });
  $('[data-dx="mode"]', ov).focus();
}
// Makes the import happen: a new project (on the desktop, alongside the others; in a browser, in place of the open
// one after asking), or the chapters added to this project.
async function docxFinish(plan, where, title, author) {
  const done = () =>
    toast(
      'Imported ' +
        fmt(plan.chapters.length) +
        ' chapter' +
        (plan.chapters.length === 1 ? '' : 's') +
        ' and ' +
        fmt(plan.words) +
        ' words.',
      { plain: true }
    );
  if (where === 'add') {
    docxAppend(plan);
    return done();
  }
  const np = normalize(docxProject(plan, title, author));
  if (DESK) {
    pmHalt();
    await deskFlush();
    const id = await deskCreate(np);
    await deskOpen(id);
    return done();
  }
  const a = await ask(
    'Replace this project?',
    'Inkling in a browser keeps one project at a time, so the import takes the place of “' +
      esc(S.meta.title) +
      '”. Back it up first if you want to keep it.',
    [
      ['backup', 'Back up, then import'],
      ['go', 'Replace it', 'danger'],
      ['no', 'Cancel']
    ]
  );
  if (a !== 'backup' && a !== 'go') return;
  if (a === 'backup') doBackup();
  replaceProject(np, true);
  done();
}
