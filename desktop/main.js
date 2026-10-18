'use strict';
// Inkling desktop: wraps index.html in a window and keeps every project as a folder on this computer.
//   <projects folder>/<project id>/project.json   the whole project (same shape as a JSON backup)
//                                  /info.json     title, words and save time for the Projects screen
//                                  /pictures/     story page pictures, one file each
//                                  /backups/      automatic copies of project.json, newest kept
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { pathToFileURL } = require('url');

const ID_RE = /^[a-z0-9][a-z0-9_-]{2,60}$/i;
const PIC_RE = /^[a-z0-9][a-z0-9_.-]{0,80}$/i;
const PIC_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif', 'image/bmp': 'bmp' };
const BACKUP_EVERY = 10 * 60 * 1000;   // at most one automatic backup per project every 10 minutes
const BACKUPS_KEPT = 40;

protocol.registerSchemesAsPrivileged([{ scheme: 'inkpic', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let win = null, closing = false, settings = {};
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const projectsDir = () => settings.dir || path.join(app.getPath('documents'), 'Inkling Projects');
function projDir(id) { if (!ID_RE.test(String(id || ''))) throw new Error('Bad project id'); return path.join(projectsDir(), id); }
function picFile(id, name) { if (!PIC_RE.test(String(name || ''))) throw new Error('Bad picture name'); return path.join(projDir(id), 'pictures', name); }

async function writeAtomic(file, data) {
  // Write beside the file, flush to disk, then swap it in, so a crash mid-save never leaves half a novel.
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  const fh = await fsp.open(tmp, 'w');
  try { await fh.writeFile(data); await fh.sync(); } finally { await fh.close(); }
  await fsp.rename(tmp, file);
}
function loadSettings() { try { settings = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) || {}; } catch (e) { settings = {}; } }
const saveSettings = () => writeAtomic(settingsFile(), JSON.stringify(settings, null, 1)).catch(() => {});
const readJson = async (file) => { try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch (e) { return null; } };
const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
function newId(title) {
  const base = String(title || 'novel').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'novel';
  return base + '-' + Math.random().toString(36).slice(2, 7);
}

async function backupIfDue(id) {
  const dir = projDir(id), cur = path.join(dir, 'project.json'), bdir = path.join(dir, 'backups');
  if (!fs.existsSync(cur)) return;
  await fsp.mkdir(bdir, { recursive: true });
  const names = (await fsp.readdir(bdir)).filter(n => n.endsWith('.json')).sort();
  const last = names.length ? (await fsp.stat(path.join(bdir, names[names.length - 1]))).mtimeMs : 0;
  if (Date.now() - last < BACKUP_EVERY) return;
  await fsp.copyFile(cur, path.join(bdir, stamp() + '.json'));
  const all = (await fsp.readdir(bdir)).filter(n => n.endsWith('.json')).sort();
  for (const n of all.slice(0, Math.max(0, all.length - BACKUPS_KEPT))) await fsp.unlink(path.join(bdir, n)).catch(() => {});
}
async function copyProject(fromId, title, json) {
  const id = newId(title), from = projDir(fromId), to = projDir(id);
  await fsp.mkdir(path.join(to, 'pictures'), { recursive: true });
  if (fs.existsSync(path.join(from, 'pictures'))) await fsp.cp(path.join(from, 'pictures'), path.join(to, 'pictures'), { recursive: true });
  const o = JSON.parse(json);
  o.meta = o.meta || {}; o.meta.title = title; o.meta.saved = Date.now();
  await writeAtomic(path.join(to, 'project.json'), JSON.stringify(o));
  const info = (await readJson(path.join(from, 'info.json'))) || {};
  await writeAtomic(path.join(to, 'info.json'), JSON.stringify(Object.assign(info, { title, saved: Date.now() })));
  return id;
}

/* ---------- requests from the page ---------- */
const handle = (name, fn) => ipcMain.handle('ink:' + name, async (e, ...args) => {
  if (!win || e.sender !== win.webContents) throw new Error('Not allowed');
  return fn(...args);
});
handle('list', async () => {
  const root = projectsDir(); await fsp.mkdir(root, { recursive: true });
  const out = [];
  for (const d of await fsp.readdir(root, { withFileTypes: true })) {
    if (!d.isDirectory() || !ID_RE.test(d.name) || !fs.existsSync(path.join(root, d.name, 'project.json'))) continue;
    const info = (await readJson(path.join(root, d.name, 'info.json'))) || {};
    const st = await fsp.stat(path.join(root, d.name, 'project.json'));
    out.push({ id: d.name, title: String(info.title || d.name), words: +info.words || 0, saved: +info.saved || st.mtimeMs, sample: !!info.sample });
  }
  return out.sort((a, b) => b.saved - a.saved);
});
handle('create', async (title) => { const id = newId(title); await fsp.mkdir(path.join(projDir(id), 'pictures'), { recursive: true }); return id; });
handle('load', async (id) => {
  const file = path.join(projDir(id), 'project.json');
  let data = null; try { data = await fsp.readFile(file, 'utf8'); } catch (e) {}
  if (data != null) { settings.last = id; saveSettings(); }
  return data;
});
handle('last', async () => (settings.last && ID_RE.test(settings.last) && fs.existsSync(path.join(projDir(settings.last), 'project.json'))) ? settings.last : null);
handle('save', async (id, json, info) => {
  if (typeof json !== 'string') throw new Error('Bad data');
  await backupIfDue(id);
  await writeAtomic(path.join(projDir(id), 'project.json'), json);
  const i = info && typeof info === 'object' ? info : {};
  await writeAtomic(path.join(projDir(id), 'info.json'), JSON.stringify({ title: String(i.title || '').slice(0, 120), words: +i.words || 0, sample: !!i.sample, saved: Date.now() }));
  return true;
});
handle('duplicate', async (id) => {
  const json = await fsp.readFile(path.join(projDir(id), 'project.json'), 'utf8');
  const title = ((JSON.parse(json).meta || {}).title || 'Untitled novel') + ' (copy)';
  return copyProject(id, title, json);
});
handle('trash', async (id) => { await shell.trashItem(projDir(id)); if (settings.last === id) { settings.last = null; saveSettings(); } return true; });
handle('backups', async (id) => {
  const bdir = path.join(projDir(id), 'backups'); if (!fs.existsSync(bdir)) return [];
  return (await fsp.readdir(bdir)).filter(n => /^[\d-]+\.json$/.test(n)).sort().reverse();
});
handle('restoreBackup', async (id, name) => {
  if (!/^[\d-]+\.json$/.test(String(name))) throw new Error('Bad backup');
  const json = await fsp.readFile(path.join(projDir(id), 'backups', name), 'utf8');
  const title = ((JSON.parse(json).meta || {}).title || 'Untitled novel') + ' (backup ' + name.slice(0, 16).replace(/-(\d\d)-(\d\d)$/, ' $1:$2') + ')';
  return copyProject(id, title, json);
});
handle('picSave', async (id, bytes, type) => {
  const ext = PIC_TYPES[type]; if (!ext || !(bytes instanceof Uint8Array) || bytes.length > 25e6) throw new Error('Bad picture');
  const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '.' + ext;
  await writeAtomic(picFile(id, name), Buffer.from(bytes));
  return name;
});
handle('picDelete', async (id, name) => { await fsp.unlink(picFile(id, name)).catch(() => {}); return true; });
handle('picRead', async (id, name) => {
  const buf = await fsp.readFile(picFile(id, name)), ext = name.split('.').pop().toLowerCase();
  const type = Object.keys(PIC_TYPES).find(t => PIC_TYPES[t] === ext) || 'application/octet-stream';
  return 'data:' + type + ';base64,' + buf.toString('base64');
});
handle('saveFile', async (name, data) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), String(name || 'inkling.txt').replace(/[\\/:*?"<>|]+/g, '-')) });
  if (r.canceled || !r.filePath) return null;
  await writeAtomic(r.filePath, String(data)); return r.filePath;
});
handle('openFile', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Inkling backup', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  const st = await fsp.stat(r.filePaths[0]); if (st.size > 300e6) throw new Error('That file is too large.');
  return fsp.readFile(r.filePaths[0], 'utf8');
});
handle('reveal', async (id) => { const d = id ? projDir(id) : projectsDir(); await fsp.mkdir(d, { recursive: true }); return shell.openPath(d); });
handle('dir', async () => projectsDir());
handle('setTitle', async (t) => { if (win) win.setTitle(String(t || 'Inkling').slice(0, 160)); return true; });
ipcMain.on('ink:closeReady', (e) => { if (win && e.sender === win.webContents) { closing = true; win.close(); } });

/* ---------- window and menu ---------- */
const send = (a) => { if (win) win.webContents.send('ink:menu', a); };
function buildMenu() {
  const mac = process.platform === 'darwin';
  const tpl = [
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'New project…', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
      { label: 'Projects…', accelerator: 'CmdOrCtrl+O', click: () => send('projects') },
      { type: 'separator' },
      { label: 'Back up this project…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('backup') },
      { label: 'Export manuscript…', accelerator: 'CmdOrCtrl+E', click: () => send('export') },
      { label: 'Import a backup as a new project…', click: () => send('import') },
      { type: 'separator' },
      { label: 'Show projects folder', click: () => shell.openPath(projectsDir()) },
      ...(mac ? [] : [{ type: 'separator' }, { role: 'quit' }])
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ label: 'Writing sessions', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('sessions') }, { label: 'Start or pause the focus timer', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('timer') }, { type: 'separator' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { type: 'separator' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'toggleDevTools', label: 'Developer tools' }] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [
      { label: 'Where are my projects?', click: () => shell.openPath(projectsDir()) },
      { label: 'About Inkling', click: () => dialog.showMessageBox(win, { type: 'info', title: 'About Inkling', message: 'Inkling ' + app.getVersion(), detail: 'Your projects are saved on this computer in:\n' + projectsDir() + '\n\nEach project keeps automatic backups in its backups folder.' }) }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}
function createWindow() {
  const st = settings.win || {};
  win = new BrowserWindow({
    width: st.w || 1400, height: st.h || 900, x: st.x, y: st.y, minWidth: 380, minHeight: 480, show: false,
    title: 'Inkling', backgroundColor: '#E7EBF1', icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true }
  });
  if (st.max) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // Inkling never navigates away or opens windows; links (if any) go to the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (url !== win.webContents.getURL()) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // Right-click: spelling suggestions plus the usual edit commands.
  win.webContents.on('context-menu', (e, p) => {
    const items = (p.dictionarySuggestions || []).slice(0, 6).map(s => ({ label: s, click: () => win.webContents.replaceMisspelling(s) }));
    if (p.misspelledWord) items.push({ label: 'Add to dictionary', click: () => win.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord) });
    if (items.length) items.push({ type: 'separator' });
    if (p.isEditable) items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' });
    else if (p.selectionText) items.push({ role: 'copy' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
  // Closing: let the page finish saving first (it answers with closeReady), with a safety timeout.
  win.on('close', (e) => {
    const b = win.getNormalBounds(); settings.win = { x: b.x, y: b.y, w: b.width, h: b.height, max: win.isMaximized() }; saveSettings();
    if (closing) return;
    e.preventDefault(); win.webContents.send('ink:closing');
    setTimeout(() => { if (!closing && win) { closing = true; win.close(); } }, 5000);
  });
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) app.quit();   // one window, so two copies never write the same project
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    loadSettings();
    protocol.handle('inkpic', (req) => {   // inkpic://p/<project id>/<picture file>
      try {
        const u = new URL(req.url), parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
        if (u.host !== 'p' || parts.length !== 2) return new Response('Not found', { status: 404 });
        return net.fetch(pathToFileURL(picFile(parts[0], parts[1])).toString());
      } catch (e) { return new Response('Not found', { status: 404 }); }
    });
    buildMenu(); createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
