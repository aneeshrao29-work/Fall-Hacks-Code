const $ = (s) => document.querySelector(s);
// stub so the page still renders in a normal browser for design work
const api = window.jepiAPI || {
  look: async () => ({ error: 'open me with npm start, twin' }),
  clickThrough() {},
  quit() {},
  copy() {},
  unpin() {},
  applyFix: async () => ({ error: 'not running in electron' }),
  explainSimple: async () => ({ error: 'not running in electron' }),
  syllabus: async () => ({ error: 'not running in electron' }),
  dueSoon: async () => [],
  showICS() {},
  undoFix: async () => ({ error: 'not running in electron' }),
  onHotkey() {},
  onCursor() {},
  onTrack() {},
  platform: 'darwin',
};
// shortcut labels per OS: ⌘ on macOS, Ctrl on Windows/Linux
const MAC = api.platform === 'darwin';
const keys = (t) => (MAC ? t : t.replace(/⌘⇧/g, 'Ctrl+Shift+').replace(/⌘⌥/g, 'Ctrl+Alt+').replace(/⌘/g, 'Ctrl+'));
const buddy = $('#buddy'), jepi = $('#jepi'), sprite = $('#sprite'), bubble = $('#bubble'), caption = $('#caption');
const input = $('#question'), dock = $('#dock'), wish = $('#askForm');
// older/weaker machines get 'lite' mode: no decorative idle animations, fewer particles
const LITE = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4
  || matchMedia('(prefers-reduced-motion: reduce)').matches;
document.body.classList.toggle('lite', LITE);
const W = 66, H = 71; // Jepi is drawn at 88x94 and scaled to 75%
let fullText = '', hushTimer = null, busy = false, aura = 0, moodTimer = null, typeTimer = null;
let flightId = 0, pos = { x: 0, y: 0 }, home = null, parked = false, hidden = false;
let mouse = { x: -1, y: -1 }, catching = null, picking = false, pasteMode = false;
let pickRegion = null, trackOff = { x: 0, y: 0 }, tipsOff = false, lastReply = '', followUp = false, pointerTimer = null, clickTimer = null, asleep = false, dozing = false, lastActive = Date.now();

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const serious = () => !!PERSONAS[persona]?.serious; // study mode: no jokes, sounds or aura banners
let persona = PERSONAS[load('jepi-persona')] ? load('jepi-persona') : 'bestie';
let outfit = { ...PERSONAS[persona].outfit, ...load('jepi-outfit', {}) };
muted = load('jepi-muted', false);
aura = Number(load('jepi-aura', 0)) || 0;

buildTwin(sprite);
buildBack($('#spriteBack'));
buildPie($('#pieSvg'));
const pointer = $('#pointer');
pointer.firstElementChild.append(miniSprite(POINTER_ART));
jepi.addEventListener('animationend', (e) => { if (e.animationName === 'swap') jepi.classList.remove('swap'); });

// ---------- talking ----------
function setMood(m, ms = 0) {
  jepi.dataset.mood = m;
  clearTimeout(moodTimer);
  if (ms) moodTimer = setTimeout(() => (jepi.dataset.mood = 'idle'), ms);
}
function say(text, cls = '', ttl = 9000, actions = [], diff = null) {
  text = fullText = keys(text);
  bubble.className = 'bubble ' + cls;
  const acts = $('#acts');
  acts.replaceChildren(...actions.map(([label, fn]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = (e) => { e.stopPropagation(); fn(); };
    return b;
  }));
  if (diff && (diff.old || diff.new)) { // red/green before→after preview of a code change
    const pre = document.createElement('pre');
    pre.className = 'diff';
    const del = document.createElement('div'), add = document.createElement('div');
    del.className = 'del'; del.textContent = '− ' + (diff.old || '');
    add.className = 'add'; add.textContent = '+ ' + (diff.new || '');
    pre.append(del, add);
    acts.prepend(pre);
  }
  clearInterval(typeTimer);
  clearTimeout(hushTimer);
  caption.textContent = '';
  jepi.classList.add('talking');
  const chars = [...text];
  let i = 0;
  typeTimer = setInterval(() => {
    caption.textContent += chars[i++] ?? '';
    if (i % 2 === 0 && cls !== 'thinking') blip(chars[i - 1] || '');
    if (i % 8 === 0 || i >= chars.length) fixBubble(); // layout reads are costly: not every char
    if (i >= chars.length) {
      clearInterval(typeTimer);
      jepi.classList.remove('talking');
      if (ttl) hushTimer = setTimeout(hush, ttl);
    }
  }, 18);
}
function hush() { // fade the bubble, then empty it (a new say() in the meantime cancels this)
  clearInterval(typeTimer);
  jepi.classList.remove('talking');
  if (!caption.textContent) return;
  bubble.classList.add('hushing');
  setTimeout(() => { if (bubble.classList.contains('hushing')) { caption.textContent = ''; $('#acts').replaceChildren(); bubble.classList.remove('hushing'); } }, 180);
}
bubble.onclick = (e) => {
  if (e.target.closest('button') || getSelection()?.toString().trim()) return; // buttons, or they're selecting text to copy
  if (caption.textContent.length < fullText.length) { // 1st click: finish typing instantly
    clearInterval(typeTimer); caption.textContent = fullText; jepi.classList.remove('talking'); fixBubble(); return;
  }
  done(); // 2nd click: dismiss
};

// ---------- movement + trail ----------
// every pinned frame + its title/number, in screen px (layout boxes, so the pop-in animation can't fool it)
function obstacles() {
  const out = [];
  for (const m of document.querySelectorAll('#marks .mark:not(.out)')) {
    const x = m.offsetLeft + trackOff.x, y = m.offsetTop + trackOff.y;
    out.push({ x, y, w: m.offsetWidth, h: m.offsetHeight });
    for (const c of m.children) out.push({ x: x + c.offsetLeft, y: y + c.offsetTop, w: c.offsetWidth, h: c.offsetHeight });
  }
  return out;
}
// how much of box a covers the obstacles (each grown by pad so Jepi keeps some air), in px²
const overlap = (a, list, pad = 12) => list.reduce((s, b) =>
  s + Math.max(0, Math.min(a.x + a.w, b.x + b.w + pad) - Math.max(a.x, b.x - pad)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h + pad) - Math.max(a.y, b.y - pad)), 0);
const offscreen = (a) => Math.max(0, -a.x) + Math.max(0, a.x + a.w - innerWidth) + Math.max(0, -a.y) + Math.max(0, a.y + a.h - innerHeight);

function fixBubble() {
  // extend away from the problem: target on the left -> bubble grows right, and vice versa
  let left = jepi.classList.contains('pointL') ? true : jepi.classList.contains('pointR') ? false : pos.x < 240;
  const bw = bubble.offsetWidth || 260, bh = bubble.offsetHeight || 60;
  if (left && pos.x + bw > innerWidth) left = false;
  if (!left && pos.x + W - bw < 0) left = true;
  let below = pos.y < bh + 24;
  const obs = $('#marks').children.length ? obstacles() : [];
  if (obs.length) [, left, below] = bubbleSpot(pos.x, pos.y, bw, bh, obs, left, below); // never cover a frame or its title
  bubble.classList.toggle('left', left);
  bubble.classList.toggle('below', below);
}
// best of the bubble's 4 corners for Jepi at (x, y) → [cost, left, below]; the preferred corner wins ties
function bubbleSpot(x, y, bw, bh, obs, left = true, below = false) {
  const box = (l, b) => ({ x: l ? x + 4 : x + W - 4 - bw, y: b ? y + H + 14 : y - 14 - bh, w: bw, h: bh });
  return [[left, below], [!left, below], [left, !below], [!left, !below]]
    .map(([l, b]) => [overlap(box(l, b), obs, 6) + offscreen(box(l, b)) * 1e5, l, b])
    .reduce((a, c) => (c[0] < a[0] ? c : a));
}
function place(x, y) {
  pos = { x: Math.round(x), y: Math.round(y) };
  buddy.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  if (!jepi.classList.contains('flying')) fixBubble(); // mid-flight: no layout reads every frame (flyTo fixes it on landing)
}
let rainbowHue = 0;
function trail(x, y) {
  const t = outfit.trail;
  if (t === 'none' || (LITE && Math.random() < 0.5)) return;
  const p = document.createElement('div');
  p.className = 'particle';
  if (t === 'crumbs') {
    p.className = 'particle crumb';
    p.style.background = pick(['#f2b25c', '#ffd79a', '#e8384f', '#c98a3a']);
    p.style.setProperty('--dx', Math.random() * 20 - 10 + 'px');
  } else if (t === 'six7') { p.classList.add('txt'); p.textContent = pick(['6', '7']); p.style.color = pick(['#f7c948', '#f0717f', '#6fe0c8']); }
  else if (t === 'rainbow') { Object.assign(p.style, { width: '12px', height: '12px', background: `hsl(${(rainbowHue += 30) % 360} 90% 60%)` }); }
  else if (TRAIL_ART[t]) p.append(miniSprite(TRAIL_ART[t]));
  else p.append(miniSprite(TRAIL_ART.sparkles));
  Object.assign(p.style, { left: x + Math.random() * 16 - 8 + 'px', top: y + Math.random() * 16 - 8 + 'px' });
  $('#fx').append(p);
  setTimeout(() => p.remove(), 1000);
}
function flyTo(tx, ty, maxDur = 1400) {
  tx = clamp(tx, 6, innerWidth - W - 6);
  ty = clamp(ty, 6, innerHeight - H - 6);
  return new Promise((done) => {
    const sx = pos.x, sy = pos.y, dist = Math.hypot(tx - sx, ty - sy), dur = Math.min(maxDur, 450 + dist * 0.9);
    if (dist < 4) { place(tx, ty); return done(); }
    const t0 = performance.now();
    let lastP = 0;
    closeMenu();
    closeWish();
    jepi.classList.add('flying');
    jepi.classList.toggle('flyL', tx < sx);
    const id = ++flightId; // a newer flight cancels this one
    const step = (now) => {
      if (id !== flightId) return done();
      const k = Math.min(1, (now - t0) / dur), e = (1 - Math.cos(Math.PI * k)) / 2; // smooth sine ease
      place(sx + (tx - sx) * e, sy + (ty - sy) * e - Math.sin(Math.PI * k) * Math.min(80, dist * 0.25));
      if (now - lastP > 28) { lastP = now; trail(pos.x + W / 2, pos.y + H * 0.6); }
      if (k < 1) requestAnimationFrame(step);
      else { jepi.classList.remove('flying'); fixBubble(); done(); }
    };
    requestAnimationFrame(step);
  });
}
let homeIsCorner = true; // until they drag Jepi somewhere
const defaultHome = () => ({ x: innerWidth - W - 28, y: innerHeight - H - 28 });


// ---------- pinpoints ----------
function clearMarks(stopTracking = true) { // fade pins + glove out instead of popping them away
  if (pointerTimer) {
    clearInterval(pointerTimer);
    pointerTimer = null;
  }
  trackOff = { x: 0, y: 0 };
  if (stopTracking) api.unpin?.(); // NOT when we're just replacing pins (main already tracks the new ones)
  const old = [...$('#marks').children];
  old.forEach((n) => n.classList.add('out'));
  setTimeout(() => old.forEach((n) => n.remove()), 220);
  if (pointer.classList.contains('on')) {
    pointer.classList.add('out');
    setTimeout(() => { if (pointer.classList.contains('out')) pointer.className = ''; }, 220);
  }
}
// glove slides out of Jepi's hand, then taps the problem from above (or below if it's at the top edge)
function showPointer(r) {
  // point where the text STARTS (left end of the box); the label sits at the right end so they never collide
  const tipX = r.left + Math.min(28, r.width / 2), down = r.top > 70;
  if (!pointer.classList.contains('on')) { // first time: start in Jepi's hand
    pointer.style.transition = 'none';
    Object.assign(pointer.style, { left: pos.x + 'px', top: pos.y + H * 0.4 + 'px' });
    void pointer.offsetWidth;
    pointer.style.transition = '';
  }
  pointer.className = 'on' + (down ? ' down' : ''); // (also cancels a pending fade-out)
  Object.assign(pointer.style, down
    ? { left: tipX - 22 + 'px', top: r.top - 50 + 'px' }
    : { left: tipX - 13 + 'px', top: r.top + r.height + 2 + 'px' });
  setTimeout(() => pointer.classList.add('tap'), 460);
}
function done() { hush(); goHome(); cozy(false); } // the user confirmed: clear everything
function goHome() {
  clearMarks();
  jepi.classList.remove('pointL', 'pointR');
  if (!parked) return;
  parked = false;
  flyTo(home.x, home.y);
}
function showTargets({ targets = [], display, win: w }) {
  clearMarks(false);
  $('#marks').style.transform = pointer.style.transform = '';
  const d = display || { x: 0, y: 0, width: innerWidth, height: innerHeight };
  const winPos = w || { x: 0, y: 0 };
  const rects = [];

  for (let i = 0; i < targets.length; i++) {
    const tg = targets[i];
    if (!tg || !Array.isArray(tg.box_2d) || tg.box_2d.length < 4) continue;
    let [y0, x0, y1, x1] = tg.box_2d.map((v) => clamp(Number(v) || 0, 0, 1000) / 1000);
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (x1 < x0) [x0, x1] = [x1, x0];
    const pad = 6;
    const left = Math.max(4, d.x + x0 * d.width - winPos.x - pad);
    const top = Math.max(4, d.y + y0 * d.height - winPos.y - pad);
    const width = Math.min(innerWidth - left - 4, Math.max(24, (x1 - x0) * d.width + pad * 2));
    const height = Math.min(innerHeight - top - 4, Math.max(24, (y1 - y0) * d.height + pad * 2));

    const m = document.createElement('div');
    m.className = 'mark' + (top < 50 ? ' below' : '');
    Object.assign(m.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px', animationDelay: i * 0.15 + 's' });
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = tg.label || 'here 👀';
    m.append(tag);
    if (targets.length > 1) {
      const n = document.createElement('span');
      n.className = 'num';
      n.textContent = i + 1;
      m.append(n);
    }
    $('#marks').append(m);
    rects.push({ left, top, width, height });
  }
  return rects;
}
async function parkBy(r) {
  r = { ...r, left: r.left + trackOff.x, top: r.top + trackOff.y }; // follow the content if it scrolled
  // closest spot (beside, above or below, stepping outward past neighbours) that covers NO frame or title
  const obs = obstacles(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, hand = cy - H * 0.66, spots = [];
  for (let d = 12; d < 400; d += 24) {
    spots.push([r.left + r.width + d, hand], [r.left - W - d, hand], [cx - W / 2, r.top - H - 30 - d], [cx - W / 2, r.top + r.height + d],
      [r.left + r.width + d, r.top - H - d], [r.left - W - d, r.top + r.height + d]);
  }
  // crowded page (card grids)? also try the whole screen on a coarse grid, so Jepi finds the nearest free gap
  // grid step grows with the screen so a 4K display is ~2.5k spots, not 9k
  const step = Math.max(30, Math.round(Math.sqrt((innerWidth * innerHeight) / 2500)));
  for (let y = 6; y < innerHeight - H; y += step) for (let x = 6; x < innerWidth - W; x += step) spots.push([x, y]);
  const fit = ([x, y]) => [clamp(x, 6, innerWidth - W - 6), clamp(y, 6, innerHeight - H - 6)]; // flyTo clamps the same way
  const bw = Math.max(bubble.offsetWidth, 300), bh = Math.max(bubble.offsetHeight, 130); // room for the answer bubble too
  // cost = overlap penalties + distance, so a spot farther than the best so far can't win: skip its overlap math
  let best = null, bestCost = Infinity;
  for (const s of spots) {
    const [x, y] = fit(s), dist = Math.hypot(x + W / 2 - cx, y + H / 2 - cy);
    if (dist >= bestCost) continue;
    const c = dist + overlap({ x, y, w: W, h: H }, obs) * 50 + bubbleSpot(x, y, bw, bh, obs)[0] * 5;
    if (c < bestCost) { bestCost = c; best = [x, y]; }
  }
  const [x, y] = best;
  const side = x + W / 2 >= cx ? 'pointL' : 'pointR';
  jepi.classList.remove('pointL', 'pointR');
  await flyTo(x, y); // hand lands level with the problem when there's room beside it
  jepi.classList.add(side);
  parked = true;
}

// ---------- looking ----------
async function look(question = '', m = 'help', context = '', region = null) {
  if (busy || hidden) return; // never peek while Jepi is hidden
  if (asleep) return say('zzz… 😴 i\'m in sleep mode, not peeking. click me → ☀️ to wake me.');
  cozy(SIMPLE_ASK.test(question)); // asked for it simple? cozy grandma beanie on
  wake();
  tipsOff = true; // any real use cancels the first-run tips
  busy = true;
  $('#lookBtn').disabled = true;
  clearMarks();
  $('#pickmark').hidden = !region; // keep showing the box they asked about while thinking
  setMood('thinking');
  say(pick(serious() ? STUDY_THINKING : THINKING), 'thinking', 0);
  jepi.classList.add('peeking');
  sfx('scan');
  const res = await api.look({ question, mode: m, persona, context, region });
  $('#pickmark').hidden = true;
  jepi.classList.remove('peeking');
  busy = false;
  $('#lookBtn').disabled = false;
  if (res.error) { setMood('shook', 3000); sfx('bonk'); return say(`i crashed out 💀 ${res.error}`, 'err'); }
  present(res, question);
}
// show an answer: fly, pin, point, caption + buttons
async function present(res, question = '') {
  addAura(res.aura);
  if (res.screenChanged) res.reply += '\n(you switched screens while i was thinking, so no pins 👀)';
  const rects = res.targets?.length ? showTargets(res) : [];
  if (rects.length) {
    say('on my way 💨');
    sfx('whoosh');
    await parkBy(rects[0]);
    showPointer(rects[0]);
    if (rects.length > 1 && res.targets.some((t) => t.note)) return startTour(res, rects); // "explain line by line"
    let i = 0; // glove tours every problem, one after another
    if (rects.length > 1) pointerTimer = setInterval(() => showPointer(rects[++i % rects.length]), 3000);
  } else goHome();
  sfx('ding');
  setMood(res.mood, 8000);
  lastReply = res.reply;
  if (res.clean) { // double-tap code check found nothing wrong
    return say(`${res.reply || 'no errors, your code looks perfect ✨'}${res.tip ? `\n⚡ ${res.tip}` : ''}\nwant me to explain how it works?`, '', 0,
      [['🧭 yes, explain it', () => look('Explain how this code works, line by line / step by step.')], ['no thanks', done]]);
  }
  const actions = [];
  if (res.edit?.find && res.edit.replace !== res.edit.find) actions.push(['🛠 apply fix', () => confirmFix(res)]);
  if (res.fix) actions.push(['📋 copy fix', () => { api.copy(res.fix); sfx('copy'); setMood('hype', 1200); say('copied ✅ paste it in, twin', '', 4000); }]);
  actions.push(['🧒 explain simply', () => explainSimply(res.reply + (res.tip ? `\nTip: ${res.tip}` : '') + (res.fix ? `\nFix: ${res.fix}` : ''))]);
  actions.push(['↩ ask more', () => { followUp = true; openWish(); }]);
  actions.push(['✓ got it', done]);
  say(res.reply + (res.tip ? `\n⚡ ${res.tip}` : ''), '', 0, actions); // stays until they confirm
}

// ---------- wardrobe + personas ----------
function equip(slot, name, persist = true) {
  outfit[slot] = name;
  if (slot !== 'trail') { wear(sprite, slot, name); wear($('#spriteBack'), slot, name); }
  document.querySelectorAll(`.opts[data-slot="${slot}"] .chip`).forEach((c) => c.setAttribute('aria-checked', c.dataset.name === name));
  if (persist) save('jepi-outfit', outfit);
}
for (const [slot, opts] of Object.entries(WARDROBE)) {
  const box = document.querySelector(`.opts[data-slot="${slot}"]`);
  for (const [name, label] of Object.entries(opts)) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('role', 'radio');
    b.dataset.name = name;
    const [icon, ...rest] = label.split(' ');
    b.textContent = icon;
    b.title = rest.join(' ') || name;
    b.setAttribute('aria-label', b.title);
    b.onclick = () => {
      equip(slot, name);
      jepi.classList.remove('swap'); void jepi.offsetWidth; jepi.classList.add('swap');
      if (slot === 'trail') for (let i = 0; i < 8; i++) setTimeout(() => trail(pos.x + W / 2, pos.y + H / 2), i * 40);
    };
    box.append(b);
  }
}
function setPersona(name, greet = true) {
  persona = name;
  save('jepi-persona', name);
  $('#personaBtn .ic').textContent = PERSONAS[name].emoji;
  $('#personaName').textContent = PERSONA_NAMES[name] || name;
  document.body.classList.toggle('serious', serious());
  document.querySelectorAll('#personas .chip').forEach((c) => c.setAttribute('aria-checked', c.dataset.persona === name));
  if (greet) { // a new persona comes with its signature fit (still customizable after)
    outfit = { ...PERSONAS[name].outfit };
    save('jepi-outfit', outfit);
    jepi.classList.remove('swap'); void jepi.offsetWidth; jepi.classList.add('swap');
    setMood('hype', 2200);
    say(PERSONAS[name].hello);
  }
  for (const s of Object.keys(WARDROBE)) equip(s, outfit[s], false);
}
document.querySelectorAll('#personas .chip').forEach((c) => (c.onclick = () => setPersona(c.dataset.persona)));
function togglePanel(id, btn) {
  for (const [pid, bid] of [['personas', 'personaBtn'], ['closet', 'closetBtn']]) {
    const open = pid === id && $('#' + pid).hidden;
    $('#' + pid).hidden = !open;
    $('#' + bid).setAttribute('aria-expanded', open);
  }
  placeMenu();
}
// the controls are a little pop-up menu beside Jepi (click Jepi to open)
function placeMenu() {
  const r = { width: dock.offsetWidth, height: dock.offsetHeight }; // offset* ignores the pop-in scale
  const left = pos.x - r.width - 12 > 8 ? pos.x - r.width - 12 : pos.x + W + 12;
  Object.assign(dock.style, { left: clamp(left, 8, innerWidth - r.width - 8) + 'px', top: clamp(pos.y + H - r.height, 8, innerHeight - r.height - 8) + 'px' });
}
function openMenu() {
  for (const [pid, bid] of [['personas', 'personaBtn'], ['closet', 'closetBtn']]) { $('#' + pid).hidden = true; $('#' + bid).setAttribute('aria-expanded', false); }
  closeWish();
  caption.textContent = '';
  dock.classList.add('open');
  placeMenu();
  syncMouse();
}
function closeMenu() { dock.classList.remove('open'); syncMouse(); }
function toggleMenu() { dock.classList.contains('open') ? closeMenu() : openMenu(); }
function openWish() {
  tipsOff = true;
  closeMenu();
  wish.classList.add('open');
  const ww = wish.offsetWidth || 300, left = pos.x - ww - 12 > 8 ? pos.x - ww - 12 : pos.x + W + 12; // fully on screen, ➜ always clickable
  Object.assign(wish.style, { left: clamp(left, 8, innerWidth - ww - 8) + 'px', top: clamp(pos.y + H / 2 - 23, 8, innerHeight - 54) + 'px' });
  syncMouse();
  input.focus();
}
function closeWish() {
  wish.classList.remove('open');
  input.blur();
  input.placeholder = keys('make a wish… ✨');
  syncMouse();
}
$('#personaBtn').onclick = () => togglePanel('personas');
$('#closetBtn').onclick = () => togglePanel('closet');
$('#quitBtn').onclick = () => api.quit();
$('#lookBtn').onclick = () => { closeMenu(); look(); };
$('#wishBtn').onclick = () => { openWish(); say('spill it, twin. what\'s your wish? 🧞', '', 0); };


$('#askForm').onsubmit = (e) => {
  e.preventDefault();
  const q = input.value.trim();
  input.value = '';
  if (!q && !pickRegion) { input.focus(); return say('type a question first ✨ or tap 🎯 to box an area', '', 4000); }
  const ctx = followUp ? lastReply : '', region = pickRegion, pasted = pasteMode;
  followUp = pasteMode = false;
  pickRegion = null;
  closeWish();
  if (/^\s*(6\s*[-.,]?\s*7|six\s*-?\s*seven|sixty\s*-?\s*seven)\s*[!?.🤲]*\s*$/i.test(q)) return go67(); // the easter egg
  if (q && (pasted || CRASH.test(q))) return look(`I copied this error. Explain the cause and the exact fix, and point at where it happens if it's visible on screen:\n${q}`, 'help', ctx, region);
  look(q || 'what is this / what\'s wrong here?', 'help', ctx, region);
};

// ---------- poke + drag ----------
function poke() {
  tipsOff = true;
  wake();
  setMood('shook', 1200);
  sfx('pop');
  say(pick(PERSONAS[persona].pokes));
  addAura(-1);
}
jepi.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); } };
jepi.onpointerdown = (e) => {
  if (e.button !== 0) return; // left button only (right/middle clicks shouldn't drag or open the menu)
  const start = { ...pos }, sx = e.clientX, sy = e.clientY;
  let dragged = false, lastP = 0;
  jepi.setPointerCapture(e.pointerId);
  jepi.onpointermove = (ev) => {
    if (!dragged && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    dragged = true;
    place(clamp(start.x + ev.clientX - sx, 0, innerWidth - W), clamp(start.y + ev.clientY - sy, 0, innerHeight - H));
    if (ev.timeStamp - lastP > 50) { lastP = ev.timeStamp; trail(pos.x + W / 2, pos.y + H * 0.55); }
  };
  jepi.onpointerup = () => {
    jepi.onpointermove = jepi.onpointerup = null;
    wake();
    if (!dragged) return tap();
    if (!parked) { home = { ...pos }; homeIsCorner = false; }
    if (dock.classList.contains('open')) placeMenu();
  };
};

// who gets the mouse? ONE rule, checked against what's really under the cursor (enter/leave events are unreliable:
// they don't fire when the menu closes under the pointer). Jepi catches clicks only over its own UI or while you're
// boxing an area with 🎯; everywhere else clicks pass straight through to your apps.
function syncMouse() {
  const over = !!document.elementFromPoint(mouse.x, mouse.y)?.closest('#buddy, #dock, #askForm, #picker');
  const want = over || picking;
  if (want !== catching) { catching = want; api.clickThrough(!want); }
}
let mouseFrame = 0;
document.addEventListener('mousemove', (e) => {
  mouse = { x: e.clientX, y: e.clientY };
  if (!mouseFrame) mouseFrame = requestAnimationFrame(() => { mouseFrame = 0; syncMouse(); });
});
input.onblur = () => { if (!input.value.trim()) setTimeout(closeWish, 150); };
input.onkeydown = (e) => { if (e.key === 'Escape') closeWish(); };

function setHidden(h) {
  hidden = h;
  buddy.classList.toggle('hide', h);
  if (h) { closeMenu(); closeWish(); }
  if (!h) summon();
}
api.onHotkey(async (k) => {
  if (k === 'look') { if (hidden) { setHidden(false); await wait(2900); } closeMenu(); look(); }
  if (k === 'ask') { if (hidden) setHidden(false); openWish(); say('spill it, twin. what do you need? 👂'); }
  if (k === 'hide') setHidden(!hidden);
  if (k === 'clear') done();
  if (k === 'stale') goHome(); // the pinned content scrolled/changed: pin is outdated
  if (k === 'moved') { parked = false; clearMarks(); quickSpin(); }
  if (k === 'space' && !hidden) { // switched macOS desktop: quick spin
    clearMarks();
    jepi.classList.remove('pointL', 'pointR');
    parked = false;
    quickSpin();
  }
  if (k === 'demo') { if (hidden) setHidden(false); runDemo(); }
});



// overlay hopped to another monitor (or resized): re-home Jepi in that screen's corner
addEventListener('resize', () => {
  const keep = (p) => ({ x: clamp(p.x, 6, innerWidth - W - 6), y: clamp(p.y, 6, innerHeight - H - 6) });
  home = homeIsCorner ? defaultHome() : keep(home);
  const n = keep(pos);
  if (n.x !== pos.x || n.y !== pos.y) flyTo(n.x, n.y); // only nudge back if it ended up off-screen
});

