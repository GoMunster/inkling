/*
 * 07-inky-life.js: Inky's life, Tamagotchi style: hatching, growing up, evolving, running away
 *
 * Each book raises its own Inky (meta.pet.life). It starts as an egg that hatches after the first LIFE.hatch words,
 * then grows through baby, child, teen and adult as the writer comes back on writing days (LIFE.grow). Which form it
 * grows into depends on how well it was looked after in that stage: every day is scored on Ink (words against the
 * daily goal), Joy (goals, streaks, finished scenes and tasks, focus sessions) and Focus (minutes of actual
 * typing). The average gives the care grade (great, ok, poor) and the strongest of the three the style (EVOLVE).
 * A great-care adult that reaches the novel length goal becomes the legendary Muse.
 *
 * Neglect shows: Inky turns sad, then dusty, and after LIFE.away days with no writing it leaves a note and runs
 * away; a new egg takes its place. Inkys that ran away or were retired go to the Hall of Fame (meta.pet.past, and
 * across projects in localStorage inkling:hall); every form seen is in the collection (inkling:dex).
 */
// Hatching, growing and running away: words to hatch, writing days needed in each stage to grow into the next
// (baby, child, teen), days alone before Inky runs away, minutes of typing that fill Focus.
const LIFE = { hatch: 100, grow: [0, 2, 5, 10], away: 30, focus: 30 };
// Life stages, by form.st.
const LIFE_STAGES = ['Egg', 'Baby', 'Child', 'Teen', 'Adult', 'Legend'];
// The default body (the classic Inky drop).
const BODY = 'M80 24 C112 24 134 52 134 90 C134 124 112 142 80 142 C48 142 26 124 26 90 C26 52 48 24 80 24 Z';
// Every form Inky can take: name, life stage, how it comes about, a line about it, and its art: s = size, body =
// outline, back = drawn behind (wings, tails, rays), top = on the head (ears, horns), front = over the body (belly,
// beard), dull = faded colours, tuft = the little curl on top, feet = shows its feet.
const FORMS = {
  egg: { n: 'Ink egg', st: 0, how: 'Every new book starts with one.', d: 'Warm, and wobbling a little.' },
  drop: {
    n: 'Droplet',
    st: 1,
    how: 'Hatches from the egg.',
    d: 'A brand new drop of ink. Needs words, often.',
    art: {
      s: 0.7,
      body: 'M80 16 C92 40 134 62 134 98 C134 128 110 142 80 142 C50 142 26 128 26 98 C26 62 68 40 80 16 Z'
    }
  },
  blotling: {
    n: 'Blotling',
    st: 2,
    how: 'A Droplet that was well looked after.',
    d: 'Round, bouncy and curious about everything.',
    art: { s: 0.84, tuft: 1 }
  },
  smudge: {
    n: 'Smudge',
    st: 2,
    how: 'A Droplet left alone too often.',
    d: 'A bit smeared around the edges. Still hopeful.',
    art: {
      s: 0.84,
      tuft: 1,
      dull: 1,
      front:
        '<path class="fxd" d="M40 126 q-7 14 2 18 q7 -3 -2 -18z M120 124 q8 13 0 18 q-7 -4 0 -18z"/><ellipse class="fxd" cx="112" cy="70" rx="9" ry="5" transform="rotate(-25 112 70)"/>'
    }
  },
  scribble: {
    n: 'Scribble',
    st: 3,
    how: 'A child fed on lots of words.',
    d: 'All energy and spiky hair. Writes faster than it thinks.',
    art: { s: 0.92, top: '<path class="fxs" d="M54 34 l6 -18 l7 15 l6 -20 l7 18 l6 -17 l7 16 l6 -13"/>' }
  },
  penpal: {
    n: 'Penpal',
    st: 3,
    how: 'A child kept happy with goals, streaks and ticked-off tasks.',
    d: 'Friendly round ears. Loves a good routine.',
    art: {
      s: 0.92,
      back: '<circle class="fx1" cx="44" cy="44" r="15"/><circle class="fx1" cx="116" cy="44" r="15"/><circle class="fxp" cx="44" cy="44" r="7"/><circle class="fxp" cx="116" cy="44" r="7"/>'
    }
  },
  inkwell: {
    n: 'Inkwell',
    st: 3,
    how: 'A child given long, focused writing time.',
    d: 'Happiest sitting deep in its inkwell, thinking.',
    art: {
      s: 0.92,
      feet: 0,
      front:
        '<path class="jar" d="M30 110 h100 v28 q0 8 -8 8 h-84 q-8 0 -8 -8z"/><rect class="jarlip" x="25" y="103" width="110" height="10" rx="5"/><path class="jarhi" d="M40 118 v18"/>'
    }
  },
  splodge: {
    n: 'Splodge',
    st: 3,
    how: 'A child that went hungry for words.',
    d: 'Lumpy and a little grumpy. Could still turn out well.',
    art: {
      s: 0.92,
      dull: 1,
      body: 'M80 26 C100 20 114 34 122 44 C138 52 132 72 138 88 C144 108 128 120 122 132 C112 146 92 138 80 144 C66 140 48 146 38 132 C26 122 18 104 24 88 C20 70 30 54 42 44 C52 32 64 30 80 26 Z',
      front: '<path class="fxd" d="M48 138 q-4 10 2 12 q5 -2 -2 -12z"/>'
    }
  },
  wyrm: {
    n: 'Ink dragon',
    st: 4,
    how: 'A Scribble raised with great care.',
    d: 'Breathes sentences. Guards your word count.',
    art: {
      back: '<path class="fx1" d="M34 84 L0 46 L8 74 L-6 80 L10 92 L-2 100 L30 102 Z M126 84 L160 46 L152 74 L166 80 L150 92 L162 100 L130 102 Z"/><path class="fx2" d="M118 132 q32 8 36 -18" fill="none" stroke-width="7" stroke-linecap="round"/><path class="fx2" d="M150 112 l12 -10 l-2 16z"/>',
      top: '<path class="horn" d="M56 36 q-6 -18 -18 -26 q16 2 26 20z M104 36 q6 -18 18 -26 q-16 2 -26 20z"/>',
      front: '<ellipse class="belly" cx="80" cy="130" rx="26" ry="11"/>'
    }
  },
  comet: {
    n: 'Comet',
    st: 4,
    how: 'A Scribble with bursts of words between quiet spells.',
    d: 'Blazes across the page, then vanishes for a while.',
    art: {
      back: '<path class="flame" d="M34 66 Q-6 34 -22 52 Q2 66 28 88 Q-16 80 -26 100 Q6 104 30 112 Q-2 118 -8 134 Q20 128 40 124Z"/><path class="spark" d="M-10 30 l2 5 5 1 -5 2 -2 5 -2 -5 -5 -2 5 -1z M150 40 l1.5 4 4 1 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1z"/>'
    }
  },
  owl: {
    n: 'Book owl',
    st: 4,
    how: 'A Penpal raised with great care.',
    d: 'Wise, steady and never misses a writing day.',
    art: {
      top: '<path class="fx1" d="M46 42 L34 10 L64 32z M114 42 L126 10 L96 32z"/>',
      front: '<path class="fxl" d="M62 122 l6 5 6 -5 6 5 6 -5 6 5 6 -5 M68 132 l6 5 6 -5 6 5 6 -5"/>'
    }
  },
  sunny: {
    n: 'Sunny',
    st: 4,
    how: 'A Penpal looked after now and then.',
    d: 'Cheerful whatever the weather. Glows on goal days.',
    art: {
      back:
        '<g class="rays">' +
        [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
          .map(a => '<path transform="rotate(' + a + ' 80 84)" d="M74 18 L80 2 L86 18z"/>')
          .join('') +
        '</g>'
    }
  },
  sage: {
    n: 'Sage',
    st: 4,
    how: 'An Inkwell raised with great care.',
    d: 'Has thought about every sentence twice. Long white beard.',
    art: {
      front: '<path class="beard" d="M58 114 q22 12 44 0 q4 26 -22 42 q-26 -16 -22 -42z"/>',
      top: '<path class="fx2" d="M46 74 q10 -9 22 -4 M114 74 q-10 -9 -22 -4" fill="none" stroke-width="5" stroke-linecap="round"/>'
    }
  },
  inkcat: {
    n: 'Ink cat',
    st: 4,
    how: 'An Inkwell looked after now and then.',
    d: 'Naps on the manuscript. Writes when it feels like it.',
    art: {
      back: '<path class="fx2" d="M126 130 q34 -2 26 -34 q-3 -12 8 -16" fill="none" stroke-width="8" stroke-linecap="round"/>',
      top: '<path class="fx1" d="M36 56 L38 12 L72 32z M124 56 L122 12 L88 32z"/><path class="fxp" d="M44 46 L45 24 L62 36z M116 46 L115 24 L98 36z"/>',
      front: '<path class="whisk" d="M30 100 l-20 -4 M30 106 l-20 4 M130 100 l20 -4 M130 106 l20 4"/>'
    }
  },
  phoenix: {
    n: 'Phoenix',
    st: 4,
    how: 'A Splodge that was turned around with great care.',
    d: 'Rose from the ashes of an abandoned draft.',
    art: {
      back: '<path class="flame" d="M32 92 Q-4 70 -12 40 Q10 58 22 56 Q4 40 6 18 Q24 44 40 60Z M128 92 Q164 70 172 40 Q150 58 138 56 Q156 40 154 18 Q136 44 120 60Z"/>',
      top: '<path class="flame" d="M66 32 q-8 -22 6 -32 q0 14 8 18 q2 -16 14 -20 q-4 16 2 22 q6 -6 12 -6 q-6 8 -8 18z"/>'
    }
  },
  gremlin: {
    n: 'Gremlin',
    st: 4,
    how: 'A Splodge looked after now and then.',
    d: 'Hides your notes and eats commas. Means well.',
    art: {
      top: '<path class="fx1" d="M36 74 L-6 46 L30 96z M124 74 L166 46 L130 96z"/><path class="fx2" d="M58 32 l6 -14 6 11 6 -14 6 14 6 -11 6 14"/>'
    }
  },
  goo: {
    n: 'Goo',
    st: 4,
    how: 'A Splodge that was mostly left alone.',
    d: 'Has melted into a puddle of good intentions.',
    art: {
      dull: 1,
      feet: 0,
      body: 'M80 30 C108 30 126 56 126 88 C126 110 134 122 150 134 C156 144 130 148 80 148 C30 148 4 144 10 134 C26 122 34 110 34 88 C34 56 52 30 80 30 Z',
      front: '<path class="fxd" d="M36 40 q-3 10 2 12 q4 -3 -2 -12z"/>'
    }
  },
  puddle: {
    n: 'Puddle',
    st: 4,
    how: 'A teen that was left on its own.',
    d: 'Flat, sleepy and in need of a good chapter.',
    art: {
      dull: 1,
      feet: 0,
      body: 'M80 52 C118 52 144 76 146 104 C148 134 120 146 80 146 C40 146 12 134 14 104 C16 76 42 52 80 52 Z'
    }
  },
  muse: {
    n: 'Muse',
    st: 5,
    how: 'Reach your novel length goal with a great-care adult.',
    d: 'The legend. Every writer hopes to meet one.',
    art: {
      back: '<circle class="aura" cx="80" cy="86" r="74"/><path class="lwing" d="M34 90 Q-6 64 -10 26 Q18 50 40 62Z M126 90 Q166 64 170 26 Q142 50 120 62Z"/>',
      top: '<ellipse class="halo" cx="80" cy="12" rx="26" ry="6"/>',
      front:
        '<path class="spark" d="M22 30 l2 5 5 1 -5 2 -2 5 -2 -5 -5 -2 5 -1z M140 124 l2 5 5 1 -5 2 -2 5 -2 -5 -5 -2 5 -1z"/>'
    }
  }
};
// What a form grows into, by the care grade (great, ok, poor) and style (ink, joy, foc) of the stage just finished.
const EVOLVE = {
  drop: g => (g === 'poor' ? 'smudge' : 'blotling'),
  blotling: (g, s) => (g === 'poor' ? 'splodge' : { ink: 'scribble', joy: 'penpal', foc: 'inkwell' }[s]),
  smudge: (g, s) => (g === 'great' ? { ink: 'scribble', joy: 'penpal', foc: 'inkwell' }[s] : 'splodge'),
  scribble: g => ({ great: 'wyrm', ok: 'comet', poor: 'puddle' })[g],
  penpal: g => ({ great: 'owl', ok: 'sunny', poor: 'puddle' })[g],
  inkwell: g => ({ great: 'sage', ok: 'inkcat', poor: 'puddle' })[g],
  splodge: g => ({ great: 'phoenix', ok: 'gremlin', poor: 'goo' })[g]
};
// How the care grades read.
const CARE_WORD = { great: 'Very well looked after', ok: 'Doing fine', poor: 'A bit neglected' };
// The day key n days after day key k.
const dayAdd = (k, n) => {
  const d = new Date(k + 'T12:00');
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
// Whole days from day key a to day key b.
const dayGap = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
// An empty score sheet: days counted and the sums of each kind of care.
const careSum = () => ({ n: 0, ink: 0, joy: 0, foc: 0 });
// A new egg.
function lifeNew(gen) {
  const k = todayKey();
  return {
    form: 'egg',
    gen: gen || 1,
    born: Date.now(),
    since: k,
    last: k,
    care: k,
    w: 0,
    days: 0,
    day: { d: k, w: 0, m: 0, j: 0 },
    acc: careSum(),
    tot: careSum(),
    meter: { ink: 30, joy: 30, foc: 30 },
    hist: [['egg', Date.now()]]
  };
}
// Checks a saved life record (null when there is none yet, so lifeOpen can work one out from the writing history).
function normLife(l) {
  if (!l || typeof l !== 'object' || !FORMS[l.form]) return null;
  const k = todayKey(),
    key = v => (/^\d{4}-\d\d-\d\d$/.test(v) ? v : k),
    num = v => Math.max(0, +v || 0),
    sum = s => ({ n: num((s || {}).n), ink: num((s || {}).ink), joy: num((s || {}).joy), foc: num((s || {}).foc) }),
    pct = v => Math.max(0, Math.min(100, +v || 0)),
    dy = l.day || {},
    mt = l.meter || {};
  return {
    form: l.form,
    gen: Math.max(1, Math.round(+l.gen || 1)),
    born: +l.born || Date.now(),
    since: key(l.since),
    last: key(l.last),
    care: key(l.care),
    w: num(l.w),
    days: num(l.days),
    day: { d: key(dy.d), w: num(dy.w), m: num(dy.m), j: num(dy.j) },
    acc: sum(l.acc),
    tot: sum(l.tot),
    meter: { ink: pct(mt.ink), joy: pct(mt.joy), foc: pct(mt.foc) },
    hist: (Array.isArray(l.hist) ? l.hist : [])
      .filter(h => Array.isArray(h) && FORMS[h[0]])
      .slice(-20)
      .map(h => [h[0], +h[1] || 0])
  };
}
// Checks the list of this book's earlier Inkys (ran away or retired).
function normPast(a) {
  return (Array.isArray(a) ? a : [])
    .filter(x => x && FORMS[x.f])
    .slice(-40)
    .map(x => ({
      n: String(x.n || 'Inky').slice(0, 40),
      f: x.f,
      c: String(x.c || 'teal').slice(0, 12),
      gen: Math.max(1, Math.round(+x.gen || 1)),
      born: +x.born || 0,
      end: +x.end || 0,
      how: x.how === 'left' ? 'left' : 'retired',
      age: Math.max(0, Math.round(+x.age || 0)),
      words: Math.max(0, Math.round(+x.words || 0)),
      book: String(x.book || '').slice(0, 120)
    }));
}
// This book's Inky's life (made on first use).
const life = () => S.meta.pet.life || (S.meta.pet.life = lifeNew());
// Days since Inky was last looked after (words written or a few minutes of typing).
const lifeAway = l => dayGap((l || life()).care, todayKey());
// The care grade for a score sheet: the average day's care across Ink, Joy and Focus.
function careGrade(s) {
  if (!s.n) return 'ok';
  const q = (s.ink + s.joy + s.foc) / (3 * s.n);
  return q >= 0.55 ? 'great' : q >= 0.25 ? 'ok' : 'poor';
}
// Which kind of care was strongest: words (ink), happiness (joy) or focused time (foc).
function careStyle(s) {
  return s.joy > s.ink && s.joy >= s.foc ? 'joy' : s.foc > s.ink && s.foc > s.joy ? 'foc' : 'ink';
}
// Brings today's record up to date: scores each finished day, lets the meters run down, and grows Inky when a
// stage is done, up to the day before until (default today). quiet: no cheers (working out an Inky from history).
// Returns the forms grown into.
function lifeRoll(quiet, until) {
  const l = life(),
    k = until || todayKey(),
    grown = [];
  let guard = 0;
  while (l.day.d < k && guard++ < 2000) {
    const d = l.day,
      g = Math.max(1, S.meta.goal),
      prev = S.meta.days[dayAdd(d.d, -1)] || 0;
    if (d.w >= g && prev >= g) d.j += 20; // a streak day
    const sc = { ink: Math.min(1, d.w / g), joy: Math.min(1, d.j / 100), foc: Math.min(1, d.m / LIFE.focus) };
    if (l.form !== 'egg') {
      ['ink', 'joy', 'foc'].forEach(x => {
        l.acc[x] += sc[x];
        l.tot[x] += sc[x];
      });
      l.acc.n++;
      l.tot.n++;
    }
    if (d.w > 0 || d.m >= 5) l.days++;
    l.meter.ink = Math.round(l.meter.ink * 0.45);
    l.meter.joy = Math.round(l.meter.joy * 0.6);
    l.meter.foc = Math.round(l.meter.foc * 0.45);
    const f = lifeGrow(l, d.d);
    if (f) grown.push(f);
    l.day = { d: dayAdd(d.d, 1), w: 0, m: 0, j: 0 };
  }
  l.last = l.day.d;
  if (grown.length && !quiet) {
    const f = FORMS[grown[grown.length - 1]];
    setTimeout(() => cheer(S.meta.pet.name + ' grew into ' + aName(f.n) + '! ' + f.d, true), 900);
  }
  return grown;
}
// "a Comet", "an Ink cat".
const aName = n => (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n;
// Grows Inky into its next form when it has had enough writing days in this stage. Returns the new form or null.
function lifeGrow(l, day) {
  const f = FORMS[l.form],
    need = LIFE.grow[f.st];
  if (!need || f.st >= 4) return null;
  const done = Object.keys(S.meta.days).filter(x => x >= l.since && x <= day && S.meta.days[x] > 0).length;
  if (done < need) return null;
  const nx = EVOLVE[l.form] && EVOLVE[l.form](careGrade(l.acc), careStyle(l.acc));
  return nx ? lifeBecome(l, nx, dayAdd(day, 1)) : null;
}
// Turns Inky into another form and remembers it in the collection.
function lifeBecome(l, f, since) {
  l.form = f;
  l.since = since || todayKey();
  l.acc = careSum();
  l.hist.push([f, Date.now()]);
  if (l.hist.length > 20) l.hist.shift();
  dexAdd(f);
  dirty('meta');
  return f;
}
// New words for Inky: feeds the Ink meter, counts the day as cared for, and hatches the egg.
function lifeFeed(delta) {
  const l = life();
  if (l.day.d !== todayKey()) lifeRoll();
  l.day.w += delta;
  l.w += delta;
  l.care = todayKey();
  l.meter.ink = Math.min(100, l.meter.ink + (100 * delta) / Math.max(1, S.meta.goal));
  if (l.form === 'egg' && l.w >= LIFE.hatch) {
    lifeBecome(l, 'drop');
    paintPet(true);
    lifePaint();
    // after any achievement cheered for the same words, so the news is not covered straight away
    setTimeout(
      () => cheer('The egg hatched! Meet ' + S.meta.pet.name + ', a tiny Droplet. Keep writing to help it grow.', true),
      1600
    );
  }
  if (FORMS[l.form].st === 4 && petStage() >= 4 && careGrade(l.tot) === 'great') {
    lifeBecome(l, 'muse');
    cheer(
      S.meta.pet.name + ' became a Muse, the legendary form! Novel length goal reached, and with great care.',
      true
    );
    paintPet(true);
  }
}
// Something that made Inky happy (goals, finished scenes, tasks, sessions): fills the Joy meter.
function lifeJoy(pts) {
  if (!S || !S.meta || !S.meta.pet) return;
  const l = life();
  if (l.day.d !== todayKey()) lifeRoll();
  l.day.j += pts;
  l.meter.joy = Math.min(100, l.meter.joy + pts);
  dirty('meta');
}
// Typing time: the gap since the last keystroke counts towards Focus when it is under a minute.
function lifeActive() {
  const now = Date.now(),
    gap = now - (ui.lfKey || 0);
  ui.lfKey = now;
  if (gap > 60000) return;
  const l = life();
  if (l.day.d !== todayKey()) lifeRoll();
  const mins = gap / 60000;
  l.day.m += mins;
  l.meter.foc = Math.min(100, l.meter.foc + (mins * 100) / LIFE.focus);
  if (l.day.m >= 5) l.care = todayKey();
}
// Works out an Inky for a project written before Inky had a life: replays the writing history day by day.
function lifeFromHistory() {
  const d = S.meta.days,
    ks = Object.keys(d)
      .filter(k => d[k] > 0)
      .sort(),
    k = todayKey();
  const l = (S.meta.pet.life = lifeNew());
  if (!ks.length) return l;
  const mins = {};
  Object.values(S.ss || {}).forEach(x => {
    const dk = keyOf(new Date(x.start || 0));
    mins[dk] = (mins[dk] || 0) + (+x.mins || 0);
  });
  l.born = new Date(ks[0] + 'T09:00').getTime();
  l.hist = [['egg', l.born]];
  l.since = l.day.d = ks[0];
  for (let day = ks[0], i = 0; day < k && i < 2000; day = dayAdd(day, 1), i++) {
    const w = d[day] || 0,
      g = Math.max(1, S.meta.goal);
    l.day = { d: day, w, m: Math.max(mins[day] || 0, w / 25), j: w >= g ? 60 : Math.floor((w / g) * 4) * 10 };
    l.w += w;
    if (l.form === 'egg' && l.w >= LIFE.hatch) {
      lifeBecome(l, 'drop', day);
      l.hist[l.hist.length - 1][1] = new Date(day + 'T12:00').getTime();
    }
    if (w > 0) l.care = day;
    lifeRoll(true, dayAdd(day, 1));
    const h = l.hist[l.hist.length - 1];
    if (h[0] !== 'egg' && h[0] !== 'drop' && h[1] > Date.now() - 5000) h[1] = new Date(day + 'T12:00').getTime();
  }
  l.day = { d: k, w: d[k] || 0, m: 0, j: 0 };
  l.w += d[k] || 0;
  if (l.form === 'egg' && l.w >= LIFE.hatch) lifeBecome(l, 'drop');
  l.care = k; // an old project gets a fresh start, never an Inky that ran away the moment it was opened
  l.meter = { ink: 50, joy: 50, foc: 50 };
  return l;
}
// When a project opens: works out Inky's life if it has none, catches up on the days away, and either shows the
// note left by an Inky that ran away or says what changed overnight.
function lifeOpen() {
  if (!S || !S.meta || !S.meta.pet) return;
  const p = S.meta.pet;
  if (!p.life) {
    lifeFromHistory();
    dirty('meta');
  }
  const l = life();
  dexAdd(l.form);
  const away = lifeAway(l);
  if (l.form !== 'egg' && away >= LIFE.away) {
    lifeRunAway(away);
    return;
  }
  const grown = lifeRoll(true);
  if (grown.length) {
    const f = FORMS[grown[grown.length - 1]];
    say('While you were away, ' + p.name + ' grew into ' + aName(f.n) + '! ' + f.d);
  } else if (away >= 21)
    say(p.name + ' had packed a little bag. ' + away + ' days is a long time! Write a few words and it will stay.');
  else if (away >= 7) say(p.name + ' is dusty from waiting ' + away + ' days. A few words would cheer it up.');
  else if (away >= 3)
    say(p.name + ' missed you. ' + away + ' days without words is a long time for ' + aName(FORMS[l.form].n) + '.');
  paintPet(true);
  lifePaint();
}
// The day check every few seconds: a new day scores yesterday and may grow Inky.
function lifeTick() {
  if (!S || !S.meta || !S.meta.pet || !S.meta.pet.life) return;
  if (life().day.d !== todayKey()) {
    lifeRoll();
    dirty('meta');
    paintPet(true);
    lifePaint();
  }
}
// Inky leaves after too long alone: a note, a place in the Hall of Fame, and a new egg.
function lifeRunAway(days) {
  const p = S.meta.pet,
    l = life(),
    f = FORMS[l.form];
  hallAdd('left');
  p.life = lifeNew(l.gen + 1);
  dexAdd('egg');
  dirty('meta');
  paintPet(true);
  lifePaint();
  ask(
    p.name + ' left a note',
    '<span class="life-note"><span class="ln-pet">' +
      petSVG('sad', petStage(), Object.assign({}, p, { life: Object.assign({}, l) })) +
      '</span><span class="ln-txt">“Dear writer, I waited ' +
      days +
      ' days. ' +
      esc(aName(f.n).replace(/^a/, 'A')) +
      ' needs words to live on, so I have gone to look for a book that is being written. I hope yours gets finished. Love, ' +
      esc(p.name) +
      '”</span></span><span class="fine ln-fine">' +
      esc(p.name) +
      ' is in the Hall of Fame in the room. Someone left a new egg on your desk. It hatches after ' +
      LIFE.hatch +
      ' words.</span>',
    [['ok', 'Look after the new egg', 'pri']]
  );
}
// Retires Inky to the Hall of Fame (the book is done) and starts a new egg.
async function lifeRetire() {
  const p = S.meta.pet,
    l = life();
  const ok = await ask(
    'Retire ' + p.name + '?',
    esc(p.name) +
      ' the ' +
      esc(FORMS[l.form].n) +
      ' goes to the Hall of Fame, and a new egg starts for your next draft. Your achievements and wardrobe stay.',
    [
      ['no', 'Not yet'],
      ['yes', 'Retire with honours', 'pri']
    ]
  );
  if (ok !== 'yes') return;
  hallAdd('retired');
  p.life = lifeNew(l.gen + 1);
  dirty('meta');
  confetti();
  paintPet(true);
  lifePaint();
  renderMain();
  say('A new egg! It hatches after ' + LIFE.hatch + ' words.');
}
// Puts this Inky in the Hall of Fame: this book's list and the list across books on this device.
function hallAdd(how) {
  const p = S.meta.pet,
    l = life(),
    e = {
      n: p.name,
      f: l.form,
      c: p.color,
      gen: l.gen,
      born: l.born,
      end: Date.now(),
      how,
      age: dayGap(keyOf(new Date(l.born)), todayKey()),
      words: Math.round(l.w),
      book: S.meta.title
    };
  p.past = normPast((p.past || []).concat([e]));
  const h = hallAll();
  h.push(e);
  try {
    localStorage.setItem('inkling:hall', JSON.stringify(normPast(h.slice(-40))));
  } catch (x) {}
}
// Every Inky in the Hall of Fame: this device's list across books, plus this book's (without doubles).
function hallAll() {
  let h = [];
  try {
    h = normPast(JSON.parse(localStorage.getItem('inkling:hall') || '[]'));
  } catch (x) {}
  const seen = new Set(h.map(x => x.born + '|' + x.end));
  (S.meta.pet.past || []).forEach(x => {
    if (!seen.has(x.born + '|' + x.end)) h.push(x);
  });
  return h.sort((a, b) => b.end - a.end);
}
// Forms seen on this device ({form: first seen}), plus this book's.
function dexAll() {
  let d = {};
  try {
    d = JSON.parse(localStorage.getItem('inkling:dex') || '{}') || {};
  } catch (x) {}
  const p = S.meta.pet;
  ((p.life && p.life.hist) || []).forEach(h => {
    if (!d[h[0]]) d[h[0]] = h[1] || 1;
  });
  (p.past || []).forEach(x => {
    if (!d[x.f]) d[x.f] = x.end || 1;
  });
  return d;
}
// Adds a form to the collection.
function dexAdd(f) {
  try {
    const d = dexAll();
    if (!d[f]) {
      d[f] = Date.now();
      localStorage.setItem('inkling:dex', JSON.stringify(d));
    }
  } catch (x) {}
}
// The Ink, Joy and Focus meters, as small bars.
function lifeMetersHtml(l) {
  return (
    '<div class="lf-meters">' +
    [
      ['ink', 'Ink', 'Words written against your daily goal'],
      ['joy', 'Joy', 'Goals, streaks, finished scenes, ticked tasks and focus sessions'],
      ['foc', 'Focus', 'Minutes spent actually typing']
    ]
      .map(
        ([k, n, t]) =>
          '<span class="lf-m" title="' +
          esc(t) +
          '"><small>' +
          n +
          '</small><span class="bar"><i class="lf-' +
          k +
          '" style="width:' +
          Math.round(l.meter[k]) +
          '%"></i></span></span>'
      )
      .join('') +
    '</div>'
  );
}
// What happens next in Inky's life, in a sentence.
function lifeNext(l) {
  const f = FORMS[l.form],
    nm = S.meta.pet.name;
  if (f.st === 0) return Math.max(0, Math.ceil(LIFE.hatch - l.w)) + ' words until the egg hatches.';
  if (f.st >= 5) return nm + ' is a legend. When the book is done, retire it with honours in the room.';
  if (f.st === 4)
    return careGrade(l.tot) === 'great' && petStage() < 4
      ? 'Fully grown. Reach your novel length goal with care like this and something special happens.'
      : 'Fully grown. When the book is done, you can retire ' + nm + ' in the room.';
  const need = LIFE.grow[f.st],
    done = Object.keys(S.meta.days).filter(x => x >= l.since && S.meta.days[x] > 0).length,
    left = Math.max(1, need - done);
  return (
    'Grows up after ' +
    left +
    ' more writing day' +
    (left === 1 ? '' : 's') +
    '. ' +
    (l.acc.n ? CARE_WORD[careGrade(l.acc)] + ' so far.' : '')
  );
}
// Updates the life line in the Inkling panel: form, age, meters, what comes next.
function lifePaint() {
  const box = $('#lifeBox');
  if (!box || !S.meta.pet.life) return;
  const l = life(),
    f = FORMS[l.form],
    away = lifeAway(l);
  const html =
    '<div class="lf-head"><b>' +
    esc(f.n) +
    '</b><small>' +
    LIFE_STAGES[f.st] +
    (l.gen > 1 ? ' · generation ' + l.gen : '') +
    '</small></div>' +
    lifeMetersHtml(l) +
    '<small class="lf-next">' +
    (away >= 7 && f.st > 0
      ? esc(S.meta.pet.name) + ' has been alone for ' + away + ' days. After ' + LIFE.away + ' it will run away.'
      : esc(lifeNext(l))) +
    '</small>';
  if (box.innerHTML !== html) box.innerHTML = html;
}
// A small picture of Inky in some form, for the collection and the Hall of Fame.
const formPic = (f, color) => petSVG('happy', 0, { color, wear: {}, form: f });
// Inky's life in the room: the form now, its path so far, the collection of forms, and the Hall of Fame.
function lifeDenHtml() {
  const p = S.meta.pet,
    l = life(),
    f = FORMS[l.form],
    dex = dexAll(),
    hall = hallAll(),
    ids = Object.keys(FORMS);
  return (
    '<section class="pf life-sec"><h2>Life</h2>' +
    '<div class="lf-now"><div><b>' +
    esc(p.name) +
    ' the ' +
    esc(f.n) +
    '</b><span class="stage-tag">' +
    LIFE_STAGES[f.st] +
    '</span><p>' +
    esc(f.d) +
    '</p>' +
    lifeMetersHtml(l) +
    '<p class="fine">' +
    esc(lifeNext(l)) +
    '</p></div>' +
    '<div class="lf-path" aria-label="How ' +
    esc(p.name) +
    ' grew">' +
    l.hist
      .map(
        h =>
          '<span class="lf-step" title="' +
          esc(FORMS[h[0]].n + (h[1] ? ', ' + new Date(h[1]).toLocaleDateString() : '')) +
          '">' +
          formPic(h[0], p.color) +
          '<small>' +
          esc(FORMS[h[0]].n) +
          '</small></span>'
      )
      .join('<i class="lf-arr">→</i>') +
    '</div></div>' +
    '<p class="fine">Every book raises its own ' +
    esc(p.name) +
    '. The egg hatches after ' +
    LIFE.hatch +
    ' words, then ' +
    esc(p.name) +
    ' grows up on writing days: a child after ' +
    LIFE.grow[1] +
    ', a teen after ' +
    LIFE.grow[2] +
    ' more, an adult after ' +
    LIFE.grow[3] +
    ' more. What it grows into depends on its care in each stage: <b>Ink</b> (words against your daily goal), <b>Joy</b> (goals, streaks, finished scenes, ticked tasks, focus sessions) and <b>Focus</b> (minutes spent typing). Days away count too. After ' +
    LIFE.away +
    ' days with no writing, ' +
    esc(p.name) +
    ' runs away and a new egg appears.</p>' +
    (f.st >= 4
      ? '<p><button class="btn" id="lifeRetire">' +
        ico('spark', 14) +
        '<span>Retire ' +
        esc(p.name) +
        ' to the Hall of Fame</span></button></p>'
      : '') +
    '</section>' +
    '<section class="pf"><h2>Forms</h2><p class="fine">' +
    ids.filter(x => dex[x]).length +
    ' of ' +
    ids.length +
    ' found. Each book can grow a different one.</p><div class="lf-dex">' +
    ids
      .map(id => {
        const got = !!dex[id],
          F = FORMS[id];
        return (
          '<div class="lf-card' +
          (got ? '' : ' unknown') +
          '" title="' +
          esc(got ? F.d : 'Not found yet') +
          '">' +
          formPic(id, p.color) +
          '<b>' +
          esc(got ? F.n : '???') +
          '</b><small>' +
          LIFE_STAGES[F.st] +
          '</small><small>' +
          esc(F.how) +
          '</small></div>'
        );
      })
      .join('') +
    '</div></section>' +
    '<section class="pf"><h2>Hall of Fame</h2>' +
    (hall.length
      ? '<div class="lf-hall">' +
        hall
          .map(
            x =>
              '<div class="lf-card">' +
              formPic(x.f, x.c) +
              '<b>' +
              esc(x.n) +
              ' the ' +
              esc(FORMS[x.f].n) +
              '</b><small>' +
              (x.how === 'left' ? 'Ran away' : 'Retired') +
              ' ' +
              esc(new Date(x.end).toLocaleDateString()) +
              '</small><small>' +
              (x.book ? esc(x.book) + ' · ' : '') +
              fmt(x.words) +
              ' words · ' +
              x.age +
              ' days</small></div>'
          )
          .join('') +
        '</div>'
      : '<p class="fine">Nobody here yet. Inkys that are retired, or that run away, are remembered here.</p>') +
    '</section>'
  );
}
