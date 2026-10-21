/*
 * 20-scene-editor.js: The main pane and the scene editor
 *
 * renderMain() draws whatever view is open in the main pane, choosing the right render function for its kind. The
 * rest of the file is the scene editor: renderScene() builds the page (title, status, toolbar, the editable text and
 * its margins), and onType() runs on every change to save the text, count new words for Inky and the daily goal, keep
 * name links and word counts up to date, and keep the caret on screen.
 *
 * Also here: Inkling's own undo and redo per scene, Tab indents, the word count of a selection, reading aloud, the
 * keyboard shortcuts list, and sticky notes in the page margins.
 */
// Draws the open view in the main pane, and keeps the scroll position when the same view is redrawn.
function renderMain() {
  const v = ui.view,
    el = $('#main');
  if (!viewValid(v)) {
    ui.view = firstView();
    return renderMain();
  }
  const key = v.k + ':' + (v.id || ''),
    reset = key !== ui.lastKey;
  ui.lastKey = key;
  const keep = el.scrollTop;
  if (v.k === 'ent') renderEnt(el, v);
  else if (v.k === 'cork') renderCork(el);
  else if (v.k === 'tl') renderTl(el, v);
  else if (v.k === 'nt') renderNt(el, v);
  else if (v.k === 'ol') renderOl(el, v);
  else if (v.k === 'rm' || v.k === 'ft') renderCv(el, v);
  else if (v.k === 'ss') renderSs(el);
  else if (v.k === 'prefs') renderPrefs(el);
  else if (v.k === 'snap') renderSnap(el, v);
  else if (v.k === 'find') renderFind(el);
  else if (v.k === 'help') renderHelp(el);
  else if (v.k === 'den') renderDen(el);
  else if (v.k === 'cont') renderCont(el);
  else if (v.k === 'layout') renderLayout(el);
  else if (v.k === 'plan') renderPlan(el);
  else if (v.k === 'trash') renderTrash(el);
  else if (v.k === 'search') renderSearch(el);
  else if (v.k === 'story') renderStory(el, v);
  else if (v.k === 'world') renderWorld(el);
  else if (v.k === 'series') renderSeries(el);
  else renderScene(el, v);
  el.scrollTop = reset ? 0 : keep;
  if (reset && v.k === 'scene') posRestore(v.id);
}
// Draws the scene editor: title, status, word count, the toolbar, the text with its name links and formatting, sticky
// notes, and the next and previous scene buttons. Also wires up typing, shortcuts and pasting.
function renderScene(el, v) {
  const m = S.meta,
    sc = m.scenes[v.id],
    d = S.sc[v.id],
    ch = m.chapters.find(c => c.scenes.includes(v.id));
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<input id="sceneTitle" class="title-in" value="' +
    esc(sc.title) +
    '" maxlength="100" aria-label="Scene title">' +
    '<select id="sceneStatus" aria-label="Scene status">' +
    Object.keys(STATUS)
      .map(k => '<option value="' + k + '"' + (sc.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>')
      .join('') +
    '</select>' +
    '<span class="mono muted" id="sceneWc">' +
    fmt(sc.words) +
    ' words</span>' +
    '<div class="tools"><span class="fmt-btns" role="group" aria-label="Formatting"><button class="ibtn fb" data-fmt="bold" title="Bold (Ctrl+B)" aria-label="Bold"><b>B</b></button><button class="ibtn fb" data-fmt="italic" title="Italic (Ctrl+I)" aria-label="Italic"><i>I</i></button><button class="ibtn fb" data-fmt="underline" title="Underline (Ctrl+U)" aria-label="Underline"><u>U</u></button><i class="fsep"></i>' +
    '<button class="ibtn fb" data-ed="undo" title="Undo (' +
    MODK +
    '+Z)" aria-label="Undo">' +
    ico('undo') +
    '</button><button class="ibtn fb" data-ed="redo" title="Redo (' +
    (MODK === '⌘' ? '⌘+Shift+Z' : 'Ctrl+Y') +
    ')" aria-label="Redo">' +
    ico('redo') +
    '</button><i class="fsep"></i>' +
    '<button class="ibtn fb" data-ed="out" title="Remove indent (Shift+Tab)" aria-label="Remove indent">' +
    ico('outdent') +
    '</button><button class="ibtn fb" data-ed="in" title="Indent (Tab)" aria-label="Indent">' +
    ico('indent') +
    '</button></span><div class="mk-wrap scene-mk"><button class="btn" id="mkBtn" title="Select a name in your text, then link it to a new page">' +
    ico('link') +
    '<span>Link selection</span></button><div class="pop" id="mkPop" hidden></div></div>' +
    '<button class="ibtn sz-btn" id="fsDn" aria-label="Smaller text" style="width:auto;padding:0 8px;font-weight:600">A−</button><button class="ibtn sz-btn" id="fsUp" aria-label="Larger text" style="width:auto;padding:0 8px;font-weight:600">A+</button>' +
    '<button class="btn" id="stkBtn" title="Add a sticky note beside the page (or double-click in the margin)">' +
    ico('note') +
    '<span>Sticky note</span></button>' +
    '<button class="btn" id="snBtn" title="Saved versions of this scene">' +
    ico('time') +
    '<span>Snapshots</span></button>' +
    (canSpeak()
      ? '<button class="btn" id="raBtn" aria-pressed="false" title="Hear the selection, or from this paragraph on: a good way to catch mistakes"></button>'
      : '') +
    '<button class="ibtn" id="spBtn" title="Side by side: a story page, note or another scene beside this one (' +
    MODK +
    '+\\)" aria-label="Side by side" aria-pressed="false">' +
    ico('split') +
    '</button>' +
    '<button class="btn" id="focusBtn" aria-pressed="' +
    (ui.focus ? 'true' : 'false') +
    '">' +
    ico('focus') +
    '<span>' +
    (ui.focus ? 'Exit focus' : 'Focus') +
    '</span></button></div></div>' +
    (m.sample
      ? '<div class="banner"><span>This is a sample project, so you can try the links and the pet. ' +
        (DESK
          ? 'Choose <b>File → New project</b> when you are ready for your own.'
          : 'Open the menu and choose <b>Start a blank project</b> when you are ready for your own.') +
        '</span><button class="btn sm" id="bnX">Dismiss</button></div>'
      : '') +
    '<div class="here-ban" id="hereBan" role="status" hidden></div>' +
    '<div class="sheet-wrap" id="sheetWrap"><div class="stk-layer" id="stkLayer"></div><div class="sheet"><div id="ed" class="editor" role="textbox" aria-multiline="true" aria-label="Scene text" spellcheck="' +
    (LOOK.spell ? 'true' : 'false') +
    '" data-ph="Start writing. Names you have pages for will link automatically."></div></div></div>' +
    (n => {
      const all = orderedScenes(),
        i = all.findIndex(x => x.id === v.id),
        pv = all[i - 1],
        nx = all[i + 1];
      return pv || nx
        ? '<nav class="sc-nav" aria-label="Scene to scene">' +
            (pv
              ? '<button data-nav="-1" title="Previous scene (Alt+Page Up)">← ' +
                esc(m.scenes[pv.id].title) +
                '</button>'
              : '') +
            (nx
              ? '<button class="nx" data-nav="1" title="Next scene (Alt+Page Down)">' +
                esc(m.scenes[nx.id].title) +
                ' →</button>'
              : '') +
            '</nav>'
        : '';
    })() +
    '<p class="hint" id="sceneHint">Highlighted names are linked. Click one to open its page, or move through it with the arrow keys to edit.</p>' +
    (LOOK.peek !== false
      ? '<div class="peek" id="peek"><div class="peek-b" id="peekB" role="status" hidden></div><button class="peek-pet" id="peekPet" aria-label="' +
        esc(m.pet.name) +
        ' is reading along"></button></div>'
      : '');
  const ed = $('#ed');
  ed.innerHTML = renderText(d.text);
  ed.setAttribute('contenteditable', 'true');
  // Bold and italic as <b>/<i>, not style attributes. A setting of the whole page, so once is enough (it costs a layout).
  if (!ui.swcSet)
    try {
      document.execCommand('styleWithCSS', false, false);
      ui.swcSet = true;
    } catch (e) {}
  ed.style.fontSize = ui.fs + 'px';
  let comp = false;
  const typed = () => {
    if (comp) return;
    onType(v.id, ed);
  };
  ed.addEventListener('input', typed);
  ed.addEventListener('compositionstart', () => {
    comp = true;
  });
  ed.addEventListener('compositionend', () => {
    comp = false;
    typed();
  });
  ed.addEventListener('paste', e => {
    // pasted text arrives plain, line by line (Enter makes a line break, never a new block)
    e.preventDefault();
    ui.bigEdit = true;
    const t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r\n?/g, '\n');
    t.split('\n').forEach((ln, i) => {
      if (i) document.execCommand('insertLineBreak');
      if (ln) document.execCommand('insertText', false, ln);
    });
    typed();
  });
  ed.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      let lead = ''; // a new line keeps the indent of the one before
      if (LOOK.keepIndent !== false) {
        const sl = edSel(ed);
        if (sl) {
          const vis = plainText(getText(ed));
          lead = (vis.slice(vis.lastIndexOf('\n', sl.s - 1) + 1).match(/^\t+/) || [''])[0];
        }
      }
      document.execCommand('insertLineBreak');
      if (lead) document.execCommand('insertText', false, lead);
      return;
    }
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      edIndent(e.shiftKey ? -1 : 1);
      return;
    }
    const mod = (e.ctrlKey || e.metaKey) && !e.altKey,
      kk = e.key.toLowerCase();
    if (mod && (kk === 'z' || kk === 'y')) {
      e.preventDefault();
      ui.keyHistAt = Date.now();
      edHist(kk === 'y' || e.shiftKey);
      return;
    }
    const k =
      (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey
        ? { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]
        : null;
    if (k) {
      e.preventDefault();
      fmtCmd(k);
    }
  });
  ed.addEventListener('beforeinput', e => {
    // undo from a menu; smart quotes, dashes and ellipses
    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
      e.preventDefault();
      if (Date.now() - (ui.keyHistAt || 0) > 300) {
        ui.keyHistAt = Date.now();
        edHist(e.inputType === 'historyRedo');
      }
      return;
    }
    if (LOOK.smart === false || e.inputType !== 'insertText' || !e.data || e.data.length !== 1) return;
    const sel = getSelection();
    if (!sel.rangeCount || !ed.contains(sel.anchorNode)) return;
    const pre = document.createRange();
    pre.selectNodeContents(ed);
    pre.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    const pre2 = pre.toString().slice(-2),
      before = pre2.slice(-1),
      opening = !before || /[\s(\[{\u2014\u2013-]/.test(before);
    let rep = null;
    if (e.data === '"') rep = opening ? '\u201C' : '\u201D';
    else if (e.data === "'") rep = opening ? '\u2018' : '\u2019';
    else if (e.data === '-' && before === '-' && sel.isCollapsed) {
      e.preventDefault();
      document.execCommand('delete');
      document.execCommand('insertText', false, '\u2014');
      return;
    } else if (e.data === '.' && pre2 === '..' && sel.isCollapsed) {
      e.preventDefault();
      document.execCommand('delete');
      document.execCommand('delete');
      document.execCommand('insertText', false, '\u2026');
      return;
    }
    if (rep) {
      e.preventDefault();
      document.execCommand('insertText', false, rep);
    }
  });
  ed.addEventListener('click', e => {
    const t = e.target.closest('.ent');
    if (t && getSelection().isCollapsed) go({ k: 'ent', id: t.dataset.ent });
  });
  const moved = () => {
    clearTimeout(ui.pkM);
    ui.pkM = setTimeout(() => peekRun('move'), 900);
  }; // Inky re-reads where the caret now is
  ed.addEventListener('mouseup', moved);
  ed.addEventListener('keyup', e => {
    if (/^(Arrow|Page|Home|End)/.test(e.key)) {
      moved();
      followCaret();
    }
  });
  const pp = $('#peekPet');
  if (pp) {
    pp.addEventListener('click', () => {
      const b = $('#peekB');
      b.textContent = ui.say || line(curMood());
      b.hidden = !b.hidden;
    });
    paintPet(true);
  }
  const fresh = ui.pkOpen !== v.id;
  ui.pkOpen = v.id;
  setTimeout(() => {
    if (ui.view === v) peekRun(fresh ? 'open' : 'move');
  }, 350);
  const tt = $('#sceneTitle');
  tt.addEventListener('input', () => {
    S.meta.scenes[v.id].title = tt.value || 'Untitled scene';
    dirty('meta');
    renderBinder();
  });
  $('#sceneStatus').addEventListener('change', e => {
    S.meta.scenes[v.id].status = e.target.value;
    dirty('meta');
    renderBinder();
    if (e.target.value === 'final') sceneFinal(v.id);
    else checkAch();
  });
  $('#focusBtn').addEventListener('click', () => {
    ui.focus = !ui.focus;
    syncTab();
    renderMain();
  });
  $('#snBtn').addEventListener('click', () => go({ k: 'snap', id: v.id }));
  $('#spBtn').addEventListener('click', () => {
    if (ui.split) splitClose();
    else splitOpen();
  });
  paintSplitBtn();
  $('#stkBtn').addEventListener('click', () => stkAdd(v.id));
  stkBind(v.id);
  el.querySelectorAll('.fb').forEach(b => {
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => {
      if (document.activeElement !== ed) ed.focus();
      const a = b.dataset.ed;
      if (a === 'undo' || a === 'redo') edHist(a === 'redo');
      else if (a) edIndent(a === 'in' ? 1 : -1);
      else fmtCmd(b.dataset.fmt);
    });
  });
  const ra = $('#raBtn');
  if (ra) {
    raPaint();
    ra.addEventListener('mousedown', e => e.preventDefault());
    ra.addEventListener('click', readAloud);
  }
  {
    const h = undoOf(v.id);
    if (h.cur.text !== d.text) {
      h.undo.push(h.cur);
      h.redo = [];
      h.cur = { text: d.text };
      h.big = true;
    }
  } // changed elsewhere (a restore, a co-writer): one more undo step
  paintSceneWc();
  const fs = n => {
    ui.fs = Math.max(14, Math.min(28, ui.fs + n));
    ed.style.fontSize = ui.fs + 'px';
    try {
      localStorage.setItem('inkling:fs', ui.fs);
    } catch (e) {}
  };
  $('#fsDn').addEventListener('click', () => fs(-1));
  $('#fsUp').addEventListener('click', () => fs(1));
  const bn = $('#bnX');
  if (bn)
    bn.addEventListener('click', () => {
      m.sample = false;
      dirty('meta');
      renderMain();
    });
  $('#mkBtn').addEventListener('mousedown', e => e.preventDefault());
  $('#mkBtn').addEventListener('click', () => {
    const pop = $('#mkPop');
    if (!pop.hidden) {
      pop.hidden = true;
      return;
    }
    const txt = ui.sel;
    if (!txt) {
      toast('Select a name in your text first, then choose Link selection.', { plain: true });
      return;
    }
    pop.innerHTML =
      '<div class="pt">Make a page for “' +
      esc(txt.slice(0, 40)) +
      '” as</div>' +
      TYPE_ORDER.map(
        t => '<button data-t="' + t + '"><i class="pip t-' + t + '"></i><span>' + esc(LS(t)) + '</span></button>'
      ).join('');
    pop.hidden = false;
  });
  $('#mkPop').addEventListener('click', e => {
    const b = e.target.closest('button[data-t]');
    if (!b) return;
    $('#mkPop').hidden = true;
    const name = ui.sel.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name) return;
    const exist = Object.values(S.meta.ents).find(x => x.name === name || (x.aliases || []).includes(name));
    if (exist) {
      toast(name + ' already has a page.', { plain: true });
      relinkEditor(true);
      return;
    }
    addEntity(b.dataset.t, name);
    renderBinder();
    relinkEditor(true);
    toast('Linked ' + name + ' as a ' + LS(b.dataset.t).toLowerCase() + '. Click it to open its page.', {
      plain: true
    });
  });
  updateSceneChips();
  const fsel = ui.findSel;
  ui.findSel = null;
  ui.selDone = !!(fsel && fsel.id === v.id) || !!v.flash;
  if (fsel && fsel.id === v.id) {
    ed.focus();
    selectRange(ed, fsel.s, fsel.e);
  }
}
/* ---------- editing: undo and redo, indents, reading aloud, typewriter scrolling ---------- */
// Inkling keeps its own undo history per scene (the editor's own one is lost whenever names are relinked). Typing is
// grouped into steps at pauses of a second or more; pastes, formatting and indents are steps of their own. Offsets
// here are in the visible text with its line breaks (edSel); right after renderText() they match the DOM's offsets.
const UNDO = {};
// A scene's undo history, started from its current text.
function undoOf(id) {
  return UNDO[id] || (UNDO[id] = { cur: { text: S.sc[id].text }, undo: [], redo: [], at: 0, big: false });
}
// Records the scene's text for undo: a new step after a pause in typing (or for big changes), otherwise part of the
// current step.
function undoNote(id, text, big) {
  const h = undoOf(id),
    now = Date.now();
  if (text === h.cur.text) return;
  if (big || h.big || now - h.at > 1000 || Math.abs(text.length - h.cur.text.length) > 2) {
    h.undo.push(h.cur);
    if (h.undo.length > 300) h.undo.shift();
  }
  h.redo = [];
  h.cur = { text };
  h.at = now;
  h.big = !!big;
}
// A DOM position in the editor as a position in its visible text (line breaks counted).
function visAt(ed, node, off) {
  const rg = document.createRange();
  rg.selectNodeContents(ed);
  rg.setEnd(node, off);
  const d = document.createElement('div');
  d.appendChild(rg.cloneContents());
  return plainText(getText(d)).length;
}
// The editor's selection as {s, e} in its visible text, or null.
function edSel(ed) {
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return null;
  const r = s.getRangeAt(0);
  return { s: visAt(ed, r.startContainer, r.startOffset), e: visAt(ed, r.endContainer, r.endOffset) };
}
// Undo (or redo with redo = true) in the open scene.
function edHist(redo) {
  const v = ui.view,
    ed = $('#ed');
  if (!v || v.k !== 'scene' || !ed) return;
  const h = undoOf(v.id),
    now = getText(ed);
  if (now !== h.cur.text) undoNote(v.id, now, true);
  const from = redo ? h.redo : h.undo,
    to = redo ? h.undo : h.redo;
  if (!from.length) {
    toast(redo ? 'Nothing to redo.' : 'Nothing more to undo in this scene.', { plain: true });
    return;
  }
  const old = h.cur.text;
  to.push(h.cur);
  h.cur = from.pop();
  h.at = 0;
  h.big = true;
  const a = plainText(old),
    b = plainText(h.cur.text);
  let p = 0,
    q = 0; // put the caret at the end of what changed
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  setSceneText(v.id, h.cur.text);
  ed.innerHTML = renderText(h.cur.text);
  ed.focus();
  setCaret(ed, b.length - q);
  const bw = document.querySelector('[data-wc="' + v.id + '"]');
  if (bw) bw.textContent = fmt(S.meta.scenes[v.id].words);
  paintSceneWc();
  updateStats();
  updateSceneChips();
  clearTimeout(ui.pkM);
  ui.pkM = setTimeout(() => peekRun('move'), 900);
}
// Puts new text in the editor with a selection, then saves it like typing (one undo step, no new words credited).
function edApply(id, ed, text, s, e) {
  ed.innerHTML = renderText(text);
  selectRange(ed, s, e);
  ui.bigEdit = true;
  onType(id, ed);
}
// Tab: a tab at the caret, or every selected line indented. Shift+Tab: one tab off the start of each line.
function edIndent(dir) {
  const v = ui.view,
    ed = $('#ed');
  if (!ed || !v || v.k !== 'scene') return;
  if (document.activeElement !== ed) ed.focus();
  const sel = edSel(ed);
  if (!sel) return;
  if (dir > 0 && sel.s === sel.e) {
    document.execCommand('insertText', false, '\t');
    return;
  }
  const text = getText(ed),
    vis = plainText(text),
    lines = text.split('\n');
  const l0 = vis.slice(0, sel.s).split('\n').length - 1,
    end = sel.e > sel.s && vis[sel.e - 1] === '\n' ? sel.e - 1 : sel.e,
    l1 = vis.slice(0, end).split('\n').length - 1;
  let ds = 0,
    de = 0;
  for (let i = l0; i <= l1; i++) {
    if (dir > 0) {
      lines[i] = '\t' + lines[i];
      de++;
      if (i === l0) ds = 1;
    } else if (lines[i].startsWith('\t')) {
      lines[i] = lines[i].slice(1);
      de--;
      if (i === l0) ds = -1;
    }
  }
  if (!de) return;
  const ls = vis.lastIndexOf('\n', sel.s - 1) + 1;
  edApply(v.id, ed, lines.join('\n'), Math.max(ls, sel.s + ds), Math.max(ls, sel.e + de));
}
// Words in the scene, and in the selection when there is one.
function paintSceneWc() {
  const v = ui.view,
    el = $('#sceneWc');
  if (!el || !v || v.k !== 'scene' || !S.meta.scenes[v.id]) return;
  const w = S.meta.scenes[v.id].words,
    s = getSelection(),
    ed = $('#ed');
  let n = 0;
  if (ed && s.rangeCount && !s.isCollapsed && ed.contains(s.anchorNode) && ed.contains(s.focusNode))
    n = wc(s.toString());
  const g = S.meta.scenes[v.id].goal,
    txt = fmt(w) + (g ? ' of ' + fmt(g) : '') + ' words' + (n ? ' · ' + fmt(n) + ' selected' : '');
  if (el.textContent === txt) return; // runs on every keystroke: touch the page only when the count changes
  el.textContent = txt;
  el.classList.toggle('met', !!g && w >= g);
  el.title =
    'About ' +
    Math.max(1, Math.round(w / 250)) +
    ' manuscript page' +
    (Math.round(w / 250) > 1 ? 's' : '') +
    ' and ' +
    Math.max(1, Math.round(w / 230)) +
    ' minute' +
    (Math.round(w / 230) > 1 ? 's' : '') +
    ' to read';
}
// Where the caret is on screen. A new empty line has no box of its own, so a moment's marker is measured instead.
function caretRect() {
  const s = getSelection();
  if (!s.rangeCount) return null;
  const r = s.getRangeAt(0),
    rc = r.getClientRects()[0];
  if (rc && rc.height) return rc;
  if (!r.collapsed) return null;
  const m = document.createElement('span');
  m.textContent = '\u200b';
  r.insertNode(m);
  const b = m.getBoundingClientRect(),
    par = m.parentNode,
    i = [...par.childNodes].indexOf(m);
  m.remove();
  const nr = document.createRange();
  nr.setStart(par, i);
  nr.collapse(true);
  s.removeAllRanges();
  s.addRange(nr);
  return b;
}
// Keeps the caret on screen while writing: once it gets near the bottom (or under a phone's keyboard) the page
// scrolls up with it. With typewriter scrolling (Settings › Writing) the line stays in the middle instead.
function followCaret() {
  const main = $('#main'),
    ed = $('#ed'),
    s = getSelection();
  if (!main || !ed || !s.rangeCount || !ed.contains(s.focusNode)) return;
  const rc = caretRect();
  if (!rc) return;
  const mr = main.getBoundingClientRect(),
    vv = window.visualViewport,
    top = Math.max(mr.top, vv ? vv.offsetTop : 0),
    bot = Math.min(mr.bottom, vv ? vv.offsetTop + vv.height : innerHeight);
  if (LOOK.typewriter) {
    const d = rc.top - (top + (bot - top) * 0.45);
    if (Math.abs(d) > 6) main.scrollTop += d;
    return;
  }
  const pad = Math.min(140, (bot - top) * 0.25);
  if (rc.bottom > bot - pad) main.scrollTop += rc.bottom - (bot - pad);
  else if (rc.top < top + 24) main.scrollTop -= top + 24 - rc.top;
}
// Read aloud: the selection, or from the caret's paragraph to the end, one paragraph at a time, each one
// highlighted while it is read (CSS custom highlights, where the browser has them).
const canSpeak = () => !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
// Shows whether reading aloud is on, on its button.
function raPaint() {
  const b = $('#raBtn');
  if (b) {
    b.innerHTML = ico(ui.ra ? 'stop' : 'speak') + '<span>' + (ui.ra ? 'Stop reading' : 'Read aloud') + '</span>';
    b.setAttribute('aria-pressed', ui.ra ? 'true' : 'false');
  }
}
// Stops reading aloud.
function raStop() {
  if (!ui.ra) return;
  ui.ra = false;
  try {
    speechSynthesis.cancel();
  } catch (e) {}
  try {
    if (window.CSS && CSS.highlights) CSS.highlights.delete('inkread');
  } catch (e) {}
  raPaint();
}
// Highlights the words being read aloud.
function raMark(ed, a, z) {
  if (!window.Highlight || !window.CSS || !CSS.highlights || !ed.isConnected) return;
  const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT),
    r = document.createRange();
  let n,
    acc = 0,
    ok = 0;
  while ((n = w.nextNode())) {
    const l = n.nodeValue.length;
    if (!ok && acc + l > a) {
      r.setStart(n, a - acc);
      ok = 1;
    }
    if (ok && acc + l >= z) {
      r.setEnd(n, z - acc);
      ok = 2;
      break;
    }
    acc += l;
  }
  if (ok < 2) return;
  CSS.highlights.set('inkread', new Highlight(r));
  const b = r.getBoundingClientRect();
  if (b.top < 80 || b.bottom > innerHeight - 80)
    (r.startContainer.parentElement || ed).scrollIntoView({ block: 'center' });
}
// Reads the selection aloud, or from the caret's paragraph to the end, one paragraph at a time.
function readAloud() {
  if (!canSpeak()) return;
  if (ui.ra) {
    raStop();
    return;
  }
  const ed = $('#ed');
  if (!ed) return;
  const sel = edSel(ed);
  relinkEditor(true); // fresh from the stored text, so visible offsets are DOM offsets
  const vis = plainText(getText(ed));
  let s = 0,
    e = vis.length;
  if (sel && sel.e > sel.s) {
    s = sel.s;
    e = sel.e;
  } else if (sel && sel.s < vis.length) s = vis.lastIndexOf('\n', sel.s - 1) + 1;
  const parts = [];
  for (let i = s; i < e; ) {
    let j = vis.indexOf('\n', i);
    if (j < 0 || j > e) j = e;
    if (vis.slice(i, j).trim()) parts.push([i, j]);
    i = j + 1;
  }
  if (!parts.length) {
    toast('Nothing to read here yet.', { plain: true });
    return;
  }
  ui.ra = true;
  raPaint();
  try {
    speechSynthesis.cancel();
  } catch (x) {}
  parts.forEach(([a, z], k) => {
    const u = new SpeechSynthesisUtterance(vis.slice(a, z).replace(/\t/g, ' '));
    u.rate = +LOOK.raRate || 1;
    u.onstart = () => {
      if (ui.ra) raMark(ed, a, z);
    };
    if (k === parts.length - 1) {
      u.onend = raStop;
      u.onerror = raStop;
    }
    speechSynthesis.speak(u);
  });
}
// The shortcut key name for this computer: ⌘ on a Mac, Ctrl elsewhere.
const MODK = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
// The keyboard shortcuts dialog.
function showKeys() {
  const k = s =>
      s
        .split('+')
        .map(x => '<kbd>' + esc(x === 'Mod' ? MODK : x) + '</kbd>')
        .join('+'),
    row = (a, b) => '<span class="kr"><span>' + b + '</span><span>' + k(a) + '</span></span>';
  ask(
    'Keyboard shortcuts',
    '<span class="keys">' +
      '<b>Writing</b>' +
      row('Mod+B', 'Bold') +
      row('Mod+I', 'Italic') +
      row('Mod+U', 'Underline') +
      row('Mod+Z', 'Undo') +
      row(MODK === '⌘' ? 'Mod+Shift+Z' : 'Mod+Y', 'Redo') +
      row('Tab', 'Indent (with lines selected: indent them all)') +
      row('Shift+Tab', 'Remove an indent') +
      row('Enter', 'New line (keeps the indent)') +
      row('Mod+F', 'Find and replace') +
      row('Mod+S', 'Save now') +
      '<b>Window</b>' +
      row('Mod+Shift+1', 'Show or hide the binder') +
      row('Mod+Shift+2', 'Show or hide the Inkling panel') +
      row('Mod+Shift+3', 'Focus mode') +
      row('Esc', 'Leave focus mode') +
      '<b>As you type</b><span class="kr"><span>"quotes" become “curly”, -- becomes —, ... becomes …</span><span></span></span></span>',
    [['ok', 'Close', 'pri']]
  );
}

/* ---------- sticky notes beside the page ---------- */
// sc[id].stickies = [{id, text, color, side:'l'|'r', y}] (y: pixels from the top of the page). Shown in the margins
// when there is room for them; otherwise as small coloured tabs on the page edge that open when clicked.
const STK_COLORS = ['thing', 'char', 'accent', 'place'],
  STK_W = 172;
// Checks a scene's sticky notes.
function normStickies(a) {
  return (Array.isArray(a) ? a : [])
    .filter(x => x && x.id)
    .slice(0, 200)
    .map(x => ({
      id: String(x.id),
      text: String(x.text || '').slice(0, 4000),
      color: STK_COLORS.includes(x.color) ? x.color : 'thing',
      side: x.side === 'l' ? 'l' : 'r',
      y: Math.max(0, Math.round(+x.y || 0))
    }));
}
// Where the margins are, beside the page, and whether notes fit in them or fold into tabs.
function stkGeo() {
  const w = $('#sheetWrap'),
    sh = w && $('.sheet', w);
  if (!sh) return null;
  const W = w.clientWidth,
    L = sh.offsetLeft,
    R = W - (sh.offsetLeft + sh.offsetWidth);
  return {
    w,
    sh,
    top: sh.offsetTop,
    h: sh.offsetHeight,
    L,
    R,
    left: L,
    right: sh.offsetLeft + sh.offsetWidth,
    roomL: L >= STK_W + 20,
    roomR: R >= STK_W + 20
  };
}
// Draws a scene's sticky notes in the margins (or as tabs on the page edge when the margins are narrow).
function stkDraw(sid) {
  const lay = $('#stkLayer'),
    g = stkGeo(),
    d = S.sc[sid];
  if (!lay || !g || !d) return;
  if (!d.stickies) d.stickies = [];
  const open = ui.stkOpen;
  lay.innerHTML = d.stickies
    .map(n => {
      const room = n.side === 'l' ? g.roomL : g.roomR,
        big = room || open === n.id,
        top = g.top + Math.min(n.y, Math.max(0, g.h - 40));
      const x = room
        ? n.side === 'l'
          ? g.left - STK_W - 10
          : g.right + 10
        : n.side === 'l'
          ? g.left + 6
          : g.right - 6 - (big ? STK_W : 22);
      return (
        '<div class="stk c-' +
        n.color +
        (big ? '' : ' tab') +
        (room ? '' : ' over') +
        '" data-id="' +
        n.id +
        '" style="top:' +
        top +
        'px;left:' +
        x +
        'px' +
        (big ? ';width:' + STK_W + 'px' : '') +
        '">' +
        (big
          ? '<div class="stk-h" title="Drag to move"><span class="stk-sw">' +
            STK_COLORS.map(
              c =>
                '<button class="sw c-' +
                c +
                (c === n.color ? ' on' : '') +
                '" data-sk="color" data-c="' +
                c +
                '" aria-label="Colour"></button>'
            ).join('') +
            '</span>' +
            (room
              ? ''
              : '<button class="ibtn" data-sk="fold" aria-label="Fold away" title="Fold away">' +
                ico(n.side === 'l' ? 'back' : 'right', 13) +
                '</button>') +
            '<button class="ibtn" data-sk="del" aria-label="Delete note" title="Delete note">' +
            (ui.confirm === 'stk' + n.id ? 'Delete?' : ico('x', 13)) +
            '</button></div>' +
            '<textarea data-sk="text" rows="2" placeholder="Note to self…" aria-label="Sticky note">' +
            esc(n.text) +
            '</textarea>'
          : '<button class="stk-tab" data-sk="open" title="' +
            esc(n.text.slice(0, 80) || 'Sticky note') +
            '" aria-label="Open sticky note: ' +
            esc(n.text.slice(0, 60)) +
            '"></button>') +
        '</div>'
      );
    })
    .join('');
  lay.querySelectorAll('textarea').forEach(ag);
}
// Adds a sticky note in a margin at a height on the page.
function stkAdd(sid, side, y) {
  const d = S.sc[sid],
    g = stkGeo();
  if (!d || !g) return;
  const main = $('#main');
  if (!d.stickies) d.stickies = [];
  if (y == null) y = Math.max(0, (main ? main.scrollTop : 0) - g.top + 80);
  if (!side) side = g.roomR || !g.roomL ? 'r' : 'l';
  const n = {
    id: uid('k_'),
    text: '',
    color: STK_COLORS[d.stickies.length % STK_COLORS.length],
    side,
    y: Math.round(y)
  };
  d.stickies.push(n);
  dirty('sc_' + sid);
  ui.stkOpen = n.id;
  stkDraw(sid);
  const t = $('#stkLayer .stk[data-id="' + n.id + '"] textarea');
  if (t) t.focus();
}
// Makes sticky notes work: add (button or double-click in a margin), edit, recolour, delete and drag.
function stkBind(sid) {
  const wrap = $('#sheetWrap'),
    lay = $('#stkLayer');
  if (!wrap) return;
  const D = () => S.sc[sid] || { stickies: [] },
    find = id => D().stickies.find(x => x.id === id); // looked up each time: a merge may replace the record
  ui.stkOpen = null;
  stkDraw(sid);
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      if (!wrap.isConnected) {
        ro.disconnect();
        return;
      }
      stkDraw(sid);
    });
    ro.observe(wrap);
  }
  wrap.addEventListener('dblclick', e => {
    if (e.target.closest('.sheet,.stk')) return;
    const g = stkGeo(),
      r = wrap.getBoundingClientRect(),
      x = e.clientX - r.left;
    stkAdd(sid, x < g.left + (g.right - g.left) / 2 ? 'l' : 'r', e.clientY - r.top - g.top - 12);
  });
  lay.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.sk !== 'text') return;
    ag(t);
    const n = find(t.closest('.stk').dataset.id);
    if (n) {
      n.text = t.value;
      dirty('sc_' + sid);
    }
  });
  lay.addEventListener('click', e => {
    const b = e.target.closest('[data-sk]');
    if (!b || b.tagName === 'TEXTAREA') return;
    const n = find(b.closest('.stk').dataset.id);
    if (!n) return;
    const a = b.dataset.sk;
    if (a === 'open') {
      ui.stkOpen = n.id;
      stkDraw(sid);
      const t = $('#stkLayer .stk[data-id="' + n.id + '"] textarea');
      if (t) t.focus();
    } else if (a === 'fold') {
      ui.stkOpen = null;
      stkDraw(sid);
    } else if (a === 'color') {
      n.color = b.dataset.c;
      dirty('sc_' + sid);
      stkDraw(sid);
    } else if (a === 'del') {
      if (!n.text.trim() || ui.confirm === 'stk' + n.id) {
        ui.confirm = null;
        D().stickies = D().stickies.filter(x => x.id !== n.id);
        dirty('sc_' + sid);
        stkDraw(sid);
      } else {
        ui.confirm = 'stk' + n.id;
        stkDraw(sid);
        setTimeout(() => {
          if (ui.confirm === 'stk' + n.id) {
            ui.confirm = null;
            stkDraw(sid);
          }
        }, 3000);
      }
    }
  });
  document.addEventListener('pointerdown', function off(e) {
    if (!wrap.isConnected) {
      document.removeEventListener('pointerdown', off);
      return;
    }
    if (ui.stkOpen && !e.target.closest('.stk')) {
      const g = stkGeo(),
        n = find(ui.stkOpen);
      if (n && !(n.side === 'l' ? g.roomL : g.roomR)) {
        ui.stkOpen = null;
        stkDraw(sid);
      }
    }
  });
  // drag a note by its top strip (or a folded tab): up and down the page, and across to the other margin
  lay.addEventListener('pointerdown', e => {
    const h = e.target.closest('.stk-h,.stk.tab');
    if (!h || e.target.closest('button:not(.stk-tab)')) return;
    const el = h.closest('.stk'),
      n = find(el.dataset.id);
    if (!n) return;
    const x0 = e.clientX,
      y0 = e.clientY,
      top0 = el.offsetTop,
      left0 = el.offsetLeft;
    let moved = false;
    const mv = m => {
      if (!moved && Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return;
      if (!moved) {
        moved = true;
        el.classList.add('moving');
      }
      m.preventDefault();
      el.style.top = top0 + m.clientY - y0 + 'px';
      el.style.left = left0 + m.clientX - x0 + 'px';
    };
    const up = m => {
      document.removeEventListener('pointermove', mv);
      document.removeEventListener('pointerup', up);
      if (!moved) return;
      document.addEventListener(
        'click',
        ev => {
          ev.stopPropagation();
          ev.preventDefault();
        },
        { capture: true, once: true }
      );
      setTimeout(() => document.dispatchEvent(new Event('click')), 0);
      const g = stkGeo(),
        r = wrap.getBoundingClientRect(),
        cx = m.clientX - r.left;
      n.side = cx < g.left + (g.right - g.left) / 2 ? 'l' : 'r';
      n.y = Math.max(0, Math.round(top0 + m.clientY - y0 - g.top));
      dirty('sc_' + sid);
      stkDraw(sid);
    };
    document.addEventListener('pointermove', mv);
    document.addEventListener('pointerup', up);
  });
}
// Bold, italic or underline from a button or shortcut: one undo step.
function fmtCmd(cmd) {
  ui.bigEdit = true;
  document.execCommand(cmd);
  const ed = $('#ed');
  if (ed) ed.dispatchEvent(new Event('input', { bubbles: true }));
}
// Selects visible-text positions s to e in an element.
function selectRange(el, s, e) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT),
    r = document.createRange();
  let n,
    acc = 0,
    ok = 0;
  while ((n = w.nextNode())) {
    const l = n.nodeValue.length;
    if (!ok && acc + l >= s) {
      r.setStart(n, s - acc);
      ok = 1;
    }
    if (ok && acc + l >= e) {
      r.setEnd(n, e - acc);
      ok = 2;
      break;
    }
    acc += l;
  }
  if (ok < 2) return;
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  const b = r.getBoundingClientRect(),
    sc = el.closest('.main') || document.scrollingElement;
  if (b.top < 80 || b.bottom > innerHeight - 80)
    (r.startContainer.parentElement || el).scrollIntoView({ block: 'center' });
}
// Runs after every change in the editor: saves the text, credits new words, takes the day's first snapshot, updates
// counts, name links and targets, lets Inky read, and keeps the caret in view.
function onType(id, ed) {
  snDaily(id);
  const text = getText(ed),
    sc = S.meta.scenes[id],
    d = S.sc[id],
    ch = S.meta.chapters.find(c => c.scenes.includes(id)),
    cw = c => c.scenes.reduce((a, x) => a + ((S.meta.scenes[x] || {}).words || 0), 0),
    cw0 = ch ? cw(ch) : 0;
  d.text = text;
  const w = wc(text),
    delta = w - sc.words,
    k0 = Math.floor(sc.words / 1000),
    w0 = sc.words;
  sc.words = w;
  if (delta > 0 && delta <= 600) {
    // word targets reached
    if (sc.goal && w0 < sc.goal && w >= sc.goal)
      cheer('“' + trunc(sc.title, 30) + '” reached its ' + fmt(sc.goal) + '-word target!');
    else if (ch && ch.goal && cw0 < ch.goal && cw(ch) >= ch.goal)
      cheer('“' + trunc(ch.title, 30) + '” reached its ' + fmt(ch.goal) + '-word target!', true);
  }
  if (ch) {
    const cc = document.querySelector('[data-cwc="' + ch.id + '"]');
    if (cc) {
      cc.textContent = fmt(cw(ch));
      const tb = cc.nextElementSibling;
      if (tb && tb.classList.contains('tg')) tb.outerHTML = tgBar(cw(ch), ch.goal);
    }
  }
  {
    const sb = document.querySelector('.sc-btn[data-id="' + id + '"] .tg');
    if (sb) sb.outerHTML = tgBar(w, sc.goal);
  }
  if (delta > 0 && delta <= 600 && w >= 1000 && Math.floor(w / 1000) > k0)
    say(
      pick([
        'This scene just passed ' + fmt(Math.floor(w / 1000) * 1000) + ' words.',
        '“' + trunc(sc.title, 30) + '” is up to ' + fmt(Math.floor(w / 1000) * 1000) + ' words!'
      ])
    );
  if (T.cur && T.running) T.cur.scenes.add(id);
  dirty('sc_' + id, 'meta');
  undoNote(id, text, ui.bigEdit);
  ui.bigEdit = false;
  raStop();
  paintSceneWc();
  followCaret();
  const bw = document.querySelector('[data-wc="' + id + '"]');
  if (bw) bw.textContent = fmt(w);
  credit(delta);
  updateStats();
  clearTimeout(ui.rl);
  ui.rl = setTimeout(() => relinkEditor(false), 500);
  if (LOOK.peek !== false) {
    clearTimeout(ui.pkM);
    clearTimeout(ui.pkT);
    ui.pkT = setTimeout(() => peekRun('type'), Date.now() - (ui.pkAt || 0) > 6000 ? 150 : 1100);
  }
}
// The "Linked in this scene" list in the Inkling panel: every story page named in the scene.
function updateSceneChips() {
  const box = $('#sceneChips');
  if (!box || ui.view.k !== 'scene') return;
  const ed = $('#ed'),
    text = plainText(ed ? getText(ed) : (S.sc[ui.view.id] || {}).text || '');
  const seen = [];
  findLinks(text).forEach(l => {
    if (!seen.includes(l.id)) seen.push(l.id);
  });
  box.innerHTML = seen.length
    ? seen
        .map(id => {
          const e = S.meta.ents[id];
          return (
            '<button class="cl t-' +
            e.type +
            '" data-ent="' +
            id +
            '"><i class="pip"></i><span class="nm">' +
            esc(e.name) +
            '</span></button>'
          );
        })
        .join('')
    : '<span class="muted" style="font-size:12.5px">No linked names in this scene yet.</span>';
}
