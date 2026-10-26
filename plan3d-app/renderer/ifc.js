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

/* The outline(s) of a footprint grid: [{ outer: [[x, z] …], holes: [[[x, z] …] …] }], corners only. */
function outlineAreas(fp) {
  const { nx, nz, inside, cell, x0, z0 } = fp;
  const at = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && !!inside[j * nx + i];
  // directed boundary edges, inside on the left; keyed by start corner
  const out = new Map(), key = (i, j) => i + ',' + j; let count = 0;
  const add = (a, b) => { const k = key(a[0], a[1]); if (!out.has(k)) out.set(k, []); out.get(k).push(b); count++; };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!at(i, j)) continue;
    if (!at(i, j - 1)) add([i + 1, j], [i, j]);
    if (!at(i, j + 1)) add([i, j + 1], [i + 1, j + 1]);
    if (!at(i - 1, j)) add([i, j], [i, j + 1]);
    if (!at(i + 1, j)) add([i + 1, j + 1], [i + 1, j]);
  }
  const loops = [];
  while (count) {
    const [k0] = [...out.entries()].find(([, v]) => v.length);
    let [ci, cj] = k0.split(',').map(Number), pi = null, pj = null;
    const loop = [];
    for (let guard = 0; guard < 1e6; guard++) {
      const list = out.get(key(ci, cj)); if (!list || !list.length) break;
      let n = 0;
      if (list.length > 1 && pi !== null) {
        // where two areas touch at a corner, turn the same way every time so the loops don't cross
        const dx = ci - pi, dz = cj - pj;
        n = list.findIndex(b => (dx * (b[1] - cj) - dz * (b[0] - ci)) < 0); if (n < 0) n = 0;
      }
      const nb = list.splice(n, 1)[0]; count--;
      loop.push([ci, cj]); pi = ci; pj = cj; ci = nb[0]; cj = nb[1];
    }
    // drop the corners along straight runs
    const pts = loop.filter((p, q) => { const a = loop[(q - 1 + loop.length) % loop.length], b = loop[(q + 1) % loop.length]; return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0; });
    if (pts.length >= 3) loops.push(pts.map(p => [x0 + p[0] * cell, z0 + p[1] * cell]));
  }
  const area = (P) => { let s = 0; for (let q = 0; q < P.length; q++) { const a = P[q], b = P[(q + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const inPoly = (pt, P) => { let c = false; for (let q = 0, r = P.length - 1; q < P.length; r = q++) { const a = P[q], b = P[r]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const sign = loops.length ? Math.sign(area(loops.reduce((m, l) => Math.abs(area(l)) > Math.abs(area(m)) ? l : m))) : 1;
  const outers = loops.filter(l => Math.sign(area(l)) === sign).map(l => ({ outer: l, holes: [], a: Math.abs(area(l)) })).sort((p, q) => p.a - q.a);
  for (const h of loops.filter(l => Math.sign(area(l)) !== sign)) {
    const t = [(h[0][0] + h[1][0]) / 2 + 1e-4, (h[0][1] + h[1][1]) / 2 + 1e-4];
    const o = outers.find(o => inPoly(h[0], o.outer) || inPoly(t, o.outer)); if (o) o.holes.push(h);
  }
  return outers.filter(o => o.a > 1).map(({ outer, holes }) => ({ outer, holes }));
}

function toIfc(plan, opts) {
  opts = opts || {};
  const MM = 304.8;
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
  // Materials, matched to the 3D view. Each is an IfcMaterial with a rendering style, so Revit creates a
  // material of that colour, finish and transparency (glass stays see-through in a Revit render).
  const matOf = {}, styleMats = [];
  const style = (name, r, g, b, tr, spec, shine, method) => {
    const col = E(`IFCCOLOURRGB($,${num(r)},${num(g)},${num(b)})`);
    const st = E(`IFCSURFACESTYLE(${stepStr(name)},.BOTH.,(${E(`IFCSURFACESTYLERENDERING(${col},${num(tr || 0)},IFCNORMALISEDRATIOMEASURE(1.),$,$,$,IFCNORMALISEDRATIOMEASURE(${num(spec == null ? 0.1 : spec)}),IFCSPECULAREXPONENT(${num(shine || 16)}),.${method || 'PLASTIC'}.)`)}))`);
    styleMats.push([name, st]);
    return st;
  };
  const S = {
    white: style('Coll panel, white', 0.97, 0.97, 0.97, 0, 0.08, 16),
    sp: style('Coll S.P. panel, yellow', 0.96, 0.86, 0.5, 0, 0.08, 16),
    batten: style('Coll panel joint, H-stud', 0.93, 0.94, 0.94, 0, 0.1, 20),
    base: style('Coll rubber base, black', 0.09, 0.1, 0.1, 0, 0.16, 28),
    track: style('Coll ceiling track, aluminum', 0.87, 0.89, 0.89, 0, 0.33, 40, 'METAL'),
    frame: style('Coll door frame, white', 0.97, 0.98, 0.98, 0, 0.13, 24),
    door: style('Coll door leaf, white', 0.98, 0.99, 0.99, 0, 0.11, 16),
    hardware: style('Coll door hardware, satin', 0.73, 0.75, 0.76, 0, 0.53, 60, 'METAL'),
    lite: style('Coll door vision lite', 0.72, 0.83, 0.86, 0.65, 1, 90, 'GLASS'),
    glass: style('Coll vision glass', 0.62, 0.85, 0.9, 0.78, 1, 90, 'GLASS'),
    steel: style('Coll stainless steel', 0.75, 0.77, 0.78, 0, 0.6, 55, 'METAL'),
    grille: style('Coll return grille', 0.8, 0.82, 0.83, 0, 0.1, 16),
    floor: style('Coll floor, gray epoxy', 0.6, 0.62, 0.63, 0, 0.06, 22),
    ceiling: style('Coll ceiling tile, white', 0.95, 0.95, 0.94, 0, 0.02, 4, 'MATT'),
    grid: style('Coll ceiling grid, white', 0.96, 0.97, 0.97, 0, 0.13, 24),
    led: style('Coll LED light lens', 1, 1, 1, 0, 0.05, 8),
    ffu: style('Coll FFU, white powder coat', 0.95, 0.96, 0.96, 0, 0.13, 18),
    face: style('Coll FFU filter face', 0.78, 0.8, 0.81, 0, 0.1, 16),
    concrete: style('Coll building wall, concrete', 0.73, 0.71, 0.68, 0, 0.03, 6, 'MATT'),
    cmu: style('Coll building wall, concrete block', 0.79, 0.77, 0.74, 0, 0.03, 6, 'MATT'),
    metal: style('Coll building wall, metal panel', 0.87, 0.89, 0.9, 0, 0.3, 30, 'METAL'),
    stud: style('Coll building wall, drywall', 0.94, 0.93, 0.91, 0, 0.04, 8),
    slab: style('Coll floor slab, concrete', 0.72, 0.71, 0.68, 0, 0.04, 8),
    deck: style('Coll roof deck, metal', 0.66, 0.69, 0.71, 0, 0.3, 30, 'METAL'),
    wood: style('Coll house wall, painted drywall', 0.95, 0.94, 0.91, 0, 0.04, 8),
    siding: style('Coll lap siding', 0.84, 0.86, 0.85, 0, 0.05, 10),
    shingles: style('Coll asphalt shingles', 0.29, 0.31, 0.33, 0, 0.05, 8, 'MATT'),
    cabinet: style('Coll cabinet, painted', 0.95, 0.94, 0.92, 0, 0.1, 16),
    counter: style('Coll countertop', 0.24, 0.25, 0.27, 0, 0.3, 40),
    porcelain: style('Coll porcelain', 0.98, 0.98, 0.98, 0, 0.4, 60),
    appliance: style('Coll stainless appliance', 0.79, 0.81, 0.82, 0, 0.6, 55, 'METAL'),
    lvp: style('Coll floor, luxury vinyl plank', 0.69, 0.53, 0.37, 0, 0.08, 16), hardwood: style('Coll floor, hardwood', 0.48, 0.31, 0.18, 0, 0.1, 20),
    carpet: style('Coll floor, carpet', 0.73, 0.68, 0.6, 0, 0, 4, 'MATT'), tile: style('Coll floor, ceramic tile', 0.85, 0.84, 0.81, 0, 0.2, 30)
  };
  S.steel_frame = S.wood;
  const KIND_NAME = (k) => (V.WALL_KINDS && V.WALL_KINDS[k] ? V.WALL_KINDS[k].label : 'Building wall');
  S.ffuFace = S.face;
  S.ohd = style('Coll overhead door, steel sections', 0.85, 0.87, 0.88, 0, 0.3, 30, 'METAL');
  S.struct = style('Coll structural steel, gray primer', 0.54, 0.57, 0.59, 0, 0.25, 20, 'METAL');
  S.plate = style('Coll device cover plate, white', 0.96, 0.96, 0.96, 0, 0.2, 30);
  // the colors seen from above in the Plenum view: tile backs, LED housings, FFU inlet ring and pre-filter
  S.tileBack = style('Coll ceiling tile, back', 0.616, 0.604, 0.569, 0, 0.02, 4, 'MATT');
  S.housing = style('Coll LED housing, steel', 0.79, 0.81, 0.82, 0, 0.4, 40, 'METAL');
  S.galv = style('Coll FFU inlet ring, galvanized', 0.68, 0.71, 0.72, 0, 0.47, 45, 'METAL');
  S.prefilter = style('Coll FFU pre-filter', 0.23, 0.25, 0.26, 0, 0.13, 10, 'MATT');
  const elPl = E(`IFCLOCALPLACEMENT(${stPl},${ax3})`);
  const contained = [];
  // Geometry is written the way Revit's own IFC exporter writes it: every element gets its own placement at
  // its lower corner, and its solids are measured from there (small local numbers), instead of every element
  // sitting at the project origin with far-away coordinates. Revit's linker (which builds the colored,
  // render-ready materials) draws and selects elements reliably only in this form.
  // solid/disc/slab collect what to build; shape() writes them relative to the element's corner.
  let O = [0, 0];
  // a solid: a plan outline (feet) pushed up from z0 to z1 (feet)
  const solid = (pts, z0, z1, st) => ({ k: 'solid', pts, z0, z1, st });
  // a round solid (inlet ring): centre (feet), radius (feet), from z0 to z1
  const disc = (cx, cy, r, z0, z1, st) => ({ k: 'disc', cx, cy, r, z0, z1, st });
  // Each solid is written as a closed triangulated mesh (IfcTriangulatedFaceSet): the geometry the IFC4
  // Reference View this file declares is built on, and what Revit's own Reference View export writes.
  // Revit's IFC link draws these faces reliably; it dropped faces from extruded solids.
  const T3 = global.THREE || (typeof THREE !== 'undefined' ? THREE : null);
  const area2 = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  const tidy = (r) => { const o = []; for (const p of r) { const l = o[o.length - 1]; if (!l || Math.abs(l[0] - p[0]) > 1e-4 || Math.abs(l[1] - p[1]) > 1e-4) o.push(p); } if (o.length > 1 && Math.abs(o[0][0] - o[o.length - 1][0]) < 1e-4 && Math.abs(o[0][1] - o[o.length - 1][1]) < 1e-4) o.pop(); return o; };
  // plan points (feet) → local IFC (mm, y flipped, from the element's corner)
  const loc = (pts) => pts.map(p => [(p[0] - O[0]) * MM, -(p[1] - O[1]) * MM]);
  const mesh = (outer, holes, z0, z1, st) => {
    let ro = tidy(loc(outer)); if (area2(ro) < 0) ro.reverse();
    const rh = (holes || []).map(h => { const r = tidy(loc(h)); if (area2(r) > 0) r.reverse(); return r; }).filter(r => r.length >= 3);
    if (ro.length < 3) return null;
    const rings = [ro, ...rh], flat = [].concat(...rings), n = flat.length, Z0 = z0 * MM, Z1 = Math.max(z0 * MM + 1, z1 * MM);
    let tris;
    if (rh.length === 0 && ro.length === 4 || !T3) { tris = []; for (let k = 1; k + 1 < ro.length; k++) tris.push([0, k, k + 1]); }
    else {
      const V = (r) => r.map(p => new T3.Vector2(p[0], p[1]));
      tris = T3.ShapeUtils.triangulateShape(V(ro), rh.map(V));
    }
    const F = [];
    for (const t of tris) {
      const a = flat[t[0]], b = flat[t[1]], c = flat[t[2]], ccwT = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
      const [i, j, k] = ccwT ? t : [t[0], t[2], t[1]];
      F.push([i + 1 + n, j + 1 + n, k + 1 + n]); // top (+Z)
      F.push([i + 1, k + 1, j + 1]);             // bottom (−Z)
    }
    let base = 0;
    for (const r of rings) {
      for (let k = 0; k < r.length; k++) {
        const a = base + k, b = base + (k + 1) % r.length;
        F.push([a + 1, b + 1, b + 1 + n], [a + 1, b + 1 + n, a + 1 + n]);
      }
      base += r.length;
    }
    const P = [...flat.map(p => `(${num(p[0])},${num(p[1])},${num(Z0)})`), ...flat.map(p => `(${num(p[0])},${num(p[1])},${num(Z1)})`)];
    const it = E(`IFCTRIANGULATEDFACESET(${E(`IFCCARTESIANPOINTLIST3D((${P.join(',')}))`)},$,.T.,(${F.map(f => `(${f.join(',')})`).join(',')}),$)`);
    if (st) E(`IFCSTYLEDITEM(${it},(${st}),$)`);
    return it;
  };
  const build = (g) => {
    if (g.k === 'solid') return mesh(g.pts, [], g.z0, g.z1, g.st);
    if (g.k === 'disc') { const c = []; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; c.push([g.cx + Math.cos(a) * g.r, g.cy + Math.sin(a) * g.r]); } return mesh(c, [], g.z0, g.z1, g.st); }
    return mesh(g.ar.outer, g.ar.holes, g.z0, g.z1, g.st);
  };
  let shapeAt = null, shapeSt = null; // the corner the last shape() was measured from, for put()
  const shape = (solids) => {
    let mx = Infinity, my = Infinity;
    const see = (x, y) => { if (x < mx) mx = x; if (y < my) my = y; };
    for (const g of solids) {
      if (g.k === 'solid') g.pts.forEach(p => see(p[0], p[1]));
      else if (g.k === 'disc') see(g.cx - g.r, g.cy - g.r);
      else g.ar.outer.forEach(p => see(p[0], p[1]));
    }
    // corner in plan (feet); IFC y runs the other way, so the element's corner is its largest plan y
    let Y = -Infinity; for (const g of solids) { if (g.k === 'solid') g.pts.forEach(p => { if (p[1] > Y) Y = p[1]; }); else if (g.k === 'disc') Y = Math.max(Y, g.cy + g.r); else g.ar.outer.forEach(p => { if (p[1] > Y) Y = p[1]; }); }
    O = isFinite(mx) ? [mx, Y] : [0, 0];
    const items = solids.map(build).filter(Boolean);
    shapeSt = new Set(solids.filter(Boolean).map(g => g.st).filter(Boolean));
    shapeAt = O; O = [0, 0];
    return E(`IFCPRODUCTDEFINITIONSHAPE($,$,(${E(`IFCSHAPEREPRESENTATION(${body},'Body','Tessellation',(${items.join(',')}))`)}))`);
  };
  const quad = (x1, y1, x2, y2, t) => { const L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L * t / 2, ny = (x2 - x1) / L * t / 2; return [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]; };
  // a box along a line: from (x1, y1) to (x2, y2), t thick, z0 to z1 high
  const seg = (x1, y1, x2, y2, z0, z1, t, st) => solid(quad(x1, y1, x2, y2, t), z0, z1, st);
  const box = (x0, y0, x1, y1, z0, z1, st) => solid([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, st);
  const put = (cls, name, objType, sh, tail, mat) => { const at = shapeAt; shapeAt = null; const pl = at ? E(`IFCLOCALPLACEMENT(${stPl},${E(`IFCAXIS2PLACEMENT3D(${E(`IFCCARTESIANPOINT((${num(at[0] * MM)},${num(-at[1] * MM)},0.))`)},$,$)`)})`) : elPl; const id = E(`${cls}('${guid()}',$,${stepStr(name)},$,${objType ? stepStr(objType) : '$'},${pl},${sh},$${tail})`); contained.push(id);
    // An element made of several finishes (a door: leaf, frame, glass, hardware; an FFU: housing and filter
    // face) gets no single element material: Revit's IFC link paints the whole element in that material,
    // so each part keeps its own color from its style instead.
    const sts = shapeSt; shapeSt = null;
    if (mat && !(sts && sts.size > 1)) (matOf[mat] = matOf[mat] || []).push(id);
    return id; };
  // Each building (the main plan, then each placed building, already moved into place) is written out in turn.
  const emit = (plan, onSlab) => {
  const A = V.analyze(plan), H = A.H, WH = A.WH || H;
  if (A.empty && !(plan.fixtures || []).length) return;
  // rubber base (4″) and ceiling track on both faces of a wall line, as in the 3D view
  const trim = (x1, y1, x2, y2, t, top) => [seg(x1, y1, x2, y2, 0, 0.333, t + 0.022, S.base), ...(top ? [seg(x1, y1, x2, y2, H - 0.17, H, t + 0.03, S.track)] : [])];

  // walls: the panel runs between openings, full height, with the panel joints (H-studs) on the 48″ module
  // from the wall's start, rubber base and ceiling track
  for (const p of A.pieces) {
    if (p.frame) {
      // house wall: drywall, with siding on the outside face when it's an outside wall
      const FPo = V.footprint(A, true), L = p.len || 1, nx = -(p.z2 - p.z1) / L, nz = (p.x2 - p.x1) / L, cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2, off = p.t / 2 + 0.8;
      const out = (x, z) => !FPo || !FPo.has(x, z), parts = [seg(p.x1, p.z1, p.x2, p.z2, 0, p.h, p.t - 0.04, S.wood)];
      for (const sd of [1, -1]) if (p.ext !== false && out(cx + nx * sd * off, cz + nz * sd * off)) { const ox = nx * sd * (p.t / 2 - 0.02), oz = nz * sd * (p.t / 2 - 0.02); parts.push(seg(p.x1 + ox, p.z1 + oz, p.x2 + ox, p.z2 + oz, 0, p.h, 0.04, S.siding)); }
      put('IFCWALL', KIND_NAME(p.kind), 'House wall', shape(parts), ',.STANDARD.', S.wood); continue;
    }
    if (!p.hard) { put('IFCWALL', KIND_NAME(p.kind), 'Building wall', shape([seg(p.x1, p.z1, p.x2, p.z2, 0, p.h, p.t, S[p.kind] || S.concrete)]), ',.STANDARD.', S[p.kind] || S.concrete); continue; }
    const ux = (p.x2 - p.x1) / (p.len || 1), uz = (p.z2 - p.z1) / (p.len || 1), parts = [seg(p.x1, p.z1, p.x2, p.z2, 0, WH, p.t, p.sp ? S.sp : S.white), ...trim(p.x1, p.z1, p.x2, p.z2, p.t, true)];
    for (let m = Math.floor(p.s0 / 4 + 1e-6) * 4 + 4; m < p.s0 + p.len - 0.2; m += 4) {
      if (m - p.s0 < 0.2) continue;
      const k = m - p.s0, a = [p.x1 + ux * (k - 0.125), p.z1 + uz * (k - 0.125)], b = [p.x1 + ux * (k + 0.125), p.z1 + uz * (k + 0.125)];
      parts.push(seg(a[0], a[1], b[0], b[1], 0.333, WH > H ? WH : H - 0.17, p.t + 0.012, S.batten));
    }
    put('IFCWALL', p.sp ? 'S.P. panel wall' : 'Modular wall panel', 'Coll hardwall cleanroom wall', shape(parts), ',.STANDARD.', p.sp ? S.sp : S.white);
  }
  // transition panels: the step above a lower building that carries on through a gap in this wall
  for (const q of A.transitions || []) {
    put('IFCWALL', 'Transition panel, ' + V.fmtFt(q.y0) + ' to ' + V.fmtFt(q.y1), 'Coll hardwall bulkhead over an opening into a lower ceiling area', shape([seg(q.x1, q.z1, q.x2, q.z2, q.y0, q.y1, q.t, S.white), seg(q.x1, q.z1, q.x2, q.z2, q.y0 - 0.015, q.y0 + 0.06, q.t + 0.012, S.white), ...(H - q.y0 > 0.25 ? [seg(q.x1, q.z1, q.x2, q.z2, H - 0.17, H, q.t + 0.03, S.track)] : [])]), ',.STANDARD.', S.white);
  }
  // posts: corners (4″ × 4″, L-shaped and flush) and free wall ends
  for (const c of A.corners) {
    const O = [c.x, c.z], Pt = (u, v, du, dv) => [O[0] + u[0] * du + v[0] * dv, O[1] + u[1] * du + v[1] * dv];
    const pts = [Pt(c.a, c.b, 0, 0), Pt(c.a, c.b, c.size, 0), Pt(c.a, c.b, c.size, c.wt), Pt(c.a, c.b, c.wt, c.wt), Pt(c.b, c.a, c.size, c.wt), Pt(c.b, c.a, c.size, 0)];
    const parts = [solid(pts, 0, WH, S.white)];
    for (const [u, v] of [[c.a, c.b], [c.b, c.a]]) { const x1 = c.x + v[0] * c.wt / 2, z1 = c.z + v[1] * c.wt / 2; parts.push(...trim(x1, z1, x1 + u[0] * c.size, z1 + u[1] * c.size, c.wt, true)); }
    put('IFCCOLUMN', 'Corner post 4x4', 'Coll corner post', shape(parts), ',.COLUMN.', S.white);
  }
  const seen = [];
  for (const e of A.ends) {
    if (e.cut || e.joined || seen.some(s => Math.hypot(s.x - e.x, s.z - e.z) < 0.02) || A.corners.some(c => Math.hypot(c.x - e.x, c.z - e.z) < 0.35)) continue; seen.push(e);
    const h = e.t / 2, g = h + 0.011;
    put('IFCCOLUMN', 'End post', 'Coll wall post', shape([box(e.x - h, e.z - h, e.x + h, e.z + h, 0, WH, S.white), box(e.x - g, e.z - g, e.x + g, e.z + g, 0, 0.333, S.base)]), ',.COLUMN.', S.white);
  }
  // openings: the door / glass / pass-thru, with wall above (and below glass)
  for (const i of A.opInfo) {
    const top = i.wallH || H, ws = i.hard ? S.white : i.frame ? S.wood : (S[i.kind] || S.concrete), wName = i.hard ? 'Coll hardwall cleanroom wall' : 'Building wall';
    const o = i.o, t = i.t, head = Math.min(top, o.head || 7), ax = o.x1, ay = o.y1, bx = o.x2, by = o.y2;
    const along = (s, off) => [ax + i.ux * s - i.uz * (off || 0), ay + i.uz * s + i.ux * (off || 0)];
    if (top - head > 0.02) put('IFCWALL', i.hard ? 'Header panel' : KIND_NAME(i.kind) + ', over opening', wName, shape([seg(ax, ay, bx, by, head, top, t, ws), ...(i.hard && H - head > 0.2 ? [seg(ax, ay, bx, by, H - 0.17, H, t + 0.03, S.track)] : [])]), ',.STANDARD.', ws);
    if (o.type === 'door' || o.type === 'door2') {
      // frame: jambs and head; leaves (closed) with a vision lite, lite frame, closer and lever, as in the 3D view
      const [j1x, j1y] = along(-0.14), [j2x, j2y] = along(i.len + 0.14);
      const parts = [seg(j1x, j1y, ax, ay, 0, head, t + 0.06, S.frame), seg(bx, by, j2x, j2y, 0, head, t + 0.06, S.frame), seg(j1x, j1y, j2x, j2y, head - 0.02, Math.min(top, head + 0.12), t + 0.06, S.frame)];
      for (const l of i.leaves) {
        const L = Math.hypot(l.x2 - l.x1, l.z2 - l.z1) || 1, dx = (l.x2 - l.x1) / L, dz = (l.z2 - l.z1) / L;
        const f = (k) => [l.x1 + dx * L * k, l.z1 + dz * L * k];
        if (i.frame) {
          // house door: painted two-panel slab with a knob
          const top2 = Math.min(head - 0.05, 6.7), [a0x, a0z] = f(0), [a1x, a1z] = f(1), [p0x, p0z] = f(0.18), [p1x, p1z] = f(0.82), [k0x, k0z] = f(0.88), [k1x, k1z] = f(0.92);
          parts.push(seg(a0x, a0z, a1x, a1z, 0.03, top2, 0.145, S.door), seg(p0x, p0z, p1x, p1z, 0.6, 3.1, 0.165, S.frame), seg(p0x, p0z, p1x, p1z, 3.6, top2 - 0.5, 0.165, S.frame), seg(k0x, k0z, k1x, k1z, 2.92, 3.08, 0.36, S.hardware));
          continue;
        }
        const top = Math.min(head - 0.1, 6.9), v0 = 3.6, v1 = Math.min(6.05, top - 0.5);
        const [a0x, a0z] = f(0), [b0x, b0z] = f(0.2), [b1x, b1z] = f(0.8), [a1x, a1z] = f(1), [c0x, c0z] = f(0.165), [c1x, c1z] = f(0.835);
        parts.push(seg(a0x, a0z, a1x, a1z, 0.05, v0, 0.14, S.door), seg(a0x, a0z, a1x, a1z, v1, top, 0.14, S.door),
          seg(a0x, a0z, b0x, b0z, v0, v1, 0.14, S.door), seg(b1x, b1z, a1x, a1z, v0, v1, 0.14, S.door),
          seg(b0x, b0z, b1x, b1z, v0, v1, 0.06, S.lite),
          seg(c0x, c0z, c1x, c1z, v0 - 0.07, v0, 0.18, S.frame), seg(c0x, c0z, c1x, c1z, v1, v1 + 0.07, 0.18, S.frame),
          seg(c0x, c0z, b0x, b0z, v0, v1, 0.18, S.frame), seg(b1x, b1z, c1x, c1z, v0, v1, 0.18, S.frame));
        const [h0x, h0z] = f(0.86), [h1x, h1z] = f(0.94); parts.push(seg(h0x, h0z, h1x, h1z, 3.25, 3.33, 0.42, S.hardware));
        const [d0x, d0z] = f(0.08), [d1x, d1z] = f(0.45), ox = l.tx * 0.13, oz = l.tz * 0.13;
        parts.push(seg(d0x + ox, d0z + oz, d1x + ox, d1z + oz, top - 0.42, top - 0.2, 0.13, S.hardware));
      }
      put('IFCDOOR', i.frame ? (o.type === 'door2' ? 'Double door' : 'Door') : o.type === 'door2' ? 'Pair of doors 6070' : 'Door 3070', i.frame ? 'Panel door' : 'Coll cleanroom door', shape(parts),
        `,${num(head * MM)},${num(i.len * MM)},.DOOR.,${o.type === 'door2' ? '.DOUBLE_DOOR_SINGLE_SWING.' : '.SINGLE_SWING_LEFT.'},$`, S.door);
    } else if (o.type === 'window') {
      const sill = Math.max(0, Math.min(head - 0.5, o.sill == null ? 3 : o.sill)), fw = 0.17;
      if (sill > 0.02) put('IFCWALL', (i.hard ? 'Hardwall' : KIND_NAME(i.kind)) + ', under window', wName, shape([seg(ax, ay, bx, by, 0, sill, t, ws)]), ',.STANDARD.', ws);
      const [p1x, p1y] = along(fw), [p2x, p2y] = along(i.len - fw), mid = (sill + head) / 2;
      put('IFCWINDOW', 'Window', 'Vinyl double-hung window', shape([seg(p1x, p1y, p2x, p2y, sill + fw, head - fw, 0.03, S.glass),
        seg(ax, ay, bx, by, sill, sill + fw, t * 0.7, S.frame), seg(ax, ay, bx, by, head - fw, head, t * 0.7, S.frame),
        seg(ax, ay, p1x, p1y, sill, head, t * 0.7, S.frame), seg(p2x, p2y, bx, by, sill, head, t * 0.7, S.frame), seg(p1x, p1y, p2x, p2y, mid - 0.05, mid + 0.05, t * 0.5, S.frame)]),
        `,${num((head - sill) * MM)},${num(i.len * MM)},.WINDOW.,.DOUBLE_PANEL_VERTICAL.,$`, S.glass);
    } else if (o.type === 'glass') {
      const sill = Math.max(0, Math.min(head - 0.5, o.sill == null ? 3 : o.sill));
      if (sill > 0.02) put('IFCWALL', i.hard ? 'Sill panel' : KIND_NAME(i.kind) + ', under opening', wName, shape([seg(ax, ay, bx, by, 0, sill, t, ws), ...(i.hard ? trim(ax, ay, bx, by, t, false) : [])]), ',.STANDARD.', ws);
      const [p1x, p1y] = along(0.12), [p2x, p2y] = along(i.len - 0.12);
      put('IFCWINDOW', 'Vision glass', 'Coll cleanroom window', shape([seg(ax, ay, bx, by, sill, head, 0.05, S.glass),
        seg(ax, ay, bx, by, sill, sill + 0.12, t + 0.06, S.frame), seg(ax, ay, bx, by, head - 0.12, head, t + 0.06, S.frame),
        seg(ax, ay, p1x, p1y, sill, head, t + 0.06, S.frame), seg(p2x, p2y, bx, by, sill, head, t + 0.06, S.frame)]),
        `,${num((head - sill) * MM)},${num(i.len * MM)},.WINDOW.,.SINGLE_PANEL.,$`, S.glass);
    } else if (o.type === 'overhead') {
      // overhead sectional door: the closed curtain, steel jamb guards, the coil/track housing inside
      const [j1x, j1y] = along(-0.33), [j2x, j2y] = along(i.len + 0.33), sw = o.swing === -1 ? -1 : 1, inO = sw * (t / 2 + 0.55);
      const [h1x, h1y] = along(0, inO), [h2x, h2y] = along(i.len, inO);
      const parts = [seg(ax, ay, bx, by, 0, head, 0.14, S.ohd), seg(j1x, j1y, ax, ay, 0, head, t + 0.1, S.steel), seg(bx, by, j2x, j2y, 0, head, t + 0.1, S.steel), ...(top - head > 1.2 ? [seg(h1x, h1y, h2x, h2y, head + 0.1, head + 1.4, 1.0, S.steel)] : [])];
      put('IFCDOOR', 'Overhead door ' + V.fmtFt(i.len) + ' × ' + V.fmtFt(head), 'Overhead sectional door', shape(parts), `,${num(head * MM)},${num(i.len * MM)},.DOOR.,.ROLLINGUP.,$`, S.ohd);
    } else if (o.type === 'pass') {
      const sill = Math.max(0, Math.min(head - 0.5, o.sill == null ? 3 : o.sill)), D = Math.max(t + 0.1, o.depth || 2), ph = head - sill;
      if (sill > 0.02) put('IFCWALL', i.hard ? 'Sill panel' : KIND_NAME(i.kind) + ', under opening', wName, shape([seg(ax, ay, bx, by, 0, sill, t, ws), ...(i.hard ? trim(ax, ay, bx, by, t, false) : [])]), ',.STANDARD.', ws);
      const [f1x, f1y] = along(-0.1), [f2x, f2y] = along(i.len + 0.1);
      const parts = [seg(ax, ay, bx, by, sill, head, D, S.steel),
        seg(f1x, f1y, f2x, f2y, sill - 0.1, sill, t + 0.05, S.steel), seg(f1x, f1y, f2x, f2y, head, head + 0.1, t + 0.05, S.steel),
        seg(f1x, f1y, ax, ay, sill, head, t + 0.05, S.steel), seg(bx, by, f2x, f2y, sill, head, t + 0.05, S.steel)];
      for (const sg of [1, -1]) {
        const off = sg * (D / 2 + 0.02);
        const [w1x, w1y] = along(i.len * 0.25, off + sg * 0.012), [w2x, w2y] = along(i.len * 0.75, off + sg * 0.012);
        parts.push(seg(w1x, w1y, w2x, w2y, sill + ph * 0.42, head - 0.22, 0.03, S.lite));
        const [h1x, h1y] = along(i.len - 0.3, off + sg * 0.05), [h2x, h2y] = along(i.len - 0.22, off + sg * 0.05);
        parts.push(seg(h1x, h1y, h2x, h2y, sill + ph * 0.3, sill + ph * 0.62, 0.08, S.hardware));
      }
      put('IFCBUILDINGELEMENTPROXY', 'Pass-thru', 'Coll pass-thru, stainless', shape(parts), ',.ELEMENT.', S.steel);
    }
  }
  // air chases, with base, track and the return grille on the room face
  for (const b of A.boxes) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0; if (w < 0.02 || d < 0.02) continue;
    const parts = [box(b.x0, b.z0, b.x1, b.z1, 0, H, S.white), box(b.x0 - 0.011, b.z0 - 0.011, b.x1 + 0.011, b.z1 + 0.011, 0, 0.333, S.base), box(b.x0 - 0.015, b.z0 - 0.015, b.x1 + 0.015, b.z1 + 0.015, H - 0.17, H, S.track)];
    const f = b.grille;
    if (f) {
      const G = V.grilleSize(b.c, (f === 'N' || f === 'S') ? w : d, H), gt = 0.04, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      if (f === 'W' || f === 'E') { const x = f === 'W' ? b.x0 - gt : b.x1; parts.push(box(x, cz - G.w / 2, x + gt, cz + G.w / 2, G.sill, G.sill + G.h, S.grille)); }
      else { const z = f === 'N' ? b.z0 - gt : b.z1; parts.push(box(cx - G.w / 2, z, cx + G.w / 2, z + gt, G.sill, G.sill + G.h, S.grille)); }
    }
    put('IFCBUILDINGELEMENTPROXY', 'Air chase', 'Coll air chase', shape(parts), ',.ELEMENT.', S.white);
  }

  // floor, ceiling, ceiling grid, lights and fan filter units. The cleanroom ceiling covers the hardwall
  // footprint; the floor slab (and a building's roof) covers everything inside the walls.
  const footprint = !A.empty && V.footprint ? V.footprint(A) : null, fpAll = !A.empty && V.footprint ? V.footprint(A, true) : null;
  const areas = footprint ? outlineAreas(footprint) : [], areasAll = fpAll ? outlineAreas(fpAll) : areas.slice();
  if (!areasAll.length && !A.empty) {
    const B = A.bounds; areasAll.push({ outer: [[B.minX, B.minZ], [B.maxX, B.minZ], [B.maxX, B.maxZ], [B.minX, B.maxZ]], holes: [] });
  }
  if (!areas.length && A.hardAny) areas.push(...areasAll);
  const slab = (ar, z0, z1, st) => ({ k: 'slab', ar, z0, z1, st });
  // the cleanroom floor (gray epoxy), its top at the floor level
  const fl = A.hardAny ? ['Cleanroom floor', 'Coll cleanroom floor, epoxy', S.floor] : A.house ? ['Floor', 'House floor, ' + ((V.FLOORS || {})[plan.floorType || 'lvp'] || 'plank'), S[plan.floorType || 'lvp'] || S.lvp] : ['Floor slab', 'Concrete floor slab', S.slab];
  // a building placed inside another sits on that building's slab: its floor is a thin epoxy topping
  if (opts.floor !== false) areasAll.forEach((ar, idx) => put('IFCSLAB', areasAll.length > 1 ? `${fl[0]} ${idx + 1}` : fl[0], fl[1], shape([onSlab ? slab(ar, 0, 0.02, fl[2]) : slab(ar, -0.33, 0, fl[2])]), onSlab ? ',.BASESLAB.' : ',.FLOOR.', fl[2]));
  // a building's roof deck at the top of its walls
  // house roof: the 3D view's roof surface, as triangles (a surface model Revit can show and render)
  if (A.frameAny && plan.roof && plan.roof.type && plan.roof.type !== 'none' && fpAll && opts.ceiling !== false) {
    const F = V.roofField(A, plan, fpAll), tri = [], step = 2; // 1′ cells keep the file small
    const vz = (i, j) => { let t = 0, n = 0; for (const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) { if (a < 0 || b < 0 || a >= F.nx || b >= F.nz || !F.roofed[b * F.nx + a]) continue; t += F.Z[b * F.nx + a]; n++; } return n ? t / n : F.H; };
    for (let j = 0; j < F.nz; j += step) for (let i = 0; i < F.nx; i += step) {
      let any = false; for (let b = j; b < Math.min(F.nz, j + step); b++) for (let a = i; a < Math.min(F.nx, i + step); a++) if (F.roofed[b * F.nx + a]) any = true; if (!any) continue;
      const i2 = Math.min(F.nx, i + step), j2 = Math.min(F.nz, j + step), X = (q) => F.gx0 + q * F.s, Zc = (q) => F.gz0 + q * F.s;
      const P = [[X(i), Zc(j), vz(i, j)], [X(i2), Zc(j), vz(i2, j)], [X(i2), Zc(j2), vz(i2, j2)], [X(i), Zc(j2), vz(i, j2)]];
      tri.push([P[0], P[1], P[2]], [P[0], P[2], P[3]]);
    }
    if (tri.length) {
      const P3 = (p) => E(`IFCCARTESIANPOINT((${num(p[0] * MM)},${num(-p[1] * MM)},${num(p[2] * MM)}))`);
      const faces = tri.map(t => E(`IFCFACE((${E(`IFCFACEOUTERBOUND(${E(`IFCPOLYLOOP((${t.map(P3).join(',')}))`)},.T.)`)}))`));
      const sm = E(`IFCSHELLBASEDSURFACEMODEL((${E(`IFCOPENSHELL((${faces.join(',')}))`)}))`);
      E(`IFCSTYLEDITEM(${sm},(${S.shingles}),$)`);
      const rs = E(`IFCPRODUCTDEFINITIONSHAPE($,$,(${E(`IFCSHAPEREPRESENTATION(${body},'Body','SurfaceModel',(${sm}))`)}))`);
      // gable ends: siding from the top of the wall up to the roof
      const gf = [];
      for (const p of A.pieces) {
        if (!p.frame) continue;
        const n = Math.max(1, Math.ceil(p.len / 1));
        for (let k = 0; k < n; k++) {
          const a = k / n, b = (k + 1) / n, xa = p.x1 + (p.x2 - p.x1) * a, za = p.z1 + (p.z2 - p.z1) * a, xb = p.x1 + (p.x2 - p.x1) * b, zb = p.z1 + (p.z2 - p.z1) * b;
          const ha = F.at(xa, za) - 0.15, hb = F.at(xb, zb) - 0.15; if (ha < p.h + 0.05 && hb < p.h + 0.05) continue;
          gf.push([[xa, za, p.h], [xb, zb, p.h], [xb, zb, Math.max(p.h, hb)], [xa, za, Math.max(p.h, ha)]]);
        }
      }
      if (gf.length) {
        const gm = E(`IFCSHELLBASEDSURFACEMODEL((${E(`IFCOPENSHELL((${gf.map(q => E(`IFCFACE((${E(`IFCFACEOUTERBOUND(${E(`IFCPOLYLOOP((${q.map(P3).join(',')}))`)},.T.)`)}))`)).join(',')}))`)}))`);
        E(`IFCSTYLEDITEM(${gm},(${S.siding}),$)`);
        put('IFCWALL', 'Gable ends', 'Siding above the wall plates', E(`IFCPRODUCTDEFINITIONSHAPE($,$,(${E(`IFCSHAPEREPRESENTATION(${body},'Body','SurfaceModel',(${gm}))`)}))`), ',.STANDARD.', S.siding);
      }
      put('IFCROOF', (({ gable: 'Gable', hip: 'Hip', flat: 'Flat' })[F.type] || 'Roof') + ' roof', 'Asphalt shingle roof', rs, `,.${F.type === 'hip' ? 'HIP_ROOF' : F.type === 'flat' ? 'FLAT_ROOF' : 'GABLE_ROOF'}.`, S.shingles);
    }
  }
  // house items (cabinets, appliances, plumbing fixtures) as simple boxes
  for (const q of A.items || []) {
    const it = q.it, D = V.ITEMS[it.type], z0 = D.z || 0, st = /base|sinkbase|upper|tall|island|vanity/.test(it.type) ? S.cabinet : /range|fridge|dishwasher|washer|dryer|furnace|waterheater/.test(it.type) ? S.appliance : S.porcelain;
    const parts = [solid(q.c, z0, z0 + D.h, st)];
    if (/^(base|sinkbase|island|dishwasher)$/.test(it.type)) parts.push(solid(q.c, D.h - 0.12, D.h, S.counter));
    put(/toilet|tub|shower|vanity|sinkbase/.test(it.type) ? 'IFCSANITARYTERMINAL' : /range|fridge|dishwasher|washer|dryer/.test(it.type) ? 'IFCELECTRICAPPLIANCE' : 'IFCFURNISHINGELEMENT', D.label, D.group, shape(parts),
      /toilet|tub|shower|vanity|sinkbase/.test(it.type) ? `,.${it.type === 'toilet' ? 'TOILETPAN' : it.type === 'tub' ? 'BATH' : it.type === 'shower' ? 'SHOWER' : 'WASHHANDBASIN'}.` : /range|fridge|dishwasher|washer|dryer/.test(it.type) ? `,.${it.type === 'range' ? 'ELECTRICCOOKER' : it.type === 'fridge' ? 'REFRIGERATOR' : it.type === 'dishwasher' ? 'DISHWASHER' : it.type === 'washer' ? 'WASHINGMACHINE' : 'TUMBLEDRYER'}.` : '', st);
  }
  if (A.shellTop > 0 && opts.ceiling !== false) areasAll.forEach((ar, idx) => put('IFCSLAB', areasAll.length > 1 ? `Roof deck ${idx + 1}` : 'Roof deck', 'Metal roof deck', shape([slab(ar, A.shellTop, A.shellTop + 0.25, S.deck)]), ',.ROOF.', S.deck));
  // roof structure: open-web steel joists under the deck
  const RS = V.roofStructure ? V.roofStructure(plan, A) : null;
  if (RS && opts.ceiling !== false) for (const j of RS.joists) {
    const yT = A.shellTop, yB = A.shellTop - RS.depth;
    put('IFCBEAM', 'Steel joist ' + Math.round(RS.depth * 12) + 'K, ' + V.fmtFt(j.len), 'Open-web steel joist', shape([seg(j.x1, j.z1, j.x2, j.z2, yT - 0.12, yT, 0.2, S.struct), seg(j.x1, j.z1, j.x2, j.z2, yB, yB + 0.12, 0.2, S.struct), seg(j.x1, j.z1, j.x2, j.z2, yB + 0.12, yT - 0.12, 0.03, S.struct)]), ',.JOIST.', S.struct);
  }
  // building columns
  const colTop = A.shellTop || V.shellHeight(plan, null);
  for (const c of plan.columns || []) {
    const sz = c.size || 0.67, ht = c.h || colTop, r = sz / 2, conc = c.kind === 'concrete';
    put('IFCCOLUMN', (conc ? 'Concrete column ' : 'Steel column ') + Math.round(sz * 12) + '″', conc ? 'Concrete column' : 'Steel wide-flange column', shape([box(c.x - r, c.y - r, c.x + r, c.y + r, 0, ht, conc ? S.concrete : S.struct)]), ',.COLUMN.', conc ? S.concrete : S.struct);
  }
  if (!A.empty && opts.ceiling !== false) {
    // One ceiling per connected area, traced around the room footprint, so Revit shows no seams where
    // smaller pieces would meet.
    // names carry the heights, so they read in Revit's properties and schedules
    const cName = A.house ? 'Ceiling, drywall at ' + V.fmtFt(H) : 'Ceiling, grid at ' + V.fmtFt(H);
    areas.forEach((ar, idx) => put('IFCCOVERING', areas.length > 1 ? `${cName} (${idx + 1})` : cName, A.house ? 'House ceiling' : 'Coll cleanroom grid ceiling, 2×4 tiles', shape(A.house ? [slab(ar, H, H + 0.052, S.ceiling)] : [slab(ar, H, H + 0.04, S.ceiling), slab(ar, H + 0.04, H + 0.052, S.tileBack)]), ',.CEILING.', S.ceiling));
    // the plenum lid: the top of the cleanroom, over the plenum
    // (a roof-type slab, so in Revit it hides with Roofs in Visibility/Graphics while the grid ceiling stays,
    // like the Plenum view)
    const lName = 'Plenum lid, top at ' + V.fmtFt(WH) + ' (' + V.fmtFt(A.PL) + ' plenum)';
    if (A.PL > 0) areas.forEach((ar, idx) => put('IFCSLAB', areas.length > 1 ? `${lName} (${idx + 1})` : lName, 'Coll cleanroom top over the plenum', shape([slab(ar, WH, WH + 0.17, S.white)]), ',.ROOF.', S.white));
    // the T-grid just under the tiles: 15/16″ tees on the 2′ × 4′ layout (or the imported ceiling drawing's
    // own grid), only where there's ceiling
    // each tee: the 15/16″ face below the tiles and its web standing up 1½″ into the plenum
    const tees = [], TW = 15 / 16 / 12, tee = (x1, y1, x2, y2) => [seg(x1, y1, x2, y2, H - 0.035, H, TW, S.grid), seg(x1, y1, x2, y2, H + 0.052, H + 0.17, 0.028, S.grid)];
    if (Array.isArray(plan.ceilingGrid) && plan.ceilingGrid.length) {
      for (const q of (V.ceilingLines ? V.ceilingLines(plan, A) : plan.ceilingGrid)) tees.push(...tee(q[0], q[1], q[2], q[3]));
    } else if (footprint && A.hardAny) {
      const G = V.ceilingGrid(plan, A), B = A.bounds, step = footprint.cell / 2;
      const runs = (fixed, lo, hi, isX) => {
        let st = null;
        for (let v = lo; v <= hi + 1e-9; v += step) {
          const inside = isX ? footprint.has(fixed, v) : footprint.has(v, fixed);
          if (inside && st === null) st = v;
          if ((!inside || v + step > hi + 1e-9) && st !== null) { const e = inside ? v : v - step; if (e - st > 0.3) tees.push(...(isX ? tee(fixed, st, fixed, e) : tee(st, fixed, e, fixed))); st = null; }
        }
      };
      for (let x = G.ox + Math.ceil((B.minX - G.ox) / G.cw) * G.cw; x <= B.maxX; x += G.cw) runs(x, B.minZ, B.maxZ, true);
      for (let z = G.oz + Math.ceil((B.minZ - G.oz) / G.cl) * G.cl; z <= B.maxZ; z += G.cl) runs(z, B.minX, B.maxX, false);
    }
    if (tees.length) put('IFCMEMBER', 'Ceiling grid', 'Coll ceiling T-grid, 15/16″', shape(tees), ',.MEMBER.', S.grid);

    // electrical and utility devices on the wall faces
    for (const dv of plan.devices || []) {
      const D = V.DEVICES && V.DEVICES[dv.type]; if (!D) continue;
      const a = dv.a || 0, nx = Math.cos(a), ny = Math.sin(a), tx = -ny, ty = nx, dep = D.d || 0.03, h = dv.h != null ? dv.h : D.h;
      const pts = [[dv.x + tx * D.w / 2, dv.y + ty * D.w / 2], [dv.x - tx * D.w / 2, dv.y - ty * D.w / 2], [dv.x - tx * D.w / 2 + nx * dep, dv.y - ty * D.w / 2 + ny * dep], [dv.x + tx * D.w / 2 + nx * dep, dv.y + ty * D.w / 2 + ny * dep]];
      const st = dv.type === 'panel' ? S.steel : S.plate;
      put(D.ifc[0], D.label, 'Coll electrical, ' + V.fmtFt(h) + ' to center', shape([solid(pts, h - D.hh / 2, h + D.hh / 2, st)]), ',' + D.ifc[1], st);
    }
    for (const f of V.ceilingFixtures(plan, A)) {
      const hw = (f.w || 1.9) / 2, hh = (f.h || 3.9) / 2, pts = [[f.x - hw, f.y - hh], [f.x + hw, f.y - hh], [f.x + hw, f.y + hh], [f.x - hw, f.y + hh]];
      const FM = plan.ffuModel && plan.ffuModel.sizes && plan.ffuModel.sizes.length ? plan.ffuModel : null;
      if (f.type === 'ffu' && FM) {
        // the real unit: cabinet in the grid, blower housing on top
        const long = Math.max(f.w || 2, f.h || 4), nominal = '2x' + Math.max(2, Math.min(4, Math.round(long)));
        const z = FM.sizes.find(q => q.nominal === nominal) || FM.sizes[0], alongZ = (f.h || 4) >= (f.w || 2);
        const fs = FM.finish === 'sst' || FM.finish === 'alum' ? S.steel : S.ffu;
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
          disc(...at(0, 0), r, H + z.overall, H + z.overall + 0.06, S.galv), disc(...at(0, 0), r * 0.86, H + z.overall + 0.06, H + z.overall + 0.065, S.prefilter),
          // electrical box on the cabinet top, toward one end
          solid(box(-z.d / 2 + 0.12, -z.d / 2 + 0.12 + z.ebox, z.w / 2 - 0.45 - 2.25 / 12, z.w / 2 - 0.45 + 2.25 / 12), H + z.h, H + z.h + 3.5 / 12, fs)
        ];
        put('IFCAIRTERMINAL', 'Fan filter unit, ' + (FM.maker ? FM.maker + ' ' : '') + (FM.model || FM.name), (FM.name || 'FFU') + ' ' + nominal + ', ' + (FM.finishLabel || ''),
          shape(solids), ',.DIFFUSER.', fs);
      } else if (f.type === 'ffu') put('IFCAIRTERMINAL', 'Fan filter unit', 'FFU', shape([solid(pts, H - 0.04, H - 0.03, S.face), solid(pts, H - 0.03, H + 1, S.ffu)]), ',.DIFFUSER.', S.ffu);
      else {
        // LED flat panel: white lens a hair below the grid inside a thin white frame, housing above
        const e = 0.06, inner = [[f.x - hw + e, f.y - hh + e], [f.x + hw - e, f.y - hh + e], [f.x + hw - e, f.y + hh - e], [f.x - hw + e, f.y + hh - e]];
        put('IFCLIGHTFIXTURE', 'LED light', 'LED flat panel', shape([solid(pts, H - 0.03, H, S.frame), solid(pts, H + 0.052, H + 0.33, S.housing), solid(inner, H - 0.04, H - 0.03, S.led)]), ',.DIRECTIONSOURCE.', S.led);
      }
    }
  }
  };
  const ZS = V.zones ? V.zones(plan) : [{ plan, main: true }], hostSlab = ZS.length > 1 && (ZS[0].plan.walls || []).some(w => !V.isHard(w)); // inside a building (warehouse) with its own slab
  for (const z of ZS) emit(z.plan, !z.main && !(z.virtual && !z.of) && hostSlab);
  E(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',$,$,$,(${contained.join(',')}),${storey})`);
  // named materials carrying each style, so Revit builds proper materials for rendering
  for (const [name, st] of styleMats) {
    if (!matOf[st]) continue;
    const mat = E(`IFCMATERIAL(${stepStr(name)},$,$)`);
    E(`IFCMATERIALDEFINITIONREPRESENTATION($,$,(${E(`IFCSTYLEDREPRESENTATION(${ctx},'Style','Material',(${E(`IFCSTYLEDITEM($,(${st}),$)`)}))`)}),${mat})`);
    E(`IFCRELASSOCIATESMATERIAL('${guid()}',$,$,$,(${matOf[st].join(',')}),${mat})`);
  }
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

global.Plan3DIfc = { planFromIfc, toIfc, embeddedPlan, minRect, outlineAreas };
})(window);
