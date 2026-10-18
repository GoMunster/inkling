// The Electron desktop app: projects on disk, safe saving, the two-computer checks, moving the projects folder.
// Needs `npm ci` in desktop/ (for Electron). On Linux without a screen, run under xvfb-run.
const { test, expect, _electron } = require('@playwright/test');
const fs = require('fs'), os = require('os'), path = require('path');

const DESKTOP = path.join(__dirname, '..', 'desktop');
let electronPath = null; try { electronPath = require(path.join(DESKTOP, 'node_modules', 'electron')); } catch (e) {}
test.skip(!electronPath, 'Run npm ci in desktop/ to test the desktop app');
// The app window loads desktop/app, built from the current index.html.
test.beforeAll(() => { if (electronPath) require('child_process').execFileSync(process.execPath, [path.join(DESKTOP, 'scripts', 'prepare.js')]); });

async function launch(home) {
  const app = await _electron.launch({ executablePath: electronPath, args: [DESKTOP, '--no-sandbox'],
    env: Object.assign({}, process.env, { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), APPDATA: path.join(home, 'AppData') }) });
  const win = await app.firstWindow(); const errors = [];
  win.on('pageerror', e => errors.push(e.message));
  await win.waitForSelector('#pjBtn'); await win.waitForTimeout(800);
  await win.evaluate(() => { const b = document.querySelector('#tour [data-t="end"]'); if (b) b.click(); });
  return { app, win, errors };
}
const projectsDir = (app) => app.evaluate(({ app }) => app.getPath('documents')).then(d => path.join(d, 'Inkling Projects'));
const newHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'inkling-home-'));
const typeInScene = async (win, text) => { await win.click('#ed'); await win.keyboard.press('Control+End'); await win.keyboard.type(text); };
async function until(fn, ms = 8000) { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v || Date.now() > end) return v; await new Promise(r => setTimeout(r, 150)); } }

test('first run makes a sample project, saves to disk, and reopens it', async () => {
  const home = newHome();
  let { app, win, errors } = await launch(home);
  const dir = await projectsDir(app), ids = fs.readdirSync(dir);
  expect(ids.length).toBe(1);
  const file = path.join(dir, ids[0], 'project.json');
  expect(fs.existsSync(path.join(dir, ids[0], '.inkling-lock.json'))).toBe(true);
  await typeInScene(win, ' Saved on disk.');
  expect(await until(() => fs.readFileSync(file, 'utf8').includes('Saved on disk.'))).toBe(true);
  const pj = JSON.parse(fs.readFileSync(file, 'utf8')); expect(pj.meta.v).toBe(2);
  await typeInScene(win, ' Written just before closing.');
  await app.close();   // the window waits for the last save
  expect(fs.readFileSync(file, 'utf8')).toContain('Written just before closing.');
  expect(fs.existsSync(path.join(dir, ids[0], '.inkling-lock.json'))).toBe(false);
  ({ app, win } = await launch(home));
  await expect(win.locator('#ed')).toContainText('Written just before closing.');
  expect(errors).toEqual([]);
  await app.close();
});

test('warns about a project open on another computer, and about edits that arrive from one', async () => {
  const home = newHome();
  const { app, win, errors } = await launch(home);
  const dir = await projectsDir(app);
  // a second project, then pretend another computer has it open
  await win.click('#pjBtn'); await win.click('[data-pj="blank"]'); await win.waitForTimeout(600);
  const other = fs.readdirSync(dir).find(id => !/sample/.test(id));
  await win.click('#pjBtn'); await win.click('[data-pj="open"][data-id^="the-lantern"]'); await win.waitForTimeout(500);
  fs.writeFileSync(path.join(dir, other, '.inkling-lock.json'), JSON.stringify({ device: 'elsewhere', host: 'Study-PC', at: Date.now() }));
  await win.click('#pjBtn'); await win.click('[data-pj="open"][data-id="' + other + '"]');
  await expect(win.locator('.ask')).toContainText('Study-PC');
  await win.click('.ask [data-v="open"]'); await win.waitForTimeout(500);
  // another computer saves through the sync folder
  const file = path.join(dir, other, 'project.json');
  await new Promise(r => setTimeout(r, 1200));
  const pj = JSON.parse(fs.readFileSync(file, 'utf8')); pj.meta.title = 'From the other computer'; fs.writeFileSync(file, JSON.stringify(pj));
  await win.click('.sc-btn'); await typeInScene(win, 'Typed here.');
  await expect(win.locator('.ask h2')).toHaveText('This project changed on another computer');
  await win.click('.ask [data-v="theirs"]');
  await expect(win.locator('#projTitle')).toHaveValue('From the other computer');
  expect(fs.readdirSync(path.join(dir, other, 'backups')).some(f => /-yours\.json$/.test(f))).toBe(true);
  expect(errors).toEqual([]);
  await app.close();
});

test('moves the projects folder (for Dropbox and similar)', async () => {
  const home = newHome();
  const { app, win, errors } = await launch(home);
  const dir = await projectsDir(app), target = path.join(home, 'Dropbox', 'Inkling');
  fs.mkdirSync(target, { recursive: true });
  await app.evaluate(({ dialog }, d) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [d] }); }, target);
  await win.click('#menuBtn'); await win.click('[data-m="prefs"]');
  await win.click('[data-pf="dir"]'); await win.click('.ask [data-v="move"]');
  await expect(win.locator('.pf code').first()).toHaveText(target);
  expect(fs.readdirSync(target).length).toBe(1);
  expect(fs.readdirSync(dir).length).toBe(0);
  await win.click('.sc-btn'); await typeInScene(win, ' In the new folder.');
  const file = path.join(target, fs.readdirSync(target)[0], 'project.json');
  expect(await until(() => fs.readFileSync(file, 'utf8').includes('In the new folder.'))).toBe(true);
  expect(errors).toEqual([]);
  await app.close();
});

test('exports a manuscript PDF', async () => {
  const home = newHome();
  const { app, win } = await launch(home);
  const out = path.join(home, 'book.pdf');
  await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, out);
  await win.click('#menuBtn'); await win.click('[data-m="export"]'); await win.click('[data-fmt="pdf"]'); await win.click('[data-x="go"]');
  expect(await until(() => fs.existsSync(out) && fs.statSync(out).size > 1000)).toBe(true);
  expect(fs.readFileSync(out).subarray(0, 5).toString()).toBe('%PDF-');
  await app.close();
});

test('shows the update prompt', async () => {
  const { app, win } = await launch(newHome());
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('ink:update', { state: 'ready', version: '9.9.9' }));
  await expect(win.locator('#updBar')).toContainText('Inkling 9.9.9 is ready to install');
  await expect(win.locator('#updBar [data-u="install"]')).toHaveText('Restart to update');
  await app.close();
});
