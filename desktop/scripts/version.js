'use strict';
// Sets the Inkling version everywhere it is written down: desktop/package.json (+ lock) and APP_VERSION in the app's
// source (src/js), then rebuilds index.html.
// Usage: node desktop/scripts/version.js 1.1.0
const fs = require('fs'), path = require('path');
const v = String(process.argv[2] || '').replace(/^v/, '');
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v)) { console.error('Give a version like 1.1.0'); process.exit(1); }
const root = path.join(__dirname, '..', '..');
for (const f of ['desktop/package.json', 'desktop/package-lock.json']) {
  const p = path.join(root, f), j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = v; if (j.packages && j.packages['']) j.packages[''].version = v;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
}
const RE = /const APP_VERSION\s*=\s*'[^']*';/;
const dir = path.join(root, 'src', 'js'), file = fs.readdirSync(dir).map(f => path.join(dir, f)).find(f => RE.test(fs.readFileSync(f, 'utf8')));
if (!file) { console.error('APP_VERSION not found in src/js'); process.exit(1); }
const js = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file, js.replace(RE, m => m.replace(/'[^']*'/, "'" + v + "'")));
require('child_process').execFileSync(process.execPath, [path.join(root, 'build.js')], { stdio: 'inherit' });
console.log('Inkling is now version ' + v + '. Commit, then: git tag v' + v + ' && git push origin v' + v);
