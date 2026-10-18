'use strict';
// Sets the Inkling version everywhere it is written down: desktop/package.json (+ lock) and APP_VERSION in index.html.
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
const ip = path.join(root, 'index.html'), html = fs.readFileSync(ip, 'utf8');
const next = html.replace(/const APP_VERSION='[^']*';/, "const APP_VERSION='" + v + "';");
if (next === html && !html.includes("const APP_VERSION='" + v + "';")) { console.error('APP_VERSION not found in index.html'); process.exit(1); }
fs.writeFileSync(ip, next);
console.log('Inkling is now version ' + v + '. Commit, then: git tag v' + v + ' && git push origin v' + v);
