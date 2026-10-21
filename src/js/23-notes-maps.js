/* ---------- main: notes and brainstorm boards ---------- */
const NT_COLORS = ['thing', 'pet', 'char', 'accent', 'place', 'muted'];
function namesHtml(text) {
  const seen = [];
  findLinks(text).forEach(l => {
    if (!seen.includes(l.id)) seen.push(l.id);
  });
  return seen
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
    .join('');
}
/* ---------- world maps: a note of kind 'map' ---------- */
// S.nt[id] for a map also holds pic (the map image, stored like a story page picture; none = blank parchment),
// pins[{id,ent,name,x,y,color,note}] (x, y: 0–1000 across and down the map; ent links a story page),
// ink[{c,w,p}] (pen strokes: colour token, width, "x,y x,y…" in the same 0–1000 units) and pinSize.
// The view (pan and zoom) is per device in ui.mpView; ui.mpSel is the selected pin, ui.mpMode 'move'|'pin'|'draw'.
const MP_W = 1500,
  MP_H = 1000; // the blank parchment's size
const mpName = pn => (pn.ent && S.meta.ents[pn.ent] ? S.meta.ents[pn.ent].name : pn.name || 'Pin');
function normMap(d, ents) {
  d = d && typeof d === 'object' ? d : {};
  const c = v => Math.max(0, Math.min(1000, Math.round(+v || 0)));
  return {
    pic: normPic(d.pic),
    pinSize: [0, 1, 2].includes(d.pinSize) ? d.pinSize : 1,
    pins: (Array.isArray(d.pins) ? d.pins : [])
      .filter(p => p && /^[\w-]{1,40}$/.test(p.id))
      .slice(0, 500)
      .map(p => ({
        id: p.id,
        ent: typeof p.ent === 'string' && (!ents || ents[p.ent]) ? p.ent : '',
        name: String(p.name || '').slice(0, 80),
        x: c(p.x),
        y: c(p.y),
        color: colOk(p.color) ? p.color : '',
        note: String(p.note || '').slice(0, 2000)
      })),
    ink: (Array.isArray(d.ink) ? d.ink : [])
      .filter(k => k && typeof k.p === 'string' && /^[\d., ]+$/.test(k.p))
      .slice(-3000)
      .map(k => ({ c: colOk(k.c) ? k.c : 'ink', w: [1, 2, 4, 8].includes(k.w) ? k.w : 2, p: k.p.slice(0, 20000) }))
  };
}
const mpCol = pn =>
  pn.color
    ? cssCol(pn.color)
    : pn.ent && S.meta.ents[pn.ent]
      ? 'var(--' + S.meta.ents[pn.ent].type + ')'
      : 'var(--danger)';
const mpInk = c => (c === 'ink' ? '#2b2118' : cssCol(c));
function mpScenesAt(entId) {
  return entId ? orderedScenes().filter(o => S.meta.scenes[o.id].place === entId) : [];
}
function renderMap(el, v, x, d) {
  const src = picSrc(v.id),
    mode = ui.mpMode || 'move',
    sel = d.pins.find(p => p.id === ui.mpSel);
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('map', 16) +
    '</span>' +
    '<input id="ntName" class="title-in" value="' +
    esc(x.name) +
    '" maxlength="80" aria-label="Map name">' +
    '<div class="mp-tools"><div class="seg" role="group" aria-label="Tool">' +
    [
      ['move', 'Move', 'fit'],
      ['pin', 'Add pin', 'pin'],
      ['draw', 'Draw', 'pen2']
    ]
      .map(
        ([k, l, i]) =>
          '<button data-mp="mode" data-v="' +
          k +
          '"' +
          (mode === k ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') +
          '>' +
          ico(i, 13) +
          '<span>' +
          l +
          '</span></button>'
      )
      .join('') +
    '</div>' +
    '<button class="ibtn" data-mp="zout" aria-label="Zoom out" title="Zoom out">' +
    ico('minus', 16) +
    '</button><button class="ibtn" data-mp="zin" aria-label="Zoom in" title="Zoom in">' +
    ico('plus', 16) +
    '</button><button class="btn sm" data-mp="fit">' +
    ico('fit', 14) +
    '<span>Fit</span></button>' +
    '<button class="btn sm" data-mp="pick">' +
    ico('upload', 14) +
    '<span>' +
    (src ? 'Replace map' : 'Upload a map') +
    '</span></button></div></div>' +
    (mode === 'draw'
      ? '<div class="mp-pen"><span class="sws">' +
        ['ink', 'danger', 'accent', 'place', 'thing', 'char']
          .map(
            c =>
              '<button class="sw' +
              ((ui.mpPen || 'ink') === c ? ' on' : '') +
              '" data-mp="pen" data-c="' +
              c +
              '" style="--c:' +
              mpInk(c) +
              '" aria-label="Pen colour"></button>'
          )
          .join('') +
        '</span>' +
        '<span class="seg">' +
        [1, 2, 4, 8]
          .map(
            w =>
              '<button data-mp="pw" data-v="' +
              w +
              '"' +
              ((ui.mpW || 2) === w ? ' class="on"' : '') +
              '>' +
              (w === 1 ? 'Fine' : w === 2 ? 'Pen' : w === 4 ? 'Marker' : 'Brush') +
              '</button>'
          )
          .join('') +
        '</span>' +
        '<button class="btn sm" data-mp="undo"' +
        (d.ink.length ? '' : ' disabled') +
        '>' +
        ico('undo', 14) +
        '<span>Undo stroke</span></button><button class="btn sm' +
        (ui.confirm === 'mpclear' ? ' danger' : '') +
        '" data-mp="clear"' +
        (d.ink.length ? '' : ' disabled') +
        '>' +
        (ui.confirm === 'mpclear' ? 'Clear the drawing?' : 'Clear drawing') +
        '</button></div>'
      : '') +
    '<div class="mp-wrap"><div class="mp-stage m-' +
    mode +
    '" id="mpStage" tabindex="0" aria-label="Map. Drag to move around, scroll or pinch to zoom.">' +
    '<div class="mp-world" id="mpWorld">' +
    (src
      ? '<img id="mpImg" src="' + esc(src) + '" alt="' + esc(x.name) + '" draggable="false">'
      : '<div class="mp-blank" id="mpImg" data-w="' + MP_W + '" data-h="' + MP_H + '"></div>') +
    '<svg class="mp-ink" id="mpInk" viewBox="0 0 1000 1000" preserveAspectRatio="none">' +
    d.ink.map(k => '<polyline points="' + k.p + '" stroke="' + mpInk(k.c) + '" stroke-width="' + k.w + '"/>').join('') +
    '</svg>' +
    '<div class="mp-pins" id="mpPins"></div></div>' +
    (!src && !d.pins.length && !d.ink.length
      ? '<div class="mp-hint"><b>Drop a map here</b><span>Upload a map you drew, scanned or made in a map maker, or draw on this blank parchment and add pins for your places.</span></div>'
      : '') +
    (ui.imgBusy === v.id ? '<span class="busy">Saving map…</span>' : '') +
    '</div>' +
    '<aside class="mp-side" id="mpSide"></aside></div><input type="file" id="mpFile" accept="image/*" hidden>';
  const nm = $('#ntName', el);
  nm.addEventListener('input', () => {
    x.name = nm.value || 'Untitled';
    dirty('meta');
    renderBinder();
  });
  if (ui.focusName) {
    ui.focusName = false;
    nm.focus();
    nm.select();
  }
  const stage = $('#mpStage', el),
    world = $('#mpWorld', el),
    img = $('#mpImg', el),
    key = 'nt_' + v.id,
    VW = ui.mpView || (ui.mpView = {});
  let W = MP_W,
    H = MP_H;
  const apply = () => {
    const q = VW[v.id];
    world.style.width = W + 'px';
    world.style.height = H + 'px';
    world.style.transform = 'translate(' + q.x + 'px,' + q.y + 'px) scale(' + q.k + ')';
    world.style.setProperty('--ik', 1 / q.k);
  };
  const fit = () => {
    const r = stage.getBoundingClientRect(),
      k = Math.min((r.width - 32) / W, (r.height - 32) / H) || 1;
    VW[v.id] = { k, x: (r.width - W * k) / 2, y: (r.height - H * k) / 2 };
    apply();
  };
  const ready = () => {
    if (src && img.naturalWidth) {
      W = img.naturalWidth;
      H = img.naturalHeight;
    }
    if (!VW[v.id] || VW[v.id].src !== src) {
      fit();
      VW[v.id].src = src;
    } else apply();
    drawPins();
  };
  if (src && !img.complete) img.addEventListener('load', ready, { once: true });
  else requestAnimationFrame(ready);
  const zoom = (f, cx, cy) => {
    const q = VW[v.id];
    if (!q) return;
    const r = stage.getBoundingClientRect();
    cx = cx == null ? r.width / 2 : cx;
    cy = cy == null ? r.height / 2 : cy;
    const k = Math.max(0.05, Math.min(8, q.k * f));
    q.x = cx - ((cx - q.x) * k) / q.k;
    q.y = cy - ((cy - q.y) * k) / q.k;
    q.k = k;
    apply();
  };
  const toMap = ev => {
    const q = VW[v.id],
      r = stage.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1000, Math.round(((ev.clientX - r.left - q.x) / q.k / W) * 1000))),
      y: Math.max(0, Math.min(1000, Math.round(((ev.clientY - r.top - q.y) / q.k / H) * 1000)))
    };
  };
  function drawPins() {
    const box = $('#mpPins', el);
    if (!box) return;
    const sz = ['s', 'm', 'l'][d.pinSize];
    box.innerHTML = d.pins
      .map(
        pn =>
          '<button class="mp-pin sz-' +
          sz +
          (pn.id === ui.mpSel ? ' on' : '') +
          '" data-pin="' +
          pn.id +
          '" style="left:' +
          pn.x / 10 +
          '%;top:' +
          pn.y / 10 +
          '%;--c:' +
          mpCol(pn) +
          '" title="' +
          esc(mpName(pn)) +
          '"><i></i><span>' +
          esc(mpName(pn)) +
          '</span></button>'
      )
      .join('');
  }
  function side() {
    const box = $('#mpSide', el);
    if (!box) return;
    const pn = d.pins.find(p => p.id === ui.mpSel),
      m = S.meta;
    if (!pn) {
      const placed = d.pins.slice().sort((a, b) => mpName(a).localeCompare(mpName(b)));
      const unplaced = Object.values(m.ents)
        .filter(e => e.type === 'place' && !d.pins.some(p => p.ent === e.id))
        .sort((a, b) => a.name.localeCompare(b.name));
      box.innerHTML =
        '<h3>Pins <span class="muted">' +
        d.pins.length +
        '</span></h3>' +
        (placed.length
          ? '<div class="mp-list">' +
            placed
              .map(p => {
                const n = mpScenesAt(p.ent).length;
                return (
                  '<button class="mp-li" data-mp="sel" data-id="' +
                  p.id +
                  '"><i style="--c:' +
                  mpCol(p) +
                  '"></i><span>' +
                  esc(mpName(p)) +
                  '</span>' +
                  (n ? '<small>' + n + ' scene' + (n === 1 ? '' : 's') + '</small>' : '') +
                  '</button>'
                );
              })
              .join('') +
            '</div>'
          : '<p class="fine">Choose <b>Add pin</b> and click the map, or double-click anywhere on it.</p>') +
        (unplaced.length
          ? '<h4>' +
            esc(LP('place')) +
            ' not on this map</h4><div class="mp-list">' +
            unplaced
              .map(
                e =>
                  '<button class="mp-li" data-mp="place" data-id="' +
                  e.id +
                  '"><i style="--c:var(--place)"></i><span>' +
                  esc(e.name) +
                  '</span><small>' +
                  ico('plus', 12) +
                  '</small></button>'
              )
              .join('') +
            '</div><p class="fine">Click one, then click the map to place it.</p>'
          : '') +
        '<h4>Pin size</h4><div class="seg">' +
        ['Small', 'Medium', 'Large']
          .map(
            (l, i) =>
              '<button data-mp="psize" data-v="' +
              i +
              '"' +
              (d.pinSize === i ? ' class="on"' : '') +
              '>' +
              l +
              '</button>'
          )
          .join('') +
        '</div>' +
        (src
          ? '<h4>Map picture</h4><input class="mp-cap" id="mpCap" value="' +
            esc(d.pic.cap || '') +
            '" maxlength="200" placeholder="Caption or artist credit" aria-label="Map credit"><button class="btn sm' +
            (ui.confirm === 'mprm' ? ' danger' : '') +
            '" data-mp="rmpic">' +
            (ui.confirm === 'mprm' ? 'Remove the picture? Pins stay' : 'Remove picture') +
            '</button>'
          : '');
      return;
    }
    const ents = Object.values(m.ents).sort((a, b) => a.name.localeCompare(b.name)),
      at = mpScenesAt(pn.ent),
      e = pn.ent && m.ents[pn.ent];
    box.innerHTML =
      '<div class="mp-sh"><h3>' +
      esc(mpName(pn)) +
      '</h3><button class="ibtn" data-mp="close" aria-label="Close">' +
      ico('x') +
      '</button></div>' +
      '<label class="f">Story page<select data-mpf="ent"><option value="">None, just a label</option>' +
      TYPE_ORDER.map(t => {
        const l = ents.filter(q => q.type === t);
        return l.length
          ? '<optgroup label="' +
              esc(LP(t)) +
              '">' +
              l
                .map(
                  q =>
                    '<option value="' +
                    q.id +
                    '"' +
                    (pn.ent === q.id ? ' selected' : '') +
                    '>' +
                    esc(q.name) +
                    '</option>'
                )
                .join('') +
              '</optgroup>'
          : '';
      }).join('') +
      '</select></label>' +
      (e
        ? ''
        : '<label class="f">Label<input data-mpf="name" value="' +
          esc(pn.name) +
          '" maxlength="80" placeholder="A town, a ruin, a battle…"></label>') +
      '<span class="sec-l">Colour</span><span class="sws">' +
      [['', 'Page colour']]
        .concat(TL_COLORS)
        .map(
          c =>
            '<button class="sw' +
            (pn.color === c[0] ? ' on' : '') +
            '" data-mp="pcol" data-c="' +
            c[0] +
            '" style="--c:' +
            (c[0] ? cssCol(c[0]) : e ? 'var(--' + e.type + ')' : 'var(--danger)') +
            '" title="' +
            c[1] +
            '" aria-label="' +
            c[1] +
            '"></button>'
        )
        .join('') +
      '</span>' +
      '<label class="f">Notes<textarea data-mpf="note" rows="3" placeholder="What happens here, how far it is from…">' +
      esc(pn.note) +
      '</textarea></label>' +
      (e
        ? '<button class="btn sm" data-mp="openent">' +
          ico('note', 13) +
          '<span>Open ' +
          esc(e.name) +
          '</span></button>'
        : '') +
      (e && e.type === 'place'
        ? '<h4>Scenes set here <span class="muted">' +
          at.length +
          '</span></h4>' +
          (at.length
            ? '<div class="mp-list">' +
              at
                .map(
                  o =>
                    '<button class="mp-li" data-mp="scene" data-id="' +
                    o.id +
                    '"><span>' +
                    esc(m.scenes[o.id].title) +
                    '</span><small>' +
                    esc(o.ch.title) +
                    '</small></button>'
                )
                .join('') +
              '</div>'
            : '<p class="fine">Set a scene’s place in the Inkling panel (This scene › ' + esc(LS('place')) + ').</p>')
        : '') +
      '<button class="btn sm danger mp-del" data-mp="delpin">' +
      ico('trash', 13) +
      '<span>Remove pin</span></button>';
  }
  side();
  const save = () => dirty(key);
  // pointer: pan, drag pins, place pins, draw
  let drag = null;
  stage.addEventListener('pointerdown', ev => {
    if (ev.button > 0) return;
    const q = VW[v.id];
    if (!q) return;
    const pinEl = ev.target.closest('.mp-pin');
    if (pinEl && (ui.mpMode || 'move') !== 'draw') {
      const pn = d.pins.find(p => p.id === pinEl.dataset.pin);
      drag = { k: 'pin', pn, x0: ev.clientX, y0: ev.clientY, moved: false };
      stage.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      return;
    }
    const md = ui.mpMode || 'move';
    if (md === 'pin') {
      const at = toMap(ev),
        pn = {
          id: uid('pn'),
          ent: ui.mpPlace || '',
          name: ui.mpPlace ? '' : 'New place',
          x: at.x,
          y: at.y,
          color: '',
          note: ''
        };
      d.pins.push(pn);
      ui.mpPlace = '';
      ui.mpSel = pn.id;
      ui.mpMode = 'move';
      save();
      renderMap(el, v, x, d);
      renderBinder();
      const n = $('[data-mpf="name"]', el);
      if (n) {
        n.focus();
        n.select();
      }
      return;
    }
    if (md === 'draw') {
      const at = toMap(ev);
      drag = {
        k: 'ink',
        pts: [at.x + ',' + at.y],
        line: document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
      };
      drag.line.setAttribute('stroke', mpInk(ui.mpPen || 'ink'));
      drag.line.setAttribute('stroke-width', ui.mpW || 2);
      drag.line.setAttribute('points', drag.pts[0]);
      $('#mpInk', el).appendChild(drag.line);
      stage.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      return;
    }
    drag = { k: 'pan', x0: ev.clientX, y0: ev.clientY, qx: q.x, qy: q.y };
    stage.setPointerCapture(ev.pointerId);
    stage.classList.add('panning');
  });
  stage.addEventListener('pointermove', ev => {
    if (!drag) return;
    const q = VW[v.id];
    if (drag.k === 'pan') {
      q.x = drag.qx + ev.clientX - drag.x0;
      q.y = drag.qy + ev.clientY - drag.y0;
      apply();
    } else if (drag.k === 'pin') {
      if (!drag.moved && Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < 4) return;
      drag.moved = true;
      const at = toMap(ev);
      drag.pn.x = at.x;
      drag.pn.y = at.y;
      const b = $('.mp-pin[data-pin="' + drag.pn.id + '"]', el);
      if (b) {
        b.style.left = at.x / 10 + '%';
        b.style.top = at.y / 10 + '%';
      }
    } else if (drag.k === 'ink') {
      const at = toMap(ev),
        last = drag.pts[drag.pts.length - 1].split(',');
      if (Math.hypot(at.x - last[0], at.y - last[1]) < 2) return;
      drag.pts.push(at.x + ',' + at.y);
      drag.line.setAttribute('points', drag.pts.join(' '));
    }
  });
  const end = () => {
    if (!drag) return;
    const g = drag;
    drag = null;
    stage.classList.remove('panning');
    if (g.k === 'pin') {
      if (g.moved) save();
      else ui.mpSel = g.pn.id;
      drawPins();
      side();
    } else if (g.k === 'ink') {
      if (g.pts.length > 1) {
        d.ink.push({ c: ui.mpPen || 'ink', w: ui.mpW || 2, p: g.pts.join(' ') });
        save();
        renderMap(el, v, x, d);
      } else g.line.remove();
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('dblclick', ev => {
    if ((ui.mpMode || 'move') !== 'move' || ev.target.closest('.mp-pin')) return;
    const at = toMap(ev),
      pn = { id: uid('pn'), ent: '', name: 'New place', x: at.x, y: at.y, color: '', note: '' };
    d.pins.push(pn);
    ui.mpSel = pn.id;
    save();
    drawPins();
    side();
    renderBinder();
    const n = $('[data-mpf="name"]', el);
    if (n) {
      n.focus();
      n.select();
    }
  });
  stage.addEventListener(
    'wheel',
    ev => {
      ev.preventDefault();
      const r = stage.getBoundingClientRect();
      zoom(Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015)), ev.clientX - r.left, ev.clientY - r.top);
    },
    { passive: false }
  );
  stage.addEventListener('keydown', ev => {
    if (ev.key === '+' || ev.key === '=') zoom(1.25);
    else if (ev.key === '-') zoom(0.8);
    else if (ev.key === 'Escape' && ui.mpSel) {
      ui.mpSel = null;
      drawPins();
      side();
    } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && ui.mpSel) {
      d.pins = d.pins.filter(p => p.id !== ui.mpSel);
      ui.mpSel = null;
      save();
      drawPins();
      side();
      renderBinder();
    }
  });
  // drop or paste a map picture
  const isImg = l => [...(l || [])].find(f => /^image\//.test(f.type));
  stage.addEventListener('dragover', ev => {
    if ([...(ev.dataTransfer.items || [])].some(i => i.kind === 'file')) {
      ev.preventDefault();
      stage.classList.add('drop');
    }
  });
  stage.addEventListener('dragleave', () => stage.classList.remove('drop'));
  stage.addEventListener('drop', ev => {
    stage.classList.remove('drop');
    const f = isImg(ev.dataTransfer.files);
    if (!f) return;
    ev.preventDefault();
    setPic(v.id, f);
  });
  stage.addEventListener('paste', ev => {
    const f = ev.clipboardData && isImg(ev.clipboardData.files);
    if (f) {
      ev.preventDefault();
      setPic(v.id, f);
    }
  });
  $('#mpFile', el).addEventListener('change', ev => {
    const f = ev.target.files && ev.target.files[0];
    if (f) setPic(v.id, f);
  });
  el.onclick = ev => {
    const b = ev.target.closest('[data-mp]');
    if (!b) return;
    const k = b.dataset.mp,
      pn = d.pins.find(p => p.id === ui.mpSel);
    if (k === 'mode') {
      ui.mpMode = b.dataset.v;
      if (b.dataset.v !== 'pin') ui.mpPlace = '';
      renderMap(el, v, x, d);
    } else if (k === 'zin') zoom(1.25);
    else if (k === 'zout') zoom(0.8);
    else if (k === 'fit') fit();
    else if (k === 'pick') {
      const f = $('#mpFile', el);
      f.value = '';
      f.click();
    } else if (k === 'pen') {
      ui.mpPen = b.dataset.c;
      renderMap(el, v, x, d);
    } else if (k === 'pw') {
      ui.mpW = +b.dataset.v;
      renderMap(el, v, x, d);
    } else if (k === 'undo') {
      d.ink.pop();
      save();
      renderMap(el, v, x, d);
    } else if (k === 'clear')
      confirmDo(
        'mpclear',
        () => {
          d.ink = [];
          save();
          renderMap(el, v, x, d);
        },
        () => renderMap(el, v, x, d)
      );
    else if (k === 'rmpic') confirmDo('mprm', () => removePic(v.id).then(() => renderMap(el, v, x, d)), side);
    else if (k === 'sel') {
      ui.mpSel = b.dataset.id;
      drawPins();
      side();
    } else if (k === 'place') {
      ui.mpPlace = b.dataset.id;
      ui.mpMode = 'pin';
      renderMap(el, v, x, d);
      toast('Click the map where ' + S.meta.ents[b.dataset.id].name + ' is.', { plain: true });
    } else if (k === 'psize') {
      d.pinSize = +b.dataset.v;
      save();
      drawPins();
      side();
    } else if (k === 'close') {
      ui.mpSel = null;
      drawPins();
      side();
    } else if (k === 'pcol' && pn) {
      pn.color = b.dataset.c;
      save();
      drawPins();
      side();
    } else if (k === 'openent' && pn) go({ k: 'ent', id: pn.ent });
    else if (k === 'scene') go({ k: 'scene', id: b.dataset.id });
    else if (k === 'delpin' && pn) {
      d.pins = d.pins.filter(p => p.id !== pn.id);
      ui.mpSel = null;
      save();
      drawPins();
      side();
      renderBinder();
    }
  };
  el.oninput = ev => {
    const k = ev.target.dataset.mpf,
      pn = d.pins.find(p => p.id === ui.mpSel);
    if (ev.target.id === 'mpCap') {
      d.pic.cap = ev.target.value.slice(0, 200);
      save();
      return;
    }
    if (!pn || !k || k === 'ent') return;
    if (k === 'name') {
      pn.name = ev.target.value.slice(0, 80);
      const b = $('.mp-pin[data-pin="' + pn.id + '"] span', el);
      if (b) b.textContent = mpName(pn);
    } else if (k === 'note') pn.note = ev.target.value.slice(0, 2000);
    save();
  };
  el.onchange = ev => {
    const pn = d.pins.find(p => p.id === ui.mpSel);
    if (ev.target.dataset.mpf === 'ent' && pn) {
      pn.ent = ev.target.value;
      if (pn.ent) pn.name = '';
      else pn.name = pn.name || 'New place';
      save();
      drawPins();
      side();
    }
  };
  const ro = new ResizeObserver(() => {
    if (!document.body.contains(stage)) {
      ro.disconnect();
      return;
    }
    if (VW[v.id]) apply();
  });
  ro.observe(stage);
}
// Story pages list the maps they are pinned on.
function mapPinsHtml(e) {
  const rows = [];
  S.meta.nts
    .filter(x => x.kind === 'map')
    .forEach(x => {
      const d = S.nt[x.id];
      ((d && d.pins) || [])
        .filter(p => p.ent === e.id)
        .forEach(p =>
          rows.push(
            '<button class="ap" data-mapof="' +
              x.id +
              '" data-pin="' +
              p.id +
              '"><b><span>' +
              esc(x.name) +
              '</span></b>' +
              (p.note ? '<span class="sn">' + esc(p.note.slice(0, 140)) + '</span>' : '') +
              '</button>'
          )
        );
    });
  return rows.length ? '<section class="appears"><h3>On the map</h3>' + rows.join('') + '</section>' : '';
}

function renderNt(el, v) {
  const x = S.meta.nts.find(y => y.id === v.id),
    d = S.nt[v.id],
    board = x.kind === 'board';
  if (x.kind === 'map') return renderMap(el, v, x, d);
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico(board ? 'bulb' : 'note', 16) +
    '</span>' +
    '<input id="ntName" class="title-in" value="' +
    esc(x.name) +
    '" maxlength="80" aria-label="Name">' +
    (board
      ? '<span class="mono muted" id="ntCount">' +
        d.ideas.length +
        ' idea' +
        (d.ideas.length === 1 ? '' : 's') +
        '</span>'
      : '<span class="mono muted" id="ntCount">' + fmt(wc(d.text)) + ' words</span>') +
    '</div>' +
    (board
      ? '<div class="nt-board"><div class="nt-quick"><input id="ntQuick" placeholder="Jot an idea and press Enter" maxlength="600" aria-label="New idea"><button class="btn pri" data-n="add">' +
        ico('plus') +
        '<span>Idea</span></button></div><div class="ideas" id="ideas"></div></div>'
      : '<div class="sheet nt-sheet"><textarea id="ntText" class="nt-ta" placeholder="Anything goes: research, questions, scraps of dialogue, things to fix later. Names with story pages are listed below.">' +
        esc(d.text) +
        '</textarea><div class="chiplinks" id="ntNames"></div></div>');
  const nm = $('#ntName', el);
  nm.addEventListener('input', () => {
    x.name = nm.value || 'Untitled';
    dirty('meta');
    renderBinder();
  });
  if (ui.focusName) {
    ui.focusName = false;
    nm.focus();
    nm.select();
  }
  if (!board) {
    const ta = $('#ntText', el),
      names = () => {
        $('#ntNames', el).innerHTML = namesHtml(ta.value);
      };
    ag(ta);
    names();
    ta.addEventListener('input', () => {
      ag(ta);
      d.text = ta.value;
      dirty('nt_' + v.id);
      $('#ntCount', el).textContent = fmt(wc(d.text)) + ' words';
      clearTimeout(ui.ntt);
      ui.ntt = setTimeout(() => {
        names();
        renderBinder();
      }, 500);
    });
    return;
  }
  const draw = () => {
    const box = $('#ideas', el);
    if (!box) return;
    box.innerHTML =
      d.ideas
        .map(
          (i, k) =>
            '<article class="idea" data-id="' +
            i.id +
            '" style="--c:var(--' +
            i.color +
            ')"><textarea data-n="text" rows="3" aria-label="Idea">' +
            esc(i.text) +
            '</textarea>' +
            '<footer><span class="sws mini">' +
            NT_COLORS.map(
              c =>
                '<button class="sw' +
                (c === i.color ? ' on' : '') +
                '" data-n="color" data-c="' +
                c +
                '" style="--c:var(--' +
                c +
                ')" aria-label="Colour"></button>'
            ).join('') +
            '</span>' +
            '<span class="acts on">' +
            (k > 0
              ? '<button class="ibtn" data-n="up" aria-label="Move earlier">' + ico('back', 14) + '</button>'
              : '') +
            (k < d.ideas.length - 1
              ? '<button class="ibtn" data-n="dn" aria-label="Move later">' + ico('right', 14) + '</button>'
              : '') +
            '<button class="ibtn' +
            (ui.confirm === 'id' + i.id ? ' on' : '') +
            '" data-n="del" aria-label="Delete idea">' +
            (ui.confirm === 'id' + i.id ? 'Delete?' : ico('trash', 14)) +
            '</button></span></footer></article>'
        )
        .join('') +
      (d.ideas.length
        ? ''
        : '<p class="muted nt-empty">No ideas yet. Type one above. Nothing here has to be good.</p>');
    box.querySelectorAll('textarea').forEach(ag);
    $('#ntCount', el).textContent = d.ideas.length + ' idea' + (d.ideas.length === 1 ? '' : 's');
  };
  const add = () => {
    const q = $('#ntQuick', el),
      t = q.value.trim();
    d.ideas.unshift({ id: uid('i_'), text: t, color: NT_COLORS[d.ideas.length % NT_COLORS.length] });
    q.value = '';
    dirty('nt_' + v.id);
    draw();
    renderBinder();
    if (!t) {
      const f = $('#ideas textarea', el);
      if (f) f.focus();
    } else q.focus();
  };
  draw();
  dragSort($('#ideas', el), {
    item: '.idea',
    grid: true,
    scroll: () => $('#main'),
    drop: (it, ref) => {
      if (moveInList(d.ideas, it.dataset.id, ref && ref.dataset.id)) {
        dirty('nt_' + v.id);
        draw();
      }
    }
  });
  $('#ntQuick', el).addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      add();
    }
  });
  el.onclick = ev => {
    const b = ev.target.closest('[data-n]');
    if (!b || b.tagName === 'TEXTAREA') return;
    const a = b.dataset.n;
    if (a === 'add') {
      add();
      return;
    }
    const card = b.closest('.idea');
    if (!card) return;
    const k = d.ideas.findIndex(i => i.id === card.dataset.id),
      i = d.ideas[k];
    if (a === 'color') {
      i.color = b.dataset.c;
      dirty('nt_' + v.id);
      draw();
    } else if (a === 'up' || a === 'dn') {
      const j = k + (a === 'up' ? -1 : 1);
      d.ideas[k] = d.ideas[j];
      d.ideas[j] = i;
      dirty('nt_' + v.id);
      draw();
    } else if (a === 'del')
      confirmDo(
        'id' + i.id,
        () => {
          d.ideas.splice(k, 1);
          dirty('nt_' + v.id);
          draw();
          renderBinder();
        },
        draw
      );
  };
  $('#ideas', el).addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset.n !== 'text') return;
    ag(t);
    d.ideas.find(i => i.id === t.closest('.idea').dataset.id).text = t.value;
    dirty('nt_' + v.id);
  });
}
