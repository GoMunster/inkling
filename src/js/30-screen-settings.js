/* ---------- your screen: what shows (Window › Project settings) ---------- */
// meta.layout = {hide:{key:true}, order:[Inkling panel sections]}. Personal and per project: it follows the writer on
// a shared project. Projects without one start from this device's default (LOOK.layoutDef, "Use for new projects").
// Hidden things get an lo-<key> class on #app; the Inkling panel is built in layout order without hidden sections.
const LO_INSP = [
  ['pet', 'Inky and the room'],
  ['timer', 'Focus timer'],
  ['today', 'Today’s goal'],
  ['todo', 'To-do list'],
  ['ms', 'Manuscript'],
  ['scene', 'This scene (synopsis and notes)']
];
const LO_GROUPS = [
  [
    'Panels',
    [
      ['binder', 'Binder (left)'],
      ['insp', 'Inkling panel (right)']
    ],
    'On narrow screens the panels are tabs at the bottom and are always there.'
  ],
  [
    'Top bar',
    [
      ['goalChip', 'Word counter for today'],
      ['saveSt', 'Saving status']
    ]
  ],
  [
    'Above the page',
    [
      ['fmt', 'Formatting, undo and indent buttons'],
      ['link', 'Link selection'],
      ['size', 'Text size buttons'],
      ['stk', 'Sticky notes'],
      ['snapBtn', 'Snapshots button'],
      ['read', 'Read aloud'],
      ['status', 'Scene status'],
      ['swc', 'Scene word count']
    ]
  ],
  [
    'Around the page',
    [
      ['hint', 'Tip under the page'],
      ['bubble', 'Inky’s speech bubble'],
      ['peek', 'Inky peeking at the page corner (focus mode, phones)']
    ]
  ]
];
const LO_ALL = LO_INSP.map(x => x[0]).concat(...LO_GROUPS.map(g => g[1].map(x => x[0])));
const LO_PRESETS = {
  standard: ['Everything', []],
  calm: ['Calm', ['saveSt', 'hint', 'link', 'size', 'snapBtn', 'read', 'ms', 'scene']],
  page: [
    'Just the page',
    ['binder', 'insp', 'saveSt', 'hint', 'link', 'size', 'stk', 'snapBtn', 'read', 'status', 'swc']
  ]
};
function normLayout(x) {
  x = x && typeof x === 'object' ? x : {};
  const hide = {},
    ids = LO_INSP.map(s => s[0]);
  Object.keys(x.hide || {}).forEach(k => {
    if (LO_ALL.includes(k) && x.hide[k]) hide[k] = true;
  });
  const order = (Array.isArray(x.order) ? x.order : []).filter((k, i, a) => ids.includes(k) && a.indexOf(k) === i);
  ids.forEach(k => {
    if (!order.includes(k)) order.push(k);
  });
  return { hide, order };
}
const loHidden = k => !!(S && S.meta.layout && S.meta.layout.hide[k]);
function applyLayout() {
  const app = $('#app');
  if (!app || !S) return;
  [...app.classList].filter(c => c.startsWith('lo-')).forEach(c => app.classList.remove(c));
  Object.keys(S.meta.layout.hide).forEach(k => app.classList.add('lo-' + k));
  applyCols();
}
function loSet(k, hide) {
  const h = S.meta.layout.hide;
  if (hide) h[k] = true;
  else delete h[k];
  dirty('meta');
  applyLayout();
  if (LO_INSP.some(s => s[0] === k)) renderInspector();
}
function loToggle(k) {
  loSet(k, !loHidden(k));
  if (ui.view.k === 'layout') renderMain();
  const nm = (LO_GROUPS[0][1].find(x => x[0] === k) || [])[1];
  if (nm && innerWidth >= 1080)
    toast(
      (loHidden(k) ? 'Hid the ' : 'Showing the ') +
        nm.replace(/ \(.*\)/, '').toLowerCase() +
        '. Window › Project settings has more.',
      { plain: true }
    );
}
// Window actions, from the ⋯ menu, the desktop's menus or the keyboard (src 'menu', 'key' or 'ui'). The desktop can
// deliver both a key and its menu accelerator for one press, so the same action from the other of those two within
// 200 ms is done once; repeats from the same source always go through.
function winAct(a, src) {
  const now = Date.now(),
    last = ui.actLast;
  src = src || 'ui';
  if (
    last &&
    last.a === a &&
    last.src !== src &&
    (last.src === 'key' || last.src === 'menu') &&
    (src === 'key' || src === 'menu') &&
    now - last.t < 200
  )
    return;
  ui.actLast = { a, src, t: now };
  if (a === 'layout') go({ k: 'layout' });
  else if (a === 'plan') go({ k: 'plan' });
  else if (a === 'story') go({ k: 'story' });
  else if (a === 'world') go({ k: 'world' });
  else if (a === 'series') go({ k: 'series' });
  else if (a === 'search') go({ k: 'search' });
  else if (a === 'qs') openQs();
  else if (a === 'next' || a === 'prev') sceneStep(a === 'next' ? 1 : -1);
  else if (a === 'back') goBack();
  else if (a === 'fwd') goFwd();
  else if (a === 'trash') go({ k: 'trash' });
  else if (a === 'split') {
    if (ui.split) splitClose();
    else splitOpen();
  } else if (a === 'tBinder') loToggle('binder');
  else if (a === 'tInsp') loToggle('insp');
  else if (a === 'focus') {
    ui.focus = !ui.focus;
    syncTab();
    renderMain();
  } else if (a === 'keys') showKeys();
  else if (a === 'undo' || a === 'redo') {
    if (now - (ui.keyHistAt || 0) < 400) return;
    const ed = $('#ed');
    if (
      ed &&
      (document.activeElement === ed ||
        (ui.view.k === 'scene' && !document.activeElement.closest('input,textarea,select')))
    )
      edHist(a === 'redo');
    else document.execCommand(a);
  }
}
function renderLayout(el) {
  const m = S.meta,
    L = m.layout,
    ck = (k, label) =>
      '<label class="ck lo-ck"><input type="checkbox" data-lo="' +
      k +
      '"' +
      (L.hide[k] ? '' : ' checked') +
      '>' +
      esc(label) +
      '</label>';
  const preset = Object.keys(LO_PRESETS).find(p => {
    const h = LO_PRESETS[p][1];
    return h.length === Object.keys(L.hide).length && h.every(k => L.hide[k]);
  });
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('layout', 16) +
    '</span><h1 class="mh-title">Project settings</h1></div><div class="pf-wrap">' +
    '<section class="pf"><h2>This project</h2><div class="two"><label class="f">Title<input id="loTitle" maxlength="90" value="' +
    esc(m.title) +
    '"></label><label class="f">Author<input id="loAuthor" maxlength="120" value="' +
    esc(m.author || '') +
    '" placeholder="Your name or pen name"></label></div>' +
    '<div class="two"><label class="f">Daily goal (words)<input id="loGoal" type="number" min="50" max="20000" step="50" value="' +
    m.goal +
    '"' +
    (m.plan.on && m.plan.auto ? ' disabled title="Set by your deadline plan"' : '') +
    '></label><label class="f">Novel length goal (words)<input id="loTarget" type="number" min="1000" max="1000000" step="1000" value="' +
    m.target +
    '"></label></div>' +
    '<div class="ts-row"><button class="btn" data-lo-a="binder">' +
    ico('sliders', 14) +
    '<span>Choose binder sections…</span></button><button class="btn" data-lo-a="exp">Export settings…</button><button class="btn" data-lo-a="plan">' +
    ico('cal', 14) +
    '<span>Deadline planner…</span></button></div></section>' +
    '<section class="pf"><h2>Your screen</h2><p class="fine">Choose what you see while you work. Changes show straight away. Each project remembers its own setup' +
    (DESK ? ', and on a shared project your setup is yours alone' : '') +
    '.</p>' +
    '<span class="sec-l">Start from</span><div class="seg">' +
    Object.keys(LO_PRESETS)
      .map(
        p =>
          '<button data-lo-p="' + p + '"' + (preset === p ? ' class="on"' : '') + '>' + LO_PRESETS[p][0] + '</button>'
      )
      .join('') +
    '</div>' +
    LO_GROUPS.map(
      g =>
        '<div class="lo-grp"><span class="sec-l">' +
        g[0] +
        '</span><div class="lo-cks">' +
        g[1].map(x => ck(x[0], x[1])).join('') +
        '</div>' +
        (g[2] ? '<p class="fine">' + g[2] + '</p>' : '') +
        '</div>'
    ).join('') +
    '<div class="lo-grp"><span class="sec-l">Inkling panel, top to bottom</span><p class="fine">Drag to change the order. Untick to hide.</p><ul class="lo-order" id="loOrder">' +
    L.order
      .map(
        k =>
          '<li class="lo-it" data-k="' +
          k +
          '"><span class="td-grip" aria-hidden="true">' +
          ico('dots', 12) +
          '</span>' +
          ck(k, LO_INSP.find(s => s[0] === k)[1]) +
          '<span class="lo-mv"><button class="ibtn" data-lo-mv="-1" aria-label="Move up">' +
          ico('up', 13) +
          '</button><button class="ibtn" data-lo-mv="1" aria-label="Move down">' +
          ico('down', 13) +
          '</button></span></li>'
      )
      .join('') +
    '</ul></div>' +
    '<div class="ts-row"><button class="btn" data-lo-a="def">Use this setup for new projects</button>' +
    (LOOK.layoutDef ? '<button class="btn" data-lo-a="nodef">Forget my default</button>' : '') +
    '</div>' +
    '<p class="fine">Window shortcuts: ' +
    MODK +
    '+Shift+1 binder, ' +
    MODK +
    '+Shift+2 Inkling panel, ' +
    MODK +
    '+Shift+3 focus mode. Appearance (theme, font, spacing) is in <button class="lnk" data-lo-a="prefs">Settings</button>.</p></section></div>';
  const redraw = () => {
    applyLayout();
    renderInspector();
    renderLayout(el);
  };
  el.onchange = e => {
    const x = e.target;
    if (x.dataset.lo) {
      loSet(x.dataset.lo, !x.checked);
      renderLayout(el);
      return;
    }
    if (x.id === 'loTitle') {
      m.title = x.value.trim() || 'Untitled novel';
      $('#projTitle').value = m.title;
      dirty('meta');
    } else if (x.id === 'loAuthor') {
      m.author = x.value.trim();
      dirty('meta');
    } else if (x.id === 'loGoal') {
      m.goal = Math.max(50, Math.min(20000, Math.round(+x.value || 500)));
      x.value = m.goal;
      dirty('meta');
      updateStats();
      renderInspector();
    } else if (x.id === 'loTarget') {
      m.target = Math.max(1000, Math.min(1000000, Math.round(+x.value || 80000)));
      x.value = m.target;
      dirty('meta');
      updateStats();
      renderInspector();
    }
  };
  el.onclick = e => {
    const p = e.target.closest('[data-lo-p]'),
      a = e.target.closest('[data-lo-a]'),
      mv = e.target.closest('[data-lo-mv]');
    if (p) {
      L.hide = {};
      LO_PRESETS[p.dataset.loP][1].forEach(k => {
        L.hide[k] = true;
      });
      dirty('meta');
      redraw();
    } else if (mv) {
      const k = mv.closest('.lo-it').dataset.k,
        i = L.order.indexOf(k),
        j = i + +mv.dataset.loMv;
      if (j < 0 || j >= L.order.length) return;
      L.order.splice(i, 1);
      L.order.splice(j, 0, k);
      dirty('meta');
      redraw();
    } else if (a) {
      const w = a.dataset.loA;
      if (w === 'def') {
        LOOK.layoutDef = clone(L);
        saveLook();
        toast('New projects will start with this setup.', { plain: true });
        renderLayout(el);
      } else if (w === 'nodef') {
        delete LOOK.layoutDef;
        saveLook();
        renderLayout(el);
      } else if (w === 'binder') {
        loSet('binder', false);
        ui.binderCfg = true;
        renderBinder();
        const b = $('.bcfg');
        if (b) b.scrollIntoView({ block: 'nearest' });
      } else if (w === 'exp') openExport();
      else if (w === 'plan') go({ k: 'plan' });
      else if (w === 'prefs') go({ k: 'prefs' });
    }
  };
  dragSort($('#loOrder', el), {
    item: '.lo-it',
    handle: '.td-grip',
    drop: (it, ref) => {
      if (moveInList(L.order, it.dataset.k, ref && ref.dataset.k, x => x)) {
        dirty('meta');
        redraw();
      }
    }
  });
}

/* ---------- settings ---------- */
// Appearance is per device (localStorage), not per project: theme, writing font, line spacing, page width, spellcheck.
const LOOK_DEF = { theme: 'system', font: 'literata', lh: 1.8, width: 'standard', spell: true };
const FONTS = [
  ['literata', 'Literata (book serif)', "'Literata',Georgia,serif"],
  ['georgia', 'Georgia', "Georgia,'Times New Roman',serif"],
  ['times', 'Times New Roman', "'Times New Roman',Times,serif"],
  ['sans', 'Instrument Sans', "'Instrument Sans',system-ui,sans-serif"],
  ['mono', 'Typewriter (IBM Plex Mono)', "'IBM Plex Mono',ui-monospace,monospace"],
  ['system', 'This computer’s font', "system-ui,-apple-system,'Segoe UI',sans-serif"]
];
const WIDTHS = { narrow: ['Narrow', 640], standard: ['Standard', 780], wide: ['Wide', 980] };
let LOOK = Object.assign({}, LOOK_DEF);
try {
  LOOK = Object.assign(LOOK, JSON.parse(localStorage.getItem('inkling:look') || '{}'));
} catch (e) {}
function applyLook() {
  const r = document.documentElement,
    f = FONTS.find(x => x[0] === LOOK.font) || FONTS[0];
  if (LOOK.theme === 'light' || LOOK.theme === 'dark') r.dataset.theme = LOOK.theme;
  else delete r.dataset.theme;
  r.style.setProperty('--ed-font', f[2]);
  r.style.setProperty('--ed-lh', String(LOOK.lh));
  r.style.setProperty('--ed-w', (WIDTHS[LOOK.width] || WIDTHS.standard)[1] + 'px');
  const ed = $('#ed');
  if (ed) ed.spellcheck = !!LOOK.spell;
  const app = $('#app');
  if (app) app.classList.toggle('tw', !!LOOK.typewriter);
  applySides();
}
function saveLook() {
  try {
    localStorage.setItem('inkling:look', JSON.stringify(LOOK));
  } catch (e) {}
  applyLook();
}
applyLook();
async function renderPrefs(el) {
  const pf = DESK ? await DESK.prefs().catch(() => null) : null;
  const seg = (k, opts) =>
    '<div class="seg">' +
    opts
      .map(
        o =>
          '<button data-look="' +
          k +
          '" data-v="' +
          o[0] +
          '"' +
          (String(LOOK[k]) === String(o[0]) ? ' class="on"' : '') +
          '>' +
          o[1] +
          '</button>'
      )
      .join('') +
    '</div>';
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('sliders', 16) +
    '</span><h1 class="mh-title">Settings</h1></div><div class="pf-wrap">' +
    (DESK
      ? '<section class="pf"><h2>You</h2><label class="f">Your name<input id="pfName" value="' +
        esc(ME.name) +
        '" maxlength="60" placeholder="For example, Mary"></label><p class="fine">Co-writers on a shared project see this name, and it keeps your pet, daily goal and word history separate from theirs. Use the same name on each of your computers. <button class="lnk" data-pf="help">How sharing works</button></p></section>'
      : '') +
    '<section class="pf"><h2>Appearance</h2><p class="fine">These apply to this ' +
    (DESK ? 'computer' : 'browser') +
    ', for every project.</p>' +
    '<span class="sec-l">Theme</span>' +
    seg('theme', [
      ['system', 'Match my computer'],
      ['light', 'Light'],
      ['dark', 'Dark']
    ]) +
    '<label class="f">Writing font<select data-look="font">' +
    FONTS.map(
      f => '<option value="' + f[0] + '"' + (LOOK.font === f[0] ? ' selected' : '') + '>' + esc(f[1]) + '</option>'
    ).join('') +
    '</select></label>' +
    '<span class="sec-l">Text size</span><div class="pf-row"><button class="btn sm" data-fs="-1">A−</button><b class="mono" id="pfFs">' +
    ui.fs +
    ' px</b><button class="btn sm" data-fs="1">A+</button></div>' +
    '<span class="sec-l">Line spacing</span>' +
    seg('lh', [
      [1.5, 'Tight'],
      [1.8, 'Comfortable'],
      [2, 'Double'],
      [2.3, 'Airy']
    ]) +
    '<span class="sec-l">Page width</span>' +
    seg(
      'width',
      Object.keys(WIDTHS).map(k => [k, WIDTHS[k][0]])
    ) +
    '<p class="pf-sample" id="pfSample">Ilsa Verrin stepped off the ferry with one bag, one coat, and no plan she was willing to say aloud.</p>' +
    '<span class="sec-l">Side panels</span><div class="pf-row"><span class="fine" style="margin:0">Drag the edge of the binder or of the Inkling panel to make it wider or narrower. Double-click an edge to put it back.</span>' +
    (LOOK.bw || LOOK.iw ? '<button class="btn sm" data-pf="sides">Reset widths</button>' : '') +
    '</div></section>' +
    '<section class="pf"><h2>Writing</h2><label class="ck"><input type="checkbox" data-look="spell"' +
    (LOOK.spell ? ' checked' : '') +
    '>Check spelling as I type</label>' +
    '<label class="ck"><input type="checkbox" data-look="smart"' +
    (LOOK.smart !== false ? ' checked' : '') +
    '>Curly quotes and em dashes as I type (“ ” ‘ ’ and -- becomes —)</label>' +
    '<label class="ck"><input type="checkbox" data-look="keepIndent"' +
    (LOOK.keepIndent !== false ? ' checked' : '') +
    '>A new line keeps the indent of the line before (Tab indents, Shift+Tab removes it)</label>' +
    '<label class="ck"><input type="checkbox" data-look="typewriter"' +
    (LOOK.typewriter ? ' checked' : '') +
    '>Typewriter scrolling: keep the line I am writing in the middle of the screen</label>' +
    (canSpeak()
      ? '<span class="sec-l">Read aloud speed</span>' +
        seg('raRate', [
          [0.8, 'Slower'],
          [1, 'Normal'],
          [1.25, 'Faster']
        ])
      : '') +
    '<p class="fine">Bold, italic and underline: the B, I and U buttons above a scene, or Ctrl+B, Ctrl+I, Ctrl+U (⌘ on a Mac). <button class="lnk" data-pf="keys">All keyboard shortcuts</button></p>' +
    (pf && pf.spellLangs && pf.spellLangs.length
      ? '<label class="f">Spelling language<select data-pf="spell">' +
        pf.spellLangs
          .map(l => '<option value="' + esc(l) + '"' + (pf.spell === l ? ' selected' : '') + '>' + esc(l) + '</option>')
          .join('') +
        '</select></label>'
      : '') +
    (pf && pf.platform === 'darwin'
      ? '<p class="fine">On a Mac, spelling uses your system language settings.</p>'
      : '') +
    '</section>' +
    (pf
      ? '<section class="pf"><h2>Projects folder</h2><p><code>' +
        esc(pf.dir) +
        '</code></p>' +
        '<p class="fine">To back your projects up online and use them on more than one computer, put this folder inside Dropbox, iCloud Drive, Google Drive or OneDrive. Close Inkling on one computer before writing on another: Inkling warns you if a project is open somewhere else or was changed by another computer.</p>' +
        '<div class="ts-row"><button class="btn" data-pf="dir">' +
        ico('folder', 14) +
        '<span>Change folder…</span></button>' +
        (pf.dir !== pf.defaultDir ? '<button class="btn" data-pf="dirdef">Use the standard folder</button>' : '') +
        '<button class="btn" data-pf="reveal">Open folder</button></div></section>' +
        '<section class="pf"><h2>Updates</h2><p>You have Inkling <b>' +
        esc(pf.version) +
        '</b>.</p><label class="ck"><input type="checkbox" data-pf="auto"' +
        (pf.autoUpdate ? ' checked' : '') +
        '>Check for updates automatically</label>' +
        '<p class="fine">' +
        (pf.platform === 'darwin'
          ? 'When a new version is out, Inkling tells you and opens the download page.'
          : 'New versions download in the background, and Inkling asks before restarting to install them.') +
        '</p>' +
        '<div class="ts-row"><button class="btn" data-pf="check">Check now</button><button class="btn" data-pf="notes">What’s new</button></div></section>'
      : '') +
    '<section class="pf"><h2>About and privacy</h2><p>Inkling ' +
    esc(pf ? pf.version : APP_VERSION) +
    ' · project format ' +
    FORMAT +
    '</p>' +
    '<p class="fine">' +
    (DESK
      ? 'Your writing stays in your projects folder. Inkling has no accounts, ads or tracking. It connects to the internet only to check for updates, and only if that is switched on above.'
      : window.claude && window.claude.use
        ? 'In Claude, your project saves to your Claude account, private to you. Inkling has no ads or tracking.'
        : 'Your project saves in this browser only. Inkling has no accounts, ads or tracking. Back it up from the menu now and then.') +
    '</p>' +
    '<div class="ts-row"><button class="btn" data-pf="tour">Show the tour</button></div></section></div>';
  const sample = () => {
    const x = $('#pfSample', el);
    if (x) {
      x.style.fontSize = ui.fs + 'px';
    }
  };
  sample();
  el.onclick = async e => {
    const b = e.target.closest('[data-look],[data-fs],[data-pf]');
    if (!b || b.tagName === 'SELECT' || b.type === 'checkbox') return;
    if (b.dataset.look) {
      const k = b.dataset.look;
      LOOK[k] = k === 'lh' || k === 'raRate' ? +b.dataset.v : b.dataset.v;
      saveLook();
      renderPrefs(el);
      return;
    }
    if (b.dataset.fs) {
      ui.fs = Math.max(14, Math.min(28, ui.fs + +b.dataset.fs));
      try {
        localStorage.setItem('inkling:fs', ui.fs);
      } catch (x) {}
      $('#pfFs', el).textContent = ui.fs + ' px';
      sample();
      return;
    }
    const a = b.dataset.pf;
    if (a === 'check') checkUpdatesNow();
    else if (a === 'notes') DESK.openReleases(pf.version);
    else if (a === 'reveal') DESK.reveal();
    else if (a === 'tour') startTour(true);
    else if (a === 'dir' || a === 'dirdef') changeFolder(a === 'dirdef');
    else if (a === 'help') go({ k: 'help' });
    else if (a === 'keys') showKeys();
    else if (a === 'sides') {
      delete LOOK.bw;
      delete LOOK.iw;
      saveLook();
      renderPrefs(el);
    }
  };
  el.onchange = async e => {
    const x = e.target;
    if (x.dataset.look) {
      LOOK[x.dataset.look] = x.type === 'checkbox' ? x.checked : x.value;
      saveLook();
      return;
    }
    if (x.id === 'pfName') {
      setMyName(x.value);
      toast(ME.name ? 'Co-writers will see you as ' + ME.name + '.' : 'Name removed.', { plain: true });
      return;
    }
    if (x.dataset.pf === 'auto') await DESK.setPrefs({ autoUpdate: x.checked });
    if (x.dataset.pf === 'spell') await DESK.setPrefs({ spell: x.value });
  };
}
async function changeFolder(toDefault) {
  const pf = await DESK.prefs(),
    dir = toDefault ? pf.defaultDir : await DESK.chooseDir();
  if (!dir || dir === pf.dir) return;
  const n = (await DESK.list()).length;
  const c = await ask(
    'Use this projects folder?',
    '<code>' +
      esc(dir) +
      '</code><br><br>' +
      (n
        ? 'You have ' +
          n +
          ' project' +
          (n === 1 ? '' : 's') +
          ' in the current folder. Moving copies each one, checks it, then puts the old copy in the trash.'
        : 'The current folder has no projects.') +
      ' Choose “Use it as it is” when the new folder already holds your projects from another computer.',
    (n ? [['move', 'Move my projects there', 'pri']] : []).concat([
      ['use', 'Use it as it is'],
      ['cancel', 'Cancel']
    ])
  );
  if (c !== 'move' && c !== 'use') return;
  pmHalt();
  await deskFlush();
  const cur = PJ.id;
  const r = await DESK.useDir(toDefault ? null : dir, c === 'move'),
    list = await DESK.list();
  if (list.some(x => x.id === cur)) await deskOpen(cur, true);
  else if (list.length) await deskOpen(list[0].id);
  else await deskNew('blank');
  go({ k: 'prefs' }, { push: false });
  toast(
    c === 'move'
      ? 'Moved ' +
          r.moved +
          ' project' +
          (r.moved === 1 ? '' : 's') +
          '.' +
          (r.skipped.length ? ' ' + r.skipped.length + ' already existed there and stayed in the old folder.' : '') +
          (r.failed.length ? ' ' + r.failed.length + ' could not be moved and stayed where they were.' : '')
      : 'Now using the new folder.',
    { plain: true }
  );
}
