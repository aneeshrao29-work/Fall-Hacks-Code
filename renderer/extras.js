// Loaded after app.js (shares its globals): quick spin, sleep/doze, first-run tips, offline demo, Esc, boot.
// ---------- quick spin, sleep, tips, demo, esc ----------
function quickSpin(msg) { // desktop/monitor switch: one quick 360° in place
  wake();
  jepi.classList.remove('qspin'); void jepi.offsetWidth; jepi.classList.add('qspin');
  setTimeout(() => jepi.classList.remove('qspin'), 600);
  if (msg) say(msg, '', 4000);
}
let zzzTimer = null;
function doze(on) {
  dozing = on;
  clearInterval(zzzTimer);
  jepi.dataset.mood = on ? 'sleep' : 'idle';
  if (on) zzzTimer = setInterval(() => {
    const z = document.createElement('div');
    z.className = 'particle txt zzz';
    z.textContent = pick(['z', 'Z', 'z']);
    Object.assign(z.style, { left: pos.x + W * 0.7 + 'px', top: pos.y + 4 + 'px' });
    $('#fx').append(z);
    setTimeout(() => z.remove(), 1600);
  }, 900);
}
function wake() {
  lastActive = Date.now();
  if (dozing && !asleep) { doze(false); say(pick(['huh?? i wasn\'t sleeping 😳', '*yawns* ok i\'m up 🥱', 'five more minutes… fine.'])); }
}
function setAsleep(on, quiet = false) {
  asleep = on;
  $('#sleepBtn .ic').textContent = on ? '☀️' : '😴';
  $('#sleepBtn .lb').firstChild.textContent = on ? 'Resume' : 'Pause';
  $('#sleepBtn small').textContent = on ? 'start looking again' : 'stop looking at my screen';
  if (on) { goHome(); doze(true); sfx('snore'); if (!quiet) say('sleep mode 😴 i won\'t look at your screen until you wake me.', '', 6000); }
  else { dozing = true; wake(); }
}
setInterval(() => { if (!asleep && !dozing && !busy && !hidden && Date.now() - lastActive > 120000) doze(true); }, 15000); // nap after 2 idle min
async function tips() {
  if (load('jepi-tips', false)) return;
  for (const t of TIPS) { await wait(4800); if (busy || tipsOff) return save('jepi-tips', true); say(t, '', 0); }
  await wait(5200);
  if (!tipsOff) hush();
  save('jepi-tips', true);
}
async function runDemo() {
  if (busy) return;
  busy = true;
  clearMarks();
  setMood('thinking');
  say(pick(THINKING), 'thinking', 0);
  jepi.classList.add('peeking');
  sfx('scan');
  await wait(2600);
  jepi.classList.remove('peeking');
  busy = false;
  addAura(DEMO.aura);
  present({ ...DEMO, display: { x: 0, y: 0, width: innerWidth, height: innerHeight }, win: { x: 0, y: 0 } });
}
$('#sleepBtn').onclick = () => { closeMenu(); setAsleep(!asleep); };
const showSound = () => { $('#muteBtn .ic').textContent = muted ? '🔇' : '🔊'; $('#muteBtn small').textContent = muted ? 'off' : 'on'; };
$('#muteBtn').onclick = () => { muted = !muted; save('jepi-muted', muted); showSound(); sfx('pop'); };
showSound();
document.addEventListener('keydown', (e) => { // Esc closes everything
  if (e.key !== 'Escape') return;
  if (going67) { going67 = false; document.querySelectorAll('.storm67').forEach((n) => n.remove()); document.body.classList.remove('crazy67'); }
  endPick(); pickmark.hidden = true; closeMenu(); closeWish(); hush(); goHome();
});

// Linux: no forwarded mouse moves, so main streams the cursor; toggle click-through + eye-follow from it
api.onCursor(({ x: cx = 0, y: cy = 0 } = {}) => {
  mouse = { x: cx, y: cy };
  syncMouse();
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy })); // eye-follow
});
// 6-7 🤲 — ONLY when the user types/presses it. Then it goes fully unhinged for a few seconds.
let going67 = false;
async function go67() {
  if (going67 || busy) return;
  going67 = tipsOff = true;
  closeMenu(); closeWish(); clearMarks(); jepi.classList.remove('pointL', 'pointR'); parked = false;
  sfx('jackpot');
  banner('6 7 🤲🤲');
  setMood('sixseven');
  say(pick(['SIX SEVENNNN 🤲🤲', '6️⃣7️⃣ IT\'S HAPPENING', 'chat. CHAT. 6 7 🤲', 'ok who said it 😭🤲']), '', 5000);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { going67 = false; return setTimeout(() => setMood('idle'), 2000); }
  document.body.classList.add('crazy67');
  for (let i = 0; i < (LITE ? 35 : 90); i++) setTimeout(() => { // full-screen number storm
    if (!going67) return; // cancelled with Esc
    const s = document.createElement('span');
    s.className = 'storm67';
    s.textContent = pick(['6', '7', '67', '6-7', '🤲', '6', '7']);
    Object.assign(s.style, {
      left: Math.random() * 100 + 'vw', top: Math.random() * 100 + 'vh', fontSize: 28 + Math.random() * 110 + 'px',
      color: pick(['#2f9e7e', '#8fd0dc', '#f0717f', '#e8384f', '#f7c948', '#6fe0c8', '#fff']),
    });
    s.style.setProperty('--r', Math.random() * 720 - 360 + 'deg');
    s.style.setProperty('--dx', Math.random() * 200 - 100 + 'px');
    document.body.append(s);
    setTimeout(() => s.remove(), 1900);
  }, i * 40);
  const start = { ...pos }, keep = outfit.trail;
  outfit.trail = 'six7'; // zig-zag around the screen leaving 6s and 7s
  for (let k = 0; k < 6 && going67; k++) await flyTo(Math.random() * (innerWidth - W), Math.random() * (innerHeight - H), 420);
  await flyTo(start.x, start.y, 600);
  outfit.trail = keep;
  document.body.classList.remove('crazy67');
  setMood('hype', 1500);
  going67 = false;
}

// ---------- banner + aura (focus score; persists between sessions) ----------
function banner(text) {
  const b = $('#banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('show'), 2200);
}
function addAura(n) {
  aura += n;
  save('jepi-aura', aura);
  const el = $('#aura');
  $('#auraVal').textContent = (aura > 0 ? '+' : '') + aura;
  el.classList.toggle('pos', aura > 0);
  el.classList.toggle('neg', aura < 0);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  if (serious()) return;
  if (aura >= 67) banner(`AURA FARMING 🔥 +${aura}`);
  else if (aura <= -67) banner(`YOU'RE COOKED 💀 ${aura}`);
  else if (Math.abs(n) >= 30) banner(`${n > 0 ? '+' : ''}${n} aura ${n > 0 ? '✨' : '📉'}`);
}

// 🚨 solve a copied error: you copy a stack trace / error, click this, Jepi explains it and points at the cause
const CRASH = /Traceback \(most recent call last\)|\b\w*(Error|Exception): |Uncaught \w+|panicked at|error\[E\d+\]|npm ERR!|error TS\d+|Segmentation fault|Exception in thread|^\s+at \S+ \(.+:\d+:\d+\)/m;
function solveCopied() { // open the ask box ready for a pasted error
  openWish();
  pasteMode = true;
  input.placeholder = keys('paste the error here (⌘V) and press Enter');
  say('copy the error, paste it in the box below with ⌘V, then press Enter 🚨', '', 0);
}

// 🧒 explain simply: cozy mode — Jepi pulls on grandma's beanie + glasses and rewrites the answer in plain words
const SIMPLE_ASK = /\b(eli5|explain (it |this |that )?(simply|simple|like i'?m (5|five|a kid))|in simple (terms|words)|simpler|dumb it down|for a beginner)\b/i;
let cozyPrev = null;
function cozy(on) {
  if (on && !cozyPrev) {
    cozyPrev = { hat: outfit.hat, face: outfit.face };
    for (const [slot, name] of [['hat', 'beanie'], ['face', 'glasses']]) { wear(sprite, slot, name); wear($('#spriteBack'), slot, name); }
    jepi.classList.remove('swap'); void jepi.offsetWidth; jepi.classList.add('swap');
  } else if (!on && cozyPrev) {
    for (const slot of ['hat', 'face']) { wear(sprite, slot, cozyPrev[slot]); wear($('#spriteBack'), slot, cozyPrev[slot]); }
    cozyPrev = null;
  }
}
async function explainSimply(text) {
  if (busy) return;
  busy = true;
  cozy(true);
  setMood('thinking');
  say('let me put on my cozy hat… 🧶', 'thinking', 0);
  const r = await api.explainSimple(text || lastReply);
  busy = false;
  if (r.error) { setMood('shook', 2000); return say(`couldn't simplify that 😬 ${r.error}`, 'err', 0, [['✓ ok', done]]); }
  setMood('idle');
  say(`🧶 ${r.reply}`, '', 0, [['↩ ask more', () => { followUp = true; lastReply = r.reply; openWish(); }], ['✓ got it', done]]);
}

// 🧭 guided tour: "explain this line by line" → Jepi walks through each spot with back / next
let tourStep = 0;
async function startTour(res, rects) {
  const n = rects.length;
  const go = async (i) => {
    tourStep = clamp(i, 0, n - 1);
    [...$('#marks').children].forEach((m, k) => m.classList.toggle('dim', k !== tourStep));
    await parkBy(rects[tourStep]);
    showPointer({ ...rects[tourStep] });
    const t = res.targets[tourStep];
    say(`${tourStep === 0 ? res.reply + '\n\n' : ''}${tourStep + 1}/${n} · ${t.note || t.label}`, '', 0, [
      ...(tourStep > 0 ? [['◀ back', () => go(tourStep - 1)]] : []),
      ...(tourStep < n - 1 ? [['next ▶', () => go(tourStep + 1)]] : []),
      ['✓ done', done],
    ]);
  };
  setMood(res.mood, 4000);
  lastReply = res.reply;
  go(0);
}

// taps on Jepi: 1 = menu · 2 = full code check · 3 = poke ("one more and i'll go") · more = Jepi goes to sleep
let taps = 0, warnedUntil = 0;
function tap() {
  taps++;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    const n = taps;
    taps = 0;
    if (asleep) { // sleeping: a triple-tap poke wakes Jepi up
      if (n >= 3) { closeMenu(); setAsleep(false); setMood('hype', 1500); return say(pick(['*yawns* ok ok i\'m up! 🥱', 'huh?! i\'m awake, i\'m awake 😳', 'five more minutes… fine, i\'m up ☀️']), '', 4000); }
      if (n === 1) return toggleMenu();
      return say('zzz… 😴 (triple-tap to wake me)', '', 3000);
    }
    if (n >= 4 || (n >= 1 && Date.now() < warnedUntil)) { // pushed it too far
      warnedUntil = 0;
      closeMenu();
      setMood('sad', 1500);
      say('ok that\'s it. i\'m going to sleep 😴 (triple-tap me to wake me)', '', 5000, [['☀️ wake up', () => setAsleep(false)]]);
      return setTimeout(() => setAsleep(true, true), 1600);
    }
    if (n === 1) return toggleMenu();
    if (n === 2) { closeMenu(); return look('', 'code'); }
    closeMenu(); // 3 taps
    poke();
    warnedUntil = Date.now() + 6000;
    say(serious() ? 'please stop, i\'m trying to focus. one more and i\'ll go.' : 'hey!! one more and i\'ll go 😤', '', 6000);
  }, 320);
}


// apply Jepi's fix to the real file, but only after the user confirms the exact change
function confirmFix(res) {
  const { edit } = res;
  setMood('thinking');
  say(`change this in ${edit.file || 'your file'}?`, '', 0, [
    ['✅ apply', async () => {
      say('applying… 🛠', 'thinking', 0);
      const r = await api.applyFix(edit);
      if (r.ok) {
        sfx('ding'); setMood('hype', 1500);
        say(`fixed ✅ ${r.file} updated (your editor should reload it)`, '', 0, [['✓ got it', done], ['↩ undo', async () => {
          const u = await api.undoFix();
          say(u.ok ? `undone ↩ ${u.file} is back to how it was` : `can't undo: ${u.error}`, u.ok ? '' : 'err', 0, [['✓ got it', done]]);
        }]]);
      } else {
        sfx('bonk'); setMood('shook', 2000);
        say(`couldn't apply 😬 ${r.error}`, 'err', 10000, res.fix ? [['📋 copy fix instead', () => { api.copy(res.fix); sfx('copy'); say('copied ✅ paste it in', '', 4000); }]] : []);
      }
    }],
    ['✖ cancel', () => { setMood('idle'); say('ok, not touching it 👍', '', 0, [['✓ got it', done]]); }],
  ], { old: edit.find, new: edit.replace });
}

// scroll tracking: main reports how far the pinned content moved; pins, glove and Jepi glide along with it
function glideTo(tx, ty, ms = 220) {
  tx = clamp(tx, 6, innerWidth - W - 6); ty = clamp(ty, 6, innerHeight - H - 6);
  const sx = pos.x, sy = pos.y, t0 = performance.now(), id = ++flightId;
  const step = (now) => {
    if (id !== flightId) return;
    const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3; // ease-out
    place(sx + (tx - sx) * e, sy + (ty - sy) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
api.onTrack?.(({ dx, dy }) => {
  if (!$('#marks').children.length) return;
  const ddx = dx - trackOff.x, ddy = dy - trackOff.y;
  trackOff = { x: dx, y: dy };
  $('#marks').style.transform = pointer.style.transform = `translate(${dx}px, ${dy}px)`;
  if (parked) glideTo(pos.x + ddx, pos.y + ddy);
});

// shortcut hints in titles/placeholders follow the OS too
document.querySelectorAll('[title]').forEach((el) => (el.title = keys(el.title)));
input.placeholder = keys(input.placeholder);
document.querySelectorAll('kbd').forEach((k) => (k.textContent = keys(k.textContent)));
$('#auraVal').textContent = (aura > 0 ? '+' : '') + aura; // restored from last session

// 🎯 point & ask: drag a box around anything, then ask about just that
const picker = $('#picker'), pickbox = $('#pickbox'), pickmark = $('#pickmark');
function startPick() {
  closeMenu(); closeWish(); hush();
  picking = true;
  picker.hidden = false;
  api.focus?.(); // so the very first drag isn't eaten by window activation
  syncMouse();
}
function endPick() { picking = false; picker.hidden = true; pickbox.style.display = 'none'; syncMouse(); }
picker.onpointerdown = (e) => {
  const sx = e.clientX, sy = e.clientY;
  const box = (ev) => ({ x: Math.min(sx, ev.clientX), y: Math.min(sy, ev.clientY), w: Math.abs(ev.clientX - sx), h: Math.abs(ev.clientY - sy) });
  const draw = (el, r) => Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  picker.setPointerCapture(e.pointerId);
  picker.onpointermove = (ev) => { pickbox.style.display = 'block'; draw(pickbox, box(ev)); };
  picker.onpointercancel = () => { picker.onpointermove = picker.onpointerup = picker.onpointercancel = null; endPick(); };
  picker.onpointerup = (ev) => {
    picker.onpointermove = picker.onpointerup = null;
    const r = box(ev);
    endPick();
    if (r.w < 6 && r.h < 6) return; // just a click: treat it as cancel, no scolding
    if (r.w < 12 || r.h < 12) return say('that box was tiny 😅 drag a bigger one', '', 3000);
    pickRegion = r;
    draw(pickmark, r);
    pickmark.hidden = false;
    openWish();
    input.placeholder = 'ask about the box… (or just press Enter)';
  };
};

// 📚 syllabus sidekick: course outline PDFs → every deadline in a calendar file + "due this week"
const fmtDue = (i) => {
  const days = Math.round((new Date(`${i.date}T12:00`) - new Date(new Date().toLocaleDateString('en-CA') + 'T12:00')) / 864e5);
  const when = days <= 0 ? '🔴 TODAY' : days === 1 ? '🟠 tomorrow' : `🟡 in ${days} days`;
  return `${when} · ${i.course} ${i.title}${i.weight ? ` [${i.weight}]` : ''}${i.time ? ` · ${i.time}` : ''}`;
};
function syllabusMenu() {
  closeMenu();
  say('📚 syllabus sidekick: give me your course outline PDFs and i\'ll put every deadline into a calendar file.', '', 0,
    [['📂 add PDFs', importSyllabus], ['📅 due this week', showWeek], ['✓ close', hush]]);
}
async function importSyllabus() {
  if (busy) return;
  busy = true;
  setMood('thinking');
  say('reading your syllabi… 📚 (about 20 seconds)', 'thinking', 0);
  const r = await api.syllabus();
  busy = false;
  setMood('idle');
  if (r.canceled) return hush();
  if (r.error) { sfx('bonk'); return say(`couldn't read that 😬 ${r.error}`, 'err', 0, [['✓ ok', hush]]); }
  sfx('ding');
  setMood('hype', 1500);
  say(`found ${r.found} deadlines ✅ (${r.total} saved)\nyour calendar file is in Downloads → jepi-deadlines.ics. open it to add them to Calendar / Google / Outlook.`,
    '', 0, [['📅 due this week', showWeek], ['📂 show file', api.showICS], ['✓ got it', hush]]);
}
async function showWeek() {
  const items = await api.dueSoon();
  say(items.length
    ? `due in the next 7 days:\n${items.slice(0, 8).map(fmtDue).join('\n')}${items.length > 8 ? `\n…and ${items.length - 8} more` : ''}`
    : 'nothing due in the next 7 days 🎉 (add your course PDFs with 📂 if you haven\'t yet)', '', 0, [['✓ got it', hush]]);
}

// 📄 resume ATS check: score + breakdown, then the fixes one at a time
const scoreEmoji = (n) => (n >= 80 ? '🟢' : n >= 60 ? '🟡' : '🔴');
async function checkResume(file) {
  if (busy || hidden) return; // it screenshots the screen (for the job post), so never while hidden / asleep
  if (asleep) return say('zzz… 😴 i\'m in sleep mode. triple-tap me to wake me first.', '', 4000);
  closeMenu();
  busy = true;
  setMood('thinking');
  say('pick your resume PDF 📄 (if a job posting is open, i\'ll match you against it)', 'thinking', 0);
  const r = await api.resume(file);
  busy = false;
  setMood('idle');
  if (r.canceled) return hush();
  if (r.error) { sfx('bonk'); return say(`couldn't check that 😬 ${r.error}`, 'err', 0, [['✓ ok', hush]]); }
  sfx('ding');
  if (r.score >= 70) setMood('hype', 1500);
  const fixes = r.suggestions;
  const copyAll = () => { api.copy(`ATS score ${r.score}/100\n\n${fixes.map((f, i) => `${i + 1}. ${f}`).join('\n')}${r.missing.length ? `\n\nmissing keywords: ${r.missing.join(', ')}` : ''}`); say('copied all the fixes 📋', '', 2500); };
  const fix = (i) => say(`fix ${i + 1}/${fixes.length}\n${fixes[i]}`, '', 0, [
    ...(i > 0 ? [['◀ back', () => fix(i - 1)]] : []),
    ...(i < fixes.length - 1 ? [['next ▶', () => fix(i + 1)]] : []),
    ['📋 copy all', copyAll], ['✓ done', hush]]);
  say(`${scoreEmoji(r.score)} ATS score: ${r.score}/100${r.job ? ` · vs ${r.job}` : ''}\n${r.verdict}\n\n`
    + r.breakdown.map((b) => `${scoreEmoji(b.score)} ${b.area} ${b.score} · ${b.note}`).join('\n')
    + (r.missing.length ? `\n\nmissing keywords: ${r.missing.join(', ')}` : ''), '', 0,
  [...(fixes.length ? [[`💡 ${fixes.length} fixes`, () => fix(0)]] : []), ['📋 copy all', copyAll], ['✓ got it', hush]]);
}
$('#atsBtn').onclick = () => checkResume();

// aura badge: explain what it is
$('#aura').onpointerdown = (e) => e.stopPropagation(); // don't start a drag / open the menu
$('#aura').onclick = (e) => { e.stopPropagation(); say(AURA_INFO, '', 0, [['✓ got it', hush]]); };
$('#pickBtn').onclick = startPick;
$('#aimBtn').onclick = startPick; // 🎯 right inside the ask box
$('#sylBtn').onclick = syllabusMenu;
$('#crashBtn').onclick = solveCopied;

// ---------- summon: pop out of pie, dust off, yeet the pie ----------
async function summon() {
  jepi.classList.remove('p-pop', 'p-rise', 'p-dust', 'p-yeet');
  jepi.classList.add('summon', 'p-pop');
  setMood('idle');
  caption.textContent = '';
  await wait(450);
  jepi.classList.replace('p-pop', 'p-rise');
  await wait(600);
  jepi.classList.replace('p-rise', 'p-dust');
  say('*dusts off pie crumbs* 🥧 ew. sticky.');
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('div');
    c.className = 'particle crumb';
    Object.assign(c.style, { left: pos.x + 14 + Math.random() * 60 + 'px', top: pos.y + 50 + Math.random() * 30 + 'px', animationDelay: Math.random() * 0.5 + 's' });
    c.style.setProperty('--dx', Math.random() * 40 - 20 + 'px');
    $('#fx').append(c);
    setTimeout(() => c.remove(), 1400);
  }
  await wait(1000);
  jepi.classList.replace('p-dust', 'p-yeet');
  sfx('yeet');
  setMood('hype', 1500);
  say('*yeets the pie* 🥧💨');
  await wait(850);
  jepi.classList.remove('summon', 'p-yeet');
  say(PERSONAS[persona].hello + ' your wish is my command 🧞 ⌘⇧Space = i find what\'s wrong. click me for the menu.');
}

// eyes follow the cursor across the whole screen (1 pixel each way, 8-bit style)
const pupils = [...document.querySelectorAll('.pupil')];
let eyeFrame = 0;
document.addEventListener('mousemove', (e) => { // eyes follow the cursor, at most once per frame
  if (eyeFrame) return;
  eyeFrame = requestAnimationFrame(() => {
    eyeFrame = 0;
    const dx = Math.sign(Math.round((e.clientX - (pos.x + W / 2)) / 80)), dy = Math.sign(Math.round((e.clientY - (pos.y + H * 0.35)) / 80));
    for (const p of pupils) p.style.transform = `translate(${dx}px, ${dy}px)`;
  });
});

// 6 then 7 = 6-7
let lastKey = '', lastAt = 0;
document.addEventListener('keydown', (e) => {
  if (e.target === input) return;
  if (e.key === '7' && lastKey === '6' && Date.now() - lastAt < 1200) go67();
  lastKey = e.key; lastAt = Date.now();
});

// boot
setPersona(persona, false);
home = defaultHome();
place(home.x, home.y);
summon().then(tips);
