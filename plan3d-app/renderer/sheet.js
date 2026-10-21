/* Coll Plan3D — printable floor plan sheet (SVG, exported to PDF by the app).
   Drawn to a standard architectural scale with chained panel dimensions, overall dimensions,
   door tags, glass / pass-thru marks, S.P. highlights, rooms and a title block.
   Coll Business Solutions LLC */
(function (global) {
'use strict';
const V = global.Plan3DViewer;

const PAGES = {
  letter:  { w: 11, h: 8.5, label: 'Letter, 11 × 8½' },
  tabloid: { w: 17, h: 11, label: 'Tabloid, 11 × 17' },
  archc:   { w: 24, h: 18, label: 'ARCH C, 18 × 24' },
  archd:   { w: 36, h: 24, label: 'ARCH D, 24 × 36' }
};
const SCALES = [[1, '1" = 1\'-0"'], [3 / 4, '3/4" = 1\'-0"'], [1 / 2, '1/2" = 1\'-0"'], [3 / 8, '3/8" = 1\'-0"'], [1 / 4, '1/4" = 1\'-0"'],
  [3 / 16, '3/16" = 1\'-0"'], [1 / 8, '1/8" = 1\'-0"'], [3 / 32, '3/32" = 1\'-0"'], [1 / 16, '1/16" = 1\'-0"']];
const FR = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n3 = (v) => +v.toFixed(4);

// Drafting-style dimension text: inches up to 8', feet-inches beyond (like 47", 80 1/2", 11'-8 3/4")
function dimText(ft) {
  const e = Math.round(Math.abs(ft) * 96);
  if (e <= 96 * 8) { const i = Math.floor(e / 8), r = e % 8; return i + (r ? ' ' + FR[r] : '') + '"'; }
  const f = Math.floor(e / 96), rr = e - f * 96, i = Math.floor(rr / 8), r = rr % 8;
  return f + "'-" + i + (r ? ' ' + FR[r] : '') + '"';
}

function ftIn(ft) {
  const e = Math.round(Math.abs(ft) * 96), f = Math.floor(e / 96), rr = e - f * 96, i = Math.floor(rr / 8), r = rr % 8;
  return f + "'-" + i + (r ? ' ' + FR[r] : '') + '"';
}
// Turn a plan a quarter turn (so a tall plan can fill a wide sheet)
function rotatePlan(plan) {
  const R = (x, y) => [y, -x], G = { N: 'W', E: 'N', S: 'E', W: 'S', '': '' };
  const p = JSON.parse(JSON.stringify(plan));
  p.walls.forEach(w => { [w.x1, w.y1] = R(w.x1, w.y1); [w.x2, w.y2] = R(w.x2, w.y2); });
  p.openings.forEach(o => { [o.x1, o.y1] = R(o.x1, o.y1); [o.x2, o.y2] = R(o.x2, o.y2); });
  p.chases.forEach(k => { const x0 = Math.min(k.y0, k.y1), x1 = Math.max(k.y0, k.y1), y0 = -Math.max(k.x0, k.x1), y1 = -Math.min(k.x0, k.x1); Object.assign(k, { x0, x1, y0, y1, grille: G[k.grille || ''] }); });
  (p.rooms || []).forEach(r => { [r.x, r.y] = R(r.x, r.y); });
  (p.fixtures || []).forEach(f => { [f.x, f.y] = R(f.x, f.y); });
  return p;
}
function makeSheet(plan, opts) {
  opts = opts || {};
  if (opts.rotate === 'auto' || opts.rotate == null) {
    const a = makeSheet(plan, { ...opts, rotate: 0 }), b = makeSheet(plan, { ...opts, rotate: 90 });
    const ka = a.k, kb = b.k;
    return kb > ka * 1.01 ? b : a;
  }
  if (opts.rotate === 90) plan = rotatePlan(plan);
  const page = PAGES[opts.page] || PAGES.tabloid;
  const A = V.analyze(plan), B = A.bounds, H = A.H;
  const PW = page.w, PH = page.h, M = 0.4, TB = Math.min(1.05, PH * 0.12);
  const area = { x0: M, y0: M, x1: PW - M, y1: PH - M - TB - 0.1 };
  const pad = 5.5; // feet around the plan for dimension strings
  const needW = B.w + pad * 2, needH = B.d + pad * 2;
  let k = null, scaleLabel = '';
  // k = paper inches per plan foot; use the largest standard scale that fits
  for (const [s, l] of SCALES) if (needW * s <= area.x1 - area.x0 && needH * s <= area.y1 - area.y0) { k = s; scaleLabel = l; break; }
  if (!k) { k = Math.min((area.x1 - area.x0) / needW, (area.y1 - area.y0) / needH); scaleLabel = 'Fit to page (not to scale)'; }
  const ox = (area.x0 + area.x1) / 2, oy = (area.y0 + area.y1) / 2;
  const X = (x) => n3(ox + (x - B.cx) * k), Y = (y) => n3(oy + (y - B.cz) * k);
  const lw = { wall: 0.011, thin: 0.005, dim: 0.004, hair: 0.003 };
  const fs = { dim: Math.max(0.065, Math.min(0.1, k * 0.33)), tag: Math.max(0.07, Math.min(0.11, k * 0.36)), room: Math.max(0.09, Math.min(0.16, k * 0.55)) };
  const out = [];
  const poly = (pts, attrs) => out.push(`<polygon points="${pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" ${attrs}/>`);
  const line = (x1, y1, x2, y2, attrs) => out.push(`<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" ${attrs}/>`);
  const text = (x, y, str, size, attrs, rot) => out.push(`<text x="${X(x)}" y="${Y(y)}" font-size="${n3(size)}" ${rot ? `transform="rotate(${n3(rot)} ${X(x)} ${Y(y)})"` : ''} ${attrs || ''}>${esc(str)}</text>`);
  const quad = (x1, y1, x2, y2, t) => { const L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L * t / 2, ny = (x2 - x1) / L * t / 2; return [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]; };

  // ---- chases (under walls)
  out.push(`<g class="chases">`);
  A.boxes.forEach((b, i) => {
    const id = 'hc' + i;
    out.push(`<clipPath id="${id}"><rect x="${X(b.x0)}" y="${Y(b.z0)}" width="${n3((b.x1 - b.x0) * k)}" height="${n3((b.z1 - b.z0) * k)}"/></clipPath>`);
    out.push(`<rect x="${X(b.x0)}" y="${Y(b.z0)}" width="${n3((b.x1 - b.x0) * k)}" height="${n3((b.z1 - b.z0) * k)}" fill="#f2f2f2" stroke="#111" stroke-width="${lw.thin}"/>`);
    const step = 0.06, w = (b.x1 - b.x0) * k, h = (b.z1 - b.z0) * k;
    let hatch = ''; for (let d = -h; d < w; d += step) hatch += `M${n3(X(b.x0) + d)},${n3(Y(b.z1))}l${n3(h)},${n3(-h)}`;
    out.push(`<path d="${hatch}" stroke="#777" stroke-width="${lw.hair}" clip-path="url(#${id})"/>`);
    if (b.grille) {
      const g = b.grille, inset = 0.25;
      if (g === 'N') line(b.x0 + inset, b.z0, b.x1 - inset, b.z0, `stroke="#111" stroke-width="${lw.wall * 2.2}"`);
      if (g === 'S') line(b.x0 + inset, b.z1, b.x1 - inset, b.z1, `stroke="#111" stroke-width="${lw.wall * 2.2}"`);
      if (g === 'W') line(b.x0, b.z0 + inset, b.x0, b.z1 - inset, `stroke="#111" stroke-width="${lw.wall * 2.2}"`);
      if (g === 'E') line(b.x1, b.z0 + inset, b.x1, b.z1 - inset, `stroke="#111" stroke-width="${lw.wall * 2.2}"`);
    }
  });
  out.push(`</g>`);

  // ---- walls (pieces between openings) + panel joints
  out.push(`<g class="walls">`);
  for (const p of A.pieces) poly(quad(p.x1, p.z1, p.x2, p.z2, p.t), `fill="${p.sp ? '#f6e27a' : '#fff'}" stroke="#111" stroke-width="${lw.wall}" stroke-linejoin="miter"`);
  const seen = [];
  for (const e of A.ends) {
    if (e.cut || seen.some(s => Math.hypot(s.x - e.x, s.z - e.z) < 0.02) || A.corners.some(c => Math.hypot(c.x - e.x, c.z - e.z) < 0.35)) continue; seen.push(e);
    const h = e.t / 2; out.push(`<rect x="${X(e.x - h)}" y="${Y(e.z - h)}" width="${n3(e.t * k)}" height="${n3(e.t * k)}" fill="#fff" stroke="#111" stroke-width="${lw.thin}"/>`);
  }
  // 4″ × 4″ corner posts
  for (const c of A.corners) {
    const O = [c.x, c.z], P = (u, v, du, dv) => [O[0] + u[0] * du + v[0] * dv, O[1] + u[1] * du + v[1] * dv];
    poly([P(c.a, c.b, 0, 0), P(c.a, c.b, c.size, 0), P(c.a, c.b, c.size, c.wt), P(c.a, c.b, c.wt, c.wt), P(c.b, c.a, c.size, c.wt), P(c.b, c.a, c.size, 0)], `fill="#fff" stroke="#111" stroke-width="${lw.wall}"`);
  }
  // 48″ module joints on walls drawn as long runs
  for (const w of A.walls) {
    if (w.piece) continue;
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, t = w.t || 0.25;
    for (let s = 4; s < L - 0.05; s += 4) {
      const px = w.x1 + ux * s, py = w.y1 + uy * s;
      if (A.opInfo.some(i => V.segDist(px, py, i.o.x1, i.o.y1, i.o.x2, i.o.y2) < t)) continue;
      line(px - uy * t / 2, py + ux * t / 2, px + uy * t / 2, py - ux * t / 2, `stroke="#111" stroke-width="${lw.thin}"`);
    }
  }
  out.push(`</g>`);

  // ---- openings
  out.push(`<g class="openings">`);
  const tags = [];
  for (const i of A.opInfo) {
    const o = i.o, t = i.t, nx = -i.uz, nz = i.ux, sw = o.swing === -1 ? -1 : 1;
    const jamb = (x, y) => line(x + nx * t / 2, y + nz * t / 2, x - nx * t / 2, y - nz * t / 2, `stroke="#111" stroke-width="${lw.wall}"`);
    jamb(o.x1, o.y1); jamb(o.x2, o.y2);
    const cx = (o.x1 + o.x2) / 2, cy = (o.y1 + o.y2) / 2;
    if (o.type === 'door' || o.type === 'door2') {
      const leaf = (hx, hy, dir, w) => {
        const bx = hx + nx * sw * t / 2, by = hy + nz * sw * t / 2, tx = bx + nx * sw * w, ty = by + nz * sw * w;
        line(bx, by, tx, ty, `stroke="#111" stroke-width="${lw.thin * 1.6}"`);
        const ex = bx + i.ux * dir * w, ey = by + i.uz * dir * w;
        const cross = (tx - bx) * (ey - by) - (ty - by) * (ex - bx);
        out.push(`<path d="M${X(tx)},${Y(ty)} A${n3(w * k)},${n3(w * k)} 0 0 ${cross > 0 ? 1 : 0} ${X(ex)},${Y(ey)}" fill="none" stroke="#111" stroke-width="${lw.hair}" stroke-dasharray="0.03 0.02"/>`);
      };
      if (o.type === 'door') leaf(o.x1, o.y1, 1, i.len); else { leaf(o.x1, o.y1, 1, i.len / 2); leaf(o.x2, o.y2, -1, i.len / 2); }
      tags.push({ x: cx - nx * sw * (t / 2 + 1.1), y: cy - nz * sw * (t / 2 + 1.1), s: o.type === 'door' ? '3070' : '6070', box: true });
    } else if (o.type === 'glass') {
      poly(quad(o.x1, o.y1, o.x2, o.y2, t), `fill="#fff" stroke="#111" stroke-width="${lw.thin}"`);
      for (const f of [-0.18, 0.18]) line(o.x1 + nx * t * f, o.y1 + nz * t * f, o.x2 + nx * t * f, o.y2 + nz * t * f, `stroke="#111" stroke-width="${lw.hair * 1.5}"`);
      tags.push({ x: cx + nx * (t / 2 + 0.75), y: cy + nz * (t / 2 + 0.75), s: 'G' });
    } else if (o.type === 'pass') {
      const d = Math.max(t, o.depth || 2), q = quad(o.x1, o.y1, o.x2, o.y2, d);
      poly(quad(o.x1, o.y1, o.x2, o.y2, t), `fill="#fff" stroke="#111" stroke-width="${lw.thin}"`);
      poly(q, `fill="#e6e6e6" stroke="#111" stroke-width="${lw.thin * 1.4}"`);
      line(q[0][0], q[0][1], q[2][0], q[2][1], `stroke="#111" stroke-width="${lw.hair}"`); line(q[1][0], q[1][1], q[3][0], q[3][1], `stroke="#111" stroke-width="${lw.hair}"`);
      tags.push({ x: cx + nx * (d / 2 + 0.8), y: cy + nz * (d / 2 + 0.8), s: 'PT', box: true });
    } else {
      line(o.x1, o.y1, o.x2, o.y2, `stroke="#111" stroke-width="${lw.hair}" stroke-dasharray="0.04 0.03"`);
    }
  }
  out.push(`</g>`);

  // ---- S.P. labels
  for (const p of A.pieces) {
    if (!p.sp || p.len < 1.5) continue;
    const L = p.len, ux = (p.x2 - p.x1) / L, uz = (p.z2 - p.z1) / L, nx = -uz, nz = ux;
    const cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2, side = ((B.cx - cx) * nx + (B.cz - cz) * nz) > 0 ? 1 : -1;
    const ang = Math.atan2(uz, ux) * 180 / Math.PI, a = ang > 90 || ang <= -90 ? ang + 180 : ang;
    text(cx + nx * side * (p.t / 2 + 0.55), cz + nz * side * (p.t / 2 + 0.55), 'S.P.', fs.tag, 'text-anchor="middle" dominant-baseline="middle" font-weight="600"', a);
  }

  // ---- dimension chains
  const dims = [];
  {
    const lines = [];
    for (const w of A.walls) {
      const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 0.05) continue;
      let ang = Math.atan2(w.y2 - w.y1, w.x2 - w.x1); if (ang < 0) ang += Math.PI; if (ang >= Math.PI - 1e-6) ang -= Math.PI;
      const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      const c = w.x1 * nx + w.y1 * ny, a1 = w.x1 * ux + w.y1 * uy, a2 = w.x2 * ux + w.y2 * uy;
      let g = lines.find(l => Math.abs(l.ang - ang) < 0.01 && Math.abs(l.c - c) < 0.03);
      if (!g) { g = { ang, ux, uy, nx, ny, c, segs: [] }; lines.push(g); }
      const joints = [a1, a2];
      if (!w.piece) {
        const dir = Math.sign(a2 - a1) || 1;
        for (let s = 4; s < L - 0.05; s += 4) joints.push(a1 + dir * s);
        for (const i of A.opInfo) {
          if (V.segDist((i.o.x1 + i.o.x2) / 2, (i.o.y1 + i.o.y2) / 2, w.x1, w.y1, w.x2, w.y2) > (w.t || 0.25)) continue;
          joints.push(i.o.x1 * ux + i.o.y1 * uy, i.o.x2 * ux + i.o.y2 * uy);
        }
      }
      g.segs.push({ a: Math.min(a1, a2), b: Math.max(a1, a2), joints, t: w.t || 0.25 });
    }
    for (const g of lines) {
      g.segs.sort((p, q) => p.a - q.a);
      const chains = [];
      for (const s of g.segs) { const last = chains[chains.length - 1]; if (last && s.a <= last.b + 0.06) { last.b = Math.max(last.b, s.b); last.j.push(...s.joints); last.t = Math.max(last.t, s.t); } else chains.push({ a: s.a, b: s.b, j: [...s.joints], t: s.t }); }
      for (const ch of chains) {
        if (ch.b - ch.a < 1) continue;
        const js = [...new Set(ch.j.filter(v => v >= ch.a - 0.01 && v <= ch.b + 0.01).map(v => Math.round(v * 96) / 96))].sort((p, q) => p - q);
        // which side is outside? exterior if the line sits on the bounding box edge
        const axisX = Math.abs(g.uy) < 1e-3, axisY = Math.abs(g.ux) < 1e-3;
        let side = 0, ext = false;
        if (axisX) { const y = g.c * g.ny; if (Math.abs(y - B.minZ) < 0.6) { side = -Math.sign(g.ny); ext = true; } else if (Math.abs(y - B.maxZ) < 0.6) { side = Math.sign(g.ny); ext = true; } }
        if (axisY) { const x = g.c * g.nx; if (Math.abs(x - B.minX) < 0.6) { side = -Math.sign(g.nx); ext = true; } else if (Math.abs(x - B.maxX) < 0.6) { side = Math.sign(g.nx); ext = true; } }
        if (!side) { const mid = (ch.a + ch.b) / 2, mx = g.ux * mid + g.nx * g.c, my = g.uy * mid + g.ny * g.c; side = ((B.cx - mx) * g.nx + (B.cz - my) * g.ny) > 0 ? 1 : -1; }
        dims.push({ g, js, side, off: ext ? 2.2 : ch.t / 2 + 1.0, ext, faceOff: ch.t / 2 });
      }
    }
  }
  const drawChain = (g, js, side, off, faceOff, big) => {
    const P = (a, o) => [g.ux * a + g.nx * (g.c + side * o), g.uy * a + g.ny * (g.c + side * o)];
    const [s1x, s1y] = P(js[0], off), [s2x, s2y] = P(js[js.length - 1], off);
    line(s1x, s1y, s2x, s2y, `stroke="#111" stroke-width="${lw.dim}"`);
    const tick = 0.06 / k;
    let ang = Math.atan2(g.uy, g.ux) * 180 / Math.PI; const rot = ang > 90 || ang <= -90 ? ang + 180 : ang;
    js.forEach(a => {
      const [ex1, ey1] = P(a, faceOff + 0.15), [ex2, ey2] = P(a, off + 0.25);
      line(ex1, ey1, ex2, ey2, `stroke="#111" stroke-width="${lw.hair}"`);
      const [tx, ty] = P(a, off);
      const dx = (g.ux + g.nx * side) * tick, dy = (g.uy + g.ny * side) * tick;
      line(tx - dx, ty - dy, tx + dx, ty + dy, `stroke="#111" stroke-width="${lw.dim * 2.2}"`);
    });
    const size = big ? fs.dim * 1.15 : fs.dim;
    for (let i = 0; i + 1 < js.length; i++) {
      const seg = js[i + 1] - js[i]; if (seg < 1 / 96) continue;
      const str = big ? ftIn(seg) : dimText(seg), segPaper = seg * k, tw = str.length * size * 0.5;
      const lift = (segPaper < tw + 0.03) ? (i % 2 ? 0.17 : 0.06) : 0.06;
      // text sits just outside the dimension line; tight spaces alternate height so labels don't collide
      const [qx, qy] = P((js[i] + js[i + 1]) / 2, off + lift / k);
      text(qx, qy, str, size, 'text-anchor="middle" dominant-baseline="middle" fill="#111"', rot);
    }
  };
  for (const d of dims) drawChain(d.g, d.js, d.side, d.off, d.faceOff, false);
  // air chase dimensions: width string along the open face, located to the nearest walls on each side,
  // plus the depth along the chase's end
  for (const b of A.boxes) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0; if (w < 0.1 || d < 0.1) continue;
    let open = b.grille;
    if (!open) { // face with the most room in front of it
      const probe = { N: [(b.x0 + b.x1) / 2, b.z0 - 1], S: [(b.x0 + b.x1) / 2, b.z1 + 1], W: [b.x0 - 1, (b.z0 + b.z1) / 2], E: [b.x1 + 1, (b.z0 + b.z1) / 2] };
      let best = -1; for (const [f, [px, pz]] of Object.entries(probe)) { let m = 1e9; for (const p of A.pieces) m = Math.min(m, V.segDist(px, pz, p.x1, p.z1, p.x2, p.z2)); if (m > best) { best = m; open = f; } }
    }
    const horizFace = open === 'N' || open === 'S';
    // locate along the face line: nearest perpendicular wall faces either side within 16′
    const faceC = horizFace ? (open === 'N' ? b.z0 : b.z1) : (open === 'W' ? b.x0 : b.x1);
    const lo = horizFace ? b.x0 : b.z0, hi = horizFace ? b.x1 : b.z1;
    let left = null, right = null;
    for (const p of A.pieces) {
      const vert = Math.abs(p.x2 - p.x1) < 1e-3, hor = Math.abs(p.z2 - p.z1) < 1e-3;
      if (horizFace && vert) {
        const z0 = Math.min(p.z1, p.z2), z1 = Math.max(p.z1, p.z2); if (faceC < z0 - 0.05 || faceC > z1 + 0.05) continue;
        const fL = p.x1 + p.t / 2, fR = p.x1 - p.t / 2;
        if (fL <= lo + 0.01 && lo - fL < 16 && (left == null || fL > left)) left = fL;
        if (fR >= hi - 0.01 && fR - hi < 16 && (right == null || fR < right)) right = fR;
      }
      if (!horizFace && hor) {
        const x0 = Math.min(p.x1, p.x2), x1 = Math.max(p.x1, p.x2); if (faceC < x0 - 0.05 || faceC > x1 + 0.05) continue;
        const fL = p.z1 + p.t / 2, fR = p.z1 - p.t / 2;
        if (fL <= lo + 0.01 && lo - fL < 16 && (left == null || fL > left)) left = fL;
        if (fR >= hi - 0.01 && fR - hi < 16 && (right == null || fR < right)) right = fR;
      }
    }
    const js = [lo, hi]; if (left != null && lo - left > 1 / 48) js.unshift(left); if (right != null && right - hi > 1 / 48) js.push(right);
    const sideSign = (open === 'S' || open === 'E') ? 1 : -1;
    const gFace = horizFace ? { ux: 1, uy: 0, nx: 0, ny: 1, c: faceC } : { ux: 0, uy: 1, nx: 1, ny: 0, c: faceC };
    drawChain(gFace, js, sideSign, 0.95, 0.05, false);
    // depth, on the chase end with more room
    const depthLo = horizFace ? Math.min(b.z0, b.z1) : Math.min(b.x0, b.x1), depthHi = horizFace ? Math.max(b.z0, b.z1) : Math.max(b.x0, b.x1);
    const endA = horizFace ? b.x0 : b.z0, endB = horizFace ? b.x1 : b.z1;
    const useB = right == null || (left != null && right - hi > lo - left);
    const gEnd = horizFace ? { ux: 0, uy: 1, nx: 1, ny: 0, c: useB ? endB : endA } : { ux: 1, uy: 0, nx: 0, ny: 1, c: useB ? endB : endA };
    drawChain(gEnd, [depthLo, depthHi], useB ? 1 : -1, 0.7, 0.05, false);
  }
  // overall dimensions on the four sides
  if (!A.empty) {
    const over = (horiz, sideSign) => {
      const g = horiz ? { ux: 1, uy: 0, nx: 0, ny: 1, c: sideSign < 0 ? B.minZ : B.maxZ } : { ux: 0, uy: 1, nx: 1, ny: 0, c: sideSign < 0 ? B.minX : B.maxX };
      const js = horiz ? [B.minX, B.maxX] : [B.minZ, B.maxZ];
      drawChain(g, js, sideSign, 4.0, 0.2, true);
    };
    over(true, -1); over(false, -1); over(false, 1); over(true, 1);
  }

  // ---- tags + rooms
  for (const tg of tags) {
    if (tg.box) { const w = (tg.s.length * fs.tag * 0.62 + 0.08) / k, h = (fs.tag + 0.07) / k; out.push(`<rect x="${X(tg.x - w / 2)}" y="${Y(tg.y - h / 2)}" width="${n3(w * k)}" height="${n3(h * k)}" fill="#fff" stroke="#111" stroke-width="${lw.hair}"/>`); }
    text(tg.x, tg.y, tg.s, fs.tag, 'text-anchor="middle" dominant-baseline="central" fill="#111"');
  }
  for (const r of plan.rooms || []) {
    text(r.x, r.y - (r.dims ? 0.6 * fs.room / k : 0), (r.name || 'Room').toUpperCase(), fs.room, 'text-anchor="middle" dominant-baseline="middle" font-weight="700" letter-spacing="0.01" fill="#111"');
    if (r.dims) text(r.x, r.y + 0.75 * fs.room / k, r.dims, fs.room * 0.72, 'text-anchor="middle" dominant-baseline="middle" fill="#333"');
  }

  // ---- title block
  const tb = { x: M, y: PH - M - TB, w: PW - M * 2, h: TB };
  const date = opts.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const fx = (f) => n3(tb.x + tb.w * f);
  const cells = [
    [0, 0.30, 'COLL BUSINESS SOLUTIONS LLC', 'collbusinesssolutions@gmail.com'],
    [0.30, 0.58, 'PROJECT', plan.name || 'Untitled plan'],
    [0.58, 0.70, 'SCALE', scaleLabel],
    [0.70, 0.80, 'CEILING', ftIn(H)],
    [0.80, 0.91, 'DATE', date],
    [0.91, 1.0, 'SHEET', 'A-1']
  ];
  const tbOut = [`<rect x="${tb.x}" y="${n3(tb.y)}" width="${n3(tb.w)}" height="${n3(tb.h)}" fill="#fff" stroke="#111" stroke-width="${lw.wall}"/>`];
  cells.forEach(([a, b, h1, v], i) => {
    if (i) tbOut.push(`<line x1="${fx(a)}" y1="${n3(tb.y)}" x2="${fx(a)}" y2="${n3(tb.y + tb.h)}" stroke="#111" stroke-width="${lw.thin}"/>`);
    const big = i === 0 || i === 1;
    tbOut.push(`<text x="${n3(fx(a) + 0.1)}" y="${n3(tb.y + 0.2)}" font-size="${i === 0 ? 0.13 : 0.075}" font-weight="700" letter-spacing="0.01" fill="#111">${esc(h1)}</text>`);
    tbOut.push(`<text x="${n3(fx(a) + 0.1)}" y="${n3(tb.y + (big ? 0.52 : 0.5))}" font-size="${big ? (i === 0 ? 0.085 : 0.16) : 0.11}" ${i === 1 ? 'font-weight="700"' : ''} fill="#222">${esc(v)}</text>`);
  });
  tbOut.push(`<text x="${n3(tb.x + 0.1)}" y="${n3(tb.y + tb.h - 0.12)}" font-size="0.065" fill="#555">FLOOR PLAN · ${esc(dimText(B.w))} × ${esc(dimText(B.d))} · Drawn with Coll Plan3D</text>`);
  // legend
  tbOut.push(`<g transform="translate(${fx(0.30) + 0.1},${n3(tb.y + tb.h - 0.27)})"><rect width="0.22" height="0.1" fill="#f6e27a" stroke="#111" stroke-width="${lw.hair}"/><text x="0.28" y="0.085" font-size="0.07" fill="#333">S.P. PANEL</text>
    <rect x="1.05" width="0.22" height="0.1" fill="#fff" stroke="#111" stroke-width="${lw.hair}"/><text x="1.33" y="0.085" font-size="0.07" fill="#333">3070 / 6070 DOOR · G GLASS · PT PASS-THRU</text></g>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}in" height="${PH}in" viewBox="0 0 ${PW} ${PH}" font-family="Arial Narrow, Bahnschrift, Arial, Helvetica, sans-serif">
<rect width="${PW}" height="${PH}" fill="#fff"/>
<rect x="${M / 2}" y="${M / 2}" width="${PW - M}" height="${PH - M}" fill="none" stroke="#111" stroke-width="${lw.wall}"/>
${out.join('\n')}
${tbOut.join('\n')}
</svg>`;
  return { svg, page, scaleLabel, k, rotated: opts.rotate === 90 };
}

function sheetHTML(sheet, title) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title || 'Floor plan')}</title>
<style>@page{size:${sheet.page.w}in ${sheet.page.h}in;margin:0}html,body{margin:0;padding:0;background:#fff}svg{display:block}</style></head><body>${sheet.svg}</body></html>`;
}

global.Plan3DSheet = { makeSheet, sheetHTML, PAGES, dimText };
})(window);
