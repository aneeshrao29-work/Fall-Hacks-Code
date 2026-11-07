const $ = (s) => document.querySelector(s);
// stub so the page still renders in a normal browser for design work
const api = window.jepiAPI || {
  look: async () => ({ error: 'open me with npm start, twin' }),
  clickThrough() {},
  quit() {},
  copy() {},
  unpin() {},
  applyFix: async () => ({ error: 'not running in electron' }),
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
let hushTimer = null, mode = 'help', busy = false, aura = 0, watchTimer = null, moodTimer = null, typeTimer = null, dismissTimer = null;
let flightId = 0, pos = { x: 0, y: 0 }, home = null, parked = false, hovering = 0, hidden = false;
let trackOff = { x: 0, y: 0 }, tipsOff = false, lastReply = '', followUp = false, pointerTimer = null, clickTimer = null, asleep = false, dozing = false, lastActive = Date.now();

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let persona = PERSONAS[load('jepi-persona')] ? load('jepi-persona') : 'bestie';
let outfit = { ...PERSONAS[persona].outfit, ...load('jepi-outfit', {}) };
muted = load('jepi-muted', false);

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
  text = keys(text);
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
bubble.onclick = () => { hush(); if (parked) goHome(); }; // click the bubble = dismiss
function banner(text) {
  const b = $('#banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('show'), 2200);
}
function addAura(n) {
  aura += n;
  const el = $('#aura');
  $('#auraVal').textContent = (aura > 0 ? '+' : '') + aura;
  el.classList.toggle('pos', aura > 0);
  el.classList.toggle('neg', aura < 0);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  if (aura >= 67) banner(`AURA FARMING 🔥 +${aura}`);
  else if (aura <= -67) banner(`YOU'RE COOKED 💀 ${aura}`);
  else if (Math.abs(n) >= 30) banner(`${n > 0 ? '+' : ''}${n} aura ${n > 0 ? '✨' : '📉'}`);
}

// ---------- movement + trail ----------
function fixBubble() {
  // extend away from the problem: target on the left -> bubble grows right, and vice versa
  let left = jepi.classList.contains('pointL') ? true : jepi.classList.contains('pointR') ? false : pos.x < 240;
  if (left && pos.x + 236 > innerWidth) left = false;
  if (!left && pos.x + W - 236 < 0) left = true;
  bubble.classList.toggle('left', left);
  bubble.classList.toggle('below', pos.y < bubble.offsetHeight + 24);
}
function place(x, y) {
  pos = { x: Math.round(x), y: Math.round(y) };
  buddy.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  fixBubble();
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
      else { jepi.classList.remove('flying'); done(); }
    };
    requestAnimationFrame(step);
  });
}
const defaultHome = () => ({ x: innerWidth - W - 28, y: innerHeight - H - 28 });

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
  const tipX = r.width > 120 ? r.left + r.width - 34 : r.left + r.width / 2, down = r.top > 70; // stay clear of the label
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
function goHome() {
  buddy.classList.remove('away');
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
  let x, side;
  if (r.left + r.width + 14 + W < innerWidth) { x = r.left + r.width + 12; side = 'pointL'; }
  else if (r.left - W - 12 > 0) { x = r.left - W - 12; side = 'pointR'; }
  else { x = r.left + r.width / 2 - W / 2; side = 'pointL'; }
  jepi.classList.remove('pointL', 'pointR');
  buddy.classList.add('away');
  await flyTo(x, r.top + r.height / 2 - H * 0.66); // hand lands level with the problem
  jepi.classList.add(side);
  parked = true;
}

// ---------- looking ----------
async function look(question = '', m = mode === 'watch' ? 'help' : mode, context = '') {
  if (busy || hidden) return; // never peek while Jepi is hidden
  if (asleep) { if (m !== 'watch') say('zzz… 😴 i\'m in sleep mode, not peeking. click me → 😴 to wake me.'); return; }
  wake();
  tipsOff = true; // any real use cancels the first-run tips
  busy = true;
  buddy.classList.add('away');
  $('#lookBtn').disabled = true;
  clearTimeout(dismissTimer);
  clearMarks();
  setMood('thinking');
  say(pick(THINKING), 'thinking', 0);
  jepi.classList.add('peeking');
  sfx('scan');
  const res = await api.look({ question, mode: m, persona, context });
  jepi.classList.remove('peeking');
  busy = false;
  $('#lookBtn').disabled = false;
  if (!res.targets?.length) buddy.classList.remove('away');
  if (res.skip) { setMood('idle'); return hush(); } // watch mode: screen unchanged
  if (res.error) { setMood('shook', 3000); sfx('bonk'); return say(`i crashed out 💀 ${res.error}`, 'err'); }
  present(res, question);
}
// show an answer: fly, pin, point, caption + buttons
async function present(res, question = '') {
  addAura(res.aura);
  if (res.screenChanged) res.reply += '\n(you switched screens while i was thinking, so no pins 👀)';
  if (pointerTimer) {
    clearInterval(pointerTimer);
    pointerTimer = null;
  }
  if (res.targets?.length) {
    say('on my way 💨');
    sfx('whoosh');
    const rects = showTargets(res);
    if (rects.length) {
      await parkBy(rects[0]);
      showPointer(rects[0]);
      let i = 0; // glove tours every problem, one after another
      if (rects.length > 1) {
        pointerTimer = setInterval(() => showPointer(rects[++i % rects.length]), 3000);
      }
    } else {
      goHome();
    }
  } else {
    goHome();
  }
  sfx('ding');
  setMood(res.mood, 8000);
  lastReply = res.reply;
  const actions = [];
  if (res.edit?.find && res.edit.replace !== res.edit.find) actions.push(['🛠 apply fix', () => confirmFix(res)]);
  if (res.fix) actions.push(['📋 copy fix', () => { api.copy(res.fix); sfx('copy'); setMood('hype', 1200); say('copied ✅ paste it in, twin', '', 4000); }]);
  actions.push(['🧒 eli5', () => look('explain that like I\'m 5, in one short sentence', 'help', lastReply)]);
  actions.push(['↩ ask more', () => { followUp = true; openWish(); }]);
  say(res.reply + (res.tip ? `\n⚡ ${res.tip}` : ''), '', 15000, actions);
  clearTimeout(dismissTimer);
  dismissTimer = setTimeout(goHome, mode === 'watch' ? 12000 : 15000);
}
function setWatch(on) {
  clearInterval(watchTimer);
  watchTimer = on ? setInterval(() => look('', 'watch'), 45000) : null; // and main skips it if the screen didn't change
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
  $('#personaBtn').textContent = PERSONAS[name].emoji;
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
  clearTimeout(dismissTimer);
  closeWish();
  caption.textContent = '';
  dock.classList.add('open');
  placeMenu();
  api.clickThrough(false);
}
function closeMenu() { dock.classList.remove('open'); if (!hovering) api.clickThrough(true); }
function toggleMenu() { dock.classList.contains('open') ? closeMenu() : openMenu(); }
function openWish() {
  clearTimeout(dismissTimer);
  tipsOff = true;
  closeMenu();
  wish.classList.add('open');
  const left = pos.x - 262 > 8 ? pos.x - 262 : pos.x + W + 12;
  Object.assign(wish.style, { left: clamp(left, 8, innerWidth - 258) + 'px', top: clamp(pos.y + H / 2 - 23, 8, innerHeight - 54) + 'px' });
  api.clickThrough(false);
  input.focus();
}
function closeWish() { wish.classList.remove('open'); input.blur(); if (!hovering) api.clickThrough(true); }
$('#personaBtn').onclick = () => togglePanel('personas');
$('#closetBtn').onclick = () => togglePanel('closet');
$('#quitBtn').onclick = () => api.quit();
$('#lookBtn').onclick = () => { closeMenu(); look(); };
$('#wishBtn').onclick = () => { openWish(); say('spill it, twin. what\'s your wish? 🧞', '', 0); };

document.querySelectorAll('.seg .ico').forEach((p) => (p.onclick = () => {
  document.querySelectorAll('.seg .ico').forEach((x) => { x.classList.toggle('on', x === p); x.setAttribute('aria-checked', x === p); });
  mode = p.dataset.mode;
  setWatch(mode === 'watch');
  if (mode === 'watch') { say('ok i\'m watching 👁️👄👁️ i peek every 45s (only if your screen changed).'); look('', 'watch'); }
  if (mode === 'roast') { setMood('judging', 2500); say('roast mode 🔥 hit 👀 if you\'re brave enough, twin.'); }
  if (mode === 'help') say('help mode 🤓 hit 👀 and i\'ll fly to what\'s wrong.');
}));

$('#askForm').onsubmit = (e) => {
  e.preventDefault();
  const q = input.value.trim();
  input.value = '';
  const ctx = followUp ? lastReply : '';
  followUp = false;
  closeWish();
  if (/^\s*(6\s*[-.,]?\s*7|six\s*-?\s*seven|sixty\s*-?\s*seven)\s*[!?.🤲]*\s*$/i.test(q)) return go67(); // the easter egg
  if (q) look(q, mode === 'watch' ? 'help' : mode, ctx);
};

// ---------- poke + drag ----------
function poke() {
  clearTimeout(dismissTimer);
  tipsOff = true;
  wake();
  setMood('shook', 1200);
  sfx('pop');
  say(pick(PERSONAS[persona].pokes));
  addAura(-1);
}
jepi.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); } };
jepi.ondblclick = () => { clearTimeout(clickTimer); closeMenu(); poke(); };
jepi.onpointerdown = (e) => {
  clearTimeout(dismissTimer);
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
    if (!dragged) { clearTimeout(clickTimer); clickTimer = setTimeout(toggleMenu, 250); return; } // wait: maybe it's a double-click
    if (!parked) home = { ...pos };
    if (dock.classList.contains('open')) placeMenu();
  };
};

// click-through everywhere except over Jepi / the dock (or while typing)
for (const el of [buddy, dock, wish]) {
  el.onmouseenter = () => { hovering++; api.clickThrough(false); };
  el.onmouseleave = () => { hovering = Math.max(0, hovering - 1); if (!hovering && document.activeElement !== input) api.clickThrough(true); };
}
input.onblur = () => { if (!input.value.trim()) setTimeout(closeWish, 150); else if (!hovering) api.clickThrough(true); };
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
  if (k === 'clear') goHome();
  if (k === 'stale') goHome(); // the pinned content scrolled/changed: pin is outdated
  if (k === 'moved') { parked = false; clearMarks(); quickSpin('new screen who dis 👀'); }
  if (k === 'space' && !hidden) { // switched macOS desktop: quick spin
    clearMarks();
    jepi.classList.remove('pointL', 'pointR');
    parked = false;
    quickSpin(pick(['new desktop who dis 👀', 'u can\'t escape me twin 🧞', 'followed you 🌀']));
    if (mode === 'watch') setTimeout(() => look('', 'watch'), 1400);
  }
  if (k === 'demo') { if (hidden) setHidden(false); runDemo(); }
});

// 6 then 7 = 6-7
let lastKey = '', lastAt = 0;
document.addEventListener('keydown', (e) => {
  if (e.target === input) return;
  if (e.key === '7' && lastKey === '6' && Date.now() - lastAt < 1200) go67();
  lastKey = e.key; lastAt = Date.now();
});

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

// overlay hopped to another monitor (or resized): re-home Jepi in that screen's corner
addEventListener('resize', () => {
  const keep = (p) => ({ x: clamp(p.x, 6, innerWidth - W - 6), y: clamp(p.y, 6, innerHeight - H - 6) });
  home = keep(home);
  const n = keep(pos);
  if (n.x !== pos.x || n.y !== pos.y) flyTo(n.x, n.y); // only nudge back if it ended up off-screen
});

