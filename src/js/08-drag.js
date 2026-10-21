/*
 * 08-drag.js: Drag to reorder
 *
 * One small engine for every list that can be rearranged by dragging: scenes and chapters in the binder, planning
 * lists, corkboard cards, outline lines and brainstorm ideas. Mouse drags start after a few pixels; touch needs a
 * short press and hold so lists still scroll. moveSceneTo() and moveInList() apply the result.
 */
// dragSort(root, {item, handle?, zones?, grid?, drop(el, beforeEl|null, zoneEl)}): mouse drags after a few pixels,
// touch after a short press and hold, so lists still scroll. A bar shows where the item will land.
function dragSort(root, o) {
  if (root['_ds' + o.item]) return;
  root['_ds' + o.item] = 1;
  root.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const it = e.target.closest(o.item);
    if (!it || !root.contains(it)) return;
    if (
      e.target.closest('input,textarea,select,[contenteditable],.no-drag') ||
      (o.handle && !e.target.closest(o.handle))
    )
      return;
    const touch = e.pointerType !== 'mouse',
      x0 = e.clientX,
      y0 = e.clientY,
      r0 = it.getBoundingClientRect();
    let on = false,
      ghost = null,
      bar = null,
      tgt = null,
      timer = null,
      raf = 0,
      last = null;
    const zonesOf = () => (o.zones ? [...root.querySelectorAll(o.zones)] : [root]);
    const start = () => {
      on = true;
      it.classList.add('dragging');
      document.body.classList.add('dnd');
      ghost = it.cloneNode(true);
      ghost.classList.add('drag-ghost');
      Object.assign(ghost.style, { width: r0.width + 'px', left: r0.left + 'px', top: r0.top + 'px' });
      document.body.appendChild(ghost);
      bar = document.createElement('div');
      bar.className = 'drop-bar' + (o.grid ? ' v' : '');
      document.body.appendChild(bar);
    };
    const find = (x, y) => {
      const under = document.elementFromPoint(x, y);
      let zone = under && (o.zones ? under.closest(o.zones) : root.contains(under) ? root : null);
      if (zone && !root.contains(zone)) zone = null;
      if (!zone) return null;
      const items = [...zone.querySelectorAll(o.item)].filter(
        x2 => x2 !== it && (o.zones ? x2.parentElement.closest(o.zones) === zone : true) && !it.contains(x2)
      );
      for (const x2 of items) {
        const r = x2.getBoundingClientRect();
        if (o.grid) {
          if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) return { zone, ref: x2, r };
        } else if (y < r.top + r.height / 2) return { zone, ref: x2, r };
      }
      const lastEl = items[items.length - 1];
      return {
        zone,
        ref: null,
        r: lastEl ? lastEl.getBoundingClientRect() : zone.getBoundingClientRect(),
        end: !!lastEl
      };
    };
    const paint = () => {
      raf = 0;
      if (!last) return;
      const { x, y } = last;
      ghost.style.transform = 'translate(' + (x - x0) + 'px,' + (y - y0) + 'px) rotate(1deg)';
      tgt = find(x, y);
      if (!tgt) {
        bar.style.display = 'none';
        return;
      }
      const r = tgt.r;
      bar.style.display = 'block';
      if (o.grid)
        Object.assign(bar.style, {
          left: (tgt.ref ? r.left : r.right) - 3 + 'px',
          top: r.top + 'px',
          height: r.height + 'px',
          width: '4px'
        });
      else
        Object.assign(bar.style, {
          left: r.left + 'px',
          width: r.width + 'px',
          top: (tgt.ref ? r.top : tgt.end ? r.bottom : r.top + 4) - 2 + 'px',
          height: '4px'
        });
      const sc = o.scroll ? o.scroll() : root,
        sr = sc.getBoundingClientRect();
      if (y < sr.top + 40) sc.scrollTop -= 12;
      else if (y > sr.bottom - 40) sc.scrollTop += 12;
    };
    const move = m => {
      if (!on) {
        const d = Math.hypot(m.clientX - x0, m.clientY - y0);
        if (touch) {
          if (d > 10) end();
          return;
        }
        if (d < 6) return;
        start();
      }
      m.preventDefault();
      last = { x: m.clientX, y: m.clientY };
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const tm = ev => {
      if (on) ev.preventDefault();
    };
    const end = () => {
      clearTimeout(timer);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', end);
      document.removeEventListener('touchmove', tm);
      if (raf) cancelAnimationFrame(raf);
      if (ghost) ghost.remove();
      if (bar) bar.remove();
      it.classList.remove('dragging');
      document.body.classList.remove('dnd');
    };
    const up = () => {
      const was = on,
        t = tgt;
      end();
      if (!was) return;
      document.addEventListener(
        'click',
        ev => {
          ev.stopPropagation();
          ev.preventDefault();
        },
        { capture: true, once: true }
      );
      setTimeout(() => document.dispatchEvent(new Event('click')), 0);
      if (t) o.drop(it, t.ref, t.zone);
    };
    if (touch)
      timer = setTimeout(() => {
        start();
        last = { x: x0, y: y0 };
        paint();
        if (navigator.vibrate) navigator.vibrate(8);
      }, 330);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', end);
    document.addEventListener('touchmove', tm, { passive: false });
  });
}
// Moves a scene into a chapter, before another scene (or to the end).
function moveSceneTo(id, chId, beforeId) {
  const cs = S.meta.chapters,
    to = cs.find(c => c.id === chId);
  if (!to || id === beforeId) return;
  cs.forEach(c => {
    const i = c.scenes.indexOf(id);
    if (i >= 0) c.scenes.splice(i, 1);
  });
  const j = beforeId ? to.scenes.indexOf(beforeId) : -1;
  to.scenes.splice(j < 0 ? to.scenes.length : j, 0, id);
  to.open = true;
  dirty('meta');
  renderBinder();
  if (ui.view.k === 'cork') renderMain();
}
// Moves the item with this id in a list to just before another item (or to the end).
function moveInList(arr, id, beforeId, key) {
  key = key || (x => x.id);
  const i = arr.findIndex(x => key(x) === id);
  if (i < 0 || id === beforeId) return false;
  const [x] = arr.splice(i, 1);
  const j = beforeId ? arr.findIndex(y => key(y) === beforeId) : -1;
  arr.splice(j < 0 ? arr.length : j, 0, x);
  return true;
}
