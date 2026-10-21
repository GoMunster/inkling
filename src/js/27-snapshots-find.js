/*
 * 27-snapshots-find.js: Scene snapshots and Find and replace
 *
 * Snapshots: saved copies of a scene's text (S.sn), taken by hand, automatically before the first change of each day,
 * and before anything Inkling changes for you (restoring a snapshot, replacing text, merging two writers' changes).
 * The Snapshots screen compares any snapshot with the current text, paragraph by paragraph and word by word
 * (diffHtml), and restores it.
 *
 * Find and replace: searches every scene (or one chapter) with match case and whole words, and replaces one match or
 * all of them, after taking a snapshot of each scene it changes.
 */
// sn[id] = {scene, at, name, text, words, auto}. Saved by hand, automatically once a day when a scene is first
// changed (auto 'daily'), and before restoring a snapshot ('restore') or replacing text ('replace').
const SN_AUTO_MAX = 30;
// How each kind of automatic snapshot is labelled.
const SN_AUTO = {
  daily: 'Start of the day',
  restore: 'Before restoring a snapshot',
  replace: 'Before find and replace',
  merge: 'The other version from a shared edit'
};
ADD_DOCS.push((o, out) => {
  const i = o.sn && typeof o.sn === 'object' ? o.sn : {},
    r = {};
  Object.keys(i).forEach(id => {
    const x = i[id];
    if (!x || !out.meta.scenes[x.scene]) return;
    r[id] = {
      scene: String(x.scene),
      at: +x.at || 0,
      name: String(x.name || '').slice(0, 80),
      text: String(x.text || ''),
      words: wc(x.text),
      auto: SN_AUTO[x.auto] ? x.auto : ''
    };
  });
  out.sn = r;
});
// A scene's snapshots, newest first.
const snList = sid =>
  Object.keys(S.sn)
    .filter(k => S.sn[k].scene === sid)
    .map(k => Object.assign({ id: k }, S.sn[k]))
    .sort((a, b) => b.at - a.at);
// A snapshot's name: the writer's, or what took it.
const snLabel = x => x.name || SN_AUTO[x.auto] || 'Snapshot';
// When a snapshot was taken, as a short date and time.
const snWhen = t =>
  new Date(t).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
// Takes a snapshot of a scene (automatic ones are capped at SN_AUTO_MAX per scene, oldest dropped first).
function snTake(sid, name, auto) {
  const t = (S.sc[sid] || {}).text || '';
  if (!t.trim()) return null;
  const last = snList(sid)[0];
  if (auto && last && last.text === t) return null;
  const id = uid('n_');
  S.sn[id] = {
    scene: sid,
    at: Date.now(),
    name: String(name || '').slice(0, 80),
    text: t,
    words: wc(t),
    auto: auto || ''
  };
  dirty('sn_' + id);
  if (auto)
    snList(sid)
      .filter(x => x.auto)
      .slice(SN_AUTO_MAX)
      .forEach(x => {
        delete S.sn[x.id];
        forget('sn_' + x.id);
      });
  return id;
}
// Takes the day's snapshot of a scene before its first change today.
function snDaily(sid) {
  // the scene as it was before today's first change
  const day = todayKey();
  ui.snDay = ui.snDay || {};
  if (ui.snDay[sid] === day) return;
  ui.snDay[sid] = day;
  if (snList(sid).some(x => keyOf(new Date(x.at)) === day)) return;
  snTake(sid, '', 'daily');
}
// Deletes all of a scene's snapshots.
function snDrop(sid) {
  Object.keys(S.sn).forEach(k => {
    if (S.sn[k].scene === sid) {
      delete S.sn[k];
      forget('sn_' + k);
    }
  });
}
// Changes a scene's text on the writer's behalf (replace, restore): saves it, but gives Inky no credit.
function setSceneText(sid, text) {
  // changes made by Inkling, not typing: no pet credit
  const sc = S.meta.scenes[sid];
  S.sc[sid].text = text;
  sc.words = wc(text);
  dirty('sc_' + sid, 'meta');
}
// Differences between two texts: paragraphs first, then words within paragraphs that changed.
function lcs(a, b) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  const A = a.slice(p, a.length - q),
    B = b.slice(p, b.length - q),
    n = A.length,
    m = B.length;
  if (n * m > 4e6) return null;
  const dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = a.slice(0, p).map(x => ['=', x]);
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push(['=', A[i]]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', A[i++]]);
    else out.push(['+', B[j++]]);
  }
  while (i < n) out.push(['-', A[i++]]);
  while (j < m) out.push(['+', B[j++]]);
  return out.concat(a.slice(a.length - q).map(x => ['=', x]));
}
// Word changes inside one paragraph, with neighbouring changes of the same kind joined into one run.
function wordOps(a, b) {
  const w = lcs(a.split(/(\s+)/), b.split(/(\s+)/));
  if (!w) return null;
  const out = [];
  w.forEach((o, i) => {
    const p = out[out.length - 1];
    if (o[0] === '=' && !o[1].trim() && p && p[0] !== '=') {
      const nx = w.slice(i + 1).find(z => z[0] !== '=' || z[1].trim());
      if (nx && nx[0] === p[0]) {
        p[1] += o[1];
        return;
      }
    }
    if (p && p[0] === o[0] && o[0] !== '=') p[1] += o[1];
    else out.push([o[0], o[1]]);
  });
  return out;
}
// Shows what changed between two texts: paragraphs added, removed or changed, and within changed ones the words.
function diffHtml(from, to) {
  const pa = t =>
      t
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean),
    ops = lcs(pa(from), pa(to));
  if (!ops)
    return {
      html: '<p class="fine">These versions are too long to compare. Switch to “Snapshot text” to read it.</p>',
      add: 0,
      del: 0
    };
  let html = '',
    add = 0,
    del = 0,
    same = [];
  const flushSame = () => {
    if (same.length > 3)
      html +=
        '<p class="df-same">' +
        esc(trunc(same[0], 160)) +
        '</p><p class="df-gap">' +
        (same.length - 2) +
        ' unchanged paragraphs</p><p class="df-same">' +
        esc(trunc(same[same.length - 1], 160)) +
        '</p>';
    else html += same.map(x => '<p class="df-same">' + esc(x) + '</p>').join('');
    same = [];
  };
  for (let k = 0; k < ops.length; ) {
    if (ops[k][0] === '=') {
      same.push(ops[k][1]);
      k++;
      continue;
    }
    flushSame();
    const dl = [],
      ad = [];
    while (k < ops.length && ops[k][0] !== '=') {
      (ops[k][0] === '-' ? dl : ad).push(ops[k][1]);
      k++;
    }
    for (let x = 0; x < Math.max(dl.length, ad.length); x++) {
      if (x < dl.length && x < ad.length) {
        const w = wordOps(dl[x], ad[x]);
        if (w) {
          html +=
            '<p class="df-ch">' +
            w
              .map(o => {
                if (o[0] === '=') return esc(o[1]);
                const n = wc(o[1]);
                if (o[0] === '+') add += n;
                else del += n;
                return o[1].trim()
                  ? '<' + (o[0] === '+' ? 'ins' : 'del') + '>' + esc(o[1]) + '</' + (o[0] === '+' ? 'ins' : 'del') + '>'
                  : esc(o[1]);
              })
              .join('') +
            '</p>';
          continue;
        }
      }
      if (x < dl.length) {
        del += wc(dl[x]);
        html += '<p class="df-ch"><del>' + esc(dl[x]) + '</del></p>';
      }
      if (x < ad.length) {
        add += wc(ad[x]);
        html += '<p class="df-ch"><ins>' + esc(ad[x]) + '</ins></p>';
      }
    }
  }
  flushSame();
  return { html, add, del };
}
// The Snapshots screen for a scene: the list, a comparison with the current text, restore, rename, delete.
function renderSnap(el, v) {
  const sid = v.id,
    sc = S.meta.scenes[sid],
    list = snList(sid),
    cur = S.sc[sid].text;
  if (!list.some(x => x.id === ui.snSel)) ui.snSel = list.length ? list[0].id : null;
  const sel = list.find(x => x.id === ui.snSel),
    mode = ui.snMode === 'text' ? 'text' : 'diff';
  let main =
    '<div class="sn-empty"><p>No snapshots of this scene yet.</p><p class="fine">Save one before a big rewrite. Inkling also keeps one automatically each day you change the scene, and before find and replace changes it.</p></div>';
  if (sel) {
    const d = mode === 'diff' ? diffHtml(plainText(sel.text), plainText(cur)) : null,
      same = sel.text === cur;
    main =
      '<div class="sn-head"><div><h2>' +
      esc(snLabel(sel)) +
      '</h2><p class="fine">' +
      esc(snWhen(sel.at)) +
      ' · ' +
      fmt(sel.words) +
      ' words' +
      (sel.name && sel.auto ? '' : '') +
      '</p></div>' +
      '<div class="ts-row" style="margin:0"><button class="btn pri" data-sn="restore"' +
      (same ? ' disabled' : '') +
      '>Restore this version</button><button class="btn danger" data-sn="del">' +
      ico('trash', 14) +
      '<span>Delete</span></button></div></div>' +
      '<div class="seg" role="tablist"><button data-sn="diff"' +
      (mode === 'diff' ? ' class="on"' : '') +
      '>Changes since then</button><button data-sn="text"' +
      (mode === 'text' ? ' class="on"' : '') +
      '>Snapshot text</button></div>' +
      (mode === 'diff'
        ? (same
            ? '<p class="fine">The scene is the same as this snapshot.</p>'
            : '<p class="fine sn-sum"><ins>+' +
              fmt(d.add) +
              ' words</ins> added and <del>−' +
              fmt(d.del) +
              ' words</del> removed since this snapshot.</p>') +
          '<div class="sn-text df">' +
          (same ? '' : d.html) +
          '</div>'
        : '<div class="sn-text">' +
          sel.text
            .split('\n')
            .filter(x => x.trim())
            .map(x => {
              const P = fmtParse(x);
              return '<p>' + fmtHtml(P.vis, P.flags, 0, P.vis.length) + '</p>';
            })
            .join('') +
          '</div>');
  }
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('time', 16) +
    '</span><h1 class="mh-title">Snapshots</h1>' +
    ((ui.hist[ui.hist.length - 1] || {}).id === sid
      ? ''
      : '<button class="btn" data-sn="open">' +
        ico('pen', 14) +
        '<span>' +
        esc(trunc(sc.title, 40)) +
        '</span></button>') +
    '</div>' +
    '<div class="sn-wrap"><aside class="sn-list"><form class="sn-new" id="snForm"><input id="snName" maxlength="80" placeholder="Name this version (optional)" aria-label="Snapshot name"><button class="btn pri" type="submit">' +
    ico('plus', 14) +
    '<span>Save snapshot</span></button></form>' +
    (list.length
      ? '<ul>' +
        list
          .map(
            x =>
              '<li><button class="sn-it' +
              (x.id === ui.snSel ? ' on' : '') +
              '" data-sel="' +
              x.id +
              '"><b>' +
              esc(snLabel(x)) +
              '</b><span class="muted">' +
              esc(snWhen(x.at)) +
              ' · ' +
              fmt(x.words) +
              ' words</span></button></li>'
          )
          .join('') +
        '</ul>'
      : '') +
    '</aside><section class="sn-main">' +
    main +
    '</section></div>';
  $('#snForm', el).addEventListener('submit', e => {
    e.preventDefault();
    const n = $('#snName', el).value.trim();
    const id = snTake(sid, n || 'Saved by hand', '');
    if (!id) {
      toast('This scene is empty, so there is nothing to save.', { plain: true });
      return;
    }
    ui.snSel = id;
    renderSnap(el, v);
    toast('Snapshot saved.', { plain: true });
  });
  el.onclick = async e => {
    const it = e.target.closest('[data-sel]');
    if (it) {
      ui.snSel = it.dataset.sel;
      renderSnap(el, v);
      return;
    }
    const b = e.target.closest('[data-sn]');
    if (!b) return;
    const a = b.dataset.sn;
    if (a === 'open') go({ k: 'scene', id: sid });
    else if (a === 'diff' || a === 'text') {
      ui.snMode = a;
      renderSnap(el, v);
    } else if (a === 'restore' && sel) {
      snTake(sid, '', 'restore');
      setSceneText(sid, sel.text);
      renderBinder();
      updateStats();
      go({ k: 'scene', id: sid });
      toast('Restored “' + snLabel(sel) + '”. The text you replaced is saved as a snapshot too.', { plain: true });
    } else if (a === 'del' && sel) {
      if (
        (await ask(
          'Delete this snapshot?',
          '“' +
            esc(snLabel(sel)) +
            '” from ' +
            esc(snWhen(sel.at)) +
            ' will be gone for good. Your scene is not changed.',
          [
            ['del', 'Delete', 'danger'],
            ['cancel', 'Cancel']
          ]
        )) !== 'del'
      )
        return;
      delete S.sn[sel.id];
      forget('sn_' + sel.id);
      ui.snSel = null;
      renderSnap(el, v);
    }
  };
}

/* ---------- find and replace ---------- */
function findRe(f) {
  if (!f.q) return null;
  const q = f.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp(f.ww ? '(?<![\\p{L}\\p{N}_])' + q + '(?![\\p{L}\\p{N}_])' : q, 'gu' + (f.mc ? '' : 'i'));
  } catch (e) {
    return null;
  }
}
// Every match of a Find search, grouped by scene.
function findAll(f) {
  const re = findRe(f),
    out = [];
  if (!re) return out;
  S.meta.chapters.forEach(c => {
    if (f.scope !== 'all' && f.scope !== c.id) return;
    c.scenes.forEach(id => {
      const P = fmtParse(S.sc[id].text),
        t = P.vis,
        hits = [];
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(t))) {
        if (!m[0].length) {
          re.lastIndex++;
          continue;
        }
        const s0 = m.index,
          e0 = s0 + m[0].length;
        hits.push({ s: s0, e: e0, rs: rawAt(P, s0), re: rawEnd(P, e0) });
      }
      if (hits.length) out.push({ id, ch: c, hits });
    });
  });
  return out;
}
// The Find and replace screen.
function renderFind(el) {
  const f = (ui.find = ui.find || { q: '', r: '', mc: false, ww: false, scope: 'all' });
  if (f.scope !== 'all' && !S.meta.chapters.some(c => c.id === f.scope)) f.scope = 'all';
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('search', 16) +
    '</span><h1 class="mh-title">Find and replace</h1></div>' +
    '<div class="fd-wrap"><div class="fd-form"><div class="two" style="margin-top:0"><label class="f">Find<input id="fdQ" value="' +
    esc(f.q) +
    '" placeholder="A word or phrase" autocomplete="off"></label>' +
    '<label class="f">Replace with<input id="fdR" value="' +
    esc(f.r) +
    '" placeholder="Leave empty to remove" autocomplete="off"></label></div>' +
    '<div class="fd-opts"><label class="ck"><input type="checkbox" id="fdMc"' +
    (f.mc ? ' checked' : '') +
    '>Match case</label><label class="ck"><input type="checkbox" id="fdWw"' +
    (f.ww ? ' checked' : '') +
    '>Whole words only</label>' +
    '<select id="fdScope" aria-label="Where to look"><option value="all">The whole book</option>' +
    S.meta.chapters
      .map(
        c => '<option value="' + c.id + '"' + (f.scope === c.id ? ' selected' : '') + '>' + esc(c.title) + '</option>'
      )
      .join('') +
    '</select></div></div>' +
    '<div id="fdRes" aria-live="polite"></div></div>';
  const draw = () => {
    const res = findAll(f),
      n = res.reduce((a, x) => a + x.hits.length, 0),
      box = $('#fdRes', el);
    let shown = 0;
    if (!f.q) {
      box.innerHTML = '<p class="fine">Searches the text of every scene. Click a result to open it in the scene.</p>';
      return;
    }
    box.innerHTML =
      '<div class="fd-bar"><b>' +
      (n
        ? fmt(n) + ' match' + (n === 1 ? '' : 'es') + ' in ' + res.length + ' scene' + (res.length === 1 ? '' : 's')
        : 'No matches') +
      '</b>' +
      (n ? '<button class="btn" data-fd="all">Replace all</button>' : '') +
      '</div>' +
      res
        .map(x => {
          const t = plainText(S.sc[x.id].text);
          return (
            '<section class="fd-sc"><h3><button class="lnk" data-open="' +
            x.id +
            '">' +
            esc(x.ch.title) +
            ' › ' +
            esc(S.meta.scenes[x.id].title) +
            '</button><span class="muted">' +
            x.hits.length +
            '</span></h3>' +
            x.hits
              .map((h, i) => {
                if (++shown > 400) return '';
                const a = Math.max(0, h.s - 50),
                  b = Math.min(t.length, h.e + 70);
                return (
                  '<div class="fd-hit"><button class="fd-go" data-id="' +
                  x.id +
                  '" data-i="' +
                  i +
                  '">' +
                  (a ? '…' : '') +
                  esc(t.slice(a, h.s)).replace(/\n/g, ' ⏎ ') +
                  '<mark>' +
                  esc(t.slice(h.s, h.e)) +
                  '</mark>' +
                  esc(t.slice(h.e, b)).replace(/\n/g, ' ⏎ ') +
                  (b < t.length ? '…' : '') +
                  '</button>' +
                  '<button class="btn sm" data-fd="one" data-id="' +
                  x.id +
                  '" data-i="' +
                  i +
                  '">Replace</button></div>'
                );
              })
              .join('') +
            '</section>'
          );
        })
        .join('') +
      (shown > 400 ? '<p class="fine">Showing the first 400 matches.</p>' : '');
  };
  const inp = (id, k, ev) =>
    $(id, el).addEventListener(ev || 'input', e => {
      f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      draw();
    });
  inp('#fdQ', 'q');
  inp('#fdR', 'r');
  inp('#fdMc', 'mc', 'change');
  inp('#fdWw', 'ww', 'change');
  inp('#fdScope', 'scope', 'change');
  const replaceIn = (id, hits) => {
    // hits from one scene, replaced from the end so offsets stay right
    const old = S.sc[id].text;
    let t = old;
    if (!S.sn || !snList(id).some(x => x.auto === 'replace' && Date.now() - x.at < 6e5)) snTake(id, '', 'replace');
    hits
      .slice()
      .sort((a, b) => b.rs - a.rs)
      .forEach(h => {
        t = t.slice(0, h.rs) + f.r + t.slice(h.re);
      });
    setSceneText(id, t);
  };
  el.onclick = async e => {
    const o = e.target.closest('[data-open]');
    if (o) {
      go({ k: 'scene', id: o.dataset.open });
      return;
    }
    const g = e.target.closest('.fd-go');
    if (g) {
      const x = findAll(f).find(r => r.id === g.dataset.id),
        h = x && x.hits[+g.dataset.i];
      if (!h) return;
      ui.findSel = { id: x.id, s: h.s, e: h.e };
      go({ k: 'scene', id: x.id });
      return;
    }
    const b = e.target.closest('[data-fd]');
    if (!b) return;
    if (b.dataset.fd === 'one') {
      const x = findAll(f).find(r => r.id === b.dataset.id),
        h = x && x.hits[+b.dataset.i];
      if (!h) return;
      replaceIn(x.id, [h]);
    } else {
      const res = findAll(f),
        n = res.reduce((a, x) => a + x.hits.length, 0);
      if (
        (await ask(
          'Replace ' + fmt(n) + ' match' + (n === 1 ? '' : 'es') + '?',
          '“' +
            esc(f.q) +
            '” becomes “' +
            esc(f.r) +
            '”' +
            (f.r ? '' : ' (removed)') +
            ' in ' +
            res.length +
            ' scene' +
            (res.length === 1 ? '' : 's') +
            '. Each scene is saved as a snapshot first, so you can undo this from its Snapshots.',
          [
            ['go', 'Replace all', 'pri'],
            ['cancel', 'Cancel']
          ]
        )) !== 'go'
      )
        return;
      res.forEach(x => replaceIn(x.id, x.hits));
      toast('Replaced ' + fmt(n) + ' match' + (n === 1 ? '' : 'es') + '.', { plain: true });
    }
    renderBinder();
    updateStats();
    draw();
  };
  draw();
  const q = $('#fdQ', el);
  q.focus();
  q.select();
}
document.addEventListener('keydown', e => {
  if (DESK || !(e.ctrlKey || e.metaKey) || e.altKey) return; // the desktop menu has these shortcuts
  if (e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openFind();
  } else if (!e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveNow();
  }
});
// Opens Find and replace with the selected words as the search.
function openFind() {
  const s = getSelection(),
    t = s && $('#ed') && $('#ed').contains(s.anchorNode) ? s.toString().trim() : '';
  if (t && t.length < 80 && !t.includes('\n')) {
    ui.find = ui.find || { q: '', r: '', mc: false, ww: false, scope: 'all' };
    ui.find.q = t;
  }
  go({ k: 'find' });
}
