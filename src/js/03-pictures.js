/*
 * 03-pictures.js: Pictures on story pages and world maps
 *
 * A picture can live in three places, depending on where Inkling runs: in the Claude artifact it is uploaded as an
 * asset and only its id is saved (pic.a); in the desktop app it is a file in the project's pictures folder (pic.f);
 * in a plain browser a resized copy is kept in localStorage under its own key (pic.l). picSrc() turns any of these
 * into an image address, setPic() stores a new picture wherever it belongs, and backups carry every picture inside
 * the file (collectImages, adoptImages) so they move between all three.
 *
 * The rest is the picture block on a story page: shape, size, framing (which part shows, and how far zoomed in), and
 * the full-size lightbox.
 */
// In the Claude artifact a picture is uploaded with the `assets` capability and only its id is saved.
// In the desktop app it is a file in the project's pictures folder (`f`). In a plain browser a resized copy lives
// in localStorage under its own key, outside the project record.
const PIC_SHAPES = [
  ['', 'Auto'],
  ['portrait', 'Portrait'],
  ['square', 'Square'],
  ['wide', 'Wide'],
  ['natural', 'Original']
];
// Sizes a story page picture can be shown at.
const PIC_SIZES = [
  ['s', 'Small'],
  ['m', 'Medium'],
  ['l', 'Banner']
];
// The frame shape each kind of page starts with.
const PIC_DEF_SHAPE = { char: 'portrait', place: 'wide', thing: 'square' };
// Checks a picture record, keeping only valid values.
function normPic(p) {
  p = p && typeof p === 'object' ? p : {};
  return {
    a: /^[0-9a-f]{32}$/i.test(p.a || '') ? p.a : '',
    l: !!p.l,
    f: /^[a-z0-9][a-z0-9_.-]{0,80}$/i.test(p.f || '') ? p.f : '',
    cap: String(p.cap || '').slice(0, 200),
    shape: PIC_SHAPES.some(x => x[0] === p.shape) ? p.shape : '',
    size: PIC_SIZES.some(x => x[0] === p.size) ? p.size : 'm',
    fit: p.fit === 'contain' ? 'contain' : 'cover',
    px: clamp(num(p.px, 50), 0, 100),
    py: clamp(num(p.py, 50), 0, 100),
    zoom: clamp(num(p.zoom, 1), 1, 4)
  };
}
// The localStorage key prefix for pictures kept in a plain browser.
const LOCAL_PIC = 'inkling:img:';
// Framing: which part of the picture shows in its frame (px/py, % from left/top) and how far it is zoomed in.
function picStyle(eid) {
  const p = (S.en[eid] || {}).pic;
  if (!p) return '';
  const o = p.px.toFixed(1) + '% ' + p.py.toFixed(1) + '%';
  return (
    'object-position:' + o + (p.zoom > 1 ? ';transform:scale(' + p.zoom.toFixed(2) + ');transform-origin:' + o : '')
  );
}
// The same framing for a round picture in an SVG (maps and trees): grow the image and shift it around the focal point.
function picSvg(eid, x, y, w, h) {
  const p = (S.en[eid] || {}).pic || { px: 50, py: 50, zoom: 1 },
    z = p.zoom || 1,
    W = w * z,
    H = h * z;
  const al = (p.px < 34 ? 'xMin' : p.px > 66 ? 'xMax' : 'xMid') + (p.py < 34 ? 'YMin' : p.py > 66 ? 'YMax' : 'YMid');
  return (
    'x="' +
    (x - ((W - w) * p.px) / 100).toFixed(1) +
    '" y="' +
    (y - ((H - h) * p.py) / 100).toFixed(1) +
    '" width="' +
    W.toFixed(1) +
    '" height="' +
    H.toFixed(1) +
    '" preserveAspectRatio="' +
    al +
    ' slice"'
  );
}
// A picture belongs to a story page (S.en[id].pic) or a world map (S.nt[id].pic, a note of kind 'map').
const picRec = id => (S.en[id] || S.nt[id] || {}).pic || null,
  picKey = id => (S.en[id] ? 'en_' + id : 'nt_' + id),
  isMapPic = id => !S.en[id] && !!S.nt[id];
// The address to show a page's or map's picture from, wherever it is stored ('' when there is none).
function picSrc(eid) {
  const p = picRec(eid);
  if (!p) return '';
  if (p.f) return DESK && PJ.id ? 'inkpic://p/' + encodeURIComponent(PJ.id) + '/' + encodeURIComponent(p.f) : '';
  if (p.a) return '/_blob/' + p.a;
  if (p.l) {
    try {
      return localStorage.getItem(LOCAL_PIC + eid) || '';
    } catch (e) {
      return '';
    }
  }
  return '';
}
// The Claude artifact's picture storage (the assets capability), or null outside the artifact.
async function getAssets() {
  try {
    return window.claude && window.claude.use ? await window.claude.use('assets') : null;
  } catch (e) {
    return null;
  }
}
// Backups carry every picture as a data URL (imgs), wherever it was stored, so a backup moves between the
// Claude artifact, a browser and the desktop app with its pictures.
async function collectImages() {
  const o = {};
  for (const id of Object.keys(S.en).concat(Object.keys(S.nt).filter(k => S.nt[k].pic))) {
    const p = picRec(id);
    if (!p) continue;
    try {
      if (p.f && DESK && PJ.id) o[id] = await DESK.picRead(PJ.id, p.f);
      else if (p.l) {
        const d = localStorage.getItem(LOCAL_PIC + id);
        if (d) o[id] = d;
      } else if (p.a) {
        const r = await fetch('/_blob/' + p.a);
        if (r.ok) o[id] = await toDataUrl(await r.blob());
      }
    } catch (e) {}
  }
  return o;
}
// After a restore or import: puts each picture from a backup where this environment keeps pictures.
async function adoptImages(np, imgs, deskId) {
  imgs = imgs && typeof imgs === 'object' ? imgs : {};
  const inClaude = !!(window.claude && window.claude.use);
  for (const id of Object.keys(np.en).concat(Object.keys(np.nt || {}).filter(k => np.nt[k].pic))) {
    const p = (np.en[id] || np.nt[id]).pic,
      d = imgs[id],
      ok = typeof d === 'string' && /^data:image\/[\w+.-]+;base64,/.test(d);
    if (deskId) {
      p.a = '';
      p.l = false;
      p.f = '';
      if (ok)
        try {
          const b = await (await fetch(d)).blob();
          p.f = await DESK.picSave(deskId, new Uint8Array(await b.arrayBuffer()), b.type);
        } catch (e) {}
      continue;
    }
    p.f = '';
    if (p.a && inClaude) continue; // the artifact still holds this picture
    if (ok) {
      try {
        localStorage.setItem(LOCAL_PIC + id, d);
        p.l = true;
        p.a = '';
      } catch (e) {
        p.l = false;
      }
    } else if (!inClaude) p.a = '';
  }
}
// Deletes a picture's stored file or data (used when its page or map is gone for good, or the picture is replaced).
async function dropPic(eid, pic) {
  const p = pic || picRec(eid);
  if (!p) return;
  if (p.l) {
    try {
      localStorage.removeItem(LOCAL_PIC + eid);
    } catch (e) {}
  }
  if (p.f && DESK && PJ.id) DESK.picDelete(PJ.id, p.f).catch(() => {});
  if (p.a) {
    const as = await getAssets();
    if (as)
      try {
        await as.delete(p.a);
      } catch (e) {}
  }
}
// Loads an image file into an <img> so it can be measured and resized.
function loadImg(file) {
  return new Promise((ok, bad) => {
    const u = URL.createObjectURL(file),
      im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(u);
      ok(im);
    };
    im.onerror = () => {
      URL.revokeObjectURL(u);
      bad({ code: 'unreadable' });
    };
    im.src = u;
  });
}
// Makes a picture smaller before storing it: at most max pixels on its longest side, as WebP (or JPEG) of quality q.
// GIFs and SVGs are kept as they are.
async function shrink(file, max, q) {
  if (/gif|svg/.test(file.type) && file.size < 6e6) return file; // keep animation and vectors as they are
  const im = await loadImg(file),
    k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  if (k === 1 && file.size < 1.5e6 && /jpeg|webp|png/.test(file.type)) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(im.naturalWidth * k);
  c.height = Math.round(im.naturalHeight * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  const out = await new Promise(r => c.toBlob(r, 'image/webp', q));
  return out && out.type === 'image/webp' ? out : await new Promise(r => c.toBlob(r, 'image/jpeg', q));
}
// Reads a file or blob as a data: URL.
const toDataUrl = b =>
  new Promise(r => {
    const f = new FileReader();
    f.onload = () => r(f.result);
    f.readAsDataURL(b);
  });
// Stores a new picture for a story page or map, wherever this environment keeps pictures, and removes the old one.
async function setPic(eid, file) {
  if (!file || !/^image\/(png|jpeg|gif|webp|svg\+xml|avif|bmp)$/.test(file.type)) {
    toast('Choose an image file: JPG, PNG, WebP or GIF.', { plain: true });
    return;
  }
  ui.imgBusy = eid;
  refreshPic();
  const p = picRec(eid),
    old = { a: p.a, l: p.l, f: p.f },
    big = isMapPic(eid);
  try {
    const as = DESK ? null : await getAssets();
    if (DESK) {
      const b = await shrink(file, big ? 4000 : 2400, 0.9),
        name = await DESK.picSave(PJ.id, new Uint8Array(await b.arrayBuffer()), b.type || 'image/webp');
      p.f = name;
      p.a = '';
      p.l = false;
      if (old.f && old.f !== name) DESK.picDelete(PJ.id, old.f).catch(() => {});
    } else if (as) {
      const b = await shrink(file, big ? 3200 : 2000, 0.88),
        r = await as.upload(b, { type: b.type });
      p.a = r.id;
      p.l = false;
      if (old.l)
        try {
          localStorage.removeItem(LOCAL_PIC + eid);
        } catch (e) {}
      if (old.a && old.a !== r.id) as.delete(old.a).catch(() => {});
    } else {
      const b = await shrink(file, big ? 1800 : 1000, 0.82),
        url = await toDataUrl(b);
      try {
        localStorage.setItem(LOCAL_PIC + eid, url);
      } catch (e) {
        throw { code: 'local_full' };
      }
      p.l = true;
      p.a = '';
    }
    if (big) {
      p.w = 0;
      p.h = 0;
    }
    dirty(picKey(eid));
  } catch (err) {
    const c = err && err.code;
    toast(
      c === 'too_large'
        ? 'That image is too big. Try one under 20 MB.'
        : c === 'local_full'
          ? 'This browser is out of room for pictures. Remove one or use Inkling in Claude.'
          : c === 'quota_or_state'
            ? 'Picture storage for Inkling is full. Remove a picture you no longer need.'
            : c === 'unreadable'
              ? 'That file could not be opened as an image.'
              : c === 'rate_limited'
                ? 'Too many uploads at once. Try again in a moment.'
                : 'The picture could not be saved. Please try again.',
      { plain: true }
    );
  }
  ui.imgBusy = null;
  refreshPic();
  renderBinder();
  if (big && ui.view.k === 'nt' && ui.view.id === eid) renderMain();
}
// Removes a page's or map's picture.
async function removePic(eid) {
  await dropPic(eid);
  const p = picRec(eid);
  p.a = '';
  p.l = false;
  p.f = '';
  p.cap = '';
  dirty(picKey(eid));
  refreshPic();
  renderBinder();
}
// The picture block at the top of a story page: the picture (or a drop zone), its caption, and the layout options.
function picHtml(e) {
  const p = S.en[e.id].pic,
    src = picSrc(e.id),
    busy = ui.imgBusy === e.id;
  let h =
    '<figure class="ent-fig"><div class="ent-img' +
    (src ? '' : ' empty') +
    (ui.frame && src && p.fit === 'cover' ? ' framing' : '') +
    '" id="entImg" tabindex="0" role="button" aria-label="' +
    (src ? 'View picture full size' : 'Add a picture') +
    '">' +
    (src
      ? '<img src="' +
        esc(src) +
        '" alt="' +
        esc(p.cap || e.name) +
        '"' +
        (p.fit === 'cover' ? ' style="' + picStyle(e.id) + '"' : '') +
        ' draggable="false">'
      : '<span class="ph">' +
        ico('image', 28) +
        '<b>Add a picture</b><small>Drop an image here, paste one, or click to choose. Character art, a map, a mood board…</small></span>') +
    (busy ? '<span class="busy">Saving picture…</span>' : '') +
    '</div>';
  if (src)
    h +=
      '<input class="ent-cap" id="entCap" value="' +
      esc(p.cap) +
      '" maxlength="200" placeholder="Caption or artist credit" aria-label="Picture caption">';
  h +=
    '<div class="ent-imgbar"><button class="btn sm" data-im="pick">' +
    ico('upload', 14) +
    '<span>' +
    (src ? 'Replace' : 'Upload') +
    '</span></button>' +
    (src
      ? '<button class="btn sm' +
        (ui.confirm === 'pic' + e.id ? ' danger' : '') +
        '" data-im="rm">' +
        (ui.confirm === 'pic' + e.id ? 'Remove picture?' : 'Remove') +
        '</button>'
      : '') +
    '<button class="btn sm" data-im="opts" aria-expanded="' +
    ui.imgOpts +
    '">' +
    ico('sliders', 14) +
    '<span>Layout</span></button></div>';
  if (ui.imgOpts) {
    const seg = (k, opts, cur) =>
      '<div class="seg">' +
      opts
        .map(
          o =>
            '<button data-im="set" data-k="' +
            k +
            '" data-v="' +
            o[0] +
            '"' +
            (cur === o[0] ? ' class="on"' : '') +
            '>' +
            o[1] +
            '</button>'
        )
        .join('') +
      '</div>';
    h +=
      '<div class="ent-imgopts"><span class="sec-l">Shape</span>' +
      seg('shape', PIC_SHAPES, p.shape) +
      '<span class="sec-l">Size</span>' +
      seg('size', PIC_SIZES, p.size) +
      '<span class="sec-l">Fit</span>' +
      seg(
        'fit',
        [
          ['cover', 'Fill the frame'],
          ['contain', 'Show it all']
        ],
        p.fit
      ) +
      (src && p.fit === 'cover'
        ? '<span class="sec-l">Framing</span><div class="frame-row"><button class="btn sm' +
          (ui.frame ? ' pri' : '') +
          '" data-im="frame" aria-pressed="' +
          !!ui.frame +
          '">' +
          ico('image', 14) +
          '<span>' +
          (ui.frame ? 'Done' : 'Adjust framing') +
          '</span></button>' +
          '<button class="btn sm" data-im="unframe"' +
          (p.px === 50 && p.py === 50 && p.zoom === 1 ? ' disabled' : '') +
          '>Reset</button></div>' +
          (ui.frame
            ? '<label class="f frame-zoom">Zoom<input type="range" id="picZoom" min="1" max="4" step="0.05" value="' +
              p.zoom +
              '" aria-label="Zoom"></label><p class="fine">Drag the picture to choose what shows in the frame, or use the arrow keys. Zoom in to crop more.</p>'
            : '')
        : '') +
      '</div>';
  }
  return h + '<input type="file" id="entFile" accept="image/*" hidden></figure>';
}
// Re-applies the framing to the page's picture while it is being dragged or zoomed.
function applyFrame(eid) {
  const im = $('#entImg img');
  if (im) im.setAttribute('style', picStyle(eid));
  const r = $('[data-im="unframe"]');
  if (r) {
    const p = S.en[eid].pic;
    r.disabled = p.px === 50 && p.py === 50 && p.zoom === 1;
  }
}
// The CSS classes for a story page's top block: picture size, shape and fit.
function picClass(e) {
  const p = S.en[e.id].pic;
  return 'ent-top pz-' + p.size + ' sh-' + (p.shape || PIC_DEF_SHAPE[e.type]) + ' fit-' + p.fit;
}
// Redraws just the picture block on the open story page.
function refreshPic() {
  const v = ui.view;
  if (!v || v.k !== 'ent') return;
  const top = $('#entTop'),
    e = S.meta.ents[v.id];
  if (!top || !e) return;
  top.className = picClass(e);
  const f = $('.ent-fig', top);
  f.outerHTML = picHtml(e);
}
// Makes the picture block work: upload, remove, layout options, and dragging or zooming to frame it.
function bindPic(el, e) {
  if (ui.framePage !== e.id) {
    ui.frame = false;
    ui.framePage = e.id;
  }
  const top = $('#entTop', el);
  top.addEventListener('click', ev => {
    const b = ev.target.closest('[data-im]');
    if (!b) {
      if (ui.frame && ev.target.closest('#entImg')) return;
      if (ev.target.closest('#entImg')) {
        const src = picSrc(e.id);
        if (src) lightbox(src, S.en[e.id].pic.cap);
        else $('#entFile', el).click();
      }
      return;
    }
    const a = b.dataset.im,
      p = S.en[e.id].pic;
    if (a === 'pick') $('#entFile', el).click();
    else if (a === 'rm') confirmDo('pic' + e.id, () => removePic(e.id), refreshPic);
    else if (a === 'opts') {
      ui.imgOpts = !ui.imgOpts;
      if (!ui.imgOpts) ui.frame = false;
      refreshPic();
    } else if (a === 'frame') {
      ui.frame = !ui.frame;
      refreshPic();
      if (ui.frame) {
        const f = $('#entImg');
        if (f) f.focus();
      }
    } else if (a === 'unframe') {
      Object.assign(p, { px: 50, py: 50, zoom: 1 });
      dirty('en_' + e.id);
      refreshPic();
      renderBinder();
    } else if (a === 'set') {
      p[b.dataset.k] = b.dataset.v;
      dirty('en_' + e.id);
      refreshPic();
    }
  });
  top.addEventListener('keydown', ev => {
    if (ev.target.id !== 'entImg') return;
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (ui.frame && arrows) {
      ev.preventDefault();
      const p = S.en[e.id].pic,
        st = ev.shiftKey ? 10 : 2;
      p.px = clamp(p.px + arrows[0] * st, 0, 100);
      p.py = clamp(p.py + arrows[1] * st, 0, 100);
      applyFrame(e.id);
      dirty('en_' + e.id);
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      ev.target.click();
    }
  });
  // framing: drag the picture inside its frame (moving it right shows more of its left side)
  top.addEventListener('pointerdown', ev => {
    const f = ev.target.closest('#entImg');
    if (!ui.frame || !f) return;
    ev.preventDefault();
    f.setPointerCapture(ev.pointerId);
    const p = S.en[e.id].pic,
      r = f.getBoundingClientRect(),
      x0 = ev.clientX,
      y0 = ev.clientY,
      px0 = p.px,
      py0 = p.py,
      k = 100 / Math.max(1, p.zoom);
    const mv = m => {
      p.px = clamp(px0 - ((m.clientX - x0) / r.width) * k * 1.6, 0, 100);
      p.py = clamp(py0 - ((m.clientY - y0) / r.height) * k * 1.6, 0, 100);
      applyFrame(e.id);
    };
    const up = () => {
      f.removeEventListener('pointermove', mv);
      f.removeEventListener('pointerup', up);
      f.removeEventListener('pointercancel', up);
      dirty('en_' + e.id);
      renderBinder();
    };
    f.addEventListener('pointermove', mv);
    f.addEventListener('pointerup', up);
    f.addEventListener('pointercancel', up);
  });
  top.addEventListener('input', ev => {
    if (ev.target.id !== 'picZoom') return;
    S.en[e.id].pic.zoom = clamp(+ev.target.value || 1, 1, 4);
    applyFrame(e.id);
    dirty('en_' + e.id);
  });
  top.addEventListener('change', ev => {
    if (ev.target.id === 'entFile') {
      const f = ev.target.files && ev.target.files[0];
      if (f) setPic(e.id, f);
    }
  });
  top.addEventListener('input', ev => {
    if (ev.target.id === 'entCap') {
      S.en[e.id].pic.cap = ev.target.value;
      dirty('en_' + e.id);
    }
  });
  top.addEventListener('dragover', ev => {
    if (ev.target.closest('.ent-fig')) {
      ev.preventDefault();
      top.classList.add('drop');
    }
  });
  top.addEventListener('dragleave', ev => {
    if (!top.contains(ev.relatedTarget)) top.classList.remove('drop');
  });
  top.addEventListener('drop', ev => {
    top.classList.remove('drop');
    const f = ev.dataTransfer && ev.dataTransfer.files[0];
    if (f && ev.target.closest('.ent-fig')) {
      ev.preventDefault();
      setPic(e.id, f);
    }
  });
  top.addEventListener('paste', ev => {
    if (!ev.target.closest('#entImg')) return;
    const it = [...((ev.clipboardData || {}).items || [])].find(x => x.kind === 'file' && /^image\//.test(x.type));
    if (it) {
      ev.preventDefault();
      setPic(e.id, it.getAsFile());
    }
  });
}
// Shows a picture full size over the page; a click or Escape closes it.
function lightbox(src, cap) {
  const d = document.createElement('div');
  d.className = 'lightbox';
  d.setAttribute('role', 'dialog');
  d.setAttribute('aria-label', 'Picture');
  d.innerHTML =
    '<img src="' +
    esc(src) +
    '" alt="' +
    esc(cap || '') +
    '">' +
    (cap ? '<p>' + esc(cap) + '</p>' : '') +
    '<button class="ibtn" aria-label="Close">' +
    ico('x', 20) +
    '</button>';
  const close = () => {
    d.remove();
    document.removeEventListener('keydown', k, true);
  };
  const k = ev => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      close();
    }
  };
  d.addEventListener('click', close);
  document.addEventListener('keydown', k, true);
  document.body.appendChild(d);
  $('button', d).focus();
}
