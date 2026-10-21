/* Coll Plan3D — importers: DXF line sets and plan images → walls (feet)
   Coll Business Solutions LLC */
(function (global) {
'use strict';

const uid = () => Math.random().toString(36).slice(2, 10);
const q = (v) => Math.round(v * 48) / 48; // round to 1/4"

/* Units → feet for DXF $INSUNITS */
const UNIT_FT = { 0: 1 / 12, 1: 1 / 12, 2: 1, 4: 1 / 304.8, 5: 1 / 30.48, 6: 3.28084, 14: 1 / 3.048 };
const UNIT_NAMES = { 1: 'Inches', 2: 'Feet', 4: 'Millimeters', 5: 'Centimeters', 6: 'Meters' };

/* Pair parallel lines that sit one wall-thickness apart into wall centerlines.
   segs: [{x1,y1,x2,y2}] in feet. Returns walls [{x1,y1,x2,y2,t}] */
function pairLines(segs, minT, maxT, minLen) {
  const L = [];
  for (const s of segs) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy);
    if (len < minLen * 0.5) continue;
    let ang = Math.atan2(dy, dx); if (ang < 0) ang += Math.PI; if (ang >= Math.PI - 1e-9) ang -= Math.PI;
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    const a = s.x1 * ux + s.y1 * uy, b = s.x2 * ux + s.y2 * uy;
    L.push({ ang, ux, uy, nx, ny, c: s.x1 * nx + s.y1 * ny, a: Math.min(a, b), b: Math.max(a, b) });
  }
  L.sort((p, r) => p.ang - r.ang);
  // cluster by angle (wrap around 0/π)
  const groups = []; const tol = 0.6 * Math.PI / 180;
  for (const l of L) {
    const g = groups[groups.length - 1];
    if (g && l.ang - g.last <= tol) { g.items.push(l); g.last = l.ang; } else groups.push({ items: [l], last: l.ang });
  }
  if (groups.length > 1) {
    const f = groups[0], l = groups[groups.length - 1];
    if (f.items[0].ang + Math.PI - l.last <= tol) {
      for (const it of l.items) { it.ang -= Math.PI; it.ux = -it.ux; it.uy = -it.uy; it.nx = -it.nx; it.ny = -it.ny; it.c = -it.c; const a = -it.b, b = -it.a; it.a = a; it.b = b; }
      // after flipping, re-express relative to first group's direction
      f.items.push(...l.items); groups.pop();
    }
  }
  const walls = [];
  for (const g of groups) {
    const it = g.items; if (it.length < 2) continue;
    const ref = it[0];
    // express all in ref frame
    const P = it.map(l => {
      const dot = l.ux * ref.ux + l.uy * ref.uy; // ~±1
      const c = l.c * dot; // normals align with direction sign
      const a = dot > 0 ? l.a : -l.b, b = dot > 0 ? l.b : -l.a;
      return { c, a, b };
    }).sort((p, r) => p.c - r.c);
    const found = [];
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) {
        const d = P[j].c - P[i].c; if (d > maxT) break; if (d < minT) continue;
        const a = Math.max(P[i].a, P[j].a), b = Math.min(P[i].b, P[j].b);
        if (b - a >= minLen) found.push({ c: (P[i].c + P[j].c) / 2, a, b, t: d });
      }
    }
    // merge duplicates / touching collinear pieces
    found.sort((p, r) => p.c - r.c || p.a - r.a);
    const merged = [];
    for (const f of found) {
      const m = merged.find(m => Math.abs(m.c - f.c) < Math.min(m.t, f.t) * 0.45 && f.a <= m.b + 0.02 && f.b >= m.a - 0.02);
      if (m) { const wa = m.b - m.a, wb = f.b - f.a; m.c = (m.c * wa + f.c * wb) / (wa + wb); m.t = Math.max(m.t, f.t); m.a = Math.min(m.a, f.a); m.b = Math.max(m.b, f.b); }
      else merged.push({ ...f });
    }
    for (const m of merged) {
      walls.push({ x1: ref.ux * m.a + ref.nx * m.c, y1: ref.uy * m.a + ref.ny * m.c, x2: ref.ux * m.b + ref.nx * m.c, y2: ref.uy * m.b + ref.ny * m.c, t: m.t });
    }
  }
  return walls;
}

/* Pull wall ends onto the centerline of the wall they run into (L and T junctions) */
function snapJunctions(walls, tolFt) {
  const inter = (a, b) => {
    const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1, d2x = b.x2 - b.x1, d2y = b.y2 - b.y1;
    const den = d1x * d2y - d1y * d2x; if (Math.abs(den) < 1e-9) return null;
    const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / den;
    return { x: a.x1 + d1x * t, y: a.y1 + d1y * t };
  };
  for (const w of walls) {
    for (const end of [1, 2]) {
      const px = end === 1 ? w.x1 : w.x2, py = end === 1 ? w.y1 : w.y2;
      let best = null, bd = tolFt;
      for (const o of walls) {
        if (o === w) continue;
        const a1 = Math.atan2(w.y2 - w.y1, w.x2 - w.x1), a2 = Math.atan2(o.y2 - o.y1, o.x2 - o.x1);
        let da = Math.abs(a1 - a2) % Math.PI; da = Math.min(da, Math.PI - da);
        if (da < 0.5) continue;
        const I = inter(w, o); if (!I) continue;
        const d = Math.hypot(I.x - px, I.y - py); if (d >= bd) continue;
        // I must lie on o (extended by tol)
        const ol = Math.hypot(o.x2 - o.x1, o.y2 - o.y1), s = ((I.x - o.x1) * (o.x2 - o.x1) + (I.y - o.y1) * (o.y2 - o.y1)) / ol;
        if (s < -tolFt || s > ol + tolFt) continue;
        best = I; bd = d;
      }
      if (best) { if (end === 1) { w.x1 = best.x; w.y1 = best.y; } else { w.x2 = best.x; w.y2 = best.y; } }
    }
  }
  return walls;
}

function finish(walls, minLen) {
  return walls
    .map(w => ({ id: uid(), x1: q(w.x1), y1: q(w.y1), x2: q(w.x2), y2: q(w.y2), t: w.t, sp: false }))
    .filter(w => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) >= minLen * 0.75);
}

/* DXF: segs [[x1,y1,x2,y2,layer]] in drawing units */
function wallsFromDxf(data, o) {
  const k = o.unitFt;
  const segs = data.segs.filter(s => o.layers.has(s[4]));
  if (!segs.length) return [];
  let minX = 1e18, maxY = -1e18;
  segs.forEach(s => { minX = Math.min(minX, s[0], s[2]); maxY = Math.max(maxY, s[1], s[3]); });
  // DXF y is up; plan y is down. Origin at top-left of the selection.
  const S = segs.map(s => ({ x1: (s[0] - minX) * k, y1: (maxY - s[1]) * k, x2: (s[2] - minX) * k, y2: (maxY - s[3]) * k }));
  let walls;
  if (o.mode === 'single') walls = S.map(s => ({ ...s, t: o.tFt }));
  else walls = pairLines(S, o.minT, o.maxT, o.minLen);
  snapJunctions(walls, Math.max(0.6, o.maxT * 2.5));
  return finish(walls, o.minLen);
}
function dxfSize(data, layers, unitFt) {
  let minX = 1e18, minY = 1e18, maxX = -1e18, maxY = -1e18, n = 0;
  for (const s of data.segs) if (layers.has(s[4])) { n++; minX = Math.min(minX, s[0], s[2]); maxX = Math.max(maxX, s[0], s[2]); minY = Math.min(minY, s[1], s[3]); maxY = Math.max(maxY, s[1], s[3]); }
  if (!n) return null;
  return { w: (maxX - minX) * unitFt, h: (maxY - minY) * unitFt, n };
}

/* Image: find long dark horizontal / vertical strokes, pair them into walls.
   bg: {cx, cy, scale (ft per image px), rot (rad)} */
function wallsFromImage(img, bg, o) {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const k = Math.min(1, 3000 / Math.max(nw, nh));
  const iw = nw * k, ih = nh * k, c = Math.cos(bg.rot || 0), s = Math.sin(bg.rot || 0);
  const W = Math.ceil(Math.abs(iw * c) + Math.abs(ih * s)), H = Math.ceil(Math.abs(iw * s) + Math.abs(ih * c));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2); g.rotate(bg.rot || 0); g.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  const px = g.getImageData(0, 0, W, H).data;
  const N = W * H, lum = new Uint8Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) lum[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
  // local mean threshold via integral image
  const W1 = W + 1, ii = new Uint32Array(W1 * (H + 1));
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += lum[y * W + x]; ii[(y + 1) * W1 + x + 1] = ii[y * W1 + x + 1] + row; } }
  const r = 18, dark = new Uint8Array(N), sens = o.sensitivity || 0.82;
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
      const sum = ii[y1 * W1 + x1] - ii[y0 * W1 + x1] - ii[y1 * W1 + x0] + ii[y0 * W1 + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = lum[y * W + x];
      dark[y * W + x] = (v < mean * sens && v < 200) ? 1 : 0;
    }
  }
  const ftPerPx = bg.scale / k;
  const tPx = o.tFt / ftPerPx, minLenPx = o.minLen / ftPerPx;
  const toPlan = (x, y) => ({ x: bg.cx + (x - W / 2) * ftPerPx, y: bg.cy + (y - H / 2) * ftPerPx });

  function scan(horizontal) {
    const A = horizontal ? H : W, Bn = horizontal ? W : H;
    const at = horizontal ? (a, b) => dark[a * W + b] : (a, b) => dark[b * W + a];
    const lines = []; let active = [];
    for (let a = 0; a < A; a++) {
      const runs = [];
      let start = -1, gap = 0;
      for (let b = 0; b <= Bn; b++) {
        const d = b < Bn && at(a, b);
        if (d) { if (start < 0) start = b; gap = 0; }
        else if (start >= 0) { gap++; if (gap > 2 || b === Bn) { const end = b - gap; if (end - start >= minLenPx) runs.push([start, end]); start = -1; gap = 0; } }
      }
      const next = [];
      for (const [b0, b1] of runs) {
        let hit = null;
        for (const l of active) { if (l.b0 < b1 && l.b1 > b0 && Math.min(l.b1, b1) - Math.max(l.b0, b0) > 0.5 * Math.min(l.b1 - l.b0, b1 - b0)) { hit = l; break; } }
        if (hit && !next.includes(hit)) { hit.sum += a; hit.n++; hit.b0 = Math.min(hit.b0, b0); hit.b1 = Math.max(hit.b1, b1); next.push(hit); }
        else { const l = { sum: a, n: 1, b0, b1 }; lines.push(l); next.push(l); }
      }
      active = next;
    }
    const maxThick = Math.max(5, tPx * 0.6);
    return lines.filter(l => l.n <= maxThick).map(l => ({ c: l.sum / l.n, a: l.b0, b: l.b1 }));
  }
  function pair(lines) {
    lines.sort((p, r) => p.c - r.c);
    const found = [];
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const d = lines[j].c - lines[i].c; if (d > tPx * 1.9) break; if (d < tPx * 0.45) continue;
      const a = Math.max(lines[i].a, lines[j].a), b = Math.min(lines[i].b, lines[j].b);
      if (b - a >= minLenPx) found.push({ c: (lines[i].c + lines[j].c) / 2, a, b });
    }
    found.sort((p, r) => p.c - r.c || p.a - r.a);
    const merged = [];
    for (const f of found) {
      const m = merged.find(m => Math.abs(m.c - f.c) < tPx * 0.6 && f.a <= m.b + tPx && f.b >= m.a - tPx);
      if (m) { const wa = m.b - m.a, wb = f.b - f.a; m.c = (m.c * wa + f.c * wb) / (wa + wb); m.a = Math.min(m.a, f.a); m.b = Math.max(m.b, f.b); }
      else merged.push({ ...f });
    }
    return merged;
  }
  const walls = [];
  for (const m of pair(scan(true))) { const p1 = toPlan(m.a, m.c), p2 = toPlan(m.b, m.c); walls.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, t: o.tFt }); }
  for (const m of pair(scan(false))) { const p1 = toPlan(m.c, m.a), p2 = toPlan(m.c, m.b); walls.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, t: o.tFt }); }
  snapJunctions(walls, Math.max(0.75, o.tFt * 4));
  return finish(walls, o.minLen);
}

global.Plan3DImport = { pairLines, snapJunctions, wallsFromDxf, dxfSize, wallsFromImage, UNIT_FT, UNIT_NAMES };
})(window);
