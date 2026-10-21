/*
 * 04-text.js: Scene text: name links, bold/italic/underline, and the editor's caret
 *
 * Name links: every story page's name and aliases are compiled into one regular expression (buildLinker); findLinks()
 * finds them in text, and the editor shows each one as a coloured, clickable name.
 *
 * Formatting: scene text is stored as plain text with markers, **bold**, *italic* and __underline__. fmtParse() turns
 * stored text into what the writer sees (the visible text, a style per character, and a map back to stored
 * positions); fmtSerialize() turns styled characters back into stored text. renderText() draws a scene for the
 * editor.
 *
 * The editor: getText() reads the editor back into stored text, caretOffset() and setCaret() keep the caret in place
 * by its position in the visible text when the editor is redrawn, and relinkEditor() redraws the name links only when
 * they change.
 */
// One regular expression that matches any of these names as a whole word, longest names first so "Anna Bell" wins
// over "Anna".
function makeRe(names) {
  const a = [...new Set(names.map(n => (n || '').trim()).filter(n => n.length >= 2))]
    .sort((x, y) => y.length - x.length)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!a.length) return null;
  const body = '(?:' + a.join('|') + ')';
  try {
    return new RegExp('(?<![\\p{L}\\p{N}_])' + body + '(?![\\p{L}\\p{N}_])', 'gu');
  } catch (e) {
    return new RegExp('\\b' + body + '\\b', 'g');
  }
}
// The tooltip on a name in the text; a glossary term shows how to say it and what it means.
function entTip(e) {
  if (e.type === 'term') {
    const f = (S.en[e.id] || {}).fields || {},
      say = String(f.say || '').trim(),
      mean = String(f.meaning || '')
        .trim()
        .split('\n')[0];
    if (say || mean)
      return e.name + (say ? ' /' + say.replace(/^\/|\/$/g, '') + '/' : '') + (mean ? ' · ' + mean.slice(0, 140) : '');
  }
  return e.name + ' · ' + LS(e.type) + ' page';
}
// Compiles every story page name and alias into the matcher used for name links; names map back to their page ids.
function buildLinker() {
  const map = new Map();
  Object.values(S.meta.ents).forEach(e => {
    [e.name].concat(e.aliases || []).forEach(n => {
      n = (n || '').trim();
      if (n.length >= 2 && !map.has(n)) map.set(n, e.id);
    });
  });
  const re = makeRe([...map.keys()]);
  return re ? { re, map } : null;
}
// Every story page name in a text, as {s, e, id}: start, end and the page it links to.
function findLinks(text) {
  if (!linker) return [];
  const out = [];
  const re = linker.re;
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    const id = linker.map.get(m[0]);
    if (id) out.push({ s: m.index, e: m.index + m[0].length, id });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}
/* ---------- formatting: **bold**, *italic*, __underline__ ---------- */
// Scene text is plain text with these markers (the older _italic_ still reads as italic). The editor shows the
// formatting and hides the markers: fmtParse() gives the visible text, a style bitmask per visible character
// (1 bold, 2 italic, 4 underline) and where each visible character sits in the stored text.
function fmtTokens(line) {
  const toks = [];
  for (let i = 0; i < line.length; ) {
    const c = line[i];
    if (c === '*' && line[i + 1] === '*') {
      toks.push({ pos: i, len: 2, t: 1 });
      i += 2;
    } else if (c === '_' && line[i + 1] === '_') {
      toks.push({ pos: i, len: 2, t: 4 });
      i += 2;
    } else if (c === '*') {
      toks.push({ pos: i, len: 1, t: 2 });
      i++;
    } else if (c === '_') {
      toks.push({ pos: i, len: 1, t: 2, u: 1 });
      i++;
    } else i++;
  }
  const open = {},
    keep = new Set(),
    W = /[\p{L}\p{N}]/u;
  toks.forEach((k, n) => {
    const before = line[k.pos - 1] || ' ',
      after = line[k.pos + k.len] || ' ',
      key = k.t + (k.u ? 'u' : '');
    const canOpen = /\S/.test(after) && (!k.u || !W.test(before)),
      canClose = /\S/.test(before) && (!k.u || !W.test(after));
    if (canClose && open[key] != null) {
      keep.add(open[key]);
      keep.add(n);
      toks[open[key]].open = true;
      open[key] = null;
    } else if (canOpen) open[key] = n;
  });
  return toks.filter((k, n) => keep.has(n)); // a marker without a partner is just a character
}
// Reads stored text with formatting markers: returns the visible text (vis), a style bitmask per visible character
// (flags: 1 bold, 2 italic, 4 underline; null when there is no formatting) and map, the stored position of each
// visible character.
function fmtParse(text) {
  text = String(text || '');
  if (!/[*_]/.test(text)) {
    const n = text.length;
    return { vis: text, flags: null, map: null };
  }
  let vis = '',
    base = 0;
  const flags = [],
    map = [];
  text.split('\n').forEach((line, li) => {
    if (li) {
      vis += '\n';
      flags.push(0);
      map.push(base - 1);
    }
    const at = {},
      cnt = { 1: 0, 2: 0, 4: 0 };
    fmtTokens(line).forEach(k => (at[k.pos] = k));
    for (let i = 0; i < line.length; ) {
      const k = at[i];
      if (k) {
        cnt[k.t] += k.open ? 1 : -1;
        i += k.len;
        continue;
      }
      vis += line[i];
      flags.push((cnt[1] > 0 ? 1 : 0) | (cnt[2] > 0 ? 2 : 0) | (cnt[4] > 0 ? 4 : 0));
      map.push(base + i);
      i++;
    }
    base += line.length + 1;
  });
  return { vis, flags, map };
}
// The visible text of stored text: the markers removed. Use it wherever text is shown, counted, searched or checked.
const plainText = t => fmtParse(t).vis;
// Turns a position in the visible text into the position in the stored text.
const rawAt = (P, i) => (P.map ? (i < P.map.length ? P.map[i] : P.map.length ? P.map[P.map.length - 1] + 1 : 0) : i); // visible offset → stored offset
// Turns the end of a visible range into the end in the stored text.
const rawEnd = (P, e) => (P.map ? (e > 0 ? P.map[e - 1] + 1 : 0) : e);
// Stored text as characters with their style flags ([char, 1 bold | 2 italic | 4 underline]), the form fmtSerialize()
// writes back: for cutting, joining and pasting text without breaking its markers.
function fmtChars(text) {
  const p = fmtParse(text),
    out = [];
  for (let i = 0; i < p.vis.length; i++) out.push([p.vis[i], p.flags ? p.flags[i] : 0]);
  return out;
}
// Characters with their styles back to stored text; spaces at the edges of a styled run stay outside the markers.
function fmtSerialize(chars) {
  let out = '';
  for (let i = 0; i < chars.length; ) {
    if (chars[i][0] === '\n') {
      out += '\n';
      i++;
      continue;
    }
    const f = chars[i][1];
    let j = i;
    while (j < chars.length && chars[j][1] === f && chars[j][0] !== '\n') j++;
    const t = chars
      .slice(i, j)
      .map(c => c[0])
      .join('');
    if (!f || !t.trim()) out += t;
    else {
      const lead = t.match(/^\s*/)[0],
        trail = t.match(/\s*$/)[0],
        core = t.slice(lead.length, t.length - trail.length);
      out +=
        lead +
        (f & 1 ? '**' : '') +
        (f & 4 ? '__' : '') +
        (f & 2 ? '*' : '') +
        core +
        (f & 2 ? '*' : '') +
        (f & 4 ? '__' : '') +
        (f & 1 ? '**' : '') +
        trail;
    }
    i = j;
  }
  return out;
}
// The visible text from s to e as HTML, with <b>, <i> and <u> where it is styled.
function fmtHtml(vis, flags, s, e) {
  if (!flags) return esc(vis.slice(s, e));
  let h = '';
  for (let i = s; i < e; ) {
    const f = flags[i];
    let j = i;
    while (j < e && flags[j] === f) j++;
    let t = esc(vis.slice(i, j));
    if (f & 4) t = '<u>' + t + '</u>';
    if (f & 2) t = '<i>' + t + '</i>';
    if (f & 1) t = '<b>' + t + '</b>';
    h += t;
    i = j;
  }
  return h;
}
// A scene's stored text as the editor's HTML: formatting plus a coloured span for every name link.
function renderText(text) {
  const P = fmtParse(text),
    vis = P.vis;
  let h = '',
    i = 0;
  findLinks(vis).forEach(l => {
    const e = S.meta.ents[l.id];
    if (!e) return;
    h +=
      fmtHtml(vis, P.flags, i, l.s) +
      '<span class="ent t-' +
      e.type +
      '" data-ent="' +
      l.id +
      '" title="' +
      esc(entTip(e)) +
      '">' +
      fmtHtml(vis, P.flags, l.s, l.e) +
      '</span>';
    i = l.e;
  });
  return h + fmtHtml(vis, P.flags, i, vis.length);
}

/* ---------- editor text + caret ---------- */
function getText(el) {
  // the editor's content as stored text (formatting as markers)
  const chars = [];
  (function walk(n, f) {
    n.childNodes.forEach(c => {
      if (c.nodeType === 3) {
        const v = c.nodeValue;
        for (let i = 0; i < v.length; i++) chars.push([v[i], v[i] === '\n' ? 0 : f]);
      } else if (c.nodeName === 'BR') chars.push(['\n', 0]);
      else if (c.nodeType === 1) {
        if (/^(DIV|P)$/.test(c.nodeName) && chars.length && chars[chars.length - 1][0] !== '\n') chars.push(['\n', 0]);
        const tn = c.nodeName,
          st = c.style || {};
        let g = f;
        if (tn === 'B' || tn === 'STRONG' || st.fontWeight === 'bold' || +st.fontWeight >= 600) g |= 1;
        if (tn === 'I' || tn === 'EM' || st.fontStyle === 'italic') g |= 2;
        if (tn === 'U' || /underline/.test((st.textDecoration || '') + (st.textDecorationLine || ''))) g |= 4;
        walk(c, g);
      }
    });
  })(el, 0);
  return fmtSerialize(chars);
}
// A fingerprint of where the editor's name links are, to tell whether they need redrawing.
function domSig(el) {
  // where the name links are, by visible offset
  const sig = [];
  el.querySelectorAll('.ent').forEach(x => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEndBefore(x);
    sig.push(r.toString().length + ':' + x.textContent.length + ':' + x.dataset.ent);
  });
  return sig.join('|');
}
// Where the caret is in the editor, as a position in the visible text (null when it is elsewhere).
function caretOffset(el) {
  const sel = getSelection();
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return null;
  const r = sel.getRangeAt(0),
    pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.endContainer, r.endOffset);
  return pre.toString().length;
}
// Puts the caret at a position in the editor's visible text.
function setCaret(el, off) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n,
    acc = 0;
  const r = document.createRange();
  const sel = getSelection();
  while ((n = w.nextNode())) {
    const l = n.nodeValue.length;
    if (acc + l >= off) {
      r.setStart(n, off - acc);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      return;
    }
    acc += l;
  }
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}
// Redraws the editor's name links when the names in the text change (or always, with force), keeping the caret where
// it was.
function relinkEditor(force) {
  const ed = $('#ed');
  if (!ed) return;
  const text = getText(ed);
  const want = findLinks(plainText(text))
    .map(l => l.s + ':' + (l.e - l.s) + ':' + l.id)
    .join('|');
  if (!force && want === domSig(ed)) {
    updateSceneChips();
    return;
  }
  const focused = document.activeElement === ed,
    off = focused ? caretOffset(ed) : null;
  ed.innerHTML = renderText(text);
  if (focused && off != null) setCaret(ed, off);
  updateSceneChips();
}
