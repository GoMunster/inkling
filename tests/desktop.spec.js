// The Electron desktop app: projects on disk, safe saving, the two-computer checks, moving the projects folder.
// Needs `npm ci` in desktop/ (for Electron). On Linux without a screen, run under xvfb-run.
const { test, expect, _electron } = require('@playwright/test');
const fs = require('fs'),
  os = require('os'),
  path = require('path');

const DESKTOP = path.join(__dirname, '..', 'desktop');
let electronPath = null;
try {
  electronPath = require(path.join(DESKTOP, 'node_modules', 'electron'));
} catch (e) {}
test.skip(!electronPath, 'Run npm ci in desktop/ to test the desktop app');
// The app window loads desktop/app, built from the current index.html.
test.beforeAll(() => {
  if (electronPath)
    require('child_process').execFileSync(process.execPath, [path.join(DESKTOP, 'scripts', 'prepare.js')]);
});

async function launch(home) {
  const app = await _electron.launch({
    executablePath: electronPath,
    args: [DESKTOP, '--no-sandbox'],
    env: Object.assign({}, process.env, {
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, '.config'),
      APPDATA: path.join(home, 'AppData')
    })
  });
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', e => errors.push(e.message));
  await win.waitForSelector('#pjBtn');
  await win.waitForTimeout(800);
  await win.evaluate(() => {
    const b = document.querySelector('#tour [data-t="end"]');
    if (b) b.click();
  });
  return { app, win, errors };
}
const projectsDir = app =>
  app.evaluate(({ app }) => app.getPath('documents')).then(d => path.join(d, 'Inkling Projects'));
const newHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'inkling-home-'));
const typeInScene = async (win, text) => {
  await win.click('#ed');
  await win.keyboard.press('Control+End');
  await win.keyboard.type(text);
};
async function until(fn, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v || Date.now() > end) return v;
    await new Promise(r => setTimeout(r, 150));
  }
}

test('first run makes a sample project, saves to disk, and reopens it', async () => {
  const home = newHome();
  let { app, win, errors } = await launch(home);
  const dir = await projectsDir(app),
    ids = fs.readdirSync(dir);
  expect(ids.length).toBe(1);
  const file = path.join(dir, ids[0], 'project.json');
  expect(fs.readdirSync(path.join(dir, ids[0], '.inkling-here')).length).toBe(1); // "this computer has it open"
  await typeInScene(win, ' Saved on disk.');
  expect(await until(() => fs.readFileSync(file, 'utf8').includes('Saved on disk.'))).toBe(true);
  const pj = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(pj.meta.v).toBe(2);
  await typeInScene(win, ' Written just before closing.');
  await app.close(); // the window waits for the last save
  expect(fs.readFileSync(file, 'utf8')).toContain('Written just before closing.');
  expect(fs.readdirSync(path.join(dir, ids[0], '.inkling-here')).length).toBe(0);
  ({ app, win } = await launch(home));
  await expect(win.locator('#ed')).toContainText('Written just before closing.');
  expect(errors).toEqual([]);
  await app.close();
});

const stubFolder = (app, dir) =>
  app.evaluate(({ dialog }, d) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [d] });
  }, dir);
const focus = app =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('ink:focus'));
async function setName(win, name) {
  await win.click('#menuBtn');
  await win.click('[data-m="prefs"]');
  await win.fill('#pfName', name);
  await win.press('#pfName', 'Tab');
}
const sceneText = (win, i) =>
  win.evaluate(i => {
    const b = document.querySelectorAll('#binder .sc-btn')[i];
    b.click();
    return document.querySelector('#ed').textContent;
  }, i);
// Brings in the other computer's saves: wait for this computer's save, then nudge the sync check until `ok` holds.
async function syncUntil(app, win, ok, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    await focus(app);
    await win.waitForTimeout(400);
    if (await ok()) return true;
    if (Date.now() > end) return false;
  }
}

test('two writers share one project through a synced folder', async () => {
  test.setTimeout(150000);
  const shared = fs.mkdtempSync(path.join(os.tmpdir(), 'Dropbox-'));
  const A = await launch(newHome()),
    B = await launch(newHome());
  await setName(A.win, 'Ann');
  await setName(B.win, 'Ben');

  // Ann moves the sample into the shared folder; Ben opens it from there
  await stubFolder(A.app, shared);
  await A.win.click('#menuBtn');
  await A.win.click('[data-m="share"]');
  await A.win.click('[data-sh="move"]');
  await expect(A.win.locator('.sh-steps li').first()).toHaveClass(/done/);
  await A.win.click('.share [data-sh="close"] >> nth=-1');
  const proj = path.join(shared, fs.readdirSync(shared)[0]),
    file = path.join(proj, 'project.json');
  await stubFolder(B.app, proj);
  await B.win.click('#pjBtn');
  await B.win.click('[data-pj="openShared"]');
  await expect(B.win.locator('#projTitle')).toHaveValue(/Lantern Tide/);
  expect(await syncUntil(B.app, B.win, async () => /Ann/.test(await B.win.locator('#hereChip').textContent()))).toBe(
    true
  );
  expect(await syncUntil(A.app, A.win, async () => /Ben/.test(await A.win.locator('#hereChip').textContent()))).toBe(
    true
  );

  // different scenes: both changes survive, on disk and on both screens
  await A.win.click('#binder .sc-btn >> nth=0');
  await typeInScene(A.win, ' Ann was here.');
  await B.win.click('#binder .sc-btn >> nth=1');
  await typeInScene(B.win, ' Ben was here and here.');
  expect(
    (await until(() => {
      const t = fs.readFileSync(file, 'utf8');
      return t.includes('Ann was here.') && t.includes('Ben was here and here.');
    }, 20000)) ||
      (await syncUntil(A.app, A.win, async () => {
        const t = fs.readFileSync(file, 'utf8');
        return t.includes('Ann was here.') && t.includes('Ben was here and here.');
      }))
  ).toBe(true);
  expect(
    await syncUntil(A.app, A.win, async () => (await sceneText(A.win, 1)).includes('Ben was here and here.'))
  ).toBe(true);
  expect(await syncUntil(B.app, B.win, async () => (await sceneText(B.win, 0)).includes('Ann was here.'))).toBe(true);
  expect(await B.win.locator('#binder .here').count()).toBeGreaterThan(0); // Ann's letter beside the scene she is in

  // the same scene at once: the newer text stays, the other is kept as a snapshot named after its writer
  await A.win.click('#binder .sc-btn >> nth=2');
  await B.win.click('#binder .sc-btn >> nth=2');
  await typeInScene(A.win, ' Ann ending.');
  await typeInScene(B.win, ' Ben ending.');
  const merged = async win => {
    const t = await sceneText(win, 2);
    return t.includes('Ben ending.') && !t.includes('Ann ending.');
  };
  expect(await syncUntil(B.app, B.win, () => merged(B.win), 25000)).toBe(true);
  expect(await syncUntil(A.app, A.win, () => merged(A.win), 25000)).toBe(true);
  const pj = JSON.parse(fs.readFileSync(file, 'utf8'));
  const merges = Object.values(pj.sn).filter(x => x.auto === 'merge');
  if (merges.length !== 1) console.log('MERGE SNAPSHOTS', JSON.stringify(merges.map(x => [x.name, x.text.slice(-40)])));
  const snap = merges.find(x => x.text.includes('Ann ending.')) || merges[0];
  expect(snap.name).toBe('Ann’s version');
  expect(snap.text).toContain('Ann ending.');

  // a deletion reaches the other computer
  const ent = await B.win.locator('[data-a="open-e"]').last().getAttribute('data-id');
  // delete asks "Delete?" first: wait for that before confirming
  await B.win.click('[data-a="dele"][data-id="' + ent + '"]', { force: true });
  await B.win.click('[data-a="dele"][data-id="' + ent + '"].on', { force: true });
  expect(
    await syncUntil(
      A.app,
      A.win,
      async () => (await A.win.locator('[data-a="open-e"][data-id="' + ent + '"]').count()) === 0,
      25000
    )
  ).toBe(true);

  // each writer keeps their own daily words and to-do list
  await expect(A.win.locator('#chipTxt')).toHaveText(/^5 \//);
  await expect(B.win.locator('#chipTxt')).toHaveText(/^7 \//);
  await A.win.fill('#tdNew', 'Ann’s task');
  await A.win.press('#tdNew', 'Enter');
  expect(
    await until(() => {
      const w = JSON.parse(fs.readFileSync(file, 'utf8')).meta.writers;
      return Object.values(w).some(x => x.name === 'Ann' && x.todo && x.todo.items.length === 1);
    }, 20000)
  ).toBe(true);
  await B.win.click('#binder .sc-btn >> nth=0');
  await syncUntil(B.app, B.win, async () => true);
  await expect(B.win.locator('.td')).toHaveCount(0);

  // a sync service's conflicted copy is merged in and tidied away
  await new Promise(r => setTimeout(r, 1500));
  const copy = JSON.parse(fs.readFileSync(file, 'utf8')),
    now = Date.now();
  copy.sc.s_stray = {
    text: 'Found in a conflicted copy.',
    synopsis: '',
    notes: '',
    _m: now,
    _dev: 'other',
    _by: 'Cat'
  };
  copy.meta.scenes.s_stray = { title: 'Stray scene', status: 'draft', words: 5 };
  copy.meta.chapters[0].scenes.push('s_stray');
  fs.writeFileSync(path.join(proj, "project (Ann's conflicted copy).json"), JSON.stringify(copy));
  expect(
    await syncUntil(
      A.app,
      A.win,
      async () => (await A.win.locator('#binder .sc-btn', { hasText: 'Stray scene' }).count()) === 1,
      25000
    )
  ).toBe(true);
  // the copy is filed away just after the merged project is saved, a moment after the scene appears
  expect(await until(() => !fs.readdirSync(proj).some(n => /conflicted/.test(n)))).toBe(true);
  expect(fs.readdirSync(path.join(proj, 'backups')).some(n => /conflicted/.test(n))).toBe(true);

  // Ann starts a sprint; Ben sees it, joins, and both timers end together
  await A.win.click('#pmGo');
  expect(
    await syncUntil(B.app, B.win, async () => /sprinting/.test(await B.win.locator('#hereChip').textContent()))
  ).toBe(true);
  await expect(B.win.locator('#petPals .pal')).toHaveCount(1);
  await B.win.click('#hereChip');
  await B.win.click('#herePop [data-hp="join"]');
  await expect(B.win.locator('#pmChip')).toBeVisible();
  const left = w => w.locator('#pmChip .mono').textContent();
  const [a1, b1] = [await left(A.win), await left(B.win)];
  const secs = t => {
    const [m, s] = t.split(':').map(Number);
    return m * 60 + s;
  };
  expect(Math.abs(secs(a1) - secs(b1))).toBeLessThanOrEqual(3);

  expect(A.errors).toEqual([]);
  expect(B.errors).toEqual([]);
  await A.app.close();
  await B.app.close();
});

test('moves the projects folder (for Dropbox and similar)', async () => {
  const home = newHome();
  const { app, win, errors } = await launch(home);
  const dir = await projectsDir(app),
    target = path.join(home, 'Dropbox', 'Inkling');
  fs.mkdirSync(target, { recursive: true });
  await app.evaluate(({ dialog }, d) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [d] });
  }, target);
  await win.click('#menuBtn');
  await win.click('[data-m="prefs"]');
  await win.click('[data-pf="dir"]');
  await win.click('.ask [data-v="move"]');
  await expect(win.locator('.pf code').first()).toHaveText(target);
  expect(fs.readdirSync(target).length).toBe(1);
  expect(fs.readdirSync(dir).length).toBe(0);
  await win.click('.sc-btn');
  await typeInScene(win, ' In the new folder.');
  const file = path.join(target, fs.readdirSync(target)[0], 'project.json');
  expect(await until(() => fs.readFileSync(file, 'utf8').includes('In the new folder.'))).toBe(true);
  expect(errors).toEqual([]);
  await app.close();
});

test('exports a manuscript PDF', async () => {
  const home = newHome();
  const { app, win } = await launch(home);
  const out = path.join(home, 'book.pdf');
  await app.evaluate(({ dialog }, f) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: f });
  }, out);
  await win.click('#menuBtn');
  await win.click('[data-m="export"]');
  await win.click('[data-fmt="pdf"]');
  await win.click('[data-x="go"]');
  expect(await until(() => fs.existsSync(out) && fs.statSync(out).size > 1000)).toBe(true);
  expect(fs.readFileSync(out).subarray(0, 5).toString()).toBe('%PDF-');
  // with front and back matter: a dedication and an about-the-author page add pages
  const pages = f =>
    (
      fs
        .readFileSync(f)
        .toString('latin1')
        .match(/\/Type\s*\/Page\b/g) || []
    ).length;
  const before = pages(out);
  fs.unlinkSync(out);
  await win.click('#menuBtn');
  await win.click('[data-m="book"]');
  await win.fill('[data-bk="ded"]', 'For the tide-watchers.');
  await win.fill('[data-bk="about"]', 'The author lives by the sea.');
  await win.click('#menuBtn');
  await win.click('[data-m="export"]');
  await win.click('[data-fmt="pdf"]');
  await win.check('[data-mat]');
  await win.click('[data-x="go"]');
  expect(await until(() => fs.existsSync(out) && fs.statSync(out).size > 1000)).toBe(true);
  expect(pages(out)).toBeGreaterThan(before + 2);
  await app.close();
});

test('shows the update prompt', async () => {
  const { app, win } = await launch(newHome());
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send('ink:update', { state: 'ready', version: '9.9.9' })
  );
  await expect(win.locator('#updBar')).toContainText('Inkling 9.9.9 is ready to install');
  await expect(win.locator('#updBar [data-u="install"]')).toHaveText('Restart to update');
  await app.close();
});

test('the Window menu and Edit › Undo', async () => {
  const { app, win, errors } = await launch(newHome());
  const menu = (top, label) =>
    app.evaluate(
      ({ Menu }, [t, l]) => {
        const m = Menu.getApplicationMenu().items.find(x => x.label === t);
        m.submenu.items.find(x => x.label === l).click();
      },
      [top, label]
    );
  await menu('Window', 'Show or hide the binder');
  await expect(win.locator('#binder')).toBeHidden();
  await win.waitForTimeout(200);
  await menu('Window', 'Show or hide the binder');
  await expect(win.locator('#binder')).toBeVisible();
  await menu('Window', 'Project settings…');
  await expect(win.locator('#main h1')).toHaveText('Project settings');
  await win.click('#binder .sc-btn >> nth=0');
  const before = await win.locator('#ed').textContent();
  await typeInScene(win, ' Undo me.');
  await win.waitForTimeout(1100);
  await menu('Edit', 'Undo');
  await expect(win.locator('#ed')).toHaveText(before);
  await menu('Help', 'Keyboard shortcuts');
  await expect(win.locator('.ask .keys')).toBeVisible();
  await win.keyboard.press('Escape');
  const t0 = await win.locator('#sceneTitle').inputValue();
  await menu('Go', 'Next scene');
  await expect(win.locator('#sceneTitle')).not.toHaveValue(t0);
  await win.waitForTimeout(150);
  await menu('Go', 'Back');
  await expect(win.locator('#sceneTitle')).toHaveValue(t0);
  await menu('Go', 'Go to…');
  await expect(win.locator('#qsQ')).toBeFocused();
  expect(errors).toEqual([]);
  await app.close();
});

test('series bible: bring a character and its picture in from another book on this computer', async () => {
  const home = newHome();
  const { app, win, errors } = await launch(home);
  const dir = await projectsDir(app),
    other = path.join(dir, 'book-one-x1');
  fs.mkdirSync(path.join(other, 'pictures'), { recursive: true });
  fs.writeFileSync(
    path.join(other, 'pictures', 'orla.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC',
      'base64'
    )
  );
  fs.writeFileSync(
    path.join(other, 'project.json'),
    JSON.stringify({
      meta: {
        v: 2,
        title: 'Book One',
        chapters: [{ id: 'c1', title: 'One', open: true, scenes: ['s1'] }],
        scenes: { s1: { title: 'S', status: 'draft', words: 0 } },
        ents: { k1: { id: 'k1', type: 'char', name: 'Captain Orla', aliases: [], tag: '' } },
        days: {},
        pet: { name: 'Inky', total: 0 }
      },
      sc: { s1: { text: 'Hello', synopsis: '', notes: '' } },
      en: { k1: { fields: { look: 'Grey coat' }, pic: { f: 'orla.png' } } }
    })
  );
  fs.writeFileSync(path.join(other, 'info.json'), JSON.stringify({ title: 'Book One', words: 1, saved: Date.now() }));
  await win.click('#menuBtn');
  await win.click('[data-m="series"]');
  await win.click('[data-sr="book"]:has-text("Book One")');
  await expect(win.locator('.sb-ck:has-text("Captain Orla") small')).toHaveText('new');
  await win.click('[data-sr="bring"]');
  await expect(win.locator('.sb-linked .cl')).toHaveCount(1);
  await expect(win.locator('[data-sr="check"]')).toHaveCount(1);
  const mine = fs.readdirSync(dir).find(d => d !== 'book-one-x1');
  const saved = await until(() => {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, mine, 'project.json'), 'utf8'));
      const e = Object.values(p.meta.ents).find(x => x.name === 'Captain Orla');
      return e && p.en[e.id].pic.f ? p : null;
    } catch (e) {
      return null;
    }
  });
  expect(saved).toBeTruthy();
  const e = Object.values(saved.meta.ents).find(x => x.name === 'Captain Orla');
  expect(e.from).toMatchObject({ book: 'Book One', src: 'book-one-x1', id: 'k1' });
  expect(fs.existsSync(path.join(dir, mine, 'pictures', saved.en[e.id].pic.f))).toBe(true);
  expect(errors).toEqual([]);
  await app.close();
});

test('store-ready ebook: the cover is saved as a file and goes into the EPUB', async () => {
  const home = newHome();
  const { app, win, errors } = await launch(home);
  const { unzip } = require('./helpers');
  const out = path.join(home, 'book.epub');
  await app.evaluate(({ dialog }, f) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: f });
  }, out);
  await win.click('#menuBtn');
  await win.click('[data-m="book"]');
  const png = await win.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 500;
    c.height = 800;
    c.getContext('2d').fillRect(0, 0, 500, 800);
    return c.toDataURL('image/png').split(',')[1];
  });
  await win.setInputFiles('[data-bkcv]', {
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64')
  });
  await expect(win.locator('#bkCvSize')).toHaveText('500 × 800 pixels: too small for stores');
  const dir = await projectsDir(app);
  const saved = await until(() => {
    try {
      const d = fs.readdirSync(dir)[0],
        p = JSON.parse(fs.readFileSync(path.join(dir, d, 'project.json'), 'utf8'));
      return p.meta.book.cover.f && fs.existsSync(path.join(dir, d, 'pictures', p.meta.book.cover.f));
    } catch (e) {
      return false;
    }
  });
  expect(saved).toBe(true);
  await win.click('[data-bka="check"]');
  await expect(win.locator('#bkCheck')).toContainText('The cover is small (500 × 800 pixels)');
  await win.click('#menuBtn');
  await win.click('[data-m="export"]');
  await win.click('[data-fmt="epub"]');
  await win.click('[data-x="go"]');
  expect(await until(() => fs.existsSync(out) && fs.statSync(out).size > 1000)).toBe(true);
  const e = unzip(fs.readFileSync(out));
  expect([...e['OEBPS/cover.jpg'].subarray(0, 2)]).toEqual([0xff, 0xd8]);
  expect(e['OEBPS/content.opf'].toString()).toContain('properties="cover-image"');
  expect(errors).toEqual([]);
  await app.close();
});

test('print book: a print-ready PDF at the trim size, with an even page count', async () => {
  const home = newHome();
  const { app, win, errors } = await launch(home);
  const out = path.join(home, 'book-print.pdf');
  await app.evaluate(({ dialog }, f) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: f });
  }, out);
  await win.click('#menuBtn');
  await win.click('[data-m="book"]');
  await win.fill('[data-bk="author"]', 'Jane Writer');
  await win.selectOption('[data-bkp="trim"]', '6x9');
  await win.click('[data-bka="count"]');
  await expect(win.locator('.bk-facts')).toContainText('Spine width');
  const pages = +(await win.locator('.bk-facts').textContent()).match(/Pages(\d+)/)[1];
  await win.click('#menuBtn');
  await win.click('[data-m="export"]');
  await win.click('[data-fmt="print"]');
  await win.click('[data-x="go"]');
  expect(await until(() => fs.existsSync(out) && fs.statSync(out).size > 1000, 20000)).toBe(true);
  const pdf = fs.readFileSync(out).toString('latin1');
  const boxes = [...pdf.matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map(m => [+m[1], +m[2]]);
  expect(boxes.length).toBe(pages);
  boxes.forEach(([w, h]) => {
    expect(Math.round(w)).toBe(432); // 6 in at 72 points per inch
    expect(Math.round(h)).toBe(648); // 9 in
  });
  expect(pdf).toContain('EBGaramond'); // the bundled book font is embedded
  expect(errors).toEqual([]);
  await app.close();
});

test('book preview works under the desktop app’s security policy, with its bundled fonts', async () => {
  const home = newHome();
  const { app, win, errors } = await launch(home);
  await win.click('#menuBtn');
  await win.click('[data-m="preview"]');
  const ebook = win.frameLocator('#pvStage .pv-frame');
  await expect(ebook.locator('h1')).toBeVisible();
  await win.click('[data-pvt="print"]');
  const print = win.frameLocator('#pvPrint .pv-pframe');
  await expect(print.locator('.pg').first()).toBeVisible();
  // the print preview is set in the bundled book font, not a fallback
  expect(
    await print
      .locator('.pb')
      .first()
      .evaluate(el => [...el.ownerDocument.fonts].some(f => /EB Garamond/.test(f.family) && f.status === 'loaded'))
  ).toBe(true);
  expect(errors).toEqual([]);
  await app.close();
});
