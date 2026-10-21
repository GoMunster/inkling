'use strict';
// Builds desktop/app from the shared index.html: same app, with the fonts bundled so it needs no internet.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'app');
const mods = path.join(root, 'node_modules');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });

// [package, css files to take, family name the page uses]
const FONTS = [
  ['@fontsource/instrument-sans', ['400.css', '500.css', '600.css', '700.css'], 'Instrument Sans'],
  ['@fontsource-variable/literata', ['opsz.css', 'opsz-italic.css'], 'Literata'],
  ['@fontsource/ibm-plex-mono', ['400.css', '500.css'], 'IBM Plex Mono']
];
let css = '/* Bundled from Fontsource. Fonts are under the SIL Open Font License, see the LICENSE files in this folder. */\n';
for (const [pkg, files, family] of FONTS) {
  const dir = path.join(mods, pkg), short = pkg.split('/').pop();
  fs.mkdirSync(path.join(out, 'fonts', short), { recursive: true });
  fs.copyFileSync(path.join(dir, 'LICENSE'), path.join(out, 'fonts', short, 'LICENSE'));
  for (const f of files) {
    let c = fs.readFileSync(path.join(dir, f), 'utf8');
    c = c.replace(/url\(\.\/files\/([^)]+)\)/g, (m, file) => {
      fs.copyFileSync(path.join(dir, 'files', file), path.join(out, 'fonts', short, file));
      return 'url(./' + short + '/' + file + ')';
    });
    c = c.replace(/font-family:\s*'[^']+'/g, "font-family: '" + family + "'");
    css += c + '\n';
  }
}
fs.writeFileSync(path.join(out, 'fonts', 'fonts.css'), css);

let html = fs.readFileSync(path.join(root, '..', 'index.html'), 'utf8');
const before = html;
html = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/, '')
  .replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, '<link rel="stylesheet" href="fonts/fonts.css">');
if (html === before || /fonts\.googleapis/.test(html)) throw new Error('Could not swap the Google Fonts link in index.html');
// The desktop app loads nothing from the internet: only its own files, its pictures, and data: URLs.
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' file:; font-src file:; img-src file: data: blob: inkpic:; connect-src data: blob:; media-src file: blob: inkpic:";
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + CSP + '">');
if (!html.includes('Content-Security-Policy')) throw new Error('Could not add the content security policy');
// The version the page shows (Settings, backups) is the desktop package's version, set from the release tag in CI.
const version = require(path.join(root, 'package.json')).version;
const vBefore = html;
html = html.replace(/const APP_VERSION\s*=\s*'[^']*';/, m => m.replace(/'[^']*'/, "'" + version + "'"));
if (html === vBefore && !html.includes("'" + version + "'")) throw new Error('Could not set APP_VERSION in index.html');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('Prepared desktop/app ' + version + ' (' + fs.readdirSync(path.join(out, 'fonts')).length + ' font entries).');
