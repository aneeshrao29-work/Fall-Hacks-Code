// Screen comparison + pin tracking on small grayscale frames (Electron NativeImage → BGRA bitmap). Pure JS.

function toGray(img) {
  const { width, height } = img.getSize();
  const b = img.toBitmap();
  const px = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < px.length; i += 4, j++) px[j] = (b[i] * 29 + b[i + 1] * 150 + b[i + 2] * 77) >> 8;
  return { w: width, h: height, px };
}

// mean brightness difference between two same-size frames (sampled). measured: idle ≈ 0.1, scroll/switch ≫ 3
function screenDiff(a, b) {
  if (a.w !== b.w || a.h !== b.h) return 255;
  let sum = 0, n = 0;
  for (let k = 0; k < a.px.length; k += 7, n++) sum += Math.abs(a.px[k] - b.px[k]);
  return sum / n;
}

// snapshot of the pinned box plus the line above/below (context makes it unique — code repeats a lot),
// sampled every 2nd pixel
function makePatch(frame, box) {
  const [y0, x0, y1, x1] = box.map((v) => Math.max(0, Math.min(1000, v)) / 1000);
  const bh = y1 - y0, ix = (x1 - x0) * 0.04;
  const x = Math.max(0, Math.round((x0 + ix) * frame.w)), y = Math.max(0, Math.round((y0 - bh) * frame.h));
  const w = Math.max(6, Math.min(frame.w - x, Math.round((x1 - x0 - 2 * ix) * frame.w)));
  const h = Math.max(6, Math.min(frame.h - y, Math.round((y1 + bh) * frame.h) - y));
  const pts = [];
  let lo = 255, hi = 0;
  for (let yy = 0; yy < h; yy += 2) for (let xx = 0; xx < w; xx += 2) {
    const v = frame.px[(y + yy) * frame.w + (x + xx)];
    pts.push(yy * frame.w + xx, v);
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  return { x, y, w, h, pts, flat: hi - lo < 24 }; // flat = blank area, can't be tracked reliably
}

function scoreAt(frame, patch, x, y, best) { // mean abs diff; bails out once it can't beat `best`
  const limit = best * (patch.pts.length / 2), base = y * frame.w + x;
  let sum = 0;
  for (let i = 0; i < patch.pts.length; i += 2) {
    sum += Math.abs(frame.px[base + patch.pts[i]] - patch.pts[i + 1]);
    if (sum > limit) return Infinity;
  }
  return sum / (patch.pts.length / 2);
}

// where did the patch move? search near the last spot first (cheap), whole height only if that fails.
// returns { score (0 = perfect), dx, dy } in frame pixels relative to where it was pinned
function findPatch(frame, patch, prev = { dx: 0, dy: 0 }) {
  let best = { score: Infinity, dx: 0, dy: 0 };
  const tryAt = (dx, dy) => {
    const x = patch.x + dx, y = patch.y + dy;
    if (x < 0 || y < 0 || x + patch.w > frame.w || y + patch.h > frame.h) return;
    const s = scoreAt(frame, patch, x, y, best.score);
    if (s < best.score) best = { score: s, dx, dy };
  };
  const scan = (from, to) => { for (let dy = from; dy <= to; dy++) tryAt(prev.dx, dy); };
  tryAt(prev.dx, prev.dy);
  scan(prev.dy - 60, prev.dy + 60);
  if (best.score > 4) scan(-patch.y, frame.h - patch.y - patch.h); // big jump: full search
  for (let dx = -24; dx <= 24; dx += 3) for (let dy = best.dy - 3; dy <= best.dy + 3; dy++) tryAt(dx, dy);
  return best;
}

module.exports = { toGray, screenDiff, makePatch, findPatch };
