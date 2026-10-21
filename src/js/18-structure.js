/*
 * 18-structure.js: Adding, moving and deleting scenes, chapters, story pages and documents
 *
 * The operations behind the binder's buttons and menus. Every delete goes to the Trash first (trashPut), so it can be
 * undone.
 */
// Adds an empty scene to a chapter (the last one if none is given) and opens it if asked.
function addScene(chId, thenOpen) {
  const m = S.meta,
    ch = m.chapters.find(c => c.id === chId) || m.chapters[m.chapters.length - 1];
  const id = uid('s_');
  m.scenes[id] = { title: 'Untitled scene', status: 'draft', words: 0 };
  S.sc[id] = { text: '', synopsis: '', notes: '' };
  ch.scenes.push(id);
  ch.open = true;
  dirty('meta', 'sc_' + id);
  if (thenOpen) {
    go({ k: 'scene', id });
    const ed = $('#ed');
    if (ed) ed.focus();
  } else {
    renderBinder();
    renderMain();
  }
}
// Adds a chapter with one empty scene.
function addChapter() {
  const m = S.meta,
    id = uid('c_');
  m.chapters.push({ id, title: 'Chapter ' + (m.chapters.length + 1), open: true, scenes: [] });
  S.ch[id] = { notes: '' };
  dirty('meta');
  addScene(id, true);
  say(pick(['A new chapter begins!', 'Chapter ' + m.chapters.length + '. Turning the page!']));
}
// Moves a scene up or down one place, across chapters at their edges.
function moveScene(id, dir) {
  const cs = S.meta.chapters;
  let ci = cs.findIndex(c => c.scenes.includes(id));
  if (ci < 0) return;
  const c = cs[ci],
    i = c.scenes.indexOf(id);
  if (dir < 0) {
    if (i > 0) {
      c.scenes.splice(i, 1);
      c.scenes.splice(i - 1, 0, id);
    } else if (ci > 0) {
      c.scenes.splice(i, 1);
      cs[ci - 1].scenes.push(id);
      cs[ci - 1].open = true;
    } else return;
  } else {
    if (i < c.scenes.length - 1) {
      c.scenes.splice(i, 1);
      c.scenes.splice(i + 1, 0, id);
    } else if (ci < cs.length - 1) {
      c.scenes.splice(i, 1);
      cs[ci + 1].scenes.unshift(id);
      cs[ci + 1].open = true;
    } else return;
  }
  dirty('meta');
  renderBinder();
  if (ui.view.k === 'cork') renderMain();
}
// Moves a chapter up or down one place.
function moveChapter(id, dir) {
  const cs = S.meta.chapters,
    i = cs.findIndex(c => c.id === id),
    j = i + dir;
  if (i < 0 || j < 0 || j >= cs.length) return;
  const t = cs[i];
  cs[i] = cs[j];
  cs[j] = t;
  dirty('meta');
  renderBinder();
  if (ui.view.k === 'cork') renderMain();
}
// Moves a scene (with its snapshots) to the Trash.
function delScene(id) {
  const m = S.meta,
    c = m.chapters.find(x => x.scenes.includes(id));
  if (m.scenes[id])
    trashPut('scene', m.scenes[id].title, c ? c.title : '', {
      id,
      ch: c ? c.id : '',
      i: c ? c.scenes.indexOf(id) : 0,
      meta: bare(m.scenes[id]),
      sc: bare(S.sc[id]),
      sn: snOf(id)
    });
  m.chapters.forEach(c => {
    c.scenes = c.scenes.filter(x => x !== id);
  });
  delete m.scenes[id];
  delete S.sc[id];
  forget('sc_' + id);
  snDrop(id);
  dirty('meta');
  if (!viewValid(ui.view)) ui.view = firstView();
  ui.hist = ui.hist.filter(viewValid);
  renderAll();
}
// Moves a chapter and all its scenes to the Trash.
function delChapter(id) {
  const m = S.meta,
    c = m.chapters.find(x => x.id === id);
  if (!c) return;
  const sc = {};
  c.scenes.forEach(s => {
    if (m.scenes[s]) sc[s] = { meta: bare(m.scenes[s]), sc: bare(S.sc[s]), sn: snOf(s) };
  });
  trashPut('chapter', c.title, c.scenes.length + ' scene' + (c.scenes.length === 1 ? '' : 's'), {
    chap: bare(c),
    i: m.chapters.indexOf(c),
    scenes: sc,
    ch: bare(S.ch[id] || { notes: '' })
  });
  c.scenes.forEach(s => {
    delete m.scenes[s];
    delete S.sc[s];
    forget('sc_' + s);
    snDrop(s);
  });
  delete S.ch[id];
  forget('ch_' + id);
  m.chapters = m.chapters.filter(x => x.id !== id);
  dirty('meta');
  if (!viewValid(ui.view)) ui.view = firstView();
  ui.hist = ui.hist.filter(viewValid);
  renderAll();
}
// Adds a story page of a kind (and shows that kind's binder section if it was hidden). Inky notices.
function addEntity(type, name) {
  const id = uid('e_');
  S.meta.ents[id] = { id, type, name, aliases: [], tag: '' };
  S.en[id] = { fields: {}, pic: normPic() };
  if (!secOn(type)) {
    S.meta.secs[type] = true;
    ui.openSec[type] = true;
  }
  dirty('meta', 'en_' + id);
  linker = buildLinker();
  const fresh = /^New /.test(name);
  say(
    fresh
      ? pick(
          {
            char: [
              'A new character! Give them a name and I will remember it.',
              'Someone new is joining the story. Who are they?'
            ],
            place: [
              'A new place! Where in the world is it?',
              'Somewhere new to explore. Name it and I will keep track.'
            ],
            thing: ['A new thing! Is it magic, or just important?', 'Something new for the story. What is it called?']
          }[type] || ['Something new for the story!']
        )
      : pick(
          {
            char: ['Ooh, who is ' + name + '?', 'Hello, ' + name + '! I will keep an eye on you.'],
            place: [name + '? I want to visit.', 'Adding ' + name + ' to my map.'],
            thing: [name + '… that sounds important.', 'I will remember ' + name + '.']
          }[type] || ['Noted: ' + name + '.']
        )
  );
  setTimeout(checkAch, 0);
  return id;
}
// Moves a story page to the Trash; its bubbles on maps and people in trees stay, unlinked.
function delEntity(id) {
  const e = S.meta.ents[id];
  if (!e) return;
  const links = { rm: {}, ft: {} }; // its picture stays until the Trash lets it go
  Object.keys(S.rm).forEach(k => {
    const n = S.rm[k].nodes.filter(x => x.ent === id).map(x => x.id);
    if (n.length) links.rm[k] = n;
  });
  Object.keys(S.ft).forEach(k => {
    const n = S.ft[k].people.filter(x => x.ent === id).map(x => x.id);
    if (n.length) links.ft[k] = n;
  });
  trashPut('ent', e.name, LS(e.type), { id, meta: bare(e), en: bare(S.en[id]), links });
  unlinkEnt(id);
  delete S.meta.ents[id];
  delete S.en[id];
  forget('en_' + id);
  dirty('meta');
  linker = buildLinker();
  if (!viewValid(ui.view)) ui.view = firstView();
  ui.hist = ui.hist.filter(viewValid);
  renderAll();
}
// Adds an outline, note (a page, a brainstorm board or a world map), relationship map or family tree, and opens it.
function addDocItem(k, kind) {
  const id = uid(k + '_'),
    list = S.meta[k + 's'];
  if (k === 'rm' || k === 'ft') {
    S[k][id] = k === 'rm' ? newRm() : newFt();
    list.push({ id, name: LS(k) + (list.length ? ' ' + (list.length + 1) : '') });
  } else if (k === 'ol') {
    S.ol[id] = {
      num: 'decimal',
      showNotes: true,
      items: [{ id: uid('i_'), text: '', note: '', depth: 0, done: false, open: true, noteOpen: false, scene: '' }]
    };
    list.push({ id, name: LS('ol') + ' ' + (list.length + 1) });
  } else {
    S.nt[id] = Object.assign({ text: '', ideas: [] }, kind === 'map' ? normMap({}) : {});
    list.push({
      id,
      name:
        kind === 'board'
          ? 'Brainstorm ' + (list.filter(x => x.kind === 'board').length + 1)
          : kind === 'map'
            ? 'World map' +
              (list.some(x => x.kind === 'map') ? ' ' + (list.filter(x => x.kind === 'map').length + 1) : '')
            : 'Notes ' + (list.filter(x => x.kind === 'page').length + 1),
      kind
    });
  }
  ui.openSec[k] = true;
  ui.focusName = true;
  dirty('meta', k + '_' + id);
  go({ k, id });
}
// Moves an outline, note, map or tree to the Trash.
function delDocItem(k, id) {
  const list = S.meta[k + 's'],
    it = list.find(x => x.id === id);
  if (it)
    trashPut(
      k,
      it.name,
      k === 'nt' && it.kind === 'board' ? 'Brainstorm' : k === 'nt' && it.kind === 'map' ? 'World map' : LS(k),
      { id, item: bare(it), i: list.indexOf(it), rec: bare(S[k][id]) }
    );
  S.meta[k + 's'] = S.meta[k + 's'].filter(x => x.id !== id);
  delete S[k][id];
  forget(k + '_' + id);
  dirty('meta');
  if (!viewValid(ui.view)) ui.view = firstView();
  ui.hist = ui.hist.filter(viewValid);
  renderAll();
}
// Adds a timeline (a copy of src if given) and opens it.
function addTimeline(src) {
  const id = uid('t_'),
    from = src && S.meta.tls.find(x => x.id === src);
  S.tl[id] = from ? normTl(JSON.parse(JSON.stringify(S.tl[src]))) : normTl(newTl());
  S.meta.tls.push({ id, name: from ? from.name + ' (copy)' : LS('tl') + ' ' + (S.meta.tls.length + 1) });
  ui.openSec.tl = true;
  ui.confirm = null;
  dirty('meta', 'tl_' + id);
  go({ k: 'tl', id });
}
// Moves a timeline to the Trash.
function delTimeline(id) {
  const it = S.meta.tls.find(x => x.id === id);
  if (it) trashPut('tl', it.name, LS('tl'), { id, item: bare(it), i: S.meta.tls.indexOf(it), rec: bare(S.tl[id]) });
  S.meta.tls = S.meta.tls.filter(x => x.id !== id);
  delete S.tl[id];
  forget('tl_' + id);
  dirty('meta');
  if (!viewValid(ui.view)) ui.view = firstView();
  ui.hist = ui.hist.filter(viewValid);
  renderAll();
}
// Two-click confirmation: the first click arms the button (rerender shows "click again"), the second runs fn.
function confirmDo(key, fn, rerender) {
  if (ui.confirm === key) {
    ui.confirm = null;
    fn();
    return;
  }
  ui.confirm = key;
  rerender();
  clearTimeout(ui.ct);
  ui.ct = setTimeout(() => {
    if (ui.confirm === key) {
      ui.confirm = null;
      rerender();
    }
  }, 3200);
}
// Replaces the open project with another (a restore, the sample, a blank one): saves the timer, redraws everything.
function replaceProject(np, keep) {
  pmHalt();
  if (keep) {
    np.meta.goal = S.meta.goal;
    np.meta.pomo = S.meta.pomo;
  } // each project has its own Inky; your goal and timer settings carry over
  const nk = allKeys(np),
    ok = allKeys(S);
  P.keys.forEach(k => ok.add(k));
  ok.forEach(k => {
    if (!nk.has(k)) P.gone.add(k);
  });
  S = np;
  nk.forEach(k => {
    P.dirty.add(k);
    P.gone.delete(k);
  });
  S.meta.saved = Date.now();
  ui.touched = true;
  linker = buildLinker();
  ui.view = firstView();
  ui.hist = [];
  ui.menu = false;
  ui.confirm = null;
  ui.mood = '';
  renderAll();
  schedule(300);
}
