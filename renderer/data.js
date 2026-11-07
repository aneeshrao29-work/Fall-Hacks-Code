// Jepi's content: personas, wardrobe, canned lines, the offline demo, and 8-bit sound effects.
const THINKING = ['hold up lemme cook… 🍳', 'scanning ur screen… no cap 🔍', 'analyzing the vibes…', 'loading rizz.exe…', 'chat is this real… checking 🧐'];
const TIPS = [
  'tip 1/3 ✨ press ⌘⇧Space and i\'ll fly to whatever\'s wrong on your screen',
  'tip 2/3 💬 press ⌘⇧A to make a wish (ask me anything about your screen)',
  'tip 3/3 👆 click me for modes, personas + outfits. double-click to poke. drag me anywhere.',
];

const WARDROBE = {
  hat: { none: '🚫 none', cap: '🧢 cap', crown: '👑 crown', propeller: '🌀 propeller', wizard: '🧙 wizard', cowboy: '🤠 yeehaw',
    beanie: '🧶 beanie', halo: '😇 halo', catears: '🐱 ears', bow: '🎀 bow' },
  face: { none: '🚫 none', shades: '😎 shades', glasses: '🤓 specs', mustache: '🥸 stache', blushy: '☺️ blush' },
  fit: { none: '🚫 none', tie: '👔 tie', bowtie: '🎀 bowtie', scarf: '🧣 scarf', cape: '🦸 cape' },
  trail: { crumbs: '🥧 pie crumbs', sparkles: '✨ sparkle', hearts: '💖 hearts', stars: '⭐ stars', coins: '🪙 coins', rainbow: '🌈 rainbow', six7: '6️⃣7️⃣ 67', none: '🚫 none' },
};
const PERSONAS = {
  bestie: { emoji: '💅', outfit: { hat: 'bow', face: 'blushy', fit: 'none', trail: 'crumbs' },
    hello: 'gen z bestie mode 💅 your hype girl AND your debugger. slay.',
    pokes: ['bro stop poking me 💀', 'that tickles, twin 😭', 'touch grass, not me', 'ok that one was kinda rizz ngl', '6-7 🤲🤲'] },
  brainrot: { emoji: '🧠', outfit: { hat: 'propeller', face: 'shades', fit: 'none', trail: 'six7' },
    hello: 'erm what the sigma 🧠 brainrot mode ON. skibidi ohio fanum tax 6-7.',
    pokes: ['stop poking or i\'m fanum taxing your cursor 🍟', '-67 aura poke detected', 'chat he poked me. chat.'] },
  linkedin: { emoji: '💼', outfit: { hat: 'none', face: 'shades', fit: 'tie', trail: 'coins' },
    hello: 'I\'m thrilled to announce I\'m your new sidekick 🚀 Agree? #Grindset',
    pokes: ['A poke is just unsolicited networking. 🤝', 'Let\'s take this poke offline.', 'Open to work. Not to pokes. #Boundaries'] },
  drama: { emoji: '🎭', outfit: { hat: 'crown', face: 'none', fit: 'cape', trail: 'stars' },
    hello: '*bursts from the pie* 🎭 DARLING. the drama has ARRIVED.',
    pokes: ['*faints dramatically* the AUDACITY', 'you have WOUNDED me, darling 🥀', 'i simply CANNOT with this poking'] },
  cat: { emoji: '🐱', outfit: { hat: 'catears', face: 'none', fit: 'bowtie', trail: 'sparkles' },
    hello: 'meow 🐱 i\'m sitting on your keyboard now, hooman.',
    pokes: ['hiss!! 🙀', '*knocks your coffee off the desk* ☕', 'purr… ok one more pet. ONE.'] },
  grandma: { emoji: '👵', outfit: { hat: 'beanie', face: 'glasses', fit: 'scarf', trail: 'crumbs' },
    hello: 'hello sweetie 👵 grandma baked herself a pie! drink some water, dear.',
    pokes: ['oh! you startled grandma 😳', 'that\'s very skibidi of you, dear', 'poke me again and no cookies 🍪'] },
};

// ⌘⌥D: a canned, network-free result so the live demo survives bad Wi-Fi.
// Open docs/demo.py full-screen in your editor; the box targets its broken line.
const DEMO = {
  reply: 'line 12 is missing its closing ) so python is crashing out 💀 add the ) and you ate, twin.',
  fix: 'print(f"total: {total + tax}")',
  tip: 'skip the separate tax line: total = sum(...) * 1.12 is shorter and just as clear ⚡',
  edit: { file: 'demo.py', find: '    print(f"total: {total + tax}"', replace: '    print(f"total: {total + tax}")' },
  mood: 'sassy', aura: 12,
  targets: [{ label: 'missing )', box_2d: [300, 40, 345, 560] }],
};

// tiny square-wave synth: no audio files, pure 8-bit
let audioCtx = null, muted = false;
const SFX = {
  scan: [[220, 880, 0.35]], ding: [[988, 988, 0.08], [1319, 1319, 0.16]], whoosh: [[600, 180, 0.25]],
  pop: [[520, 900, 0.08]], yeet: [[900, 140, 0.4]], bonk: [[160, 90, 0.2]], copy: [[660, 660, 0.06], [990, 990, 0.1]],
  snore: [[140, 110, 0.5]],
};
function sfx(name) {
  if (muted || !SFX[name]) return;
  try {
    audioCtx ||= new AudioContext();
    let t = audioCtx.currentTime;
    for (const [f0, f1, dur] of SFX[name]) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + dur);
      t += dur;
    }
  } catch {}
}
