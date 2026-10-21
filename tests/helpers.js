// Shared helpers for the Inkling tests.
const path = require('path');
const zlib = require('zlib');

const APP_URL = 'file://' + path.join(__dirname, '..', 'index.html');

// Opens the app in a plain browser (localStorage saving). The tour is skipped unless `tour` is set.
async function openApp(page, { tour = false, project = null, clock = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  if (clock) await page.clock.install();
  await page.addInitScript(
    ({ tour, project }) => {
      if (sessionStorage.getItem('seeded')) return; // only before the first load, so reloads keep what the app saved
      sessionStorage.setItem('seeded', '1');
      if (!tour) localStorage.setItem('inkling:tour', '1');
      if (project) localStorage.setItem('inkling:project', JSON.stringify(project));
    },
    { tour, project }
  );
  await page.goto(APP_URL);
  await page.waitForSelector('#binder .sc-btn');
  return errors;
}

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('inkling:project') || 'null'));
// Waits for the app's debounced save to reach localStorage.
async function waitSaved(page, test) {
  for (let i = 0; i < 40; i++) {
    const p = await saved(page);
    if (p && test(p)) return p;
    await page.waitForTimeout(150);
  }
  throw new Error('The project was not saved as expected');
}

// Reads a zip (stored or deflated entries) into {name: Buffer}.
function unzip(buf) {
  const out = {};
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Not a zip file');
  let p = buf.readUInt32LE(end + 16);
  const n = buf.readUInt16LE(end + 10);
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad central directory');
    const method = buf.readUInt16LE(p + 10),
      size = buf.readUInt32LE(p + 20),
      nl = buf.readUInt16LE(p + 28),
      xl = buf.readUInt16LE(p + 30),
      cl = buf.readUInt16LE(p + 32),
      off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    const lnl = buf.readUInt16LE(off + 26),
      lxl = buf.readUInt16LE(off + 28),
      data = buf.subarray(off + 30 + lnl + lxl, off + 30 + lnl + lxl + size);
    out[name] = method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
    out[name].firstOffset = off;
    p += 46 + nl + xl + cl;
  }
  return out;
}

module.exports = { APP_URL, openApp, saved, waitSaved, unzip };
