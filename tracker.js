// Pin tracking: remember what the pinned area looks like, then find where it moved (scrolling) on later frames.
// Works on small grayscale frames (Electron NativeImage → BGRA bitmap), pure JS, no dependencies.

function toGray(img) {
  const { width, height } = img.getSize();
  const b = img.toBitmap();
  const g = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (b[i] * 29 + b[i + 1] * 150 + b[i + 2] * 77) >> 8;
  return { w: width, h: height, px: g };
}

// patch = the interior of the pinned box (box_2d normalized 0-1000), sampled every 2nd pixel for speed
function makePatch(frame, box) {
  const [y0, x0, y1, x1] = box.map((v) => Math.max(0, Math.min(1000, v)) / 1000);
  // widen the snapshot to include the lines just above/below the pin: context makes it unique (code repeats a lot)
  const bh = y1 - y0, ix = (x1 - x0) * 0.04;
  const x = Math.max(0, Math.round((x0 + ix) * frame.w)), y = Math.max(0, Math.round((y0 - bh) * frame.h));
  const w = Math.max(6, Math.min(frame.w - x, Math.round((x1 - x0 - 2 * ix) * frame.w)));
  const h = Math.max(6, Math.min(frame.h - y, Math.round((y1 + bh) * frame.h) - y));
  const pts = [];
  for (let yy = 0; yy < h; yy += 2) for (let xx = 0; xx < w; xx += 2) pts.push(yy * frame.w + xx, frame.px[(y + yy) * frame.w + (x + xx)]);
  // contrast check: a flat patch (blank area) can't be tracked reliably
  let lo = 255, hi = 0;
  for (let i = 1; i < pts.length; i += 2) { lo = Math.min(lo, pts[i]); hi = Math.max(hi, pts[i]); }
  return { x, y, w, h, pts, flat: hi - lo < 24 };
}

function scoreAt(frame, patch, x, y, best) { // mean abs diff, bails out early once it can't beat `best`
  const limit = best * (patch.pts.length / 2);
  let sum = 0;
  const base = y * frame.w + x;
  for (let i = 0; i < patch.pts.length; i += 2) {
    sum += Math.abs(frame.px[base + patch.pts[i]] - patch.pts[i + 1]);
    if (sum > limit) return Infinity;
  }
  return sum / (patch.pts.length / 2);
}

// search the whole height (any scroll distance) at the same x, plus a little sideways; ties keep `prev`
function findPatch(frame, patch, prev = { dx: 0, dy: 0 }) {
  let best = { score: Infinity, dx: 0, dy: 0 };
  const tryAt = (dx, dy) => {
    const x = patch.x + dx, y = patch.y + dy;
    if (x < 0 || y < 0 || x + patch.w > frame.w || y + patch.h > frame.h) return;
    const s = scoreAt(frame, patch, x, y, best.score); // no distance bias: big scrolls must win on pixels alone
    if (s < best.score) best = { score: s, dx, dy };
  };
  tryAt(prev.dx, prev.dy);
  for (let dy = -patch.y; dy <= frame.h - patch.y - patch.h; dy++) tryAt(prev.dx, dy);
  for (let dx = -24; dx <= 24; dx += 3) for (let dy = best.dy - 3; dy <= best.dy + 3; dy++) tryAt(dx, dy);
  return best; // score: 0 = perfect match; dx/dy in frame pixels relative to where it was pinned
}

module.exports = { toGray, makePatch, findPatch };
