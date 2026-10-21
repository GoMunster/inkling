/*
 * 01-core.js: Shared helpers, constants and the app's state
 *
 * Everything else builds on this file: small helpers ($ to find an element, esc to make text safe inside HTML, uid
 * for new ids, wc to count words, fmt for numbers), the icon set (ICO and ico()), the kinds of story page (TYPES),
 * the binder's section names, Inky's ranks, and the state itself.
 *
 * The state: S is the open project, { meta, sc, en, tl, ch, nt, ol, rm, ft, ss, sn, tr } (see CLAUDE.md for every
 * field). ui holds what is on screen right now and is never saved. P holds the saving machinery's own state. DESK is
 * the desktop app's bridge (null in a browser), PJ the desktop project that is open, ME the writer's name on shared
 * projects.
 */
// The first element matching a CSS selector, inside r (the whole page by default).
const $ = (s, r) => (r || document).querySelector(s);
// Makes any value safe to put inside HTML: escapes & < > " and '.
const esc = s =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
// A new random id with a prefix, like "s_k3j9x1ab": random letters plus the time, so two devices never clash.
const uid = p => p + Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-3);
// Counts the words in a piece of text (runs of non-space characters).
const wc = t => {
  const m = String(t || '').match(/\S+/g);
  return m ? m.length : 0;
};
// A number rounded and written with thousands separators: 12,345.
const NUM_FMT = new Intl.NumberFormat('en-US'); // made once: toLocaleString() builds a new formatter on every call
const fmt = n => NUM_FMT.format(Math.round(n));
// Two digits with a leading zero, for dates: 7 → "07".
const pad = n => String(n).padStart(2, '0');
// A date as the "YYYY-MM-DD" key used for daily word counts.
const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
// Today's "YYYY-MM-DD" key.
const todayKey = () => keyOf(new Date());
// One random item from a list.
const pick = a => a[Math.floor(Math.random() * a.length)];
// True when the computer asks for reduced motion; animations are then kept to a minimum.
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
// The length of the progress ring's arc in the top bar (its circumference in SVG units).
const RING = 66;

// The icon set: each icon is one SVG path, drawn by ico().
const ICO = {
  plus: 'M12 5v14M5 12h14',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  pen2: 'M4 20l4-1L19 8l-3-3L5 16zM14 6l3 3',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  down: 'M6 9l6 6 6-6',
  right: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  back: 'M15 6l-6 6 6 6',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  card: 'M4 6h7v6H4zM13 6h7v6h-7zM4 14h7v4H4zM13 14h7v4h-7z',
  book: 'M5 5h6a2 2 0 012 2v12a2 2 0 00-2-2H5zM19 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z',
  pen: 'M4 20l1-4L16 5l3 3L8 19l-4 1z',
  focus: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  x: 'M6 6l12 12M18 6L6 18',
  note: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  indent: 'M4 6h16M10 12h10M10 18h10M4 10l3 2-3 2',
  outdent: 'M4 6h16M10 12h10M10 18h10M7 10l-3 2 3 2',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  play: 'M7 5l12 7-12 7z',
  pause: 'M8 5v14M16 5v14',
  stop: 'M6 6h12v12H6z',
  skip: 'M5 5l10 7-10 7zM19 5v14',
  timer: 'M12 9v4l2.5 2M9 2h6M12 22a8 8 0 100-16 8 8 0 000 16z',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  web: 'M8 7a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM21 7a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM14.5 18a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM8 7h8M6.5 9l4.5 7M17.5 9L13 16',
  tree: 'M9 3h6v4H9zM3 17h6v4H3zM15 17h6v4h-6zM12 7v5M6 12h12M6 12v5M18 12v5',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z',
  time: 'M3 12h18M7 12V7M12 12v5M17 12V7',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4.2-4.2',
  users:
    'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.8 3.2 2.6 3.5 5.2',
  minus: 'M5 12h14',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  fit: 'M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  speak: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11',
  layout: 'M4 4h16v16H4zM9 4v16M9 10h11',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  swap: 'M7 7h13l-4-4M17 17H4l4 4',
  split: 'M4 4h16v16H4zM12 4v16'
};
// An icon as inline SVG markup, in the current text colour; s is its size in pixels (16 by default).
const ico = (n, s) =>
  '<svg class="ico" width="' +
  (s || 16) +
  '" height="' +
  (s || 16) +
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
  ICO[n] +
  '"/></svg>';

// The kinds of story page, with their default fields ([key, label]). Writers can change the fields per project
// (entFields).
const TYPES = {
  char: {
    label: 'Character',
    plural: 'Characters',
    fields: [
      ['role', 'Role in the story'],
      ['look', 'Appearance'],
      ['voice', 'Personality and voice'],
      ['want', 'What they want'],
      ['fear', 'Fears and flaws'],
      ['past', 'Backstory'],
      ['arc', 'Arc'],
      ['ties', 'Relationships'],
      ['notes', 'Notes']
    ]
  },
  place: {
    label: 'Place',
    plural: 'Places',
    fields: [
      ['kind', 'Kind of place'],
      ['look', 'What it looks like'],
      ['feel', 'Atmosphere'],
      ['past', 'History'],
      ['spots', 'Notable spots'],
      ['who', 'Who is found here'],
      ['notes', 'Notes']
    ]
  },
  thing: {
    label: 'Thing',
    plural: 'Things',
    fields: [
      ['look', 'Description'],
      ['origin', 'Origin'],
      ['power', 'Why it matters'],
      ['holder', 'Who has it'],
      ['notes', 'Notes']
    ]
  },
  rule: {
    label: 'Rule',
    plural: 'Rules & magic',
    fields: [
      ['kind', 'What it is (magic, technology, law, custom)'],
      ['how', 'How it works'],
      ['cost', 'What it costs'],
      ['limits', 'Limits and weaknesses'],
      ['who', 'Who can use it, and who can’t'],
      ['seen', 'How the reader first sees it'],
      ['notes', 'Notes']
    ]
  },
  term: {
    label: 'Term',
    plural: 'Glossary',
    fields: [
      ['meaning', 'Meaning'],
      ['say', 'Pronunciation'],
      ['lang', 'Language or origin'],
      ['use', 'Used in a sentence'],
      ['notes', 'Notes']
    ]
  }
};
// The order story page kinds are listed in, in the binder and in menus.
const TYPE_ORDER = ['char', 'place', 'thing', 'rule', 'term'];
// The binder's sections and their default names, plural and singular. Writers can rename them (LP, LS).
const SEC_DEF = {
  ol: ['Outlines', 'Outline'],
  nt: ['Notes & ideas', 'Note'],
  tl: ['Timelines', 'Timeline'],
  rm: ['Relationship maps', 'Relationship map'],
  ft: ['Family trees', 'Family tree'],
  char: ['Characters', 'Character'],
  place: ['Places', 'Place'],
  thing: ['Things', 'Thing'],
  rule: ['Rules & magic', 'Rule'],
  term: ['Glossary', 'Term']
};
const OPT_SECS = ['ol', 'nt', 'tl', 'rm', 'ft', 'place', 'thing', 'rule', 'term']; // binder sections a writer can switch off ('char' always stays)
// Whether an optional binder section is switched on for this project.
const secOn = k => !S.meta.secs || S.meta.secs[k] !== false;
const LP = t => ((S && S.meta.labels[t]) || {}).p || SEC_DEF[t][0]; // section title, user-renamable
const LS = t => ((S && S.meta.labels[t]) || {}).s || SEC_DEF[t][1]; // one item of that section
// Scene statuses and how they are shown.
const STATUS = { draft: 'Draft', revised: 'Revised', final: 'Final' };
// Inky's ranks, from a blot of ink to a laureate. The words each one needs come from stageAt().
const STAGES = [
  { n: 'Blot', at: 0 },
  { n: 'Inkling', at: 1000 },
  { n: 'Scribe', at: 10000 },
  { n: 'Bard', at: 30000 },
  { n: 'Laureate', at: 60000 }
];
// Ranks follow the novel length goal: Inkling at 5%, Scribe at 25%, Bard at 50%, Laureate at 100% of meta.target
// (words written in this project). A rank once reached is kept in pet.rank, so raising the goal never shrinks Inky.
const STAGE_FR = [0, 0.05, 0.25, 0.5, 1];
// Words needed for rank i: a share (STAGE_FR) of this project's novel length goal.
const stageAt = i =>
  i
    ? Math.max(i * 50, Math.round(((typeof S !== 'undefined' && S && S.meta && S.meta.target) || 80000) * STAGE_FR[i]))
    : 0;
// The highest rank a word total has reached.
const stageOf = t => {
  let i = 0;
  for (let j = 1; j < STAGES.length; j++) if (t >= stageAt(j)) i = j;
  return i;
};
// Inky's rank now: the rank the words reach, or a higher one already earned (ranks are never lost).
const petStage = () => Math.max(stageOf(S.meta.pet.total), S.meta.pet.rank || 0);

/* ---------- state ---------- */
let S = null; // {meta, sc:{id:{text,synopsis,notes}}, en:{id:{fields,pic}}, tl:{id:timeline}, ch:{id:{notes}}, nt:{id:{text,ideas}}, ol:{id:{num,showNotes,items}}}
// The record maps of S that are saved one record per document, named "<prefix>_<id>".
const DOCS = ['sc', 'en', 'tl', 'ch', 'nt', 'ol', 'rm', 'ft', 'ss', 'sn', 'tr']; // each record of these maps is its own saved doc, '<prefix>_<id>'
const ADD_DOCS = []; // (raw, out) => out.<prefix> = normalized records, for doc types added after normalize() was written
// The whole project as one plain object (meta plus every record map), ready to save or back up.
const snapshot = st => {
  if (!st) stampMine(S);
  st = st || S;
  const o = { meta: st.meta };
  DOCS.forEach(p => {
    o[p] = st[p];
  });
  return o;
};
// The desktop app (desktop/) provides window.inklingDesktop: each project is a folder on the computer. Elsewhere it is null.
const DESK = window.inklingDesktop || null;
const APP_VERSION = '1.11.0'; // the desktop build replaces this with desktop/package.json's version
// Saved-format version. When the shape of saved data changes: bump FORMAT and add MIGRATE[old] that upgrades a raw
// project one step (it runs before normalize()). A project from a newer FORMAT is never loaded or overwritten.
const FORMAT = 2;
// Steps that upgrade a project saved in an older format, keyed by the old format number.
const MIGRATE = {
  1: o => o // 1 → 2: records gain change stamps (_m, _dev) and meta.gone; nothing to convert
};
// Runs MIGRATE steps until a raw project is in the current format; refuses a project from a newer Inkling.
function migrate(o) {
  const v = Math.max(1, Math.round(+(o.meta || {}).v || 1));
  if (v > FORMAT) {
    const e = new Error('This project was saved by a newer version of Inkling.');
    e.code = 'newer';
    e.v = v;
    throw e;
  }
  for (let n = v; n < FORMAT; n++) o = (MIGRATE[n] || (x => x))(o);
  o.meta.v = FORMAT;
  return o;
}
// Sync-ready bookkeeping: each saved record carries _m (last change, ms) and _dev (device that changed it), and
// meta.gone keeps a dated marker for each deleted record, so a future sync can tell edits from deletions.
const DEVICE = (() => {
  try {
    let d = localStorage.getItem('inkling:device');
    if (!d) {
      d = 'd' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('inkling:device', d);
    }
    return d;
  } catch (e) {
    return 'd-unknown';
  }
})();
// Who is writing, for shared projects: a name chosen in Settings (per device). Personal things (pet, daily goal,
// word history, focus timer) are kept per writer in meta.writers, keyed by the lower-cased name.
const ME = { name: '' };
try {
  ME.name = String(JSON.parse(localStorage.getItem('inkling:me') || '{}').name || '').slice(0, 60);
} catch (e) {}
// A writer's name as a key: trimmed and lower-cased, so "Sam" and "sam " are the same writer.
const nameKey = n =>
  String(n || '')
    .trim()
    .toLowerCase();
// This writer's key on a shared project.
const myKey = () => nameKey(ME.name);
// The meta fields that belong to each writer rather than to the book (word history, Inky, goals, timer, to-do,
// layout, plan).
const PERSONAL = ['days', 'pet', 'mark', 'goal', 'pomo', 'todo', 'layout', 'plan'];
const PJ = { id: null, base: null }; // the desktop project that is open, and the version of it last read from or written to disk
// The compiled name-link matcher (buildLinker()), rebuilt whenever story page names change.
let linker = null;
// What is on screen right now: the current view, history, open sections, selections, dialogs. Never saved.
const ui = {
  view: null,
  hist: [],
  cork: 'all',
  rename: null,
  confirm: null,
  menu: false,
  tab: 'write',
  focus: false,
  openSec: {
    ol: true,
    nt: true,
    tl: true,
    rm: true,
    ft: true,
    char: true,
    place: true,
    thing: true,
    rule: true,
    term: true
  },
  say: '',
  sayAt: 0,
  mood: '',
  touched: false,
  sel: '',
  focusName: false,
  fs: 18,
  relabel: null,
  ntAdd: false,
  olUndo: null,
  binderCfg: false,
  cvFor: null,
  cvSel: null,
  cvPop: false,
  ftGen: {},
  imgOpts: false,
  imgBusy: null,
  tlFor: null,
  tlSel: null,
  tlSide: null,
  tlSideKey: '',
  tlQ: '',
  tlEnt: '',
  tlR: null,
  tlDragged: false
};
// The saving machinery: which records changed and wait to be saved, the active storage, the save timer.
const P = {
  db: null,
  base: null,
  keys: new Set(),
  dirty: new Set(),
  gone: new Set(),
  timer: null,
  busy: false,
  again: false,
  fails: 0
};
