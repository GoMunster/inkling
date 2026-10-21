/* ---------- main: corkboard ---------- */
function renderCork(el) {
  const m = S.meta;
  if (ui.cork !== 'all' && !m.chapters.find(c => c.id === ui.cork)) ui.cork = 'all';
  const chs = ui.cork === 'all' ? m.chapters : m.chapters.filter(c => c.id === ui.cork);
  let h =
    '<div class="main-head">' +
    backBtn() +
    '<h1 class="mh-title">Corkboard</h1><select id="corkSel" aria-label="Show chapter"><option value="all">All chapters</option>' +
    m.chapters
      .map(
        c => '<option value="' + c.id + '"' + (ui.cork === c.id ? ' selected' : '') + '>' + esc(c.title) + '</option>'
      )
      .join('') +
    '</select><button class="btn" data-ca="addsc">' +
    ico('plus') +
    '<span>Scene</span></button></div><div class="cork">';
  const one = ui.cork !== 'all';
  chs.forEach(c => {
    const nt = (S.ch[c.id] || {}).notes || '';
    h += '<h2 class="cork-ch">' + esc(c.title) + '</h2>';
    if (one)
      h +=
        '<section class="ch-notes' +
        (ui.chNotesHide ? ' shut' : '') +
        '"><div class="chn-head"><button class="chn-tog" data-ca="chntog" aria-expanded="' +
        !ui.chNotesHide +
        '">' +
        ico(ui.chNotesHide ? 'right' : 'down', 14) +
        '<span>Chapter notes</span></button><span class="muted mono" id="chnWc">' +
        fmt(wc(nt)) +
        ' words</span></div>' +
        (ui.chNotesHide
          ? ''
          : '<textarea class="chn-ta" id="chNotes" data-id="' +
            c.id +
            '" aria-label="Notes for ' +
            esc(c.title) +
            '" placeholder="Goals for this chapter, threads to pick up, research, what has to change by the end…">' +
            esc(nt) +
            '</textarea><div class="chiplinks" id="chNames"></div>') +
        '</section>';
    else if (nt.trim())
      h +=
        '<button class="chn-peek" data-ca="chopen" data-id="' +
        c.id +
        '" title="Open this chapter and its notes">' +
        ico('edit', 12) +
        '<span>' +
        esc(nt.trim().replace(/\s+/g, ' ').slice(0, 220)) +
        (nt.trim().length > 220 ? '…' : '') +
        '</span></button>';
    h += '<div class="cards" data-ch="' + c.id + '">';
    c.scenes.forEach(id => {
      const s = m.scenes[id],
        d = S.sc[id];
      h +=
        '<article class="card" data-sid="' +
        id +
        '"><header title="Drag to move this scene"><button class="card-t" data-ca="open" data-id="' +
        id +
        '">' +
        esc(s.title) +
        '</button><span class="st st-' +
        s.status +
        '">' +
        STATUS[s.status] +
        '</span></header><textarea class="syn" data-id="' +
        id +
        '" rows="4" aria-label="Synopsis for ' +
        esc(s.title) +
        '" placeholder="Synopsis: what happens in this scene?">' +
        esc(d.synopsis) +
        '</textarea><footer><span class="mono">' +
        fmt(s.words) +
        ' words</span><span class="acts on"><button class="ibtn" data-ca="mvup" data-id="' +
        id +
        '" aria-label="Move earlier">' +
        ico('back', 14) +
        '</button><button class="ibtn" data-ca="mvdn" data-id="' +
        id +
        '" aria-label="Move later">' +
        ico('right', 14) +
        '</button></span></footer></article>';
    });
    if (!c.scenes.length) h += '<p class="muted">No scenes in this chapter yet.</p>';
    h += '</div>';
  });
  if (!m.chapters.length)
    h += '<p class="muted" style="padding:24px 0">No chapters yet. Use + Chapter in the binder.</p>';
  el.innerHTML = h + '</div>';
  el.querySelectorAll('.syn').forEach(t => {
    ag(t);
    t.addEventListener('input', () => {
      ag(t);
      S.sc[t.dataset.id].synopsis = t.value;
      dirty('sc_' + t.dataset.id);
    });
  });
  $('#corkSel', el).addEventListener('change', ev => {
    ui.cork = ev.target.value;
    renderCork(el);
  });
  dragSort(el, {
    item: '.card',
    handle: 'header',
    zones: '.cards',
    grid: true,
    scroll: () => $('#main'),
    drop: (it, ref, zone) => moveSceneTo(it.dataset.sid, zone.dataset.ch, ref && ref.dataset.sid)
  });
  const cn = $('#chNotes', el);
  if (cn) {
    const names = () => {
      const box = $('#chNames', el);
      if (!box) return;
      const seen = [];
      findLinks(cn.value).forEach(l => {
        if (!seen.includes(l.id)) seen.push(l.id);
      });
      box.innerHTML = seen
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
    };
    ag(cn);
    names();
    cn.addEventListener('input', () => {
      ag(cn);
      S.ch[cn.dataset.id].notes = cn.value;
      dirty('ch_' + cn.dataset.id);
      $('#chnWc', el).textContent = fmt(wc(cn.value)) + ' words';
      clearTimeout(ui.cnt);
      ui.cnt = setTimeout(names, 400);
    });
  }
  el.onclick = ev => {
    const b = ev.target.closest('[data-ca]');
    if (!b) return;
    const a = b.dataset.ca,
      id = b.dataset.id;
    if (a === 'open') go({ k: 'scene', id });
    else if (a === 'mvup') moveScene(id, -1);
    else if (a === 'mvdn') moveScene(id, 1);
    else if (a === 'addsc') {
      addScene(ui.cork === 'all' ? null : ui.cork, false);
    } else if (a === 'chntog') {
      ui.chNotesHide = !ui.chNotesHide;
      renderCork(el);
      if (!ui.chNotesHide) {
        const t = $('#chNotes', el);
        if (t) t.focus();
      }
    } else if (a === 'chopen') {
      ui.cork = id;
      renderCork(el);
      renderBinder();
    }
  };
}
