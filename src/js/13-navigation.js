/* ---------- header / stats ---------- */
function updateStats() {
  planSync();
  planPaint();
  const m = S.meta,
    g = Math.max(1, m.goal),
    w = todayWords(),
    p = Math.min(1, w / g);
  $('#ringArc').style.strokeDasharray = (p * RING).toFixed(1) + ' ' + RING;
  $('#chipTxt').textContent = fmt(w) + ' / ' + fmt(m.goal);
  const set = (id, v) => {
    const e = $(id);
    if (e) e.textContent = v;
  };
  set('#goalNum', fmt(w));
  set('#goalOf', fmt(m.goal));
  const gb = $('#goalBar');
  if (gb) gb.style.width = p * 100 + '%';
  const tot = totalWords();
  set('#totNum', fmt(tot));
  set('#totOf', fmt(m.target));
  const tb = $('#totBar');
  if (tb) tb.style.width = Math.min(100, (tot / Math.max(1, m.target)) * 100) + '%';
  const s = streak(),
    sc = $('#streakChip');
  if (sc) {
    sc.textContent = s > 0 ? s + '-day streak' : 'No streak yet';
    sc.classList.toggle('hot', s > 0);
  }
  const st = petStage(),
    nx = STAGES[st + 1];
  set(
    '#evoTxt',
    nx
      ? fmt(Math.max(0, stageAt(st + 1) - m.pet.total)) +
          ' words until ' +
          m.pet.name +
          ' becomes a ' +
          nx.n +
          ' (' +
          Math.round(STAGE_FR[st + 1] * 100) +
          '% of your ' +
          fmt(m.target) +
          '-word goal)'
      : m.pet.name + ' is a Laureate: you reached your novel length goal!'
  );
  const eb = $('#evoBar');
  if (eb && nx)
    eb.style.width =
      Math.max(0, Math.min(100, ((m.pet.total - stageAt(st)) / Math.max(1, stageAt(st + 1) - stageAt(st))) * 100)) +
      '%';
  set('#stageTag', STAGES[st].n);
  const md = curMood();
  if (md !== ui.mood || st !== ui.stage) {
    ui.mood = md;
    ui.stage = st;
    paintPet();
    if (Date.now() - ui.sayAt > 4500 && !(peekNow() || {}).mood) say(line(md));
  }
}

/* ---------- navigation ---------- */
function go(v, o) {
  o = o || {};
  if (!viewValid(v)) v = firstView();
  const moving = ui.view && !(ui.view.k === v.k && ui.view.id === v.id);
  if (moving && ui.view.k === 'scene') posSaveScene();
  if (moving && o.push !== false) {
    ui.hist.push(ui.view);
    if (ui.hist.length > 40) ui.hist.shift();
    if (!o.fwd) ui.fwd = [];
  }
  if (POS_KINDS.includes(v.k))
    posPut(p => {
      p.last = { k: v.k, id: v.id };
    });
  ui.view = v;
  ui.tab = 'write';
  ui.rename = null;
  ui.pop = false;
  if (v.k !== 'scene') ui.pkOpen = null;
  raStop();
  renderBinder();
  renderMain();
  renderInspector();
  syncTab();
  hereSoon();
  if (v.flash) {
    const el = document.querySelector('#ed .ent[data-ent="' + v.flash + '"]');
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 2000);
    }
    v.flash = null;
  }
}
function goBack() {
  let v = ui.hist.pop();
  while (v && !viewValid(v)) v = ui.hist.pop();
  if (v && ui.view) {
    ui.fwd = ui.fwd || [];
    ui.fwd.push(ui.view);
    if (ui.fwd.length > 40) ui.fwd.shift();
  }
  if (v) go(v, { push: false });
  else go(firstView(), { push: false });
}
function syncTab() {
  $('#app').dataset.tab = ui.tab;
  $('#app').classList.toggle('focus', ui.focus);
  applyCols();
  const t = $('#tabs');
  if (t)
    t.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-selected', b.dataset.tab === ui.tab ? 'true' : 'false')
    );
}
const backBtn = () => {
  const f = (ui.fwd || [])[(ui.fwd || []).length - 1],
    fw =
      f && viewValid(f)
        ? '<button class="ibtn" data-a="fwd" title="Forward to ' +
          esc(viewName(f)) +
          '" aria-label="Forward to ' +
          esc(viewName(f)) +
          '">' +
          ico('right') +
          '</button>'
        : '';
  if (!ui.hist.length) return fw;
  const v = ui.hist[ui.hist.length - 1];
  if (!viewValid(v)) return fw;
  return (
    '<button class="btn" data-a="back" aria-label="Go back to ' +
    esc(viewName(v)) +
    '">' +
    ico('back') +
    '<span>' +
    esc(viewName(v)) +
    '</span></button>' +
    fw
  );
};
