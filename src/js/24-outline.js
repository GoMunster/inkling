/*
 * 24-outline.js: Outlines
 *
 * An outline is one flat list of lines, each with a depth (up to OL_MAX); a line's children are the lines after it
 * with a greater depth. Indenting, outdenting, moving and deleting always carry a line's whole block. Lines can be
 * numbered, ticked off, given notes and linked to scenes.
 *
 * Templates (OL_TPL: three acts, the Hero's Journey, Save the Cat and more) fill an outline with story beats.
 * Switching template keeps what the writer typed: their notes and lines move with the matching beat.
 */
const OL_MAX = 5;
// Ways an outline can be numbered.
const OL_NUMS = [
  ['decimal', '1.2.3'],
  ['classic', 'I. A. 1. a.'],
  ['bullets', 'Bullets'],
  ['none', 'None']
];
// Outline templates: each a list of [beat, hint, depth].
const OL_TPL = {
  three: [
    'Three-act structure',
    [
      [0, 'Act I · Setup'],
      [1, 'Hook / opening image', 'Who is the protagonist and what is their normal world?'],
      [1, 'Inciting incident', 'The event that disrupts normal life.'],
      [1, 'First plot point', 'The protagonist commits and the story turns.'],
      [0, 'Act II · Confrontation'],
      [1, 'Rising action', 'Obstacles, allies and enemies.'],
      [1, 'Midpoint', 'A reversal or revelation that raises the stakes.'],
      [1, 'Crisis', 'Things fall apart; the lowest point.'],
      [0, 'Act III · Resolution'],
      [1, 'Climax', 'The final confrontation.'],
      [1, 'Resolution', 'The new normal.']
    ]
  ],
  cat: [
    'Save the Cat (15 beats)',
    [
      [0, 'Act One'],
      [1, 'Opening image', "~1%: a snapshot of the hero's world before."],
      [1, 'Theme stated', '~5%: someone hints at the lesson.'],
      [1, 'Set-up', '1–10%: the hero, their flaws and what is missing.'],
      [1, 'Catalyst', '~10%: the life-changing event.'],
      [1, 'Debate', '10–20%: should they go?'],
      [0, 'Act Two'],
      [1, 'Break into Two', '~20%: the hero chooses the new world.'],
      [1, 'B story', '~22%: a relationship that carries the theme.'],
      [1, 'Fun and games', '20–50%: the promise of the premise.'],
      [1, 'Midpoint', '~50%: false victory or false defeat.'],
      [1, 'Bad guys close in', '50–75%: pressure from outside and within.'],
      [1, 'All is lost', '~75%: the opposite of the midpoint.'],
      [1, 'Dark night of the soul', '75–80%: the hero wallows, then realises.'],
      [0, 'Act Three'],
      [1, 'Break into Three', '~80%: the solution is found.'],
      [1, 'Finale', '80–99%: the hero proves they have changed.'],
      [1, 'Final image', '~100%: the mirror of the opening image.']
    ]
  ],
  hero: [
    "Hero's Journey",
    [
      [0, 'Departure'],
      [1, 'Ordinary world'],
      [1, 'Call to adventure'],
      [1, 'Refusal of the call'],
      [1, 'Meeting the mentor'],
      [1, 'Crossing the threshold'],
      [0, 'Initiation'],
      [1, 'Tests, allies, enemies'],
      [1, 'Approach to the inmost cave'],
      [1, 'The ordeal'],
      [1, 'Reward'],
      [0, 'Return'],
      [1, 'The road back'],
      [1, 'Resurrection'],
      [1, 'Return with the elixir']
    ]
  ],
  seven: [
    'Seven-point structure',
    [
      [0, 'Hook', 'Start opposite to the resolution.'],
      [0, 'Plot turn 1', 'The call that sets the story moving.'],
      [0, 'Pinch point 1', 'Pressure from the antagonist.'],
      [0, 'Midpoint', 'The hero moves from reacting to acting.'],
      [0, 'Pinch point 2', 'Things look hopeless.'],
      [0, 'Plot turn 2', 'The final piece the hero needs.'],
      [0, 'Resolution', 'The climax and the change.']
    ]
  ],
  romance: [
    'Romance beats',
    [
      [0, 'Setup'],
      [1, 'Introduce the first lead'],
      [1, 'Introduce the second lead'],
      [1, 'Meet cute'],
      [1, 'No way #1', 'Why they cannot be together.'],
      [0, 'Falling in love'],
      [1, 'Adhesion', 'What forces them together.'],
      [1, 'No way #2'],
      [1, 'Inkling of desire'],
      [1, 'Deepening desire'],
      [1, 'Maybe this could work'],
      [1, 'Midpoint of love', 'A first kiss, a confession, a night together.'],
      [0, 'Retreat'],
      [1, 'Inkling of doubt'],
      [1, 'Deepening doubt'],
      [1, 'Retreat'],
      [1, 'Shields up'],
      [1, 'Break up'],
      [0, 'Fighting for love'],
      [1, 'Dark night of the soul'],
      [1, 'Wake up'],
      [1, 'Grand gesture'],
      [1, 'Whole-hearted'],
      [1, 'Happily ever after']
    ]
  ]
};
// Where each template line falls in a story (% of the way through), in the same order as OL_TPL's rows.
// Switching templates uses it to move what the writer wrote to the beat at the same point in the story.
const OL_POS = {
  three: [0, 1, 10, 20, 25, 35, 50, 75, 80, 88, 99],
  cat: [0, 1, 5, 7, 10, 15, 20, 20, 23, 35, 50, 62, 75, 78, 80, 81, 88, 99],
  hero: [0, 1, 10, 14, 17, 20, 25, 35, 45, 50, 60, 75, 75, 88, 99],
  seven: [1, 20, 35, 50, 62, 81, 99],
  romance: [0, 1, 5, 10, 15, 20, 20, 25, 30, 37, 43, 50, 55, 55, 62, 68, 72, 75, 78, 78, 82, 88, 94, 99]
};
// The outline that is open.
const curOl = () => S.ol[ui.view.id];
// A new outline line.
const olItem = (text, depth, o) =>
  Object.assign(
    {
      id: uid('i_'),
      text: text || '',
      note: '',
      depth: depth || 0,
      done: false,
      open: true,
      noteOpen: false,
      scene: ''
    },
    o || {}
  );
// Choosing a template replaces the lines a template wrote and keeps what the writer typed. A template line
// remembers its original wording in `tpl` (older outlines are recognised by matching a known beat name).
// Notes written on a template line move to the new template's matching beat (same name, else the same relative
// place in the story); renamed template lines and the writer's own lines follow that beat as lines under it.
const olKey = s =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
// Switches an outline to another template, keeping everything the writer added or changed.
function olApplyTemplate(old, key) {
  const beats = new Map();
  Object.values(OL_TPL).forEach(t =>
    t[1].forEach(r => {
      if (!beats.has(r[1])) beats.set(r[1], r[2] || '');
    })
  );
  Object.keys(OL_TPL).forEach(k =>
    OL_TPL[k][1].forEach((r, i) => {
      const b = beats.get(r[1]);
      if (b && typeof b === 'string') beats.set(r[1], { n: b, p: OL_POS[k][i] });
      else if (!b || b.p == null) beats.set(r[1], { n: r[2] || '', p: OL_POS[k][i] });
    })
  );
  const fresh = OL_TPL[key][1].map((r, i) =>
    olItem(r[1], r[0], { note: r[2] || '', tpl: { t: r[1], n: r[2] || '', p: OL_POS[key][i] } })
  );
  const isT = x => !!x.tpl || beats.has(x.text),
    tplOf = x => {
      const b = beats.get((x.tpl || {}).t || x.text) || {};
      return { t: x.tpl ? x.tpl.t : x.text, n: x.tpl ? x.tpl.n : b.n, p: x.tpl && x.tpl.p != null ? x.tpl.p : b.p };
    };
  const oldT = old.filter(isT),
    oldLeaves = oldT.filter(x => x.depth > 0),
    oldTops = oldT.filter(x => x.depth === 0);
  const leaves = fresh.filter(x => x.depth > 0),
    tops = fresh.filter(x => x.depth === 0),
    pos = (a, x) => (a.length > 1 ? a.indexOf(x) / (a.length - 1) : 0);
  const hits = new Map();
  const target = x => {
    if (hits.has(x)) return hits.get(x);
    let hit = fresh.find(y => olKey(y.text) === olKey(tplOf(x).t));
    if (!hit) {
      const group = x.depth === 0 && oldLeaves.length && tops.length,
        to = group ? tops : leaves.length ? leaves : fresh,
        tp = tplOf(x);
      if (tp.p != null) hit = to.reduce((b, y) => (Math.abs(y.tpl.p - tp.p) < Math.abs(b.tpl.p - tp.p) ? y : b), to[0]);
      else {
        const from = x.depth > 0 ? oldLeaves : oldLeaves.length ? oldTops : oldT,
          f = pos(from, x);
        hit = to.reduce((b, y) => (Math.abs(pos(to, y) - f) < Math.abs(pos(to, b) - f) ? y : b), to[0]);
      }
    }
    hits.set(x, hit);
    return hit;
  };
  const head = [],
    under = new Map(),
    notes = new Map();
  let anchor = null,
    kept = 0;
  const put = (beat, x) => {
    if (!under.has(beat)) under.set(beat, []);
    under.get(beat).push(x);
  };
  old.forEach(x => {
    if (isT(x)) {
      anchor = x;
      const t = tplOf(x),
        beat = target(x),
        title = x.text !== t.t ? x.text.trim() : '',
        note = x.note && x.note !== t.n ? x.note.trim() : '';
      if (note) {
        const m = note.match(/^From “(.+?)”: ([\s\S]*)$/),
          from = m ? m[1] : t.t,
          body = m ? m[2] : note; // keep where it was first written
        notes.set(
          beat,
          (notes.get(beat) || []).concat(olKey(from) === olKey(beat.text) ? body : 'From “' + from + '”: ' + body)
        );
        kept++;
      }
      if (title) {
        const y = Object.assign({}, x, { text: title, note: '' });
        delete y.tpl;
        put(beat, y);
        kept++;
      } else {
        if (x.done) beat.done = true;
        if (x.scene && !beat.scene) beat.scene = x.scene;
      }
      return;
    }
    if (!x.text.trim() && !x.note.trim()) return; // empty lines go
    kept++;
    if (anchor) put(target(anchor), Object.assign({}, x));
    else head.push(Object.assign({}, x));
  });
  const out = head.slice();
  fresh.forEach(b => {
    if (notes.has(b)) b.note = notes.get(b).join('\n\n');
    out.push(b);
    const xs = under.get(b) || [],
      base = Math.min(...xs.map(y => y.depth));
    xs.forEach(y => {
      y.depth = Math.min(OL_MAX, b.depth + 1 + y.depth - base);
      out.push(y);
    });
  });
  let prev = -1;
  out.forEach(y => {
    y.depth = Math.max(0, Math.min(y.depth, prev + 1));
    prev = y.depth;
  });
  return { items: out, kept };
}
// The index just past a line's block (the line and all its children).
const olEnd = (it, i) => {
  let j = i + 1;
  while (j < it.length && it[j].depth > it[i].depth) j++;
  return j;
}; // end of item i's block
// Whether a line has children.
const olHasKids = (it, i) => i + 1 < it.length && it[i + 1].depth > it[i].depth;
// The lines to show: children of folded lines are hidden.
function olVisible(it) {
  const out = [];
  let hide = 99;
  it.forEach((x, i) => {
    if (x.depth > hide) return;
    hide = 99;
    out.push(i);
    if (!x.open && olHasKids(it, i)) hide = x.depth;
  });
  return out;
}
// A number in Roman numerals, for outline numbering.
const ROMAN = n => {
  let r = '',
    v = [
      [1000, 'm'],
      [900, 'cm'],
      [500, 'd'],
      [400, 'cd'],
      [100, 'c'],
      [90, 'xc'],
      [50, 'l'],
      [40, 'xl'],
      [10, 'x'],
      [9, 'ix'],
      [5, 'v'],
      [4, 'iv'],
      [1, 'i']
    ];
  v.forEach(p => {
    while (n >= p[0]) {
      r += p[1];
      n -= p[0];
    }
  });
  return r;
};
// Each line's number (1.2.3, I.A.1 and so on) in the chosen style.
function olNumbers(o) {
  const c = [],
    out = [];
  o.items.forEach(x => {
    c.length = x.depth + 1;
    c[x.depth] = (c[x.depth] || 0) + 1;
    if (o.num === 'decimal') out.push(c.join('.'));
    else if (o.num === 'classic') {
      const n = c[x.depth],
        d = x.depth % 5;
      out.push(
        (d === 0
          ? ROMAN(n).toUpperCase()
          : d === 1
            ? String.fromCharCode(64 + ((n - 1) % 26) + 1)
            : d === 2
              ? String(n)
              : d === 3
                ? String.fromCharCode(96 + ((n - 1) % 26) + 1)
                : ROMAN(n)) + '.'
      );
    } else out.push(o.num === 'bullets' ? '•' : '');
  });
  return out;
}
// Draws the outline screen: toolbar, templates and the list.
function renderOl(el, v) {
  const x = S.meta.ols.find(y => y.id === v.id),
    o = S.ol[v.id];
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('list', 16) +
    '</span><input id="olName" class="title-in" value="' +
    esc(x.name) +
    '" maxlength="80" aria-label="Outline name">' +
    '<span class="mono muted" id="olProg"></span>' +
    '<div class="tools"><button class="btn pri" data-o="add">' +
    ico('plus') +
    '<span>Item</span></button>' +
    '<select id="olTpl" aria-label="Use a structure template"><option value="">Use a template…</option>' +
    Object.keys(OL_TPL)
      .map(k => '<option value="' + k + '">' + OL_TPL[k][0] + '</option>')
      .join('') +
    '</select>' +
    '<button class="btn" data-o="frommss" title="Add every chapter and scene to this outline">' +
    ico('book') +
    '<span>From manuscript</span></button>' +
    '<button class="btn danger" data-o="delall">' +
    ico('trash') +
    '<span>Delete outline</span></button></div></div>' +
    '<div class="ol-bar"><label class="muted">Numbering <select id="olNum">' +
    OL_NUMS.map(
      n => '<option value="' + n[0] + '"' + (o.num === n[0] ? ' selected' : '') + '>' + n[1] + '</option>'
    ).join('') +
    '</select></label>' +
    '<label class="ck"><input type="checkbox" id="olNotes"' +
    (o.showNotes ? ' checked' : '') +
    '>Show notes</label>' +
    '<button class="btn sm" data-o="undo" id="olUndo" hidden>Undo template switch</button><button class="btn sm" data-o="expand">Expand all</button><button class="btn sm" data-o="collapse">Collapse all</button>' +
    '<span class="tl-help">Enter adds a line, Tab and Shift+Tab indent, Alt+↑↓ moves a line with everything under it.</span></div>' +
    '<div class="sheet ol-sheet"><div id="olList" class="ol-list"></div></div>';
  const nm = $('#olName', el);
  nm.addEventListener('input', () => {
    x.name = nm.value || 'Outline';
    dirty('meta');
    renderBinder();
  });
  $('#olNum', el).addEventListener('change', ev => {
    o.num = ev.target.value;
    dirty('ol_' + v.id);
    drawOl();
  });
  $('#olNotes', el).addEventListener('change', ev => {
    o.showNotes = ev.target.checked;
    dirty('ol_' + v.id);
    drawOl();
  });
  $('#olTpl', el).addEventListener('change', ev => {
    const key = ev.target.value,
      t = OL_TPL[key];
    ev.target.value = '';
    if (!t) return;
    const before = JSON.parse(JSON.stringify(o.items)),
      r = olApplyTemplate(o.items, key);
    o.items = r.items;
    ui.olUndo = { id: v.id, items: before, name: t[0] };
    dirty('ol_' + v.id);
    drawOl();
    renderBinder();
    olUndoBtn();
    toast(
      r.kept
        ? 'Switched to ' +
            t[0] +
            '. Kept everything you wrote (' +
            r.kept +
            ' note' +
            (r.kept === 1 ? '' : 's') +
            ' and lines).'
        : 'Switched to ' + t[0] + '. Rename, delete or rearrange anything.',
      { plain: true }
    );
  });
  const list = $('#olList', el);
  el.onclick = ev => {
    const b = ev.target.closest('[data-o]');
    if (!b || b.tagName === 'INPUT' || b.tagName === 'TEXTAREA' || b.tagName === 'SELECT') return;
    const a = b.dataset.o,
      row = b.closest('[data-i]'),
      it = o.items,
      i = row ? it.findIndex(y => y.id === row.dataset.i) : -1;
    if (a === 'add') {
      it.push(olItem('', 0));
      dirty('ol_' + v.id);
      drawOl(it[it.length - 1].id);
      renderBinder();
    } else if (a === 'delall')
      confirmDo(
        'olall' + v.id,
        () => delDocItem('ol', v.id),
        () => {
          const db = $('[data-o="delall"] span', el);
          if (db)
            db.textContent = ui.confirm === 'olall' + v.id ? 'Click again to delete this outline' : 'Delete outline';
        }
      );
    else if (a === 'undo') {
      if (ui.olUndo && ui.olUndo.id === v.id) {
        o.items = ui.olUndo.items;
        ui.olUndo = null;
        dirty('ol_' + v.id);
        drawOl();
        renderBinder();
        olUndoBtn();
        toast('Your outline is back the way it was.', { plain: true });
      }
    } else if (a === 'expand' || a === 'collapse') {
      it.forEach(y => {
        y.open = a === 'expand';
      });
      dirty('ol_' + v.id);
      drawOl();
    } else if (a === 'frommss') {
      if (it.length === 1 && !it[0].text && !it[0].note) it.length = 0;
      S.meta.chapters.forEach(c => {
        it.push(olItem(c.title, 0));
        c.scenes.forEach(id => it.push(olItem(S.meta.scenes[id].title, 1, { scene: id, note: S.sc[id].synopsis })));
      });
      dirty('ol_' + v.id);
      drawOl();
      renderBinder();
      toast('Added your chapters and scenes. Scene lines link back to the scene.', { plain: true });
    } else if (i < 0) return;
    else if (a === 'tog') {
      it[i].open = !it[i].open;
      dirty('ol_' + v.id);
      drawOl();
    } else if (a === 'note') {
      it[i].noteOpen = !it[i].noteOpen;
      dirty('ol_' + v.id);
      drawOl();
      const t = $('[data-i="' + it[i].id + '"] + .ol-note textarea', list);
      if (t && it[i].noteOpen) t.focus();
    } else if (a === 'opensc') go({ k: 'scene', id: it[i].scene });
    else if (a === 'del') {
      if (olHasKids(it, i)) {
        ui.confirm = ui.confirm === 'ol' + it[i].id ? null : 'ol' + it[i].id;
        drawOl();
      } else
        confirmDo(
          'ol' + it[i].id,
          () => olDelete(i),
          () => drawOl()
        );
    } else if (a === 'delsec') {
      ui.confirm = null;
      olDelete(i, true);
    } else if (a === 'delone') {
      ui.confirm = null;
      olDelete(i);
    } else if (a === 'delno') {
      ui.confirm = null;
      drawOl();
    } else olOp(a, i);
  };
  list.addEventListener('input', ev => {
    const t = ev.target,
      row = t.closest('[data-i]');
    if (!row) return;
    const y = o.items.find(z => z.id === row.dataset.i);
    if (!y) return;
    if (t.dataset.o === 'text') y.text = t.value;
    else if (t.dataset.o === 'notetx') {
      y.note = t.value;
      ag(t);
    } else return;
    dirty('ol_' + v.id);
  });
  list.addEventListener('change', ev => {
    const t = ev.target,
      row = t.closest('[data-i]');
    if (!row) return;
    const y = o.items.find(z => z.id === row.dataset.i);
    if (!y) return;
    if (t.dataset.o === 'done') {
      y.done = t.checked;
      dirty('ol_' + v.id);
      drawOl();
      renderBinder();
    } else if (t.dataset.o === 'scene') {
      y.scene = t.value;
      dirty('ol_' + v.id);
      drawOl();
    }
  });
  list.addEventListener('keydown', ev => {
    const t = ev.target;
    if (t.dataset.o !== 'text') return;
    const it = o.items,
      i = it.findIndex(z => z.id === t.closest('[data-i]').dataset.i);
    if (i < 0) return;
    const vis = olVisible(it),
      vi = vis.indexOf(i);
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const kid = olHasKids(it, i) && it[i].open,
        n = olItem('', kid ? it[i].depth + 1 : it[i].depth);
      it.splice(kid ? i + 1 : olEnd(it, i), 0, n);
      dirty('ol_' + v.id);
      drawOl(n.id);
      renderBinder();
    } else if (ev.key === 'Tab') {
      ev.preventDefault();
      olOp(ev.shiftKey ? 'out' : 'in', i, true);
    } else if (ev.altKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
      ev.preventDefault();
      olOp(ev.key === 'ArrowUp' ? 'up' : 'dn', i, true);
    } else if (ev.key === 'ArrowUp' && vi > 0) {
      ev.preventDefault();
      olFocus(it[vis[vi - 1]].id);
    } else if (ev.key === 'ArrowDown' && vi < vis.length - 1) {
      ev.preventDefault();
      olFocus(it[vis[vi + 1]].id);
    } else if (ev.key === 'Backspace' && !t.value && it.length > 1 && !olHasKids(it, i)) {
      ev.preventDefault();
      const prev = vi > 0 ? it[vis[vi - 1]].id : null;
      olDelete(i);
      if (prev) olFocus(prev, true);
    }
  });
  if (ui.olUndo && ui.olUndo.id !== v.id) ui.olUndo = null;
  drawOl();
  olUndoBtn();
  dragSort($('#olList', el), {
    item: '.ol-row',
    handle: '.ol-grip',
    scroll: () => $('#main'),
    drop: (it, ref) => olDrop(it.dataset.i, ref && ref.dataset.i)
  });
  if (ui.focusName) {
    ui.focusName = false;
    nm.focus();
    nm.select();
  }
}
// Shows or hides the outline's one-step Undo button.
function olUndoBtn() {
  const b = $('#olUndo');
  if (b) b.hidden = !(ui.olUndo && ui.olUndo.id === ui.view.id);
}
// Puts the caret in an outline line.
function olFocus(id, end) {
  const i = $('#olList [data-i="' + id + '"] .ol-tx');
  if (i) {
    i.focus();
    const n = end ? i.value.length : i.selectionStart;
    try {
      i.setSelectionRange(n, n);
    } catch (e) {}
  }
}
// Deletes a line (with its block if all), with one step of undo.
function olDelete(i, all) {
  const o = curOl(),
    it = o.items,
    e = olEnd(it, i);
  if (all) it.splice(i, e - i);
  else {
    for (let j = i + 1; j < e; j++) it[j].depth--;
    it.splice(i, 1);
  }
  if (!it.length) it.push(olItem('', 0));
  dirty('ol_' + ui.view.id);
  drawOl();
  renderBinder();
}
// Outline actions from keys and buttons: add, indent, outdent, move, fold, tick.
function olOp(a, i, keep) {
  const o = curOl(),
    it = o.items,
    x = it[i],
    e = olEnd(it, i);
  let ok = true;
  if (a === 'in') {
    if (i === 0 || x.depth >= it[i - 1].depth + 1 || x.depth >= OL_MAX) ok = false;
    else for (let j = i; j < e; j++) it[j].depth = Math.min(OL_MAX, it[j].depth + 1);
  } else if (a === 'out') {
    if (x.depth === 0) ok = false;
    else for (let j = i; j < e; j++) it[j].depth--;
  } else if (a === 'up') {
    let p = i - 1;
    while (p >= 0 && it[p].depth > x.depth) p--;
    if (p < 0 || it[p].depth < x.depth) ok = false;
    else {
      const blk = it.splice(i, e - i);
      it.splice(p, 0, ...blk);
    }
  } else if (a === 'dn') {
    if (e >= it.length || it[e].depth < x.depth) ok = false;
    else {
      const e2 = olEnd(it, e),
        sib = it.splice(e, e2 - e);
      it.splice(i, 0, ...sib);
    }
  } else ok = false;
  if (!ok) return;
  dirty('ol_' + ui.view.id);
  drawOl(keep ? x.id : null);
}
// Moves a line and everything under it before another line, at that line's depth.
function olDrop(id, beforeId) {
  // move a line and everything under it before another line, at that line's depth
  const o = curOl(),
    it = o.items,
    i = it.findIndex(x => x.id === id);
  if (i < 0) return;
  const e = olEnd(it, i);
  if (beforeId && it.slice(i, e).some(x => x.id === beforeId)) return;
  const blk = it.splice(i, e - i);
  let j = beforeId ? it.findIndex(x => x.id === beforeId) : it.length;
  if (j < 0) j = it.length;
  const want = beforeId ? it[j].depth : 0,
    prev = j > 0 ? it[j - 1].depth : -1,
    d = Math.min(want, prev + 1) - blk[0].depth;
  blk.forEach(x => {
    x.depth = Math.max(0, Math.min(OL_MAX, x.depth + d));
  });
  it.splice(j, 0, ...blk);
  dirty('ol_' + ui.view.id);
  drawOl();
}
// Redraws the outline's lines (keeps the toolbar), optionally focusing one.
function drawOl(focusId) {
  const list = $('#olList'),
    o = curOl();
  if (!list || !o) return;
  const it = o.items,
    nums = olNumbers(o),
    vis = olVisible(it),
    done = it.filter(y => y.done).length,
    cf = ui.confirm;
  const scOpts = sel =>
    '<option value="">No linked scene</option>' +
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
                (sel === id ? ' selected' : '') +
                '>' +
                esc(S.meta.scenes[id].title) +
                '</option>'
            )
            .join('') +
          '</optgroup>'
      )
      .join('');
  list.innerHTML = vis
    .map(i => {
      const y = it[i],
        kids = olHasKids(it, i),
        showN = y.noteOpen || (o.showNotes && y.note),
        sc = y.scene && S.meta.scenes[y.scene];
      return (
        '<div class="ol-row' +
        (y.done ? ' done' : '') +
        (y.depth === 0 ? ' lvl0' : '') +
        '" data-i="' +
        y.id +
        '" style="--d:' +
        y.depth +
        '"><span class="ol-grip" title="Drag to move (with everything under it)" aria-hidden="true">' +
        ico('dots', 14) +
        '</span>' +
        (kids
          ? '<button class="ol-tw" data-o="tog" aria-expanded="' +
            y.open +
            '" aria-label="Show or hide what is under this line">' +
            ico(y.open ? 'down' : 'right', 14) +
            '</button>'
          : '<span class="ol-tw"></span>') +
        (o.num === 'none' ? '' : '<span class="ol-num">' + nums[i] + '</span>') +
        '<input type="checkbox" data-o="done"' +
        (y.done ? ' checked' : '') +
        ' aria-label="Done">' +
        '<input class="ol-tx" data-o="text" value="' +
        esc(y.text) +
        '" placeholder="A beat, a plot point, a question…" aria-label="Outline line">' +
        (sc
          ? '<button class="ol-sc" data-o="opensc" title="Open scene">' +
            ico('pen', 12) +
            '<span>' +
            esc(sc.title) +
            '</span></button>'
          : '') +
        '<span class="ol-acts"><button class="ibtn' +
        (y.note || y.noteOpen ? ' has' : '') +
        '" data-o="note" aria-label="Notes and linked scene" title="Notes and linked scene">' +
        ico('note', 14) +
        '</button>' +
        '<button class="ibtn" data-o="out" aria-label="Outdent" title="Outdent (Shift+Tab)">' +
        ico('outdent', 14) +
        '</button><button class="ibtn" data-o="in" aria-label="Indent" title="Indent (Tab)">' +
        ico('indent', 14) +
        '</button>' +
        '<button class="ibtn" data-o="up" aria-label="Move up" title="Move up (Alt+↑)">' +
        ico('up', 14) +
        '</button><button class="ibtn" data-o="dn" aria-label="Move down" title="Move down (Alt+↓)">' +
        ico('down', 14) +
        '</button>' +
        '<button class="ibtn' +
        (cf === 'ol' + y.id ? ' on' : '') +
        '" data-o="del" aria-label="' +
        (kids ? 'Delete this section' : 'Delete line') +
        '">' +
        (cf === 'ol' + y.id && !kids ? 'Delete?' : ico('trash', 14)) +
        '</button></span></div>' +
        (cf === 'ol' + y.id && kids
          ? (n =>
              '<div class="ol-del" data-i="' +
              y.id +
              '" style="--d:' +
              y.depth +
              '"><span>Delete “' +
              esc(trunc(y.text || 'this line', 40)) +
              '”?</span><button class="btn sm danger" data-o="delsec">' +
              ico('trash', 14) +
              '<span>Delete it and the ' +
              n +
              ' line' +
              (n === 1 ? '' : 's') +
              ' under it</span></button><button class="btn sm" data-o="delone">Only this line</button><button class="btn sm" data-o="delno">Cancel</button></div>')(
              olEnd(it, i) - i - 1
            )
          : '') +
        (showN
          ? '<div class="ol-note" data-i="' +
            y.id +
            '" style="--d:' +
            y.depth +
            '"><textarea data-o="notetx" rows="2" placeholder="Notes for this line">' +
            esc(y.note) +
            '</textarea>' +
            (y.noteOpen ? '<select data-o="scene" aria-label="Linked scene">' + scOpts(y.scene) + '</select>' : '') +
            '</div>'
          : '')
      );
    })
    .join('');
  list.querySelectorAll('.ol-note textarea').forEach(ag);
  const pg = $('#olProg');
  if (pg) pg.textContent = done + ' of ' + it.length + ' done';
  if (focusId) olFocus(focusId);
}
