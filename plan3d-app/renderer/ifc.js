/* Coll Plan3D — IFC, the open BIM format Revit, ArchiCAD and most BIM programs read and write.
   planFromIfc(): walls, doors, windows, rooms and ceiling height from an IFC file (one level) → an editable plan.
   toIfc():       the plan → an IFC4 model (walls, posts, doors, glass, pass-thrus, air chases, ceiling,
                  lights and fan filter units) that Revit opens or links. The Coll Plan3D project rides along
                  in a property set, so opening the file here again restores it exactly.
   Plan units are feet; plan y grows toward the bottom of the sheet (south).
   Coll Business Solutions LLC */
(function (global) {
'use strict';
const V = global.Plan3DViewer;

const q16 = (v) => Math.round(v * 192) / 192; // nearest 1/16″
const uid = () => Math.random().toString(36).slice(2, 10);

/* Smallest rectangle around a convex outline: centre, long direction, length and width. */
function minRect(h) {
  if (!h || !h.length) return null;
  if (h.length < 3) {
    const a = h[0], b = h[h.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
    return { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, ux: (b[0] - a[0]) / L, uy: (b[1] - a[1]) / L, L, T: 0 };
  }
  let best = null;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d < 1e-9) continue;
    const ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d;
    let s0 = 1e18, s1 = -1e18, n0 = 1e18, n1 = -1e18;
    for (const p of h) { const s = p[0] * ux + p[1] * uy, n = -p[0] * uy + p[1] * ux; s0 = Math.min(s0, s); s1 = Math.max(s1, s); n0 = Math.min(n0, n); n1 = Math.max(n1, n); }
    const area = (s1 - s0) * (n1 - n0);
    if (!best || area < best.area - 1e-9) best = { area, ux, uy, s0, s1, n0, n1 };
  }
  let { ux, uy, s0, s1, n0, n1 } = best;
  const sm = (s0 + s1) / 2, nm = (n0 + n1) / 2;
  let L = s1 - s0, T = n1 - n0;
  const cx = sm * ux - nm * uy, cy = sm * uy + nm * ux;
  if (T > L) { const t = L; L = T; T = t; const ox = ux; ux = -uy; uy = ox; }
  // point the long direction east or south, so results are stable
  if (ux < -1e-9 || (Math.abs(ux) < 1e-9 && uy < 0)) { ux = -ux; uy = -uy; }
  return { cx, cy, ux, uy, L, T };
}

const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

/* The IFC file → plan. data from the app's loader; opts.level = storey id; opts.doors/glass/rooms booleans. */
function planFromIfc(data, opts) {
  opts = opts || {};
  const lv = data.storeys.find(s => s.id === opts.level) || data.storeys.slice().sort((a, b) => b.walls - a.walls)[0];
  const on = (e) => !lv || e.level === lv.id || (e.level == null && data.storeys.length <= 1);
  const els = data.els.filter(on);
  const floor = lv ? lv.floor : Math.min(...els.filter(e => e.kind === 'wall').map(e => e.y0));
  // walls that stand on the floor (not headers over doors or sills under windows)
  let walls = [];
  const hosts = []; // every wall piece, including headers over doors and sills under windows
  for (const e of els) {
    if (e.kind !== 'wall') continue;
    { const r = minRect(e.hull); if (r && r.L >= 0.3) hosts.push({ x1: r.cx - r.ux * r.L / 2, y1: r.cy - r.uy * r.L / 2, x2: r.cx + r.ux * r.L / 2, y2: r.cy + r.uy * r.L / 2, t: Math.min(2, Math.max(2 / 12, r.T)) }); }
    if (e.y0 > floor + 1 || e.y1 - e.y0 < 4) continue;
    const r = minRect(e.hull); if (!r || r.L < 0.3) continue;
    const t = Math.min(2, Math.max(2 / 12, r.T));
    if (r.L < t * 1.2) continue;
    walls.push({ id: uid(), x1: r.cx - r.ux * r.L / 2, y1: r.cy - r.uy * r.L / 2, x2: r.cx + r.ux * r.L / 2, y2: r.cy + r.uy * r.L / 2, t, sp: false, h: e.y1 - e.y0 });
  }
  // Walls drawn to each other's faces: move the ends to where the centerlines meet
  const ends = [];
  walls.forEach(w => { ends.push([w, 1]); ends.push([w, 2]); });
  for (const [w, k] of ends) {
    const px = w['x' + k], py = w['y' + k];
    let best = null;
    for (const o of walls) {
      if (o === w) continue;
      const ax = w.x2 - w.x1, ay = w.y2 - w.y1, bx = o.x2 - o.x1, by = o.y2 - o.y1, den = ax * by - ay * bx;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (Math.abs(den) / (la * lb) < 0.3) continue;
      const s = ((o.x1 - w.x1) * by - (o.y1 - w.y1) * bx) / den;
      const ix = w.x1 + ax * s, iy = w.y1 + ay * s;
      const d = Math.hypot(ix - px, iy - py);
      if (d > Math.max(w.t, o.t) * 1.1 + 0.1) continue;
      // the meeting point must be on (or just past the end of) the other wall
      const u = ((ix - o.x1) * bx + (iy - o.y1) * by) / (lb * lb);
      if (u < -o.t / lb - 0.02 || u > 1 + o.t / lb + 0.02) continue;
      if (!best || d < best.d) best = { d, ix, iy };
    }
    if (best) { w['x' + k] = best.ix; w['y' + k] = best.iy; }
  }
  // doors and windows → openings on the nearest wall
  const openings = [];
  const onWall = (cx, cy) => {
    let best = null;
    for (const w of walls.concat(hosts)) {
      const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
      const s = (cx - w.x1) * ux + (cy - w.y1) * uy, n = Math.abs(-(cx - w.x1) * uy + (cy - w.y1) * ux);
      if (s < -1 || s > L + 1 || n > w.t / 2 + 0.75) continue;
      if (!best || n < best.n) best = { w, s, n, ux, uy };
    }
    return best;
  };
  for (const e of els) {
    if (!(e.kind === 'door' && opts.doors !== false) && !(e.kind === 'window' && opts.glass !== false)) continue;
    const r = minRect(e.hull); if (!r || r.L < 1) continue;
    const hit = onWall(r.cx, r.cy); if (!hit) continue;
    const { w, ux, uy } = hit, px = w.x1 + ux * hit.s, py = w.y1 + uy * hit.s, half = r.L / 2;
    const o = { id: uid(), x1: px - ux * half, y1: py - uy * half, x2: px + ux * half, y2: py + uy * half, t: w.t, swing: 1 };
    if (e.kind === 'door') { o.type = r.L >= 4.5 ? 'door2' : 'door'; o.head = q16(Math.max(6, Math.min(12, e.y1 - floor))); }
    else { o.type = 'glass'; o.sill = q16(Math.max(0, e.y0 - floor)); o.head = q16(Math.max(o.sill + 0.5, e.y1 - floor)); }
    o.from = e.name || '';
    openings.push(o);
  }
  // join pieces of one wall line that Revit split at a door or window
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i], b = walls[j];
      if (Math.abs(a.t - b.t) > 0.03) continue;
      const L = Math.hypot(a.x2 - a.x1, a.y2 - a.y1), ux = (a.x2 - a.x1) / L, uy = (a.y2 - a.y1) / L;
      const perp = (x, y) => Math.abs(-(x - a.x1) * uy + (y - a.y1) * ux);
      if (perp(b.x1, b.y1) > 0.05 || perp(b.x2, b.y2) > 0.05) continue;
      const sa = [0, L], sb = [(b.x1 - a.x1) * ux + (b.y1 - a.y1) * uy, (b.x2 - a.x1) * ux + (b.y2 - a.y1) * uy].sort((p, q) => p - q);
      const lo = Math.max(sa[0], sb[0]), hi = Math.min(sa[1], sb[1]);
      let join = lo - hi < 0.06; // touching or overlapping
      if (!join) {
        const g0 = Math.min(sa[1], sb[1]), g1 = Math.max(sa[0], sb[0]);
        join = openings.some(o => { const s1 = (o.x1 - a.x1) * ux + (o.y1 - a.y1) * uy, s2 = (o.x2 - a.x1) * ux + (o.y2 - a.y1) * uy; return perp((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2) < a.t && Math.min(s1, s2) <= g0 + 0.5 && Math.max(s1, s2) >= g1 - 0.5; });
      }
      if (!join) continue;
      const s0 = Math.min(sa[0], sb[0]), s1 = Math.max(sa[1], sb[1]);
      a.x2 = a.x1 + ux * s1; a.y2 = a.y1 + uy * s1; a.x1 = a.x1 + ux * s0; a.y1 = a.y1 + uy * s0;
      walls.splice(j, 1); merged = true; break outer;
    }
  }
  // rooms
  const rooms = [];
  if (opts.rooms !== false) for (const e of els) {
    if (e.kind !== 'space') continue;
    let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18, ax = 0, ay = 0;
    for (const p of e.hull) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); ax += p[0]; ay += p[1]; }
    const nm = (e.name && e.num && e.name !== e.num) ? e.name + ' ' + e.num : (e.name || e.num || 'Room');
    rooms.push({ id: uid(), name: nm, x: (x0 + x1) / 2, y: (y0 + y1) / 2, dims: global.Plan3DEditor.fmt(x1 - x0) + ' × ' + global.Plan3DEditor.fmt(y1 - y0) });
  }
  // ceiling height: Revit ceilings if there are any, otherwise the walls
  const ceil = els.filter(e => e.kind === 'covering').map(e => e.y0 - floor).filter(v => v > 6 && v < 40);
  let H = ceil.length ? median(ceil) : median(walls.map(w => w.h));
  H = q16(Math.max(6, Math.min(40, H || 8)));
  // ceiling lights and fan filter units (Revit light fixtures and air terminals near the ceiling)
  const fixtures = [];
  for (const e of els) {
    if (e.kind !== 'light' && e.kind !== 'terminal') continue;
    if (e.y1 - floor < H - 2.5) continue;
    const r = minRect(e.hull); if (!r || r.T < 0.9 || r.L > 6.2) continue;
    const txt = (e.name || '') + ' ' + (e.type || '');
    const type = /ffu|fan.?filter|hepa/i.test(txt) ? 'ffu' : (e.kind === 'light' || /light|led|troffer|lum/i.test(txt)) ? 'led' : null;
    if (!type) continue;
    const along = Math.abs(r.ux) >= Math.abs(r.uy);
    fixtures.push({ id: uid(), type, x: r.cx, y: r.cy, w: along ? r.L : r.T, h: along ? r.T : r.L });
  }
  // move to the sheet's corner, round to 1/16″
  let mx = 1e18, my = 1e18;
  for (const w of walls) { mx = Math.min(mx, w.x1, w.x2); my = Math.min(my, w.y1, w.y2); }
  if (!(mx < 1e17)) { mx = 0; my = 0; }
  const sh = (o, keys) => { for (const [x, y] of keys) { o[x] = q16(o[x] - mx); o[y] = q16(o[y] - my); } };
  walls.forEach(w => { sh(w, [['x1', 'y1'], ['x2', 'y2']]); w.t = q16(w.t); delete w.h; });
  openings.forEach(o => { sh(o, [['x1', 'y1'], ['x2', 'y2']]); o.t = q16(o.t); });
  rooms.forEach(r => sh(r, [['x', 'y']]));
  fixtures.forEach(f => sh(f, [['x', 'y']]));
  const counts = {
    walls: walls.length, doors: openings.filter(o => o.type !== 'glass').length, glass: openings.filter(o => o.type === 'glass').length, rooms: rooms.length,
    columns: els.filter(e => e.kind === 'column').length, fixtures: fixtures.length
  };
  return { plan: { version: 1, name: data.name, ceiling: H, wallT: median(walls.map(w => w.t)) || 0.25, walls, openings, chases: [], rooms, fixtures, ceilingMode: fixtures.length ? 'manual' : 'auto', background: null }, counts, level: lv };
}

/* ---------- IFC writer ---------- */
const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
function guid() { let s = B64[Math.floor(Math.random() * 4)]; for (let i = 0; i < 21; i++) s += B64[Math.floor(Math.random() * 64)]; return s; }
// STEP text: '' for ', \\ for \, anything outside ASCII as \X2\hhhh\X0\
function stepStr(s) {
  s = String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "''");
  return "'" + s.replace(/[^\x20-\x7e]+/g, m => '\\X2\\' + [...m].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join('') + '\\X0\\') + "'";
}
const num = (v) => { const r = Math.round(v * 1000) / 1000; const s = String(r); return /[.eE]/.test(s) ? s : s + '.'; };

function toIfc(plan, opts) {
  opts = opts || {};
  const A = V.analyze(plan), H = A.H, MM = 304.8;
  const lines = []; let n = 0;
  const E = (body) => { n++; lines.push('#' + n + '=' + body + ';'); return '#' + n; };
  const P2 = (x, y) => E(`IFCCARTESIANPOINT((${num(x * MM)},${num(-y * MM)}))`);
  const origin = E('IFCCARTESIANPOINT((0.,0.,0.))'), dirZ = E('IFCDIRECTION((0.,0.,1.))'), dirX = E('IFCDIRECTION((1.,0.,0.))');
  const ax3 = E(`IFCAXIS2PLACEMENT3D(${origin},${dirZ},${dirX})`);
  const ctx = E(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${ax3},$)`);
  const body = E(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const units = E(`IFCUNITASSIGNMENT((${E('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)')},${E('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')},${E('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')},${E('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)')}))`);
  const project = E(`IFCPROJECT('${guid()}',$,${stepStr(plan.name || 'Coll Plan3D project')},${stepStr('Made with Coll Plan3D, Coll Business Solutions LLC')},$,$,$,(${ctx}),${units})`);
  const sitePl = E(`IFCLOCALPLACEMENT($,${ax3})`), bldPl = E(`IFCLOCALPLACEMENT(${sitePl},${ax3})`), stPl = E(`IFCLOCALPLACEMENT(${bldPl},${ax3})`);
  const site = E(`IFCSITE('${guid()}',$,'Site',$,$,${sitePl},$,$,.ELEMENT.,$,$,$,$,$)`);
  const bld = E(`IFCBUILDING('${guid()}',$,${stepStr(plan.name || 'Building')},$,$,${bldPl},$,$,.ELEMENT.,$,$,$)`);
  const storey = E(`IFCBUILDINGSTOREY('${guid()}',$,'Level 1',$,$,${stPl},$,$,.ELEMENT.,0.)`);
  E(`IFCRELAGGREGATES('${guid()}',$,$,$,${project},(${site}))`); E(`IFCRELAGGREGATES('${guid()}',$,$,$,${site},(${bld}))`); E(`IFCRELAGGREGATES('${guid()}',$,$,$,${bld},(${storey}))`);
  // colours
  const style = (name, r, g, b, tr) => E(`IFCSURFACESTYLE(${stepStr(name)},.BOTH.,(${E(`IFCSURFACESTYLESHADING(${E(`IFCCOLOURRGB($,${num(r)},${num(g)},${num(b)})`)},${num(tr || 0)})`)}))`);
  const S = { white: style('Panel white', 0.97, 0.97, 0.97), door: style('Door', 0.9, 0.91, 0.91), glass: style('Glass', 0.7, 0.85, 0.9, 0.6), steel: style('Stainless', 0.66, 0.68, 0.69), ffu: style('FFU', 0.85, 0.88, 0.89), face: style('Filter face', 0.78, 0.8, 0.81), ceiling: style('Ceiling tile', 0.95, 0.95, 0.94) };
  const elPl = E(`IFCLOCALPLACEMENT(${stPl},${ax3})`);
  const contained = [];
  // a solid: a plan outline (feet) pushed up from z0 to z1 (feet)
  const solid = (pts, z0, z1, st) => {
    const ring = pts.map(p => P2(p[0], p[1])); ring.push(ring[0]);
    const prof = E(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${E(`IFCPOLYLINE((${ring.join(',')}))`)})`);
    const pos = E(`IFCAXIS2PLACEMENT3D(${E(`IFCCARTESIANPOINT((0.,0.,${num(z0 * MM)}))`)},$,$)`);
    const s = E(`IFCEXTRUDEDAREASOLID(${prof},${pos},${dirZ},${num(Math.max(1, (z1 - z0) * MM))})`);
    if (st) E(`IFCSTYLEDITEM(${s},(${st}),$)`);
    return s;
  };
  // a round solid (inlet ring): centre (feet), radius (feet), from z0 to z1
  const disc = (cx, cy, r, z0, z1, st) => {
    const prof = E(`IFCCIRCLEPROFILEDEF(.AREA.,$,${E(`IFCAXIS2PLACEMENT2D(${P2(cx, cy)},$)`)},${num(r * MM)})`);
    const pos = E(`IFCAXIS2PLACEMENT3D(${E(`IFCCARTESIANPOINT((0.,0.,${num(z0 * MM)}))`)},$,$)`);
    const s = E(`IFCEXTRUDEDAREASOLID(${prof},${pos},${dirZ},${num(Math.max(1, (z1 - z0) * MM))})`);
    if (st) E(`IFCSTYLEDITEM(${s},(${st}),$)`);
    return s;
  };
  const shape = (solids) => E(`IFCPRODUCTDEFINITIONSHAPE($,$,(${E(`IFCSHAPEREPRESENTATION(${body},'Body','SweptSolid',(${solids.join(',')}))`)}))`);
  const quad = (x1, y1, x2, y2, t) => { const L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L * t / 2, ny = (x2 - x1) / L * t / 2; return [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]; };
  const put = (cls, name, objType, sh, tail) => { const id = E(`${cls}('${guid()}',$,${stepStr(name)},$,${objType ? stepStr(objType) : '$'},${elPl},${sh},$${tail})`); contained.push(id); return id; };

  // walls: the panel runs between openings, full height
  for (const p of A.pieces) put('IFCWALL', p.sp ? 'S.P. panel wall' : 'Modular wall panel', 'Coll modular cleanroom wall', shape([solid(quad(p.x1, p.z1, p.x2, p.z2, p.t), 0, H, S.white)]), ',.STANDARD.');
  // posts: corners (4″ × 4″, L-shaped and flush) and free wall ends
  for (const c of A.corners) {
    const O = [c.x, c.z], Pt = (u, v, du, dv) => [O[0] + u[0] * du + v[0] * dv, O[1] + u[1] * du + v[1] * dv];
    const pts = [Pt(c.a, c.b, 0, 0), Pt(c.a, c.b, c.size, 0), Pt(c.a, c.b, c.size, c.wt), Pt(c.a, c.b, c.wt, c.wt), Pt(c.b, c.a, c.size, c.wt), Pt(c.b, c.a, c.size, 0)];
    put('IFCCOLUMN', 'Corner post 4x4', 'Coll corner post', shape([solid(pts, 0, H, S.white)]), ',.COLUMN.');
  }
  const seen = [];
  for (const e of A.ends) {
    if (e.cut || e.joined || seen.some(s => Math.hypot(s.x - e.x, s.z - e.z) < 0.02) || A.corners.some(c => Math.hypot(c.x - e.x, c.z - e.z) < 0.35)) continue; seen.push(e);
    const h = e.t / 2; put('IFCCOLUMN', 'End post', 'Coll wall post', shape([solid([[e.x - h, e.z - h], [e.x + h, e.z - h], [e.x + h, e.z + h], [e.x - h, e.z + h]], 0, H, S.white)]), ',.COLUMN.');
  }
  // openings: the door / glass / pass-thru, with wall above (and below glass)
  for (const i of A.opInfo) {
    const o = i.o, t = i.t, head = Math.min(H, o.head || 7);
    if (H - head > 0.02) put('IFCWALL', 'Header panel', 'Coll modular cleanroom wall', shape([solid(quad(o.x1, o.y1, o.x2, o.y2, t), head, H, S.white)]), ',.STANDARD.');
    if (o.type === 'door' || o.type === 'door2') {
      const w = i.len * MM, hh = head * MM;
      put('IFCDOOR', o.type === 'door2' ? 'Pair of doors 6070' : 'Door 3070', 'Coll cleanroom door', shape([solid(quad(o.x1, o.y1, o.x2, o.y2, Math.min(t, 0.15)), 0, head, S.door)]),
        `,${num(hh)},${num(w)},.DOOR.,${o.type === 'door2' ? '.DOUBLE_DOOR_SINGLE_SWING.' : '.SINGLE_SWING_LEFT.'},$`);
    } else if (o.type === 'glass') {
      const sill = Math.max(0, Math.min(head - 0.5, o.sill == null ? 3 : o.sill));
      if (sill > 0.02) put('IFCWALL', 'Sill panel', 'Coll modular cleanroom wall', shape([solid(quad(o.x1, o.y1, o.x2, o.y2, t), 0, sill, S.white)]), ',.STANDARD.');
      put('IFCWINDOW', 'Vision glass', 'Coll cleanroom window', shape([solid(quad(o.x1, o.y1, o.x2, o.y2, 0.05), sill, head, S.glass)]), `,${num((head - sill) * MM)},${num(i.len * MM)},.WINDOW.,.SINGLE_PANEL.,$`);
    } else if (o.type === 'pass') {
      const sill = Math.max(0, Math.min(head - 0.5, o.sill == null ? 3 : o.sill)), D = Math.max(t + 0.1, o.depth || 2);
      if (sill > 0.02) put('IFCWALL', 'Sill panel', 'Coll modular cleanroom wall', shape([solid(quad(o.x1, o.y1, o.x2, o.y2, t), 0, sill, S.white)]), ',.STANDARD.');
      put('IFCBUILDINGELEMENTPROXY', 'Pass-thru', 'Coll pass-thru', shape([solid(quad(o.x1, o.y1, o.x2, o.y2, D), sill, head, S.steel)]), ',.ELEMENT.');
    }
  }
  // air chases
  for (const b of A.boxes) put('IFCBUILDINGELEMENTPROXY', 'Air chase', 'Coll air chase', shape([solid([[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]], 0, H, S.white)]), ',.ELEMENT.');

  // ceiling, lights and fan filter units (Constrained strictly to room footprints)
  if (!A.empty && opts.ceiling !== false) {
    const footprint = V.footprint ? V.footprint(A) : null;
    const rects = (footprint && footprint.rects && footprint.rects.length) 
      ? footprint.rects 
      : [[A.bounds.minX, A.bounds.minZ, A.bounds.maxX, A.bounds.maxZ]];

    rects.forEach((r, idx) => {
      const pts = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
      put('IFCCOVERING', `Ceiling Section ${idx + 1}`, 'Coll cleanroom ceiling', shape([solid(pts, H, H + 0.052, S.ceiling)]), ',.CEILING.');
    });

    for (const f of V.ceilingFixtures(plan, A)) {
      const hw = (f.w || 1.9) / 2, hh = (f.h || 3.9) / 2, pts = [[f.x - hw, f.y - hh], [f.x + hw, f.y - hh], [f.x + hw, f.y + hh], [f.x - hw, f.y + hh]];
      const FM = plan.ffuModel && plan.ffuModel.sizes && plan.ffuModel.sizes.length ? plan.ffuModel : null;
      if (f.type === 'ffu' && FM) {
        // the real unit: cabinet in the grid, blower housing on top
        const long = Math.max(f.w || 2, f.h || 4), nominal = '2x' + Math.max(2, Math.min(4, Math.round(long)));
        const z = FM.sizes.find(q => q.nominal === nominal) || FM.sizes[0], alongZ = (f.h || 4) >= (f.w || 2);
        const fs = FM.finish === 'sst' || FM.finish === 'alum' ? S.steel : S.white;
        // the same unit the 3D view draws: local u across the short side (d), v along the long side (w)
        const at = (u, v) => alongZ ? [f.x + u, f.y + v] : [f.x + v, f.y - u];
        const box = (u0, u1, v0, v1) => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
        const e = 1.25 / 12, hd = Math.min(z.hd, z.d - 0.1) / 2, hwl = Math.min(z.hw, z.w - 0.1) / 2, r = Math.min(z.hw, z.hd) * 0.36;
        const solids = [
          // knife-edge frame in the grid and the filter face inside it
          solid(box(-z.d / 2, z.d / 2, -z.w / 2, -z.w / 2 + e), H - 0.04, H + 0.01, fs), solid(box(-z.d / 2, z.d / 2, z.w / 2 - e, z.w / 2), H - 0.04, H + 0.01, fs),
          solid(box(-z.d / 2, -z.d / 2 + e, -z.w / 2 + e, z.w / 2 - e), H - 0.04, H + 0.01, fs), solid(box(z.d / 2 - e, z.d / 2, -z.w / 2 + e, z.w / 2 - e), H - 0.04, H + 0.01, fs),
          solid(box(-z.d / 2 + e, z.d / 2 - e, -z.w / 2 + e, z.w / 2 - e), H - 0.035, H + 0.01, S.face),
          // cabinet above the grid, blower housing centred on it, inlet ring on top
          solid(box(-z.d / 2 + 0.015, z.d / 2 - 0.015, -z.w / 2 + 0.015, z.w / 2 - 0.015), H + 0.01, H + z.h, fs),
          solid(box(-hd, hd, -hwl, hwl), H + z.h, H + z.overall, fs),
          disc(...at(0, 0), r, H + z.overall, H + z.overall + 0.06, S.steel),
          // electrical box on the cabinet top, toward one end
          solid(box(-z.d / 2 + 0.12, -z.d / 2 + 0.12 + z.ebox, z.w / 2 - 0.45 - 2.25 / 12, z.w / 2 - 0.45 + 2.25 / 12), H + z.h, H + z.h + 3.5 / 12, fs)
        ];
        put('IFCAIRTERMINAL', 'Fan filter unit, ' + (FM.maker ? FM.maker + ' ' : '') + (FM.model || FM.name), (FM.name || 'FFU') + ' ' + nominal + ', ' + (FM.finishLabel || ''),
          shape(solids), ',.DIFFUSER.');
      } else if (f.type === 'ffu') put('IFCAIRTERMINAL', 'Fan filter unit', 'FFU', shape([solid(pts, H - 0.04, H + 1, S.ffu)]), ',.DIFFUSER.');
      else put('IFCLIGHTFIXTURE', 'LED light', 'LED troffer', shape([solid(pts, H - 0.04, H + 0.33, S.white)]), ',.DIRECTIONSOURCE.');
    }
  }
  E(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',$,$,$,(${contained.join(',')}),${storey})`);
  // the Coll Plan3D project itself, for opening the file here again
  const bytes = new TextEncoder().encode(JSON.stringify(plan)); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const data = btoa(bin), props = [];
  for (let k = 0; k * 4000 < data.length; k++) props.push(E(`IFCPROPERTYSINGLEVALUE('Data${k}',$,IFCTEXT('${data.slice(k * 4000, (k + 1) * 4000)}'),$)`));
  const pset = E(`IFCPROPERTYSET('${guid()}',$,'CollPlan3D_Project',$,(${props.join(',')}))`);
  E(`IFCRELDEFINESBYPROPERTIES('${guid()}',$,$,$,(${project}),${pset})`);

  const now = new Date().toISOString().slice(0, 19);
  return ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
    `FILE_NAME(${stepStr((plan.name || 'plan') + '.ifc')},'${now}',('Coll Business Solutions LLC'),('Coll Business Solutions LLC'),'Coll Plan3D','Coll Plan3D','');`,
    "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;', ...lines, 'ENDSEC;', 'END-ISO-10303-21;', ''].join('\r\n');
}

/* A plan saved in an IFC by Coll Plan3D, or null. */
function embeddedPlan(data) {
  if (!data || !data.embedded) return null;
  try {
    const s = atob(data.embedded), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    const p = JSON.parse(new TextDecoder().decode(u));
    return p && Array.isArray(p.walls) ? p : null;
  } catch (e) { return null; }
}

global.Plan3DIfc = { planFromIfc, toIfc, embeddedPlan, minRect };
})(window);
