/*
 * 38-desktop.js: Dialogs, and the desktop app's projects
 *
 * ask() is the app's dialog (use it instead of confirm()). The rest runs only in the desktop app: opening, creating
 * and importing projects (each a folder on the computer), saving through the desktop bridge (deskFlush), the Projects
 * window, and update notices.
 */
// ask(title, html, [[value,label,style]]) resolves with the chosen value ('' when closed with Escape).
function ask(title, html, buttons) {
  return new Promise(res => {
    const ov = document.createElement('div');
    ov.className = 'pj-ov ask-ov';
    ov.innerHTML =
      '<div class="pj-dlg ask" role="alertdialog" aria-modal="true" aria-labelledby="askH"><h2 id="askH">' +
      esc(title) +
      '</h2><p>' +
      html +
      '</p><div class="ask-btns">' +
      buttons
        .map(
          b => '<button class="btn' + (b[2] ? ' ' + b[2] : '') + '" data-v="' + b[0] + '">' + esc(b[1]) + '</button>'
        )
        .join('') +
      '</div></div>';
    const done = v => {
      ov.remove();
      document.removeEventListener('keydown', k, true);
      res(v);
    };
    const k = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        done('');
      }
    };
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (b) done(b.dataset.v);
    });
    document.addEventListener('keydown', k, true);
    document.body.appendChild(ov);
    $('[data-v]', ov).focus();
  });
}

/* ---------- desktop projects ---------- */
// A project's summary for the Projects window: title, words, when saved.
const deskInfo = st => {
  st = st || S;
  return {
    title: st.meta.title,
    words: Object.values(st.meta.scenes).reduce((a, x) => a + (x.words || 0), 0),
    sample: !!st.meta.sample
  };
};
// Desktop: saves now and waits for it (before switching project or closing).
async function deskFlush() {
  clearTimeout(P.timer);
  for (let i = 0; i < 60 && P.busy; i++) await new Promise(r => setTimeout(r, 100));
  if (P.dirty.size || P.gone.size) await flush();
}
// Desktop: opens a project folder: loads, checks, merges conflicted copies, and shows it.
async function deskOpen(id) {
  const r = await DESK.load(id);
  const raw = r && r.data;
  if (raw == null) {
    toast('That project could not be found. If it is a shared project, check that its folder has finished syncing.', {
      plain: true
    });
    return false;
  }
  let o, ns;
  try {
    o = JSON.parse(raw);
  } catch (e) {
    toast('This project file is damaged. Open its Backups in Projects to get back a recent copy.', { plain: true });
    return false;
  }
  try {
    ns = normalize(o);
  } catch (e) {
    toast(
      e.code === 'newer'
        ? '“' +
            ((o.meta || {}).title || 'This project') +
            '” was saved by a newer version of Inkling. Update Inkling to open it.'
        : 'This project could not be opened: ' + e.message,
      { plain: true }
    );
    return false;
  }
  clearTimeout(P.timer);
  P.dirty.clear();
  P.gone.clear();
  P.keys.clear();
  PJ.base = clone(ns);
  adoptMine(ns);
  S = ns;
  PJ.id = id;
  linker = buildLinker();
  ui.locked = 0;
  Object.assign(ui, {
    view: startView(),
    hist: [],
    fwd: [],
    touched: false,
    mood: '',
    confirm: null,
    menu: false,
    tlFor: null,
    tlSide: null,
    cvFor: null,
    cvSel: null,
    relabel: null,
    others: r.others || []
  });
  ['#mergeBar', '#herePop'].forEach(q => {
    const x = $(q);
    if (x) x.remove();
  });
  renderAll();
  setStatus('disk');
  document.title = S.meta.title + ' – Inkling';
  DESK.setTitle(document.title);
  paintHere();
  hereSoon();
  checkAch(true);
  greet();
  if (ui.others.length)
    toast(
      ui.others.map(whoName).join(' and ') +
        (ui.others.length > 1 ? ' have' : ' has') +
        ' this project open too. Inkling merges your changes; see Help › How sharing works.',
      { plain: true }
    );
  setTimeout(syncCheck, 800); // conflicted copies a sync service left behind
  return true;
}
// Desktop: saves a new project (with its pictures) as a new folder and opens it.
async function deskCreate(np, imgs) {
  np.meta.saved = Date.now();
  const id = await DESK.create(np.meta.title);
  if (imgs !== undefined) await adoptImages(np, imgs, id);
  await DESK.save(id, JSON.stringify(snapshot(np)), deskInfo(np));
  return id;
}
// Desktop: a new project, blank or the sample.
async function deskNew(kind) {
  pmHalt();
  await deskFlush();
  const id = await deskCreate(normalize(kind === 'sample' ? sampleProject() : blankProject()));
  await deskOpen(id);
  return id;
}
// Desktop: a backup file as a new project.
async function deskImport(text) {
  let o, np;
  try {
    o = JSON.parse(text);
    if (!o || !o.meta || !Array.isArray(o.meta.chapters)) throw 0;
    np = normalize(o);
  } catch (e) {
    toast(
      e && e.code === 'newer'
        ? 'That backup was made by a newer version of Inkling. Update Inkling to open it.'
        : 'That file is not an Inkling backup.',
      { plain: true }
    );
    return;
  }
  pmHalt();
  await deskFlush();
  const id = await deskCreate(np, o.imgs || {});
  await deskOpen(id);
  toast('Imported “' + np.meta.title + '” as a new project. Your other projects are unchanged.', { plain: true });
  return id;
}
// Desktop: picks a backup file to import.
async function deskImportPick() {
  try {
    const t = await DESK.openFile();
    if (t != null) {
      await deskImport(t);
      closeProjects();
    }
  } catch (e) {
    toast('Could not open that file.', { plain: true });
  }
}
// Desktop start-up: menu commands, closing, focus, updates, and opening the last project.
async function deskBoot() {
  DESK.onMenu(a => {
    if (a === 'new' || a === 'projects') openProjects();
    else if (a === 'backup') doBackup();
    else if (a === 'export') openExport();
    else if (a === 'find') openFind();
    else if (a === 'prefs') go({ k: 'prefs' });
    else if (a === 'tour') startTour(true);
    else if (a === 'updcheck') checkUpdatesNow();
    else if (a === 'save') saveNow();
    else if (a === 'cont') go({ k: 'cont' });
    else if (a === 'share') openShare();
    else if (a === 'openShared') openSharedPick();
    else if (a === 'helpShare') go({ k: 'help' });
    else if (a === 'snapshots') {
      if (ui.view.k === 'scene') go({ k: 'snap', id: ui.view.id });
      else toast('Open a scene first, then choose Scene snapshots.', { plain: true });
    } else if (a === 'import') deskImportPick();
    else if (a === 'sessions') go({ k: 'ss' });
    else if (a === 'timer') {
      if (T.running) pmPause();
      else pmStart();
    } else winAct(a, 'menu');
  });
  DESK.onClosing(async () => {
    try {
      pmHalt();
      await deskFlush();
    } catch (e) {}
    DESK.closeReady();
  });
  DESK.onUpdate(showUpdate);
  DESK.onFocus(() => {
    syncCheck();
    hereTick();
  }); // bring in what the sync folder delivered while Inkling was in the background
  setInterval(syncCheck, 8000);
  setInterval(hereTick, 30000);
  const b = document.createElement('button');
  b.className = 'ibtn';
  b.id = 'pjBtn';
  b.title = 'Projects';
  b.setAttribute('aria-label', 'Projects');
  b.innerHTML = ico('folder', 18);
  b.addEventListener('click', () => openProjects());
  $('#projTitle').before(b);
  try {
    let id = await DESK.last();
    if (!id) {
      const l = await DESK.list();
      id = l.length ? l[0].id : null;
    }
    if (id) {
      if (!(await deskOpen(id))) openProjects();
    } else await deskNew('sample');
  } catch (e) {
    toast('Inkling could not open your projects folder: ' + ((e && e.message) || e), { plain: true });
  }
  try {
    // after an update, offer the release notes once
    const pf = await DESK.prefs();
    if (pf.update && pf.update.state) showUpdate(pf.update);
    if (pf.lastVersion !== pf.version) {
      if (
        pf.lastVersion &&
        (await ask(
          'Inkling was updated',
          'You are now on Inkling ' + esc(pf.version) + '. Your projects are unchanged.',
          [
            ['notes', 'See what’s new', 'pri'],
            ['ok', 'OK']
          ]
        )) === 'notes'
      )
        DESK.openReleases(pf.version);
      DESK.setPrefs({ lastVersion: pf.version });
    }
  } catch (e) {}
  startTour();
}
// The update bar: a new version is downloading, ready, or available to download.
function showUpdate(st) {
  let bar = $('#updBar');
  if (!st || !/available|ready/.test(st.state)) {
    if (bar) bar.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'updBar';
    bar.className = 'upd-bar';
    bar.setAttribute('role', 'status');
    document.body.appendChild(bar);
    bar.addEventListener('click', async e => {
      const b = e.target.closest('[data-u]');
      if (!b) return;
      const a = b.dataset.u;
      if (a === 'later') bar.remove();
      else if (a === 'notes') DESK.openReleases(bar.dataset.v);
      else if (a === 'get') DESK.openReleases(bar.dataset.v);
      else if (a === 'install') {
        b.disabled = true;
        b.textContent = 'Saving…';
        pmHalt();
        await deskFlush();
        DESK.installUpdate();
      }
    });
  }
  bar.dataset.v = st.version || '';
  bar.innerHTML =
    ico('spark', 16) +
    '<span>' +
    (st.state === 'ready'
      ? 'Inkling ' + esc(st.version) + ' is ready to install.'
      : 'Inkling ' + esc(st.version) + ' is out.') +
    '</span>' +
    (st.state === 'ready'
      ? '<button class="btn sm pri" data-u="install">Restart to update</button>'
      : '<button class="btn sm pri" data-u="get">Download</button>') +
    '<button class="btn sm" data-u="notes">What’s new</button><button class="ibtn" data-u="later" aria-label="Later">' +
    ico('x', 14) +
    '</button>';
}
// Checks for an update now (Settings).
async function checkUpdatesNow() {
  if (!DESK) {
    toast('This is Inkling ' + APP_VERSION + '. The online version updates itself.', { plain: true });
    return;
  }
  toast('Checking for updates…', { plain: true });
  const r = await DESK.checkUpdates();
  if (r.state === 'none') toast('You have the latest version of Inkling.', { plain: true });
  else if (r.state === 'unavailable')
    toast('Updates are checked in the installed app, not this development copy.', { plain: true });
  else if (r.state === 'error') toast('Could not check for updates: ' + r.message, { plain: true });
  else if (r.state === 'downloading')
    toast('Downloading Inkling ' + r.version + '. You will be asked to restart when it is ready.', { plain: true });
  else showUpdate(r);
}
// How long ago a time was, in words.
const ago = t => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  if (s < 86400 * 7) return Math.round(s / 86400) + ' days ago';
  return new Date(t).toLocaleDateString();
};
// The Projects window.
async function openProjects() {
  if (!DESK) return;
  await deskFlush();
  let ov = $('#pj');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'pj';
    ov.className = 'pj-ov';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      if (e.target === ov) {
        if (PJ.id) closeProjects();
        return;
      }
      const b = e.target.closest('[data-pj]');
      if (b) pjAct(b.dataset.pj, b.dataset.id, b.dataset.name);
    });
  }
  ui.pj = { list: await DESK.list(), dir: await DESK.dir(), bk: null, bks: [], confirm: null };
  ov.hidden = false;
  drawProjects();
  const f = $('.pj-dlg [data-pj]', ov);
  if (f) f.focus();
}
// Closes the Projects window.
function closeProjects() {
  const ov = $('#pj');
  if (ov) ov.hidden = true;
}
// Draws the Projects window: every project, with open, rename, duplicate, share, backups and delete.
function drawProjects() {
  const ov = $('#pj'),
    st = ui.pj;
  if (!ov || !st) return;
  ov.innerHTML =
    '<div class="pj-dlg" role="dialog" aria-modal="true" aria-labelledby="pjH"><header><h2 id="pjH">' +
    ico('folder', 20) +
    'Your projects</h2>' +
    (PJ.id ? '<button class="ibtn" data-pj="close" aria-label="Close">' + ico('x') + '</button>' : '') +
    '</header>' +
    '<p class="muted pj-sub">Each project is a separate novel with its own story pages, timelines, maps and Inkling. Everything saves on this computer as you write.</p>' +
    '<div class="pj-new"><button class="btn pri" data-pj="blank">' +
    ico('plus') +
    '<span>New blank project</span></button><button class="btn" data-pj="sample">New copy of the sample</button><button class="btn" data-pj="import">' +
    ico('upload') +
    '<span>Import a backup…</span></button><button class="btn" data-pj="openShared">' +
    ico('users') +
    '<span>Open a shared project…</span></button></div>' +
    '<ul class="pj-list">' +
    (st.list.length
      ? st.list
          .map(x => {
            const cur = x.id === PJ.id,
              cf = st.confirm === 'del' + x.id,
              others = (x.others || []).map(whoName);
            if (x.missing)
              return (
                '<li class="pj-row"><div class="pj-top"><span class="pj-open"><b>' +
                esc(x.title) +
                '</b><span>Shared project not found at <code>' +
                esc(x.path) +
                '</code>. Its folder may have been moved, or not synced to this computer yet.</span></span><span class="pj-acts"><button class="btn sm" data-pj="unlink" data-id="' +
                esc(x.id) +
                '">Remove from list</button></span></div></li>'
              );
            return (
              '<li class="pj-row' +
              (cur ? ' cur' : '') +
              '"><div class="pj-top"><button class="pj-open" data-pj="open" data-id="' +
              esc(x.id) +
              '"><b>' +
              esc(x.title || 'Untitled novel') +
              (x.shared || x.synced ? ' <span class="pj-tag">' + ico('users', 12) + 'Shared folder</span>' : '') +
              '</b><span>' +
              fmt(x.words) +
              ' words · saved ' +
              esc(ago(x.saved)) +
              (cur ? ' · <em>open now</em>' : '') +
              (others.length ? ' · open by ' + esc(others.join(', ')) : '') +
              '</span></button>' +
              '<span class="pj-acts"><button class="btn sm" data-pj="share" data-id="' +
              esc(x.id) +
              '">' +
              ico('users', 14) +
              '<span>Share</span></button><button class="btn sm" data-pj="dup" data-id="' +
              esc(x.id) +
              '">' +
              ico('copy', 14) +
              '<span>Duplicate</span></button><button class="btn sm" data-pj="bk" data-id="' +
              esc(x.id) +
              '" aria-expanded="' +
              (st.bk === x.id) +
              '">Backups</button>' +
              '<button class="btn sm" data-pj="reveal" data-id="' +
              esc(x.id) +
              '">Show folder</button>' +
              (x.shared
                ? '<button class="btn sm" data-pj="unlink" data-id="' +
                  esc(x.id) +
                  '">' +
                  (st.confirm === 'un' + x.id ? 'Remove? Co-writers keep it' : 'Remove from list') +
                  '</button>'
                : '<button class="btn sm danger" data-pj="del" data-id="' +
                  esc(x.id) +
                  '">' +
                  ico('trash', 14) +
                  '<span>' +
                  (cf ? 'Move to trash?' : 'Delete') +
                  '</span></button>') +
              '</span></div>' +
              (st.bk === x.id
                ? '<div class="pj-bks">' +
                  (st.bks.length
                    ? '<p class="fine">Automatic copies, made at most every 10 minutes while you write. Opening one makes a new project, so nothing is overwritten.</p>' +
                      st.bks
                        .map(
                          n =>
                            '<div class="pj-bk"><span class="mono">' +
                            esc(
                              n.replace('.json', '').replace(/^(\d{4}-\d\d-\d\d)-(\d\d)-(\d\d)-(\d\d)$/, '$1 $2:$3')
                            ) +
                            '</span><button class="btn sm" data-pj="rb" data-id="' +
                            esc(x.id) +
                            '" data-name="' +
                            esc(n) +
                            '">Open as a copy</button></div>'
                        )
                        .join('')
                    : '<p class="fine">No automatic backups yet. They are made as you write, at most every 10 minutes.</p>') +
                  '</div>'
                : '') +
              '</li>'
            );
          })
          .join('')
      : '<li class="muted">No projects yet.</li>') +
    '</ul>' +
    '<footer><span>Projects folder: <code>' +
    esc(st.dir) +
    '</code></span><button class="btn sm" data-pj="root">Open folder</button></footer></div>';
}
// The Projects window's actions.
async function pjAct(a, id, name) {
  const st = ui.pj,
    refresh = async () => {
      st.list = await DESK.list();
      drawProjects();
    };
  try {
    if (a === 'close') closeProjects();
    else if (a === 'open') {
      if (id !== PJ.id) {
        pmHalt();
        await deskFlush();
        if (!(await deskOpen(id))) return;
      }
      closeProjects();
    } else if (a === 'blank' || a === 'sample') {
      await deskNew(a);
      closeProjects();
      if (a === 'blank') {
        const t = $('#projTitle');
        t.focus();
        t.select();
      }
    } else if (a === 'import') await deskImportPick();
    else if (a === 'openShared') await openSharedPick();
    else if (a === 'share') openShare(id);
    else if (a === 'unlink') {
      const missing = (st.list.find(x => x.id === id) || {}).missing;
      if (!missing && st.confirm !== 'un' + id) {
        st.confirm = 'un' + id;
        drawProjects();
        clearTimeout(ui.pjt);
        ui.pjt = setTimeout(() => {
          if (st.confirm === 'un' + id) {
            st.confirm = null;
            drawProjects();
          }
        }, 3500);
        return;
      }
      st.confirm = null;
      const wasOpen = id === PJ.id;
      if (wasOpen) {
        pmHalt();
        await deskFlush();
        PJ.id = null;
      }
      await DESK.unlink(id);
      st.list = await DESK.list();
      if (wasOpen) {
        const next = st.list.find(x => !x.missing);
        if (next) await deskOpen(next.id);
        else await deskNew('blank');
        st.list = await DESK.list();
      }
      drawProjects();
      toast('Removed from your list. The shared folder and your co-writers’ copies are untouched.', { plain: true });
    } else if (a === 'dup') {
      await deskFlush();
      await DESK.duplicate(id);
      await refresh();
      toast('Duplicated. The copy is at the top of the list.', { plain: true });
    } else if (a === 'bk') {
      st.bk = st.bk === id ? null : id;
      st.bks = st.bk ? await DESK.backups(id) : [];
      drawProjects();
    } else if (a === 'rb') {
      await deskFlush();
      await DESK.restoreBackup(id, name);
      st.bk = null;
      await refresh();
      toast('Added the backup as a new project at the top of the list.', { plain: true });
    } else if (a === 'reveal') DESK.reveal(id);
    else if (a === 'root') DESK.reveal();
    else if (a === 'del') {
      if (st.confirm !== 'del' + id) {
        st.confirm = 'del' + id;
        drawProjects();
        clearTimeout(ui.pjt);
        ui.pjt = setTimeout(() => {
          if (st.confirm === 'del' + id) {
            st.confirm = null;
            drawProjects();
          }
        }, 3500);
        return;
      }
      st.confirm = null;
      const wasOpen = id === PJ.id;
      if (wasOpen) {
        clearTimeout(P.timer);
        P.dirty.clear();
        PJ.id = null;
      }
      await DESK.trash(id);
      st.list = await DESK.list();
      if (wasOpen) {
        if (st.list.length) await deskOpen(st.list[0].id);
        else await deskNew('blank');
        st.list = await DESK.list();
      }
      drawProjects();
      toast('Moved to your computer’s trash. You can still get it back from there.', { plain: true });
    }
  } catch (e) {
    toast('Something went wrong: ' + ((e && e.message) || e), { plain: true });
  }
}
