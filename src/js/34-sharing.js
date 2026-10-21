/*
 * 34-sharing.js: Shared projects: merging two writers' work, presence, and setting up sharing
 *
 * Two computers can save one project through a sync folder (Dropbox, Google Drive, OneDrive, iCloud). Saves are
 * compare-and-swap: if the file changed since this computer last read it, the two versions are merged record by
 * record (mergeProjects): a record only one side changed takes that change, a true clash goes to the newer change,
 * and a scene clash keeps the other text as a snapshot. Deletions are known from meta.gone. patchState() then updates
 * the screen in place.
 *
 * Presence: each computer writes a small file saying who has the project open and which scene they are in (hereTick),
 * shown as letters in the binder and a chip in the top bar (paintHere). Setting up: openShare() moves a project into
 * a sync folder, openSharedPick() opens one there, setMyName() sets the writer's name.
 */
// Two computers can save the same project through a sync folder. Instead of one version replacing the other, the two
// are merged record by record: a scene, a story page, a timeline... each is one record with a change stamp (_m) and
// author (_by). PJ.base is the version this computer last read or wrote, so a record that only one side changed is
// taken from that side; a record both sides changed keeps the newer change (for a scene, the other text is saved as a
// snapshot). Deleting wins over an older edit and loses to a newer one (meta.gone holds the deletion times).
function canon(x) {
  return JSON.stringify(x, (k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v)
          .sort()
          .reduce((o, kk) => ((o[kk] = v[kk]), o), {})
      : v
  );
}
// Whether two values are the same, ignoring change stamps.
const same = (a, b) => canon(a) === canon(b);
// A deep copy of a plain value.
const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
// Three-way choice for one value: base, ours, theirs. If only one side changed it, that change wins.
function pick3(b, o, t) {
  if (same(o, t)) return o;
  if (b !== undefined && same(o, b)) return t;
  return o;
} // a true clash keeps ours
function mergeOrder(b, o, t) {
  // lists of ids: keep both sides' additions and removals
  if (same(o, t)) return o.slice();
  if (b && same(o, b)) return t.slice();
  if (b && same(t, b)) return o.slice();
  const B = new Set(b || []),
    T = new Set(t),
    out = o.filter(id => !(B.has(id) && !T.has(id)));
  t.forEach((id, i) => {
    if (out.includes(id) || B.has(id)) return;
    let j = i - 1;
    while (j >= 0 && !out.includes(t[j])) j--;
    out.splice(j < 0 ? 0 : out.indexOf(t[j]) + 1, 0, id);
  });
  return out;
}
// A record's name, for the "merged with…" message.
function recName(p, id, m) {
  if (p === 'sc') return (m.scenes[id] || {}).title;
  if (p === 'en') return (m.ents[id] || {}).name;
  const l = { tl: 'tls', ol: 'ols', nt: 'nts', rm: 'rms', ft: 'fts' }[p];
  if (l) return ((m[l] || []).find(x => x.id === id) || {}).name;
  if (p === 'ch') return ((m.chapters || []).find(x => x.id === id) || {}).title + ' notes';
  return '';
}
// Merges one kind of record (scenes, pages…) three ways, using change times for true clashes and meta.gone for
// deletions.
function mergeRecords(p, b, o, t, goneO, goneT, rep, mo, mt) {
  const out = {};
  new Set([...Object.keys(o), ...Object.keys(t)]).forEach(id => {
    const k = p + '_' + id,
      x = o[id],
      y = t[id],
      z = b ? b[id] : undefined;
    if (x && y) {
      if (same(x, y)) out[id] = x;
      else if (z && same(x, z)) {
        out[id] = y;
        rep.add(p, id, y, mt);
      } else if (z && same(y, z)) out[id] = x;
      else {
        const theirs = (+y._m || 0) > (+x._m || 0);
        out[id] = theirs ? y : x;
        if (theirs) rep.add(p, id, y, mt);
        rep.clash.push({ p, id, win: theirs ? y : x, lose: theirs ? x : y, name: recName(p, id, theirs ? mt : mo) });
      }
    } else if (x) {
      if ((+goneT[k] || 0) > (+x._m || 0)) rep.del(p, id, mo);
      else out[id] = x;
    } // they deleted it after our last change to it
    else if (!((+goneO[k] || 0) >= (+y._m || 0))) {
      out[id] = y;
      rep.add(p, id, y, mt);
    } // new from them (unless we deleted it since)
  });
  return out;
}
// Merges the project's index (meta) field by field, keeping both sides' list order changes.
function mergeMeta(b, o, t) {
  b = b || {};
  const out = clone(o),
    newer = !b._m || (+t._m || 0) > (+b._m || 0);
  const SKIP = [
    'scenes',
    'ents',
    'chapters',
    'tls',
    'ols',
    'nts',
    'rms',
    'fts',
    'gone',
    'saved',
    'writers',
    '_m',
    '_dev',
    '_by',
    'v'
  ].concat(PERSONAL);
  if (newer)
    new Set([...Object.keys(o), ...Object.keys(t)]).forEach(f => {
      if (SKIP.includes(f)) return;
      const v = pick3(b[f], o[f], t[f]);
      if (v === undefined) delete out[f];
      else out[f] = clone(v);
    });
  out.gone = Object.assign({}, t.gone || {});
  Object.keys(o.gone || {}).forEach(k => {
    out.gone[k] = Math.max(+o.gone[k] || 0, +out.gone[k] || 0);
  });
  out.saved = Math.max(+o.saved || 0, +t.saved || 0);
  out.writers = clone(t.writers || {});
  Object.keys(o.writers || {}).forEach(k => {
    const a = o.writers[k],
      c = out.writers[k];
    if (k === myKey() || !c || (+a.at || 0) >= (+c.at || 0)) out.writers[k] = clone(a);
  });
  ['scenes', 'ents'].forEach(f => {
    const B = b[f] || {},
      O = o[f] || {},
      T = t[f] || {},
      r = {};
    new Set([...Object.keys(O), ...Object.keys(T)]).forEach(id => {
      r[id] = clone(O[id] && T[id] ? (newer ? pick3(B[id], O[id], T[id]) : O[id]) : O[id] || T[id]);
    });
    out[f] = r;
  });
  ['tls', 'ols', 'nts', 'rms', 'fts'].forEach(f => {
    const O = o[f] || [],
      T = t[f] || [],
      B = b[f];
    out[f] = mergeOrder(
      B && B.map(x => x.id),
      O.map(x => x.id),
      T.map(x => x.id)
    ).map(id => {
      const x = O.find(q => q.id === id),
        y = T.find(q => q.id === id),
        z = B && B.find(q => q.id === id);
      return clone(x && y ? (newer ? pick3(z, x, y) : x) : x || y);
    });
  });
  const O = o.chapters || [],
    T = t.chapters || [],
    B = b.chapters;
  out.chapters = mergeOrder(
    B && B.map(c => c.id),
    O.map(c => c.id),
    T.map(c => c.id)
  ).map(id => {
    const x = O.find(c => c.id === id),
      y = T.find(c => c.id === id),
      z = B && B.find(c => c.id === id);
    if (!x || !y) return clone(x || y);
    return {
      id,
      title: newer ? pick3(z && z.title, x.title, y.title) : x.title,
      open: x.open,
      scenes: mergeOrder(z && z.scenes, x.scenes, y.scenes)
    };
  });
  return out;
}
// After a merge: makes the indexes in meta match the records that survived (no lost or orphaned scenes).
function fixMerged(out, o, t) {
  // the indexes in meta follow the records that survived
  const m = out.meta,
    seen = new Set();
  Object.keys(m.scenes).forEach(id => {
    if (!out.sc[id]) delete m.scenes[id];
  });
  Object.keys(out.sc).forEach(id => {
    if (!m.scenes[id])
      m.scenes[id] = clone(
        t.meta.scenes[id] || o.meta.scenes[id] || { title: 'Untitled scene', status: 'draft', words: 0 }
      );
  });
  m.chapters.forEach(c => {
    c.scenes = c.scenes.filter(id => out.sc[id] && !seen.has(id) && seen.add(id));
  });
  Object.keys(out.sc).forEach(id => {
    if (seen.has(id)) return;
    seen.add(id);
    const home = [t.meta, o.meta]
      .map(mm => (mm.chapters || []).find(c => c.scenes.includes(id)))
      .find(c => c && m.chapters.some(x => x.id === c.id));
    const ch = home ? m.chapters.find(x => x.id === home.id) : m.chapters[m.chapters.length - 1];
    if (!ch) {
      m.chapters.push({ id: uid('c_'), title: 'Chapter', open: true, scenes: [id] });
      return;
    }
    const src = home ? home.scenes : [],
      i = src.indexOf(id);
    let j = i - 1;
    while (j >= 0 && !ch.scenes.includes(src[j])) j--;
    ch.scenes.splice(j >= 0 ? ch.scenes.indexOf(src[j]) + 1 : i < 0 ? ch.scenes.length : 0, 0, id);
  });
  Object.keys(m.ents).forEach(id => {
    if (!out.en[id]) delete m.ents[id];
  });
  Object.keys(out.en).forEach(id => {
    if (m.ents[id]) return;
    const e = t.meta.ents[id] || o.meta.ents[id];
    if (e) m.ents[id] = clone(e);
    else delete out.en[id];
  });
  [
    ['tls', 'tl', 'Timeline'],
    ['ols', 'ol', 'Outline'],
    ['nts', 'nt', 'Notes'],
    ['rms', 'rm', 'Relationship map'],
    ['fts', 'ft', 'Family tree']
  ].forEach(([f, p, def]) => {
    m[f] = (m[f] || []).filter(x => out[p][x.id]);
    Object.keys(out[p]).forEach(id => {
      if (!m[f].some(x => x.id === id))
        m[f].push(
          clone(
            (t.meta[f] || []).find(y => y.id === id) || (o.meta[f] || []).find(y => y.id === id) || { id, name: def }
          )
        );
    });
  });
  Object.keys(m.gone).forEach(k => {
    const p = k.slice(0, 2);
    if (out[p] && out[p][k.slice(3)]) delete m.gone[k];
  });
}
// base: the common ancestor (null for a sync service's conflicted copy); ours and theirs: normalized projects.
function mergeProjects(base, ours, theirs) {
  const rep = {
    items: [],
    dels: 0,
    clash: [],
    by: new Set(),
    add(p, id, rec, m) {
      this.items.push({ p, id, name: recName(p, id, m) });
      if (rec._by && nameKey(rec._by) !== myKey()) this.by.add(rec._by);
    },
    del() {
      this.dels++;
    }
  };
  const goneO = ours.meta.gone || {},
    goneT = theirs.meta.gone || {};
  const out = { meta: mergeMeta(base && base.meta, ours.meta, theirs.meta) };
  DOCS.forEach(p => {
    out[p] = mergeRecords(
      p,
      (base && base[p]) || null,
      ours[p] || {},
      theirs[p] || {},
      goneO,
      goneT,
      rep,
      ours.meta,
      theirs.meta
    );
  });
  rep.clash.forEach(c => {
    // both changed the same scene: the other text becomes a snapshot of that scene
    if (c.p !== 'sc' || !out.sc[c.id] || !String(c.lose.text || '').trim() || c.lose.text === c.win.text) return;
    const id = uid('n_');
    c.snap = id;
    out.sn[id] = {
      scene: c.id,
      at: Date.now(),
      name: (c.lose._by ? c.lose._by + '’s version' : 'The other version').slice(0, 80),
      text: c.lose.text,
      words: wc(c.lose.text),
      auto: 'merge',
      _m: Date.now(),
      _dev: DEVICE
    };
  });
  fixMerged(out, ours, theirs);
  return { out, rep };
}
// Meta fields ignored when comparing projects (each device's own working copies).
const PROJ_SKIP = new Set(PERSONAL.concat(['saved']));
// Whether two versions of a project hold the same work.
function sameProject(a, b) {
  // ignoring the per-device copies of personal stats at the top of meta
  const strip = x => {
    const o = Object.assign({}, x, { meta: Object.assign({}, x.meta) });
    PROJ_SKIP.forEach(f => delete o.meta[f]);
    return o;
  };
  return canon(strip(a)) === canon(strip(b));
}
// Personal stats live in meta.writers[name]; the copies at the top of meta are this device's working view.
function stampMine(st) {
  if (!DESK || !st || !st.meta) return;
  const m = st.meta,
    k = myKey(),
    w = m.writers[k];
  const cur = {
    name: ME.name,
    days: m.days,
    pet: m.pet,
    mark: m.mark,
    goal: m.goal,
    pomo: m.pomo,
    todo: m.todo,
    layout: m.layout,
    plan: m.plan,
    devs: Array.from(new Set(((w && w.devs) || []).concat(DEVICE))).slice(-10)
  };
  if (!w || canon(Object.assign({}, w, { at: 0 })) !== canon(Object.assign({}, cur, { at: 0 })))
    m.writers[k] = Object.assign(clone(cur), { at: Date.now() });
}
// Takes this writer's personal stats from meta.writers into the working copy.
function adoptMine(st) {
  const m = st.meta,
    wr = m.writers || {};
  let w = wr[myKey()];
  if (!w) {
    const k = Object.keys(wr).find(k => (wr[k].devs || []).includes(DEVICE));
    if (k) w = wr[k];
  } // this computer under an earlier name
  if (w)
    PERSONAL.forEach(f => {
      if (w[f] !== undefined) m[f] = clone(w[f]);
    });
  else if (Object.keys(wr).length) {
    m.days = {};
    m.pet = normPet({});
    m.mark = null;
    m.todo = normTodo({});
    m.layout = normLayout(LOOK.layoutDef);
    m.plan = normPlan({}, m.target);
  } // someone else's project: your own pet and goals start fresh
}
// Puts merged data into the live state, keeping every object that did not change (open screens hold references to them).
function patchState(ns) {
  const patch = (cur, nx, depth) => {
    Object.keys(cur).forEach(k => {
      if (!(k in nx)) delete cur[k];
    });
    Object.keys(nx).forEach(k => {
      const a = cur[k],
        b = nx[k];
      if (
        depth > 0 &&
        a &&
        b &&
        typeof a === 'object' &&
        typeof b === 'object' &&
        !Array.isArray(a) &&
        !Array.isArray(b)
      )
        patch(a, b, depth - 1);
      else if (canon(a) !== canon(b)) cur[k] = b;
    });
  };
  patch(S.meta, ns.meta, 2);
  DOCS.forEach(p => {
    S[p] = S[p] || {};
    const cur = S[p],
      nx = ns[p] || {};
    Object.keys(cur).forEach(id => {
      if (!nx[id]) delete cur[id];
    });
    Object.keys(nx).forEach(id => {
      if (!cur[id] || canon(cur[id]) !== canon(nx[id])) cur[id] = nx[id];
    });
  });
}
// A fingerprint of the data a view shows, to tell whether a merge changed it.
function viewSig(v) {
  if (!v) return '';
  const m = S.meta;
  if (v.k === 'scene') return canon([S.sc[v.id] && S.sc[v.id].text, m.scenes[v.id]]);
  if (v.k === 'ent') return canon([S.en[v.id], m.ents[v.id]]);
  if (['tl', 'nt', 'ol', 'rm', 'ft'].includes(v.k)) return canon(S[v.k][v.id]);
  if (v.k === 'snap') return canon([S.sc[v.id] && S.sc[v.id].text, Object.keys(S.sn).length]);
  if (v.k === 'prefs' || v.k === 'help' || v.k === 'find') return v.k;
  return canon([m.chapters, m.scenes, Object.keys(S.ss).length]);
}
// Merges another computer's version (and any conflicted copies) into this one, updates the screen and says what
// changed.
function mergeIn(theirs, strays) {
  const ours = clone(snapshot(S));
  let r = mergeProjects(PJ.base, ours, theirs);
  const rep = r.rep;
  strays.forEach(x => {
    const r2 = mergeProjects(null, r.out, x);
    r = r2;
    rep.items.push(...r2.rep.items);
    rep.clash.push(...r2.rep.clash);
    r2.rep.by.forEach(b => rep.by.add(b));
  });
  const ns = normalize(r.out);
  PERSONAL.forEach(f => {
    ns.meta[f] = clone(S.meta[f]);
  }); // your pet and goals stay as they are on this computer
  const v = ui.view,
    before = viewSig(v),
    ed = $('#ed'),
    caret = ed && document.activeElement === ed ? caretOffset(ed) : null;
  patchState(ns);
  linker = buildLinker();
  if (!viewValid(v)) {
    ui.view = firstView();
    ui.hist = ui.hist.filter(viewValid);
    renderAll();
  } else {
    ui.hist = ui.hist.filter(viewValid);
    const t = $('#projTitle');
    if (t && document.activeElement !== t) t.value = S.meta.title;
    renderBinder();
    renderInspector();
    updateStats();
    if (viewSig(v) !== before) {
      const main = $('#main'),
        top = main ? main.scrollTop : 0;
      renderMain();
      if (main) main.scrollTop = top;
      const e2 = $('#ed');
      if (e2 && caret != null) {
        e2.focus();
        setCaret(e2, Math.min(caret, getText(e2).length));
      }
    }
  }
  return { rep, mine: !sameProject(snapshot(S), theirs) };
}
// project.json changed on disk (another computer saved through the sync folder): merge it with ours and save the result.
async function deskSync() {
  for (let i = 0; i < 4; i++) {
    const r = await DESK.read(PJ.id);
    if (!r || r.data == null) return;
    let theirs;
    try {
      theirs = normalize(JSON.parse(r.data));
    } catch (e) {
      if (e && e.code === 'newer') {
        lockNewer(e.v);
        return;
      }
      toast(
        'The shared copy of this project could not be read, so Inkling left it alone. Your work is safe on this computer.',
        { plain: true }
      );
      throw e;
    }
    const strays = [];
    (r.strays || []).forEach(x => {
      try {
        strays.push(normalize(JSON.parse(x.data)));
      } catch (e) {}
    });
    const res = mergeIn(theirs, strays);
    if (!res.mine && !strays.length) {
      await DESK.adopt(PJ.id, r.token);
      PJ.base = theirs;
      announceMerge(res.rep);
      return;
    }
    const json = JSON.stringify(snapshot()),
      w = await DESK.save(PJ.id, json, deskInfo(), { token: r.token });
    if (w && w.conflict) continue; // they saved again in the meantime: merge once more
    PJ.base = JSON.parse(json);
    if (r.strays && r.strays.length)
      await DESK.clearStrays(
        PJ.id,
        r.strays.map(x => x.name)
      );
    announceMerge(res.rep);
    setStatus('disk');
    return;
  }
  throw new Error('the shared folder keeps changing; trying again shortly');
}
// Checks whether another computer saved the project (every 8 s and on focus), and merges if so.
async function syncCheck() {
  if (!PJ.id || ui.locked || P.busy) return;
  try {
    if (!(await DESK.changed(PJ.id)) || P.busy) return;
  } catch (e) {
    return;
  }
  P.busy = true;
  try {
    await deskSync();
  } catch (e) {
  } finally {
    P.busy = false;
    if (P.again || P.dirty.size) {
      P.again = false;
      schedule(300);
    }
  }
}
// Tells the writer what came in from another computer.
function announceMerge(rep) {
  const who = [...rep.by].join(' and ') || 'another computer',
    names = [...new Set(rep.items.map(x => x.name).filter(Boolean))];
  if (names.length || rep.dels)
    toast(
      'Brought in changes from ' +
        who +
        ': ' +
        (names.length
          ? names.slice(0, 3).join(', ') + (names.length > 3 ? ' and ' + (names.length - 3) + ' more' : '')
          : '') +
        (rep.dels ? (names.length ? ', ' : '') + rep.dels + ' deleted' : '') +
        '.',
      { plain: true }
    );
  const clashes = rep.clash.filter(c => c.snap);
  if (!clashes.length) return;
  let bar = $('#mergeBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'mergeBar';
    bar.className = 'upd-bar merge-bar';
    bar.setAttribute('role', 'status');
    document.body.appendChild(bar);
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-mb]');
      if (!b) return;
      if (b.dataset.mb === 'x') bar.remove();
      else if (b.dataset.mb === 'help') go({ k: 'help' });
      else {
        ui.snSel = b.dataset.snap;
        go({ k: 'snap', id: b.dataset.mb });
        bar.remove();
      }
    });
  }
  const c = clashes[0];
  bar.innerHTML =
    ico('note', 16) +
    '<span>' +
    (clashes.length > 1 ? clashes.length + ' scenes were' : '“' + esc(c.name || 'A scene') + '” was') +
    ' changed on two computers at once. The newer text is in the scene; the other is saved as a snapshot.</span>' +
    '<button class="btn sm pri" data-mb="' +
    c.id +
    '" data-snap="' +
    c.snap +
    '">Compare</button><button class="btn sm" data-mb="help">How this works</button><button class="ibtn" data-mb="x" aria-label="Dismiss">' +
    ico('x', 14) +
    '</button>';
}

/* ---------- shared projects: who else is here ---------- */
// A co-writer's name (or their computer's name).
const whoName = o => o.name || o.host || 'Someone';
// Writes this computer's presence file and reads the others'.
async function hereTick() {
  if (!DESK || !PJ.id) return;
  const v = ui.view,
    sc = v && v.k === 'scene' && S.meta.scenes[v.id];
  try {
    ui.others =
      (await DESK.here(PJ.id, {
        name: ME.name,
        scene: sc ? v.id : '',
        sceneTitle: sc ? sc.title : '',
        sprint: T.running && T.phase === 'focus' ? T.endAt : 0,
        pet: { c: S.meta.pet.color, st: petStage(), n: S.meta.pet.name }
      })) || [];
  } catch (e) {
    ui.others = [];
  }
  paintHere();
}
// Updates presence shortly (after opening a scene).
function hereSoon() {
  if (!DESK) return;
  clearTimeout(ui.hereT);
  ui.hereT = setTimeout(hereTick, 400);
}
// Shows who else is here: the top bar chip, letters in the binder, a note on a scene someone else has open.
function paintHere() {
  const others = ui.others || [];
  let chip = $('#hereChip');
  if (!chip) {
    chip = document.createElement('button');
    chip.id = 'hereChip';
    chip.className = 'chip here-chip';
    chip.hidden = true;
    $('#saveSt').after(chip);
    chip.addEventListener('click', e => {
      e.stopPropagation();
      const pop = $('#herePop');
      if (pop) {
        pop.remove();
        return;
      }
      openHerePop();
    });
  }
  chip.hidden = !others.length;
  const sprinting = others.filter(o => o.sprint > Date.now());
  chip.innerHTML =
    others
      .slice(0, 3)
      .map(
        o => '<i class="av" style="--h:' + hue(whoName(o)) + '">' + esc(whoName(o).slice(0, 1).toUpperCase()) + '</i>'
      )
      .join('') +
    '<span>' +
    (sprinting.length
      ? esc(whoName(sprinting[0])) +
        (sprinting.length > 1 ? ' and ' + (sprinting.length - 1) + ' more' : '') +
        ' sprinting'
      : others.length === 1
        ? esc(whoName(others[0])) + ' is here'
        : others.length + ' others here') +
    '</span>';
  chip.classList.toggle('sprinting', !!sprinting.length);
  sprinting.forEach(o => {
    const k = whoName(o) + o.sprint;
    if (ui.sprintSeen !== k && !(T.running && T.phase === 'focus')) {
      ui.sprintSeen = k;
      say(whoName(o) + ' started a writing sprint. Join from the chip at the top!');
    }
  });
  paintPals();
  chip.setAttribute(
    'aria-label',
    others.map(o => whoName(o) + (o.sceneTitle ? ' in ' + o.sceneTitle : '')).join(', ') + ' also in this project'
  );
  const v = ui.view,
    ban = $('#hereBan');
  if (ban) {
    const w = others.filter(o => v.k === 'scene' && o.scene === v.id);
    ban.hidden = !w.length;
    ban.innerHTML = w.length
      ? ico('pen', 14) +
        '<span><b>' +
        esc(w.map(whoName).join(' and ')) +
        '</b> ' +
        (w.length > 1 ? 'are' : 'is') +
        ' in this scene too. If you both change it, the newer text is kept and the other is saved as a snapshot.</span>'
      : '';
  }
  document.querySelectorAll('#binder .here').forEach(x => x.remove());
  others.forEach(o => {
    if (!o.scene) return;
    const row = document.querySelector('#binder .sc-btn[data-id="' + o.scene + '"]');
    if (!row) return;
    const d = document.createElement('i');
    d.className = 'here av';
    d.style.setProperty('--h', hue(whoName(o)));
    d.title = whoName(o) + ' is here';
    d.textContent = whoName(o).slice(0, 1).toUpperCase();
    row.querySelector('.wc').before(d);
  });
  const old = others.find(o => o.version && o.version !== APP_VERSION);
  if (old && ui.verWarned !== old.version + whoName(old)) {
    ui.verWarned = old.version + whoName(old);
    toast(
      whoName(old) +
        ' is using Inkling ' +
        old.version +
        ' and you have ' +
        APP_VERSION +
        '. Shared projects work best when everyone has the same version: Help › Check for updates.',
      { plain: true }
    );
  }
}
// A stable colour for a name.
const hue = n => {
  let h = 0;
  for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
// The popup listing who else has the project open.
function openHerePop() {
  const pop = document.createElement('div');
  pop.id = 'herePop';
  pop.className = 'pop here-pop';
  pop.innerHTML =
    '<div class="pt">Also in this project</div>' +
    (ui.others || [])
      .map(
        o =>
          '<div class="here-row"><i class="av" style="--h:' +
          hue(whoName(o)) +
          '">' +
          esc(whoName(o).slice(0, 1).toUpperCase()) +
          '</i><span><b>' +
          esc(whoName(o)) +
          '</b>' +
          (o.name && o.host ? ' <span class="muted">on ' + esc(o.host) + '</span>' : '') +
          '<br><span class="muted">' +
          (o.sceneTitle ? 'In “' + esc(o.sceneTitle) + '”' : 'Looking around') +
          (o.version && o.version !== APP_VERSION ? ' · Inkling ' + esc(o.version) : '') +
          '</span>' +
          (o.sprint > Date.now()
            ? '<br><span class="spr">Sprinting · ' +
              Math.max(1, Math.round((o.sprint - Date.now()) / 60000)) +
              ' min left</span>' +
              (T.running && T.phase === 'focus'
                ? ''
                : ' <button class="btn sm pri" data-hp="join" data-end="' +
                  o.sprint +
                  '" data-who="' +
                  esc(whoName(o)) +
                  '">Join the sprint</button>')
            : '') +
          '</span></div>'
      )
      .join('') +
    (ME.name ? '' : '<p class="fine">Add your name in Settings so co-writers see who you are.</p>') +
    '<button class="btn sm" data-hp="help">How sharing works</button>';
  document.body.appendChild(pop);
  const r = $('#hereChip').getBoundingClientRect();
  pop.style.top = r.bottom + 6 + 'px';
  pop.style.left = Math.max(8, Math.min(innerWidth - 288, r.left)) + 'px';
  pop.addEventListener('click', e => {
    const b = e.target.closest('[data-hp]');
    if (!b) return;
    pop.remove();
    if (b.dataset.hp === 'join') pmJoin(+b.dataset.end, b.dataset.who);
    else go({ k: 'help' });
  });
  setTimeout(
    () =>
      document.addEventListener('click', function off(e) {
        if (!pop.contains(e.target)) {
          pop.remove();
          document.removeEventListener('click', off);
        }
      }),
    0
  );
}

/* ---------- shared projects: setting up ---------- */
async function openShare(id) {
  id = id || PJ.id;
  if (!DESK || !id) return;
  await deskFlush();
  const draw = async () => {
    const w = await DESK.where(id),
      cur = (await DESK.list()).find(x => x.id === id) || { title: S.meta.title };
    ov.innerHTML =
      '<div class="pj-dlg share" role="dialog" aria-modal="true" aria-labelledby="shH"><header><h2 id="shH">' +
      ico('users', 20) +
      'Share “' +
      esc(cur.title) +
      '”</h2><button class="ibtn" data-sh="close" aria-label="Close">' +
      ico('x') +
      '</button></header>' +
      '<p class="muted pj-sub">Co-writers share the project’s folder through Dropbox, Google Drive, OneDrive or iCloud Drive, and each opens it in Inkling. Inkling merges everyone’s changes. <button class="lnk" data-sh="help">How sharing works</button></p>' +
      '<ol class="sh-steps">' +
      '<li class="' +
      (w.synced || w.shared ? 'done' : '') +
      '"><b>Put the project in a folder that syncs.</b>' +
      (w.synced || w.shared
        ? '<p>It is in <code>' +
          esc(w.path) +
          '</code>.</p><div class="ts-row"><button class="btn sm" data-sh="reveal">Show this folder</button>' +
          (w.synced ? '' : '<button class="btn sm" data-sh="move">Move it somewhere else…</button>') +
          '</div>'
        : '<p>Right now it is only on this computer, in <code>' +
          esc(w.path) +
          '</code>. Choose a folder inside Dropbox, Google Drive, OneDrive or iCloud Drive and Inkling moves the project there (it checks the copy before removing the original).</p><div class="ts-row"><button class="btn sm pri" data-sh="move">Move to a shared folder…</button></div>') +
      '</li>' +
      '<li><b>Share the folder “' +
      esc(w.folder) +
      '” with your co-writers.</b><p>Use your sync service’s Share button on that folder and give them permission to <b>edit</b>. In Dropbox: right-click the folder › Share. In Google Drive: right-click › Share (they then add it to their My Drive, or use “Add shortcut to Drive”). In OneDrive: right-click › Share. In iCloud Drive (Mac): right-click › Share › Share Folder.</p></li>' +
      '<li><b>They open it in Inkling.</b><p>Each co-writer installs Inkling, waits for the folder to finish syncing, then chooses <b>File › Open a shared project…</b> (or <b>Open a shared project</b> in Projects) and picks the folder.</p></li>' +
      '<li class="' +
      (ME.name ? 'done' : '') +
      '"><b>Everyone sets their name.</b><p>It shows co-writers who is where, and keeps each writer’s pet, daily goal and word history separate.</p><label class="f">Your name on this computer<input id="shName" value="' +
      esc(ME.name) +
      '" maxlength="60" placeholder="For example, Mary"></label></li>' +
      '</ol><div class="ask-btns"><button class="btn pri" data-sh="close">Done</button></div></div>';
    const ni = $('#shName', ov);
    ni.addEventListener('change', () => {
      setMyName(ni.value);
      draw();
    });
  };
  const ov = document.createElement('div');
  ov.className = 'pj-ov share-ov';
  document.body.appendChild(ov);
  const close = () => {
    ov.remove();
    document.removeEventListener('keydown', key, true);
  };
  const key = e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', key, true);
  ov.addEventListener('click', async e => {
    if (e.target === ov) return close();
    const b = e.target.closest('[data-sh]');
    if (!b) return;
    const a = b.dataset.sh;
    if (a === 'close') close();
    else if (a === 'help') {
      close();
      closeProjects();
      go({ k: 'help' });
    } else if (a === 'reveal') DESK.reveal(id);
    else if (a === 'move') {
      try {
        pmHalt();
        await deskFlush();
        const r = await DESK.shareMove(id);
        if (!r) return;
        if (r.error === 'exists') {
          toast(
            'There is already a folder called that in the place you chose. Pick another place, or remove that folder first.',
            { plain: true }
          );
          return;
        }
        toast('Moved. The project now lives in ' + r.path, { plain: true });
        if (ui.pj) ui.pj.list = await DESK.list();
        drawProjects();
        draw();
      } catch (x) {
        toast('Could not move the project: ' + ((x && x.message) || x), { plain: true });
      }
    }
  });
  await draw();
  const f = $('[data-sh]', ov);
  if (f) f.focus();
}
// Opens a project from a shared folder.
async function openSharedPick() {
  try {
    pmHalt();
    await deskFlush();
    const r = await DESK.openShared();
    if (!r) return;
    if (r.error) {
      toast(
        'That folder has no Inkling project in it. Pick the project’s own folder, the one that contains project.json.',
        { plain: true }
      );
      return;
    }
    closeProjects();
    if (await deskOpen(r.id))
      toast(r.added ? 'Opened the shared project. It is now on your Projects list too.' : 'Opened.', { plain: true });
  } catch (e) {
    toast('Could not open that folder: ' + ((e && e.message) || e), { plain: true });
  }
}
// Sets the writer's name and moves their personal stats to the new name.
function setMyName(n) {
  const old = myKey();
  ME.name = String(n || '')
    .trim()
    .slice(0, 60);
  try {
    localStorage.setItem('inkling:me', JSON.stringify({ name: ME.name }));
  } catch (e) {}
  const wr = S.meta.writers;
  if (wr && wr[old] && old !== myKey()) {
    if (!wr[myKey()]) wr[myKey()] = wr[old];
    delete wr[old];
  }
  dirty('meta');
  hereSoon();
}
// The "How sharing works" guide.
function helpShareHtml() {
  const sec = (t, b) => '<section class="pf hs"><h2>' + t + '</h2>' + b + '</section>';
  return (
    '<div class="pf-wrap">' +
    (DESK
      ? ''
      : '<p class="banner-note">Sharing works in the Inkling desktop app for Windows, Mac and Linux. In a browser or in Claude, a project is yours alone; you can still back it up and import it into the desktop app.</p>') +
    sec(
      'What sharing is',
      '<p>Two or more people can work on the same novel, each in Inkling on their own computer. The project lives in a folder that a sync service keeps the same on every computer: Dropbox, Google Drive, OneDrive or iCloud Drive. Inkling has no server and no accounts; your sync service carries the files, and Inkling merges everyone’s changes.</p><p>It is not live like Google Docs: changes arrive when the sync service delivers them, usually within a few seconds to a minute. It works best when co-writers work on different scenes, or take turns.</p>'
    ) +
    sec(
      'Setting it up',
      '<ol><li>Open the project and choose <b>Share this project…</b> (in the File menu, or <b>Share</b> on the Projects screen).</li><li>Move it into a folder inside Dropbox, Google Drive, OneDrive or iCloud Drive. Inkling copies it, checks the copy, then moves the original to the trash.</li><li>In your sync service, share that project folder with your co-writers, with permission to edit.</li><li>Each co-writer installs Inkling, waits for the folder to sync, and chooses <b>File › Open a shared project…</b>, then picks the folder. It joins their Projects list.</li><li>Everyone types their name in <b>Settings › You</b>.</li></ol>'
    ) +
    sec(
      'Working at the same time',
      '<ul><li><b>Who is here.</b> A chip at the top shows who else has the project open, and a letter beside a scene shows who is in it. A note appears above a scene when someone else is in it too.</li><li><b>Sprint together.</b> When a co-writer starts a focus sprint, the chip at the top says so. Click it and choose <b>Join the sprint</b>: your timer ends at the same moment as theirs, and their Inky sits beside yours.</li><li><b>Different things merge.</b> If you change one scene and your co-writer changes another, or adds a character, a timeline card or a chapter, both changes are kept. Inkling checks for new changes every few seconds and whenever you come back to the window, and says what came in.</li><li><b>The same scene.</b> If you both change the same scene before the sync catches up, the newer change is kept in the scene and the other text is saved as a <b>snapshot</b> of that scene, named after whoever wrote it. A note appears with a <b>Compare</b> button, so you can copy anything back. Nothing is thrown away.</li><li><b>Other pages.</b> For a story page, timeline, outline, note, map or tree that you both changed, the newer change is kept. The project’s Backups have earlier versions.</li><li><b>Deleting.</b> Deleting something removes it for everyone, unless someone changed it after it was deleted; then it comes back.</li><li><b>Chapter order and titles</b> merge too: scenes one person adds or moves appear in place for everyone.</li></ul>'
    ) +
    sec(
      'What stays yours',
      '<p>Your Inkling pet, daily goal, deadline plan, to-do list, screen setup, word history chart, focus timer settings and writing sessions belong to you, under the name you set. Appearance settings (theme, font, spacing) are per computer. Everything else (the text, story pages, timelines, outlines, notes, maps, trees, chapter notes, snapshots and export settings) is shared.</p><p>Use the same name on each of your own computers so your pet follows you.</p>'
    ) +
    sec(
      'Good habits',
      '<ul><li>Agree who is writing which chapters or scenes.</li><li>Before you start, check the sync service has finished syncing (its icon shows a tick).</li><li>Keep everyone on the same version of Inkling (Help › Check for updates). Inkling warns you when a co-writer has a different version.</li><li>Make the folder “available offline” or “always keep on this device” (Google Drive: right-click › Offline access; OneDrive: Always keep on this device; iCloud: Download Now). Online-only files can make Inkling wait.</li><li>Take a <b>snapshot</b> of a scene before a big rewrite.</li></ul>'
    ) +
    sec(
      'If something looks wrong',
      '<ul><li><b>A co-writer’s changes have not arrived.</b> Check that their sync service is running and finished. Switching back to Inkling, or waiting a few seconds, brings in anything that has arrived.</li><li><b>Text you expected is missing from a scene.</b> Open the scene’s <b>Snapshots</b>: the other version from a clash is there, named after its writer.</li><li><b>Files called “conflicted copy”, “(1)” or with a computer’s name.</b> Sync services make these when two saves cross. Inkling merges them in automatically and moves them into the project’s backups folder.</li><li><b>Going back to an earlier state.</b> Projects › Backups lists copies made every 10 minutes; opening one makes a separate project, so nothing is overwritten.</li><li><b>Stopping sharing.</b> In your sync service, stop sharing the folder. To take a shared project off your own list without affecting anyone, use <b>Remove from list</b> on the Projects screen.</li></ul>'
    ) +
    sec(
      'Privacy',
      '<p>The project is stored by your sync service and anyone you share the folder with can read and change all of it. Inkling itself sends nothing anywhere. Remove someone’s access in your sync service to stop sharing with them.</p>'
    ) +
    '</div>'
  );
}
// The "How sharing works" screen.
function renderHelp(el) {
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('users', 16) +
    '</span><h1 class="mh-title">How sharing works</h1>' +
    (DESK && PJ.id ? '<button class="btn pri" data-hs="share">Share this project…</button>' : '') +
    '</div>' +
    helpShareHtml();
  el.onclick = e => {
    if (e.target.closest('[data-hs="share"]')) openShare();
  };
}
