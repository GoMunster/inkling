/*
 * 28-tour-todo.js: The first-run tour and today's to-do list
 *
 * The tour: a few coach marks pointing at the main parts of the screen, shown once per device. The to-do list
 * (meta.todo, personal): tasks for today in the Inkling panel. Some tick themselves (reach the daily goal, finish a
 * focus sprint, mark a scene Final); unfinished tasks carry over to the next day.
 */
// A few coach marks, shown once per device (localStorage 'inkling:tour'); Show the tour replays them.
const TOUR = [
  [
    null,
    'Welcome to Inkling',
    'A place to write your novel and keep track of everything in it. This takes a few seconds; you can replay it from the menu any time.'
  ],
  [
    '#binder',
    'Your book',
    'Chapters and scenes live here, with pages for your characters, places and things, plus timelines, outlines and notes. Choose which sections you use at the bottom of this list.'
  ],
  [
    '#main',
    'Write',
    'Open a scene and write. Names that have a page link themselves, so you can jump to a character’s notes mid-sentence.'
  ],
  [
    '#insp',
    'Your writing pet',
    'It grows with every new word you write. The focus timer is here too, and it records each writing session.'
  ],
  [
    '#goalChip',
    'Daily goal',
    'Your words today against your daily goal. You can change the goal in the panel under your pet.'
  ],
  [
    '#menuBtn',
    'Everything else',
    'Export to Word, PDF or EPUB, find and replace, settings, writing history and backups.'
  ]
];
// Starts the tour (once per device unless force).
function startTour(force) {
  try {
    if (!force && localStorage.getItem('inkling:tour')) return;
    localStorage.setItem('inkling:tour', '1');
  } catch (e) {
    if (!force) return;
  }
  let i = 0;
  endTour();
  const ring = document.createElement('div');
  ring.className = 'tour-ring';
  ring.id = 'tourRing';
  const bub = document.createElement('div');
  bub.className = 'tour';
  bub.id = 'tour';
  bub.setAttribute('role', 'dialog');
  bub.setAttribute('aria-live', 'polite');
  document.body.append(ring, bub);
  const show = () => {
    const st = TOUR[i],
      t = st[0] && $(st[0]),
      r = t && t.getBoundingClientRect(),
      vis = r && r.width > 20 && r.height > 20 && r.bottom > 0 && r.top < innerHeight;
    bub.innerHTML =
      '<b>' +
      esc(st[1]) +
      '</b><p>' +
      esc(st[2]) +
      '</p><div class="tour-f"><span class="muted">' +
      (i + 1) +
      ' of ' +
      TOUR.length +
      '</span>' +
      (i < TOUR.length - 1
        ? '<button class="btn sm" data-t="end">Skip</button><button class="btn sm pri" data-t="next">Next</button>'
        : '<button class="btn sm pri" data-t="end">Start writing</button>') +
      '</div>';
    ring.hidden = !vis;
    if (vis) {
      const pad = 4,
        x = Math.max(2, r.left - pad),
        y = Math.max(2, r.top - pad),
        w = Math.min(innerWidth - 4, r.right + pad) - x,
        h = Math.min(innerHeight - 4, r.bottom + pad) - y;
      Object.assign(ring.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      const bw = Math.min(320, innerWidth - 32),
        bh = bub.offsetHeight;
      let bx, by;
      if (r.right + 16 + bw < innerWidth) {
        bx = r.right + 12;
        by = r.top + 12;
      } // right of the target
      else if (r.left - 16 - bw > 0) {
        bx = r.left - 12 - bw;
        by = r.top + 12;
      } // left of it
      else {
        bx = r.left + r.width / 2 - bw / 2;
        by = r.bottom + 12;
        if (by + bh > innerHeight - 16) by = r.top + 16;
      } // below, or inside near the top
      Object.assign(bub.style, {
        left: Math.max(16, Math.min(innerWidth - bw - 16, bx)) + 'px',
        top: Math.max(16, Math.min(innerHeight - bh - 16, by)) + 'px'
      });
    } else
      Object.assign(bub.style, {
        left: Math.max(16, (innerWidth - bub.offsetWidth) / 2) + 'px',
        top: Math.max(16, (innerHeight - bub.offsetHeight) / 2) + 'px'
      });
    const f = $('[data-t="next"],[data-t="end"].pri', bub);
    if (f) f.focus({ preventScroll: true });
  };
  bub.addEventListener('click', e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    if (b.dataset.t === 'next') {
      i++;
      show();
    } else endTour();
  });
  bub.addEventListener('keydown', e => {
    if (e.key === 'Escape') endTour();
  });
  ui.tourResize = () => show();
  addEventListener('resize', ui.tourResize);
  show();
}
// Ends the tour and remembers it was seen.
function endTour() {
  ['#tour', '#tourRing'].forEach(q => {
    const x = $(q);
    if (x) x.remove();
  });
  if (ui.tourResize) {
    removeEventListener('resize', ui.tourResize);
    ui.tourResize = null;
  }
}

/* ---------- today's to-do list ---------- */
// meta.todo = {d: day, items:[{id, text, done, old, auto, sc, c}]}. Personal, like the daily goal (it follows the
// writer on a shared project). On a new day finished tasks go and unfinished ones carry over (old: from an earlier day).
// auto: 'goal' ticks itself when the daily goal is reached, 'sprint' when a focus session ends, 'fin' when scene sc is
// marked Final. c: already counted towards Inky's List maker achievement.
const TODO_AUTO = {
  goal: 'Ticks itself when you reach today’s goal',
  sprint: 'Ticks itself when a focus session ends',
  fin: 'Ticks itself when the scene is marked Final'
};
// Checks today's to-do list.
function normTodo(t) {
  t = t && typeof t === 'object' ? t : {};
  return {
    d: /^\d{4}-\d{2}-\d{2}$/.test(t.d || '') ? t.d : todayKey(),
    items: (Array.isArray(t.items) ? t.items : [])
      .filter(x => x && x.id)
      .slice(0, 40)
      .map(x => {
        const o = { id: String(x.id).slice(0, 24), text: String(x.text || '').slice(0, 200), done: !!x.done };
        if (x.old) o.old = true;
        if (TODO_AUTO[x.auto]) o.auto = x.auto;
        if (x.auto === 'fin' && x.sc) o.sc = String(x.sc);
        if (x.c) o.c = 1;
        return o;
      })
  };
}
// On a new day: clears finished tasks and marks the ones carried over.
function todoRoll() {
  const t = S.meta.todo,
    k = todayKey();
  if (t.d === k) return false;
  t.items = t.items.filter(x => !x.done && !(x.auto === 'fin' && !S.meta.scenes[x.sc]));
  t.items.forEach(x => {
    x.old = true;
  });
  t.d = k;
  dirty('meta');
  return true;
}
// Ticks a task off and counts it for Inky.
function todoDone(x) {
  x.done = true;
  if (!x.c) {
    x.c = 1;
    S.meta.pet.tasks = (S.meta.pet.tasks || 0) + 1;
  }
  const it = S.meta.todo.items;
  if (it.length >= 2 && it.every(y => y.done))
    cheer(
      pick([
        'Everything on today’s list is done!',
        'To-do list: cleared. ' + S.meta.pet.name + ' is impressed.',
        'Every task ticked off. What a day!'
      ])
    );
  checkAch();
}
// Ticks the automatic tasks of one kind (called by credit(), pmEnd() and sceneFinal()).
function todoTick(kind, sc) {
  if (!S || !S.meta.todo) return;
  todoRoll();
  let n = 0;
  S.meta.todo.items.forEach(x => {
    if (!x.done && x.auto === kind && (kind !== 'fin' || x.sc === sc)) {
      todoDone(x);
      n++;
    }
  });
  if (n) {
    dirty('meta');
    drawTodo(n);
  }
}
// Suggested tasks to add with one click (only the ones not already on the list).
function todoIdeas() {
  const m = S.meta,
    it = m.todo.items,
    v = ui.view,
    out = [],
    has = t => it.some(x => x.text.toLowerCase() === t.toLowerCase());
  if (!it.some(x => x.auto === 'goal') && todayWords() < m.goal)
    out.push({ text: 'Write ' + fmt(m.goal) + ' words', auto: 'goal' });
  if (!it.some(x => x.auto === 'sprint')) out.push({ text: 'Do a focus sprint', auto: 'sprint' });
  if (
    v &&
    v.k === 'scene' &&
    m.scenes[v.id] &&
    m.scenes[v.id].status !== 'final' &&
    !it.some(x => x.auto === 'fin' && x.sc === v.id)
  )
    out.push({ text: 'Finish “' + trunc(m.scenes[v.id].title, 30) + '”', auto: 'fin', sc: v.id });
  ['Plan the next scene', 'Fill in a story page', 'Read back yesterday’s pages'].forEach(t => {
    if (!has(t)) out.push({ text: t });
  });
  return out.slice(0, 4);
}
// Draws the to-do list in the Inkling panel.
function drawTodo(justTicked) {
  const box = $('#tdBox');
  if (!box) return;
  todoRoll();
  const t = S.meta.todo,
    done = t.items.filter(x => x.done).length,
    ideas = t.items.length < 5 ? todoIdeas() : [];
  if (todayWords() >= S.meta.goal && t.items.some(x => !x.done && x.auto === 'goal')) {
    t.items.forEach(x => {
      if (!x.done && x.auto === 'goal') todoDone(x);
    });
    dirty('meta');
  }
  const n = $('#tdN');
  if (n) n.textContent = t.items.length ? done + ' of ' + t.items.length + ' done' : '';
  box.innerHTML =
    '<ul class="td-list" id="tdList">' +
    t.items
      .map(
        x =>
          '<li class="td' +
          (x.done ? ' done' : '') +
          '" data-id="' +
          x.id +
          '"><span class="td-grip" title="Drag to reorder" aria-hidden="true">' +
          ico('dots', 12) +
          '</span>' +
          '<input type="checkbox" class="td-ck"' +
          (x.done ? ' checked' : '') +
          ' aria-label="Done: ' +
          esc(x.text) +
          '">' +
          '<input class="td-t" value="' +
          esc(x.text) +
          '" maxlength="200" aria-label="Task">' +
          (x.old && !x.done ? '<i class="td-old" title="Carried over from an earlier day"></i>' : '') +
          (x.auto && !x.done ? '<span class="td-auto" title="' + esc(TODO_AUTO[x.auto]) + '">auto</span>' : '') +
          '<button class="ibtn" data-td="del" aria-label="Delete task" title="Delete task">' +
          ico('x', 13) +
          '</button></li>'
      )
      .join('') +
    '</ul>' +
    '<input class="td-new" id="tdNew" maxlength="200" placeholder="Add a task and press Enter" aria-label="New task">' +
    (ideas.length
      ? '<div class="td-ideas">' +
        ideas
          .map(
            (x, i) =>
              '<button class="td-idea" data-idea="' +
              i +
              '"' +
              (x.auto ? ' title="' + esc(TODO_AUTO[x.auto]) + '"' : '') +
              '>+ ' +
              esc(x.text) +
              '</button>'
          )
          .join('') +
        '</div>'
      : '') +
    (done ? '<div class="td-foot"><button class="btn sm" data-td="clear">Clear finished</button></div>' : '');
  box._ideas = ideas;
  if (justTicked) box.querySelectorAll('.td.done').forEach(li => li.classList.add('just'));
}
// Makes the to-do list work: add, tick, edit, delete, drag to reorder, add a suggestion.
function bindTodo() {
  const box = $('#tdBox');
  if (!box) return;
  const T2 = () => S.meta.todo,
    find = el => {
      const li = el.closest('.td');
      return li && T2().items.find(x => x.id === li.dataset.id);
    };
  const add = o => {
    const t = T2();
    if (t.items.length >= 40) {
      toast('That’s a long list! Finish a few first.', { plain: true });
      return false;
    }
    t.items.push(
      Object.assign(
        { id: uid('td_'), text: o.text.slice(0, 200), done: false },
        o.auto ? { auto: o.auto } : {},
        o.sc ? { sc: o.sc } : {}
      )
    );
    dirty('meta');
    return true;
  };
  box.addEventListener('change', e => {
    if (!e.target.classList.contains('td-ck')) return;
    const x = find(e.target);
    if (!x) return;
    if (e.target.checked) {
      todoDone(x);
      dirty('meta');
      drawTodo();
      const li = box.querySelector('.td[data-id="' + x.id + '"]');
      if (li) li.classList.add('just');
    } else {
      x.done = false;
      dirty('meta');
      drawTodo();
    }
  });
  box.addEventListener('input', e => {
    if (!e.target.classList.contains('td-t')) return;
    const x = find(e.target);
    if (!x) return;
    x.text = e.target.value.slice(0, 200);
    dirty('meta');
  });
  box.addEventListener('focusout', e => {
    if (!e.target.classList.contains('td-t')) return;
    const x = find(e.target);
    if (x && !x.text.trim()) {
      T2().items = T2().items.filter(y => y !== x);
      dirty('meta');
      setTimeout(drawTodo, 0);
    }
  });
  box.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'tdNew') {
      e.preventDefault();
      const v = e.target.value.trim();
      if (!v) return;
      if (add({ text: v })) {
        drawTodo();
        const nb = $('#tdNew');
        if (nb) nb.focus();
      }
    } else if (e.target.classList.contains('td-t')) {
      e.preventDefault();
      const nb = $('#tdNew');
      if (nb) nb.focus();
    }
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-td],[data-idea]');
    if (!b) return;
    if (b.dataset.idea != null) {
      const o = (box._ideas || [])[+b.dataset.idea];
      if (o && add(o)) drawTodo();
      return;
    }
    if (b.dataset.td === 'del') {
      const x = find(b);
      if (x) {
        T2().items = T2().items.filter(y => y !== x);
        dirty('meta');
        drawTodo();
      }
    } else if (b.dataset.td === 'clear') {
      T2().items = T2().items.filter(y => !y.done);
      dirty('meta');
      drawTodo();
    }
  });
  dragSort(box, {
    item: '.td',
    handle: '.td-grip',
    drop: (it, ref) => {
      if (moveInList(T2().items, it.dataset.id, ref && ref.dataset.id)) {
        dirty('meta');
        drawTodo();
      }
    }
  });
}
