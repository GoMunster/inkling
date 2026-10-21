/*
 * 37-print.js: Print-ready paperback and hardcover PDFs
 *
 * The print settings live in meta.book.print (normPrint): binding (paperback or hardcover), trim size (PRINT_TRIMS,
 * the sizes KDP prints), paper, book font (PRINT_FONTS, bundled in the desktop app and loaded from Google Fonts in a
 * browser), type size, line spacing, whether chapters start on a right-hand page, running heads and page numbers.
 *
 * Browsers can't lay out a book properly on their own (they won't add the blank page that puts a chapter on the right,
 * drop the running head on a chapter's first page or number from 1 where the story starts), so Inkling lays the pages
 * out itself: printLayout() builds the book in a hidden frame, one fixed-size page box at a time, splitting paragraphs
 * between pages at word boundaries with no single line left alone at the top or bottom of a page (printPass). The
 * story is laid out first, so the contents page can give page numbers, then the front matter, padded so the story
 * starts on a right-hand page. The inside margin (gutter) depends on the page count, so a book whose count crosses
 * one of KDP's steps is laid out a second time.
 *
 * The finished frame is printed as it is in a browser (the print window, "Save as PDF") and sent to DESK.pdf with
 * book:true on the desktop, which prints it edge to edge at the trim size. printFacts() gives the page count, spine
 * width and cover size for Book details.
 */
// Trim sizes KDP prints: [key, name, width in, height in, also offered for hardcover].
const PRINT_TRIMS = [
  ['5x8', '5 × 8 in', 5, 8, false],
  ['5.25x8', '5.25 × 8 in', 5.25, 8, false],
  ['5.5x8.5', '5.5 × 8.5 in', 5.5, 8.5, true],
  ['a5', 'A5 (5.83 × 8.27 in)', 5.83, 8.27, false],
  ['6x9', '6 × 9 in', 6, 9, true],
  ['6.14x9.21', '6.14 × 9.21 in', 6.14, 9.21, true],
  ['7x10', '7 × 10 in', 7, 10, true]
];
// Book fonts: [key, name (also the family a browser loads from Google Fonts), the family the desktop app bundles,
// usual size in pt, Google Fonts query]. Always fixed weights: Chromium writes a variable font into a PDF as a Type 3
// font, which some printers reject.
const PRINT_FONTS = [
  ['garamond', 'EB Garamond', 'EB Garamond', 12, 'EB+Garamond:ital,wght@0,400;0,700;1,400;1,700'],
  ['crimson', 'Crimson Pro', 'Crimson Pro', 12, 'Crimson+Pro:ital,wght@0,400;0,700;1,400;1,700'],
  ['baskerville', 'Libre Baskerville', 'Libre Baskerville', 10, 'Libre+Baskerville:ital,wght@0,400;0,700;1,400'],
  ['literata', 'Literata', 'Literata Book', 10.5, 'Literata:ital,wght@0,400;0,700;1,400;1,700']
];
// Where a browser loads a book font from (the desktop app bundles them instead).
const GOOGLE_FONTS = 'https://fonts.googleapis.com/css2?family=';
// KDP's smallest inside margin by page count: [up to this many pages, inches].
const PRINT_GUTTER = [
  [150, 0.375],
  [300, 0.5],
  [500, 0.625],
  [700, 0.75],
  [Infinity, 0.875]
];
// Paper thickness per page in inches (KDP's spine formula) and the page counts KDP accepts per binding.
const PRINT_PAPER = { white: 0.002252, cream: 0.0025 };
const PRINT_LIMITS = { pb: [24, 828], hc: [75, 550] };

// Checks the print settings (meta.book.print).
function normPrint(p) {
  p = p && typeof p === 'object' ? p : {};
  const bind = p.bind === 'hc' ? 'hc' : 'pb',
    size = +p.size;
  return {
    bind,
    trim: PRINT_TRIMS.some(t => t[0] === p.trim && (bind === 'pb' || t[4])) ? p.trim : '5.5x8.5',
    paper: bind === 'pb' && p.paper === 'white' ? 'white' : bind === 'hc' ? 'white' : 'cream',
    font: PRINT_FONTS.some(f => f[0] === p.font) ? p.font : 'garamond',
    size: size >= 8 && size <= 14 ? Math.round(size * 2) / 2 : 0, // 0: the font's usual size
    lead: [1.3, 1.4, 1.5, 1.6].includes(+p.lead) ? +p.lead : 1.4,
    recto: p.recto !== false,
    heads: ['at', 'tc', 'none'].includes(p.heads) ? p.heads : 'at',
    nums: p.nums === 'top' ? 'top' : 'bottom',
    hyph: p.hyph !== false // hyphenate long words (English books)
  };
}
const printFont = pr => PRINT_FONTS.find(f => f[0] === pr.font) || PRINT_FONTS[0];
// The CSS family of the book font here: bundled in the desktop app, or loaded from Google Fonts in a browser.
const printFamily = pr => printFont(pr)[DESK ? 2 : 1];
const printSize = pr => pr.size || printFont(pr)[3];
const printTrim = pr => PRINT_TRIMS.find(t => t[0] === pr.trim) || PRINT_TRIMS[2];
// KDP's inside margin for a page count.
const printGutter = pages => PRINT_GUTTER.find(g => pages <= g[0])[1];
// The page margins in inches for a trim and page count: KDP's gutter plus room for the curve of the binding.
function printMargins(pr, pages) {
  const w = printTrim(pr)[2];
  return { inner: printGutter(pages) + 0.25, outer: w <= 5.5 ? 0.6 : 0.7, top: 0.7, bot: 0.75 };
}

// Splits a laid-out paragraph after its k-th line, exactly where the browser broke the line (at a space, after a
// dash or a hyphen, or at a hyphenation point, which then gets its hyphen). The paragraph keeps the first k lines;
// returns the rest as a new paragraph, null if there is nothing after line k, or 'again' when line k ended in a soft
// hyphen, which it removes so the caller lays the paragraph out again (no hyphenated word across a page turn).
// Ranges clone the formatting around each half, so both stay well formed.
function splitAtLine(x, k, lh) {
  const D = x.ownerDocument,
    texts = [],
    w = D.createTreeWalker(x, NodeFilter.SHOW_TEXT);
  let n,
    total = 0;
  while ((n = w.nextNode())) {
    texts.push([n, total]);
    total += n.data.length;
  }
  const at = i => {
      let a = 0;
      while (a < texts.length - 1 && texts[a + 1][1] <= i) a++;
      return [texts[a][0], i - texts[a][1]];
    },
    top = x.getBoundingClientRect().top,
    r = D.createRange();
  // which line a character is on, or -1 for a space (a space at a line end has no reliable position)
  const lineOf = i => {
    const [node, off] = at(i);
    if (/\s/.test(node.data[off])) return -1;
    r.setStart(node, off);
    r.setEnd(node, off + 1);
    // the last box: a letter just after a hyphenated line break also reports an empty box at the end of the line before
    const rs = r.getClientRects(),
      b = rs[rs.length - 1];
    return b ? Math.floor((b.top - top + lh * 0.3) / lh) : -1;
  };
  // the first visible character on line k or later
  let lo = 0,
    hi = total - 1,
    cut = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let j = mid;
    while (j <= hi && lineOf(j) < 0) j++;
    if (j > hi) {
      hi = mid - 1;
      continue;
    }
    if (lineOf(j) >= k) {
      cut = j;
      hi = mid - 1;
    } else lo = j + 1;
  }
  if (cut <= 0) return null;
  const [cn, co] = at(cut),
    [pn, po] = at(cut - 1);
  // never a hyphenated word across a page turn: take that soft hyphen out and let the caller lay out again
  if (pn.data[po] === '\u00AD') {
    pn.deleteData(po, 1);
    return 'again';
  }
  const hyph = /\p{L}/u.test(pn.data[po]) && /\p{L}/u.test(cn.data[co]); // broken inside a word: a hyphenation point
  // the break's own spaces go with neither half
  let end = cut;
  while (end > 0 && /\s/.test(at(end - 1)[0].data[at(end - 1)[1]])) end--;
  const [en, eo] = at(end);
  r.setStart(x, 0);
  r.setEnd(en, eo);
  const first = r.cloneContents();
  r.setStart(cn, co);
  r.setEnd(x, x.childNodes.length);
  const rest = x.cloneNode(false);
  rest.appendChild(r.cloneContents());
  x.textContent = '';
  x.appendChild(first);
  if (hyph) {
    const tw = D.createTreeWalker(x, NodeFilter.SHOW_TEXT);
    let last = null;
    while ((n = tw.nextNode())) last = n;
    if (last) last.data += '-';
  }
  // the drop cap stays with the first half only
  rest.querySelectorAll('.dc').forEach(d => d.replaceWith(...d.childNodes));
  return rest;
}

// The frame's page HTML: the trim size, the book font and the styles for pages, heads, numbers and the text.
function printDocHtml(pr, M, bodyPx, lh, title) {
  const [, , W, H] = printTrim(pr),
    f = printFont(pr),
    size = printSize(pr),
    bw = W - M.inner - M.outer,
    app = document.querySelector('link[rel="stylesheet"][href*="fonts"]'),
    fam = "'" + printFamily(pr) + "',Georgia,serif",
    sink = Math.round(bodyPx * 0.24),
    footTop = M.top + bodyPx / 96 + 0.28;
  // the desktop app's bundled fonts (main.js links them by full path for the PDF), or the book font from Google Fonts
  const links = DESK
    ? app
      ? '<link rel="stylesheet" data-inkfonts href="' + esc(app.getAttribute('href')) + '">'
      : ''
    : '<link rel="stylesheet" href="' + GOOGLE_FONTS + f[4] + '&display=block">';
  const css =
    '@page{size:' +
    W +
    'in ' +
    H +
    'in;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}' +
    '.pg{position:relative;width:' +
    W +
    'in;height:' +
    H +
    'in;overflow:hidden;background:#fff;break-after:page;page-break-after:always;contain:strict}' +
    '.pg.end{break-after:auto;page-break-after:auto}' +
    '.pb,.ph,.pf{position:absolute;width:' +
    bw +
    'in;font-family:' +
    fam +
    '}.pb{top:' +
    M.top +
    'in;height:' +
    bodyPx +
    'px;font-size:' +
    size +
    'pt;line-height:' +
    lh +
    'px;text-align:justify;hyphens:auto;-webkit-hyphens:auto;font-kerning:normal;font-variant-ligatures:common-ligatures}' +
    '.r .pb,.r .ph,.r .pf{left:' +
    M.inner +
    'in}.v .pb,.v .ph,.v .pf{left:' +
    M.outer +
    'in}' +
    '.ph{top:' +
    (M.top - 0.36) +
    'in;font-size:' +
    size * 0.75 +
    'pt;line-height:1;text-align:center;letter-spacing:.14em;text-transform:uppercase}' +
    '.ph .fo{position:absolute;top:0;letter-spacing:0}.v .ph .fo{left:0}.r .ph .fo{right:0}' +
    '.pf{top:' +
    footTop +
    'in;font-size:' +
    size * 0.85 +
    'pt;line-height:1;text-align:center}' +
    // the ebook style's CSS, with its serif headings in the book font and without its page breaks (pages are boxes)
    bookCss()
      .replace(/font-family:serif/g, 'font-family:inherit')
      .replace(/h1\{page-break-before:always\}/, '') +
    '.pb h1,.pb h2,.pb h3{line-height:1.2}.pb p{orphans:1;widows:1}.pb p.cut{text-align-last:justify}.pb p.cont{text-indent:0}' +
    '.pb>h1.ch:first-child{margin-top:' +
    sink +
    'px}.pb>h1.part:first-child{margin-top:' +
    Math.round(bodyPx * 0.3) +
    'px}.pb h1{break-before:auto;page-break-before:auto}' +
    '.bk-toc{display:flex;gap:.6em;text-align:left}.bk-toc .tt{flex:1}.bk-toc .pn{flex:none}' +
    'h1.bk-title{margin-top:' +
    Math.round(bodyPx * 0.25) +
    'px}.bk-copy{margin-top:0}.pb .bk-small{line-height:1.35}';
  return (
    '<!doctype html><html lang="' +
    esc(bookLang()) +
    '"><head><meta charset="utf-8"><title>' +
    esc(title) +
    '</title>' +
    links +
    '<style>' +
    css +
    '</style></head><body><div id="front"></div><div id="main"></div></body></html>'
  );
}
// Waits for a frame's stylesheets and the book font (at most a few seconds, so an offline browser still prints in
// its fallback font).
async function printFonts(frame, pr) {
  const D = frame.contentDocument,
    fam = printFamily(pr),
    size = printSize(pr);
  // the font stylesheets themselves first: until they are in, the fonts they describe aren't known, a font check
  // passes at once and the pages would be measured in a fallback font
  await Promise.all(
    [...D.querySelectorAll('link[rel="stylesheet"]')].map(l =>
      l.sheet
        ? null
        : new Promise(r => {
            l.addEventListener('load', r, { once: true });
            l.addEventListener('error', r, { once: true });
            setTimeout(r, 8000);
          })
    )
  );
  await Promise.race([
    Promise.all(['', 'italic ', 'bold '].map(s => D.fonts.load(s + size + "pt '" + fam + "'").catch(() => null))).then(
      () => D.fonts.ready
    ),
    new Promise(r => setTimeout(r, 8000))
  ]);
}

// Lays the book out once with a given inside margin. Returns {frame, doc, count, front, body, starts, M}: the page
// count, how many pages come before the story, the story's pages, and each chapter's first page number.
async function printPass(I, pr, gutterPages, matter) {
  const M = printMargins(pr, gutterPages),
    [, , W, H] = printTrim(pr),
    lh = (printSize(pr) * pr.lead * 96) / 72,
    bodyPx = Math.floor(((H - M.top - M.bot) * 96) / lh) * lh; // the text block holds whole lines
  const frame = document.createElement('iframe');
  frame.className = 'ink-print';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText =
    'position:fixed;left:-30000px;top:0;width:' + Math.ceil(W * 96 + 40) + 'px;height:900px;border:0';
  document.body.appendChild(frame);
  const D = frame.contentDocument;
  D.open();
  D.write(printDocHtml(pr, M, bodyPx, lh, I.title));
  D.close();
  await printFonts(frame, pr);
  const verso = pr.heads === 'tc' ? I.title : I.byline || I.title,
    hy = pr.hyph && /^en\b/i.test(bookLang()); // hyphenation patterns are English
  let list, // the pages of the part being laid out (front matter or the story)
    cur, // the current page: {el, pb}
    sec, // the section being laid out: {head, num, rhead}
    work = 0;
  const page = (into, o) => {
    const n = list.length + 1,
      r = n % 2 === 1,
      el = D.createElement('div');
    el.className = 'pg ' + (r ? 'r' : 'v');
    into.appendChild(el);
    const p = { el, n, r };
    if (o !== 'blank') {
      const showHead = sec.head && o !== 'open' && pr.heads !== 'none',
        fo = sec.num && pr.nums === 'top' && showHead ? '<span class="fo">' + n + '</span>' : '';
      if (showHead || fo)
        el.innerHTML = '<div class="ph">' + (showHead ? esc(r ? sec.rhead || I.title : verso) : '') + fo + '</div>';
      if (sec.num && (pr.nums === 'bottom' || !showHead))
        el.insertAdjacentHTML('beforeend', '<div class="pf">' + n + '</div>');
      p.pb = D.createElement('div');
      p.pb.className = 'pb';
      el.appendChild(p.pb);
    }
    list.push(p);
    return p;
  };
  const fits = x => x.offsetTop + x.offsetHeight <= bodyPx + 1;
  // keep a heading or scene break with what follows it: move them to the new page too
  const carry = () => {
    const out = [];
    while (cur.pb.children.length > 1 && cur.pb.lastElementChild.matches('h1,h2,h3,p.brk,p.deco'))
      out.unshift(cur.pb.removeChild(cur.pb.lastElementChild));
    return out;
  };
  const turn = into => {
    const keep = carry();
    cur = page(into);
    keep.forEach(x => cur.pb.appendChild(x));
  };
  // places one block (a paragraph or heading) on the current page, splitting a paragraph between pages if needed
  // (moved: it was just moved to this page, so it stays even if it still doesn't fit)
  const place = async (x, into, moved) => {
    if (++work % 40 === 0) await new Promise(r => setTimeout(r));
    cur.pb.appendChild(x);
    if (hy && x.tagName === 'P' && x.offsetHeight > lh * 2.5) hyphLimit(x, lh); // at most two hyphens in a row
    if (fits(x)) return;
    const splittable = x.tagName === 'P' && !x.matches('.brk,.deco,.bk-gap,.bk-toc');
    if (splittable) {
      const room = Math.floor((bodyPx - x.offsetTop + 1) / lh),
        total = Math.round(x.offsetHeight / lh),
        k = Math.min(room, total - 2); // at least two lines on each page
      if (k >= 2) {
        const rest = splitAtLine(x, k, lh);
        if (rest === 'again') {
          // the page would have turned inside a hyphenated word: that hyphen is gone, so lay the paragraph out again
          x.remove();
          return place(x, into, moved);
        }
        if (rest) {
          x.classList.add('cut');
          rest.classList.remove('cut', 'first');
          rest.classList.add('cont');
          cur = page(into);
          return place(rest, into);
        }
      }
    }
    // taller than a page on its own (or with the heading it was moved with): leave it here, cut off
    if (cur.pb.children.length === 1 || moved) return;
    x.remove();
    turn(into);
    return place(x, into, true);
  };
  // lays out one section (a chapter, a part or a page of front or back matter) starting on a new page; returns the
  // number of its first page
  const flow = async (into, html, s) => {
    sec = s;
    if (s.recto && list.length % 2 === 1) page(into, 'blank');
    cur = page(into, 'open');
    const first = cur.n,
      tmp = D.createElement('div');
    tmp.innerHTML = html;
    if (hy) hyphenateEl(tmp);
    for (const x of [...tmp.children]) await place(x, into);
    return first;
  };

  // the story, numbered from 1 on a right-hand page
  const main = D.getElementById('main'),
    starts = {};
  list = [];
  for (const c of I.book)
    starts[c.id] = await flow(main, chapterHead(c) + chapterHtml(c.scenes), {
      recto: c.kind === 'part' || pr.recto,
      head: c.kind !== 'part',
      num: c.kind !== 'part',
      rhead: pr.heads === 'tc' ? c.title || c.label || c.name : I.title
    });
  if (matter)
    for (const pg of bookPages('back', I.toc))
      await flow(main, printMatterHtml(pg, starts), { recto: false, head: false, num: true });
  if (list.length % 2) page(main, 'blank'); // an even number of pages
  const body = list.length;

  // the front matter, with no numbers, padded so the story starts on a right-hand page
  const front = D.getElementById('front');
  list = [];
  if (matter)
    for (const pg of bookPages('front', I.toc))
      await flow(front, printMatterHtml(pg, starts), { recto: pg.key !== 'copy', head: false, num: false });
  if (list.length % 2) page(front, 'blank');
  // a blank scene break at the top or foot of a page would be lost: show an ornament there
  D.querySelectorAll('.pb > p.brk:first-child, .pb > p.brk:last-child').forEach(x => {
    if (!x.textContent.trim()) x.textContent = '* * *';
  });
  const all = D.querySelectorAll('.pg');
  if (all.length) all[all.length - 1].classList.add('end');
  return { frame, doc: D, count: list.length + body, front: list.length, body, starts, M };
}
// One page of front or back matter for print: the contents page gets page numbers.
function printMatterHtml(pg, starts) {
  if (pg.key !== 'toc') return '<section class="bk-page bk-' + pg.key + '">' + matterHtml(pg, null) + '</section>';
  return pg.blocks
    .map(b =>
      b[0] === 'toc'
        ? '<p class="bk-toc"><span class="tt">' +
          xe(b[1]) +
          '</span><span class="pn">' +
          (starts[b[2]] || '') +
          '</span></p>'
        : matterHtml({ blocks: [b] }, null)
    )
    .join('');
}
// Lays out the whole book (or one chapter, as a proof) for print. Lays it out again when the page count lands in a
// different gutter step than the first estimate. The caller removes result.frame when done.
async function printLayout(scope) {
  const I = expInfo(scope),
    pr = S.meta.book.print,
    matter = I.full && I.o.matter.print;
  let guess = Math.max(24, Math.round(I.words / 280) + 8),
    r;
  for (let pass = 0; pass < 3; pass++) {
    r = await printPass(I, pr, guess, matter);
    if (printGutter(r.count) === printGutter(guess)) break;
    if (pass < 2) r.frame.remove();
    guess = r.count;
  }
  r.html = '<!doctype html>' + r.doc.documentElement.outerHTML;
  return r;
}
// The facts KDP and a cover designer need, from a page count: spine width and the full cover's size, in inches.
function printFacts(pages) {
  const pr = S.meta.book.print,
    [, , W, H] = printTrim(pr),
    spine = pr.bind === 'pb' ? pages * PRINT_PAPER[pr.paper] : null,
    [lo, hi] = PRINT_LIMITS[pr.bind];
  return {
    pages,
    spine,
    coverW: spine == null ? null : W * 2 + spine + 0.25,
    coverH: spine == null ? null : H + 0.25,
    gutter: printGutter(pages),
    tooFew: pages < lo,
    tooMany: pages > hi,
    lo,
    hi,
    spineText: pages >= 80
  };
}
// Inches with up to three decimals, for the facts list.
const inch = x => (Math.round(x * 1000) / 1000).toString() + ' in';
// The Print book section of Book details: the settings and, after Count pages, the page count, spine and cover size.
function printSectionHtml() {
  const pr = S.meta.book.print,
    sel = (k, opts, label) =>
      '<label class="f">' +
      label +
      '<select data-bkp="' +
      k +
      '">' +
      opts
        .map(
          o =>
            '<option value="' +
            o[0] +
            '"' +
            (String(pr[k]) === String(o[0]) ? ' selected' : '') +
            '>' +
            o[1] +
            '</option>'
        )
        .join('') +
      '</select></label>';
  const f = ui.prFacts;
  return (
    '<section class="pf"><h2>Print book</h2><p class="fine">A print-ready PDF for KDP paperbacks and hardcovers (and most other printers): your trim size, KDP’s margins for the page count, chapters on right-hand pages, running heads and page numbers. Export it with Export › Print book.</p>' +
    '<div class="bk-grid">' +
    sel(
      'bind',
      [
        ['pb', 'Paperback'],
        ['hc', 'Hardcover']
      ],
      'Binding'
    ) +
    sel(
      'trim',
      PRINT_TRIMS.filter(t => pr.bind === 'pb' || t[4]).map(t => [t[0], t[1]]),
      'Trim size'
    ) +
    (pr.bind === 'pb'
      ? sel(
          'paper',
          [
            ['cream', 'Cream (usual for novels)'],
            ['white', 'White']
          ],
          'Paper'
        )
      : '<label class="f">Paper<select disabled><option>White (hardcovers are white)</option></select></label>') +
    sel(
      'font',
      PRINT_FONTS.map(x => [x[0], x[1]]),
      'Font'
    ) +
    sel(
      'size',
      [[0, 'Usual for the font (' + printFont(pr)[3] + ' pt)']].concat(
        [9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13].map(x => [x, x + ' pt'])
      ),
      'Type size'
    ) +
    sel(
      'lead',
      [
        [1.3, 'Snug'],
        [1.4, 'Normal'],
        [1.5, 'Roomy'],
        [1.6, 'Very roomy']
      ],
      'Line spacing'
    ) +
    sel(
      'heads',
      [
        ['at', 'Your name and the title'],
        ['tc', 'The title and the chapter'],
        ['none', 'None']
      ],
      'Running heads'
    ) +
    sel(
      'nums',
      [
        ['bottom', 'At the foot of the page'],
        ['top', 'Beside the running head']
      ],
      'Page numbers'
    ) +
    '<label class="ck bk-ck"><input type="checkbox" data-bkp="recto"' +
    (pr.recto ? ' checked' : '') +
    '>Start chapters on a right-hand page</label><label class="ck bk-ck"><input type="checkbox" data-bkp="hyph"' +
    (pr.hyph ? ' checked' : '') +
    '>Hyphenate long words (English books)</label></div>' +
    '<div class="bk-print" id="bkPrint">' +
    (f
      ? printFactsHtml(f)
      : '<button class="btn" data-bka="count">' +
        ico('book', 14) +
        '<span>Count pages and spine width</span></button>') +
    '</div></section>'
  );
}
// The page count, spine width, cover size and any problems, after a layout.
function printFactsHtml(f) {
  const pr = S.meta.book.print,
    [, , W, H] = printTrim(pr),
    warn = [];
  if (f.tooFew)
    warn.push(
      (pr.bind === 'hc' ? 'Hardcovers' : 'Paperbacks') +
        ' need at least ' +
        f.lo +
        ' pages. A larger type size or a smaller trim size adds pages.'
    );
  if (f.tooMany)
    warn.push(
      'KDP prints at most ' +
        f.hi +
        ' pages for a ' +
        (pr.bind === 'hc' ? 'hardcover' : 'paperback') +
        '. A smaller type size or larger trim size saves pages.'
    );
  if (!f.spineText) warn.push('Under 80 pages, KDP doesn’t allow text on the spine.');
  return (
    '<dl class="bk-facts"><dt>Pages</dt><dd>' +
    f.pages +
    '</dd><dt>Inside margin</dt><dd>' +
    inch(f.gutter + 0.25) +
    ' (KDP asks for at least ' +
    inch(f.gutter) +
    ')</dd>' +
    (f.spine != null
      ? '<dt>Spine width</dt><dd>' +
        inch(f.spine) +
        '</dd><dt>Full cover (with bleed)</dt><dd>' +
        inch(f.coverW) +
        ' × ' +
        inch(f.coverH) +
        '</dd>'
      : '<dt>Spine width</dt><dd>Hardcover spines depend on the boards: use KDP’s cover calculator with ' +
        f.pages +
        ' pages.</dd>') +
    '<dt>Trim</dt><dd>' +
    W +
    ' × ' +
    H +
    ' in, no bleed</dd></dl>' +
    (warn.length
      ? '<ul class="bk-pf">' +
        warn.map(w => '<li class="warn">' + ico('alert', 14) + '<span>' + esc(w) + '</span></li>').join('') +
        '</ul>'
      : '') +
    '<p class="fine">Your cover designer needs the full cover size; KDP’s cover calculator gives a template for it. <button class="btn sm" data-bka="count">' +
    ico('book', 13) +
    '<span>Count again</span></button></p>'
  );
}
// Lays the book out to count its pages, and shows the facts in Book details.
async function printCount(el) {
  const box = $('#bkPrint', el);
  if (box) box.innerHTML = '<p class="fine">Laying out the pages…</p>';
  const r = await printLayout('all');
  r.frame.remove();
  ui.prFacts = printFacts(r.count);
  const b2 = $('#bkPrint', el);
  if (b2 && b2.isConnected) b2.innerHTML = printFactsHtml(ui.prFacts);
}
// Exports the print-ready PDF: the desktop app saves it; a browser opens its print window ("Save as PDF").
async function exportPrint(scope, name) {
  toast('Laying out the pages…', { plain: true });
  const r = await printLayout(scope);
  if (scope === 'all') ui.prFacts = printFacts(r.count);
  if (DESK) {
    r.frame.remove();
    try {
      const at = await DESK.pdf(r.html, { book: true, name });
      if (at) toast('Saved to ' + at + ' (' + r.count + ' pages)', { plain: true });
    } catch (e) {
      toast('Could not make the PDF.', { plain: true });
    }
    return r.count;
  }
  try {
    r.frame.contentWindow.focus();
    r.frame.contentWindow.print();
  } catch (e) {
    toast('Printing is blocked here. Use the desktop app to make the print PDF.', { plain: true });
  }
  setTimeout(() => r.frame.remove(), 60000);
  return r.count;
}
