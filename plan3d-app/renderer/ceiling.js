/* Coll Plan3D — ceiling drawings (reflected ceiling plans).
   Reads the T-grid, light fixtures and fan filter units out of a DXF / DWG ceiling drawing, or takes a
   picture of one, and lines it up over the floor plan so the 3D model shows the real ceiling.
   Result on the plan:
     plan.ceilingGrid   [[x1, y1, x2, y2], …]  grid lines, plan feet
     plan.fixtures      [{ id, type: 'led'|'ffu', x, y, w, h }]  with plan.ceilingMode = 'manual'
     plan.ceilingImage  { dataUrl, x, y, w, h, rot }  a picture laid on the ceiling
     plan.ceilingSource name of the drawing it came from
   Coll Business Solutions LLC */
(function (global) {
'use strict';
const V = global.Plan3DViewer;

const RX_FFU = /ffu|fan.?filter|hepa|filter|\bfan\b/i;
const RX_LED = /led|light|lite|lgt|lum|troff|fixt|lamp|\blt\b|^l\d|^lt/i;
const RX_GRID = /grid|clg|ceil|rcp|tile|t-?bar|susp|act\b/i;
const RX_NOT_GRID = /fixt|light|lite|ffu|led|lum|anno|text|dim|tag|hatch/i;
const RX_WALL = /wall|partition|panel|^a-wall/i;

const uidc = () => Math.random().toString(36).slice(2, 10);
const round = (v, q) => Math.round(v / q) * q;

/* Group the rectangles in a drawing that are the size of a ceiling fixture (about 1′ to 6′ a side).
   unitFt: feet per drawing unit. Returns groups [{key, layer, name, w, h, count, type, items}]. */
function fixtureGroups(data, unitFt) {
  const k = unitFt, groups = new Map();
  const labels = (data.labels || []);
  // the same fixture can be both a block and the outline drawn inside it: keep the block
  const list = (data.rects || []).slice().sort((a, b) => (a.kind === 'block' ? 0 : 1) - (b.kind === 'block' ? 0 : 1));
  const seen = new Map(), cell = 0.5 / k;
  const dup = (r) => {
    const gx = Math.round(r.cx / cell), gy = Math.round(r.cy / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of seen.get((gx + i) + ',' + (gy + j)) || [])
      if (Math.abs(q.cx - r.cx) < cell && Math.abs(q.cy - r.cy) < cell && Math.abs(q.w - r.w) < cell && Math.abs(q.h - r.h) < cell) return q;
    const key = gx + ',' + gy; (seen.get(key) || seen.set(key, []).get(key)).push(r); return null;
  };
  for (const r of list) {
    const w = r.w * k, h = r.h * k, lo = Math.min(w, h), hi = Math.max(w, h);
    if (lo < 0.9 || hi > 6.2 || hi / lo > 4.5) continue;
    const same = dup(r);
    if (same) { same.also = (same.also || []).concat([r]); continue; }
    // a label inside the rectangle, like "FFU" or "LED", decides the type for that one
    let tag = '';
    for (const l of labels) if (Math.abs(l.x - r.cx) <= r.w / 2 && Math.abs(l.y - r.cy) <= r.h / 2) { tag = l.text; break; }
    const sizeKey = round(lo, 0.5) + 'x' + round(hi, 0.5);
    const tagType = RX_FFU.test(tag) ? 'ffu' : RX_LED.test(tag) ? 'led' : '';
    const key = r.layer + '|' + (r.name || '') + '|' + sizeKey + '|' + tagType;
    let g = groups.get(key);
    if (!g) {
      const txt = (r.name || '') + ' ' + r.layer;
      // plumbing fixtures (sinks, toilets, showers) are 'fixtures' too, but not ceiling ones
      const type = /sanr|plumb|toilet|sink|shwr|shower|lav|urinal|\btlt\b|pfix|drain/i.test(txt) ? 'ignore' : tagType || (RX_FFU.test(txt) ? 'ffu' : RX_LED.test(txt) ? 'led' : 'ignore');
      g = { key, layer: r.layer, name: r.name || '', w: round(lo, 0.5), h: round(hi, 0.5), tag: tagType ? tag : '', count: 0, type, items: [] };
      groups.set(key, g);
    }
    g.count++; g.items.push(r);
  }
  // a rectangle can show up twice (block outline and the polyline inside it): keep one per spot
  const all = [...groups.values()].sort((a, b) => b.count - a.count);
  return all;
}

function gridLayerList(data) {
  return Object.keys(data.layers || {}).sort((a, b) => data.layers[b] - data.layers[a])
    .map(n => ({ name: n, count: data.layers[n], grid: RX_GRID.test(n) && !RX_NOT_GRID.test(n), wall: RX_WALL.test(n) }));
}

/* Build the placed ceiling from a CAD drawing.
   o: { unitFt, gridLayers:Set, types:{groupKey:type}, groups, refLayer ('' = grid + fixtures), rot (deg), dx, dy } */
function placeCad(data, plan, o) {
  const A = V.analyze(plan), B = A.bounds, k = o.unitFt;
  const rot = ((o.rot || 0) % 360 + 360) % 360, c = Math.round(Math.cos(rot * Math.PI / 180)), s = Math.round(Math.sin(rot * Math.PI / 180));
  // drawing units (y up) → feet (y down), turned
  const tf = (x, y) => { const X = x * k, Y = -y * k; return [X * c - Y * s, X * s + Y * c]; };
  // fixtures
  const fixtures = [], used = new Set();
  for (const g of o.groups) {
    const type = o.types[g.key] || g.type; if (type === 'ignore') continue;
    for (const r of g.items) {
      const [x, y] = tf(r.cx, r.cy);
      if (fixtures.some(f => Math.abs(f.x - x) < 0.3 && Math.abs(f.y - y) < 0.3)) { for (let i = 0; i < r.sn; i++) used.add(r.si + i); continue; }
      const quarter = rot % 180 !== 0;
      const w = (quarter ? r.h : r.w) * k, h = (quarter ? r.w : r.h) * k;
      fixtures.push({ id: uidc(), type, x, y, w, h });
      for (let i = 0; i < r.sn; i++) used.add(r.si + i);
      for (const q of r.also || []) for (let i = 0; i < q.sn; i++) used.add(q.si + i);
    }
  }
  // grid lines on the chosen layers, minus fixture outlines
  let grid = [];
  data.segs.forEach((q, i) => {
    if (used.has(i) || !o.gridLayers.has(q[4])) return;
    const a = tf(q[0], q[1]), b = tf(q[2], q[3]);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) return;
    grid.push([a[0], a[1], b[0], b[1]]);
  });
  // the outline used to line it up: a chosen layer (walls on the ceiling drawing), or the grid and fixtures
  let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
  const ext = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  if (o.refLayer) for (const q of data.segs) { if (q[4] !== o.refLayer) continue; const a = tf(q[0], q[1]), b = tf(q[2], q[3]); ext(a[0], a[1]); ext(b[0], b[1]); }
  if (x0 > x1) { for (const g of grid) { ext(g[0], g[1]); ext(g[2], g[3]); } for (const f of fixtures) { ext(f.x - f.w / 2, f.y - f.h / 2); ext(f.x + f.w / 2, f.y + f.h / 2); } }
  if (x0 > x1) return { grid: [], fixtures: [], ref: null };
  // centre it on the room, then the nudge
  const mx = B.cx - (x0 + x1) / 2 + (o.dx || 0), my = B.cz - (y0 + y1) / 2 + (o.dy || 0);
  grid = grid.map(g => [g[0] + mx, g[1] + my, g[2] + mx, g[3] + my]);
  fixtures.forEach(f => { f.x += mx; f.y += my; });
  // keep only what's over the room
  const pad = 0.6, inB = (x, y) => x >= B.minX - pad && x <= B.maxX + pad && y >= B.minZ - pad && y <= B.maxZ + pad;
  grid = grid.map(g => clipSeg(g, B.minX - 0.15, B.minZ - 0.15, B.maxX + 0.15, B.maxZ + 0.15)).filter(Boolean);
  const kept = fixtures.filter(f => inB(f.x, f.y));
  return { grid, fixtures: kept, outside: fixtures.length - kept.length, ref: { w: x1 - x0, h: y1 - y0 } };
}

// Liang–Barsky clip of a segment to a box
function clipSeg(g, xmin, ymin, xmax, ymax) {
  let [x1, y1, x2, y2] = g, t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
  const P = [-dx, dx, -dy, dy], Q = [x1 - xmin, xmax - x1, y1 - ymin, ymax - y1];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(P[i]) < 1e-12) { if (Q[i] < 0) return null; continue; }
    const t = Q[i] / P[i];
    if (P[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  if (t1 - t0 < 1e-6) return null;
  return [x1 + dx * t0, y1 + dy * t0, x1 + dx * t1, y1 + dy * t1];
}

/* A picture of the ceiling, stretched over the room outline (turned if asked). */
function placeImage(plan, dataUrl, o) {
  const B = V.analyze(plan).bounds;
  return { dataUrl, x: B.cx + (o.dx || 0), y: B.cz + (o.dy || 0), w: B.w, h: B.d, rot: o.rot || 0 };
}

/* Move or turn a ceiling that is already on the plan (turning is about the room's centre). */
function shiftCeiling(P, dx, dy, rot) {
  const B = V.analyze(P).bounds, a = (rot || 0) * Math.PI / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  const T = (x, y) => { const X = x - B.cx, Y = y - B.cz; return [B.cx + X * c - Y * s + dx, B.cz + X * s + Y * c + dy]; };
  if (P.ceilingGrid) P.ceilingGrid = P.ceilingGrid.map(g => { const a1 = T(g[0], g[1]), b1 = T(g[2], g[3]); return [a1[0], a1[1], b1[0], b1[1]]; });
  if (P.ceilingSource && P.fixtures) P.fixtures.forEach(f => { const [x, y] = T(f.x, f.y); f.x = x; f.y = y; if (rot % 180 && f.w) { const t = f.w; f.w = f.h; f.h = t; } });
  if (P.ceilingImage) { const I = P.ceilingImage, [x, y] = T(I.x, I.y); I.x = x; I.y = y; I.rot = ((I.rot || 0) + (rot || 0)) % 360; }
  for (const t of P.ceilTiles || []) { const [x, y] = T(t.x, t.y); t.x = x; t.y = y; if (rot % 180) { const w = t.w; t.w = t.h; t.h = w; } }
  if ((P.ceilTiles || []).length) P.ceilRects = V.builtRects(P);
}

function removeCeiling(P) {
  delete P.ceilingGrid; delete P.ceilingImage; delete P.ceilingSource; delete P.ceilRects; delete P.ceilTiles; delete P.gridZones; delete P.ceilSkip; delete P.ceilForce;
  P.fixtures = []; P.ceilingMode = 'auto';
}

/* Small top-down preview: walls in grey, grid in blue, LEDs white, FFUs teal, the picture underneath. */
function drawPreview(canvas, plan, placed, img) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  g.fillStyle = '#0f1416'; g.fillRect(0, 0, W, H);
  const A = V.analyze(plan), B = A.bounds, pad = 18;
  const sc = Math.min((W - pad * 2) / (B.w + 2), (H - pad * 2) / (B.d + 2));
  const ox = W / 2 - B.cx * sc, oy = H / 2 - B.cz * sc;
  const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;
  if (img && placed && placed.image) {
    const I = placed.image; g.save(); g.translate(X(I.x), Y(I.y)); g.rotate((I.rot || 0) * Math.PI / 180); g.globalAlpha = 0.85;
    const q = (I.rot || 0) % 180 ? [I.h, I.w] : [I.w, I.h];
    g.drawImage(img, -q[0] * sc / 2, -q[1] * sc / 2, q[0] * sc, q[1] * sc); g.restore();
  }
  if (placed && placed.grid) { g.strokeStyle = 'rgba(120,170,220,.75)'; g.lineWidth = 1; g.beginPath(); for (const q of placed.grid) { g.moveTo(X(q[0]), Y(q[1])); g.lineTo(X(q[2]), Y(q[3])); } g.stroke(); }
  if (placed && placed.fixtures) for (const f of placed.fixtures) {
    g.fillStyle = f.type === 'ffu' ? 'rgba(127,211,227,.55)' : 'rgba(255,255,255,.75)';
    g.fillRect(X(f.x - f.w / 2), Y(f.y - f.h / 2), f.w * sc, f.h * sc);
  }
  g.fillStyle = '#9aa4a8';
  for (const p of A.pieces) {
    const L = Math.hypot(p.x2 - p.x1, p.z2 - p.z1) || 1, nx = -(p.z2 - p.z1) / L * p.t / 2, nz = (p.x2 - p.x1) / L * p.t / 2;
    g.beginPath(); g.moveTo(X(p.x1 + nx), Y(p.z1 + nz)); g.lineTo(X(p.x2 + nx), Y(p.z2 + nz)); g.lineTo(X(p.x2 - nx), Y(p.z2 - nz)); g.lineTo(X(p.x1 - nx), Y(p.z1 - nz)); g.closePath(); g.fill();
    g.strokeStyle = '#c9d1d4'; g.lineWidth = Math.max(1, p.t * sc); g.beginPath(); g.moveTo(X(p.x1), Y(p.z1)); g.lineTo(X(p.x2), Y(p.z2)); g.stroke();
  }
}

/* Light fixtures out of a lighting drawing, however they were drawn: blocks and closed polylines, or four loose
   lines (an exploded fixture). The symbol inside says what it is:
     a diagonal across it            a light
     cross-hatching (a fill)          an emergency light (battery backup)
     a circle / arcs in the middle    an FFU
   k: feet per drawing unit. Returns [{ cx, cy (drawing units), w, h (feet, long side first), along ('x'|'y' on
   the sheet), type: 'led'|'ffu', em }]. */
function lightsFromDrawing(data, k) {
  const segs = data.segs || [], tol = (0.6 / 12) / k, lo = 0.9 / k, hi = 6.2 / k;
  const key = (x, y) => Math.round(x / tol) + ',' + Math.round(y / tol);
  const at = new Map();
  segs.forEach((q, i) => { for (const e of [0, 1]) { const x = q[e * 2], y = q[e * 2 + 1], kk = key(x, y); (at.get(kk) || at.set(kk, []).get(kk)).push(i); } });
  const near = (x, y) => { const gx = Math.round(x / tol), gy = Math.round(y / tol), out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of at.get((gx + i) + ',' + (gy + j)) || []) out.push(s); return out; };
  const len = (q) => Math.hypot(q[2] - q[0], q[3] - q[1]);
  const other = (q, x, y) => Math.hypot(q[0] - x, q[1] - y) < tol * 1.5 ? [q[2], q[3]] : Math.hypot(q[2] - x, q[3] - y) < tol * 1.5 ? [q[0], q[1]] : null;
  const segBetween = (a, b) => near(a[0], a[1]).some(i => { const o = other(segs[i], a[0], a[1]); return o && Math.hypot(o[0] - b[0], o[1] - b[1]) < tol * 1.5; });
  const rects = [], seen = new Set();
  const addRect = (P, Q, R, S, layer) => {
    const cx = (P[0] + Q[0] + R[0] + S[0]) / 4, cy = (P[1] + Q[1] + R[1] + S[1]) / 4, a = Math.hypot(Q[0] - P[0], Q[1] - P[1]), b = Math.hypot(R[0] - Q[0], R[1] - Q[1]);
    const ky = Math.round(cx / (tol * 4)) + ',' + Math.round(cy / (tol * 4)) + ',' + Math.round(Math.max(a, b) / (tol * 4));
    if (seen.has(ky)) return; seen.add(ky);
    const longX = a >= b ? Q[0] - P[0] : R[0] - Q[0], longY = a >= b ? Q[1] - P[1] : R[1] - Q[1], L = Math.max(a, b), W = Math.min(a, b);
    rects.push({ cx, cy, L, W, ang: Math.atan2(longY, longX), layer, pts: [P, Q, R, S] });
  };
  // closed rectangles already found (blocks, polylines)
  for (const r of data.rects || []) { const L = Math.max(r.w, r.h), W = Math.min(r.w, r.h); if (W < lo || L > hi) continue; addRect([r.cx - r.w / 2, r.cy - r.h / 2], [r.cx + r.w / 2, r.cy - r.h / 2], [r.cx + r.w / 2, r.cy + r.h / 2], [r.cx - r.w / 2, r.cy + r.h / 2], r.layer); }
  // four loose lines meeting at right angles
  segs.forEach((a) => {
    const la = len(a); if (la < lo || la > hi) return;
    for (const [P, Q] of [[[a[0], a[1]], [a[2], a[3]]], [[a[2], a[3]], [a[0], a[1]]]]) {
      const ux = (Q[0] - P[0]) / la, uy = (Q[1] - P[1]) / la;
      for (const i of near(Q[0], Q[1])) {
        const b = segs[i]; if (b === a) continue; const R = other(b, Q[0], Q[1]); if (!R) continue;
        const lb = Math.hypot(R[0] - Q[0], R[1] - Q[1]); if (lb < lo || lb > hi) continue;
        if (Math.abs(((R[0] - Q[0]) * ux + (R[1] - Q[1]) * uy) / lb) > 0.04) continue;   // square to the first side
        const S = [R[0] - (Q[0] - P[0]), R[1] - (Q[1] - P[1])];
        if (segBetween(R, S) && segBetween(S, P)) addRect(P, Q, R, S, a[4]);
      }
    }
  });
  // what's drawn inside each one
  const arcs = data.arcs || [];
  const out = [];
  for (const r of rects) {
    if (r.W * k < 0.9 || r.L * k > 6.2 || r.L / r.W > 4.5) continue;
    const c = Math.cos(r.ang), s2 = Math.sin(r.ang), loc = (x, y) => { const dx = x - r.cx, dy = y - r.cy; return [dx * c + dy * s2, -dx * s2 + dy * c]; };
    const inside = (x, y) => { const [u, v] = loc(x, y); return Math.abs(u) <= r.L / 2 + tol && Math.abs(v) <= r.W / 2 + tol; };
    const diag = Math.hypot(r.L, r.W);
    let nDiag = 0, nHatch = 0, nArc = 0;
    // only the lines near it: the ones touching its corners' cells and its middle, by a coarse scan
    for (const q of segs) {
      if (Math.abs((q[0] + q[2]) / 2 - r.cx) > r.L || Math.abs((q[1] + q[3]) / 2 - r.cy) > r.L) continue;
      if (!inside(q[0], q[1]) || !inside(q[2], q[3])) continue;
      const lq = len(q); if (lq < tol) continue;
      const [u1, v1] = loc(q[0], q[1]), [u2, v2] = loc(q[2], q[3]), du = Math.abs(u2 - u1) / lq, dv = Math.abs(v2 - v1) / lq;
      if (du > 0.995 || dv > 0.995) continue;   // the outline itself (or a line along it)
      if (Math.abs(lq - diag) < diag * 0.06) nDiag++; else nHatch++;
    }
    for (const q of arcs) if (inside(q.x, q.y) && q.r * 2 < r.W * 1.05) nArc++;
    const txt = (r.layer || '');
    let type = null, em = false;
    if (nHatch >= 6) { type = 'led'; em = true; }
    else if (nDiag >= 1) type = 'led';
    else if (nArc >= 1) type = 'ffu';
    else if (RX_LED.test(txt)) type = 'led';
    if (!type) continue;
    const alongX = Math.abs(Math.cos(r.ang)) >= Math.abs(Math.sin(r.ang));
    out.push({ cx: r.cx, cy: r.cy, w: alongX ? r.L * k : r.W * k, h: alongX ? r.W * k : r.L * k, type, em, turned: Math.min(Math.abs(Math.sin(r.ang)), Math.abs(Math.cos(r.ang))) > 0.08 });
  }
  // cross-hatching the size of a fixture with no complete outline round it (a side left off, or drawn a hair
  // apart): the fill alone is an emergency light, at the hatch's extent
  {
    const H = [];
    // (fill lines run up to a fixture's width on the slant)
    segs.forEach((q) => { const lq = len(q); if (lq < tol || lq * k > 3.2) return; const ax = Math.abs(q[2] - q[0]) / lq, ay = Math.abs(q[3] - q[1]) / lq; if (ax > 0.97 || ay > 0.97) return; H.push(q); });
    const par = H.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
    const cell = 3 / 12 / k, grid = new Map(), cKey = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
    H.forEach((q, i) => { for (const [x, y] of [[q[0], q[1]], [q[2], q[3]]]) { const kk = cKey(x, y); (grid.get(kk) || grid.set(kk, []).get(kk)).push(i); } });
    for (const [kk, ids] of grid) { const [gx, gy] = kk.split(',').map(Number); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of grid.get((gx + i) + ',' + (gy + j)) || []) if (b !== ids[0]) par[find(b)] = find(ids[0]); }
    const groups = new Map(); H.forEach((q, i) => { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(q); });
    // pieces of one fill (split where the fixture's diagonal or a gap crosses it) join when their extents touch
    let boxes = [...groups.values()].map(G => { let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; for (const q of G) { x0 = Math.min(x0, q[0], q[2]); x1 = Math.max(x1, q[0], q[2]); y0 = Math.min(y0, q[1], q[3]); y1 = Math.max(y1, q[1], q[3]); } return { x0, y0, x1, y1, n: G.length }; });
    const gap = 3 / 12 / k;
    for (let again = true; again;) {
      again = false;
      for (let i = 0; i < boxes.length && !again; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x0 - gap > b.x1 || b.x0 - gap > a.x1 || a.y0 - gap > b.y1 || b.y0 - gap > a.y1) continue;
        const m = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), n: a.n + b.n };
        if (Math.max(m.x1 - m.x0, m.y1 - m.y0) * k > 6.2) continue;   // two fixtures side by side stay two
        boxes.splice(j, 1); boxes[i] = m; again = true; break;
      }
    }
    for (const B0 of boxes) {
      if (B0.n < 12) continue;
      const { x0, y0, x1, y1 } = B0;
      const w = (x1 - x0) * k, h = (y1 - y0) * k, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (Math.min(w, h) < 1.5 || Math.max(w, h) > 6.2 || Math.max(w, h) / Math.min(w, h) > 3.2) continue;   // a real fixture size, not a scrap of a fill
      if (out.some(f => Math.abs(f.cx - cx) * k < Math.max(f.w, f.h) / 2 && Math.abs(f.cy - cy) * k < Math.max(f.w, f.h) / 2)) continue;
      out.push({ cx, cy, w, h, type: 'led', em: true, turned: false });
    }
  }
  // an emergency fixture is often drawn as a light outline with its fill on top: one fixture, emergency
  const merged = [];
  for (const f of out) { const m = merged.find(g => Math.hypot(g.cx - f.cx, g.cy - f.cy) < tol * 4); if (m) { m.em = m.em || f.em; if (f.type === 'led') m.type = 'led'; } else merged.push(f); }
  return merged;
}

global.Plan3DCeiling = { lightsFromDrawing, fixtureGroups, gridLayerList, placeCad, placeImage, shiftCeiling, removeCeiling, drawPreview, clipSeg };
})(window);
