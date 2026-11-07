// Jepi — hovering AI sidekick. Transparent always-on-top overlay that screenshots, asks Gemini, and pinpoints.
const { app, BrowserWindow, screen, desktopCapturer, globalShortcut, ipcMain, systemPreferences, clipboard } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { MOODS, MODES, SCHEMA, buildSystem } = require('./prompts');
const { applyFix, undoFix } = require('./fixer');

// tiny .env loader (no dependency)
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}
const KEY = process.env.GEMINI_API_KEY;
// fastest accurate model first; fall back when one is overloaded / retired / slow
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite']
  .filter((m, i, a) => m && a.indexOf(m) === i);
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);
const LINUX = process.platform === 'linux';
if (LINUX) app.commandLine.appendSwitch('enable-transparent-visuals'); // transparent overlay on Linux compositors

let win, curDisplay = null, lastWatchHash = '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createWindow() {
  const d = cursorDisplay();
  curDisplay = d.id;
  win = new BrowserWindow({
    ...d.bounds, transparent: true, frame: false, resizable: false, movable: false, hasShadow: false,
    skipTaskbar: true, fullscreenable: false, enableLargerThanScreen: true, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }, // flights + 8-bit sfx
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true }); // click-through except over Jepi
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// Jepi lives on whichever monitor the cursor is on; it hops screens when you summon it there
const cursorDisplay = () => screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
function jumpToCursorDisplay() {
  const d = cursorDisplay();
  if (d.id === curDisplay) return d; // same monitor: leave Jepi exactly where it is
  curDisplay = d.id;
  win.setBounds(d.bounds);
  win.webContents.send('hotkey', 'moved');
  return d;
}

async function captureScreen(d) {
  const width = 1600, height = Math.round((width * d.size.height) / d.size.width);
  // keep Jepi + pins OUT of the screenshot without hiding them on screen: content protection excludes the window
  // from captures for ~80ms (Linux has no content protection, so it briefly hides the window instead)
  if (LINUX) win.hide(); else win.setContentProtection(true);
  await sleep(LINUX ? 250 : 80);
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    const src = sources.find((s) => s.display_id === String(d.id)) || sources[0];
    if (!src || src.thumbnail.isEmpty()) throw new Error('screen capture blocked — allow Screen Recording in System Settings');
    // tiny fingerprint of the screen so watch mode can skip when nothing changed
    const hash = crypto.createHash('md5').update(src.thumbnail.resize({ width: 64 }).toBitmap()).digest('hex');
    return { image: src.thumbnail.toJPEG(75).toString('base64'), hash, thumb: src.thumbnail };
  } finally {
    if (LINUX) win.showInactive(); else win.setContentProtection(false);
  }
}

// ---- pin tracking: the pin follows its content when you scroll; it fades out once the content is gone ----
const { toGray, makePatch, findPatch } = require('./tracker');
let staleTimer = null;
function stopStaleWatch() { clearInterval(staleTimer); staleTimer = null; }
async function grabClean(d, SW, SH) { // a frame of the real screen, with Jepi's overlay excluded
  if (!LINUX) win.setContentProtection(true);
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: SW, height: SH } });
    const src = sources.find((x) => x.display_id === String(d.id)) || sources[0];
    return src && !src.thumbnail.isEmpty() ? src.thumbnail : null;
  } finally { if (!LINUX && !win.isDestroyed()) win.setContentProtection(false); }
}
function startStaleWatch(d, base, box) {
  stopStaleWatch();
  const SW = 960, SH = Math.round((SW * d.size.height) / d.size.width), sx = d.size.width / SW, sy = d.size.height / SH, t0 = Date.now();
  // the 'before' frame must come through the exact same capture size as later frames, or blur differences break matching
  const sz = base.getSize();
  const first = toGray(sz.width === SW ? base : base.resize({ width: SW, height: SH }));
  const patch = makePatch(first, box);
  let prev = { dx: 0, dy: 0 }, checking = false;
  console.log(`[track] following pin (${patch.flat ? 'flat area: unpin on any change' : 'tracking scroll'})`);
  staleTimer = setInterval(async () => {
    if (checking) return; // never stack captures
    if (Date.now() - t0 > 60000) return stopStaleWatch();
    checking = true;
    try {
      const img = await grabClean(d, SW, SH);
      if (!staleTimer || !img) return;
      const frame = toGray(img);
      let m;
      if (patch.flat) { // blank-ish pin area can't be tracked: unpin when the screen as a whole changes (avg diff, so a blinking caret doesn't count)
        let sum = 0;
        for (let k = 0; k < frame.px.length; k += 7) sum += Math.abs(frame.px[k] - first.px[k]);
        m = { score: sum / (frame.px.length / 7) > 3 ? 99 : 0, dx: 0, dy: 0 };
      } else m = findPatch(frame, patch, prev);
      // measured on real code: tracked matches score ≤ ~3.5, content gone ≈ 8.6+
      if (m.score > 7) { // tuned: real 'gone' scores 8.5-12, borderline matches ~6
        console.log(`[track] pinned content is gone (score ${m.score.toFixed(1)}) → unpin`);
        stopStaleWatch();
        return win.webContents.send('hotkey', 'stale');
      }
      if (process.env.JEPI_DEBUG) console.log(`[track] score ${m.score.toFixed(1)} dx ${m.dx} dy ${m.dy}`);
      if (m.dx !== prev.dx || m.dy !== prev.dy) win.webContents.send('track', { dx: m.dx * sx, dy: m.dy * sy });
      prev = m;
    } catch (e) { console.log('[track] failed:', e.message); stopStaleWatch(); }
    finally { checking = false; }
  }, 250);
}

async function askGemini(image, question, mode, persona, context) {
  if (!KEY) throw new Error('GEMINI_API_KEY missing — put it in .env');
  const body = {
    systemInstruction: { parts: [{ text: buildSystem(persona) }] },
    contents: [{ role: 'user', parts: [
      { inline_data: { mime_type: 'image/jpeg', data: image } },
      { text: `${MODES[mode] || MODES.help}\n${context ? `Your previous answer (they may be following up): ${context}\n` : ''}User says: ${question || '(nothing — just look at my screen)'}` },
    ] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 1 },
  };
  let data, lastErr;
  for (const model of MODELS) {
    const config = { ...body.generationConfig, ...(model.startsWith('gemini-3') && { thinkingConfig: { thinkingLevel: 'low' } }) };
    const t0 = Date.now();
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(25000), // an overloaded model can hang forever otherwise
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify({ ...body, generationConfig: config }),
      });
      const json = await r.json();
      console.log(`[gemini] ${model} → ${r.status} in ${Date.now() - t0}ms`);
      if (r.ok && json.candidates?.[0]?.content?.parts?.[0]?.text) { data = json; break; }
      lastErr = new Error(`Gemini said no (${r.status}): ${json.error?.message || 'empty reply'}`.slice(0, 300));
      if (r.ok || !RETRYABLE.has(r.status)) break;
    } catch (e) {
      console.log(`[gemini] ${model} → ${e.name} after ${Date.now() - t0}ms`);
      lastErr = new Error(e.name === 'TimeoutError' ? 'gemini is taking forever rn, try again' : e.message);
    }
  }
  if (!data) throw lastErr;
  const out = JSON.parse(data.candidates[0].content.parts[0].text);
  out.aura = Math.max(-67, Math.min(67, Math.round(Number(out.aura) || 0)));
  if (!MOODS.includes(out.mood)) out.mood = 'sassy';
  out.targets = (out.targets || [])
    .filter((t) => Array.isArray(t.box_2d) && t.box_2d.length === 4 && t.box_2d.every(Number.isFinite))
    .filter((t) => { const [y0, x0, y1, x1] = t.box_2d; return Math.abs((y1 - y0) * (x1 - x0)) / 1e6 < 0.6; }) // vague half-screen boxes = no pin
    .slice(0, 3);
  out.fix = typeof out.fix === 'string' ? out.fix.slice(0, 2000) : '';
  out.tip = typeof out.tip === 'string' ? out.tip.slice(0, 300) : '';
  const e = out.edit || {};
  out.edit = { file: String(e.file || '').slice(0, 200), find: String(e.find || '').slice(0, 2000), replace: String(e.replace || '').slice(0, 2000) };
  return out;
}

ipcMain.handle('look', async (_e, { question = '', mode = 'help', persona = 'bestie', context = '' } = {}) => {
  try {
    const d = jumpToCursorDisplay();
    stopStaleWatch();
    const { image, hash } = await captureScreen(d);
    const trackBase = await grabClean(d, 960, Math.round((960 * d.size.height) / d.size.width)); // same-size frame for pin tracking
    if (mode === 'watch' && hash === lastWatchHash) return { skip: true }; // screen didn't change: don't bug them
    lastWatchHash = hash;
    const res = await askGemini(image, String(question).slice(0, 500), mode, persona, String(context).slice(0, 600));
    if (res.targets.length && trackBase) startStaleWatch(d, trackBase, res.targets[0].box_2d); // the box Jepi points at
    return { ...res, display: d.bounds, win: win.getBounds() };
  } catch (e) {
    return { error: e.message };
  }
});
ipcMain.on('clickthrough', (_e, on) => win.setIgnoreMouseEvents(on, { forward: true }));
ipcMain.on('quit', () => app.quit());
ipcMain.on('unpin', stopStaleWatch);
ipcMain.handle('apply-fix', async (_e, edit) => {
  try { win.setIgnoreMouseEvents(false); return await applyFix(win, edit || {}); } catch (err) { return { error: err.message }; }
});
ipcMain.handle('undo-fix', () => { try { return undoFix(); } catch (err) { return { error: err.message }; } });
ipcMain.on('copy', (_e, text) => clipboard.writeText(String(text).slice(0, 5000)));

app.whenReady().then(async () => {
  if (LINUX) await sleep(300); // Linux needs a beat before a transparent window can be created
  createWindow();
  if (process.env.JEPI_SELFTEST) require(process.env.JEPI_SELFTEST)({ win, screen, grabClean, startStaleWatch, BrowserWindow }); // dev-only end-to-end test hook
  // Linux can't forward mouse moves through a click-through window, so stream the cursor position instead
  if (LINUX) setInterval(() => {
    if (win.isDestroyed()) return;
    const c = screen.getCursorScreenPoint(), b = win.getBounds();
    win.webContents.send('cursor', { x: c.x - b.x, y: c.y - b.y });
  }, 80);
  const send = (k) => win.webContents.send('hotkey', k);
  globalShortcut.register('CommandOrControl+Shift+Space', () => { jumpToCursorDisplay(); send('look'); });
  globalShortcut.register('CommandOrControl+Shift+A', () => { jumpToCursorDisplay(); win.setIgnoreMouseEvents(false); win.focus(); send('ask'); });
  globalShortcut.register('CommandOrControl+Shift+H', () => { jumpToCursorDisplay(); send('hide'); });
  globalShortcut.register('CommandOrControl+Shift+X', () => send('clear'));
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
  globalShortcut.register('CommandOrControl+Alt+D', () => send('demo')); // offline demo run (no network needed)
  // macOS desktops (Spaces): Jepi is on every Space already; hop with you when you switch
  if (process.platform === 'darwin') {
    systemPreferences.subscribeWorkspaceNotification('NSWorkspaceActiveSpaceDidChangeNotification', () => { jumpToCursorDisplay(); send('space'); });
  }
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
