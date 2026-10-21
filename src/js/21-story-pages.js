/* ---------- main: entity page ---------- */
function mentionsOf(e) {
  const re = makeRe([e.name].concat(e.aliases || []));
  const out = [];
  if (!re) return out;
  orderedScenes().forEach(o => {
    const text = plainText(S.sc[o.id].text);
    re.lastIndex = 0;
    let m,
      n = 0,
      first = null;
    while ((m = re.exec(text))) {
      n++;
      if (!first) first = { i: m.index, l: m[0].length };
      if (!m[0].length) re.lastIndex++;
    }
    if (n) out.push({ id: o.id, ch: o.ch, n, first, text });
  });
  return out;
}
const ag = el => {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 2 + 'px';
};
function tlMentionsHtml(e) {
  const re = makeRe([e.name].concat(e.aliases || [])),
    out = [];
  if (!re) return '';
  S.meta.tls.forEach(x => {
    const t = S.tl[x.id];
    Object.values(t.cards)
      .sort((p, q) => p.at - q.at)
      .forEach(c => {
        re.lastIndex = 0;
        if (re.test(c.title + '\n' + c.body)) out.push({ x, t, c });
      });
  });
  if (!out.length) return '';
  return (
    '<section class="appears"><h3>On timelines</h3><p class="sub">' +
    out.length +
    ' card' +
    (out.length === 1 ? '' : 's') +
    ' mention this name.</p>' +
    out
      .map(
        o =>
          '<button class="ap" data-tl="' +
          o.x.id +
          '" data-card="' +
          o.c.id +
          '"><b><span>' +
          esc((o.c.icon ? o.c.icon + ' ' : '') + (o.c.title || 'Untitled card')) +
          '</span><span class="mono muted">' +
          esc(tlWhen(o.t, o.c)) +
          '</span></b><span class="muted" style="font-size:12px">' +
          esc(o.x.name) +
          '</span>' +
          (o.c.body
            ? '<span class="sn">' + esc(o.c.body.slice(0, 160)) + (o.c.body.length > 160 ? '…' : '') + '</span>'
            : '') +
          '</button>'
      )
      .join('') +
    '</section>'
  );
}
function renderEnt(el, v) {
  const m = S.meta,
    e = m.ents[v.id],
    body = S.en[v.id],
    T = TYPES[e.type];
  const ap = mentionsOf(e);
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<h1 class="mh-title">Development page</h1>' +
    '<label class="muted" style="display:flex;align-items:center;gap:6px;font-size:12px">Type <select id="entType" aria-label="Page type">' +
    TYPE_ORDER.map(
      t => '<option value="' + t + '"' + (e.type === t ? ' selected' : '') + '>' + esc(LS(t)) + '</option>'
    ).join('') +
    '</select></label></div>' +
    '<article class="sheet ent-page"><div class="' +
    picClass(e) +
    '" id="entTop">' +
    picHtml(e) +
    '<div class="ent-id">' +
    '<span class="badge t-' +
    e.type +
    '"><i class="pip"></i>' +
    esc(LS(e.type)) +
    '</span>' +
    '<input id="entName" class="ent-name" value="' +
    esc(e.name) +
    '" maxlength="70" aria-label="Name" placeholder="Name">' +
    '<div class="meta-row"><label class="f">Also called (separate with commas)<input id="entAl" value="' +
    esc((e.aliases || []).join(', ')) +
    '" placeholder="Nicknames, titles, short forms"></label>' +
    '<label class="f">One-line summary<input id="entTag" value="' +
    esc(e.tag || '') +
    '" maxlength="140" placeholder="Who or what is this, in one line?"></label></div></div></div>' +
    '<div class="fields-box">' +
    (ui.fEdit === e.type
      ? fieldsEditHtml(e.type)
      : '<div class="fields-head"><button class="btn sm" data-fe="edit" title="Add, rename, reorder or remove the fields on ' +
        esc(LP(e.type).toLowerCase()) +
        ' pages">' +
        ico('edit', 13) +
        '<span>Edit fields</span></button></div>') +
    '<div class="fields">' +
    entFields(e.type)
      .map(
        f =>
          '<label class="f">' +
          esc(f[1]) +
          '<textarea data-k="' +
          esc(f[0]) +
          '" rows="2">' +
          esc((body.fields || {})[f[0]] || '') +
          '</textarea></label>'
      )
      .join('') +
    '</div></div>' +
    '<section class="appears"><h3>Appears in</h3>' +
    (ap.length
      ? '<p class="sub">' +
        ap.reduce((a, x) => a + x.n, 0) +
        ' mention' +
        (ap.reduce((a, x) => a + x.n, 0) === 1 ? '' : 's') +
        ' across ' +
        ap.length +
        ' scene' +
        (ap.length === 1 ? '' : 's') +
        '. Open one to jump to the name.</p>' +
        ap
          .map(x => {
            const f = x.first,
              s = Math.max(0, f.i - 45),
              en = Math.min(x.text.length, f.i + f.l + 70);
            const sn =
              (s > 0 ? '…' : '') +
              esc(x.text.slice(s, f.i).replace(/\s+/g, ' ')) +
              '<mark>' +
              esc(x.text.slice(f.i, f.i + f.l)) +
              '</mark>' +
              esc(x.text.slice(f.i + f.l, en).replace(/\s+/g, ' ')) +
              (en < x.text.length ? '…' : '');
            return (
              '<button class="ap" data-sc="' +
              x.id +
              '"><b><span>' +
              esc(m.scenes[x.id].title) +
              '</span><span class="mono muted">' +
              x.n +
              '×</span></b><span class="muted" style="font-size:12px">' +
              esc(x.ch.title) +
              '</span><span class="sn">' +
              sn +
              '</span></button>'
            );
          })
          .join('')
      : '<p class="sub">Not mentioned yet. Write this name in a scene and it will link here automatically.</p>') +
    '</section>' +
    relHtml(e) +
    mapPinsHtml(e) +
    tlMentionsHtml(e) +
    '</article>';
  el.querySelector('.fields').insertAdjacentHTML('beforebegin', entContHtml(e));
  el.querySelectorAll('textarea').forEach(t => {
    ag(t);
    t.addEventListener('input', () => {
      ag(t);
      body.fields[t.dataset.k] = t.value;
      dirty('en_' + v.id);
    });
  });
  if (e.type === 'char') {
    $('.fields-box', el).insertAdjacentHTML('afterend', '<section class="arc-box" id="arcBox"></section>');
    drawArcBox(e);
  }
  bindPic(el, e);
  bindPicDrop(el, e);
  bindFieldsEdit(el, e, v);
  el.onclick = ev => {
    if (ev.target.closest('.facts')) contClick(ev);
  };
  const fa = $('.facts textarea', el);
  if (fa)
    fa.addEventListener('change', () => {
      contCheck(true);
      const box = $('.facts', el);
      if (box) {
        const at = document.activeElement === fa;
        box.outerHTML = entContHtml(e);
        const nf = $('.facts textarea', el);
        ag(nf);
        nf.addEventListener('input', () => {
          ag(nf);
          body.fields.facts = nf.value;
          dirty('en_' + v.id);
        });
      }
    });
  const nm = $('#entName', el);
  nm.addEventListener('input', () => {
    e.name = nm.value;
    dirty('meta');
    linker = buildLinker();
    renderBinder();
  });
  nm.addEventListener('blur', () => {
    if (!nm.value.trim()) {
      e.name = 'Untitled';
      nm.value = 'Untitled';
      dirty('meta');
      linker = buildLinker();
      renderBinder();
    }
  });
  $('#entAl', el).addEventListener('input', ev => {
    e.aliases = [
      ...new Set(
        ev.target.value
          .split(/[,;]/)
          .map(s => s.trim())
          .filter(Boolean)
      )
    ];
    dirty('meta');
    linker = buildLinker();
  });
  $('#entTag', el).addEventListener('input', ev => {
    e.tag = ev.target.value;
    dirty('meta');
  });
  $('#entType', el).addEventListener('change', ev => {
    e.type = ev.target.value;
    dirty('meta');
    renderBinder();
    renderEnt(el, v);
  });
  el.querySelectorAll('.ap[data-sc]').forEach(b =>
    b.addEventListener('click', () => go({ k: 'scene', id: b.dataset.sc, flash: v.id }))
  );
  el.querySelectorAll('.ap[data-cv]').forEach(b =>
    b.addEventListener('click', () => {
      ui.cvFor = b.dataset.id;
      ui.cvSel = { k: b.dataset.sk, id: b.dataset.sel };
      go({ k: b.dataset.cv, id: b.dataset.id });
    })
  );
  el.querySelectorAll('.ap[data-mapof]').forEach(b =>
    b.addEventListener('click', () => {
      ui.mpSel = b.dataset.pin;
      go({ k: 'nt', id: b.dataset.mapof });
    })
  );
  el.querySelectorAll('.ap[data-card]').forEach(b =>
    b.addEventListener('click', () => {
      go({ k: 'tl', id: b.dataset.tl });
      tlOpenCard(b.dataset.card, true);
    })
  );
  if (ui.focusName) {
    ui.focusName = false;
    nm.focus();
    nm.select();
  }
}
