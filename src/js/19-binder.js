/*
 * 19-binder.js: The binder: the left-hand pane
 *
 * renderBinder() draws the whole binder: the manuscript (chapters and scenes with word counts, targets and status),
 * then the planning sections (outlines, notes, timelines, maps, trees) and the story pages by kind, plus the
 * Customize binder options. bindBinder() handles every click, rename, drag and right-click in it, once.
 */
// The small form for renaming a binder section (plural and singular).
function relabelForm(t) {
  if (ui.relabel !== t) return '';
  return (
    '<div class="relabel"><label class="f">Section title<input id="rlP" value="' +
    esc(LP(t)) +
    '" maxlength="40" placeholder="' +
    esc(SEC_DEF[t][0]) +
    '"></label>' +
    '<label class="f">One item is called a<input id="rlS" value="' +
    esc(LS(t)) +
    '" maxlength="40" placeholder="' +
    esc(SEC_DEF[t][1]) +
    '"></label>' +
    '<div class="row"><button class="btn sm pri" data-a="rl-save">Done</button><button class="btn sm" data-a="rl-reset">Reset to ' +
    esc(SEC_DEF[t][0]) +
    '</button></div></div>'
  );
}
// Saves (or cancels) a section's new name.
function saveRelabel(ok) {
  const t = ui.relabel;
  if (!t) return;
  ui.relabel = null;
  if (!ok) {
    renderBinder();
    return;
  }
  const p = $('#rlP').value.trim().slice(0, 40),
    q = $('#rlS').value.trim().slice(0, 40);
  S.meta.labels[t] = { p: p === SEC_DEF[t][0] ? '' : p, s: q === SEC_DEF[t][1] ? '' : q };
  if (!S.meta.labels[t].p && !S.meta.labels[t].s) delete S.meta.labels[t];
  dirty('meta');
  renderAll();
}
// Redraws the binder, then marks who else is in which scene on a shared project.
function renderBinder() {
  renderBinder0();
  if (ui.others && ui.others.length) paintHere();
}
// Draws the binder: manuscript, planning sections, story pages and Customize binder.
function renderBinder0() {
  const m = S.meta,
    cur = ui.view,
    el = $('#binder'),
    cf = ui.confirm;
  let h =
    '<div class="pane-head"><h2>Binder</h2><div class="row"><button class="btn sm" data-a="cork-all">' +
    ico('card', 14) +
    '<span>Corkboard</span></button><button class="btn sm" data-a="addch">' +
    ico('plus', 14) +
    '<span>Chapter</span></button><button class="ibtn b-head-x" data-a="fold" title="' +
    (m.chapters.some(c => c.open) ? 'Collapse' : 'Expand') +
    ' all chapters" aria-label="' +
    (m.chapters.some(c => c.open) ? 'Collapse' : 'Expand') +
    ' all chapters">' +
    ico(m.chapters.some(c => c.open) ? 'up' : 'down', 14) +
    '</button></div></div>' +
    '<button class="b-search" data-a="search">' +
    ico('search', 14) +
    '<span>Search everything</span><kbd>' +
    MODK +
    ' K</kbd></button><div class="tree">';
  h += '<div class="chs">';
  m.chapters.forEach((c, ci) => {
    const words = c.scenes.reduce((a, id) => a + (m.scenes[id] ? m.scenes[id].words : 0), 0);
    h +=
      '<div class="ch-block" data-ch="' +
      c.id +
      '"><div class="ch-row"><button class="tw" data-a="toggle" data-id="' +
      c.id +
      '" aria-expanded="' +
      (c.open ? 'true' : 'false') +
      '" aria-label="Expand or collapse ' +
      esc(c.title) +
      '">' +
      ico(c.open ? 'down' : 'right', 14) +
      '</button>';
    if (ui.rename === c.id)
      h +=
        '<input class="rn" id="rn" data-id="' +
        c.id +
        '" value="' +
        esc(c.title) +
        '" maxlength="80" aria-label="Chapter name">';
    else
      h +=
        '<button class="ch-title" data-a="cork-ch" data-id="' +
        c.id +
        '" title="Open this chapter on the corkboard">' +
        esc(c.title) +
        '</button>';
    h +=
      '<span class="wc" data-cwc="' +
      c.id +
      '"' +
      (c.goal ? ' title="' + fmt(words) + ' of ' + fmt(c.goal) + ' words"' : '') +
      '>' +
      fmt(words) +
      '</span>' +
      tgBar(words, c.goal) +
      '<span class="acts"><button class="ibtn" data-a="addsc" data-id="' +
      c.id +
      '" aria-label="Add scene">' +
      ico('plus', 14) +
      '</button><button class="ibtn" data-a="ren" data-id="' +
      c.id +
      '" aria-label="Rename chapter">' +
      ico('edit', 14) +
      '</button>' +
      (ci > 0
        ? '<button class="ibtn" data-a="chup" data-id="' +
          c.id +
          '" aria-label="Move chapter up">' +
          ico('up', 14) +
          '</button>'
        : '') +
      (ci < m.chapters.length - 1
        ? '<button class="ibtn" data-a="chdn" data-id="' +
          c.id +
          '" aria-label="Move chapter down">' +
          ico('down', 14) +
          '</button>'
        : '') +
      '<button class="ibtn' +
      (cf === 'ch' + c.id ? ' on' : '') +
      '" data-a="delch" data-id="' +
      c.id +
      '" aria-label="Delete chapter">' +
      (cf === 'ch' + c.id ? 'Delete?' : ico('trash', 14)) +
      '</button></span></div>';
    if (c.open)
      c.scenes.forEach((id, si) => {
        const s = m.scenes[id];
        if (!s) return;
        const on = cur.k === 'scene' && cur.id === id;
        h +=
          '<div class="sc-row' +
          (on ? ' on' : '') +
          '" data-sid="' +
          id +
          '">' +
          (ui.rename === id
            ? '<input class="rn" id="rn" data-id="' +
              id +
              '" value="' +
              esc(s.title) +
              '" maxlength="100" aria-label="Scene name">'
            : '<button class="sc-btn" data-a="open-sc" data-id="' +
              id +
              '" title="' +
              esc(
                (S.sc[id] && S.sc[id].synopsis ? S.sc[id].synopsis + '\n' : '') +
                  fmt(s.words) +
                  (s.goal ? ' of ' + fmt(s.goal) : '') +
                  ' words · right-click for more'
              ) +
              '"><i class="dot st-' +
              s.status +
              '" title="' +
              STATUS[s.status] +
              '"></i><span class="t">' +
              esc(s.title) +
              '</span><span class="wc" data-wc="' +
              id +
              '">' +
              fmt(s.words) +
              '</span>' +
              tgBar(s.words, s.goal) +
              '</button>') +
          '<span class="acts"><button class="ibtn" data-a="split" data-k="scene" data-id="' +
          id +
          '" aria-label="Open beside the page" title="Open side by side (or Alt+click)">' +
          ico('split', 14) +
          '</button><button class="ibtn" data-a="scup" data-id="' +
          id +
          '" aria-label="Move scene up">' +
          ico('up', 14) +
          '</button><button class="ibtn" data-a="scdn" data-id="' +
          id +
          '" aria-label="Move scene down">' +
          ico('down', 14) +
          '</button><button class="ibtn' +
          (cf === 'sc' + id ? ' on' : '') +
          '" data-a="delsc" data-id="' +
          id +
          '" aria-label="Delete scene">' +
          (cf === 'sc' + id ? 'Delete?' : ico('trash', 14)) +
          '</button></span></div>';
      });
    if (c.open && !c.scenes.length) h += '<div class="empty-s">No scenes yet.</div>';
    h += '</div>';
  });
  h += '</div>';
  h += '<div class="ch-row" style="margin-top:20px"></div>';
  const secHead = (t, n, add) =>
    '<div class="bsec"><button class="lbl" data-a="sec" data-t="' +
    t +
    '" aria-expanded="' +
    (ui.openSec[t] ? 'true' : 'false') +
    '">' +
    ico(ui.openSec[t] ? 'down' : 'right', 14) +
    '<span>' +
    esc(LP(t)) +
    '</span><span class="n">' +
    n +
    '</span></button><button class="ibtn" data-a="relabel" data-t="' +
    t +
    '" aria-label="Rename this section" title="Rename this section">' +
    ico('edit', 14) +
    '</button><button class="ibtn" data-a="' +
    add +
    '" aria-label="Add ' +
    esc(LS(t).toLowerCase()) +
    '">' +
    ico('plus', 14) +
    '</button></div>' +
    relabelForm(t);
  const docRow = (k, x, icon, count) => {
    const on = cur.k === k && cur.id === x.id;
    return (
      '<div class="e-row' +
      (on ? ' on' : '') +
      '"><button class="e-btn" data-a="open-' +
      k +
      '" data-id="' +
      x.id +
      '">' +
      ico(icon, 14) +
      '<span class="t">' +
      esc(x.name) +
      '</span><span class="wc">' +
      count +
      '</span></button><span class="acts">' +
      (k === 'ol' || k === 'nt'
        ? '<button class="ibtn" data-a="split" data-k="' +
          k +
          '" data-id="' +
          x.id +
          '" aria-label="Open beside the page" title="Open side by side (or Alt+click)">' +
          ico('split', 14) +
          '</button>'
        : '') +
      '<button class="ibtn' +
      (cf === k + x.id ? ' on' : '') +
      '" data-a="del' +
      k +
      '" data-id="' +
      x.id +
      '" aria-label="Delete">' +
      (cf === k + x.id ? 'Delete?' : ico('trash', 14)) +
      '</button></span></div>'
    );
  };
  if (secOn('ol')) h += secHead('ol', m.ols.length, 'addol');
  if (secOn('ol') && ui.openSec.ol) {
    h += '<div class="doc-list" data-list="ols">';
    m.ols.forEach(x => {
      const it = S.ol[x.id].items;
      h += docRow('ol', x, 'list', it.filter(i => i.done).length + '/' + it.length);
    });
    h += '</div>';
    if (!m.ols.length) h += '<div class="empty-s">No outline yet. Press + to start one.</div>';
  }
  if (secOn('nt')) h += secHead('nt', m.nts.length, 'addnt');
  if (secOn('nt') && ui.ntAdd)
    h +=
      '<div class="nt-add"><button class="btn sm" data-a="addnt-page">' +
      ico('note', 14) +
      '<span>Notes page</span></button><button class="btn sm" data-a="addnt-map">' +
      ico('map', 14) +
      '<span>World map</span></button><button class="btn sm" data-a="addnt-board">' +
      ico('bulb', 14) +
      '<span>Brainstorm board</span></button></div>';
  if (secOn('nt') && ui.openSec.nt) {
    h += '<div class="doc-list" data-list="nts">';
    m.nts.forEach(x => {
      const d = S.nt[x.id];
      h += docRow(
        'nt',
        x,
        x.kind === 'board' ? 'bulb' : x.kind === 'map' ? 'map' : 'note',
        x.kind === 'board' ? d.ideas.length : x.kind === 'map' ? (d.pins || []).length : fmt(wc(d.text))
      );
    });
    h += '</div>';
    if (!m.nts.length) h += '<div class="empty-s">No notes yet. Press + to add a page or a board.</div>';
  }
  if (secOn('tl'))
    h +=
      '<div class="bsec"><button class="lbl" data-a="sec" data-t="tl" aria-expanded="' +
      (ui.openSec.tl ? 'true' : 'false') +
      '">' +
      ico(ui.openSec.tl ? 'down' : 'right', 14) +
      '<span>' +
      esc(LP('tl')) +
      '</span><span class="n">' +
      m.tls.length +
      '</span></button><button class="ibtn" data-a="relabel" data-t="tl" aria-label="Rename this section" title="Rename this section">' +
      ico('edit', 14) +
      '</button><button class="ibtn" data-a="addtl" aria-label="Add ' +
      esc(LS('tl').toLowerCase()) +
      '">' +
      ico('plus', 14) +
      '</button></div>' +
      relabelForm('tl');
  if (secOn('tl') && ui.openSec.tl) {
    h += '<div class="doc-list" data-list="tls">';
    m.tls.forEach(x => {
      const on = cur.k === 'tl' && cur.id === x.id,
        n = Object.keys(S.tl[x.id].cards).length;
      h +=
        '<div class="e-row' +
        (on ? ' on' : '') +
        '"><button class="e-btn" data-a="open-tl" data-id="' +
        x.id +
        '">' +
        ico('time', 14) +
        '<span class="t">' +
        esc(x.name) +
        '</span><span class="wc">' +
        n +
        '</span></button><span class="acts"><button class="ibtn" data-a="split" data-k="tl" data-id="' +
        x.id +
        '" aria-label="Open beside the page" title="Open side by side (or Alt+click)">' +
        ico('split', 14) +
        '</button><button class="ibtn' +
        (cf === 'tl' + x.id ? ' on' : '') +
        '" data-a="deltl" data-id="' +
        x.id +
        '" aria-label="Delete timeline">' +
        (cf === 'tl' + x.id ? 'Delete?' : ico('trash', 14)) +
        '</button></span></div>';
    });
    h += '</div>';
    if (!m.tls.length) h += '<div class="empty-s">No timelines yet. Press + to start one.</div>';
  }
  [
    ['rm', 'web', x => S.rm[x.id].edges.length],
    ['ft', 'tree', x => S.ft[x.id].people.length]
  ].forEach(r => {
    const k = r[0];
    if (!secOn(k)) return;
    h += secHead(k, m[k + 's'].length, 'add' + k);
    if (ui.openSec[k]) {
      h += '<div class="doc-list" data-list="' + k + 's">';
      m[k + 's'].forEach(x => {
        h += docRow(k, x, r[1], r[2](x));
      });
      h += '</div>';
      if (!m[k + 's'].length) h += '<div class="empty-s">Nothing here yet. Press + to start one.</div>';
    }
  });
  const mc = mentionCounts();
  TYPE_ORDER.forEach(t => {
    if (!secOn(t)) return;
    const list = Object.values(m.ents)
      .filter(e => e.type === t)
      .sort((a, b) => a.name.localeCompare(b.name));
    h +=
      '<div class="bsec"><button class="lbl" data-a="sec" data-t="' +
      t +
      '" aria-expanded="' +
      (ui.openSec[t] ? 'true' : 'false') +
      '">' +
      ico(ui.openSec[t] ? 'down' : 'right', 14) +
      '<span>' +
      esc(LP(t)) +
      '</span><span class="n">' +
      list.length +
      '</span></button><button class="ibtn" data-a="relabel" data-t="' +
      t +
      '" aria-label="Rename this section" title="Rename this section">' +
      ico('edit', 14) +
      '</button><button class="ibtn" data-a="adde" data-t="' +
      t +
      '" aria-label="Add ' +
      esc(LS(t).toLowerCase()) +
      '">' +
      ico('plus', 14) +
      '</button></div>' +
      relabelForm(t);
    if (ui.openSec[t]) {
      list.forEach(e => {
        const on = cur.k === 'ent' && cur.id === e.id;
        const ps = picSrc(e.id);
        h +=
          '<div class="e-row' +
          (on ? ' on' : '') +
          '"><button class="e-btn" data-a="open-e" data-id="' +
          e.id +
          '" title="' +
          esc(e.tag || LS(t) + ' page') +
          '">' +
          (ps
            ? '<img class="bav t-' + t + '" src="' + esc(ps) + '" alt="" style="' + picStyle(e.id) + '">'
            : '<i class="pip t-' + t + '"></i>') +
          '<span class="t">' +
          esc(e.name || 'Untitled') +
          '</span><span class="wc" title="Mentions in your scenes">' +
          (mc[e.id] || 0) +
          '</span></button><span class="acts"><button class="ibtn" data-a="split" data-k="ent" data-id="' +
          e.id +
          '" aria-label="Open beside the page" title="Open side by side (or Alt+click)">' +
          ico('split', 14) +
          '</button><button class="ibtn' +
          (cf === 'en' + e.id ? ' on' : '') +
          '" data-a="dele" data-id="' +
          e.id +
          '" aria-label="Delete page">' +
          (cf === 'en' + e.id ? 'Delete?' : ico('trash', 14)) +
          '</button></span></div>';
      });
      if (!list.length) h += '<div class="empty-s">None yet. Press + or select a name in your text.</div>';
    }
  });
  const nTr = Object.keys(S.tr || {}).length;
  h +=
    '<div class="bcfg-wrap"><div class="b-foot"><button class="btn sm" data-a="bcfg" aria-expanded="' +
    ui.binderCfg +
    '">' +
    ico('sliders', 14) +
    '<span>Customize binder</span></button><button class="btn sm" data-a="trash">' +
    ico('trash', 14) +
    '<span>Trash' +
    (nTr ? ' (' + nTr + ')' : '') +
    '</span></button></div>';
  if (ui.binderCfg)
    h +=
      '<div class="bcfg"><p class="fine">Choose which sections appear in your binder. Hiding a section keeps everything in it.</p>' +
      OPT_SECS.map(
        k =>
          '<label class="ck"><input type="checkbox" data-sec="' +
          k +
          '"' +
          (secOn(k) ? ' checked' : '') +
          '>' +
          esc(LP(k)) +
          '</label>'
      ).join('') +
      '<label class="ck"><input type="checkbox" checked disabled>' +
      esc(LP('char')) +
      ' <span class="muted">(always on)</span></label></div>';
  el.innerHTML = h + '</div></div>';
  dragSort(el, {
    item: '.sc-row',
    zones: '.ch-block',
    drop: (it, ref, zone) => moveSceneTo(it.dataset.sid, zone.dataset.ch, ref && ref.dataset.sid)
  });
  dragSort(el, {
    item: '.ch-block',
    handle: '.ch-row',
    zones: '.chs',
    drop: (it, ref) => {
      if (moveInList(S.meta.chapters, it.dataset.ch, ref && ref.dataset.ch)) {
        dirty('meta');
        renderBinder();
        if (ui.view.k === 'cork') renderMain();
      }
    }
  });
  dragSort(el, {
    item: '.doc-list>.e-row',
    zones: '.doc-list',
    drop: (it, ref, zone) => {
      const arr = S.meta[zone.dataset.list],
        id = $('.e-btn', it).dataset.id;
      if (it.parentElement !== zone) return;
      if (moveInList(arr, id, ref && $('.e-btn', ref).dataset.id)) {
        dirty('meta');
        renderBinder();
      }
    }
  });
  el.querySelectorAll('[data-sec]').forEach(c =>
    c.addEventListener('change', () => {
      const k = c.dataset.sec;
      S.meta.secs[k] = c.checked;
      dirty('meta');
      if (c.checked && (k === 'rm' || k === 'ft') && !S.meta[k + 's'].length) {
        ui.binderCfg = false;
        addDocItem(k);
        return;
      }
      renderBinder();
    })
  );
  el.querySelectorAll('#rlP,#rlS').forEach(i =>
    i.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveRelabel(true);
      else if (e.key === 'Escape') {
        e.stopPropagation();
        saveRelabel(false);
      }
    })
  );
  const rn = $('#rn', el);
  if (rn) {
    rn.focus();
    rn.select();
    const done = ok => {
      if (ui.rename == null) return;
      const c = S.meta.chapters.find(x => x.id === rn.dataset.id),
        sc = S.meta.scenes[rn.dataset.id];
      if (ok && c && rn.value.trim()) {
        c.title = rn.value.trim();
        dirty('meta');
      }
      if (ok && sc && rn.value.trim()) {
        sc.title = rn.value.trim().slice(0, 100);
        dirty('meta');
        const t = $('#sceneTitle');
        if (t && ui.view.id === rn.dataset.id) t.value = sc.title;
      }
      ui.rename = null;
      renderBinder();
      if (ui.view.k === 'scene' || ui.view.k === 'cork') renderMain();
    };
    rn.addEventListener('keydown', e => {
      if (e.key === 'Enter') done(true);
      else if (e.key === 'Escape') done(false);
    });
    rn.addEventListener('blur', () => done(true));
  }
}
// Handles everything in the binder (clicks, renames, drags, right-clicks), set up once.
function bindBinder() {
  $('#binder').addEventListener('contextmenu', binderMenu);
  $('#binder').addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a,
      id = b.dataset.id,
      rr = renderBinder;
    const opens = { 'open-sc': 'scene', 'open-e': 'ent', 'open-nt': 'nt', 'open-ol': 'ol', 'open-tl': 'tl' };
    if (e.altKey && opens[a]) {
      splitOpen({ k: opens[a], id });
      return;
    } // Alt+click: open beside the page
    if (a === 'split') {
      splitOpen({ k: b.dataset.k, id });
      return;
    }
    if (a === 'search') {
      go({ k: 'search' });
      return;
    }
    if (a === 'trash') {
      go({ k: 'trash' });
      return;
    }
    if (a === 'fold') {
      const open = !S.meta.chapters.some(c => c.open);
      S.meta.chapters.forEach(c => {
        c.open = open;
      });
      dirty('meta');
      renderBinder();
      return;
    }
    if (a === 'cork-all') {
      ui.cork = 'all';
      go({ k: 'cork' });
    } else if (a === 'cork-ch') {
      ui.cork = id;
      go({ k: 'cork' });
    } else if (a === 'addch') addChapter();
    else if (a === 'toggle') {
      const c = S.meta.chapters.find(x => x.id === id);
      c.open = !c.open;
      dirty('meta');
      renderBinder();
    } else if (a === 'open-sc') go({ k: 'scene', id });
    else if (a === 'addsc') addScene(id, true);
    else if (a === 'ren') {
      ui.rename = id;
      renderBinder();
    } else if (a === 'chup') moveChapter(id, -1);
    else if (a === 'chdn') moveChapter(id, 1);
    else if (a === 'scup') moveScene(id, -1);
    else if (a === 'scdn') moveScene(id, 1);
    else if (a === 'delch') confirmDo('ch' + id, () => delChapter(id), rr);
    else if (a === 'delsc') confirmDo('sc' + id, () => delScene(id), rr);
    else if (a === 'dele') confirmDo('en' + id, () => delEntity(id), rr);
    else if (a === 'sec') {
      ui.openSec[b.dataset.t] = !ui.openSec[b.dataset.t];
      renderBinder();
    } else if (a === 'adde') {
      const t = b.dataset.t;
      ui.openSec[t] = true;
      const nid = addEntity(t, 'New ' + LS(t).toLowerCase());
      ui.focusName = true;
      go({ k: 'ent', id: nid });
    } else if (a === 'open-e') go({ k: 'ent', id });
    else if (a === 'open-tl') go({ k: 'tl', id });
    else if (a === 'open-ol') go({ k: 'ol', id });
    else if (a === 'open-nt') go({ k: 'nt', id });
    else if (a === 'addol') addDocItem('ol');
    else if (a === 'addnt') {
      ui.ntAdd = !ui.ntAdd;
      ui.openSec.nt = true;
      renderBinder();
    } else if (a === 'addnt-page' || a === 'addnt-board' || a === 'addnt-map') {
      ui.ntAdd = false;
      addDocItem('nt', a.slice(6));
    } else if (a === 'bcfg') {
      ui.binderCfg = !ui.binderCfg;
      renderBinder();
    } else if (a === 'open-rm' || a === 'open-ft') go({ k: a.slice(5), id });
    else if (a === 'addrm' || a === 'addft') addDocItem(a.slice(3));
    else if (a === 'delol' || a === 'delnt' || a === 'delrm' || a === 'delft') {
      const k = a.slice(3);
      confirmDo(k + id, () => delDocItem(k, id), rr);
    } else if (a === 'relabel') {
      ui.relabel = ui.relabel === b.dataset.t ? null : b.dataset.t;
      renderBinder();
      const i = $('#rlP');
      if (i) {
        i.focus();
        i.select();
      }
    } else if (a === 'rl-save') saveRelabel(true);
    else if (a === 'rl-reset') {
      delete S.meta.labels[ui.relabel];
      dirty('meta');
      ui.relabel = null;
      renderAll();
    } else if (a === 'addtl') addTimeline();
    else if (a === 'deltl') confirmDo('tl' + id, () => delTimeline(id), rr);
  });
}
