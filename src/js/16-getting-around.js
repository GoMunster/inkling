/*
 * 16-getting-around.js: Getting around: side by side, remembering your place, the quick switcher
 *
 * Side by side: a second pane beside the page (#split) for a story page, a note, an outline, a timeline or another
 * scene. Remembering your place: the last view, and each scene's caret and scroll position, are kept per device in
 * localStorage and restored when you come back. The quick switcher (Ctrl+P) finds anything by a few letters of its
 * name. Also next and previous scene, and Forward.
 */
// A second pane beside the page (#split), so a scene can be written with a story page, a note, an outline, a
// timeline or another scene in view. ui.split is that view. Scenes, outlines and timelines show read-only there (⇄
// swaps the two sides to edit); a story page's fields and a notes page can be edited in place. The grid's columns
// come from applyCols(), which accounts for focus mode, hidden panels and the split.
const SPLIT_KINDS = ['scene', 'ent', 'nt', 'ol', 'tl'];
// Whether a view can be shown side by side.
const splitOk = v => !!v && SPLIT_KINDS.includes(v.k) && viewValid(v);
// Sets the page's columns (--cols on #app) for the panes that are shown: binder, page, side by side, Inkling panel.
function applyCols() {
  const app = $('#app');
  if (!app || !S) return;
  const sp = app.classList.contains('splitting'),
    f = ui.focus;
  app.style.setProperty(
    '--cols',
    [
      !f && !loHidden('binder') ? 'var(--bw,272px)' : '',
      'minmax(0,1fr)',
      sp ? 'minmax(0,1fr)' : '',
      !f && !loHidden('insp') ? 'var(--iw,308px)' : ''
    ]
      .filter(Boolean)
      .join(' ')
  );
}
// Opens a view side by side (or a picker of things to open). Not on narrow screens.
function splitOpen(v) {
  if (innerWidth < 1080) {
    toast('Side by side needs a wider window.', { plain: true });
    return;
  }
  if (!v) {
    const cur = ui.view,
      d = cur.k === 'scene' && S.sc[cur.id],
      links = d ? findLinks(plainText(d.text)) : []; // a good first guess: a page named in this scene
    v = splitOk(ui.lastSplit)
      ? ui.lastSplit
      : links.length
        ? { k: 'ent', id: links[0].id }
        : S.meta.nts[0]
          ? { k: 'nt', id: S.meta.nts[0].id }
          : firstView();
  }
  if (!splitOk(v)) return;
  ui.split = ui.lastSplit = v;
  renderSplit();
}
// Closes the side-by-side pane.
function splitClose() {
  ui.split = null;
  renderSplit();
}
// Swaps the main page and the side-by-side pane.
function splitSwap() {
  const a = ui.view,
    b = ui.split;
  if (!splitOk(b)) return;
  ui.split = splitOk(a) ? a : null;
  go(b);
  renderSplit();
}
// The list of things that can be opened side by side.
function splitPicker(cur) {
  const m = S.meta,
    o = (v, label) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>',
    grp = (l, h) => (h ? '<optgroup label="' + esc(l) + '">' + h + '</optgroup>' : '');
  return (
    grp(
      'Scenes',
      m.chapters
        .map(c =>
          c.scenes
            .filter(id => m.scenes[id])
            .map(id => o('scene:' + id, c.title + ' · ' + m.scenes[id].title))
            .join('')
        )
        .join('')
    ) +
    TYPE_ORDER.map(t =>
      grp(
        LP(t),
        Object.values(m.ents)
          .filter(e => e.type === t)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(e => o('ent:' + e.id, e.name))
          .join('')
      )
    ).join('') +
    grp(LP('nt'), m.nts.map(x => o('nt:' + x.id, x.name)).join('')) +
    grp(LP('ol'), m.ols.map(x => o('ol:' + x.id, x.name)).join('')) +
    grp(LP('tl'), m.tls.map(x => o('tl:' + x.id, x.name)).join(''))
  );
}
// Draws the side-by-side pane for its view.
function renderSplit() {
  const el = $('#split'),
    app = $('#app');
  if (!el) return;
  if (ui.split && !splitOk(ui.split)) ui.split = null;
  const v = ui.split;
  app.classList.toggle('splitting', !!v);
  el.hidden = !v;
  applyCols();
  paintSplitBtn();
  if (!v) {
    el.innerHTML = '';
    return;
  }
  const m = S.meta;
  let body = '';
  if (v.k === 'scene') {
    const sc = m.scenes[v.id],
      d = S.sc[v.id],
      ch = m.chapters.find(c => c.scenes.includes(v.id));
    body =
      '<h2 class="sp-h">' +
      esc(sc.title) +
      '</h2><p class="muted sp-sub">' +
      esc((ch ? ch.title + ' · ' : '') + fmt(sc.words) + ' words · read only') +
      '</p>' +
      (d.synopsis ? '<p class="sp-syn">' + esc(d.synopsis) + '</p>' : '') +
      '<div class="sp-text editor">' +
      renderText(d.text) +
      '</div>';
  } else if (v.k === 'ent') {
    const e = m.ents[v.id],
      b = S.en[v.id] || { fields: {} },
      T = TYPES[e.type] || TYPES.thing,
      ps = picSrc(e.id);
    body =
      (ps ? '<img class="sp-pic" src="' + esc(ps) + '" alt="" style="' + picStyle(e.id) + '">' : '') +
      '<span class="badge t-' +
      e.type +
      '"><i class="pip"></i>' +
      esc(LS(e.type)) +
      '</span><h2 class="sp-h">' +
      esc(e.name) +
      '</h2>' +
      ((e.aliases || []).length ? '<p class="muted sp-sub">Also called ' + esc(e.aliases.join(', ')) + '</p>' : '') +
      (e.tag ? '<p class="sp-syn">' + esc(e.tag) + '</p>' : '') +
      entFields(e.type)
        .concat([['facts', 'Key facts']])
        .map(
          f =>
            '<label class="f">' +
            esc(f[1]) +
            '<textarea data-spf="' +
            f[0] +
            '" rows="2">' +
            esc((b.fields || {})[f[0]] || '') +
            '</textarea></label>'
        )
        .join('');
  } else if (v.k === 'nt') {
    const x = m.nts.find(y => y.id === v.id),
      d = S.nt[v.id];
    body =
      '<h2 class="sp-h">' +
      esc(x.name) +
      '</h2>' +
      (x.kind === 'map'
        ? (picSrc(x.id) ? '<img class="sp-pic" src="' + esc(picSrc(x.id)) + '" alt="">' : '') +
          '<div class="sp-ideas">' +
          ((d.pins || [])
            .map(
              pn =>
                '<div class="sp-idea"><b>' +
                esc(mpName(pn)) +
                '</b>' +
                (pn.note ? '<br>' + esc(pn.note) : '') +
                '</div>'
            )
            .join('') || '<p class="muted">No pins yet.</p>') +
          '</div>'
        : x.kind === 'board'
          ? '<div class="sp-ideas">' +
            (d.ideas.map(i => '<div class="sp-idea">' + esc(i.text || '…') + '</div>').join('') ||
              '<p class="muted">No ideas yet.</p>') +
            '</div>'
          : '<textarea class="sp-note" data-spn="1" placeholder="Notes…">' + esc(d.text) + '</textarea>');
  } else if (v.k === 'ol') {
    const x = m.ols.find(y => y.id === v.id),
      d = S.ol[v.id];
    body =
      '<h2 class="sp-h">' +
      esc(x.name) +
      '</h2><p class="muted sp-sub">Read only</p><ul class="sp-ol">' +
      d.items
        .filter(i => i.text || i.note)
        .map(
          i =>
            '<li style="--d:' +
            i.depth +
            '" class="' +
            (i.done ? 'done' : '') +
            '"><span>' +
            esc(i.text || '') +
            '</span>' +
            (i.note ? '<small>' + esc(i.note) + '</small>' : '') +
            '</li>'
        )
        .join('') +
      '</ul>';
  } else if (v.k === 'tl') {
    const x = m.tls.find(y => y.id === v.id),
      t = S.tl[v.id],
      lanes = {};
    t.lanes.forEach(l => {
      lanes[l.id] = l;
    });
    const cards = Object.values(t.cards).sort((a, b) => a.at - b.at);
    body =
      '<h2 class="sp-h">' +
      esc(x.name) +
      '</h2><p class="muted sp-sub">' +
      cards.length +
      ' cards in time order · read only</p><div class="sp-tl">' +
      cards
        .map(
          c =>
            '<div class="sp-card" style="--c:' +
            cssCol(c.color || (lanes[c.lane] || {}).color || 'accent') +
            '"><small>' +
            esc([(lanes[c.lane] || {}).name, c.when].filter(Boolean).join(' · ')) +
            '</small><b>' +
            esc(c.title || 'Untitled card') +
            '</b>' +
            (c.body ? '<span>' + esc(c.body) + '</span>' : '') +
            '</div>'
        )
        .join('') +
      '</div>';
  }
  el.innerHTML =
    '<div class="sp-head"><select id="spPick" aria-label="Show beside the page">' +
    splitPicker(v.k + ':' + v.id) +
    '</select>' +
    '<button class="ibtn" data-sp="swap" title="Swap sides (edit this one)" aria-label="Swap sides">' +
    ico('swap', 15) +
    '</button><button class="ibtn" data-sp="close" title="Close side by side (' +
    MODK +
    '+\\)" aria-label="Close side by side">' +
    ico('x', 15) +
    '</button></div><div class="sp-body">' +
    body +
    '</div>';
  el.querySelectorAll('textarea').forEach(ag);
}
// Shows whether side by side is open on the button above a scene.
function paintSplitBtn() {
  const b = $('#spBtn');
  if (b) {
    b.setAttribute('aria-pressed', ui.split ? 'true' : 'false');
    b.classList.toggle('on', !!ui.split);
  }
}
// Makes the side-by-side pane's buttons and editable fields work.
function bindSplit() {
  const el = $('#split');
  el.addEventListener('change', e => {
    if (e.target.id !== 'spPick') return;
    const [k, id] = e.target.value.split(':');
    ui.split = ui.lastSplit = { k, id };
    renderSplit();
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-sp]'),
      en = e.target.closest('.ent[data-ent]');
    if (b) {
      if (b.dataset.sp === 'close') splitClose();
      else splitSwap();
    } else if (en) {
      ui.split = ui.lastSplit = { k: 'ent', id: en.dataset.ent };
      renderSplit();
    }
  });
  el.addEventListener('input', e => {
    const v = ui.split,
      x = e.target;
    if (!v) return;
    if (x.dataset.spf) {
      const b = S.en[v.id];
      b.fields = b.fields || {};
      b.fields[x.dataset.spf] = x.value;
      dirty('en_' + v.id);
      if (x.dataset.spf === 'facts') {
        ui.cont = null;
      }
      ag(x);
    } else if (x.dataset.spn) {
      S.nt[v.id].text = x.value;
      dirty('nt_' + v.id);
      ag(x);
    }
    if (ui.view.k === v.k && ui.view.id === v.id) ui.splitStale = true;
  });
  el.addEventListener('focusout', () => {
    if (ui.splitStale) {
      ui.splitStale = false;
      setTimeout(() => {
        if (!el.contains(document.activeElement)) renderMain();
      }, 0);
    }
  });
}
// Something changed elsewhere: redraw the split pane if it shows that thing (and is not being typed in).
function splitTouch(keys) {
  const v = ui.split;
  if (!v) return;
  const mine = v.k === 'scene' ? 'sc_' + v.id : v.k + '_' + v.id;
  if (!keys.includes(mine)) return;
  clearTimeout(ui.spT);
  ui.spT = setTimeout(() => {
    const el = $('#split');
    if (el && !el.contains(document.activeElement)) renderSplit();
  }, 500);
}

/* ---------- remember where I was ---------- */
// Per device and project (localStorage inkling:pos:<project>): the last view opened, and for each scene the caret
// (visible-text offset) and how far down the page was scrolled. renderMain() puts a scene back as it was left.
const posKey = () => 'inkling:pos:' + (DESK ? PJ.id || 'none' : P.db ? 'claude' : 'local');
// Reads the saved positions: the last view and each scene's caret and scroll.
function posGet() {
  try {
    const o = JSON.parse(localStorage.getItem(posKey()) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    return {};
  }
}
// Saves part of the positions.
function posPut(f) {
  try {
    const o = posGet();
    f(o);
    o.sc = o.sc || {};
    const ks = Object.keys(o.sc);
    if (ks.length > 400) ks.slice(0, ks.length - 400).forEach(k => delete o.sc[k]);
    localStorage.setItem(posKey(), JSON.stringify(o));
  } catch (e) {}
}
// The kinds of view worth reopening when the project opens again.
const POS_KINDS = ['scene', 'ent', 'tl', 'ol', 'nt', 'rm', 'ft', 'cork'];
// The view to open with: the last one used, if it still exists.
function startView() {
  const v = posGet().last;
  return v && POS_KINDS.includes(v.k) && viewValid(v) ? { k: v.k, id: v.id } : firstView();
}
// Saves the open scene's caret and scroll position.
function posSaveScene() {
  const v = ui.view,
    ed = $('#ed'),
    main = $('#main');
  if (!v || v.k !== 'scene' || !ed || !main) return;
  const r = ui.edRange,
    c = r && ed.contains(r.endContainer) ? visAt(ed, r.endContainer, r.endOffset) : null; // the caret as last seen in the editor
  posPut(o => {
    o.sc = o.sc || {};
    const p = o.sc[v.id] || {};
    p.y = Math.round(main.scrollTop);
    if (c != null) p.c = c;
    delete o.sc[v.id];
    o.sc[v.id] = p;
  });
}
// Puts the caret and scroll back where they were in a scene.
function posRestore(id) {
  const p = (posGet().sc || {})[id],
    ed = $('#ed'),
    main = $('#main');
  if (!p || !ed || !main) return;
  if (!ui.selDone && p.c != null && innerWidth >= 1080) {
    try {
      ed.focus({ preventScroll: true });
      setCaret(ed, p.c);
    } catch (e) {}
  }
  if (!ui.selDone && p.y != null) main.scrollTop = p.y;
}

/* ---------- quick switcher, scene to scene, back and forward ---------- */
// Ctrl+P: type a few letters of any scene, chapter, page, note, outline, timeline, map or tree (or a screen such as
// the Trash) and press Enter; Alt+Enter opens it side by side. With nothing typed it lists where you have just been.
function qsItems() {
  const m = S.meta,
    out = [],
    add = (v, label, sub, ico2) => out.push({ v, label: String(label || 'Untitled'), sub, ico: ico2 });
  m.chapters.forEach(c => {
    add({ k: 'cork', ch: c.id }, c.title, 'Chapter', 'book');
    c.scenes.forEach(id => {
      const s = m.scenes[id];
      if (s) add({ k: 'scene', id }, s.title, c.title, 'pen');
    });
  });
  Object.values(m.ents).forEach(e => add({ k: 'ent', id: e.id }, e.name, LS(e.type), 'note'));
  [
    ['nt', 'note'],
    ['ol', 'list'],
    ['tl', 'time'],
    ['rm', 'web'],
    ['ft', 'tree']
  ].forEach(([k, i]) =>
    m[k + 's'].forEach(x =>
      add(
        { k, id: x.id },
        x.name,
        k === 'nt' && x.kind === 'board' ? 'Brainstorm' : k === 'nt' && x.kind === 'map' ? 'World map' : LS(k),
        k === 'nt' && x.kind === 'map' ? 'map' : i
      )
    )
  );
  [
    [{ k: 'cork' }, 'Corkboard', 'card'],
    [{ k: 'search' }, 'Search everything', 'search'],
    [{ k: 'ss' }, 'Writing sessions', 'timer'],
    [{ k: 'plan' }, 'Deadline planner', 'cal'],
    [{ k: 'cont' }, 'Continuity check', 'search'],
    [{ k: 'story' }, 'Story insights', 'chart'],
    [{ k: 'world' }, 'Calendars & money', 'cal'],
    [{ k: 'series' }, 'Series bible', 'book'],
    [{ k: 'book' }, 'Book details', 'book'],
    [{ k: 'trash' }, 'Trash', 'trash'],
    [{ k: 'layout' }, 'Project settings', 'layout'],
    [{ k: 'prefs' }, 'Settings', 'sliders']
  ].forEach(([v, l, i]) => add(v, l, 'Screen', i));
  return out;
}
function qsScore(q, s) {
  // letters in order; a start of a word or a run of letters scores more
  q = q.toLowerCase();
  s = s.toLowerCase();
  if (!q) return 1;
  const at = s.indexOf(q);
  if (at >= 0) return 100 - Math.min(40, at) + (at === 0 || /\W/.test(s[at - 1]) ? 30 : 0);
  let i = 0,
    sc = 0,
    run = 0;
  for (let j = 0; j < s.length && i < q.length; j++) {
    if (s[j] === q[i]) {
      i++;
      run++;
      sc += run * 2 + (j === 0 || /\W/.test(s[j - 1]) ? 6 : 0);
    } else run = 0;
  }
  return i === q.length ? sc : 0;
}
// Opens a quick-switcher result (side by side with Alt+Enter).
function qsOpen(o, side) {
  closeQs();
  const v = o.v;
  if (side && SPLIT_KINDS.includes(v.k)) {
    splitOpen({ k: v.k, id: v.id });
    return;
  }
  if (v.k === 'cork') {
    ui.cork = v.ch || 'all';
    go({ k: 'cork' });
    return;
  }
  go(v);
}
// Closes the quick switcher.
function closeQs() {
  const x = $('#qs');
  if (x) x.remove();
}
// Opens the quick switcher (Ctrl+P): type a few letters, use the arrow keys and Enter.
function openQs() {
  closeQs();
  const all = qsItems(),
    seen = new Set(),
    recent = [];
  ui.hist
    .slice()
    .reverse()
    .concat([ui.view])
    .reverse()
    .forEach(v => {
      const k = v.k + ':' + (v.id || '');
      if (seen.has(k)) return;
      seen.add(k);
      const it = all.find(x => x.v.k === v.k && x.v.id === v.id && !x.v.ch);
      if (it) recent.push(it);
    });
  const ov = document.createElement('div');
  ov.className = 'pj-ov qs-ov';
  ov.id = 'qs';
  ov.innerHTML =
    '<div class="qs" role="dialog" aria-label="Go to"><input id="qsQ" placeholder="Go to a scene, page, note, timeline…" autocomplete="off" aria-label="Go to"><div class="qs-list" id="qsList" role="listbox"></div>' +
    '<p class="qs-tip">↑↓ to choose · Enter to open · Alt+Enter side by side · Esc to close</p></div>';
  document.body.appendChild(ov);
  let list = [],
    sel = 0;
  const draw = () => {
    const q = $('#qsQ').value.trim();
    list = q
      ? all
          .map(x => ({ x, s: Math.max(qsScore(q, x.label), qsScore(q, x.label + ' ' + x.sub) * 0.6) }))
          .filter(r => r.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, 40)
          .map(r => r.x)
      : recent.concat(all.filter(x => !recent.includes(x))).slice(0, 40);
    sel = Math.min(sel, Math.max(0, list.length - 1));
    $('#qsList').innerHTML = list.length
      ? list
          .map(
            (x, i) =>
              '<button class="qs-it' +
              (i === sel ? ' on' : '') +
              '" data-i="' +
              i +
              '" role="option" aria-selected="' +
              (i === sel) +
              '">' +
              ico(x.ico, 15) +
              '<b>' +
              esc(x.label) +
              '</b><span class="muted">' +
              esc(x.sub || '') +
              '</span>' +
              (!q && i < recent.length ? '<small>recent</small>' : '') +
              '</button>'
          )
          .join('')
      : '<p class="muted qs-none">Nothing called that.</p>';
    const on = $('#qsList .on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  };
  const q = $('#qsQ');
  q.focus();
  draw();
  q.addEventListener('input', () => {
    sel = 0;
    draw();
  });
  let alt = false; // Alt held (tracked here too: not every system reports it on the Enter key)
  q.addEventListener('keyup', e => {
    if (e.key === 'Alt') alt = false;
  });
  q.addEventListener('blur', () => {
    alt = false;
  });
  q.addEventListener('keydown', e => {
    if (e.key === 'Alt') {
      alt = true;
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % Math.max(1, list.length);
      draw();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (list[sel]) qsOpen(list[sel], e.altKey || alt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeQs();
    }
  });
  ov.addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (b) qsOpen(list[+b.dataset.i], e.altKey);
    else if (e.target === ov) closeQs();
  });
}
// Opens the next (d = 1) or previous (d = -1) scene in book order.
function sceneStep(d) {
  const all = orderedScenes();
  if (!all.length) return;
  const v = ui.view;
  const i = v.k === 'scene' ? all.findIndex(x => x.id === v.id) : -1,
    j = i < 0 ? (d > 0 ? 0 : all.length - 1) : i + d;
  if (j < 0 || j >= all.length) {
    toast(d > 0 ? 'That was the last scene.' : 'This is the first scene.', { plain: true });
    return;
  }
  go({ k: 'scene', id: all[j].id });
}
// Forward to the view Back left.
function goFwd() {
  let v = (ui.fwd || []).pop();
  while (v && !viewValid(v)) v = ui.fwd.pop();
  if (v) go(v, { fwd: true });
}
