'use strict';
// Inkling desktop: wraps index.html in a window and keeps every project as a folder on this computer.
//   <projects folder>/<project id>/project.json         the whole project (same shape as a JSON backup)
//                                  /info.json           title, words and save time for the Projects screen
//                                  /pictures/           story page pictures, one file each
//                                  /backups/            automatic copies of project.json, newest kept
//                                  /.inkling-here/      one small file per computer that has the project open
// A project can also live anywhere else (a folder shared through Dropbox, Google Drive, OneDrive or iCloud): those are
// "linked" projects, kept in settings.links. Saving is compare-and-swap: a save only replaces project.json if it is
// still the version this computer last read or wrote; otherwise the page merges the two (see SHARING.md).
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, protocol, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fsp = fs.promises;
const { pathToFileURL } = require('url');
const crypto = require('crypto');

const REPO = 'GoMunster/inkling';
const RELEASES = 'https://github.com/' + REPO + '/releases';
const ID_RE = /^[a-z0-9][a-z0-9_-]{2,60}$/i;
const PIC_RE = /^[a-z0-9][a-z0-9_.-]{0,80}$/i;
const BACKUP_RE = /^[\d-]+(-yours)?\.json$/;
const PIC_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp'
};
const BACKUP_EVERY = 10 * 60 * 1000; // at most one automatic backup per project every 10 minutes
const BACKUPS_KEPT = 40;
const HERE = '.inkling-here',
  HERE_FRESH = 150 * 1000; // presence older than this means that computer closed or went to sleep
const STRAY_RE = /^project.+\.json$/i; // copies a sync service makes when two saves cross: "project (Mary's conflicted copy).json", "project-PC.json", "project (1).json"
const SYNC_RE =
  /dropbox|google ?drive|googledrive|my drive|onedrive|icloud|mobile documents|cloudstorage|box sync|nextcloud|sync/i;

protocol.registerSchemesAsPrivileged([
  { scheme: 'inkpic', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

let win = null,
  closing = false,
  settings = {},
  openId = null,
  updater = null,
  upd = { state: 'idle' };
const known = {}; // project id -> {hash, mtime, size} of project.json as this computer last read or wrote it
let hereInfo = {}; // what this computer last said about itself (name, scene) for the presence file
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const defaultDir = () => path.join(app.getPath('documents'), 'Inkling Projects');
const projectsDir = () => settings.dir || defaultDir();
function projDir(id) {
  if (!ID_RE.test(String(id || ''))) throw new Error('Bad project id');
  const links = settings.links || {};
  return Object.prototype.hasOwnProperty.call(links, id) ? links[id] : path.join(projectsDir(), id);
}
const isLinked = id => !!(settings.links && Object.prototype.hasOwnProperty.call(settings.links, id));
const hash = s => crypto.createHash('sha1').update(s).digest('hex');
async function diskState(id, withData) {
  const file = path.join(projDir(id), 'project.json');
  let st;
  try {
    st = await fsp.stat(file);
  } catch (e) {
    return null;
  }
  const k = known[id];
  if (!withData && k && k.mtime === st.mtimeMs && k.size === st.size) return k; // untouched since we last looked
  const data = await fsp.readFile(file, 'utf8');
  return { hash: hash(data), mtime: st.mtimeMs, size: st.size, data };
}
const remember = (id, s) => {
  known[id] = { hash: s.hash, mtime: s.mtime, size: s.size };
};
function picFile(id, name) {
  if (!PIC_RE.test(String(name || ''))) throw new Error('Bad picture name');
  return path.join(projDir(id), 'pictures', name);
}

async function writeAtomic(file, data) {
  // Write beside the file, flush to disk, then swap it in, so a crash mid-save never leaves half a novel.
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  const fh = await fsp.open(tmp, 'w');
  try {
    await fh.writeFile(data);
    await fh.sync();
  } finally {
    await fh.close();
  }
  await fsp.rename(tmp, file);
}
function loadSettings() {
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) || {};
  } catch (e) {
    settings = {};
  }
  if (!settings.device) settings.device = 'c' + Math.random().toString(36).slice(2, 10);
}
const saveSettings = () => writeAtomic(settingsFile(), JSON.stringify(settings, null, 1)).catch(() => {});
const readJson = async file => {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch (e) {
    return null;
  }
};
const mtime = async file => {
  try {
    return (await fsp.stat(file)).mtimeMs;
  } catch (e) {
    return 0;
  }
};
const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
function newId(title) {
  const base =
    String(title || 'novel')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'novel';
  return base + '-' + Math.random().toString(36).slice(2, 7);
}

async function backupIfDue(id) {
  const dir = projDir(id),
    cur = path.join(dir, 'project.json'),
    bdir = path.join(dir, 'backups');
  if (!fs.existsSync(cur)) return;
  await fsp.mkdir(bdir, { recursive: true });
  const names = (await fsp.readdir(bdir)).filter(n => BACKUP_RE.test(n)).sort();
  const last = names.length ? (await fsp.stat(path.join(bdir, names[names.length - 1]))).mtimeMs : 0;
  if (Date.now() - last < BACKUP_EVERY) return;
  await fsp.copyFile(cur, path.join(bdir, stamp() + '.json'));
  const all = (await fsp.readdir(bdir)).filter(n => BACKUP_RE.test(n)).sort();
  for (const n of all.slice(0, Math.max(0, all.length - BACKUPS_KEPT)))
    await fsp.unlink(path.join(bdir, n)).catch(() => {});
}
async function copyProject(fromId, title, json) {
  const id = newId(title),
    from = projDir(fromId),
    to = projDir(id);
  await fsp.mkdir(path.join(to, 'pictures'), { recursive: true });
  if (fs.existsSync(path.join(from, 'pictures')))
    await fsp.cp(path.join(from, 'pictures'), path.join(to, 'pictures'), { recursive: true });
  const o = JSON.parse(json);
  o.meta = o.meta || {};
  o.meta.title = title;
  o.meta.saved = Date.now();
  await writeAtomic(path.join(to, 'project.json'), JSON.stringify(o));
  const info = (await readJson(path.join(from, 'info.json'))) || {};
  await writeAtomic(path.join(to, 'info.json'), JSON.stringify(Object.assign(info, { title, saved: Date.now() })));
  return id;
}

/* ---------- who has a project open ---------- */
// Each computer keeps one small file in <project>/.inkling-here/ while the project is open, refreshed every 30 seconds.
// Through a sync folder, co-writers see who else is in the project and which scene they are in.
const hereFile = (id, dev) => path.join(projDir(id), HERE, dev + '.json');
async function writeHere(id) {
  try {
    await fsp.mkdir(path.join(projDir(id), HERE), { recursive: true });
    await fsp.writeFile(
      hereFile(id, settings.device),
      JSON.stringify(
        Object.assign({}, hereInfo, {
          device: settings.device,
          host: os.hostname(),
          version: app.getVersion(),
          at: Date.now()
        })
      )
    );
  } catch (e) {}
}
async function dropHere(id) {
  if (id) await fsp.unlink(hereFile(id, settings.device)).catch(() => {});
}
async function othersHere(id) {
  const dir = path.join(projDir(id), HERE),
    out = [];
  let names = [];
  try {
    names = await fsp.readdir(dir);
  } catch (e) {
    return out;
  }
  for (const n of names) {
    if (!/^[\w-]{1,40}\.json$/.test(n) || n === settings.device + '.json') continue;
    const h = await readJson(path.join(dir, n));
    if (!h) continue;
    const age = Date.now() - (+h.at || 0);
    if (age > 7 * 864e5) {
      fsp.unlink(path.join(dir, n)).catch(() => {});
      continue;
    } // left behind by a crash long ago
    if (age < HERE_FRESH)
      out.push({
        name: String(h.name || '').slice(0, 60),
        host: String(h.host || '').slice(0, 60),
        scene: String(h.scene || '').slice(0, 40),
        sceneTitle: String(h.sceneTitle || '').slice(0, 100),
        version: String(h.version || ''),
        sprint: Math.max(0, +h.sprint || 0),
        pet:
          h.pet && typeof h.pet === 'object'
            ? {
                c: String(h.pet.c || '').slice(0, 12),
                st: Math.max(0, Math.min(9, +h.pet.st || 0)),
                n: String(h.pet.n || '').slice(0, 40)
              }
            : null,
        at: +h.at
      });
  }
  return out;
}
setInterval(() => {
  if (openId) writeHere(openId);
}, 30 * 1000);

/* ---------- requests from the page ---------- */
const handle = (name, fn) =>
  ipcMain.handle('ink:' + name, async (e, ...args) => {
    if (!win || e.sender !== win.webContents) throw new Error('Not allowed');
    return fn(...args);
  });
handle('list', async () => {
  const root = projectsDir();
  await fsp.mkdir(root, { recursive: true });
  const out = [];
  const ids = [];
  for (const d of await fsp.readdir(root, { withFileTypes: true })) {
    if (
      d.isDirectory() &&
      ID_RE.test(d.name) &&
      !isLinked(d.name) &&
      fs.existsSync(path.join(root, d.name, 'project.json'))
    )
      ids.push(d.name);
  }
  for (const id of Object.keys(settings.links || {})) ids.push(id);
  for (const id of ids) {
    const dir = projDir(id),
      shared = isLinked(id);
    if (!fs.existsSync(path.join(dir, 'project.json'))) {
      out.push({ id, title: path.basename(dir), words: 0, saved: 0, shared, missing: true, path: dir });
      continue;
    }
    const info = (await readJson(path.join(dir, 'info.json'))) || {};
    const st = await fsp.stat(path.join(dir, 'project.json'));
    out.push({
      id,
      title: String(info.title || id),
      words: +info.words || 0,
      saved: +info.saved || st.mtimeMs,
      sample: !!info.sample,
      shared,
      path: dir,
      synced: SYNC_RE.test(dir),
      others: await othersHere(id)
    });
  }
  return out.sort((a, b) => a.missing - b.missing || b.saved - a.saved);
});
handle('create', async title => {
  const id = newId(title);
  await fsp.mkdir(path.join(projDir(id), 'pictures'), { recursive: true });
  return id;
});
// Opens a project: its text, plus who else has it open right now.
handle('load', async id => {
  const st = await diskState(id, true);
  if (!st) return { data: null, others: [] };
  if (openId && openId !== id) await dropHere(openId);
  openId = id;
  remember(id, st);
  hereInfo = {};
  await writeHere(id);
  settings.last = id;
  saveSettings();
  return { data: st.data, others: await othersHere(id) };
});
handle('last', async () => {
  try {
    return settings.last && fs.existsSync(path.join(projDir(settings.last), 'project.json')) ? settings.last : null;
  } catch (e) {
    return null;
  }
});
// Saves only if project.json is still the version this computer last read or wrote (or the `token` from read()).
// Otherwise it answers {conflict: true}: another computer saved through the sync folder, and the page merges first.
handle('save', async (id, json, info, opt) => {
  if (typeof json !== 'string') throw new Error('Bad data');
  const file = path.join(projDir(id), 'project.json');
  if (opt !== true) {
    const want = opt && opt.token ? opt.token : known[id] && known[id].hash,
      cur = await diskState(id);
    if (cur && want && cur.hash !== want) return { conflict: true };
  }
  await backupIfDue(id);
  await writeAtomic(file, json);
  const st = await fsp.stat(file);
  remember(id, { hash: hash(json), mtime: st.mtimeMs, size: st.size });
  const i = info && typeof info === 'object' ? info : {};
  await writeAtomic(
    path.join(projDir(id), 'info.json'),
    JSON.stringify({
      title: String(i.title || '').slice(0, 120),
      words: +i.words || 0,
      sample: !!i.sample,
      saved: Date.now()
    })
  );
  return { ok: true };
});
// Has another computer saved since we last read or wrote? Also true when a sync service left a conflicted copy.
handle('changed', async id => {
  const cur = await diskState(id);
  if (!cur) return false;
  if (known[id] && cur.hash !== known[id].hash) return true;
  try {
    return (await fsp.readdir(projDir(id))).some(n => STRAY_RE.test(n));
  } catch (e) {
    return false;
  }
});
// The project as it is on disk now, with a token for a save that must not overwrite anything newer, and any
// conflicted copies a sync service made (the page merges those in too).
handle('read', async id => {
  const st = await diskState(id, true);
  if (!st) return null;
  const strays = [];
  for (const n of await fsp.readdir(projDir(id))) {
    if (!STRAY_RE.test(n)) continue;
    try {
      strays.push({ name: n, data: await fsp.readFile(path.join(projDir(id), n), 'utf8') });
    } catch (e) {}
  }
  return { data: st.data, token: st.hash, strays };
});
// Nothing of ours needed writing after a merge: take the disk version as the one we know.
handle('adopt', async (id, token) => {
  const st = await diskState(id, true);
  if (st && st.hash === token) remember(id, st);
  return true;
});
// Conflicted copies, once merged, go into the project's backups folder.
handle('clearStrays', async (id, names) => {
  for (const n of Array.isArray(names) ? names : []) {
    if (!STRAY_RE.test(String(n)) || /[\\/]/.test(n)) continue;
    await fsp.mkdir(path.join(projDir(id), 'backups'), { recursive: true });
    await fsp
      .rename(
        path.join(projDir(id), n),
        path.join(projDir(id), 'backups', stamp() + '-merged-' + n.replace(/[^\w.()' -]+/g, '_'))
      )
      .catch(() => {});
  }
  return true;
});
// Presence: what this computer is doing (name, scene); returns everyone else who has the project open.
handle('here', async (id, info) => {
  const i = info && typeof info === 'object' ? info : {};
  const pet =
    i.pet && typeof i.pet === 'object'
      ? {
          c: String(i.pet.c || '').slice(0, 12),
          st: Math.max(0, Math.min(9, Math.round(+i.pet.st || 0))),
          n: String(i.pet.n || '').slice(0, 40)
        }
      : null;
  hereInfo = {
    name: String(i.name || '').slice(0, 60),
    scene: String(i.scene || '').slice(0, 40),
    sceneTitle: String(i.sceneTitle || '').slice(0, 100),
    sprint: Math.max(0, +i.sprint || 0),
    pet
  };
  if (id === openId) await writeHere(id);
  return othersHere(id);
});

/* ---------- shared projects (folders outside the projects folder) ---------- */
const linkId = dir => {
  const base =
    path
      .basename(dir)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'shared';
  return (base.length < 3 ? base + '-project' : base) + '-' + Math.random().toString(36).slice(2, 6);
};
// Opens a project folder someone shared with you (or any project folder): it stays where it is and is listed with your projects.
handle('openShared', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose the shared project folder (the one with project.json in it)',
    defaultPath: app.getPath('home'),
    properties: ['openDirectory']
  });
  if (r.canceled || !r.filePaths[0]) return null;
  let dir = path.resolve(r.filePaths[0]);
  if (!fs.existsSync(path.join(dir, 'project.json'))) {
    // they may have picked the folder around it: accept it when exactly one project is inside
    const inner = (await fsp.readdir(dir, { withFileTypes: true })).filter(
      d => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'project.json'))
    );
    if (inner.length !== 1) return { error: 'notProject' };
    dir = path.join(dir, inner[0].name);
  }
  JSON.parse(await fsp.readFile(path.join(dir, 'project.json'), 'utf8')); // throws when it is not a project
  if (path.dirname(dir) === path.resolve(projectsDir()) && ID_RE.test(path.basename(dir)))
    return { id: path.basename(dir) };
  settings.links = settings.links || {};
  for (const [id, d] of Object.entries(settings.links)) if (path.resolve(d) === dir) return { id };
  const id = linkId(dir);
  settings.links[id] = dir;
  await saveSettings();
  return { id, added: true };
});
// Moves a project into a folder you choose (inside Dropbox, Google Drive...), so it can be shared from there.
handle('shareMove', async id => {
  const from = projDir(id);
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose where the shared project should live (for example in Dropbox or Google Drive)',
    defaultPath: app.getPath('home'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const to = path.join(path.resolve(r.filePaths[0]), path.basename(from));
  if (path.resolve(to) === path.resolve(from)) return { path: to };
  if (fs.existsSync(to)) return { error: 'exists', path: to };
  await fsp.cp(from, to, { recursive: true });
  JSON.parse(await fsp.readFile(path.join(to, 'project.json'), 'utf8')); // check the copy before letting go of the original
  settings.links = settings.links || {};
  settings.links[id] = to;
  await saveSettings();
  await fsp.rm(path.join(to, HERE), { recursive: true, force: true });
  await shell.trashItem(from).catch(() => fsp.rm(from, { recursive: true, force: true }));
  const st = await diskState(id, true);
  if (st) remember(id, st);
  if (openId === id) await writeHere(id);
  return { path: to };
});
// Takes a shared project off your list without touching its folder (your co-writers still have it).
handle('unlink', async id => {
  if (!isLinked(id)) return false;
  if (openId === id) {
    await dropHere(id);
    openId = null;
  }
  delete settings.links[id];
  delete known[id];
  if (settings.last === id) settings.last = null;
  await saveSettings();
  return true;
});
handle('where', async id => {
  const dir = projDir(id);
  return { path: dir, shared: isLinked(id), synced: SYNC_RE.test(dir), folder: path.basename(dir) };
});

handle('duplicate', async id => {
  const json = await fsp.readFile(path.join(projDir(id), 'project.json'), 'utf8');
  const title = ((JSON.parse(json).meta || {}).title || 'Untitled novel') + ' (copy)';
  return copyProject(id, title, json);
});
handle('trash', async id => {
  if (isLinked(id))
    throw new Error('This is a shared project. Use Remove from list instead, so your co-writers keep it.');
  await shell.trashItem(projDir(id));
  if (settings.last === id) {
    settings.last = null;
    saveSettings();
  }
  if (openId === id) openId = null;
  return true;
});
handle('backups', async id => {
  const bdir = path.join(projDir(id), 'backups');
  if (!fs.existsSync(bdir)) return [];
  return (await fsp.readdir(bdir))
    .filter(n => BACKUP_RE.test(n))
    .sort()
    .reverse();
});
handle('restoreBackup', async (id, name) => {
  if (!BACKUP_RE.test(String(name))) throw new Error('Bad backup');
  const json = await fsp.readFile(path.join(projDir(id), 'backups', name), 'utf8');
  const title =
    ((JSON.parse(json).meta || {}).title || 'Untitled novel') +
    ' (backup ' +
    name.slice(0, 16).replace(/-(\d\d)-(\d\d)$/, ' $1:$2') +
    ')';
  return copyProject(id, title, json);
});
handle('picSave', async (id, bytes, type) => {
  const ext = PIC_TYPES[type];
  if (!ext || !(bytes instanceof Uint8Array) || bytes.length > 25e6) throw new Error('Bad picture');
  const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '.' + ext;
  await writeAtomic(picFile(id, name), Buffer.from(bytes));
  return name;
});
handle('picDelete', async (id, name) => {
  await fsp.unlink(picFile(id, name)).catch(() => {});
  return true;
});
handle('picRead', async (id, name) => {
  const buf = await fsp.readFile(picFile(id, name)),
    ext = name.split('.').pop().toLowerCase();
  const type = Object.keys(PIC_TYPES).find(t => PIC_TYPES[t] === ext) || 'application/octet-stream';
  return 'data:' + type + ';base64,' + buf.toString('base64');
});
const safeName = n => String(n || 'inkling.txt').replace(/[\\/:*?"<>|]+/g, '-');
// `data` is text, or bytes (Uint8Array) for Word and EPUB files.
handle('saveFile', async (name, data) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), safeName(name)) });
  if (r.canceled || !r.filePath) return null;
  await writeAtomic(r.filePath, data instanceof Uint8Array ? Buffer.from(data) : String(data));
  return r.filePath;
});
handle('openFile', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Inkling backup', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const st = await fsp.stat(r.filePaths[0]);
  if (st.size > 300e6) throw new Error('That file is too large.');
  return fsp.readFile(r.filePaths[0], 'utf8');
});
// Manuscript PDF: print the page's generated HTML in a hidden window, with the running header Chromium supports.
handle('pdf', async (html, opts) => {
  const o = opts || {},
    tmp = path.join(app.getPath('temp'), 'inkling-print-' + process.pid + '.html');
  await fsp.writeFile(tmp, String(html));
  const pw = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } });
  try {
    await pw.loadFile(tmp);
    const esc = s =>
      String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const pdf = await pw.webContents.printToPDF({
      pageSize: o.pageSize === 'A4' ? 'A4' : 'Letter',
      printBackground: false,
      preferCSSPageSize: false,
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      displayHeaderFooter: !!o.header,
      headerTemplate:
        '<div style="font-family:' +
        esc(o.font || 'Times New Roman') +
        ',serif;font-size:11px;width:100%;text-align:right;padding:0 0.9in;color:#000">' +
        esc(o.header) +
        ' / <span class="pageNumber"></span></div>',
      footerTemplate: '<span></span>'
    });
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.join(app.getPath('documents'), safeName(o.name || 'manuscript.pdf')),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (r.canceled || !r.filePath) return null;
    await writeAtomic(r.filePath, pdf);
    return r.filePath;
  } finally {
    pw.destroy();
    fsp.unlink(tmp).catch(() => {});
  }
});
handle('reveal', async id => {
  const d = id ? projDir(id) : projectsDir();
  await fsp.mkdir(d, { recursive: true });
  return shell.openPath(d);
});
handle('dir', async () => projectsDir());
handle('setTitle', async t => {
  if (win) win.setTitle(String(t || 'Inkling').slice(0, 160));
  return true;
});

/* ---------- settings, projects folder, updates ---------- */
const ses = () => session.defaultSession;
handle('prefs', async () => ({
  version: app.getVersion(),
  platform: process.platform,
  packaged: app.isPackaged,
  host: os.hostname(),
  dir: projectsDir(),
  defaultDir: defaultDir(),
  autoUpdate: settings.autoUpdate !== false,
  lastVersion: settings.lastVersion || null,
  spell: (ses().getSpellCheckerLanguages() || [])[0] || '',
  spellLangs: process.platform === 'darwin' ? [] : ses().availableSpellCheckerLanguages,
  update: upd
}));
handle('setPrefs', async p => {
  p = p || {};
  if ('autoUpdate' in p) settings.autoUpdate = !!p.autoUpdate;
  if ('lastVersion' in p) settings.lastVersion = String(p.lastVersion).slice(0, 40);
  if (p.spell && process.platform !== 'darwin' && ses().availableSpellCheckerLanguages.includes(p.spell)) {
    ses().setSpellCheckerLanguages([p.spell]);
    settings.spell = p.spell;
  }
  await saveSettings();
  return true;
});
handle('chooseDir', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose a folder for your Inkling projects',
    defaultPath: projectsDir(),
    properties: ['openDirectory', 'createDirectory']
  });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
});
// Switch the projects folder. With `move`, each project is copied, checked, and only then its old folder goes to the
// trash; a project whose name already exists in the new folder is left where it was.
handle('useDir', async (dir, move) => {
  dir = dir ? path.resolve(String(dir)) : defaultDir();
  await fsp.mkdir(dir, { recursive: true });
  const old = projectsDir(),
    res = { moved: 0, skipped: [], failed: [] };
  if (openId) await dropHere(openId);
  if (move && path.resolve(old) !== dir && fs.existsSync(old)) {
    for (const d of await fsp.readdir(old, { withFileTypes: true })) {
      if (!d.isDirectory() || !ID_RE.test(d.name) || !fs.existsSync(path.join(old, d.name, 'project.json'))) continue;
      const to = path.join(dir, d.name);
      if (fs.existsSync(to)) {
        res.skipped.push(d.name);
        continue;
      }
      try {
        await fsp.cp(path.join(old, d.name), to, { recursive: true });
        JSON.parse(await fsp.readFile(path.join(to, 'project.json'), 'utf8'));
        // the copy checked out, so the old folder can go (to the trash where the system has one)
        await shell
          .trashItem(path.join(old, d.name))
          .catch(() => fsp.rm(path.join(old, d.name), { recursive: true, force: true }));
        res.moved++;
      } catch (e) {
        res.failed.push(d.name);
      }
    }
  }
  settings.dir = path.resolve(dir) === path.resolve(defaultDir()) ? undefined : dir;
  openId = null;
  for (const k of Object.keys(known)) if (!isLinked(k)) delete known[k];
  await saveSettings();
  return res;
});
handle('checkUpdates', async () => {
  if (!updater || !app.isPackaged) return { state: 'unavailable' };
  try {
    const r = await updater.checkForUpdates();
    return r && r.updateInfo && r.updateInfo.version !== app.getVersion() ? upd : { state: 'none' };
  } catch (e) {
    return { state: 'error', message: String((e && e.message) || e) };
  }
});
handle('installUpdate', async () => {
  if (upd.state === 'ready' && updater) {
    closing = true;
    setImmediate(() => updater.quitAndInstall());
  }
  return true;
});
handle('openReleases', async version => {
  shell.openExternal(version && /^[\w.-]+$/.test(version) ? RELEASES + '/tag/v' + version : RELEASES + '/latest');
  return true;
});
ipcMain.on('ink:closeReady', e => {
  if (win && e.sender === win.webContents) {
    dropHere(openId).finally(() => {
      closing = true;
      if (win) win.close();
    });
  }
});

// Windows and Linux download the update in the background and install it on restart. macOS needs a signed app to
// update itself, so there Inkling only says a new version exists and opens the download page.
function setupUpdates() {
  if (!app.isPackaged) return;
  try {
    updater = require('electron-updater').autoUpdater;
  } catch (e) {
    return;
  }
  updater.autoDownload = process.platform !== 'darwin';
  updater.autoInstallOnAppQuit = process.platform !== 'darwin';
  const tell = s => {
    upd = s;
    if (win) win.webContents.send('ink:update', s);
  };
  updater.on('update-available', i =>
    tell({ state: updater.autoDownload ? 'downloading' : 'available', version: i.version })
  );
  updater.on('update-downloaded', i => tell({ state: 'ready', version: i.version }));
  updater.on('error', e => {
    upd = { state: 'error', message: String((e && e.message) || e) };
  });
  if (settings.autoUpdate !== false) setTimeout(() => updater.checkForUpdates().catch(() => {}), 10000);
}

/* ---------- window and menu ---------- */
const send = a => {
  if (win) win.webContents.send('ink:menu', a);
};
function buildMenu() {
  const mac = process.platform === 'darwin';
  const tpl = [
    ...(mac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => send('prefs') },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New project…', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'Projects…', accelerator: 'CmdOrCtrl+O', click: () => send('projects') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { type: 'separator' },
        { label: 'Export…', accelerator: 'CmdOrCtrl+E', click: () => send('export') },
        { label: 'Back up this project…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('backup') },
        { label: 'Import a backup as a new project…', click: () => send('import') },
        { type: 'separator' },
        { label: 'Share this project…', click: () => send('share') },
        { label: 'Open a shared project…', click: () => send('openShared') },
        { type: 'separator' },
        { label: 'Show projects folder', click: () => shell.openPath(projectsDir()) },
        ...(mac
          ? []
          : [
              { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => send('prefs') },
              { type: 'separator' },
              { role: 'quit' }
            ])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: 'Redo', accelerator: mac ? 'Cmd+Shift+Z' : 'Ctrl+Y', click: () => send('redo') },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Search everything…', accelerator: 'CmdOrCtrl+K', click: () => send('search') },
        { label: 'Find and replace…', accelerator: 'CmdOrCtrl+Shift+F', click: () => send('find') },
        { label: 'Continuity check', click: () => send('cont') },
        { label: 'Scene snapshots…', click: () => send('snapshots') },
        { type: 'separator' },
        { label: 'Trash', click: () => send('trash') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Writing sessions', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('sessions') },
        { label: 'Deadline planner', click: () => send('plan') },
        { label: 'Story insights', click: () => send('story') },
        { label: 'Calendars & money', click: () => send('world') },
        { label: 'Series bible', click: () => send('series') },
        { label: 'Start or pause the focus timer', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('timer') },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Developer tools' }
      ]
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Go to…', accelerator: 'CmdOrCtrl+P', click: () => send('qs') },
        { type: 'separator' },
        { label: 'Back', accelerator: mac ? 'Cmd+[' : 'Alt+Left', click: () => send('back') },
        { label: 'Forward', accelerator: mac ? 'Cmd+]' : 'Alt+Right', click: () => send('fwd') },
        { type: 'separator' },
        { label: 'Next scene', accelerator: 'CmdOrCtrl+PageDown', click: () => send('next') },
        { label: 'Previous scene', accelerator: 'CmdOrCtrl+PageUp', click: () => send('prev') }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Project settings…', click: () => send('layout') },
        { type: 'separator' },
        { label: 'Show or hide the binder', accelerator: 'CmdOrCtrl+Shift+1', click: () => send('tBinder') },
        { label: 'Show or hide the Inkling panel', accelerator: 'CmdOrCtrl+Shift+2', click: () => send('tInsp') },
        { label: 'Focus mode', accelerator: 'CmdOrCtrl+Shift+3', click: () => send('focus') },
        { label: 'Side by side', accelerator: 'CmdOrCtrl+\\', click: () => send('split') },
        { type: 'separator' },
        { role: 'minimize' },
        ...(mac ? [{ role: 'zoom' }, { type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])
      ]
    },
    {
      role: 'help',
      submenu: [
        { label: 'Show the tour', click: () => send('tour') },
        { label: 'Keyboard shortcuts', click: () => send('keys') },
        { label: 'How sharing works', click: () => send('helpShare') },
        { label: 'Check for updates…', click: () => send('updcheck') },
        { label: 'What’s new', click: () => shell.openExternal(RELEASES + '/tag/v' + app.getVersion()) },
        { type: 'separator' },
        { label: 'Where are my projects?', click: () => shell.openPath(projectsDir()) },
        {
          label: 'About Inkling',
          click: () =>
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About Inkling',
              message: 'Inkling ' + app.getVersion(),
              detail:
                'Your projects are saved on this computer in:\n' +
                projectsDir() +
                '\n\nEach project keeps automatic backups in its backups folder. Inkling contacts GitHub only to check for updates, and you can turn that off in Settings.'
            })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}
function createWindow() {
  const st = settings.win || {};
  win = new BrowserWindow({
    width: st.w || 1400,
    height: st.h || 900,
    x: st.x,
    y: st.y,
    minWidth: 380,
    minHeight: 480,
    show: false,
    title: 'Inkling',
    backgroundColor: '#E7EBF1',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });
  if (st.max) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // Inkling never navigates away or opens windows; links (if any) go to the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  // Right-click: spelling suggestions plus the usual edit commands.
  win.webContents.on('context-menu', (e, p) => {
    const items = (p.dictionarySuggestions || [])
      .slice(0, 6)
      .map(s => ({ label: s, click: () => win.webContents.replaceMisspelling(s) }));
    if (p.misspelledWord)
      items.push({
        label: 'Add to dictionary',
        click: () => win.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord)
      });
    if (items.length) items.push({ type: 'separator' });
    if (p.isEditable)
      items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' });
    else if (p.selectionText) items.push({ role: 'copy' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
  win.on('focus', () => {
    if (win) win.webContents.send('ink:focus');
  });
  // Closing: let the page finish saving first (it answers with closeReady), with a safety timeout.
  win.on('close', e => {
    const b = win.getNormalBounds();
    settings.win = { x: b.x, y: b.y, w: b.width, h: b.height, max: win.isMaximized() };
    saveSettings();
    if (closing) return;
    e.preventDefault();
    win.webContents.send('ink:closing');
    setTimeout(() => {
      if (!closing && win) {
        closing = true;
        dropHere(openId).finally(() => win && win.close());
      }
    }, 5000);
  });
  win.on('closed', () => {
    win = null;
  });
}

if (!app.requestSingleInstanceLock())
  app.quit(); // one window, so two copies never write the same project
else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    loadSettings();
    saveSettings();
    if (settings.spell && process.platform !== 'darwin')
      try {
        ses().setSpellCheckerLanguages([settings.spell]);
      } catch (e) {}
    protocol.handle('inkpic', req => {
      // inkpic://p/<project id>/<picture file>
      try {
        const u = new URL(req.url),
          parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
        if (u.host !== 'p' || parts.length !== 2) return new Response('Not found', { status: 404 });
        return net.fetch(pathToFileURL(picFile(parts[0], parts[1])).toString());
      } catch (e) {
        return new Response('Not found', { status: 404 });
      }
    });
    buildMenu();
    createWindow();
    setupUpdates();
  });
  app.on('window-all-closed', () => app.quit());
}
