/*
 * 17-binder-menus.js: Right-click menus, word targets, duplicates, and story page fields
 *
 * Right-clicking a scene, chapter or story page in the binder opens a menu (binderMenu) with everything that can be
 * done to it: rename, duplicate, move, set a word target, open side by side, delete. This file also holds the dialog
 * for typing a value (askValue), the duplicate functions, the editor for a project's own story page fields
 * (entFields, fieldsEditHtml), and dropping or pasting a picture onto a page.
 */
// ctxMenu(x, y, items): items are [label, fn, opts] (opts.danger, opts.on for a tick, opts.sub: a list shown in its
// place), or '-' for a line. Closes on a click elsewhere, Escape or scrolling.
function ctxClose() {
  const x = $('#ctx');
  if (x) x.remove();
}
// Opens a menu at x, y. items: [label, fn, {danger, on, sub}] or '-' for a dividing line.
function ctxMenu(x, y, items, title) {
  ctxClose();
  const box = document.createElement('div');
  box.id = 'ctx';
  box.className = 'ctx';
  box.setAttribute('role', 'menu');
  const draw = (list, head, back) => {
    box.innerHTML =
      (head
        ? '<div class="ctx-h">' +
          (back ? '<button class="ctx-back" data-back="1" aria-label="Back">' + ico('back', 13) + '</button>' : '') +
          '<span>' +
          esc(head) +
          '</span></div>'
        : '') +
      list
        .map((it, i) =>
          it === '-'
            ? '<hr>'
            : '<button role="menuitem" data-i="' +
              i +
              '" class="' +
              (it[2] && it[2].danger ? 'warn' : '') +
              '">' +
              (it[2] && it[2].on ? '✓ ' : '') +
              esc(it[0]) +
              (it[2] && it[2].sub ? ' ›' : '') +
              '</button>'
        )
        .join('');
    box.onclick = e => {
      e.stopPropagation();
      if (e.target.closest('[data-back]')) {
        draw(items, title);
        return;
      }
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const it = list[+b.dataset.i];
      if (it[2] && it[2].sub) {
        draw(it[2].sub, it[0], true);
        return;
      }
      ctxClose();
      it[1]();
    };
    const f = box.querySelector('button[data-i]');
    if (f) f.focus();
  };
  document.body.appendChild(box);
  draw(items, title);
  const r = box.getBoundingClientRect();
  box.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  box.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  box.addEventListener('keydown', e => {
    const bs = [...box.querySelectorAll('button[data-i]')],
      i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length];
      if (n) n.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      ctxClose();
    }
  });
  setTimeout(() => {
    const off = e => {
      if (!box.contains(e.target)) {
        ctxClose();
        document.removeEventListener('pointerdown', off, true);
      }
    };
    document.addEventListener('pointerdown', off, true);
  }, 0);
}
// A small dialog asking for one value (a word target): resolves to the text typed, or null when cancelled.
function askValue(title, label, value, hint) {
  return new Promise(res => {
    const ov = document.createElement('div');
    ov.className = 'pj-ov ask-ov';
    ov.innerHTML =
      '<div class="pj-dlg ask" role="dialog" aria-modal="true"><h2>' +
      esc(title) +
      '</h2><label class="f">' +
      esc(label) +
      '<input id="askVal" inputmode="numeric" value="' +
      esc(value) +
      '"></label>' +
      (hint ? '<p class="fine">' + esc(hint) + '</p>' : '') +
      '<div class="ask-btns"><button class="btn" data-v="">Cancel</button><button class="btn pri" data-v="ok">Save</button></div></div>';
    const inp = () => $('#askVal', ov),
      done = v => {
        const val = v === 'ok' ? inp().value : null;
        ov.remove();
        res(val);
      };
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (b) done(b.dataset.v);
    });
    ov.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        done('ok');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        done('');
      }
    });
    document.body.appendChild(ov);
    inp().focus();
    inp().select();
  });
}
// A small progress bar towards a word target (empty when there is no target).
const tgBar = (w, g) =>
  g
    ? '<i class="tg' + (w >= g ? ' met' : '') + '" style="--p:' + Math.min(100, (w / g) * 100).toFixed(1) + '%"></i>'
    : ''; // a word target's thin bar in the binder
// Asks for a word target for a scene or chapter and saves it (0 removes it).
function setTarget(kind, id) {
  const m = S.meta,
    o = kind === 'scene' ? m.scenes[id] : m.chapters.find(c => c.id === id);
  if (!o) return;
  askValue(
    'Word target',
    (kind === 'scene' ? 'Words for “' : 'Words for the chapter “') + (o.title || '') + '”',
    o.goal || '',
    o.goal
      ? 'Leave it empty to remove the target.'
      : 'A target shows as a bar in the binder, and ' + m.pet.name + ' cheers when you reach it.'
  ).then(v => {
    if (v == null) return;
    const n = Math.round(+String(v).replace(/[^\d]/g, '') || 0);
    if (n > 0) o.goal = Math.min(1000000, n);
    else delete o.goal;
    dirty('meta');
    renderBinder();
    if (ui.view.k === 'scene') paintSceneWc();
    renderInspector();
  });
}
// Duplicates a scene (text, notes, details) just after it, or into another chapter.
function dupScene(id, toCh, at) {
  const m = S.meta,
    c = toCh || m.chapters.find(x => x.scenes.includes(id)),
    sid = uid('s_'),
    s = m.scenes[id],
    d = S.sc[id];
  if (!s || !c) return null;
  m.scenes[sid] = Object.assign(bare(s), { title: toCh ? s.title : s.title + ' (copy)' });
  S.sc[sid] = Object.assign(bare(d), {
    stickies: (d.stickies || []).map(n => Object.assign({}, n, { id: uid('k_') }))
  });
  c.scenes.splice(at != null ? at : c.scenes.indexOf(id) + 1, 0, sid);
  dirty('meta', 'sc_' + sid);
  return sid;
}
// Duplicates a chapter with copies of all its scenes.
function dupChapter(id) {
  const m = S.meta,
    c = m.chapters.find(x => x.id === id);
  if (!c) return;
  const nc = { id: uid('c_'), title: c.title + ' (copy)', open: true, scenes: [] };
  if (c.goal) nc.goal = c.goal;
  m.chapters.splice(m.chapters.indexOf(c) + 1, 0, nc);
  S.ch[nc.id] = bare(S.ch[id] || { notes: '' });
  dirty('ch_' + nc.id);
  c.scenes.forEach(s => dupScene(s, nc, nc.scenes.length));
  dirty('meta');
  renderBinder();
  toast('Chapter copied, with its ' + c.scenes.length + ' scene' + (c.scenes.length === 1 ? '' : 's') + '.', {
    plain: true
  });
}
// Duplicates a story page (without its picture, which belongs to the original).
function dupEnt(id) {
  const m = S.meta,
    e = m.ents[id];
  if (!e) return;
  const nid = uid('e_');
  m.ents[nid] = Object.assign(bare(e), { id: nid, name: e.name + ' (copy)', aliases: [] });
  S.en[nid] = { fields: bare((S.en[id] || {}).fields || {}), pic: normPic() };
  if (S.en[id] && S.en[id].arc) S.en[nid].arc = bare(S.en[id].arc); // the picture stays with the original
  dirty('meta', 'en_' + nid);
  linker = buildLinker();
  go({ k: 'ent', id: nid });
}
// Duplicates a timeline, outline, note, map or tree.
function dupDoc(k, id) {
  if (k === 'tl') {
    addTimeline(id);
    return;
  }
  const list = S.meta[k + 's'],
    it = list.find(x => x.id === id);
  if (!it) return;
  const nid = uid(k + '_');
  S[k][nid] = bare(S[k][id]);
  if (S[k][nid].pic) S[k][nid].pic = normPic();
  list.splice(list.indexOf(it) + 1, 0, Object.assign(bare(it), { id: nid, name: it.name + ' (copy)' }));
  dirty('meta', k + '_' + nid);
  go({ k, id: nid });
}
// The right-click menu for a scene, chapter or story page in the binder.
function binderMenu(e) {
  const row = e.target.closest('.sc-row,.ch-row,.e-row');
  if (!row) return;
  e.preventDefault();
  const m = S.meta,
    x = e.clientX || row.getBoundingClientRect().left + 40,
    y = e.clientY || row.getBoundingClientRect().bottom,
    all = v => {
      m.chapters.forEach(c => {
        c.open = v;
      });
      dirty('meta');
      renderBinder();
    };
  const fold = [
    m.chapters.some(c => c.open) ? 'Collapse all chapters' : 'Expand all chapters',
    () => all(!m.chapters.some(c => c.open))
  ];
  if (row.classList.contains('sc-row')) {
    const id = row.dataset.sid,
      s = m.scenes[id],
      here = m.chapters.find(c => c.scenes.includes(id));
    ctxMenu(
      x,
      y,
      [
        ['Open', () => go({ k: 'scene', id })],
        ['Open side by side', () => splitOpen({ k: 'scene', id })],
        '-',
        [
          'Rename',
          () => {
            ui.rename = id;
            renderBinder();
          }
        ],
        [
          'Duplicate',
          () => {
            const n = dupScene(id);
            renderBinder();
            if (n) toast('Scene copied.', { plain: true });
          }
        ],
        [
          'Move to chapter',
          null,
          { sub: m.chapters.map(c => [c.title, () => moveSceneTo(id, c.id, null), { on: c === here }]) }
        ],
        [
          'Status',
          null,
          {
            sub: Object.keys(STATUS).map(k => [
              STATUS[k],
              () => {
                s.status = k;
                dirty('meta');
                renderBinder();
                if (ui.view.k === 'scene' && ui.view.id === id) renderMain();
                if (k === 'final') sceneFinal(id);
              },
              { on: s.status === k }
            ])
          }
        ],
        ['Word target…', () => setTarget('scene', id)],
        '-',
        fold,
        '-',
        ['Move to Trash', () => delScene(id), { danger: true }]
      ],
      s.title
    );
  } else if (row.classList.contains('ch-row')) {
    const id = row.closest('.ch-block').dataset.ch,
      c = m.chapters.find(z => z.id === id);
    ctxMenu(
      x,
      y,
      [
        [
          'Open on the corkboard',
          () => {
            ui.cork = id;
            go({ k: 'cork' });
          }
        ],
        ['Add a scene', () => addScene(id, true)],
        '-',
        [
          'Rename',
          () => {
            ui.rename = id;
            renderBinder();
          }
        ],
        ['Duplicate', () => dupChapter(id)],
        ['Word target…', () => setTarget('chapter', id)],
        '-',
        fold,
        '-',
        ['Move to Trash', () => delChapter(id), { danger: true }]
      ],
      c.title
    );
  } else {
    const b = row.querySelector('.e-btn'),
      a = b.dataset.a,
      id = b.dataset.id,
      k = a === 'open-e' ? 'ent' : a.slice(5);
    if (k === 'ent') {
      const e2 = m.ents[id];
      ctxMenu(
        x,
        y,
        [
          ['Open', () => go({ k: 'ent', id })],
          ['Open side by side', () => splitOpen({ k: 'ent', id })],
          '-',
          [
            'Rename',
            () => {
              ui.focusName = true;
              go({ k: 'ent', id });
            }
          ],
          ['Duplicate', () => dupEnt(id)],
          [
            'Change to',
            null,
            {
              sub: TYPE_ORDER.map(t => [
                LS(t),
                () => {
                  e2.type = t;
                  ui.openSec[t] = true;
                  dirty('meta');
                  renderBinder();
                  if (ui.view.k === 'ent' && ui.view.id === id) renderMain();
                },
                { on: e2.type === t }
              ])
            }
          ],
          '-',
          ['Move to Trash', () => delEntity(id), { danger: true }]
        ],
        e2.name
      );
    } else {
      const it = m[k + 's'].find(z => z.id === id);
      ctxMenu(
        x,
        y,
        [['Open', () => go({ k, id })]].concat(
          SPLIT_KINDS.includes(k) ? [['Open side by side', () => splitOpen({ k, id })]] : [],
          [
            '-',
            [
              'Rename',
              () => {
                ui.focusName = true;
                go({ k, id });
              }
            ],
            ['Duplicate', () => dupDoc(k, id)],
            '-',
            ['Move to Trash', () => (k === 'tl' ? delTimeline(id) : delDocItem(k, id)), { danger: true }]
          ]
        ),
        it ? it.name : ''
      );
    }
  }
}

/* ---------- story pages: your own fields, and pictures dropped or pasted ---------- */
// meta.fields{char|place|thing: [[key,label]]} replaces TYPES[t].fields for this project when set (entFields).
// Removing a field hides it; what was written in it stays in en.fields and comes back if the field does.
const entFields = t => (S.meta.fields && S.meta.fields[t]) || (TYPES[t] || TYPES.thing).fields;
// Checks a project's own story page fields.
function normFields(x) {
  const out = {};
  if (!x || typeof x !== 'object') return out;
  Object.keys(TYPES).forEach(t => {
    if (!Array.isArray(x[t])) return;
    const seen = new Set();
    out[t] = x[t]
      .filter(
        f => Array.isArray(f) && /^[\w-]{1,24}$/.test(f[0]) && f[0] !== 'facts' && !seen.has(f[0]) && seen.add(f[0])
      )
      .slice(0, 40)
      .map(f => [f[0], String(f[1] || 'Field').slice(0, 60)]);
  });
  return out;
}
// The editor for a kind of page's fields: rename, reorder, add and remove.
function fieldsEditHtml(t) {
  return (
    '<div class="fe"><p class="fine">These fields are on every ' +
    esc(LS(t).toLowerCase()) +
    ' page in this project. Removing one hides it; anything written in it is kept.</p><div class="fe-list">' +
    entFields(t)
      .map(
        (f, i, a) =>
          '<div class="fe-row" data-key="' +
          esc(f[0]) +
          '"><input value="' +
          esc(f[1]) +
          '" maxlength="60" aria-label="Field name"><button class="ibtn" data-fe="up"' +
          (i ? '' : ' disabled') +
          ' aria-label="Move up">' +
          ico('up', 13) +
          '</button><button class="ibtn" data-fe="down"' +
          (i < a.length - 1 ? '' : ' disabled') +
          ' aria-label="Move down">' +
          ico('down', 13) +
          '</button><button class="ibtn" data-fe="del" aria-label="Remove field">' +
          ico('x', 13) +
          '</button></div>'
      )
      .join('') +
    '</div><div class="ts-row"><button class="btn sm" data-fe="add">' +
    ico('plus', 13) +
    '<span>Add a field</span></button>' +
    (S.meta.fields && S.meta.fields[t]
      ? '<button class="btn sm" data-fe="reset">Back to the standard fields</button>'
      : '') +
    '<button class="btn sm pri" data-fe="done">Done</button></div></div>'
  );
}
// Makes the fields editor work.
function bindFieldsEdit(el, e, v) {
  const box = $('.fields-box', el);
  if (!box) return;
  const t = e.type;
  const cur = () => {
    S.meta.fields = S.meta.fields || {};
    return (S.meta.fields[t] = S.meta.fields[t] || entFields(t).map(f => f.slice()));
  };
  box.addEventListener('click', ev => {
    const b = ev.target.closest('[data-fe]');
    if (!b) return;
    const a = b.dataset.fe;
    if (a === 'edit') {
      ui.fEdit = t;
      renderEnt(el, v);
      return;
    }
    if (a === 'done') {
      ui.fEdit = null;
      renderEnt(el, v);
      return;
    }
    if (a === 'reset') {
      delete S.meta.fields[t];
      dirty('meta');
      renderEnt(el, v);
      return;
    }
    if (a === 'add') {
      cur().push(['f' + uid('').slice(-7), 'New field']);
      dirty('meta');
      renderEnt(el, v);
      const ins = el.querySelectorAll('.fe-row input');
      const last = ins[ins.length - 1];
      if (last) {
        last.focus();
        last.select();
      }
      return;
    }
    const row = b.closest('.fe-row'),
      list = cur(),
      i = list.findIndex(f => f[0] === row.dataset.key);
    if (i < 0) return;
    if (a === 'del') list.splice(i, 1);
    else {
      const j = i + (a === 'up' ? -1 : 1);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    }
    dirty('meta');
    renderEnt(el, v);
  });
  box.addEventListener('input', ev => {
    const row = ev.target.closest('.fe-row');
    if (!row) return;
    const f = cur().find(x => x[0] === row.dataset.key);
    if (f) {
      f[1] = ev.target.value.slice(0, 60) || 'Field';
      dirty('meta');
    }
  });
}
// Lets a picture be dropped or pasted onto a story page.
function bindPicDrop(el, e) {
  const page = $('.ent-page', el);
  if (!page) return;
  const img = list => [...(list || [])].find(f => /^image\//.test(f.type));
  page.addEventListener('dragover', ev => {
    if ([...(ev.dataTransfer.items || [])].some(i => i.kind === 'file')) {
      ev.preventDefault();
      page.classList.add('drop');
    }
  });
  page.addEventListener('dragleave', ev => {
    if (!page.contains(ev.relatedTarget)) page.classList.remove('drop');
  });
  page.addEventListener('drop', ev => {
    page.classList.remove('drop');
    const f = img(ev.dataTransfer.files);
    if (!f) return;
    ev.preventDefault();
    setPic(e.id, f);
  });
  page.addEventListener('paste', ev => {
    const cd = ev.clipboardData,
      f = cd && img(cd.files);
    if (!f || (cd.getData('text/plain') || '').trim()) return;
    ev.preventDefault();
    setPic(e.id, f);
  });
}
