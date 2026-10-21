/*
 * 26-timeline.js: Timelines
 *
 * A timeline has lanes (rows) and cards placed along a time scale (axis) in its own units: days, years, chapters or
 * an invented calendar. Positions are kept in those units, never in pixels, so zooming and changing the scale never
 * move anything. Cards that overlap in a lane stack into rows. Marks are labelled spans across all lanes (an era, a
 * war).
 *
 * drawTl() redraws only the board and drawSide() only the side panel (a card's details or the timeline's settings),
 * so typing in the panel never loses focus while the board updates. Mouse drags a whole card; on touch screens only
 * its grip or resize edge drags, so the board still scrolls.
 */
// Whether this is a touch screen without a mouse.
const TOUCH = !!(window.matchMedia && matchMedia('(hover: none)').matches);
// The height of the time scale at the top, in pixels.
const AXH = 48;
// The width of the lane names column, narrower on phones.
const lw = () => (window.innerWidth < 600 ? 108 : 156);
let D = null; // card being dragged or resized
// The timeline that is open.
const curTl = () => (ui.view && ui.view.k === 'tl' ? S.tl[ui.view.id] : null);
// The open timeline's save key.
const tlKey = () => 'tl_' + ui.view.id;
// The timeline's list of names for its ticks (months, seasons…).
const tlNames = t =>
  t.axis.names
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(Boolean);
// The column (tick) a time value falls in.
const tlIdx = (t, v) => Math.floor((v - t.axis.start) / t.axis.step + 1e-9);
// The label for a time value: the column's own label if the writer renamed it, else the template ({n}, {name},
// {cycle}, {i}).
function tlLabel(t, v, auto) {
  const a = t.axis,
    idx = tlIdx(t, v),
    names = tlNames(t),
    L = names.length;
  if (!auto && t.ticks[idx]) return t.ticks[idx];
  return a.fmt.replace(/\{(n|i|name|cycle)\}/g, (m, k) =>
    k === 'n'
      ? nfmt(v)
      : k === 'i'
        ? String(idx + 1)
        : k === 'name'
          ? L
            ? names[((idx % L) + L) % L]
            : ''
          : nfmt((L ? Math.floor(idx / L) : idx) + a.cycle)
  );
}
// A span of time as words: "Day 3 – Day 5".
const tlSpan = (t, at, len) => tlLabel(t, at) + (len ? ' – ' + tlLabel(t, at + len) : '');
// When a card happens: its own words, or its span on the scale.
const tlWhen = (t, c) => c.when || tlSpan(t, c.at, c.len);
// Rounds a time value to the timeline's snap setting.
function tlSnap(t, v) {
  const a = t.axis,
    u = a.step * (a.snap || 0);
  return +(u ? a.start + Math.round((v - a.start) / u) * u : v).toFixed(4);
}
// The span of time the board shows: everything on it, with room around, and at least the width of the window.
function tlRange(t, vw) {
  const a = t.axis;
  let lo = a.start,
    hi = a.start + a.step * 6;
  Object.values(t.cards).forEach(c => {
    lo = Math.min(lo, c.at);
    hi = Math.max(hi, c.at + c.len);
  });
  if (t.showMarks)
    t.marks.forEach(m => {
      lo = Math.min(lo, m.at);
      hi = Math.max(hi, m.at + m.len);
    });
  const from = a.start + Math.floor((lo - a.start) / a.step) * a.step;
  const n = Math.min(
    4000,
    Math.max(Math.ceil((hi - from) / a.step) + Math.ceil(t.cardW / a.px) + 2, Math.ceil(vw / a.px) + 1)
  );
  return { from, n, w: n * a.px };
}
// Places cards in rows within each lane so overlapping cards stack.
function tlLayout(t, R) {
  const a = t.axis,
    out = {},
    ends = {};
  t.lanes.forEach(l => {
    out[l.id] = { rows: 1, items: [] };
    ends[l.id] = [];
  });
  Object.values(t.cards)
    .sort((p, q) => p.at - q.at || q.len - p.len)
    .forEach(c => {
      const L = out[c.lane];
      if (!L) return;
      const x = ((c.at - R.from) / a.step) * a.px,
        sw = (c.len / a.step) * a.px,
        w = Math.max(t.cardW, sw),
        e = ends[c.lane];
      let r = 0;
      while (r < e.length && e[r] > x - 8) r++;
      e[r] = x + w;
      L.rows = Math.max(L.rows, r + 1);
      L.items.push({ c, x, w, sw, r });
    });
  return out;
}
// One card on the board.
function tlCardHtml(t, it, l, H, hit) {
  const c = it.c,
    col = c.color || l.color,
    big = t.density !== 'compact',
    scn = c.scene && S.meta.scenes[c.scene],
    when = tlWhen(t, c);
  return (
    '<div class="tl-card s-' +
    c.style +
    ' d-' +
    t.density +
    (hit ? '' : ' dim') +
    (ui.tlSel === c.id ? ' sel' : '') +
    '" tabindex="0" role="button" data-card="' +
    c.id +
    '" title="' +
    esc(when) +
    '" aria-label="' +
    esc((c.title || 'Untitled card') + ', ' + when) +
    '" style="left:' +
    it.x +
    'px;top:' +
    (it.r * H + 8) +
    'px;width:' +
    it.w +
    'px;height:' +
    (H - 8) +
    'px;--c:' +
    cssCol(col) +
    ';--ci:' +
    inkOn(col) +
    '">' +
    (c.len ? '<i class="tc-span" style="width:' + Math.max(4, it.sw) + 'px"></i>' : '') +
    '<div class="tc-h">' +
    (c.icon ? '<span class="tc-ic">' + esc(c.icon) + '</span>' : '') +
    '<span class="tc-t">' +
    renderText(c.title || 'Untitled card') +
    '</span></div>' +
    (big && t.showWhen ? '<div class="tc-w">' + esc(when) + '</div>' : '') +
    (big && c.body ? '<div class="tc-b">' + renderText(c.body) + '</div>' : '') +
    (big && scn
      ? '<button class="tc-sc" data-tl="opensc" data-id="' +
        c.scene +
        '" title="Open this scene">' +
        ico('pen', 12) +
        '<span>' +
        esc(scn.title) +
        '</span></button>'
      : '') +
    '<span class="tc-rs" data-rs="1" title="Drag to change how long this lasts"></span><span class="tc-grip" data-grip="1" title="Drag to move">' +
    ico('grip', 14) +
    '</span></div>'
  );
}
// Redraws the board: time scale, marks, lanes and cards.
function drawTl() {
  const sc = $('#tlScroll'),
    t = curTl();
  if (!sc || !t) return;
  const a = t.axis,
    H = TL_DENS[t.density],
    W = lw(),
    R = tlRange(t, sc.clientWidth - W),
    lay = tlLayout(t, R);
  const q = ui.tlQ.trim().toLowerCase(),
    fe = ui.tlEnt && S.meta.ents[ui.tlEnt],
    fre = fe ? makeRe([fe.name].concat(fe.aliases || [])) : null;
  const hit = c => {
    if (q && !(c.title + '\n' + c.body + '\n' + c.when).toLowerCase().includes(q)) return false;
    if (fre) {
      fre.lastIndex = 0;
      if (!fre.test(c.title + '\n' + c.body)) return false;
    }
    return true;
  };
  const cw = { s: 6.8, m: 8, l: 9.6 }[t.tickSize],
    est = Math.max(tlLabel(t, R.from, true).length, tlLabel(t, R.from + a.step * (R.n - 1), true).length) * cw + 14,
    every = Math.max(1, Math.ceil(est / a.px));
  let ticks = '';
  for (let k = 0; k < R.n; k++) {
    const v = R.from + k * a.step,
      i = tlIdx(t, v),
      own = t.ticks[i] != null;
    if (k % every && !own) continue;
    let room = 1;
    while (room < every * 4 && k + room < R.n && !t.ticks[i + room] && (k + room) % every) room++;
    ticks +=
      '<button class="tl-tick' +
      (own ? ' own' : '') +
      '" data-tl="tick" data-i="' +
      i +
      '" style="left:' +
      k * a.px +
      'px;max-width:' +
      Math.max(a.px, room * a.px) +
      'px" title="' +
      esc(own ? 'Renamed from ' + tlLabel(t, v, true) + '. Click to edit.' : 'Click to rename this column') +
      '">' +
      esc(tlLabel(t, v)) +
      '</button>';
  }
  let mk = '',
    bands = '';
  if (t.showMarks)
    t.marks.forEach(m => {
      const x = ((m.at - R.from) / a.step) * a.px,
        w = (m.len / a.step) * a.px,
        st = 'left:' + x + 'px;--c:' + cssCol(m.color);
      mk +=
        '<button class="tl-mk" data-tl="mark" data-id="' +
        m.id +
        '" style="' +
        st +
        (m.len ? ';width:' + Math.max(18, w) + 'px;max-width:none' : '') +
        '" title="' +
        esc((m.label || 'Marker') + ' · ' + tlSpan(t, m.at, m.len)) +
        '">' +
        esc(m.label || 'Marker') +
        '</button>';
      bands +=
        '<i class="tl-band' +
        (m.len ? '' : ' line') +
        '" style="' +
        st +
        (m.len ? ';width:' + w + 'px' : '') +
        '"></i>';
    });
  let lanes = '';
  t.lanes.forEach(l => {
    if (l.hide) return;
    const L = lay[l.id];
    lanes +=
      '<div class="tl-lane" data-lane="' +
      l.id +
      '" style="--lc:' +
      cssCol(l.color) +
      '"><div class="tl-lab"><span class="tl-lt"><button class="tl-ln" data-tl="lanename" data-id="' +
      l.id +
      '" title="Click to rename this lane">' +
      esc(l.name || 'Lane') +
      '</button>' +
      (l.note ? '<small>' + esc(l.note) + '</small>' : '') +
      '</span><span class="mono muted">' +
      L.items.length +
      '</span></div>' +
      '<div class="tl-track' +
      (t.grid ? ' grid' : '') +
      '" data-track="' +
      l.id +
      '" style="width:' +
      R.w +
      'px;height:' +
      (L.rows * H + 8) +
      'px">' +
      L.items.map(it => tlCardHtml(t, it, l, H, hit(it.c))).join('') +
      '</div></div>';
  });
  if (!lanes)
    lanes =
      '<p class="muted" style="position:sticky;left:0;padding:16px;margin:0;max-width:100vw">Every lane is hidden. Turn one back on in the bar above.</p>';
  const kl = sc.scrollLeft,
    kt = sc.scrollTop;
  sc.innerHTML =
    '<div class="tl-canvas" style="width:' +
    (W + R.w) +
    'px;--lw:' +
    W +
    'px;--px:' +
    a.px +
    'px">' +
    '<div class="tl-axis ts-' +
    t.tickSize +
    '"><button class="tl-corner" data-tl="corner" title="Click to rename">' +
    esc(t.corner) +
    '</button><div class="tl-ticks" style="width:' +
    R.w +
    'px">' +
    mk +
    ticks +
    '</div></div>' +
    '<div class="tl-bands">' +
    bands +
    '</div>' +
    lanes +
    '<div class="tl-foot"><button class="btn sm" data-tl="addlane">' +
    ico('plus', 14) +
    '<span>Lane</span></button></div></div>';
  sc.scrollLeft = kl;
  sc.scrollTop = kt;
  ui.tlR = R;
}
// The lane buttons above the board (click to show or hide a lane).
function drawLaneChips() {
  const b = $('#tlLanes'),
    t = curTl();
  if (!b || !t) return;
  b.innerHTML = t.lanes
    .map(
      l =>
        '<button class="lchip' +
        (l.hide ? ' off' : '') +
        '" data-tl="lanevis" data-id="' +
        l.id +
        '" aria-pressed="' +
        !l.hide +
        '" style="--lc:' +
        cssCol(l.color) +
        '" title="Show or hide this lane"><i></i>' +
        esc(l.name || 'Lane') +
        '</button>'
    )
    .join('');
}
// Colour choices for a card, lane or mark.
function swatches(cur, kind, id, laneCol, defLabel) {
  let h = '<div class="sws">';
  defLabel = defLabel || 'Same as its lane';
  if (laneCol != null)
    h +=
      '<button class="sw lanec' +
      (cur === '' ? ' on' : '') +
      '" data-tl="' +
      kind +
      '" data-id="' +
      id +
      '" data-c="" style="--c:' +
      (/^var|^#/.test(laneCol) ? laneCol : cssCol(laneCol)) +
      '" title="' +
      defLabel +
      '" aria-label="' +
      defLabel +
      '"></button>';
  TL_COLORS.forEach(c => {
    h +=
      '<button class="sw' +
      (cur === c[0] ? ' on' : '') +
      '" data-tl="' +
      kind +
      '" data-id="' +
      id +
      '" data-c="' +
      c[0] +
      '" style="--c:var(--' +
      c[0] +
      ')" title="' +
      c[1] +
      '" aria-label="' +
      c[1] +
      '"></button>';
  });
  return (
    h +
    '<label class="sw cust' +
    (hexOk(cur) ? ' on' : '') +
    '" title="Pick any colour"' +
    (hexOk(cur) ? ' style="background:' + cur + '"' : '') +
    '><input type="color" data-hex="' +
    kind +
    '" data-id="' +
    id +
    '" value="' +
    (hexOk(cur) ? cur : '#7a5cff') +
    '" aria-label="Pick any colour"></label></div>'
  );
}
// The story pages named on a card, as chips in the side panel.
function tsNames(c) {
  const box = $('#tsNames');
  if (!box) return;
  const seen = [];
  findLinks(c.title + '\n' + c.body).forEach(l => {
    if (!seen.includes(l.id)) seen.push(l.id);
  });
  box.innerHTML = seen.length
    ? seen
        .map(id => {
          const e = S.meta.ents[id];
          return (
            '<button class="cl t-' +
            e.type +
            '" data-ent="' +
            id +
            '"><i class="pip"></i><span class="nm">' +
            esc(e.name) +
            '</span></button>'
          );
        })
        .join('')
    : '<span class="muted" style="font-size:12.5px">Write the name of any story page in the title or notes to link it.</span>';
}
// The side panel for a card: title, notes, when, lane, length, look, linked scene, duplicate, delete.
function sideCard(t, c) {
  const l = t.lanes.find(x => x.id === c.lane) || t.lanes[0],
    cf = ui.confirm,
    scn = c.scene && S.meta.scenes[c.scene];
  const scOpts =
    '<option value="">None</option>' +
    S.meta.chapters
      .map(
        ch =>
          '<optgroup label="' +
          esc(ch.title) +
          '">' +
          ch.scenes
            .map(
              id =>
                '<option value="' +
                id +
                '"' +
                (c.scene === id ? ' selected' : '') +
                '>' +
                esc(S.meta.scenes[id].title) +
                '</option>'
            )
            .join('') +
          '</optgroup>'
      )
      .join('');
  return (
    '<div class="ts-head"><h3>Card</h3><button class="ibtn" data-tl="close" aria-label="Close panel">' +
    ico('x') +
    '</button></div>' +
    '<label class="f">Title<input data-cf="title" value="' +
    esc(c.title) +
    '" maxlength="120" placeholder="What happens?"></label>' +
    '<div class="two"><label class="f">Icon or emoji<input data-cf="icon" value="' +
    esc(c.icon) +
    '" maxlength="4" placeholder="⚔"></label><label class="f">Lane<select data-cf="lane">' +
    t.lanes
      .map(
        x =>
          '<option value="' +
          x.id +
          '"' +
          (x.id === c.lane ? ' selected' : '') +
          '>' +
          esc(x.name || 'Lane') +
          '</option>'
      )
      .join('') +
    '</select></label></div>' +
    '<div class="two"><label class="f">Starts at<input type="number" step="any" data-cf="at" value="' +
    c.at +
    '"></label><label class="f">Lasts<input type="number" step="any" min="0" data-cf="len" value="' +
    c.len +
    '"></label></div>' +
    '<p class="fine">On the scale: <b id="tsWhen">' +
    esc(tlSpan(t, c.at, c.len)) +
    '</b>. A length of 0 is a single moment.</p>' +
    '<label class="f">Custom time label<input data-cf="when" value="' +
    esc(c.when) +
    '" maxlength="80" placeholder="Optional, e.g. The night of the fire"></label>' +
    '<span class="sec-l">Colour</span>' +
    swatches(c.color, 'ccol', c.id, l.color) +
    '<span class="sec-l">Style</span><div class="seg" role="group" aria-label="Card style">' +
    TL_STYLES.map(
      s =>
        '<button data-tl="cstyle" data-s="' +
        s[0] +
        '" aria-pressed="' +
        (c.style === s[0]) +
        '"' +
        (c.style === s[0] ? ' class="on"' : '') +
        '>' +
        s[1] +
        '</button>'
    ).join('') +
    '</div>' +
    '<label class="f">Notes<textarea data-cf="body" rows="5" placeholder="Details, beats, reminders. Names with pages link automatically.">' +
    esc(c.body) +
    '</textarea></label>' +
    '<span class="sec-l">Names on this card</span><div class="chiplinks" id="tsNames"></div>' +
    '<label class="f">Linked scene<select data-cf="scene">' +
    scOpts +
    '</select></label>' +
    '<div class="ts-row">' +
    (scn
      ? '<button class="btn sm" data-tl="opensc" data-id="' +
        c.scene +
        '">' +
        ico('pen', 14) +
        '<span>Open scene</span></button>'
      : '') +
    '<button class="btn sm" data-tl="dupcard">' +
    ico('copy', 14) +
    '<span>Duplicate</span></button>' +
    '<button class="btn sm danger" data-tl="delcard">' +
    ico('trash', 14) +
    '<span>' +
    (cf === 'k' + c.id ? 'Click again to delete' : 'Delete') +
    '</span></button></div>'
  );
}
// The side panel with the timeline's settings: time scale, lanes, marks, look.
function sideSet(t) {
  const a = t.axis,
    cf = ui.confirm,
    tid = ui.view.id;
  let h =
    '<div class="ts-head"><h3>Customize timeline</h3><button class="ibtn" data-tl="close" aria-label="Close panel">' +
    ico('x') +
    '</button></div>';
  h +=
    '<h4>Time scale</h4><label class="f">Start from a preset<select data-sf="preset"><option value="">Choose…</option>' +
    TL_PRESETS.map((p, i) => '<option value="' + i + '">' + p[2] + '</option>').join('') +
    S.meta.world.cals.map(c => '<option value="w:' + c.id + '">' + esc(c.name) + ' (your world)</option>').join('') +
    '</select></label>' +
    '<label class="f">Tick label<input data-sf="fmt" value="' +
    esc(a.fmt) +
    '" maxlength="60"></label>' +
    '<p class="fine"><span class="mono">{n}</span> is the time value, <span class="mono">{name}</span> the next name in your list, <span class="mono">{cycle}</span> how many times the list has come round, <span class="mono">{i}</span> the column number. Try <span class="mono">{name}, year {cycle}</span>.</p>' +
    '<label class="f">Names to cycle through<textarea data-sf="names" rows="2" placeholder="Months, seasons, festivals… separated by commas">' +
    esc(a.names) +
    '</textarea></label>' +
    '<div class="two"><label class="f">First {cycle}<input type="number" step="any" data-sf="cycle" value="' +
    a.cycle +
    '"></label><label class="f">Scale starts at<input type="number" step="any" data-sf="start" value="' +
    a.start +
    '"></label></div>' +
    '<div class="two"><label class="f">Units per column<input type="number" step="any" min="0" data-sf="step" value="' +
    a.step +
    '"></label><label class="f">Snap cards to<select data-sf="snap">' +
    TL_SNAPS.map(
      s => '<option value="' + s[0] + '"' + (a.snap === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'
    ).join('') +
    '</select></label></div>' +
    '<label class="f">Zoom<input type="range" min="40" max="600" step="10" data-sf="px" value="' +
    a.px +
    '"></label>';
  const nt = Object.keys(t.ticks).length;
  h +=
    '<h4>Header row</h4><p class="fine">Click any label in the header row to rename that column, like <i>The Siege</i> instead of <i>Day 4</i>. Cards in that column show the new name too. Clear a label to go back to the scale. Renamed columns stay tied to their position, so changing the start or units per column moves them.</p>' +
    '<label class="f">Title above the lane names<input data-sf="corner" value="' +
    esc(t.corner) +
    '" maxlength="30" placeholder="Lanes"></label>' +
    '<label class="f">Header label size<select data-sf="tickSize">' +
    [
      ['s', 'Small'],
      ['m', 'Medium'],
      ['l', 'Large']
    ]
      .map(o => '<option value="' + o[0] + '"' + (t.tickSize === o[0] ? ' selected' : '') + '>' + o[1] + '</option>')
      .join('') +
    '</select></label>' +
    '<p class="fine">' +
    (nt
      ? nt +
        ' renamed column' +
        (nt === 1 ? '' : 's') +
        '. <button class="btn sm" data-tl="resetticks">Reset all column labels</button>'
      : 'No renamed columns yet.') +
    '</p>';
  h +=
    '<h4>Cards</h4><label class="f">Card width<input type="range" min="110" max="400" step="10" data-sf="cardW" value="' +
    t.cardW +
    '"></label>' +
    '<label class="f">Card height<select data-sf="density">' +
    [
      ['compact', 'Compact (title only)'],
      ['normal', 'Normal'],
      ['tall', 'Tall (more notes)']
    ]
      .map(d => '<option value="' + d[0] + '"' + (t.density === d[0] ? ' selected' : '') + '>' + d[1] + '</option>')
      .join('') +
    '</select></label>' +
    [
      ['showWhen', 'Show the time on each card'],
      ['grid', 'Show grid lines'],
      ['showMarks', 'Show eras and markers']
    ]
      .map(
        o =>
          '<label class="ck"><input type="checkbox" data-sf="' +
          o[0] +
          '"' +
          (t[o[0]] ? ' checked' : '') +
          '>' +
          o[1] +
          '</label>'
      )
      .join('');
  h +=
    '<h4>Lanes</h4><p class="fine">Name lanes after whatever you want to track: characters, plotlines, places, a magic system, the weather. You can also click a lane\'s name on the board to rename it. Cards take their lane\'s colour unless you pick another.</p>';
  t.lanes.forEach((l, i) => {
    h +=
      '<div class="lrow"><div class="r1"><input class="nm" data-lf="name" data-id="' +
      l.id +
      '" value="' +
      esc(l.name) +
      '" maxlength="40" aria-label="Lane name">' +
      (i > 0
        ? '<button class="ibtn" data-tl="lup" data-id="' +
          l.id +
          '" aria-label="Move lane up">' +
          ico('up', 14) +
          '</button>'
        : '') +
      (i < t.lanes.length - 1
        ? '<button class="ibtn" data-tl="ldn" data-id="' +
          l.id +
          '" aria-label="Move lane down">' +
          ico('down', 14) +
          '</button>'
        : '') +
      (t.lanes.length > 1
        ? '<button class="ibtn' +
          (cf === 'ln' + l.id ? ' on' : '') +
          '" data-tl="dellane" data-id="' +
          l.id +
          '" aria-label="Delete lane">' +
          (cf === 'ln' + l.id ? 'Delete it and its cards?' : ico('trash', 14)) +
          '</button>'
        : '') +
      '</div><input class="nm sub" data-lf="note" data-id="' +
      l.id +
      '" value="' +
      esc(l.note) +
      '" maxlength="60" placeholder="What it tracks (optional), e.g. POV, subplot, magic system" aria-label="What this lane tracks">' +
      swatches(l.color, 'lcol', l.id) +
      '</div>';
  });
  h +=
    '<button class="btn sm" data-tl="addlane" style="margin-top:8px">' + ico('plus', 14) + '<span>Lane</span></button>';
  h +=
    '<h4>Eras and markers</h4><p class="fine">Length 0 draws a line through every lane. Give a marker a length to shade a band, like an act, a war or a season.</p>';
  t.marks.forEach(m => {
    h +=
      '<div class="lrow" id="mk_' +
      m.id +
      '"><div class="r1"><input class="nm" data-mf="label" data-id="' +
      m.id +
      '" value="' +
      esc(m.label) +
      '" maxlength="40" placeholder="Label" aria-label="Marker label">' +
      '<button class="ibtn' +
      (cf === 'mk' + m.id ? ' on' : '') +
      '" data-tl="delmark" data-id="' +
      m.id +
      '" aria-label="Delete marker">' +
      (cf === 'mk' + m.id ? 'Delete?' : ico('trash', 14)) +
      '</button></div>' +
      '<div class="two"><label class="f">At<input type="number" step="any" data-mf="at" data-id="' +
      m.id +
      '" value="' +
      m.at +
      '"></label><label class="f">Length<input type="number" step="any" min="0" data-mf="len" data-id="' +
      m.id +
      '" value="' +
      m.len +
      '"></label></div>' +
      swatches(m.color, 'mcol', m.id) +
      '</div>';
  });
  h +=
    '<button class="btn sm" data-tl="addmark" style="margin-top:8px">' +
    ico('plus', 14) +
    '<span>Marker</span></button>';
  h +=
    '<h4>Tools</h4><div class="ts-col"><button class="btn sm" data-tl="fromsc">' +
    ico('card', 14) +
    '<span>Add a card for every scene</span></button>' +
    '<button class="btn sm" data-tl="duptl">' +
    ico('copy', 14) +
    '<span>Duplicate this timeline</span></button>' +
    '<button class="btn sm danger" data-tl="deltl">' +
    ico('trash', 14) +
    '<span>' +
    (cf === 'tl' + tid ? 'Click again to delete this timeline' : 'Delete this timeline') +
    '</span></button></div>';
  return h;
}
// Redraws the side panel (keeping its scroll position).
function drawSide() {
  const box = $('#tlSide'),
    t = curTl();
  if (!box || !t) return;
  if (ui.tlSide && ui.tlSide.k === 'card' && !t.cards[ui.tlSide.id]) ui.tlSide = null;
  const s = ui.tlSide,
    sb = $('#tlv [data-tl="settings"]');
  if (sb) sb.setAttribute('aria-pressed', s && s.k === 'set' ? 'true' : 'false');
  if (!s) {
    box.hidden = true;
    box.innerHTML = '';
    ui.tlSideKey = '';
    return;
  }
  const key = s.k + (s.id || ''),
    keep = key === ui.tlSideKey ? box.scrollTop : 0;
  ui.tlSideKey = key;
  box.hidden = false;
  if (s.k === 'card') {
    box.innerHTML = sideCard(t, t.cards[s.id]);
    tsNames(t.cards[s.id]);
  } else box.innerHTML = sideSet(t);
  box.scrollTop = keep;
}
// Scrolls the board so the start of time is in view.
function tlCenter(t) {
  const sc = $('#tlScroll'),
    R = ui.tlR;
  return R.from + ((sc.scrollLeft + (sc.clientWidth - lw()) / 2) / t.axis.px) * t.axis.step;
}
// Scrolls a card into view and focuses it.
function tlRefocus(id) {
  const el = $('#tlScroll [data-card="' + id + '"]');
  if (el) {
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
// Selects a card and opens it in the side panel.
function tlOpenCard(id, focus) {
  ui.tlSel = id;
  ui.tlSide = { k: 'card', id };
  ui.confirm = null;
  drawSide();
  drawTl();
  if (focus) tlRefocus(id);
}
// Adds a card in a lane at a time value, and opens it.
function tlNewCard(lane, at) {
  const t = curTl(),
    vis = t.lanes.filter(l => !l.hide);
  if (!vis.length) {
    toast('Turn on a lane first.', { plain: true });
    return;
  }
  if (lane == null) lane = vis[0].id;
  if (at == null) at = tlCenter(t) - (t.cardW / 2 / t.axis.px) * t.axis.step;
  const id = uid('k_');
  t.cards[id] = {
    id,
    lane,
    at: tlSnap(t, at),
    len: 0,
    title: '',
    body: '',
    when: '',
    icon: '',
    color: '',
    style: 'tint',
    scene: ''
  };
  dirty(tlKey());
  renderBinder();
  tlOpenCard(id);
  tlRefocus(id);
  const ti = $('#tlSide [data-cf="title"]');
  if (ti) ti.focus();
}
// Zooms the time scale by factor f, keeping the middle in place.
function tlZoom(f) {
  const t = curTl(),
    a = t.axis,
    sc = $('#tlScroll'),
    mid = tlCenter(t);
  a.px = clamp(Math.round(a.px * f), 40, 600);
  dirty(tlKey());
  drawTl();
  sc.scrollLeft = ((mid - ui.tlR.from) / a.step) * a.px - (sc.clientWidth - lw()) / 2;
  const z = $('#tlSide [data-sf="px"]');
  if (z) z.value = a.px;
}
// Zooms and scrolls so every card fits.
function tlFit() {
  const t = curTl(),
    a = t.axis,
    sc = $('#tlScroll'),
    vis = new Set(t.lanes.filter(l => !l.hide).map(l => l.id));
  const cs = Object.values(t.cards).filter(c => vis.has(c.lane));
  if (!cs.length) return;
  const lo = Math.min(...cs.map(c => c.at)),
    hi = Math.max(...cs.map(c => c.at + c.len)),
    span = (hi - lo) / a.step;
  if (span > 0) a.px = clamp(Math.floor((sc.clientWidth - lw() - t.cardW - 32) / span), 40, 600);
  dirty(tlKey());
  drawTl();
  sc.scrollLeft = ((lo - ui.tlR.from) / a.step) * a.px - 16;
  const z = $('#tlSide [data-sf="px"]');
  if (z) z.value = a.px;
}
// Saves a card field edited in the side panel.
function tlCardField(t, x) {
  const c = ui.tlSide && t.cards[ui.tlSide.id];
  if (!c) return;
  const k = x.dataset.cf;
  if (k === 'at' || k === 'len') {
    if (x.value === '' || !isFinite(+x.value)) return;
    c[k] = k === 'len' ? Math.max(0, +x.value) : +x.value;
  } else if (k === 'lane') {
    if (!t.lanes.some(l => l.id === x.value)) return;
    c.lane = x.value;
  } else c[k] = x.value;
  dirty(tlKey());
  drawTl();
  const w = $('#tsWhen');
  if (w) w.textContent = tlSpan(t, c.at, c.len);
  if (k === 'title' || k === 'body') tsNames(c);
}
// Saves a timeline setting edited in the side panel (time scale, lanes, look).
function tlSetField(t, x) {
  const k = x.dataset.sf,
    a = t.axis,
    v = x.type === 'checkbox' ? x.checked : x.value;
  if (k === 'preset' && /^w:/.test(v)) {
    const c = S.meta.world.cals.find(x => x.id === v.slice(2));
    if (!c) return;
    a.fmt = '{name} {cycle}' + (c.era ? ' ' + c.era.replace(/[{}]/g, '') : '');
    a.names = c.months.map(x => x[0].replace(/,/g, ' ')).join(', ');
    a.cycle = c.first;
    dirty(tlKey());
    drawTl();
    drawSide();
    return;
  }
  if (k === 'preset') {
    const p = TL_PRESETS[+v];
    if (!v || !p) return;
    a.fmt = p[0];
    a.names = p[1];
    dirty(tlKey());
    drawTl();
    drawSide();
    return;
  }
  if (k === 'fmt') a.fmt = v.trim() ? v : '{n}';
  else if (k === 'names') a.names = v;
  else if (k === 'cycle' || k === 'start' || k === 'step' || k === 'px') {
    const n = +v;
    if (v === '' || !isFinite(n) || (k === 'step' && n <= 0)) return;
    a[k] = k === 'px' ? clamp(n, 40, 600) : n;
  } else if (k === 'snap') a.snap = +v;
  else if (k === 'corner') t.corner = v.slice(0, 30);
  else if (k === 'tickSize') t.tickSize = ['s', 'm', 'l'].includes(v) ? v : 's';
  else if (k === 'cardW') t.cardW = clamp(+v, 110, 400);
  else if (k === 'density') t.density = TL_DENS[v] ? v : 'normal';
  else t[k] = !!v;
  dirty(tlKey());
  drawTl();
}
// Sets the colour of a card, lane or mark.
function tlColor(t, kind, id, val, full) {
  const o = kind === 'ccol' ? t.cards[id] : (kind === 'lcol' ? t.lanes : t.marks).find(x => x.id === id);
  if (!o) return;
  if (val === '' ? kind !== 'ccol' : !colOk(val)) return;
  o.color = val;
  dirty(tlKey());
  drawTl();
  if (kind === 'lcol') drawLaneChips();
  if (full) drawSide();
}
// Timeline buttons: add, delete, move and edit lanes, marks and cards; presets; zoom.
function tlAction(act, b) {
  const t = curTl(),
    a = t.axis,
    id = b.dataset.id,
    side = () => {
      drawSide();
    };
  if (act === 'tick' || act === 'corner') tlEditHead(b);
  else if (act === 'lanename') tlEditLane(b);
  else if (act === 'resetticks') {
    t.ticks = {};
    dirty(tlKey());
    drawTl();
    drawSide();
  } else if (act === 'addcard') tlNewCard();
  else if (act === 'zin') tlZoom(1.25);
  else if (act === 'zout') tlZoom(0.8);
  else if (act === 'fit') tlFit();
  else if (act === 'settings') {
    ui.tlSide = ui.tlSide && ui.tlSide.k === 'set' ? null : { k: 'set' };
    ui.confirm = null;
    drawSide();
    drawTl();
  } else if (act === 'close') {
    ui.tlSide = null;
    ui.tlSel = null;
    ui.confirm = null;
    drawSide();
    drawTl();
  } else if (act === 'opensc') go({ k: 'scene', id });
  else if (act === 'lanevis') {
    const l = t.lanes.find(x => x.id === id);
    l.hide = !l.hide;
    dirty(tlKey());
    drawLaneChips();
    drawTl();
  } else if (act === 'ccol' || act === 'lcol' || act === 'mcol') tlColor(t, act, id, b.dataset.c, true);
  else if (act === 'cstyle') {
    const c = t.cards[ui.tlSide.id];
    c.style = b.dataset.s;
    dirty(tlKey());
    drawTl();
    drawSide();
  } else if (act === 'dupcard') {
    const c = t.cards[ui.tlSide.id],
      nid = uid('k_');
    t.cards[nid] = Object.assign({}, c, { id: nid });
    dirty(tlKey());
    renderBinder();
    tlOpenCard(nid, true);
    toast('Card duplicated. It sits just below the original.', { plain: true });
  } else if (act === 'delcard') {
    const cid = ui.tlSide.id;
    confirmDo(
      'k' + cid,
      () => {
        delete t.cards[cid];
        ui.tlSide = null;
        ui.tlSel = null;
        dirty(tlKey());
        renderBinder();
        drawSide();
        drawTl();
      },
      side
    );
  } else if (act === 'addlane') {
    const nid = uid('l_');
    t.lanes.push({
      id: nid,
      name: 'Lane ' + (t.lanes.length + 1),
      color: TL_COLORS[t.lanes.length % TL_COLORS.length][0],
      hide: false
    });
    dirty(tlKey());
    drawLaneChips();
    drawSide();
    drawTl();
    const n = $('#tlSide [data-lf="name"][data-id="' + nid + '"]');
    if (n) {
      n.focus();
      n.select();
    } else {
      const lb = $('#tlScroll [data-tl="lanename"][data-id="' + nid + '"]');
      if (lb) {
        lb.scrollIntoView({ block: 'nearest' });
        tlEditLane(lb);
      }
    }
  } else if (act === 'lup' || act === 'ldn') {
    const i = t.lanes.findIndex(x => x.id === id),
      j = i + (act === 'lup' ? -1 : 1);
    if (i < 0 || j < 0 || j >= t.lanes.length) return;
    const x = t.lanes[i];
    t.lanes[i] = t.lanes[j];
    t.lanes[j] = x;
    dirty(tlKey());
    drawLaneChips();
    drawSide();
    drawTl();
  } else if (act === 'dellane')
    confirmDo(
      'ln' + id,
      () => {
        if (t.lanes.length < 2) return;
        t.lanes = t.lanes.filter(x => x.id !== id);
        Object.keys(t.cards).forEach(k => {
          if (t.cards[k].lane === id) delete t.cards[k];
        });
        dirty(tlKey());
        renderBinder();
        drawLaneChips();
        drawSide();
        drawTl();
      },
      side
    );
  else if (act === 'mark' || act === 'addmark') {
    let mid = id;
    if (act === 'addmark') {
      mid = uid('m_');
      t.marks.push({ id: mid, label: 'New marker', at: tlSnap(t, tlCenter(t)), len: 0, color: 'muted' });
      t.showMarks = true;
      dirty(tlKey());
    }
    ui.tlSide = { k: 'set' };
    ui.confirm = null;
    drawSide();
    drawTl();
    const r = $('#mk_' + mid);
    if (r) {
      r.scrollIntoView({ block: 'center' });
      const i = $('input', r);
      i.focus();
      i.select();
    }
  } else if (act === 'delmark')
    confirmDo(
      'mk' + id,
      () => {
        t.marks = t.marks.filter(x => x.id !== id);
        dirty(tlKey());
        drawSide();
        drawTl();
      },
      side
    );
  else if (act === 'fromsc') {
    const have = new Set(
        Object.values(t.cards)
          .map(c => c.scene)
          .filter(Boolean)
      ),
      lane = (t.lanes.find(l => !l.hide) || t.lanes[0]).id,
      cs = Object.values(t.cards);
    let at = cs.length ? tlSnap(t, Math.max(...cs.map(c => c.at + c.len)) + a.step) : a.start,
      n = 0;
    orderedScenes().forEach(o => {
      if (have.has(o.id)) return;
      const id2 = uid('k_');
      t.cards[id2] = {
        id: id2,
        lane,
        at,
        len: 0,
        title: S.meta.scenes[o.id].title,
        body: S.sc[o.id].synopsis,
        when: '',
        icon: '',
        color: '',
        style: 'tint',
        scene: o.id
      };
      at = +(at + a.step).toFixed(4);
      n++;
    });
    if (n) {
      dirty(tlKey());
      renderBinder();
      drawTl();
    }
    toast(
      n
        ? 'Added ' + n + ' scene card' + (n === 1 ? '' : 's') + '. Drag them to where they happen.'
        : 'Every scene already has a card on this timeline.',
      { plain: true }
    );
  } else if (act === 'duptl') addTimeline(ui.view.id);
  else if (act === 'deltl') {
    const tid = ui.view.id;
    confirmDo('tl' + tid, () => delTimeline(tid), side);
  }
}
// Renames a lane in place.
function tlEditLane(b) {
  const t = curTl(),
    l = t.lanes.find(x => x.id === b.dataset.id);
  if (!l) return;
  const inp = document.createElement('input');
  inp.className = 'tl-lane-in';
  inp.maxLength = 40;
  inp.value = l.name;
  inp.placeholder = 'Lane name';
  inp.setAttribute('aria-label', 'Lane name');
  b.replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const fin = ok => {
    if (done) return;
    done = true;
    if (ok && inp.value.trim()) {
      l.name = inp.value.trim();
      dirty(tlKey());
      drawLaneChips();
      if (ui.tlSide) drawSide();
    }
    drawTl();
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fin(true);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      fin(false);
    }
  });
  inp.addEventListener('blur', () => fin(true));
}
// Renames a column of the time scale (or the corner label) in place.
function tlEditHead(b) {
  const t = curTl(),
    corner = b.dataset.tl === 'corner',
    i = b.dataset.i,
    auto = corner ? 'Lanes' : tlLabel(t, t.axis.start + i * t.axis.step, true);
  const inp = document.createElement('input');
  inp.className = 'tl-head-in' + (corner ? ' corner' : '');
  inp.maxLength = corner ? 30 : 60;
  inp.placeholder = auto;
  inp.value = corner ? t.corner : t.ticks[i] || auto;
  inp.setAttribute('aria-label', corner ? 'Lane column title' : 'Column label');
  if (!corner) inp.style.left = b.style.left;
  b.replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const fin = ok => {
    if (done) return;
    done = true;
    if (ok) {
      const v = inp.value.trim();
      if (corner) t.corner = inp.value.slice(0, 30);
      else if (!v || v === auto) delete t.ticks[i];
      else t.ticks[i] = v;
      dirty(tlKey());
      if (ui.tlSide && ui.tlSide.k === 'set') drawSide();
    }
    drawTl();
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fin(true);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      fin(false);
    }
  });
  inp.addEventListener('blur', () => fin(true));
}
// While dragging a card or its edge: moves or resizes it.
function tlMove(e) {
  const t = curTl(),
    sc = $('#tlScroll');
  if (!D) return;
  if (!t || !sc) {
    D = null;
    return;
  }
  const a = t.axis,
    r = sc.getBoundingClientRect();
  if (e.clientX > r.right - 36) sc.scrollLeft += 14;
  else if (e.clientX < r.left + lw() + 36) sc.scrollLeft -= 14;
  if (e.clientY > r.bottom - 30) sc.scrollTop += 10;
  else if (e.clientY < r.top + AXH + 30) sc.scrollTop -= 10;
  const dx = e.clientX - D.x0 + sc.scrollLeft - D.sl,
    dy = e.clientY - D.y0 + sc.scrollTop - D.st;
  if (!D.moved) {
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    D.moved = true;
    D.el.classList.add('drag');
  }
  const du = (dx / a.px) * a.step,
    lbl = $('.tc-w', D.el);
  if (D.rs) {
    D.nlen = Math.max(0, +(tlSnap(t, D.at + D.len + du) - D.at).toFixed(4));
    const sw = (D.nlen / a.step) * a.px;
    D.el.style.width = Math.max(t.cardW, sw) + 'px';
    let sp = $('.tc-span', D.el);
    if (!sp) {
      sp = document.createElement('i');
      sp.className = 'tc-span';
      D.el.prepend(sp);
    }
    sp.style.width = Math.max(4, sw) + 'px';
    sp.hidden = !D.nlen;
    if (lbl) lbl.textContent = tlWhen(t, { when: D.c.when, at: D.at, len: D.nlen });
  } else {
    D.nat = tlSnap(t, D.at + du);
    let lane = D.lane,
      best = 1e9;
    sc.querySelectorAll('.tl-track').forEach(tr => {
      const b = tr.getBoundingClientRect(),
        d = e.clientY < b.top ? b.top - e.clientY : e.clientY > b.bottom ? e.clientY - b.bottom : 0;
      if (d < best) {
        best = d;
        lane = tr.dataset.track;
      }
    });
    D.nlane = lane;
    sc.querySelectorAll('.tl-lane').forEach(l =>
      l.classList.toggle('drop', l.dataset.lane === lane && lane !== D.lane)
    );
    D.el.style.transform = 'translate(' + ((D.nat - D.at) / a.step) * a.px + 'px,' + dy + 'px)';
    if (lbl) lbl.textContent = tlWhen(t, { when: D.c.when, at: D.nat, len: D.len });
  }
}
// The end of a drag: snaps and saves.
function tlUp(e) {
  window.removeEventListener('pointermove', tlMove);
  window.removeEventListener('pointerup', tlUp);
  window.removeEventListener('pointercancel', tlUp);
  const d = D;
  D = null;
  if (!d || !d.moved) return;
  ui.tlDragged = true;
  setTimeout(() => {
    ui.tlDragged = false;
  }, 0);
  if (e.type !== 'pointercancel' && curTl()) {
    const c = d.c;
    if (d.rs) {
      if (d.nlen != null) c.len = d.nlen;
    } else {
      if (d.nat != null) c.at = d.nat;
      if (d.nlane) c.lane = d.nlane;
    }
    dirty(tlKey());
    ui.tlSel = c.id;
    if (ui.tlSide && ui.tlSide.k === 'card' && ui.tlSide.id === c.id) drawSide();
  }
  drawTl();
}
// Handles everything on the timeline screen: clicks, double-clicks, drags and keys.
function bindTl(tv) {
  tv.addEventListener('click', e => {
    if (ui.tlDragged) {
      ui.tlDragged = false;
      return;
    }
    const en = e.target.closest('.tl-card .ent');
    if (en) {
      go({ k: 'ent', id: en.dataset.ent });
      return;
    }
    const b = e.target.closest('[data-tl]');
    if (b) {
      tlAction(b.dataset.tl, b);
      return;
    }
    const card = e.target.closest('.tl-card');
    if (card) tlOpenCard(card.dataset.card, true);
  });
  tv.addEventListener('dblclick', e => {
    const tr = e.target.closest('.tl-track');
    if (!tr || e.target.closest('.tl-card')) return;
    const t = curTl();
    tlNewCard(
      tr.dataset.track,
      ui.tlR.from + ((e.clientX - tr.getBoundingClientRect().left) / t.axis.px) * t.axis.step
    );
  });
  tv.addEventListener('pointerdown', e => {
    const card = e.target.closest('.tl-card');
    if (!card || e.button !== 0 || e.target.closest('.tc-sc')) return;
    const rs = !!e.target.closest('[data-rs]'),
      grip = !!e.target.closest('[data-grip]');
    if (e.pointerType === 'touch' && !rs && !grip) return; // on touch, drag by the handle so the board still scrolls
    const t = curTl(),
      c = t.cards[card.dataset.card],
      sc = $('#tlScroll');
    if (!c) return;
    if (e.pointerType !== 'mouse' || rs || grip) e.preventDefault();
    D = {
      c,
      el: card,
      rs,
      x0: e.clientX,
      y0: e.clientY,
      sl: sc.scrollLeft,
      st: sc.scrollTop,
      moved: false,
      at: c.at,
      len: c.len,
      lane: c.lane
    };
    window.addEventListener('pointermove', tlMove);
    window.addEventListener('pointerup', tlUp);
    window.addEventListener('pointercancel', tlUp);
  });
  tv.addEventListener('keydown', e => {
    const card = e.target.classList && e.target.classList.contains('tl-card') ? e.target : null;
    if (!card) return;
    const t = curTl(),
      c = t.cards[card.dataset.card];
    if (!c) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tlOpenCard(c.id, true);
      return;
    }
    const vis = t.lanes.filter(l => !l.hide),
      li = vis.findIndex(l => l.id === c.lane),
      u = e.shiftKey ? t.axis.step : t.axis.step * (t.axis.snap || 0.1);
    if (e.key === 'ArrowLeft') c.at = +(c.at - u).toFixed(4);
    else if (e.key === 'ArrowRight') c.at = +(c.at + u).toFixed(4);
    else if (e.key === 'ArrowUp' && li > 0) c.lane = vis[li - 1].id;
    else if (e.key === 'ArrowDown' && li >= 0 && li < vis.length - 1) c.lane = vis[li + 1].id;
    else return;
    e.preventDefault();
    dirty(tlKey());
    ui.tlSel = c.id;
    drawTl();
    tlRefocus(c.id);
    if (ui.tlSide && ui.tlSide.k === 'card' && ui.tlSide.id === c.id) drawSide();
  });
  tv.addEventListener(
    'wheel',
    e => {
      if (!e.ctrlKey || !e.target.closest('#tlScroll')) return;
      e.preventDefault();
      tlZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    },
    { passive: false }
  );
  tv.addEventListener('input', e => {
    const x = e.target,
      t = curTl();
    if (!t || x.tagName === 'SELECT' || x.type === 'checkbox') return;
    if (x.id === 'tlName') {
      S.meta.tls.find(y => y.id === ui.view.id).name = x.value || 'Timeline';
      dirty('meta');
      renderBinder();
    } else if (x.id === 'tlQ') {
      ui.tlQ = x.value;
      drawTl();
    } else if (x.dataset.cf) tlCardField(t, x);
    else if (x.dataset.sf) tlSetField(t, x);
    else if (x.dataset.lf) {
      const l = t.lanes.find(y => y.id === x.dataset.id);
      if (l) {
        l[x.dataset.lf === 'note' ? 'note' : 'name'] = x.value;
        dirty(tlKey());
        drawTl();
        drawLaneChips();
      }
    } else if (x.dataset.mf) {
      const m = t.marks.find(y => y.id === x.dataset.id),
        k = x.dataset.mf;
      if (!m) return;
      if (k === 'label') m.label = x.value;
      else {
        if (x.value === '' || !isFinite(+x.value)) return;
        m[k] = k === 'len' ? Math.max(0, +x.value) : +x.value;
      }
      dirty(tlKey());
      drawTl();
    } else if (x.dataset.hex) {
      x.parentNode.style.background = x.value;
      tlColor(t, x.dataset.hex, x.dataset.id, x.value, false);
    }
  });
  tv.addEventListener('change', e => {
    const x = e.target,
      t = curTl();
    if (!t) return;
    if (x.id === 'tlEnt') {
      ui.tlEnt = x.value;
      drawTl();
    } else if (x.dataset.cf && x.tagName === 'SELECT') {
      tlCardField(t, x);
      drawSide();
    } else if (x.dataset.sf && (x.tagName === 'SELECT' || x.type === 'checkbox')) tlSetField(t, x);
    else if (x.dataset.hex) drawSide();
  });
}
// The timeline screen: name, toolbar, search and lane filters, the board and the side panel.
function renderTl(el, v) {
  const name = S.meta.tls.find(x => x.id === v.id).name;
  if (ui.tlFor !== v.id) {
    ui.tlFor = v.id;
    ui.tlSel = null;
    ui.tlSide = null;
    ui.tlQ = '';
    ui.tlEnt = '';
  }
  if (ui.tlEnt && !S.meta.ents[ui.tlEnt]) ui.tlEnt = '';
  const entOpts =
    '<option value="">All cards</option>' +
    TYPE_ORDER.map(ty => {
      const list = Object.values(S.meta.ents)
        .filter(e => e.type === ty)
        .sort((p, q) => p.name.localeCompare(q.name));
      return list.length
        ? '<optgroup label="' +
            esc(LP(ty)) +
            '">' +
            list
              .map(
                e =>
                  '<option value="' +
                  e.id +
                  '"' +
                  (ui.tlEnt === e.id ? ' selected' : '') +
                  '>' +
                  esc(e.name) +
                  '</option>'
              )
              .join('') +
            '</optgroup>'
        : '';
    }).join('');
  el.innerHTML =
    '<div class="tl-view" id="tlv"><div class="main-head">' +
    backBtn() +
    '<input id="tlName" class="title-in" value="' +
    esc(name) +
    '" maxlength="80" aria-label="Timeline name">' +
    '<div class="tools"><button class="btn pri" data-tl="addcard">' +
    ico('plus') +
    '<span>Card</span></button>' +
    '<button class="ibtn" data-tl="zout" aria-label="Zoom out" title="Zoom out (Ctrl + scroll)">' +
    ico('minus') +
    '</button><button class="ibtn" data-tl="zin" aria-label="Zoom in" title="Zoom in (Ctrl + scroll)">' +
    ico('plus') +
    '</button>' +
    '<button class="btn" data-tl="fit" title="Fit every card on screen">' +
    ico('fit') +
    '<span>Fit</span></button>' +
    '<button class="btn" data-tl="settings" aria-pressed="false">' +
    ico('sliders') +
    '<span>Customize</span></button></div></div>' +
    '<div class="tl-bar"><input id="tlQ" class="tl-q" type="search" placeholder="Search cards" aria-label="Search cards" value="' +
    esc(ui.tlQ) +
    '">' +
    '<select id="tlEnt" aria-label="Only show cards that mention">' +
    entOpts +
    '</select><span class="tl-lchips" id="tlLanes"></span>' +
    '<span class="tl-help">' +
    (TOUCH
      ? 'Drag a card by its handle, or its right edge to change length. Tap a card to edit it.'
      : 'Drag cards to move them, or their right edge to change length. Double-click a lane to add a card. Arrow keys nudge the selected card.') +
    '</span></div>' +
    '<div class="tl-body"><div class="tl-scroll" id="tlScroll"></div><aside class="tl-side" id="tlSide" aria-label="Card and timeline settings" hidden></aside></div></div>';
  drawLaneChips();
  drawSide();
  drawTl();
  bindTl($('#tlv', el));
}
