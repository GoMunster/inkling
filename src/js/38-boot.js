/*
 * 38-boot.js: Start-up
 *
 * init() loads the project (from localStorage, the Claude artifact or the desktop), sets up every part of the screen
 * once, then draws it all (renderAll). This is the last file, so everything it uses is defined by now.
 */
// Draws everything: binder, main pane, Inkling panel, tabs and stats.
function renderAll() {
  trashPurge();
  $('#projTitle').value = S.meta.title;
  renderBinder();
  renderMain();
  renderInspector();
  updateStats();
  syncTab();
  renderSplit();
}
// Starts Inkling: loads the project, sets up the screen and its handlers, and draws everything.
function init() {
  try {
    const f = +localStorage.getItem('inkling:fs');
    if (f >= 14 && f <= 28) ui.fs = f;
  } catch (e) {}
  let local = null;
  let newer = 0;
  if (!DESK)
    try {
      const raw = localStorage.getItem('inkling:project');
      if (raw) local = normalize(JSON.parse(raw));
    } catch (e) {
      if (e.code === 'newer') newer = e.v;
    }
  S = local || normalize(sampleProject());
  linker = buildLinker();
  ui.view = startView();
  $('#tabs').innerHTML = [
    ['binder', 'Binder', 'book'],
    ['write', 'Write', 'pen'],
    ['pet', 'Inkling', 'spark']
  ]
    .map(
      t =>
        '<button role="tab" data-tab="' +
        t[0] +
        '" aria-selected="false">' +
        ico(t[2], 20) +
        '<span>' +
        t[1] +
        '</span></button>'
    )
    .join('');
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    ui.tab = b.dataset.tab;
    syncTab();
  });
  $('#goalChip').addEventListener('click', () => {
    ui.tab = 'pet';
    syncTab();
    const i = $('#insp');
    if (i) i.scrollTop = 0;
  });
  const pc = document.createElement('button');
  pc.id = 'pmChip';
  pc.className = 'chip pm-chip';
  pc.hidden = true;
  pc.setAttribute('aria-label', 'Focus timer');
  pc.innerHTML = ico('timer', 16) + '<span class="mono"></span>';
  pc.addEventListener('click', () => {
    ui.tab = 'pet';
    syncTab();
    const t = $('#pomo');
    if (t) t.scrollIntoView({ block: 'nearest' });
  });
  $('#goalChip').after(pc);
  $('#projTitle').addEventListener('input', e => {
    S.meta.title = e.target.value || 'Untitled novel';
    dirty('meta');
    if (DESK) {
      document.title = S.meta.title + ' – Inkling';
      DESK.setTitle(document.title);
    }
  });
  bindBinder();
  bindMenu();
  bindSizers();
  applySides();
  bindSplit();
  $('#main').addEventListener('click', e => {
    const b = e.target.closest('[data-a="back"]');
    if (b) goBack();
    if (e.target.closest('[data-a="fwd"]')) goFwd();
    const nv = e.target.closest('[data-nav]');
    if (nv) sceneStep(+nv.dataset.nav);
    const c = e.target.closest('.cl');
    if (c) go({ k: 'ent', id: c.dataset.ent });
  });
  $('#insp').addEventListener('click', e => {
    const c = e.target.closest('.cl');
    if (c) go({ k: 'ent', id: c.dataset.ent });
  });
  document.addEventListener('selectionchange', () => {
    const ed = $('#ed'),
      s = getSelection();
    if (!ed || !s.rangeCount) return;
    if (ed.contains(s.anchorNode) && ed.contains(s.focusNode)) {
      const t = s.toString();
      if (t.trim()) ui.sel = t;
      else if (s.isCollapsed) ui.sel = '';
      clearTimeout(ui.selT);
      ui.selT = setTimeout(paintSceneWc, 120);
      ui.edRange = s.getRangeAt(0).cloneRange();
      clearTimeout(ui.posT);
      ui.posT = setTimeout(posSaveScene, 800);
    }
  });
  document.addEventListener('click', e => {
    const path = e.composedPath(); // the menu re-renders on click, so e.target may already be detached
    if (ui.menu && !path.includes($('#menu')) && !path.includes($('#menuBtn'))) closeMenu();
    const pop = $('#mkPop');
    if (pop && !pop.hidden && !e.target.closest('.mk-wrap')) pop.hidden = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const pj = $('#pj');
      if (pj && !pj.hidden) {
        if (PJ.id) closeProjects();
      } else if (ui.menu) closeMenu();
      else if ((ui.view.k === 'rm' || ui.view.k === 'ft') && (ui.cvSel || ui.cvPop)) {
        ui.cvSel = null;
        ui.cvPop = false;
        ui.confirm = null;
        cvRefresh();
      } else if (ui.view.k === 'tl' && ui.tlSide) {
        ui.tlSide = null;
        ui.confirm = null;
        drawSide();
        drawTl();
      } else if (ui.focus) {
        ui.focus = false;
        syncTab();
        renderMain();
      }
    }
  });
  document.addEventListener('keydown', e => {
    // window shortcuts, and Find
    const mod = (e.ctrlKey || e.metaKey) && !e.altKey;
    if (!mod) return;
    if (!e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      winAct('search', 'key');
      return;
    }
    if (!e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      winAct('qs', 'key');
      return;
    }
    if (!e.shiftKey && (e.key === '\\' || e.code === 'Backslash')) {
      e.preventDefault();
      winAct('split', 'key');
      return;
    }
    if (e.shiftKey && /^Digit[123]$/.test(e.code)) {
      e.preventDefault();
      winAct({ Digit1: 'tBinder', Digit2: 'tInsp', Digit3: 'focus' }[e.code], 'key');
    } else if (e.key.toLowerCase() === 'f' && !$('#pj:not([hidden])')) {
      e.preventDefault();
      openFind();
    } else if (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') ui.keyHistAt = Date.now();
  });
  if (window.visualViewport)
    visualViewport.addEventListener('resize', () => {
      if (document.activeElement && document.activeElement.id === 'ed') followCaret();
    }); // a phone keyboard opening
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (ui.view && ui.view.k === 'tl') drawTl();
    }, 150);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && P.dirty.size) flush();
  });
  $('#main').addEventListener(
    'scroll',
    () => {
      if (ui.view && ui.view.k === 'scene') {
        clearTimeout(ui.posS);
        ui.posS = setTimeout(posSaveScene, 400);
      }
    },
    { passive: true }
  );
  document.addEventListener('mouseup', e => {
    if (e.button === 3 || e.button === 4) {
      e.preventDefault();
      winAct(e.button === 3 ? 'back' : 'fwd');
    }
  }); // mouse back and forward buttons
  document.addEventListener('keydown', e => {
    // scene to scene, back and forward
    if (e.defaultPrevented) return;
    const k = e.key;
    if ((e.altKey || e.ctrlKey || e.metaKey) && !e.shiftKey && (k === 'PageDown' || k === 'PageUp')) {
      e.preventDefault();
      winAct(k === 'PageDown' ? 'next' : 'prev', 'key');
    } else if (MODK !== '⌘' && e.altKey && !e.ctrlKey && !e.shiftKey && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      e.preventDefault();
      winAct(k === 'ArrowLeft' ? 'back' : 'fwd', 'key');
    } else if (MODK === '⌘' && e.metaKey && !e.shiftKey && (k === '[' || k === ']')) {
      e.preventDefault();
      winAct(k === '[' ? 'back' : 'fwd', 'key');
    }
  });
  window.addEventListener('pagehide', () => {
    posSaveScene();
    if (T.cur) pmRecord(false);
    if (P.dirty.size) {
      mirrorLocal();
      flush();
    }
  });
  setInterval(() => {
    if (S.meta.todo.d !== todayKey()) drawTodo();
    planSync();
    planPaint();
    if (!document.hidden && Date.now() - ui.sayAt > 40000 && !(peekNow() || {}).mood) say(line(curMood()));
  }, 15000);
  renderAll();
  checkAch(true);
  greet();
  if (newer) {
    lockNewer(newer);
    return;
  }
  if (DESK) deskBoot();
  else {
    setStatus('local');
    connectDb(!!local);
    setTimeout(() => startTour(), 700);
  }
}
init();
