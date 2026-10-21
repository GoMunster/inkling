/* ---------- story insights: scene details, pacing, point of view, plot threads ---------- */
// Each scene can name its point-of-view character (meta.scenes[id].pov), where it happens (place), how tense it is
// (tension 1–5) and the plot threads it moves on (threads: ids from meta.threads). The Story insights view
// ({k:'story'}, tabs in ui.stTab) draws pacing across the book, who gets the page, and threads by chapter.
const THREAD_GAP = 3; // chapters a thread may go missing before it is flagged
const REFLECT = new Set(
  'thought thoughts think thinks thinking wondered wonder wonders wondering remembered remember remembers remembering memory memories realised realized realise realize knew felt feel feels feeling feelings wished wish hoped hope hopes considered imagined believed supposed perhaps maybe somehow regret regretted'.split(
    ' '
  )
);
function normThreads(x) {
  const seen = new Set();
  return (Array.isArray(x) ? x : [])
    .filter(t => t && typeof t === 'object' && /^[\w-]{1,40}$/.test(t.id) && !seen.has(t.id) && seen.add(t.id))
    .slice(0, 80)
    .map(t => ({
      id: t.id,
      name: String(t.name || 'Thread').slice(0, 80),
      color: colOk(t.color) ? t.color : 'accent',
      note: String(t.note || '').slice(0, 2000),
      done: typeof t.done === 'string' ? t.done : ''
    }));
}
function normSceneDetails(meta) {
  const ids = new Set(meta.threads.map(t => t.id));
  Object.values(meta.scenes).forEach(s => {
    if (!(s.pov && meta.ents[s.pov])) delete s.pov;
    if (!(s.place && meta.ents[s.place])) delete s.place;
    const t = Math.round(+s.tension || 0);
    if (t >= 1 && t <= 5) s.tension = t;
    else delete s.tension;
    const th = (Array.isArray(s.threads) ? s.threads : []).filter(x => ids.has(x));
    if (th.length) s.threads = [...new Set(th)];
    else delete s.threads;
  });
  meta.threads.forEach(t => {
    if (t.done && !meta.scenes[t.done]) t.done = '';
  });
  meta.setups.forEach(x => {
    if (x.scene && !meta.scenes[x.scene]) x.scene = '';
    if (x.pay && !meta.scenes[x.pay]) x.pay = '';
  });
}
// Foreshadowing: a setup (a clue, a promise, Chekhov's gun) planted in one scene and paid off in a later one.
function normSetups(x) {
  const seen = new Set();
  return (Array.isArray(x) ? x : [])
    .filter(t => t && typeof t === 'object' && /^[\w-]{1,40}$/.test(t.id) && !seen.has(t.id) && seen.add(t.id))
    .slice(0, 500)
    .map(t => ({
      id: t.id,
      text: String(t.text || '').slice(0, 300),
      note: String(t.note || '').slice(0, 2000),
      scene: typeof t.scene === 'string' ? t.scene : '',
      pay: typeof t.pay === 'string' ? t.pay : ''
    }));
}
function setupAdd(text, scene) {
  const x = { id: uid('fs'), text: String(text).trim().slice(0, 300), note: '', scene: scene || '', pay: '' };
  S.meta.setups.push(x);
  dirty('meta');
  return x;
}
function sceneOrder() {
  const o = {};
  orderedScenes().forEach((x, i) => {
    o[x.id] = i;
  });
  return o;
}
function setupWarnings() {
  const ord = sceneOrder(),
    m = S.meta,
    out = [];
  m.setups.forEach(x => {
    const a = ord[x.scene],
      b = ord[x.pay];
    if (x.pay && x.scene && b < a)
      out.push({
        x,
        kind: 'order',
        text:
          '“' +
          x.text +
          '” pays off in ' +
          m.scenes[x.pay].title +
          ', before it is set up in ' +
          m.scenes[x.scene].title +
          '.'
      });
    else if (x.pay && x.scene && b === a)
      out.push({
        x,
        kind: 'same',
        text: '“' + x.text + '” is set up and paid off in the same scene (' + m.scenes[x.pay].title + ').'
      });
    else if (!x.pay)
      out.push({
        x,
        kind: 'open',
        text: '“' + x.text + '” is set up' + (x.scene ? ' in ' + m.scenes[x.scene].title : '') + ' and never paid off.'
      });
    if (!x.scene) out.push({ x, kind: 'where', text: '“' + x.text + '” doesn’t say which scene sets it up.' });
  });
  return out;
}
// One row per scene, in book order: words, the tension set by the writer (or 0) and one estimated from the words,
// the share of dialogue, action and reflection words per 100, who is named, and the scene's details.
function storyRows() {
  const m = S.meta,
    c = ui.stRows;
  if (c && c.v === m.saved && c.n === Object.keys(m.scenes).length && Date.now() - c.at < 4000) return c.rows;
  const L = pkLex(),
    rows = [];
  orderedScenes().forEach((o, i) => {
    const s = m.scenes[o.id],
      vis = plainText(S.sc[o.id].text),
      words = wc(vis),
      per = Math.max(1, words / 100);
    const sents = (vis.match(/[^.!?…\n]+[.!?…]*/g) || []).filter(x => /\p{L}/u.test(x)).length;
    const toks =
      vis
        .toLowerCase()
        .replace(/’/g, "'")
        .match(/[\p{L}']+/gu) || [];
    let act = 0,
      refl = 0,
      ev = 0;
    toks.forEach(w => {
      if (REFLECT.has(w)) refl++;
      pkHits(L.mood, w).forEach(([k, v]) => {
        if (k === 'action' || k === 'fear' || k === 'anger') act += v;
      });
    });
    PK_EV.forEach(e => {
      ev += (vis.match(new RegExp(e[1].source, 'gi')) || []).length * e[4];
    });
    const avg = sents ? words / sents : 0,
      bangs = (vis.match(/!/g) || []).length;
    let est = 1 + ((act + ev * 0.6) / per) * 1.1 + (bangs / per) * 0.3;
    if (avg && avg < 10) est += 0.5;
    else if (avg > 24) est -= 0.4;
    const quote = (vis.match(/[“"][^”"\n]*[”"]/g) || []).join('').length,
      cast = {};
    findLinks(vis).forEach(l => {
      cast[l.id] = (cast[l.id] || 0) + 1;
    });
    rows.push({
      id: o.id,
      ch: o.ch,
      i,
      title: s.title,
      words,
      tension: s.tension || 0,
      est: words ? Math.round(Math.max(1, Math.min(5, est)) * 10) / 10 : 0,
      dlg: vis.length ? Math.min(1, quote / vis.length) : 0,
      act: act / per,
      refl: refl / per,
      cast,
      pov: s.pov || '',
      place: s.place || '',
      threads: s.threads || []
    });
  });
  ui.stRows = { v: m.saved, n: Object.keys(m.scenes).length, at: Date.now(), rows };
  return rows;
}
const stTen = r => r.tension || r.est;
function stLabel(r) {
  return r.ch.title + ' › ' + r.title;
}
// Scene details in the Inkling panel (This scene)
function sceneDetailsHtml(id) {
  const m = S.meta,
    s = m.scenes[id],
    ents = Object.values(m.ents).sort((a, b) => a.name.localeCompare(b.name));
  const opt = (list, sel, none) =>
    '<option value="">' +
    none +
    '</option>' +
    list
      .map(e => '<option value="' + e.id + '"' + (sel === e.id ? ' selected' : '') + '>' + esc(e.name) + '</option>')
      .join('');
  const chars = ents.filter(e => e.type === 'char'),
    places = ents.filter(e => e.type === 'place');
  return (
    '<div class="sd" id="sceneDet">' +
    '<label class="f">Point of view<select data-sd="pov">' +
    opt(chars, s.pov, 'Not set') +
    '</select></label>' +
    (places.length || s.place
      ? '<label class="f">' +
        esc(LS('place')) +
        '<select data-sd="place">' +
        opt(places, s.place, 'Not set') +
        '</select></label>'
      : '') +
    '<div class="f sdf">Tension<span class="seg sd-ten" role="group" aria-label="Tension">' +
    [1, 2, 3, 4, 5]
      .map(
        n =>
          '<button data-sd="ten" data-n="' +
          n +
          '"' +
          (s.tension === n ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') +
          ' title="' +
          ['Calm', 'Easy', 'Rising', 'Tense', 'Peak'][n - 1] +
          '">' +
          n +
          '</button>'
      )
      .join('') +
    '</span></div>' +
    '<div class="f sdf">Plot threads<span class="sd-th">' +
    m.threads
      .map(t => {
        const on = (s.threads || []).includes(t.id);
        return (
          '<button class="th-chip' +
          (on ? ' on' : '') +
          '" data-sd="th" data-id="' +
          t.id +
          '" aria-pressed="' +
          on +
          '" style="--c:' +
          cssCol(t.color) +
          '">' +
          esc(t.name) +
          '</button>'
        );
      })
      .join('') +
    '<input class="th-new" data-sd="new" maxlength="80" placeholder="' +
    (m.threads.length ? 'New thread…' : 'Name a plot thread…') +
    '" aria-label="New plot thread"></span></div>' +
    sceneSetupsHtml(id) +
    '<button class="lnk sd-open" data-sd="open">' +
    ico('chart', 13) +
    '<span>Story insights</span></button></div>'
  );
}
function sceneSetupsHtml(id) {
  const m = S.meta,
    ord = sceneOrder(),
    here = m.setups.filter(x => x.scene === id),
    paid = m.setups.filter(x => x.pay === id && x.scene !== id),
    open = m.setups.filter(x => !x.pay && x.scene && x.scene !== id && ord[x.scene] < ord[id]);
  return (
    '<div class="f sdf">Setups and payoffs<div class="fs-mini">' +
    here
      .map(
        x =>
          '<div class="fs-li"><span class="fs-ic" title="Set up here">◆</span><span>' +
          esc(x.text) +
          '</span><small>' +
          (x.pay && m.scenes[x.pay] ? 'paid off in ' + esc(m.scenes[x.pay].title) : 'no payoff yet') +
          '</small></div>'
      )
      .join('') +
    paid
      .map(
        x =>
          '<div class="fs-li pay"><span class="fs-ic" title="Paid off here">✓</span><span>' +
          esc(x.text) +
          '</span><small>' +
          (x.scene && m.scenes[x.scene] ? 'set up in ' + esc(m.scenes[x.scene].title) : '') +
          '</small></div>'
      )
      .join('') +
    '<input class="th-new" data-sd="setup" maxlength="300" placeholder="Plant a setup: a clue, a promise… (Enter)" aria-label="New setup in this scene">' +
    (open.length
      ? '<select data-sd="pay" aria-label="Pay off a setup in this scene"><option value="">Pay off a setup here…</option>' +
        open.map(x => '<option value="' + x.id + '">' + esc(x.text.slice(0, 60)) + '</option>').join('') +
        '</select>'
      : '') +
    '</div></div>'
  );
}
function bindSceneDetails(id) {
  const box = $('#sceneDet');
  if (!box) return;
  const m = S.meta;
  const redo = () => {
    renderInspector();
    renderBinder();
    if (ui.view.k === 'story') renderMain();
  };
  box.addEventListener('focusin', e => {
    if (e.target.dataset.sd === 'setup' && !e.target.value && ui.sel && ui.sel.trim()) {
      e.target.value = ui.sel.trim().replace(/\s+/g, ' ').slice(0, 300);
      e.target.select();
    }
  });
  box.addEventListener('change', e => {
    const k = e.target.dataset.sd,
      s = m.scenes[id];
    if (k === 'pay') {
      const x = m.setups.find(q => q.id === e.target.value);
      if (x) {
        x.pay = id;
        dirty('meta');
        redo();
        toast('Paid off here.', { plain: true });
      }
      return;
    }
    if (k !== 'pov' && k !== 'place') return;
    if (e.target.value) s[k] = e.target.value;
    else delete s[k];
    dirty('meta');
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('button[data-sd]');
    if (!b) return;
    const s = m.scenes[id],
      k = b.dataset.sd;
    if (k === 'ten') {
      const n = +b.dataset.n;
      if (s.tension === n) delete s.tension;
      else s.tension = n;
      dirty('meta');
      redo();
    } else if (k === 'th') {
      const t = s.threads || [],
        i = t.indexOf(b.dataset.id);
      if (i >= 0) t.splice(i, 1);
      else t.push(b.dataset.id);
      if (t.length) s.threads = t;
      else delete s.threads;
      dirty('meta');
      redo();
    } else if (k === 'open') go({ k: 'story', tab: 'pace' });
  });
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.dataset.sd === 'setup') {
      e.preventDefault();
      const t = e.target.value.trim();
      if (!t) return;
      setupAdd(t, id);
      ui.sel = '';
      redo();
      setTimeout(() => {
        const x = $('#sceneDet [data-sd="setup"]');
        if (x) x.focus();
      });
      return;
    }
    if (e.key !== 'Enter' || e.target.dataset.sd !== 'new') return;
    e.preventDefault();
    const name = e.target.value.trim();
    if (!name) return;
    const t = threadAdd(name),
      s = m.scenes[id];
    s.threads = (s.threads || []).concat(t.id);
    dirty('meta');
    redo();
    setTimeout(() => {
      const x = $('#sceneDet [data-sd="new"]');
      if (x) x.focus();
    });
  });
}
function threadAdd(name) {
  const m = S.meta,
    t = {
      id: uid('th'),
      name: String(name).slice(0, 80),
      color: TL_COLORS[m.threads.length % TL_COLORS.length][0],
      note: '',
      done: ''
    };
  m.threads.push(t);
  dirty('meta');
  return t;
}
// The view
function renderStory(el, v) {
  const tab = ['pace', 'cast', 'arcs', 'threads', 'setups'].includes(v.tab) ? v.tab : ui.stTab || 'pace';
  ui.stTab = tab;
  v.tab = tab;
  const tabs = [
    ['pace', 'Pacing'],
    ['cast', 'Point of view'],
    ['arcs', 'Arcs'],
    ['threads', 'Plot threads'],
    ['setups', 'Setups & payoffs']
  ];
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('chart', 16) +
    '</span><h1 class="mh-title">Story insights</h1>' +
    '<div class="seg st-tabs" role="tablist">' +
    tabs
      .map(
        ([k, l]) =>
          '<button role="tab" data-st="tab" data-v="' +
          k +
          '" aria-selected="' +
          (k === tab) +
          '"' +
          (k === tab ? ' class="on"' : '') +
          '>' +
          l +
          '</button>'
      )
      .join('') +
    '</div></div>' +
    '<div class="pf-wrap st-wrap">' +
    (tab === 'pace'
      ? stPaceHtml()
      : tab === 'cast'
        ? stCastHtml()
        : tab === 'setups'
          ? stSetupsHtml()
          : tab === 'arcs'
            ? stArcsHtml()
            : stThreadsHtml()) +
    '</div>';
  el.onclick = e => {
    const b = e.target.closest('[data-st],[data-open]');
    if (!b) return;
    if (b.dataset.open) {
      go({ k: 'scene', id: b.dataset.open });
      return;
    }
    const k = b.dataset.st;
    if (k === 'tab') {
      v.tab = b.dataset.v;
      renderStory(el, v);
    } else if (k === 'ent') go({ k: 'ent', id: b.dataset.id });
    else if (k === 'thadd') {
      const i = $('#thName', el),
        n = i && i.value.trim();
      if (!n) {
        if (i) i.focus();
        return;
      }
      threadAdd(n);
      renderStory(el, v);
      const j = $('#thName', el);
      if (j) j.focus();
    } else if (k === 'fsadd') {
      const i = $('#fsText', el),
        t = i && i.value.trim();
      if (!t) {
        if (i) i.focus();
        return;
      }
      setupAdd(t, $('#fsScene', el).value);
      renderStory(el, v);
      const j = $('#fsText', el);
      if (j) j.focus();
    } else if (k === 'fsdel') {
      S.meta.setups = S.meta.setups.filter(x => x.id !== b.dataset.id);
      dirty('meta');
      renderStory(el, v);
    } else if (k === 'thcol') {
      const t = S.meta.threads.find(x => x.id === b.dataset.id);
      if (t) {
        t.color = b.dataset.c;
        dirty('meta');
        renderStory(el, v);
      }
    } else if (k === 'thdel') {
      const t = S.meta.threads.find(x => x.id === b.dataset.id);
      if (!t) return;
      ask(
        'Delete the thread “' + t.name + '”?',
        'Scenes keep their words; they just stop being tagged with this thread.',
        [
          ['yes', 'Delete', 'danger'],
          ['no', 'Cancel']
        ]
      ).then(r => {
        if (r !== 'yes') return;
        S.meta.threads = S.meta.threads.filter(x => x.id !== t.id);
        Object.values(S.meta.scenes).forEach(s => {
          if (s.threads) {
            s.threads = s.threads.filter(x => x !== t.id);
            if (!s.threads.length) delete s.threads;
          }
        });
        dirty('meta');
        renderStory(el, v);
      });
    }
  };
  el.onkeydown = e => {
    if (e.key === 'Enter' && e.target.id === 'fsText') {
      e.preventDefault();
      const b = $('[data-st="fsadd"]', el);
      if (b) b.click();
      return;
    }
    if (e.key === 'Enter' && e.target.id === 'thName') {
      e.preventDefault();
      const b = $('[data-st="thadd"]', el);
      if (b) b.click();
    }
  };
  el.oninput = e => {
    const fx = e.target.dataset.fs && S.meta.setups.find(x => x.id === e.target.dataset.id);
    if (fx) {
      const k = e.target.dataset.fs;
      if (k === 'text') fx.text = e.target.value.slice(0, 300);
      else if (k === 'note') fx.note = e.target.value.slice(0, 2000);
      dirty('meta');
      return;
    }
    const t = e.target.dataset.th && S.meta.threads.find(x => x.id === e.target.dataset.id);
    if (!t) return;
    if (e.target.dataset.th === 'name') t.name = e.target.value.slice(0, 80) || 'Thread';
    else if (e.target.dataset.th === 'note') t.note = e.target.value.slice(0, 2000);
    dirty('meta');
  };
  el.onchange = e => {
    const fx = e.target.dataset.fs && S.meta.setups.find(x => x.id === e.target.dataset.id);
    if (fx && (e.target.dataset.fs === 'scene' || e.target.dataset.fs === 'pay')) {
      fx[e.target.dataset.fs] = e.target.value;
      dirty('meta');
      renderStory(el, v);
      return;
    }
    const t = e.target.dataset.th === 'done' && S.meta.threads.find(x => x.id === e.target.dataset.id);
    if (!t) return;
    t.done = e.target.value;
    dirty('meta');
    renderStory(el, v);
  };
}
function stEmpty() {
  return '<section class="pf"><p class="ct-none">Write a scene or two first. Story insights reads your scenes in order.</p></section>';
}
function stPaceHtml() {
  const rows = storyRows();
  if (!rows.some(r => r.words)) return stEmpty();
  const n = rows.length,
    cw = Math.max(14, 680 / n),
    x0 = 34,
    W = x0 + n * cw + 12,
    yT = 34,
    yB = 170,
    wT = 186,
    wB = 226,
    mT = 236,
    mB = 248,
    H = 262;
  const y = t => yB - ((t - 1) / 4) * (yB - yT),
    cx = i => x0 + i * cw + cw / 2,
    maxW = Math.max(...rows.map(r => r.words), 1);
  let bands = '',
    lastCh = null,
    ci = 0;
  rows.forEach((r, i) => {
    if (r.ch !== lastCh) {
      let j = i;
      while (j < n && rows[j].ch === r.ch) j++;
      const bw = (j - i) * cw;
      bands +=
        '<g><rect x="' +
        (x0 + i * cw) +
        '" y="14" width="' +
        bw +
        '" height="' +
        (mB - 14) +
        '" class="st-band' +
        (ci % 2 ? ' alt' : '') +
        '"/><text x="' +
        (x0 + i * cw + 4) +
        '" y="26" class="st-chl">' +
        esc(stClip(r.ch.title, Math.floor(bw / 6.5))) +
        '</text></g>';
      lastCh = r.ch;
      ci++;
    }
  });
  const pts = rows.map((r, i) => (r.words || r.tension ? [cx(i), y(stTen(r))] : null));
  let path = '',
    pen = false;
  pts.forEach(p => {
    if (!p) {
      pen = false;
      return;
    }
    path += (pen ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    pen = true;
  });
  const grid = [1, 2, 3, 4, 5]
    .map(
      t =>
        '<line x1="' +
        x0 +
        '" x2="' +
        (W - 12) +
        '" y1="' +
        y(t) +
        '" y2="' +
        y(t) +
        '" class="st-grid"/><text x="' +
        (x0 - 8) +
        '" y="' +
        (y(t) + 4) +
        '" class="st-ax" text-anchor="end">' +
        t +
        '</text>'
    )
    .join('');
  const cols = rows
    .map((r, i) => {
      const x = x0 + i * cw,
        bh = (r.words / maxW) * (wB - wT),
        t = stTen(r),
        d = r.dlg,
        rest = 1 - d,
        ar = r.act + r.refl,
        a = ar ? (rest * r.act) / ar : 0,
        f = ar ? (rest * r.refl) / ar : 0,
        w2 = cw - 4;
      const tip =
        stLabel(r) +
        '\n' +
        (r.tension
          ? 'Tension ' + r.tension + ' (set by you)'
          : r.words
            ? 'Tension about ' + r.est + ' (estimated)'
            : 'No words yet') +
        '\n' +
        fmt(r.words) +
        ' words · ' +
        Math.round(d * 100) +
        '% dialogue';
      return (
        '<g class="st-col" data-open="' +
        r.id +
        '"><title>' +
        esc(tip) +
        '</title><rect x="' +
        x +
        '" y="14" width="' +
        cw +
        '" height="' +
        (mB - 14) +
        '" class="st-hit"/>' +
        '<rect x="' +
        (x + 2) +
        '" y="' +
        (wB - bh).toFixed(1) +
        '" width="' +
        w2 +
        '" height="' +
        bh.toFixed(1) +
        '" rx="2" class="st-words"/>' +
        (r.words
          ? '<rect x="' +
            (x + 2) +
            '" y="' +
            mT +
            '" width="' +
            (w2 * d).toFixed(1) +
            '" height="' +
            (mB - mT) +
            '" class="st-m dlg"/><rect x="' +
            (x + 2 + w2 * d).toFixed(1) +
            '" y="' +
            mT +
            '" width="' +
            (w2 * a).toFixed(1) +
            '" height="' +
            (mB - mT) +
            '" class="st-m act"/><rect x="' +
            (x + 2 + w2 * (d + a)).toFixed(1) +
            '" y="' +
            mT +
            '" width="' +
            (w2 * f).toFixed(1) +
            '" height="' +
            (mB - mT) +
            '" class="st-m refl"/><rect x="' +
            (x + 2 + w2 * (d + a + f)).toFixed(1) +
            '" y="' +
            mT +
            '" width="' +
            Math.max(0, w2 * (1 - d - a - f)).toFixed(1) +
            '" height="' +
            (mB - mT) +
            '" class="st-m nar"/>'
          : '') +
        (pts[i]
          ? '<circle cx="' +
            pts[i][0].toFixed(1) +
            '" cy="' +
            pts[i][1].toFixed(1) +
            '" r="' +
            (r.tension ? 4.5 : 3.5) +
            '" class="st-pt' +
            (r.tension ? ' set' : '') +
            '"/>'
          : '') +
        '</g>'
      );
    })
    .join('');
  const svg =
    '<div class="st-chart"><svg viewBox="0 0 ' +
    W +
    ' ' +
    H +
    '" style="width:100%;min-width:' +
    (cw > 14 ? 0 : W) +
    'px" role="img" aria-label="Tension across the book, scene by scene">' +
    bands +
    grid +
    '<path d="' +
    path +
    '" class="st-line"/>' +
    cols +
    '</svg></div>' +
    '<div class="st-key"><span><i class="st-k pt set"></i>Tension you set</span><span><i class="st-k pt"></i>Estimated from your words</span><span><i class="st-k dlg"></i>Dialogue</span><span><i class="st-k act"></i>Action</span><span><i class="st-k refl"></i>Reflection</span><span><i class="st-k nar"></i>Other narration</span></div>';
  // what stands out
  const notes = [],
    vals = rows.map(r => (r.words || r.tension ? stTen(r) : null)),
    total = rows.reduce((a, r) => a + r.words, 0);
  let i = 0;
  while (i < n) {
    if (vals[i] != null && vals[i] <= 2) {
      let j = i;
      while (j + 1 < n && vals[j + 1] != null && vals[j + 1] <= 2) j++;
      if (j - i + 1 >= 3)
        notes.push(
          '<li><b>A quiet stretch of ' +
            (j - i + 1) +
            ' scenes</b>, from <button class="lnk" data-open="' +
            rows[i].id +
            '">' +
            esc(stLabel(rows[i])) +
            '</button> to <button class="lnk" data-open="' +
            rows[j].id +
            '">' +
            esc(stLabel(rows[j])) +
            '</button>. A breather can be good; check it isn’t a sag.</li>'
        );
      i = j + 1;
    } else i++;
  }
  const top = rows.filter(r => r.words || r.tension).sort((a, b) => stTen(b) - stTen(a) || b.i - a.i)[0];
  if (top && total) {
    const at = rows.slice(0, top.i).reduce((a, r) => a + r.words, 0) + top.words / 2,
      pc = Math.round((at / total) * 100);
    notes.push(
      '<li><b>The most intense scene</b> is <button class="lnk" data-open="' +
        top.id +
        '">' +
        esc(stLabel(top)) +
        '</button>, ' +
        pc +
        '% of the way through. ' +
        (pc < 60
          ? 'Most stories build to their biggest moment later, around 75–90%.'
          : pc > 95
            ? 'Leave a little room after the climax to land the ending.'
            : 'That’s about where a climax usually sits.') +
        '</li>'
    );
  }
  const unset = rows.filter(r => r.words && !r.tension).length;
  if (unset)
    notes.push(
      '<li>' +
        unset +
        ' scene' +
        (unset === 1 ? ' has' : 's have') +
        ' an estimated tension. Set your own in the Inkling panel (This scene › Tension) for a truer line.</li>'
    );
  return (
    '<section class="pf"><h2>Pacing</h2><p class="fine">Each column is a scene, in book order. The line is how tense it feels; the bars are its length; the strip under them is its mix. Click a scene to open it.</p>' +
    svg +
    '</section>' +
    (notes.length
      ? '<section class="pf"><h2>What stands out</h2><ul class="st-notes">' + notes.join('') + '</ul></section>'
      : '')
  );
}
function stClip(s, n) {
  s = String(s);
  return n < 4 ? '' : s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function stCastHtml() {
  const rows = storyRows(),
    m = S.meta;
  if (!rows.some(r => r.words)) return stEmpty();
  const total = rows.reduce((a, r) => a + r.words, 0) || 1,
    by = {};
  rows.forEach(r => {
    const k = r.pov && m.ents[r.pov] ? r.pov : '';
    const b = by[k] || (by[k] = { words: 0, scenes: 0, chs: new Set() });
    b.words += r.words;
    b.scenes++;
    b.chs.add(r.ch.id);
  });
  const keys = Object.keys(by).sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || by[b].words - by[a].words);
  const pov =
    '<section class="pf"><h2>Point of view</h2><p class="fine">Whose eyes we see through, by words. Set each scene’s point of view in the Inkling panel (This scene › Point of view).</p><div class="st-bars">' +
    keys
      .map(k => {
        const b = by[k],
          pc = (b.words / total) * 100,
          e = k && m.ents[k];
        return (
          '<div class="st-br"><span class="st-bn">' +
          (e
            ? '<button class="lnk" data-st="ent" data-id="' + k + '">' + esc(e.name) + '</button>'
            : '<span class="muted">Not set</span>') +
          '</span><span class="st-bb"><i style="width:' +
          pc.toFixed(1) +
          '%;--c:' +
          (e ? 'var(--char)' : 'var(--line)') +
          '"></i></span><span class="st-bv">' +
          Math.round(pc) +
          '% · ' +
          b.scenes +
          ' scene' +
          (b.scenes === 1 ? '' : 's') +
          '</span></div>'
        );
      })
      .join('') +
    '</div></section>';
  const chars = Object.values(m.ents).filter(e => e.type === 'char'),
    tot = {};
  rows.forEach(r =>
    Object.keys(r.cast).forEach(id => {
      tot[id] = (tot[id] || 0) + r.cast[id];
    })
  );
  const list = chars
    .filter(e => tot[e.id] || rows.some(r => r.pov === e.id))
    .sort((a, b) => (tot[b.id] || 0) - (tot[a.id] || 0))
    .slice(0, 20);
  const chs = m.chapters.filter(c => c.scenes.length),
    cell = {},
    povIn = {};
  rows.forEach(r => {
    Object.keys(r.cast).forEach(id => {
      const k = id + '|' + r.ch.id;
      cell[k] = (cell[k] || 0) + r.cast[id];
    });
    if (r.pov) povIn[r.pov + '|' + r.ch.id] = 1;
  });
  const max = Math.max(1, ...Object.values(cell));
  const grid = list.length
    ? '<div class="st-grid-wrap"><table class="st-tab"><thead><tr><th></th>' +
      chs.map((c, i) => '<th title="' + esc(c.title) + '">' + (i + 1) + '</th>').join('') +
      '<th>All</th></tr></thead><tbody>' +
      list
        .map(
          e =>
            '<tr><th><button class="lnk" data-st="ent" data-id="' +
            e.id +
            '">' +
            esc(e.name) +
            '</button></th>' +
            chs
              .map(c => {
                const k = e.id + '|' + c.id,
                  nn = cell[k] || 0;
                return (
                  '<td class="st-c' +
                  (povIn[k] ? ' pov' : '') +
                  '" style="--a:' +
                  (nn ? (0.15 + (0.85 * nn) / max).toFixed(2) : 0) +
                  '" title="' +
                  esc(
                    e.name +
                      ' in ' +
                      c.title +
                      ': ' +
                      nn +
                      ' mention' +
                      (nn === 1 ? '' : 's') +
                      (povIn[k] ? ', point of view' : '')
                  ) +
                  '">' +
                  (nn || '') +
                  '</td>'
                );
              })
              .join('') +
            '<td class="st-all">' +
            (tot[e.id] || 0) +
            '</td></tr>'
        )
        .join('') +
      '</tbody></table></div><p class="fine">Mentions of each character by chapter (names and aliases). A ringed square means they hold the point of view there.</p>'
    : '<p class="ct-none">No characters are mentioned yet. Add character pages and use their names in your scenes.</p>';
  return pov + '<section class="pf"><h2>Screen time</h2>' + grid + '</section>';
}
function threadWarnings() {
  const m = S.meta,
    chs = m.chapters.filter(c => c.scenes.length),
    idx = {},
    out = [];
  chs.forEach((c, i) => {
    idx[c.id] = i;
  });
  m.threads.forEach(t => {
    const at = [
      ...new Set(
        storyRows()
          .filter(r => r.threads.includes(t.id))
          .map(r => idx[r.ch.id])
      )
    ].sort((a, b) => a - b);
    if (!at.length) {
      out.push({ t, kind: 'none', text: '“' + t.name + '” isn’t in any scene yet.' });
      return;
    }
    for (let k = 1; k < at.length; k++)
      if (at[k] - at[k - 1] - 1 >= THREAD_GAP)
        out.push({
          t,
          kind: 'gap',
          text:
            '“' +
            t.name +
            '” disappears for ' +
            (at[k] - at[k - 1] - 1) +
            ' chapters, between ' +
            chs[at[k - 1]].title +
            ' and ' +
            chs[at[k]].title +
            '.'
        });
    const last = at[at.length - 1];
    if (!t.done && chs.length - 1 - last >= THREAD_GAP)
      out.push({
        t,
        kind: 'end',
        text: '“' + t.name + '” was last seen in ' + chs[last].title + ' and is never resolved.'
      });
    else if (!t.done && chs.length >= THREAD_GAP * 2)
      out.push({ t, kind: 'open', text: '“' + t.name + '” has no resolving scene yet.' });
  });
  return out;
}
function stSetupsHtml() {
  const m = S.meta,
    ord = sceneOrder(),
    list = m.setups.slice().sort((a, b) => (ord[a.scene] ?? 1e9) - (ord[b.scene] ?? 1e9)),
    warn = setupWarnings(),
    cur = ui.view.k === 'scene' ? ui.view.id : ui.lastScene || '';
  const scOpts = (sel, none) =>
    '<option value="">' +
    none +
    '</option>' +
    m.chapters
      .map(
        ch =>
          '<optgroup label="' +
          esc(ch.title) +
          '">' +
          ch.scenes
            .map(
              id =>
                '<option value="' +
                id +
                '"' +
                (sel === id ? ' selected' : '') +
                '>' +
                esc(m.scenes[id].title) +
                '</option>'
            )
            .join('') +
          '</optgroup>'
      )
      .join('');
  const add =
    '<div class="th-add fs-add"><input id="fsText" maxlength="300" placeholder="A clue, a promise, a gun on the wall…" aria-label="New setup"><select id="fsScene" aria-label="Set up in">' +
    scOpts(m.scenes[cur] ? cur : '', 'Set up in…') +
    '</select><button class="btn pri" data-st="fsadd">' +
    ico('plus', 14) +
    '<span>Add setup</span></button></div>';
  const intro =
    '<p class="fine">Every clue, promise or Chekhov’s gun should pay off later. Plant them here or in the Inkling panel (This scene › Setups and payoffs; select words in a scene first to use them), then choose where each one pays off.</p>';
  if (!list.length) return '<section class="pf"><h2>Setups &amp; payoffs</h2>' + intro + add + '</section>';
  const paid = list.filter(x => x.pay).length;
  const cards = list
    .map(x => {
      const bad = warn.some(w => w.x === x && w.kind === 'order');
      return (
        '<div class="th-card fs-card' +
        (x.pay ? ' paid' : '') +
        (bad ? ' bad' : '') +
        '"><div class="th-row"><span class="fs-ic">' +
        (x.pay ? '✓' : '◆') +
        '</span><input data-fs="text" data-id="' +
        x.id +
        '" value="' +
        esc(x.text) +
        '" maxlength="300" aria-label="Setup"><button class="ibtn" data-st="fsdel" data-id="' +
        x.id +
        '" aria-label="Delete setup" title="Delete setup">' +
        ico('trash', 14) +
        '</button></div>' +
        '<div class="two"><label class="f">Set up in<select data-fs="scene" data-id="' +
        x.id +
        '">' +
        scOpts(x.scene, 'Not chosen') +
        '</select></label><label class="f">Paid off in<select data-fs="pay" data-id="' +
        x.id +
        '">' +
        scOpts(x.pay, 'Not yet') +
        '</select></label></div>' +
        '<textarea data-fs="note" data-id="' +
        x.id +
        '" rows="2" placeholder="How it pays off, or what the reader should notice." aria-label="Setup notes">' +
        esc(x.note) +
        '</textarea>' +
        '<p class="fine">' +
        [
          x.scene && m.scenes[x.scene] ? '<button class="lnk" data-open="' + x.scene + '">Open the setup</button>' : '',
          x.pay && m.scenes[x.pay] ? '<button class="lnk" data-open="' + x.pay + '">Open the payoff</button>' : ''
        ]
          .filter(Boolean)
          .join(' · ') +
        '</p></div>'
      );
    })
    .join('');
  return (
    '<section class="pf"><h2>Setups &amp; payoffs <span class="muted">' +
    paid +
    ' of ' +
    list.length +
    ' paid off</span></h2>' +
    intro +
    add +
    '</section>' +
    '<section class="pf"><h2>To check <span class="muted">' +
    warn.length +
    '</span></h2>' +
    (warn.length
      ? '<ul class="st-notes">' +
        warn.map(w => '<li class="th-w fs-' + w.kind + '">' + esc(w.text) + '</li>').join('') +
        '</ul>'
      : '<p class="ct-none">Every setup pays off, in the right order.</p>') +
    '</section>' +
    '<section class="pf"><h2>In book order</h2><div class="th-cards">' +
    cards +
    '</div></section>'
  );
}

/* ---------- character arcs ---------- */
// S.en[id].arc on a character page: type (pos: grows, neg: falls, flat: holds firm and changes others), goal, wound,
// lie, truth, and pts{chapterId:{v:1–10, n:note}}: how far along their change they are in that chapter.
const ARC_TYPES = [
  ['pos', 'Grows'],
  ['neg', 'Falls'],
  ['flat', 'Holds firm']
];
const ARC_F = [
  ['goal', 'Goal', 'What they want'],
  ['wound', 'Wound', 'What hurt them before the story'],
  ['lie', 'Lie', 'What they wrongly believe'],
  ['truth', 'Truth', 'What they need to learn']
];
function normArc(a) {
  if (!a || typeof a !== 'object') return null;
  const o = { type: ARC_TYPES.some(t => t[0] === a.type) ? a.type : 'pos', pts: {} };
  let any = false;
  ARC_F.forEach(([k]) => {
    const t = String(a[k] || '').slice(0, 2000);
    if (t) {
      o[k] = t;
      any = true;
    }
  });
  const p = a.pts && typeof a.pts === 'object' ? a.pts : {};
  Object.keys(p)
    .slice(0, 500)
    .forEach(k => {
      const x = p[k] || {},
        v = Math.round(+x.v || 0),
        n = String(x.n || '').slice(0, 1000);
      if (!/^[\w-]{1,40}$/.test(k) || (!(v >= 1 && v <= 10) && !n)) return;
      o.pts[k] = {};
      if (v >= 1 && v <= 10) o.pts[k].v = v;
      if (n) o.pts[k].n = n;
      any = true;
    });
  return any || (a.type && a.type !== 'pos') ? o : null;
}
const arcOf = id => (S.en[id] && S.en[id].arc) || null;
function arcEdit(id) {
  const b = S.en[id];
  if (!b.arc) b.arc = { type: 'pos', pts: {} };
  return b.arc;
}
// A line chart of arcs by chapter: series [{id,name,color,pts}], one column per chapter; sel = the selected chapter id.
function arcSvg(series, chs, o) {
  o = o || {};
  const n = Math.max(1, chs.length),
    x0 = 30,
    cw = Math.max(28, 640 / n),
    W = x0 + n * cw + 10,
    yT = 18,
    yB = 170,
    H = 196,
    y = v => yB - ((v - 1) / 9) * (yB - yT),
    cx = i => x0 + i * cw + cw / 2;
  let h =
    '<svg class="arc-svg" viewBox="0 0 ' +
    W +
    ' ' +
    H +
    '" style="width:100%;min-width:' +
    (cw > 28 ? 0 : W) +
    'px" role="img" aria-label="' +
    esc(o.label || 'Character arcs by chapter') +
    '">';
  [1, 4, 7, 10].forEach(v => {
    h += '<line x1="' + x0 + '" x2="' + (W - 10) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="st-grid"/>';
  });
  h +=
    '<text x="' +
    (x0 - 6) +
    '" y="' +
    (y(10) + 4) +
    '" class="st-ax" text-anchor="end">10</text><text x="' +
    (x0 - 6) +
    '" y="' +
    (y(1) + 4) +
    '" class="st-ax" text-anchor="end">1</text>';
  chs.forEach((c, i) => {
    h +=
      '<g class="arc-col' +
      (o.sel === c.id ? ' sel' : '') +
      '" data-arc-ch="' +
      c.id +
      '"><title>' +
      esc(c.title) +
      '</title><rect x="' +
      (x0 + i * cw) +
      '" y="' +
      (yT - 8) +
      '" width="' +
      cw +
      '" height="' +
      (yB - yT + 16) +
      '" class="arc-hit"/><text x="' +
      cx(i) +
      '" y="' +
      (H - 6) +
      '" class="st-ax" text-anchor="middle">' +
      (i + 1) +
      '</text></g>';
  });
  series.forEach(s => {
    const col = cssCol(s.color);
    let d = '',
      pen = false;
    chs.forEach((c, i) => {
      const p = s.pts[c.id];
      if (!p || !p.v) {
        return;
      }
      d += (pen ? 'L' : 'M') + cx(i).toFixed(1) + ' ' + y(p.v).toFixed(1);
      pen = true;
    });
    h +=
      '<path d="' +
      d +
      '" fill="none" stroke="' +
      col +
      '" stroke-width="2.5" stroke-linejoin="round" class="arc-line" data-who="' +
      s.id +
      '"/>';
    chs.forEach((c, i) => {
      const p = s.pts[c.id];
      if (p && p.v)
        h +=
          '<circle cx="' +
          cx(i).toFixed(1) +
          '" cy="' +
          y(p.v).toFixed(1) +
          '" r="4.5" fill="' +
          col +
          '" class="arc-pt"><title>' +
          esc(s.name + ' · ' + c.title + ': ' + p.v + (p.n ? ' · ' + p.n : '')) +
          '</title></circle>';
    });
  });
  return h + '</svg>';
}
function drawArcBox(e) {
  const box = $('#arcBox');
  if (!box) return;
  const a = arcOf(e.id) || { type: 'pos', pts: {} },
    chs = S.meta.chapters,
    sel = chs.some(c => c.id === ui.arcSel) ? ui.arcSel : '',
    p = (sel && a.pts[sel]) || {};
  box.innerHTML =
    '<h3>Character arc</h3><p class="sub">Who they are at the start, what they must learn, and how far they’ve come in each chapter. Click the chart to set a chapter.</p>' +
    '<div class="seg arc-type" role="group" aria-label="Kind of arc">' +
    ARC_TYPES.map(
      ([k, l]) =>
        '<button data-arc="type" data-v="' +
        k +
        '"' +
        (a.type === k ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') +
        '>' +
        l +
        '</button>'
    ).join('') +
    '</div>' +
    '<div class="arc-fs">' +
    ARC_F.map(
      ([k, l, h]) =>
        '<label class="f">' +
        l +
        '<textarea data-arc-f="' +
        k +
        '" rows="2" placeholder="' +
        esc(h) +
        '">' +
        esc(a[k] || '') +
        '</textarea></label>'
    ).join('') +
    '</div>' +
    '<div class="arc-chart">' +
    arcSvg([{ id: e.id, name: e.name, color: 'char', pts: a.pts }], chs, { sel, label: e.name + '’s arc by chapter' }) +
    '</div>' +
    '<div class="arc-scale"><span>1 · ' +
    (a.type === 'neg' ? 'At their best' : a.type === 'flat' ? 'Tested' : 'Where they start') +
    '</span><span>10 · ' +
    (a.type === 'neg' ? 'Fallen' : a.type === 'flat' ? 'Proved right' : 'Changed') +
    '</span></div>' +
    (sel
      ? '<div class="arc-sel"><b>' +
        esc(chs.find(c => c.id === sel).title) +
        '</b><label class="f">Where they are<select data-arc="v"><option value="">Not set</option>' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          .map(n => '<option' + (p.v === n ? ' selected' : '') + '>' + n + '</option>')
          .join('') +
        '</select></label>' +
        '<label class="f">What changes for them here<input data-arc="n" maxlength="1000" value="' +
        esc(p.n || '') +
        '" placeholder="A choice, a blow, a realisation…"></label></div>'
      : '<p class="sub arc-hint">' +
        (Object.keys(a.pts).length
          ? 'Click a chapter to change it or add a note.'
          : 'Click above a chapter number to mark where ' + esc(e.name) + ' is.') +
        '</p>');
  box.querySelectorAll('textarea').forEach(t => ag(t));
  if (!box.dataset.bound) {
    box.dataset.bound = '1';
    box.addEventListener('input', ev => {
      const k = ev.target.dataset.arcF;
      if (k) {
        ag(ev.target);
        const ar = arcEdit(e.id);
        if (ev.target.value) ar[k] = ev.target.value.slice(0, 2000);
        else delete ar[k];
        dirty('en_' + e.id);
        return;
      }
      if (ev.target.dataset.arc === 'n' && ui.arcSel) {
        const ar = arcEdit(e.id),
          q = ar.pts[ui.arcSel] || (ar.pts[ui.arcSel] = {});
        if (ev.target.value) q.n = ev.target.value.slice(0, 1000);
        else delete q.n;
        if (!q.v && !q.n) delete ar.pts[ui.arcSel];
        dirty('en_' + e.id);
      }
    });
    box.addEventListener('change', ev => {
      if (ev.target.dataset.arc !== 'v' || !ui.arcSel) return;
      const ar = arcEdit(e.id),
        q = ar.pts[ui.arcSel] || (ar.pts[ui.arcSel] = {}),
        n = +ev.target.value;
      if (n) q.v = n;
      else delete q.v;
      if (!q.v && !q.n) delete ar.pts[ui.arcSel];
      dirty('en_' + e.id);
      drawArcBox(e);
    });
    box.addEventListener('click', ev => {
      const b = ev.target.closest('[data-arc="type"]');
      if (b) {
        arcEdit(e.id).type = b.dataset.v;
        dirty('en_' + e.id);
        drawArcBox(e);
      }
    });
    box.addEventListener('pointerdown', ev => {
      const g = ev.target.closest('[data-arc-ch]');
      if (!g) return;
      const svg = g.ownerSVGElement,
        r = svg.getBoundingClientRect(),
        vb = svg.viewBox.baseVal,
        yy = ((ev.clientY - r.top) / r.height) * vb.height;
      const v = Math.max(1, Math.min(10, Math.round(1 + ((170 - yy) / (170 - 18)) * 9))),
        ch = g.dataset.arcCh,
        ar = arcEdit(e.id),
        q = ar.pts[ch] || (ar.pts[ch] = {});
      if (ui.arcSel === ch || !q.v) q.v = v;
      ui.arcSel = ch;
      dirty('en_' + e.id);
      drawArcBox(e);
    });
  }
}
function stArcsHtml() {
  const m = S.meta,
    chs = m.chapters,
    chars = Object.values(m.ents).filter(e => e.type === 'char'),
    withArc = chars.filter(e => {
      const a = arcOf(e.id);
      return a && Object.values(a.pts).some(p => p.v);
    });
  const intro =
    '<p class="fine">Track how each character changes. On a character’s page, fill in their goal, wound, lie and truth, then click the arc chart to mark how far along they are in each chapter.</p>';
  if (!chars.length)
    return (
      '<section class="pf"><h2>Character arcs</h2>' +
      intro +
      '<p class="ct-none">Add a character page first.</p></section>'
    );
  const series = withArc.map((e, i) => ({
    id: e.id,
    name: e.name,
    color: TL_COLORS[i % TL_COLORS.length][0],
    pts: arcOf(e.id).pts
  }));
  const pov = new Set(
      Object.values(m.scenes)
        .map(s => s.pov)
        .filter(Boolean)
    ),
    miss = chars.filter(e => pov.has(e.id) && !withArc.includes(e));
  const rows = chars
    .filter(e => arcOf(e.id) || pov.has(e.id))
    .map(e => {
      const a = arcOf(e.id) || {},
        pts = chs.map(c => a.pts && a.pts[c.id] && a.pts[c.id].v).filter(Boolean);
      return (
        '<tr><th><button class="lnk" data-st="ent" data-id="' +
        e.id +
        '">' +
        esc(e.name) +
        '</button></th><td>' +
        esc((ARC_TYPES.find(t => t[0] === a.type) || ['', a.type ? '' : '—'])[1]) +
        '</td><td>' +
        esc(a.lie || '') +
        '</td><td>' +
        esc(a.truth || '') +
        '</td><td class="mono">' +
        (pts.length > 1 ? pts[0] + ' → ' + pts[pts.length - 1] : pts[0] || '') +
        '</td></tr>'
      );
    })
    .join('');
  return (
    '<section class="pf"><h2>Character arcs</h2>' +
    intro +
    (series.length
      ? '<div class="st-chart">' +
        arcSvg(series, chs) +
        '</div><div class="st-key">' +
        series
          .map(
            s =>
              '<span><i class="st-k" style="background:' +
              cssCol(s.color) +
              '"></i><button class="lnk" data-st="ent" data-id="' +
              s.id +
              '">' +
              esc(s.name) +
              '</button></span>'
          )
          .join('') +
        '</div>'
      : '<p class="ct-none">No arcs charted yet.</p>') +
    (miss.length
      ? '<p class="fine arc-miss">Point-of-view characters without an arc yet: ' +
        miss
          .map(e => '<button class="lnk" data-st="ent" data-id="' + e.id + '">' + esc(e.name) + '</button>')
          .join(', ') +
        '.</p>'
      : '') +
    '</section>' +
    (rows
      ? '<section class="pf"><h2>At a glance</h2><div class="st-grid-wrap"><table class="arc-tab"><thead><tr><th>Character</th><th>Arc</th><th>Lie</th><th>Truth</th><th>From → to</th></tr></thead><tbody>' +
        rows +
        '</tbody></table></div></section>'
      : '')
  );
}
