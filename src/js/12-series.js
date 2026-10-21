/*
 * 12-series.js: Series bible: sharing a world between the books of a series
 *
 * The Series bible screen ({k:'series'}) names the series and the book's number, and brings story pages, timelines,
 * world maps, calendars and money in from another book: another project on this computer (desktop) or a backup file.
 * A page brought in remembers where it came from (meta.ents[id].from), so a later import updates it instead of making
 * a copy. It also exports a story bible: every page, arc, thread, calendar and currency as one Word or Markdown
 * document.
 */
// meta.series{name,num}. A page brought in keeps from{book,src,id,at} (src: the desktop project id, '' for a backup
// file) so it can be updated later from that book. View {k:'series'} (renderSeries); ui.sb holds the open source:
// {title,src,data (normalized),imgs (backup pictures)}. A story bible document exports every page (bibleBlocks).
function normSeries(x) {
  x = x && typeof x === 'object' ? x : {};
  return { name: String(x.name || '').slice(0, 120), num: Math.max(0, Math.min(999, Math.round(+x.num || 0))) };
}
// Checks where a page came from: {book, src (desktop project id), id (the page there), at}.
function normFrom(f) {
  return f && typeof f === 'object' && typeof f.id === 'string'
    ? {
        book: String(f.book || '').slice(0, 160),
        src: /^[\w.-]{1,120}$/.test(f.src || '') ? f.src : '',
        id: f.id.slice(0, 60),
        at: +f.at || 0
      }
    : null;
}
// Opens another project on this computer as the source to bring things in from.
async function sbOpenDesk(id) {
  try {
    const r = await DESK.read(id);
    if (!r || r.data == null) throw 0;
    const d = normalize(JSON.parse(r.data));
    ui.sb = { title: d.meta.title, src: id, data: d, imgs: null };
  } catch (e) {
    toast(
      e && e.code === 'newer'
        ? 'That book was saved by a newer Inkling. Update Inkling first.'
        : 'Could not open that book.',
      { plain: true }
    );
    ui.sb = null;
  }
  renderMain();
}
// Opens a backup file as the source to bring things in from.
function sbOpenFile(f) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(r.result);
      if (!o || !o.meta || !Array.isArray(o.meta.chapters)) throw 0;
      const d = normalize(o);
      ui.sb = { title: d.meta.title, src: '', data: d, imgs: o.imgs || null };
    } catch (e) {
      toast(
        e && e.code === 'newer' ? 'That backup was made by a newer Inkling.' : 'That file is not an Inkling backup.',
        { plain: true }
      );
      ui.sb = null;
    }
    renderMain();
  };
  r.readAsText(f);
}
// The page here that a source page matches: one brought in from it before, or one of the same type and name.
function sbMatch(e, src) {
  const m = S.meta,
    ents = Object.values(m.ents);
  return (
    ents.find(x => x.from && x.from.id === e.id && x.from.book === src.title) ||
    ents.find(x => x.type === e.type && x.name.trim().toLowerCase() === e.name.trim().toLowerCase()) ||
    null
  );
}
// A fingerprint of a page's content, to tell whether it differs between the two books.
const sbPageSig = (meta, en, id) => {
  const e = meta.ents[id];
  return canon({ n: e.name, a: e.aliases, t: e.tag, ty: e.type, f: (en[id] || {}).fields || {} });
};
// Copies a picture from the source book onto a page or map here.
async function sbPic(srcId, srcPic, id) {
  // copies a picture from the source book onto the page or map `id` here
  let url = '';
  const sb = ui.sb;
  if (!sb || !srcPic) return;
  try {
    if (sb.src && srcPic.f) url = await DESK.picRead(sb.src, srcPic.f);
    else if (sb.imgs && typeof sb.imgs[srcId] === 'string') url = sb.imgs[srcId];
    else if (srcPic.a && !DESK) {
      const r = await fetch('/_blob/' + srcPic.a);
      if (r.ok) url = await toDataUrl(await r.blob());
    }
  } catch (e) {}
  if (!/^data:image\//.test(url)) return;
  const b = await (await fetch(url)).blob();
  await setPic(id, new File([b], 'picture', { type: b.type || 'image/png' }));
  const p = picRec(id);
  ['cap', 'shape', 'size', 'fit', 'px', 'py', 'zoom'].forEach(k => {
    if (srcPic[k] != null) p[k] = srcPic[k];
  });
}
// Brings the chosen pages, timelines, maps and calendars/money in from the source book. Matching pages are updated,
// not duplicated. Returns how many things came in.
async function sbBring(sel) {
  const sb = ui.sb,
    src = sb.data,
    m = S.meta,
    idMap = {};
  let n = 0;
  for (const id of sel.ent) {
    const e = src.meta.ents[id],
      b = src.en[id] || { fields: {} };
    if (!e) continue;
    const hit = sbMatch(e, sb);
    const tid = hit ? hit.id : uid('e_');
    if (!hit) {
      m.ents[tid] = { id: tid, type: e.type, name: e.name, aliases: [], tag: '' };
      S.en[tid] = { fields: {}, pic: normPic() };
    }
    Object.assign(m.ents[tid], {
      type: e.type,
      name: e.name,
      aliases: (e.aliases || []).slice(),
      tag: e.tag || '',
      from: { book: sb.title, src: sb.src, id, at: Date.now() }
    });
    S.en[tid].fields = bare(b.fields || {});
    if (!secOn(e.type)) {
      m.secs[e.type] = true;
      ui.openSec[e.type] = true;
    }
    idMap[id] = tid;
    dirty('en_' + tid);
    n++;
    const sp = b.pic;
    if (sp && (sp.f || sp.a || sp.l)) await sbPic(id, sp, tid);
  }
  Object.keys(src.meta.ents).forEach(id => {
    if (!idMap[id]) {
      const h = sbMatch(src.meta.ents[id], sb);
      if (h) idMap[id] = h.id;
    }
  });
  for (const id of sel.tl) {
    const t = src.tl[id],
      x = src.meta.tls.find(q => q.id === id);
    if (!t || !x) continue;
    const nid = uid('t_'),
      c = normTl(bare(t));
    Object.values(c.cards).forEach(k => {
      k.scene = '';
    });
    S.tl[nid] = c;
    m.tls.push({ id: nid, name: x.name + ' (' + sb.title + ')' });
    dirty('tl_' + nid);
    n++;
  }
  for (const id of sel.map) {
    const d = src.nt[id],
      x = src.meta.nts.find(q => q.id === id);
    if (!d || !x) continue;
    const nid = uid('nt_'),
      c = normMap(bare(d));
    c.pic = normPic();
    c.pins.forEach(pn => {
      if (pn.ent) {
        const e = src.meta.ents[pn.ent];
        pn.name = pn.name || (e ? e.name : '');
        pn.ent = idMap[pn.ent] || '';
      }
    });
    S.nt[nid] = Object.assign({ text: '', ideas: [] }, c);
    m.nts.push({ id: nid, name: x.name, kind: 'map' });
    dirty('nt_' + nid);
    n++;
    if (d.pic && (d.pic.f || d.pic.a || d.pic.l)) await sbPic(id, d.pic, nid);
  }
  if (sel.world) {
    const w = src.meta.world;
    w.cals.forEach(c => {
      if (!m.world.cals.some(q => q.name === c.name)) {
        m.world.cals.push(Object.assign(bare(c), { id: uid('cal') }));
        n++;
      }
    });
    w.coins.forEach(c => {
      if (!m.world.coins.some(q => q.name === c.name)) {
        m.world.coins.push(Object.assign(bare(c), { id: uid('cn') }));
        n++;
      }
    });
  }
  if (!m.series.name && src.meta.series && src.meta.series.name) m.series.name = src.meta.series.name;
  dirty('meta');
  linker = buildLinker();
  renderBinder();
  return n;
}
// The Series bible screen.
function renderSeries(el) {
  const m = S.meta,
    sb = ui.sb,
    linked = Object.values(m.ents).filter(e => e.from);
  let h =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('book', 16) +
    '</span><h1 class="mh-title">Series bible</h1></div><div class="pf-wrap">' +
    '<section class="pf"><h2>This book in its series</h2><div class="two"><label class="f">Series<input data-sr="name" value="' +
    esc(m.series.name) +
    '" maxlength="120" placeholder="The Lantern Chronicles"></label><label class="f">Book number<input type="number" min="0" data-sr="num" value="' +
    (m.series.num || '') +
    '" placeholder="1"></label></div>' +
    '<p class="fine">Write a series without retyping your world. Bring characters, places, rules, glossary words, timelines, maps, calendars and money in from another book, and update them later when that book changes. You can also export everything as one story bible document.</p>' +
    '<div class="w-add"><button class="btn" data-sr="bible">' +
    ico('down', 14) +
    '<span>Export the story bible (Word)</span></button><button class="btn" data-sr="biblemd">' +
    ico('down', 14) +
    '<span>Markdown</span></button></div></section>';
  h += '<section class="pf"><h2>Bring in from another book</h2>';
  if (DESK)
    h +=
      '<p class="fine">Choose one of your books, or a backup file.</p><div class="sb-books" id="sbBooks"><span class="muted">Looking for your books…</span></div>';
  h +=
    '<div class="w-add"><button class="btn" data-sr="file">' +
    ico('upload', 14) +
    '<span>Choose a backup file (.json)</span></button></div><input type="file" id="sbFile" accept=".json,application/json" hidden>';
  if (sb) {
    const d = sb.data,
      ents = Object.values(d.meta.ents).sort((a, b) => a.name.localeCompare(b.name));
    const row = (k, id, label, sub, on) =>
      '<label class="ck sb-ck"><input type="checkbox" data-sb="' +
      k +
      '" value="' +
      id +
      '"' +
      (on ? ' checked' : '') +
      '><span>' +
      label +
      '</span>' +
      (sub ? '<small>' + sub + '</small>' : '') +
      '</label>';
    h +=
      '<div class="sb-src"><h3>From “' +
      esc(sb.title) +
      '”' +
      (d.meta.series && d.meta.series.name
        ? ' <span class="muted">' +
          esc(d.meta.series.name) +
          (d.meta.series.num ? ', book ' + d.meta.series.num : '') +
          '</span>'
        : '') +
      '</h3>' +
      '<div class="sb-acts"><button class="lnk" data-sr="all">Select all</button> · <button class="lnk" data-sr="none">None</button></div>' +
      TYPE_ORDER.map(t => {
        const l = ents.filter(e => e.type === t);
        if (!l.length) return '';
        return (
          '<h4>' +
          esc(LP(t)) +
          '</h4>' +
          l
            .map(e => {
              const hit = sbMatch(e, sb),
                same = hit && sbPageSig(m, S.en, hit.id) === sbPageSig(d.meta, d.en, e.id);
              return row(
                'ent',
                e.id,
                esc(e.name),
                hit ? (same ? 'already here, the same' : 'already here: will be updated') : 'new',
                !hit || !same
              );
            })
            .join('')
        );
      }).join('') +
      (d.meta.tls.length
        ? '<h4>' +
          esc(LP('tl')) +
          '</h4>' +
          d.meta.tls
            .map(x => row('tl', x.id, esc(x.name), Object.keys(d.tl[x.id].cards).length + ' cards', false))
            .join('')
        : '') +
      (d.meta.nts.some(x => x.kind === 'map')
        ? '<h4>World maps</h4>' +
          d.meta.nts
            .filter(x => x.kind === 'map')
            .map(x => row('map', x.id, esc(x.name), (d.nt[x.id].pins || []).length + ' pins', true))
            .join('')
        : '') +
      (d.meta.world.cals.length || d.meta.world.coins.length
        ? '<h4>Calendars &amp; money</h4>' +
          row(
            'world',
            '1',
            d.meta.world.cals
              .map(c => esc(c.name))
              .concat(d.meta.world.coins.map(c => esc(c.name)))
              .join(', '),
            'only ones not here yet',
            true
          )
        : '') +
      '<div class="ask-btns"><button class="btn" data-sr="cancel">Cancel</button><button class="btn pri" data-sr="bring">' +
      ico('down', 14) +
      '<span>Bring them in</span></button></div></div>';
  }
  h += '</section>';
  if (linked.length) {
    const by = {};
    linked.forEach(e => {
      (by[e.from.book] = by[e.from.book] || []).push(e);
    });
    h +=
      '<section class="pf"><h2>Pages from other books <span class="muted">' +
      linked.length +
      '</span></h2><p class="fine">' +
      (DESK
        ? 'Check them against their books to pick up changes made there.'
        : 'To pick up changes, open a newer backup of that book above: pages that changed are marked to be updated.') +
      '</p>' +
      Object.keys(by)
        .map(
          b =>
            '<h4>' +
            esc(b) +
            '</h4><div class="sb-linked">' +
            by[b]
              .map(
                e =>
                  '<button class="cl t-' +
                  e.type +
                  '" data-sr="open" data-id="' +
                  e.id +
                  '"><i class="pip"></i><span class="nm">' +
                  esc(e.name) +
                  '</span></button>'
              )
              .join('') +
            '</div>' +
            (DESK && by[b][0].from.src
              ? '<button class="btn sm" data-sr="check" data-src="' +
                esc(by[b][0].from.src) +
                '">' +
                ico('search', 13) +
                '<span>Check “' +
                esc(b) +
                '” for changes</span></button>'
              : '')
        )
        .join('') +
      '</section>';
  }
  el.innerHTML = h + '</div>';
  if (DESK)
    DESK.list()
      .then(list => {
        const box = $('#sbBooks', el);
        if (!box) return;
        const others = list.filter(x => x.id !== PJ.id && !x.missing);
        box.innerHTML = others.length
          ? others
              .map(
                x =>
                  '<button class="btn sm" data-sr="book" data-id="' +
                  esc(x.id) +
                  '">' +
                  ico('book', 13) +
                  '<span>' +
                  esc(x.title) +
                  '</span></button>'
              )
              .join('')
          : '<span class="muted">No other books here yet.</span>';
      })
      .catch(() => {});
  $('#sbFile', el).addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) sbOpenFile(f);
  });
  el.oninput = e => {
    const k = e.target.dataset.sr;
    if (k === 'name') m.series.name = e.target.value.slice(0, 120);
    else if (k === 'num') m.series.num = Math.max(0, Math.min(999, Math.round(+e.target.value || 0)));
    else return;
    dirty('meta');
  };
  el.onclick = async e => {
    const b = e.target.closest('[data-sr]');
    if (!b || b.tagName === 'INPUT') return;
    const k = b.dataset.sr;
    if (k === 'file') {
      const f = $('#sbFile', el);
      f.value = '';
      f.click();
    } else if (k === 'book') sbOpenDesk(b.dataset.id);
    else if (k === 'all' || k === 'none')
      el.querySelectorAll('[data-sb]').forEach(c => {
        c.checked = k === 'all';
      });
    else if (k === 'cancel') {
      ui.sb = null;
      renderSeries(el);
    } else if (k === 'bring') {
      const sel = { ent: [], tl: [], map: [], world: false };
      el.querySelectorAll('[data-sb]:checked').forEach(c => {
        if (c.dataset.sb === 'world') sel.world = true;
        else sel[c.dataset.sb].push(c.value);
      });
      b.disabled = true;
      const n = await sbBring(sel);
      ui.sb = null;
      toast(n ? 'Brought in ' + n + ' thing' + (n === 1 ? '' : 's') + '.' : 'Nothing was selected.', { plain: true });
      renderSeries(el);
    } else if (k === 'check') sbOpenDesk(b.dataset.src);
    else if (k === 'open') go({ k: 'ent', id: b.dataset.id });
    else if (k === 'bible') saveFile(slug(m.title) + '-story-bible.docx', bibleDocx());
    else if (k === 'biblemd') saveFile(slug(m.title) + '-story-bible.md', bibleMd());
  };
}
// The story bible: every story page, arcs, threads, calendars and money, as headings and paragraphs.
function bibleBlocks() {
  const m = S.meta,
    out = [
      ['t', m.title + ' · Story bible'],
      [
        'p',
        (m.series.name ? m.series.name + (m.series.num ? ', book ' + m.series.num : '') + ' · ' : '') + (m.author || '')
      ]
    ];
  TYPE_ORDER.forEach(t => {
    const l = Object.values(m.ents)
      .filter(e => e.type === t)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!l.length) return;
    out.push(['h1', LP(t)]);
    l.forEach(e => {
      const f = (S.en[e.id] || {}).fields || {};
      out.push(['h2', e.name]);
      if (e.aliases.length) out.push(['i', 'Also called: ' + e.aliases.join(', ')]);
      if (e.tag) out.push(['i', e.tag]);
      entFields(e.type)
        .concat([['facts', 'Key facts']])
        .forEach(([k, lab]) => {
          const v = String(f[k] || '').trim();
          if (v) out.push(['kv', lab, v]);
        });
      const a = arcOf(e.id);
      if (a) {
        ARC_F.forEach(([k, lab]) => {
          if (a[k]) out.push(['kv', lab, a[k]]);
        });
      }
    });
  });
  if (m.threads.length) {
    out.push(['h1', 'Plot threads']);
    m.threads.forEach(t => {
      out.push(['h2', t.name]);
      if (t.note) out.push(['p', t.note]);
    });
  }
  if (m.world.cals.length || m.world.coins.length) {
    out.push(['h1', 'Calendars and money']);
    m.world.cals.forEach(c => {
      out.push(['h2', c.name]);
      out.push([
        'p',
        c.months.map(x => x[0] + ' (' + x[1] + ' days)').join(', ') +
          '. ' +
          calYear(c) +
          ' days a year.' +
          (c.week ? ' Week: ' + c.week + '.' : '') +
          (c.era ? ' Era: ' + c.era + '.' : '')
      ]);
    });
    m.world.coins.forEach(c => {
      out.push(['h2', c.name]);
      out.push([
        'p',
        c.units
          .map((u, i) => (i < c.units.length - 1 ? '1 ' + u[0] + ' = ' + u[1] + ' ' + c.units[i + 1][0] : ''))
          .filter(Boolean)
          .join('; ') || c.units.map(u => u[0]).join(', ')
      ]);
      if (c.note) out.push(['p', c.note]);
    });
  }
  return out;
}
// The story bible as Markdown.
function bibleMd() {
  return (
    bibleBlocks()
      .map(b =>
        b[0] === 't'
          ? '# ' + b[1]
          : b[0] === 'h1'
            ? '## ' + b[1]
            : b[0] === 'h2'
              ? '### ' + b[1]
              : b[0] === 'i'
                ? '*' + b[1] + '*'
                : b[0] === 'kv'
                  ? '**' + b[1] + ':** ' + b[2].replace(/\n/g, '  \n')
                  : b[1]
      )
      .filter(x => x.trim())
      .join('\n\n') + '\n'
  );
}
// The story bible as a Word document.
function bibleDocx() {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const r = (t, o) =>
    '<w:r>' +
    (o ? '<w:rPr>' + o + '</w:rPr>' : '') +
    String(t)
      .split('\n')
      .map((x, i) => (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + xe(x) + '</w:t>')
      .join('') +
    '</w:r>';
  const p = (sty, inner) => '<w:p>' + (sty ? '<w:pPr><w:pStyle w:val="' + sty + '"/></w:pPr>' : '') + inner + '</w:p>';
  const body = bibleBlocks()
    .map(b =>
      b[0] === 't'
        ? p('Title', r(b[1]))
        : b[0] === 'h1'
          ? p('Heading1', r(b[1]))
          : b[0] === 'h2'
            ? p('Heading2', r(b[1]))
            : b[0] === 'i'
              ? p('', r(b[1], '<w:i/>'))
              : b[0] === 'kv'
                ? p('', r(b[1] + ': ', '<w:b/>') + r(b[2]))
                : b[1]
                  ? p('', r(b[1]))
                  : ''
    )
    .join('');
  const st = (id, name, rpr, ppr) =>
    '<w:style w:type="paragraph" w:styleId="' +
    id +
    '"><w:name w:val="' +
    name +
    '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/>' +
    ppr +
    '</w:pPr><w:rPr>' +
    rpr +
    '</w:rPr></w:style>';
  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' +
    W +
    '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    st('Title', 'Title', '<w:sz w:val="44"/>', '<w:spacing w:after="240"/>') +
    st(
      'Heading1',
      'heading 1',
      '<w:b/><w:sz w:val="32"/>',
      '<w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/>'
    ) +
    st(
      'Heading2',
      'heading 2',
      '<w:b/><w:sz w:val="26"/>',
      '<w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/>'
    ) +
    '</w:styles>';
  return zip([
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    ],
    [
      'word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
    ],
    [
      'word/document.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' +
        W +
        '><w:body>' +
        body +
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>'
    ],
    ['word/styles.xml', styles]
  ]);
}
