// Jepi (official Fall Hacks mascot) as 8-bit pixel art. Each part is its own <g> so the CSS rig can animate it.
// Spans are [y, x0, x1, colorKey] on a 1-unit pixel grid. Shared viewBox for sprite + pie layers:
const VIEWBOX = '-1 -5 44 47';
const PAL = {
  k: '#161616', g: '#5aa994', b: '#9dcfd8', m: '#74f5d2', n: '#06038d', p: '#ee8888', r: '#e85a57', w: '#ffffff',
  y: '#f7c948', c: '#f2b25c', l: '#ffd79a', t: '#a9cde0', s: '#7fb0cc', u: '#5fb4ff', v: '#6b3fa0', o: '#8a5a2b',
  d: '#a8243a', R: '#e8384f', G: '#4a8d7b', B: '#86bcc6', L: '#7fc6b1', e: '#cfd6d4',
};
const SVGNS = 'http://www.w3.org/2000/svg';

function grp(attrs = {}) {
  const el = document.createElementNS(SVGNS, 'g');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function paint(el, spans) {
  for (const [y, x0, x1, col] of spans) {
    const r = document.createElementNS(SVGNS, 'rect');
    r.setAttribute('x', x0); r.setAttribute('y', y); r.setAttribute('width', x1 - x0 + 1); r.setAttribute('height', 1);
    r.setAttribute('fill', PAL[col]);
    el.append(r);
  }
  return el;
}
const box = (x0, y0, x1, y1, col) => Array.from({ length: y1 - y0 + 1 }, (_, i) => [y0 + i, x0, x1, col]);
const dots = (list, col) => list.map(([x, y]) => [y, x, x, col]);
const ring = (x0, y0, x1, y1, col) => [[y0, x0, x1, col], [y1, x0, x1, col], ...box(x0, y0 + 1, x0, y1 - 1, col), ...box(x1, y0 + 1, x1, y1 - 1, col)];
// rounded block: outline k, fill col, corners clipped
const blob = (x0, y0, x1, y1, col) => [
  [y0, x0 + 2, x1 - 2, 'k'], [y0 + 1, x0 + 1, x1 - 1, 'k'], ...box(x0, y0 + 2, x1, y1 - 2, 'k'), [y1 - 1, x0 + 1, x1 - 1, 'k'], [y1, x0 + 2, x1 - 2, 'k'],
  [y0 + 1, x0 + 2, x1 - 2, col], ...box(x0 + 1, y0 + 2, x1 - 1, y1 - 2, col), [y1 - 1, x0 + 2, x1 - 2, col],
];

// wide head: green body, light-blue strip on the right, mint dot
function headSpans() {
  const s = blob(9, 6, 36, 28, 'g');
  s.push(...box(30, 8, 35, 26, 'b'), [7, 30, 34, 'b'], [27, 30, 34, 'b']);
  s.push([9, 31, 32, 'm'], [10, 30, 33, 'm'], [11, 30, 33, 'm'], [12, 31, 32, 'm']);
  return s;
}
// tab column on the left: navy block, pink pill, red bar (overlaps the head like the logo)
function tabSpans() {
  return [
    ...box(4, 8, 15, 25, 'k'),
    ...box(5, 9, 15, 14, 'n'),
    [16, 6, 14, 'p'], ...box(5, 17, 15, 20, 'p'), [21, 6, 14, 'p'],
    ...box(5, 23, 15, 24, 'r'),
  ];
}
function pieSpans() {
  const out = { 30: [8, 25], 31: [5, 28], 32: [3, 30], 33: [2, 31], 34: [2, 31], 35: [3, 30], 36: [4, 29], 37: [5, 28], 38: [6, 27], 39: [7, 26] };
  const s = Object.entries(out).map(([y, [a, b]]) => [+y, a, b, 'k']);
  s.push([31, 6, 27, 'c'], [32, 4, 29, 'c'], [33, 3, 30, 'c'], [34, 3, 30, 'c'], [32, 8, 25, 'R'], [33, 6, 27, 'R']);
  s.push(...dots([[12, 32], [16, 32], [20, 32], [9, 33], [10, 33], [13, 33], [14, 33], [17, 33], [18, 33], [21, 33], [22, 33], [25, 33]], 'l'));
  s.push(...dots([[11, 31], [15, 31], [19, 31], [23, 31]], 'l'));
  s.push([35, 4, 29, 't'], [36, 5, 28, 't'], [37, 6, 27, 't'], [38, 7, 26, 't']);
  for (const x of [8, 12, 16, 20, 24]) s.push(...box(x, 35, x, 38, 's'));
  return s;
}
const capeSpans = () => Array.from({ length: 11 }, (_, i) => [26 + i, 9 - (i >> 1), 35 + (i >> 1), i === 10 ? 'd' : 'R']);

// wardrobe: slot -> name -> spans. Hats were drawn for a 20-wide head, so they get nudged onto Jepi's head.
const HAT_SHIFT = 'translate(4 1)';
const WEAR = {
  hat: {
    cap: [[1, 13, 21, 'R'], [2, 11, 23, 'R'], [3, 10, 25, 'R'], [4, 9, 30, 'd'], [2, 16, 17, 'w']],
    crown: [[0, 10, 11, 'y'], [0, 16, 17, 'y'], [0, 22, 23, 'y'], [1, 10, 12, 'y'], [1, 15, 18, 'y'], [1, 21, 23, 'y'],
      ...box(10, 2, 23, 4, 'y'), [3, 13, 13, 'R'], [3, 20, 20, 'u'], [3, 16, 17, 'p']],
    propeller: [[-1, 17, 17, 'k'], [0, 17, 17, 'k'], [1, 14, 21, 'R'], [2, 12, 23, 'y'], [3, 10, 25, 'R'], [4, 9, 26, 'y']],
    wizard: [[-5, 18, 18, 'v'], [-4, 17, 18, 'v'], [-3, 16, 19, 'v'], [-2, 16, 19, 'v'], [-1, 15, 20, 'v'], [0, 15, 20, 'v'],
      [1, 14, 21, 'v'], [2, 13, 22, 'v'], [3, 12, 23, 'v'], [4, 7, 28, 'v'], ...dots([[17, -1], [19, 1], [15, 2], [21, 3]], 'y')],
    cowboy: [[0, 13, 22, 'o'], [1, 12, 23, 'o'], [2, 12, 23, 'k'], [3, 12, 23, 'o'], [3, 3, 5, 'o'], [3, 30, 32, 'o'], [4, 4, 31, 'o']],
    beanie: [[-1, 16, 19, 'w'], [0, 16, 19, 'w'], [1, 13, 22, 'p'], [2, 11, 24, 'p'], [3, 10, 25, 'p'], [4, 9, 26, 'R'],
      ...dots([[13, 2], [17, 2], [21, 2], [12, 3], [16, 3], [20, 3], [24, 3]], 'w')],
    halo: [[-3, 13, 22, 'y'], [-2, 12, 12, 'y'], [-2, 23, 23, 'y'], [-1, 13, 22, 'y']],
    catears: [[0, 6, 7, 'k'], [1, 6, 8, 'k'], [2, 6, 9, 'g'], [3, 6, 10, 'g'], [4, 6, 11, 'g'], [3, 7, 7, 'p'], [4, 7, 8, 'p'],
      [0, 28, 29, 'k'], [1, 27, 29, 'k'], [2, 26, 29, 'b'], [3, 25, 29, 'b'], [4, 24, 29, 'b'], [3, 28, 28, 'p'], [4, 27, 28, 'p']],
    bow: [...box(23, 2, 25, 4, 'p'), ...box(28, 2, 30, 4, 'p'), ...box(26, 3, 27, 4, 'R')],
  },
  face: {
    shades: [[18, 18, 35, 'k'], [19, 18, 23, 'k'], [19, 28, 35, 'k'], [20, 19, 22, 'k'], [20, 29, 34, 'k'], [21, 20, 21, 'k'], [21, 30, 33, 'k'],
      [19, 19, 19, 'w'], [19, 29, 29, 'w']],
    glasses: [...ring(18, 17, 23, 25, 'o'), ...ring(28, 16, 35, 23, 'o'), [19, 24, 27, 'o']],
    mustache: [[25, 22, 30, 'k'], [26, 21, 22, 'k'], [26, 30, 31, 'k'], [24, 24, 28, 'k']],
    blushy: [[25, 16, 18, 'p'], [26, 17, 17, 'p'], [24, 32, 34, 'p'], [25, 33, 33, 'p']],
  },
  fit: {
    tie: [[31, 21, 23, 'n'], ...box(21, 32, 23, 36, 'n'), [33, 21, 23, 'y'], [35, 21, 23, 'y']],
    bowtie: [[28, 17, 18, 'R'], [29, 17, 19, 'R'], [30, 17, 18, 'R'], [28, 25, 26, 'R'], [29, 24, 26, 'R'], [30, 25, 26, 'R'], [29, 20, 23, 'd']],
    scarf: [...box(10, 27, 34, 30, 'R'), ...box(29, 31, 31, 35, 'R'), ...dots([[13, 28], [17, 29], [21, 28], [25, 29], [29, 28], [30, 33]], 'w')],
    cape: capeSpans(),
  },
};
const PROPELLER_BLADE = [[-2, 12, 22, 'n']];

// small pixel sprites for the flight trail
const TRAIL_ART = {
  hearts: ['.rr.rr.', 'rpprrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  stars: ['..y..', '.yyy.', 'yyyyy', '.yyy.', 'y...y'],
  coins: ['.yy.', 'yywy', 'yywy', 'yyyy', '.yy.'],
  sparkles: ['..w..', '..m..', 'wmymw', '..m..', '..w..'],
};
// chunky pixel hand cursor (points up; rotated in CSS to point down) with a red cuff
const POINTER_ART = ['....kk......', '...kwwk.....', '...kwwk.....', '...kwwk.....', '...kwwkkk...', '...kwwkwwkk.',
  '.kkkwwkwwkwk', 'kwwkwwwwwkwk', 'kwwkwwwwwwwk', '.kwwwwwwwwwk', '.kwwwwwwwwwk', '..kwwwwwwwk.', '..kwwwwwwwk.',
  '...kwwwwwk..', '...RRRRRRR..', '...RRyRRRR..'];

function miniSprite(rows, scale = 3) {
  const svg = document.createElementNS(SVGNS, 'svg');
  if (!Array.isArray(rows) || !rows.length || !rows[0]) return svg;
  svg.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`);
  svg.setAttribute('width', rows[0].length * scale);
  svg.setAttribute('height', rows.length * scale);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const spans = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') spans.push([y, x, x, ch]); }));
  paint(svg, spans);
  return svg;
}

function buildTwin(svg) {
  svg.setAttribute('viewBox', VIEWBOX);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const body = grp({ id: 'body' });
  const back = grp({ id: 'fitBack' });
  back.append(paint(grp({ class: 'wear fit', 'data-name': 'cape' }), WEAR.fit.cape));

  const head = grp({ id: 'head' });
  paint(head, headSpans());
  paint(head, tabSpans());
  const eyes = grp({ id: 'eyes' });
  eyes.append(paint(grp({ class: 'pupil' }), box(20, 19, 21, 23, 'k'))); // tall pill eye
  eyes.append(paint(grp({ class: 'pupil' }), box(30, 18, 33, 21, 'k')));
  head.append(eyes, paint(grp({ id: 'lids' }), [[22, 19, 22, 'k'], [21, 29, 34, 'k']]));
  const mouths = {
    line: [[26, 24, 26, 'k'], [27, 27, 29, 'k']],
    smirk: [[27, 24, 26, 'k'], [26, 27, 28, 'k'], [25, 29, 29, 'k']],
    o: box(26, 25, 27, 26, 'k'),
    frown: [[27, 24, 24, 'k'], [26, 25, 27, 'k'], [27, 28, 28, 'k']],
    open: [[25, 24, 28, 'k'], [26, 25, 27, 'k']],
  };
  for (const [n, s] of Object.entries(mouths)) head.append(paint(grp({ class: `mouth m-${n}` }), s));
  head.append(paint(grp({ id: 'tear' }), [[22, 33, 33, 'u'], [23, 33, 33, 'u']]));
  for (const [n, s] of Object.entries(WEAR.face)) head.append(paint(grp({ class: 'wear face', 'data-name': n }), s));
  for (const [n, s] of Object.entries(WEAR.hat)) {
    const h = paint(grp({ class: `wear hat${n === 'halo' ? ' halo' : ''}`, 'data-name': n, transform: HAT_SHIFT }), s);
    if (n === 'propeller') h.append(paint(grp({ class: 'prop' }), PROPELLER_BLADE));
    head.append(h);
  }

  const armL = paint(grp({ id: 'armL' }), dots([[12, 30], [11, 30], [10, 31], [9, 31], [8, 31], [7, 30], [6, 29], [5, 28], [4, 27], [3, 26], [4, 25], [5, 26]], 'k'));
  const armR = paint(grp({ id: 'armR' }), dots([[32, 30], [33, 30], [34, 31], [35, 31], [36, 31], [37, 30], [38, 29], [39, 28], [40, 27], [41, 26], [40, 25], [39, 26]], 'k'));
  // connector-pin legs: band + 7 little U-shaped pins
  const legs = grp({ id: 'legs' });
  paint(legs, box(13, 29, 31, 30, 'k'));
  for (let i = 0; i < 7; i++) {
    const x = 15 + i * 2;
    legs.append(paint(grp({ class: 'leg' }), [[31, x - 1, x + 1, 'k'], [32, x - 1, x - 1, 'k'], [32, x, x, 'w'], [32, x + 1, x + 1, 'k'], [33, x - 1, x + 1, 'k']]));
  }
  const front = grp({ id: 'fitFront' });
  for (const n of ['tie', 'bowtie', 'scarf']) front.append(paint(grp({ class: 'wear fit', 'data-name': n }), WEAR.fit[n]));

  body.append(back, legs, head, armL, armR, front);
  const sparkles = grp({ id: 'sparkles' });
  for (const [x, y] of [[1, 5], [41, 3], [0, -1]]) sparkles.append(paint(grp({ class: 'spark' }), [[y - 1, x, x, 'y'], [y, x - 1, x + 1, 'y'], [y + 1, x, x, 'y']]));
  svg.append(body, sparkles);
}

// back view for the 2.5D spin: same body seen from behind (rotateY(180) mirrors it for us), no face, a little vent
// the BACK of Jepi: the underside of a Raspberry Pi board (not a copy of the face).
// Spans use front-view coordinates, then the group is mirrored (x → 42 - x) so it reads correctly from BEHIND:
// the ports (on Jepi's left) appear on the viewer's right, the blue side on the viewer's left — like a real object.
function buildBack(svg) {
  svg.setAttribute('viewBox', VIEWBOX);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const g = grp({ transform: 'translate(42 0) scale(-1 1)' });
  paint(g, [...blob(9, 6, 36, 28, 'G'), ...box(30, 8, 35, 26, 'B'), [7, 30, 34, 'B'], [27, 30, 34, 'B']]); // same two-tone body, darker
  const hole = (x, y) => [[y - 1, x - 1, x + 1, 'y'], [y, x - 1, x - 1, 'y'], [y, x, x, 'k'], [y, x + 1, x + 1, 'y'], [y + 1, x - 1, x + 1, 'y']];
  paint(g, [...hole(12, 9), ...hole(33, 9), ...hole(12, 25), ...hole(33, 25)]); // mounting holes
  paint(g, dots([16, 18, 20, 22, 24, 26, 28].map((x) => [x, 8]), 'y')); // GPIO header solder pads
  paint(g, [...box(15, 13, 22, 18, 'k'), ...dots([16, 18, 20].map((x) => [x, 12]).concat([16, 18, 20].map((x) => [x, 19])), 'e')]); // main chip
  paint(g, [...box(25, 14, 28, 17, 'k'), [13, 26, 26, 'e'], [18, 26, 26, 'e']]); // small chip
  paint(g, [[21, 11, 14, 'L'], [21, 23, 31, 'L'], ...box(23, 18, 23, 20, 'L'), [11, 23, 30, 'L'], ...box(30, 11, 30, 13, 'L')]); // traces
  paint(g, [...box(16, 22, 22, 26, 'w'), [23, 18, 18, 'r'], [23, 20, 20, 'r'], [24, 18, 20, 'r'], [25, 19, 19, 'r']]); // sticker ♥
  paint(g, tabSpans()); // back of the port column
  paint(g, box(13, 29, 31, 30, 'k'));
  for (let i = 0; i < 7; i++) { const x = 15 + i * 2; paint(g, [[31, x - 1, x + 1, 'k'], [32, x - 1, x - 1, 'k'], [32, x + 1, x + 1, 'k'], [33, x - 1, x + 1, 'k']]); }
  paint(g, dots([[12, 30], [11, 30], [10, 31], [9, 31], [8, 31], [7, 30], [6, 29], [5, 28], [4, 27], [3, 26], [4, 25], [5, 26]], 'k'));
  paint(g, dots([[32, 30], [33, 30], [34, 31], [35, 31], [36, 31], [37, 30], [38, 29], [39, 28], [40, 27], [41, 26], [40, 25], [39, 26]], 'k'));
  for (const [n, sp] of Object.entries(WEAR.hat)) g.append(paint(grp({ class: 'wear hat', 'data-name': n, transform: HAT_SHIFT }), sp));
  g.append(paint(grp({ class: 'wear fit', 'data-name': 'cape' }), WEAR.fit.cape)); // a cape covers the back
  svg.append(g);
}

// the pie lives in its own layer on top of Jepi, so Jepi can climb out from behind its crust
function buildPie(svg) {
  svg.setAttribute('viewBox', VIEWBOX);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.append(paint(grp({ id: 'pie', transform: 'translate(5 1)' }), pieSpans()));
}

function wear(svg, slot, name) {
  svg.querySelectorAll(`.wear.${slot}`).forEach((g) => (g.style.display = g.dataset.name === name ? 'inline' : 'none'));
}
