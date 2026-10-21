/* ---------- main: relationship maps and family trees ---------- */
// Both draw into one pan-and-zoom SVG (cv*). A map is free-form bubbles and lines; a tree lays itself out
// from parents and partnerships (ftLayout), so a writer only says who is related to whom.
const RM_R = { s: 22, m: 30, l: 40 };
const DASH = { solid: '', dashed: '7 5', dotted: '1.5 5' };
const LINE_STYLES = [
  ['solid', 'Solid'],
  ['dashed', 'Dashed'],
  ['dotted', 'Dotted']
];
const PTYPES = [
  ['bio', 'By birth'],
  ['adopted', 'Adopted'],
  ['fostered', 'Fostered'],
  ['step', 'Step-child'],
  ['rumoured', 'Rumoured']
];
const PT_DASH = { bio: '', adopted: '7 5', fostered: '7 5', step: '2 5', rumoured: '1 6' };
const FT_GAP = { compact: [18, 56], normal: [36, 84], roomy: [64, 120] };
const str = (v, n) => String(v == null ? '' : v).slice(0, n || 200);
function rmKindsDef() {
  return [
    ['Family', 'place', 'solid'],
    ['Romance', 'char', 'solid'],
    ['Friends', 'pet', 'solid'],
    ['Allies', 'accent', 'dashed'],
    ['Rivals', 'danger', 'dashed'],
    ['Mentor', 'thing', 'dotted'],
    ['Secret', 'muted', 'dotted']
  ].map(k => ({ id: uid('r_'), name: k[0], color: k[1], dash: k[2], hide: false }));
}
function ftKindsDef() {
  return [
    ['Married', 'char', 'solid', '♥'],
    ['Partners', 'accent', 'solid', '∞'],
    ['Betrothed', 'thing', 'dashed', '◇'],
    ['Affair', 'danger', 'dotted', '♥'],
    ['Separated', 'muted', 'dashed', '✕']
  ].map(k => ({ id: uid('u_'), name: k[0], color: k[1], dash: k[2], sym: k[3] }));
}
function newRm() {
  return {
    kinds: rmKindsDef(),
    nodes: [],
    edges: [],
    view: { x: 300, y: 220, k: 1 },
    labels: true,
    pics: true,
    size: 'm',
    def: ''
  };
}
function newFt() {
  return {
    kinds: ftKindsDef(),
    people: [],
    unions: [],
    view: { x: 60, y: 60, k: 1 },
    cardW: 170,
    gap: 'normal',
    dates: true,
    titles: true,
    pics: true
  };
}
function normKinds(a, def, sym) {
  const out = (Array.isArray(a) ? a : [])
    .filter(k => k && k.id)
    .map(k => {
      const o = {
        id: String(k.id),
        name: str(k.name, 40) || 'Type',
        color: colOk(k.color) ? k.color : 'accent',
        dash: DASH[k.dash] != null ? k.dash : 'solid'
      };
      if (sym) o.sym = str(k.sym, 2);
      else o.hide = !!k.hide;
      return o;
    });
  return out.length ? out : def();
}
const normView = (v, d) => {
  v = v || {};
  return { x: num(v.x, d.x), y: num(v.y, d.y), k: clamp(num(v.k, 1), 0.2, 3) };
};
function normRm(m, ents) {
  m = m && typeof m === 'object' ? m : {};
  const kinds = normKinds(m.kinds, rmKindsDef, false),
    ks = new Set(kinds.map(k => k.id));
  const nodes = (Array.isArray(m.nodes) ? m.nodes : [])
    .filter(n => n && n.id)
    .map(n => ({
      id: String(n.id),
      ent: n.ent && ents[n.ent] ? String(n.ent) : '',
      name: str(n.name, 60),
      x: num(n.x, 0),
      y: num(n.y, 0),
      color: colOk(n.color) ? n.color : '',
      size: RM_R[n.size] ? n.size : '',
      note: str(n.note, 4000)
    }));
  const ns = new Set(nodes.map(n => n.id));
  const edges = (Array.isArray(m.edges) ? m.edges : [])
    .filter(e => e && e.id && ns.has(e.a) && ns.has(e.b) && e.a !== e.b)
    .map(e => ({
      id: String(e.id),
      a: String(e.a),
      b: String(e.b),
      kind: ks.has(e.kind) ? e.kind : kinds[0].id,
      dir: ['none', 'ab', 'ba', 'both'].includes(e.dir) ? e.dir : 'none',
      label: str(e.label, 80),
      note: str(e.note, 4000)
    }));
  return {
    kinds,
    nodes,
    edges,
    view: normView(m.view, { x: 300, y: 220 }),
    labels: m.labels !== false,
    pics: m.pics !== false,
    size: RM_R[m.size] ? m.size : 'm',
    def: ks.has(m.def) ? m.def : ''
  };
}
function normFt(f, ents) {
  f = f && typeof f === 'object' ? f : {};
  const kinds = normKinds(f.kinds, ftKindsDef, true),
    ks = new Set(kinds.map(k => k.id));
  const people = (Array.isArray(f.people) ? f.people : [])
    .filter(p => p && p.id)
    .map(p => ({
      id: String(p.id),
      ent: p.ent && ents[p.ent] ? String(p.ent) : '',
      name: str(p.name, 60),
      title: str(p.title, 80),
      born: str(p.born, 30),
      died: str(p.died, 30),
      color: colOk(p.color) ? p.color : '',
      of: String(p.of || ''),
      ptype: PT_DASH[p.ptype] != null ? p.ptype : 'bio',
      note: str(p.note, 4000)
    }));
  const ps = new Set(people.map(p => p.id));
  const unions = (Array.isArray(f.unions) ? f.unions : [])
    .filter(u => u && u.id)
    .map(u => {
      let a = ps.has(u.a) ? String(u.a) : '',
        b = ps.has(u.b) && u.b !== u.a ? String(u.b) : '';
      if (!a) {
        a = b;
        b = '';
      }
      return {
        id: String(u.id),
        a,
        b,
        kind: ks.has(u.kind) ? u.kind : kinds[0].id,
        label: str(u.label, 60),
        note: str(u.note, 4000)
      };
    })
    .filter(u => u.a);
  const us = new Set(unions.map(u => u.id));
  people.forEach(p => {
    if (!us.has(p.of)) p.of = '';
  });
  return {
    kinds,
    people,
    unions,
    view: normView(f.view, { x: 60, y: 60 }),
    cardW: clamp(num(f.cardW, 170), 120, 260),
    gap: FT_GAP[f.gap] ? f.gap : 'normal',
    dates: f.dates !== false,
    titles: f.titles !== false,
    pics: f.pics !== false
  };
}
// When a story page is deleted, its bubbles and tree people keep their place and name.
function unlinkEnt(id) {
  const e = S.meta.ents[id];
  if (!e) return;
  Object.keys(S.rm).forEach(k => {
    let ch = false;
    S.rm[k].nodes.forEach(n => {
      if (n.ent === id) {
        n.ent = '';
        n.name = e.name;
        ch = true;
      }
    });
    if (ch) dirty('rm_' + k);
  });
  Object.keys(S.ft).forEach(k => {
    let ch = false;
    S.ft[k].people.forEach(p => {
      if (p.ent === id) {
        p.ent = '';
        p.name = e.name;
        ch = true;
      }
    });
    if (ch) dirty('ft_' + k);
  });
}
const rmName = n => {
  const e = n.ent && S.meta.ents[n.ent];
  return e ? e.name : n.name || 'Unnamed';
};
const ftName = p => {
  const e = p.ent && S.meta.ents[p.ent];
  return e ? e.name : p.name || 'Unnamed';
};
const rmCol = n => {
  if (n.color) return cssCol(n.color);
  const e = n.ent && S.meta.ents[n.ent];
  return e ? 'var(--' + e.type + ')' : 'var(--muted)';
};
const initials = s =>
  (s.match(/\p{L}[\p{L}'’-]*/gu) || ['?'])
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
const trunc = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);
function relHtml(e) {
  const rows = [];
  S.meta.rms.forEach(x => {
    const m = S.rm[x.id],
      ns = m.nodes.filter(n => n.ent === e.id);
    ns.forEach(n => {
      m.edges.forEach(ed => {
        if (ed.a !== n.id && ed.b !== n.id) return;
        const o = m.nodes.find(y => y.id === (ed.a === n.id ? ed.b : ed.a)),
          k = m.kinds.find(y => y.id === ed.kind);
        rows.push(
          '<button class="ap" data-cv="rm" data-id="' +
            x.id +
            '" data-sk="edge" data-sel="' +
            ed.id +
            '"><b><span>' +
            esc(k.name) +
            ' · ' +
            esc(rmName(o)) +
            '</span><span class="muted" style="font-weight:400;font-size:12px">' +
            esc(x.name) +
            '</span></b>' +
            (ed.label ? '<span class="sn">' + esc(ed.label) + '</span>' : '') +
            '</button>'
        );
      });
    });
  });
  S.meta.fts.forEach(x => {
    const f = S.ft[x.id];
    f.people
      .filter(p => p.ent === e.id)
      .forEach(p => {
        const par = f.unions.find(u => u.id === p.of),
          names = ids => ids.map(i => ftName(f.people.find(q => q.id === i))).join(' & ');
        const bits = [];
        if (par) bits.push('Child of ' + names([par.a, par.b].filter(Boolean)));
        const ptn = f.unions
          .filter(u => (u.a === p.id || u.b === p.id) && u.b)
          .map(u => ftName(f.people.find(q => q.id === (u.a === p.id ? u.b : u.a))));
        if (ptn.length) bits.push('Partner of ' + ptn.join(', '));
        const kids = f.people
          .filter(q => f.unions.some(u => u.id === q.of && (u.a === p.id || u.b === p.id)))
          .map(ftName);
        if (kids.length) bits.push('Parent of ' + kids.join(', '));
        rows.push(
          '<button class="ap" data-cv="ft" data-id="' +
            x.id +
            '" data-sk="person" data-sel="' +
            p.id +
            '"><b><span>' +
            esc(x.name) +
            '</span><span class="muted" style="font-weight:400;font-size:12px">' +
            esc(LS('ft')) +
            '</span></b><span class="sn">' +
            esc(bits.join('. ') || 'In this tree') +
            '</span></button>'
        );
      });
  });
  return rows.length
    ? '<section class="appears"><h3>Relationships</h3><p class="sub">From your ' +
        esc(LP('rm').toLowerCase()) +
        ' and ' +
        esc(LP('ft').toLowerCase()) +
        '.</p>' +
        rows.join('') +
        '</section>'
    : '';
}

/* canvas: pan, zoom, fit */
const cvDoc = () => S[ui.view.k][ui.view.id];
const cvKey = () => ui.view.k + '_' + ui.view.id;
function cvApply() {
  const v = cvDoc().view,
    t = 'translate(' + v.x + ' ' + v.y + ') scale(' + v.k + ')';
  ['#cvRoot', '#cvTop'].forEach(s => {
    const g = $(s);
    if (g) g.setAttribute('transform', t);
  });
  const w = $('#cvWrap');
  if (w) {
    w.style.backgroundSize = 28 * v.k + 'px ' + 28 * v.k + 'px';
    w.style.backgroundPosition = v.x + 'px ' + v.y + 'px';
  }
}
function cvWorld(e) {
  const r = $('#cv').getBoundingClientRect(),
    v = cvDoc().view;
  return { x: (e.clientX - r.left - v.x) / v.k, y: (e.clientY - r.top - v.y) / v.k };
}
function cvZoom(f, cx, cy) {
  const v = cvDoc().view,
    r = $('#cv').getBoundingClientRect();
  if (cx == null) {
    cx = r.width / 2;
    cy = r.height / 2;
  }
  const k = clamp(v.k * f, 0.2, 3);
  v.x = cx - ((cx - v.x) * k) / v.k;
  v.y = cy - ((cy - v.y) * k) / v.k;
  v.k = k;
  cvApply();
  dirty(cvKey());
}
function cvFit() {
  const g = $('#cvRoot'),
    svg = $('#cv');
  if (!g || !svg) return;
  const b = g.getBBox();
  if (!b.width && !b.height) return;
  const r = svg.getBoundingClientRect(),
    v = cvDoc().view,
    pad = 40,
    k = clamp(
      Math.min((r.width - pad * 2) / Math.max(b.width, 1), (r.height - pad * 2) / Math.max(b.height, 1)),
      0.2,
      1.5
    );
  v.k = k;
  v.x = (r.width - b.width * k) / 2 - b.x * k;
  v.y = (r.height - b.height * k) / 2 - b.y * k;
  cvApply();
  dirty(cvKey());
}
function cvDraw() {
  if (ui.view.k === 'rm') drawRm();
  else if (ui.view.k === 'ft') drawFt();
  cvApply();
}
function cvRefresh() {
  cvDraw();
  cvSide();
  cvBar();
}
function cvSelect(k, id, focus) {
  ui.cvSel = k ? { k, id } : null;
  ui.confirm = null;
  ui.cvPop = false;
  cvRefresh();
  const el =
      k && $('#cvRoot [data-' + ({ node: 'node', person: 'p', union: 'u', edge: 'edge' }[k] || 'x') + '="' + id + '"]'),
    svg = $('#cv');
  if (el && svg) {
    // the side panel narrows the canvas: keep what was just selected in view
    const r = svg.getBoundingClientRect(),
      b = el.getBoundingClientRect(),
      v = cvDoc().view,
      m = 24;
    let dx = 0,
      dy = 0;
    if (b.right > r.right - m) dx = r.right - m - b.right;
    else if (b.left < r.left + m) dx = r.left + m - b.left;
    if (b.bottom > r.bottom - m) dy = r.bottom - m - b.bottom;
    else if (b.top < r.top + m) dy = r.top + m - b.top;
    if (dx || dy) {
      v.x += dx;
      v.y += dy;
      cvApply();
      dirty(cvKey());
    }
  }
  if (focus) {
    const i = $('#cvSide [data-f="' + focus + '"]');
    if (i) {
      i.focus();
      if (i.select) i.select();
    }
  }
}

/* relationship map drawing */
function drawRm() {
  const m = cvDoc(),
    g = $('#cvRoot');
  if (!g) return;
  const R = n => RM_R[n.size || m.size],
    by = {},
    K = {},
    sel = ui.cvSel || {};
  m.nodes.forEach(n => {
    by[n.id] = n;
  });
  m.kinds.forEach(k => {
    K[k.id] = k;
  });
  const near = new Set();
  if (sel.k === 'node') {
    near.add(sel.id);
    m.edges.forEach(e => {
      if (e.a === sel.id) near.add(e.b);
      if (e.b === sel.id) near.add(e.a);
    });
  }
  const pairs = {};
  m.edges.forEach(e => {
    if (K[e.kind].hide) return;
    const key = [e.a, e.b].sort().join('|');
    (pairs[key] = pairs[key] || []).push(e.id);
  });
  const end = (N, tx, ty, r) => {
    const d = Math.hypot(tx - N.x, ty - N.y) || 1;
    return { x: N.x + ((tx - N.x) / d) * r, y: N.y + ((ty - N.y) / d) * r };
  };
  const head = (P, cx, cy) => {
    const a = Math.atan2(P.y - cy, P.x - cx),
      L = 11;
    return (
      '<path class="ar" d="M' +
      P.x +
      ' ' +
      P.y +
      'L' +
      (P.x - L * Math.cos(a - 0.42)) +
      ' ' +
      (P.y - L * Math.sin(a - 0.42)) +
      'L' +
      (P.x - L * Math.cos(a + 0.42)) +
      ' ' +
      (P.y - L * Math.sin(a + 0.42)) +
      'Z"/>'
    );
  };
  let lines = '',
    labels = '',
    nodes = '';
  m.edges.forEach(e => {
    const A = by[e.a],
      B = by[e.b],
      k = K[e.kind];
    if (!A || !B || k.hide) return;
    const key = [e.a, e.b].sort().join('|'),
      list = pairs[key],
      i = list.indexOf(e.id),
      first = e.a < e.b ? A : B,
      second = e.a < e.b ? B : A;
    const dx = second.x - first.x,
      dy = second.y - first.y,
      L = Math.hypot(dx, dy) || 1,
      off = (i - (list.length - 1) / 2) * 38;
    const cx = (A.x + B.x) / 2 - (dy / L) * off * 2,
      cy = (A.y + B.y) / 2 + (dx / L) * off * 2;
    const sa = end(A, cx, cy, R(A) + 3 + (e.dir === 'ba' || e.dir === 'both' ? 2 : 0)),
      sb = end(B, cx, cy, R(B) + 3 + (e.dir === 'ab' || e.dir === 'both' ? 2 : 0));
    const d =
      'M' +
      sa.x.toFixed(1) +
      ' ' +
      sa.y.toFixed(1) +
      'Q' +
      cx.toFixed(1) +
      ' ' +
      cy.toFixed(1) +
      ' ' +
      sb.x.toFixed(1) +
      ' ' +
      sb.y.toFixed(1);
    const on = sel.k === 'edge' && sel.id === e.id,
      dim = sel.k === 'node' && e.a !== sel.id && e.b !== sel.id;
    lines +=
      '<g class="rm-e' +
      (on ? ' sel' : '') +
      (dim ? ' dim' : '') +
      '" data-edge="' +
      e.id +
      '" style="--c:' +
      cssCol(k.color) +
      '"><path class="hit" d="' +
      d +
      '"/><path class="ln" d="' +
      d +
      '"' +
      (DASH[k.dash] ? ' stroke-dasharray="' + DASH[k.dash] + '"' : '') +
      '/>' +
      (e.dir === 'ab' || e.dir === 'both' ? head(sb, cx, cy) : '') +
      (e.dir === 'ba' || e.dir === 'both' ? head(sa, cx, cy) : '') +
      '</g>';
    if (m.labels && e.label) {
      const mx = (sa.x + 2 * cx + sb.x) / 4,
        my = (sa.y + 2 * cy + sb.y) / 4,
        t = trunc(e.label, 34),
        w = t.length * 6.3 + 14;
      labels +=
        '<g class="rm-lb' +
        (dim ? ' dim' : '') +
        '" data-edge="' +
        e.id +
        '" style="--c:' +
        cssCol(k.color) +
        '" transform="translate(' +
        mx.toFixed(1) +
        ' ' +
        my.toFixed(1) +
        ')"><rect x="' +
        -w / 2 +
        '" y="-10" width="' +
        w +
        '" height="20" rx="10"/><text dy="4">' +
        esc(t) +
        '</text></g>';
    }
  });
  m.nodes.forEach(n => {
    const r = R(n),
      name = rmName(n),
      src = m.pics && n.ent ? picSrc(n.ent) : '',
      on = sel.k === 'node' && sel.id === n.id,
      dim = sel.k === 'node' && !near.has(n.id);
    nodes +=
      '<g class="rm-n' +
      (on ? ' sel' : '') +
      (dim ? ' dim' : '') +
      '" data-node="' +
      n.id +
      '" transform="translate(' +
      n.x +
      ' ' +
      n.y +
      ')" style="--c:' +
      rmCol(n) +
      '"><circle class="ring" r="' +
      (r + 6) +
      '"/><circle class="bg" r="' +
      r +
      '"/>' +
      (src
        ? '<clipPath id="cp_' +
          n.id +
          '"><circle r="' +
          (r - 2.5) +
          '"/></clipPath><image href="' +
          esc(src) +
          '" ' +
          picSvg(n.ent, 2.5 - r, 2.5 - r, 2 * r - 5, 2 * r - 5) +
          ' clip-path="url(#cp_' +
          n.id +
          ')"/>'
        : '<text class="ini" dy=".35em" style="font-size:' +
          Math.round(r * 0.62) +
          'px">' +
          esc(initials(name)) +
          '</text>') +
      '<text class="nm" y="' +
      (r + 17) +
      '">' +
      esc(trunc(name, 26)) +
      '</text>' +
      (on
        ? '<g class="hd" data-h="1" transform="translate(' +
          (r * 0.72 + 4) +
          ' ' +
          (-r * 0.72 - 4) +
          ')"><title>Drag onto another bubble to connect</title><circle r="10"/><path d="M-4.5 0h9M0 -4.5v9"/></g>'
        : '') +
      '</g>';
  });
  g.innerHTML = lines + nodes + labels;
  const em = $('#cvEmpty');
  if (em) em.hidden = !!m.nodes.length;
}

/* family tree layout and drawing */
function ftLayout(f) {
  const W = f.cardW,
    H = 34 + (f.titles ? 16 : 0) + (f.dates ? 16 : 0),
    gx = FT_GAP[f.gap][0],
    gy = FT_GAP[f.gap][1];
  const P = {},
    U = {},
    gen = {};
  f.people.forEach((p, i) => {
    P[p.id] = p;
    gen[p.id] = 0;
  });
  f.unions.forEach(u => {
    U[u.id] = u;
  });
  const par = p => {
    const u = U[p.of];
    return u ? [u.a, u.b].filter(x => P[x]) : [];
  };
  const kidsOf = {};
  f.people.forEach(p => {
    if (U[p.of]) (kidsOf[p.of] = kidsOf[p.of] || []).push(p.id);
  });
  for (let it = 0; it < 80; it++) {
    let ch = false; // partners and siblings share a generation; parents sit one row above their children
    const lift = (x, g) => {
      if (gen[x] < g && g < 60) {
        gen[x] = g;
        ch = true;
      }
    };
    Object.keys(kidsOf).forEach(uid2 => {
      const ks = kidsOf[uid2],
        u = U[uid2],
        top = Math.max(...ks.map(x => gen[x]));
      ks.forEach(x => lift(x, top));
      [u.a, u.b].filter(x => P[x]).forEach(x => lift(x, top - 1));
    });
    f.unions.forEach(u => {
      const ps = [u.a, u.b].filter(x => P[x]),
        g = Math.max(...ps.map(x => gen[x]));
      ps.forEach(x => {
        if (gen[x] < g && g < 60) {
          gen[x] = g;
          ch = true;
        }
      });
    });
    f.people.forEach(p => {
      const ps = par(p);
      if (!ps.length) return;
      const g = Math.max(...ps.map(x => gen[x])) + 1;
      if (gen[p.id] < g && g < 60) {
        gen[p.id] = g;
        ch = true;
      }
    });
    if (!ch) break;
  }
  const partners = id => f.unions.filter(u => u.b && (u.a === id || u.b === id)).map(u => (u.a === id ? u.b : u.a));
  const pos = {},
    maxG = Math.max(0, ...f.people.map(p => gen[p.id]));
  for (let g = 0; g <= maxG; g++) {
    const row = f.people.filter(p => gen[p.id] === g),
      inRow = new Set(row.map(p => p.id)),
      placed = new Set(),
      groups = [];
    const pcx = p => {
      const xs = par(p)
        .filter(x => pos[x])
        .map(x => pos[x].x + W / 2);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };
    const prim = row
      .filter(p => pcx(p) != null)
      .sort((a, b) => pcx(a) - pcx(b) || f.people.indexOf(a) - f.people.indexOf(b));
    const take = (p, grp) => {
      if (placed.has(p.id)) return;
      placed.add(p.id);
      grp.items.push(p);
      partners(p.id).forEach(q => {
        if (inRow.has(q) && !placed.has(q) && pcx(P[q]) == null) take(P[q], grp);
      });
    };
    prim.forEach(p => {
      if (placed.has(p.id)) return;
      const key = p.of;
      let gr = groups.length && groups[groups.length - 1].key === key ? groups[groups.length - 1] : null;
      if (!gr) {
        gr = { key, items: [], c: pcx(p) };
        groups.push(gr);
      }
      take(p, gr);
    });
    row.forEach(p => {
      if (placed.has(p.id)) return;
      const gr = { key: 'solo', items: [], c: null };
      groups.push(gr);
      take(p, gr);
    });
    let cur = null;
    groups.forEach(gr => {
      const w = gr.items.length * W + (gr.items.length - 1) * gx;
      let x0 = gr.c != null ? gr.c - w / 2 : cur == null ? 0 : cur + gx * 1.8;
      if (cur != null) x0 = Math.max(x0, cur + gx * 1.8);
      gr.items.forEach((p, i) => {
        pos[p.id] = { x: x0 + i * (W + gx), y: g * (H + gy) };
      });
      cur = x0 + w;
    });
  }
  ui.ftGen = gen;
  return { pos, W, H, gy };
}
function drawFt() {
  const f = cvDoc(),
    g = $('#cvRoot');
  if (!g) return;
  const L = ftLayout(f),
    pos = L.pos,
    W = L.W,
    H = L.H,
    K = {},
    sel = ui.cvSel || {};
  f.kinds.forEach(k => {
    K[k.id] = k;
  });
  let links = '',
    marks = '',
    cards = '';
  f.unions.forEach((u, ui2) => {
    const A = pos[u.a],
      B = u.b && pos[u.b],
      k = K[u.kind],
      kids = f.people.filter(p => p.of === u.id && pos[p.id]);
    let O;
    if (A && B) {
      const l = A.x <= B.x ? A : B,
        r = A.x <= B.x ? B : A,
        y = l.y + H / 2,
        sameRow = Math.abs(A.y - B.y) < 1,
        adj = sameRow && r.x - l.x - W <= FT_GAP[f.gap][0] * 2.2 + 1;
      let d;
      if (adj) {
        d = 'M' + (l.x + W) + ' ' + y + 'H' + r.x;
        O = { x: (l.x + W + r.x) / 2, y };
      } else {
        const x1 = l.x + W / 2,
          x2 = r.x + W / 2,
          yb = Math.max(l.y, r.y) + H,
          dip = yb + 18 + (ui2 % 3) * 6;
        d = 'M' + x1 + ' ' + (l.y + H) + 'V' + dip + 'H' + x2 + 'V' + (r.y + H);
        O = { x: (x1 + x2) / 2, y: dip };
      }
      const on = sel.k === 'union' && sel.id === u.id;
      links +=
        '<path class="ft-ul" d="' +
        d +
        '" style="--c:' +
        cssCol(k.color) +
        '"' +
        (DASH[k.dash] ? ' stroke-dasharray="' + DASH[k.dash] + '"' : '') +
        '/>';
      marks +=
        '<g class="ft-u' +
        (on ? ' sel' : '') +
        '" data-u="' +
        u.id +
        '" transform="translate(' +
        O.x +
        ' ' +
        O.y +
        ')" style="--c:' +
        cssCol(k.color) +
        '"><title>' +
        esc(k.name + (u.label ? ' · ' + u.label : '')) +
        '</title><circle r="10"/><text dy="4">' +
        esc(k.sym || '') +
        '</text></g>';
      if (u.label)
        marks += '<text class="ft-ulb" x="' + O.x + '" y="' + (O.y - 15) + '">' + esc(trunc(u.label, 22)) + '</text>';
    } else if (A) O = { x: A.x + W / 2, y: A.y + H };
    if (!O || !kids.length) return;
    const top = Math.min(...kids.map(p => pos[p.id].y)),
      bus = top - L.gy / 2 + ((ui2 % 3) - 1) * 5,
      xs = kids.map(p => pos[p.id].x + W / 2);
    links +=
      '<path class="ft-ln" d="M' +
      O.x +
      ' ' +
      (O.y + (A && B ? 10 : 0)) +
      'V' +
      bus +
      'M' +
      Math.min(O.x, ...xs) +
      ' ' +
      bus +
      'H' +
      Math.max(O.x, ...xs) +
      '"/>';
    kids.forEach(p => {
      const P2 = pos[p.id];
      links +=
        '<path class="ft-ln" d="M' +
        (P2.x + W / 2) +
        ' ' +
        bus +
        'V' +
        P2.y +
        '"' +
        (PT_DASH[p.ptype] ? ' stroke-dasharray="' + PT_DASH[p.ptype] + '"' : '') +
        '/>';
    });
  });
  f.people.forEach(p => {
    const P2 = pos[p.id];
    if (!P2) return;
    const name = ftName(p),
      src = f.pics && p.ent ? picSrc(p.ent) : '',
      on = sel.k === 'person' && sel.id === p.id;
    const col = p.color
      ? cssCol(p.color)
      : p.ent && S.meta.ents[p.ent]
        ? 'var(--' + S.meta.ents[p.ent].type + ')'
        : 'var(--muted)';
    const pr = Math.min(18, (H - 14) / 2),
      tx = src ? 14 + pr * 2 + 10 : 16,
      chars = Math.max(4, Math.floor((W - tx - 10) / 7.2));
    const dates = p.born || p.died ? (p.born || '?') + ' – ' + (p.died || '') : '';
    let y = 22;
    cards +=
      '<g class="ft-p' +
      (on ? ' sel' : '') +
      '" data-p="' +
      p.id +
      '" transform="translate(' +
      P2.x +
      ' ' +
      P2.y +
      ')" style="--c:' +
      col +
      '"><rect class="bx" width="' +
      W +
      '" height="' +
      H +
      '" rx="10"/><rect class="st" width="5" height="' +
      (H - 16) +
      '" x="0" y="8" rx="2"/>' +
      (src
        ? '<clipPath id="fp_' +
          p.id +
          '"><circle cx="' +
          (14 + pr) +
          '" cy="' +
          H / 2 +
          '" r="' +
          pr +
          '"/></clipPath><image href="' +
          esc(src) +
          '" ' +
          picSvg(p.ent, 14, H / 2 - pr, pr * 2, pr * 2) +
          ' clip-path="url(#fp_' +
          p.id +
          ')"/>'
        : '') +
      '<text class="nm" x="' +
      tx +
      '" y="' +
      y +
      '">' +
      esc(trunc(name, chars)) +
      '</text>';
    if (f.titles) {
      y += 16;
      cards += '<text class="sub" x="' + tx + '" y="' + y + '">' + esc(trunc(p.title, chars + 3)) + '</text>';
    }
    if (f.dates) {
      y += 16;
      cards += '<text class="dt" x="' + tx + '" y="' + y + '">' + esc(trunc(dates, chars + 4)) + '</text>';
    }
    cards += '</g>';
  });
  g.innerHTML = links + cards + marks;
  const em = $('#cvEmpty');
  if (em) em.hidden = !!f.people.length;
}

/* family tree editing */
function ftPerson(f, o, after) {
  const p = Object.assign(
    { id: uid('p_'), ent: '', name: '', title: '', born: '', died: '', color: '', of: '', ptype: 'bio', note: '' },
    o || {}
  );
  const i = after ? f.people.findIndex(q => q.id === after) : -1;
  if (i >= 0) f.people.splice(i + 1, 0, p);
  else f.people.push(p);
  return p;
}
function ftUnion(f, a, b) {
  const u = { id: uid('u_'), a, b: b || '', kind: f.kinds[0].id, label: '', note: '' };
  f.unions.push(u);
  return u;
}
function ftSoloUnion(f, pid) {
  return f.unions.find(u => u.a === pid && !u.b) || ftUnion(f, pid, '');
}
function ftTidy(f) {
  const live = new Set(f.people.map(p => p.id));
  f.unions.forEach(u => {
    if (!live.has(u.b)) u.b = '';
    if (!live.has(u.a)) {
      u.a = u.b;
      u.b = '';
    }
  });
  const hasKids = id => f.people.some(p => p.of === id);
  f.unions = f.unions.filter(u => u.a && (u.b || hasKids(u.id)));
  const us = new Set(f.unions.map(u => u.id));
  f.people.forEach(p => {
    if (!us.has(p.of)) p.of = '';
  });
}
function ftAct(a, b) {
  const f = cvDoc(),
    sel = ui.cvSel || {},
    p = sel.k === 'person' && f.people.find(x => x.id === sel.id),
    u = sel.k === 'union' && f.unions.find(x => x.id === sel.id),
    save = () => {
      dirty(cvKey());
      renderBinder();
    };
  if (a === 'addpar' && p) {
    const pu = f.unions.find(x => x.id === p.of);
    if (pu && pu.b) {
      toast('They already have two parents here. Select a parent to add a partner instead.', { plain: true });
      return;
    }
    if (pu) {
      const n = ftPerson(f, { name: 'New parent' });
      pu.b = n.id;
      save();
      return cvSelect('person', n.id, 'name');
    }
    const x = ftPerson(f, { name: 'New parent' }),
      y = ftPerson(f, { name: 'New parent' }),
      nu = ftUnion(f, x.id, y.id);
    p.of = nu.id;
    save();
    cvSelect('person', x.id, 'name');
  } else if (a === 'addpart' && p) {
    const n = ftPerson(f, { name: 'New partner' }, p.id);
    ftUnion(f, p.id, n.id);
    save();
    cvSelect('person', n.id, 'name');
  } else if (a === 'addchild' && p) {
    const w = ($('#cvSide [data-f="childof"]') || {}).value || '',
      un = (w && f.unions.find(x => x.id === w)) || ftSoloUnion(f, p.id),
      n = ftPerson(f, { name: 'New child', of: un.id });
    save();
    cvSelect('person', n.id, 'name');
  } else if (a === 'uaddchild' && u) {
    const n = ftPerson(f, { name: 'New child', of: u.id });
    save();
    cvSelect('person', n.id, 'name');
  } else if (a === 'addsib' && p) {
    if (!p.of) {
      const par = ftPerson(f, { name: 'New parent' });
      p.of = ftUnion(f, par.id, '').id;
    }
    const n = ftPerson(f, { name: 'New sibling', of: p.of }, p.id);
    save();
    cvSelect('person', n.id, 'name');
  } else if ((a === 'mvl' || a === 'mvr') && p) {
    const g = ui.ftGen,
      same = f.people.filter(q => g[q.id] === g[p.id] && q.of === p.of),
      i = same.indexOf(p),
      j = i + (a === 'mvl' ? -1 : 1);
    if (j < 0 || j >= same.length) {
      toast('They are already at that end of their family.', { plain: true });
      return;
    }
    const ia = f.people.indexOf(p),
      ib = f.people.indexOf(same[j]);
    f.people[ia] = same[j];
    f.people[ib] = p;
    save();
    cvRefresh();
  } else if (a === 'delp' && p)
    confirmDo(
      'fp' + p.id,
      () => {
        f.people = f.people.filter(x => x.id !== p.id);
        ftTidy(f);
        save();
        cvSelect(null);
      },
      cvSide
    );
  else if (a === 'delu' && u)
    confirmDo(
      'fu' + u.id,
      () => {
        f.people.forEach(x => {
          if (x.of === u.id) x.of = '';
        });
        f.unions = f.unions.filter(x => x.id !== u.id);
        save();
        cvSelect(null);
      },
      cvSide
    );
  else if (a === 'ukind' && u) {
    u.kind = b.dataset.v;
    dirty(cvKey());
    cvRefresh();
  } else if (a === 'mkent' && p) {
    const id = addEntity('char', (p.name || 'New character').slice(0, 60));
    p.ent = id;
    p.name = '';
    save();
    renderBinder();
    cvRefresh();
    toast('Made a ' + LS('char').toLowerCase() + ' page for ' + S.meta.ents[id].name + '.', { plain: true });
  } else if (a === 'unlink' && p) {
    p.name = ftName(p);
    p.ent = '';
    dirty(cvKey());
    cvRefresh();
  } else if (a === 'ftstart') {
    const s = $('#ftStartSel'),
      nmI = $('#ftStartName'),
      ent = s && s.value,
      name = nmI && nmI.value.trim();
    if (!ent && !name) {
      toast('Pick a ' + LS('char').toLowerCase() + ' or type a name first.', { plain: true });
      return;
    }
    const n = ftPerson(f, { ent: ent || '', name: ent ? '' : name });
    save();
    cvSelect('person', n.id);
  }
}
function rmAct(a, b) {
  const m = cvDoc(),
    sel = ui.cvSel || {},
    n = sel.k === 'node' && m.nodes.find(x => x.id === sel.id),
    e = sel.k === 'edge' && m.edges.find(x => x.id === sel.id),
    save = () => {
      dirty(cvKey());
      renderBinder();
    };
  const spot = () => {
    const r = $('#cv').getBoundingClientRect(),
      v = m.view;
    let x = (r.width / 2 - v.x) / v.k,
      y = (r.height / 2 - v.y) / v.k,
      t = 0;
    while (t < 40 && m.nodes.some(q => Math.hypot(q.x - x, q.y - y) < 80)) {
      t++;
      x += Math.cos(t * 2.4) * 30 * Math.sqrt(t);
      y += Math.sin(t * 2.4) * 30 * Math.sqrt(t);
    }
    return { x: Math.round(x), y: Math.round(y) };
  };
  const addNode = o => {
    const nn = Object.assign({ id: uid('b_'), ent: '', name: '', color: '', size: '', note: '' }, spot(), o);
    m.nodes.push(nn);
    return nn;
  };
  if (a === 'addpop') {
    ui.cvPop = !ui.cvPop;
    cvBar();
  } else if (a === 'addent') {
    const nn = addNode({ ent: b.dataset.id });
    ui.cvPop = false;
    save();
    cvSelect('node', nn.id);
  } else if (a === 'addfree') {
    const nn = addNode({ name: 'New bubble' });
    ui.cvPop = false;
    save();
    cvSelect('node', nn.id, 'name');
  } else if (a === 'allchars') {
    let c = 0;
    Object.values(S.meta.ents)
      .filter(x => x.type === 'char')
      .forEach(x => {
        if (!m.nodes.some(q => q.ent === x.id)) {
          addNode({ ent: x.id });
          c++;
        }
      });
    ui.cvPop = false;
    save();
    cvRefresh();
    toast(
      c
        ? 'Added ' + c + ' ' + (c === 1 ? LS('char') : LP('char')).toLowerCase() + '.'
        : 'Everyone is already on this map.',
      { plain: true }
    );
  } else if (a === 'arrange') {
    const N = m.nodes.length;
    if (!N) return;
    const r = Math.max(150, (N * 44) / Math.PI);
    m.nodes.forEach((q, i) => {
      q.x = Math.round(Math.cos((i / N) * 2 * Math.PI - Math.PI / 2) * r);
      q.y = Math.round(Math.sin((i / N) * 2 * Math.PI - Math.PI / 2) * r);
    });
    dirty(cvKey());
    cvDraw();
    cvFit();
  } else if (a === 'kvis') {
    const k = m.kinds.find(x => x.id === b.dataset.id);
    k.hide = !k.hide;
    dirty(cvKey());
    cvRefresh();
  } else if (a === 'nsize' && n) {
    n.size = b.dataset.v;
    dirty(cvKey());
    cvRefresh();
  } else if (a === 'mkent' && n) {
    const t = ($('#cvSide [data-f="mktype"]') || {}).value || 'char',
      id = addEntity(t, (n.name || 'New page').slice(0, 60));
    n.ent = id;
    n.name = '';
    save();
    renderBinder();
    cvRefresh();
    toast('Made a ' + LS(t).toLowerCase() + ' page for ' + S.meta.ents[id].name + '.', { plain: true });
  } else if (a === 'delnode' && n)
    confirmDo(
      'rn' + n.id,
      () => {
        m.nodes = m.nodes.filter(x => x.id !== n.id);
        m.edges = m.edges.filter(x => x.a !== n.id && x.b !== n.id);
        save();
        cvSelect(null);
      },
      cvSide
    );
  else if (a === 'ekind' && e) {
    e.kind = b.dataset.v;
    m.def = e.kind;
    dirty(cvKey());
    cvRefresh();
  } else if (a === 'edir' && e) {
    e.dir = b.dataset.v;
    dirty(cvKey());
    cvRefresh();
  } else if (a === 'eswap' && e) {
    const t = e.a;
    e.a = e.b;
    e.b = t;
    e.dir = { ab: 'ba', ba: 'ab' }[e.dir] || e.dir;
    dirty(cvKey());
    cvRefresh();
  } else if (a === 'deledge' && e)
    confirmDo(
      're' + e.id,
      () => {
        m.edges = m.edges.filter(x => x.id !== e.id);
        save();
        cvSelect(null);
      },
      cvSide
    );
}
function rmConnect(m, a, b2) {
  if (a === b2) return;
  const k = (m.def && m.kinds.find(x => x.id === m.def && !x.hide)) || m.kinds.find(x => !x.hide) || m.kinds[0];
  const e = { id: uid('e_'), a, b: b2, kind: k.id, dir: 'none', label: '', note: '' };
  m.edges.push(e);
  dirty(cvKey());
  renderBinder();
  cvSelect('edge', e.id, 'label');
}

/* side panels */
function cvSide() {
  const box = $('#cvSide');
  if (!box) return;
  const d = cvDoc(),
    s = ui.cvSel,
    rm = ui.view.k === 'rm';
  const sb = $('#cvv [data-x="settings"]');
  if (sb) sb.setAttribute('aria-pressed', s && s.k === 'set' ? 'true' : 'false');
  const ok =
    s &&
    (s.k === 'set' ||
      (s.k === 'node' && d.nodes && d.nodes.some(x => x.id === s.id)) ||
      (s.k === 'edge' && d.edges && d.edges.some(x => x.id === s.id)) ||
      (s.k === 'person' && d.people && d.people.some(x => x.id === s.id)) ||
      (s.k === 'union' && d.unions && d.unions.some(x => x.id === s.id)));
  if (!ok) {
    ui.cvSel = null;
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const keep = box.dataset.key === s.k + s.id ? box.scrollTop : 0;
  box.dataset.key = s.k + s.id;
  box.hidden = false;
  const head = t =>
    '<div class="ts-head"><h3>' +
    t +
    '</h3><button class="ibtn" data-x="close" aria-label="Close panel">' +
    ico('x') +
    '</button></div>';
  const seg = (act, opts, cur) =>
    '<div class="seg">' +
    opts
      .map(
        o =>
          '<button data-x="' +
          act +
          '" data-v="' +
          o[0] +
          '"' +
          (cur === o[0] ? ' class="on"' : '') +
          '>' +
          esc(o[1]) +
          '</button>'
      )
      .join('') +
    '</div>';
  const cf = ui.confirm;
  let h = '';
  const kindRows = sym =>
    d.kinds
      .map(
        k =>
          '<div class="lrow"><div class="r1"><input class="nm" data-kf="name" data-id="' +
          k.id +
          '" value="' +
          esc(k.name) +
          '" maxlength="40" aria-label="Type name">' +
          (sym
            ? '<input class="nm sym" data-kf="sym" data-id="' +
              k.id +
              '" value="' +
              esc(k.sym) +
              '" maxlength="2" aria-label="Symbol" title="Symbol on the line">'
            : '') +
          (d.kinds.length > 1
            ? '<button class="ibtn' +
              (cf === 'k' + k.id ? ' on' : '') +
              '" data-x="delkind" data-id="' +
              k.id +
              '" aria-label="Delete type">' +
              (cf === 'k' + k.id ? 'Delete?' : ico('trash', 14)) +
              '</button>'
            : '') +
          '</div>' +
          '<div class="seg">' +
          LINE_STYLES.map(
            o =>
              '<button data-x="kdash" data-id="' +
              k.id +
              '" data-v="' +
              o[0] +
              '"' +
              (k.dash === o[0] ? ' class="on"' : '') +
              '>' +
              o[1] +
              '</button>'
          ).join('') +
          '</div>' +
          swatches(k.color, 'kcol', k.id) +
          '</div>'
      )
      .join('') +
    '<button class="btn sm" data-x="addkind" style="margin-top:8px">' +
    ico('plus', 14) +
    '<span>Type</span></button>';
  const tools =
    '<h4>Tools</h4><div class="ts-col">' +
    (rm
      ? '<button class="btn sm" data-x="allchars">' +
        ico('plus', 14) +
        '<span>Add every ' +
        esc(LS('char').toLowerCase()) +
        '</span></button><button class="btn sm" data-x="arrange">' +
        ico('web', 14) +
        '<span>Arrange in a circle</span></button>'
      : '') +
    '<button class="btn sm" data-x="dup">' +
    ico('copy', 14) +
    '<span>Duplicate</span></button><button class="btn sm danger" data-x="deldoc">' +
    ico('trash', 14) +
    '<span>' +
    (cf === 'doc' + ui.view.id ? 'Click again to delete' : 'Delete this ' + esc(LS(ui.view.k).toLowerCase())) +
    '</span></button></div>';
  if (s.k === 'set' && rm) {
    h =
      head('Customize map') +
      '<h4>Relationship types</h4><p class="fine">Rename them, recolour them, pick a line style, or add your own: sworn enemies, bound by magic, owes a debt.</p>' +
      kindRows(false) +
      '<h4>Display</h4><label class="f">Bubble size<select data-sf="size">' +
      [
        ['s', 'Small'],
        ['m', 'Medium'],
        ['l', 'Large']
      ]
        .map(o => '<option value="' + o[0] + '"' + (d.size === o[0] ? ' selected' : '') + '>' + o[1] + '</option>')
        .join('') +
      '</select></label>' +
      '<label class="ck"><input type="checkbox" data-sf="labels"' +
      (d.labels ? ' checked' : '') +
      '>Show labels on lines</label><label class="ck"><input type="checkbox" data-sf="pics"' +
      (d.pics ? ' checked' : '') +
      '>Show pictures from story pages</label>' +
      tools;
  } else if (s.k === 'set') {
    h =
      head('Customize tree') +
      '<h4>Partnership types</h4><p class="fine">Each type has a symbol, colour and line. Add your own: handfasted, bonded, consorts.</p>' +
      kindRows(true) +
      '<h4>Cards</h4><label class="f">Card width<input type="range" min="120" max="260" step="10" data-sf="cardW" value="' +
      d.cardW +
      '"></label>' +
      '<label class="f">Spacing<select data-sf="gap">' +
      [
        ['compact', 'Compact'],
        ['normal', 'Normal'],
        ['roomy', 'Roomy']
      ]
        .map(o => '<option value="' + o[0] + '"' + (d.gap === o[0] ? ' selected' : '') + '>' + o[1] + '</option>')
        .join('') +
      '</select></label>' +
      [
        ['titles', 'Show titles'],
        ['dates', 'Show dates'],
        ['pics', 'Show pictures from story pages']
      ]
        .map(
          o =>
            '<label class="ck"><input type="checkbox" data-sf="' +
            o[0] +
            '"' +
            (d[o[0]] ? ' checked' : '') +
            '>' +
            o[1] +
            '</label>'
        )
        .join('') +
      '<p class="fine">Lines to children: solid by birth, dashed adopted or fostered, dotted step-child, faint dots rumoured.</p>' +
      tools;
  } else if (s.k === 'node') {
    const n = d.nodes.find(x => x.id === s.id),
      ent = n.ent && S.meta.ents[n.ent],
      conn = d.edges.filter(x => x.a === n.id || x.b === n.id);
    h =
      head('Bubble') +
      (ent
        ? '<p class="cv-ent t-' +
          ent.type +
          '"><i class="pip"></i>' +
          esc(LS(ent.type)) +
          '</p><h2 class="cv-h">' +
          esc(ent.name) +
          '</h2><button class="btn sm" data-x="openent" data-id="' +
          ent.id +
          '">' +
          ico('book', 14) +
          '<span>Open page</span></button>'
        : '<label class="f">Name<input data-f="name" value="' +
          esc(n.name) +
          '" maxlength="60" placeholder="A person, a group, a god…"></label><div class="mk-row"><select data-f="mktype" aria-label="Page type">' +
          TYPE_ORDER.map(t => '<option value="' + t + '">' + esc(LS(t)) + '</option>').join('') +
          '</select><button class="btn sm" data-x="mkent">Make a story page</button></div>') +
      '<span class="sec-l">Size</span>' +
      seg(
        'nsize',
        [
          ['', 'Default'],
          ['s', 'Small'],
          ['m', 'Medium'],
          ['l', 'Large']
        ],
        n.size
      ) +
      '<span class="sec-l">Colour</span>' +
      swatches(n.color, 'ncol', n.id, ent ? 'var(--' + ent.type + ')' : 'muted', 'Same as its page type') +
      '<label class="f">Notes<textarea data-f="note" rows="3" placeholder="What matters about them on this map?">' +
      esc(n.note) +
      '</textarea></label>' +
      '<h4>Connections (' +
      conn.length +
      ')</h4><div class="rel-list">' +
      conn
        .map(x => {
          const k = d.kinds.find(y => y.id === x.kind),
            o = d.nodes.find(y => y.id === (x.a === n.id ? x.b : x.a));
          return (
            '<button data-x="seledge" data-id="' +
            x.id +
            '" style="--c:' +
            cssCol(k.color) +
            '"><i></i><b>' +
            esc(k.name) +
            '</b><span>' +
            esc(rmName(o)) +
            (x.label ? ' · ' + esc(x.label) : '') +
            '</span></button>'
          );
        })
        .join('') +
      '</div>' +
      '<label class="f">Connect to<select data-f="connect"><option value="">Choose…</option>' +
      d.nodes
        .filter(x => x.id !== n.id)
        .map(x => '<option value="' + x.id + '">' + esc(rmName(x)) + '</option>')
        .join('') +
      '</select></label>' +
      '<p class="fine">Or drag the <b>+</b> on the bubble onto someone else.</p>' +
      '<div class="ts-row"><button class="btn sm danger" data-x="delnode">' +
      ico('trash', 14) +
      '<span>' +
      (cf === 'rn' + n.id ? 'Click again to remove' : 'Remove from map') +
      '</span></button></div>';
  } else if (s.k === 'edge') {
    const e = d.edges.find(x => x.id === s.id),
      A = d.nodes.find(x => x.id === e.a),
      B = d.nodes.find(x => x.id === e.b),
      an = trunc(rmName(A), 14),
      bn = trunc(rmName(B), 14);
    h =
      head('Relationship') +
      '<p class="cv-pair"><button data-x="selnode" data-id="' +
      A.id +
      '">' +
      esc(rmName(A)) +
      '</button><button class="ibtn" data-x="eswap" aria-label="Swap sides" title="Swap sides">⇄</button><button data-x="selnode" data-id="' +
      B.id +
      '">' +
      esc(rmName(B)) +
      '</button></p>' +
      '<span class="sec-l">Type</span><div class="kchips">' +
      d.kinds
        .map(
          k =>
            '<button class="kc' +
            (e.kind === k.id ? ' on' : '') +
            '" data-x="ekind" data-v="' +
            k.id +
            '" style="--c:' +
            cssCol(k.color) +
            '"><i' +
            (k.dash !== 'solid' ? ' class="' + k.dash + '"' : '') +
            '></i>' +
            esc(k.name) +
            '</button>'
        )
        .join('') +
      '</div>' +
      '<label class="f">Label<input data-f="label" value="' +
      esc(e.label) +
      '" maxlength="80" placeholder="e.g. childhood friends, owes a life debt"></label>' +
      '<span class="sec-l">Arrow</span>' +
      seg(
        'edir',
        [
          ['none', 'None'],
          ['ab', an + ' →'],
          ['ba', '← ' + bn],
          ['both', 'Both ways']
        ],
        e.dir
      ) +
      '<label class="f">Notes<textarea data-f="note" rows="4" placeholder="How it started, how it changes, what they hide from each other.">' +
      esc(e.note) +
      '</textarea></label>' +
      '<div class="ts-row"><button class="btn sm danger" data-x="deledge">' +
      ico('trash', 14) +
      '<span>' +
      (cf === 're' + e.id ? 'Click again to delete' : 'Delete relationship') +
      '</span></button></div>';
  } else if (s.k === 'person') {
    const p = d.people.find(x => x.id === s.id),
      ent = p.ent && S.meta.ents[p.ent],
      pu = d.unions.find(x => x.id === p.of),
      mine = d.unions.filter(x => x.a === p.id || x.b === p.id);
    const nm = id => ftName(d.people.find(x => x.id === id)),
      btn = id => '<button data-x="selp" data-id="' + id + '">' + esc(nm(id)) + '</button>';
    const kids = d.people.filter(x => mine.some(m2 => m2.id === x.of)),
      sibs = p.of ? d.people.filter(x => x.of === p.of && x.id !== p.id) : [];
    const used = new Set(d.people.map(x => x.ent).filter(Boolean));
    h =
      head('Person') +
      (ent
        ? '<p class="cv-ent t-char"><i class="pip"></i>' +
          esc(LS(ent.type)) +
          '</p><h2 class="cv-h">' +
          esc(ent.name) +
          '</h2><div class="ts-row" style="margin-top:6px"><button class="btn sm" data-x="openent" data-id="' +
          ent.id +
          '">' +
          ico('book', 14) +
          '<span>Open page</span></button><button class="btn sm" data-x="unlink">Unlink page</button></div>'
        : '<label class="f">Name<input data-f="name" value="' +
          esc(p.name) +
          '" maxlength="60"></label><label class="f">Link to a ' +
          esc(LS('char').toLowerCase()) +
          ' page<select data-f="link"><option value="">Not linked</option>' +
          Object.values(S.meta.ents)
            .filter(x => x.type === 'char' && !used.has(x.id))
            .sort((a2, b2) => a2.name.localeCompare(b2.name))
            .map(x => '<option value="' + x.id + '">' + esc(x.name) + '</option>')
            .join('') +
          '</select></label><button class="btn sm" data-x="mkent" style="margin-top:8px">Make a ' +
          esc(LS('char').toLowerCase()) +
          ' page</button>') +
      '<label class="f">Title or role<input data-f="title" value="' +
      esc(p.title) +
      '" maxlength="80" placeholder="e.g. Queen of the North, blacksmith"></label>' +
      '<div class="two"><label class="f">Born<input data-f="born" value="' +
      esc(p.born) +
      '" maxlength="30" placeholder="any calendar"></label><label class="f">Died<input data-f="died" value="' +
      esc(p.died) +
      '" maxlength="30"></label></div>' +
      (p.of
        ? '<label class="f">Tie to parents<select data-f="ptype">' +
          PTYPES.map(
            o => '<option value="' + o[0] + '"' + (p.ptype === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'
          ).join('') +
          '</select></label>'
        : '') +
      '<span class="sec-l">Colour</span>' +
      swatches(p.color, 'pcol', p.id, ent ? 'var(--' + ent.type + ')' : 'muted', 'Default') +
      '<label class="f">Notes<textarea data-f="note" rows="3">' +
      esc(p.note) +
      '</textarea></label>' +
      '<h4>Family</h4><dl class="fam"><dt>Parents</dt><dd>' +
      (pu
        ? [pu.a, pu.b].filter(Boolean).map(btn).join(' & ') +
          ' <button class="lnk" data-x="selu" data-id="' +
          pu.id +
          '">(edit)</button>'
        : '<span class="muted">None yet</span>') +
      '</dd>' +
      '<dt>Partners</dt><dd>' +
      (mine.filter(x => x.b).length
        ? mine
            .filter(x => x.b)
            .map(x => {
              const k = d.kinds.find(y => y.id === x.kind);
              return (
                '<button data-x="selu" data-id="' +
                x.id +
                '" style="color:' +
                cssCol(k.color) +
                '">' +
                esc(k.sym || '') +
                '</button> ' +
                btn(x.a === p.id ? x.b : x.a)
              );
            })
            .join(', ')
        : '<span class="muted">None yet</span>') +
      '</dd>' +
      '<dt>Children</dt><dd>' +
      (kids.length ? kids.map(x => btn(x.id)).join(', ') : '<span class="muted">None yet</span>') +
      '</dd>' +
      (sibs.length ? '<dt>Siblings</dt><dd>' + sibs.map(x => btn(x.id)).join(', ') + '</dd>' : '') +
      '</dl>' +
      '<h4>Add to the family</h4><div class="ts-col"><button class="btn sm" data-x="addpar">' +
      ico('plus', 14) +
      '<span>Parents</span></button><button class="btn sm" data-x="addpart">' +
      ico('plus', 14) +
      '<span>Partner</span></button>' +
      '<div class="mk-row"><button class="btn sm" data-x="addchild">' +
      ico('plus', 14) +
      '<span>Child</span></button><select data-f="childof" aria-label="Other parent">' +
      mine
        .filter(x => x.b)
        .map(x => '<option value="' + x.id + '">with ' + esc(nm(x.a === p.id ? x.b : x.a)) + '</option>')
        .join('') +
      '<option value="">with no partner shown</option></select></div>' +
      '<button class="btn sm" data-x="addsib">' +
      ico('plus', 14) +
      '<span>Sibling</span></button></div>' +
      '<label class="f">Link someone already in this tree as a partner<select data-f="linkpart"><option value="">Choose…</option>' +
      d.people
        .filter(x => x.id !== p.id && !mine.some(m2 => m2.a === x.id || m2.b === x.id))
        .map(x => '<option value="' + x.id + '">' + esc(ftName(x)) + '</option>')
        .join('') +
      '</select></label>' +
      '<h4>Order</h4><div class="ts-row" style="margin-top:6px"><button class="btn sm" data-x="mvl">' +
      ico('back', 14) +
      '<span>Move left</span></button><button class="btn sm" data-x="mvr"><span>Move right</span>' +
      ico('right', 14) +
      '</button></div>' +
      '<div class="ts-row"><button class="btn sm danger" data-x="delp">' +
      ico('trash', 14) +
      '<span>' +
      (cf === 'fp' + p.id ? 'Click again to remove' : 'Remove from tree') +
      '</span></button></div>';
  } else if (s.k === 'union') {
    const u = d.unions.find(x => x.id === s.id),
      kids = d.people.filter(x => x.of === u.id);
    h =
      head(u.b ? 'Partnership' : 'Parent') +
      '<p class="cv-pair">' +
      [u.a, u.b]
        .filter(Boolean)
        .map(
          id =>
            '<button data-x="selp" data-id="' + id + '">' + esc(ftName(d.people.find(x => x.id === id))) + '</button>'
        )
        .join('<span>&amp;</span>') +
      '</p>' +
      (u.b
        ? '<span class="sec-l">Type</span><div class="kchips">' +
          d.kinds
            .map(
              k =>
                '<button class="kc' +
                (u.kind === k.id ? ' on' : '') +
                '" data-x="ukind" data-v="' +
                k.id +
                '" style="--c:' +
                cssCol(k.color) +
                '"><i' +
                (k.dash !== 'solid' ? ' class="' + k.dash + '"' : '') +
                '></i>' +
                esc((k.sym ? k.sym + ' ' : '') + k.name) +
                '</button>'
            )
            .join('') +
          '</div>' +
          '<label class="f">Label<input data-f="label" value="' +
          esc(u.label) +
          '" maxlength="60" placeholder="e.g. m. 1040, never made official"></label>'
        : '') +
      '<label class="f">Notes<textarea data-f="note" rows="3">' +
      esc(u.note) +
      '</textarea></label>' +
      '<h4>Children (' +
      kids.length +
      ')</h4><p class="fam">' +
      (kids.map(x => '<button data-x="selp" data-id="' + x.id + '">' + esc(ftName(x)) + '</button>').join(', ') ||
        '<span class="muted">None yet</span>') +
      '</p>' +
      '<div class="ts-row"><button class="btn sm" data-x="uaddchild">' +
      ico('plus', 14) +
      '<span>Child</span></button><button class="btn sm danger" data-x="delu">' +
      ico('trash', 14) +
      '<span>' +
      (cf === 'fu' + u.id ? 'Click again to delete' : 'Delete partnership') +
      '</span></button></div>';
  }
  box.innerHTML = h;
  box.scrollTop = keep;
  box.querySelectorAll('textarea').forEach(ag);
}
function cvBar() {
  const bar = $('#cvBar');
  if (!bar) return;
  const d = cvDoc(),
    rm = ui.view.k === 'rm';
  if (rm) {
    const cnt = {};
    d.edges.forEach(e => {
      cnt[e.kind] = (cnt[e.kind] || 0) + 1;
    });
    bar.innerHTML =
      '<span class="tl-lchips">' +
      d.kinds
        .map(
          k =>
            '<button class="lchip kchip' +
            (k.hide ? ' off' : '') +
            '" data-x="kvis" data-id="' +
            k.id +
            '" aria-pressed="' +
            !k.hide +
            '" style="--c:' +
            cssCol(k.color) +
            '" title="Show or hide this type"><i' +
            (k.dash !== 'solid' ? ' class="' + k.dash + '"' : '') +
            '></i>' +
            esc(k.name) +
            ' <span class="mono muted">' +
            (cnt[k.id] || 0) +
            '</span></button>'
        )
        .join('') +
      '</span>' +
      '<span class="tl-help">' +
      (TOUCH
        ? 'Tap a bubble, then drag its + onto someone to connect them.'
        : 'Drag bubbles to arrange them. Select one and drag its + onto another to connect. Drag the background to pan, Ctrl + scroll to zoom.') +
      '</span>';
  } else {
    bar.innerHTML =
      '<span class="tl-lchips">' +
      d.kinds
        .map(
          k =>
            '<span class="lchip kchip" style="--c:' +
            cssCol(k.color) +
            '"><i' +
            (k.dash !== 'solid' ? ' class="' + k.dash + '"' : '') +
            '></i>' +
            esc((k.sym ? k.sym + ' ' : '') + k.name) +
            '</span>'
        )
        .join('') +
      '</span>' +
      '<span class="tl-help">Click a person to add parents, partners, children or siblings. Click a symbol to edit a partnership. The tree arranges itself.</span>';
  }
  const pop = $('#cvPop');
  if (pop) {
    pop.hidden = !ui.cvPop;
    if (ui.cvPop && rm) {
      const on = new Set(d.nodes.map(n => n.ent).filter(Boolean));
      pop.innerHTML =
        TYPE_ORDER.map(t => {
          const l = Object.values(S.meta.ents)
            .filter(x => x.type === t && !on.has(x.id))
            .sort((a, b) => a.name.localeCompare(b.name));
          return l.length
            ? '<div class="pt">' +
                esc(LP(t)) +
                '</div>' +
                l
                  .map(
                    x =>
                      '<button data-x="addent" data-id="' +
                      x.id +
                      '"><i class="pip t-' +
                      t +
                      '"></i><span>' +
                      esc(x.name) +
                      '</span></button>'
                  )
                  .join('')
            : '';
        }).join('') +
        '<div class="pt">Anything else</div><button data-x="addfree">' +
        ico('plus', 14) +
        '<span>A bubble without a page: a faction, a god, a ship</span></button>' +
        (Object.values(S.meta.ents).some(x => x.type === 'char' && !on.has(x.id))
          ? '<button data-x="allchars">' +
            ico('plus', 14) +
            '<span>Every ' +
            esc(LS('char').toLowerCase()) +
            ' at once</span></button>'
          : '');
    }
  }
}
function renderCv(el, v) {
  const rm = v.k === 'rm',
    x = S.meta[v.k + 's'].find(y => y.id === v.id),
    d = S[v.k][v.id];
  if (ui.cvFor !== v.id) {
    ui.cvFor = v.id;
    ui.cvSel = null;
  }
  ui.cvPop = false;
  const chars = Object.values(S.meta.ents)
    .filter(e => e.type === 'char')
    .sort((a, b) => a.name.localeCompare(b.name));
  el.innerHTML =
    '<div class="tl-view" id="cvv"><div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico(rm ? 'web' : 'tree', 16) +
    '</span><input id="cvName" class="title-in" value="' +
    esc(x.name) +
    '" maxlength="80" aria-label="Name">' +
    '<div class="tools">' +
    (rm
      ? '<div class="mk-wrap"><button class="btn pri" data-x="addpop">' +
        ico('plus') +
        '<span>Add</span></button><div class="pop cv-pop" id="cvPop" hidden></div></div>'
      : '') +
    '<button class="ibtn" data-x="zout" aria-label="Zoom out">' +
    ico('minus') +
    '</button><button class="ibtn" data-x="zin" aria-label="Zoom in">' +
    ico('plus') +
    '</button><button class="btn" data-x="fit">' +
    ico('fit') +
    '<span>Fit</span></button>' +
    '<button class="btn" data-x="settings" aria-pressed="false">' +
    ico('sliders') +
    '<span>Customize</span></button></div></div>' +
    '<div class="tl-bar" id="cvBar"></div>' +
    '<div class="tl-body"><div class="cv-wrap" id="cvWrap"><svg id="cv" role="img" aria-label="' +
    esc(x.name) +
    '"><g id="cvRoot"></g><g id="cvTop"><line id="cvTemp" visibility="hidden"/></g></svg>' +
    '<div class="cv-empty" id="cvEmpty" hidden><div class="cv-card">' +
    (rm
      ? '<b>Map who matters to whom</b><p class="muted">Add ' +
        esc(LP('char').toLowerCase()) +
        ', places, things or free bubbles, then connect them with relationship lines you can name and style.</p><div class="ts-row"><button class="btn pri" data-x="addpop">' +
        ico('plus') +
        '<span>Add</span></button>' +
        (chars.length
          ? '<button class="btn" data-x="allchars">Add every ' + esc(LS('char').toLowerCase()) + '</button>'
          : '') +
        '</div>'
      : '<b>Start your family tree</b><p class="muted">Begin with anyone. You can add parents, partners, children and siblings from there.</p>' +
        (chars.length
          ? '<select id="ftStartSel"><option value="">Pick a ' +
            esc(LS('char').toLowerCase()) +
            '…</option>' +
            chars.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('') +
            '</select><span class="muted" style="font-size:12px">or</span>'
          : '') +
        '<input id="ftStartName" placeholder="Type a name" maxlength="60"><button class="btn pri" data-x="ftstart">Add first person</button>') +
    '</div></div></div><aside class="tl-side" id="cvSide" aria-label="Details" hidden></aside></div></div>';
  const view = $('#cvv', el),
    svg = $('#cv', el);
  $('#cvName', el).addEventListener('input', ev => {
    x.name = ev.target.value || LS(v.k);
    dirty('meta');
    renderBinder();
  });
  if (ui.focusName) {
    ui.focusName = false;
    const i = $('#cvName', el);
    i.focus();
    i.select();
  }
  view.addEventListener('click', ev => {
    const b = ev.target.closest('[data-x],[data-tl]');
    if (!b || b.tagName === 'SELECT' || (b.tagName === 'INPUT' && b.type !== 'button')) return;
    if (b.dataset.tl) {
      const kind = b.dataset.tl,
        id = b.dataset.id,
        c = b.dataset.c; // colour swatches
      const o =
        kind === 'kcol'
          ? d.kinds.find(y => y.id === id)
          : kind === 'ncol'
            ? d.nodes.find(y => y.id === id)
            : kind === 'pcol'
              ? d.people.find(y => y.id === id)
              : null;
      if (o && (c === '' ? kind !== 'kcol' : colOk(c))) {
        o.color = c;
        dirty(cvKey());
        cvRefresh();
      }
      return;
    }
    const a = b.dataset.x;
    if (a === 'zin') cvZoom(1.25);
    else if (a === 'zout') cvZoom(0.8);
    else if (a === 'fit') cvFit();
    else if (a === 'settings') cvSelect(ui.cvSel && ui.cvSel.k === 'set' ? null : 'set');
    else if (a === 'close') cvSelect(null);
    else if (a === 'openent') go({ k: 'ent', id: b.dataset.id });
    else if (a === 'seledge') cvSelect('edge', b.dataset.id);
    else if (a === 'selnode') cvSelect('node', b.dataset.id);
    else if (a === 'selp') cvSelect('person', b.dataset.id);
    else if (a === 'selu') cvSelect('union', b.dataset.id);
    else if (a === 'kdash') {
      const k = d.kinds.find(y => y.id === b.dataset.id);
      k.dash = b.dataset.v;
      dirty(cvKey());
      cvRefresh();
    } else if (a === 'addkind') {
      d.kinds.push(
        Object.assign(
          {
            id: uid(rm ? 'r_' : 'u_'),
            name: 'New type',
            color: TL_COLORS[d.kinds.length % TL_COLORS.length][0],
            dash: 'solid'
          },
          rm ? { hide: false } : { sym: '•' }
        )
      );
      dirty(cvKey());
      cvRefresh();
      const all = document.querySelectorAll('#cvSide [data-kf="name"]');
      if (all.length) {
        all[all.length - 1].focus();
        all[all.length - 1].select();
      }
    } else if (a === 'delkind') {
      const id = b.dataset.id;
      confirmDo(
        'k' + id,
        () => {
          if (d.kinds.length < 2) return;
          d.kinds = d.kinds.filter(y => y.id !== id);
          const f0 = d.kinds[0].id;
          (rm ? d.edges : d.unions).forEach(y => {
            if (y.kind === id) y.kind = f0;
          });
          if (d.def === id) d.def = '';
          dirty(cvKey());
          cvRefresh();
        },
        cvSide
      );
    } else if (a === 'dup') {
      const nid = uid(v.k + '_');
      S[v.k][nid] = JSON.parse(JSON.stringify(d));
      S.meta[v.k + 's'].push({ id: nid, name: x.name + ' (copy)' });
      dirty('meta', v.k + '_' + nid);
      go({ k: v.k, id: nid });
    } else if (a === 'deldoc') confirmDo('doc' + v.id, () => delDocItem(v.k, v.id), cvSide);
    else if (rm) rmAct(a, b);
    else ftAct(a, b);
  });
  view.addEventListener('input', ev => {
    const t = ev.target;
    if (t.tagName === 'SELECT' || t.type === 'checkbox') return;
    const s = ui.cvSel || {};
    if (t.dataset.kf) {
      const k = d.kinds.find(y => y.id === t.dataset.id);
      if (k) {
        k[t.dataset.kf] = t.value.slice(0, t.dataset.kf === 'sym' ? 2 : 40) || (t.dataset.kf === 'name' ? 'Type' : '');
        dirty(cvKey());
        cvDraw();
        cvBar();
      }
      return;
    }
    if (t.dataset.sf === 'cardW') {
      d.cardW = clamp(+t.value, 120, 260);
      dirty(cvKey());
      cvDraw();
      return;
    }
    if (t.dataset.hex) {
      t.parentNode.style.background = t.value;
      const kind = t.dataset.hex,
        o =
          kind === 'kcol'
            ? d.kinds.find(y => y.id === t.dataset.id)
            : kind === 'ncol'
              ? d.nodes.find(y => y.id === t.dataset.id)
              : kind === 'pcol'
                ? d.people.find(y => y.id === t.dataset.id)
                : null;
      if (o) {
        o.color = t.value;
        dirty(cvKey());
        cvDraw();
        cvBar();
      }
      return;
    }
    const f = t.dataset.f;
    if (!f) return;
    const o =
      s.k === 'node'
        ? d.nodes.find(y => y.id === s.id)
        : s.k === 'edge'
          ? d.edges.find(y => y.id === s.id)
          : s.k === 'person'
            ? d.people.find(y => y.id === s.id)
            : s.k === 'union'
              ? d.unions.find(y => y.id === s.id)
              : null;
    if (!o || !(f in o)) return;
    o[f] = t.value;
    dirty(cvKey());
    cvDraw();
    if (f === 'name') renderBinder();
  });
  view.addEventListener('change', ev => {
    const t = ev.target,
      s = ui.cvSel || {};
    if (t.dataset.sf && (t.tagName === 'SELECT' || t.type === 'checkbox')) {
      d[t.dataset.sf] = t.type === 'checkbox' ? t.checked : t.value;
      dirty(cvKey());
      cvRefresh();
      return;
    }
    if (t.dataset.hex) {
      cvSide();
      return;
    }
    const f = t.dataset.f;
    if (!f) return;
    if (f === 'connect' && t.value) {
      rmConnect(d, s.id, t.value);
    } else if (f === 'link' && s.k === 'person' && t.value) {
      const p = d.people.find(y => y.id === s.id);
      p.ent = t.value;
      p.name = '';
      dirty(cvKey());
      cvRefresh();
    } else if (f === 'linkpart' && s.k === 'person' && t.value) {
      ftUnion(d, s.id, t.value);
      dirty(cvKey());
      cvRefresh();
    } else if (f === 'ptype' && s.k === 'person') {
      d.people.find(y => y.id === s.id).ptype = t.value;
      dirty(cvKey());
      cvDraw();
    }
  });
  // pointer: pan the background, drag bubbles, drag a bubble's + handle to connect
  let CD = null;
  const move = ev => {
    if (!CD) return;
    const dx = ev.clientX - CD.x0,
      dy = ev.clientY - CD.y0;
    if (!CD.moved && Math.hypot(dx, dy) < 4) return;
    CD.moved = true;
    if (CD.t === 'pan') {
      d.view.x = CD.vx + dx;
      d.view.y = CD.vy + dy;
      $('#cvWrap').classList.add('panning');
      cvApply();
    } else if (CD.t === 'node') {
      const w = cvWorld(ev);
      CD.n.x = Math.round(w.x + CD.ox);
      CD.n.y = Math.round(w.y + CD.oy);
      drawRm();
    } else if (CD.t === 'link') {
      const w = cvWorld(ev),
        n = d.nodes.find(y => y.id === CD.from),
        L = $('#cvTemp');
      L.setAttribute('x1', n.x);
      L.setAttribute('y1', n.y);
      L.setAttribute('x2', w.x);
      L.setAttribute('y2', w.y);
      L.setAttribute('visibility', 'visible');
    }
  };
  const up = ev => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    const c = CD;
    CD = null;
    if (!c) return;
    $('#cvWrap').classList.remove('panning');
    if (c.t === 'pan') {
      if (c.moved) dirty(cvKey());
      else if ((ui.cvSel && ui.cvSel.k !== 'set') || ui.cvPop) cvSelect(null);
    } else if (c.t === 'node') {
      if (c.moved) {
        dirty(cvKey());
      } else cvSelect('node', c.n.id);
    } else if (c.t === 'link') {
      $('#cvTemp').setAttribute('visibility', 'hidden');
      if (!c.moved || ev.type === 'pointercancel') return;
      const w = cvWorld(ev);
      const hit = d.nodes
        .filter(y => y.id !== c.from)
        .map(y => ({ y, dd: Math.hypot(y.x - w.x, y.y - w.y) - RM_R[y.size || d.size] }))
        .sort((p, q) => p.dd - q.dd)[0];
      if (hit && hit.dd < 14) rmConnect(d, c.from, hit.y.id);
      else toast('Drop the line on another bubble to connect them.', { plain: true });
    }
  };
  svg.addEventListener('pointerdown', ev => {
    if (ev.button > 0) return;
    const h = ev.target.closest('[data-h]'),
      nd = rm && ev.target.closest('[data-node]');
    if (h && ui.cvSel && ui.cvSel.k === 'node') CD = { t: 'link', from: ui.cvSel.id, x0: ev.clientX, y0: ev.clientY };
    else if (nd) {
      const n = d.nodes.find(y => y.id === nd.dataset.node),
        w = cvWorld(ev);
      CD = { t: 'node', n, ox: n.x - w.x, oy: n.y - w.y, x0: ev.clientX, y0: ev.clientY };
    } else if (ev.target.closest('[data-edge],[data-p],[data-u]')) return;
    else CD = { t: 'pan', x0: ev.clientX, y0: ev.clientY, vx: d.view.x, vy: d.view.y };
    ev.preventDefault();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
  svg.addEventListener('click', ev => {
    const e = ev.target.closest('[data-edge]'),
      p = ev.target.closest('[data-p]'),
      u = ev.target.closest('[data-u]');
    if (e) cvSelect('edge', e.dataset.edge);
    else if (p) cvSelect('person', p.dataset.p);
    else if (u) cvSelect('union', u.dataset.u);
  });
  svg.addEventListener(
    'wheel',
    ev => {
      ev.preventDefault();
      const r = svg.getBoundingClientRect();
      if (ev.ctrlKey || ev.metaKey) cvZoom(Math.exp(-ev.deltaY * 0.0025), ev.clientX - r.left, ev.clientY - r.top);
      else {
        d.view.x -= ev.deltaX;
        d.view.y -= ev.deltaY;
        cvApply();
        clearTimeout(ui.cvw);
        ui.cvw = setTimeout(() => dirty(cvKey()), 400);
      }
    },
    { passive: false }
  );
  cvRefresh();
}
