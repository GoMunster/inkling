// The app in a plain browser: saving, the save format, writing tools and exports.
const { test, expect } = require('@playwright/test');
const { openApp, saved, waitSaved, unzip } = require('./helpers');

const OLD_PROJECT = {   // a project saved before format 2 (no version stamps, no tombstones)
  meta: { v: 1, title: 'Old Book', chapters: [{ id: 'c1', title: 'Chapter One', open: true, scenes: ['s1'] }],
    scenes: { s1: { title: 'First', status: 'draft', words: 3 } }, ents: {}, pet: { name: 'Inky', total: 0 }, days: {} },
  sc: { s1: { text: 'Old words here', synopsis: '', notes: '' } }, en: {}
};
const typeInScene = async (page, text) => { await page.click('#ed'); await page.keyboard.press('Control+End'); await page.keyboard.type(text); };

test('loads the sample with no errors and saves typing across a reload', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#projTitle')).toHaveValue(/Lantern Tide/);
  await typeInScene(page, ' The tide came in late.');
  await waitSaved(page, p => Object.values(p.sc).some(s => s.text.includes('came in late')));
  await page.reload(); await page.waitForSelector('#ed');
  await expect(page.locator('#ed')).toContainText('came in late');
  expect(errors).toEqual([]);
});

test('saves format 2 with change stamps, and leaves a marker for deleted records', async ({ page }) => {
  await openApp(page);
  await typeInScene(page, ' Stamped.');
  const p = await waitSaved(page, p => Object.values(p.sc).some(s => s.text.includes('Stamped.')));
  expect(p.meta.v).toBe(2);
  const sc = Object.values(p.sc).find(s => s.text.includes('Stamped.'));
  expect(sc._m).toBeGreaterThan(0); expect(typeof sc._dev).toBe('string');
  const id = await page.locator('.sc-btn >> nth=1').getAttribute('data-id');
  await page.click('[data-a="delsc"][data-id="' + id + '"]', { force: true });
  await page.click('[data-a="delsc"][data-id="' + id + '"]', { force: true });
  const after = await waitSaved(page, p => !p.sc[id]);
  expect(after.meta.gone['sc_' + id]).toBeGreaterThan(0);
});

test('opens an older project and upgrades it', async ({ page }) => {
  await openApp(page, { project: OLD_PROJECT });
  await expect(page.locator('#projTitle')).toHaveValue('Old Book');
  await page.click('.sc-btn'); await typeInScene(page, ' and new ones.');
  const p = await waitSaved(page, p => p.sc.s1.text.includes('new ones'));
  expect(p.meta.v).toBe(2); expect(p.meta.gone).toEqual({});
});

test('never overwrites a project saved by a newer Inkling', async ({ page }) => {
  const newer = JSON.parse(JSON.stringify(OLD_PROJECT)); newer.meta.v = 99; newer.meta.futureThing = 'keep me';
  const errors = await openApp(page, { project: newer });
  await expect(page.locator('#saveSt')).toContainText('newer');
  await page.click('.sc-btn'); await typeInScene(page, ' typed');
  await page.waitForTimeout(2500);
  const p = await saved(page);
  expect(p.meta.v).toBe(99); expect(p.meta.futureThing).toBe('keep me'); expect(p.sc.s1.text).toBe('Old words here');
  expect(errors).toEqual([]);
});

test('find and replace changes every scene, keeps snapshots and gives no pet credit', async ({ page }) => {
  await openApp(page);
  const before = await page.locator('#chipTxt').textContent();
  await page.click('#menuBtn'); await page.click('[data-m="find"]');
  await page.fill('#fdQ', 'Tobias');
  await expect(page.locator('.fd-bar b')).toHaveText(/matches in \d+ scenes/);
  await page.fill('#fdR', 'Tomas');
  await page.click('[data-fd="all"]'); await page.click('.ask [data-v="go"]');
  await expect(page.locator('.fd-bar b')).toHaveText('No matches');
  const p = await waitSaved(page, p => Object.values(p.sc).some(s => s.text.includes('Tomas')));
  expect(Object.values(p.sc).some(s => /Tobias/.test(s.text))).toBe(false);
  expect(Object.values(p.sn).filter(x => x.auto === 'replace').length).toBeGreaterThan(0);
  expect(await page.locator('#chipTxt').textContent()).toBe(before);
  // a result opens the scene with the match selected
  await page.fill('#fdQ', 'Tomas'); await page.click('.fd-go >> nth=0');
  await page.waitForSelector('#ed');
  expect(await page.evaluate(() => getSelection().toString())).toBe('Tomas');
});

test('snapshots save, compare and restore a scene', async ({ page }) => {
  await openApp(page);
  await page.click('#snBtn'); await page.fill('#snName', 'First draft'); await page.click('#snForm button');
  await expect(page.locator('.sn-it').first()).toContainText('First draft');
  await page.click('[data-sn="open"], [data-a="back"] >> nth=0');
  await typeInScene(page, ' A brand new ending.');
  await page.click('#snBtn'); await page.click('.sn-it:has-text("First draft")');
  await expect(page.locator('.df ins')).toHaveText('A brand new ending.');
  await page.click('[data-sn="restore"]');
  await expect(page.locator('#ed')).not.toContainText('brand new ending');
  const p = await waitSaved(page, p => Object.values(p.sn).some(x => x.auto === 'restore'));
  expect(Object.values(p.sn).find(x => x.auto === 'restore').text).toContain('brand new ending');
});

test('exports a Word manuscript and an EPUB', async ({ page }) => {
  await openApp(page);
  await page.click('#menuBtn'); await page.click('[data-m="export"]');
  await page.fill('[data-e="author"]', 'Jane Writer');
  await page.fill('[data-e="contact"]', 'Jane Writer\njane@example.com');
  const [docx] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="go"]')]);
  expect(docx.suggestedFilename()).toMatch(/\.docx$/);
  const d = unzip(require('fs').readFileSync(await docx.path()));
  const doc = d['word/document.xml'].toString();
  expect(doc).toContain('Ilsa Verrin stepped off the ferry');
  expect(doc).toContain('about ');
  expect(d['word/header1.xml'].toString()).toContain('Writer / THE LANTERN TIDE');
  expect(d['[Content_Types].xml']).toBeTruthy();

  await page.click('#menuBtn'); await page.click('[data-m="export"]'); await page.click('[data-fmt="epub"]');
  const [epub] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="go"]')]);
  const e = unzip(require('fs').readFileSync(await epub.path()));
  expect(e.mimetype.toString()).toBe('application/epub+zip');
  expect(e.mimetype.firstOffset).toBe(0);
  expect(e['OEBPS/content.opf'].toString()).toContain('<dc:creator>Jane Writer</dc:creator>');
  expect(e['OEBPS/ch1.xhtml'].toString()).toContain('<h1>');
});

test('settings change the look and are remembered', async ({ page }) => {
  await openApp(page);
  await page.click('#menuBtn'); await page.click('[data-m="prefs"]');
  await page.click('[data-look="theme"][data-v="dark"]');
  await page.click('[data-look="width"][data-v="wide"]');
  await page.reload(); await page.waitForSelector('#ed');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.sheet')).maxWidth)).toBe('980px');
});

test('the tour shows once, and can be replayed', async ({ page }) => {
  await openApp(page, { tour: true });
  await expect(page.locator('#tour')).toBeVisible();
  await page.click('#tour [data-t="end"]');
  await page.reload(); await page.waitForSelector('#ed'); await page.waitForTimeout(1000);
  await expect(page.locator('#tour')).toHaveCount(0);
  await page.click('#menuBtn'); await page.click('[data-m="tour"]');
  await expect(page.locator('#tour')).toContainText('Welcome');
});

test('the word history chart and table show today\'s words', async ({ page }) => {
  await openApp(page);
  await typeInScene(page, ' one two three four five');
  await page.click('#menuBtn'); await page.click('[data-m="sessions"]');
  await expect(page.locator('#wcSvg .wc-bar')).toHaveCount(1);
  await page.click('[data-wr="table"]');
  await expect(page.locator('.wc-table td.mono').first()).toHaveText('5');
});

test('a focus session records the new words written in it', async ({ page }) => {
  await openApp(page, { clock: true });
  await page.click('[data-pm="set"]'); await page.fill('[data-pms="focus"]', '1'); await page.press('[data-pms="focus"]', 'Tab');
  await page.click('.sc-btn');
  await page.click('#pmGo'); await page.clock.runFor(1000);
  await typeInScene(page, ' She counted the lanterns again.');
  await page.clock.runFor(61000);
  const p = await waitSaved(page, p => Object.values(p.ss).some(s => s.done && s.words === 5));
  expect(Object.values(p.ss).length).toBeGreaterThan(0);
});

test('outline templates replace template lines but keep what the writer typed', async ({ page }) => {
  await openApp(page);
  await page.click('[data-a="addol"]');
  await page.selectOption('#olTpl', 'three');
  const first = page.locator('.ol-tx').first(); const was = await first.inputValue();
  await page.locator('.ol-tx').nth(2).fill('My own beat');
  await page.selectOption('#olTpl', await page.locator('#olTpl option').nth(2).getAttribute('value'));
  if (await page.locator('.ask').count()) await page.click('.ask [data-v]');
  const lines = await page.locator('.ol-tx').evaluateAll(a => a.map(x => x.value));
  expect(lines).toContain('My own beat');
  expect(lines.length).toBeGreaterThan(1);
  expect(was).toBeTruthy();
});

test('a new character, place or thing opens, and opens again from the binder', async ({ page }) => {
  const errors = await openApp(page);
  for (const t of ['char', 'place', 'thing']) {
    const before = await page.locator('[data-a="open-e"]').evaluateAll(a => a.map(x => x.dataset.id));
    await page.click('[data-a="adde"][data-t="' + t + '"]');
    await expect(page.locator('#main')).toContainText('Development page');
    const id = (await page.locator('[data-a="open-e"]').evaluateAll(a => a.map(x => x.dataset.id))).find(x => !before.includes(x));
    await page.click('.sc-btn');
    await page.click('[data-a="open-e"][data-id="' + id + '"]');
    await expect(page.locator('#main')).toContainText('Development page');
  }
  expect(errors).toEqual([]);
});

test('the sharing guide opens from the menu, and says sharing needs the desktop app', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('#menuBtn'); await page.click('[data-m="help"]');
  await expect(page.locator('#main h1')).toHaveText('How sharing works');
  await expect(page.locator('.banner-note')).toContainText('desktop app');
  await expect(page.locator('.hs h2')).toHaveCount(7);
  expect(errors).toEqual([]);
});

test('Inky earns things, wears them, and notices new characters', async ({ page }) => {
  const errors = await openApp(page);
  await page.fill('#goalIn', '50'); await page.press('#goalIn', 'Tab');
  await page.click('.sc-btn');
  await page.click('#ed'); await page.keyboard.press('Control+End');
  await page.keyboard.type(' ' + 'The lanterns flickered along the quay as the tide came in. '.repeat(6));
  await expect(page.locator('#bubble')).toContainText('Goal getter');
  await page.click('[data-a="adde"][data-t="char"]');
  await expect(page.locator('#bubble')).toContainText(/character|Someone new/);
  await page.click('#denBtn');
  await expect(page.locator('.ach-card.got')).toContainText(['Goal getter']);
  await expect(page.locator('[data-wear="neck"][data-v="scarf"]')).toBeDisabled();
  await page.click('[data-wear="head"][data-v="beret"]');
  await page.click('[data-color="plum"]');
  await expect(page.locator('#petArt .beret').first()).toBeAttached();
  expect(await page.locator('#petArt svg').getAttribute('style')).toContain('--pet:');
  const p = await waitSaved(page, p => p.meta.pet.wear.head === 'beret' && p.meta.pet.color === 'plum');
  expect(p.meta.pet.got.goal1).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a quiet Inky keeps celebrations to the speech bubble', async ({ page }) => {
  await openApp(page);
  await page.click('#denBtn'); await page.click('[data-talk="off"]');
  await page.fill('#goalIn', '50'); await page.press('#goalIn', 'Tab');
  await page.click('.sc-btn'); await page.click('#ed'); await page.keyboard.press('Control+End');
  await page.keyboard.type(' ' + 'Quiet words for a quiet pet, written one after another. '.repeat(6));
  await expect(page.locator('#bubble')).toContainText('Goal getter');
  await expect(page.locator('#toast')).toBeHidden();
  await expect(page.locator('#fx i')).toHaveCount(0);
});

test('Save in the menu and Ctrl+S save right away', async ({ page }) => {
  await openApp(page);
  await page.click('.sc-btn'); await typeInScene(page, ' Saved by hand.');
  await page.keyboard.press('Control+s');
  await expect(page.locator('#toast')).toContainText('Saved');
  expect(Object.values((await saved(page)).sc).some(s => s.text.includes('Saved by hand.'))).toBe(true);
  await page.click('#menuBtn'); await page.click('[data-m="save"]');
  await expect(page.locator('#toast')).toContainText('Saved');
});

test('a picture can be reframed by dragging and zooming', async ({ page }) => {
  await openApp(page);
  await page.click('[data-a="open-e"] >> nth=0');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');
  await page.setInputFiles('#entFile', { name: 'p.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#entImg img');
  await page.click('[data-im="opts"]'); await page.click('[data-im="frame"]');
  const box = await page.locator('#entImg').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 60, { steps: 4 }); await page.mouse.up();
  await page.fill('#picZoom', '2'); await page.dispatchEvent('#picZoom', 'input');
  const style = await page.locator('#entImg img').getAttribute('style');
  expect(style).toContain('scale(2');
  const p = await waitSaved(page, p => Object.values(p.en).some(x => x.pic && x.pic.zoom === 2));
  const pic = Object.values(p.en).find(x => x.pic && x.pic.zoom === 2).pic;
  expect(pic.px).toBeLessThan(50); expect(pic.py).toBeGreaterThan(50);
  await page.click('[data-im="unframe"]');
  await expect(page.locator('#entImg img')).toHaveAttribute('style', /50\.0% 50\.0%/);
});

test('the Room button opens and closes the room, and a new project gets a new Inky', async ({ page }) => {
  await openApp(page);
  await page.click('.sc-btn >> nth=1'); const title = await page.locator('#sceneTitle').inputValue();
  await page.click('#denBtn'); await expect(page.locator('.den')).toBeVisible();
  await expect(page.locator('#denBtn')).toContainText('Close room');
  await page.click('#denBtn'); await expect(page.locator('#sceneTitle')).toHaveValue(title);
  const before = (await saved(page)) || {};
  await page.click('#menuBtn'); await page.click('[data-m="blank"]'); await page.click('[data-m="blank"]');
  const p = await waitSaved(page, p => !p.meta.sample);
  expect(p.meta.pet.total).toBe(0); expect(Object.keys(p.meta.pet.got)).toEqual([]);
});
