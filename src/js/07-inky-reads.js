/*
 * 07-inky-reads.js: Inky reads over your shoulder
 *
 * While a scene is open, Inky reads the passage around the caret, right here in the page (nothing is sent anywhere),
 * and reacts: a face and something to hold for the mood or what just happened, the story's weather, time of day and
 * setting in the room's window, and now and then a short remark using the names in the passage.
 *
 * How it reads: word lists (PK_MOOD, PK_WEATHER, PK_TIME, PK_PLACE) are compiled once into a fast lookup (pkLex);
 * readPage() scores the sentences before the caret, recent ones counting most, and picks up events (PK_EV), who is in
 * the scene, dialogue and pace. peekRun() runs it when the writer pauses or opens a scene, and peekLine() chooses at
 * most one remark, never too often.
 *
 * This file also draws co-writers' pets during a shared sprint (paintPals) and Inky's room screen (renderDen).
 */
// While you write a scene, Inky reads the passage around the caret (in the page: nothing is sent anywhere) and reacts:
// a face and something to hold for the mood or what just happened, the story's weather, time of day and setting in the
// room's window, and now and then a remark that uses the names in the passage. readPage() reads, peekRun() reacts.
// Word lists: a trailing * matches any ending; :n is a weight (default 1).
const PK_MOOD = {
  fear: 'afraid fear fears feared fearful terrified terror terrifying scared scary scream* shriek* shiver* trembl* panic* dread* horror horrible horrified nightmare* creep* creak* lurk* eerie ominous gasp* monster* haunt* menac* sinister danger:.7 dangerous:.8 threat*:.7 shadow*:.5 dark:.3 darkness:.5 footsteps:.6 hiding:.5 frozen:.3 trapped:.8 doom*:.8 pounding:.6 heartbeat:.5 cold:.2',
  action:
    'run:.6 ran:.7 running:.7 sprint* chase* chasing fight* fought punch* kick* sword* blade* dagger* stab* slash* swung gun gunfire shot:.6 shoot* explod* explosion* crash* attack* slam*:.6 lunge* dodg* struggl* battle* wound* escap* hurl* charg*:.4 leap*:.6 leapt:.6 jump*:.5 grab*:.6 tackl* rush*:.6 faster:.6 racing:.6 duel*',
  sad: 'sad sadly sadness cry cried cries crying tears weep* wept sob sobs sobbed sobbing grief griev* mourn* funeral* lonely loneliness loss lost:.4 sorrow* heartbr* goodbye* farewell* empty:.4 ache:.6 aching:.6 regret* hopeless* despair* broken:.5 grave:.5 died:.8 dead:.5 death:.6 miss:.3 missed:.4 alone:.5 numb:.6 hollow:.6 sigh*:.3',
  joy: 'smil* grin*:.8 joy joyful joyous happy happily happiness delight* cheer* celebrat* danc* beam*:.6 thrill* glee* wonderful bright:.3 hug* festival* party:.7 feast:.6 sunshine:.3 grateful glad excit* hooray yay laugh*:.4',
  funny: 'joke* joking laugh*:.6 snort* chuckl* giggl* ridiculous absurd silly hilarious funny teas* wink*:.6 prank*',
  love: 'love loved loves loving lover* kiss* embrac* caress* blush* darling sweetheart beloved tender* romanc* romantic longing desire* lips:.6 flirt* ador* heart:.3 cheek:.3 cheeks:.3 gaze*:.4 swoon*',
  anger:
    'anger angry angrily furious fury rage raging snarl* snapped:.6 shout*:.6 yell* glare* seeth* hiss*:.5 clench*:.7 curs*:.6 damn:.5 hate hated hatred resent* bitter* scowl* growl*:.7 livid',
  mystery:
    'secret* mystery mysterious strange* odd:.5 clue* puzzl* wonder*:.4 hidden:.6 riddle* unknown cipher* suspicious* suspect* locked:.5 vanish* disappear* missing:.6 whisper*:.4 hint*:.5 cryptic',
  calm: 'quiet:.6 quietly:.5 calm* peace* gentle gently softly:.5 warm:.5 warmth:.6 tea:.5 cocoa blanket* hearth* fireplace cosy cozy serene* breeze:.4 meadow*:.5 purr*',
  sleepy: 'sleepy asleep:.8 slept:.6 yawn* drows* nap:.6 napping tired:.6 exhausted:.6 pillow*:.5 sleep:.6'
};
// Words that tell the story's weather.
const PK_WEATHER = {
  rain: 'rain rains rained raining rainy rainfall raindrop* drizzl* downpour puddle* umbrella* drench* soaked damp:.5 wet:.4',
  storm: 'storm stormy storms thunder* lightning gale* tempest* hurricane* squall*',
  snow: 'snow* sleet blizzard* frost*:.7 icy:.5 ice:.4 frozen:.4 winter:.5',
  fog: 'fog foggy mist misty mists haze:.6 hazy:.6 murk*',
  wind: 'wind:.8 windy gust* howling:.5 blustery',
  sun: 'sunny sunlight sunshine sunbeam* heat:.5 hot:.4 summer:.5 blazing:.5 scorching sweltering sun:.6'
};
// Words that tell the story's time of day.
const PK_TIME = {
  night:
    'night nights nighttime tonight midnight moon moonlight moonlit stars:.7 starlight starry:.7 dark:.3 candle*:.4 lantern*:.3',
  dawn: 'dawn sunrise daybreak morning:.8 sunup',
  dusk: 'dusk sunset twilight evening:.8 sundown nightfall:.6',
  day: 'noon midday afternoon daylight daytime lunchtime'
};
// Words that tell the kind of place the scene is in.
const PK_PLACE = {
  sea: 'sea seas ocean* tide* ship ships harbo* dock docks docked sail sails sailed sailing sailor* deck:.5 shore* beach* quay* boat* mast* gull* waves:.6 salt:.4 port:.4 anchor*:.6 lighthouse* wharf*',
  forest:
    'forest* woods:.8 tree:.5 trees:.6 pine* oak:.6 oaks:.6 moss* glade* thicket* grove* branches:.4 undergrowth woodland* fern*',
  city: 'city cities street* alley* traffic sidewalk* pavement:.5 taxi* subway* skyscraper* apartment* neon downtown crowd*:.4 market*:.4 car:.4 cars:.5 bus:.5',
  mountain: 'mountain* peak*:.6 cliff* ridge* summit* valley*:.5 slope*:.5 crag* boulder*:.5',
  desert: 'desert* dune* sand:.6 sands:.6 cactus cacti oasis',
  space: 'spaceship* starship* planet* galax* orbit* asteroid* airlock* cosmos nebula* spacecraft astronaut*',
  castle: 'castle* throne* king:.5 queen:.5 knight* courtyard*:.5 battlement* drawbridge* tower:.3 banquet*:.5 palace*',
  cave: 'cave caves cavern* tunnel* underground crypt* dungeon* cellar* catacomb*'
};
// Things that happen: [key, pattern, face, something to hold, how big a moment it is]. Only the last two sentences count.
const PK_EV = [
  ['kiss', /\bkiss(?:ed|es|ing)?\b/i, 'love', 'hearts', 3],
  [
    'death',
    /\b(?:died|dies|dying|killed|murder(?:ed|s)?|corpse|last breath|funeral|(?:is|was|were|lay|fell) dead|dead body)\b/i,
    'sad',
    'tissue',
    3
  ],
  [
    'gun',
    /\b(?:gunshots?|gunfire|pistol|rifle|revolver|fired (?:a|the|again|twice)|shots? rang)\b/i,
    'scared',
    'excl',
    3
  ],
  ['boom', /\b(?:explo(?:ded|sion|sions|ding)|boom|kaboom)\b/i, 'scared', 'excl', 3],
  ['scream', /\b(?:scream(?:ed|s|ing)?|shriek(?:ed|s|ing)?)\b/i, 'scared', 'excl', 2.5],
  [
    'fight',
    /\b(?:punch(?:ed|es)?|stab(?:bed|s)?|fought|fighting|duel(?:led)?|swords?|blades?|daggers?|brawl)\b/i,
    'tense',
    'popcorn',
    2
  ],
  ['chase', /\b(?:chas(?:e|ed|es|ing)|fled|flee(?:ing|s)?|ran for|running for|raced after)\b/i, 'tense', 'popcorn', 2],
  ['blood', /\b(?:blood(?:y|ied)?|bleed(?:ing|s)?|bled)\b/i, 'scared', 'sweat', 2],
  ['dragon', /\bdragons?\b/i, 'scared', 'excl', 2.5],
  ['ghost', /\b(?:ghosts?|ghostly|phantom|spectre|specter)\b/i, 'scared', 'sweat', 2],
  ['fire', /\b(?:on fire|in flames|caught fire|ablaze|burning down)\b/i, 'scared', 'sweat', 2.5],
  ['betray', /\bbetray(?:ed|al|s|ing)?\b/i, 'angry', '', 2.5],
  ['cry', /\b(?:cried|cry|cries|crying|sobb(?:ed|ing)|sobs?|wept|weep(?:ing|s)?|tears)\b/i, 'sad', 'tissue', 2],
  ['door', /\b(?:knock(?:ed|ing|s)?|doorbell|door (?:creaked|burst|slammed|swung|flew))\b/i, 'curious', 'qmark', 1.5],
  ['phone', /\b(?:phone (?:rang|buzzed)|the phone rang)\b/i, 'curious', 'qmark', 1.5],
  ['letter', /\b(?:letter|envelope|telegram)\b/i, 'curious', 'letter', 1],
  ['secret', /\bsecrets?\b/i, 'curious', 'magnifier', 1.5],
  ['wedding', /\b(?:wedding|marry me|proposed)\b/i, 'love', 'hearts', 2],
  ['birthday', /\bbirthday\b/i, 'glee', 'cake', 1.5],
  [
    'magic',
    /\b(?:magic(?:al)?|spell(?:s|book)?|wand|enchant(?:ed|ment)?|sorcer(?:y|er|ess)|wizard|witch|runes?)\b/i,
    'glee',
    'wand',
    1.5
  ],
  ['laugh', /\b(?:laugh(?:ed|s|ing|ter)?|giggl(?:ed|es|ing)|chuckl(?:ed|es|ing))\b/i, 'laugh', '', 1.2],
  [
    'food',
    /\b(?:ate|eating|dinner|supper|breakfast|feast|bread|soup|cake|pie|stew|biscuits?|cookies?|pastr(?:y|ies))\b/i,
    'happy',
    'cookie',
    1
  ],
  ['asleep', /\b(?:fell asleep|yawn(?:ed|s|ing)?|dozed off)\b/i, 'sleepy', '', 1],
  ['cat', /\b(?:cat|cats|kitten|kittens)\b/i, 'glee', '', 1],
  ['dog', /\b(?:dog|dogs|puppy|puppies)\b/i, 'glee', '', 1],
  ['horse', /\b(?:horse|horses|pony|stallion)\b/i, 'happy', '', 1]
];
// Words that cancel a mood word just after them ("not afraid").
const PK_NEG = new Set(['not', 'no', 'never', 'nothing', 'without', 'nobody', 'hardly', 'barely', 'nor', 'cannot']);
// Words that strengthen the mood word after them ("very afraid").
const PK_AMP = new Set([
  'very',
  'so',
  'too',
  'utterly',
  'completely',
  'deeply',
  'terribly',
  'really',
  'truly',
  'totally',
  'incredibly'
]);
// The face Inky makes for each mood it reads.
const PK_FACE = {
  fear: 'scared',
  action: 'tense',
  sad: 'sad',
  joy: 'glee',
  funny: 'laugh',
  love: 'love',
  anger: 'angry',
  mystery: 'curious',
  calm: 'cozy',
  sleepy: 'sleepy'
};
// What Inky holds for some moods.
const PK_HOLD = { fear: 'sweat', action: 'popcorn', love: 'hearts', mystery: 'magnifier' };
// Common words that never count as "a word used again and again".
const PK_STOP = new Set(
  'about above after again against along always among another around away back because been before behind being below beside between could didn down every first from going great have having here into just later like little looked looking might more most much never next nothing once only other over perhaps really right said says shall should since some something still such than that their them then there these they thing things think this those though thought through toward towards under until upon very want wanted well were what when where which while whole with within without would your'.split(
    ' '
  )
);
// The compiled word lists (built once by pkLex).
let PK_LEX = null;
// Compiles the word lists into lookups: exact words, and word starts for entries ending in *.
function pkLex() {
  if (PK_LEX) return PK_LEX;
  const build = groups => {
    const ex = new Map(),
      st = new Map();
    Object.keys(groups).forEach(cat =>
      groups[cat].split(/\s+/).forEach(w => {
        if (!w) return;
        let [t, wt] = w.split(':');
        const star = t.endsWith('*');
        if (star) t = t.slice(0, -1);
        const m = star ? st : ex;
        if (!m.has(t)) m.set(t, []);
        m.get(t).push([cat, wt ? +wt : 1]);
      })
    );
    return { ex, st };
  };
  return (PK_LEX = { mood: build(PK_MOOD), weather: build(PK_WEATHER), time: build(PK_TIME), place: build(PK_PLACE) });
}
// The [group, weight] pairs one word scores in a compiled list.
function pkHits(L, w) {
  let out = L.ex.get(w) || [];
  for (let i = Math.min(w.length, 14); i >= 3; i--) {
    const s = L.st.get(w.slice(0, i));
    if (s) {
      out = out.concat(s);
      break;
    }
  }
  return out;
}
// The strongest group in a score table, if it is strong enough (min) and clearly ahead of the next (lead).
function pkTop(o, min, lead) {
  let k = null,
    v = 0,
    v2 = 0;
  Object.keys(o).forEach(c => {
    if (o[c] > v) {
      v2 = v;
      v = o[c];
      k = c;
    } else if (o[c] > v2) v2 = o[c];
  });
  return v >= min && v >= v2 * (lead || 1.15) ? k : null;
}
// Reads the scene's visible text up to the end of the line the caret is on. Recent sentences count most: the mood
// comes from the last dozen or so, weather, time and setting remember much further back.
function readPage(vis, at) {
  if (at == null || at > vis.length) at = vis.length;
  let end = vis.indexOf('\n', at);
  if (end < 0) end = vis.length;
  const base = Math.max(0, end - 8000),
    txt = vis.slice(base, end),
    sents = [],
    sre = /[^.!?…\n]+(?:[.!?…]+["”’')\]]*)?/g;
  let m;
  while ((m = sre.exec(txt))) {
    if (/\p{L}/u.test(m[0])) sents.push({ s: base + m.index, t: m[0] });
  }
  const n = sents.length,
    R = {
      mood: null,
      weather: null,
      time: null,
      place: null,
      placeName: '',
      ev: null,
      evs: [],
      who: '',
      lead: '',
      cast: [],
      dlg: 0,
      pace: '',
      echo: '',
      fact: null,
      words: wc(vis.slice(0, end)),
      n
    };
  if (!n) return R;
  const L = pkLex(),
    mood = {},
    wx = {},
    tm = {},
    pl = {},
    add = (o, k, v) => {
      o[k] = (o[k] || 0) + v;
    };
  sents.forEach((x, i) => {
    const j = n - 1 - i,
      wm = Math.pow(0.5, j / 3),
      wl = Math.pow(0.5, j / 14),
      wt = Math.pow(0.5, j / 8),
      bang = /!/.test(x.t) ? 1.25 : 1;
    if (j > 60) return;
    const toks =
      x.t
        .toLowerCase()
        .replace(/’/g, "'")
        .match(/[\p{L}']+/gu) || [];
    toks.forEach((w, k) => {
      const neg = toks.slice(Math.max(0, k - 3), k).some(p => PK_NEG.has(p) || /n't$/.test(p)),
        amp = k && PK_AMP.has(toks[k - 1]) ? 1.5 : 1;
      if (neg) return;
      if (j < 14) pkHits(L.mood, w).forEach(([c, v]) => add(mood, c, v * wm * amp * bang));
      pkHits(L.weather, w).forEach(([c, v]) => add(wx, c, v * wl));
      pkHits(L.time, w).forEach(([c, v]) => add(tm, c, v * wt));
      pkHits(L.place, w).forEach(([c, v]) => add(pl, c, v * wl));
    });
  });
  if ((mood.funny || 0) >= (mood.joy || 0) * 0.8 && mood.funny) {
    mood.funny += (mood.joy || 0) * 0.5;
    delete mood.joy;
  }
  if (wx.storm && wx.rain) wx.storm += wx.rain * 0.6;
  R.mood = pkTop(mood, 0.9, 1.2);
  R.weather = pkTop(wx, 0.8);
  R.time = pkTop(tm, 0.7);
  R.place = pkTop(pl, 1.1);
  // who is in it: name links to character pages, the most recent first; the last place page named
  const ents = S.meta.ents,
    links = findLinks(vis).filter(l => l.s >= base && l.e <= end),
    recent = sents[Math.max(0, n - 12)].s,
    near = sents[Math.max(0, n - 3)].s;
  const chars = links.filter(l => (ents[l.id] || {}).type === 'char'),
    named = l => vis.slice(l.s, l.e);
  chars
    .filter(l => l.s >= recent)
    .reverse()
    .forEach(l => {
      const nm = named(l);
      if (!R.cast.includes(nm)) R.cast.push(nm);
    });
  const lastChar = chars.filter(l => l.s >= near).pop();
  R.who = lastChar ? named(lastChar) : '';
  R.lead = R.cast[0] || '';
  const pls = links.filter(l => (ents[l.id] || {}).type === 'place' && l.s >= sents[Math.max(0, n - 40)].s);
  if (pls.length) R.placeName = named(pls[pls.length - 1]);
  // what just happened (the last two sentences), and who it happened near
  sents.slice(-2).forEach((x, i) => {
    PK_EV.forEach(([k, re, face, hold, big]) => {
      const mm = re.exec(x.t);
      if (!mm) return;
      const pre = x.t.slice(Math.max(0, mm.index - 24), mm.index).toLowerCase();
      if (/\b(?:not|no|never|without|nobody|nothing)\b[^.!?]{0,14}$|n['’]t\s+(?:\w+\s+)?$/.test(pre)) return;
      const p = x.s + mm.index,
        who = chars.filter(l => l.s >= x.s && l.s < p).pop() || chars.filter(l => l.s >= x.s).shift();
      R.evs.push({
        k,
        face,
        hold,
        big,
        at: p,
        sig: k + ':' + x.s,
        j: sents.length > 1 ? 1 - i : 0,
        who: who ? named(who) : ''
      });
    });
  });
  // the biggest moment wins, the latest sentence counting more
  const sc2 = e => e.big * (e.j ? 0.6 : 1) + e.at / 1e9;
  R.evs.sort((a, b) => sc2(a) - sc2(b));
  R.ev = R.evs[R.evs.length - 1] || null;
  // how it reads: dialogue, pace, a word used again and again
  const tail = sents
      .slice(-12)
      .map(x => x.t)
      .join(' '),
    q = (tail.match(/[“"][^”"]*[”"]/g) || []).join('').length;
  R.dlg = tail.length ? q / tail.length : 0;
  const last8 = sents.slice(-8).map(x => wc(x.t)),
    avg = last8.reduce((a, b) => a + b, 0) / last8.length;
  if (last8.length >= 6) R.pace = avg < 7 ? 'fast' : avg > 30 ? 'slow' : '';
  const names = new Set();
  Object.values(ents).forEach(e =>
    [e.name].concat(e.aliases || []).forEach(s =>
      String(s)
        .toLowerCase()
        .split(/\s+/)
        .forEach(w => names.add(w))
    )
  );
  const ws = (
      sents
        .slice(-10)
        .map(x => x.t)
        .join(' ')
        .toLowerCase()
        .replace(/’/g, "'")
        .match(/[\p{L}']+/gu) || []
    ).slice(-160),
    cnt = {};
  ws.forEach(w => {
    if (w.length >= 5 && !PK_STOP.has(w) && !names.has(w) && !/'/.test(w)) cnt[w] = (cnt[w] || 0) + 1;
  });
  const echo = Object.keys(cnt)
    .filter(w => cnt[w] >= 3)
    .sort((a, b) => cnt[b] - cnt[a])[0];
  if (echo) R.echo = echo;
  return R;
}
// Inky's remarks: for events (ev), moods, weather and the pace, with {who} and {place} filled in from the passage.
const PK_LINES = {
  ev: {
    kiss: [
      'A kiss!? I’m covering my eyes. (I’m peeking.)',
      '{who}! A kiss! I need a minute.',
      'Ooh. I did not see that kiss coming. Or did I?'
    ],
    death: [
      'Oh no. Oh no no no.',
      'I need a moment after that.',
      '{who}… I’m not ready for this.',
      'That one hurt. I’m holding a tissue just in case.'
    ],
    gun: ['A shot! Everybody down!', 'Was that a gunshot? My ink froze.'],
    boom: ['BOOM! My tuft is still shaking.', 'An explosion! Is everyone all right in there?'],
    scream: [
      'AAH! Sorry. That scream made me jump.',
      'Who screamed?! My ink just curdled.',
      '{who}, what is it? What did you see?'
    ],
    fight: ['Duck, {who}!', 'A fight! I’m watching through my fingers.', 'Swing, dodge, swing! I’ve got popcorn.'],
    chase: ['Run, {who}, run!', 'A chase! Faster, faster!', 'My little legs can’t keep up!'],
    blood: ['Blood! I’m not looking. Tell me when it’s over.', 'Is that blood? Somebody find a bandage.'],
    dragon: ['A DRAGON. I’m hiding behind the inkpot.', 'Is the dragon friendly? Asking for me.'],
    ghost: ['A ghost?! I’m sleeping with the lamp on tonight.', 'Boo! …Sorry. Couldn’t resist.'],
    fire: ['Fire! Somebody fetch a bucket!', 'It’s getting hot in here. Literally.'],
    betray: ['Betrayal! I knew something was off.', 'How could they! I’m cross on {who}’s behalf.'],
    cry: ['Oh, {who}. Here, take a tissue.', 'Someone’s crying. I brought tissues.', 'My eyes are leaking ink.'],
    door: [
      'Someone’s at the door. Don’t open it! …Fine, open it.',
      'Who’s there? I have to know.',
      'That door. I don’t trust that door.'
    ],
    phone: ['The phone! Who’s calling?', 'Answer it, {who}!'],
    letter: [
      'A letter! Read it out loud, please.',
      'Ooh, a letter. Good news or bad news?',
      'What does it say, {who}?'
    ],
    secret: [
      'A secret? I won’t tell. Promise.',
      'Ooh, {who} is hiding something.',
      'Secrets! I’ve got my magnifying glass.'
    ],
    wedding: ['A wedding! I’ll bring confetti.', 'Wedding bells! Do I get cake?'],
    birthday: ['A birthday! Is there cake? I see cake.', 'Happy birthday, {who}!'],
    magic: ['Magic! Sparkles everywhere.', 'Ooh, a spell. What does it do?', '{who} can do magic? Teach me!'],
    laugh: ['Ha! I’m laughing too.', '{who} laughing makes me happy.'],
    food: [
      'Now I’m hungry. Is there enough for me?',
      'This scene smells delicious.',
      '{who} is eating and I’m jealous.'
    ],
    asleep: ['All this yawning is catching. Yaaawn.', 'Shh. Someone’s sleeping.'],
    cat: ['A cat! Is it fluffy? Please say it’s fluffy.'],
    dog: ['A dog! Good dog. Very good dog.'],
    horse: ['A horse! Giddy up.']
  },
  mood: {
    fear: [
      'I’m scared. Is it safe to keep reading?',
      'The hairs on my tuft are standing up.',
      'Something’s coming. I can feel it.',
      'Behind you, {who}! …Probably nothing. Probably.'
    ],
    action: ['My heart is pounding!', 'Go, go, go!', 'Edge of my seat. Literally. I’m about to fall off.'],
    sad: ['This part is sad. I’m right here.', 'Poor {who}.', 'I need a hug after this paragraph.', 'Sniff.'],
    joy: ['This makes me smile.', 'Happy scene! I’m doing a little wiggle.', 'Yay for {who}!'],
    funny: ['Ha! That’s funny.', 'I snorted ink. Thanks for that.', '{who} is a riot.'],
    love: [
      'Is it getting warm in here? It’s the romance.',
      '{who} is in love. I can tell.',
      'My heart just did a little flip.'
    ],
    anger: [
      'Uh oh. Someone’s angry.',
      '{who} is fuming. I’m keeping my distance.',
      'The tension! I could cut it with a quill.'
    ],
    mystery: [
      'Something doesn’t add up. Fetching my magnifying glass.',
      'A clue? I love a clue.',
      'Hmm. What is {who} not telling us?'
    ],
    calm: ['Nice and peaceful. I could nap here.', 'This feels cosy. Like tea and a blanket.'],
    sleepy: ['All this talk of sleep is making me drowsy.']
  },
  weather: {
    rain: ['Rain! I’ve got my umbrella.', 'Listen to that rain on the window.'],
    storm: ['A storm! I’m holding on to my umbrella.', 'Thunder! I’m not scared. (I am a bit.)'],
    snow: ['Snow! Look at my window!', 'Brr. I can feel the cold through the page.'],
    fog: ['Fog everywhere. I can’t see a thing.'],
    wind: ['Hold on to your hats, it’s windy.'],
    sun: ['Sunshine! Where are my sunglasses?', 'What a bright day.']
  },
  time: {
    night: ['Night has fallen. I’ve lit the lamp.', 'It’s dark out there now.'],
    dawn: ['Morning! The light just changed.'],
    dusk: ['The sun’s going down. Pretty sky.'],
    day: ['Broad daylight. Nowhere to hide.']
  },
  place: {
    sea: ['We’re by the sea! I can smell the salt.', 'Waves! I hope nobody gets seasick.'],
    forest: ['Into the woods. Stay on the path!'],
    city: ['The city! So many lights.'],
    mountain: ['Up in the mountains. Mind the edge!'],
    desert: ['Sand everywhere. I’m thirsty already.'],
    space: ['Space! I’ve always wanted to float.'],
    castle: ['A castle! Do I curtsy?'],
    cave: ['It’s dark in here. Watch your head.']
  },
  at: ['We’re at {place}!', 'Off to {place}.', '{place}! I like it there.'],
  enter: ['Oh, {who} is here!', 'Hello, {who}.', '{who}! I wondered when you’d turn up.'],
  echo: ['“{word}” three times in a few lines. On purpose?', 'I keep reading “{word}”. Maybe swap one?'],
  dlg: ['So much talking! I can hear the voices.', 'Good dialogue. I’m listening in.'],
  fast: ['Short sentences. Quick. Like a heartbeat.', 'Fast pace! I’m out of breath.'],
  slow: ['Long, winding sentences. Very dreamy.', 'Ooh, lyrical.'],
  fact: {
    eyes: ['Wait… I thought {who}’s eyes were {fact}.', 'Hmm. {who}’s page says {fact} eyes.'],
    hair: ['Wait… isn’t {who}’s hair {fact}?', 'Hmm. {who}’s page says {fact} hair.'],
    age: ['Hang on, isn’t {who} {fact}?', 'Hmm. {who}’s page says {fact}.']
  }
};
// How Inky says where the scene is.
const PK_WHERE = {
  sea: 'by the sea',
  forest: 'in the woods',
  city: 'in the city',
  mountain: 'in the mountains',
  desert: 'in the desert',
  space: 'out in space',
  castle: 'in the castle',
  cave: 'underground'
};
// How Inky says the time of day (PK_WX: the weather).
const PK_WHEN = { night: 'at night', dawn: 'at dawn', dusk: 'at dusk', day: 'by day' },
  PK_WX = {
    rain: 'in the rain',
    storm: 'in a storm',
    snow: 'in the snow',
    fog: 'in the fog',
    wind: 'in the wind',
    sun: 'in the sun'
  };
// Inky's one-line reaction to each mood, used when it says where we are.
const PK_FEEL = {
  fear: 'Something’s wrong, I can tell.',
  action: 'And it’s all go.',
  sad: 'And it’s sad.',
  joy: 'And everyone’s happy.',
  funny: 'And it’s funny.',
  love: 'And there’s romance.',
  anger: 'And someone’s cross.',
  mystery: 'And there’s a mystery.',
  calm: 'All peaceful.',
  sleepy: 'Sleepily.'
};
// Picks a remark whose {placeholders} can all be filled, and fills them.
function pkFill(list, v) {
  const ok = list.filter(s => (s.match(/\{(\w+)\}/g) || []).every(t => v[t.slice(1, -1)]));
  return ok.length ? pick(ok).replace(/\{(\w+)\}/g, (_, k) => v[k]) : '';
}
// Whether Inky is reading: switched on and a scene is open.
const peekOn = () => LOOK.peek !== false && !!ui.view && ui.view.k === 'scene';
// What Inky has read in the open scene (null when it is not reading).
const peekNow = () => (peekOn() && ui.peek && ui.peek.id === ui.view.id ? ui.peek.r : null);
// Inky's face and what it holds, from what it has read (null when it is not reading).
function peekFace(r) {
  r = r || peekNow();
  if (!r) return null;
  let face = null;
  const hold = [];
  const ev = r.ev; // a big moment shows on the face; a small one only puts something in Inky's hands
  if (ev && (ev.big >= 2 || !r.mood)) {
    face = ev.face;
    if (ev.hold) hold.push(ev.hold);
  } else if (r.mood) {
    face = PK_FACE[r.mood];
    if (ev && ev.hold) hold.push(ev.hold);
    else if (PK_HOLD[r.mood]) hold.push(PK_HOLD[r.mood]);
  }
  if ((r.weather === 'rain' || r.weather === 'storm') && !hold.some(k => REACT_R.includes(k))) hold.push('umbrella');
  if (r.weather === 'snow') hold.push('scarf', 'shiver');
  if (r.weather === 'sun' && !face) hold.push('shades');
  if (!face && r.time === 'night' && !r.weather) face = 'cozy';
  return { m: face, react: hold };
}
// Inky's face and props right now: the reading face if there is one, otherwise the mood from today's words.
function petNow() {
  const md = curMood(),
    f = peekFace();
  return { m: (f && f.m) || md, react: f ? f.react : [] };
}
// Inky's look with something to hold added.
function petLook(react) {
  return react && react.length ? Object.assign({}, S.meta.pet, { react }) : null;
}
// Redraws the pet and the room when what Inky shows has changed.
function paintPet(force) {
  const f = petNow(),
    st = petStage(),
    r = peekNow(),
    sig = f.m + '|' + st + '|' + f.react.join(',') + '|' + (r ? [r.weather, r.time, r.place, r.mood].join(',') : '');
  if (!force && sig === ui.petSig) return;
  ui.petSig = sig;
  const art = $('#petArt');
  if (art) art.innerHTML = petSVG(f.m, st, petLook(f.react));
  const card = $('.pet-card');
  if (card) card.className = 'pet-card m-' + f.m + (card.classList.contains('reading') ? ' reading' : '');
  const room = $('#petRoom');
  if (room) room.innerHTML = roomSVG();
  const pp = $('#peekPet');
  if (pp) {
    pp.innerHTML = petSVG(f.m, st, petLook(f.react));
    pp.className = 'peek-pet m-' + f.m;
  }
}
// Inky says something it noticed while reading (remembered so the same kind of remark waits a while).
function peekSay(msg) {
  say(msg);
  ui.sayKind = 'peek';
  const pk = ui.peek;
  if (pk) pk.lineAt = ui.sayAt;
  const b = $('#peekB');
  if (b) {
    b.textContent = msg;
    b.hidden = false;
    clearTimeout(ui.pkB);
    ui.pkB = setTimeout(() => {
      b.hidden = true;
    }, 7000);
  }
}
// mode: 'open' (a scene was just opened: say where we are), 'type' (the writer paused) or 'move' (the caret moved).
function peekRun(mode) {
  if (!S || !peekOn()) return;
  const v = ui.view,
    ed = $('#ed');
  if (!ed) return;
  const vis = plainText(getText(ed)),
    at = peekCaret(ed),
    r = readPage(vis, at);
  let pk = ui.peek;
  if (!pk || pk.id !== v.id) pk = ui.peek = { id: v.id, said: {}, seen: new Set(), r: null, lineAt: 0 };
  const prev = pk.r;
  pk.r = r;
  ui.pkAt = Date.now();
  r.fact = peekFacts(v.id, at == null ? vis.length : at);
  if (mode === 'type') {
    const card = $('.pet-card');
    if (card) {
      card.classList.add('reading');
      clearTimeout(ui.pkRd);
      ui.pkRd = setTimeout(() => card.classList.remove('reading'), 1400);
    }
  }
  if (mode !== 'type' || !prev) {
    r.evs.forEach(e => pk.seen.add(e.sig));
    paintPet();
    if (mode === 'open') peekWhere(r);
    return;
  }
  paintPet();
  const t = peekLine(r, prev, pk); // a remark, and how long until a waiting one (something that happened, a fact) can be made
  if (t.s) peekSay(t.s);
  if (t.wait) {
    clearTimeout(ui.pkT);
    ui.pkT = setTimeout(() => {
      if (ui.view === v) peekRun('type');
    }, t.wait + 100);
  }
}
// The caret's place in the visible text (with line breaks), or null when the editor does not have it.
function peekCaret(ed) {
  const sel = getSelection();
  if (!sel.rangeCount || !ed.contains(sel.focusNode)) return null;
  const rg = document.createRange();
  rg.selectNodeContents(ed);
  rg.setEnd(sel.focusNode, sel.focusOffset);
  const d = document.createElement('div');
  d.appendChild(rg.cloneContents());
  return plainText(getText(d)).length;
}
// Chooses at most one remark from what Inky just read, rate-limited per kind, never over a recent cheer.
function peekLine(r, prev, pk) {
  const now = Date.now(),
    since = now - pk.lineAt,
    cool = k => now - (pk.said[k] || 0) > 240000,
    out = [];
  const quiet = ui.sayKind !== 'peek' ? 8000 - (now - ui.sayAt) : 0; // a cheer or milestone was just said
  if (r.words < 25 && !r.evs.length) return {};
  const fresh = r.evs.filter(e => !pk.seen.has(e.sig)),
    ev = fresh[fresh.length - 1]; // sorted, biggest last
  if (ev && cool('ev:' + ev.k))
    out.push([
      'ev:' + ev.k,
      PK_LINES.ev[ev.k],
      { who: ev.who || r.who },
      5000,
      () => fresh.forEach(e => pk.seen.add(e.sig))
    ]);
  const f = r.fact;
  if (f && cool('fact:' + f.key))
    out.push(['fact:' + f.key, PK_LINES.fact[f.attr] || PK_LINES.fact.eyes, { who: f.who, fact: f.fact }, 10000]);
  if (r.mood && r.mood !== prev.mood && cool('m:' + r.mood))
    out.push(['m:' + r.mood, PK_LINES.mood[r.mood], { who: r.who || r.lead }, 20000]);
  if (r.weather && r.weather !== prev.weather && cool('w:' + r.weather))
    out.push(['w:' + r.weather, PK_LINES.weather[r.weather], {}, 20000]);
  if (r.placeName && r.placeName !== prev.placeName && cool('at:' + r.placeName))
    out.push(['at:' + r.placeName, PK_LINES.at, { place: r.placeName }, 25000]);
  else if (r.place && r.place !== prev.place && cool('s:' + r.place))
    out.push(['s:' + r.place, PK_LINES.place[r.place], {}, 25000]);
  if (r.time && r.time !== prev.time && cool('t:' + r.time))
    out.push(['t:' + r.time, PK_LINES.time[r.time], {}, 25000]);
  const nw = r.cast.find(c => !prev.cast.includes(c));
  if (nw && cool('c:' + nw)) out.push(['c:' + nw, PK_LINES.enter, { who: nw }, 40000]);
  if (r.echo && r.echo !== prev.echo && cool('e:' + r.echo))
    out.push(['e:' + r.echo, PK_LINES.echo, { word: r.echo }, 45000]);
  if (r.pace && r.pace !== prev.pace && cool('pace:' + r.pace))
    out.push(['pace:' + r.pace, PK_LINES[r.pace], {}, 90000]);
  if (r.dlg > 0.55 && prev.dlg <= 0.55 && cool('dlg')) out.push(['dlg', PK_LINES.dlg, {}, 90000]);
  let wait = 0,
    said = '';
  const urgent = k => k.startsWith('ev:') || k.startsWith('fact:');
  for (const [k, list, vars, gap, done] of out) {
    if (said) {
      if (urgent(k)) wait = wait || gap;
      continue;
    } // said something: come back for the next waiting remark
    if (quiet > 0 || since < gap) {
      if (urgent(k)) wait = Math.max(wait, quiet, gap - since);
      continue;
    }
    const s = pkFill(list, vars);
    if (s) {
      pk.said[k] = now;
      if (done) done();
      said = s;
      wait = 0;
    }
  }
  return { s: said, wait: wait > 0 && wait < 15000 ? wait : 0 };
}
// Just after a scene opens: "Where were we? Mara and Tobias, by the sea, at night, in the rain."
function peekWhere(r) {
  if (r.words < 40 || Date.now() - ui.sayAt < 3000) return;
  const who = r.cast.slice(0, 2).join(' and '),
    parts = [who, r.placeName ? 'at ' + r.placeName : PK_WHERE[r.place], PK_WHEN[r.time], PK_WX[r.weather]].filter(
      Boolean
    );
  if (parts.length < 2 && !(parts.length && r.mood)) return;
  let s = 'Where were we? ' + parts.join(', ') + '.';
  s = s
    .replace('? at ', '? At ')
    .replace('? by ', '? By ')
    .replace('? in ', '? In ')
    .replace('? out ', '? Out ')
    .replace('? underground', '? Underground');
  if (r.mood && PK_FEEL[r.mood]) s += ' ' + PK_FEEL[r.mood];
  peekSay(s);
}
// Continuity facts close to the caret: Inky notices "green eyes" on someone whose page says blue.
function peekFacts(id, at) {
  const x = contCheck().find(c => c.kind === 'fact' && c.scene === id && c.s <= at && c.s >= at - 400);
  if (!x) return null;
  const e = S.meta.ents[x.ent];
  if (!e) return null;
  return { key: contKey(x), who: e.name, attr: x.attr, fact: x.fact };
}
// Co-writers' pets, when they are sprinting at the same time as you.
function paintPals() {
  const box = $('#petPals');
  if (!box) return;
  const o = (ui.others || []).filter(x => x.sprint > Date.now() && x.pet);
  box.innerHTML = o
    .slice(0, 2)
    .map(
      x =>
        '<span class="pal" title="' +
        esc(whoName(x)) +
        ' is sprinting">' +
        petSVG('hype', Math.max(0, Math.min(4, +x.pet.st || 0)), { color: x.pet.c, wear: {}, form: x.pet.f }) +
        '<b>' +
        esc(whoName(x)) +
        '</b></span>'
    )
    .join('');
}
// Joins a co-writer's sprint: starts a focus session that ends when theirs does.
function pmJoin(end, who) {
  if (T.running && T.phase === 'focus') {
    toast('Your focus timer is already running.', { plain: true });
    return;
  }
  const left = end - Date.now();
  if (left < 30000) {
    toast('That sprint is nearly over. Start your own from the timer.', { plain: true });
    return;
  }
  T.phase = 'focus';
  T.left = left;
  pmStart();
  say('Sprinting with ' + who + '! Same finish line.');
  hereSoon();
}
// Inky's room screen: the room full size, Inky's name and colour, what it wears, achievements, and how chatty it is.
function renderDen(el) {
  const p = S.meta.pet,
    st = petStats(),
    stg = petStage(),
    md = curMood(),
    unlockedItem = id => {
      if (id === 'quill') return stg >= 1 || owns('quill');
      if (id === 'glasses') return stg >= 2 || owns('glasses');
      if (id === 'beret') return stg >= 3 || owns('beret');
      if (id === 'laurel') return stg >= 4 || owns('laurel');
      return owns(id);
    };
  const slots = [
    ['head', 'On the head'],
    ['face', 'Eyes'],
    ['neck', 'Neck'],
    ['hand', 'In hand']
  ];
  const opt = (slot, id, label, ok, hint) => {
    const on = (p.wear[slot] || 'auto') === id,
      look = { color: p.color, wear: { head: 'none', face: 'none', neck: 'none', hand: 'none', [slot]: id } };
    return (
      '<button class="wd' +
      (on ? ' on' : '') +
      (ok ? '' : ' locked') +
      '" data-wear="' +
      slot +
      '" data-v="' +
      id +
      '"' +
      (ok ? '' : ' disabled') +
      ' title="' +
      esc(ok ? label : hint) +
      '" aria-pressed="' +
      on +
      '">' +
      (id === 'auto'
        ? '<span class="wd-auto">Auto</span>'
        : id === 'none'
          ? '<span class="wd-auto">None</span>'
          : petSVG('happy', 0, look)) +
      (id === 'auto' || id === 'none'
        ? ''
        : '<small>' + esc(ok ? label : '🔒 ' + ((ACH.find(x => x[3] === id) || [])[1] || 'Locked')) + '</small>') +
      '</button>'
    );
  };
  const hintFor = id => {
    const a = ACH.find(x => x[3] === id);
    return a ? a[2] : { beret: 'Reach your daily goal.' }[id] || '';
  };
  el.innerHTML =
    '<div class="main-head">' +
    backBtn() +
    '<span class="kind">' +
    ico('spark', 16) +
    '</span><h1 class="mh-title">' +
    esc(p.name) +
    '’s room</h1></div><div class="den">' +
    '<section class="den-hero"><div class="den-stage"><div class="room">' +
    roomSVG() +
    '</div><span class="den-pet">' +
    petSVG(md, stg) +
    '</span></div>' +
    '<div class="den-side"><div class="den-name"><b>' +
    esc(p.name) +
    '</b><span class="stage-tag">' +
    STAGES[stg].n +
    '</span></div>' +
    '<div class="ss-tiles den-tiles"><div class="ss-tile"><b class="mono">' +
    fmt(st.total) +
    '</b><span>words written</span></div><div class="ss-tile"><b class="mono">' +
    st.best +
    '</b><span>best streak</span></div><div class="ss-tile"><b class="mono">' +
    st.goalDays +
    '</b><span>days at goal</span></div><div class="ss-tile"><b class="mono">' +
    st.sprints +
    '</b><span>sprints</span></div></div>' +
    '<span class="sec-l">Colour</span><div class="swatches">' +
    PET_COLORS.map(
      c =>
        '<button class="sw' +
        (p.color === c[0] ? ' on' : '') +
        '" data-color="' +
        c[0] +
        '" aria-label="' +
        c[1] +
        '" title="' +
        c[1] +
        '"' +
        (c[2] ? ' style="--c:' + c[2][0] + '"' : '') +
        '></button>'
    ).join('') +
    '</div>' +
    '<span class="sec-l">How chatty</span><div class="seg">' +
    [
      ['chatty', 'Chatty'],
      ['quiet', 'Only big moments'],
      ['off', 'Quiet']
    ]
      .map(
        o =>
          '<button data-talk="' +
          o[0] +
          '"' +
          ((LOOK.petTalk || 'chatty') === o[0] ? ' class="on"' : '') +
          '>' +
          o[1] +
          '</button>'
      )
      .join('') +
    '</div>' +
    '<label class="ck"><input type="checkbox" id="denConf"' +
    (LOOK.confetti !== false ? ' checked' : '') +
    '>Confetti for big moments</label>' +
    '<label class="ck"><input type="checkbox" id="denPeek"' +
    (LOOK.peek !== false ? ' checked' : '') +
    '>Reads over your shoulder</label>' +
    '<p class="fine">While you write, ' +
    esc(p.name) +
    ' reads the lines around the cursor and reacts: the weather, time of day and place show in the window, and the mood and what happens show on ' +
    esc(p.name) +
    '’s face. The reading happens on this ' +
    (DESK ? 'computer' : 'device') +
    '; nothing is sent anywhere.</p>' +
    '<p class="fine">Ranks follow this project’s novel length goal (' +
    fmt(S.meta.target) +
    ' words): Inkling at 5%, Scribe at 25%, Bard at 50%, Laureate at 100%. A rank, once reached, stays.</p>' +
    '<p class="fine">' +
    esc(p.name) +
    ' and everything earned belong to you' +
    (DESK ? ', on every project you share' : '') +
    '. Chattiness and confetti are set per ' +
    (DESK ? 'computer' : 'browser') +
    '.</p></div></section>' +
    lifeDenHtml() +
    '<section class="pf"><h2>Wardrobe</h2><p class="fine">“Auto” follows ' +
    esc(p.name) +
    '’s rank. Earn more by writing.</p>' +
    slots
      .map(([k, label]) => {
        const ids = Object.keys(PET_ITEMS).filter(id => PET_ITEMS[id][0] === k);
        return (
          '<div class="wd-row"><span class="sec-l">' +
          label +
          '</span><div class="wd-opts">' +
          opt(k, 'auto', 'Auto', true) +
          opt(k, 'none', 'None', true) +
          ids.map(id => opt(k, id, PET_ITEMS[id][1], unlockedItem(id), hintFor(id))).join('') +
          '</div></div>'
        );
      })
      .join('') +
    '</section>' +
    '<section class="pf"><h2>Achievements</h2><p class="fine">' +
    ACH.filter(a => p.got[a[0]]).length +
    ' of ' +
    ACH.length +
    ' earned. Room things appear in the room as soon as they are earned.</p><div class="ach">' +
    ACH.map(a => {
      const got = p.got[a[0]],
        cur = Math.min(st[a[4]], a[5]),
        it = PET_ITEMS[a[3]];
      return (
        '<div class="ach-card' +
        (got ? ' got' : '') +
        '"><b>' +
        esc(a[1]) +
        '</b><span>' +
        esc(a[2]) +
        '</span>' +
        (got
          ? '<small>Earned ' + esc(new Date(got).toLocaleDateString()) + ' · ' + esc(it[1]) + '</small>'
          : '<div class="bar"><i style="width:' +
            (cur / a[5]) * 100 +
            '%"></i></div><small>' +
            (a[5] > 1 ? fmt(cur) + ' / ' + fmt(a[5]) + ' · ' : '') +
            'Unlocks ' +
            esc(it[1].toLowerCase()) +
            '</small>') +
        '</div>'
      );
    }).join('') +
    '</div></section></div>';
  el.onclick = e => {
    if (e.target.closest('#lifeRetire')) return lifeRetire();
    const w = e.target.closest('[data-wear]'),
      c = e.target.closest('[data-color]'),
      t = e.target.closest('[data-talk]');
    if (w && !w.disabled) {
      p.wear[w.dataset.wear] = w.dataset.v;
      dirty('meta');
      renderDen(el);
      updatePetArt();
    } else if (c) {
      p.color = c.dataset.color;
      dirty('meta');
      renderDen(el);
      updatePetArt();
    } else if (t) {
      LOOK.petTalk = t.dataset.talk;
      saveLook();
      renderDen(el);
    }
  };
  $('#denConf', el).addEventListener('change', e => {
    LOOK.confetti = e.target.checked;
    saveLook();
  });
  $('#denPeek', el).addEventListener('change', e => {
    LOOK.peek = e.target.checked;
    saveLook();
    ui.peek = null;
    ui.pkOpen = null;
    paintPet(true);
  });
}
// Redraws Inky (kept as a name other code calls).
function updatePetArt() {
  paintPet(true);
}
