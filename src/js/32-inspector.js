/*
 * 32-inspector.js: The Inkling panel (right-hand pane)
 *
 * renderInspector() builds the panel from its sections, in the writer's order (Project settings): Inky and the room,
 * the focus timer, today's goal, the to-do list, the manuscript totals, and for an open scene its synopsis, details,
 * target and notes.
 */
// Builds the Inkling panel and wires up its sections.
function renderInspector() {
  applyLayout();
  const m = S.meta,
    p = m.pet,
    st = petStage(),
    nx = STAGES[st + 1],
    md = curMood(),
    v = ui.view;
  ui.mood = md;
  ui.stage = st;
  const sec = {}; // the panel's sections, shown in the writer's order (Project settings)
  sec.pet =
    '<section class="pet-card m-' +
    md +
    '"><div class="pet-stage"><div class="room" id="petRoom" aria-hidden="true"></div><div class="pals" id="petPals"></div>' +
    '<button class="pet-btn" id="petBtn" aria-label="Cheer with ' +
    esc(p.name) +
    '"><span id="petArt"></span></button>' +
    '<button class="btn sm den-btn" id="denBtn" aria-pressed="' +
    (v.k === 'den') +
    '">' +
    (v.k === 'den' ? ico('back', 13) + '<span>Close room</span>' : ico('spark', 13) + '<span>Room</span>') +
    (ui.newThings && v.k !== 'den' ? '<i class="dot-new" aria-label="new things"></i>' : '') +
    '</button></div>' +
    '<div class="bubble" id="bubble">' +
    esc(ui.say || line(md)) +
    '</div>' +
    '<div class="pet-meta"><input class="pet-name" id="petName" maxlength="18" value="' +
    esc(p.name) +
    '" aria-label="Pet name"><span class="stage-tag" id="stageTag">' +
    STAGES[st].n +
    '</span></div>' +
    '<div class="evo">' +
    (nx
      ? '<div class="bar"><i id="evoBar" style="width:' +
        Math.max(0, Math.min(100, ((p.total - stageAt(st)) / Math.max(1, stageAt(st + 1) - stageAt(st))) * 100)) +
        '%"></i></div>'
      : '') +
    '<small id="evoTxt"></small></div></section>';
  sec.timer = pomoHtml();
  sec.today =
    '<section class="psec"><h3>Today</h3><div class="big"><b class="mono" id="goalNum">0</b><span>of <span class="mono" id="goalOf">0</span> new words</span></div><div class="bar lg"><i id="goalBar" style="width:0"></i></div>' +
    '<div class="chips"><span class="chip2" id="streakChip"></span></div>' +
    '<button class="plan-line" id="planLine"></button>' +
    '<div class="two"><label class="f">Daily goal<input id="goalIn" type="number" inputmode="numeric" min="50" max="20000" step="50" value="' +
    m.goal +
    '"' +
    (m.plan.on && m.plan.auto ? ' disabled title="Set by your deadline plan"' : '') +
    '></label><label class="f">Novel length goal<input id="tgtIn" type="number" inputmode="numeric" min="1000" max="1000000" step="1000" value="' +
    m.target +
    '"></label></div>' +
    '<p class="fine">Only new words count. Pasted blocks over 600 words are treated as imports.</p></section>';
  sec.todo =
    '<section class="psec todo" id="todo"><h3><span>To do today</span><span class="td-n" id="tdN"></span></h3><div id="tdBox"></div></section>';
  sec.ms =
    '<section class="psec"><h3>Manuscript</h3><div class="big"><b class="mono" id="totNum" style="font-size:26px">0</b><span>of <span class="mono" id="totOf">0</span> words</span></div><div class="bar proj"><i id="totBar" style="width:0"></i></div>' +
    '<p class="fine">' +
    m.chapters.length +
    ' chapter' +
    (m.chapters.length === 1 ? '' : 's') +
    ', ' +
    Object.keys(m.scenes).length +
    ' scenes, ' +
    Object.keys(m.ents).length +
    ' story pages.</p>' +
    (n =>
      '<button class="btn sm ct-chip' +
      (n ? ' warn' : '') +
      '" id="contBtn">' +
      ico('search', 13) +
      '<span>' +
      (n ? n + ' continuity thing' + (n === 1 ? '' : 's') + ' to check' : 'Continuity check') +
      '</span></button>')(contCount()) +
    ' <button class="btn sm" id="storyBtn">' +
    ico('chart', 13) +
    '<span>Story insights</span></button></section>';
  if (v.k === 'scene' && m.scenes[v.id]) {
    const d = S.sc[v.id];
    sec.scene =
      '<section class="psec"><h3>This scene</h3><label class="sec-l" for="synIn" style="margin-top:0">Synopsis</label><textarea class="ta" id="synIn" rows="3" placeholder="One or two lines on what happens.">' +
      esc(d.synopsis) +
      '</textarea>' +
      sceneDetailsHtml(v.id) +
      '<label class="sec-l" for="scGoal">Word target</label><div class="sc-goal"><input id="scGoal" type="number" min="0" step="100" placeholder="None" value="' +
      (m.scenes[v.id].goal || '') +
      '"></div>' +
      '<label class="sec-l" for="noteIn">Notes</label><textarea class="ta" id="noteIn" rows="3" placeholder="Reminders, research, loose ends.">' +
      esc(d.notes) +
      '</textarea>' +
      '<span class="sec-l">Linked in this scene</span><div class="chiplinks" id="sceneChips"></div></section>';
  }
  const h =
    m.layout.order
      .filter(k => sec[k] && !loHidden(k))
      .map(k => sec[k])
      .join('') ||
    '<p class="fine lo-empty">Everything in this panel is hidden. <button class="lnk" data-a="layout">Project settings</button></p>';
  const el = $('#insp');
  el.innerHTML = h;
  paintPet(true);
  updateStats();
  updateSceneChips();
  bindPomo();
  pmPaint();
  drawTodo();
  bindTodo();
  if (v.k === 'scene' && m.scenes[v.id]) bindSceneDetails(v.id);
  const on = (q, ev, f) => {
    const x = $(q, el);
    if (x) x.addEventListener(ev, f);
  };
  on('#petBtn', 'click', () => {
    bump();
    say(line(curMood()));
  });
  on('#contBtn', 'click', () => go({ k: 'cont' }));
  on('#storyBtn', 'click', () => go({ k: 'story' }));
  on('#denBtn', 'click', () => {
    ui.newThings = 0;
    if (ui.view.k === 'den') goBack();
    else go({ k: 'den' });
  });
  on('[data-a="layout"]', 'click', () => go({ k: 'layout' }));
  on('#planLine', 'click', () => go({ k: 'plan' }));
  paintPals();
  on('#petName', 'input', e => {
    p.name = e.target.value.trim() || 'Inky';
    dirty('meta');
  });
  on('#goalIn', 'change', e => {
    m.goal = Math.max(50, Math.min(20000, Math.round(+e.target.value || 500)));
    e.target.value = m.goal;
    dirty('meta');
    updateStats();
    drawTodo();
  });
  on('#tgtIn', 'change', e => {
    m.target = Math.max(1000, Math.min(1000000, Math.round(+e.target.value || 80000)));
    e.target.value = m.target;
    const was = p.rank || 0,
      now = stageOf(p.total);
    if (now > was) {
      p.rank = now;
      cheer(p.name + ' grew into a ' + STAGES[now].n + '!', true);
    }
    dirty('meta');
    updateStats();
    checkAch();
  });
  on('#scGoal', 'change', e => {
    const n = Math.round(+e.target.value || 0),
      sc = m.scenes[v.id];
    if (n > 0) sc.goal = Math.min(1000000, n);
    else delete sc.goal;
    dirty('meta');
    renderBinder();
    paintSceneWc();
  });
  on('#synIn', 'input', e => {
    S.sc[v.id].synopsis = e.target.value;
    dirty('sc_' + v.id);
  });
  on('#noteIn', 'input', e => {
    S.sc[v.id].notes = e.target.value;
    dirty('sc_' + v.id);
  });
}
