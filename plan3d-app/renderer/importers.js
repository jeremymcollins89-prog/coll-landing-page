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
        const d = P[j].c - P[i].c; if (d > maxT + 1e-4) break; if (d < minT - 1e-4) continue; // a hair of slack: 2″ drawn as 1.9999″
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

/* Where the drawing's corner lands on the plan: DXF y is up, plan y is down; origin at the top-left of the selection. */
function dxfFrame(data, o) {
  // a drawing added to a project that came from a drawing in the same coordinates: the same origin, so it lands
  // right where it belongs (o.frame: that origin, in feet)
  if (o.frame && isFinite(o.frame.x0)) { const k = o.unitFt, f = o.frame; return { k, minX: f.x0 / k, maxY: f.y0 / k, P: (x, y) => [x * k - f.x0, f.y0 - y * k] }; }
  let minX = 1e18, maxY = -1e18;
  const FL = o.frameLayers && o.frameLayers.size ? o.frameLayers : o.layers;
  for (const s of data.segs) if (FL.has(s[4])) { minX = Math.min(minX, s[0], s[2]); maxY = Math.max(maxY, s[1], s[3]); }
  if (o.keepOrigin || !(minX < 1e17)) { minX = 0; maxY = 0; } // drawings saved by Coll Plan3D: keep the project's own coordinates
  const k = o.unitFt;
  return { k, minX, maxY, P: (x, y) => [(x - minX) * k, (maxY - y) * k] };
}

/* Join segments that lie on the same straight line and overlap or nearly touch (gap ≤ gapFt). */
function joinCollinear(S, gapFt) {
  const L = [];
  for (const s of S) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy); if (len < 1e-6) continue;
    let ux = dx / len, uy = dy / len; if (ux < -1e-9 || (Math.abs(ux) < 1e-9 && uy < 0)) { ux = -ux; uy = -uy; }
    const c = -uy * s.x1 + ux * s.y1, a = s.x1 * ux + s.y1 * uy, b = s.x2 * ux + s.y2 * uy;
    L.push({ ux, uy, c, a: Math.min(a, b), b: Math.max(a, b), ang: Math.atan2(uy, ux) });
  }
  L.sort((p, r) => p.ang - r.ang || p.c - r.c || p.a - r.a);
  const out = []; let i = 0;
  while (i < L.length) {
    let j = i; const grp = [];
    while (j < L.length && Math.abs(L[j].ang - L[i].ang) < 0.002 && Math.abs(L[j].c - L[i].c) < 0.004) grp.push(L[j++]);
    grp.sort((p, r) => p.a - r.a);
    let cur = { ...grp[0] };
    const push = (g) => out.push({ x1: g.ux * g.a - g.uy * g.c, y1: g.uy * g.a + g.ux * g.c, x2: g.ux * g.b - g.uy * g.c, y2: g.uy * g.b + g.ux * g.c });
    for (let k = 1; k < grp.length; k++) { const g = grp[k]; if (g.a <= cur.b + gapFt) cur.b = Math.max(cur.b, g.b); else { push(cur); cur = { ...g }; } }
    push(cur); i = j;
  }
  return out;
}
/* Wall pieces on the same line (centerlines within 1″) that overlap or are split by a small gap
   (a ribbed panel face, a joint line) become one wall; it keeps the thickest piece's thickness. */
function joinWalls(walls, gapFt) {
  const L = walls.map(w => {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = Math.hypot(dx, dy) || 1;
    let ux = dx / len, uy = dy / len; if (ux < -1e-9 || (Math.abs(ux) < 1e-9 && uy < 0)) { ux = -ux; uy = -uy; }
    const a = w.x1 * ux + w.y1 * uy, b = w.x2 * ux + w.y2 * uy;
    return { w, ux, uy, ang: Math.atan2(uy, ux), c: -uy * w.x1 + ux * w.y1, a: Math.min(a, b), b: Math.max(a, b), t: w.t };
  }).sort((p, r) => p.ang - r.ang || p.c - r.c);
  const used = new Array(L.length).fill(false), out = [];
  for (let i = 0; i < L.length; i++) {
    if (used[i]) continue;
    const grp = [L[i]]; used[i] = true;
    for (let j = i + 1; j < L.length && Math.abs(L[j].ang - L[i].ang) < 0.004; j++) if (!used[j] && Math.abs(L[j].c - L[i].c) <= 1 / 12) { grp.push(L[j]); used[j] = true; }
    grp.sort((p, r) => p.a - r.a);
    let cur = null;
    const push = (g) => { const c = g.cs / g.n; out.push({ ...g.w, x1: g.ux * g.a - g.uy * c, y1: g.uy * g.a + g.ux * c, x2: g.ux * g.b - g.uy * c, y2: g.uy * g.b + g.ux * c, t: g.t }); };
    for (const g of grp) {
      if (cur && g.a <= cur.b + gapFt && Math.abs(g.t - cur.t) <= 2 / 12) { cur.b = Math.max(cur.b, g.b); if (g.b - g.a > cur.lw) { cur.lw = g.b - g.a; cur.t = Math.max(cur.t, g.t); } cur.cs += g.c * (g.b - g.a); cur.n += (g.b - g.a); }
      else { if (cur) push(cur); cur = { w: g.w, ux: g.ux, uy: g.uy, a: g.a, b: g.b, t: g.t, lw: g.b - g.a, cs: g.c * (g.b - g.a), n: g.b - g.a }; }
    }
    if (cur) push(cur);
  }
  return out;
}
/* DXF: segs [[x1,y1,x2,y2,layer]] in drawing units */
function wallsFromDxf(data, o) {
  const k = o.unitFt;
  const segs = data.segs.filter(s => o.layers.has(s[4]));
  if (!segs.length) return [];
  const { minX, maxY } = dxfFrame(data, o);
  const S = segs.map(s => ({ x1: (s[0] - minX) * k, y1: (maxY - s[1]) * k, x2: (s[2] - minX) * k, y2: (maxY - s[3]) * k }));
  let walls;
  // Lines drawn in pieces along one straight line (ribbed metal panel faces, panel joints, Revit's wall
  // breaks) are joined across gaps of up to 1½″ first, so a wall doesn't come in as a row of dashes.
  const S2 = joinCollinear(S, 1.5 / 12);
  if (o.mode === 'single') walls = S2.map(s => ({ ...s, t: o.tFt }));
  else walls = pairLines(S2, o.minT, o.maxT, o.minLen);
  walls = joinWalls(mergeLayered(joinWalls(walls, 2.5 / 12)), 2.5 / 12);
  snapJunctions(walls, Math.max(0.6, o.maxT * 2.5));
  return finish(walls, o.minLen);
}
/* Doors, windows and pass-thrus drawn as blocks (symbols) → openings on the walls they sit in.
   A block counts when its name or layer says so (DOOR, DR, DLG330, DDG360, WINDOW, GLAZ, PASS …) or when it
   holds a door-sized swing arc. Its length along the wall is the opening; the side it sticks out is the swing;
   the arc's centre is the hinge. Returns { openings, found: {door, door2, glass, pass}, names: {block: type} } */
const RX_DOOR = /door|\bdr\b|^dr[-_ ]?\d|^d[a-z]{0,3}\d{2,4}$|^(dlg|ddg|dsg|dss|dds|dl|dd|sd|dbl)[-_]?\d/i;
const RX_GLASS = /window|glaz|glass|^wi?n?[-_]?\d|vision|^vg[-_]?\d|lite\b/i;
const RX_PASS = /pass[-_ ]?thr|passthr|^pt[-_]?\d|^ptb/i;
const RX_NOT = /stud|post|col(umn)?\b|chase|ffu|light|grid|title|north|dim|tag|anno|furn|equip|bench|text|logo|border/i;
function blockKind(b, k) {
  const nm = b.name || '', lay = b.layer || '', both = nm + ' ' + lay + ' ' + (b.text || '');
  if (RX_NOT.test(nm)) return null;
  const w = (b.box.x1 - b.box.x0) * k, h = (b.box.y1 - b.box.y0) * k, big = Math.max(w, h);
  if (big < 1.4 || big > 14) return null;
  if (RX_PASS.test(both)) return 'pass';
  if (RX_DOOR.test(nm) || /door/i.test(lay)) return 'door';
  if (RX_GLASS.test(nm) || /glaz|window|glass/i.test(lay)) return 'glass';
  // no name to go on: a swing arc 1.5′–5′ across makes it a door
  if ((b.arcs || []).some(a => a.r * k >= 1.4 && a.r * k <= 5)) return 'door';
  return null;
}
function openingsFromDxf(data, walls, o, types) {
  types = types || {};
  const F = dxfFrame(data, o), k = F.k, out = [], found = { door: 0, door2: 0, glass: 0, pass: 0 }, names = {};
  for (const b of data.blocks || []) {
    if (!b.box) continue;
    let kind = types[b.name] != null ? types[b.name] : blockKind(b, k);
    if (!kind || kind === 'none') continue;
    // block point (lx, ly) → plan feet
    const W = (lx, ly) => F.P(b.o[0] + b.u[0] * lx + b.v[0] * ly, b.o[1] + b.u[1] * lx + b.v[1] * ly);
    // which local axis runs along a wall: try x, then y
    let best = null;
    for (const axis of ['x', 'y']) {
      const A = axis === 'x' ? W(b.box.x0, 0) : W(0, b.box.y0), B = axis === 'x' ? W(b.box.x1, 0) : W(0, b.box.y1);
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]); if (len < 1.2) continue;
      const ax = (B[0] - A[0]) / len, ay = (B[1] - A[1]) / len, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      for (const w of walls) {
        const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 0.3) continue;
        const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
        if (Math.abs(ax * uy - ay * ux) > 0.08) continue; // not parallel
        const d = Math.abs(-(mx - w.x1) * uy + (my - w.y1) * ux); if (d > Math.max(w.t, 0.25) / 2 + 0.6) continue;
        const sm = (mx - w.x1) * ux + (my - w.y1) * uy; if (sm < -len / 2 - 0.5 || sm > L + len / 2 + 0.5) continue;
        if (!best || d < best.d) best = { d, w, ux, uy, A, B, len, axis };
      }
    }
    if (!best) continue;
    const { w, ux, uy } = best;
    // project the ends onto the wall's centreline
    const pr = (p) => { const s0 = (p[0] - w.x1) * ux + (p[1] - w.y1) * uy; return [w.x1 + ux * s0, w.y1 + uy * s0]; };
    let p1 = pr(best.A), p2 = pr(best.B);
    if (kind === 'door' && best.len > 4.6) kind = 'door2';
    // hinge: the arc centre nearest an end goes first (single doors hinge at the opening's first end)
    if (kind === 'door' && b.arcs && b.arcs.length) {
      const a = b.arcs.slice().sort((x, y) => y.r - x.r)[0], H = W(a.x, a.y);
      if (Math.hypot(H[0] - p2[0], H[1] - p2[1]) < Math.hypot(H[0] - p1[0], H[1] - p1[1])) { const t = p1; p1 = p2; p2 = t; }
    }
    // swing: the side the block sticks out of the wall
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, nx = -(p2[1] - p1[1]) / L, ny = (p2[0] - p1[0]) / L;
    const far = best.axis === 'x' ? (Math.abs(b.box.y1) >= Math.abs(b.box.y0) ? b.box.y1 : b.box.y0) : (Math.abs(b.box.x1) >= Math.abs(b.box.x0) ? b.box.x1 : b.box.x0);
    const O = W(0, 0), S2 = best.axis === 'x' ? W(0, far) : W(far, 0);
    const swing = ((S2[0] - O[0]) * nx + (S2[1] - O[1]) * ny) >= 0 ? 1 : -1;
    if (out.some(q => Math.hypot((q.x1 + q.x2) / 2 - (p1[0] + p2[0]) / 2, (q.y1 + q.y2) / 2 - (p1[1] + p2[1]) / 2) < 0.5)) continue;
    const op = { id: uid(), type: kind, x1: q(p1[0]), y1: q(p1[1]), x2: q(p2[0]), y2: q(p2[1]), t: w.t, swing, from: b.name };
    if (kind === 'glass') { op.sill = 3; op.head = 7; } else if (kind === 'pass') { op.sill = 3; op.head = 5; op.depth = 2; } else op.head = 7;
    out.push(op); found[kind]++; names[b.name] = kind;
  }
  return { openings: out, found, names };
}
/* Door swings drawn as plain arcs on the sheet instead of door blocks: the arc's centre is the hinge at the
   end of a wall, and across the gap is the next wall on the same line. The gap gets a wall piece with a door
   in it; two swings meeting in one gap make a pair. have: openings already found (from door blocks). */
function arcDoors(data, walls, o, have) {
  const F = dxfFrame(data, o), k = F.k, gaps = new Map(), addW = [], addO = [], found = { door: 0, door2: 0 };
  const ends = [];
  for (const w of walls) {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 0.3) continue;
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    ends.push({ w, x: w.x2, y: w.y2, ux, uy }, { w, x: w.x1, y: w.y1, ux: -ux, uy: -uy });
  }
  for (const a of data.arcs || []) {
    if (/dim|anno|text|grid|detl|detail|ffu|light/i.test(a.layer)) continue;
    let sw = a.a1 - a.a0; while (sw <= 0) sw += Math.PI * 2;
    const R = a.r * k; if (R < 1.4 || R > 5 || sw < 1.25 || sw > 1.9) continue;
    const H = F.P(a.x, a.y), am = a.a0 + sw / 2, M = F.P(a.x + a.r * Math.cos(am), a.y + a.r * Math.sin(am));
    const P0 = F.P(a.x + a.r * Math.cos(a.a0), a.y + a.r * Math.sin(a.a0)), P1 = F.P(a.x + a.r * Math.cos(a.a1), a.y + a.r * Math.sin(a.a1));
    // the wall line runs along the closed leaf: from the hinge to whichever arc end lines up with a wall
    let best = null;
    for (const C of [P0, P1]) {
      const ux = (C[0] - H[0]) / R, uy = (C[1] - H[1]) / R;
      // wall ends sitting on that line: the nearest one behind the hinge (up to 5′ back, door frames and filler
      // pieces are often on their own layers) and the nearest one past the leaf (up to 2½′ on)
      let back = null, fwd = null;
      for (const e of ends) {
        const dx = e.x - H[0], dy = e.y - H[1], s = dx * ux + dy * uy, lat = Math.abs(-dx * uy + dy * ux);
        const par = Math.abs(ux * e.uy - uy * e.ux) < 0.03;
        if (lat > (par ? 0.35 : 0.35 + (e.w.t || 0.25) / 2)) continue;
        // a wall on the line must point away from the gap; a cross wall just ends on the line
        if (s <= 0.3 && s >= -5 && (!par || e.ux * ux + e.uy * uy > 0.9) && (!back || s > back.s)) back = { e, s };
        if (s >= R - 0.4 && s <= R + 2.5 && (!par || e.ux * ux + e.uy * uy < -0.9) && (!fwd || s < fwd.s)) fwd = { e, s };
      }
      if (!back || !fwd) continue;
      const sc = -back.s + (fwd.s - R);
      if (!best || sc < best.sc) best = { ux, uy, back, fwd, sc };
    }
    if (!best) continue;
    const { ux, uy, back, fwd } = best;
    const S = [H[0] + ux * back.s, H[1] + uy * back.s], len = fwd.s - back.s;
    const key = S[0].toFixed(1) + ',' + S[1].toFixed(1) + '|' + (H[0] + ux * fwd.s).toFixed(1) + ',' + (H[1] + uy * fwd.s).toFixed(1);
    const key2 = (H[0] + ux * fwd.s).toFixed(1) + ',' + (H[1] + uy * fwd.s).toFixed(1) + '|' + S[0].toFixed(1) + ',' + S[1].toFixed(1);
    const n = [-uy, ux], side = ((M[0] - H[0]) * n[0] + (M[1] - H[1]) * n[1]) >= 0 ? 1 : -1;
    const g = gaps.get(key) || gaps.get(key2) || { S, ux, uy, len, t: back.e.w.t || fwd.e.w.t || 0.25, leaves: [] };
    gaps.set(gaps.has(key2) ? key2 : key, g);
    // positions along this gap's own direction
    const at = (P) => (P[0] - g.S[0]) * g.ux + (P[1] - g.S[1]) * g.uy;
    const hA = at(H), cA = hA + (ux * g.ux + uy * g.uy) * R;
    // swing: which side of the gap's line the door opens to
    const gn = [-g.uy, g.ux], gside = ((M[0] - H[0]) * gn[0] + (M[1] - H[1]) * gn[1]) >= 0 ? 1 : -1;
    if (!g.leaves.some(x => Math.abs(x.hA - hA) < 0.1)) g.leaves.push({ hA, lo: Math.max(0, Math.min(hA, cA)), hi: Math.min(g.len, Math.max(hA, cA)), side: gside });
  }
  for (const g of gaps.values()) {
    const { S, ux, uy, len } = g, mx = S[0] + ux * len / 2, my = S[1] + uy * len / 2;
    if ((have || []).some(op => Math.hypot((op.x1 + op.x2) / 2 - mx, (op.y1 + op.y2) / 2 - my) < Math.max(1, len / 2))) continue;
    addW.push({ id: uid(), x1: q(S[0]), y1: q(S[1]), x2: q(S[0] + ux * len), y2: q(S[1] + uy * len), t: Math.min(g.t, 0.67) });
    const pair = g.leaves.length > 1, L0 = g.leaves[0];
    const s1 = Math.min(...g.leaves.map(x => x.lo)), s2 = Math.max(...g.leaves.map(x => x.hi));
    let p1 = [S[0] + ux * s1, S[1] + uy * s1], p2 = [S[0] + ux * s2, S[1] + uy * s2], swing = L0.side;
    // a single door lists its hinge end first
    if (!pair && Math.abs(L0.hA - s2) < Math.abs(L0.hA - s1)) { const t = p1; p1 = p2; p2 = t; swing = -swing; }
    const op = { id: uid(), type: pair ? 'door2' : 'door', x1: q(p1[0]), y1: q(p1[1]), x2: q(p2[0]), y2: q(p2[1]), t: Math.min(g.t, 0.67), swing, head: 7, from: 'door swing' };
    addO.push(op); found[op.type]++;
  }
  return { walls: addW, openings: addO, found };
}
/* Other drawings on the sheet that aren't walls: a ceiling grid (a field of long straight lines at an even
   2′ / 4′ spacing) and steel beams (three or more long parallel lines, evenly spaced 3′–16′ apart), on layers
   that aren't the wall layers. Plan feet, same frame as the walls. Returns { grids: [{lines, box}], beams: [] } */
const RX_EXTRA_SKIP = /dim|anno|text|hatch|patt|detl|detail|door|glaz|stud|title|iden|tag|symb|furn|equip|spcq|genm|sanr|ffu|hepa|light|elev|sect|xref|defpoints|viewport|border|logo|rail|stair/i;
function sheetExtras(data, o) {
  const F = dxfFrame(data, o), segs = [];
  for (const q of data.segs) {
    if (o.layers.has(q[4]) || RX_EXTRA_SKIP.test(q[4])) continue;
    const a = F.P(q[0], q[1]), b = F.P(q[2], q[3]), L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
    const ax = Math.abs(a[0] - b[0]) < 0.02 ? 'v' : Math.abs(a[1] - b[1]) < 0.02 ? 'h' : null; if (!ax) continue;
    segs.push({ a, b, L, ax, layer: q[4], x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) });
  }
  // groups of lines near each other
  const clusters = (S, pad) => {
    const par = S.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
    // bucket by a coarse cell so this stays quick on a big sheet
    const cell = 40, buckets = new Map();
    S.forEach((g, i) => { for (let X = Math.floor((g.x0 - pad) / cell); X <= Math.floor((g.x1 + pad) / cell); X++) for (let Y = Math.floor((g.y0 - pad) / cell); Y <= Math.floor((g.y1 + pad) / cell); Y++) { const k = X + ',' + Y; (buckets.get(k) || buckets.set(k, []).get(k)).push(i); } });
    for (const L of buckets.values()) for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
      const i = L[a], j = L[b], p = S[i], q = S[j]; if (find(i) === find(j)) continue;
      if (p.x0 - pad <= q.x1 && q.x0 - pad <= p.x1 && p.y0 - pad <= q.y1 && q.y0 - pad <= p.y1) par[find(i)] = find(j);
    }
    const m = new Map(); S.forEach((g, i) => { const r = find(i); (m.get(r) || m.set(r, []).get(r)).push(g); }); return [...m.values()];
  };
  // most common spacing between distinct line positions, and how many gaps are whole multiples of it
  const spacing = (pos) => {
    const u = [...new Set(pos.map(v => Math.round(v * 48) / 48))].sort((x, y) => x - y); if (u.length < 5) return null;
    const cnt = new Map(); for (let i = 1; i < u.length; i++) { const d = Math.round((u[i] - u[i - 1]) * 24) / 24; if (d >= 1.4 && d <= 5.1) cnt.set(d, (cnt.get(d) || 0) + 1); }
    if (!cnt.size) return null;
    const sp = [...cnt.entries()].sort((x, y) => y[1] - x[1])[0][0];
    let ok = 0; for (let i = 1; i < u.length; i++) { const r = (u[i] - u[i - 1]) / sp; if (Math.abs(r - Math.round(r)) < 0.06 && Math.round(r) <= 3) ok++; }
    return ok / (u.length - 1) >= 0.6 ? sp : null;
  };
  const grids = [], used = new Set();
  for (const C of clusters(segs.filter(g => g.L >= 4), 2.5)) {
    const V = C.filter(g => g.ax === 'v'), H = C.filter(g => g.ax === 'h');
    if (V.length < 5 || H.length < 5) continue;
    if (!spacing(V.map(g => g.a[0])) || !spacing(H.map(g => g.a[1]))) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; C.forEach(g => { x0 = Math.min(x0, g.x0); x1 = Math.max(x1, g.x1); y0 = Math.min(y0, g.y0); y1 = Math.max(y1, g.y1); used.add(g); });
    grids.push({ lines: C.map(g => [g.a[0], g.a[1], g.b[0], g.b[1]]), box: { x0, y0, x1, y1 } });
  }
  grids.sort((p, q) => q.lines.length - p.lines.length);
  // beams: long lines, side by side, evenly spaced
  const beams = [];
  const long = segs.filter(g => !used.has(g) && g.L >= 20 && !/grid|axis/i.test(g.layer));
  for (const ax of ['v', 'h']) {
    for (const C of clusters(long.filter(g => g.ax === ax), 16)) {
      const off = (g) => ax === 'v' ? g.a[0] : g.a[1];
      const S2 = C.slice().sort((p, q) => off(p) - off(q));
      // a beam drawn as its two flange lines (closer than 1′): one beam down the middle
      const one = [];
      for (const g of S2) { const last = one[one.length - 1]; if (last && off(g) - last.o < 1 && Math.abs(g.L - last.g.L) < 2) { last.o = (last.o + off(g)) / 2; last.n++; } else one.push({ g, o: off(g), n: 1 }); }
      if (one.length < 3) continue;
      const gaps = one.slice(1).map((x, i) => x.o - one[i].o).sort((p, q) => p - q), med = gaps[gaps.length >> 1];
      if (med < 3 || med > 16) continue;
      for (const x of one) {
        const g = x.g, lo = ax === 'v' ? g.y0 : g.x0, hi = ax === 'v' ? g.y1 : g.x1;
        beams.push(ax === 'v' ? { x1: x.o, y1: lo, x2: x.o, y2: hi } : { x1: lo, y1: x.o, x2: hi, y2: x.o });
      }
    }
  }
  return { grids, beams };
}
/* Where a drawing of lines (a ceiling grid) sits on the walls: try lining its corners up with wall ends and
   keep the shift that puts the most line ends against a wall. prefer(box): a bonus for a spot (inside the
   building, say). Returns { dx, dy, score: share of line ends on a wall }. */
function alignToWalls(lines, walls, prefer) {
  const cell = 0.5, hit = new Set(), key = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
  for (const w of walls) {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), r = (w.t || 0.25) / 2 + 0.6, n = Math.max(1, Math.ceil(L / (cell / 2)));
    for (let i = 0; i <= n; i++) { const x = w.x1 + (w.x2 - w.x1) * i / n, y = w.y1 + (w.y2 - w.y1) * i / n; for (let a = -r; a <= r + 1e-9; a += cell / 2) for (let b = -r; b <= r + 1e-9; b += cell / 2) hit.add(key(x + a, y + b)); }
  }
  let pts = []; for (const q of lines) pts.push([q[0], q[1]], [q[2], q[3]]);
  if (pts.length > 500) { const st = Math.ceil(pts.length / 500); pts = pts.filter((_, i) => i % st === 0); }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of lines) { x0 = Math.min(x0, q[0], q[2]); x1 = Math.max(x1, q[0], q[2]); y0 = Math.min(y0, q[1], q[3]); y1 = Math.max(y1, q[1], q[3]); }
  const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]], tried = new Set();
  let best = { dx: 0, dy: 0, score: -1, raw: -1 };
  for (const w of walls) for (const [ex, ey] of [[w.x1, w.y1], [w.x2, w.y2]]) for (const [cx, cy] of corners) for (const sx of [-1, 0, 1]) for (const sy of [-1, 0, 1]) {
    // the drawing's corner is at the inside face of the corner wall: try a half-thickness either way
    const h = (w.t || 0.25) / 2, dx = ex - cx + sx * h, dy = ey - cy + sy * h, k = Math.round(dx * 8) + ',' + Math.round(dy * 8);
    if (tried.has(k)) continue; tried.add(k);
    let n = 0; for (const [px, py] of pts) if (hit.has(key(px + dx, py + dy))) n++;
    const raw = n / pts.length, sc = raw + (prefer && prefer(x0 + dx, y0 + dy, x1 + dx, y1 + dy) ? 0.04 : 0);
    if (sc > best.score) best = { dx, dy, score: sc, raw };
  }
  return { dx: best.dx, dy: best.dy, score: best.raw };
}
/* The block names in a drawing that look like doors / windows / pass-thrus, with counts, for the import dialog. */
function dxfOpeningBlocks(data, unitFt) {
  const m = new Map();
  for (const b of data.blocks || []) {
    if (!b.box) continue;
    const kind = blockKind(b, unitFt); if (!kind) continue;
    const e = m.get(b.name) || { name: b.name, layer: b.layer, kind, n: 0, w: (b.box.x1 - b.box.x0) * unitFt };
    e.n++; m.set(b.name, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
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

/* Which imported walls are a building around the cleanroom (a warehouse shell)? For each group of joined
   walls, its outside walls (open to the outdoors) count as a building when the group also holds a room of
   walls that stands free of them, a cleanroom inside a warehouse. Openings close their gaps for this.
   Returns a Set of wall ids. mode: 'auto' | 'all' (every outside wall) | 'none'. */
function buildingWalls(walls, openings, mode) {
  const out = new Set(); out.strays = new Set(); if (!walls.length) return out;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const w of walls) { x0 = Math.min(x0, w.x1, w.x2); x1 = Math.max(x1, w.x1, w.x2); y0 = Math.min(y0, w.y1, w.y2); y1 = Math.max(y1, w.y1, w.y2); }
  const c = 0.5, gx = x0 - 3, gy = y0 - 3, nx = Math.ceil((x1 - x0 + 6) / c), ny = Math.ceil((y1 - y0 + 6) / c);
  if (nx * ny > 4e6) return out;
  const solid = new Uint8Array(nx * ny);
  const stamp = (ax, ay, bx, by, t) => { const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / (c / 2))), r = Math.max(t / 2, c * 0.6); for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n; const i0 = Math.floor((x - r - gx) / c), i1 = Math.floor((x + r - gx) / c), j0 = Math.floor((y - r - gy) / c), j1 = Math.floor((y + r - gy) / c); for (let j = Math.max(0, j0); j <= Math.min(ny - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) solid[j * nx + i] = 1; } };
  for (const w of walls) stamp(w.x1, w.y1, w.x2, w.y2, w.t || 0.25);
  for (const o of openings || []) stamp(o.x1, o.y1, o.x2, o.y2, o.t || 0.25);
  // an unmarked opening (up to 16′) between two walls on one straight line still closes the outline here
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const a = walls[i], b = walls[j], la = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) || 1, ux = (a.x2 - a.x1) / la, uy = (a.y2 - a.y1) / la, lb = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) || 1;
    if (Math.abs(ux * (b.y2 - b.y1) / lb - uy * (b.x2 - b.x1) / lb) > 0.01 || Math.abs((b.x1 - a.x1) * -uy + (b.y1 - a.y1) * ux) > 0.5) continue;
    let best = null, bd = 16;
    for (const [ex, ey] of [[a.x1, a.y1], [a.x2, a.y2]]) for (const [fx, fy] of [[b.x1, b.y1], [b.x2, b.y2]]) { const g = Math.hypot(fx - ex, fy - ey); const mx = (ex + fx) / 2, my = (ey + fy) / 2, sA = (mx - a.x1) * ux + (my - a.y1) * uy, sB = (mx - b.x1) * ux + (my - b.y1) * uy; if (g < bd && (sA < 0 || sA > la) && (sB * Math.sign(sB) > 0)) { bd = g; best = [ex, ey, fx, fy]; } }
    if (best) stamp(best[0], best[1], best[2], best[3], Math.min(a.t || 0.25, b.t || 0.25));
  }
  const outside = new Uint8Array(nx * ny), st = [];
  const push = (k) => { if (!solid[k] && !outside[k]) { outside[k] = 1; st.push(k); } };
  for (let i = 0; i < nx; i++) { push(i); push((ny - 1) * nx + i); } for (let j = 0; j < ny; j++) { push(j * nx); push(j * nx + nx - 1); }
  while (st.length) { const k = st.pop(), i = k % nx, j = (k - i) / nx; if (i > 0) push(k - 1); if (i < nx - 1) push(k + 1); if (j > 0) push(k - nx); if (j < ny - 1) push(k + nx); }
  const isOut = (x, y) => { const i = Math.floor((x - gx) / c), j = Math.floor((y - gy) / c); return i < 0 || j < 0 || i >= nx || j >= ny || outside[j * nx + i]; };
  const both = walls.map(w => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = -(w.y2 - w.y1) / L, uy = (w.x2 - w.x1) / L, off = (w.t || 0.25) / 2 + 0.9; let n = 0; for (const f of [0.25, 0.5, 0.75]) { const mx = w.x1 + (w.x2 - w.x1) * f, my = w.y1 + (w.y2 - w.y1) * f; if (isOut(mx + ux * off, my + uy * off) && isOut(mx - ux * off, my - uy * off)) n++; } return n >= 2; });
  const ext = walls.map(w => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = -(w.y2 - w.y1) / L, uy = (w.x2 - w.x1) / L, off = (w.t || 0.25) / 2 + 0.9; let n = 0; for (const f of [0.25, 0.5, 0.75]) { const mx = w.x1 + (w.x2 - w.x1) * f, my = w.y1 + (w.y2 - w.y1) * f; if (isOut(mx + ux * off, my + uy * off) || isOut(mx - ux * off, my - uy * off)) n++; } return n >= 2; });
  // groups of walls that touch (within 1′)
  const near = (a, b) => { const d = (px, py, w) => { const L2 = (w.x2 - w.x1) ** 2 + (w.y2 - w.y1) ** 2 || 1; let t = ((px - w.x1) * (w.x2 - w.x1) + (py - w.y1) * (w.y2 - w.y1)) / L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - w.x1 - t * (w.x2 - w.x1), py - w.y1 - t * (w.y2 - w.y1)); }; return Math.min(d(a.x1, a.y1, b), d(a.x2, a.y2, b), d(b.x1, b.y1, a), d(b.x2, b.y2, a)) < 1 + ((a.t || 0.25) + (b.t || 0.25)) / 2; };
  const par = walls.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i]))), join = (a, b) => { par[find(a)] = find(b); };
  // strays: a lone wall standing outside everything (a curb, a sign, a bench drawn on a wall layer)
  out.strays = new Set(walls.filter((w, i) => both[i] && !walls.some((o, j) => j !== i && near(w, o))).map(w => w.id));
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) if (near(walls[i], walls[j])) join(i, j);
  // a door or window joins the wall pieces on either side of it
  for (const o of openings || []) { const ow = { x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, t: o.t }; let first = -1; walls.forEach((w, i) => { if (near(w, ow)) { if (first < 0) first = i; else join(first, i); } }); }
  const groups = new Map(); walls.forEach((w, i) => { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(i); });
  if (mode === 'none') return out;
  for (const g of groups.values()) {
    const E = g.filter(i => ext[i] && !out.strays.has(walls[i].id)); if (!E.length) continue;
    if (mode === 'all') { E.forEach(i => out.add(walls[i].id)); continue; }
    // inside walls that don't touch the outside walls, grouped; a free-standing set of 6+ walls is a room inside
    const I = g.filter(i => !ext[i] && !E.some(e => near(walls[i], walls[e])));
    const p2 = new Map(I.map(i => [i, i])), f2 = (i) => (p2.get(i) === i ? i : (p2.set(i, f2(p2.get(i))), p2.get(i)));
    for (let a = 0; a < I.length; a++) for (let b = a + 1; b < I.length; b++) if (near(walls[I[a]], walls[I[b]])) p2.set(f2(I[a]), f2(I[b]));
    const cnt = new Map(); I.forEach(i => cnt.set(f2(i), (cnt.get(f2(i)) || 0) + 1));
    const freeRoom = [...cnt.values()].some(n => n >= 6);
    // also a separate group of walls standing wholly inside this one's outline
    let ex0 = 1e9, ey0 = 1e9, ex1 = -1e9, ey1 = -1e9; E.forEach(i => { const w = walls[i]; ex0 = Math.min(ex0, w.x1, w.x2); ex1 = Math.max(ex1, w.x1, w.x2); ey0 = Math.min(ey0, w.y1, w.y2); ey1 = Math.max(ey1, w.y1, w.y2); });
    const inner = [...groups.values()].some(h => h !== g && h.length >= 4 && h.every(i => { const w = walls[i]; return Math.min(w.x1, w.x2) > ex0 && Math.max(w.x1, w.x2) < ex1 && Math.min(w.y1, w.y2) > ey0 && Math.max(w.y1, w.y2) < ey1; }));
    if (freeRoom || inner) E.forEach(i => out.add(walls[i].id));
  }
  // a lone wall just outside the building's outside walls (a curb or a sign drawn on a wall layer) is a stray too
  if (out.size) {
    // the building's outline from its long outside walls; short walls standing beyond it don't belong
    const lenOf = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; for (const w of walls) if (out.has(w.id) && lenOf(w) >= 15) { bx0 = Math.min(bx0, w.x1, w.x2); bx1 = Math.max(bx1, w.x1, w.x2); by0 = Math.min(by0, w.y1, w.y2); by1 = Math.max(by1, w.y1, w.y2); }
    if (bx0 < bx1) walls.forEach((w) => { if (lenOf(w) >= 15) return; const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2; if (mx < bx0 - 0.25 || mx > bx1 + 0.25 || my < by0 - 0.25 || my > by1 + 0.25) { out.strays.add(w.id); out.delete(w.id); } });
  }
  return out;
}
/* A thick wall drawn with its layers (core, finish faces) as several parallel line pairs comes in as two or
   three thin walls side by side; they become one wall the full thickness. */
function mergeLayered(walls) {
  let changed = true, W = walls.slice();
  const info = (w) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1; let ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L; if (ux < -1e-9 || (Math.abs(ux) < 1e-9 && uy < 0)) { ux = -ux; uy = -uy; } const a = w.x1 * ux + w.y1 * uy, b = w.x2 * ux + w.y2 * uy; return { L, ux, uy, c: -uy * w.x1 + ux * w.y1, a: Math.min(a, b), b: Math.max(a, b), t: w.t || 0.25 }; };
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
      const A = info(W[i]), B = info(W[j]);
      if (Math.abs(A.ux * B.uy - A.uy * B.ux) > 0.01) continue;
      const dc = Math.abs(A.c - B.c); if (dc < 0.02 || dc > (A.t + B.t) / 2 + 1.5 / 12) continue;
      const ov = Math.min(A.b, B.b) - Math.max(A.a, B.a); if (ov < 0.8 * Math.min(A.b - A.a, B.b - B.a)) continue;
      const lo = Math.min(A.c - A.t / 2, B.c - B.t / 2), hi = Math.max(A.c + A.t / 2, B.c + B.t / 2), c = (lo + hi) / 2, a = Math.min(A.a, B.a), b = Math.max(A.b, B.b);
      const m = { ...W[i], x1: A.ux * a - A.uy * c, y1: A.uy * a + A.ux * c, x2: A.ux * b - A.uy * c, y2: A.uy * b + A.ux * c, t: hi - lo };
      W.splice(j, 1); W[i] = m; changed = true; break outer;
    }
  }
  return W;
}
/* Separate drawings on one sheet (a second copy of a plan off to the side, stray symbols): groups of walls
   more than gapFt from each other, largest (by total wall length) first. */
function wallClusters(walls, gapFt) {
  const n = walls.length, par = walls.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
  const box = walls.map(w => [Math.min(w.x1, w.x2) - gapFt / 2, Math.min(w.y1, w.y2) - gapFt / 2, Math.max(w.x1, w.x2) + gapFt / 2, Math.max(w.y1, w.y2) + gapFt / 2]);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = box[i], b = box[j]; if (a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]) par[find(i)] = find(j); }
  const g = new Map(); walls.forEach((w, i) => { const r = find(i); (g.get(r) || g.set(r, []).get(r)).push(w); });
  return [...g.values()].map(ws => ({ walls: ws, len: ws.reduce((t, w) => t + Math.hypot(w.x2 - w.x1, w.y2 - w.y1), 0) })).sort((a, b) => b.len - a.len);
}
global.Plan3DImport = { sheetExtras, alignToWalls, arcDoors, mergeLayered, wallClusters, buildingWalls, joinCollinear, pairLines, snapJunctions, wallsFromDxf, openingsFromDxf, dxfOpeningBlocks, dxfFrame, dxfSize, wallsFromImage, UNIT_FT, UNIT_NAMES };
})(window);
