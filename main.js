// JepiTheGenie — a hovering pixel sidekick. Transparent always-on-top overlay that screenshots the screen,
// asks Gemini, then points at (and can fix) whatever matters.
const { app, BrowserWindow, screen, desktopCapturer, globalShortcut, ipcMain, systemPreferences, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const { MOODS, MODES, SCHEMA, buildSystem, SIMPLE_SYSTEM, SIMPLE_SCHEMA } = require('./prompts');
const { applyFix, undoFix } = require('./fixer');
const { toGray, makePatch, findPatch, screenDiff } = require('./tracker');
const { importSyllabus, dueSoon, showCalendarFile } = require('./syllabus');
const { checkResume } = require('./resume');

// Robust .env loader (no external dependencies, safe on Windows CRLF)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
} catch (err) {
  console.warn('[env] error reading .env:', err.message);
}

const KEY = process.env.GEMINI_API_KEY;
// fastest accurate model first; fall back when one is overloaded / rate-limited / retired / slow
const MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
].filter((m, i, a) => m && a.indexOf(m) === i);

const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);
const LINUX = process.platform === 'linux';
const TRACK_W = 960; // capture width for change checks + pin tracking (every frame must use the same size)
if (LINUX) app.commandLine.appendSwitch('enable-transparent-visuals');

let win = null, lastShot = null;
let curDisplay = null;
let cursorTimer = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (k, payload) => win && !win.isDestroyed() && win.webContents.send(k, payload);

function createWindow() {
  const d = cursorDisplay();
  curDisplay = d.id;
  win = new BrowserWindow({
    ...d.bounds,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    hasShadow: false,
    skipTaskbar: true,
    fullscreenable: false,
    enableLargerThanScreen: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true }); // click-through except over Jepi
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// Jepi lives on whichever monitor the cursor is on
const cursorDisplay = () => screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
function jumpToCursorDisplay() {
  const d = cursorDisplay();
  if (!win || win.isDestroyed()) return d;
  if (d.id === curDisplay) return d;
  curDisplay = d.id;
  try {
    win.setBounds(d.bounds);
  } catch {}
  send('hotkey', 'moved');
  return d;
}

// ---------- screen capture ----------
// Jepi must not appear in its own screenshots. 'protect' = content protection (window stays visible, captures skip it).
// Some machines (older Windows 10, some GPUs) black out the WHOLE capture instead -> we detect that and switch to
// 'hide' (blink the overlay away for a moment). Linux has no content protection, so it always hides.
let hideMode = LINUX ? 'hide' : 'protect';
async function grabOnce(d, width) {
  if (!win || win.isDestroyed()) return null;
  const height = Math.round((width * d.size.height) / d.size.width);
  if (hideMode === 'protect') {
    win.setContentProtection(true);
  } else if (LINUX) {
    win.hide();
  } else {
    win.setOpacity(0);
  }

  await sleep(hideMode === 'protect' ? 60 : LINUX ? 250 : 120);

  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    // Windows often leaves display_id empty: fall back to the display's position in the list (screen:<index>:0)
    const idx = screen.getAllDisplays().findIndex((x) => x.id === d.id);
    const src = sources.find((s) => s.display_id === String(d.id)) || sources.find((s) => s.id === `screen:${idx}:0`)
      || sources[idx] || sources[0];
    return src && !src.thumbnail.isEmpty() ? src.thumbnail : null;
  } finally {
    if (win && !win.isDestroyed()) {
      if (hideMode === 'protect') {
        win.setContentProtection(false);
      } else if (LINUX) {
        win.showInactive();
      } else {
        win.setOpacity(1);
      }
    }
  }
}

function isBlack(img) {
  if (!img || img.isEmpty()) return true;
  try {
    const b = img.resize({ width: 48 }).toBitmap();
    for (let i = 0; i < b.length; i += 4) {
      if (b[i] + b[i + 1] + b[i + 2] > 45) return false;
    }
    return true;
  } catch {
    return true;
  }
}

async function grab(d, width) {
  let img = await grabOnce(d, width);
  if (img && hideMode === 'protect' && isBlack(img)) {
    console.log('[capture] protected capture is black on this machine → switching to hide mode');
    hideMode = 'hide';
    img = await grabOnce(d, width);
  }
  if (!img || isBlack(img)) {
    throw new Error('i can only see a black screen 😵 allow Screen Recording for this app in your system settings, then restart me');
  }
  return img;
}

// ---------- pin tracking: the pin follows its content on scroll, and fades once the content is gone ----------
let trackTimer = null;
function stopTracking() {
  if (trackTimer) {
    clearInterval(trackTimer);
    trackTimer = null;
  }
}

function startTracking(d, first, box) {
  stopTracking();
  if (hideMode !== 'protect') return; // tracking captures often; hiding each time would blink constantly
  if (!first || first.w <= 0 || first.h <= 0) return;

  const patch = makePatch(first, box);
  const sx = d.size.width / first.w;
  const sy = d.size.height / first.h;
  const t0 = Date.now();
  let prev = { dx: 0, dy: 0 };
  let busy = false, frame = null;

  trackTimer = setInterval(async () => {
    if (busy) return;
    if (Date.now() - t0 > 300000) return stopTracking(); // pins stay until dismissed; stop watching after 5 min
    busy = true;
    try {
      frame = toGray(await grab(d, TRACK_W), frame); // reuses the same buffer every tick
      if (!trackTimer) return;
      // blank-ish pins can't be tracked: they just unpin when the screen changes
      const m = patch.flat
        ? { score: screenDiff(first, frame) > 3 ? 99 : 0, dx: 0, dy: 0 }
        : findPatch(frame, patch, prev);

      if (m.score > 7) {
        stopTracking();
        return send('hotkey', 'stale');
      } // measured: tracked ≤ ~3.5, gone ≥ 8.5

      if (m.dx !== prev.dx || m.dy !== prev.dy) {
        send('track', { dx: m.dx * sx, dy: m.dy * sy });
      }
      prev = m;
    } catch {
      stopTracking();
    } finally {
      busy = false;
    }
  }, 400);
}

// ---------- Gemini ----------
// one place that talks to Gemini: model fallback, timeout, JSON parsing. Used for screen looks AND syllabus PDFs.
async function callGemini({ system, parts, schema, timeout = 25000 }) {
  if (!KEY) throw new Error('GEMINI_API_KEY missing — put it in .env');
  let lastErr;
  for (const model of MODELS) {
    const generationConfig = { responseMimeType: 'application/json', responseSchema: schema, temperature: 1,
      ...(model.startsWith('gemini-3') && { thinkingConfig: { thinkingLevel: 'low' } }) };
    const t0 = Date.now();
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeout), // an overloaded model can hang forever otherwise
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts }], generationConfig }),
      });
      const json = await r.json().catch(() => ({ error: { message: `HTTP ${r.status} non-JSON response` } }));
      console.log(`[gemini] ${model} → ${r.status} in ${Date.now() - t0}ms`);
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (r.ok && text) return JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
      lastErr = new Error(`Gemini said no (${r.status}): ${json.error?.message || 'empty reply'}`.slice(0, 300));
      if (r.ok || !RETRYABLE.has(r.status)) break;
    } catch (e) {
      lastErr = new Error(e.name === 'TimeoutError' ? 'gemini is taking forever rn, try again' : e.message);
      if (e instanceof SyntaxError) break; // bad JSON from a model that answered: retrying elsewhere won't help
    }
  }
  throw lastErr || new Error('failed to reach Gemini');
}

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
async function askGemini(image, question, mode, persona, context, region) {
  const out = await callGemini({
    system: buildSystem(persona),
    parts: [
      { inline_data: { mime_type: 'image/jpeg', data: image } },
      { text: [
        `Task: ${MODES[mode] || MODES.help}`,
        region && `The user boxed this part of the screen: box_2d [${region.join(', ')}]. Answer ONLY about what is inside that box; targets must be inside it.`,
        context && `Your previous answer (they are following up): ${context}`,
        `User says: ${question || '(nothing — just look at my screen)'}`,
      ].filter(Boolean).join('\n') },
    ],
  });
  const e = out.edit && typeof out.edit === 'object' ? out.edit : {};
  return {
    reply: str(out.reply, 1200), fix: str(out.fix, 2000), tip: str(out.tip, 300),
    clean: out.clean === true,
    edit: { file: str(e.file, 200), find: str(e.find, 2000), replace: str(e.replace, 2000) },
    mood: MOODS.includes(out.mood) ? out.mood : 'sassy',
    aura: Math.max(-67, Math.min(67, Math.round(Number(out.aura) || 0))),
    targets: (Array.isArray(out.targets) ? out.targets : [])
      .filter((t) => t && Array.isArray(t.box_2d) && t.box_2d.length === 4 && t.box_2d.every((n) => Number.isFinite(Number(n))))
      .map((t) => ({ label: str(t.label, 80) || 'here 👀', note: str(t.note, 400), box_2d: t.box_2d.map((n) => Math.round(Number(n))) }))
      .filter(({ box_2d: [y0, x0, y1, x1] }) => Math.abs((y1 - y0) * (x1 - x0)) / 1e6 < 0.6) // vague/huge = no pin
      .slice(0, 20), // "find all…" can pin up to 20 things
  };
}

// ---------- IPC ----------
// region comes from the renderer in overlay-window pixels → convert to Gemini's 0-1000 screen coordinates
function regionToBox(region, d) {
  if (!region || !(region.w > 4 && region.h > 4)) return null;
  const b = win.getBounds(), n = (v, o, size) => Math.max(0, Math.min(1000, Math.round(((v + o) / size) * 1000)));
  return [n(region.y, b.y - d.bounds.y, d.size.height), n(region.x, b.x - d.bounds.x, d.size.width),
    n(region.y + region.h, b.y - d.bounds.y, d.size.height), n(region.x + region.w, b.x - d.bounds.x, d.size.width)];
}
ipcMain.handle('look', async (_e, { question = '', mode = 'help', persona = 'bestie', context = '', region = null } = {}) => {
  try {
    const d = jumpToCursorDisplay();
    stopTracking();
    const shot = await grab(d, 1600); // what Gemini sees
    lastShot = shot.toJPEG(75).toString('base64'); // reused by "explain simply" (no second screenshot)
    const before = toGray(await grab(d, TRACK_W)); // same-size frame for change checks + tracking
    const res = await askGemini(lastShot, String(question).slice(0, 3500), mode, persona,
      String(context).slice(0, 600), regionToBox(region, d));
    // did they switch windows / scroll while Gemini was thinking? then boxes would point at the wrong thing:
    // answer in the bubble only, no pins
    const after = toGray(await grab(d, TRACK_W));
    // a spinner or video elsewhere is fine: only drop pins when the pinned thing itself is gone
    if (res.targets.length) {
      const p = makePatch(before, res.targets[0].box_2d);
      if (p.flat ? screenDiff(before, after) > 3 : findPatch(after, p).score > 7) { res.targets = []; res.screenChanged = true; }
      else startTracking(d, before, res.targets[0].box_2d); // track from what Gemini saw, so a scroll mid-think still moves the pins
    }
    return { ...res, display: d.bounds, win: win.getBounds() };
  } catch (e) {
    return { error: e.message };
  }
});
// 🧒 explain simply: rewrite the last answer in plain words, using the SAME screenshot (fast, no flying around)
ipcMain.handle('explain-simple', async (_e, { text = '' } = {}) => {
  try {
    const parts = [...(lastShot ? [{ inline_data: { mime_type: 'image/jpeg', data: lastShot } }] : []),
      { text: `Explain this simply:\n${String(text).slice(0, 2000)}` }];
    const out = await callGemini({ system: SIMPLE_SYSTEM, parts, schema: SIMPLE_SCHEMA });
    return { reply: str(out.reply, 900) };
  } catch (e) { return { error: e.message }; }
});
ipcMain.handle('syllabus', async (_e, { paths } = {}) => {
  try { return await importSyllabus(win, paths, callGemini); } catch (e) { return { error: e.message }; }
});
ipcMain.handle('due-soon', () => dueSoon(7));
ipcMain.handle('resume', async (_e, { file } = {}) => {
  try {
    const shoot = async () => (await grab(jumpToCursorDisplay(), 1600)).toJPEG(75).toString('base64');
    return await checkResume(win, file, shoot, callGemini);
  } catch (e) { return { error: e.message }; }
});
ipcMain.on('show-ics', showCalendarFile);
ipcMain.on('clickthrough', (_e, on) => {
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(Boolean(on), { forward: true });
  }
});
ipcMain.on('quit', () => app.quit());
ipcMain.on('unpin', stopTracking);
ipcMain.on('focus', () => { if (win && !win.isDestroyed()) win.focus(); });
ipcMain.on('copy', (_e, text) => clipboard.writeText(String(text).slice(0, 5000)));

ipcMain.handle('apply-fix', async (_e, edit) => {
  try {
    if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(false);
    return await applyFix(win, edit || {});
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('undo-fix', () => {
  try {
    return undoFix();
  } catch (err) {
    return { error: err.message };
  }
});

app.whenReady().then(async () => {
  if (LINUX) await sleep(300); // Linux needs a beat before a transparent window can be created
  createWindow();

  // Linux can't forward mouse moves through a click-through window, so stream the cursor position instead
  if (LINUX) {
    cursorTimer = setInterval(() => {
      if (!win || win.isDestroyed()) return;
      const c = screen.getCursorScreenPoint(), b = win.getBounds();
      send('cursor', { x: c.x - b.x, y: c.y - b.y });
    }, 33);
  }

  const hotkey = (k) => send('hotkey', k);
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    jumpToCursorDisplay();
    hotkey('look');
  });
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    jumpToCursorDisplay();
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(false);
      win.focus();
    }
    hotkey('ask');
  });
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    jumpToCursorDisplay();
    hotkey('hide');
  });
  globalShortcut.register('CommandOrControl+Shift+X', () => hotkey('clear'));
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
  globalShortcut.register('CommandOrControl+Alt+D', () => hotkey('demo')); // offline demo run

  if (process.platform === 'darwin') {
    // macOS desktops (Spaces): quick spin when you switch
    try {
      systemPreferences.subscribeWorkspaceNotification('NSWorkspaceActiveSpaceDidChangeNotification', () => {
        jumpToCursorDisplay();
        hotkey('space');
      });
    } catch {}
  }
});

app.on('will-quit', () => {
  stopTracking();
  if (cursorTimer) clearInterval(cursorTimer);
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => app.quit());
