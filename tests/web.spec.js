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

test('bold, italic and smart quotes in the editor, kept as markers and exported to Word', async ({ page }) => {
  await openApp(page);
  await page.click('.sc-btn'); await page.click('#ed', { position: { x: 3, y: 3 } }); await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter'); await page.keyboard.type('She said "yes" -- ');
  await page.keyboard.press('Control+b'); await page.keyboard.type('loudly'); await page.keyboard.press('Control+b');
  await page.keyboard.type(' and '); await page.click('[data-fmt="italic"]'); await page.keyboard.type('fast'); await page.click('[data-fmt="italic"]'); await page.keyboard.type('.');
  const p = await waitSaved(page, p => Object.values(p.sc).some(s => s.text.includes('**loudly**')));
  expect(Object.values(p.sc).find(s => s.text.includes('**loudly**')).text).toContain('She said “yes” — **loudly** and *fast*.');
  await page.reload(); await page.waitForSelector('#ed');
  await expect(page.locator('#ed b')).toHaveText(['loudly']); await expect(page.locator('#ed i')).toHaveText(['fast']);
  await expect(page.locator('#ed')).not.toContainText('**');
  await page.click('#menuBtn'); await page.click('[data-m="export"]'); await page.click('[data-fmt="docx"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="go"]')]);
  const doc = unzip(require('fs').readFileSync(await dl.path()))['word/document.xml'].toString();
  expect(doc).toContain('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">loudly');
  expect(doc).toContain('<w:rPr><w:i/></w:rPr><w:t xml:space="preserve">fast');
});

test('the continuity check finds facts that disagree and names that look misspelled', async ({ page }) => {
  await openApp(page);
  await page.click('[data-a="open-e"][data-id="e_ilsa"]');
  await page.fill('.facts textarea', 'eyes: grey\nage: 29'); await page.locator('.facts textarea').blur();
  await expect(page.locator('.ct-seen')).toContainText('First seen in');
  await page.click('.sc-btn'); await page.click('#ed', { position: { x: 3, y: 3 } }); await page.keyboard.press('Control+End');
  await page.keyboard.type(' Ilsa Verrin narrowed her blue eyes. Later Ilsa Verin left.');
  await page.click('#menuBtn'); await page.click('[data-m="cont"]');
  await expect(page.locator('.ct-item.k-fact')).toContainText('“blue” here, but the page says “grey”');
  await expect(page.locator('.ct-item.k-spell')).toContainText('Verin');
  await page.click('.ct-item.k-fact [data-ct="go"]');
  expect(await page.evaluate(() => getSelection().toString())).toBe('blue eyes');
  await page.click('#menuBtn'); await page.click('[data-m="cont"]');
  await page.click('.ct-item.k-spell [data-ct="ign"]');
  await expect(page.locator('.ct-item.k-spell')).toHaveCount(0);
  await expect(page.locator('[data-a="open-e"][data-id="e_ilsa"] .wc')).not.toHaveText('0');
});

test('drag to reorder scenes, chapters, outline lines and brainstorm ideas', async ({ page }) => {
  await openApp(page);
  const drag = async (from, to, dy = -4) => { const a = await page.locator(from).boundingBox(), b = await page.locator(to).boundingBox();
    const ox = Math.min(20, a.width / 2);
    await page.mouse.move(a.x + ox, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + ox + 6, a.y + a.height / 2 + 10, { steps: 3 }); await page.mouse.move(b.x + 20, b.y + (dy < 0 ? 4 : b.height - 4), { steps: 6 }); await page.mouse.up(); };
  const ids = await page.locator('.sc-row').evaluateAll(a => a.map(x => x.dataset.sid));
  await drag('.sc-row[data-sid="' + ids[0] + '"]', '.sc-row[data-sid="' + ids[2] + '"]');   // first scene into chapter 2, above its scene
  let p = await waitSaved(page, p => p.meta.chapters[1].scenes[0] === ids[0]);
  expect(p.meta.chapters[0].scenes).not.toContain(ids[0]);
  const chs = p.meta.chapters.map(c => c.id);
  await drag('.ch-block[data-ch="' + chs[1] + '"] .ch-row', '.ch-block[data-ch="' + chs[0] + '"] .ch-row');
  p = await waitSaved(page, p => p.meta.chapters[0].id === chs[1]);
  await page.click('[data-a="open-ol"] >> nth=0');
  const rows = await page.locator('.ol-row').evaluateAll(a => a.map(x => x.dataset.i));
  await page.locator('.ol-row').last().hover();
  await drag('.ol-row[data-i="' + rows[rows.length - 1] + '"] .ol-grip', '.ol-row[data-i="' + rows[0] + '"]');
  p = await waitSaved(page, p => Object.values(p.ol).some(o => o.items[0].id === rows[rows.length - 1]));
  await page.click('[data-a="open-nt"] >> nth=1');
  const ideas = await page.locator('.idea').evaluateAll(a => a.map(x => x.dataset.id));
  const a = await page.locator('.idea[data-id="' + ideas[2] + '"] footer').boundingBox(), b = await page.locator('.idea[data-id="' + ideas[0] + '"]').boundingBox();
  await page.mouse.move(a.x + a.width - 6, a.y + 6); await page.mouse.down(); await page.mouse.move(a.x + a.width - 20, a.y + 20, { steps: 3 });
  await page.mouse.move(b.x + 10, b.y + b.height / 2, { steps: 6 }); await page.mouse.up();
  await waitSaved(page, p => Object.values(p.nt).some(n => n.ideas.length && n.ideas[0].id === ideas[2]));
});

test('Inky’s rank follows the novel length goal and never goes back', async ({ page }) => {
  await openApp(page, { project: { meta: { v: 2, title: 'Small', target: 1000, chapters: [{ id: 'c1', title: 'One', open: true, scenes: ['s1'] }], scenes: { s1: { title: 'S', status: 'draft', words: 0 } }, ents: {}, pet: { name: 'Inky', total: 0 }, days: {} }, sc: { s1: { text: '', synopsis: '', notes: '' } }, en: {} } });
  await expect(page.locator('#stageTag')).toHaveText('Blot');
  await page.click('.sc-btn'); await page.click('#ed'); await page.keyboard.type('word '.repeat(55));
  await expect(page.locator('#stageTag')).toHaveText('Inkling');
  await expect(page.locator('#evoTxt')).toContainText('25% of your 1,000-word goal');
  await page.fill('#tgtIn', '100000'); await page.press('#tgtIn', 'Tab');
  await expect(page.locator('#stageTag')).toHaveText('Inkling');
});

test('sticky notes beside the page: add, write, move to the other side, recolour, delete', async ({ page }) => {
  await page.setViewportSize({ width: 1900, height: 1000 });   // wide enough for notes in the margins
  const errors = await openApp(page);
  await page.click('.sc-btn');
  await page.click('#stkBtn');
  const note = page.locator('#stkLayer .stk').first();
  await expect(note).toBeVisible(); await expect(note).not.toHaveClass(/tab/);
  await page.keyboard.type('Check the tide tables.');
  let p = await waitSaved(page, p => Object.values(p.sc).some(s => (s.stickies || []).some(n => n.text === 'Check the tide tables.')));
  const startSide = Object.values(p.sc).flatMap(s => s.stickies || [])[0].side;
  const h = await note.locator('.stk-h').boundingBox(), sheet = await page.locator('.sheet').boundingBox();
  const tx = startSide === 'r' ? sheet.x - 90 : sheet.x + sheet.width + 90;
  await page.mouse.move(h.x + 30, h.y + 8); await page.mouse.down(); await page.mouse.move(tx, h.y + 120, { steps: 8 }); await page.mouse.up();
  p = await waitSaved(page, p => Object.values(p.sc).flatMap(s => s.stickies || []).some(n => n.side !== startSide && n.y > 60));
  await note.hover(); await page.click('#stkLayer .stk .sw.c-char');
  await waitSaved(page, p => Object.values(p.sc).flatMap(s => s.stickies || []).some(n => n.color === 'char'));
  await page.reload(); await page.waitForSelector('#stkLayer .stk');
  await expect(page.locator('#stkLayer textarea')).toHaveValue('Check the tide tables.');
  await page.click('#stkLayer [data-sk="del"]'); await page.click('#stkLayer [data-sk="del"]');
  await expect(page.locator('#stkLayer .stk')).toHaveCount(0);
  await page.setViewportSize({ width: 1300, height: 900 });   // narrow: notes fold into tabs on the page edge
  await page.click('#stkBtn'); await page.keyboard.type('Folded');
  await page.click('#ed', { position: { x: 3, y: 3 } });
  await expect(page.locator('#stkLayer .stk.tab')).toHaveCount(1);
  await page.click('#stkLayer .stk-tab'); await expect(page.locator('#stkLayer textarea')).toHaveValue('Folded');
  expect(errors).toEqual([]);
});

test('the side panels widen by dragging their edges and remember it', async ({ page }) => {
  const errors = await openApp(page);
  const width = sel => page.locator(sel).boundingBox().then(b => Math.round(b.width));
  const drag = async (sel, dx) => { const b = await page.locator(sel).boundingBox();
    await page.mouse.move(b.x + 5, b.y + 300); await page.mouse.down(); await page.mouse.move(b.x + 5 + dx, b.y + 300, { steps: 6 }); await page.mouse.up(); };
  expect(await width('#binder')).toBe(272); expect(await width('#insp')).toBe(308);
  await drag('#szL', 120); await drag('#szR', -100);
  expect(await width('#binder')).toBe(392); expect(await width('#insp')).toBe(408);
  await page.focus('#szL'); await page.keyboard.press('ArrowRight');
  expect(await width('#binder')).toBe(408);
  await page.reload(); await page.waitForSelector('#ed');
  expect(await width('#binder')).toBe(408); expect(await width('#insp')).toBe(408);
  await page.dblclick('#szL');
  expect(await width('#binder')).toBe(272);
  await drag('#szR', -2000);   // never squeezes the page below a usable width
  expect(await width('#main')).toBeGreaterThanOrEqual(430);
  expect(errors).toEqual([]);
});

test('today’s to-do list: add, tick, automatic tasks, and unfinished ones carry over to a new day', async ({ page, context }) => {
  const errors = await openApp(page);
  await page.fill('#goalIn', '50'); await page.press('#goalIn', 'Tab');
  await page.fill('#tdNew', 'Name the ship'); await page.press('#tdNew', 'Enter');
  await page.fill('#tdNew', 'Outline chapter 3'); await page.press('#tdNew', 'Enter');
  await expect(page.locator('#tdNew')).toBeFocused();
  await page.click('.td-idea:has-text("Write 50 words")');
  await expect(page.locator('.td')).toHaveCount(3);
  await page.check('.td >> nth=1 >> .td-ck');
  await expect(page.locator('#tdN')).toHaveText('1 of 3 done');
  await page.click('.sc-btn'); await page.click('#ed'); await page.keyboard.press('Control+End');
  await page.keyboard.type(' ' + 'word '.repeat(55));
  await expect(page.locator('.td.done')).toHaveCount(2);
  expect(await page.locator('.td.done .td-t').evaluateAll(els => els.map(x => x.value))).toEqual(['Outline chapter 3', 'Write 50 words']);
  const p = await waitSaved(page, p => p.meta.todo && p.meta.todo.items.filter(x => x.done).length === 2);
  expect(p.meta.pet.tasks).toBe(2);
  p.meta.todo.d = '2020-01-01';   // the next day
  const next = await context.newPage();
  const errs2 = await openApp(next, { project: p });
  await expect(next.locator('.td')).toHaveCount(1);
  await expect(next.locator('.td .td-t')).toHaveValue('Name the ship');
  await expect(next.locator('.td .td-old')).toHaveCount(1);
  expect(errors).toEqual([]); expect(errs2).toEqual([]);
});

const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const READING = () => ({
  meta: { v: 2, title: 'Reading', goal: 5000, target: 80000, chapters: [{ id: 'c1', title: 'One', open: true, scenes: ['s1'] }], scenes: { s1: { title: 'The quay', status: 'draft', words: 0 } },
    ents: { e_m: { id: 'e_m', type: 'char', name: 'Mara', aliases: [] }, e_h: { id: 'e_h', type: 'place', name: 'Harrow Point', aliases: [] } },
    pet: { name: 'Inky', total: 0 }, days: {}, mark: { d: dayKey(), hit: { start: 1 }, over: 0 } },
  sc: { s1: { text: 'Mara walked out to Harrow Point as night fell. The sea was black under the clouds. Rain began to fall on the quay, soft at first, then harder. She pulled her coat tight around her and waited for the boat to come in.', synopsis: '', notes: '' } },
  en: { e_m: { fields: { facts: 'eyes: green' } }, e_h: { fields: {} } }
});

test('Inky reads over your shoulder: where we are, the weather, what happens, and facts that disagree', async ({ page }) => {
  const errors = await openApp(page, { project: READING() });
  const room = page.locator('#petRoom svg');
  await expect(page.locator('#bubble')).toHaveText('Where were we? Mara, at Harrow Point, at night, in the rain.');
  await expect(room).toHaveAttribute('data-read', /night rain sea/);
  await expect(page.locator('#petArt .umbc')).toHaveCount(1);   // an umbrella for the rain
  await page.click('#ed'); await page.keyboard.press('Control+End');
  await page.keyboard.type(' Then lightning split the sky and thunder shook the windows.');
  await expect(room).toHaveAttribute('data-read', /storm/);
  await page.keyboard.type(' Mara screamed.');
  await expect(page.locator('#petArt svg')).toHaveAttribute('aria-label', /scared/);
  await expect(page.locator('#bubble')).toHaveText(/scream|jump|Mara, what is it/, { timeout: 15000 });
  await page.keyboard.type(' She held the dead man and wept, so alone now, and her tears would not stop.');
  await expect(page.locator('#petArt svg')).toHaveAttribute('aria-label', /sad/);
  await expect(page.locator('#petArt .tis')).toHaveCount(1);   // a tissue
  await page.keyboard.type(' Mara narrowed her blue eyes.');
  await expect(page.locator('#bubble')).toHaveText(/Mara’s (eyes were|page says) green/, { timeout: 20000 });
  // switched off: the room is just the room again
  await page.click('#denBtn'); await page.uncheck('#denPeek'); await page.click('#denBtn');
  await expect(page.locator('#petRoom svg')).not.toHaveAttribute('data-read', /.+/);
  await expect(page.locator('#peek')).toHaveCount(0);
  expect(errors).toEqual([]);
});
