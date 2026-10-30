/* Coll Plan3D — general drafting (the "Build a project" side): lines, polylines, rectangles, circles, arcs, text
   and dimensions on layers, blocks, exact input, CAD snaps and edit commands, drawn on the 2D plan, on the plan
   sheet and in the DWG / DXF export.

   Everything is kept on the plan in plan.draft:
     layers  [{ id, name, color, on, lock, xref? }]   cur: the layer new drawing goes on
     ents    [{ id, t, layer, … }]                     the drawing
     blocks  { name: { ents: [...] } }                 block definitions, their base point at 0,0
     ascale  annotation scale: plotted inches per foot × … as a denominator (48 = 1/4″ = 1′-0″)
   Entities (plan feet, y down, angles in radians measured the way the screen turns: + is clockwise on screen):
     line    x1 y1 x2 y2
     pline   pts [[x,y]…], closed
     circle  cx cy r
     arc     cx cy r a0 a1   (from a0 to a1, clockwise on screen)
     text    x y str ph (height in plotted inches) rot
     dim     x1 y1 x2 y2 off (the dimension line's distance off the measured points, + to the left of 1→2) ph
     insert  block x y rot sc fx (fx: -1 mirrored)
   Coll Business Solutions LLC */
(function (global) {
'use strict';
const uid = () => Math.random().toString(36).slice(2, 10);
const TAU = Math.PI * 2;
// layer colours, with the AutoCAD colour number each one exports as
const COLORS = [['#e8edef', 7, 'White'], ['#ff6a4d', 1, 'Red'], ['#f2c84b', 2, 'Yellow'], ['#5bd17a', 3, 'Green'], ['#7fd3e3', 4, 'Cyan'], ['#6f8cff', 5, 'Blue'], ['#d07bff', 6, 'Magenta'], ['#9aa5ab', 8, 'Grey'], ['#f29b4b', 30, 'Orange']];
const ACI = Object.fromEntries(COLORS.map(c => [c[0], c[1]]));
const SCALES = [[96, '1/8″ = 1′-0″'], [64, '3/16″ = 1′-0″'], [48, '1/4″ = 1′-0″'], [32, '3/8″ = 1′-0″'], [24, '1/2″ = 1′-0″'], [16, '3/4″ = 1′-0″'], [12, '1″ = 1′-0″'], [8, '1-1/2″ = 1′-0″'], [4, '3″ = 1′-0″'], [1, 'Full size']];

function data(P, make) {
  if (!P.draft && make) P.draft = { layers: [{ id: '0', name: '0', color: '#e8edef', on: true, lock: false }], cur: '0', ents: [], blocks: {}, ascale: 48 };
  const D = P.draft; if (D) { D.layers = D.layers || []; D.ents = D.ents || []; D.blocks = D.blocks || {}; if (!D.layers.length) D.layers.push({ id: '0', name: '0', color: '#e8edef', on: true, lock: false }); if (!D.cur || !D.layers.some(l => l.id === D.cur)) D.cur = D.layers[0].id; }
  return D;
}
const layerOf = (P, id) => { const D = P.draft; return (D && D.layers.find(l => l.id === id)) || (D && D.layers[0]) || { id: '0', name: '0', color: '#e8edef', on: true }; };
const shown = (P, e) => layerOf(P, e.layer).on !== false;
const editable = (P, e) => { const L = layerOf(P, e.layer); return L.on !== false && !L.lock; };
const ascale = (P) => (P.draft && +P.draft.ascale > 0) ? +P.draft.ascale : 48;
// a text's height on the drawing (feet) from its plotted height (inches) and the annotation scale
const textH = (P, e) => (e.ph || 0.125) * ascale(P) / 12;

/* ---------- geometry ---------- */
const segD = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy; let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - x1 - dx * t, py - y1 - dy * t); };
const norm = (a) => { a %= TAU; return a < 0 ? a + TAU : a; };
const onArc = (a, a0, a1) => { const s = norm(a1 - a0) || TAU; return norm(a - a0) <= s + 1e-9; };
function circum(p1, p2, p3) {
  const ax = p1[0], ay = p1[1], bx = p2[0], by = p2[1], cx = p3[0], cy = p3[1], d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-12) return null;
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d, uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  return [ux, uy, Math.hypot(ax - ux, ay - uy)];
}
// an arc through three points: start, a point on it, end
function arc3(p1, p2, p3) {
  const c = circum(p1, p2, p3); if (!c) return null;
  const A = (p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
  let a0 = A(p1), a1 = A(p3); if (!onArc(A(p2), a0, a1)) [a0, a1] = [a1, a0];
  return { cx: c[0], cy: c[1], r: c[2], a0: norm(a0), a1: norm(a1) };
}
// the block's entities placed by an insert, as plain entities in plan coordinates
function expand(P, e, depth) {
  const B = P.draft && P.draft.blocks[e.block]; if (!B || (depth || 0) > 4) return [];
  const c = Math.cos(e.rot || 0), s = Math.sin(e.rot || 0), k = e.sc || 1, f = e.fx === -1 ? -1 : 1;
  const M = [c * k * f, s * k * f, -s * k, c * k, e.x, e.y];
  const out = [];
  for (const q of B.ents) { const z = xform(JSON.parse(JSON.stringify(q)), M); if (!z.layer || z.layer === '0') z.layer = e.layer; if (z.t === 'insert') out.push(...expand(P, z, (depth || 0) + 1)); else out.push(z); }
  return out;
}
// line pieces of an entity (arcs and circles as short chords) for picking, snapping and box select
function pieces(P, e) {
  if (e.t === 'line' || e.t === 'dim') return [[e.x1, e.y1, e.x2, e.y2]];
  if (e.t === 'pline') { const o = []; const n = e.pts.length; for (let i = 0; i + 1 < n + (e.closed ? 1 : 0); i++) { const a = e.pts[i], b = e.pts[(i + 1) % n]; o.push([a[0], a[1], b[0], b[1]]); } return o; }
  if (e.t === 'circle' || e.t === 'arc') { const a0 = e.t === 'arc' ? e.a0 : 0, sw = e.t === 'arc' ? (norm(e.a1 - e.a0) || TAU) : TAU, n = Math.max(8, Math.ceil(sw / 0.2)), o = []; for (let i = 0; i < n; i++) { const t0 = a0 + sw * i / n, t1 = a0 + sw * (i + 1) / n; o.push([e.cx + e.r * Math.cos(t0), e.cy + e.r * Math.sin(t0), e.cx + e.r * Math.cos(t1), e.cy + e.r * Math.sin(t1)]); } return o; }
  if (e.t === 'text') { const c = textBox(P, e); return [[c[0][0], c[0][1], c[1][0], c[1][1]], [c[1][0], c[1][1], c[2][0], c[2][1]], [c[2][0], c[2][1], c[3][0], c[3][1]], [c[3][0], c[3][1], c[0][0], c[0][1]]]; }
  if (e.t === 'insert') return [].concat(...expand(P, e).map(q => pieces(P, q)));
  return [];
}
function textBox(P, e) {
  const h = textH(P, e), w = String(e.str || '').length * h * 0.62, c = Math.cos(e.rot || 0), s = Math.sin(e.rot || 0);
  const at = (u, v) => [e.x + c * u - s * v, e.y + s * u + c * v];
  return [at(0, 0.2 * h), at(w, 0.2 * h), at(w, -h), at(0, -h)];
}
// the points that place an entity (box select takes an entity when all of them are inside)
function pts(P, e) {
  if (e.t === 'line' || e.t === 'dim') return [[e.x1, e.y1], [e.x2, e.y2]];
  if (e.t === 'pline') return e.pts.map(p => [p[0], p[1]]);
  if (e.t === 'circle') return [[e.cx - e.r, e.cy - e.r], [e.cx + e.r, e.cy + e.r]];
  if (e.t === 'arc') return [[e.cx + e.r * Math.cos(e.a0), e.cy + e.r * Math.sin(e.a0)], [e.cx + e.r * Math.cos(e.a1), e.cy + e.r * Math.sin(e.a1)], [e.cx + e.r * Math.cos(e.a0 + (norm(e.a1 - e.a0) || TAU) / 2), e.cy + e.r * Math.sin(e.a0 + (norm(e.a1 - e.a0) || TAU) / 2)]];
  if (e.t === 'text') return textBox(P, e);
  if (e.t === 'insert') { const L = [].concat(...expand(P, e).map(q => pts(P, q))); return L.length ? L : [[e.x, e.y]]; }
  return [];
}
function bounds(P) {
  const D = P.draft; if (!D || !D.ents.length) return null;
  let a = 1e18, b = 1e18, c = -1e18, d = -1e18;
  for (const e of D.ents) { if (!shown(P, e)) continue; for (const [x, y] of pts(P, e)) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } }
  return a <= c ? { x0: a, y0: b, x1: c, y1: d } : null;
}
// apply an affine map M = [a, b, c, d, tx, ty] (x' = a·x + c·y + tx, y' = b·x + d·y + ty) to an entity
function xform(e, M) {
  const [a, b, c, d, tx, ty] = M, F = (x, y) => [a * x + c * y + tx, b * x + d * y + ty], det = a * d - b * c, k = Math.sqrt(Math.abs(det)) || 1, mir = det < 0;
  const ang = (t) => Math.atan2(b * Math.cos(t) + d * Math.sin(t), a * Math.cos(t) + c * Math.sin(t));
  if (e.t === 'line' || e.t === 'dim') { [e.x1, e.y1] = F(e.x1, e.y1); [e.x2, e.y2] = F(e.x2, e.y2); if (e.t === 'dim') e.off = (e.off || 0) * k * (mir ? -1 : 1); }
  else if (e.t === 'pline') e.pts = e.pts.map(p => F(p[0], p[1]));
  else if (e.t === 'circle') { [e.cx, e.cy] = F(e.cx, e.cy); e.r *= k; }
  else if (e.t === 'arc') { [e.cx, e.cy] = F(e.cx, e.cy); e.r *= k; let a0 = norm(ang(e.a0)), a1 = norm(ang(e.a1)); if (mir) [a0, a1] = [a1, a0]; e.a0 = a0; e.a1 = a1; }
  else if (e.t === 'text') { [e.x, e.y] = F(e.x, e.y); let r = ang(e.rot || 0); if (mir) { r = norm(r); if (r > Math.PI / 2 && r < Math.PI * 1.5) r -= Math.PI; } e.rot = r; e.ph = (e.ph || 0.125) * k; }
  else if (e.t === 'insert') {
    // the block's own x axis (flipped when it's mirrored) carried through the map
    const f = e.fx === -1 ? -1 : 1, r = e.rot || 0, vx = a * f * Math.cos(r) + c * f * Math.sin(r), vy = b * f * Math.cos(r) + d * f * Math.sin(r), f2 = mir ? -f : f;
    [e.x, e.y] = F(e.x, e.y); e.sc = (e.sc || 1) * k; e.fx = f2; e.rot = Math.atan2(vy, vx) + (f2 === -1 ? Math.PI : 0);
  }
  return e;
}
const MOVE = (dx, dy) => [1, 0, 0, 1, dx, dy];
const ROT = (cx, cy, t) => { const c = Math.cos(t), s = Math.sin(t); return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; };
const SCALE = (cx, cy, k) => [k, 0, 0, k, cx - k * cx, cy - k * cy];
// mirror across the line through (x1, y1) and (x2, y2)
const MIRROR = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1, a = (dx * dx - dy * dy) / L2, b = 2 * dx * dy / L2; return [a, b, b, -a, x1 - a * x1 - b * y1, y1 - b * x1 + a * y1]; };
function center(P, list) { let a = 1e18, b = 1e18, c = -1e18, d = -1e18; for (const e of list) for (const [x, y] of pts(P, e)) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return a <= c ? [(a + c) / 2, (b + d) / 2, a, b, c, d] : [0, 0, 0, 0, 0, 0]; }

/* ---------- intersections (for snaps, trim and extend) ---------- */
function segX(a, b) { // two segments [x1,y1,x2,y2]: the crossing point and where it is along each (t, u from 0 to 1)
  const r = [a[2] - a[0], a[3] - a[1]], s = [b[2] - b[0], b[3] - b[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const t = ((b[0] - a[0]) * s[1] - (b[1] - a[1]) * s[0]) / den, u = ((b[0] - a[0]) * r[1] - (b[1] - a[1]) * r[0]) / den;
  return { x: a[0] + r[0] * t, y: a[1] + r[1] * t, t, u };
}
function lineCircle(a, e) { // a line through segment a with a circle / arc: the t values along a
  const dx = a[2] - a[0], dy = a[3] - a[1], fx = a[0] - e.cx, fy = a[1] - e.cy, A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - e.r * e.r, D = B * B - 4 * A * C;
  if (D < 0 || A < 1e-12) return [];
  const q = Math.sqrt(D), out = [];
  for (const t of [(-B - q) / (2 * A), (-B + q) / (2 * A)]) { const x = a[0] + dx * t, y = a[1] + dy * t; if (e.t === 'arc' && !onArc(Math.atan2(y - e.cy, x - e.cx), e.a0, e.a1)) continue; out.push(t); }
  return out;
}

/* ---------- snaps ---------- */
// the snap points of every shown entity: end, mid, cen, quad, ins (an insert's or a text's base point)
function snapPts(P) {
  const D = P.draft, out = []; if (!D) return out;
  const add = (x, y, k) => out.push([x, y, k]);
  const one = (e) => {
    if (e.t === 'line') { add(e.x1, e.y1, 'end'); add(e.x2, e.y2, 'end'); add((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2, 'mid'); }
    else if (e.t === 'pline') { const n = e.pts.length; e.pts.forEach(p => add(p[0], p[1], 'end')); for (let i = 0; i + 1 < n + (e.closed ? 1 : 0); i++) { const a = e.pts[i], b = e.pts[(i + 1) % n]; add((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 'mid'); } }
    else if (e.t === 'circle') { add(e.cx, e.cy, 'cen'); for (let k = 0; k < 4; k++) add(e.cx + e.r * Math.cos(k * Math.PI / 2), e.cy + e.r * Math.sin(k * Math.PI / 2), 'quad'); }
    else if (e.t === 'arc') { add(e.cx, e.cy, 'cen'); add(e.cx + e.r * Math.cos(e.a0), e.cy + e.r * Math.sin(e.a0), 'end'); add(e.cx + e.r * Math.cos(e.a1), e.cy + e.r * Math.sin(e.a1), 'end'); const m = e.a0 + (norm(e.a1 - e.a0) || TAU) / 2; add(e.cx + e.r * Math.cos(m), e.cy + e.r * Math.sin(m), 'mid'); }
    else if (e.t === 'text') add(e.x, e.y, 'ins');
    else if (e.t === 'dim') { add(e.x1, e.y1, 'end'); add(e.x2, e.y2, 'end'); }
    else if (e.t === 'insert') { add(e.x, e.y, 'ins'); expand(P, e).forEach(one); }
  };
  for (const e of D.ents) if (shown(P, e)) one(e);
  return out;
}
const SNAP_RANK = { end: 0, int: 1, cen: 2, quad: 3, mid: 4, ins: 5, perp: 6, wall: 1 };
/* The point a click or the cursor lands on: a snap point within 10 px (and the wall ends, chase corners, the
   grid and Ortho through the plan editor), crossings of nearby lines, square off the last point (perp). */
function snap(ed, x, y, from, free) {
  const P = ed.plan, tol = 10 / ed.view.s;
  let best = null;
  const cand = (px, py, k) => { const d = Math.hypot(px - x, py - y); if (d > tol) return; if (!best || SNAP_RANK[k] < SNAP_RANK[best.kind] - 0.5 || (SNAP_RANK[k] <= SNAP_RANK[best.kind] + 0.5 && d < best.d)) best = { x: px, y: py, kind: k, d }; };
  if (!free) {
    for (const [px, py, k] of snapPts(P)) cand(px, py, k);
    for (const w of P.walls || []) { cand(w.x1, w.y1, 'end'); cand(w.x2, w.y2, 'end'); }
    // crossings among the pieces near the cursor
    const near = [];
    for (const e of (P.draft ? P.draft.ents : [])) if (shown(P, e) && e.t !== 'text') for (const q of pieces(P, e)) if (segD(x, y, q[0], q[1], q[2], q[3]) < tol * 2) near.push(q);
    for (const w of P.walls || []) if (segD(x, y, w.x1, w.y1, w.x2, w.y2) < tol * 2) near.push([w.x1, w.y1, w.x2, w.y2]);
    for (let i = 0; i < near.length && i < 60; i++) for (let j = i + 1; j < near.length && j < 60; j++) { const X = segX(near[i], near[j]); if (X && X.t >= -1e-9 && X.t <= 1 + 1e-9 && X.u >= -1e-9 && X.u <= 1 + 1e-9) cand(X.x, X.y, 'int'); }
    // square off the last point onto a line near the cursor
    if (from) for (const q of near) { const dx = q[2] - q[0], dy = q[3] - q[1], L2 = dx * dx + dy * dy; if (L2 < 1e-9) continue; const t = ((from.x - q[0]) * dx + (from.y - q[1]) * dy) / L2; if (t < 0 || t > 1) continue; cand(q[0] + dx * t, q[1] + dy * t, 'perp'); }
  }
  if (best) return best;
  const s = ed.snap(x, y, from, { free });
  return { x: s.x, y: s.y, kind: s.kind === 'point' ? 'wall' : s.kind, ax: s.ax, ay: s.ay };
}
const SNAP_NAME = { end: 'Endpoint', mid: 'Midpoint', cen: 'Center', quad: 'Quadrant', int: 'Intersection', perp: 'Perpendicular', ins: 'Insertion', wall: 'Wall end' };
function drawSnap(ed, g, p) {
  const X = ed.sx(p.x), Y = ed.sy(p.y), C = '#7fd3e3';
  g.save(); g.strokeStyle = C; g.lineWidth = 1.6; g.beginPath();
  if (p.kind === 'end' || p.kind === 'wall') g.rect(X - 5, Y - 5, 10, 10);
  else if (p.kind === 'mid') { g.moveTo(X, Y - 6); g.lineTo(X + 6, Y + 5); g.lineTo(X - 6, Y + 5); g.closePath(); }
  else if (p.kind === 'cen') g.arc(X, Y, 6, 0, TAU);
  else if (p.kind === 'quad') { g.moveTo(X, Y - 6); g.lineTo(X + 6, Y); g.lineTo(X, Y + 6); g.lineTo(X - 6, Y); g.closePath(); }
  else if (p.kind === 'int') { g.moveTo(X - 6, Y - 6); g.lineTo(X + 6, Y + 6); g.moveTo(X + 6, Y - 6); g.lineTo(X - 6, Y + 6); }
  else if (p.kind === 'perp') { g.moveTo(X - 6, Y + 5); g.lineTo(X + 6, Y + 5); g.moveTo(X, Y + 5); g.lineTo(X, Y - 6); }
  else if (p.kind === 'ins') { g.rect(X - 5, Y - 5, 10, 10); g.moveTo(X - 5, Y); g.lineTo(X + 5, Y); }
  else { g.strokeStyle = '#f2c84b'; g.moveTo(X - 8, Y); g.lineTo(X + 8, Y); g.moveTo(X, Y - 8); g.lineTo(X, Y + 8); }
  g.stroke();
  if (SNAP_NAME[p.kind]) { g.font = '11px Consolas, monospace'; g.fillStyle = 'rgba(23,29,32,.9)'; const t = SNAP_NAME[p.kind], w = g.measureText(t).width; g.fillRect(X + 10, Y + 8, w + 8, 16); g.fillStyle = C; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(t, X + 14, Y + 16); }
  g.restore();
}

/* ---------- drawing on the plan ---------- */
function strokeEnt(ed, g, P, e, color, lw) {
  const s = ed.view.s, X = (x) => ed.sx(x), Y = (y) => ed.sy(y);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw;
  if (e.t === 'line') { g.beginPath(); g.moveTo(X(e.x1), Y(e.y1)); g.lineTo(X(e.x2), Y(e.y2)); g.stroke(); }
  else if (e.t === 'pline') { g.beginPath(); e.pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); if (e.closed) g.closePath(); g.stroke(); }
  else if (e.t === 'circle') { g.beginPath(); g.arc(X(e.cx), Y(e.cy), e.r * s, 0, TAU); g.stroke(); }
  else if (e.t === 'arc') { g.beginPath(); g.arc(X(e.cx), Y(e.cy), e.r * s, e.a0, e.a0 + (norm(e.a1 - e.a0) || TAU)); g.stroke(); }
  else if (e.t === 'text') { const h = textH(P, e) * s; if (h < 2) return; g.save(); g.translate(X(e.x), Y(e.y)); g.rotate(e.rot || 0); g.font = `${h}px "Segoe UI", Arial, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(e.str || '', 0, 0); g.restore(); }
  else if (e.t === 'dim') {
    const G = dimGeom(P, e), h = textH(P, e) * s;
    g.beginPath(); for (const q of G.lines) { g.moveTo(X(q[0]), Y(q[1])); g.lineTo(X(q[2]), Y(q[3])); } g.stroke();
    if (h >= 2) { g.save(); g.translate(X(G.tx), Y(G.ty)); g.rotate(G.rot); g.font = `${h}px "Segoe UI", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(G.str, 0, 0); g.restore(); }
  }
  else if (e.t === 'insert') for (const q of expand(P, e)) strokeEnt(ed, g, P, q, color, lw);
}
// a dimension's lines (extension lines, the dimension line, ticks) and where its text goes
function dimGeom(P, e) {
  const dx = e.x2 - e.x1, dy = e.y2 - e.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = uy, ny = -ux, o = e.off || 0, h = textH(P, e);
  const a = [e.x1 + nx * o, e.y1 + ny * o], b = [e.x2 + nx * o, e.y2 + ny * o], sg = Math.sign(o) || 1, ext = h * 0.6, gap = h * 0.4, tk = h * 0.5;
  const lines = [[e.x1 + nx * gap * sg, e.y1 + ny * gap * sg, a[0] + nx * ext * sg, a[1] + ny * ext * sg], [e.x2 + nx * gap * sg, e.y2 + ny * gap * sg, b[0] + nx * ext * sg, b[1] + ny * ext * sg], [a[0], a[1], b[0], b[1]]];
  for (const p of [a, b]) lines.push([p[0] - (ux + nx) * tk, p[1] - (uy + ny) * tk, p[0] + (ux + nx) * tk, p[1] + (uy + ny) * tk]);
  let rot = Math.atan2(dy, dx); if (rot > Math.PI / 2 || rot <= -Math.PI / 2) rot += Math.PI;
  // the text sits over the dimension line, on its outside (away from the measured points)
  const up = [Math.sin(rot), -Math.cos(rot)], lift = h * 0.35, tx = (a[0] + b[0]) / 2 + up[0] * lift, ty = (a[1] + b[1]) / 2 + up[1] * lift;
  return { lines, tx, ty, rot, str: e.text || dimText(L) };
}
function dimText(ft) { const FR = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8']; const e = Math.round(ft * 96), f = Math.floor(e / 96), r = e - f * 96, i = Math.floor(r / 8), q = r % 8; return (f ? f + '\'-' : '') + i + (q ? ' ' + FR[q] : '') + '"'; }

function drawAll(ed, g) {
  const P = ed.plan, D = P.draft; if (!D) return;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const e of D.ents) { if (!shown(P, e)) continue; const L = layerOf(P, e.layer); g.globalAlpha = L.xref ? 0.65 : 1; strokeEnt(ed, g, P, e, L.color || '#e8edef', 1.2); }
  g.restore();
}
function outline(ed, g, e, color, lw) { const P = ed.plan; g.save(); g.setLineDash([]); g.shadowColor = color; g.shadowBlur = 6; strokeEnt(ed, g, P, e, color, lw + 0.8); g.restore();
  // grips at the points that place it
  if (lw >= 2) { g.save(); g.fillStyle = '#1a2024'; g.strokeStyle = color; g.lineWidth = 1.5; const G = e.t === 'circle' ? [[e.cx, e.cy]] : e.t === 'text' || e.t === 'insert' ? [[e.x, e.y]] : pts(P, e); for (const [x, y] of G.slice(0, 40)) { g.beginPath(); g.rect(ed.sx(x) - 3.5, ed.sy(y) - 3.5, 7, 7); g.fill(); g.stroke(); } g.restore(); }
}
function hit(ed, x, y) {
  const P = ed.plan, D = P.draft; if (!D) return null;
  const tol = 6 / ed.view.s;
  for (let i = D.ents.length - 1; i >= 0; i--) {
    const e = D.ents[i]; if (!editable(P, e)) continue;
    if (e.t === 'text') { const c = textBox(P, e); if (inPoly(x, y, c)) return { kind: 'dent', id: e.id }; continue; }
    if (e.t === 'circle') { if (Math.abs(Math.hypot(x - e.cx, y - e.cy) - e.r) < tol) return { kind: 'dent', id: e.id }; continue; }
    if (e.t === 'arc') { if (Math.abs(Math.hypot(x - e.cx, y - e.cy) - e.r) < tol && onArc(Math.atan2(y - e.cy, x - e.cx), e.a0, e.a1)) return { kind: 'dent', id: e.id }; continue; }
    if (e.t === 'dim') { if (dimGeom(P, e).lines.some(q => segD(x, y, q[0], q[1], q[2], q[3]) < tol)) return { kind: 'dent', id: e.id }; continue; }
    for (const q of pieces(P, e)) if (segD(x, y, q[0], q[1], q[2], q[3]) < tol) return { kind: 'dent', id: e.id };
  }
  return null;
}
function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }

/* ---------- drawing tools ---------- */
const TOOLS = {
  line: 'Line: click the start, then each next point (it carries on from the last). Type a length and Enter, @x,y for a step, or length<angle. Esc to stop.',
  pline: 'Polyline: click each corner; Enter or double-click to finish, C closes it. Type lengths as for a line.',
  rect: 'Rectangle: click one corner, then the other, or type the size as width,height and Enter.',
  circle: 'Circle: click the center, then a point on it, or type the radius and Enter.',
  arc: 'Arc: click the start, a point along it, then the end.',
  text: 'Text: click where it starts (bottom left), then type it.',
  dim: 'Dimension: click the two points to measure, then where the dimension line goes.',
  insert: 'Insert a block: click where its base point goes. R turns it 90°.',
  trim: 'Trim: click the part of a line to cut away, between the lines that cross it.',
  extend: 'Extend: click near the end of a line to stretch it to the next line it meets.',
  offset: 'Offset: click the side to put the copy on.',
  xref: ''
};
function cur(ed) { const D = data(ed.plan, true); return D.cur; }
function add(ed, e) { e.id = uid(); e.layer = e.layer || cur(ed); ed.edit(P => { data(P, true).ents.push(e); }); return e; }
// a typed point: "x,y" (absolute), "@dx,dy" (from the last point), "length<angle" / "@length<angle" (degrees, counter-
// clockwise from the right, as AutoCAD), or a plain length along the cursor's direction from the last point
function typedPoint(ed, str, last, toward) {
  const L = (s) => global.Plan3DEditor.parseLen(s.trim(), 'ft');
  str = str.trim(); const rel = str.startsWith('@'); if (rel) str = str.slice(1);
  if (str.includes('<')) { const [a, b] = str.split('<'), d = L(a), t = +b * Math.PI / 180; if (!isFinite(d) || !isFinite(t) || !last) return null; return { x: last.x + d * Math.cos(t), y: last.y - d * Math.sin(t) }; }
  if (str.includes(',')) { const [a, b] = str.split(','), dx = L(a), dy = L(b); if (!isFinite(dx) || !isFinite(dy)) return null; return rel || !last ? (rel && last ? { x: last.x + dx, y: last.y + dy } : { x: dx, y: dy }) : { x: dx, y: dy }; }
  const d = L(str); if (!isFinite(d) || !last || !toward) return null;
  const vx = toward.x - last.x, vy = toward.y - last.y, n = Math.hypot(vx, vy) || 1; return { x: last.x + vx / n * d, y: last.y + vy / n * d };
}
function down(ed, p, e) {
  const T = ed.dtool || 'line', S = ed.dd || (ed.dd = { pts: [] }), last = S.pts[S.pts.length - 1];
  if (T === 'trim' || T === 'extend') { (T === 'trim' ? trimAt : extendAt)(ed, p.x, p.y); return; }
  if (T === 'offset') { offsetTo(ed, p.x, p.y); return; }
  const q = snap(ed, p.x, p.y, last || null, e.altKey);
  click(ed, { x: q.x, y: q.y });
}
function click(ed, q) {
  const T = ed.dtool || 'line', S = ed.dd || (ed.dd = { pts: [] }), P = S.pts;
  if (T === 'line') { if (P.length) add(ed, { t: 'line', x1: P[P.length - 1].x, y1: P[P.length - 1].y, x2: q.x, y2: q.y }); P.push(q); }
  else if (T === 'pline') { P.push(q); if (P.length > 2 && Math.hypot(q.x - P[0].x, q.y - P[0].y) < 1e-6) { P.pop(); finishPline(ed, true); } }
  else if (T === 'rect') { if (!P.length) P.push(q); else { const a = P[0]; if (Math.abs(q.x - a.x) > 1e-6 && Math.abs(q.y - a.y) > 1e-6) add(ed, { t: 'pline', closed: true, pts: [[a.x, a.y], [q.x, a.y], [q.x, q.y], [a.x, q.y]] }); S.pts = []; } }
  else if (T === 'circle') { if (!P.length) P.push(q); else { const r = Math.hypot(q.x - P[0].x, q.y - P[0].y); if (r > 1e-6) add(ed, { t: 'circle', cx: P[0].x, cy: P[0].y, r }); S.pts = []; } }
  else if (T === 'arc') { P.push(q); if (P.length === 3) { const A = arc3([P[0].x, P[0].y], [P[1].x, P[1].y], [P[2].x, P[2].y]); if (A) add(ed, { t: 'arc', ...A }); S.pts = []; } }
  else if (T === 'dim') { P.push(q); if (P.length === 3) { const a = P[0], b = P[1], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = (b.y - a.y) / L, ny = -(b.x - a.x) / L, off = (q.x - a.x) * nx + (q.y - a.y) * ny; add(ed, { t: 'dim', x1: a.x, y1: a.y, x2: b.x, y2: b.y, off, ph: 3 / 32 }); S.pts = []; } }
  else if (T === 'text') { S.pts = []; ed.emit('drafttext', { x: q.x, y: q.y }); }
  else if (T === 'insert') { if (ed.dblock && ed.plan.draft && ed.plan.draft.blocks[ed.dblock]) add(ed, { t: 'insert', block: ed.dblock, x: q.x, y: q.y, rot: (ed.drot || 0) * Math.PI / 2, sc: 1 }); }
  ed.typed = ''; ed.render(); status(ed);
}
function finishPline(ed, closed) {
  const S = ed.dd; if (!S) return;
  if (S.pts.length >= 2) add(ed, { t: 'pline', closed: !!closed && S.pts.length > 2, pts: S.pts.map(p => [p.x, p.y]) });
  S.pts = []; ed.render(); status(ed);
}
function status(ed) {
  const T = ed.dtool || 'line', n = ed.dd ? ed.dd.pts.length : 0;
  const next = { line: n ? 'Next point (or type a length, @x,y, length<angle). Esc to stop.' : 'First point (click, or type x,y and Enter).', pline: n ? `Next corner (${n} so far). Enter finishes, C closes.` : 'First corner.', rect: n ? 'The other corner, or type width,height.' : 'First corner.', circle: n ? 'A point on the circle, or type the radius.' : 'The center.', arc: ['The start of the arc.', 'A point along the arc.', 'The end of the arc.'][n], dim: ['The first point to measure.', 'The second point.', 'Where the dimension line goes.'][n] }[T];
  ed.status(next || TOOLS[T]);
}
function key(ed, e) {
  if (ed.tool !== 'draft') return false;
  const k = e.key, S = ed.dd || (ed.dd = { pts: [] }), T = ed.dtool || 'line';
  if (e.ctrlKey || e.metaKey) return false;
  if (k === 'Escape') { if (S.pts.length || ed.typed) { if (T === 'pline' && S.pts.length >= 2) finishPline(ed, false); S.pts = []; ed.typed = ''; ed.render(); status(ed); return true; } return false; }
  if (T === 'insert' && (k === 'r' || k === 'R')) { ed.drot = ((ed.drot || 0) + 1) % 4; ed.render(); return true; }
  if (T === 'pline' && (k === 'c' || k === 'C') && !ed.typed && S.pts.length > 2) { finishPline(ed, true); return true; }
  if (/^[0-9.'"\- /,@<]$/.test(k)) { ed.typed = (ed.typed || '') + k; ed.status('Typed: ' + ed.typed + '   (Enter)'); ed.render(); return true; }
  if (k === 'Backspace' && ed.typed) { ed.typed = ed.typed.slice(0, -1); ed.status('Typed: ' + ed.typed); ed.render(); return true; }
  if (k === 'Enter') {
    if (!ed.typed) { if (T === 'pline') { finishPline(ed, false); return true; } if (T === 'line') { S.pts = []; status(ed); ed.render(); return true; } return true; }
    const str = ed.typed; ed.typed = '';
    const last = S.pts[S.pts.length - 1], C = ed.cursor ? snap(ed, ed.cursor.x, ed.cursor.y, last || null, e.altKey) : null;
    if ((T === 'circle') && S.pts.length === 1 && !/[,<@]/.test(str)) { const r = global.Plan3DEditor.parseLen(str, 'ft'); if (r > 0) { add(ed, { t: 'circle', cx: last.x, cy: last.y, r }); S.pts = []; } ed.render(); status(ed); return true; }
    if (T === 'rect' && S.pts.length === 1 && str.includes(',') && !str.startsWith('@')) { const [a, b] = str.split(','), w = global.Plan3DEditor.parseLen(a, 'ft'), h = global.Plan3DEditor.parseLen(b, 'ft'); if (isFinite(w) && isFinite(h)) click(ed, { x: last.x + w, y: last.y + h }); return true; }
    const q = typedPoint(ed, str, last, C);
    if (q) click(ed, q); else ed.status('Couldn’t read “' + str + '”. Try 10\'6", @4,3 or 12<45.');
    ed.render(); return true;
  }
  return false;
}
function preview(ed, g) {
  if (ed.tool !== 'draft' || !ed.cursor) return;
  const T = ed.dtool || 'line', S = ed.dd || { pts: [] }, P = S.pts, last = P[P.length - 1];
  if (T === 'trim' || T === 'extend' || T === 'offset') return;
  const q = snap(ed, ed.cursor.x, ed.cursor.y, last || null, false), col = '#f2c84b', X = (x) => ed.sx(x), Y = (y) => ed.sy(y);
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.2; g.setLineDash([5, 4]);
  const lbl = (txt, x, y) => { g.setLineDash([]); g.font = '600 11px Consolas, monospace'; const w = g.measureText(txt).width; g.fillStyle = 'rgba(23,29,32,.9)'; g.fillRect(X(x) + 12, Y(y) - 26, w + 10, 17); g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, X(x) + 17, Y(y) - 17.5); };
  const F = global.Plan3DEditor.fmt;
  if ((T === 'line' || T === 'pline') && last) {
    g.beginPath(); if (T === 'pline') P.forEach((p, i) => i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))); else g.moveTo(X(last.x), Y(last.y)); g.lineTo(X(q.x), Y(q.y)); g.stroke();
    const d = Math.hypot(q.x - last.x, q.y - last.y), a = Math.atan2(-(q.y - last.y), q.x - last.x) * 180 / Math.PI; lbl(F(d) + '  ' + ((a + 360) % 360).toFixed(1) + '°', q.x, q.y);
  }
  if (T === 'rect' && last) { g.strokeRect(X(Math.min(last.x, q.x)), Y(Math.min(last.y, q.y)), Math.abs(q.x - last.x) * ed.view.s, Math.abs(q.y - last.y) * ed.view.s); lbl(F(Math.abs(q.x - last.x)) + ' × ' + F(Math.abs(q.y - last.y)), q.x, q.y); }
  if (T === 'circle' && last) { const r = Math.hypot(q.x - last.x, q.y - last.y); g.beginPath(); g.arc(X(last.x), Y(last.y), r * ed.view.s, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(X(last.x), Y(last.y)); g.lineTo(X(q.x), Y(q.y)); g.stroke(); lbl('R ' + F(r), q.x, q.y); }
  if (T === 'arc' && P.length === 1) { g.beginPath(); g.moveTo(X(P[0].x), Y(P[0].y)); g.lineTo(X(q.x), Y(q.y)); g.stroke(); }
  if (T === 'arc' && P.length === 2) { const A = arc3([P[0].x, P[0].y], [P[1].x, P[1].y], [q.x, q.y]); if (A) { g.beginPath(); g.arc(X(A.cx), Y(A.cy), A.r * ed.view.s, A.a0, A.a0 + (norm(A.a1 - A.a0) || TAU)); g.stroke(); lbl('R ' + F(A.r), q.x, q.y); } }
  if (T === 'dim' && P.length) { const a = P[0], b = P[1] || q; g.beginPath(); g.moveTo(X(a.x), Y(a.y)); g.lineTo(X(b.x), Y(b.y)); g.stroke(); if (P.length === 2) { const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = (b.y - a.y) / L, ny = -(b.x - a.x) / L, off = (q.x - a.x) * nx + (q.y - a.y) * ny; g.setLineDash([]); strokeEnt(ed, g, ed.plan, { t: 'dim', x1: a.x, y1: a.y, x2: b.x, y2: b.y, off, ph: 3 / 32 }, col, 1.2); } else lbl(F(Math.hypot(b.x - a.x, b.y - a.y)), q.x, q.y); }
  if (T === 'insert' && ed.dblock && ed.plan.draft && ed.plan.draft.blocks[ed.dblock]) { g.setLineDash([]); g.globalAlpha = 0.7; strokeEnt(ed, g, ed.plan, { t: 'insert', block: ed.dblock, x: q.x, y: q.y, rot: (ed.drot || 0) * Math.PI / 2, sc: 1 }, col, 1.2); }
  g.restore();
  drawSnap(ed, g, q);
  if (P.length && (T === 'line' || T === 'pline' || T === 'arc' || T === 'dim' || T === 'rect' || T === 'circle')) { g.save(); g.fillStyle = col; for (const p of P) { g.beginPath(); g.arc(X(p.x), Y(p.y), 2.5, 0, TAU); g.fill(); } g.restore(); }
}

/* ---------- edit commands (on the selected drawing) ---------- */
function selEnts(ed) { const refs = ed.multi || (ed.sel ? [ed.sel] : []), P = ed.plan; return refs.filter(r => r.kind === 'dent').map(r => P.draft && P.draft.ents.find(e => e.id === r.id)).filter(Boolean); }
function applyM(ed, M, copy, n) {
  const L = selEnts(ed); if (!L.length) return 0; const ids = new Set(L.map(e => e.id)), made = [];
  ed.edit(P => {
    const E = P.draft.ents, src = E.filter(e => ids.has(e.id));
    if (!copy) { for (const e of src) xform(e, M); return; }
    let cur = src.map(e => JSON.parse(JSON.stringify(e)));
    for (let k = 0; k < (n || 1); k++) { cur = cur.map(e => xform(JSON.parse(JSON.stringify(e)), M)); for (const e of cur) { const c = JSON.parse(JSON.stringify(e)); c.id = uid(); delete c.gid; E.push(c); made.push(c.id); } }
  });
  if (copy && made.length) ed.setMulti(made.map(id => ({ kind: 'dent', id })));
  return L.length;
}
const cmd = {
  move: (ed, dx, dy) => applyM(ed, MOVE(dx, dy), false),
  copy: (ed, dx, dy, n) => applyM(ed, MOVE(dx, dy), true, n || 1),
  rotate: (ed, deg, copy) => { const [cx, cy] = center(ed.plan, selEnts(ed)); return applyM(ed, ROT(cx, cy, -deg * Math.PI / 180), !!copy); },
  scale: (ed, k) => { const [cx, cy] = center(ed.plan, selEnts(ed)); return applyM(ed, SCALE(cx, cy, k), false); },
  mirror: (ed, axis, keep) => { const [cx, cy] = center(ed.plan, selEnts(ed)); return applyM(ed, axis === 'h' ? MIRROR(cx - 1, cy, cx + 1, cy) : MIRROR(cx, cy - 1, cx, cy + 1), !!keep); },
  array: (ed, rows, cols, dx, dy) => {
    const L = selEnts(ed); if (!L.length) return 0; const made = [];
    ed.edit(P => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (!r && !c) continue; for (const e of L) { const z = xform(JSON.parse(JSON.stringify(e)), MOVE(c * dx, r * dy)); z.id = uid(); P.draft.ents.push(z); made.push(z.id); } } });
    return made.length;
  },
  explode: (ed) => {
    const L = selEnts(ed); let n = 0;
    ed.edit(P => { const E = P.draft.ents; for (const e of L) { const i = E.findIndex(q => q.id === e.id); if (i < 0) continue; let out = null;
      if (e.t === 'insert') out = expand(P, e).map(q => ({ ...q, id: uid() }));
      else if (e.t === 'pline') out = pieces(P, e).map(q => ({ t: 'line', id: uid(), layer: e.layer, x1: q[0], y1: q[1], x2: q[2], y2: q[3] }));
      if (out) { E.splice(i, 1, ...out); n++; } } });
    ed.sel = null; ed.multi = null; ed.emit('select'); return n;
  },
  layer: (ed, id) => { const ids = new Set(selEnts(ed).map(e => e.id)); ed.edit(P => { for (const e of P.draft.ents) if (ids.has(e.id)) e.layer = id; }); },
  block: (ed, name) => {
    const L = selEnts(ed); if (!L.length || !name) return false;
    const [, , x0, y0] = center(ed.plan, L), ids = new Set(L.map(e => e.id)); let id = null;
    ed.edit(P => { const D = P.draft; D.blocks[name] = { ents: L.map(e => { const z = xform(JSON.parse(JSON.stringify(e)), MOVE(-x0, -y0)); delete z.id; return z; }) }; D.ents = D.ents.filter(e => !ids.has(e.id)); const ins = { id: uid(), t: 'insert', block: name, x: x0, y: y0, rot: 0, sc: 1, layer: D.cur }; D.ents.push(ins); id = ins.id; });
    ed.multi = null; ed.sel = { kind: 'dent', id }; ed.emit('select'); ed.render(); return true;
  }
};
// offset: the selected lines, polylines, circles and arcs copied a distance away, to the side clicked
function offsetTo(ed, x, y) {
  const d = ed.doffset || 1, L = selEnts(ed); if (!L.length) { ed.status('Select the lines, circles or arcs to offset first (Select tool), then use Offset.'); return; }
  const made = [];
  ed.edit(P => { for (const e of L) { const z = offsetEnt(e, d, x, y); if (z) { z.id = uid(); z.layer = e.layer; P.draft.ents.push(z); made.push(z.id); } } });
  ed.status(made.length ? `Offset ${made.length} by ${global.Plan3DEditor.fmt(d)}. Click again for another, Esc when done.` : 'Offset works on lines, polylines, circles and arcs.');
}
function offsetEnt(e, d, x, y) {
  if (e.t === 'line') { const dx = e.x2 - e.x1, dy = e.y2 - e.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, sd = ((x - e.x1) * nx + (y - e.y1) * ny) >= 0 ? 1 : -1; return { t: 'line', x1: e.x1 + nx * d * sd, y1: e.y1 + ny * d * sd, x2: e.x2 + nx * d * sd, y2: e.y2 + ny * d * sd }; }
  if (e.t === 'circle' || e.t === 'arc') { const out = Math.hypot(x - e.cx, y - e.cy) > e.r, r = e.r + (out ? d : -d); if (r <= 1e-6) return null; return { ...JSON.parse(JSON.stringify(e)), r }; }
  if (e.t === 'pline') {
    const p = e.pts, n = p.length, segs = []; for (let i = 0; i + 1 < n + (e.closed ? 1 : 0); i++) segs.push([p[i], p[(i + 1) % n]]);
    // the side: from the segment nearest the click
    let bi = 0, bd = 1e18; segs.forEach((s, i) => { const q = segD(x, y, s[0][0], s[0][1], s[1][0], s[1][1]); if (q < bd) { bd = q; bi = i; } });
    const s0 = segs[bi], L0 = Math.hypot(s0[1][0] - s0[0][0], s0[1][1] - s0[0][1]) || 1, sd = ((x - s0[0][0]) * -(s0[1][1] - s0[0][1]) / L0 + (y - s0[0][1]) * (s0[1][0] - s0[0][0]) / L0) >= 0 ? 1 : -1;
    const off = segs.map(([a, b]) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L * d * sd, ny = (b[0] - a[0]) / L * d * sd; return [a[0] + nx, a[1] + ny, b[0] + nx, b[1] + ny]; });
    const out = [];
    for (let i = 0; i < n; i++) {
      const prev = e.closed ? off[(i - 1 + off.length) % off.length] : off[i - 1], next = off[i] || null;
      if (prev && next) { const X = segX(prev, next); out.push(X ? [X.x, X.y] : [next[0], next[1]]); } else if (next) out.push([next[0], next[1]]); else out.push([prev[2], prev[3]]);
    }
    return { t: 'pline', closed: e.closed, pts: out };
  }
  return null;
}
// the lines (and walls) a line runs into: t values along it
function cutsOn(P, e, q) {
  const ts = [];
  for (const o of P.draft.ents) { if (o === e || !shown(P, o)) continue;
    if (o.t === 'circle' || o.t === 'arc') { ts.push(...lineCircle(q, o)); continue; }
    for (const s of pieces(P, o)) { const X = segX(q, s); if (X && X.u >= -1e-9 && X.u <= 1 + 1e-9) ts.push(X.t); } }
  for (const w of P.walls || []) { const X = segX(q, [w.x1, w.y1, w.x2, w.y2]); if (X && X.u >= -1e-9 && X.u <= 1 + 1e-9) ts.push(X.t); }
  return ts;
}
function trimAt(ed, x, y) {
  const P = ed.plan, h = hit(ed, x, y), e = h && P.draft.ents.find(q => q.id === h.id);
  if (!e || e.t !== 'line') { ed.status('Trim works on lines: click the part of a line to cut away.'); return; }
  const q = [e.x1, e.y1, e.x2, e.y2], dx = q[2] - q[0], dy = q[3] - q[1], L2 = dx * dx + dy * dy || 1, tc = ((x - q[0]) * dx + (y - q[1]) * dy) / L2;
  const ts = cutsOn(P, e, q).filter(t => t > 1e-6 && t < 1 - 1e-6).sort((a, b) => a - b);
  const lo = Math.max(0, ...ts.filter(t => t < tc)), hi = Math.min(1, ...ts.filter(t => t > tc));
  if (!ts.length) { ed.status('Nothing crosses that line, so there is nothing to trim it to (Delete removes it).'); return; }
  ed.edit(P2 => { const E = P2.draft.ents, i = E.findIndex(z => z.id === e.id), o = E[i], keep = [];
    if (lo > 1e-6) keep.push({ ...o, id: uid(), x2: q[0] + dx * lo, y2: q[1] + dy * lo });
    if (hi < 1 - 1e-6) keep.push({ ...o, id: uid(), x1: q[0] + dx * hi, y1: q[1] + dy * hi });
    E.splice(i, 1, ...keep); });
  ed.sel = null; ed.emit('select'); ed.status('Trimmed. Click another piece to trim, Esc when done.');
}
function extendAt(ed, x, y) {
  const P = ed.plan, h = hit(ed, x, y), e = h && P.draft.ents.find(q => q.id === h.id);
  if (!e || e.t !== 'line') { ed.status('Extend works on lines: click near the end to stretch.'); return; }
  const endB = Math.hypot(x - e.x2, y - e.y2) < Math.hypot(x - e.x1, y - e.y1), q = [e.x1, e.y1, e.x2, e.y2], dx = q[2] - q[0], dy = q[3] - q[1];
  const ts = cutsOn(P, e, q), t = endB ? Math.min(...ts.filter(v => v > 1 + 1e-6)) : Math.max(...ts.filter(v => v < -1e-6));
  if (!isFinite(t)) { ed.status('Nothing in line with that end to extend it to.'); return; }
  ed.edit(P2 => { const o = P2.draft.ents.find(z => z.id === e.id); if (endB) { o.x2 = q[0] + dx * t; o.y2 = q[1] + dy * t; } else { o.x1 = q[0] + dx * t; o.y1 = q[1] + dy * t; } });
  ed.status('Extended. Click another line end, Esc when done.');
}

/* ---------- attach a drawing (an xref): a DWG / DXF's lines, arcs and text on a layer of its own, locked ---------- */
function attach(ed, r, name) {
  const I = global.Plan3DImport, k = (I && I.UNIT_FT && I.UNIT_FT[r.insunits]) || 1 / 12, d = r.data || r;
  const segs = d.segs || [], arcs = d.arcs || [], labels = d.labels || [];
  let x0 = 1e18, y0 = -1e18; for (const s of segs) { x0 = Math.min(x0, s[0], s[2]); y0 = Math.max(y0, s[1], s[3]); }
  if (!(x0 < 1e17)) { x0 = 0; y0 = 0; }
  const C = ed.cursor || { x: ed.wx(ed.W / 2), y: ed.wy(ed.H / 2) }, X = (x) => (x - x0) * k + C.x, Y = (y) => (y0 - y) * k + C.y;
  const lid = 'x' + uid(), ents = [];
  for (const s of segs) ents.push({ id: uid(), t: 'line', layer: lid, x1: X(s[0]), y1: Y(s[1]), x2: X(s[2]), y2: Y(s[3]) });
  for (const a of arcs) { const r0 = a.r * k, a0 = -(a.a1 || 0), a1 = -(a.a0 || 0); ents.push({ id: uid(), t: 'arc', layer: lid, cx: X(a.x), cy: Y(a.y), r: r0, a0: norm(a0), a1: norm(a1) }); }
  for (const l of labels) ents.push({ id: uid(), t: 'text', layer: lid, x: X(l.x), y: Y(l.y), str: l.text, ph: 3 / 32, rot: 0 });
  ed.edit(P => { const D = data(P, true); D.layers.push({ id: lid, name: 'XREF ' + (name || 'drawing'), color: '#9aa5ab', on: true, lock: true, xref: name || true }); D.ents.push(...ents); });
  return ents.length;
}

/* ---------- the plan sheet (SVG) and the DWG / DXF export ---------- */
// SVG of the drawing for the plan sheet. X, Y: plan feet → sheet inches; k: sheet inches per foot
function svg(P, X, Y, k) {
  const D = P.draft; if (!D || !D.ents.length) return '';
  const n3 = (v) => +(+v).toFixed(4), out = ['<g class="drafting" fill="none" stroke="#111" stroke-width="0.006" stroke-linecap="round">'];
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const one = (e) => {
    if (e.t === 'line') out.push(`<line x1="${X(e.x1)}" y1="${Y(e.y1)}" x2="${X(e.x2)}" y2="${Y(e.y2)}"/>`);
    else if (e.t === 'pline') out.push(`<${e.closed ? 'polygon' : 'polyline'} points="${e.pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>`);
    else if (e.t === 'circle') out.push(`<circle cx="${X(e.cx)}" cy="${Y(e.cy)}" r="${n3(e.r * k)}"/>`);
    else if (e.t === 'arc') { const sw = norm(e.a1 - e.a0) || TAU, p0 = [e.cx + e.r * Math.cos(e.a0), e.cy + e.r * Math.sin(e.a0)], p1 = [e.cx + e.r * Math.cos(e.a0 + sw), e.cy + e.r * Math.sin(e.a0 + sw)]; out.push(`<path d="M${X(p0[0])},${Y(p0[1])} A${n3(e.r * k)},${n3(e.r * k)} 0 ${sw > Math.PI ? 1 : 0} 1 ${X(p1[0])},${Y(p1[1])}"/>`); }
    else if (e.t === 'text') { const h = textH(P, e) * k; out.push(`<text x="${X(e.x)}" y="${Y(e.y)}" font-size="${n3(h)}" fill="#111" stroke="none" transform="rotate(${n3((e.rot || 0) * 180 / Math.PI)} ${X(e.x)} ${Y(e.y)})">${esc(e.str || '')}</text>`); }
    else if (e.t === 'dim') { const G = dimGeom(P, e); for (const q of G.lines) out.push(`<line x1="${X(q[0])}" y1="${Y(q[1])}" x2="${X(q[2])}" y2="${Y(q[3])}"/>`); out.push(`<text x="${X(G.tx)}" y="${Y(G.ty)}" font-size="${n3(textH(P, e) * k)}" fill="#111" stroke="none" text-anchor="middle" transform="rotate(${n3(G.rot * 180 / Math.PI)} ${X(G.tx)} ${Y(G.ty)})">${esc(G.str)}</text>`); }
    else if (e.t === 'insert') expand(P, e).forEach(one);
  };
  for (const e of D.ents) if (shown(P, e)) one(e);
  out.push('</g>'); return out.join('');
}
// the drawing's layers for the DXF layer table: [name, colour number]
function dxfLayers(P) { const D = P.draft; if (!D) return []; return D.layers.map(l => [dxfName(l.name), ACI[l.color] || 7, l.on === false]); }
const dxfName = (n) => String(n || '0').replace(/[<>\/\\":;?*|,=`]/g, '-').slice(0, 60) || '0';
// entities into a DXF (R12) entity list: put(code, value, …); X, Y: plan feet → drawing inches (y up)
function dxf(P, put, X, Y, txt) {
  const D = P.draft; if (!D) return;
  const r6 = (v) => +(+v).toFixed(6), deg = (a) => r6(((-a * 180 / Math.PI) % 360 + 360) % 360);
  const one = (e) => {
    const lay = dxfName(layerOf(P, e.layer).name);
    if (e.t === 'line') put(0, 'LINE', 8, lay, 10, X(e.x1), 20, Y(e.y1), 30, 0, 11, X(e.x2), 21, Y(e.y2), 31, 0);
    else if (e.t === 'pline') { put(0, 'POLYLINE', 8, lay, 66, 1, 10, 0, 20, 0, 30, 0, 70, e.closed ? 1 : 0); for (const p of e.pts) put(0, 'VERTEX', 8, lay, 10, X(p[0]), 20, Y(p[1]), 30, 0); put(0, 'SEQEND', 8, lay); }
    else if (e.t === 'circle') put(0, 'CIRCLE', 8, lay, 10, X(e.cx), 20, Y(e.cy), 30, 0, 40, r6(e.r * 12));
    else if (e.t === 'arc') put(0, 'ARC', 8, lay, 10, X(e.cx), 20, Y(e.cy), 30, 0, 40, r6(e.r * 12), 50, deg(e.a1), 51, deg(e.a0));
    else if (e.t === 'text') put(0, 'TEXT', 8, lay, 10, X(e.x), 20, Y(e.y), 30, 0, 40, r6(textH(P, e) * 12), 1, txt(e.str || ''), 50, deg(e.rot || 0));
    else if (e.t === 'dim') { const G = dimGeom(P, e); for (const q of G.lines) put(0, 'LINE', 8, lay, 10, X(q[0]), 20, Y(q[1]), 30, 0, 11, X(q[2]), 21, Y(q[3]), 31, 0); const h = textH(P, e), w = G.str.length * h * 0.6, c = Math.cos(G.rot), s = Math.sin(G.rot); put(0, 'TEXT', 8, lay, 10, X(G.tx - c * w / 2), 20, Y(G.ty - s * w / 2), 30, 0, 40, r6(h * 12), 1, txt(G.str), 50, deg(G.rot)); }
    else if (e.t === 'insert') expand(P, e).forEach(one);
  };
  for (const e of D.ents) one(e);
}
// turn the whole drawing with the plan (the plan sheet turns a tall plan a quarter turn)
function xformPlan(P, F) { const D = P.draft; if (!D) return; const o = F(0, 0), ax = F(1, 0), ay = F(0, 1), M = [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]]; D.ents.forEach(e => xform(e, M)); }

global.Plan3DDraft = { add, data, layerOf, shown, editable, COLORS, SCALES, TOOLS, bounds, pts, pieces, xform, MOVE, hit, drawAll, outline, preview, down, key, click, finishPline, status, cmd, selEnts, snap, center, attach, svg, dxf, dxfLayers, xformPlan, textH, dimText, expand };
})(window);
