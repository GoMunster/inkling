/*
 * 35-book.js: Book details, front and back matter, and chapter types
 *
 * Everything a finished book needs around the story itself, kept in meta.book (normBook): details for stores and the
 * copyright page (subtitle, imprint, ISBNs, edition, description, keywords), the front matter (half title, title page,
 * copyright, dedication, epigraph, contents) and back matter (acknowledgments, about the author, also by, links),
 * each switched on or off and in the writer's order, and how chapters are headed (chNum, chTitles).
 *
 * Chapters have a kind (meta.chapters[].kind): '' an ordinary numbered chapter, 'un' unnumbered (a prologue or
 * epilogue: it does not take a number) or 'part' (a part divider, "Part One", whose scenes are the part's opening
 * words). chHeads() works out every chapter's heading.
 *
 * bookPages() turns the front or back matter into pages of simple blocks ([type, text, extra]), which each export
 * format draws its own way: matterHtml() for EPUB and PDF, matterMd() for Markdown, and expDocx for Word. The Book
 * details screen ({k:'book'}, renderBook) edits all of it.
 *
 * The store-ready ebook: the cover (meta.book.cover, a picture stored like a map's, under the id 'cover'; coverJpeg()
 * turns it into the JPEG the EPUB carries), the book style (BOOK_STYLES: chapter heading design, drop cap, small
 * capitals and scene-break ornament, BOOK_ORNS; bookCss(), chapterHead(), chapterHtml(), previewed by
 * stylePreviewHtml()) and the check before publishing (preflight(), preflightHtml(); tidyBook() fixes quotes, dashes,
 * ellipses and double spaces, after a snapshot of each scene it changes).
 */
// The pages that can come before the story, in their default order: [key, name, on at first].
const BOOK_FRONT = [
  ['half', 'Half title', false],
  ['title', 'Title page', true],
  ['copy', 'Copyright', true],
  ['ded', 'Dedication', true],
  ['epi', 'Epigraph', true],
  ['toc', 'Contents', true]
];
// The pages that can come after the story: [key, name, on at first].
const BOOK_BACK = [
  ['ack', 'Acknowledgments', true],
  ['about', 'About the author', true],
  ['also', 'Also by', true],
  ['links', 'Links', true]
];
// Kinds of chapter: [key, name]. '' is an ordinary numbered chapter.
const CH_KINDS = [
  ['', 'Numbered chapter'],
  ['un', 'Unnumbered (prologue, epilogue, interlude)'],
  ['part', 'Part divider']
];
// How chapters are numbered in exports: [key, name].
const CH_NUMS = [
  ['none', 'Titles only'],
  ['word', 'Chapter One'],
  ['num', 'Chapter 1'],
  ['bare', 'One'],
  ['digit', '1']
];
// Checks the book details, keeping only valid values; the front and back matter lists always hold every page once.
function normBook(b) {
  b = b && typeof b === 'object' ? b : {};
  const s = (k, n) => String(b[k] || '').slice(0, n);
  const order = (list, def) => {
    const seen = new Set(),
      out = [];
    (Array.isArray(list) ? list : []).forEach(x => {
      const k = Array.isArray(x) ? x[0] : '';
      if (def.some(d => d[0] === k) && !seen.has(k)) {
        seen.add(k);
        out.push([k, !!x[1]]);
      }
    });
    def.forEach(d => {
      if (!seen.has(d[0])) out.push([d[0], d[2]]);
    });
    return out;
  };
  return {
    subtitle: s('subtitle', 200),
    imprint: s('imprint', 120),
    edition: s('edition', 80),
    year: s('year', 20),
    lang: s('lang', 20),
    isbnE: s('isbnE', 20),
    isbnP: s('isbnP', 20),
    isbnH: s('isbnH', 20),
    desc: s('desc', 4000),
    keys: s('keys', 500),
    copy: s('copy', 4000),
    ded: s('ded', 2000),
    epi: s('epi', 2000),
    epiBy: s('epiBy', 200),
    ack: s('ack', 8000),
    about: s('about', 4000),
    also: s('also', 4000),
    links: (Array.isArray(b.links) ? b.links : []).slice(0, 12).map(l => ({
      label: String((l || {}).label || '').slice(0, 120),
      url: String((l || {}).url || '').slice(0, 500)
    })),
    front: order(b.front, BOOK_FRONT),
    back: order(b.back, BOOK_BACK),
    chNum: CH_NUMS.some(x => x[0] === b.chNum) ? b.chNum : 'none',
    chTitles: b.chTitles !== false,
    cover: normPic(b.cover),
    style: BOOK_STYLES.some(x => x[0] === b.style) ? b.style : 'classic',
    dc: b.dc == null ? true : !!b.dc,
    sc: b.sc == null ? true : !!b.sc,
    orn: BOOK_ORNS.includes(b.orn) ? b.orn : '* * *',
    print: normPrint(b.print)
  };
}
// Number words for chapter and part headings.
const NUM_WORDS =
  'Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen'.split(
    ' '
  );
const NUM_TENS = '  Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety'.split(' ');
// A number in words, for headings: 3 → "Three", 21 → "Twenty-One", 105 → "One Hundred and Five".
function numWord(n) {
  if (n < 20) return NUM_WORDS[n];
  if (n < 100) return NUM_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + NUM_WORDS[n % 10] : '');
  if (n < 1000) return NUM_WORDS[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numWord(n % 100) : '');
  return String(n);
}
// How each chapter is headed in exports: {chapterId: {kind, label, title}}. label is "Chapter Three", "Part One" or ''
// (unnumbered chapters and "Titles only"); title is '' when the writer chose numbers without titles.
function chHeads() {
  const b = S.meta.book,
    out = {};
  let n = 0,
    p = 0;
  S.meta.chapters.forEach(c => {
    const kind = c.kind || '';
    let label = '';
    if (kind === 'part') {
      p++;
      label = 'Part ' + numWord(p);
    } else if (!kind) {
      n++;
      label =
        b.chNum === 'word'
          ? 'Chapter ' + numWord(n)
          : b.chNum === 'num'
            ? 'Chapter ' + n
            : b.chNum === 'bare'
              ? numWord(n)
              : b.chNum === 'digit'
                ? String(n)
                : '';
    }
    out[c.id] = { kind, label, title: !label || b.chTitles || kind === 'part' ? c.title : '' };
  });
  return out;
}
// A chapter's heading as one line of text: "Chapter Three: The Storm".
const chHeadText = (h, sep) => [h.label, h.title].filter(Boolean).join(sep || ': ');
// The standard copyright page, from the book details (used unless the writer wrote their own).
function copyrightAuto() {
  const m = S.meta,
    b = m.book,
    by = (m.exp.byline || m.author || '').trim() || 'the author',
    yr = b.year.trim() || String(new Date().getFullYear());
  const L = [
    'Copyright © ' + yr + ' ' + by,
    '',
    'All rights reserved. No part of this book may be reproduced in any form or by any electronic or mechanical means, including information storage and retrieval systems, without written permission from the author, except for the use of brief quotations in a book review.',
    '',
    'This is a work of fiction. Names, characters, places and incidents are the products of the author’s imagination or are used fictitiously. Any resemblance to actual persons, living or dead, events or locales is entirely coincidental.'
  ];
  const isbns = [
    ['isbnE', 'ebook'],
    ['isbnP', 'paperback'],
    ['isbnH', 'hardcover']
  ].filter(x => b[x[0]].trim());
  if (isbns.length) {
    L.push('');
    isbns.forEach(x => L.push('ISBN ' + b[x[0]].trim() + ' (' + x[1] + ')'));
  }
  if (b.edition.trim()) L.push('', b.edition.trim());
  if (b.imprint.trim()) L.push('', 'Published by ' + b.imprint.trim());
  return L.join('\n');
}
// The copyright page's text: the writer's own wording, or the standard one.
const copyrightText = () => S.meta.book.copy.trim() || copyrightAuto();
// Text with one line per paragraph, as blocks of one type (an empty line is a gap).
const linesAs = (t, type) =>
  String(t || '')
    .split('\n')
    .map(l => l.trim())
    .map(l => (l ? [type, l] : ['gap']));
// The front ('front') or back ('back') matter that is switched on and has something in it, as pages of blocks:
// [{key, name, type (the EPUB page type), blocks: [[kind, text, extra]]}]. Block kinds: title, sub, h (a heading),
// sh (a small heading), c (centred), i (centred italic), small, p (a paragraph), gap, toc (text, chapter id), link
// (label, url). toc lists the chapters given.
function bookPages(side, chapters) {
  const m = S.meta,
    b = m.book,
    by = (m.exp.byline || m.author || '').trim(),
    out = [];
  (side === 'front' ? b.front : b.back).forEach(([k, on]) => {
    if (!on) return;
    const pg = (type, blocks) =>
      out.push({ key: k, name: (side === 'front' ? BOOK_FRONT : BOOK_BACK).find(d => d[0] === k)[1], type, blocks });
    if (k === 'half') pg('halftitlepage', [['title', m.title]]);
    else if (k === 'title')
      pg(
        'titlepage',
        [['title', m.title]]
          .concat(b.subtitle.trim() ? [['sub', b.subtitle.trim()]] : [])
          .concat(by ? [['gap'], ['c', by]] : [])
          .concat(b.imprint.trim() ? [['gap'], ['gap'], ['small', b.imprint.trim()]] : [])
      );
    else if (k === 'copy') pg('copyright-page', linesAs(copyrightText(), 'small'));
    else if (k === 'ded' && b.ded.trim()) pg('dedication', linesAs(b.ded.trim(), 'i'));
    else if (k === 'epi' && b.epi.trim())
      pg('epigraph', linesAs(b.epi.trim(), 'i').concat(b.epiBy.trim() ? [['c', '— ' + b.epiBy.trim()]] : []));
    else if (k === 'toc' && chapters && chapters.length)
      pg('toc', [['h', 'Contents']].concat(chapters.map(c => ['toc', c.text, c.id])));
    else if (k === 'ack' && b.ack.trim()) pg('acknowledgments', [['h', 'Acknowledgments']].concat(linesAs(b.ack, 'p')));
    else if (k === 'about' && b.about.trim()) pg('appendix', [['h', 'About the author']].concat(linesAs(b.about, 'p')));
    else if (k === 'also' && b.also.trim())
      pg(
        'appendix',
        [['h', 'Also by ' + (by || 'the author')]].concat(
          linesAs(b.also, 'c').map(x => (x[0] === 'c' && /^##\s*/.test(x[1]) ? ['sh', x[1].replace(/^##\s*/, '')] : x))
        )
      );
    else if (k === 'links' && b.links.some(l => l.url.trim() || l.label.trim()))
      pg(
        'appendix',
        [['h', 'Stay in touch']].concat(
          b.links.filter(l => l.url.trim() || l.label.trim()).map(l => ['link', l.label.trim(), l.url.trim()])
        )
      );
  });
  return out;
}
// The book's language as a tag for ebook files (like "en" or "en-GB"): the writer's choice, or this computer's.
function bookLang() {
  const t = (S.meta.book.lang.trim() || navigator.language || 'en').match(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*/i);
  return t ? t[0] : 'en';
}
// Whether a link is safe to put in an exported file (web and email addresses only).
const okUrl = u => /^(https?:\/\/|mailto:)[^\s"<>]+$/i.test(u || '');
// One page of front or back matter as HTML, for EPUB and PDF. href(chapterId) links a contents entry, or null.
function matterHtml(pg, href) {
  return pg.blocks
    .map(b => {
      const t = b[1];
      if (b[0] === 'title') return '<h1 class="bk-title">' + htmlRuns(t) + '</h1>';
      if (b[0] === 'sub') return '<p class="bk-sub">' + htmlRuns(t) + '</p>';
      if (b[0] === 'h') return '<h2 class="bk-h">' + xe(t) + '</h2>';
      if (b[0] === 'sh') return '<h3 class="bk-sh">' + htmlRuns(t) + '</h3>';
      if (b[0] === 'c') return '<p class="bk-c">' + htmlRuns(t) + '</p>';
      if (b[0] === 'i') return '<p class="bk-i">' + htmlRuns(t) + '</p>';
      if (b[0] === 'small') return '<p class="bk-small">' + htmlRuns(t) + '</p>';
      if (b[0] === 'p') return '<p class="bk-p">' + htmlRuns(t) + '</p>';
      if (b[0] === 'gap') return '<p class="bk-gap">&#160;</p>';
      if (b[0] === 'toc')
        return '<p class="bk-toc">' + (href ? '<a href="' + href(b[2]) + '">' + xe(t) + '</a>' : xe(t)) + '</p>';
      if (b[0] === 'link')
        return (
          '<p class="bk-c">' +
          (okUrl(b[2])
            ? '<a href="' + xe(b[2]) + '">' + xe(t || b[2]) + '</a>'
            : xe([t, b[2]].filter(Boolean).join(': '))) +
          '</p>'
        );
      return '';
    })
    .join('');
}
// The CSS for front and back matter pages, shared by EPUB and PDF.
const MATTER_CSS =
  '.bk-page{text-align:center}h1.bk-title{font-size:2em;font-weight:normal;margin:30% 0 .4em;text-indent:0}.bk-sub{font-style:italic;font-size:1.15em;text-indent:0;margin:0}' +
  '.bk-h{font-size:1.3em;font-weight:normal;margin:2em 0 1.2em;text-indent:0}.bk-sh{font-size:1em;font-variant:small-caps;letter-spacing:.05em;margin:1.4em 0 .4em;text-indent:0}' +
  '.bk-c,.bk-i,.bk-toc{text-indent:0;margin:.3em 0}.bk-i{font-style:italic}.bk-small{font-size:.8em;text-align:left;text-indent:0;margin:0 0 .2em}' +
  '.bk-p{text-align:left;text-indent:1.5em;margin:0}.bk-h+.bk-p{text-indent:0}.bk-gap{margin:0;text-indent:0}' +
  '.bk-copy{margin-top:40%}.bk-ded,.bk-epi{margin-top:30%}.bk-toc{text-align:left}';
// One page of front or back matter as Markdown.
function matterMd(pg) {
  return pg.blocks
    .map(b =>
      b[0] === 'title'
        ? '# ' + b[1]
        : b[0] === 'sub' || b[0] === 'i'
          ? '*' + b[1] + '*'
          : b[0] === 'h'
            ? '## ' + b[1]
            : b[0] === 'sh'
              ? '### ' + b[1]
              : b[0] === 'gap'
                ? ''
                : b[0] === 'toc'
                  ? '- ' + b[1]
                  : b[0] === 'link'
                    ? okUrl(b[2])
                      ? '[' + (b[1] || b[2]) + '](' + b[2] + ')'
                      : [b[1], b[2]].filter(Boolean).join(': ')
                    : b[1]
    )
    .filter(x => x !== '')
    .join('\n\n');
}
// The Book details screen: details for stores and the copyright page, front and back matter, and chapter headings.
function renderBook(el) {
  const m = S.meta,
    b = m.book,
    H = chHeads();
  const fld = (k, label, ph, o) => {
    o = o || {};
    const v = k === 'title' ? m.title : k === 'author' ? m.author : k === 'byline' ? m.exp.byline : b[k];
    return (
      '<label class="f' +
      (o.wide ? ' bk-wide' : '') +
      '">' +
      label +
      (o.area
        ? '<textarea data-bk="' +
          k +
          '" rows="' +
          (o.rows || 3) +
          '" placeholder="' +
          esc(ph || '') +
          '">' +
          esc(v) +
          '</textarea>'
        : '<input data-bk="' +
          k +
          '" value="' +
          esc(v) +
          '" placeholder="' +
          esc(ph || '') +
          '" maxlength="' +
          (o.max || 200) +
          '">') +
      (o.hint ? '<small class="bk-hint">' + o.hint + '</small>' : '') +
      '</label>'
    );
  };
  const list = side =>
    '<div class="bk-list" data-side="' +
    side +
    '">' +
    b[side]
      .map(([k, on]) => {
        const name = (side === 'front' ? BOOK_FRONT : BOOK_BACK).find(d => d[0] === k)[1];
        return (
          '<div class="bk-row" data-k="' +
          k +
          '"><span class="bk-grip" title="Drag to reorder">' +
          ico('grip', 14) +
          '</span><label class="ck"><input type="checkbox" data-bkon="' +
          side +
          ':' +
          k +
          '"' +
          (on ? ' checked' : '') +
          '>' +
          esc(name) +
          '</label><small class="muted">' +
          esc(matterNote(k)) +
          '</small></div>'
        );
      })
      .join('') +
    '</div>';
  const own = !!b.copy.trim() || ui.bkCopyEdit,
    src = picSrc('cover');
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('book', 16) +
    '</span><h1 class="mh-title">Book details</h1><button class="btn" data-bka="preview">' +
    ico('book', 14) +
    '<span>Preview</span></button><button class="btn" data-bka="export">' +
    ico('down', 14) +
    '<span>Export…</span></button></div><div class="pf-wrap bk-wrap">' +
    '<section class="pf"><h2>About the book</h2><p class="fine">Used on the title page, the copyright page and in ebook files. Stores ask for the same details when you publish.</p><div class="bk-grid">' +
    fld('title', 'Title', 'The Lantern Tide', { max: 90 }) +
    fld('subtitle', 'Subtitle', 'A novel') +
    fld('author', 'Your name', 'Your legal name', { max: 120 }) +
    fld('byline', 'Pen name', 'Same as your name', { max: 120 }) +
    '<label class="f">Series<input data-bks="name" value="' +
    esc(m.series.name) +
    '" maxlength="120" placeholder="Not part of a series"></label><label class="f">Book number<input type="number" min="0" data-bks="num" value="' +
    (m.series.num || '') +
    '" placeholder="1"></label>' +
    fld('imprint', 'Publisher or imprint', 'Your imprint, if you have one', { max: 120 }) +
    fld('edition', 'Edition', 'First edition', { max: 80 }) +
    fld('year', 'Year of publication', String(new Date().getFullYear()), { max: 20 }) +
    fld('lang', 'Language', bookLang(), {
      max: 20,
      hint: 'A code like en, en-GB or fr.'
    }) +
    fld('isbnE', 'ISBN, ebook', 'Not needed for Kindle', { max: 20 }) +
    fld('isbnP', 'ISBN, paperback', '', { max: 20 }) +
    fld('isbnH', 'ISBN, hardcover', '', { max: 20 }) +
    fld('keys', 'Keywords', 'cozy mystery, seaside, found family', { max: 500 }) +
    fld('desc', 'Description', 'The blurb for the back cover and store page.', { area: true, rows: 5, wide: true }) +
    '</div></section>' +
    '<section class="pf"><h2>Cover</h2><p class="fine">The front cover for your ebook. Stores ask for a JPEG about 1600 × 2560 pixels (at least 625 × 1000, about 1.6 times taller than wide). Inkling puts it at the front of the EPUB.</p>' +
    '<div class="bk-cover">' +
    (src
      ? '<img class="bk-cv-img" src="' + esc(src) + '" alt="The cover">'
      : '<div class="bk-cv-drop">' + ico('image', 28) + '<span>Drop your cover here</span></div>') +
    '<div class="bk-cv-side"><p class="fine" id="bkCvSize">' +
    (ui.imgBusy === 'cover' ? 'Saving…' : src ? 'Checking the size…' : 'No cover yet.') +
    '</p><label class="btn">' +
    ico('upload', 14) +
    '<span>' +
    (src ? 'Replace' : 'Choose a picture') +
    '…</span><input type="file" accept="image/*" data-bkcv hidden></label>' +
    (src ? '<button class="btn" data-bka="delcover">' + ico('trash', 14) + '<span>Remove</span></button>' : '') +
    '</div></div></section>' +
    '<section class="pf"><h2>Ebook style</h2><p class="fine">How chapters open in the ebook. Every style works on Kindle, Apple Books, Kobo and the rest.</p>' +
    '<div class="bk-styles" role="radiogroup" aria-label="Book style">' +
    BOOK_STYLES.map(
      ([k, name, desc]) =>
        '<button class="bk-st' +
        (b.style === k ? ' on' : '') +
        '" role="radio" aria-checked="' +
        (b.style === k) +
        '" data-bkst="' +
        k +
        '"><b>' +
        name +
        '</b><small>' +
        desc +
        '</small></button>'
    ).join('') +
    '</div><div class="bk-grid"><label class="ck bk-ck"><input type="checkbox" data-bkf="dc"' +
    (b.dc ? ' checked' : '') +
    '>Drop cap: a large first letter</label><label class="ck bk-ck"><input type="checkbox" data-bkf="sc"' +
    (b.sc ? ' checked' : '') +
    '>The first words in small capitals</label><label class="f">Scene break<select data-bkf="orn">' +
    BOOK_ORNS.map(
      x =>
        '<option value="' +
        esc(x) +
        '"' +
        (b.orn === x ? ' selected' : '') +
        '>' +
        (x ? esc(x) : 'A blank line') +
        '</option>'
    ).join('') +
    '</select></label></div><div class="bk-pv-box" aria-label="Preview">' +
    stylePreviewHtml() +
    '</div></section>' +
    printSectionHtml() +
    '<section class="pf"><h2>Check the book</h2><p class="fine">Looks for things stores reject and readers notice: a missing cover, empty chapters, notes left in the text, straight quotes.</p>' +
    '<div id="bkCheck"><button class="btn" data-bka="check">' +
    ico('check', 14) +
    '<span>Check the book</span></button></div></section>' +
    '<section class="pf"><h2>Front matter</h2><p class="fine">The pages before the story. Tick the ones to include and drag to reorder. Exports include them when “Front and back matter” is ticked (always on for EPUB).</p>' +
    list('front') +
    '<h3 class="bk-sub-h">Copyright page</h3>' +
    (own
      ? '<label class="f">Your wording<textarea data-bk="copy" rows="8">' +
        esc(b.copy.trim() ? b.copy : copyrightAuto()) +
        '</textarea></label><button class="lnk" data-bka="stdcopy">Use the standard wording instead</button>'
      : '<pre class="bk-preview">' +
        esc(copyrightAuto()) +
        '</pre><p class="fine">Made from the details above. <button class="lnk" data-bka="owncopy">Write my own</button></p>') +
    '<div class="bk-grid">' +
    fld('ded', 'Dedication', 'For Mum, who read to me.', { area: true, rows: 2, wide: true }) +
    fld('epi', 'Epigraph', 'A quotation to open the book.', { area: true, rows: 3 }) +
    fld('epiBy', 'Epigraph by', 'Who said or wrote it', { max: 200 }) +
    '</div></section>' +
    '<section class="pf"><h2>Back matter</h2><p class="fine">The pages after the story.</p>' +
    list('back') +
    '<div class="bk-grid">' +
    fld('ack', 'Acknowledgments', 'Thank you to…', { area: true, rows: 4, wide: true }) +
    fld('about', 'About the author', 'A few lines about you, in the third person.', {
      area: true,
      rows: 4,
      wide: true
    }) +
    fld('also', 'Also by', 'One title per line.', {
      area: true,
      rows: 4,
      wide: true,
      hint: 'Start a line with ## for a series name, then list its books under it.'
    }) +
    '</div><h3 class="bk-sub-h">Links</h3><p class="fine">Your newsletter, website or store pages. Ebooks make them clickable.</p><div class="bk-links">' +
    b.links
      .map(
        (l, i) =>
          '<div class="bk-link"><input data-bkl="label" data-i="' +
          i +
          '" value="' +
          esc(l.label) +
          '" placeholder="Join my newsletter" maxlength="120" aria-label="Link text"><input data-bkl="url" data-i="' +
          i +
          '" value="' +
          esc(l.url) +
          '" placeholder="https://…" maxlength="500" aria-label="Address"><button class="ibtn" data-bka="dellink" data-i="' +
          i +
          '" aria-label="Remove link">' +
          ico('x', 14) +
          '</button></div>'
      )
      .join('') +
    '<button class="btn sm" data-bka="addlink">' +
    ico('plus', 13) +
    '<span>Link</span></button></div></section>' +
    '<section class="pf"><h2>Chapters</h2><p class="fine">How chapters are headed in exports. Prologues and epilogues can be left unnumbered, and part dividers (“Part One”) group the chapters after them. The text of a part’s scenes is printed on the part’s page.</p>' +
    '<div class="bk-grid"><label class="f">Numbering<select data-bk="chNum">' +
    CH_NUMS.map(
      x => '<option value="' + x[0] + '"' + (b.chNum === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'
    ).join('') +
    '</select></label><label class="ck bk-ck"><input type="checkbox" data-bk="chTitles"' +
    (b.chTitles ? ' checked' : '') +
    (b.chNum === 'none' ? ' disabled' : '') +
    '>Show chapter titles under the numbers</label></div>' +
    (b.chNum !== 'none' && b.chTitles && m.chapters.some(c => /^(chapter|part)\b/i.test(c.title.trim()))
      ? '<p class="fine bk-warn">Some chapter titles already start with “Chapter” or “Part”. Rename them, choose Titles only, or untick Show chapter titles, so the number isn’t written twice.</p>'
      : '') +
    '<div class="bk-chs">' +
    m.chapters
      .map(
        c =>
          '<div class="bk-ch"><span class="bk-chn">' +
          esc(c.title) +
          '</span><select data-bkk="' +
          c.id +
          '" aria-label="Kind of chapter">' +
          CH_KINDS.map(
            k =>
              '<option value="' + k[0] + '"' + ((c.kind || '') === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'
          ).join('') +
          '</select><span class="bk-head' +
          (H[c.id].kind === 'part' ? ' part' : '') +
          '">' +
          esc(chHeadText(H[c.id], ' · ') || 'No heading') +
          '</span></div>'
      )
      .join('') +
    '</div></section></div>';
  if (src)
    coverSize().then(cs => {
      const p = $('#bkCvSize', el);
      if (p)
        p.textContent = cs
          ? cs.w + ' × ' + cs.h + ' pixels' + (cs.w < 625 || cs.h < 1000 ? ': too small for stores' : '')
          : '';
    });
  const cvBox = $('.bk-cover', el);
  cvBox.ondragover = e => {
    e.preventDefault();
    cvBox.classList.add('over');
  };
  cvBox.ondragleave = () => cvBox.classList.remove('over');
  cvBox.ondrop = e => {
    e.preventDefault();
    cvBox.classList.remove('over');
    const f = [...(e.dataTransfer.files || [])].find(x => /^image\//.test(x.type));
    if (f) setPic('cover', f);
  };
  dragSort(el, {
    item: '.bk-row',
    handle: '.bk-grip',
    zones: '.bk-list',
    drop: (it, ref, zone) => {
      const arr = b[zone.dataset.side],
        from = arr.findIndex(x => x[0] === it.dataset.k);
      if (from < 0 || it.parentElement !== zone) return;
      const [x] = arr.splice(from, 1),
        to = ref ? arr.findIndex(y => y[0] === ref.dataset.k) : arr.length;
      arr.splice(to < 0 ? arr.length : to, 0, x);
      dirty('meta');
      renderBook(el);
    }
  });
  el.oninput = e => {
    const t = e.target,
      k = t.dataset.bk;
    if (k && k !== 'chNum' && k !== 'chTitles') {
      const v = t.value;
      if (k === 'title') {
        m.title = v.slice(0, 90) || 'Untitled novel';
        const pt = $('#projTitle');
        if (pt) pt.value = m.title;
      } else if (k === 'author') m.author = v.slice(0, 120);
      else if (k === 'byline') m.exp.byline = v.slice(0, 120);
      else b[k] = v;
      dirty('meta');
      if (
        !own &&
        k !== 'copy' &&
        k !== 'ded' &&
        k !== 'epi' &&
        k !== 'epiBy' &&
        k !== 'ack' &&
        k !== 'about' &&
        k !== 'also'
      ) {
        const pre = $('.bk-preview', el);
        if (pre) pre.textContent = copyrightAuto();
      }
    } else if (t.dataset.bks) {
      if (t.dataset.bks === 'name') m.series.name = t.value.slice(0, 120);
      else m.series.num = Math.max(0, Math.min(999, Math.round(+t.value || 0)));
      dirty('meta');
    } else if (t.dataset.bkl) {
      const l = b.links[+t.dataset.i];
      if (l) {
        l[t.dataset.bkl] = t.value;
        dirty('meta');
      }
    }
  };
  el.onchange = e => {
    const t = e.target;
    if (t.dataset.bkp) {
      const k = t.dataset.bkp,
        pr = b.print;
      pr[k] = k === 'recto' || k === 'hyph' ? t.checked : k === 'size' || k === 'lead' ? +t.value : t.value;
      if (k === 'bind' && pr.bind === 'pb') pr.paper = 'cream'; // hardcovers are white; paperback novels are usually cream
      b.print = normPrint(pr);
      ui.prFacts = null; // the page count changes with the settings
      dirty('meta');
      renderBook(el);
    } else if (t.dataset.bkcv != null) {
      if (t.files && t.files[0]) setPic('cover', t.files[0]);
    } else if (t.dataset.bkf) {
      const f = t.dataset.bkf;
      b[f] = f === 'orn' ? t.value : t.checked;
      dirty('meta');
      $('.bk-pv-box', el).innerHTML = stylePreviewHtml();
    } else if (t.dataset.bk === 'chNum' || t.dataset.bk === 'chTitles') {
      if (t.dataset.bk === 'chNum') b.chNum = t.value;
      else b.chTitles = t.checked;
      dirty('meta');
      renderBook(el);
    } else if (t.dataset.bkk) {
      const c = m.chapters.find(x => x.id === t.dataset.bkk);
      if (!c) return;
      if (t.value) c.kind = t.value;
      else delete c.kind;
      dirty('meta');
      renderBinder();
      renderBook(el);
    } else if (t.dataset.bkon) {
      const [side, k] = t.dataset.bkon.split(':'),
        x = b[side].find(y => y[0] === k);
      if (x) {
        x[1] = t.checked;
        dirty('meta');
      }
    }
  };
  el.onclick = e => {
    const st = e.target.closest('[data-bkst]');
    if (st) {
      // a style also brings its own drop cap, small capitals and ornament; the writer can change them after
      const x = BOOK_STYLES.find(y => y[0] === st.dataset.bkst)[3];
      Object.assign(b, { style: st.dataset.bkst, dc: x.dc, sc: x.sc, orn: x.orn });
      dirty('meta');
      renderBook(el);
      return;
    }
    const a = (e.target.closest('[data-bka]') || {}).dataset;
    if (!a || !a.bka) return;
    if (a.bka === 'export') openExport();
    else if (a.bka === 'preview') go({ k: 'preview' });
    else if (a.bka === 'delcover') removePic('cover');
    else if (a.bka === 'count') printCount(el);
    else if (a.bka === 'check' || a.bka === 'tidy') {
      if (a.bka === 'tidy') {
        const n = tidyBook();
        toast(
          n
            ? 'Tidied ' + n + ' scene' + (n === 1 ? '' : 's') + '. Each one has a snapshot from before.'
            : 'Nothing to tidy.',
          {
            plain: true
          }
        );
      }
      const box = $('#bkCheck', el);
      preflight().then(list => {
        box.innerHTML =
          preflightHtml(list) +
          '<button class="btn sm" data-bka="check">' +
          ico('check', 13) +
          '<span>Check again</span></button>';
      });
    } else if (a.bka === 'pfgo') go({ k: 'scene', id: a.id });
    else if (a.bka === 'owncopy') {
      ui.bkCopyEdit = true;
      renderBook(el);
      const ta = $('[data-bk="copy"]', el);
      if (ta) ta.focus();
    } else if (a.bka === 'stdcopy') {
      b.copy = '';
      ui.bkCopyEdit = false;
      dirty('meta');
      renderBook(el);
    } else if (a.bka === 'addlink') {
      b.links.push({ label: '', url: '' });
      dirty('meta');
      renderBook(el);
      const ins = el.querySelectorAll('[data-bkl="label"]');
      if (ins.length) ins[ins.length - 1].focus();
    } else if (a.bka === 'dellink') {
      b.links.splice(+a.i, 1);
      dirty('meta');
      renderBook(el);
    }
  };
}
// A short note beside each front or back matter page in the Book details list: what it shows, or what it still needs.
function matterNote(k) {
  const b = S.meta.book;
  if (k === 'half') return 'Just the title, on a page of its own';
  if (k === 'title') return 'Title, subtitle, your name and imprint';
  if (k === 'copy') return b.copy.trim() ? 'Your own wording' : 'Standard wording, made from the details';
  if (k === 'toc') return 'The chapters (and parts), linked in ebooks';
  const has = {
    ded: b.ded,
    epi: b.epi,
    ack: b.ack,
    about: b.about,
    also: b.also,
    links: b.links.some(l => l.url || l.label)
  }[k];
  return has && String(has).trim() ? 'Written' : 'Nothing written yet: left out';
}

/* ---------- book styles: how the ebook looks ---------- */
// Book styles for the EPUB (and, later, print): [key, name, description, settings]. Settings: dc (drop cap) and sc
// (small capitals for the first words) are the style's starting choice, orn its scene-break ornament, head the CSS for
// chapter headings (h1.ch with .cn, the number, and .ct, the title), and deco an ornament printed under the heading.
const BOOK_STYLES = [
  [
    'classic',
    'Classic',
    'Centred serif headings with the number in spaced capitals. Timeless for any genre.',
    {
      dc: true,
      sc: true,
      orn: '* * *',
      head: 'h1.ch{font-family:serif;font-weight:normal;text-align:center;margin:3em 0 2.2em}h1.ch .cn{display:block;font-size:.62em;letter-spacing:.22em;text-transform:uppercase;margin-bottom:.8em}h1.ch .ct{display:block;font-size:1.25em}'
    }
  ],
  [
    'elegant',
    'Elegant',
    'Italic titles with a flourish underneath. Lovely for romance and historical fiction.',
    {
      dc: true,
      sc: true,
      orn: '❧',
      deco: '❦',
      head: 'h1.ch{font-family:serif;font-weight:normal;text-align:center;margin:3em 0 .6em}h1.ch .cn{display:block;font-size:.6em;letter-spacing:.3em;text-transform:uppercase;margin-bottom:.6em}h1.ch .ct{display:block;font-style:italic;font-size:1.35em}p.deco{text-align:center;text-indent:0;margin:0 0 2em;font-size:1.3em}'
    }
  ],
  [
    'modern',
    'Modern',
    'Left-aligned sans-serif headings with a large number and a thin rule. Clean and contemporary.',
    {
      dc: false,
      sc: false,
      orn: '• • •',
      head: 'h1.ch{font-family:sans-serif;font-weight:bold;text-align:left;margin:3em 0 2em;padding-bottom:.4em;border-bottom:1px solid currentColor}h1.ch .cn{display:block;font-size:1.8em;font-weight:300;line-height:1}h1.ch .ct{display:block;font-size:.9em;letter-spacing:.04em;margin-top:.3em}'
    }
  ],
  [
    'thriller',
    'Thriller',
    'Bold capital headings with a heavy rule. Punchy for crime, thrillers and action.',
    {
      dc: false,
      sc: false,
      orn: '■',
      head: 'h1.ch{font-family:sans-serif;font-weight:bold;text-transform:uppercase;text-align:center;letter-spacing:.06em;margin:3em 0 2em}h1.ch .cn{display:block;font-size:2.2em;line-height:1;border-bottom:3px solid currentColor;padding-bottom:.15em;margin:0 auto .4em;width:2.2em}h1.ch .ct{display:block;font-size:.85em}'
    }
  ],
  [
    'storybook',
    'Storybook',
    'A star under each heading and a large drop cap. Made for fantasy and children’s books.',
    {
      dc: true,
      sc: true,
      orn: '✦ ✦ ✦',
      deco: '✦',
      head: 'h1.ch{font-family:serif;font-weight:normal;text-align:center;margin:3em 0 .5em}h1.ch .cn{display:block;font-size:.7em;letter-spacing:.15em;text-transform:uppercase;margin-bottom:.5em}h1.ch .ct{display:block;font-size:1.4em}p.deco{text-align:center;text-indent:0;margin:0 0 2em}'
    }
  ],
  [
    'simple',
    'Simple',
    'Plain centred headings and nothing else. Lets the words speak.',
    {
      dc: false,
      sc: false,
      orn: '* * *',
      head: 'h1.ch{font-weight:normal;text-align:center;margin:3em 0 2em}h1.ch .cn,h1.ch .ct{display:block}h1.ch .cn{margin-bottom:.4em}'
    }
  ],
  [
    'typewriter',
    'Typewriter',
    'Monospaced headings, like a manuscript on the desk. Fun for literary and quirky books.',
    {
      dc: false,
      sc: false,
      orn: '#',
      head: 'h1.ch{font-family:monospace;font-weight:normal;text-align:left;margin:3em 0 2em}h1.ch .cn{display:block;font-size:.8em;margin-bottom:.6em}h1.ch .cn:before{content:"— "}h1.ch .ct{display:block}'
    }
  ]
];
// Scene-break ornaments the writer can choose. Plain characters show on every e-reader; fancier ones on most.
const BOOK_ORNS = ['* * *', '#', '• • •', '~', '⁂', '❧', '❦', '✦ ✦ ✦', '◆', '■', ''];
const bookStyle = () => (BOOK_STYLES.find(x => x[0] === S.meta.book.style) || BOOK_STYLES[0])[3];
// The ebook's CSS for the chosen style: body text, headings, drop caps, small capitals, scene breaks, part pages and
// front and back matter. scope prefixes every rule, so the same CSS can preview a style inside the Book details screen.
function bookCss(scope) {
  const st = bookStyle(),
    css =
      'p{margin:0;text-indent:1.5em}p.first,p.brk+p,p.deco+p{text-indent:0}p.brk{text-align:center;text-indent:0;margin:1em 0}' +
      'h1{page-break-before:always}h1.part{text-align:center;font-weight:normal;margin-top:35%;font-size:1.6em}h1.part .cn{display:block;font-size:.55em;letter-spacing:.2em;text-transform:uppercase;margin-bottom:.6em}' +
      '.dc{float:left;font-size:3.2em;line-height:.85;margin:.05em .08em 0 0}.sc{font-variant:small-caps;letter-spacing:.03em}' +
      st.head +
      '.cover{margin:0;padding:0;text-align:center}.cover img{max-width:100%;max-height:100%}' +
      MATTER_CSS;
  if (!scope) return css;
  // add the scope in front of every selector (rules are simple "selectors{declarations}" pairs)
  return css.replace(
    /(^|})([^{}]+)\{/g,
    (m, end, sel) =>
      end +
      sel
        .split(',')
        .map(x => scope + ' ' + x.trim())
        .join(',') +
      '{'
  );
}
// One chapter's text as ebook HTML: scenes joined by the style's ornament, the first paragraph without an indent,
// and, if chosen, a drop cap and the first words in small capitals.
function chapterHtml(scenes) {
  const b = S.meta.book,
    orn = b.orn;
  return scenes
    .map((x, si) =>
      x
        .map((l, li) => {
          if (li) return '<p>' + htmlRuns(l) + '</p>';
          let h = htmlRuns(l);
          if (si === 0 && (b.dc || b.sc)) {
            // the opening letter (after any quotes or opening formatting tags) and the words after it, up to the next
            // tag, so the spans always nest inside the formatting
            const m = h.match(
              /^((?:&quot;|[“‘'(]|<(?:em|strong|u)>)*)(\p{L})((?:[^\s<&]|&amp;)*(?:\s+[^\s<&]+){0,3})/u
            );
            if (m)
              h =
                m[1] +
                (b.dc ? '<span class="dc">' + m[2] + '</span>' : m[2]) +
                (b.sc ? '<span class="sc">' + m[3] + '</span>' : m[3]) +
                h.slice(m[0].length);
          }
          return '<p class="first">' + h + '</p>';
        })
        .join('')
    )
    .join(orn ? '<p class="brk">' + xe(orn) + '</p>' : '<p class="brk">&#160;</p>');
}
// The ebook heading for a chapter or part, with the style's ornament under it.
function chapterHead(c) {
  if (!c.label && !c.title) return '';
  const deco = bookStyle().deco;
  return (
    '<h1 class="' +
    (c.kind === 'part' ? 'part' : 'ch') +
    '">' +
    (c.label ? '<span class="cn">' + xe(c.label) + '</span>' : '') +
    (c.title ? '<span class="ct">' + xe(c.title) + '</span>' : '') +
    '</h1>' +
    (deco && c.kind !== 'part' ? '<p class="deco">' + xe(deco) + '</p>' : '')
  );
}
// A sample of the first chapter in the chosen style, for the Book details screen.
function stylePreviewHtml() {
  const H = chHeads(),
    c = S.meta.chapters.find(x => !x.kind && x.scenes.some(id => S.sc[id].text.trim())) || S.meta.chapters[0],
    h = c ? H[c.id] : { kind: '', label: 'Chapter One', title: 'A Beginning' };
  const lines = c
    ? c.scenes
        .map(id =>
          String(S.sc[id].text || '')
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
        )
        .filter(x => x.length)
        .slice(0, 2)
        .map((x, i) => (i ? x.slice(0, 1) : x.slice(0, 2)))
    : [['It was a dark and stormy night.']];
  return (
    '<style>' +
    bookCss('.bk-pv') +
    '</style><div class="bk-pv">' +
    chapterHead({
      kind: h.kind,
      label: h.label || (S.meta.book.chNum === 'none' ? '' : 'Chapter One'),
      title: h.title
    }) +
    chapterHtml(lines) +
    '</div>'
  );
}

/* ---------- the cover ---------- */
// The cover's size in pixels, read from the picture itself (null when there is none or it can't be read).
function coverSize() {
  return new Promise(res => {
    const src = picSrc('cover');
    if (!src) return res(null);
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => res(null);
    im.src = src;
  });
}
// The cover as JPEG bytes for the ebook (every e-reader shows JPEG), or null. Desktop pictures are read through the
// desktop app, so the canvas is never "tainted" by a picture from another origin.
async function coverJpeg() {
  const p = S.meta.book.cover;
  if (!hasPic(p)) return null;
  try {
    const src = p.f && DESK && PJ.id ? await DESK.picRead(PJ.id, p.f) : picSrc('cover');
    const im = await new Promise((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = bad;
      i.src = src;
    });
    const c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height } : null;
  } catch (e) {
    return null;
  }
}

/* ---------- the check before publishing ---------- */
// An ISBN-13 (or ISBN-10) with a correct check digit; spaces and hyphens are ignored.
function isbnOk(s) {
  const d = String(s).replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{13}$/.test(d)) return [...d].reduce((a, c, i) => a + +c * (i % 2 ? 3 : 1), 0) % 10 === 0;
  if (/^\d{9}[\dX]$/.test(d)) return [...d].reduce((a, c, i) => a + (c === 'X' ? 10 : +c) * (10 - i), 0) % 11 === 0;
  return false;
}
// Things to look at before publishing: [{level:'warn'|'tip', text, fix?: 'tidy', scene?}]. For an ebook (the default)
// this includes the cover (reading its size, so it returns a Promise) and the store description; print leaves them out.
async function preflight(fmt) {
  const m = S.meta,
    b = m.book,
    out = [],
    add = (level, text, o) => out.push(Object.assign({ level, text }, o || {})),
    ebook = fmt !== 'print';
  const cs = ebook ? await coverSize() : null;
  if (ebook && !cs) add('warn', 'There is no cover. Stores need one: add it in Book details › Cover.');
  else if (cs) {
    if (cs.w < 625 || cs.h < 1000)
      add(
        'warn',
        'The cover is small (' +
          cs.w +
          ' × ' +
          cs.h +
          ' pixels). Kindle asks for at least 625 × 1000; 1600 × 2560 is ideal.'
      );
    const r = cs.h / cs.w;
    if (r < 1.3 || r > 1.8)
      add(
        'tip',
        'The cover is ' +
          (r < 1.3 ? 'wide' : 'tall') +
          ' for a book (' +
          cs.w +
          ' × ' +
          cs.h +
          '). Most ebook covers are 1.6 times taller than wide.'
      );
  }
  if (!(m.exp.byline || m.author || '').trim())
    add('warn', 'Your name is missing. It goes on the title page and in the book’s details.');
  [
    ['isbnE', 'ebook'],
    ['isbnP', 'paperback'],
    ['isbnH', 'hardcover']
  ].forEach(([k, l]) => {
    if (b[k].trim() && !isbnOk(b[k]))
      add('warn', 'The ' + l + ' ISBN (' + b[k].trim() + ') doesn’t look right: its last digit doesn’t match.');
  });
  if (ebook && !b.desc.trim()) add('tip', 'There is no description yet. Stores show it on your book’s page.');
  let straight = 0,
    doubles = 0,
    todo = [],
    long = 0;
  m.chapters.forEach(c => {
    const txt = c.scenes.map(id => S.sc[id].text).join('\n');
    if (c.kind !== 'part' && !txt.trim()) add('warn', '“' + c.title + '” has no text yet.');
    c.scenes.forEach(id => {
      const t = S.sc[id].text;
      straight += (t.match(/["']/g) || []).length;
      doubles += (t.match(/\S {2,}\S/g) || []).length;
      if (/\b(TODO|TK|XXX|FIXME)\b|\[\[/.test(t)) todo.push(id);
      long += t.split('\n').filter(l => wc(l) > 400).length;
    });
  });
  todo
    .slice(0, 5)
    .forEach(id => add('warn', '“' + m.scenes[id].title + '” has a TODO, TK or [[note]] left in it.', { scene: id }));
  if (todo.length > 5) add('warn', todo.length - 5 + ' more scenes have notes left in them.');
  if (straight || doubles)
    add(
      'tip',
      [
        straight ? straight + ' straight quote' + (straight === 1 ? '' : 's') : '',
        doubles ? doubles + ' double space' + (doubles === 1 ? '' : 's') : ''
      ]
        .filter(Boolean)
        .join(' and ') + ' in the text. Books use curly quotes and single spaces.',
      { fix: 'tidy' }
    );
  if (long)
    add(
      'tip',
      long +
        ' very long paragraph' +
        (long === 1 ? '' : 's') +
        ' (over 400 words). Long paragraphs are hard to read on a phone.'
    );
  return out;
}
// Curly quotes, single spaces, em dashes and ellipses in one scene's stored text. Formatting markers (* and _) are
// skipped over when deciding whether a quote opens or closes.
function tidyText(t) {
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '"' || ch === "'") {
      let j = out.length - 1;
      while (j >= 0 && (out[j] === '*' || out[j] === '_')) j--;
      const before = j < 0 ? '' : out[j],
        opening = !before || /[\s(\[{—–-]/.test(before);
      out += ch === '"' ? (opening ? '“' : '”') : opening ? '‘' : '’';
    } else out += ch;
  }
  return out
    .replace(/(\S) {2,}(?=\S)/g, '$1 ')
    .replace(/(^|[^-])--(?!-)/g, '$1—')
    .replace(/\.\.\./g, '…');
}
// Tidies the typography of every scene (after a snapshot of each one changed). Returns how many scenes changed.
function tidyBook() {
  let n = 0;
  orderedScenes().forEach(o => {
    const t = S.sc[o.id].text,
      nt = tidyText(t);
    if (nt === t) return;
    snTake(o.id, '', 'replace');
    setSceneText(o.id, nt);
    n++;
  });
  return n;
}

// The results of the check before publishing, as a list (with a Tidy button for typography and links to scenes).
function preflightHtml(list) {
  if (!list.length) return '<p class="bk-pf-ok">' + ico('check', 15) + ' Everything looks ready.</p>';
  return (
    '<ul class="bk-pf">' +
    list
      .map(
        x =>
          '<li class="' +
          x.level +
          '">' +
          ico(x.level === 'warn' ? 'alert' : 'info', 14) +
          '<span>' +
          esc(x.text) +
          (x.fix === 'tidy' ? ' <button class="lnk" data-bka="tidy">Tidy typography</button>' : '') +
          (x.scene ? ' <button class="lnk" data-bka="pfgo" data-id="' + x.scene + '">Open</button>' : '') +
          '</span></li>'
      )
      .join('') +
    '</ul>'
  );
}
