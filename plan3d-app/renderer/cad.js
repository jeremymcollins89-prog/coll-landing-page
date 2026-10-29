/* Coll Plan3D — CAD export: the floor plan as an AutoCAD drawing (DXF), 1:1 in inches.
   Organized on standard layers (A-WALL, A-DOOR, A-GLAZ, A-DIMS …) so it can be edited, plotted or
   inserted into other drawings. The full Coll Plan3D project rides along on a frozen layer (P3D-DATA),
   so importing the file back restores doors, chases and rooms exactly.
   The app turns this DXF into a DWG with the free ODA File Converter.
   Coll Business Solutions LLC */
(function (global) {
'use strict';
const V = global.Plan3DViewer;
const S = global.Plan3DSheet;

const DATA_LAYER = 'P3D-DATA';
const DATA_TAG = 'COLLPLAN3D';
// name, AutoCAD color, linetype
const LAYERS = [
  ['A-WALL', 7, 'CONTINUOUS'], ['A-WALL-SP', 2, 'CONTINUOUS'], ['A-WALL-JOINT', 8, 'CONTINUOUS'], ['A-WALL-POST', 7, 'CONTINUOUS'], ['A-WALL-BLDG', 8, 'CONTINUOUS'],
  ['A-DOOR', 4, 'CONTINUOUS'], ['A-DOOR-SWING', 4, 'DASHED'], ['A-GLAZ', 5, 'CONTINUOUS'], ['A-PASS', 6, 'CONTINUOUS'],
  ['A-OPEN', 4, 'DASHED'], ['A-WALL-REMV', 30, 'CONTINUOUS'], ['A-WALL-REMV-FRAM', 8, 'CONTINUOUS'], ['A-CHASE', 8, 'CONTINUOUS'], ['A-CHASE-HATCH', 9, 'CONTINUOUS'], ['A-GRILLE', 7, 'CONTINUOUS'],
  ['A-CLNG-FIXT', 8, 'DASHED'], ['A-CLNG-FIXT-EMER', 1, 'CONTINUOUS'], ['A-CLNG-GRID', 9, 'CONTINUOUS'], ['S-BEAM', 30, 'DASHED'], ['A-DIMS', 3, 'CONTINUOUS'], ['A-ANNO-ROOM', 7, 'CONTINUOUS'], ['A-ANNO-TAG', 2, 'CONTINUOUS'],
  [DATA_LAYER, 8, 'CONTINUOUS', true]
];
// Layers whose lines make up the walls (used to tell whether the drawing was changed in AutoCAD)
const WALL_LAYERS = ['A-WALL', 'A-WALL-SP', 'A-WALL-BLDG'];

const r6 = (v) => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(6));
// plan feet (y down) → drawing inches (y up)
const X = (x) => r6(x * 12), Y = (y) => r6(-y * 12);

function b64(str) { const u = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new TextDecoder().decode(u); }
// Text in a DXF is one line of plain characters; AutoCAD reads \U+XXXX for anything outside ASCII.
// Feet/inch marks and fractions become plain ASCII so every CAD program shows them the same way.
const ASCII = { '\u2032': "'", '\u2033': '"', '\u00d7': 'x', '\u2013': '-', '\u2014': '-', '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u00b0': '%%d',
  '\u00bd': ' 1/2', '\u00bc': ' 1/4', '\u00be': ' 3/4', '\u215b': ' 1/8', '\u215c': ' 3/8', '\u215d': ' 5/8', '\u215e': ' 7/8' };
const dxfStr = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/[\u2032\u2033\u00d7\u2013\u2014\u2018\u2019\u201c\u201d\u00b0\u00bd\u00bc\u00be\u215b-\u215e]/g, c => ASCII[c]).replace(/(\d) +(\d\/\d)/g, '$1 $2').replace(/-\s+(\d\/)/g, '-$1').replace(/[^\x20-\x7e]/g, c => '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));

/* A simple fingerprint of the wall lines: if someone edits walls in AutoCAD, it changes. */
function wallPrint(segs) {
  let n = 0, len = 0;
  for (const s of segs) { n++; len += Math.hypot(s[2] - s[0], s[3] - s[1]); }
  return n + ':' + Math.round(len);
}

function toDxf(plan, opts) {
  opts = opts || {};
  // placed buildings are drawn in place; the project itself (with its buildings) is kept on the data layer
  const full = plan; if (V.flatten && plan.inserts && plan.inserts.length) plan = V.flatten(plan);
  const A = V.analyze(plan), B = A.bounds;
  const ents = [];
  const wallSegs = [];
  const put = (...kv) => { for (let i = 0; i < kv.length; i += 2) ents.push(kv[i], kv[i + 1]); };
  const line = (layer, x1, y1, x2, y2) => {
    if (Math.hypot(x2 - x1, y2 - y1) < 1e-6) return;
    put(0, 'LINE', 8, layer, 10, X(x1), 20, Y(y1), 30, 0, 11, X(x2), 21, Y(y2), 31, 0);
    if (WALL_LAYERS.includes(layer)) wallSegs.push([X(x1), Y(y1), X(x2), Y(y2)]);
  };
  const pline = (layer, pts, closed) => {
    put(0, 'POLYLINE', 8, layer, 66, 1, 10, 0, 20, 0, 30, 0, 70, closed ? 1 : 0);
    for (const p of pts) put(0, 'VERTEX', 8, layer, 10, X(p[0]), 20, Y(p[1]), 30, 0);
    put(0, 'SEQEND', 8, layer);
    if (WALL_LAYERS.includes(layer)) for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; wallSegs.push([X(a[0]), Y(a[1]), X(b[0]), Y(b[1])]); }
  };
  // arc from a center through two end points, the short way round (plan coordinates)
  const arc = (layer, cx, cy, ax, ay, bx, by) => {
    const r = Math.hypot(ax - cx, ay - cy) * 12; if (r < 1e-6) return;
    const ang = (x, y) => Math.atan2(-(y - cy), x - cx) * 180 / Math.PI; // drawing space (y up)
    let a1 = ang(ax, ay), a2 = ang(bx, by), d = a2 - a1;
    while (d > 180) d -= 360; while (d < -180) d += 360;
    let s = d >= 0 ? a1 : a2, e = d >= 0 ? a2 : a1;
    s = (s + 360) % 360; e = (e + 360) % 360;
    put(0, 'ARC', 8, layer, 10, X(cx), 20, Y(cy), 30, 0, 40, r6(r), 50, r6(s), 51, r6(e));
  };
  // text centered at a point; height in feet; rot in plan degrees
  const text = (layer, x, y, str, hFt, rotPlan) => {
    if (!str) return;
    const rot = r6(-(rotPlan || 0));
    if (opts.plainText) {
      // for a DWG made with LibreDWG: it drops a text's alignment point, which would send every centred label to
      // the drawing's origin. So the label is written left-aligned at its baseline, moved back by half its width
      // and down by half its height (about 0.8 of the height a letter) so it still sits centred where it goes.
      const h = hFt * 12, w = String(str).length * h * 0.8, a = rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
      const ix = X(x) - c * w / 2 + sn * h / 2, iy = Y(y) - sn * w / 2 - c * h / 2;
      put(0, 'TEXT', 8, layer, 10, r6(ix), 20, r6(iy), 30, 0, 40, r6(h), 1, dxfStr(str), 50, rot);
      return;
    }
    put(0, 'TEXT', 8, layer, 10, X(x), 20, Y(y), 30, 0, 40, r6(hFt * 12), 1, dxfStr(str), 50, rot, 72, 1, 11, X(x), 21, Y(y), 31, 0, 73, 2);
  };
  const quad = (x1, y1, x2, y2, t) => { const L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L * t / 2, ny = (x2 - x1) / L * t / 2; return [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]; };

  // ---- air chases: outline, 45° hatch, grille face
  for (const b of A.boxes) {
    pline('A-CHASE', [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]], true);
    const w = b.x1 - b.x0, h = b.z1 - b.z0, step = 0.25;
    for (let d = -h + step / 2; d < w; d += step) {
      // line x = b.x0 + d + s, z = b.z1 - s (s from 0..h), clipped to the box
      const s0 = Math.max(0, -d), s1 = Math.min(h, w - d);
      if (s1 - s0 > 1e-3) line('A-CHASE-HATCH', b.x0 + d + s0, b.z1 - s0, b.x0 + d + s1, b.z1 - s1);
    }
    const g = b.grille, fl = (g === 'N' || g === 'S') ? w : h, inset = g ? (fl - V.grilleSize(b.c, fl, A.H).w) / 2 : 0;
    if (g === 'N') line('A-GRILLE', b.x0 + inset, b.z0, b.x1 - inset, b.z0);
    if (g === 'S') line('A-GRILLE', b.x0 + inset, b.z1, b.x1 - inset, b.z1);
    if (g === 'W') line('A-GRILLE', b.x0, b.z0 + inset, b.x0, b.z1 - inset);
    if (g === 'E') line('A-GRILLE', b.x1, b.z0 + inset, b.x1, b.z1 - inset);
  }

  // ---- walls (pieces between openings), joint studs, corner posts, 48″ module joints
  for (const p of A.pieces) pline(p.hard === false ? 'A-WALL-BLDG' : p.sp ? 'A-WALL-SP' : 'A-WALL', quad(p.x1, p.z1, p.x2, p.z2, p.t), true);
  const seen = [];
  for (const e of A.ends) {
    if (e.cut || e.joined || seen.some(s => Math.hypot(s.x - e.x, s.z - e.z) < 0.02) || A.corners.some(c => Math.hypot(c.x - e.x, c.z - e.z) < 0.35)) continue; seen.push(e);
    const h = e.t / 2; pline('A-WALL-POST', [[e.x - h, e.z - h], [e.x + h, e.z - h], [e.x + h, e.z + h], [e.x - h, e.z + h]], true);
  }
  for (const c of A.corners) {
    const O = [c.x, c.z], P = (u, v, du, dv) => [O[0] + u[0] * du + v[0] * dv, O[1] + u[1] * du + v[1] * dv];
    pline('A-WALL-POST', [P(c.a, c.b, 0, 0), P(c.a, c.b, c.size, 0), P(c.a, c.b, c.size, c.wt), P(c.a, c.b, c.wt, c.wt), P(c.b, c.a, c.size, c.wt), P(c.b, c.a, c.size, 0)], true);
  }
  for (const w of A.walls) {
    if (w.piece || !V.isHard(w)) continue;
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, t = w.t || 0.25;
    for (let s = 4; s < L - 0.05; s += 4) {
      const px = w.x1 + ux * s, py = w.y1 + uy * s;
      if (A.opInfo.some(i => V.segDist(px, py, i.o.x1, i.o.y1, i.o.x2, i.o.y2) < t)) continue;
      line('A-WALL-JOINT', px - uy * t / 2, py + ux * t / 2, px + uy * t / 2, py - ux * t / 2);
    }
  }

  // ---- openings
  const TAG_H = 0.375, DIM_H = 0.375, ROOM_H = 0.75;
  for (const i of A.opInfo) {
    const o = i.o, t = i.t, nx = -i.uz, nz = i.ux, sw = o.swing === -1 ? -1 : 1;
    const cx = (o.x1 + o.x2) / 2, cy = (o.y1 + o.y2) / 2;
    const jamb = (x, y, layer) => line(layer, x + nx * t / 2, y + nz * t / 2, x - nx * t / 2, y - nz * t / 2);
    if (o.type === 'door' || o.type === 'door2') {
      jamb(o.x1, o.y1, 'A-DOOR'); jamb(o.x2, o.y2, 'A-DOOR');
      const leaf = (hx, hy, dir, w) => {
        const bx = hx + nx * sw * t / 2, by = hy + nz * sw * t / 2, tx = bx + nx * sw * w, ty = by + nz * sw * w;
        line('A-DOOR', bx, by, tx, ty);
        arc('A-DOOR-SWING', bx, by, tx, ty, bx + i.ux * dir * w, by + i.uz * dir * w);
      };
      if (o.type === 'door') leaf(o.x1, o.y1, 1, i.len); else { leaf(o.x1, o.y1, 1, i.len / 2); leaf(o.x2, o.y2, -1, i.len / 2); }
      text('A-ANNO-TAG', cx - nx * sw * (t / 2 + 1.1), cy - nz * sw * (t / 2 + 1.1), o.type === 'door' ? '3070' : '6070', TAG_H, 0);
    } else if (o.type === 'glass') {
      pline('A-GLAZ', quad(o.x1, o.y1, o.x2, o.y2, t), true);
      for (const f of [-0.18, 0.18]) line('A-GLAZ', o.x1 + nx * t * f, o.y1 + nz * t * f, o.x2 + nx * t * f, o.y2 + nz * t * f);
      text('A-ANNO-TAG', cx + nx * (t / 2 + 0.75), cy + nz * (t / 2 + 0.75), 'G', TAG_H, 0);
    } else if (o.type === 'pass') {
      const d = Math.max(t, o.depth || 2), q = quad(o.x1, o.y1, o.x2, o.y2, d);
      pline('A-PASS', quad(o.x1, o.y1, o.x2, o.y2, t), true);
      pline('A-PASS', q, true);
      line('A-PASS', q[0][0], q[0][1], q[2][0], q[2][1]); line('A-PASS', q[1][0], q[1][1], q[3][0], q[3][1]);
      text('A-ANNO-TAG', cx + nx * (d / 2 + 0.8), cy + nz * (d / 2 + 0.8), 'PT', TAG_H, 0);
    } else if (o.type === 'removable' && V.removableLayout) {
      // removable wall section: the panels (A-WALL-REMV), the tube posts and H-studs (A-WALL-REMV-FRAM), tag R
      const RL = V.removableLayout(i.len, o.head || 8, 99), at = (a) => [o.x1 + i.ux * a, o.y1 + i.uz * a];
      const seg = (q, layer) => { const [ax, ay] = at(q.s0), [bx, by] = at(q.s1); pline(layer, quad(ax, ay, bx, by, t), true); };
      for (const q of RL.panels) seg(q, 'A-WALL-REMV');
      for (const q of RL.posts) seg(q, 'A-WALL-REMV-FRAM');
      for (const q of RL.studs) seg(q, 'A-WALL-REMV-FRAM');
      for (const q of RL.starts.slice(0, 2)) seg(q, 'A-WALL-REMV-FRAM');
      text('A-ANNO-TAG', cx + nx * sw * (t / 2 + 1.1), cy + nz * sw * (t / 2 + 1.1), 'R', TAG_H, 0);
    } else {
      jamb(o.x1, o.y1, 'A-OPEN'); jamb(o.x2, o.y2, 'A-OPEN');
      line('A-OPEN', o.x1, o.y1, o.x2, o.y2);
    }
  }

  // ---- S.P. labels
  for (const p of A.pieces) {
    if (!p.sp || p.len < 1.5) continue;
    const L = p.len, ux = (p.x2 - p.x1) / L, uz = (p.z2 - p.z1) / L, nx = -uz, nz = ux;
    const cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2, side = ((B.cx - cx) * nx + (B.cz - cz) * nz) > 0 ? 1 : -1;
    const ang = Math.atan2(uz, ux) * 180 / Math.PI, a = ang > 90 || ang <= -90 ? ang + 180 : ang;
    text('A-ANNO-TAG', cx + nx * side * (p.t / 2 + 0.55), cz + nz * side * (p.t / 2 + 0.55), 'S.P.', TAG_H, a);
  }

  // ---- ceiling fixtures (LED lights / fan filter units), 2×4
  if (opts.fixtures !== false) {
    for (const f of V.ceilingFixtures(plan, A)) {
      const hw = (f.w || 1.9) / 2, hh = (f.h || 3.9) / 2;
      pline('A-CLNG-FIXT', [[f.x - hw, f.y - hh], [f.x + hw, f.y - hh], [f.x + hw, f.y + hh], [f.x - hw, f.y + hh]], true);
      if (f.type === 'ffu') { const rr = Math.min(hw, hh) * 0.68, pts = []; for (let k = 0; k < 32; k++) pts.push([f.x + Math.cos(k / 32 * Math.PI * 2) * rr, f.y + Math.sin(k / 32 * Math.PI * 2) * rr]); pline('A-CLNG-FIXT', pts, true); }   // an FFU: a circle in the middle
      else line('A-CLNG-FIXT', f.x - hw, f.y - hh, f.x + hw, f.y + hh);   // a light: the rectangle with a diagonal across it
      if (f.type !== 'ffu' && f.em) {
        // an emergency light: cross-hatched, 45° every 3″, clipped to the fixture
        const st = 0.25, x0 = f.x - hw, x1 = f.x + hw, y0 = f.y - hh, y1 = f.y + hh;
        for (let c = x0 - (y1 - y0); c < x1; c += st) {
          // the line x − y = c − y0 … as (x, y) from y = y0 up; clip to the box
          let ax = c, ay = y0, bx = c + (y1 - y0), by = y1;
          if (ax < x0) { ay += x0 - ax; ax = x0; } if (bx > x1) { by -= bx - x1; bx = x1; }
          if (bx - ax > 0.01) line('A-CLNG-FIXT-EMER', ax, ay, bx, by);
        }
      }
    }
    for (const b0 of plan.beams || []) { const bm = V.beamSeat ? V.beamSeat(plan, A, b0) : b0; line('S-BEAM', bm.x1, bm.y1, bm.x2, bm.y2); text('S-BEAM', (bm.x1 + bm.x2) / 2, (bm.y1 + bm.y2) / 2, (b0.size || 'W12x26').toUpperCase(), 0.3, Math.abs(bm.x2 - bm.x1) >= Math.abs(bm.y2 - bm.y1) ? 0 : 90); }
    for (const q of (V.isBuilt && V.isBuilt(plan) ? V.builtLines(plan) : plan.ceilingGrid && plan.ceilingGrid.length && V.ceilingLines ? V.ceilingLines(plan, A) : plan.ceilingGrid || [])) line('A-CLNG-GRID', q[0], q[1], q[2], q[3]);
  }

  // ---- dimension strings (same layout as the plan sheet)
  if (opts.dims !== false && !A.empty) {
    for (const d of S.dimChains(plan, A)) {
      const { g, js, side, off, faceOff, big } = d;
      const P = (a, o) => [g.ux * a + g.nx * (g.c + side * o), g.uy * a + g.ny * (g.c + side * o)];
      const [s1x, s1y] = P(js[0], off), [s2x, s2y] = P(js[js.length - 1], off);
      line('A-DIMS', s1x, s1y, s2x, s2y);
      const tick = 0.125;
      const ang = Math.atan2(g.uy, g.ux) * 180 / Math.PI, rot = ang > 90 || ang <= -90 ? ang + 180 : ang;
      js.forEach(a => {
        const [ex1, ey1] = P(a, faceOff + 0.15), [ex2, ey2] = P(a, off + 0.25);
        line('A-DIMS', ex1, ey1, ex2, ey2);
        const [tx, ty] = P(a, off), dx = (g.ux + g.nx * side) * tick, dy = (g.uy + g.ny * side) * tick;
        line('A-DIMS', tx - dx, ty - dy, tx + dx, ty + dy);
      });
      const h = big ? DIM_H * 1.2 : DIM_H;
      for (let k = 0; k + 1 < js.length; k++) {
        const seg = js[k + 1] - js[k]; if (seg < 1 / 96) continue;
        const str = big ? S.ftIn(seg) : S.dimText(seg), tw = str.length * h * 0.6;
        const lift = seg < tw + 0.1 ? (k % 2 ? 3.0 : 1.2) * h : 1.2 * h;
        const [qx, qy] = P((js[k] + js[k + 1]) / 2, off + lift);
        text('A-DIMS', qx, qy, str, h, rot);
      }
    }
  }

  // ---- room names
  for (const r of plan.rooms || []) {
    text('A-ANNO-ROOM', r.x, r.y - (r.dims ? ROOM_H * 0.75 : 0), (r.name || 'Room').toUpperCase(), ROOM_H, 0);
    if (r.dims) text('A-ANNO-ROOM', r.x, r.y + ROOM_H * 0.75, r.dims, ROOM_H * 0.6, 0);
  }

  // ---- the Coll Plan3D project, on a frozen layer
  const json = JSON.stringify(full);
  const data = b64(json), CH = 200, n = Math.ceil(data.length / CH);
  const head = { v: 1, n, print: wallPrint(wallSegs), name: plan.name || '' };
  put(0, 'TEXT', 8, DATA_LAYER, 10, 0, 20, 0, 30, 0, 40, 1, 1, DATA_TAG + ' ' + b64(JSON.stringify(head)));
  for (let k = 0; k < n; k++) put(0, 'TEXT', 8, DATA_LAYER, 10, 0, 20, 0, 30, 0, 40, 1, 1, DATA_TAG + ':' + k + ':' + data.slice(k * CH, (k + 1) * CH));

  // ---- assemble (AutoCAD R12 DXF: opens in every AutoCAD version and most CAD programs)
  let minX = 1e18, minY = 1e18, maxX = -1e18, maxY = -1e18;
  for (let k = 0; k < ents.length; k += 2) {
    if (ents[k] === 10 || ents[k] === 11) { const x = ents[k + 1], y = ents[k + 3]; if (typeof x === 'number' && typeof y === 'number') { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }
  }
  if (minX > maxX) { minX = 0; minY = 0; maxX = 288; maxY = 288; }
  const out = [];
  const w = (...kv) => { for (let i = 0; i < kv.length; i += 2) out.push(String(kv[i]), String(kv[i + 1])); };
  w(999, 'Coll Plan3D - Coll Business Solutions LLC - units: inches');
  w(0, 'SECTION', 2, 'HEADER');
  w(9, '$ACADVER', 1, 'AC1009');
  w(9, '$INSBASE', 10, 0, 20, 0, 30, 0);
  w(9, '$EXTMIN', 10, r6(minX), 20, r6(minY), 30, 0);
  w(9, '$EXTMAX', 10, r6(maxX), 20, r6(maxY), 30, 0);
  w(9, '$LIMMIN', 10, r6(minX), 20, r6(minY));
  w(9, '$LIMMAX', 10, r6(maxX), 20, r6(maxY));
  w(9, '$LUNITS', 70, 4);   // architectural: 23'-8 3/4"
  w(9, '$LUPREC', 70, 4);   // to 1/16"
  w(9, '$LTSCALE', 40, 12);
  w(9, '$TEXTSIZE', 40, 4.5);
  w(9, '$CLAYER', 8, '0');
  w(0, 'ENDSEC');
  w(0, 'SECTION', 2, 'TABLES');
  w(0, 'TABLE', 2, 'LTYPE', 70, 2);
  w(0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, 0);
  w(0, 'LTYPE', 2, 'DASHED', 70, 0, 3, '__ __ __ __', 72, 65, 73, 2, 40, 0.75, 49, 0.5, 49, -0.25);
  w(0, 'ENDTAB');
  w(0, 'TABLE', 2, 'LAYER', 70, LAYERS.length + 1);
  w(0, 'LAYER', 2, '0', 70, 0, 62, 7, 6, 'CONTINUOUS');
  for (const [name, color, lt, frozen] of LAYERS) w(0, 'LAYER', 2, name, 70, frozen ? 1 : 0, 62, frozen ? -color : color, 6, lt);
  w(0, 'ENDTAB');
  w(0, 'TABLE', 2, 'STYLE', 70, 1);
  w(0, 'STYLE', 2, 'STANDARD', 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 4.5, 3, 'txt', 4, '');
  w(0, 'ENDTAB');
  w(0, 'ENDSEC');
  w(0, 'SECTION', 2, 'BLOCKS');
  w(0, 'ENDSEC');
  w(0, 'SECTION', 2, 'ENTITIES');
  for (let k = 0; k < ents.length; k += 2) out.push(String(ents[k]), String(ents[k + 1]));
  w(0, 'ENDSEC');
  w(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}

/* Read the project back out of a drawing this app saved. texts: [{layer, text}], wallSegs: [[x1,y1,x2,y2]]
   in drawing units on the wall layers. Returns { plan, edited } or null. */
function readEmbedded(texts, wallSegs) {
  const mine = texts.filter(t => t.layer === DATA_LAYER && t.text && t.text.startsWith(DATA_TAG));
  const headT = mine.find(t => t.text.startsWith(DATA_TAG + ' '));
  if (!headT) return null;
  try {
    const head = JSON.parse(unb64(headT.text.slice(DATA_TAG.length + 1)));
    const parts = new Array(head.n);
    for (const t of mine) {
      const m = /^COLLPLAN3D:(\d+):(.*)$/.exec(t.text);
      if (m) parts[+m[1]] = m[2];
    }
    if (parts.some(p => p == null) || parts.length !== head.n) return null;
    const plan = JSON.parse(unb64(parts.join('')));
    const r6s = wallSegs.map(s => s.map(r6));
    const edited = head.print && wallPrint(r6s) !== head.print;
    return { plan, edited, name: head.name };
  } catch (e) { return null; }
}

global.Plan3DCad = { toDxf, readEmbedded, DATA_LAYER, WALL_LAYERS, LAYERS };
})(window);
