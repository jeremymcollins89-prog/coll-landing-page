/* Coll Plan3D — 3D walkthrough viewer (shared by the app and exported .html files)
   Plan units are feet. Plan (x, y) maps to 3D (x, z); y grows "down" the sheet = +z.
   Coll Business Solutions LLC */
(function (global) {
'use strict';

const CSS = `
.p3v [hidden]{display:none!important}
.p3v{position:relative;overflow:hidden;background:#dde4e8;font-family:Bahnschrift,"Segoe UI",system-ui,sans-serif;color:#eef2f3;-webkit-user-select:none;user-select:none}
.p3v-c{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;outline:none}
.p3v-c.drag{cursor:grabbing}
.p3v-top{position:absolute;top:12px;left:12px;right:12px;display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;pointer-events:none;z-index:5}
.p3v-top>*{pointer-events:auto}
.p3v-panel{background:rgba(18,23,25,.86);border:1px solid rgba(255,255,255,.13);border-radius:10px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.p3v-card{padding:9px 13px 10px;max-width:330px;min-width:0}
.p3v-title{font-size:17px;font-weight:600;line-height:1.15}
.p3v-meta{font:11px Consolas,"Cascadia Mono",ui-monospace,monospace;color:#9aa7ad;text-transform:uppercase;letter-spacing:.04em;margin-top:3px}
.p3v-here{margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.13);display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.p3v-here b{font-size:15px;font-weight:600}
.p3v-here span{font:11.5px Consolas,"Cascadia Mono",ui-monospace,monospace;color:#f2c84b}
.p3v-modes{display:flex;border-radius:999px;padding:3px;gap:2px}
.p3v-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.p3v-look{font-family:inherit;font-size:12.5px;font-weight:600;color:#cfd8dc;border-radius:999px;padding:6px 12px;cursor:pointer}
.p3v-look kbd{font:11px Consolas,ui-monospace,monospace;color:#9aa7ad;margin-left:4px;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:0 4px}
.p3v-look[aria-pressed=true]{background:#f2c84b;color:#121719;border-color:#f2c84b}
.p3v-look[aria-pressed=true] kbd{color:#121719;border-color:rgba(0,0,0,.3)}
.p3v-aim{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#f2c84b;box-shadow:0 0 0 2px rgba(0,0,0,.35);pointer-events:none;z-index:6;display:none}
.p3v-looking .p3v-aim{display:block}
.p3v-looking .p3v-c{cursor:none}
.p3v-modes button{font-family:inherit;font-size:13px;font-weight:600;letter-spacing:.03em;color:#9aa7ad;background:transparent;border:0;border-radius:999px;padding:7px 14px;cursor:pointer}
.p3v-modes button[aria-pressed=true]{background:#eef2f3;color:#121719}
.p3v-bottom{position:absolute;bottom:12px;left:12px;right:12px;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none;z-index:5}
.p3v-bottom>*{pointer-events:auto}
.p3v-mini{width:130px;height:150px;display:block;cursor:crosshair}
.p3v-chips{display:flex;gap:6px;overflow-x:auto;max-width:100%;scrollbar-width:none;padding:1px}
.p3v-chips::-webkit-scrollbar{display:none}
.p3v-chips button{flex:0 0 auto;font-family:inherit;font-size:13px;font-weight:600;color:#eef2f3;background:rgba(18,23,25,.86);border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:7px 13px;cursor:pointer;white-space:nowrap}
.p3v-chips button.on{border-color:#f2c84b;color:#f2c84b}
.p3v-hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;pointer-events:none;background:rgba(18,23,25,.86);border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:9px 16px;font-size:14px;transition:opacity .6s;white-space:nowrap;max-width:calc(100% - 32px);overflow:hidden;text-overflow:ellipsis}
.p3v-hint.gone{opacity:0}
.p3v-labels{position:absolute;inset:0;pointer-events:none;z-index:3}
.p3v-rl{position:absolute;left:0;top:0;background:rgba(18,23,25,.86);border:1px solid rgba(255,255,255,.13);border-radius:6px;padding:3px 8px;text-align:center;white-space:nowrap}
.p3v-rl b{display:block;font-size:12.5px;font-weight:600}
.p3v-rl span{font:10.5px Consolas,ui-monospace,monospace;color:#f2c84b}
.p3v button:focus-visible{outline:2px solid #f2c84b;outline-offset:2px}
.p3v-empty{position:absolute;inset:0;display:grid;place-items:center;color:#5b676d;font-size:16px;pointer-events:none;z-index:2}
`;

function injectCSS() {
  if (document.getElementById('p3v-css')) return;
  const s = document.createElement('style'); s.id = 'p3v-css'; s.textContent = CSS; document.head.appendChild(s);
}
function makeCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
const CANVAS_CACHE = {};
function cachedCanvas(key, createFn) {
  if (!CANVAS_CACHE[key]) CANVAS_CACHE[key] = createFn();
  return CANVAS_CACHE[key];
}

function segDist(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - x1) * dx + (pz - z1) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t));
}
function segCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const o = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const d1 = o(cx, cz, dx, dz, ax, az), d2 = o(cx, cz, dx, dz, bx, bz), d3 = o(ax, az, bx, bz, cx, cz), d4 = o(ax, az, bx, bz, dx, dz);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
const FR = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
function fmtFt(ft) {
  const e = Math.round(Math.abs(ft) * 96), f = Math.floor(e / 96), r = e - f * 96;
  return (ft < 0 ? '-' : '') + f + '′-' + Math.floor(r / 8) + FR[r % 8] + '″';
}

/* ---------- Pure geometry analysis (no three.js) ---------- */
function leavesFor(i) {
  const o = i.o, sw = o.swing === -1 ? -1 : 1, nx = -i.uz, nz = i.ux, out = [];
  if (o.type === 'door') {
    const w = Math.max(0.5, i.len - 0.22);
    const bx = o.x1 + i.ux * 0.1, bz = o.y1 + i.uz * 0.1;
    const sx = bx + nx * sw * (i.t / 2 + 0.07), sz = bz + nz * sw * (i.t / 2 + 0.07);
    out.push({ x1: sx, z1: sz, x2: sx + i.ux * w, z2: sz + i.uz * w, w, leafSw: sw });
  } else if (o.type === 'door2') {
    const halfW = Math.max(0.4, i.len / 2 - 0.14);
    const bx1 = o.x1 + i.ux * 0.1, bz1 = o.y1 + i.uz * 0.1;
    const sx1 = bx1 + nx * sw * (i.t / 2 + 0.07), sz1 = bz1 + nz * sw * (i.t / 2 + 0.07);
    out.push({ x1: sx1, z1: sz1, x2: sx1 + i.ux * halfW, z2: sz1 + i.uz * halfW, w: halfW, leafSw: sw });

    const bx2 = o.x2 - i.ux * 0.1, bz2 = o.y2 - i.uz * 0.1;
    const sx2 = bx2 + nx * sw * (i.t / 2 + 0.07), sz2 = bz2 + nz * sw * (i.t / 2 + 0.07);
    out.push({ x1: sx2, z1: sz2, x2: sx2 - i.ux * halfW, z2: sz2 - i.uz * halfW, w: halfW, leafSw: sw });
  }
  return out;
}

function analyze(plan) {
  const H = Math.max(6, plan.ceiling || 8);
  const walls = (plan.walls || []).filter(w => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 0.01);
  const ops = plan.openings || [], chases = plan.chases || [];
  const pieces = [], ends = [];
  for (const w of walls) {
    const dx = w.x2 - w.x1, dz = w.y2 - w.y1, len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len, t = w.t || 0.25;
    const cuts = [];
    for (const o of ops) {
      const tol = t * 0.6 + 0.05;
      const perp = (x, y) => Math.abs((x - w.x1) * (-uz) + (y - w.y1) * ux);
      if (perp(o.x1, o.y1) > tol || perp(o.x2, o.y2) > tol) continue;
      const s1 = (o.x1 - w.x1) * ux + (o.y1 - w.y1) * uz, s2 = (o.x2 - w.x1) * ux + (o.y2 - w.y1) * uz;
      const a = Math.max(0, Math.min(s1, s2)), b = Math.min(len, Math.max(s1, s2));
      if (b - a > 0.02) cuts.push([a, b]);
    }
    cuts.sort((p, q) => p[0] - q[0]);
    let c = 0; const segs = [];
    for (const [a, b] of cuts) { if (a > c + 0.004) segs.push([c, a]); c = Math.max(c, b); }
    if (len > c + 0.004) segs.push([c, len]);
    for (const [a, b] of segs) pieces.push({ id: w.id, piece: w.piece || null, x1: w.x1 + ux * a, z1: w.y1 + uz * a, x2: w.x1 + ux * b, z2: w.y1 + uz * b, t, sp: !!w.sp, s0: a, len: b - a });
    ends.push({ x: w.x1, z: w.y1, t, ang: Math.atan2(-uz, ux), cut: cuts.some(k => k[0] < 0.01) });
    ends.push({ x: w.x2, z: w.y2, t, ang: Math.atan2(-uz, ux), cut: cuts.some(k => k[1] > len - 0.01) });
  }
  const CORNER = 4 / 12, corners = [], nodes = [];
  for (const w of walls) for (const [x, y, st] of [[w.x1, w.y1, true], [w.x2, w.y2, false]]) {
    let n = nodes.find(n => Math.hypot(n.x - x, n.y - y) < 0.3);
    if (!n) { n = { x, y, ws: [] }; nodes.push(n); }
    if (!n.ws.includes(w)) n.ws.push(w);
  }
  for (const n of nodes) {
    if (n.ws.length !== 2) continue;
    const [a, b] = n.ws;
    const ax = a.x2 - a.x1, ay = a.y2 - a.y1, bx = b.x2 - b.x1, by = b.y2 - b.y1, den = ax * by - ay * bx;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (Math.abs(den) / (la * lb) < 0.2) continue;
    if (walls.some(o => o !== a && o !== b && segDist(n.x, n.y, o.x1, o.y1, o.x2, o.y2) < (o.t || 0.25) / 2 + 0.06)) continue;
    const t = ((b.x1 - a.x1) * by - (b.y1 - a.y1) * bx) / den;
    const cx = a.x1 + ax * t, cz = a.y1 + ay * t;
    const away = (w) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); const fromStart = Math.hypot(w.x1 - cx, w.y1 - cz) < Math.hypot(w.x2 - cx, w.y2 - cz); return fromStart ? [(w.x2 - w.x1) / L, (w.y2 - w.y1) / L] : [(w.x1 - w.x2) / L, (w.y1 - w.y2) / L]; };
    const [dax, day] = away(a), [dbx, dby] = away(b);
    const S = Math.max(CORNER, a.t || 0.25, b.t || 0.25), wt = Math.max(a.t || 0.25, b.t || 0.25);
    const ox = cx - (dax + dbx) * wt / 2, oz = cz - (day + dby) * wt / 2;
    corners.push({ x: ox, z: oz, a: [dax, day], b: [dbx, dby], size: S, wt, ang: Math.atan2(-ay, ax) });
  }
  const opInfo = [];
  for (const o of ops) {
    const dx = o.x2 - o.x1, dz = o.y2 - o.y1, len = Math.hypot(dx, dz); if (len < 0.05) continue;
    let t = o.t;
    if (!t) {
      let best = 1e9;
      for (const w of walls) { const d = segDist((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, w.x1, w.y1, w.x2, w.y2); if (d < best) { best = d; t = w.t; } }
      if (!t || best > 1.5) t = 0.25;
    }
    const i = { o, len, ux: dx / len, uz: dz / len, t };
    i.leaves = leavesFor(i);
    opInfo.push(i);
  }
  let minX = 1e9, minZ = 1e9, maxX = -1e9, maxZ = -1e9;
  const ext = (x, z) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); };
  walls.forEach(w => { ext(w.x1, w.y1); ext(w.x2, w.y2); });
  chases.forEach(c => { ext(c.x0, c.y0); ext(c.x1, c.y1); });
  ops.forEach(o => { ext(o.x1, o.y1); ext(o.x2, o.y2); });
  const empty = minX > maxX;
  if (empty) { minX = 0; minZ = 0; maxX = 24; maxZ = 24; }
  const obs = [];
  pieces.forEach(p => obs.push({ x1: p.x1, z1: p.z1, x2: p.x2, z2: p.z2, r: p.t / 2 }));
  opInfo.forEach(i => {
    if (i.o.type === 'glass') obs.push({ x1: i.o.x1, z1: i.o.y1, x2: i.o.x2, z2: i.o.y2, r: i.t / 2 });
    if (i.o.type === 'pass') obs.push({ x1: i.o.x1, z1: i.o.y1, x2: i.o.x2, z2: i.o.y2, r: Math.max(i.t, i.o.depth || 2) / 2 });
  });
  const boxes = chases.map(c => ({ x0: Math.min(c.x0, c.x1), x1: Math.max(c.x0, c.x1), z0: Math.min(c.y0, c.y1), z1: Math.max(c.y0, c.y1), grille: c.grille || '', c }));
  return { H, walls, pieces, ends, corners, opInfo, boxes, obs, empty, bounds: { minX, minZ, maxX, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ } };
}

function footprint(A) {
  if (A.__fp !== undefined) return A.__fp;
  A.__fp = null;
  if (A.empty) return null;
  const B = A.bounds, R = 0.75;
  let cell = 0.25;
  const span = (B.w + 2 * R + 4) * (B.d + 2 * R + 4);
  while (span / (cell * cell) > 400000) cell *= 1.5;
  const x0 = B.minX - R - 2, z0 = B.minZ - R - 2, nx = Math.ceil((B.w + 2 * R + 4) / cell), nz = Math.ceil((B.d + 2 * R + 4) / cell), N = nx * nz;
  const wall = new Uint8Array(N);
  const stamp = (x1, z1, x2, z2, t) => {
    const r = Math.max(t / 2, cell * 0.75), L = Math.hypot(x2 - x1, z2 - z1);
    const i0 = Math.max(0, Math.floor((Math.min(x1, x2) - r - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((Math.max(x1, x2) + r - x0) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(z1, z2) - r - z0) / cell)), j1 = Math.min(nz - 1, Math.ceil((Math.max(z1, z2) + r - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * cell, pz = z0 + (j + 0.5) * cell;
      let d;
      if (L < 1e-6) d = Math.hypot(px - x1, pz - z1);
      else { const u = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (pz - z1) * (z2 - z1)) / (L * L))); d = Math.hypot(px - x1 - u * (x2 - x1), pz - z1 - u * (z2 - z1)); }
      if (d <= r) wall[j * nx + i] = 1;
    }
  };
  for (const p of A.pieces) stamp(p.x1, p.z1, p.x2, p.z2, p.t);
  for (const i of A.opInfo) stamp(i.o.x1, i.o.y1, i.o.x2, i.o.y2, i.t);
  for (const b of A.boxes) { stamp(b.x0, b.z0, b.x1, b.z0, 0.1); stamp(b.x1, b.z0, b.x1, b.z1, 0.1); stamp(b.x1, b.z1, b.x0, b.z1, 0.1); stamp(b.x0, b.z1, b.x0, b.z0, 0.1); }
  const segD = (px, pz, w) => { const dx = w.x2 - w.x1, dz = w.y2 - w.y1, L2 = dx * dx + dz * dz || 1e-9, u = Math.max(0, Math.min(1, ((px - w.x1) * dx + (pz - w.y1) * dz) / L2)); return Math.hypot(px - w.x1 - u * dx, pz - w.y1 - u * dz); };
  const free = [];
  for (const w of A.walls) for (const [x, z] of [[w.x1, w.y1], [w.x2, w.y2]]) {
    const t = w.t || 0.25;
    if (A.walls.some(o => o !== w && segD(x, z, o) < Math.max(t, o.t || 0.25) * 0.8)) continue;
    if (A.opInfo.some(i => Math.min(Math.hypot(i.o.x1 - x, i.o.y1 - z), Math.hypot(i.o.x2 - x, i.o.y2 - z)) < 0.3)) continue;
    free.push({ x, z, w });
  }
  const crosses = (a, b) => A.walls.some(w => {
    if (w === a.w || w === b.w) return false;
    const d1x = b.x - a.x, d1z = b.z - a.z, d2x = w.x2 - w.x1, d2z = w.y2 - w.y1, den = d1x * d2z - d1z * d2x;
    if (Math.abs(den) < 1e-9) return false;
    const s1 = ((w.x1 - a.x) * d2z - (w.y1 - a.z) * d2x) / den, s2 = ((w.x1 - a.x) * d1z - (w.y1 - a.z) * d1x) / den;
    return s1 > 0.02 && s1 < 0.98 && s2 > 0 && s2 < 1;
  });
  const joined = new Set();
  free.forEach((a, ia) => {
    let best = -1, bd = 16;
    free.forEach((b, ib) => { if (ib === ia || b.w === a.w) return; const d = Math.hypot(b.x - a.x, b.z - a.z); if (d > 0.3 && d < bd && !crosses(a, b)) { bd = d; best = ib; } });
    if (best < 0) return;
    const key = Math.min(ia, best) + '-' + Math.max(ia, best); if (joined.has(key)) return; joined.add(key);
    stamp(a.x, a.z, free[best].x, free[best].z, 0.05);
  });
  const dist = (seed) => {
    const D = new Float32Array(N); for (let k = 0; k < N; k++) D[k] = seed[k] ? 0 : 1e9;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; let d = D[k];
      if (i > 0) d = Math.min(d, D[k - 1] + 1); if (j > 0) { d = Math.min(d, D[k - nx] + 1); if (i > 0) d = Math.min(d, D[k - nx - 1] + 1.4142); if (i < nx - 1) d = Math.min(d, D[k - nx + 1] + 1.4142); } D[k] = d; }
    for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; let d = D[k];
      if (i < nx - 1) d = Math.min(d, D[k + 1] + 1); if (j < nz - 1) { d = Math.min(d, D[k + nx] + 1); if (i < nx - 1) d = Math.min(d, D[k + nx + 1] + 1.4142); if (i > 0) d = Math.min(d, D[k + nx - 1] + 1.4142); } D[k] = d; }
    return D;
  };
  const rc = R / cell;
  const Dw = dist(wall);
  const out = new Uint8Array(N), stack = [];
  const push = (k) => { if (!out[k] && Dw[k] > rc) { out[k] = 1; stack.push(k); } };
  for (let i = 0; i < nx; i++) { push(i); push((nz - 1) * nx + i); }
  for (let j = 0; j < nz; j++) { push(j * nx); push(j * nx + nx - 1); }
  while (stack.length) { const k = stack.pop(), i = k % nx, j = (k - i) / nx; if (i > 0) push(k - 1); if (i < nx - 1) push(k + 1); if (j > 0) push(k - nx); if (j < nz - 1) push(k + nx); }
  const Do = dist(out), inside = new Uint8Array(N);
  let n = 0;
  for (let k = 0; k < N; k++) if (wall[k] || Do[k] > rc + 0.5) { inside[k] = 1; n++; }
  if (n < 4) return null;
  const rects = [], open = new Map();
  for (let j = 0; j <= nz; j++) {
    const runs = [];
    if (j < nz) { let i = 0; while (i < nx) { if (!inside[j * nx + i]) { i++; continue; } const a = i; while (i < nx && inside[j * nx + i]) i++; runs.push(a + ',' + i); } }
    const now = new Set(runs);
    for (const [key, r] of open) if (!now.has(key)) { rects.push(r); open.delete(key); }
    for (const key of runs) {
      if (open.has(key)) open.get(key)[3] = z0 + (j + 1) * cell;
      else { const [a, b] = key.split(',').map(Number); open.set(key, [x0 + a * cell, z0 + j * cell, x0 + b * cell, z0 + (j + 1) * cell]); }
    }
  }
  const fp = { cell, x0, z0, nx, nz, inside, rects, area: n * cell * cell,
    has(x, z) { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); return i >= 0 && j >= 0 && i < nx && j < nz && !!inside[j * nx + i]; } };
  A.__fp = fp;
  return fp;
}

function rectsGeometry(THREE, rects, y, down, su, sv, ox, oz) {
  const pos = [], uv = [];
  for (const [ax, az, bx, bz] of rects) {
    const P = [[ax, az], [bx, az], [bx, bz], [ax, bz]];
    const tri = down ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const t of tri) { pos.push(P[t][0], y, P[t][1]); uv.push((P[t][0] - ox) / su, (P[t][1] - oz) / sv); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function ceilingFixtures(plan, A) {
  A = A || analyze(plan);
  if (plan.ceilingMode === 'manual') return (plan.fixtures || []).slice();
  const B = A.bounds, out = []; let k = 0;
  for (let x = B.minX + 2; x + 2 <= B.maxX; x += 6) {
    for (let z = B.minZ + 4; z + 4 <= B.maxZ; z += 8) {
      const cx = x + 1, cz = z + 2;
      let clear = true;
      for (const p of A.pieces) { if (segDist(cx, cz, p.x1, p.z1, p.x2, p.z2) < 2.3) { clear = false; break; } }
      if (clear) for (const b of A.boxes) if (cx > b.x0 - 1.2 && cx < b.x1 + 1.2 && cz > b.z0 - 2.2 && cz < b.z1 + 2.2) { clear = false; break; }
      if (clear) { const fp = footprint(A); if (fp && !(fp.has(cx - 0.9, cz - 1.9) && fp.has(cx + 0.9, cz - 1.9) && fp.has(cx - 0.9, cz + 1.9) && fp.has(cx + 0.9, cz + 1.9))) clear = false; }
      if (clear) out.push({ type: (k++ % 2) ? 'ffu' : 'led', x: cx, y: cz });
    }
  }
  return out;
}

/* ---------- three.js scene ---------- */
const IMG_TEX = {};
let ANISO = 4;
function buildScene(THREE, plan, A) {
  const root = new THREE.Group();
  const H = A.H, B = A.bounds;
  const pick = [];
  const doors = [];
  const doorObs = [];

  const PX_IN = 512 / 48;
  const seamCanvas = cachedCanvas('seamCanvas', () => makeCanvas(512, 256, (g, w, h) => {
    g.fillStyle = '#f7f8f8'; g.fillRect(0, 0, w, h);
    const vg = g.createLinearGradient(0, 0, 0, h); vg.addColorStop(0, 'rgba(255,255,255,.25)'); vg.addColorStop(1, 'rgba(0,0,0,.015)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .025})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 6); }
    const batten = (cx) => {
      const half = 1.5 * PX_IN, ins = 0.6 * PX_IN;
      g.fillStyle = '#fbfbfb'; g.fillRect(cx - half, 0, half * 2, h);
      g.fillStyle = '#a3aaae'; g.fillRect(cx - half - 1, 0, 1.4, h);
      g.fillStyle = '#a3aaae'; g.fillRect(cx + half - 0.4, 0, 1.4, h);
      g.fillStyle = '#ffffff'; g.fillRect(cx - half + 0.6, 0, 1, h);
      const ig = g.createLinearGradient(cx - ins, 0, cx + ins, 0);
      ig.addColorStop(0, '#e9ecec'); ig.addColorStop(0.5, '#f6f7f7'); ig.addColorStop(1, '#e3e6e7');
      g.fillStyle = ig; g.fillRect(cx - ins, 0, ins * 2, h);
      g.fillStyle = '#b3babd'; g.fillRect(cx - ins - 1, 0, 1, h); g.fillRect(cx + ins, 0, 1, h);
      g.fillStyle = '#ffffff'; g.fillRect(cx - ins, 0, 0.8, h);
    };
    batten(0); batten(w);
  }));
  const floorCanvas = cachedCanvas('floorCanvas', () => makeCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#c3c7c8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, r); const d = Math.random() < .5; gr.addColorStop(0, d ? 'rgba(90,96,100,.035)' : 'rgba(255,255,255,.04)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); } }
    for (let i = 0; i < 4000; i++) { const v = 150 + Math.random() * 70 | 0; g.fillStyle = `rgba(${v},${v + 3},${v + 5},.28)`; g.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2); }
  }));
  const ceilCanvas = cachedCanvas('ceilCanvas', () => makeCanvas(128, 256, (g, w, h) => {
    g.fillStyle = '#f1f2f1'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(120,124,126,${Math.random() * .22})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    g.fillStyle = '#d3d8da'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
    g.fillStyle = '#fbfbfb'; g.fillRect(0, 3, w, 1); g.fillRect(3, 0, 1, h);
  }));
  const ffuCanvas = cachedCanvas('ffuCanvas', () => makeCanvas(64, 128, (g, w, h) => { g.fillStyle = '#eceeee'; g.fillRect(0, 0, w, h); g.fillStyle = '#b8c0c4'; for (let y = 8; y < h - 6; y += 5) for (let x = 6; x < w - 4; x += 5) g.fillRect(x, y, 2, 2); g.strokeStyle = '#c4cacd'; g.lineWidth = 4; g.strokeRect(0, 0, w, h); }));
  const steelCanvas = cachedCanvas('steelCanvas', () => makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#a9aeb0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * h, r = 15 + Math.random() * 50, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, Math.random() < .5 ? 'rgba(70,76,80,.10)' : 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 1400; i++) { const v = Math.random() < .5 ? 255 : 60; g.fillStyle = `rgba(${v},${v},${v},${Math.random() * .03})`; g.fillRect(0, Math.random() * h, w, 1); }
  }));
  const grilleCanvas = cachedCanvas('grilleCanvas', () => makeCanvas(256, 96, (g, w, h) => {
    g.fillStyle = '#f3f4f4'; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 8; y += 7) { g.fillStyle = '#c4cacd'; g.fillRect(9, y, w - 18, 2.2); g.fillStyle = '#ffffff'; g.fillRect(9, y + 2.2, w - 18, 1); }
    g.strokeStyle = '#dde1e2'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.strokeStyle = '#b9c0c3'; g.lineWidth = 1; g.strokeRect(8.5, 8.5, w - 17, h - 17);
  }));
  const aoCanvas = cachedCanvas('aoCanvas', () => makeCanvas(64, 64, (g) => { g.filter = 'blur(9px)'; g.fillStyle = '#000'; g.fillRect(20, 20, 24, 24); }));

  const M = {
    white: new THREE.MeshPhongMaterial({ color: 0xf7f8f8, emissive: 0x141515, specular: 0x1c1c1c, shininess: 16 }),
    edge: new THREE.MeshPhongMaterial({ color: 0xf2f3f3, emissive: 0x121313, specular: 0x111111, shininess: 10 }),
    base: new THREE.MeshPhongMaterial({ color: 0x18191b, specular: 0x2a2a2a, shininess: 28 }),
    track: new THREE.MeshPhongMaterial({ color: 0xdfe2e3, specular: 0x555555, shininess: 40 }),
    frame: new THREE.MeshPhongMaterial({ color: 0xf8f9f9, emissive: 0x121313, specular: 0x222222, shininess: 24 }),
    closer: new THREE.MeshPhongMaterial({ color: 0xb9bfc2, specular: 0x888888, shininess: 60 }),
    leaf: new THREE.MeshPhongMaterial({ color: 0xfbfcfc, emissive: 0x121313, specular: 0x1c1c1c, shininess: 16 }),
    kick: new THREE.MeshLambertMaterial({ color: 0xa9b2b8 }),
    lite: new THREE.MeshPhongMaterial({ color: 0xb8d3db, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    glass: new THREE.MeshLambertMaterial({ color: 0x9fd8e6, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    grille: new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(grilleCanvas), specular: 0x1c1c1c, shininess: 16 }),
    steel: new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(steelCanvas), color: 0xffffff, specular: 0x9a9a9a, shininess: 55 }),
    steelDoor: new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(steelCanvas), color: 0xf2f2f2, specular: 0xb0b0b0, shininess: 70 }),
    line: new THREE.LineBasicMaterial({ color: 0x8a9398, transparent: true, opacity: 0.45 }),
    ao: new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(aoCanvas), transparent: true, opacity: 0.34, depthWrite: false, color: 0x1c2428 })
  };
  const aoGeo = new THREE.PlaneGeometry(1, 1);
  const outline = (m) => m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), M.line));
  function shadow(cx, cz, len, wid, ang, spread) {
    const s = spread || 0.9, g = new THREE.Group(), m = new THREE.Mesh(aoGeo, M.ao);
    m.rotation.x = -Math.PI / 2; m.scale.set(len + s * 2.4, wid + s * 2.4, 1); m.renderOrder = 1;
    g.add(m); g.position.set(cx, 0.018, cz); g.rotation.y = ang || 0; root.add(g);
  }
  function segBox(x1, z1, x2, z2, y0, y1, th, mat, ext) {
    const len = Math.hypot(x2 - x1, z2 - z1) + (ext || 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.001, len), Math.max(0.001, y1 - y0), th), mat);
    m.position.set((x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2);
    m.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
    if (curRef) m.userData.ref = curRef;
    root.add(m); return m;
  }
  function localSegBox(parent, x1, z1, x2, z2, y0, y1, th, mat, ext) {
    const len = Math.hypot(x2 - x1, z2 - z1) + (ext || 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.001, len), Math.max(0.001, y1 - y0), th), mat);
    m.position.set((x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2);
    m.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
    if (curRef) m.userData.ref = curRef;
    parent.add(m); return m;
  }
  let curRef = null;

  for (const p of A.pieces) {
    curRef = p.id ? { kind: 'wall', id: p.id } : null;
    const tex = new THREE.CanvasTexture(seamCanvas); tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = ANISO;
    tex.repeat.set(p.len / 4, 1); tex.offset.set(((p.s0 % 4) + 4) % 4 / 4, 0);
    const face = new THREE.MeshPhongMaterial({ map: tex, color: p.sp ? 0xf6dc80 : 0xffffff, emissive: p.sp ? 0x000000 : 0x141515, specular: 0x1c1c1c, shininess: 16 });
    const m = segBox(p.x1, p.z1, p.x2, p.z2, 0, H, p.t, [M.edge, M.edge, M.edge, M.edge, face, face]);
    outline(m); pick.push(m);
    segBox(p.x1, p.z1, p.x2, p.z2, 0, 0.333, p.t + 0.022, M.base);
    segBox(p.x1, p.z1, p.x2, p.z2, H - 0.17, H, p.t + 0.03, M.track);
    shadow((p.x1 + p.x2) / 2, (p.z1 + p.z2) / 2, p.len, p.t, Math.atan2(-(p.z2 - p.z1), p.x2 - p.x1));
  }
  curRef = null;
  for (const c of A.corners) {
    const legs = [[c.a, c.b], [c.b, c.a]];
    for (const [u, v] of legs) {
      const x1 = c.x + v[0] * c.wt / 2, z1 = c.z + v[1] * c.wt / 2, x2 = x1 + u[0] * c.size, z2 = z1 + u[1] * c.size;
      const m = segBox(x1, z1, x2, z2, 0, H, c.wt + 0.006, M.white); outline(m); pick.push(m);
      segBox(x1, z1, x2, z2, 0, 0.333, c.wt + 0.024, M.base);
      segBox(x1, z1, x2, z2, H - 0.17, H, c.wt + 0.032, M.track);
    }
  }
  const seen = [];
  for (const e of A.ends) {
    if (e.cut || seen.some(s => Math.hypot(s.x - e.x, s.z - e.z) < 0.02) || A.corners.some(c => Math.hypot(c.x - e.x, c.z - e.z) < 0.35)) continue;
    seen.push(e);
    const m = new THREE.Mesh(new THREE.BoxGeometry(e.t, H, e.t), M.white);
    m.position.set(e.x, H / 2, e.z); m.rotation.y = e.ang; root.add(m); pick.push(m);
    const pb = new THREE.Mesh(new THREE.BoxGeometry(e.t + 0.022, 0.333, e.t + 0.022), M.base); pb.position.set(e.x, 0.1665, e.z); pb.rotation.y = e.ang; root.add(pb);
    const pt = new THREE.Mesh(new THREE.BoxGeometry(e.t + 0.03, 0.17, e.t + 0.03), M.track); pt.position.set(e.x, H - 0.085, e.z); pt.rotation.y = e.ang; root.add(pt);
  }

  for (const i of A.opInfo) {
    const o = i.o, t = i.t, nx = -i.uz, nz = i.ux;
    curRef = o.id ? { kind: 'opening', id: o.id } : null;
    const head = Math.min(H, o.head || (o.type === 'glass' ? 7 : 7));
    if (H - head > 0.01) { const h = segBox(o.x1, o.y1, o.x2, o.y2, head, H, t, M.white); outline(h); pick.push(h); if (H - head > 0.2) segBox(o.x1, o.y1, o.x2, o.y2, H - 0.17, H, t + 0.03, M.track); }
    const ax = o.x1, az = o.y1, bx = o.x2, bz = o.y2;
    const along = (s) => [ax + i.ux * s, az + i.uz * s];
    if (o.type === 'pass') {
      const sill = Math.max(0, Math.min(head - 0.5, o.sill == null ? 3 : o.sill)), D = Math.max(t + 0.1, o.depth || 2), ph = head - sill;
      if (sill > 0.01) { const lw = segBox(ax, az, bx, bz, 0, sill, t, M.white); outline(lw); pick.push(lw); segBox(ax, az, bx, bz, 0, 0.333, t + 0.022, M.base); }
      const body = segBox(ax, az, bx, bz, sill, head, D, M.steel); outline(body); pick.push(body);
      const [f1x, f1z] = along(-0.1), [f2x, f2z] = along(i.len + 0.1);
      segBox(f1x, f1z, f2x, f2z, sill - 0.1, sill, t + 0.05, M.steel); segBox(f1x, f1z, f2x, f2z, head, head + 0.1, t + 0.05, M.steel);
      segBox(f1x, f1z, ax, az, sill, head, t + 0.05, M.steel); segBox(bx, bz, f2x, f2z, sill, head, t + 0.05, M.steel);
      for (const sg of [1, -1]) {
        const off = sg * (D / 2 + 0.02), O = (s, k) => { const [x, z] = along(s); return [x + nx * (off + sg * (k || 0)), z + nz * (off + sg * (k || 0))]; };
        const [p1x, p1z] = O(0.08), [p2x, p2z] = O(i.len - 0.08);
        const dr = segBox(p1x, p1z, p2x, p2z, sill + 0.08, head - 0.08, 0.04, M.steelDoor); outline(dr); pick.push(dr);
        const [w1x, w1z] = O(i.len * 0.25, 0.012), [w2x, w2z] = O(i.len * 0.75, 0.012);
        segBox(w1x, w1z, w2x, w2z, sill + ph * 0.42, head - 0.22, 0.03, M.lite);
        const [h1x, h1z] = O(i.len - 0.3, 0.05), [h2x, h2z] = O(i.len - 0.22, 0.05);
        segBox(h1x, h1z, h2x, h2z, sill + ph * 0.3, sill + ph * 0.62, 0.08, M.closer);
      }
      shadow((ax + bx) / 2, (az + bz) / 2, i.len, D, Math.atan2(-i.uz, i.ux), 0.5);
    } else if (o.type === 'glass') {
      const sill = Math.max(0, Math.min(head - 0.5, o.sill == null ? 3 : o.sill));
      if (sill > 0.01) { const s = segBox(ax, az, bx, bz, 0, sill, t, M.white); outline(s); pick.push(s); segBox(ax, az, bx, bz, 0, 0.333, t + 0.022, M.base); }
      segBox(ax, az, bx, bz, sill, head, 0.05, M.glass);
      segBox(ax, az, bx, bz, sill, sill + 0.12, t + 0.06, M.frame);
      segBox(ax, az, bx, bz, head - 0.12, head, t + 0.06, M.frame);
      const [p1x, p1z] = along(0.12), [p2x, p2z] = along(i.len - 0.12);
      segBox(ax, az, p1x, p1z, sill, head, t + 0.06, M.frame);
      segBox(p2x, p2z, bx, bz, sill, head, t + 0.06, M.frame);
      shadow((ax + bx) / 2, (az + bz) / 2, i.len, t, Math.atan2(-i.uz, i.ux), 0.6);
    } else {
      const [j1x, j1z] = along(-0.14), [j2x, j2z] = along(i.len + 0.14);
      segBox(j1x, j1z, ax, az, 0, head, t + 0.06, M.frame);
      segBox(bx, bz, j2x, j2z, 0, head, t + 0.06, M.frame);
      segBox(j1x, j1z, j2x, j2z, head - 0.02, Math.min(H, head + 0.12), t + 0.06, M.frame);
      for (const l of i.leaves) {
        const baseAngle = Math.atan2(-(l.z2 - l.z1), l.x2 - l.x1);
        const swingDir = l.leafSw;

        const doorGroup = new THREE.Group();
        doorGroup.position.set(l.x1, 0, l.z1);
        doorGroup.rotation.y = baseAngle;
        doorGroup.userData = { 
          isDoor: true, 
          isOpen: false, 
          baseRotation: baseAngle,
          openAngle: 0,
          swingDir: swingDir 
        };
        root.add(doorGroup);
        doors.push(doorGroup);

        doorObs.push({ x1: l.x1, z1: l.z1, x2: l.x2, z2: l.z2, r: 0.07, doorGroup });

        const leafLen = Math.hypot(l.x2 - l.x1, l.z2 - l.z1) || 1;
        const top = Math.min(head - 0.1, 6.9);
        const f = (k) => [leafLen * k, 0];
        const g0 = 0.2, g1 = 0.8, v0 = 3.6, v1 = Math.min(6.05, top - 0.5);
        const [a0x, a0z] = f(0), [b0x, b0z] = f(g0), [b1x, b1z] = f(g1), [a1x, a1z] = f(1);

        const leafMesh = new THREE.Group();
        doorGroup.add(leafMesh);

        const m1 = localSegBox(leafMesh, a0x, a0z, a1x, a1z, 0.05, v0, 0.14, M.leaf);
        const m2 = localSegBox(leafMesh, a0x, a0z, a1x, a1z, v1, top, 0.14, M.leaf);
        const m3 = localSegBox(leafMesh, a0x, a0z, b0x, b0z, v0, v1, 0.14, M.leaf);
        const m4 = localSegBox(leafMesh, b1x, b1z, a1x, a1z, v0, v1, 0.14, M.leaf);

        [m1, m2].forEach(m => outline(m));
        pick.push(m1); pick.push(m2);

        localSegBox(leafMesh, b0x, b0z, b1x, b1z, v0, v1, 0.06, M.lite);

        const [c0x, c0z] = f(g0 - 0.035), [c1x, c1z] = f(g1 + 0.035);
        localSegBox(leafMesh, c0x, c0z, c1x, c1z, v0 - 0.07, v0, 0.18, M.frame);
        localSegBox(leafMesh, c0x, c0z, c1x, c1z, v1, v1 + 0.07, 0.18, M.frame);
        localSegBox(leafMesh, c0x, c0z, b0x, b0z, v0, v1, 0.18, M.frame);
        localSegBox(leafMesh, b1x, b1z, c1x, c1z, v0, v1, 0.18, M.frame);

        const [d0x, d0z] = f(0.08), [d1x, d1z] = f(0.45);
        localSegBox(leafMesh, d0x, d0z + 0.13, d1x, d1z + 0.13, top - 0.42, top - 0.2, 0.13, M.closer);

        const [h0x, h0z] = f(0.86), [h1x, h1z] = f(0.94);
        localSegBox(leafMesh, h0x, h0z, h1x, h1z, 3.25, 3.33, 0.42, M.closer);

        shadow((l.x1 + l.x2) / 2, (l.z1 + l.z2) / 2, l.w, 0.14, Math.atan2(-(l.z2 - l.z1), l.x2 - l.x1), 0.45);
      }
    }
  }

  curRef = null;
  for (const b of A.boxes) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0; if (w < 0.02 || d < 0.02) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), M.white);
    m.position.set((b.x0 + b.x1) / 2, H / 2, (b.z0 + b.z1) / 2); root.add(m); outline(m); pick.push(m);
    if (b.c && b.c.id) m.userData.ref = { kind: 'chase', id: b.c.id };
    const cv = new THREE.Mesh(new THREE.BoxGeometry(w + 0.022, 0.333, d + 0.022), M.base); cv.position.set(m.position.x, 0.1665, m.position.z); root.add(cv);
    const ct = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.17, d + 0.03), M.track); ct.position.set(m.position.x, H - 0.085, m.position.z); root.add(ct);
    shadow(m.position.x, m.position.z, w, d, 0, 1.0);
    const f = b.grille;
    if (f) {
      const gh = 1.5, gy = 0.5 + gh / 2, gt = 0.04;
      const glen = (f === 'N' || f === 'S') ? Math.max(0.5, w - 0.5) : Math.max(0.5, d - 0.5);
      let gm;
      if (f === 'W' || f === 'E') { gm = new THREE.Mesh(new THREE.BoxGeometry(gt, gh, glen), M.grille); gm.position.set(f === 'W' ? b.x0 - gt / 2 : b.x1 + gt / 2, gy, m.position.z); }
      else { gm = new THREE.Mesh(new THREE.BoxGeometry(glen, gh, gt), M.grille); gm.position.set(m.position.x, gy, f === 'N' ? b.z0 - gt / 2 : b.z1 + gt / 2); }
      root.add(gm);
      const tg = new THREE.BoxGeometry(0.14, H - 0.503, 0.14), corners = [];
      if (f === 'W') corners.push([b.x0, b.z0], [b.x0, b.z1]); else if (f === 'E') corners.push([b.x1, b.z0], [b.x1, b.z1]);
      else if (f === 'N') corners.push([b.x0, b.z0], [b.x1, b.z0]); else corners.push([b.x0, b.z1], [b.x1, b.z1]);
      corners.forEach(([x, z]) => { const t = new THREE.Mesh(tg, M.frame); t.position.set(x, 0.333 + (H - 0.503) / 2, z); root.add(t); outline(t); });
    }
  }

  const FP = footprint(A);
  const fTex = new THREE.CanvasTexture(floorCanvas); fTex.wrapS = fTex.wrapT = THREE.RepeatWrapping; fTex.anisotropy = ANISO;
  const fMat = new THREE.MeshPhongMaterial({ map: fTex, color: 0x9ea2a3, specular: 0x101010, shininess: 22 });
  let floor;
  if (FP) floor = new THREE.Mesh(rectsGeometry(THREE, FP.rects, 0.01, false, 12, 12, 0, 0), fMat);
  else { fTex.repeat.set(B.w / 12, B.d / 12); floor = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.d), fMat); floor.rotation.x = -Math.PI / 2; floor.position.set(B.cx, 0.01, B.cz); }
  root.add(floor);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(B.w + 140, B.d + 140), new THREE.MeshLambertMaterial({ color: 0xc4c8c2 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(B.cx, 0, B.cz); root.add(ground);

  const ceiling = new THREE.Group(); root.add(ceiling);
  const cTex = new THREE.CanvasTexture(ceilCanvas); cTex.wrapS = cTex.wrapT = THREE.RepeatWrapping; cTex.repeat.set(B.w / 2, B.d / 4); cTex.anisotropy = ANISO;
  const ownGrid = Array.isArray(plan.ceilingGrid) && plan.ceilingGrid.length > 0;
  let cMap = cTex;
  if (ownGrid) {
    const plain = cachedCanvas('ceilPlain', () => makeCanvas(128, 128, (g, w, h) => { g.fillStyle = '#f1f2f1'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(120,124,126,${Math.random() * .22})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } }));
    cMap = new THREE.CanvasTexture(plain); cMap.wrapS = cMap.wrapT = THREE.RepeatWrapping; cMap.repeat.set(B.w / 2, B.d / 2); cMap.anisotropy = ANISO;
  }
  const cMat = new THREE.MeshLambertMaterial({ map: cMap, color: 0xbfc2c2, emissive: 0x9a9c9c, emissiveMap: cMap });
  let ceil;
  if (FP) {
    cMap.repeat.set(1, 1);
    ceil = new THREE.Mesh(rectsGeometry(THREE, FP.rects, H, true, 2, ownGrid ? 2 : 4, B.minX, B.minZ), cMat);
  } else { ceil = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.d), cMat); ceil.rotation.x = Math.PI / 2; ceil.position.set(B.cx, H, B.cz); }
  ceiling.add(ceil);
  if (ownGrid) {
    const tw = 0.078 / 2, pos = [];
    for (const q of plan.ceilingGrid) {
      const L = Math.hypot(q[2] - q[0], q[3] - q[1]); if (!(L > 0.01)) continue;
      const nx = -(q[3] - q[1]) / L * tw, nz = (q[2] - q[0]) / L * tw, y = H - 0.012;
      const a = [q[0] + nx, y, q[1] + nz], b = [q[2] + nx, y, q[3] + nz], c = [q[2] - nx, y, q[3] - nz], d = [q[0] - nx, y, q[1] - nz];
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ceiling.add(new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: 0xd0d6d9, side: THREE.DoubleSide })));
  }
  if (plan.ceilingImage && plan.ceilingImage.dataUrl) {
    const I = plan.ceilingImage, q = (I.rot || 0) % 180 ? [I.h, I.w] : [I.w, I.h];
    const tex = IMG_TEX[I.dataUrl] || (IMG_TEX[I.dataUrl] = new THREE.TextureLoader().load(I.dataUrl));
    tex.anisotropy = ANISO;
    const im = new THREE.Mesh(new THREE.PlaneGeometry(q[0], q[1]), new THREE.MeshBasicMaterial({ map: tex, color: 0xe6e8e8, side: THREE.DoubleSide }));
    im.rotation.order = 'YXZ'; im.rotation.x = -Math.PI / 2; im.rotation.y = -(I.rot || 0) * Math.PI / 180;
    im.position.set(I.x, H - 0.006, I.y); ceiling.add(im);
  }
  const led = new THREE.MeshBasicMaterial({ color: 0xffffff }), ffu = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ffuCanvas) });
  const fg = new THREE.BoxGeometry(1.9, 0.08, 3.9), fgs = {};
  const fixtures = new THREE.Group(); root.add(fixtures);
  for (const f of ceilingFixtures(plan, A)) {
    let geo = fg;
    if (f.w > 0 && f.h > 0 && !(Math.abs(f.w - 2) < 0.06 && Math.abs(f.h - 4) < 0.06)) { const key = f.w.toFixed(2) + 'x' + f.h.toFixed(2); geo = fgs[key] || (fgs[key] = new THREE.BoxGeometry(Math.max(0.3, f.w - 0.1), 0.08, Math.max(0.3, f.h - 0.1))); }
    const m = new THREE.Mesh(geo, f.type === 'ffu' ? ffu : led); m.position.set(f.x, H - 0.04, f.y);
    if (f.id) m.userData.ref = { kind: 'fixture', id: f.id };
    fixtures.add(m);
  }
  return { root, pick, floor, ground, ceiling, ceilPlane: ceil, fixtures, doors, doorObs };
}

/* ---------- Mount ---------- */
function mount(container, plan, opts) {
  opts = opts || {};
  const THREE = global.THREE;
  injectCSS();
  container.classList.add('p3v');
  container.innerHTML = `
    <canvas class="p3v-c" tabindex="0" aria-label="3D model. Drag to look, click the floor to walk."></canvas>
    <div class="p3v-labels" hidden></div>
    <div class="p3v-top">
      <div class="p3v-panel p3v-card"><div class="p3v-title"></div><div class="p3v-meta"></div><div class="p3v-here"><b></b><span></span></div></div>
      <div class="p3v-right"><div class="p3v-panel p3v-modes" role="group" aria-label="View"><button data-m="walk">Walk</button><button data-m="doll">Dollhouse</button><button data-m="plan">Plan</button></div>
      <button class="p3v-panel p3v-look" aria-pressed="false" title="Turn by moving the mouse, no button needed (L). Esc to stop.">Mouse look <kbd>L</kbd></button></div>
    </div>
    <div class="p3v-aim" aria-hidden="true"></div>
    <div class="p3v-bottom"><canvas class="p3v-mini p3v-panel" aria-label="Mini map. Click to jump there."></canvas><div class="p3v-chips"></div></div>
    <div class="p3v-hint"></div>
    <div class="p3v-empty" hidden>Draw or import walls to see them in 3D.</div>`;
  const $ = (s) => container.querySelector(s);
  const canvas = $('.p3v-c'), labelsEl = $('.p3v-labels'), chipsEl = $('.p3v-chips'), mini = $('.p3v-mini'), hint = $('.p3v-hint');
  const titleEl = $('.p3v-title'), metaEl = $('.p3v-meta'), hereName = $('.p3v-here b'), hereDims = $('.p3v-here span'), emptyEl = $('.p3v-empty');
  const modeBtns = [...container.querySelectorAll('.p3v-modes button')];
  const lookBtn = container.querySelector('.p3v-look');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!opts.preserve });
  renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
  ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdde4e8);
  scene.fog = new THREE.Fog(0xdde4e8, 140, 360);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 900);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b6b9, 0.64));
  scene.add(new THREE.AmbientLight(0xffffff, 0.17));
  const sun = new THREE.DirectionalLight(0xffffff, 0.58); sun.position.set(-50, 80, 35); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xf2f6ff, 0.24); fill.position.set(70, 50, -50); scene.add(fill);

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.09; controls.maxPolarAngle = 1.42;
  controls.minDistance = 8; controls.maxDistance = 400; controls.enabled = false;

  const EYE = 5.3, R = 0.55;
  const st = { x: 0, z: 0, yaw: 0, pitch: -0.04 };
  let A = null, built = null, rooms = [], outside = null;
  let mode = 'walk', tween = null, target = null, stuck = 0, fov = 70, curRoom = undefined;
  const reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2c84b, transparent: true, opacity: 0.9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.58, 40), ringMat); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 40), new THREE.MeshBasicMaterial({ color: 0xf2c84b, transparent: true, opacity: 0, depthWrite: false }));
  pulse.rotation.x = -Math.PI / 2; scene.add(pulse); let pulseT = -1;
  function showPulse(x, z) { pulse.position.set(x, 0.03, z); pulseT = 0; }

  function collides(x, z) {
    const b = A.bounds;
    if (x < b.minX - 30 || x > b.maxX + 30 || z < b.minZ - 30 || z > b.maxZ + 30) return true;
    for (const o of A.obs) if (segDist(x, z, o.x1, o.z1, o.x2, o.z2) < o.r + R) return true;
    if (built && built.doorObs) {
      for (const d of built.doorObs) {
        if (d.doorGroup && d.doorGroup.userData.isOpen) continue;
        if (segDist(x, z, d.x1, d.z1, d.x2, d.z2) < d.r + R) return true;
      }
    }
    for (const q of A.boxes) if (x > q.x0 - R && x < q.x1 + R && z > q.z0 - R && z < q.z1 + R) return true;
    return false;
  }
  function step(dx, dz) { let m = 0; if (!collides(st.x + dx, st.z)) { st.x += dx; m += Math.abs(dx); } if (!collides(st.x, st.z + dz)) { st.z += dz; m += Math.abs(dz); } return m; }
  function freeSpot(x, z) {
    if (!collides(x, z)) return { x, z };
    for (let r = 0.3; r < 5; r += 0.3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!collides(px, pz)) return { x: px, z: pz }; }
    return { x, z };
  }
  function roomAt(x, z) {
    const b = A.bounds;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return outside;
    let best = null, bd = 1e9;
    for (const r of rooms) {
      const d = Math.hypot(r.x - x, r.y - z); if (d >= bd) continue;
      let blocked = false;
      for (const p of A.pieces) if (segCross(x, z, r.x, r.y, p.x1, p.z1, p.x2, p.z2)) { blocked = true; break; }
      if (!blocked) { best = r; bd = d; }
    }
    return best;
  }
  function applyWalkCam() { camera.position.set(st.x, EYE, st.z); camera.rotation.set(st.pitch, st.yaw, 0, 'YXZ'); }
  function walkLook() { const cp = Math.cos(st.pitch); return new THREE.Vector3(st.x - Math.sin(st.yaw) * cp * 6, EYE + Math.sin(st.pitch) * 6, st.z - Math.cos(st.yaw) * cp * 6); }
  function orbitPose(kind) {
    const b = A.bounds, vh = Math.tan(THREE.MathUtils.degToRad(45 / 2)), asp = (container.clientWidth || 1) / (container.clientHeight || 1);
    const d = Math.max(b.d * 0.62 / vh, b.w * 0.62 / (vh * asp), 30);
    const t = new THREE.Vector3(b.cx, 0, b.cz);
    if (kind === 'plan') return { pos: new THREE.Vector3(b.cx, d * 1.05, b.cz + 0.01), look: t, fov: 45 };
    return { pos: new THREE.Vector3(b.cx - d * 0.42, d * 0.72, b.cz + d * 0.62), look: t, fov: 45 };
  }
  function startTween(to, dur, done) {
    const from = { pos: camera.position.clone(), look: mode === 'walk' ? walkLook() : controls.target.clone(), fov: camera.fov };
    tween = { t0: performance.now(), dur: reduce ? 1 : dur, from, to, done };
    controls.enabled = false;
  }
  function runTween(now) {
    const k = Math.min(1, (now - tween.t0) / tween.dur), e = ease(k);
    camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
    const look = new THREE.Vector3().lerpVectors(tween.from.look, tween.to.look, e);
    camera.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e; camera.updateProjectionMatrix();
    camera.lookAt(look);
    if (k >= 1) { const d = tween.done; tween = null; d && d(); }
  }
  function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function setModeUI() { modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === mode))); }
  function goWalk(x, z, yaw, dur) {
    const p = freeSpot(x, z); target = null;
    const to = { pos: new THREE.Vector3(p.x, EYE, p.z), look: new THREE.Vector3(p.x - Math.sin(yaw) * 6, EYE, p.z - Math.cos(yaw) * 6), fov };
    if (built) built.ceiling.visible = true; labelsEl.hidden = true;
    startTween(to, dur || 900, () => { st.x = p.x; st.z = p.z; st.yaw = yaw; st.pitch = 0; applyWalkCam(); });
    mode = 'walk'; setModeUI();
  }
  function goOrbit(kind) {
    const pose = orbitPose(kind); target = null; if (built) built.ceiling.visible = false;
    const wasWalk = mode === 'walk';
    startTween(pose, wasWalk ? 1100 : 800, () => { controls.target.copy(pose.look); controls.enabled = true; controls.update(); labelsEl.hidden = false; });
    mode = kind; setModeUI();
  }
  modeBtns.forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.m;
    if (m === 'walk') { if (mode !== 'walk' || tween) goWalk(st.x, st.z, st.yaw); }
    else if (m !== mode) goOrbit(m);
  }));

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    if (!built) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs = [built.floor, built.ground, ...built.pick];
    const hit = ray.intersectObjects(objs, false)[0];
    if (!hit) return null;
    const p = hit.point;
    if (hit.object === built.floor || hit.object === built.ground) return { x: p.x, z: p.z };
    const dx = camera.position.x - p.x, dz = camera.position.z - p.z, d = Math.hypot(dx, dz) || 1;
    return { x: p.x + dx / d * 1.0, z: p.z + dz / d * 1.0 };
  }

  const doorRay = new THREE.Raycaster();
  function checkDoorClick(clientX, clientY) {
    if (!built || !built.doors || !built.doors.length) return false;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    doorRay.setFromCamera(ndc, camera);
    const hits = doorRay.intersectObjects(built.doors, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && obj !== scene) {
        if (obj.userData && obj.userData.isDoor) {
          obj.userData.isOpen = !obj.userData.isOpen;
          return true;
        }
        obj = obj.parent;
      }
    }
    return false;
  }

  const pts = new Map(); let down = null, pinch = null;
  let hintGone = false; function dismissHint() { if (hintGone) return; hintGone = true; hint.classList.add('gone'); }
  const coarse = global.matchMedia && global.matchMedia('(pointer: coarse)').matches;
  if (coarse && lookBtn) lookBtn.hidden = true;
  hint.textContent = coarse ? 'Drag to look · Tap the floor to walk · Tap doors to open' : 'Drag to look · L for mouse look · WASD to move, Shift to run · Q/E or ←/→ to turn · Click doors to open';
  setTimeout(dismissHint, 7000);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    dismissHint(); canvas.focus();
    if (isLocked()) { down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, multi: false }; return; }
    down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, multi: pts.size > 0 };
    if (mode !== 'walk' || tween) return;
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov }; down.multi = true; }
    canvas.classList.add('drag');
  });
  // Mouse look (L key or the Look button): the mouse turns the view without holding a button, like a game.
  // Esc or L again lets go of the mouse.
  const lockable = !!canvas.requestPointerLock;
  const isLocked = () => document.pointerLockElement === canvas;
  function toggleLook() {
    if (!lockable) return;
    if (isLocked()) { document.exitPointerLock(); return; }
    if (mode !== 'walk') goWalk(st.x, st.z, st.yaw, 500);
    try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* not allowed here */ }
  }
  if (lookBtn) { if (!lockable) lookBtn.hidden = true; lookBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleLook(); }); }
  document.addEventListener('pointerlockchange', () => { container.classList.toggle('p3v-looking', isLocked()); keys.clear(); if (lookBtn) lookBtn.setAttribute('aria-pressed', String(isLocked())); });
  canvas.addEventListener('mousemove', e => {
    if (!isLocked() || mode !== 'walk' || tween) return;
    const k = 0.0024 * (fov / 70);
    st.yaw -= e.movementX * k; st.pitch = Math.max(-1.25, Math.min(1.25, st.pitch - e.movementY * k));
  });
  canvas.addEventListener('pointermove', e => {
    if (isLocked()) return;
    if (down) down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
    if (mode === 'walk' && !tween && pts.has(e.pointerId)) {
      const p = pts.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) { const k = (e.pointerType === 'touch' ? 0.0068 : 0.0058) * (fov / 70); st.yaw += dx * k; st.pitch = Math.max(-1.25, Math.min(1.25, st.pitch + dy * k)); }
      else if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); fov = Math.max(35, Math.min(85, pinch.fov * pinch.d / d)); camera.fov = fov; camera.updateProjectionMatrix(); }
      ring.visible = false; return;
    }
    if (e.pointerType === 'mouse' && !e.buttons && !tween) {
      const p = pick(e.clientX, e.clientY);
      if (p) { ring.position.set(p.x, 0.03, p.z); ring.visible = true; } else ring.visible = false;
    }
  });
  function endPointer(e) {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) canvas.classList.remove('drag');
    if (!down) return;
    const click = down.moved < 7 && !down.multi && performance.now() - down.t < 600 && e.type === 'pointerup' && e.button === 0;
    if (pts.size === 0) down = null;
    if (!click || tween || !A) return;
    if (isLocked()) { const r = canvas.getBoundingClientRect(); e = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; }

    if (checkDoorClick(e.clientX, e.clientY)) return;

    const p = pick(e.clientX, e.clientY); if (!p) return;
    if (mode === 'walk') { const f = freeSpot(p.x, p.z); target = f; stuck = 0; showPulse(f.x, f.z); }
    else { const yaw = Math.atan2(-(p.x - camera.position.x), -(p.z - camera.position.z)); showPulse(p.x, p.z); goWalk(p.x, p.z, yaw); }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') ring.visible = false; });
  canvas.addEventListener('wheel', e => { if (mode !== 'walk') return; e.preventDefault(); fov = Math.max(35, Math.min(85, fov + e.deltaY * 0.03)); camera.fov = fov; camera.updateProjectionMatrix(); }, { passive: false });
  const keys = new Set();
  const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e', 'shift'];
  const typing = (t) => t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ''));
  // Keys reach the walkthrough whenever it's on screen and you're not typing in a box,
  // so you don't have to click the 3D view first.
  const viewOnScreen = () => !!container.offsetParent && container.clientWidth > 0;
  const onKeyDown = (e) => {
    if (!alive || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || !viewOnScreen()) return;
    if (document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (k === 'l' && !e.repeat) { toggleLook(); e.preventDefault(); return; }
    // Only take keys that are meant for the walkthrough: when you're in it, or when it fills the window.
    // Side by side with the 2D plan, keys typed in the plan stay with the plan (W = wall tool, and so on).
    const inView = container.contains(e.target), big = container.clientWidth > global.innerWidth * 0.6;
    if (!inView && !big) return;
    if (mode !== 'walk' && !inView) return;
    running = e.shiftKey;
    if (MOVE_KEYS.includes(k)) { keys.add(k); dismissHint(); if (k !== 'shift') e.preventDefault(); }
  };
  const onKeyUp = (e) => { keys.delete(e.key.toLowerCase()); running = e.shiftKey; };
  let running = false;
  global.addEventListener('keydown', onKeyDown);
  global.addEventListener('keyup', onKeyUp);
  global.addEventListener('blur', () => keys.clear());

  const mg = mini.getContext('2d'); let mm = { s: 1, ox: 0, oy: 0, w: 1, h: 1 };
  function sizeMini() {
    if (!A) return;
    const r = mini.getBoundingClientRect(), dpr = Math.min(2, global.devicePixelRatio || 1);
    mini.width = Math.max(1, Math.round(r.width * dpr)); mini.height = Math.max(1, Math.round(r.height * dpr)); mg.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = A.bounds, s = Math.min((r.width - 14) / b.w, (r.height - 14) / b.d);
    mm = { s, ox: (r.width - b.w * s) / 2 - b.minX * s, oy: (r.height - b.d * s) / 2 - b.minZ * s, w: r.width, h: r.height };
  }
  const mx = x => mm.ox + x * mm.s, my = z => mm.oy + z * mm.s;
  function drawMini() {
    if (!A) return;
    mg.clearRect(0, 0, mm.w, mm.h);
    mg.fillStyle = '#c9d2d6';
    for (const b of A.boxes) mg.fillRect(mx(b.x0), my(b.z0), (b.x1 - b.x0) * mm.s, (b.z1 - b.z0) * mm.s);
    mg.lineCap = 'square';
    for (const p of A.pieces) { mg.strokeStyle = p.sp ? '#f2c84b' : '#e8edef'; mg.lineWidth = 2; mg.beginPath(); mg.moveTo(mx(p.x1), my(p.z1)); mg.lineTo(mx(p.x2), my(p.z2)); mg.stroke(); }
    for (const i of A.opInfo) {
      if (i.o.type === 'pass') { mg.strokeStyle = '#b9c0c3'; mg.lineWidth = 3; mg.beginPath(); mg.moveTo(mx(i.o.x1), my(i.o.y1)); mg.lineTo(mx(i.o.x2), my(i.o.y2)); mg.stroke(); }
      if (i.o.type === 'glass') { mg.strokeStyle = '#7fd3e3'; mg.lineWidth = 1.6; mg.beginPath(); mg.moveTo(mx(i.o.x1), my(i.o.y1)); mg.lineTo(mx(i.o.x2), my(i.o.y2)); mg.stroke(); }
      mg.strokeStyle = 'rgba(232,237,239,.45)'; mg.lineWidth = 1;
      for (const l of i.leaves) { mg.beginPath(); mg.moveTo(mx(l.x1), my(l.z1)); mg.lineTo(mx(l.x2), my(l.z2)); mg.stroke(); }
    }
    let px, pz, yaw;
    if (mode === 'walk' && !tween) { px = st.x; pz = st.z; yaw = st.yaw; }
    else { const v = new THREE.Vector3(); camera.getWorldDirection(v); px = camera.position.x; pz = camera.position.z; yaw = Math.atan2(-v.x, -v.z); }
    if (mode === 'walk' || tween) {
      const a = Math.atan2(-Math.cos(yaw), -Math.sin(yaw)), half = THREE.MathUtils.degToRad(fov * 0.6);
      const b = A.bounds, cx = mx(Math.max(b.minX - 3, Math.min(b.maxX + 3, px))), cy = my(Math.max(b.minZ - 3, Math.min(b.maxZ + 3, pz)));
      const grd = mg.createRadialGradient(cx, cy, 0, cx, cy, 30); grd.addColorStop(0, 'rgba(242,200,75,.55)'); grd.addColorStop(1, 'rgba(242,200,75,0)');
      mg.fillStyle = grd; mg.beginPath(); mg.moveTo(cx, cy); mg.arc(cx, cy, 30, a - half, a + half); mg.closePath(); mg.fill();
      mg.fillStyle = '#f2c84b'; mg.beginPath(); mg.arc(cx, cy, 3.6, 0, Math.PI * 2); mg.fill(); mg.strokeStyle = '#121719'; mg.lineWidth = 1.2; mg.stroke();
    } else { mg.fillStyle = '#f2c84b'; mg.beginPath(); mg.arc(mx(st.x), my(st.z), 3, 0, Math.PI * 2); mg.fill(); }
  }
  mini.addEventListener('click', e => {
    if (!A) return; dismissHint();
    const r = mini.getBoundingClientRect(), b = A.bounds;
    const x = (e.clientX - r.left - mm.ox) / mm.s, z = (e.clientY - r.top - mm.oy) / mm.s;
    goWalk(Math.max(b.minX - 8, Math.min(b.maxX + 8, x)), Math.max(b.minZ - 8, Math.min(b.maxZ + 8, z)), mode === 'walk' ? st.yaw : 0, 900);
  });

  let labelEls = [], chipBtns = {};
  function buildHud(p) {
    const b = A.bounds;
    titleEl.textContent = p.name || 'Floor plan';
    metaEl.textContent = A.empty ? 'No walls yet' : `${fmtFt(b.w)} × ${fmtFt(b.d)} · ${fmtFt(A.H)} ceiling`;
    rooms = (p.rooms || []).filter(r => r && isFinite(r.x) && isFinite(r.y)).map(r => ({ ...r }));
    outside = { id: '__out', name: 'Outside', dims: '', x: b.cx, y: b.minZ - 11 };
    chipsEl.innerHTML = ''; chipBtns = {};
    [...rooms, outside].forEach(r => {
      const btn = document.createElement('button'); btn.textContent = r.name || 'Room';
      btn.addEventListener('click', () => {
        dismissHint();
        const yaw = r === outside ? Math.PI : Math.atan2(-(b.cx - r.x), -(b.cz - r.y));
        goWalk(r.x, r.y, yaw, mode === 'walk' ? 850 : 1000);
      });
      chipsEl.appendChild(btn); chipBtns[r.id || r.name] = btn; r.__btn = btn;
    });
    labelsEl.innerHTML = ''; labelEls = [];
    rooms.forEach(r => {
      const d = document.createElement('div'); d.className = 'p3v-rl';
      d.innerHTML = '<b></b>' + (r.dims ? '<span></span>' : '');
      d.querySelector('b').textContent = r.name || 'Room'; if (r.dims) d.querySelector('span').textContent = r.dims;
      labelsEl.appendChild(d); labelEls.push({ d, v: new THREE.Vector3(r.x, A.H + 0.6, r.y) });
    });
    curRoom = undefined;
  }
  function updateRoom() {
    const x = mode === 'walk' && !tween ? st.x : camera.position.x, z = mode === 'walk' && !tween ? st.z : camera.position.z;
    const r = (mode !== 'walk' && !tween) ? { name: 'Overview', dims: '' } : roomAt(x, z);
    if (r === curRoom || (curRoom && r && !r.id && curRoom.name === r.name)) return; curRoom = r;
    hereName.textContent = r ? (r.name || 'Room') : '—'; hereDims.textContent = r ? (r.dims || '') : '';
    [...rooms, outside].forEach(q => q.__btn && q.__btn.classList.toggle('on', q === r));
  }

  function setPlan(p, keep) {
    plan = p;
    A = analyze(p);
    if (built) { scene.remove(built.root); built.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    built = buildScene(THREE, p, A);
    scene.add(built.root);
    emptyEl.hidden = !A.empty;
    buildHud(p);
    sizeMini();
    if (!keep) {
      const b = A.bounds, r0 = (p.rooms || [])[0];
      const sx = r0 ? r0.x : b.cx, sz = r0 ? r0.y : b.cz;
      const f = freeSpot(sx, sz); st.x = f.x; st.z = f.z; st.yaw = r0 ? Math.atan2(-(b.cx - sx), -(b.cz - sz)) || 0 : 0; st.pitch = -0.04;
      if (A.empty) { mode = 'doll'; }
      if (mode === 'walk') { built.ceiling.visible = true; labelsEl.hidden = true; applyWalkCam(); }
      else { const pose = orbitPose(mode); camera.position.copy(pose.pos); camera.fov = 45; camera.updateProjectionMatrix(); controls.target.copy(pose.look); controls.enabled = true; controls.update(); built.ceiling.visible = false; labelsEl.hidden = false; }
      setModeUI();
    } else {
      if (mode === 'walk') { if (collides(st.x, st.z)) { const f = freeSpot(st.x, st.z); st.x = f.x; st.z = f.z; } built.ceiling.visible = true; }
      else built.ceiling.visible = false;
    }
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sizeMini();
  }
  const ro = new ResizeObserver(resize); ro.observe(container);

  const tmp = new THREE.Vector3(); let last = performance.now(), raf = 0, alive = true, turnHeld = 0;
  function loop(now) {
    if (!alive) return;
    // up to 1/8 s per frame, so turning and walking keep their speed even when the 3D draws slowly
    const dt = Math.min(0.125, (now - last) / 1000); last = now;
    if (A) {
      if (tween) runTween(now);
      else if (mode === 'walk') {
        let f = 0, s = 0, turn = 0;
        if (keys.has('w') || keys.has('arrowup')) f += 1; if (keys.has('s') || keys.has('arrowdown')) f -= 1;
        if (keys.has('d')) s += 1; if (keys.has('a')) s -= 1;
        if (keys.has('arrowleft') || keys.has('q')) turn += 1; if (keys.has('arrowright') || keys.has('e')) turn -= 1;
        // turning starts gentle for small corrections and speeds up while held
        if (turn) { turnHeld = Math.min(1, turnHeld + dt * 2.5); st.yaw += turn * (1.6 + 1.6 * turnHeld) * dt; } else turnHeld = 0;
        if (f || s) {
          target = null; const sp = (running || keys.has('shift') ? 13 : 7) * dt, fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
          const vx = fx * f + rx * s, vz = fz * f + rz * s, n = Math.hypot(vx, vz); step(vx / n * sp, vz / n * sp);
        }
        if (target) {
          const dx = target.x - st.x, dz = target.z - st.z, d = Math.hypot(dx, dz);
          if (d < 0.06) target = null;
          else { const sp = Math.min(d, dt * Math.max(2.2, Math.min(9, d * 2.6))); const m = step(dx / d * sp, dz / d * sp); if (m < sp * 0.2) { stuck += dt; if (stuck > 0.2) target = null; } else stuck = 0; }
        }
        applyWalkCam();
      } else controls.update();

      if (built && built.doors) {
        built.doors.forEach(doorGroup => {
          const targetOpenAngle = doorGroup.userData.isOpen ? (Math.PI / 2) * doorGroup.userData.swingDir : 0;
          doorGroup.userData.openAngle += (targetOpenAngle - doorGroup.userData.openAngle) * 0.15;
          doorGroup.rotation.y = doorGroup.userData.baseRotation + doorGroup.userData.openAngle;
        });
      }

      if (pulseT >= 0) { pulseT += dt; const k = pulseT / 0.7; pulse.scale.setScalar(1 + k * 1.4); pulse.material.opacity = Math.max(0, 0.9 * (1 - k)); if (k >= 1) { pulseT = -1; pulse.material.opacity = 0; } }
      if (!labelsEl.hidden) {
        const w = container.clientWidth, h = container.clientHeight;
        for (const l of labelEls) {
          tmp.copy(l.v).project(camera);
          if (tmp.z > 1) { l.d.style.display = 'none'; continue; } l.d.style.display = '';
          l.d.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px,${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
        }
      }
      updateRoom(); drawMini();
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  camera.fov = fov; camera.updateProjectionMatrix();
  resize();
  setPlan(plan || { walls: [] }, false);
  raf = requestAnimationFrame(loop);

  return {
    setPlan: (p) => setPlan(p, true),
    loadPlan: (p) => setPlan(p, false),
    setMode: (m) => { if (m === 'walk') goWalk(st.x, st.z, st.yaw); else goOrbit(m); },
    resize,
    get state() { return { x: st.x, z: st.z, yaw: st.yaw, pitch: st.pitch, mode }; },
    exportGLB: () => new Promise((resolve, reject) => {
      if (!THREE.GLTFExporter) return reject(new Error('GLTF exporter missing'));
      const fresh = buildScene(THREE, plan, analyze(plan));
      fresh.root.traverse(o => { if (o.isLineSegments) o.visible = false; });
      new THREE.GLTFExporter().parse(fresh.root, (res) => resolve(res), { binary: true, onlyVisible: true });
    }),
    dispose: () => { alive = false; global.removeEventListener('keydown', onKeyDown); global.removeEventListener('keyup', onKeyUp); if (isLocked()) document.exitPointerLock(); cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); container.innerHTML = ''; }
  };
}

global.Plan3DViewer = { mount, analyze, footprint, fmtFt, buildScene: (THREE, plan, A) => buildScene(THREE, plan, A || analyze(plan)), ceilingFixtures, segDist };
})(typeof window !== 'undefined' ? window : this);
