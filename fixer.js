// Apply Jepi's suggested fix to the real file on disk — only after the user confirms in the bubble.
// Safe by design: exact-text match, refuses if the text appears 0 or 2+ times, one-step undo that won't clobber later edits.
const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

const SKIP = new Set(['node_modules', 'dist', 'build', 'venv', '.venv', '__pycache__', 'target', '.git', '.claude-flow', '.swarm']);
const settingsFile = () => path.join(app.getPath('userData'), 'jepi-settings.json');

const loadSettings = () => {
  try {
    const data = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
};

const saveSettings = (s) => {
  try {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2), 'utf8');
  } catch (err) {
    console.warn('[fixer] failed to save settings:', err.message);
  }
};

const TEXT_EXT = /\.(py|js|jsx|ts|tsx|mjs|cjs|java|c|cc|cpp|h|hpp|cs|go|rs|rb|php|swift|kt|scala|html|css|scss|json|md|txt|sh|sql|yml|yaml|toml|vue|svelte|dart|lua|r|m)$/i;

// walk the project once per lookup (skips deps/build folders, caps size). Async so the app never freezes.
async function walk(dir, out = [], depth = 0) {
  if (depth > 7 || out.length > 4000) return out;
  let entries;
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out, depth + 1);
    else if (TEXT_EXT.test(e.name)) out.push(p);
  }
  return out;
}

const safeMtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
const newest = (list) => list.slice().sort((a, b) => safeMtime(b) - safeMtime(a))[0];

// "demo.py — Visual Studio Code", "● app.js", "src/App.tsx" → "demo.py" / "app.js" / "App.tsx"
const cleanName = (name) => {
  const matches = String(name || '').match(/[\w.@-]+\.[A-Za-z0-9]{1,6}/g) || [];
  return matches.length ? path.basename(matches[matches.length - 1]) : '';
};

async function contains(p, find) {
  try {
    if ((await fs.promises.stat(p)).size > 600000) return false;
    const t = await fs.promises.readFile(p, 'utf8');
    const want = find.trim();
    return t.includes(find) || t.split(/\r?\n/).some((l) => l.trim() && l.trim() === want);
  } catch { return false; }
}
const filterAsync = async (list, fn) => (await Promise.all(list.map(fn))).reduce((acc, ok, i) => (ok ? [...acc, list[i]] : acc), []);

// 1) a file you already picked with that name  2) same name in the project (case-insensitive)
// 3) the ONE project file that actually contains the broken line  4) only then ask (and remember)
async function resolveFile(win, name, find) {
  const s = loadSettings(), base = cleanName(name), key = base.toLowerCase();
  const known = s.files && Object.prototype.hasOwnProperty.call(s.files, key) ? s.files[key] : null;
  if (known && typeof known === 'string' && fs.existsSync(known)) {
    try { if (fs.statSync(known).isFile()) return known; } catch {}
  }

  const files = s.projectDir && typeof s.projectDir === 'string' && fs.existsSync(s.projectDir) ? await walk(s.projectDir) : [];
  const byName = files.filter((p) => path.basename(p).toLowerCase() === key);
  if (byName.length) {
    const hits = await filterAsync(byName, (p) => contains(p, find));
    return newest(hits.length ? hits : byName);
  }

  const byContent = await filterAsync(files, (p) => contains(p, find));
  console.log(`[fix] "${name}" → name "${base}": ${byName.length} by name, ${byContent.length} by content in ${s.projectDir || '(no folder yet)'}`);
  if (byContent.length === 1) return byContent[0];

  const r = await dialog.showOpenDialog(win, {
    title: `Which file is ${base || 'this'}? (Jepi will remember it)`,
    defaultPath: s.projectDir,
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const picked = r.filePaths[0];

  const updatedFiles = Object.assign(Object.create(null), s.files || {});
  const fileKey = key || path.basename(picked).toLowerCase();
  if (fileKey) updatedFiles[fileKey] = picked;

  saveSettings({
    ...s,
    projectDir: s.projectDir && picked.startsWith(s.projectDir) ? s.projectDir : path.dirname(picked),
    files: updatedFiles,
  });
  return picked;
}

let lastEdit = null;

async function applyFix(win, edit) {
  const rawFile = String(edit?.file || '');
  let find = String(edit?.find || '');
  let replace = String(edit?.replace || '');

  if (!find || find === replace) return { error: 'nothing to change' };

  const p = await resolveFile(win, rawFile, find);
  if (!p) return { error: 'no file picked' };

  let text;
  try {
    text = fs.readFileSync(p, 'utf8');
  } catch (err) {
    return { error: `unable to read ${path.basename(p)}: ${err.message}` };
  }

  // Normalize CRLF / LF matching between file and prompt input
  const fileHasCRLF = text.includes('\r\n');
  if (fileHasCRLF && !find.includes('\r\n')) {
    find = find.replace(/\r?\n/g, '\r\n');
    replace = replace.replace(/\r?\n/g, '\r\n');
  } else if (!fileHasCRLF && find.includes('\r\n')) {
    find = find.replace(/\r\n/g, '\n');
    replace = replace.replace(/\r\n/g, '\n');
  }

  // fix already applied? (e.g. find is a prefix of replace) — don't apply it twice
  if (replace.includes(find) && text.includes(replace)) {
    return { error: `${path.basename(p)} already has that fix 👍` };
  }

  let target = find;
  let count = text.split(find).length - 1;

  if (count === 0) {
    // the screen may show different whitespace: fall back to a unique trimmed-line match
    const want = find.trim();
    const lines = text.split(/\r?\n/);
    const hits = lines.filter((l) => l.trim() === want);
    if (hits.length === 1) {
      target = hits[0];
      count = 1;
      // re-indent EVERY line of a multi-line fix, keeping its own relative indentation
      const leadingIndent = target.match(/^\s*/)[0];
      const rl = replace.replace(/\r\n/g, '\n').replace(/^\n+|\s+$/g, '').split('\n');
      const minIndent = Math.min(...rl.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length));
      replace = rl.map((l) => (l.trim() ? leadingIndent + l.slice(minIndent) : '')).join(fileHasCRLF ? '\r\n' : '\n');
    }
  }

  if (count === 0) return { error: `couldn't find that exact line in ${path.basename(p)}` };
  if (count > 1) return { error: `that text appears ${count}× in ${path.basename(p)}, so i won't guess` };

  // a multi-line fix dropped into the middle of an indented line (screen text often loses indentation):
  // indent the fix's following lines to match that line, so Python/YAML/etc. stay valid
  const at = text.indexOf(target), lineStart = text.lastIndexOf('\n', at - 1) + 1, prefix = text.slice(lineStart, at);
  if (replace.includes('\n') && prefix && /^[ \t]*$/.test(prefix)) {
    replace = replace.split(/\r?\n/).map((l, i) => (i && l.trim() ? prefix + l : l)).join(fileHasCRLF ? '\r\n' : '\n');
  }

  const after = text.replace(target, () => replace);
  try {
    fs.writeFileSync(p, after, 'utf8');
  } catch (err) {
    return { error: `failed to save ${path.basename(p)}: ${err.message}` };
  }

  lastEdit = { path: p, before: text, after };
  return { ok: true, file: path.basename(p) };
}

function undoFix() {
  if (!lastEdit) return { error: 'nothing to undo' };
  const { path: p, before, after } = lastEdit;
  try {
    if (!fs.existsSync(p)) return { error: 'the file was deleted, cannot undo' };
    if (fs.readFileSync(p, 'utf8') !== after) {
      return { error: "the file changed since, so i won't overwrite your edits" };
    }
    fs.writeFileSync(p, before, 'utf8');
    lastEdit = null;
    return { ok: true, file: path.basename(p) };
  } catch (err) {
    return { error: `undo failed: ${err.message}` };
  }
}

module.exports = { applyFix, undoFix };
