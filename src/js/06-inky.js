/*
 * 06-inky.js: Inky, the writing pet: drawing, talking, cheering, rewards and the room
 *
 * petSVG() draws Inky as inline SVG for any mood, rank and outfit. say(), toast() and cheer() let Inky talk (Settings
 * in the room decide how chatty). credit() is where every new word lands: it adds to today's count and Inky's total,
 * the running focus session and the to-do list, and triggers cheers, confetti and rank-ups.
 *
 * The second half is what Inky earns: colours, things to wear (PET_ITEMS, PET_ART), achievements (ACH, checked by
 * checkAch), and the room behind Inky (roomSVG), whose window follows the time of day.
 */
// Inky's arm shapes (SVG paths, left and right) for each mood.
const PET_ARMS = {
  sleepy: ['M34 108 q-10 8 -8 22', 'M126 108 q10 8 8 22'],
  happy: ['M34 106 q-14 2 -16 16', 'M126 106 q14 2 16 16'],
  hype: ['M34 102 q-18 -6 -18 -28', 'M126 106 q14 2 16 16'],
  party: ['M34 100 q-20 -8 -18 -32', 'M126 100 q20 -8 18 -32'],
  scared: ['M34 104 q-4 -16 12 -22', 'M126 104 q4 -16 -12 -22'],
  tense: ['M34 106 q10 12 26 10', 'M126 106 q-10 12 -26 10'],
  sad: ['M34 110 q-6 12 -2 26', 'M126 110 q6 12 2 26'],
  love: ['M34 106 q12 14 32 8', 'M126 106 q-12 14 -32 8'],
  angry: ['M34 104 q-16 4 -14 20', 'M126 104 q16 4 14 20'],
  curious: ['M34 108 q-10 8 -8 22', 'M126 106 q-2 10 -24 8'],
  glee: ['M34 102 q-18 -6 -18 -28', 'M126 102 q18 -6 18 -28'],
  laugh: ['M34 106 q8 16 28 14', 'M126 106 q-8 16 -28 14'],
  cozy: ['M34 108 q-10 8 -8 22', 'M126 108 q10 8 8 22']
};
// Words for each mood, used in the pet's description for screen readers.
const PET_FEEL = {
  sleepy: 'sleepy',
  party: 'ecstatic',
  hype: 'excited',
  happy: 'happy',
  scared: 'scared',
  tense: 'tense',
  sad: 'sad',
  love: 'smitten',
  angry: 'cross',
  curious: 'curious',
  glee: 'delighted',
  laugh: 'in fits of laughter',
  cozy: 'cosy'
};
// Things Inky holds or shows while reading over your shoulder (look.react): right hand, left hand, or floating.
const REACT_R = ['umbrella', 'popcorn', 'magnifier', 'wand'],
  REACT_L = ['tissue', 'cookie', 'letter', 'cake'];
// Things Inky can hold or show while reading (an umbrella, popcorn, a tissue…), as SVG.
const REACT_ART = {
  tissue:
    '<g class="pr"><path class="tis" d="M10 116 q6 -10 13 -4 q7 -7 13 2 l-3 18 h-20z"/><path class="tis2" d="M16 112 q4 -8 8 -2"/></g>',
  cookie:
    '<g class="pr"><circle class="ckie" cx="22" cy="122" r="11"/><circle class="ckc" cx="18" cy="118" r="2"/><circle class="ckc" cx="26" cy="121" r="2"/><circle class="ckc" cx="21" cy="127" r="2"/></g>',
  cake: '<g class="pr"><rect class="ckie" x="8" y="114" width="28" height="18" rx="3"/><rect class="icing" x="8" y="114" width="28" height="6" rx="3"/><path class="candle" d="M22 114 v-10"/><path class="flame" d="M22 103 q-3 -4 0 -8 q3 4 0 8z"/></g>',
  letter:
    '<g class="pr"><rect class="env" x="6" y="112" width="32" height="22" rx="2"/><path class="envf" d="M6 112 l16 12 l16 -12"/></g>',
  popcorn:
    '<g class="pr"><path class="pcb" d="M122 114 h30 l-4 30 h-22z"/><path class="pcs" d="M131 114 l2 30 M142 114 l-1 30"/><circle class="pck" cx="127" cy="112" r="5"/><circle class="pck" cx="136" cy="109" r="5.5"/><circle class="pck" cx="146" cy="112" r="5"/><circle class="pck" cx="141" cy="104" r="4"/></g>',
  magnifier: '<g class="pr"><path class="mgh" d="M140 71 L135 86"/><circle class="mgl" cx="148" cy="62" r="12"/></g>',
  wand: '<g class="pr"><path class="wnd" d="M142 82 L156 54"/><path class="wst" d="M156 39 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z"/></g>',
  umbrella:
    '<g class="pr" transform="rotate(-18 140 100)"><path class="umbs" d="M140 -4 V100 q0 8 -7 8"/><path class="umbc" d="M88 -4 Q140 -58 192 -4 Q179 -12 166 -4 Q153 -12 140 -4 Q127 -12 114 -4 Q101 -12 88 -4Z"/></g>',
  hearts:
    '<g class="hearts"><path class="hrt" d="M26 46 l-7 -7 a4 4 0 0 1 7 -4.5 a4 4 0 0 1 7 4.5z"/><path class="hrt" d="M138 34 l-9 -9 a5 5 0 0 1 9 -6 a5 5 0 0 1 9 6z"/></g>',
  sweat: '<path class="sweat" d="M128 58 q7 11 0 15 q-7 -4 0 -15z"/>',
  excl: '<text class="mark" x="14" y="48">!</text>',
  qmark: '<text class="mark" x="10" y="48">?</text>'
};
// Draws Inky as SVG: m is the mood (face and arms), stage the rank (which brings its own accessories), look the
// colour, what Inky wears and its form (look.form, or look.life.form; FORMS), from meta.pet unless given.
function petSVG(m, stage, look) {
  look = look || (S && S.meta && S.meta.pet) || {};
  const lf = look.life,
    fid = look.form || (lf && lf.form) || 'blotling',
    F = FORMS[fid] || FORMS.blotling,
    A = F.art || {};
  if (fid === 'egg') return eggSVG(look, lf);
  const wear = look.wear || {},
    slot = k => (wear[k] && wear[k] !== 'auto' ? wear[k] : F.st < 2 ? 'none' : 'auto');
  const rx = look.react || [],
    has = k => rx.includes(k),
    busyR = REACT_R.some(has),
    busyL = REACT_L.some(has);
  const arms = (PET_ARMS[m] || PET_ARMS.happy).slice();
  if (busyL) arms[0] = 'M34 108 q-8 4 -12 12';
  if (has('umbrella')) arms[1] = 'M126 104 q8 -2 14 -4';
  else if (has('popcorn')) arms[1] = 'M126 108 q10 4 8 14';
  else if (has('magnifier')) arms[1] = 'M126 104 q12 -6 12 -20';
  else if (has('wand')) arms[1] = 'M126 102 q14 -6 16 -22';
  const pomL =
    m === 'hype' || m === 'party'
      ? '<g class="pomg"><circle class="pom" cx="16" cy="' +
        (m === 'party' ? 66 : 70) +
        '" r="9"/><circle class="pom2" cx="12" cy="' +
        (m === 'party' ? 62 : 66) +
        '" r="4"/></g>'
      : '';
  const pomR =
    m === 'party'
      ? '<g class="pomg"><circle class="pom" cx="144" cy="66" r="9"/><circle class="pom2" cx="148" cy="62" r="4"/></g>'
      : '';
  const ck = c =>
    '<ellipse class="cheek' +
    (c || '') +
    '" cx="44" cy="103" rx="7" ry="4.5"/><ellipse class="cheek' +
    (c || '') +
    '" cx="116" cy="103" rx="7" ry="4.5"/>';
  const open = (ry, cy) =>
    '<g class="blink"><ellipse class="eye" cx="59" cy="' +
    (cy || 90) +
    '" rx="7" ry="' +
    ry +
    '"/><ellipse class="eye" cx="101" cy="' +
    (cy || 90) +
    '" rx="7" ry="' +
    ry +
    '"/><circle class="hl" cx="61.5" cy="' +
    ((cy || 90) - 3.5) +
    '" r="2.4"/><circle class="hl" cx="103.5" cy="' +
    ((cy || 90) - 3.5) +
    '" r="2.4"/></g>';
  let eyes,
    mouth,
    cheeks = ck(),
    zz = '',
    brow = '',
    extra = '';
  if (m === 'sleepy') {
    eyes = '<path class="pe" d="M50 90 q9 7 18 0 M92 90 q9 7 18 0"/>';
    mouth = '<path class="pe" d="M73 109 q7 3 14 0"/>';
    cheeks = '';
    zz = '<g class="zz"><text x="116" y="38">z</text><text x="130" y="22">z</text></g>';
  } else if (m === 'party' || m === 'glee') {
    eyes = '<path class="pe" d="M50 92 q9 -13 18 0 M92 92 q9 -13 18 0"/>';
    mouth =
      m === 'party'
        ? '<path class="pm" d="M65 102 q15 26 30 0 z"/><path class="tongue" d="M73 113 q7 8 14 0 q-7 -4 -14 0z"/>'
        : '<path class="pm" d="M66 102 q14 20 28 0 z"/>';
  } else if (m === 'scared' || m === 'tense') {
    const r = m === 'scared' ? 10.5 : 9,
      dx = m === 'tense' ? -3 : 0;
    eyes =
      '<g class="eyesw"><circle class="eyew" cx="59" cy="90" r="' +
      r +
      '"/><circle class="eyew" cx="101" cy="90" r="' +
      r +
      '"/><circle class="eye" cx="' +
      (59 + dx) +
      '" cy="91" r="4.2"/><circle class="eye" cx="' +
      (101 + dx) +
      '" cy="91" r="4.2"/></g>';
    brow =
      m === 'scared'
        ? '<path class="pe" d="M47 74 q10 -7 20 -3 M93 71 q10 -4 20 3"/>'
        : '<path class="pe" d="M48 75 l18 4 M112 75 l-18 4"/>';
    mouth =
      m === 'scared'
        ? '<path class="pe" d="M66 111 q4 -5 7 0 q4 5 7 0 q4 -5 7 0 q4 5 7 0"/>'
        : '<rect class="teeth" x="67" y="103" width="26" height="10" rx="3"/><path class="tline" d="M67 108 h26 M75.7 103 v10 M84.3 103 v10"/>';
    cheeks = '';
  } else if (m === 'sad') {
    eyes =
      '<g class="blink"><ellipse class="eye" cx="59" cy="92" rx="6.5" ry="6.5"/><ellipse class="eye" cx="101" cy="92" rx="6.5" ry="6.5"/><circle class="hl" cx="61" cy="89.5" r="2.2"/><circle class="hl" cx="103" cy="89.5" r="2.2"/></g>';
    brow = '<path class="pe" d="M48 80 L67 74 M112 80 L93 74"/>';
    mouth = '<path class="pe" d="M70 113 q10 -9 20 0"/>';
    extra = '<path class="tear" d="M53 100 q-5 9 0 12 q5 -3 0 -12z"/>';
    cheeks = '';
  } else if (m === 'love') {
    const h = x => '<path class="heye" d="M' + x + ' 98 l-8.5 -8.5 a4.8 4.8 0 0 1 8.5 -5.5 a4.8 4.8 0 0 1 8.5 5.5z"/>';
    eyes = h(59) + h(101);
    mouth = '<path class="pe" d="M70 105 q10 9 20 0"/>';
    cheeks = ck(' hot');
  } else if (m === 'angry') {
    eyes = open(6);
    brow = '<path class="pe" d="M47 76 L68 83 M113 76 L92 83"/>';
    mouth = '<path class="pe" d="M70 111 q10 -7 20 0"/>';
    cheeks = ck(' hot');
    extra =
      '<g class="steamp"><path d="M22 58 q-6 -8 0 -16 q6 -8 0 -16"/><path d="M138 58 q6 -8 0 -16 q-6 -8 0 -16"/></g>';
  } else if (m === 'curious') {
    eyes =
      '<g class="blink"><ellipse class="eye" cx="59" cy="91" rx="6" ry="6"/><ellipse class="eye" cx="101" cy="90" rx="7.5" ry="9"/><circle class="hl" cx="61" cy="88.5" r="2"/><circle class="hl" cx="103.5" cy="86.5" r="2.4"/></g>';
    brow = '<path class="pe" d="M49 81 h18 M92 74 q10 -9 20 -3"/>';
    mouth = '<ellipse class="pm" cx="82" cy="109" rx="4.5" ry="5"/>';
  } else if (m === 'laugh') {
    eyes = '<path class="pe" d="M50 85 l14 6 l-14 6 M110 85 l-14 6 l14 6"/>';
    mouth = '<path class="pm" d="M64 102 q16 28 32 0 z"/><path class="tongue" d="M73 114 q7 7 14 0 q-7 -4 -14 0z"/>';
    extra =
      '<path class="tear joy" d="M43 93 q-5 7 0 10 q5 -3 0 -10z"/><path class="tear joy" d="M117 93 q-5 7 0 10 q5 -3 0 -10z"/>';
  } else if (m === 'cozy') {
    eyes = '<path class="pe" d="M50 92 q9 -8 18 0 M92 92 q9 -8 18 0"/>';
    mouth = '<path class="pe" d="M71 105 q9 7 18 0"/>';
  } else {
    eyes = open(m === 'hype' ? 9 : 7.5);
    mouth = m === 'hype' ? '<path class="pm" d="M68 104 q12 18 24 0 z"/>' : '<path class="pe" d="M70 105 q10 9 20 0"/>';
  }
  const hd = slot('head'),
    fc = slot('face'),
    hn = slot('hand'),
    nk = slot('neck');
  const tuft =
    A.tuft && (hd === 'auto' ? stage < 3 : hd === 'none') ? '<path class="tuft" d="M80 26 C76 12 90 6 96 14"/>' : '';
  let glass = (fc === 'auto' ? stage >= 2 : fc === 'glasses')
    ? '<g class="glass"><circle cx="59" cy="90" r="13"/><circle cx="101" cy="90" r="13"/><path d="M72 90 h16"/></g>'
    : fc !== 'auto' && fc !== 'none' && PET_ART[fc]
      ? PET_ART[fc]
      : '';
  if (has('shades') && !glass) glass = PET_ART.shades;
  let hat = '';
  if (stage === 3)
    hat =
      '<path class="beret" d="M42 46 C40 12 120 12 118 46 C100 38 60 38 42 46 Z"/><circle class="beret" cx="80" cy="14" r="3.5"/>';
  if (stage >= 4) {
    let leaves = '';
    for (let i = 0; i <= 6; i++) {
      const t = i / 6,
        x = (1 - t) * (1 - t) * 46 + 2 * (1 - t) * t * 80 + t * t * 114,
        y = (1 - t) * (1 - t) * 46 + 2 * (1 - t) * t * 14 + t * t * 46;
      const dx = 2 * (1 - t) * (80 - 46) + 2 * t * (114 - 80),
        dy = 2 * (1 - t) * (14 - 46) + 2 * t * (46 - 14),
        ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      leaves +=
        '<ellipse cx="' +
        x.toFixed(1) +
        '" cy="' +
        (y - 4).toFixed(1) +
        '" rx="7" ry="3" transform="rotate(' +
        (ang - 30).toFixed(0) +
        ' ' +
        x.toFixed(1) +
        ' ' +
        (y - 4).toFixed(1) +
        ')"/>';
    }
    hat = '<g class="laurel"><path d="M46 46 Q80 14 114 46"/>' + leaves + '</g>';
  }
  if (hd !== 'auto') {
    const l = hat.indexOf('class="laurel"') >= 0 ? hat : '';
    hat =
      hd === 'laurel'
        ? l || hat
        : hd === 'beret'
          ? '<path class="beret" d="M42 46 C40 12 120 12 118 46 C100 38 60 38 42 46 Z"/><circle class="beret" cx="80" cy="14" r="3.5"/>'
          : PET_ART[hd] || '';
  }
  const quill = busyR
    ? ''
    : (hn === 'auto' ? stage >= 1 : hn === 'quill')
      ? '<path class="quill" d="M110 34 C120 14 140 8 154 12 C152 28 130 40 112 38 Z"/><path class="qstem" d="M110 36 L152 12"/>'
      : hn !== 'auto' && hn !== 'none' && PET_ART[hn]
        ? PET_ART[hn]
        : '';
  let neck = nk !== 'auto' && nk !== 'none' && PET_ART[nk] ? PET_ART[nk] : '';
  if (has('scarf') && !neck) neck = PET_ART.scarf;
  const props =
    rx
      .filter(k => k !== 'umbrella' && REACT_ART[k])
      .map(k => REACT_ART[k])
      .join('') + (has('umbrella') ? REACT_ART.umbrella : '');
  const sz = A.s || 1,
    dusty = lf && F.st > 0 && dayGap(lf.care, todayKey()) >= 7;
  return (
    '<svg class="petsvg' +
    (has('shiver') ? ' shiver' : '') +
    (A.dull ? ' dull' : '') +
    '"' +
    petStyle(look) +
    ' viewBox="0 0 160 160" role="img" aria-label="Your Inkling, ' +
    esc(aName(F.n)) +
    ', looks ' +
    (PET_FEEL[m] || 'happy') +
    '">' +
    '<ellipse class="shadow" cx="80" cy="150" rx="' +
    Math.round(40 * sz) +
    '" ry="6"/>' +
    (sz !== 1 ? '<g transform="translate(80 148) scale(' + sz + ') translate(-80 -148)">' : '<g>') +
    (A.back || '') +
    '<path class="arm" d="' +
    arms[0] +
    '"/><path class="arm" d="' +
    arms[1] +
    '"/>' +
    pomL +
    pomR +
    (A.feet === 0
      ? ''
      : '<ellipse class="pdeep" cx="62" cy="141" rx="13" ry="7"/><ellipse class="pdeep" cx="98" cy="141" rx="13" ry="7"/>') +
    '<path class="pbody" d="' +
    (A.body || BODY) +
    '"/>' +
    '<path class="shine" d="M50 58 q8 -14 24 -17"/>' +
    (A.top || '') +
    (A.front || '') +
    (dusty ? DUST_ART : '') +
    neck +
    tuft +
    cheeks +
    brow +
    eyes +
    glass +
    mouth +
    extra +
    hat +
    quill +
    zz +
    props +
    '</g></svg>'
  );
}
// Dust and a cobweb on an Inky left alone for a week or more.
const DUST_ART =
  '<g class="dust"><circle cx="58" cy="50" r="2"/><circle cx="96" cy="44" r="1.6"/><circle cx="112" cy="64" r="2.2"/><circle cx="46" cy="70" r="1.5"/><circle cx="104" cy="120" r="1.8"/><path class="web" d="M118 34 l16 -6 M118 34 l10 12 M118 34 l18 6 M124 31 q4 6 8 7 M122 40 q6 0 10 -4"/></g>';
// Inky's egg: spots, and cracks that spread as the first words come in (look.life.w of LIFE.hatch).
function eggSVG(look, lf) {
  const w = lf ? lf.w : 0,
    k = Math.min(3, Math.floor((w / LIFE.hatch) * 4)),
    cracks = [
      '',
      '<path class="crack" d="M70 70 l6 8 l-4 6"/>',
      '<path class="crack" d="M70 70 l6 8 l-4 6 l8 6 M98 92 l-6 6 l5 6"/>',
      '<path class="crack" d="M58 88 l8 -6 l6 8 l8 -8 l6 8 l8 -6 l6 8 l8 -6 M100 60 l-4 8"/>'
    ][k];
  return (
    '<svg class="petsvg egg' +
    (k >= 2 ? ' wobble' : '') +
    '"' +
    petStyle(look) +
    ' viewBox="0 0 160 160" role="img" aria-label="An ink egg' +
    (k ? ', starting to crack' : '') +
    '"><ellipse class="shadow" cx="80" cy="150" rx="24" ry="5"/><g transform="translate(80 148) scale(.72) translate(-80 -148)"><g class="eggg">' +
    '<path class="eggshell" d="M80 30 C108 30 126 76 126 104 C126 132 106 148 80 148 C54 148 34 132 34 104 C34 76 52 30 80 30 Z"/>' +
    '<ellipse class="eggspot" cx="66" cy="70" rx="9" ry="7"/><ellipse class="eggspot" cx="102" cy="104" rx="11" ry="8"/><ellipse class="eggspot" cx="62" cy="122" rx="7" ry="5"/>' +
    '<path class="shine" d="M52 84 q4 -20 18 -30"/>' +
    cracks +
    (k === 3
      ? '<g class="peeky"><circle class="eye" cx="72" cy="98" r="3.5"/><circle class="eye" cx="88" cy="98" r="3.5"/></g>'
      : '') +
    '</g></g></svg>'
  );
}
// What Inky says for each mood.
const LINES = {
  sleepy: [
    'Zzz… write a sentence and I will wake up.',
    'I am resting my ink. Say hello with a few words?',
    'Quiet page, quiet me. Type something!'
  ],
  happy: ['Nice pace. Keep going!', 'Words are piling up. I like it.', 'Every sentence counts. I am cheering.'],
  hype: ['Past halfway! Do not stop now!', 'Look at you go!', 'The quill is on fire!'],
  party: [
    'Goal smashed! Everything from here is a bonus.',
    "Today's pages are in the bag!",
    'I am so proud I could spill.'
  ],
  sad: ['I missed you. Write me a sentence?', 'It was quiet here without you.', 'A few words would cheer me right up.']
};
// Something Inky might say in this mood.
const line = m => pick(LINES[m]);
// Puts words in Inky's speech bubble.
function say(msg) {
  ui.say = msg;
  ui.sayAt = Date.now();
  ui.sayKind = '';
  const b = $('#bubble');
  if (b) b.textContent = msg;
}
// Makes Inky hop once.
function bump() {
  const w = $('#petBtn');
  if (!w) return;
  const card = w.closest('.pet-card');
  if (!card) return;
  card.classList.remove('hop');
  void card.offsetWidth;
  card.classList.add('hop');
  setTimeout(() => card.classList.remove('hop'), 700);
}
// A short message at the bottom of the screen, with Inky beside it unless o.plain. o.act adds one button: [label,
// fn].
function toast(msg, o) {
  const t = $('#toast'),
    withPet = !(o && o.plain);
  t.className = 'toast' + (withPet ? '' : ' plain');
  const act = o && o.act; // [label, fn]: a button, such as Undo
  t.innerHTML =
    (withPet ? '<span class="tpet m-' + curMood() + '">' + petSVG(curMood(), petStage()) + '</span>' : '') +
    '<span>' +
    esc(msg) +
    '</span>' +
    (act ? '<button class="btn sm t-act">' + esc(act[0]) + '</button>' : '');
  t.classList.toggle('has-act', !!act);
  const hide = () => {
    t.classList.remove('show');
    ui.tt2 = setTimeout(() => {
      t.hidden = true;
    }, 300);
  };
  if (act)
    t.querySelector('.t-act').onclick = () => {
      clearTimeout(ui.tt);
      hide();
      act[1]();
    };
  t.hidden = false;
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(ui.tt);
  clearTimeout(ui.tt2);
  ui.tt = setTimeout(hide, act ? 7000 : 4300);
}
// A burst of confetti (skipped when the computer asks for reduced motion, or when switched off in Settings).
function confetti() {
  if (RM) return;
  const fx = $('#fx'),
    cols = ['var(--accent)', 'var(--char)', 'var(--place)', 'var(--thing)', 'var(--pet)'];
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('i'),
      a = Math.random() * Math.PI * 2,
      r = 120 + Math.random() * 240;
    s.style.cssText =
      '--dx:' +
      (Math.cos(a) * r).toFixed(0) +
      'px;--dy:' +
      (Math.sin(a) * r - 90).toFixed(0) +
      'px;--rot:' +
      (Math.random() * 720 - 360).toFixed(0) +
      'deg;background:' +
      cols[i % 5] +
      ';left:50%;top:42%;animation-delay:' +
      (Math.random() * 0.15).toFixed(2) +
      's';
    fx.appendChild(s);
    setTimeout(() => s.remove(), 2000);
  }
}
// Inky celebrates: words in the bubble, and for big moments a toast and confetti, as the writer's settings allow.
function cheer(msg, big) {
  // Settings in Inky's room: chatty (default), quiet (only big moments pop up) or silent (speech bubble only)
  say(msg);
  bump();
  const talk = LOOK.petTalk || 'chatty';
  if (talk === 'chatty' || (talk === 'quiet' && big)) toast(msg);
  if (big && talk !== 'off' && LOOK.confetti !== false) confetti();
}
// Counts new writing: delta is the change in words. Only additions count, and a single jump of more than 600 words is
// treated as a paste, not writing. Adds to today, Inky's total and the focus session, ticks to-do items, and cheers
// at goals and new ranks.
function credit(delta) {
  if (delta <= 0 || delta > 600) return; // pasted blocks do not count as writing
  if (T.cur && T.running && T.phase === 'focus') {
    T.cur.words += delta;
    pmPaint();
  }
  const m = S.meta,
    k = todayKey(),
    g = Math.max(1, m.goal),
    before = m.days[k] || 0;
  m.days[k] = before + delta;
  const after = m.days[k];
  const keysAll = Object.keys(m.days);
  if (keysAll.length > 420) {
    keysAll
      .sort()
      .slice(0, keysAll.length - 400)
      .forEach(x => delete m.days[x]);
  }
  const sb = petStage();
  m.pet.total += delta;
  const now = stageOf(m.pet.total);
  if (now > (m.pet.rank || 0)) m.pet.rank = now;
  const sa = petStage();
  lifeFeed(delta);
  if (!m.mark || m.mark.d !== k) m.mark = { d: k, hit: {}, over: 0 };
  const hit = m.mark.hit,
    name = m.pet.name;
  let msg = null,
    big = false,
    top = null;
  [
    ['q25', 0.25],
    ['q50', 0.5],
    ['q75', 0.75],
    ['goal', 1]
  ].forEach(a => {
    if (after >= g * a[1] && !hit[a[0]]) {
      hit[a[0]] = 1;
      top = a[0];
    }
  });
  if (top) lifeJoy(top === 'goal' ? 50 : 10);
  if (sa > sb) {
    msg = name + ' grew into a ' + STAGES[sa].n + '! ' + fmt(m.pet.total) + ' words so far.';
    big = true;
  } else if (top === 'goal') {
    const s = streak();
    msg =
      pick(['Daily goal reached! ' + name + ' is going wild.', 'You did it: ' + fmt(g) + ' words today!']) +
      (s > 1 ? ' ' + s + '-day streak.' : '');
    big = true;
  } else if (top === 'q75')
    msg = pick(["Three quarters of today's goal. The finish line is in sight!", '75%! One more push.']);
  else if (top === 'q50') msg = pick(["Halfway to today's goal!", '50%! ' + name + ' is doing a little dance.']);
  else if (top === 'q25') msg = pick(["A quarter of today's goal. Keep it flowing!", '25%! The quill is warming up.']);
  else if (after >= g) {
    const over = Math.floor((after - g) / 250);
    if (over > m.mark.over) {
      m.mark.over = over;
      msg = pick(['Bonus words! ' + fmt(after - g) + ' past the goal.', name + ' cannot stop cheering.']);
    }
  } else if (!hit.start && after >= 20) {
    hit.start = 1;
    msg = pick(['First words of the day. ' + name + ' is awake!', 'The page is no longer blank. Nice start.']);
  }
  const hr = new Date().getHours(),
    fl = m.pet.flags;
  if (!msg && hr >= 4 && hr < 7 && !fl.early) {
    fl.early = 1;
    msg = pick(['Early bird! The page is fresh and so are you.', 'Writing before sunrise? I brought the lamp.']);
  } else if (!msg && (hr >= 23 || hr < 4) && !fl.night) {
    fl.night = 1;
    msg = pick([
      'Writing by moonlight. I will keep the lamp on.',
      'Night owl hours! The best ideas come out after dark.'
    ]);
  }
  if (msg) cheer(msg, big);
  if (after >= g) todoTick('goal');
  checkAch();
}

/* ---------- Inky: looks, things to earn, room ---------- */
// Everything here is personal (it lives in meta.pet, which follows the writer on shared projects).
const PET_COLORS = [
  ['teal', 'Teal', null],
  ['blue', 'Blue', ['#3E7BE0', '#2A5BB0', '#0B1E3D']],
  ['plum', 'Plum', ['#9A63D3', '#7140A6', '#1F0B33']],
  ['rose', 'Rose', ['#E0607E', '#B03C5A', '#3A0B18']],
  ['amber', 'Amber', ['#E2A23B', '#B47A1C', '#33210A']],
  ['moss', 'Moss', ['#6FA34A', '#4C7A2E', '#14250A']],
  ['slate', 'Slate', ['#7C8BA1', '#56657A', '#121A26']]
];
// Checks Inky's saved record: name, words, colour, what it wears, achievements, flags, its life and earlier Inkys.
function normPet(p) {
  p = p && typeof p === 'object' ? p : {};
  const wear = {};
  ['head', 'face', 'neck', 'hand'].forEach(k => {
    const v = String((p.wear || {})[k] || 'auto');
    wear[k] = /^[a-z]{2,12}$/.test(v) ? v : 'auto';
  });
  const got = {};
  Object.keys(p.got || {}).forEach(k => {
    if (/^[a-z0-9]{2,16}$/.test(k)) got[k] = +p.got[k] || Date.now();
  });
  return {
    name: String(p.name || 'Inky').slice(0, 40),
    total: Math.max(0, +p.total || 0),
    color: PET_COLORS.some(c => c[0] === p.color) ? p.color : 'teal',
    wear,
    got,
    flags: { early: !!(p.flags || {}).early, night: !!(p.flags || {}).night },
    tasks: Math.max(0, Math.round(+p.tasks || 0)),
    life: normLife(p.life),
    past: normPast(p.past),
    rank:
      p.rank != null
        ? Math.max(0, Math.min(4, Math.round(+p.rank || 0)))
        : [0, 1000, 10000, 30000, 60000].filter(x => (+p.total || 0) >= x).length - 1
  }; // older projects keep the rank they had
}
// The CSS variables that recolour Inky, as a style attribute.
const petStyle = look => {
  const c = PET_COLORS.find(x => x[0] === (look && look.color));
  return c && c[2] ? ' style="--pet:' + c[2][0] + ';--pet-deep:' + c[2][1] + ';--pet-ink:' + c[2][2] + '"' : '';
};
// Extra things to wear, drawn in the pet's 160x160 space.
const PET_ART = {
  nightcap:
    '<g class="it"><path class="c1" d="M42 46 C46 14 96 2 124 22 C134 30 140 46 142 60 L134 62 C128 48 118 40 106 38 C88 36 60 38 42 46Z"/><path class="c2" d="M40 48 C62 36 98 34 120 42 L118 50 C96 42 62 44 42 56Z"/><circle class="c3" cx="140" cy="64" r="7"/></g>',
  sunhat:
    '<g class="it"><ellipse class="c3" cx="80" cy="44" rx="60" ry="11"/><path class="c3" d="M50 44 C52 18 108 18 110 44Z"/><path class="c1" d="M51 38 C70 33 90 33 109 38 L110 44 C90 40 70 40 50 44Z"/></g>',
  crown:
    '<g class="it"><path class="gold" d="M50 44 L52 14 L66 30 L80 8 L94 30 L108 14 L110 44Z"/><circle class="c1" cx="80" cy="34" r="4"/><circle class="c2" cx="64" cy="38" r="3"/><circle class="c2" cx="96" cy="38" r="3"/></g>',
  partyhat:
    '<g class="it"><path class="c2" d="M64 38 L84 -6 L102 34Z"/><path class="c3" d="M72 20 L94 16 M68 30 L98 25" stroke-width="5" fill="none"/><circle class="gold" cx="84" cy="-6" r="6"/></g>',
  flower:
    '<g class="it"><circle class="c1" cx="108" cy="30" r="6"/><circle class="c1" cx="120" cy="34" r="6"/><circle class="c1" cx="118" cy="46" r="6"/><circle class="c1" cx="106" cy="44" r="6"/><circle class="c1" cx="100" cy="36" r="6"/><circle class="gold" cx="110" cy="38" r="5"/></g>',
  monocle:
    '<g class="it"><circle class="lens" cx="101" cy="90" r="14"/><path class="chain" d="M114 96 q8 18 -2 34"/></g>',
  shades:
    '<g class="it"><rect class="dark" x="44" y="80" width="30" height="18" rx="8"/><rect class="dark" x="86" y="80" width="30" height="18" rx="8"/><path class="chain" d="M74 86 h12"/></g>',
  scarf:
    '<g class="it"><path class="c1" d="M32 112 Q80 134 128 112 L128 124 Q80 146 32 124Z"/><path class="c1" d="M96 128 l4 26 l12 -3 l-4 -24Z"/><path class="c3" d="M44 118 l0 8 M58 123 l0 8 M72 126 l0 8 M88 126 l0 8 M104 123 l0 8 M118 118 l0 8" stroke-width="3"/></g>',
  bowtie:
    '<g class="it"><path class="c2" d="M80 122 L62 112 L62 134Z M80 122 L98 112 L98 134Z"/><circle class="c2" cx="80" cy="122" r="5"/></g>',
  medal:
    '<g class="it"><path class="c2" d="M66 106 L80 126 L94 106" fill="none" stroke-width="6"/><circle class="gold" cx="80" cy="132" r="9"/><path class="star" d="M80 126 l2 4 4 .5 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -.5Z"/></g>',
  clipboard:
    '<g class="it"><rect class="c3" x="126" y="92" width="24" height="32" rx="3"/><rect class="gold" x="132" y="88" width="12" height="7" rx="2"/><path class="chain" d="M131 104 h14 M131 111 h14 M131 118 h9"/></g>',
  mug: '<g class="it"><path class="steam" d="M134 98 q-4 -6 0 -12 M142 98 q-4 -6 0 -12"/><rect class="c3" x="128" y="102" width="20" height="22" rx="4"/><path class="c3" d="M148 108 q8 0 8 6 q0 6 -8 6" fill="none" stroke-width="4"/><rect class="c1" x="128" y="108" width="20" height="5"/></g>'
};
// Everything Inky can wear or put in the room: id → [slot, name].
const PET_ITEMS = {
  // id: [slot, name]
  quill: ['hand', 'Quill'],
  mug: ['hand', 'Mug of ink'],
  clipboard: ['hand', 'Clipboard'],
  glasses: ['face', 'Reading glasses'],
  monocle: ['face', 'Monocle'],
  shades: ['face', 'Sunglasses'],
  beret: ['head', 'Beret'],
  nightcap: ['head', 'Nightcap'],
  sunhat: ['head', 'Sun hat'],
  flower: ['head', 'Flower'],
  partyhat: ['head', 'Party hat'],
  crown: ['head', 'Crown'],
  laurel: ['head', 'Laurel wreath'],
  scarf: ['neck', 'Scarf'],
  bowtie: ['neck', 'Bow tie'],
  medal: ['neck', 'Medal'],
  lamp: ['room', 'Desk lamp'],
  rug: ['room', 'Rug'],
  armchair: ['room', 'Armchair'],
  mapframe: ['room', 'Map on the wall'],
  shelf: ['room', 'Bookshelf'],
  hourglass: ['room', 'Hourglass']
};
// The numbers achievements are measured by: words, streak, days written, scenes finished, pages, sessions and more.
function petStats() {
  const m = S.meta,
    d = m.days,
    g = Math.max(1, m.goal),
    ks = Object.keys(d).sort();
  let best = 0,
    run = 0,
    prev = 0;
  ks.forEach(k => {
    const t = new Date(k + 'T12:00').getTime();
    if (d[k] >= g) {
      run = prev && t - prev < 36 * 36e5 ? run + 1 : 1;
      prev = t;
      best = Math.max(best, run);
    } else {
      run = 0;
      prev = 0;
    }
  });
  return {
    total: m.pet.total,
    streak: streak(),
    best: Math.max(best, streak()),
    goalDays: ks.filter(k => d[k] >= g).length,
    bigDay: ks.reduce((a, k) => Math.max(a, d[k] || 0), 0),
    sprints: mySs().filter(x => x.done).length,
    pages: Object.keys(m.ents).length,
    polished: Object.values(m.scenes).filter(x => x.status !== 'draft').length,
    chDone: m.chapters.filter(
      c => c.scenes.length && c.scenes.every(id => m.scenes[id] && m.scenes[id].status === 'final')
    ).length,
    early: +m.pet.flags.early,
    night: +m.pet.flags.night,
    tasks: m.pet.tasks || 0,
    stage: petStage()
  };
}
// [id, name, how to earn it, reward, stat, target]
const ACH = [
  ['first', 'First words', 'Write 100 words.', 'mug', 'total', 100],
  ['inkling', 'Inkling', 'Become an Inkling (5% of your novel length goal).', 'quill', 'stage', 1],
  ['goal1', 'Goal getter', 'Reach your daily goal.', 'beret', 'goalDays', 1],
  ['streak3', 'Three in a row', 'Reach your goal 3 days running.', 'scarf', 'best', 3],
  ['rug', 'Settling in', 'Write 5,000 words.', 'rug', 'total', 5000],
  ['early', 'Early bird', 'Write before 7 in the morning.', 'sunhat', 'early', 1],
  ['night', 'Night owl', 'Write after 11 at night.', 'nightcap', 'night', 1],
  ['sprint1', 'First sprint', 'Finish a focus session.', 'lamp', 'sprints', 1],
  ['pages5', 'World builder', 'Make 5 story pages.', 'mapframe', 'pages', 5],
  ['streak7', 'A week of words', 'Reach your goal 7 days running.', 'flower', 'best', 7],
  ['scribe', 'Scribe', 'Become a Scribe (25% of your novel length goal).', 'glasses', 'stage', 2],
  ['party', 'Ten thousand', 'Write 10,000 words. Party!', 'partyhat', 'total', 10000],
  ['bigday', 'Marathon', 'Write 2,000 words in one day.', 'shades', 'bigDay', 2000],
  ['polish', 'Polisher', 'Mark 10 scenes Revised or Final.', 'monocle', 'polished', 10],
  ['chapter', 'Chapter done', 'Mark every scene in a chapter Final.', 'shelf', 'chDone', 1],
  ['sprint10', 'Ten sprints', 'Finish 10 focus sessions.', 'bowtie', 'sprints', 10],
  ['tasks25', 'List maker', 'Tick off 25 tasks on your to-do list.', 'clipboard', 'tasks', 25],
  ['goal10', 'Ten good days', 'Reach your daily goal on 10 days.', 'medal', 'goalDays', 10],
  ['sprint25', 'Time keeper', 'Finish 25 focus sessions.', 'hourglass', 'sprints', 25],
  ['chair', 'Comfy now', 'Write 25,000 words.', 'armchair', 'total', 25000],
  ['streak30', 'Month of ink', 'Reach your goal 30 days running.', 'crown', 'best', 30],
  ['laureate', 'Laureate', 'Reach your novel length goal.', 'laurel', 'stage', 4]
];
// Whether Inky has earned an item (items without an achievement are always available).
const owns = id => {
  const a = ACH.find(x => x[3] === id);
  return !a || !!S.meta.pet.got[a[0]];
};
// Marks newly earned achievements. quiet: at startup, catch up without a fanfare for each one.
function checkAch(quiet) {
  if (!S || !S.meta) return;
  const st = petStats(),
    got = S.meta.pet.got,
    fresh = [];
  ACH.forEach(a => {
    if (!got[a[0]] && st[a[4]] >= a[5]) {
      got[a[0]] = Date.now();
      fresh.push(a);
    }
  });
  if (!fresh.length) return;
  if (!quiet) lifeJoy(10 * fresh.length);
  dirty('meta');
  ui.newThings = 1;
  const d = $('#denBtn');
  if (d && !d.querySelector('.dot-new'))
    d.insertAdjacentHTML('beforeend', '<i class="dot-new" aria-label="new things"></i>');
  const nm = S.meta.pet.name;
  if (quiet) {
    const t0 = ui.sayAt;
    setTimeout(() => {
      if (ui.sayAt === t0)
        say(
          nm + ' found ' + fresh.length + ' new thing' + (fresh.length > 1 ? 's' : '') + ' in the room. Have a look!'
        );
    }, 1200);
    return;
  } // unless Inky has said something newer since
  const a = fresh[fresh.length - 1],
    it = PET_ITEMS[a[3]];
  cheer(
    a[1] +
      '! ' +
      nm +
      ' earned ' +
      (it[0] === 'room' ? 'a ' + it[1].toLowerCase() + ' for the room' : 'a ' + it[1].toLowerCase()) +
      '.' +
      (fresh.length > 1 ? ' And ' + (fresh.length - 1) + ' more.' : ''),
    true
  );
  const room = $('#petRoom');
  if (room) room.innerHTML = roomSVG();
  if (ui.view && ui.view.k === 'den') renderMain();
}
// A scene was marked Final: cheers, a to-do tick, and a note when a whole chapter is final.
function sceneFinal(id) {
  const m = S.meta,
    ch = m.chapters.find(c => c.scenes.includes(id)),
    sc = m.scenes[id];
  if (ch && ch.scenes.every(x => m.scenes[x].status === 'final'))
    cheer('“' + ch.title + '” is finished! Every scene is final.', true);
  else
    say(
      pick(['“' + sc.title + '” is final. Polished to a shine!', 'Another scene done. ' + m.pet.name + ' approves.'])
    );
  todoTick('fin', id);
  lifeJoy(15);
  checkAch();
}
// What Inky says when a project opens: a welcome back, the streak, or the deadline plan.
function greet() {
  // said once when a project opens
  const d = S.meta.days,
    ks = Object.keys(d)
      .filter(k => d[k] > 0)
      .sort(),
    last = ks[ks.length - 1],
    pg = planGreet();
  if (!last) {
    if (pg) say(pg);
    return;
  }
  const gap = Math.round((new Date(todayKey() + 'T12:00') - new Date(last + 'T12:00')) / 864e5);
  if (gap >= 3)
    say(
      pick([
        'Welcome back! It has been ' + gap + ' days. Shall we write a little?',
        'There you are! ' + gap + ' days away. I kept your pages warm.'
      ])
    );
  else if (gap === 1 && streak() > 0) say('Back for day ' + (streak() + 1) + '? Let us keep the streak going.');
  else if (pg) say(pg);
}
// The room behind the pet: a window that follows the time of day, a plant that grows with the streak, and what was earned.
// While Inky reads a scene, the window shows the story instead: its time of day, weather and setting, and the room
// takes on the scene's mood.
let WIN_ID = 0;
// The view through the room's window: sea, forest, city and so on, by day or night.
function winView(place, night) {
  const dk = (a, b) => (night ? b : a);
  if (place === 'sea')
    return (
      '<rect x="20" y="54" width="62" height="16" fill="' +
      dk('#3C82B5', '#1B3552') +
      '"/><path d="M20 58 q4 -3 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>' +
      '<path d="M44 54 h14 l-3 3 h-8z" fill="#5B4A3A"/><path d="M51 53 v-12 l7 10z" fill="#F4EFD8"/>'
    );
  if (place === 'forest') {
    let h = '';
    for (let i = 0; i < 7; i++) {
      const x = 16 + i * 10 + (i % 2) * 3,
        t = 14 + ((i * 7) % 10);
      h +=
        '<path d="M' +
        x +
        ' 70 l6 -' +
        t +
        ' l6 ' +
        t +
        'z" fill="' +
        dk(i % 2 ? '#2F6B45' : '#3D7F52', '#1E3A2A') +
        '"/>';
    }
    return h;
  }
  if (place === 'city') {
    let h = '';
    [
      [20, 40, 10],
      [29, 30, 9],
      [37, 46, 8],
      [44, 26, 10],
      [53, 38, 9],
      [61, 34, 11],
      [71, 44, 11]
    ].forEach(([x, t, w], i) => {
      h +=
        '<rect x="' +
        x +
        '" y="' +
        t +
        '" width="' +
        w +
        '" height="' +
        (70 - t) +
        '" fill="' +
        dk('#7C8AA0', '#2A2F45') +
        '"/>';
      for (let y = t + 4; y < 66; y += 6)
        for (let xx = x + 2; xx < x + w - 2; xx += 4)
          if ((xx + y + i) % 3)
            h += '<rect x="' + xx + '" y="' + y + '" width="2" height="2.4" fill="' + dk('#C9D6E3', '#FFD86B') + '"/>';
    });
    return h;
  }
  if (place === 'mountain')
    return (
      '<path d="M20 70 L34 42 L42 52 L56 30 L70 50 L76 44 L82 54 V70Z" fill="' +
      dk('#8492A6', '#3A4258') +
      '"/><path d="M52 37 L56 30 L60 37 L57.5 35 L55 38Z M32 46 L34 42 L36 46Z" fill="#fff"/>'
    );
  if (place === 'desert')
    return (
      '<path d="M20 60 Q34 52 48 60 T82 58 V70 H20Z" fill="' +
      dk('#E2B66B', '#8A6A3A') +
      '"/><path d="M20 66 Q40 58 60 66 T100 64 V70 H20Z" fill="' +
      dk('#C9954A', '#6E5230') +
      '"/><path d="M70 66 v-10 M70 61 h-3 v-3 M70 59 h3 v-4" stroke="#4C7A2E" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    );
  if (place === 'space')
    return '<circle cx="64" cy="44" r="7" fill="#C77DDB"/><ellipse cx="64" cy="44" rx="12" ry="3" fill="none" stroke="#F4EFD8" stroke-width="1.4"/><circle cx="34" cy="58" r="3" fill="#9AD7F5"/>';
  if (place === 'castle')
    return (
      '<path d="M30 70 V46 h4 v-4 h3 v4 h3 v-4 h3 v4 h4 V54 h12 V42 h4 v-4 h3 v4 h3 v-4 h3 v4 h4 V70Z" fill="' +
      dk('#9AA3B2', '#3A4258') +
      '"/><path d="M63 38 v-9 l7 2.5 -7 2.5" fill="#E0607E" stroke="' +
      dk('#5B4A3A', '#9AA3B2') +
      '" stroke-width=".8"/><rect x="47" y="60" width="6" height="10" rx="3" fill="#5B4A3A"/>'
    );
  if (place === 'cave')
    return '<path d="M20 18 H82 V70 H20Z M28 70 Q24 50 34 36 Q44 26 56 30 Q72 32 76 48 Q80 60 74 70Z" fill="#3B3430" fill-rule="evenodd"/>';
  return '';
}
// Rain, snow, fog or storm drawn over the window view.
function winWeather(w) {
  let h = '';
  if (w === 'rain' || w === 'storm') {
    h +=
      '<g class="cloud"><ellipse cx="34" cy="22" rx="16" ry="7"/><ellipse cx="56" cy="20" rx="18" ry="8"/><ellipse cx="76" cy="24" rx="12" ry="6"/></g>';
    if (w === 'storm') h += '<path class="bolt" d="M58 24 l-6 14 h6 l-5 13 l12 -17 h-6 l5 -10z"/>';
    let d = '';
    for (let k = 0; k < 8; k++)
      for (let i = 0; i < 13; i++) {
        const x = 20 + i * 7 - 3 * k + 12,
          y = -18 + k * 12;
        d += 'M' + x + ' ' + y + ' l-1.6 5 ';
      }
    h += '<g class="rain"><path d="' + d + '"/></g>';
  }
  if (w === 'snow')
    for (let s = 0; s < 2; s++) {
      let c = '';
      for (let k = 0; k < 6; k++)
        for (let i = 0; i < 6; i++) {
          const x = 22 + i * 11 + ((i * 5 + s * 7) % 6),
            y = -14 + k * 16 + ((i * 3 + s * 5) % 8);
          c += '<circle cx="' + x + '" cy="' + y + '" r="' + (s ? 1.1 : 1.6) + '"/>';
        }
      h += '<g class="snow' + (s ? ' s2' : '') + '">' + c + '</g>';
    }
  if (w === 'fog')
    h +=
      '<rect class="fogb" x="12" y="34" width="80" height="9" rx="4.5"/><rect class="fogb" x="8" y="50" width="84" height="12" rx="6"/>';
  if (w === 'wind')
    h +=
      '<path class="windl" d="M22 32 q14 -6 26 0 t22 -2"/><path class="windl" d="M28 48 q12 -5 24 0 t18 -1" style="animation-delay:.8s"/><ellipse cx="40" cy="40" rx="3" ry="1.6" fill="#6FA34A" class="windl" style="animation-delay:1.4s;stroke:none;fill:#6FA34A"/>';
  return h;
}
// The room behind Inky: the window (the real time of day, or the story's while Inky reads), a plant that grows with
// the streak, and earned things on the walls and floor.
function roomSVG() {
  const st = petStats(),
    hr = new Date().getHours(),
    rd = peekNow();
  const t = (rd && rd.time) || (hr < 6 || hr >= 20 ? 'night' : hr >= 17 ? 'dusk' : 'day'),
    night = t === 'night',
    dusk = t === 'dusk' || t === 'dawn';
  const wx = rd && rd.weather,
    place = rd && rd.place,
    cloudy = wx === 'rain' || wx === 'storm' || wx === 'fog' || wx === 'snow';
  let sky = night ? '#1F2B4D' : t === 'dawn' ? '#F7C9A8' : dusk ? '#F2B27A' : '#A8D8F5';
  if (wx === 'storm') sky = night ? '#1A2030' : '#4A5568';
  else if (wx === 'rain') sky = night ? '#26314A' : '#8EA0B5';
  else if (wx === 'snow') sky = night ? '#3A4660' : '#D5DEE8';
  else if (wx === 'fog') sky = '#C9CED4';
  if (place === 'space') sky = '#0B1026';
  else if (place === 'cave') sky = '#1A1614';
  const cid = 'winc' + ++WIN_ID;
  let h =
    '<svg viewBox="0 0 300 190" preserveAspectRatio="xMidYMax meet" class="roomsvg"' +
    (rd ? ' data-read="' + esc([t, wx || '', place || '', rd.mood || ''].join(' ')) + '"' : '') +
    '>' +
    '<rect class="floor" x="0" y="152" width="300" height="38"/>' +
    '<defs><clipPath id="' +
    cid +
    '"><rect x="20" y="18" width="62" height="52" rx="4"/></clipPath></defs>' +
    '<g class="win"><rect x="20" y="18" width="62" height="52" rx="4" fill="' +
    sky +
    '"/><g clip-path="url(#' +
    cid +
    ')">';
  if (place === 'space' || (night && !cloudy))
    h +=
      '<circle cx="34" cy="28" r="1.4" fill="#fff"/><circle cx="44" cy="50" r="1.2" fill="#fff"/><circle cx="72" cy="56" r="1.2" fill="#fff"/><circle cx="28" cy="46" r="1" fill="#fff"/><circle cx="54" cy="24" r="1" fill="#fff"/>';
  if (!cloudy && place !== 'space' && place !== 'cave')
    h += night
      ? '<circle cx="64" cy="32" r="7" fill="#F4EFD8"/>'
      : '<circle cx="' +
        (dusk ? 40 : 66) +
        '" cy="' +
        (dusk ? 58 : 32) +
        '" r="' +
        (wx === 'sun' ? 10 : 8) +
        '" fill="' +
        (dusk ? '#F06C3B' : '#FFD86B') +
        '"/>';
  h +=
    winView(place, night) + winWeather(wx) + '</g><path class="frame" d="M20 18h62v52h-62z M51 18v52 M20 44h62"/></g>';
  const gd = Math.min(12, st.goalDays);
  for (let i = 0; i < gd; i++)
    h +=
      '<path class="wstar" transform="translate(' +
      (102 + i * 12) +
      ' ' +
      (16 + (i % 2) * 6) +
      ') scale(.55)" d="M8 0 l2.4 5 5.6.8 -4 4 1 5.6 -5 -2.6 -5 2.6 1 -5.6 -4 -4 5.6 -.8Z"/>';
  if (owns('mapframe'))
    h +=
      '<g class="mapf"><rect x="214" y="22" width="64" height="44" rx="2"/><path d="M222 54 q10 -18 20 -6 t18 -14 t12 6" fill="none"/><circle cx="252" cy="40" r="2.5"/></g>';
  if (owns('shelf')) {
    h += '<g class="shelf"><rect x="10" y="98" width="78" height="5"/>';
    const n = Math.max(1, Math.min(9, st.chDone));
    for (let i = 0; i < n; i++)
      h +=
        '<rect class="book b' +
        (i % 4) +
        '" x="' +
        (13 + i * 8) +
        '" y="' +
        (74 + (i % 3) * 3) +
        '" width="7" height="' +
        (24 - (i % 3) * 3) +
        '" rx="1"/>';
    h += '</g>';
  }
  if (owns('hourglass'))
    h +=
      '<g class="hg" transform="translate(' +
      (owns('shelf') ? 74 : 16) +
      ' 80)"><path d="M0 0h12 M0 18h12 M2 0 q0 9 4 9 q-4 0 -4 9 M10 0 q0 9 -4 9 q4 0 4 9"/></g>';
  if (owns('rug')) h += '<ellipse class="rug" cx="150" cy="172" rx="92" ry="11"/>';
  if (owns('armchair'))
    h +=
      '<g class="chair"><rect x="14" y="128" width="58" height="34" rx="10"/><rect x="8" y="138" width="14" height="28" rx="6"/><rect x="64" y="138" width="14" height="28" rx="6"/><rect x="18" y="164" width="6" height="10"/><rect x="62" y="164" width="6" height="10"/></g>';
  if (owns('lamp'))
    h +=
      '<g class="lamp"><path class="shade" d="M226 98 l22 0 l8 20 l-38 0Z"/><path class="pole" d="M237 118 v52 M226 172 h22"/>' +
      (night || dusk ? '<path class="glow" d="M218 118 l38 0 l20 50 l-78 0Z"/>' : '') +
      '</g>';
  const s = st.streak,
    ph = s >= 7 ? 46 : s >= 3 ? 32 : s >= 1 ? 20 : 10;
  h +=
    '<g class="plant"><path class="stem" d="M276 158 v-' +
    ph +
    '"/>' +
    (s >= 1
      ? '<ellipse class="leaf" cx="' +
        270 +
        '" cy="' +
        (156 - ph * 0.5) +
        '" rx="7" ry="3.5" transform="rotate(-30 270 ' +
        (156 - ph * 0.5) +
        ')"/><ellipse class="leaf" cx="282" cy="' +
        (154 - ph * 0.7) +
        '" rx="7" ry="3.5" transform="rotate(30 282 ' +
        (154 - ph * 0.7) +
        ')"/>'
      : '') +
    (s >= 3
      ? '<ellipse class="leaf" cx="269" cy="' +
        (156 - ph * 0.9) +
        '" rx="8" ry="4" transform="rotate(-40 269 ' +
        (156 - ph * 0.9) +
        ')"/>'
      : '') +
    (s >= 7
      ? '<circle class="bloom" cx="276" cy="' +
        (158 - ph) +
        '" r="6"/><circle class="bloomc" cx="276" cy="' +
        (158 - ph) +
        '" r="2.5"/>'
      : '') +
    '<path class="pot" d="M264 156 h24 l-3 18 h-18Z"/></g>';
  if (rd && rd.mood) h += '<rect class="tint t-' + rd.mood + '" x="0" y="0" width="300" height="190"/>';
  if (wx === 'storm') h += '<rect class="flash" x="0" y="0" width="300" height="190"/>';
  return h + '</svg>';
}
