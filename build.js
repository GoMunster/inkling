'use strict';
// Builds index.html, the whole app in one file, from the source in src/.
//
//   node build.js          write index.html
//   node build.js --check  fail if index.html is not what src/ builds (CI runs this)
//
// The app ships as one file on purpose: it is what the Claude artifact publishes, it opens offline with a
// double-click, and the desktop app (desktop/scripts/prepare.js) copies it. The source is split by feature so it is
// easier to read and change. Build steps, in order:
//   1. src/index.html is the page: its head, the markup, and two markers, /* @css */ and /* @js */.
//   2. Every src/css/*.css file, in file-name order, replaces /* @css */ inside the page's <style>.
//   3. Every src/js/*.js file, in file-name order, replaces /* @js */ inside the page's one script. They all share
//      one scope (an IIFE in src/index.html), so the order of the numbered files is the order the code runs in:
//      a file may use functions from any file, but top-level constants only from files before it.
// Nothing is minified or rewritten, so index.html stays readable and line numbers in errors are easy to follow.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const src = path.join(root, 'src');

// All the files in one folder of src/ with this extension, joined in file-name order.
function joinFolder(folder, ext) {
  const dir = path.join(src, folder);
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith(ext))
    .sort()
    .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('');
}

function build() {
  const page = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
  for (const marker of ['/* @css */\n', '/* @js */\n']) {
    if (page.split(marker).length !== 2) throw new Error('src/index.html must contain ' + marker.trim() + ' once');
  }
  // A function as the replacement, so "$" in the code is never read as a replacement pattern.
  return page.replace('/* @css */\n', () => joinFolder('css', '.css')).replace('/* @js */\n', () => joinFolder('js', '.js'));
}

const out = path.join(root, 'index.html');
const html = build();
if (process.argv.includes('--check')) {
  const now = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (now !== html) {
    console.error('index.html is out of date: run "node build.js" and commit it.');
    process.exit(1);
  }
  console.log('index.html matches src/.');
} else {
  fs.writeFileSync(out, html);
  console.log('Built index.html (' + Math.round(html.length / 1024) + ' KB).');
}
