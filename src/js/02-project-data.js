/* ---------- sample + blank projects ---------- */
function sampleProject() {
  const t1 =
    'Ilsa Verrin stepped off the ferry with one bag, one coat, and no plan she was willing to say aloud. Marrow Quay smelled of tar and wet rope, and the fog had already swallowed the far end of the pier.\n\n"You\'ll be wanting the Gull," said the porter, not asking. "Everyone does, the first night."\n\nShe did not argue. The Gull & Lantern was the only lit window on the whole waterfront, and somewhere inside it, Tobias Crane was waiting with a story she had crossed the sea to hear.';
  const t2 =
    'Tobias Crane kept his ledger the way other men keep secrets: close, and in code. He turned it toward Ilsa only after the third cup of tea.\n\n"Every ship that docked at Marrow Quay in the last ten years is in here," he said. "Every ship except one."\n\nHe slid something across the table. The brass compass was warm from his pocket, and its needle ignored north entirely. It pointed at Ilsa, and held steady, and did not waver when she moved.';
  const t3 =
    'By dusk the lamplighters had reached the end of the pier. Ilsa watched from the window of the Gull as the lanterns came on, one by one, each flame a little late, like an echo.';
  const ids = {
    c1: 'c_one',
    c2: 'c_two',
    s1: 's_arrive',
    s2: 's_ledger',
    s3: 's_lamps',
    ilsa: 'e_ilsa',
    tobias: 'e_tobias',
    quay: 'e_quay',
    gull: 'e_gull',
    comp: 'e_compass'
  };
  const meta = {
    v: 1,
    title: 'The Lantern Tide (sample)',
    author: '',
    goal: 500,
    target: 80000,
    sample: true,
    saved: Date.now(),
    chapters: [
      { id: ids.c1, title: 'Chapter 1 · The Salt Road', open: true, scenes: [ids.s1, ids.s2] },
      { id: ids.c2, title: 'Chapter 2 · Lanterns', open: true, scenes: [ids.s3] }
    ],
    scenes: {
      [ids.s1]: { title: 'Arrival at Marrow Quay', status: 'revised', words: 0 },
      [ids.s2]: { title: 'The Crane ledger', status: 'draft', words: 0 },
      [ids.s3]: { title: 'Lighting the lanterns', status: 'draft', words: 0 }
    },
    ents: {
      [ids.ilsa]: {
        id: ids.ilsa,
        type: 'char',
        name: 'Ilsa Verrin',
        aliases: ['Ilsa'],
        tag: 'Cartographer who follows a missing ship'
      },
      [ids.tobias]: {
        id: ids.tobias,
        type: 'char',
        name: 'Tobias Crane',
        aliases: ['Crane'],
        tag: 'Harbour clerk with an unreadable ledger'
      },
      [ids.quay]: {
        id: ids.quay,
        type: 'place',
        name: 'Marrow Quay',
        aliases: [],
        tag: 'Fog-bound port at the end of the salt road'
      },
      [ids.gull]: {
        id: ids.gull,
        type: 'place',
        name: 'The Gull & Lantern',
        aliases: ['the Gull'],
        tag: 'Only lit tavern on the waterfront'
      },
      [ids.comp]: {
        id: ids.comp,
        type: 'thing',
        name: 'Brass compass',
        aliases: ['the brass compass'],
        tag: 'Points at a person, not at north'
      }
    },
    pet: { name: 'Inky', total: 0 },
    days: {},
    mark: null
  };
  const sc = {
    [ids.s1]: {
      text: t1,
      synopsis: 'Ilsa arrives in fog and is steered toward the one place still open.',
      notes: 'Keep the porter nameless for now.'
    },
    [ids.s2]: {
      text: t2,
      synopsis: 'Tobias shows his coded ledger and hands over the compass.',
      notes: 'Plant the missing ship. Do not name it yet.'
    },
    [ids.s3]: { text: t3, synopsis: 'The lanterns come on late. Something is off with the tide.', notes: '' }
  };
  const en = {
    [ids.ilsa]: {
      fields: {
        role: 'Protagonist. A cartographer whose last commission vanished at sea.',
        want: 'To find the ship her brother sailed on.',
        fear: 'That the map she drew was the reason it was lost.',
        arc: 'Trusts charts, learns to trust people.'
      }
    },
    [ids.tobias]: {
      fields: {
        role: 'Keeper of the harbour ledger. Knows more than he says.',
        voice: 'Dry, patient, answers questions with other questions.',
        notes: 'Pays for tea, never for anything else.'
      }
    },
    [ids.quay]: {
      fields: {
        kind: 'Fishing port and ferry landing',
        feel: 'Tar, wet rope, fog that arrives before the tide.',
        past: 'Founded by salt traders. Three lighthouses, two of them dark.'
      }
    },
    [ids.gull]: {
      fields: {
        kind: 'Tavern with four rooms upstairs',
        feel: 'Low beams, one fireplace, lantern glass in every window.',
        who: 'Pilots, porters, and anyone waiting for a ship.'
      }
    },
    [ids.comp]: {
      fields: {
        look: 'Brass, thumb-sized, chipped at the hinge.',
        origin: 'Unknown. Crane will not say.',
        power: 'The needle ignores north and settles on one person.'
      }
    }
  };
  meta.tls = [{ id: 't_main', name: 'Story timeline' }];
  const ch = {
    [ids.c1]: {
      notes:
        'Goal: get Ilsa to Marrow Quay and put the brass compass in her hand.\nKeep Tobias Crane friendly but evasive. The reader should trust him a little less than Ilsa does.'
    },
    [ids.c2]: { notes: '' }
  };
  const L = { i: 'l_ilsa', t: 'l_tobias', w: 'l_world' };
  const k = (id, o) =>
    Object.assign({ id, len: 0, body: '', when: '', icon: '', color: '', style: 'tint', scene: '' }, o);
  const tl = {
    t_main: {
      axis: { start: 0, step: 1, px: 190, fmt: 'Day {n}', names: '', cycle: 1, snap: 0.5 },
      cardW: 200,
      density: 'normal',
      showWhen: true,
      showMarks: true,
      grid: true,
      lanes: [
        { id: L.i, name: 'Ilsa', color: 'char' },
        { id: L.t, name: 'Tobias', color: 'thing' },
        { id: L.w, name: 'The world', color: 'place' }
      ],
      cards: {
        k_wren: k('k_wren', {
          lane: L.w,
          at: 0,
          title: 'The Wren sails from Marrow Quay',
          body: "Ilsa's brother is aboard. The ship never reaches port.",
          when: 'Ten years earlier',
          icon: '⚓',
          style: 'dashed'
        }),
        k_arrive: k('k_arrive', {
          lane: L.i,
          at: 1,
          title: 'Arrival at Marrow Quay',
          body: 'Ilsa arrives in fog and heads for the Gull.',
          scene: ids.s1
        }),
        k_ledger: k('k_ledger', {
          lane: L.t,
          at: 1.5,
          title: 'The Crane ledger',
          body: 'Tobias Crane hands Ilsa the brass compass.',
          scene: ids.s2
        }),
        k_fog: k('k_fog', {
          lane: L.w,
          at: 1,
          len: 4,
          title: 'Fog season',
          body: 'No ship leaves Marrow Quay.',
          color: 'muted'
        }),
        k_lamps: k('k_lamps', {
          lane: L.w,
          at: 2,
          title: 'Lanterns light late',
          body: 'Something is off with the tide.',
          scene: ids.s3
        }),
        k_follow: k('k_follow', {
          lane: L.i,
          at: 4,
          title: 'Ilsa follows the compass',
          body: 'Not written yet.',
          icon: '?',
          style: 'dashed'
        })
      },
      marks: [
        { id: 'm_one', label: 'Act I', at: 1, len: 3, color: 'accent' },
        { id: 'm_two', label: 'Act II', at: 4, len: 4, color: 'char' }
      ]
    }
  };
  meta.nts = [
    { id: 'n_gen', name: 'General notes', kind: 'page' },
    { id: 'n_brain', name: 'Brainstorming', kind: 'board' }
  ];
  const nt = {
    n_gen: {
      text: "The Wren went missing ten years ago with Ilsa's brother aboard.\n\nTone: foggy, quiet, a little uncanny. Lanterns that light late are the only hint of magic in the first act.",
      ideas: []
    },
    n_brain: {
      text: '',
      ideas: [
        { id: 'i1', text: 'What if the brass compass points at whoever is lying?', color: 'thing' },
        { id: 'i2', text: 'The Wren never left. It is under the harbour.', color: 'accent' },
        { id: 'i3', text: "Tobias Crane sailed with Ilsa's brother once.", color: 'char' }
      ]
    }
  };
  meta.ols = [{ id: 'o_main', name: 'Novel outline' }];
  const oi = (id, depth, text, o) =>
    Object.assign({ id, depth, text, note: '', done: false, open: true, noteOpen: false, scene: '' }, o || {});
  const ol = {
    o_main: {
      num: 'decimal',
      showNotes: true,
      items: [
        oi('a1', 0, 'Act I · The Salt Road'),
        oi('a1b', 1, 'Ilsa lands at Marrow Quay', { scene: ids.s1, done: true }),
        oi('a1c', 1, 'Tobias hands over the brass compass', {
          scene: ids.s2,
          note: 'Plant the missing ship without naming it.'
        }),
        oi('a1d', 1, 'The lanterns light late', { scene: ids.s3 }),
        oi('a2', 0, 'Act II · The Dark Lighthouse'),
        oi('a2b', 1, 'Ilsa follows the compass out along the breakwater'),
        oi('a2c', 1, 'Midpoint: the compass swings to Tobias'),
        oi('a3', 0, 'Act III · Low Tide'),
        oi('a3b', 1, 'The Wren rises')
      ]
    }
  };
  meta.secs = { ol: true, nt: true, tl: true, rm: true, ft: true, place: true, thing: true };
  const rm = newRm(),
    K = rm.kinds,
    nd = (id, o) => Object.assign({ id, ent: '', name: '', x: 0, y: 0, color: '', size: '', note: '' }, o);
  rm.nodes = [
    nd('n_ilsa', { ent: ids.ilsa, x: 0, y: 0, size: 'l' }),
    nd('n_tob', { ent: ids.tobias, x: 260, y: -30 }),
    nd('n_eli', {
      name: 'Elias Verrin',
      x: 70,
      y: 230,
      color: 'char',
      note: "Ilsa's older brother. Sailed on the Wren."
    }),
    nd('n_comp', { ent: ids.comp, x: -230, y: 90, size: 's' }),
    nd('n_gull', { ent: ids.gull, x: 300, y: 200, size: 's' })
  ];
  const ed = (id, a, b, k, label, dir) => ({ id, a, b, kind: K[k].id, dir: dir || 'none', label, note: '' });
  rm.edges = [
    ed('r1', 'n_ilsa', 'n_tob', 3, 'wary allies'),
    ed('r2', 'n_ilsa', 'n_eli', 0, 'brother · missing'),
    ed('r3', 'n_tob', 'n_eli', 6, 'sailed together?'),
    ed('r4', 'n_comp', 'n_ilsa', 6, 'points at her', 'ab'),
    ed('r5', 'n_tob', 'n_gull', 2, 'regular')
  ];
  rm.view = { x: 420, y: 220, k: 1 };
  meta.rms = [{ id: 'm_main', name: "Who's who" }];
  const ft = newFt(),
    pp = (id, o) =>
      Object.assign(
        { id, ent: '', name: '', title: '', born: '', died: '', color: '', of: '', ptype: 'bio', note: '' },
        o
      );
  ft.people = [
    pp('p_osk', { name: 'Oskar Verrin', title: 'Harbour pilot', born: '1004', died: '1046' }),
    pp('p_mar', { name: 'Maren Hale', title: 'Chart maker', born: '1007' }),
    pp('p_eli', { name: 'Elias Verrin', title: 'Sailor on the Wren', born: '1028', died: '?', of: 'u_om' }),
    pp('p_ils', { ent: ids.ilsa, born: '1031', of: 'u_om', color: 'char' })
  ];
  ft.unions = [{ id: 'u_om', a: 'p_osk', b: 'p_mar', kind: ft.kinds[0].id, label: 'm. 1026', note: '' }];
  meta.fts = [{ id: 'f_main', name: 'The Verrins' }];
  const day = 864e5,
    at = (d, h, m) => {
      const x = new Date(Date.now() - d * day);
      x.setHours(h, m, 0, 0);
      return +x;
    };
  const ss = {
    w_s1: {
      start: at(2, 9, 5),
      end: at(2, 9, 30),
      planned: 25,
      mins: 25,
      words: 412,
      net: 398,
      done: true,
      scenes: [ids.s1]
    },
    w_s2: {
      start: at(2, 9, 36),
      end: at(2, 10, 1),
      planned: 25,
      mins: 25,
      words: 356,
      net: 340,
      done: true,
      scenes: [ids.s1, ids.s2]
    },
    w_s3: {
      start: at(1, 20, 10),
      end: at(1, 20, 24),
      planned: 25,
      mins: 14,
      words: 180,
      net: 122,
      done: false,
      scenes: [ids.s2]
    }
  };
  return { meta, sc, en, tl, ch, nt, ol, rm: { m_main: rm }, ft: { f_main: ft }, ss };
}
function blankProject() {
  const c = uid('c_'),
    s = uid('s_');
  return {
    meta: {
      v: 1,
      title: 'Untitled novel',
      author: '',
      goal: 500,
      target: 80000,
      sample: false,
      saved: Date.now(),
      chapters: [{ id: c, title: 'Chapter 1', open: true, scenes: [s] }],
      scenes: { [s]: { title: 'Opening scene', status: 'draft', words: 0 } },
      ents: {},
      pet: { name: 'Inky', total: 0 },
      days: {},
      mark: null
    },
    sc: { [s]: { text: '', synopsis: '', notes: '' } },
    en: {}
  };
}
function normalize(o) {
  o = JSON.parse(JSON.stringify(o));
  o.meta = o.meta || {};
  o = migrate(o);
  const stamps = {};
  DOCS.forEach(p => {
    const m = o[p] && typeof o[p] === 'object' ? o[p] : {};
    Object.keys(m).forEach(id => {
      const x = m[id];
      if (x && x._m)
        (stamps[p] = stamps[p] || {})[id] = [+x._m, String(x._dev || ''), String(x._by || '').slice(0, 60)];
    });
  });
  const meta = o.meta;
  meta.v = FORMAT;
  const gn = meta.gone && typeof meta.gone === 'object' ? meta.gone : {},
    cut = Date.now() - 180 * 864e5;
  meta.gone = {};
  Object.keys(gn)
    .filter(k => +gn[k] > cut)
    .sort((a, b) => gn[b] - gn[a])
    .slice(0, 2000)
    .forEach(k => {
      meta.gone[k] = +gn[k];
    });
  meta.title = meta.title || 'Untitled novel';
  meta.goal = +meta.goal || 500;
  meta.target = +meta.target || 80000;
  meta.chapters = Array.isArray(meta.chapters) ? meta.chapters : [];
  meta.scenes = meta.scenes || {};
  meta.ents = meta.ents || {};
  meta.pet = normPet(meta.pet);
  meta.days = meta.days || {};
  meta.saved = +meta.saved || 0;
  meta.pomo = normPomo(meta.pomo);
  meta.todo = normTodo(meta.todo);
  meta.layout = normLayout(meta.layout || LOOK.layoutDef);
  meta.plan = normPlan(meta.plan, meta.target);
  meta.fields = normFields(meta.fields);
  meta.exp = normExp(meta.exp);
  meta.author = String(meta.author || '');
  const wr = meta.writers && typeof meta.writers === 'object' ? meta.writers : {};
  meta.writers = {};
  Object.keys(wr)
    .slice(0, 60)
    .forEach(k => {
      const w = wr[k];
      if (!w || typeof w !== 'object') return;
      meta.writers[String(k).slice(0, 60)] = {
        name: String(w.name || '').slice(0, 60),
        days: w.days && typeof w.days === 'object' ? w.days : {},
        pet: normPet(w.pet),
        mark: w.mark || null,
        goal: +w.goal || 500,
        pomo: normPomo(w.pomo),
        ...(w.todo ? { todo: normTodo(w.todo) } : {}),
        ...(w.layout ? { layout: normLayout(w.layout) } : {}),
        ...(w.plan ? { plan: normPlan(w.plan) } : {}),
        devs: (Array.isArray(w.devs) ? w.devs : []).filter(x => typeof x === 'string').slice(-10),
        at: +w.at || 0
      };
    });
  const sx = meta.secs && typeof meta.secs === 'object' ? meta.secs : { rm: false, ft: false };
  meta.secs = {};
  OPT_SECS.forEach(k => {
    meta.secs[k] = sx[k] === undefined ? !['rm', 'ft', 'rule', 'term'].includes(k) : !!sx[k];
  });
  const lb = meta.labels && typeof meta.labels === 'object' ? meta.labels : {};
  meta.labels = {};
  Object.keys(SEC_DEF).forEach(k => {
    const x = lb[k] || {},
      p = String(x.p || '')
        .trim()
        .slice(0, 40),
      q = String(x.s || '')
        .trim()
        .slice(0, 40);
    if (p || q) meta.labels[k] = { p, s: q };
  });
  const sc = o.sc || {},
    en = o.en || {};
  meta.chapters.forEach(c => {
    c.scenes = (c.scenes || []).filter(id => meta.scenes[id]);
    c.scenes.forEach(id => {
      sc[id] = sc[id] || {};
      sc[id].stickies = normStickies(sc[id].stickies);
      sc[id].text = sc[id].text || '';
      sc[id].synopsis = sc[id].synopsis || '';
      sc[id].notes = sc[id].notes || '';
      meta.scenes[id].words = wc(sc[id].text);
      meta.scenes[id].status = STATUS[meta.scenes[id].status] ? meta.scenes[id].status : 'draft';
      meta.scenes[id].title = meta.scenes[id].title || 'Untitled scene';
      const g = Math.round(+meta.scenes[id].goal || 0);
      if (g > 0) meta.scenes[id].goal = Math.min(1000000, g);
      else delete meta.scenes[id].goal;
    });
    {
      const g = Math.round(+c.goal || 0);
      if (g > 0) c.goal = Math.min(1000000, g);
      else delete c.goal;
    }
    if (c.open == null) c.open = true;
  });
  Object.keys(meta.ents).forEach(id => {
    const e = meta.ents[id];
    e.id = id;
    e.aliases = Array.isArray(e.aliases) ? e.aliases : [];
    e.tag = e.tag || '';
    if (!TYPES[e.type]) e.type = 'thing';
    en[id] = en[id] || {};
    en[id].fields = en[id].fields || {};
    en[id].pic = normPic(en[id].pic);
    const ar = normArc(en[id].arc);
    if (ar) en[id].arc = ar;
    else delete en[id].arc;
    const fr = normFrom(e.from);
    if (fr) e.from = fr;
    else delete e.from;
  });
  meta.series = normSeries(meta.series);
  meta.world = normWorld(meta.world);
  meta.threads = normThreads(meta.threads);
  meta.setups = normSetups(meta.setups);
  normSceneDetails(meta);
  if (!meta.chapters.length) {
    const b = blankProject();
    meta.chapters = b.meta.chapters;
    meta.scenes = Object.assign(meta.scenes, b.meta.scenes);
    Object.assign(sc, b.sc);
  }
  const tl = o.tl && typeof o.tl === 'object' ? o.tl : {};
  if (!Array.isArray(meta.tls)) {
    meta.tls = [];
    if (!Object.keys(tl).length) {
      const id = uid('t_');
      meta.tls.push({ id, name: 'Story timeline' });
      tl[id] = newTl();
    }
  }
  meta.tls = meta.tls.filter(x => x && x.id).map(x => ({ id: String(x.id), name: String(x.name || 'Timeline') }));
  Object.keys(tl).forEach(id => {
    if (!meta.tls.some(x => x.id === id)) meta.tls.push({ id, name: 'Timeline' });
  });
  const tlo = {};
  meta.tls.forEach(x => {
    tlo[x.id] = normTl(tl[x.id]);
  });
  const chi = o.ch && typeof o.ch === 'object' ? o.ch : {},
    cho = {};
  meta.chapters.forEach(c => {
    cho[c.id] = { notes: String((chi[c.id] || {}).notes || '') };
  });
  const nti = o.nt && typeof o.nt === 'object' ? o.nt : {},
    nto = {};
  if (!Array.isArray(meta.nts))
    meta.nts = [
      { id: uid('n_'), name: 'General notes', kind: 'page' },
      { id: uid('n_'), name: 'Brainstorming', kind: 'board' }
    ];
  meta.nts = meta.nts
    .filter(x => x && x.id)
    .map(x => ({
      id: String(x.id),
      name: String(x.name || 'Notes'),
      kind: ['board', 'map'].includes(x.kind) ? x.kind : 'page'
    }));
  meta.nts.forEach(x => {
    const d = nti[x.id] || {};
    nto[x.id] = {
      text: String(d.text || ''),
      ideas: (Array.isArray(d.ideas) ? d.ideas : [])
        .filter(i => i && i.id)
        .map(i => ({
          id: String(i.id),
          text: String(i.text || ''),
          color: NT_COLORS.includes(i.color) ? i.color : 'thing'
        }))
    };
    if (x.kind === 'map') Object.assign(nto[x.id], normMap(d, meta.ents));
  });
  const oli = o.ol && typeof o.ol === 'object' ? o.ol : {},
    olo = {};
  if (!Array.isArray(meta.ols)) meta.ols = [{ id: uid('o_'), name: 'Novel outline' }];
  meta.ols = meta.ols.filter(x => x && x.id).map(x => ({ id: String(x.id), name: String(x.name || 'Outline') }));
  meta.ols.forEach(x => {
    const d = oli[x.id] || {};
    let prev = -1;
    olo[x.id] = {
      num: OL_NUMS.some(n => n[0] === d.num) ? d.num : 'decimal',
      showNotes: d.showNotes !== false,
      items: (Array.isArray(d.items) ? d.items : [])
        .filter(i => i && i.id)
        .map(i => {
          const dp = Math.min(prev + 1, clamp(Math.round(num(i.depth, 0)), 0, OL_MAX));
          prev = dp;
          return {
            id: String(i.id),
            text: String(i.text || ''),
            note: String(i.note || ''),
            depth: dp,
            done: !!i.done,
            open: i.open !== false,
            noteOpen: !!i.noteOpen,
            scene: i.scene && meta.scenes[i.scene] ? String(i.scene) : '',
            tpl:
              i.tpl && typeof i.tpl === 'object' && typeof i.tpl.t === 'string'
                ? {
                    t: i.tpl.t.slice(0, 200),
                    n: String(i.tpl.n || '').slice(0, 1000),
                    p: isFinite(i.tpl.p) ? +i.tpl.p : undefined
                  }
                : undefined
          };
        })
    };
  });
  const rmo = {},
    fto = {},
    rmi = o.rm && typeof o.rm === 'object' ? o.rm : {},
    fti = o.ft && typeof o.ft === 'object' ? o.ft : {};
  meta.rms = (Array.isArray(meta.rms) ? meta.rms : [])
    .filter(x => x && x.id)
    .map(x => ({ id: String(x.id), name: String(x.name || 'Relationship map') }));
  meta.fts = (Array.isArray(meta.fts) ? meta.fts : [])
    .filter(x => x && x.id)
    .map(x => ({ id: String(x.id), name: String(x.name || 'Family tree') }));
  meta.rms.forEach(x => {
    rmo[x.id] = normRm(rmi[x.id], meta.ents);
  });
  meta.fts.forEach(x => {
    fto[x.id] = normFt(fti[x.id], meta.ents);
  });
  const ssi = o.ss && typeof o.ss === 'object' ? o.ss : {},
    sso = {};
  Object.keys(ssi).forEach(id => {
    const x = ssi[id];
    if (!x || !isFinite(+x.start)) return;
    sso[id] = {
      start: +x.start,
      end: isFinite(+x.end) ? +x.end : +x.start,
      planned: Math.max(0, Math.round(num(x.planned, 25))),
      mins: Math.max(0, num(x.mins, 0)),
      words: Math.max(0, Math.round(num(x.words, 0))),
      net: Math.round(num(x.net, 0)),
      done: !!x.done,
      scenes: (Array.isArray(x.scenes) ? x.scenes : []).filter(y => typeof y === 'string').slice(0, 60)
    };
    if (typeof x.cyc === 'string' && x.cyc) sso[id].cyc = x.cyc.slice(0, 24);
  });
  const out = { meta, sc, en, tl: tlo, ch: cho, nt: nto, ol: olo, rm: rmo, ft: fto, ss: sso };
  ADD_DOCS.forEach(f => f(o, out));
  DOCS.forEach(p => {
    const st = stamps[p] || {},
      m = out[p] || {};
    Object.keys(m).forEach(id => {
      if (st[id] && m[id] && typeof m[id] === 'object') {
        m[id]._m = st[id][0];
        m[id]._dev = st[id][1];
        if (st[id][2]) m[id]._by = st[id][2];
      }
    });
  });
  return out;
}

/* ---------- timeline data ---------- */
const TL_COLORS = [
  ['accent', 'Blue'],
  ['char', 'Rose'],
  ['place', 'Green'],
  ['thing', 'Amber'],
  ['pet', 'Teal'],
  ['danger', 'Red'],
  ['muted', 'Slate']
];
const TL_DENS = { compact: 46, normal: 112, tall: 176 };
const TL_STYLES = [
  ['tint', 'Tinted'],
  ['outline', 'Outline'],
  ['dashed', 'Dashed'],
  ['solid', 'Solid']
];
const TL_SNAPS = [
  [0, 'Free'],
  [1, 'Whole units'],
  [0.5, 'Halves'],
  [0.25, 'Quarters'],
  [0.1, 'Tenths']
];
const TL_PRESETS = [
  ['Day {n}', '', 'Days'],
  ['Week {n}', '', 'Weeks'],
  ['Year {n}', '', 'Years'],
  ['Chapter {n}', '', 'Chapters'],
  ['Act {n}', '', 'Acts'],
  ['{n}:00', '', 'Hours of a day'],
  ['{name} {cycle}', 'Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec', 'Months and years'],
  ['{name}, year {cycle}', 'Spring, Summer, Autumn, Winter', 'Seasons and years'],
  ['{name}, week {cycle}', 'Mon, Tue, Wed, Thu, Fri, Sat, Sun', 'Weekdays'],
  ['{n}', '', 'Plain numbers']
];
const hexOk = c => /^#[0-9a-f]{6}$/i.test(c || '');
const colOk = c => hexOk(c) || TL_COLORS.some(x => x[0] === c);
const cssCol = c => (hexOk(c) ? c : 'var(--' + (colOk(c) ? c : 'accent') + ')');
function inkOn(c) {
  if (!hexOk(c)) return 'var(--paper)';
  const n = parseInt(c.slice(1), 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? '#17202D' : '#FFFFFF';
}
const num = (v, d) => {
  v = parseFloat(v);
  return isFinite(v) ? v : d;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nfmt = v => String(Math.round(v * 100) / 100);
function newTl() {
  const l = (name, color) => ({ id: uid('l_'), name, color, hide: false });
  return {
    axis: { start: 1, step: 1, px: 170, fmt: 'Day {n}', names: '', cycle: 1, snap: 1 },
    cardW: 190,
    density: 'normal',
    showWhen: true,
    showMarks: true,
    grid: true,
    lanes: [l('Main plot', 'accent'), l('Subplot', 'char'), l('World', 'place')],
    cards: {},
    marks: []
  };
}
function normTl(t) {
  t = t && typeof t === 'object' ? t : {};
  const a = t.axis || {};
  t.axis = {
    start: num(a.start, 1),
    step: num(a.step, 1) > 0 ? num(a.step, 1) : 1,
    px: clamp(num(a.px, 170), 40, 600),
    fmt: typeof a.fmt === 'string' && a.fmt.trim() ? a.fmt : '{n}',
    names: typeof a.names === 'string' ? a.names : '',
    cycle: num(a.cycle, 1),
    snap: TL_SNAPS.some(s => s[0] === num(a.snap, 1)) ? num(a.snap, 1) : 1
  };
  t.cardW = clamp(num(t.cardW, 190), 110, 400);
  t.density = TL_DENS[t.density] ? t.density : 'normal';
  t.showWhen = t.showWhen !== false;
  t.showMarks = t.showMarks !== false;
  t.grid = t.grid !== false;
  t.lanes = (Array.isArray(t.lanes) ? t.lanes : [])
    .filter(l => l && l.id)
    .map(l => ({
      id: String(l.id),
      name: String(l.name == null ? 'Lane' : l.name),
      note: String(l.note || '').slice(0, 60),
      color: colOk(l.color) ? l.color : 'accent',
      hide: !!l.hide
    }));
  if (!t.lanes.length) t.lanes = newTl().lanes.slice(0, 1);
  const cards = t.cards && typeof t.cards === 'object' ? t.cards : {};
  t.cards = {};
  Object.keys(cards).forEach(id => {
    const c = cards[id];
    if (!c || typeof c !== 'object') return;
    t.cards[id] = {
      id,
      lane: t.lanes.some(l => l.id === c.lane) ? c.lane : t.lanes[0].id,
      at: num(c.at, 0),
      len: Math.max(0, num(c.len, 0)),
      title: String(c.title || ''),
      body: String(c.body || ''),
      when: String(c.when || ''),
      icon: String(c.icon || '').slice(0, 4),
      color: colOk(c.color) ? c.color : '',
      style: TL_STYLES.some(s => s[0] === c.style) ? c.style : 'tint',
      scene: c.scene ? String(c.scene) : ''
    };
  });
  const tk = t.ticks && typeof t.ticks === 'object' ? t.ticks : {};
  t.ticks = {};
  Object.keys(tk).forEach(k => {
    const v = String(tk[k] == null ? '' : tk[k]).slice(0, 60);
    if (/^-?\d+$/.test(k) && v.trim()) t.ticks[k] = v;
  });
  t.corner = typeof t.corner === 'string' ? t.corner.slice(0, 30) : 'Lanes';
  t.tickSize = ['s', 'm', 'l'].includes(t.tickSize) ? t.tickSize : 's';
  t.marks = (Array.isArray(t.marks) ? t.marks : [])
    .filter(m => m && m.id)
    .map(m => ({
      id: String(m.id),
      label: String(m.label || ''),
      at: num(m.at, 0),
      len: Math.max(0, num(m.len, 0)),
      color: colOk(m.color) ? m.color : 'muted'
    }));
  return t;
}
