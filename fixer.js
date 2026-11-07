// Apply Jepi's suggested fix to the real file on disk — only after the user confirms in the bubble.
// Safe by design: exact-text match, refuses if the text appears 0 or 2+ times, one-step undo that won't clobber later edits.
const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

const SKIP = new Set(['node_modules', 'dist', 'build', 'venv', '.venv', '__pycache__', 'target', '.git']);
const settingsFile = () => path.join(app.getPath('userData'), 'jepi-settings.json');
const loadSettings = () => { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; } };
const saveSettings = (s) => fs.writeFileSync(settingsFile(), JSON.stringify(s));

const TEXT_EXT = /\.(py|js|jsx|ts|tsx|mjs|cjs|java|c|cc|cpp|h|hpp|cs|go|rs|rb|php|swift|kt|scala|html|css|scss|json|md|txt|sh|sql|yml|yaml|toml|vue|svelte|dart|lua|r|m)$/i;

// walk the project once per lookup (skips deps/build folders, caps size so it stays fast)
function walk(dir, out = [], depth = 0) {
  if (depth > 7 || out.length > 4000) return out;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1);
    else if (TEXT_EXT.test(e.name)) out.push(p);
  }
  return out;
}
const newest = (list) => list.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
// "demo.py — Visual Studio Code", "● app.js", "src/App.tsx" → "demo.py" / "app.js" / "App.tsx"
const cleanName = (name) => (String(name || '').match(/[\w.@-]+\.[A-Za-z0-9]{1,6}/g) || []).map((n) => path.basename(n)).pop() || '';
function contains(p, find) {
  try {
    if (fs.statSync(p).size > 600000) return false;
    const t = fs.readFileSync(p, 'utf8');
    return t.includes(find) || t.split('\n').some((l) => l.trim() && l.trim() === find.trim());
  } catch { return false; }
}

// 1) a file you already picked with that name  2) same name in the project (case-insensitive)
// 3) the ONE project file that actually contains the broken line  4) only then ask (and remember)
async function resolveFile(win, name, find) {
  const s = loadSettings(), base = cleanName(name), key = base.toLowerCase();
  const known = (s.files || {})[key];
  if (known && fs.existsSync(known)) return known;
  const files = s.projectDir ? walk(s.projectDir) : [];
  const byName = files.filter((p) => path.basename(p).toLowerCase() === key);
  if (byName.length) return newest(byName.filter((p) => contains(p, find)).length ? byName.filter((p) => contains(p, find)) : byName);
  const byContent = files.filter((p) => contains(p, find));
  console.log(`[fix] "${name}" → name "${base}": ${byName.length} by name, ${byContent.length} by content in ${s.projectDir || '(no folder yet)'}`);
  if (byContent.length === 1) return byContent[0];
  const r = await dialog.showOpenDialog(win, {
    title: `Which file is ${base || 'this'}? (Jepi will remember it)`,
    defaultPath: s.projectDir, properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const picked = r.filePaths[0];
  saveSettings({ ...s, projectDir: s.projectDir && picked.startsWith(s.projectDir) ? s.projectDir : path.dirname(picked),
    files: { ...(s.files || {}), [key || path.basename(picked).toLowerCase()]: picked } });
  return picked;
}

let lastEdit = null;
async function applyFix(win, { file, find, replace }) {
  if (!find || find === replace) return { error: 'nothing to change' };
  const p = await resolveFile(win, file, find);
  if (!p) return { error: 'no file picked' };
  const text = fs.readFileSync(p, 'utf8');
  // fix already applied? (e.g. find is a prefix of replace) — don't apply it twice
  if (replace.includes(find) && text.includes(replace)) return { error: `${path.basename(p)} already has that fix 👍` };
  let target = find, count = text.split(find).length - 1;
  if (count === 0) { // the screen may show different whitespace: fall back to a unique trimmed-line match
    const want = find.trim(), lines = text.split('\n');
    const hits = lines.filter((l) => l.trim() === want);
    if (hits.length === 1) { target = hits[0]; count = 1; replace = target.match(/^\s*/)[0] + replace.trim(); }
  }
  if (count === 0) return { error: `couldn't find that exact line in ${path.basename(p)}` };
  if (count > 1) return { error: `that text appears ${count}× in ${path.basename(p)}, so i won't guess` };
  const after = text.replace(target, () => replace);
  fs.writeFileSync(p, after);
  lastEdit = { path: p, before: text, after };
  return { ok: true, file: path.basename(p) };
}

function undoFix() {
  if (!lastEdit) return { error: 'nothing to undo' };
  const { path: p, before, after } = lastEdit;
  if (fs.readFileSync(p, 'utf8') !== after) return { error: 'the file changed since, so i won\'t overwrite your edits' };
  fs.writeFileSync(p, before);
  lastEdit = null;
  return { ok: true, file: path.basename(p) };
}

module.exports = { applyFix, undoFix };
