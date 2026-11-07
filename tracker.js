// Screen comparison + pin tracking on small grayscale frames (Electron NativeImage → BGRA bitmap). Pure JS.

function toGray(img, reuse) { // pass `reuse` (a previous frame) to recycle its buffer instead of allocating
  if (!img || img.isEmpty()) return { w: 0, h: 0, px: new Uint8Array(0) };
  const { width, height } = img.getSize();
  if (width <= 0 || height <= 0) return { w: 0, h: 0, px: new Uint8Array(0) };
  const b = img.toBitmap();
  const pxLen = width * height;
  if (b.length < pxLen * 4) return { w: 0, h: 0, px: new Uint8Array(0) };

  const px = reuse?.px?.length === pxLen ? reuse.px : new Uint8Array(pxLen);
  // ITU-R BT.601 integer grayscale conversion: (B * 29 + G * 150 + R * 77) >> 8
  for (let i = 0, j = 0; j < pxLen; i += 4, j++) {
    px[j] = (b[i] * 29 + b[i + 1] * 150 + b[i + 2] * 77) >> 8;
  }
  return { w: width, h: height, px };
}

// mean brightness difference between two same-size frames (sampled). measured: idle ≈ 0.1, scroll/switch ≫ 3
function screenDiff(a, b) {
  if (!a || !b || a.w !== b.w || a.h !== b.h || a.w === 0 || a.h === 0) return 255;
  if (a.px.length === 0 || b.px.length === 0) return 255;
  let sum = 0, n = 0;
  for (let k = 0; k < a.px.length; k += 7, n++) {
    sum += Math.abs(a.px[k] - b.px[k]);
  }
  return n > 0 ? sum / n : 255;
}

// snapshot of the pinned box plus the line above/below (context makes it unique — code repeats a lot),
// sampled every 2nd pixel
function makePatch(frame, box) {
  if (!frame || !frame.px || frame.w <= 0 || frame.h <= 0 || !Array.isArray(box) || box.length < 4) {
    return { x: 0, y: 0, w: 0, h: 0, pts: [], flat: true };
  }

  let [y0, x0, y1, x1] = box.map((v) => Math.max(0, Math.min(1000, Number(v) || 0)) / 1000);
  if (y1 < y0) [y0, y1] = [y1, y0];
  if (x1 < x0) [x0, x1] = [x1, x0];

  const bh = y1 - y0;
  const ix = (x1 - x0) * 0.04;
  const x = Math.max(0, Math.round((x0 + ix) * frame.w));
  const y = Math.max(0, Math.round((y0 - bh) * frame.h));
  const w = Math.max(6, Math.min(frame.w - x, Math.round((x1 - x0 - 2 * ix) * frame.w)));
  const h = Math.max(6, Math.min(frame.h - y, Math.round((y1 + bh) * frame.h) - y));

  const pts = [];
  let lo = 255, hi = 0;
  for (let yy = 0; yy < h; yy += 2) {
    for (let xx = 0; xx < w; xx += 2) {
      const idx = (y + yy) * frame.w + (x + xx);
      if (idx < frame.px.length) {
        const v = frame.px[idx];
        pts.push(yy * frame.w + xx, v);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
  }

  return { x, y, w, h, pts, flat: pts.length === 0 || hi - lo < 24 }; // flat = blank area, can't be tracked reliably
}

function scoreAt(frame, patch, x, y, best) {
  const count = patch.pts.length >> 1;
  if (count === 0) return Infinity;
  const limit = best * count;
  const base = y * frame.w + x;
  let sum = 0;

  for (let i = 0; i < patch.pts.length; i += 2) {
    const idx = base + patch.pts[i];
    if (idx >= frame.px.length) return Infinity;
    sum += Math.abs(frame.px[idx] - patch.pts[i + 1]);
    if (sum > limit) return Infinity;
  }
  return sum / count;
}

// where did the patch move? search near the last spot first (cheap), whole height only if that fails.
// returns { score (0 = perfect), dx, dy } in frame pixels relative to where it was pinned
function findPatch(frame, patch, prev = { dx: 0, dy: 0 }) {
  if (!patch || patch.pts.length === 0 || !frame || frame.px.length === 0) {
    return { score: 99, dx: 0, dy: 0 };
  }
  let best = { score: Infinity, dx: 0, dy: 0 };

  const tryAt = (dx, dy) => {
    const x = patch.x + dx, y = patch.y + dy;
    if (x < 0 || y < 0 || x + patch.w > frame.w || y + patch.h > frame.h) return;
    const s = scoreAt(frame, patch, x, y, best.score);
    if (s < best.score) best = { score: s, dx, dy };
  };

  const pDx = Number(prev.dx) || 0, pDy = Number(prev.dy) || 0;
  const scan = (from, to) => {
    for (let dy = from; dy <= to; dy++) tryAt(pDx, dy);
  };

  tryAt(pDx, pDy);
  scan(pDy - 60, pDy + 60);
  if (best.score > 4) scan(-patch.y, frame.h - patch.y - patch.h); // big jump: full search
  for (let dx = -24; dx <= 24; dx += 3) {
    for (let dy = best.dy - 3; dy <= best.dy + 3; dy++) {
      tryAt(dx, dy);
    }
  }
  return best;
}

module.exports = { toGray, screenDiff, makePatch, findPatch };
