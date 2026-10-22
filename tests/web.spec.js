// The app in a plain browser: saving, the save format, writing tools and exports.
const { test, expect } = require('@playwright/test');
const { openApp, saved, waitSaved, unzip, makeDocx } = require('./helpers');

const OLD_PROJECT = {
  // a project saved before format 2 (no version stamps, no tombstones)
  meta: {
    v: 1,
    title: 'Old Book',
    chapters: [{ id: 'c1', title: 'Chapter One', open: true, scenes: ['s1'] }],
    scenes: { s1: { title: 'First', status: 'draft', words: 3 } },
    ents: {},
    pet: { name: 'Inky', total: 0 },
    days: {}
  },
  sc: { s1: { text: 'Old words here', synopsis: '', notes: '' } },
  en: {}
};
const typeInScene = async (page, text) => {
  await page.click('#ed');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(text);
};

test('loads the sample with no errors and saves typing across a reload', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#projTitle')).toHaveValue(/Lantern Tide/);
  await typeInScene(page, ' The tide came in late.');
  await waitSaved(page, p => Object.values(p.sc).some(s => s.text.includes('came in late')));
  await page.reload();
  await page.waitForSelector('#ed');
  await expect(page.locator('#ed')).toContainText('came in late');
  expect(errors).toEqual([]);
});

test('saves format 2 with change stamps, and leaves a marker for deleted records', async ({ page }) => {
  await openApp(page);
  await typeInScene(page, ' Stamped.');
  const p = await waitSaved(page, p => Object.values(p.sc).some(s => s.text.includes('Stamped.')));
  expect(p.meta.v).toBe(2);
  const sc = Object.values(p.sc).find(s => s.text.includes('Stamped.'));
  expect(sc._m).toBeGreaterThan(0);
  expect(typeof sc._dev).toBe('string');
  const id = await page.locator('.sc-btn >> nth=1').getAttribute('data-id');
  await page.click('[data-a="delsc"][data-id="' + id + '"]', { force: true });
  await page.click('[data-a="delsc"][data-id="' + id + '"].on', { force: true }); // after it asks "Delete?"
  const after = await waitSaved(page, p => !p.sc[id]);
  expect(after.meta.gone['sc_' + id]).toBeGreaterThan(0);
});

test('opens an older project and upgrades it', async ({ page }) => {
  await openApp(page, { project: OLD_PROJECT });
  await expect(page.locator('#projTitle')).toHaveValue('Old Book');
  await page.click('.sc-btn');
  await typeInScene(page, ' and new ones.');
  const p = await waitSaved(page, p => p.sc.s1.text.includes('new ones'));
  expect(p.meta.v).toBe(2);
  expect(p.meta.gone).toEqual({});
});

test('never overwrites a project saved by a newer Inkling', async ({ page }) => {
  const newer = JSON.parse(JSON.stringify(OLD_PROJECT));
  newer.meta.v = 99;
  newer.meta.futureThing = 'keep me';
  const errors = await openApp(page, { project: newer });
  await expect(page.locator('#saveSt')).toContainText('newer');
  await page.click('.sc-btn');
  await typeInScene(page, ' typed');
  await page.waitForTimeout(2500);
  const p = await saved(page);
  expect(p.meta.v).toBe(99);
  expect(p.meta.futureThing).toBe('keep me');
  expect(p.sc.s1.text).toBe('Old words here');
  expect(errors).toEqual([]);
});

test('find and replace changes every scene, keeps snapshots and gives no pet credit', async ({ page }) => {
  await openApp(page);
  const before = await page.locator('#chipTxt').textContent();
  await page.click('#menuBtn');
  await page.click('[data-m="find"]');
  await page.fill('#fdQ', 'Tobias');
  await expect(page.locator('.fd-bar b')).toHaveText(/matches in \d+ scenes/);
  await page.fill('#fdR', 'Tomas');
  await page.click('[data-fd="all"]');
  await page.click('.ask [data-v="go"]');
  await expect(page.locator('.fd-bar b')).toHaveText('No matches');
  const p = await waitSaved(page, p => Object.values(p.sc).some(s => s.text.includes('Tomas')));
  expect(Object.values(p.sc).some(s => /Tobias/.test(s.text))).toBe(false);
  expect(Object.values(p.sn).filter(x => x.auto === 'replace').length).toBeGreaterThan(0);
  expect(await page.locator('#chipTxt').textContent()).toBe(before);
  // a result opens the scene with the match selected
  await page.fill('#fdQ', 'Tomas');
  await page.click('.fd-go >> nth=0');
  await page.waitForSelector('#ed');
  expect(await page.evaluate(() => getSelection().toString())).toBe('Tomas');
});

test('snapshots save, compare and restore a scene', async ({ page }) => {
  await openApp(page);
  await page.click('#snBtn');
  await page.fill('#snName', 'First draft');
  await page.click('#snForm button');
  await expect(page.locator('.sn-it').first()).toContainText('First draft');
  await page.click('[data-sn="open"], [data-a="back"] >> nth=0');
  await typeInScene(page, ' A brand new ending.');
  await page.click('#snBtn');
  await page.click('.sn-it:has-text("First draft")');
  await expect(page.locator('.df ins')).toHaveText('A brand new ending.');
  await page.click('[data-sn="restore"]');
  await expect(page.locator('#ed')).not.toContainText('brand new ending');
  const p = await waitSaved(page, p => Object.values(p.sn).some(x => x.auto === 'restore'));
  expect(Object.values(p.sn).find(x => x.auto === 'restore').text).toContain('brand new ending');
});

test('exports a Word manuscript and an EPUB', async ({ page }) => {
  await openApp(page);
  await page.click('#menuBtn');
  await page.click('[data-m="export"]');
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

  await page.click('#menuBtn');
  await page.click('[data-m="export"]');
  await page.click('[data-fmt="epub"]');
  const [epub] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="go"]')]);
  const e = unzip(require('fs').readFileSync(await epub.path()));
  expect(e.mimetype.toString()).toBe('application/epub+zip');
  expect(e.mimetype.firstOffset).toBe(0);
  expect(e['OEBPS/content.opf'].toString()).toContain('<dc:creator>Jane Writer</dc:creator>');
  expect(e['OEBPS/ch1.xhtml'].toString()).toContain('<h1 class="ch">');
});

test('settings change the look and are remembered', async ({ page }) => {
  await openApp(page);
  await page.click('#menuBtn');
  await page.click('[data-m="prefs"]');
  await page.click('[data-look="theme"][data-v="dark"]');
  await page.click('[data-look="width"][data-v="wide"]');
  await page.reload();
  await page.waitForSelector('#ed');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.sheet')).maxWidth)).toBe('980px');
});

test('the tour shows once, and can be replayed', async ({ page }) => {
  await openApp(page, { tour: true });
  await expect(page.locator('#tour')).toBeVisible();
  await page.click('#tour [data-t="end"]');
  await page.reload();
  await page.waitForSelector('#ed');
  await page.waitForTimeout(1000);
  await expect(page.locator('#tour')).toHaveCount(0);
  await page.click('#menuBtn');
  await page.click('[data-m="tour"]');
  await expect(page.locator('#tour')).toContainText('Welcome');
});

test("the word history chart and table show today's words", async ({ page }) => {
  await openApp(page);
  await typeInScene(page, ' one two three four five');
  await page.click('#menuBtn');
  await page.click('[data-m="sessions"]');
  await expect(page.locator('#wcSvg .wc-bar')).toHaveCount(1);
  await page.click('[data-wr="table"]');
  await expect(page.locator('.wc-table td.mono').first()).toHaveText('5');
});

test('a focus session records the new words written in it', async ({ page }) => {
  await openApp(page, { clock: true });
  await page.click('[data-pm="set"]');
  await page.fill('[data-pms="focus"]', '1');
  await page.press('[data-pms="focus"]', 'Tab');
  await page.click('.sc-btn');
  await page.click('#pmGo');
  await page.clock.runFor(1000);
  await typeInScene(page, ' She counted the lanterns again.');
  await page.clock.runFor(61000);
  const p = await waitSaved(page, p => Object.values(p.ss).some(s => s.done && s.words === 5));
  expect(Object.values(p.ss).length).toBeGreaterThan(0);
});

test('outline templates replace template lines but keep what the writer typed', async ({ page }) => {
  await openApp(page);
  await page.click('[data-a="addol"]');
  await page.selectOption('#olTpl', 'three');
  const first = page.locator('.ol-tx').first();
  const was = await first.inputValue();
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
    const id = (await page.locator('[data-a="open-e"]').evaluateAll(a => a.map(x => x.dataset.id))).find(
      x => !before.includes(x)
    );
    await page.click('.sc-btn');
    await page.click('[data-a="open-e"][data-id="' + id + '"]');
    await expect(page.locator('#main')).toContainText('Development page');
  }
  expect(errors).toEqual([]);
});

test('the sharing guide opens from the menu, and says sharing needs the desktop app', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('#menuBtn');
  await page.click('[data-m="help"]');
  await expect(page.locator('#main h1')).toHaveText('How sharing works');
  await expect(page.locator('.banner-note')).toContainText('desktop app');
  await expect(page.locator('.hs h2')).toHaveCount(7);
  expect(errors).toEqual([]);
});

test('Inky earns things, wears them, and notices new characters', async ({ page }) => {
  const errors = await openApp(page);
  await page.fill('#goalIn', '50');
  await page.press('#goalIn', 'Tab');
  await page.click('.sc-btn');
  await page.click('#ed');
  await page.keyboard.press('Control+End');
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
  await page.click('#denBtn');
  await page.click('[data-talk="off"]');
  await page.fill('#goalIn', '50');
  await page.press('#goalIn', 'Tab');
  await page.click('.sc-btn');
  await page.click('#ed');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' ' + 'Quiet words for a quiet pet, written one after another. '.repeat(6));
  await expect(page.locator('#bubble')).toContainText('Goal getter');
  await expect(page.locator('#toast')).toBeHidden();
  await expect(page.locator('#fx i')).toHaveCount(0);
});

test('Save in the menu and Ctrl+S save right away', async ({ page }) => {
  await openApp(page);
  await page.click('.sc-btn');
  await typeInScene(page, ' Saved by hand.');
  await page.keyboard.press('Control+s');
  await expect(page.locator('#toast')).toContainText('Saved');
  expect(Object.values((await saved(page)).sc).some(s => s.text.includes('Saved by hand.'))).toBe(true);
  await page.click('#menuBtn');
  await page.click('[data-m="save"]');
  await expect(page.locator('#toast')).toContainText('Saved');
});

test('a picture can be reframed by dragging and zooming', async ({ page }) => {
  await openApp(page);
  await page.click('[data-a="open-e"] >> nth=0');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC',
    'base64'
  );
  await page.setInputFiles('#entFile', { name: 'p.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#entImg img');
  await page.click('[data-im="opts"]');
  await page.click('[data-im="frame"]');
  const box = await page.locator('#entImg').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 60, { steps: 4 });
  await page.mouse.up();
  await page.fill('#picZoom', '2');
  await page.dispatchEvent('#picZoom', 'input');
  const style = await page.locator('#entImg img').getAttribute('style');
  expect(style).toContain('scale(2');
  const p = await waitSaved(page, p => Object.values(p.en).some(x => x.pic && x.pic.zoom === 2));
  const pic = Object.values(p.en).find(x => x.pic && x.pic.zoom === 2).pic;
  expect(pic.px).toBeLessThan(50);
  expect(pic.py).toBeGreaterThan(50);
  await page.click('[data-im="unframe"]');
  await expect(page.locator('#entImg img')).toHaveAttribute('style', /50\.0% 50\.0%/);
});

test('the Room button opens and closes the room, and a new project gets a new Inky', async ({ page }) => {
  await openApp(page);
  await page.click('.sc-btn >> nth=1');
  const title = await page.locator('#sceneTitle').inputValue();
  await page.click('#denBtn');
  await expect(page.locator('.den')).toBeVisible();
  await expect(page.locator('#denBtn')).toContainText('Close room');
  await page.click('#denBtn');
  await expect(page.locator('#sceneTitle')).toHaveValue(title);
  const before = (await saved(page)) || {};
  await page.click('#menuBtn');
  await page.click('[data-m="blank"]');
  await page.click('[data-m="blank"]');
  const p = await waitSaved(page, p => !p.meta.sample);
  expect(p.meta.pet.total).toBe(0);
  expect(Object.keys(p.meta.pet.got)).toEqual([]);
});

test('bold, italic and smart quotes in the editor, kept as markers and exported to Word', async ({ page }) => {
  await openApp(page);
  await page.click('.sc-btn');
  await page.click('#ed', { position: { x: 3, y: 3 } });
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('She said "yes" -- ');
  await page.keyboard.press('Control+b');
  await page.keyboard.type('loudly');
  await page.keyboard.press('Control+b');
  await page.keyboard.type(' and ');
  await page.click('[data-fmt="italic"]');
  await page.keyboard.type('fast');
  await page.click('[data-fmt="italic"]');
  await page.keyboard.type('.');
  const p = await waitSaved(page, p => Object.values(p.sc).some(s => s.text.includes('**loudly**')));
  expect(Object.values(p.sc).find(s => s.text.includes('**loudly**')).text).toContain(
    'She said “yes” — **loudly** and *fast*.'
  );
  await page.reload();
  await page.waitForSelector('#ed');
  await expect(page.locator('#ed b')).toHaveText(['loudly']);
  await expect(page.locator('#ed i')).toHaveText(['fast']);
  await expect(page.locator('#ed')).not.toContainText('**');
  await page.click('#menuBtn');
  await page.click('[data-m="export"]');
  await page.click('[data-fmt="docx"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="go"]')]);
  const doc = unzip(require('fs').readFileSync(await dl.path()))['word/document.xml'].toString();
  expect(doc).toContain('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">loudly');
  expect(doc).toContain('<w:rPr><w:i/></w:rPr><w:t xml:space="preserve">fast');
});

test('the continuity check finds facts that disagree and names that look misspelled', async ({ page }) => {
  await openApp(page);
  await page.click('[data-a="open-e"][data-id="e_ilsa"]');
  await page.fill('.facts textarea', 'eyes: grey\nage: 29');
  await page.locator('.facts textarea').blur();
  await expect(page.locator('.ct-seen')).toContainText('First seen in');
  await page.click('.sc-btn');
  await page.click('#ed', { position: { x: 3, y: 3 } });
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' Ilsa Verrin narrowed her blue eyes. Later Ilsa Verin left.');
  await page.click('#menuBtn');
  await page.click('[data-m="cont"]');
  await expect(page.locator('.ct-item.k-fact')).toContainText('“blue” here, but the page says “grey”');
  await expect(page.locator('.ct-item.k-spell')).toContainText('Verin');
  await page.click('.ct-item.k-fact [data-ct="go"]');
  expect(await page.evaluate(() => getSelection().toString())).toBe('blue eyes');
  await page.click('#menuBtn');
  await page.click('[data-m="cont"]');
  await page.click('.ct-item.k-spell [data-ct="ign"]');
  await expect(page.locator('.ct-item.k-spell')).toHaveCount(0);
  await expect(page.locator('[data-a="open-e"][data-id="e_ilsa"] .wc')).not.toHaveText('0');
});

test('drag to reorder scenes, chapters, outline lines and brainstorm ideas', async ({ page }) => {
  await openApp(page);
  const drag = async (from, to, dy = -4) => {
    const a = await page.locator(from).boundingBox(),
      b = await page.locator(to).boundingBox();
    const ox = Math.min(20, a.width / 2);
    await page.mouse.move(a.x + ox, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + ox + 6, a.y + a.height / 2 + 10, { steps: 3 });
    await page.mouse.move(b.x + 20, b.y + (dy < 0 ? 4 : b.height - 4), { steps: 6 });
    await page.mouse.up();
  };
  const ids = await page.locator('.sc-row').evaluateAll(a => a.map(x => x.dataset.sid));
  await drag('.sc-row[data-sid="' + ids[0] + '"]', '.sc-row[data-sid="' + ids[2] + '"]'); // first scene into chapter 2, above its scene
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
  const a = await page.locator('.idea[data-id="' + ideas[2] + '"] footer').boundingBox(),
    b = await page.locator('.idea[data-id="' + ideas[0] + '"]').boundingBox();
  await page.mouse.move(a.x + a.width - 6, a.y + 6);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width - 20, a.y + 20, { steps: 3 });
  await page.mouse.move(b.x + 10, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  await waitSaved(page, p => Object.values(p.nt).some(n => n.ideas.length && n.ideas[0].id === ideas[2]));
});

test('Inky’s rank follows the novel length goal and never goes back', async ({ page }) => {
  await openApp(page, {
    project: {
      meta: {
        v: 2,
        title: 'Small',
        target: 1000,
        chapters: [{ id: 'c1', title: 'One', open: true, scenes: ['s1'] }],
        scenes: { s1: { title: 'S', status: 'draft', words: 0 } },
        ents: {},
        pet: { name: 'Inky', total: 0 },
        days: {}
      },
      sc: { s1: { text: '', synopsis: '', notes: '' } },
      en: {}
    }
  });
  await expect(page.locator('#stageTag')).toHaveText('Blot');
  await page.click('.sc-btn');
  await page.click('#ed');
  await page.keyboard.type('word '.repeat(55));
  await expect(page.locator('#stageTag')).toHaveText('Inkling');
  await expect(page.locator('#evoTxt')).toContainText('25% of your 1,000-word goal');
  await page.fill('#tgtIn', '100000');
  await page.press('#tgtIn', 'Tab');
  await expect(page.locator('#stageTag')).toHaveText('Inkling');
});

test('sticky notes beside the page: add, write, move to the other side, recolour, delete', async ({ page }) => {
  await page.setViewportSize({ width: 1900, height: 1000 }); // wide enough for notes in the margins
  const errors = await openApp(page);
  await page.click('.sc-btn');
  await page.click('#stkBtn');
  const note = page.locator('#stkLayer .stk').first();
  await expect(note).toBeVisible();
  await expect(note).not.toHaveClass(/tab/);
  await page.keyboard.type('Check the tide tables.');
  let p = await waitSaved(page, p =>
    Object.values(p.sc).some(s => (s.stickies || []).some(n => n.text === 'Check the tide tables.'))
  );
  const startSide = Object.values(p.sc).flatMap(s => s.stickies || [])[0].side;
  const h = await note.locator('.stk-h').boundingBox(),
    sheet = await page.locator('.sheet').boundingBox();
  const tx = startSide === 'r' ? sheet.x - 90 : sheet.x + sheet.width + 90;
  await page.mouse.move(h.x + 30, h.y + 8);
  await page.mouse.down();
  await page.mouse.move(tx, h.y + 120, { steps: 8 });
  await page.mouse.up();
  p = await waitSaved(page, p =>
    Object.values(p.sc)
      .flatMap(s => s.stickies || [])
      .some(n => n.side !== startSide && n.y > 60)
  );
  await note.hover();
  await page.click('#stkLayer .stk .sw.c-char');
  await waitSaved(page, p =>
    Object.values(p.sc)
      .flatMap(s => s.stickies || [])
      .some(n => n.color === 'char')
  );
  await page.reload();
  await page.waitForSelector('#stkLayer .stk');
  await expect(page.locator('#stkLayer textarea')).toHaveValue('Check the tide tables.');
  await page.click('#stkLayer [data-sk="del"]');
  await page.click('#stkLayer [data-sk="del"]');
  await expect(page.locator('#stkLayer .stk')).toHaveCount(0);
  await page.setViewportSize({ width: 1300, height: 900 }); // narrow: notes fold into tabs on the page edge
  await page.click('#stkBtn');
  await page.keyboard.type('Folded');
  await page.click('#ed', { position: { x: 3, y: 3 } });
  await expect(page.locator('#stkLayer .stk.tab')).toHaveCount(1);
  await page.click('#stkLayer .stk-tab');
  await expect(page.locator('#stkLayer textarea')).toHaveValue('Folded');
  expect(errors).toEqual([]);
});

test('the side panels widen by dragging their edges and remember it', async ({ page }) => {
  const errors = await openApp(page);
  const width = sel =>
    page
      .locator(sel)
      .boundingBox()
      .then(b => Math.round(b.width));
  const drag = async (sel, dx) => {
    const b = await page.locator(sel).boundingBox();
    await page.mouse.move(b.x + 5, b.y + 300);
    await page.mouse.down();
    await page.mouse.move(b.x + 5 + dx, b.y + 300, { steps: 6 });
    await page.mouse.up();
  };
  expect(await width('#binder')).toBe(272);
  expect(await width('#insp')).toBe(308);
  await drag('#szL', 120);
  await drag('#szR', -100);
  expect(await width('#binder')).toBe(392);
  expect(await width('#insp')).toBe(408);
  await page.focus('#szL');
  await page.keyboard.press('ArrowRight');
  expect(await width('#binder')).toBe(408);
  await page.reload();
  await page.waitForSelector('#ed');
  expect(await width('#binder')).toBe(408);
  expect(await width('#insp')).toBe(408);
  await page.dblclick('#szL');
  expect(await width('#binder')).toBe(272);
  await drag('#szR', -2000); // never squeezes the page below a usable width
  expect(await width('#main')).toBeGreaterThanOrEqual(430);
  expect(errors).toEqual([]);
});

test('today’s to-do list: add, tick, automatic tasks, and unfinished ones carry over to a new day', async ({
  page,
  context
}) => {
  const errors = await openApp(page);
  await page.fill('#goalIn', '50');
  await page.press('#goalIn', 'Tab');
  await page.fill('#tdNew', 'Name the ship');
  await page.press('#tdNew', 'Enter');
  await page.fill('#tdNew', 'Outline chapter 3');
  await page.press('#tdNew', 'Enter');
  await expect(page.locator('#tdNew')).toBeFocused();
  await page.click('.td-idea:has-text("Write 50 words")');
  await expect(page.locator('.td')).toHaveCount(3);
  await page.check('.td >> nth=1 >> .td-ck');
  await expect(page.locator('#tdN')).toHaveText('1 of 3 done');
  await page.click('.sc-btn');
  await page.click('#ed');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' ' + 'word '.repeat(55));
  await expect(page.locator('.td.done')).toHaveCount(2);
  expect(await page.locator('.td.done .td-t').evaluateAll(els => els.map(x => x.value))).toEqual([
    'Outline chapter 3',
    'Write 50 words'
  ]);
  const p = await waitSaved(page, p => p.meta.todo && p.meta.todo.items.filter(x => x.done).length === 2);
  expect(p.meta.pet.tasks).toBe(2);
  p.meta.todo.d = '2020-01-01'; // the next day
  const next = await context.newPage();
  const errs2 = await openApp(next, { project: p });
  await expect(next.locator('.td')).toHaveCount(1);
  await expect(next.locator('.td .td-t')).toHaveValue('Name the ship');
  await expect(next.locator('.td .td-old')).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(errs2).toEqual([]);
});

const dayKey = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const READING = () => ({
  meta: {
    v: 2,
    title: 'Reading',
    goal: 5000,
    target: 80000,
    chapters: [{ id: 'c1', title: 'One', open: true, scenes: ['s1'] }],
    scenes: { s1: { title: 'The quay', status: 'draft', words: 0 } },
    ents: {
      e_m: { id: 'e_m', type: 'char', name: 'Mara', aliases: [] },
      e_h: { id: 'e_h', type: 'place', name: 'Harrow Point', aliases: [] }
    },
    pet: { name: 'Inky', total: 0 },
    days: {},
    mark: { d: dayKey(), hit: { start: 1 }, over: 0 }
  },
  sc: {
    s1: {
      text: 'Mara walked out to Harrow Point as night fell. The sea was black under the clouds. Rain began to fall on the quay, soft at first, then harder. She pulled her coat tight around her and waited for the boat to come in.',
      synopsis: '',
      notes: ''
    }
  },
  en: { e_m: { fields: { facts: 'eyes: green' } }, e_h: { fields: {} } }
});

test('Inky reads over your shoulder: where we are, the weather, what happens, and facts that disagree', async ({
  page
}) => {
  const errors = await openApp(page, { project: READING() });
  const room = page.locator('#petRoom svg');
  await expect(page.locator('#bubble')).toHaveText('Where were we? Mara, at Harrow Point, at night, in the rain.');
  await expect(room).toHaveAttribute('data-read', /night rain sea/);
  await expect(page.locator('#petArt .umbc')).toHaveCount(1); // an umbrella for the rain
  await page.click('#ed');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' Then lightning split the sky and thunder shook the windows.');
  await expect(room).toHaveAttribute('data-read', /storm/);
  await page.keyboard.type(' Mara screamed.');
  await expect(page.locator('#petArt svg')).toHaveAttribute('aria-label', /scared/);
  await expect(page.locator('#bubble')).toHaveText(/scream|jump|Mara, what is it/, { timeout: 15000 });
  await page.keyboard.type(' She held the dead man and wept, so alone now, and her tears would not stop.');
  await expect(page.locator('#petArt svg')).toHaveAttribute('aria-label', /sad/);
  await expect(page.locator('#petArt .tis')).toHaveCount(1); // a tissue
  await page.keyboard.type(' Mara narrowed her blue eyes.');
  await expect(page.locator('#bubble')).toHaveText(/Mara’s (eyes were|page says) green/, { timeout: 20000 });
  // switched off: the room is just the room again
  await page.click('#denBtn');
  await page.uncheck('#denPeek');
  await page.click('#denBtn');
  await expect(page.locator('#petRoom svg')).not.toHaveAttribute('data-read', /.+/);
  await expect(page.locator('#peek')).toHaveCount(0);
  expect(errors).toEqual([]);
});

const ONE_SCENE = (text = '') => ({
  meta: {
    v: 2,
    title: 'Tools',
    goal: 5000,
    target: 80000,
    chapters: [{ id: 'c1', title: 'One', open: true, scenes: ['s1'] }],
    scenes: { s1: { title: 'S', status: 'draft', words: 0 } },
    ents: {},
    pet: { name: 'Inky', total: 0 },
    days: {}
  },
  sc: { s1: { text, synopsis: '', notes: '' } },
  en: {}
});
const stored = page => saved(page).then(p => p && p.sc.s1.text);

test('writing tools: Tab indents, Enter keeps the indent, undo and redo, ellipses, selected words', async ({
  page
}) => {
  await page.addInitScript(() => {
    if (window.speechSynthesis) speechSynthesis.speak = () => {};
  }); // no voices in a headless browser
  const errors = await openApp(page, { project: ONE_SCENE() });
  await page.click('#ed');
  await page.keyboard.press('Tab');
  await page.keyboard.type('One two');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Three');
  await expect.poll(() => stored(page)).toBe('\tOne two\n\tThree');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Shift+Tab'); // both lines lose their indent
  await expect.poll(() => stored(page)).toBe('One two\nThree');
  await page.keyboard.press('Control+a');
  await expect(page.locator('#sceneWc')).toContainText('3 selected');
  await page.keyboard.press('Tab'); // with lines selected, Tab indents them all
  await expect.poll(() => stored(page)).toBe('\tOne two\n\tThree');
  await page.keyboard.press('Control+z');
  await expect.poll(() => stored(page)).toBe('One two\nThree');
  await page.keyboard.press('Control+z');
  await expect.poll(() => stored(page)).toBe('\tOne two\n\tThree');
  await page.keyboard.press('Control+y');
  await expect.poll(() => stored(page)).toBe('One two\nThree');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' Wait...');
  await expect.poll(() => stored(page)).toBe('One two\nThree Wait…');
  await page.waitForTimeout(1100);
  await page.click('[data-ed="undo"]');
  await expect.poll(() => stored(page)).toBe('One two\nThree');
  await page.click('[data-ed="redo"]');
  await expect.poll(() => stored(page)).toBe('One two\nThree Wait…');
  if (await page.locator('#raBtn').count()) {
    // read aloud, where the browser can speak
    await page.click('#raBtn');
    await expect(page.locator('#raBtn')).toContainText('Stop reading');
    await page.click('#raBtn');
    await expect(page.locator('#raBtn')).toContainText('Read aloud');
  }
  await page.click('#menuBtn');
  await page.click('[data-m="keys"]');
  await expect(page.locator('.ask .keys')).toContainText('Shift+Tab');
  expect(errors).toEqual([]);
});

test('a writing report with words per minute after the last focus session before a long break', async ({ page }) => {
  const errors = await openApp(page, { project: ONE_SCENE('Start.'), clock: true });
  await page.click('[data-pm="set"]');
  for (const [k, v] of [
    ['focus', '1'],
    ['short', '1'],
    ['every', '2']
  ]) {
    await page.fill('[data-pms="' + k + '"]', v);
    await page.press('[data-pms="' + k + '"]', 'Tab');
  }
  await page.check('[data-pms="autoFocus"]');
  await page.click('#pmGo');
  await page.click('#ed');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' ' + 'word '.repeat(20));
  await page.clock.fastForward(61000); // first focus session ends, the break starts by itself
  await expect(page.locator('#pmPhase')).toContainText('Short break');
  await page.clock.fastForward(61000); // the break ends and the next focus session starts
  await expect(page.locator('#pmPhase')).toHaveText('Focus');
  await page.click('#ed');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' ' + 'more '.repeat(30));
  await page.clock.fastForward(62000);
  await page.clock.fastForward(1000);
  await expect(page.locator('.rp h2')).toHaveText('Writing report');
  await expect(page.locator('.rp-row')).toHaveCount(2);
  await expect(page.locator('#rpWpm')).toHaveText('25'); // 50 new words in 2 minutes
  await expect(page.locator('.rp-big')).toContainText('50');
  await page.click('.rp [data-v="ss"]');
  await expect(page.locator('#main h1')).toHaveText('Writing sessions');
  await page.click('[data-ss="rep"]');
  await expect(page.locator('.rp-row')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('Window › Project settings: choose what shows, reorder the Inkling panel, presets and shortcuts', async ({
  page
}) => {
  const errors = await openApp(page);
  await page.click('#menuBtn');
  await page.click('[data-m="layout"]');
  await expect(page.locator('#main h1')).toHaveText('Project settings');
  await page.uncheck('[data-lo="goalChip"]');
  await expect(page.locator('#goalChip')).toBeHidden();
  await page.uncheck('#loOrder [data-lo="timer"]');
  await expect(page.locator('#pomo')).toHaveCount(0);
  await page.click('#loOrder .lo-it[data-k="todo"] [data-lo-mv="-1"]');
  await page.click('#loOrder .lo-it[data-k="todo"] [data-lo-mv="-1"]');
  const order = () =>
    page.locator('#insp > section').evaluateAll(els => els.map(x => x.id || x.className.split(' ')[0]));
  expect((await order()).indexOf('todo')).toBe(1); // right under Inky
  await page.fill('#loTitle', 'The Renamed Book');
  await page.press('#loTitle', 'Tab');
  await expect(page.locator('#projTitle')).toHaveValue('The Renamed Book');
  let p = await waitSaved(
    page,
    p => p.meta.layout && p.meta.layout.hide.goalChip && p.meta.layout.hide.timer && p.meta.layout.order[1] === 'todo'
  );
  await page.reload();
  await page.waitForSelector('#ed');
  await expect(page.locator('#goalChip')).toBeHidden();
  await expect(page.locator('#pomo')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+Digit1');
  await expect(page.locator('#binder')).toBeHidden();
  await page.waitForTimeout(200);
  await page.keyboard.press('Control+Shift+Digit1');
  await expect(page.locator('#binder')).toBeVisible();
  await page.click('#menuBtn');
  await page.click('[data-m="layout"]');
  await page.click('[data-lo-p="page"]');
  await expect(page.locator('#binder')).toBeHidden();
  await expect(page.locator('#insp')).toBeHidden();
  await expect(page.locator('#main')).toBeVisible();
  await page.click('[data-lo-p="standard"]');
  await expect(page.locator('#binder')).toBeVisible();
  await expect(page.locator('#pomo')).toHaveCount(1);
  await expect(page.locator('#goalChip')).toBeVisible();
  await page.click('[data-lo-p="calm"]');
  await page.click('[data-lo-a="def"]'); // new projects start like this
  await page.click('#menuBtn');
  await page.click('[data-m="blank"]');
  await page.click('[data-m="blank"]');
  p = await waitSaved(page, p => p.meta.title === 'Untitled novel');
  expect(p.meta.layout.hide.hint).toBe(true);
  await expect(page.locator('#sceneHint')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the page scrolls with the caret when writing reaches the bottom of the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 700 });
  const errors = await openApp(page, { project: ONE_SCENE() });
  await page.click('#ed');
  const caretOnScreen = () =>
    page.evaluate(() => {
      const r = getSelection().getRangeAt(0),
        m = document.createElement('span');
      m.textContent = '​';
      r.insertNode(m);
      const b = m.getBoundingClientRect(),
        main = document.querySelector('#main').getBoundingClientRect();
      m.remove();
      return b.top >= main.top && b.bottom <= main.bottom;
    });
  for (let i = 0; i < 30; i++) {
    await page.keyboard.type('Line ' + i + ' of a long scene that keeps going.');
    await page.keyboard.press('Enter');
    if (i % 5 === 4) expect(await caretOnScreen()).toBe(true);
  }
  expect(await page.locator('#main').evaluate(m => m.scrollTop)).toBeGreaterThan(200);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // empty lines at the very end too
  expect(await caretOnScreen()).toBe(true);
  expect(errors).toEqual([]);
});

const dayOff = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

test('deadline planner: a daily goal from the deadline that keeps you on track', async ({ page }) => {
  const errors = await openApp(page, { project: ONE_SCENE() });
  await page.click('#planLine');
  await expect(page.locator('#main h1')).toHaveText('Deadline planner');
  await page.fill('#plTarget', '1000');
  await page.press('#plTarget', 'Tab');
  await page.fill('#plBy', dayOff(9));
  await page.press('#plBy', 'Tab'); // ten writing days, today included
  await page.click('[data-pl="go"]');
  await expect(page.locator('.pl-now-box h2')).toHaveText('On track');
  await expect(page.locator('#goalOf')).toHaveText('100'); // 1,000 words over 10 days
  await expect(page.locator('#goalIn')).toBeDisabled();
  await expect(page.locator('#planLine')).toContainText('100 today');
  await page.click('.sc-btn');
  await page.click('#ed');
  await page.keyboard.type('word '.repeat(220));
  await expect(page.locator('#planLine')).toContainText('120 ahead');
  await expect(page.locator('#goalOf')).toHaveText('100'); // today's goal stays put while you write
  await page.click('#planLine');
  await page.click('.pl-d[data-day="' + dayOff(3) + '"]'); // a day off: the rest spread over nine days
  await expect(page.locator('.pl-d[data-day="' + dayOff(3) + '"]')).toHaveClass(/rest/);
  const p = await waitSaved(page, p => p.meta.plan && p.meta.plan.on && p.meta.plan.off[dayOff(3)]);
  expect(p.meta.plan.target).toBe(1000);
  expect(p.meta.plan.log[dayOff(0)].p).toBe(220);
  await page.click('[data-pl="stop"]');
  await page.click('.ask [data-v="stop"]');
  await expect(page.locator('#goalIn')).toBeEnabled();
  await expect(page.locator('#planLine')).toContainText('Plan a deadline');
  expect(errors).toEqual([]);
});

test('deadline planner: missed days raise the goal, and reaching the target is celebrated', async ({ page }) => {
  const project = ONE_SCENE('word '.repeat(100).trim());
  Object.assign(project.meta, {
    goal: 500,
    days: { [dayOff(-4)]: 100 },
    plan: {
      on: true,
      mode: 'new',
      target: 1000,
      start: dayOff(-4),
      by: dayOff(5),
      wd: [true, true, true, true, true, true, true]
    }
  });
  const errors = await openApp(page, { project });
  await expect(page.locator('#planLine')).toContainText('400 behind'); // the plan expected 500 by tonight
  await expect(page.locator('#goalOf')).toHaveText('150'); // 900 words left over 6 days
  await page.click('#planLine');
  await expect(page.locator('.pl-d.miss')).toHaveCount(3);
  await expect(page.locator('.pl-d.met')).toHaveCount(1);
  await expect(page.locator('.pl-chart .pl-act')).toHaveCount(1);
  await page.click('.sc-btn');
  await page.click('#ed');
  await page.keyboard.press('Control+End');
  for (let i = 0; i < 2; i++) {
    await page.keyboard.type(' ' + 'more '.repeat(450));
  } // 900 new words, in two sittings
  await expect(page.locator('#planLine')).toContainText('Deadline goal reached');
  await expect(page.locator('#bubble')).toContainText(/1,000 words/);
  await page.click('#planLine');
  await page.click('[data-pl="month"]');
  const p = await waitSaved(page, p => p.meta.plan && p.meta.plan.target === 50000);
  expect(p.meta.plan.mode).toBe('new');
  expect(p.meta.plan.start).toBe(dayOff(0));
  expect(p.meta.plan.by > dayOff(26) && p.meta.plan.by < dayOff(31)).toBe(true);
  expect(errors).toEqual([]);
});

test('Trash: deleted things can be undone, restored with their snapshots and links, or deleted for good', async ({
  page
}) => {
  const errors = await openApp(page);
  const sid = await page.locator('.sc-btn >> nth=1').getAttribute('data-id');
  const title = (await page.locator('.sc-btn').nth(1).locator('.t').textContent()).trim();
  // delete buttons ask "Delete?" first (for about 3 seconds): wait for that, then confirm
  const del = async sel => {
    await page.click(sel, { force: true });
    await page.click(sel + '.on', { force: true });
  };
  await del('[data-a="delsc"][data-id="' + sid + '"]');
  await expect(page.locator('.sc-btn[data-id="' + sid + '"]')).toHaveCount(0);
  await page.click('#toast .t-act'); // Undo
  await expect(page.locator('.sc-btn[data-id="' + sid + '"]')).toHaveCount(1);
  // a scene with a snapshot, deleted and restored from the Trash
  await page.click('.sc-btn[data-id="' + sid + '"]');
  await page.click('#snBtn');
  await page.fill('#snName', 'Keep me');
  await page.click('#snForm button');
  await expect(page.locator('.sn-it').first()).toContainText('Keep me');
  await del('[data-a="delsc"][data-id="' + sid + '"]');
  let p = await waitSaved(page, p => p.tr && Object.values(p.tr).some(x => x.kind === 'scene') && !p.sc[sid]);
  expect(Object.values(p.sn).some(x => x.scene === sid)).toBe(false);
  await page.click('[data-a="trash"]');
  await expect(page.locator('.tr-row')).toHaveCount(1);
  await expect(page.locator('.tr-row')).toContainText(title);
  await page.click('.tr-row [data-tr="back"]');
  await expect(page.locator('#sceneTitle')).toHaveValue(title);
  p = await waitSaved(page, p => p.sc[sid] && !Object.keys(p.tr).length);
  expect(Object.values(p.sn).some(x => x.scene === sid)).toBe(true);
  // a character on a relationship map comes back linked to its bubble
  const onMap = pr => Object.values(pr.rm).some(r => r.nodes.some(n => n.ent === 'e_ilsa'));
  expect(onMap(p)).toBe(true);
  await del('[data-a="dele"][data-id="e_ilsa"]');
  p = await waitSaved(page, p => !p.en.e_ilsa);
  expect(onMap(p)).toBe(false);
  await page.click('[data-a="trash"]');
  await page.click('.tr-row [data-tr="back"]');
  p = await waitSaved(page, p => p.en.e_ilsa && onMap(p));
  expect(p.meta.ents.e_ilsa.name).toBe('Ilsa Verrin');
  // delete for good, and empty
  await del('[data-a="dele"][data-id="e_ilsa"]');
  await page.click('[data-a="trash"]');
  await page.click('.tr-row [data-tr="drop"]');
  await page.click('.tr-row [data-tr="drop"].danger'); // once it asks "Delete forever?"
  await expect(page.locator('.tr-row')).toHaveCount(0);
  await expect(page.locator('.ss-empty')).toContainText('empty');
  expect(errors).toEqual([]);
});

test('Trash: items older than 30 days go for good when the project opens', async ({ page }) => {
  const project = ONE_SCENE('Hello.');
  project.tr = {
    x_old: {
      kind: 'scene',
      at: Date.now() - 31 * 864e5,
      title: 'Old',
      d: { id: 's_old', ch: 'c1', i: 0, meta: { title: 'Old' }, sc: { text: 'gone' } }
    },
    x_new: {
      kind: 'scene',
      at: Date.now() - 2 * 864e5,
      title: 'Recent',
      d: { id: 's_new', ch: 'c1', i: 1, meta: { title: 'Recent' }, sc: { text: 'Back again.' } }
    }
  };
  const errors = await openApp(page, { project });
  await expect(page.locator('[data-a="trash"]')).toContainText('Trash (1)');
  await page.click('[data-a="trash"]');
  await expect(page.locator('.tr-row')).toHaveCount(1);
  await page.click('.tr-row [data-tr="back"]');
  await expect(page.locator('#ed')).toHaveText('Back again.');
  expect(errors).toEqual([]);
});

test('Search everything finds scenes, story pages, notes and brainstorms, and opens the right place', async ({
  page
}) => {
  const errors = await openApp(page);
  await page.click('#ed');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#main h1')).toHaveText('Search everything');
  await page.keyboard.type('compass');
  await expect(page.locator('.sa-sec h2')).toContainText(['Scenes']);
  await expect(page.locator('.sa-hit mark').first()).toHaveText(/compass/i);
  const areas = await page.locator('.sa-areas button').allTextContents();
  expect(areas.length).toBeGreaterThan(2); // All, plus at least two kinds of places
  await page.click('.sa-areas [data-area="nt"]');
  await page.click('.sa-hit:has-text("points at whoever is lying")');
  await expect(page.locator('#main .idea[data-id="i1"]')).toBeVisible();
  await page.click('[data-a="search"]'); // the search box in the binder; the last search is still there
  await expect(page.locator('#saQ')).toHaveValue('compass');
  await page.click('.sa-areas [data-area="scene"]');
  await page.locator('.sa-hit').first().click();
  expect((await page.evaluate(() => getSelection().toString())).toLowerCase()).toBe('compass');
  await page.click('[data-a="search"]');
  await page.fill('#saQ', 'zzqx nothing');
  await expect(page.locator('.sa-none')).toContainText('Nothing found');
  expect(errors).toEqual([]);
});

test('side by side: a story page beside the scene, edited in place, swapped and closed', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const errors = await openApp(page);
  await page.click('.sc-btn');
  await page.click('#spBtn');
  await expect(page.locator('#split')).toBeVisible();
  await page.click('[data-a="open-e"][data-id="e_tobias"]', { modifiers: ['Alt'] }); // Alt+click opens it beside the page
  await expect(page.locator('#split .sp-h')).toHaveText('Tobias Crane');
  await expect(page.locator('#main #ed')).toBeVisible(); // the scene stays open
  await page.fill('#split [data-spf="voice"]', 'Dry, careful, never in a hurry.');
  await waitSaved(page, p => p.en.e_tobias.fields.voice === 'Dry, careful, never in a hurry.');
  await page.selectOption('#spPick', { label: 'General notes' });
  await expect(page.locator('#split .sp-note')).toBeVisible();
  await page.click('#split [data-sp="swap"]'); // the note becomes the main view, the scene goes beside it
  await expect(page.locator('#main .nt-ta')).toBeVisible();
  await expect(page.locator('#split .sp-text')).toBeVisible();
  await page.keyboard.press('Control+Backslash');
  await expect(page.locator('#split')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Inkling remembers the scene, the caret and the scroll position, and reopens where you were', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 600 });
  const long = Array.from({ length: 60 }, (_, i) => 'Line ' + i + ' of a long scene.').join('\n');
  const project = ONE_SCENE(long);
  project.meta.chapters[0].scenes.push('s2');
  project.meta.scenes.s2 = { title: 'Second', status: 'draft', words: 0 };
  project.sc.s2 = { text: 'Short one.', synopsis: '', notes: '' };
  const errors = await openApp(page, { project });
  await page.click('#ed');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' End here.');
  const y = await page.locator('#main').evaluate(m => m.scrollTop);
  expect(y).toBeGreaterThan(300);
  await page.click('.sc-btn[data-id="s2"]');
  await expect(page.locator('#sceneTitle')).toHaveValue('Second');
  await page.click('.sc-btn[data-id="s1"]');
  await expect.poll(() => page.locator('#main').evaluate(m => m.scrollTop)).toBeGreaterThan(300);
  await page.keyboard.type('!'); // the caret came back to where it was
  await expect.poll(() => saved(page).then(p => p && p.sc.s1.text.endsWith('End here.!'))).toBe(true);
  await page.click('.sc-btn[data-id="s2"]');
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector('#ed');
  await expect(page.locator('#sceneTitle')).toHaveValue('Second'); // the project reopens on the last scene
  expect(errors).toEqual([]);
});

test('quick switcher, next and previous scene, back and forward', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const errors = await openApp(page);
  await page.click('.sc-btn');
  const first = await page.locator('#sceneTitle').inputValue();
  const pick = async q => {
    await page.keyboard.press('Control+p');
    await expect(page.locator('#qsQ')).toBeFocused();
    await page.keyboard.type(q);
    await expect(page.locator('.qs-it.on')).toContainText(q === 'ilsa' ? 'Ilsa Verrin' : 'The Crane ledger');
  };
  await page.keyboard.press('Control+p');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+p'); // quick repeats are not swallowed
  await expect(page.locator('#qsQ')).toBeFocused();
  await page.keyboard.press('Escape');
  await pick('crane led');
  await page.keyboard.press('Enter');
  await expect(page.locator('#sceneTitle')).toHaveValue('The Crane ledger');
  await pick('ilsa');
  await page.keyboard.down('Alt');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Alt');
  await expect(page.locator('#split .sp-h')).toHaveText('Ilsa Verrin');
  await page.keyboard.press('Control+Backslash');
  await page.click('.sc-nav [data-nav="-1"]');
  await expect(page.locator('#sceneTitle')).toHaveValue(first);
  await page.keyboard.press('Alt+PageDown');
  await expect(page.locator('#sceneTitle')).toHaveValue('The Crane ledger');
  await page.waitForTimeout(150);
  await page.keyboard.press('Alt+PageDown');
  await expect(page.locator('#sceneTitle')).not.toHaveValue('The Crane ledger');
  const third = await page.locator('#sceneTitle').inputValue();
  await page.waitForTimeout(150);
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(page.locator('#sceneTitle')).toHaveValue('The Crane ledger');
  await page.click('[data-a="fwd"]');
  await expect(page.locator('#sceneTitle')).toHaveValue(third);
  expect(errors).toEqual([]);
});

test('right-click menus in the binder, collapse all, and word targets', async ({ page }) => {
  const errors = await openApp(page);
  const sid = await page.locator('.sc-btn').first().getAttribute('data-id');
  await page.click('.sc-btn[data-id="' + sid + '"]', { button: 'right' });
  await page.click('.ctx button:has-text("Duplicate")');
  await expect(page.locator('.sc-btn .t', { hasText: '(copy)' })).toHaveCount(1);
  await page.click('.sc-btn[data-id="' + sid + '"]', { button: 'right' });
  await page.click('.ctx button:has-text("Status")');
  await page.click('.ctx button:has-text("Final")');
  await expect(page.locator('.sc-btn[data-id="' + sid + '"] .dot')).toHaveClass(/st-final/);
  await page.click('.sc-btn[data-id="' + sid + '"]', { button: 'right' });
  await page.click('.ctx button:has-text("Rename")');
  await page.fill('#rn', 'Renamed scene');
  await page.press('#rn', 'Enter');
  await expect(page.locator('.sc-btn[data-id="' + sid + '"] .t')).toHaveText('Renamed scene');
  await page.click('.sc-btn[data-id="' + sid + '"]', { button: 'right' });
  await page.click('.ctx button:has-text("Word target")');
  await page.fill('#askVal', '100');
  await page.press('#askVal', 'Enter');
  await expect(page.locator('.sc-btn[data-id="' + sid + '"] .tg')).toHaveCount(1);
  await page.click('.sc-btn[data-id="' + sid + '"]');
  await expect(page.locator('#sceneWc')).toContainText('of 100 words');
  await page.click('#ed');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' ' + 'word '.repeat(12));
  await expect(page.locator('#bubble')).toContainText('100-word target');
  await expect(page.locator('#sceneWc')).toHaveClass(/met/);
  await page.click('[data-a="fold"]');
  await expect(page.locator('.sc-row')).toHaveCount(0);
  await page.click('[data-a="fold"]');
  await expect(page.locator('.sc-row').first()).toBeVisible();
  const p = await waitSaved(page, p => p.meta.scenes[sid].goal === 100 && p.meta.scenes[sid].title === 'Renamed scene');
  expect(p.meta.scenes[sid].status).toBe('final');
  expect(errors).toEqual([]);
});

test('story pages: your own fields, and a picture dropped onto the page', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-a="open-e"][data-id="e_ilsa"]');
  await page.click('[data-fe="edit"]');
  await page.click('[data-fe="add"]');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Magic ability');
  await page.click('.fe-row:has(input[value="Notes"]) [data-fe="del"]');
  await page.click('[data-fe="done"]');
  await page.fill('.fields label:has-text("Magic ability") textarea', 'Reads the tide.');
  let p = await waitSaved(
    page,
    p => p.meta.fields && p.meta.fields.char && Object.values(p.en.e_ilsa.fields).includes('Reads the tide.')
  );
  expect(p.meta.fields.char.map(f => f[1])).toContain('Magic ability');
  expect(p.meta.fields.char.map(f => f[1])).not.toContain('Notes');
  await page.click('[data-a="open-e"][data-id="e_tobias"]');
  await expect(page.locator('.fields label:has-text("Magic ability")')).toHaveCount(1); // every character page has it
  await page.click('[data-a="open-e"][data-id="e_ilsa"]');
  await page.evaluate(() => {
    // drop a small PNG onto the page
    const b = atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDEgcxh4KAABJgIBCX0d2wAAAABJRU5ErkJggg=='
    );
    const f = new File([Uint8Array.from(b, c => c.charCodeAt(0))], 'face.png', { type: 'image/png' }),
      dt = new DataTransfer();
    dt.items.add(f);
    const pg = document.querySelector('.ent-page');
    pg.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    pg.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('#entTop img').first()).toBeVisible();
  expect(errors).toEqual([]);
});

const STORY_PROJECT = (() => {
  const chapters = [],
    scenes = {},
    sc = {};
  const texts = [
    'Mara walked to the market. She thought about her mother and wondered whether she remembered the old songs.',
    'Mara ran. The soldiers chased her through the alley, swords drawn, and she leapt the wall as a gun fired twice!',
    '"Where were you?" Jon asked. "Out," Mara said. "Out where?" "Just out."',
    'The rain fell on the quiet town. Jon sat by the window and remembered the summer.',
    'Jon felt the long afternoon pass. He wondered about the letter and thought about Mara.',
    'The tower exploded. Mara screamed, blood on her hands, and fought the captain on the burning stairs!'
  ];
  texts.forEach((t, i) => {
    const c = 'c' + (i + 1),
      s = 's' + (i + 1);
    chapters.push({ id: c, title: 'Chapter ' + (i + 1), open: true, scenes: [s] });
    scenes[s] = { title: 'Scene ' + (i + 1), status: 'draft', words: 0 };
    sc[s] = { text: t, synopsis: '', notes: '' };
  });
  return {
    meta: {
      v: 2,
      title: 'Story Test',
      chapters,
      scenes,
      days: {},
      pet: { name: 'Inky', total: 0 },
      ents: {
        e1: { id: 'e1', type: 'char', name: 'Mara', aliases: [], tag: '' },
        e2: { id: 'e2', type: 'char', name: 'Jon', aliases: [], tag: '' },
        e3: { id: 'e3', type: 'place', name: 'the market', aliases: [], tag: '' }
      }
    },
    sc,
    en: {}
  };
})();

test('story insights: scene details, pacing, point of view and plot threads', async ({ page }) => {
  const errors = await openApp(page, { project: STORY_PROJECT });
  await page.click('.sc-btn[data-id="s1"]');
  await page.selectOption('#sceneDet [data-sd="pov"]', 'e1');
  await page.selectOption('#sceneDet [data-sd="place"]', 'e3');
  await page.click('#sceneDet [data-sd="ten"][data-n="2"]');
  await page.fill('#sceneDet [data-sd="new"]', 'The missing letter');
  await page.press('#sceneDet [data-sd="new"]', 'Enter');
  await expect(page.locator('#sceneDet .th-chip.on')).toHaveText('The missing letter');
  let p = await waitSaved(page, p => p.meta.scenes.s1.threads && p.meta.scenes.s1.tension === 2);
  expect(p.meta.scenes.s1).toMatchObject({ pov: 'e1', place: 'e3', tension: 2 });
  expect(p.meta.threads).toHaveLength(1);
  // tension toggles off, and scene 2 also gets the thread from its chip
  await page.click('.sc-btn[data-id="s2"]');
  await page.click('#sceneDet .th-chip');
  await page.selectOption('#sceneDet [data-sd="pov"]', 'e1');
  await page.click('.sc-btn[data-id="s4"]');
  await page.selectOption('#sceneDet [data-sd="pov"]', 'e2');
  await page.click('#sceneDet [data-sd="ten"][data-n="5"]');
  await page.click('#sceneDet [data-sd="ten"][data-n="5"]');
  p = await waitSaved(page, p => p.meta.scenes.s2.threads && p.meta.scenes.s4.pov === 'e2');
  expect(p.meta.scenes.s4.tension).toBeUndefined();

  // Pacing: one column per scene, a set point for scene 1, action scenes estimated higher than reflective ones
  await page.click('#sceneDet [data-sd="open"]');
  await expect(page.locator('.mh-title')).toHaveText('Story insights');
  await expect(page.locator('.st-col')).toHaveCount(6);
  await expect(page.locator('.st-pt.set')).toHaveCount(1);
  const ys = await page.locator('.st-pt').evaluateAll(els => els.map(e => +e.getAttribute('cy')));
  expect(ys[1]).toBeLessThan(ys[3]);
  expect(ys[5]).toBeLessThan(ys[4]); // higher on screen = more tense
  await expect(page.locator('.st-notes')).toContainText('most intense scene');
  await page.click('.st-col[data-open="s3"]');
  await expect(page.locator('#sceneTitle')).toHaveValue('Scene 3');
  await page.click('#menuBtn');
  await page.click('[data-m="story"]');

  // Point of view and screen time
  await page.click('[data-st="tab"][data-v="cast"]');
  await expect(page.locator('.st-br')).toHaveCount(3);
  await expect(page.locator('.st-br').first()).toContainText('Mara');
  await expect(page.locator('.st-br').last()).toContainText('Not set');
  await expect(page.locator('.st-tab tbody tr')).toHaveCount(2);
  await expect(page.locator('.st-c.pov')).toHaveCount(3);

  // Plot threads: a grid, a warning for a thread that is dropped and never resolved, then resolving it
  await page.click('[data-st="tab"][data-v="threads"]');
  await expect(page.locator('.th-tab tbody tr')).toHaveCount(1);
  await expect(page.locator('.th-c.on')).toHaveCount(2);
  await expect(page.locator('.th-w.end')).toContainText('never resolved');
  await page.fill('#thName', 'Jon and Mara');
  await page.click('[data-st="thadd"]');
  await expect(page.locator('.th-w.none')).toContainText('Jon and Mara');
  await page.selectOption('.th-card >> nth=0 >> select', 's6');
  await expect(page.locator('.th-w.end')).toHaveCount(0);
  await expect(page.locator('.th-c.done')).toHaveCount(1);
  p = await waitSaved(page, p => p.meta.threads.length === 2 && p.meta.threads[0].done === 's6');
  expect(errors).toEqual([]);
});

test('setups and payoffs: plant from selected words, pay off later, and flag what is left hanging', async ({
  page
}) => {
  const errors = await openApp(page, { project: STORY_PROJECT });
  await page.click('.sc-btn[data-id="s2"]');
  // select "the wall" in the scene, then plant it as a setup from the Inkling panel
  await page.evaluate(() => {
    const ed = document.querySelector('#ed'),
      w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const i = n.data.indexOf('the wall');
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 8);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        return;
      }
    }
  });
  await page.waitForTimeout(200);
  await page.click('#sceneDet [data-sd="setup"]');
  await expect(page.locator('#sceneDet [data-sd="setup"]')).toHaveValue('the wall');
  await page.fill('#sceneDet [data-sd="setup"]', 'The cracked wall');
  await page.press('#sceneDet [data-sd="setup"]', 'Enter');
  await page.fill('#sceneDet [data-sd="setup"]', 'The captain’s promise');
  await page.press('#sceneDet [data-sd="setup"]', 'Enter');
  await expect(page.locator('#sceneDet .fs-li')).toHaveCount(2);
  // a later scene pays one off
  await page.click('.sc-btn[data-id="s6"]');
  await page.selectOption('#sceneDet [data-sd="pay"]', { label: 'The cracked wall' });
  await expect(page.locator('#sceneDet .fs-li.pay')).toContainText('The cracked wall');
  let p = await waitSaved(page, p => p.meta.setups && p.meta.setups.some(x => x.pay === 's6'));
  expect(p.meta.setups.map(x => [x.text, x.scene, x.pay])).toEqual([
    ['The cracked wall', 's2', 's6'],
    ['The captain’s promise', 's2', '']
  ]);
  // Story insights › Setups & payoffs
  await page.click('#sceneDet [data-sd="open"]');
  await page.click('[data-st="tab"][data-v="setups"]');
  await expect(page.locator('.pf h2').first()).toContainText('1 of 2 paid off');
  await expect(page.locator('.th-w.fs-open')).toContainText('captain’s promise');
  // a payoff before its setup is flagged
  await page.selectOption('.fs-card >> nth=1 >> [data-fs="pay"]', 's1');
  await expect(page.locator('.th-w.fs-order')).toContainText('before it is set up');
  await expect(page.locator('.fs-card.bad')).toHaveCount(1);
  // add one from the tab, then delete it
  await page.fill('#fsText', 'A key on a string');
  await page.selectOption('#fsScene', 's3');
  await page.press('#fsText', 'Enter');
  await expect(page.locator('.fs-card')).toHaveCount(3);
  await page.click('.fs-card:has([value="A key on a string"]) [data-st="fsdel"]');
  await expect(page.locator('.fs-card')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('character arcs: goal, wound, lie and truth, a point per chapter, and every arc together', async ({ page }) => {
  const errors = await openApp(page, { project: STORY_PROJECT });
  await page.click('.e-btn:has-text("Mara")');
  await expect(page.locator('#arcBox')).toBeVisible();
  await page.fill('[data-arc-f="lie"]', 'Running keeps you safe');
  await page.fill('[data-arc-f="truth"]', 'Some things are worth standing for');
  await page.click('[data-arc="type"][data-v="pos"]');
  // click low in chapter 1 and high in chapter 6
  const col = n => page.locator('[data-arc-ch="c' + n + '"] .arc-hit');
  await col(1).click({ position: { x: 10, y: 150 } });
  await col(6).click({ position: { x: 10, y: 12 } });
  await page.fill('[data-arc="n"]', 'She stays and fights');
  await expect(page.locator('#arcBox .arc-pt')).toHaveCount(2);
  let p = await waitSaved(page, p => p.en.e1?.arc?.pts?.c6?.n);
  expect(p.en.e1.arc.lie).toBe('Running keeps you safe');
  expect(p.en.e1.arc.pts.c1.v).toBeLessThan(4);
  expect(p.en.e1.arc.pts.c6.v).toBeGreaterThan(8);
  // pick a value from the list for the selected chapter
  await col(3).click({ position: { x: 10, y: 90 } });
  await page.selectOption('[data-arc="v"]', '5');
  p = await waitSaved(page, p => p.en.e1?.arc?.pts?.c3?.v === 5);
  // Story insights › Arcs
  await page.click('#storyBtn');
  await page.click('[data-st="tab"][data-v="arcs"]');
  await expect(page.locator('.arc-svg .arc-line')).toHaveCount(1);
  await expect(page.locator('.arc-tab tbody tr')).toHaveCount(1);
  await expect(page.locator('.arc-tab')).toContainText('Running keeps you safe');
  await expect(page.locator('.arc-tab')).toContainText('→');
  expect(errors).toEqual([]);
});

test('world-building: rules and glossary pages, invented calendars and money', async ({ page }) => {
  const errors = await openApp(page, { project: STORY_PROJECT });
  // the new binder sections start hidden; the world screen turns them on
  await expect(page.locator('[data-a="adde"][data-t="term"]')).toHaveCount(0);
  await page.click('#menuBtn');
  await page.click('[data-m="world"]');
  await expect(page.locator('.mh-title')).toHaveText('Calendars & money');
  await page.click('[data-w="secs"]');
  await expect(page.locator('[data-a="adde"][data-t="term"]')).toHaveCount(1);
  await expect(page.locator('[data-a="adde"][data-t="rule"]')).toHaveCount(1);
  // a glossary term is linked in the text with its pronunciation
  await page.click('[data-a="adde"][data-t="term"]');
  await page.fill('#entName', 'songs');
  await page.fill('textarea[data-k="meaning"]', 'Old tunes');
  await page.fill('textarea[data-k="say"]', 'SONGZ');
  await page.click('.sc-btn[data-id="s1"]');
  await expect(page.locator('#ed .ent.t-term')).toHaveAttribute('title', 'songs /SONGZ/ · Old tunes');
  // a calendar: day 40 of a 12 × 30(+5) day year falls in the second month
  await page.click('#menuBtn');
  await page.click('[data-m="world"]');
  await page.click('[data-w="addcal"]');
  await page.fill('.w-cal [data-w="name"]', 'Reckoning of Tides');
  await page.press('.w-cal [data-w="name"]', 'Tab');
  await page.fill('.w-cal [data-w="era"]', 'AT');
  await page.press('.w-cal [data-w="era"]', 'Tab');
  await page.fill('.w-cal [data-w="n"]', '40');
  await expect(page.locator('.w-cal [data-w-out="n"]')).toHaveText('Hearthday, 10 Second Month, year 1 AT');
  await page.fill('.w-cal [data-w="n"]', '366');
  await expect(page.locator('.w-cal [data-w-out="n"]')).toContainText('1 First Month, year 2 AT');
  await expect(page.locator('.w-cal .fine').first()).toContainText('365 days a year');
  // money: 2 crowns = 480 pennies = 2 Crown
  await page.click('[data-w="addcoin"]');
  await page.fill('.w-coin [data-w="q"]', '2');
  await page.selectOption('.w-coin [data-w="u"]', '0');
  await expect(page.locator('.w-coin .w-out')).toHaveText('= 480 Penny · 2 Crown');
  await page.fill('.w-coin [data-w="q"]', '30');
  await page.selectOption('.w-coin [data-w="u"]', '2');
  await expect(page.locator('.w-coin .w-out')).toHaveText('= 30 Penny · 2 Shilling, 6 Penny');
  const p = await waitSaved(page, p => p.meta.world?.cals?.[0]?.era === 'AT' && p.meta.world.coins.length === 1);
  expect(p.meta.secs.term).toBe(true);
  // a timeline can use the calendar for its time scale
  await page.click('[data-a="addtl"]');
  if (!(await page.locator('[data-sf="preset"]').isVisible())) await page.click('#tlv [data-tl="settings"]');
  await page.selectOption('[data-sf="preset"]', 'w:' + p.meta.world.cals[0].id);
  const q = await waitSaved(page, q =>
    Object.values(q.tl).some(t => t.axis.names.startsWith('First Month, Second Month'))
  );
  expect(Object.values(q.tl).find(t => t.axis.names).axis.fmt).toBe('{name} {cycle} AT');
  expect(errors).toEqual([]);
});

test('world maps: pins linked to places, scenes set there, drawing, and an uploaded map', async ({ page }) => {
  const errors = await openApp(page, { project: STORY_PROJECT });
  await page.click('.sc-btn[data-id="s1"]');
  await page.selectOption('#sceneDet [data-sd="place"]', 'e3');
  await page.click('[data-a="addnt"]');
  await page.click('[data-a="addnt-map"]');
  await expect(page.locator('#mpStage .mp-blank')).toBeVisible();
  await expect(page.locator('.mp-hint')).toBeVisible();
  // place a story page from the side list, then a free label by double-clicking
  await page.click('[data-mp="place"][data-id="e3"]');
  await page.locator('#mpStage').click({ position: { x: 200, y: 150 } });
  await expect(page.locator('.mp-pin')).toHaveCount(1);
  await expect(page.locator('.mp-pin span')).toHaveText('the market');
  await expect(page.locator('#mpSide')).toContainText('Scenes set here 1');
  await page.click('[data-mp="close"]');
  await page.locator('#mpStage').dblclick({ position: { x: 400, y: 260 } });
  await page.fill('[data-mpf="name"]', 'Old ruins');
  await expect(page.locator('.mp-pin span').nth(1)).toHaveText('Old ruins');
  // draw a stroke
  await page.click('[data-mp="mode"][data-v="draw"]');
  const box = await page.locator('#mpStage').boundingBox();
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 140, { steps: 5 });
  await page.mouse.move(box.x + 220, box.y + 120, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#mpInk polyline')).toHaveCount(1);
  let p = await waitSaved(page, p =>
    Object.values(p.nt || {}).some(d => d.pins && d.pins.length === 2 && d.ink && d.ink.length === 1)
  );
  const mapId = p.meta.nts.find(x => x.kind === 'map').id;
  expect(p.nt[mapId].pins.map(x => x.ent || x.name).sort()).toEqual(['Old ruins', 'e3']);
  // upload a map picture
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC',
    'base64'
  );
  await page.setInputFiles('#mpFile', { name: 'map.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#mpImg')).toHaveAttribute('src', /^data:image/);
  p = await waitSaved(page, p => p.nt[mapId].pic.l === true);
  // the place's story page links back to the map
  await page.click('.e-btn:has-text("the market")');
  await page.click('.ap[data-mapof]');
  await expect(page.locator('#mpSide h3')).toHaveText('the market');
  // search finds the free pin
  await page.click('#menuBtn');
  await page.click('[data-m="search"]');
  await page.fill('#saQ', 'ruins');
  await expect(page.locator('.sa-hit').first()).toContainText('Old ruins');
  expect(errors).toEqual([]);
});

test('series bible: bring pages, timelines and world details in from another book, update them, export the bible', async ({
  page
}) => {
  const errors = await openApp(page, { project: STORY_PROJECT });
  const book1 = JSON.parse(JSON.stringify(STORY_PROJECT));
  book1.meta.title = 'Book One';
  book1.meta.series = { name: 'The Tide Books', num: 1 };
  book1.meta.ents = {
    k1: { id: 'k1', type: 'char', name: 'Captain Orla', aliases: ['Orla'], tag: 'Harbour master' },
    k2: { id: 'k2', type: 'char', name: 'Mara', aliases: [], tag: 'From book one' },
    k3: { id: 'k3', type: 'term', name: 'saltglass', aliases: [], tag: '' }
  };
  book1.en = {
    k1: { fields: { look: 'Grey coat' } },
    k2: { fields: { want: 'To leave' } },
    k3: { fields: { meaning: 'Sea-made glass', say: 'SALT-glass' } }
  };
  book1.meta.tls = [{ id: 'tA', name: 'History' }];
  book1.tl = {
    tA: {
      axis: { start: 1, step: 1, px: 170, fmt: 'Year {n}', names: '', cycle: 1, snap: 1 },
      lanes: [{ id: 'L1', name: 'Wars', color: 'danger' }],
      cards: { c1: { id: 'c1', lane: 'L1', at: 3, len: 1, title: 'The flood', scene: 's1' } },
      marks: []
    }
  };
  book1.meta.world = {
    cals: [
      {
        id: 'cA',
        name: 'Tide Reckoning',
        months: [
          ['Ebb', 30],
          ['Flow', 30]
        ],
        week: '',
        era: 'TR',
        first: 1
      }
    ],
    coins: []
  };
  const file = o => ({
    name: 'book-one-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(o))
  });

  await page.click('#menuBtn');
  await page.click('[data-m="series"]');
  await expect(page.locator('.mh-title')).toHaveText('Series bible');
  await page.setInputFiles('#sbFile', file(book1));
  await expect(page.locator('.sb-src h3')).toContainText('Book One');
  await expect(page.locator('.sb-ck:has-text("Mara") small')).toHaveText('already here: will be updated');
  await expect(page.locator('.sb-ck:has-text("Captain Orla") small')).toHaveText('new');
  await page.check('[data-sb="tl"][value="tA"]');
  await page.click('[data-sr="bring"]');
  await expect(page.locator('.sb-linked .cl')).toHaveCount(3);
  let p = await waitSaved(page, p => Object.values(p.meta.ents).some(e => e.name === 'Captain Orla'));
  const orla = Object.values(p.meta.ents).find(e => e.name === 'Captain Orla');
  expect(orla.from).toMatchObject({ book: 'Book One', id: 'k1' });
  expect(p.en[orla.id].fields.look).toBe('Grey coat');
  expect(p.en.e1.fields.want).toBe('To leave'); // Mara here was updated, not duplicated
  expect(Object.values(p.meta.ents).filter(e => e.name === 'Mara')).toHaveLength(1);
  expect(p.meta.tls.some(x => x.name === 'History (Book One)')).toBe(true);
  expect(p.meta.world.cals[0].name).toBe('Tide Reckoning');
  expect(p.meta.series.name).toBe('The Tide Books');
  expect(p.meta.secs.term).toBe(true);
  // a newer copy of book one: only the changed page is marked
  book1.en.k1.fields.look = 'A new red coat';
  await page.setInputFiles('#sbFile', file(book1));
  await expect(page.locator('.sb-ck:has-text("Captain Orla") small')).toHaveText('already here: will be updated');
  await expect(page.locator('.sb-ck:has-text("saltglass") small')).toHaveText('already here, the same');
  await page.click('[data-sr="none"]');
  await page.check('.sb-ck:has-text("Captain Orla") input');
  await page.click('[data-sr="bring"]');
  p = await waitSaved(page, p => p.en[orla.id].fields.look === 'A new red coat');
  expect(Object.values(p.meta.ents).filter(e => e.name === 'Captain Orla')).toHaveLength(1);
  // the story bible
  const dl = page.waitForEvent('download');
  await page.click('[data-sr="biblemd"]');
  const md = await (await dl).path();
  const text = require('fs').readFileSync(md, 'utf8');
  expect(text).toContain('### Captain Orla');
  expect(text).toContain('**Pronunciation:** SALT-glass');
  expect(text).toContain('Tide Reckoning');
  const dl2 = page.waitForEvent('download');
  await page.click('[data-sr="bible"]');
  const docx = unzip(require('fs').readFileSync(await (await dl2).path()));
  expect(docx['word/document.xml'].toString()).toContain('Captain Orla');
  expect(errors).toEqual([]);
});

test('opening a scene only moves the binder highlight; a change still redraws the binder', async ({ page }) => {
  const errors = await openApp(page, { project: STORY_PROJECT });
  await page.click('.sc-btn[data-id="s1"]');
  await page.evaluate(() => {
    document.querySelector('.sc-row[data-sid="s4"]').dataset.keep = '1';
  });
  await page.click('.sc-btn[data-id="s4"]');
  await expect(page.locator('.sc-row.on')).toHaveCount(1);
  await expect(page.locator('.sc-row.on')).toHaveAttribute('data-sid', 's4');
  await expect(page.locator('.sc-row[data-sid="s4"]')).toHaveAttribute('data-keep', '1'); // same element: not rebuilt
  await page.click('.e-btn:has-text("Mara")');
  await expect(page.locator('.e-row.on .e-btn')).toHaveText(/Mara/);
  await expect(page.locator('.sc-row.on')).toHaveCount(0);
  // renaming a scene changes what the binder shows, so it is rebuilt
  await page.click('.sc-btn[data-id="s2"]');
  await page.fill('#sceneTitle', 'The chase');
  await expect(page.locator('.sc-btn[data-id="s2"]')).toContainText('The chase');
  await expect(page.locator('.sc-row.on')).toHaveAttribute('data-sid', 's2');
  expect(errors).toEqual([]);
});

test('book details: front and back matter, chapter kinds and numbering, in EPUB, Word and Markdown', async ({
  page
}) => {
  const errors = await openApp(page, { project: STORY_PROJECT });
  const fs = require('fs');
  await page.click('#menuBtn');
  await page.click('[data-m="book"]');
  await expect(page.locator('.mh-title')).toHaveText('Book details');
  await page.fill('[data-bk="subtitle"]', 'A Tide Book');
  await page.fill('[data-bk="author"]', 'Jane Writer');
  await page.fill('[data-bk="imprint"]', 'Gull Press');
  await page.fill('[data-bk="isbnE"]', '978-1-23456-789-0');
  await page.fill('[data-bk="keys"]', 'fantasy, sea');
  await expect(page.locator('.bk-preview')).toContainText('ISBN 978-1-23456-789-0 (ebook)');
  await expect(page.locator('.bk-preview')).toContainText('Copyright © ' + new Date().getFullYear() + ' Jane Writer');
  await page.fill('[data-bk="ded"]', 'For the tide-watchers.');
  await page.fill('[data-bk="about"]', 'Jane lives by the sea.');
  await page.fill('[data-bk="also"]', '## The Tide Books\nThe Lantern Tide\nThe Salt Road');
  await page.click('[data-bka="addlink"]');
  await page.fill('[data-bkl="label"]', 'Join my newsletter');
  await page.fill('[data-bkl="url"]', 'https://example.com/news');
  await page.check('[data-bkon="front:half"]');
  // chapter 1 is a part divider, chapter 6 an unnumbered epilogue; numbers in words
  await page.selectOption('[data-bkk="c1"]', 'part');
  await page.selectOption('[data-bkk="c6"]', 'un');
  await page.selectOption('[data-bk="chNum"]', 'word');
  await expect(page.locator('.bk-head').nth(0)).toHaveText('Part One · Chapter 1');
  await expect(page.locator('.bk-head').nth(1)).toHaveText('Chapter One · Chapter 2');
  await expect(page.locator('.bk-head').nth(5)).toHaveText('Chapter 6');
  await expect(page.locator('.bk-warn')).toBeVisible();
  await expect(page.locator('.ch-kind')).toHaveCount(2); // badges in the binder
  const p = await waitSaved(page, p => p.meta.book?.links?.[0]?.url && p.meta.chapters[5].kind === 'un');
  expect(p.meta.book).toMatchObject({ subtitle: 'A Tide Book', chNum: 'word', imprint: 'Gull Press' });
  expect(p.meta.chapters[0].kind).toBe('part');

  const get = async (fmt, matter) => {
    await page.click('#menuBtn');
    await page.click('[data-m="export"]');
    await page.click('[data-fmt="' + fmt + '"]');
    if (matter != null) await page.setChecked('[data-mat]', matter);
    const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="go"]')]);
    return fs.readFileSync(await d.path());
  };
  const e = unzip(await get('epub'));
  const opf = e['OEBPS/content.opf'].toString();
  expect(opf).toContain('<dc:publisher>Gull Press</dc:publisher>');
  expect(opf).toContain('<dc:subject>sea</dc:subject>');
  const spine = [...opf.matchAll(/<itemref idref="([^"]+)"/g)].map(x => x[1]);
  expect(spine.slice(0, 5)).toEqual(['f-half', 'f-title', 'f-copy', 'f-ded', 'f-toc']);
  expect(spine.slice(-3)).toEqual(['b-about', 'b-also', 'b-links']);
  expect(e['OEBPS/f-title.xhtml'].toString()).toContain('A Tide Book');
  expect(e['OEBPS/f-copy.xhtml'].toString()).toContain('978-1-23456-789-0');
  expect(e['OEBPS/f-toc.xhtml'].toString()).toContain('href="ch2.xhtml">Chapter One: Chapter 2</a>');
  expect(e['OEBPS/ch1.xhtml'].toString()).toContain('epub:type="part"');
  expect(e['OEBPS/ch1.xhtml'].toString()).toContain('<span class="cn">Part One</span>');
  expect(e['OEBPS/ch2.xhtml'].toString()).toContain(
    '<span class="cn">Chapter One</span><span class="ct">Chapter 2</span>'
  );
  expect(e['OEBPS/ch6.xhtml'].toString()).not.toContain('class="cn"');
  expect(e['OEBPS/b-also.xhtml'].toString()).toContain('<h3 class="bk-sh">The Tide Books</h3>');
  expect(e['OEBPS/b-links.xhtml'].toString()).toContain('<a href="https://example.com/news">Join my newsletter</a>');
  // every file is well-formed XML, as ebook stores and Word require
  const xmlOk = xml =>
    page.evaluate(x => !new DOMParser().parseFromString(x, 'application/xml').querySelector('parsererror'), xml);
  for (const f of Object.keys(e).filter(f => /\.(xhtml|opf)$/.test(f)))
    expect([f, await xmlOk(e[f].toString())]).toEqual([f, true]);
  const nav = e['OEBPS/nav.xhtml'].toString();
  expect(nav).toContain('epub:type="landmarks"');
  expect(nav).toContain('<a epub:type="bodymatter" href="ch1.xhtml">');

  const w = unzip(await get('docx', true));
  const doc = w['word/document.xml'].toString();
  expect(doc).toContain('For the tide-watchers.');
  expect(doc).toContain('Jane lives by the sea.');
  expect(doc).toContain('Chapter One');
  expect(doc).not.toContain('>END<');
  expect(await xmlOk(doc)).toBe(true);
  const md = (await get('md', true)).toString();
  expect(md).toContain('## Chapter Two: Chapter 3');
  expect(md).toContain('[Join my newsletter](https://example.com/news)');
  // without the matter, Word is the plain manuscript again
  const w2 = unzip(await get('docx', false))['word/document.xml'].toString();
  expect(w2).not.toContain('For the tide-watchers.');
  expect(w2).toContain('>END<');
  expect(errors).toEqual([]);
});

test('store-ready ebook: cover, book style, the check before publishing and tidy typography', async ({ page }) => {
  const project = JSON.parse(JSON.stringify(OLD_PROJECT));
  project.meta.chapters.push({ id: 'c2', title: 'Empty', open: true, scenes: ['s2'] });
  project.meta.scenes.s2 = { title: 'Blank', status: 'draft', words: 0 };
  project.sc.s1.text = '"*Go*," she said -- "now..."  \'Twas late. TODO fix';
  project.sc.s2 = { text: '', synopsis: '', notes: '' };
  project.meta.chapters[0].scenes.push('s3');
  project.meta.scenes.s3 = { title: 'Next', status: 'draft', words: 2 };
  project.sc.s3 = { text: 'Morning came.', synopsis: '', notes: '' };
  const errors = await openApp(page, { project });
  const fs = require('fs');
  await page.click('#menuBtn');
  await page.click('[data-m="book"]');
  // a cover the size stores ask for, made in the page
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 2560;
    const g = c.getContext('2d');
    g.fillStyle = '#246';
    g.fillRect(0, 0, 1600, 2560);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.setInputFiles('[data-bkcv]', {
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64')
  });
  await expect(page.locator('#bkCvSize')).toHaveText('1600 × 2560 pixels');
  // a style brings its own drop cap, ornament and heading flourish; each can be changed after
  await page.click('[data-bkst="storybook"]');
  await expect(page.locator('.bk-st.on')).toContainText('Storybook');
  await expect(page.locator('.bk-pv .dc')).toHaveCount(1);
  await expect(page.locator('.bk-pv p.deco')).toHaveCount(1);
  await page.uncheck('[data-bkf="sc"]');
  await expect(page.locator('.bk-pv .sc')).toHaveCount(0);
  await page.selectOption('[data-bkf="orn"]', '⁂');
  await expect(page.locator('.bk-pv p.brk').first()).toHaveText('⁂');
  await page.fill('[data-bk="isbnP"]', '978-1-23456-789-0'); // wrong check digit
  await page.fill('[data-bk="isbnE"]', '978-1-23456-789-7');

  // the Export dialog warns before publishing
  await page.click('#menuBtn');
  await page.click('[data-m="export"]');
  await page.click('[data-fmt="epub"]');
  await expect(page.locator('#exCheck')).toContainText('Your name is missing');
  await expect(page.locator('[data-bkstyle]')).toHaveValue('storybook');
  await page.click('[data-x="close"]');

  await page.click('[data-bka="check"]');
  const check = page.locator('#bkCheck');
  await expect(check).toContainText('Your name is missing');
  await expect(check).toContainText('paperback ISBN');
  await expect(check).not.toContainText('ebook ISBN');
  await expect(check).not.toContainText('no cover');
  await expect(check).toContainText('straight quote');
  await expect(check).toContainText('“Empty” has no text yet.');
  await expect(check).toContainText('“First” has a TODO');
  await page.fill('[data-bk="author"]', 'Jane Writer');
  await page.fill('[data-bk="isbnP"]', '');
  await page.click('[data-bka="tidy"]');
  await expect(check).not.toContainText('straight quote');
  await expect(check).not.toContainText('Your name is missing');
  const p = await waitSaved(
    page,
    p => p.sc.s1.text.includes('“') && Object.values(p.sn || {}).some(x => x.auto === 'replace')
  );
  // quotes around formatting markers, dashes, ellipses and double spaces
  expect(p.sc.s1.text).toBe('“*Go*,” she said — “now…” ‘Twas late. TODO fix');
  expect(p.meta.book).toMatchObject({ style: 'storybook', dc: true, sc: false, orn: '⁂' });

  await page.click('#menuBtn');
  await page.click('[data-m="export"]');
  await page.click('[data-fmt="epub"]');
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="go"]')]);
  const buf = fs.readFileSync(await d.path());
  const e = unzip(buf);
  const opf = e['OEBPS/content.opf'].toString();
  expect([...e['OEBPS/cover.jpg'].slice(0, 2)]).toEqual([0xff, 0xd8]);
  expect(opf).toContain('properties="cover-image"');
  expect(opf).toContain('<meta name="cover" content="cover-img"/>');
  expect(opf.match(/<itemref idref="([^"]+)"/)[1]).toBe('cover');
  expect(opf).toContain('<spine toc="ncx">');
  expect(e['OEBPS/toc.ncx'].toString()).toContain('<content src="ch1.xhtml"/>');
  expect(e['OEBPS/nav.xhtml'].toString()).toContain('<a epub:type="cover" href="cover.xhtml">');
  const ch1 = e['OEBPS/ch1.xhtml'].toString();
  expect(ch1).toContain('<span class="dc">');
  expect(ch1).not.toContain('class="sc"');
  expect(ch1).toContain('<p class="deco">✦</p>');
  expect(ch1).toContain('<p class="brk">⁂</p>');
  expect(e['OEBPS/style.css'].toString()).toContain('.dc{float:left');
  // the ebook passes the stores' own validator, EPUBCheck (CI sets EPUBCHECK_JAR)
  if (process.env.EPUBCHECK_JAR) {
    const f = test.info().outputPath('book.epub');
    fs.writeFileSync(f, buf);
    const r = require('child_process').spawnSync('java', ['-jar', process.env.EPUBCHECK_JAR, f], { encoding: 'utf8' });
    expect(r.stdout + r.stderr).toContain('0 fatals / 0 errors');
  }
  expect(errors).toEqual([]);
});

test('print book: KDP page layout with right-hand chapter starts, running heads, page numbers and contents', async ({
  page
}) => {
  const errors = await openApp(page, { project: STORY_PROJECT });
  await page.click('#menuBtn');
  await page.click('[data-m="book"]');
  await page.fill('[data-bk="author"]', 'Jane Writer');
  await page.fill('[data-bk="ded"]', 'For the tide-watchers.');
  await page.selectOption('[data-bk="chNum"]', 'word');
  await page.selectOption('[data-bkp="trim"]', '6x9');
  await page.selectOption('[data-bkp="font"]', 'crimson');
  await page.click('[data-bka="count"]');
  await expect(page.locator('.bk-facts')).toContainText('Spine width');
  const facts = await page.locator('.bk-facts').textContent();
  const pages = +facts.match(/Pages(\d+)/)[1];
  expect(pages % 2).toBe(0);
  // hardcovers: fewer trims, white paper only, and the spine comes from KDP's calculator
  await page.selectOption('[data-bkp="bind"]', 'hc');
  await expect(page.locator('[data-bkp="trim"] option')).toHaveCount(4);
  await expect(page.locator('[data-bkp="paper"]')).toHaveCount(0);
  await page.selectOption('[data-bkp="bind"]', 'pb');
  await page.selectOption('[data-bkp="trim"]', '6x9');
  const p = await waitSaved(page, p => p.meta.book?.print?.trim === '6x9' && p.meta.book.print.font === 'crimson');
  expect(p.meta.book.print).toMatchObject({ bind: 'pb', paper: 'cream', recto: true, heads: 'at' });

  // export: the browser path lays the pages out in a frame and opens its print window
  await page.click('#menuBtn');
  await page.click('[data-m="export"]');
  await page.click('[data-fmt="print"]');
  await expect(page.locator('.pj-dlg .fine').first()).toContainText('6 × 9 in');
  await page.click('[data-x="go"]');
  const frame = await (await page.waitForSelector('iframe.ink-print', { state: 'attached' })).contentFrame();
  await frame.waitForSelector('.pg.end');
  const r = await frame.evaluate(() => {
    const pgs = [...document.querySelectorAll('.pg')],
      front = document.querySelectorAll('#front .pg').length,
      main = [...document.querySelectorAll('#main .pg')];
    const over = [...document.querySelectorAll('.pb')].filter(pb => {
      const l = pb.lastElementChild;
      return l && l.offsetTop + l.offsetHeight > pb.clientHeight + 1;
    }).length;
    return {
      total: pgs.length,
      front,
      width: getComputedStyle(pgs[0]).width,
      over,
      // per story page: right-hand?, opens a chapter?, running head, page number
      body: main.map(x => ({
        r: x.classList.contains('r'),
        open: !!x.querySelector('.pb > h1:first-child'),
        head: (x.querySelector('.ph') || {}).textContent || '',
        num: (x.querySelector('.pf') || {}).textContent || '',
        blank: !x.querySelector('.pb')
      })),
      toc: [...document.querySelectorAll('.bk-toc')].map(t => t.textContent),
      title: (document.querySelector('h1.bk-title') || {}).textContent
    };
  });
  expect(r.total).toBe(pages);
  expect(r.front % 2).toBe(0); // the story starts on a right-hand page
  expect(r.width).toBe('576px'); // 6 in
  expect(r.over).toBe(0);
  expect(r.title).toBe('Story Test');
  const opens = r.body.map((x, i) => (x.open ? i : -1)).filter(i => i >= 0);
  expect(opens.length).toBe(6);
  opens.forEach(i => {
    expect(r.body[i].r).toBe(true); // chapters open on right-hand pages
    expect(r.body[i].head).toBe(''); // with no running head
  });
  expect(r.body[0].num).toBe('1');
  r.body.forEach((x, i) => {
    if (x.blank) expect(x.num + x.head).toBe('');
    else if (!x.open) expect(x.head).toBe(x.r ? 'Story Test' : 'Jane Writer');
    if (!x.blank) expect(x.num).toBe(String(i + 1));
  });
  // the contents page gives each chapter's first page
  expect(r.toc[1]).toMatch(new RegExp('^Chapter Two.*' + (opens[1] + 1) + '$'));
  expect(errors).toEqual([]);
});

test('print book: a paragraph split across pages breaks exactly where the line did, so no line is stretched', async ({
  page
}) => {
  // fiction is full of dashes ("ground—and"): the browser breaks lines after them, not only at spaces
  const words = 'the hilt struck the ruined ground—and then silence—only the long-forgotten echo of steel'.split(' ');
  const para = n =>
    Array.from({ length: n }, (_, i) => words[(i * 7) % words.length] + (i % 9 === 8 ? '—half-remembered' : '')).join(
      ' '
    );
  const text = Array.from({ length: 40 }, (_, i) => para(60 + (i % 5) * 25)).join('\n');
  const project = {
    meta: {
      v: 2,
      title: 'Dashes',
      author: 'Jane Writer',
      chapters: [{ id: 'c1', title: 'One', open: true, scenes: ['s1'] }],
      scenes: { s1: { title: 'S', status: 'draft', words: 0 } },
      ents: {},
      days: {},
      pet: { name: 'Inky', total: 0 }
    },
    sc: { s1: { text, synopsis: '', notes: '' } },
    en: {}
  };
  const errors = await openApp(page, { project });
  await page.click('#menuBtn');
  await page.click('[data-m="export"]');
  await page.click('[data-fmt="print"]');
  await page.click('[data-x="go"]');
  const frame = await (await page.waitForSelector('iframe.ink-print', { state: 'attached' })).contentFrame();
  await frame.waitForSelector('.pg.end');
  const r = await frame.evaluate(() => {
    const cuts = [...document.querySelectorAll('#main p.cut')];
    // how full each split paragraph's last line is when not stretched
    const fills = cuts.map(p => {
      p.classList.remove('cut');
      const rg = document.createRange();
      rg.selectNodeContents(p);
      const rects = [...rg.getClientRects()].filter(b => b.width),
        low = Math.max(...rects.map(b => b.top)),
        right = Math.max(...rects.filter(b => b.top > low - 3).map(b => b.right)),
        box = p.getBoundingClientRect();
      p.classList.add('cut');
      return (right - box.left) / box.width;
    });
    const story = [...document.querySelectorAll('#main .pb p')].map(p => p.textContent).join(' ');
    return { cuts: cuts.length, fills, story };
  });
  expect(r.cuts).toBeGreaterThan(5);
  r.fills.forEach(f => expect(f).toBeGreaterThan(0.8));
  // every word comes through once, in order
  const squash = s => s.replace(/[\s\u00AD-]/g, ''); // (soft hyphens from hyphenation are invisible)
  expect(squash(r.story)).toBe(squash(text));
  expect(errors).toEqual([]);
});

test('book preview: ebook pages on reading devices, print spreads, and a live preview beside the writing', async ({
  page
}) => {
  const project = JSON.parse(JSON.stringify(STORY_PROJECT));
  project.sc.s1.text = Array(30).fill(project.sc.s1.text).join('\n'); // a chapter long enough to turn pages
  const errors = await openApp(page, { project });
  await page.click('#menuBtn');
  await page.click('[data-m="preview"]');
  await expect(page.locator('.mh-title')).toHaveText('Book preview');
  // ebook: the chapter in the book style, a page at a time
  const ebook = page.frameLocator('#pvStage .pv-frame');
  await expect(ebook.locator('h1.ch')).toBeVisible();
  await expect(page.locator('#pvStage .pv-pg')).toHaveText(/^Page 1 of \d+$/);
  await page.click('[data-pvo="dev"][data-v="kindle"]');
  await expect(page.locator('#pvStage .pv-frame')).toHaveAttribute('width', '530');
  await page.click('[data-pvo="theme"][data-v="night"]');
  await expect(ebook.locator('body')).toHaveCSS('background-color', 'rgb(18, 18, 18)');
  // a long chapter turns pages
  await page.click('[data-pvz="1"]');
  await page.click('[data-pvz="1"]');
  await expect(page.locator('#pvStage .pv-pg')).not.toHaveText('Page 1 of 1');
  const pages = +(await page.locator('#pvStage .pv-pg').textContent()).match(/of (\d+)/)[1];
  await page.click('[data-pvp="1"]');
  await expect(page.locator('#pvStage .pv-pg')).toHaveText('Page 2 of ' + pages);
  await page.selectOption('[data-pvsel]', 'front');
  await expect(ebook.locator('h1.bk-title')).toHaveText('Story Test');
  // the choices are remembered on this device
  const pv = JSON.parse(await page.evaluate(() => localStorage.getItem('inkling:pv')));
  expect(pv).toMatchObject({ dev: 'kindle', theme: 'night', size: 1.3 });

  // print: the laid-out book as spreads, the first page on the right
  await page.click('[data-pvt="print"]');
  const print = page.frameLocator('#pvPrint .pv-pframe');
  await expect(print.locator('.pg').first()).toBeVisible();
  const n = await print.locator('.pg').count();
  expect(n % 2).toBe(0);
  await expect(print.locator('.pg').first()).toHaveCSS('grid-column-start', '2');
  await expect(page.locator('.pv-facts')).toContainText(n + ' pages');

  // beside the writing: the chapter being written, following the text as it changes
  await page.click('[data-pva="side"]');
  await expect(page.locator('#split .pv-frame')).toBeVisible();
  await page.click('#ed');
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('Zephyrine ');
  await expect(page.frameLocator('#split .pv-frame').locator('#flow')).toContainText('Zephyrine');
  await page.click('[data-pvside="print"]');
  await expect(page.frameLocator('#split .pv-pframe').locator('.pg').first()).toContainText('Zephyrine');
  // moving to another chapter's scene moves the preview with it
  const other = await page.locator('.sc-btn').last().getAttribute('data-id');
  await page.click('.sc-btn[data-id="' + other + '"]');
  await page.click('[data-pvside="ebook"]');
  const lastCh = await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('inkling:project'));
    return p.meta.chapters[p.meta.chapters.length - 1].title;
  });
  await expect(page.locator('#pvSideSub')).toContainText(lastCh);
  expect(errors).toEqual([]);
});

// Picks a Word file through the menu's Import from Word.
async function importDocx(page, name, buffer) {
  await page.click('#menuBtn');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-m="docx"]')]);
  await chooser.setFiles({
    name,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer
  });
  await expect(page.locator('.pj-dlg.dx')).toBeVisible();
}

test('import from Word: headings become chapters, parts and scenes, with italics, bold and underlining', async ({
  page
}) => {
  const errors = await openApp(page);
  const doc = makeDocx(
    [
      { style: 'Title', runs: [['The Glass Tide']] },
      'Copyright 2026 Jane Writer',
      { style: 'Heading1', runs: [['Prologue']] },
      { runs: [['The sea was '], ['very', 'i'], [' cold and '], ['loud', 'b'], [' and '], ['grey', 'u'], ['.']] },
      '* * *',
      { runs: [['A gull cried '], ['twice', 'e'], ['.']] },
      { style: 'Heading1', runs: [['Part One']] },
      { style: 'Heading1', runs: [['Chapter 1']] },
      { style: 'Heading2', runs: [['Into the Fog']] },
      {
        runs: [['Ilsa stepped off the ferry.']],
        xml: '<w:del><w:r><w:delText>DELETED WORDS</w:delText></w:r></w:del><w:ins><w:r><w:t xml:space="preserve"> She waited.</w:t></w:r></w:ins><w:r><w:br/><w:t>A new line.</w:t></w:r>'
      },
      {
        style: 'raw',
        xml: '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Inside a table.</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
      },
      { style: 'Heading1', runs: [['Chapter 2: Lanterns']] },
      { style: 'Heading2', runs: [['Night market']] },
      'The lamps came on one by one.',
      { style: 'Heading2', runs: [['Morning']] },
      'By morning the fog had lifted.',
      // a horizontal line on its own (as Word and pandoc draw one) is a scene break
      {
        style: 'raw',
        xml: '<w:p><w:r><w:pict><v:rect xmlns:v="urn:schemas-microsoft-com:vml" style="width:0;height:1.5pt"/></w:pict></w:r></w:p>'
      },
      'Then the tide came in.'
    ],
    { title: 'Core title' }
  );
  await importDocx(page, 'the-glass-tide.docx', doc);
  await expect(page.locator('[data-dx="title"]')).toHaveValue('The Glass Tide');
  await expect(page.locator('[data-dx="author"]')).toHaveValue('Jane Writer');
  await expect(page.locator('.dx-sum')).toContainText('4 chapters');
  await expect(page.locator('.dx-sum')).toContainText('found at heading 1');
  await expect(page.locator('.dx-list li')).toHaveText([
    /^Prologue Unnumbered/,
    /^Part One Part/,
    /^Chapter 1: Into the Fog/,
    /^Chapter 2: Lanterns/
  ]);
  await page.click('[data-x="go"]');
  // in a browser the import takes the place of the open project, after asking
  await page.click('.ask [data-v="go"]');
  const p = await waitSaved(page, p => p.meta.title === 'The Glass Tide');
  const ch = p.meta.chapters;
  expect(ch.map(c => [c.title, c.kind || ''])).toEqual([
    ['Prologue', 'un'],
    ['Part One', 'part'],
    ['Chapter 1: Into the Fog', ''],
    ['Chapter 2: Lanterns', '']
  ]);
  const text = c => c.scenes.map(id => p.sc[id].text);
  expect(text(ch[0])).toEqual(['The sea was *very* cold and **loud** and __grey__.', 'A gull cried *twice*.']);
  expect(text(ch[2])).toEqual(['Ilsa stepped off the ferry. She waited.\nA new line.\nInside a table.']);
  expect(ch[3].scenes.map(id => p.meta.scenes[id].title)).toEqual(['Night market', 'Morning', 'Scene 3']);
  expect(p.sc[ch[3].scenes[2]].text).toBe('Then the tide came in.');
  expect(p.meta.author).toBe('Jane Writer');
  expect(JSON.stringify(p)).not.toContain('DELETED WORDS');
  expect(JSON.stringify(p)).not.toContain('Copyright 2026'); // a short title page is left out
  // imported words are the project's, not today's writing
  expect(Object.values(p.meta.scenes).reduce((a, x) => a + x.words, 0)).toBeGreaterThan(30);
  expect(Object.values(p.meta.days || {}).reduce((a, x) => a + x, 0)).toBe(0);
  expect(errors).toEqual([]);
});

test('import from Word: a plain manuscript with “Chapter” lines and # breaks, added to this project', async ({
  page
}) => {
  const errors = await openApp(page);
  const before = await page.locator('#binder [data-a="delch"]').count();
  const doc = makeDocx([
    'CHAPTER ONE',
    'The Salt Road',
    'She walked a long way.',
    '#',
    'Later, the rain began.',
    'Chapter Two',
    '"Where were you?" he asked.',
    { pageBreak: true, runs: [['Epilogue']] },
    'It ended well.'
  ]);
  await importDocx(page, 'manuscript.docx', doc);
  await expect(page.locator('.dx-sum')).toContainText('3 chapters');
  await expect(page.locator('.dx-list li')).toHaveText([/^CHAPTER ONE: The Salt Road/, /^Chapter Two/, /^Epilogue/]);
  // chapters can be found another way: at page breaks there is only one
  await page.selectOption('[data-dx="mode"]', 'page');
  await expect(page.locator('.dx-sum')).toContainText('1 chapter,');
  await page.selectOption('[data-dx="mode"]', 'auto');
  await page.selectOption('[data-dx="where"]', 'add');
  await page.click('[data-x="go"]');
  const p = await waitSaved(page, p => p.meta.chapters.length === before + 3);
  const added = p.meta.chapters.slice(before);
  expect(added.map(c => c.title)).toEqual(['CHAPTER ONE: The Salt Road', 'Chapter Two', 'Epilogue']);
  expect(added[0].scenes.map(id => p.sc[id].text)).toEqual(['She walked a long way.', 'Later, the rain began.']);
  // the title line wasn't merged into a chapter whose next line is dialogue
  expect(p.sc[added[1].scenes[0]].text).toBe('"Where were you?" he asked.');
  expect(added[2].kind).toBe('un');
  expect(p.meta.title).toContain('Lantern'); // still the same project
  await expect(page.locator('#ed')).toContainText('She walked a long way.');
  expect(errors).toEqual([]);
});

test('import from Word: a book exported from Inkling comes back with the same chapters and text', async ({ page }) => {
  const errors = await openApp(page);
  const fs = require('fs');
  await page.click('#menuBtn');
  await page.click('[data-m="export"]');
  await page.click('[data-fmt="docx"]');
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-x="go"]')]);
  const buf = fs.readFileSync(await d.path());
  const n = await page.locator('#binder [data-a="delch"]').count();
  await importDocx(page, 'round-trip.docx', buf);
  await page.selectOption('[data-dx="where"]', 'add');
  await page.click('[data-x="go"]');
  const p = await waitSaved(page, p => p.meta.chapters.length >= n * 2);
  const words = c => c.scenes.reduce((a, id) => a + p.meta.scenes[id].words, 0);
  const a = p.meta.chapters.slice(0, n),
    b = p.meta.chapters.slice(n);
  expect(b.length).toBe(n);
  b.forEach((c, i) => {
    expect(c.scenes.length).toBe(a[i].scenes.length);
    expect(words(c)).toBe(words(a[i]));
  });
  expect(errors).toEqual([]);
});

test('print book: English hyphenation with book rules, and none across a page turn', async ({ page }) => {
  // long words in a narrow measure, so many lines end in a hyphen
  const words =
    'hyphenation responsibility characteristically remembered the lighthouse keeper Constantinople incomprehensibility table extraordinary'.split(
      ' '
    );
  const para = n => Array.from({ length: n }, (_, i) => words[(i * 5) % words.length]).join(' ') + '.';
  const text = Array.from({ length: 30 }, (_, i) => para(50 + (i % 4) * 20)).join('\n');
  const project = {
    meta: {
      v: 2,
      title: 'Hyphens',
      author: 'Jane Writer',
      chapters: [{ id: 'c1', title: 'One', open: true, scenes: ['s1'] }],
      scenes: { s1: { title: 'S', status: 'draft', words: 0 } },
      ents: {},
      days: {},
      pet: { name: 'Inky', total: 0 },
      book: { print: { trim: '5x8', size: 13 } }
    },
    sc: { s1: { text, synopsis: '', notes: '' } },
    en: {}
  };
  const errors = await openApp(page, { project });
  const layout = async () => {
    await page.evaluate(() => document.querySelectorAll('iframe.ink-print').forEach(f => f.remove()));
    await page.click('#menuBtn');
    await page.click('[data-m="export"]');
    await page.click('[data-fmt="print"]');
    await page.click('[data-x="go"]');
    const frame = await (await page.waitForSelector('iframe.ink-print', { state: 'attached' })).contentFrame();
    await frame.waitForSelector('.pg.end');
    return frame.evaluate(() => {
      const ps = [...document.querySelectorAll('#main .pb p:not(.brk)')],
        text = ps.map(p => p.textContent).join(' ');
      // the longest run of lines ending in a hyphen, in any paragraph
      let worst = 0;
      ps.forEach(p => {
        const r = document.createRange(),
          ends = new Set(),
          top = p.getBoundingClientRect().top,
          lh = parseFloat(getComputedStyle(p).lineHeight);
        const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = tw.nextNode()))
          for (let i = n.data.indexOf('­'); i > 0 && i < n.data.length - 1; i = n.data.indexOf('­', i + 1)) {
            // where the line breaks, the soft hyphen is drawn as a hyphen: one of its boxes has a width
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            const a = [...r.getClientRects()].find(x => x.width > 0.5);
            if (a) ends.add(Math.floor((a.top - top + lh * 0.3) / lh));
          }
        let run = 0;
        for (let l = 0; l < 400; l++) {
          run = ends.has(l) ? run + 1 : 0;
          worst = Math.max(worst, run);
        }
      });
      return {
        text,
        hyphenated: worst,
        pageTurn: [...document.querySelectorAll('#main p.cut')].filter(p => /­$/.test(p.textContent)).length
      };
    });
  };
  const r = await layout();
  expect(r.text).toContain('hy­phen­ation');
  expect(r.text).toContain('char­ac­ter­is­ti­cally');
  expect(r.text).toContain(' Constantinople '); // names stay whole
  expect(r.text).toContain(' table '); // so do short words
  expect(r.hyphenated).toBeGreaterThan(0);
  expect(r.hyphenated).toBeLessThanOrEqual(2); // never more than two hyphens in a row
  expect(r.pageTurn).toBe(0); // and never a word split across a page turn
  expect(r.text.replace(/[\s­]/g, '')).toBe(text.replace(/\s/g, '')); // every letter is still there
  // switched off in Book details › Print book
  await page.click('#menuBtn');
  await page.click('[data-m="book"]');
  await page.uncheck('[data-bkp="hyph"]');
  expect((await layout()).text).not.toContain('­');
  expect(errors).toEqual([]);
});

// Pastes into the scene editor as a browser would, with an HTML version and a plain version.
async function pasteInto(page, html, plain) {
  await page.evaluate(
    ([html, plain]) => {
      const dt = new DataTransfer();
      if (html) dt.setData('text/html', html);
      dt.setData('text/plain', plain);
      document.querySelector('#ed').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    },
    [html, plain]
  );
}
// Puts the caret in the scene editor at a visible-text offset.
async function caretAt(page, off) {
  await page.click('#ed');
  await page.evaluate(off => {
    const ed = document.querySelector('#ed'),
      w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let n,
      acc = 0;
    while ((n = w.nextNode())) {
      if (acc + n.data.length >= off) {
        const r = document.createRange();
        r.setStart(n, off - acc);
        r.collapse(true);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        return;
      }
      acc += n.data.length;
    }
  }, off);
}
const TWO_SCENES = text => ({
  meta: {
    v: 2,
    title: 'Paste',
    chapters: [{ id: 'c1', title: 'One', open: true, scenes: ['s1', 's2'] }],
    scenes: {
      s1: { title: 'First', status: 'draft', words: 0, pov: '' },
      s2: { title: 'Second', status: 'draft', words: 0 }
    },
    ents: {},
    days: {},
    pet: { name: 'Inky', total: 0 }
  },
  sc: {
    s1: { text, synopsis: 'The arrival.', notes: 'Check the tide.', stickies: [] },
    s2: { text: 'They met at dawn.', synopsis: 'The meeting.', notes: '', stickies: [] }
  },
  en: {}
});

test('paste keeps italics, bold and underlining from Google Docs, Word and other scenes', async ({ page }) => {
  const errors = await openApp(page, { project: TWO_SCENES('Hello *world* end.') });
  await page.click('.sc-btn[data-id="s1"]');
  // Google Docs: everything wrapped in <b style="font-weight:normal">, formatting as inline styles
  await page.click('#ed');
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter'); // a new empty line, then paste there
  await pasteInto(
    page,
    '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:400;font-style:normal;"> She said </span><span style="font-weight:400;font-style:italic;">never</span><span style="font-weight:400;"> again.</span></p><p dir="ltr"><span style="font-weight:700;">Bold line</span></p></b>',
    'She said never again.\nBold line'
  );
  let p = await waitSaved(page, p => p.sc.s1.text.includes('Bold'));
  expect(p.sc.s1.text).toBe('Hello *world* end.\nShe said *never* again.\n**Bold line**');
  // Word: classes, comments, an empty paragraph, <o:p> tags and underlining
  await caretAt(page, plainLen(p.sc.s1.text));
  await pasteInto(
    page,
    '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{margin:0}</style></head><body><!--StartFragment--><p class=MsoNormal>The <i>Gull</i> was <u>full</u>.<o:p></o:p></p><p class=MsoNormal><o:p>&nbsp;</o:p></p><p class=MsoNormal>Next.</p><!--EndFragment--></body></html>',
    'The Gull was full.\n\nNext.'
  );
  p = await waitSaved(page, p => p.sc.s1.text.includes('Next.'));
  expect(p.sc.s1.text).toBe(
    'Hello *world* end.\nShe said *never* again.\n**Bold line**The *Gull* was __full__.\n\nNext.'
  );
  // pasting bold into the middle of italic text keeps both, and the markers stay well formed
  await caretAt(page, 8); // Hello wo|rld
  await pasteInto(page, '<b>X</b>', 'X');
  p = await waitSaved(page, p => p.sc.s1.text.includes('X'));
  await expect(page.locator('#ed i').first()).toHaveText('wo');
  await expect(page.locator('#ed b').first()).toHaveText('X');
  expect(await page.locator('#ed').textContent()).toContain('Hello woXrld end.');
  // plain text (nothing formatted) still arrives as it is
  await caretAt(page, 0);
  await pasteInto(page, '<span>plain</span>', 'plain ');
  p = await waitSaved(page, p => p.sc.s1.text.startsWith('plain'));
  expect(errors).toEqual([]);
});
// The visible length of stored text (markers removed).
const plainLen = t => t.replace(/\*\*|__|\*/g, '').length;

test('split a scene at the cursor, merge it back with the next one, and undo both', async ({ page }) => {
  const errors = await openApp(page, { project: TWO_SCENES('Line *one*.\nLine two is here.') });
  await page.click('.sc-btn[data-id="s1"]');
  await caretAt(page, 9); // after "Line one."
  await page.keyboard.press('Control+Shift+K');
  let p = await waitSaved(page, p => p.meta.chapters[0].scenes.length === 3);
  const [a, b, c] = p.meta.chapters[0].scenes;
  expect([a, c]).toEqual(['s1', 's2']);
  expect(p.sc.s1.text).toBe('Line *one*.');
  expect(p.sc[b].text).toBe('Line two is here.');
  expect(p.meta.scenes[b].title).toBe('First (2)');
  expect(Object.values(p.sn).some(x => x.scene === 's1' && x.name === 'Before splitting')).toBe(true);
  await expect(page.locator('#sceneTitle')).toHaveValue('First (2)'); // the new scene is open
  // undo puts it back as it was
  await page.click('#toast .t-act');
  p = await waitSaved(page, p => p.meta.chapters[0].scenes.length === 2 && !p.sc[b]);
  expect(p.sc.s1.text).toBe('Line *one*.\nLine two is here.');

  // merge the first scene with the next from the binder's right-click menu
  await page.click('.sc-btn[data-id="s1"] .t', { button: 'right' });
  await page.click('.ctx button:has-text("Merge with the next scene")');
  p = await waitSaved(page, p => p.meta.chapters[0].scenes.length === 1);
  expect(p.sc.s1.text).toBe('Line *one*.\nLine two is here.\nThey met at dawn.');
  expect(p.sc.s1.synopsis).toBe('The arrival. The meeting.');
  expect(p.sc.s1.notes).toBe('Check the tide.');
  expect(p.sc.s2).toBeUndefined();
  expect(p.meta.gone.sc_s2).toBeGreaterThan(0);
  await page.click('#toast .t-act');
  p = await waitSaved(page, p => p.meta.chapters[0].scenes.length === 2 && p.sc.s2);
  expect(p.sc.s1.text).toBe('Line *one*.\nLine two is here.');
  expect(p.sc.s2.text).toBe('They met at dawn.');
  expect(p.sc.s1.synopsis).toBe('The arrival.');
  expect(errors).toEqual([]);
});
