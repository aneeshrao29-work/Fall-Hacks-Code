// End-to-end tests: boots the REAL app (main.js + renderer) with Gemini faked. Run: npx electron tests/e2e.js
// Fails on any JavaScript error (renderer console or main process) and on any broken flow.
// Uses temp settings/Downloads folders, so it never touches your real Jepi settings or files.
const { app, BrowserWindow, globalShortcut } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jepi-e2e-'));
for (const d of ['user', 'dl', 'proj/src']) fs.mkdirSync(path.join(tmp, d), { recursive: true });
app.setPath('userData', path.join(tmp, 'user'));
app.setPath('downloads', path.join(tmp, 'dl'));
process.env.GEMINI_API_KEY = 'test-key'; // never use a real key in tests
process.env.GEMINI_MODEL = '';

// ---------- fake Gemini ----------
const calls = [];
let queue = [];
const answer = (o = {}) => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: JSON.stringify({
  reply: 'stub answer', fix: '', tip: '', clean: false, edit: { file: '', find: '', replace: '' }, mood: 'sassy', aura: 1, targets: [], ...o }) }] } }] } });
const reply = (...r) => { queue = r; };
global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  calls.push({ model: url.split('/models/')[1].split(':')[0], system: body.systemInstruction.parts[0].text,
    text: body.contents[0].parts.filter((p) => p.text).map((p) => p.text).join('\n'), pdf: body.contents[0].parts.some((p) => p.inline_data?.mime_type === 'application/pdf') });
  const next = queue.shift() || answer();
  await new Promise((r) => setTimeout(r, next.delay || 50));
  return { ok: next.status === 200, status: next.status, json: async () => { if (next.raw) throw new SyntaxError('bad json'); return next.json || {}; } };
};

// ---------- error capture ----------
const errors = [];
process.on('uncaughtException', (e) => errors.push(`main: ${e.message}`));
process.on('unhandledRejection', (e) => errors.push(`main (promise): ${e?.message || e}`));
app.on('browser-window-created', (_e, w) => {
  w.webContents.on('console-message', (e, level, message) => {
    const lvl = e.level ?? level, msg = e.message ?? message;
    if ((lvl === 'error' || lvl === 3) && !/Failed to load resource/.test(msg)) errors.push(`renderer: ${msg}`);
  });
  w.webContents.on('render-process-gone', (_ev, d) => errors.push(`renderer crashed: ${d.reason}`));
});

require(path.join(__dirname, '..', 'main.js')); // the real app

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let win, js, results = [];
const ev = (type, x, y, extra = {}) => win.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), ...extra });
const jepiCenter = () => js(`(()=>{const r=jepi.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
async function taps(n, button = 'left') {
  const [x, y] = await jepiCenter();
  ev('mouseMove', x, y); await sleep(60);
  for (let k = 0; k < n; k++) { ev('mouseDown', x, y, { button, clickCount: 1 }); ev('mouseUp', x, y, { button, clickCount: 1 }); await sleep(80); }
  await sleep(500);
}
const caption = () => js('caption.textContent');
const buttons = () => js(`[...$('#acts').children].filter(b=>b.tagName==='BUTTON').map(b=>b.textContent)`);
const clickAct = (text) => js(`(()=>{const b=[...$('#acts').children].find(b=>b.textContent.includes(${JSON.stringify(text)})); if(!b) return false; b.click(); return true})()`);
const waitFor = async (expr, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expr)) return true; await sleep(100); } return false; };
const reset = () => js(`done(); closeMenu(); closeWish(); endPick(); if (asleep) setAsleep(false); busy = false; setPersona('bestie', false); hush(); 0`);
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

const ONLY = process.env.ONLY; // e.g. ONLY="clean code" npx electron tests/e2e.js
async function test(name, fn) {
  if (ONLY && !name.includes(ONLY)) return;
  const before = errors.length;
  try {
    await Promise.race([fn(), sleep(30000).then(() => { throw new Error('timed out'); })]);
    if (errors.length > before) throw new Error(`JS error: ${errors.slice(before).join(' | ')}`);
    results.push([true, name]); console.log(`  ✓ ${name}`);
  } catch (e) { results.push([false, name]); console.log(`  ✗ ${name}\n      ${e.message}`); }
  try { await reset(); await sleep(250); await waitFor(`!jepi.classList.contains('flying')`, 3000); } catch {} // let Jepi land before the next test clicks it
}

// ---------- the suite ----------
app.whenReady().then(async () => {
  while (!BrowserWindow.getAllWindows().length) await sleep(50);
  win = BrowserWindow.getAllWindows()[0];
  js = (c) => win.webContents.executeJavaScript(c);
  await new Promise((r) => (win.webContents.isLoading() ? win.webContents.once('did-finish-load', r) : r()));
  await js(`localStorage.setItem('jepi-tips','true'); 0`);
  const through = []; const setIgnore = win.setIgnoreMouseEvents.bind(win);
  win.setIgnoreMouseEvents = (on, o) => { through.push(on ? 'pass' : 'catch'); return setIgnore(on, o); };
  await sleep(4000); // pie summon
  await js(`window.__res = []; const _present = present; present = (r, q) => { window.__res.push(JSON.stringify(r).slice(0, 300)); return _present(r, q); }; 0`);

  console.log('boot');
  await test('starts with zero JavaScript errors', async () => ok(errors.length === 0, errors.join(' | ')));
  await test('all hotkeys are registered', async () => {
    for (const k of ['CommandOrControl+Shift+Space', 'CommandOrControl+Shift+A', 'CommandOrControl+Shift+H', 'CommandOrControl+Shift+X', 'CommandOrControl+Shift+Q', 'CommandOrControl+Alt+D'])
      ok(globalShortcut.isRegistered(k), `${k} not registered`);
  });
  await test('summon finished (Jepi said hello)', async () => ok(/bestie|wish/i.test(await caption()) || (await js('!jepi.classList.contains("summon")')), 'no hello'));

  console.log('mouse + taps');
  await test('hover Jepi catches clicks, empty screen passes them through', async () => {
    const [x, y] = await jepiCenter();
    ev('mouseMove', 20, 20); await sleep(150); through.length = 0;
    ev('mouseMove', x, y); await sleep(150); ok(through.includes('catch'), 'did not catch over Jepi');
    ev('mouseMove', 20, 20); await sleep(150); ok(through[through.length - 1] === 'pass', 'did not release');
  });
  await test('1 tap opens the menu (no check-code button, tip shown)', async () => {
    await taps(1);
    ok(await js(`dock.classList.contains('open')`), 'menu closed');
    ok(!(await js(`!!document.querySelector('#codeBtn, #quickBtn')`)), 'check-code button still exists');
    ok(/double-tap/.test(await js(`$('.mtip').textContent`)), 'tip missing');
  });
  await test('menu always reopens with panels closed', async () => {
    await js(`openMenu(); togglePanel('personas'); closeMenu(); openMenu(); 0`);
    ok(await js(`$('#personas').hidden && $('#closet').hidden`), 'panel stayed open');
  });
  await test('right-click does NOT open the menu', async () => { await taps(1, 'right'); ok(!(await js(`dock.classList.contains('open')`)), 'menu opened'); });
  await test('2 taps → code review with bug pinned', async () => {
    reply(answer({ reply: 'line 12 missing )', fix: 'print(x)', targets: [{ label: 'missing )', note: '', box_2d: [300, 100, 340, 500] }] }));
    calls.length = 0; await taps(2);
    ok(await waitFor(`document.querySelectorAll('#marks .mark').length === 1`), 'no pin');
    ok(/CODE REVIEW/.test(calls[0]?.text), 'did not send a code review');
    ok(await waitFor(`[...$('#acts').children].some(b=>b.textContent==='✓ got it')`), 'no got-it button');
    await sleep(700); // glove glides in
    const g = await js(`(()=>{const m=document.querySelector('#marks .mark').getBoundingClientRect(), p=pointer.getBoundingClientRect(), t=document.querySelector('#marks .tag').getBoundingClientRect();
      return { gloveCenter: p.x + p.width / 2 - m.x, boxW: m.width, tagRight: m.right - t.right }})()`);
    ok(g.gloveCenter < g.boxW * 0.25, `glove not at the start of the text (${Math.round(g.gloveCenter)}px into a ${Math.round(g.boxW)}px box)`);
    ok(Math.abs(g.tagRight) < 12, 'label not on the right end');
  });
  await test('2 taps on clean code → "perfect" + offer to explain → tour', async () => {
    reply(answer({ reply: 'no errors, your code looks perfect ✨', clean: true }),
      answer({ reply: 'it totals a cart', targets: [1, 2, 3].map((i) => ({ label: `line ${i}`, note: `step ${i}`, box_2d: [200 + i * 50, 100, 230 + i * 50, 500] })) }));
    await taps(2);
    if (!(await waitFor(`/explain how it works/.test(caption.textContent)`, 8000))) throw new Error(`no offer — said: "${await caption()}" got: ${await js('window.__res.slice(-2).join(" || ")')}`);
    ok(await clickAct('yes, explain it'), 'no explain button');
    ok(await waitFor(`/1\\/3 · step 1/.test(caption.textContent)`, 8000), 'tour did not start');
    ok(await clickAct('next'), 'no next'); ok(await waitFor(`/2\\/3/.test(caption.textContent)`, 5000), 'next failed');
    ok(await clickAct('back'), 'no back'); ok(await waitFor(`/1\\/3/.test(caption.textContent)`, 5000), 'back failed');
  });
  await test('4 taps → sleep, and the sleep message goes away by itself', async () => {
    await taps(4); ok(await waitFor(`/going to sleep/.test(caption.textContent)`), 'no sleep message');
    ok(await waitFor(`asleep && caption.textContent === ''`, 8000), `message stuck: ${await caption()}`);
  });
  await test('3 taps warns, one more puts Jepi to sleep, sleeping Jepi never looks', async () => {
    await taps(3); ok(await waitFor(`/one more/i.test(caption.textContent)`), 'no warning');
    await taps(1); await sleep(1800); ok(await js('asleep'), 'not asleep');
    calls.length = 0; await js(`look(); 0`); await sleep(600); ok(calls.length === 0, 'looked while asleep');
    await taps(2); ok(await js('asleep'), 'double-tap woke it (should not)');
    await taps(3); await sleep(300); ok(!(await js('asleep')), 'triple-tap did not wake Jepi');
    ok(await waitFor(`/up|awake/i.test(caption.textContent)`), 'no wake-up line');
  });

  console.log('answers');
  await test('answers stay until confirmed (no auto-dismiss)', async () => {
    reply(answer({ reply: 'stay please', targets: [{ label: 'x', note: '', box_2d: [300, 100, 340, 500] }] }));
    await js(`look(); 0`); await waitFor(`/stay please/.test(caption.textContent)`); await sleep(6000);
    ok(/stay please/.test(await caption()), 'bubble vanished'); // (pins may unpin on their own if the real screen behind changes)
  });
  await test('1st bubble click finishes typing, 2nd dismisses', async () => {
    await js(`say('a long sentence that takes a while to type out on the screen ok', '', 0, [['✓ got it', done]]); 0`); await sleep(60);
    await js(`bubble.click(); 0`); ok(/screen ok$/.test(await caption()), 'did not finish typing');
    await js(`bubble.click(); 0`); await sleep(300); ok((await caption()) === '', 'not dismissed');
  });
  await test('selecting text in the bubble does not dismiss it', async () => {
    await js(`say('select me please', '', 0); 0`); await sleep(600);
    await js(`getSelection().selectAllChildren(caption); bubble.click(); 0`);
    ok(/select me/.test(await caption()), 'dismissed while selecting'); await js(`getSelection().removeAllRanges(); 0`);
  });
  await test('explain simply: cozy beanie + glasses, plain-words prompt, outfit restored', async () => {
    reply(answer({ reply: 'r', fix: 'f' }), { status: 200, json: { candidates: [{ content: { parts: [{ text: '{"reply":"like a door left open"}' }] } }] } });
    await js(`look(); 0`); await waitFor(`[...$('#acts').children].some(b=>b.textContent.includes('explain simply'))`);
    calls.length = 0; await clickAct('explain simply'); ok(await waitFor(`/door left open/.test(caption.textContent)`), 'no simple answer');
    ok(/explain it simply/.test(calls[0].system), 'wrong prompt');
    ok(await js(`[...sprite.querySelectorAll('.wear')].some(g=>g.dataset.name==='beanie'&&g.style.display==='inline')`), 'no beanie');
    await clickAct('got it'); await sleep(200);
    ok(!(await js(`[...sprite.querySelectorAll('.wear')].some(g=>g.dataset.name==='beanie'&&g.style.display==='inline')`)), 'beanie stuck');
  });
  await test('asking "explain this simply" puts the beanie on', async () => {
    await js(`look('can you explain this simply'); 0`); await sleep(400);
    ok(await js(`[...sprite.querySelectorAll('.wear')].some(g=>g.dataset.name==='beanie'&&g.style.display==='inline')`), 'no beanie');
  });

  await test('find ALL: 7 matches → 7 pins + a tour through every one', async () => {
    const cars = ['Toyota Corolla', 'Honda Civic', 'Ford F-150', 'Tesla Model 3', 'Mazda CX-5', 'BMW X3', 'Kia Soul'];
    reply(answer({ reply: `7 cars: ${cars.join(', ')}`, targets: cars.map((c, i) => ({ label: c, note: `listing #${i + 1}`, box_2d: [80 + i * 110, 100, 150 + i * 110, 420] })) }));
    await js(`look('find all the makes and models of cars on this page'); 0`);
    ok(await waitFor(`document.querySelectorAll('#marks .mark').length === 7`, 8000), `pins: ${await js(`document.querySelectorAll('#marks .mark').length`)}`);
    ok(await waitFor(`caption.textContent.includes('1/7 · listing #1')`, 8000), 'tour did not start at 1/7');
    for (let k = 2; k <= 7; k++) { ok(await clickAct('next'), `no next at ${k}`); ok(await waitFor(`caption.textContent.includes('${k}/7')`, 5000), `did not reach ${k}/7`); }
    ok(!(await buttons()).some((b) => b.includes('next')), 'next shown on the last item');
  });
  await test('tour on a tight card grid: Jepi + bubble never cover a frame or its title', async () => {
    const cells = [...Array(7)].map((_, i) => [150 + Math.floor(i / 4) * 330, 50 + (i % 4) * 245]); // 4×2 grid, small gaps
    reply(answer({ reply: '7 cars', targets: cells.map(([y, x], i) => ({ label: `Car ${i + 1}`, note: `car #${i + 1}`, box_2d: [y, x, y + 280, x + 220] })) }));
    await js(`look('find all the cars'); 0`);
    const hits = `(()=>{const bad=[], me=[['jepi',jepi.getBoundingClientRect()],['bubble',bubble.getBoundingClientRect()]];
      for (const n of document.querySelectorAll('#marks .mark:not(.out), #marks .mark:not(.out) > *')) { const b=n.getBoundingClientRect();
        for (const [who,a] of me) if (a.width && a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top) bad.push(who+' on '+(n.textContent||'frame')); }
      return bad.join(', ')})()`;
    for (let k = 1; k <= 7; k++) {
      if (k > 1) ok(await clickAct('next'), `no next at ${k}`);
      ok(await waitFor(`caption.textContent.includes('${k}/7') && !jepi.classList.contains('flying')`, 10000), `did not reach ${k}/7`);
      await waitFor(`!document.getAnimations().some((a) => a.animationName === 'pinIn')`, 3000); // measure the resting frame, not the pop-in
      const bad = await js(hits);
      ok(!bad, `step ${k}: ${bad}`);
    }
  });

  console.log('point & ask + wish');
  await test('🎯 drag a box → the box reaches Gemini', async () => {
    await js(`openMenu(); 0`); await sleep(200);
    const [px, py] = await js(`(()=>{const r=$('#pickBtn').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
    ev('mouseMove', px, py); ev('mouseDown', px, py, { button: 'left', clickCount: 1 }); ev('mouseUp', px, py, { button: 'left', clickCount: 1 }); await sleep(300);
    ok(await js(`!picker.hidden`), 'picker did not open');
    ev('mouseMove', 120, 120); await sleep(150); ok(!through.slice(-1).includes('pass'), 'mouse released during pick');
    ev('mouseDown', 100, 100, { button: 'left', clickCount: 1 });
    for (let k = 1; k <= 5; k++) { ev('mouseMove', 100 + k * 60, 100 + k * 30, { button: 'left', modifiers: ['leftButtonDown'] }); await sleep(30); }
    ev('mouseUp', 400, 250, { button: 'left', clickCount: 1 }); await sleep(300);
    ok(await js(`wish.classList.contains('open') && !!pickRegion`), 'no region / ask box');
    calls.length = 0; await js(`input.value='what is this'; $('#askForm').requestSubmit(); 0`); await sleep(1200);
    ok(/boxed this part of the screen/.test(calls[0]?.text), 'region not sent');
  });
  await test('a plain click on the picker cancels silently', async () => {
    await js(`startPick(); 0`); ev('mouseDown', 300, 300, { button: 'left', clickCount: 1 }); ev('mouseUp', 300, 300, { button: 'left', clickCount: 1 }); await sleep(300);
    ok(await js(`picker.hidden && caption.textContent === ''`), 'scolded or stuck');
  });
  await test('empty ask shows a hint instead of vanishing', async () => {
    await js(`openWish(); input.value=''; $('#askForm').requestSubmit(); 0`); await sleep(400);
    ok(await js(`wish.classList.contains('open')`), 'box closed'); ok(/type a question/.test(await caption()), 'no hint');
  });
  await test('pasted error is solved as an error', async () => {
    calls.length = 0; await js(`solveCopied(); input.value='Traceback (most recent call last):\\nZeroDivisionError: division by zero'; $('#askForm').requestSubmit(); 0`); await sleep(1200);
    ok(/I copied this error/.test(calls[0]?.text) && /ZeroDivisionError/.test(calls[0]?.text), 'not sent as an error');
  });
  await test('6-7 storm runs and Esc stops it', async () => {
    await js(`openWish(); input.value='67'; $('#askForm').requestSubmit(); 0`); await sleep(700);
    ok(await js(`document.querySelectorAll('.storm67').length > 0`), 'no storm');
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); 0`); await sleep(300);
    ok(await js(`!going67 && document.querySelectorAll('.storm67').length === 0`), 'storm kept going');
  });

  console.log('gemini failures');
  await test('429 rate limit → falls back to the next model', async () => {
    reply({ status: 429, json: { error: { message: 'quota' } } }, answer({ reply: 'fallback worked' }));
    calls.length = 0; await js(`look(); 0`); ok(await waitFor(`/fallback worked/.test(caption.textContent)`), 'no answer');
    ok(calls.length === 2 && calls[0].model !== calls[1].model, 'did not switch model');
  });
  await test('every model down → friendly error, Jepi recovers', async () => {
    reply(...Array(6).fill({ status: 503, json: { error: { message: 'overloaded' } } }));
    await js(`look(); 0`); ok(await waitFor(`/crashed out/.test(caption.textContent)`), 'no error bubble');
    ok(!(await js('busy')), 'stuck busy');
    reply(answer({ reply: 'back online' })); await js(`look(); 0`); ok(await waitFor(`/back online/.test(caption.textContent)`), 'did not recover');
  });
  await test('broken JSON from Gemini → error, no crash', async () => {
    reply({ status: 200, raw: true }, ...Array(4).fill({ status: 200, raw: true }));
    await js(`look(); 0`); ok(await waitFor(`/crashed out/.test(caption.textContent)`), 'no error shown');
  });
  await test('garbage pins (huge / non-numeric) are ignored safely', async () => {
    reply(answer({ reply: 'garbage', targets: [{ label: 'a', note: '', box_2d: [0, 0, 1000, 1000] }, { label: 'b', note: '', box_2d: ['x', null, 5, 'y'] }, { label: 'c' }] }));
    await js(`look(); 0`); await waitFor(`/garbage/.test(caption.textContent)`);
    ok(await js(`document.querySelectorAll('#marks .mark:not(.out)').length === 0`), 'drew a garbage pin');
  });

  console.log('personas, syllabus, fixes');
  await test('study persona: serious, aura hidden, study voice sent', async () => {
    await js(`setPersona('study'); 0`); ok(await js(`document.body.classList.contains('serious') && getComputedStyle($('#aura')).display === 'none'`), 'not serious');
    calls.length = 0; await js(`look(); 0`); await sleep(1000); ok(/STUDY TUTOR/.test(calls[0]?.system), 'wrong voice');
  });
  await test('syllabus: PDF → deadlines → .ics, re-import does not duplicate', async () => {
    const pdf = path.join(tmp, 'outline.pdf'); fs.writeFileSync(pdf, '%PDF-1.4 fake');
    const items = [{ course: 'CMPT 225', title: 'A1', type: 'assignment', date: '2099-01-10', time: '23:59', weight: '10%' },
      { course: 'CMPT 225', title: 'Final', type: 'exam', date: '2099-04-20', time: '', weight: '40%' }];
    const syl = { status: 200, json: { candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] } }] } };
    reply(syl); const r1 = await js(`api.syllabus([${JSON.stringify(pdf)}])`);
    ok(r1.found === 2 && calls[calls.length - 1].pdf, `found ${r1.found}`);
    const ics = fs.readFileSync(path.join(tmp, 'dl', 'jepi-deadlines.ics'), 'utf8');
    ok((ics.match(/BEGIN:VEVENT/g) || []).length === 2 && ics.includes('\r\n'), 'bad .ics');
    reply(syl); const r2 = await js(`api.syllabus([${JSON.stringify(pdf)}])`); ok(r2.total === 2, `duplicated: ${r2.total}`);
  });
  await test('resume ATS: PDF + screenshot → score, breakdown, missing keywords, fixes one by one', async () => {
    const pdf = path.join(tmp, 'resume.pdf'); fs.writeFileSync(pdf, '%PDF-1.4 fake');
    const ats = { score: 140, job: 'Software Developer Intern · Acme', verdict: 'solid base, weak keywords',
      breakdown: [{ area: 'format', score: 90, note: 'clean single column' }, { area: 'keywords', score: 41, note: 'few posting keywords' }, { area: 'bogus', score: 5, note: 'x' }],
      missing: ['Docker', 'CI/CD'], suggestions: ['Add Docker to Skills', "Change 'Worked on site' → 'Built a React site for 2k users'"] };
    reply({ status: 200, json: { candidates: [{ content: { parts: [{ text: JSON.stringify(ats) }] } }] } });
    calls.length = 0;
    await js(`checkResume(${JSON.stringify(pdf)}); 0`);
    ok(await waitFor(`caption.textContent.includes('ATS score: 100/100') && caption.textContent.includes('CI/CD')`, 8000), `no/unclamped score: ${await caption()}`);
    const c = await caption();
    ok(calls[0].pdf && /ATS/.test(calls[0].system), 'resume PDF not sent');
    ok(c.includes('vs Software Developer Intern') && c.includes('Docker, CI/CD') && !c.includes('bogus'), `bad summary: ${c}`);
    ok(await clickAct('2 fixes'), 'no fixes button');
    ok(await waitFor(`caption.textContent.includes('fix 1/2') && caption.textContent.includes('Add Docker')`), 'fix 1 not shown');
    ok(await clickAct('next'), 'no next'); ok(await waitFor(`caption.textContent.includes('fix 2/2')`), 'fix 2 not shown');
    ok(!(await buttons()).some((b) => b.includes('next')), 'next on the last fix');
    const bad = path.join(tmp, 'resume.docx'); fs.writeFileSync(bad, 'x');
    await js(`hush(); checkResume(${JSON.stringify(bad)}); 0`);
    ok(await waitFor(`/export your resume as PDF/.test(caption.textContent)`), 'non-PDF not refused');
  });
  await test('audit: ask box fully on screen at the right edge; menu never runs off a short screen', async () => {
    await js(`place(innerWidth - W - 6, 300); openWish(); 0`); await sleep(250);
    ok(await js(`wish.getBoundingClientRect().right <= innerWidth && $('#askForm .go, .btn.go').getBoundingClientRect().right <= innerWidth`), 'ask box off screen');
    await js(`closeWish(); openMenu(); $('#personaBtn').click(); 0`); await sleep(300);
    ok(await js(`(()=>{const r=dock.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && dock.scrollHeight>=dock.clientHeight})()`), 'menu off screen');
    await js(`closeMenu(); place(...Object.values(defaultHome())); 0`);
  });
  await test('audit: pasted error keeps the boxed region', async () => {
    calls.length = 0; reply(answer());
    await js(`pickRegion = { x: 100, y: 100, w: 300, h: 200 }; pasteMode = true; openWish(); input.value = 'boom'; $('#askForm').requestSubmit(); 0`);
    ok(await waitFor(`!busy`, 8000) && /I copied this error/.test(calls[0]?.text) && /boxed this part of the screen/.test(calls[0]?.text), 'region dropped');
  });
  await test('apply fix edits the file (multi-line keeps indentation) and undo restores it', async () => {
    const f = path.join(tmp, 'proj/src/demo.py');
    fs.writeFileSync(f, 'def checkout(items):\n    total = 1\n    print(f"total: {total}"\n');
    fs.writeFileSync(path.join(tmp, 'user', 'jepi-settings.json'), JSON.stringify({ projectDir: path.join(tmp, 'proj') }));
    const r = await js(`api.applyFix(${JSON.stringify({ file: 'demo.py', find: 'print(f"total: {total}"', replace: 'try:\n    print(f"total: {total}")\nexcept TypeError:\n    pass' })})`);
    ok(r.ok, JSON.stringify(r));
    ok(fs.readFileSync(f, 'utf8').includes('    try:\n        print(f"total: {total}")\n    except TypeError:\n        pass'), 'indentation broken');
    ok((await js(`api.undoFix()`)).ok && fs.readFileSync(f, 'utf8').endsWith('print(f"total: {total}"\n'), 'undo failed');
  });

  console.log('robustness');
  await test('hidden Jepi never looks', async () => {
    await js(`setHidden(true); 0`); calls.length = 0; await js(`look(); 0`); await sleep(500); ok(calls.length === 0, 'looked while hidden');
    await js(`setHidden(false); 0`); await sleep(3200);
  });
  await test('stress: 25 rapid taps/menus/looks/esc → no errors, sane state', async () => {
    for (let k = 0; k < 25; k++) {
      reply(answer({ reply: `r${k}` }));
      await js(`[()=>toggleMenu(), ()=>look(), ()=>done(), ()=>openWish(), ()=>closeWish(), ()=>startPick(), ()=>endPick(), ()=>poke()][${k % 8}](); 0`);
      await sleep(40);
    }
    await sleep(2500); ok(!(await js('busy')), 'stuck busy');
  });
  await test('no JavaScript errors during the whole run', async () => ok(errors.length === 0, errors.join(' | ')));

  const failed = results.filter(([p]) => !p).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  fs.rmSync(tmp, { recursive: true, force: true });
  app.exit(failed ? 1 : 0);
});
