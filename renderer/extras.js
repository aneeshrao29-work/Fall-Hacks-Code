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
function setAsleep(on) {
  asleep = on;
  $('#sleepBtn').textContent = on ? '☀️' : '😴';
  $('#sleepBtn').title = on ? 'wake up (start peeking again)' : 'sleep mode: no peeking';
  if (on) { setWatch(false); goHome(); doze(true); sfx('snore'); say('sleep mode 😴 i won\'t look at your screen until you wake me.', '', 6000); }
  else { dozing = true; wake(); if (mode === 'watch') setWatch(true); }
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
$('#muteBtn').onclick = () => { muted = !muted; save('jepi-muted', muted); $('#muteBtn').textContent = muted ? '🔇' : '🔊'; sfx('pop'); };
$('#muteBtn').textContent = muted ? '🔇' : '🔊';
document.addEventListener('keydown', (e) => { // Esc closes everything
  if (e.key !== 'Escape') return;
  closeMenu(); closeWish(); hush(); goHome();
});

// Linux: no forwarded mouse moves, so main streams the cursor; toggle click-through + eye-follow from it
let overUI = false;
api.onCursor?.(({ x = 0, y = 0 } = {}) => {
  const inside = !!document.elementFromPoint(x, y)?.closest('#buddy, #dock, #askForm');
  if (inside !== overUI) { overUI = inside; hovering = inside ? 1 : 0; if (document.activeElement !== input) api.clickThrough(!inside); }
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }));
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
  buddy.classList.add('away');
  for (let i = 0; i < (LITE ? 35 : 90); i++) setTimeout(() => { // full-screen number storm
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
  for (let k = 0; k < 6; k++) await flyTo(Math.random() * (innerWidth - W), Math.random() * (innerHeight - H), 420);
  await flyTo(start.x, start.y, 600);
  outfit.trail = keep;
  document.body.classList.remove('crazy67');
  buddy.classList.remove('away');
  setMood('hype', 1500);
  going67 = false;
}

// 🐞 one-click code check
$('#quickBtn').onclick = (e) => { e.stopPropagation(); closeMenu(); look('', 'code'); };

// apply Jepi's fix to the real file, but only after the user confirms the exact change
function confirmFix(res) {
  const { edit } = res;
  clearTimeout(dismissTimer); // stay put while they decide
  setMood('thinking');
  say(`change this in ${edit.file || 'your file'}?`, '', 0, [
    ['✅ apply', async () => {
      say('applying… 🛠', 'thinking', 0);
      const r = await api.applyFix(edit);
      if (r.ok) {
        sfx('ding'); setMood('hype', 1500);
        say(`fixed ✅ ${r.file} updated (your editor should reload it)`, '', 12000, [['↩ undo', async () => {
          const u = await api.undoFix();
          say(u.ok ? `undone ↩ ${u.file} is back to how it was` : `can't undo: ${u.error}`, u.ok ? '' : 'err', 6000);
        }]]);
        dismissTimer = setTimeout(goHome, 12000);
      } else {
        sfx('bonk'); setMood('shook', 2000);
        say(`couldn't apply 😬 ${r.error}`, 'err', 10000, res.fix ? [['📋 copy fix instead', () => { api.copy(res.fix); sfx('copy'); say('copied ✅ paste it in', '', 4000); }]] : []);
      }
    }],
    ['✖ cancel', () => { setMood('idle'); say('ok, not touching it 👍', '', 3000); dismissTimer = setTimeout(goHome, 4000); }],
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
  clearTimeout(dismissTimer); // still reading/scrolling: keep the pin a bit longer
  dismissTimer = setTimeout(goHome, 15000);
});

// shortcut hints in titles/placeholders follow the OS too
document.querySelectorAll('[title]').forEach((el) => (el.title = keys(el.title)));
input.placeholder = keys(input.placeholder);

// boot
setPersona(persona, false);
home = defaultHome();
place(home.x, home.y);
summon().then(tips);
