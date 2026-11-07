// Unit tests (plain Node, no Electron): node tests/unit.js
// Covers the pure logic: pin tracking math, screen diffing, prompt/schema contracts, crash detection.
const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..');
const { screenDiff, makePatch, findPatch } = require(path.join(root, 'tracker.js'));
const { MODES, SCHEMA, buildSystem, SIMPLE_SYSTEM, SIMPLE_SCHEMA, MOODS } = require(path.join(root, 'prompts.js'));

let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓ ${name}`); } catch (e) { fail++; console.log(`  ✗ ${name}\n      ${e.message}`); }
};

// deterministic "screen": textured rows (like lines of code) so patches are unique
function frame(w, h, seed = 1, shiftY = 0) {
  const px = new Uint8Array(w * h);
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rows = Array.from({ length: h + 400 }, () => Array.from({ length: w }, () => (rnd() > 0.7 ? 220 : 30)));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = rows[y + 200 + shiftY][x];
  return { w, h, px };
}

console.log('tracker');
test('screenDiff: identical frames = 0', () => assert.strictEqual(screenDiff(frame(200, 120), frame(200, 120)), 0));
test('screenDiff: different size = 255 (never "unchanged")', () => assert.strictEqual(screenDiff(frame(200, 120), frame(100, 60)), 255));
test('screenDiff: empty/null input is safe', () => assert.strictEqual(screenDiff(null, frame(10, 10)), 255));
test('screenDiff: scrolled screen is clearly "changed" (> 3)', () => assert.ok(screenDiff(frame(200, 120), frame(200, 120, 1, 15)) > 3));
for (const dy of [0, 7, 25, -18, 60]) {
  test(`findPatch: finds content scrolled by ${dy}px`, () => {
    const a = frame(320, 200), b = frame(320, 200, 1, -dy); // content moved down by dy
    const patch = makePatch(a, [400, 200, 460, 700]);
    const m = findPatch(b, patch);
    assert.strictEqual(m.dy, dy, `found ${m.dy}`);
    assert.ok(m.score < 1, `score ${m.score}`);
  });
}
test('findPatch: content gone → high score (unpin)', () => {
  const a = frame(320, 200, 1), b = frame(320, 200, 999);
  assert.ok(findPatch(b, makePatch(a, [400, 200, 460, 700])).score > 7);
});
test('makePatch: blank area is flagged flat (not trackable)', () => {
  const blank = { w: 100, h: 100, px: new Uint8Array(10000).fill(40) };
  assert.strictEqual(makePatch(blank, [100, 100, 300, 600]).flat, true);
});
test('makePatch: garbage box is safe', () => {
  assert.doesNotThrow(() => makePatch(frame(50, 50), ['x', null, 9999, -5]));
  assert.strictEqual(makePatch(null, [1, 2, 3, 4]).flat, true);
});
test('findPatch: empty patch/frame returns "gone", never throws', () => {
  assert.strictEqual(findPatch(null, null).score, 99);
});

console.log('prompts / schema');
test('only help + code modes (roast/watch removed)', () => assert.deepStrictEqual(Object.keys(MODES).sort(), ['code', 'help']));
test('code mode checks bugs AND redundant code', () => assert.match(MODES.code, /redundant/i));
test('answer schema requires every field the app reads', () =>
  assert.deepStrictEqual([...SCHEMA.required].sort(), ['aura', 'clean', 'edit', 'fix', 'mood', 'reply', 'targets', 'tip']));
test('find-all asks Gemini to pin EVERY match (no 3-item limit)', () => assert.match(buildSystem('bestie'), /pin EVERY match[\s\S]*up to 20/));
test('targets carry a note (guided tours)', () => assert.ok(SCHEMA.properties.targets.items.required.includes('note')));
test('mood enum has no surprises', () => assert.deepStrictEqual(SCHEMA.properties.mood.enum, MOODS));
for (const p of ['bestie', 'brainrot', 'linkedin', 'drama', 'cat', 'grandma', 'study']) {
  test(`persona prompt builds: ${p}`, () => { const s = buildSystem(p); assert.ok(s.length > 500 && s.includes('Rules:')); });
}
test('unknown persona falls back safely', () => assert.ok(buildSystem('nope').includes('GEN Z BESTIE')));
test('study persona forbids slang/jokes', () => assert.match(buildSystem('study'), /No slang, no\s+jokes/));
test('prompts never ask Gemini to say 6-7', () => assert.match(buildSystem('brainrot'), /NEVER say "6-7"/));
test('explain-simply prompt + schema exist', () => { assert.match(SIMPLE_SYSTEM, /analogy/); assert.deepStrictEqual(SIMPLE_SCHEMA.required, ['reply']); });

test('resume ATS schema requires score, breakdown, missing keywords and fixes', () => {
  const R = require(path.join(root, 'resume.js')).SCHEMA;
  assert.deepStrictEqual([...R.required].sort(), ['breakdown', 'job', 'missing', 'score', 'suggestions', 'verdict']);
});

console.log('crash detection (Solve the error I copied)');
const extras = require('fs').readFileSync(path.join(root, 'renderer', 'extras.js'), 'utf8');
const CRASH = eval(extras.match(/const CRASH = (\/.*\/m);/)[1]);
for (const t of ['Traceback (most recent call last):\n  File "a.py"', "TypeError: Cannot read properties of undefined (reading 'x')",
  '    at foo (app.js:10:5)', 'npm ERR! code ELIFECYCLE', "thread 'main' panicked at 'index'", 'a.ts(3,1): error TS2304: Cannot find name',
  'Exception in thread "main" java.lang.NullPointerException', 'ZeroDivisionError: division by zero']) {
  test(`detects: ${t.split('\n')[0].slice(0, 45)}`, () => assert.ok(CRASH.test(t)));
}
for (const t of ['const total = items.reduce((a, b) => a + b, 0)', 'Meeting: fix the error handling next week', 'https://github.com/x/y', 'print("hi")']) {
  test(`ignores: ${t.slice(0, 45)}`, () => assert.ok(!CRASH.test(t)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
