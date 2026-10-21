/*
 * 36-preview.js: Book preview, the ebook on a reading device and the print book as spreads
 *
 * The Book preview view ({k:'preview'}, renderPreview) has two tabs. Ebook shows one part of the book (the cover, the
 * front matter, a chapter or the back matter, pvContent) in the chosen book style on a phone, tablet or Kindle screen
 * (PV_DEVICES), page by page as a reader would turn them: the text is set in columns one screen wide inside a frame
 * (pvEbook), with the reader's text size and a white, sepia or night page (PV_THEMES). Print lays the whole book out
 * with printLayout() (35-print.js) and shows its pages as two-page spreads, the first page on the right, with a jump to
 * any chapter and a zoom.
 *
 * The preview can also sit beside the writing (side by side, {k:'preview'} in ui.split, pvSideHtml/pvSide): it shows
 * the chapter being written, as an ebook page or as a print proof of that chapter, and follows the text as it changes
 * (pvTouch, called from dirty()). The reader's choices (device, size, theme, tab, zoom) are kept per device in
 * localStorage inkling:pv.
 */
// Reading devices: [key, name, screen width, screen height, text size in px]. Sizes are CSS pixels, scaled to fit.
const PV_DEVICES = [
  ['phone', 'Phone', 390, 760, 17],
  ['tablet', 'Tablet', 620, 860, 19],
  ['kindle', 'Kindle', 530, 706, 18]
];
// Reading themes: [key, name, page colour, text colour].
const PV_THEMES = [
  ['white', 'White', '#ffffff', '#1b1b1b'],
  ['sepia', 'Sepia', '#f4ecd8', '#3d3022'],
  ['night', 'Night', '#121212', '#d6d6d6']
];
// Text sizes a reader can pick (a share of the device's usual size).
const PV_SIZES = [0.8, 0.9, 1, 1.15, 1.3, 1.5];
// The reader's preview choices on this device.
let PV = (() => {
  let x = {};
  try {
    x = JSON.parse(localStorage.getItem('inkling:pv') || '{}') || {};
  } catch (e) {}
  return {
    tab: x.tab === 'print' ? 'print' : 'ebook',
    dev: PV_DEVICES.some(d => d[0] === x.dev) ? x.dev : 'phone',
    size: PV_SIZES.includes(x.size) ? x.size : 1,
    theme: PV_THEMES.some(t => t[0] === x.theme) ? x.theme : 'white',
    zoom: ['fit', '0.5', '0.75', '1'].includes(x.zoom) ? x.zoom : 'fit',
    side: x.side === 'print' ? 'print' : 'ebook'
  };
})();
// Remembers the preview choices on this device.
function pvSave() {
  try {
    localStorage.setItem('inkling:pv', JSON.stringify(PV));
  } catch (e) {}
}
// Counts changes to the project, so the print preview knows when its layout is out of date.
let PV_CHG = 0;

// What to preview: 'cover', 'front', 'back' or a chapter id. Defaults to the chapter being written.
function pvSel() {
  const m = S.meta,
    sel = ui.pvSel,
    ok =
      sel === 'front' ||
      sel === 'back' ||
      (sel === 'cover' && hasPic(m.book.cover)) ||
      m.chapters.some(c => c.id === sel);
  return ok ? sel : pvChapterOf(ui.lastScene) || (m.chapters[0] || {}).id || 'front';
}
// The chapter that holds a scene.
const pvChapterOf = sid => (S.meta.chapters.find(c => c.scenes.includes(sid)) || {}).id;
// The choices for what to preview: the cover, the front matter, each chapter and the back matter.
function pvSelOptions(cur) {
  const H = chHeads(),
    o = (v, l) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(l) + '</option>';
  return (
    (hasPic(S.meta.book.cover) ? o('cover', 'Cover') : '') +
    o('front', 'Front matter') +
    S.meta.chapters.map(c => o(c.id, chHeadText(H[c.id], ' · ') || c.title)).join('') +
    o('back', 'Back matter')
  );
}
// The ebook HTML for one part of the book: the cover, the front or back matter pages, or a chapter.
function pvContent(sel) {
  if (sel === 'cover') {
    const src = picSrc('cover');
    return src
      ? '<div class="cover"><img src="' + esc(src) + '" alt="The cover"></div>'
      : '<p class="pv-none">No cover yet. Add one in Book details.</p>';
  }
  if (sel === 'front' || sel === 'back') {
    const toc = expBook('all').map(c => ({ id: c.id, text: chHeadText(c) || c.name })),
      pages = bookPages(sel, toc);
    return (
      pages.map(pg => '<section class="bk-page bk-' + pg.key + '">' + matterHtml(pg, null) + '</section>').join('') ||
      '<p class="pv-none">No ' +
        (sel === 'front' ? 'front' : 'back') +
        ' matter is switched on. Choose the pages in Book details.</p>'
    );
  }
  const c = expBook(sel)[0];
  return c ? chapterHead(c) + chapterHtml(c.scenes) : '';
}
// The ebook page's CSS: the book style, set in columns one screen wide so each column is a page.
function pvCss() {
  const th = PV_THEMES.find(t => t[0] === PV.theme),
    dev = PV_DEVICES.find(d => d[0] === PV.dev);
  return (
    'html,body{margin:0;height:100%;overflow:hidden}body{background:' +
    th[2] +
    ';color:' +
    th[3] +
    ";font-family:'Literata',Georgia,serif;font-size:" +
    Math.round(dev[4] * PV.size * 10) / 10 +
    'px;line-height:1.55;-webkit-font-smoothing:antialiased}' +
    '#flow{height:100vh;box-sizing:border-box;padding:6vh 6vw;column-width:88vw;column-gap:12vw;column-fill:auto;transition:transform .25s ease}' +
    bookCss().replace(/h1\{page-break-before:always\}/, '') +
    '.bk-page{break-before:column}.bk-page:first-child{break-before:auto}.bk-title{margin-top:20vh}' +
    '.cover{text-align:center;height:100%}.cover img{max-width:100%;max-height:86vh}' +
    '.pv-none{text-indent:0;opacity:.6;font-style:italic;margin-top:30vh;text-align:center}' +
    (PV.theme === 'night' ? 'a{color:#9fb4ff}' : '')
  );
}
// Draws an ebook reading device in host and returns its controls: show(html, page or fraction) puts the text in,
// keeping the page the reader is on; go(page) turns to a page. fit: 'width' or 'height' of host to scale into.
function pvEbook(host, fit) {
  const dev = PV_DEVICES.find(d => d[0] === PV.dev),
    [, , W, H] = dev;
  host.innerHTML =
    '<div class="pv-dev pv-' +
    dev[0] +
    '"><div class="pv-scale"><iframe class="pv-frame" title="Ebook preview" width="' +
    W +
    '" height="' +
    H +
    '"></iframe></div></div><div class="pv-nav"><button class="ibtn" data-pvp="-1" aria-label="Previous page">' +
    ico('back', 16) +
    '</button><span class="pv-pg mono">Page 1</span><button class="ibtn" data-pvp="1" aria-label="Next page">' +
    ico('right', 16) +
    '</button></div>';
  const frame = $('.pv-frame', host),
    scale = $('.pv-scale', host),
    label = $('.pv-pg', host);
  // scale the device to fit the space it has
  const room = fit === 'width' ? (host.clientWidth || 360) - 28 : Math.max(320, innerHeight - 260);
  const k = Math.min(1, fit === 'width' ? room / W : room / H);
  scale.style.cssText = 'width:' + W * k + 'px;height:' + H * k + 'px';
  frame.style.transform = 'scale(' + k + ')';
  const D = frame.contentDocument,
    app = document.querySelector('link[rel="stylesheet"][href*="fonts"]');
  D.open();
  D.write(
    '<!doctype html><html lang="' +
      esc(bookLang()) +
      '"><head><meta charset="utf-8">' +
      (app ? '<link rel="stylesheet" href="' + esc(app.getAttribute('href')) + '">' : '') +
      '<style id="pvcss"></style></head><body><div id="flow"></div></body></html>'
  );
  D.close();
  const ctl = { page: 0, pages: 1 };
  const count = () => {
    const end = D.getElementById('pvEnd'),
      w = D.documentElement.clientWidth || W;
    ctl.pages = end ? Math.max(1, Math.floor((end.getBoundingClientRect().left + ctl.page * w + 1) / w) + 1) : 1;
  };
  ctl.go = n => {
    count();
    ctl.page = Math.max(0, Math.min(ctl.pages - 1, n));
    D.getElementById('flow').style.transform = 'translateX(' + -100 * ctl.page + 'vw)';
    label.textContent = 'Page ' + (ctl.page + 1) + ' of ' + ctl.pages;
  };
  // where: a page number, or {frac} for a share of the way through (to follow the scene being written)
  ctl.show = (html, where) => {
    D.getElementById('pvcss').textContent = pvCss();
    D.getElementById('flow').innerHTML = html + '<span id="pvEnd"></span>';
    const turn = () => {
      count();
      ctl.go(where && where.frac != null ? Math.floor(where.frac * ctl.pages) : where == null ? ctl.page : where);
    };
    turn();
    D.fonts.ready.then(turn); // the book font changes how many pages there are
  };
  host.onclick = e => {
    const b = e.target.closest('[data-pvp]');
    if (b) ctl.go(ctl.page + +b.dataset.pvp);
  };
  // tap the right or left side of the screen to turn the page, as on a reader
  D.addEventListener('click', e => ctl.go(ctl.page + (e.clientX > (D.documentElement.clientWidth || W) / 3 ? 1 : -1)));
  host.tabIndex = 0;
  host.onkeydown = e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') ctl.go(ctl.page + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') ctl.go(ctl.page - 1);
    else return;
    e.preventDefault();
  };
  return ctl;
}

/* ---------- print spreads ---------- */
// The print book's pages as spreads: the laid-out book with styles that set pages in pairs, the first on the right.
function pvSpreadHtml(html, zoom, single) {
  const css =
    '<style>html{background:#7c828c}body{display:grid;grid-template-columns:repeat(' +
    (single ? 1 : 2) +
    ',max-content);justify-content:center;row-gap:26px;padding:26px 0 60px;zoom:' +
    zoom +
    '}#front,#main{display:contents}.pg{box-shadow:0 2px 10px rgba(0,0,0,.35)}' +
    (single
      ? ''
      : '.pg.v{box-shadow:-2px 2px 10px rgba(0,0,0,.35),inset -14px 0 14px -14px rgba(0,0,0,.25)}.pg.r{box-shadow:2px 2px 10px rgba(0,0,0,.35),inset 14px 0 14px -14px rgba(0,0,0,.25)}.pg.first{grid-column:2}') +
    '</style>';
  return html.replace('</head>', css + '</head>').replace(/<div class="pg r/, '<div class="pg first r');
}
// Lays the whole book out for the Print tab (keeping the result until the book changes).
async function pvLayout() {
  const tok = (ui.pvTok = (ui.pvTok || 0) + 1),
    chg = PV_CHG,
    r = await printLayout('all');
  r.frame.remove();
  if (tok !== ui.pvTok) return null; // a newer layout was asked for
  ui.pvPrint = { html: r.html, starts: r.starts, front: r.front, count: r.count, chg, sig: pvPrintSig() };
  ui.prFacts = printFacts(r.count);
  return ui.pvPrint;
}
// What the print layout depends on besides the text: the book's settings.
const pvPrintSig = () => JSON.stringify([S.meta.book, S.meta.exp.matter, S.meta.exp.byline, S.meta.author]);

/* ---------- the Book preview view ---------- */
// The Book preview view: the Ebook and Print tabs.
function renderPreview(el) {
  const sel = pvSel(),
    tab = PV.tab;
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('book', 16) +
    '</span><h1 class="mh-title">Book preview</h1><div class="seg pv-tabs"><button data-pvt="ebook"' +
    (tab === 'ebook' ? ' class="on"' : '') +
    '>Ebook</button><button data-pvt="print"' +
    (tab === 'print' ? ' class="on"' : '') +
    '>Print</button></div><button class="btn" data-pva="side" title="Show the preview beside the scene you are writing">' +
    ico('split', 14) +
    '<span>Beside the writing</span></button></div><div class="pv-wrap" id="pvWrap"></div>';
  const wrap = $('#pvWrap', el);
  $('.main-head', el).onclick = e => {
    const t = e.target.closest('[data-pvt]'),
      a = e.target.closest('[data-pva]');
    if (t) {
      PV.tab = t.dataset.pvt;
      pvSave();
      renderPreview(el);
    } else if (a) {
      const sid = S.meta.scenes[ui.lastScene] ? ui.lastScene : (orderedScenes()[0] || {}).id;
      ui.split = ui.lastSplit = { k: 'preview', id: '' };
      if (sid) go({ k: 'scene', id: sid });
      renderSplit();
    }
  };
  if (tab === 'ebook') pvEbookTab(wrap, sel);
  else pvPrintTab(wrap, sel);
}
// The Ebook tab: what to show, the device, text size and theme, and the device itself.
function pvEbookTab(wrap, sel) {
  const seg = (k, list, cur) =>
    '<div class="seg sm">' +
    list
      .map(
        x =>
          '<button data-pvo="' +
          k +
          '" data-v="' +
          x[0] +
          '"' +
          (String(cur) === String(x[0]) ? ' class="on"' : '') +
          '>' +
          x[1] +
          '</button>'
      )
      .join('') +
    '</div>';
  wrap.innerHTML =
    '<div class="pv-bar"><select data-pvsel aria-label="Part of the book">' +
    pvSelOptions(sel) +
    '</select>' +
    seg(
      'dev',
      PV_DEVICES.map(d => [d[0], d[1]]),
      PV.dev
    ) +
    '<span class="pv-size"><button class="ibtn" data-pvz="-1" aria-label="Smaller text">A−</button><button class="ibtn" data-pvz="1" aria-label="Larger text">A+</button></span>' +
    seg(
      'theme',
      PV_THEMES.map(t => [t[0], t[1]]),
      PV.theme
    ) +
    '</div><div class="pv-stage" id="pvStage"></div><p class="fine pv-note">Each reader looks a little different: Kindle and Apple Books let readers choose the font and size. Headings, drop caps, scene breaks and front and back matter come from Book details.</p>';
  const ctl = pvEbook($('#pvStage', wrap), 'height');
  ctl.show(pvContent(sel), 0);
  ui.pvCtl = ctl;
  wrap.onchange = e => {
    if (e.target.dataset.pvsel == null) return;
    ui.pvSel = e.target.value;
    ctl.show(pvContent(e.target.value), 0);
  };
  wrap.onclick = e => {
    const o = e.target.closest('[data-pvo]'),
      z = e.target.closest('[data-pvz]');
    if (o) {
      PV[o.dataset.pvo] = o.dataset.v;
      pvSave();
      pvEbookTab(wrap, pvSel());
    } else if (z) {
      const i = Math.max(0, Math.min(PV_SIZES.length - 1, PV_SIZES.indexOf(PV.size) + +z.dataset.pvz));
      PV.size = PV_SIZES[i];
      pvSave();
      ctl.show(pvContent(pvSel()));
    }
  };
}
// The Print tab: the laid-out book as spreads, with a jump to a chapter, the zoom and the page count.
async function pvPrintTab(wrap, sel) {
  const pr = S.meta.book.print,
    p = ui.pvPrint,
    fresh = p && p.chg === PV_CHG && p.sig === pvPrintSig();
  wrap.innerHTML =
    '<div class="pv-bar"><select data-pvjump aria-label="Go to">' +
    pvSelOptions(sel).replace(/<option value="cover"[^>]*>[^<]*<\/option>/, '') +
    '</select><select data-pvzoom aria-label="Zoom">' +
    [
      ['fit', 'Fit'],
      ['0.5', '50%'],
      ['0.75', '75%'],
      ['1', '100%']
    ]
      .map(x => '<option value="' + x[0] + '"' + (PV.zoom === x[0] ? ' selected' : '') + '>' + x[1] + '</option>')
      .join('') +
    '</select><span class="muted pv-facts">' +
    esc(printTrim(pr)[1] + ' · ' + printFont(pr)[1] + (p ? ' · ' + p.count + ' pages' : '')) +
    '</span><button class="btn sm" data-pva="relayout">' +
    ico('undo', 13) +
    '<span>Lay out again</span></button></div>' +
    '<div class="pv-print" id="pvPrint"><p class="fine pv-wait">' +
    (fresh ? '' : 'Laying out the pages…') +
    '</p></div><p class="fine pv-note">Trim size, font and page numbers are set in Book details › Print book.</p>';
  const host = $('#pvPrint', wrap);
  const draw = q => {
    const W = printTrim(pr)[2] * 96,
      zoom = PV.zoom === 'fit' ? Math.min(1, ((host.clientWidth || 800) - 40) / (2 * W)) : +PV.zoom;
    host.innerHTML = '<iframe class="pv-pframe" title="Print preview"></iframe>';
    const f = $('iframe', host);
    f.srcdoc = pvSpreadHtml(q.html, zoom, false);
    f.onload = () => pvJump(f, q, pvSel());
    $('.pv-facts', wrap).textContent = printTrim(pr)[1] + ' · ' + printFont(pr)[1] + ' · ' + q.count + ' pages';
  };
  wrap.onchange = e => {
    if (e.target.dataset.pvjump != null) {
      ui.pvSel = e.target.value;
      const f = $('iframe', host);
      if (f && ui.pvPrint) pvJump(f, ui.pvPrint, e.target.value);
    } else if (e.target.dataset.pvzoom != null) {
      PV.zoom = e.target.value;
      pvSave();
      if (ui.pvPrint) draw(ui.pvPrint);
    }
  };
  wrap.onclick = async e => {
    if (!e.target.closest('[data-pva="relayout"]')) return;
    host.innerHTML = '<p class="fine pv-wait">Laying out the pages…</p>';
    const q = await pvLayout();
    if (q && host.isConnected) draw(q);
  };
  if (fresh) return draw(p);
  const q = await pvLayout();
  if (q && host.isConnected) draw(q);
}
// Scrolls the print preview to the first page of a chapter, or of the front or back matter.
function pvJump(frame, q, sel) {
  const D = frame.contentDocument;
  if (!D) return;
  const pages = D.querySelectorAll('.pg');
  let i = 0;
  // the back matter: the first story page holding a page of matter
  if (sel === 'back')
    i = Math.max(
      0,
      [...pages].findIndex((x, k) => k >= q.front && x.querySelector('section.bk-page'))
    );
  else if (q.starts[sel]) i = q.front + q.starts[sel] - 1;
  if (pages[i]) pvScrollTo(frame, pages[i]);
}

// Scrolls a preview frame to a page (scrolling only the frame, not the panes around it).
function pvScrollTo(frame, el) {
  const w = frame.contentWindow;
  w.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + w.scrollY - 16));
}

/* ---------- beside the writing ---------- */
// The side-by-side pane's preview: Ebook or Print, for the chapter being written.
function pvSideHtml() {
  return (
    '<div class="pv-side"><div class="seg sm"><button data-pvside="ebook"' +
    (PV.side === 'ebook' ? ' class="on"' : '') +
    '>Ebook</button><button data-pvside="print"' +
    (PV.side === 'print' ? ' class="on"' : '') +
    '>Print proof</button></div><p class="muted sp-sub" id="pvSideSub"></p><div class="pv-stage" id="pvSideStage"></div></div>'
  );
}
// Fills the side-by-side preview with the chapter being written and follows the scene's place in it.
async function pvSide() {
  const host = $('#pvSideStage'),
    sub = $('#pvSideSub');
  if (!host) return;
  const ch = pvSideChapter();
  ui.pvSideCh = ch;
  if (!ch) {
    host.innerHTML = '<p class="muted">Open a scene to see its chapter here.</p>';
    return;
  }
  const H = chHeads()[ch],
    name = chHeadText(H, ' · ') || S.meta.chapters.find(c => c.id === ch).title;
  if (PV.side === 'ebook') {
    sub.textContent = name + ' · ' + PV_DEVICES.find(d => d[0] === PV.dev)[1];
    if (!ui.pvSideCtl || !host.querySelector('.pv-frame')) ui.pvSideCtl = pvEbook(host, 'width');
    ui.pvSideCtl.show(pvContent(ch), { frac: pvSceneFrac(ch) });
  } else {
    sub.textContent = name + ' · print proof (page numbers start at 1)';
    const tok = (ui.pvSideTok = (ui.pvSideTok || 0) + 1);
    if (!host.querySelector('iframe')) host.innerHTML = '<p class="fine pv-wait">Laying out the pages…</p>';
    const r = await printLayout(ch);
    r.frame.remove();
    if (tok !== ui.pvSideTok || !host.isConnected) return;
    const W = printTrim(S.meta.book.print)[2] * 96,
      zoom = Math.min(1, ((host.clientWidth || 360) - 30) / W),
      old = host.querySelector('iframe'),
      at = old && old.contentWindow ? old.contentWindow.scrollY : null;
    const f = document.createElement('iframe');
    f.className = 'pv-pframe side';
    f.title = 'Print proof';
    f.srcdoc = pvSpreadHtml(r.html, zoom, true);
    f.onload = () => {
      const D = f.contentDocument,
        pgs = D.querySelectorAll('.pg');
      if (at != null) f.contentWindow.scrollTo(0, at);
      else if (pgs.length) pvScrollTo(f, pgs[Math.min(pgs.length - 1, Math.floor(pvSceneFrac(ch) * pgs.length))]);
    };
    host.innerHTML = '';
    host.appendChild(f);
  }
}
// The chapter to show beside the writing: the open scene's chapter, else the last scene written.
function pvSideChapter() {
  const v = ui.view;
  if (v.k === 'scene') return pvChapterOf(v.id);
  if (v.k === 'cork' && v.ch) return v.ch;
  return pvChapterOf(ui.lastScene) || (S.meta.chapters[0] || {}).id;
}
// How far through its chapter the open scene starts (0–1), by words, so the preview turns to it.
function pvSceneFrac(ch) {
  const c = S.meta.chapters.find(x => x.id === ch),
    sid = ui.view.k === 'scene' ? ui.view.id : null;
  if (!c || !sid || !c.scenes.includes(sid)) return 0;
  let before = 0,
    all = 0;
  c.scenes.forEach(id => {
    const n = S.meta.scenes[id].words || 0;
    if (c.scenes.indexOf(id) < c.scenes.indexOf(sid)) before += n;
    all += n;
  });
  return all ? Math.min(0.999, before / all) : 0;
}
// Called from dirty(): notes that the book changed, and refreshes a preview beside the writing (soon for the ebook,
// after a longer pause for a print proof, which takes longer to lay out).
function pvTouch(keys) {
  PV_CHG++;
  if (!ui.split || ui.split.k !== 'preview') return;
  if (!keys.some(k => k === 'meta' || k.startsWith('sc_'))) return;
  clearTimeout(ui.pvT);
  ui.pvT = setTimeout(pvSide, PV.side === 'ebook' ? 500 : 1500);
}
// When the main page moves to another chapter, the preview beside it follows.
function pvFollow() {
  if (ui.split && ui.split.k === 'preview' && pvSideChapter() !== ui.pvSideCh) pvSide();
}
