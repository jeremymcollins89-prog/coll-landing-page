/* Coll Plan3D — parts list (bill of materials) from a plan.
   Pieces placed in Build mode count as the unit they are; walls drawn in 2D are split on the 48″ module.
   Coll Business Solutions LLC */
(function (global) {
'use strict';
const FR = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
function inch(ft) { const e = Math.round(Math.abs(ft) * 96), i = Math.floor(e / 8), r = e % 8; return i + FR[r] + '″'; }
function ftin(ft) { const e = Math.round(Math.abs(ft) * 96), f = Math.floor(e / 96), r = e - f * 96; return f + '′-' + Math.floor(r / 8) + FR[r % 8] + '″'; }
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1 / 48);

const PIECE_NAMES = { panel: 'Wall panel', sp: 'S.P. panel', glass: 'Glass panel', door: 'Door panel, 3070', door2: 'Door panel, pair 6070', pass: 'Pass-thru panel' };

/* Hardwall floor track, in feet: one run under every wall panel, inside walls and outside walls, including
   the panels under glass and pass-thrus; it stops at doors and open doorways (no panel there). Air chase
   walls sit in floor track too. Hidden in 3D (it's under the panels), but it's on the parts list. */
function floorTrackFt(plan, A) {
  A = A || global.Plan3DViewer.analyze(plan);
  let ft = 0;
  for (const p of A.pieces) if (p.hard !== false) ft += p.len;
  for (const i of A.opInfo) if (i.hard !== false && (i.o.type === 'glass' || i.o.type === 'pass')) ft += i.len;
  for (const b of A.boxes) ft += 2 * ((b.x1 - b.x0) + (b.z1 - b.z0));
  return ft;
}

function partsList(plan) {
  const V = global.Plan3DViewer, A = V.analyze(plan), H = A.H;
  const rows = new Map();
  const add = (cat, item, size, qty, unit, order) => {
    const k = cat + '|' + item + '|' + size + '|' + unit;
    const r = rows.get(k) || { cat, item, size, qty: 0, unit: unit || 'ea', order: order || 50 };
    r.qty += qty; rows.set(k, r);
  };
  // hardwall (cleanroom) walls get panels, studs, posts, track and base; building walls get their own lines
  const walls = A.walls.filter(w => V.isHard(w)), built = new Set(walls.filter(w => w.piece).map(w => w.id));
  const hgt = ' × ' + ftin(H);

  // --- Panels
  for (const w of walls) {
    if (!w.piece) continue;
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    add('Wall panels', PIECE_NAMES[w.piece] || 'Wall panel', inch(L) + hgt, 1, 'ea', 10);
  }
  let hStuds = 0;
  // Walls drawn as long runs: panels fall on a 48″ module from the wall's start (as on the plan sheet);
  // a door or glass cut leaves a cut panel on each side. Slivers under 1″ are trim, not panels.
  for (const p of A.pieces) {
    if (built.has(p.id) || p.hard === false) continue;
    const a = p.s0, b = p.s0 + p.len, cuts = [a];
    for (let m = Math.floor(a / 4 + 1e-6) * 4 + 4; m < b - 1e-6; m += 4) cuts.push(m);
    cuts.push(b);
    let n = 0;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const L = cuts[i + 1] - cuts[i]; if (L < 1 / 12) continue;
      add('Wall panels', p.sp ? 'S.P. panel' : 'Wall panel', (Math.abs(L - 4) < 1 / 96 ? '48″' : inch(L)) + hgt, 1, 'ea', 10); n++;
    }
    hStuds += Math.max(0, n - 1);
  }

  // --- Joints: H-studs, corner posts, T-posts, end caps (from how wall ends meet).
  // Ends within a wall's thickness of each other are one joint, so walls that stop at a face
  // (drawn in Plan mode) count the same as panels that meet on centerlines (Build mode).
  const TOL = 0.3, nodes = [];
  const dirOf = (w, fromStart) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L; return fromStart ? [ux, uy] : [-ux, -uy]; };
  const addDir = (n, d) => { if (!n.dirs.some(e => e[0] * d[0] + e[1] * d[1] > 0.99)) n.dirs.push(d); };
  for (const w of walls) {
    for (const [x, y, st] of [[w.x1, w.y1, true], [w.x2, w.y2, false]]) {
      let n = nodes.find(n => Math.hypot(n.x - x, n.y - y) < TOL);
      if (!n) { n = { x, y, dirs: [], ws: new Set() }; nodes.push(n); }
      addDir(n, dirOf(w, st)); n.ws.add(w.id);
    }
  }
  // an end that lands on the middle of another wall is a T
  for (const n of nodes) {
    for (const w of walls) {
      if (n.ws.has(w.id)) continue;
      const d = V.segDist(n.x, n.y, w.x1, w.y1, w.x2, w.y2);
      const nearEnd = Math.hypot(n.x - w.x1, n.y - w.y1) < TOL || Math.hypot(n.x - w.x2, n.y - w.y2) < TOL;
      if (!nearEnd && d < (w.t || 0.25) / 2 + 0.06) { addDir(n, dirOf(w, true)); addDir(n, dirOf(w, false)); n.ws.add(w.id); }
    }
  }
  let corners = 0, tees = 0, crosses = 0, caps = 0;
  for (const n of nodes) {
    const k = n.dirs.length;
    if (k === 1) caps++;
    else if (k === 2) { const [a, b] = n.dirs; if (a[0] * b[0] + a[1] * b[1] < -0.99) hStuds++; else corners++; }
    else if (k === 3) tees++;
    else crosses++;
  }
  if (hStuds) add('Studs & posts', 'H-stud, 3″ with insert (panel joint)', '3″ × ' + ftin(H), hStuds, 'ea', 20);
  if (corners) add('Studs & posts', 'Corner post', '4″ × 4″ × ' + ftin(H), corners, 'ea', 21);
  if (tees) add('Studs & posts', 'T-post', ftin(H), tees, 'ea', 22);
  if (crosses) add('Studs & posts', 'Cross post', ftin(H), crosses, 'ea', 23);
  if (caps) add('Studs & posts', 'End cap', ftin(H), caps, 'ea', 24);

  // --- Doors, glass, pass-thrus
  for (const i of A.opInfo) {
    const o = i.o, W = i.len;
    if (o.type === 'door') add('Doors & glass', 'Door, single (3070)', inch(W) + ' × ' + ftin(o.head || 7), 1, 'ea', 30);
    else if (o.type === 'door2') add('Doors & glass', 'Door, pair (6070)', inch(W) + ' × ' + ftin(o.head || 7), 1, 'ea', 31);
    else if (o.type === 'glass') add('Doors & glass', 'Glass, 1/4″', inch(W) + ' × ' + inch((o.head || 7) - (o.sill == null ? 3 : o.sill)), 1, 'ea', 32);
    else if (o.type === 'pass') add('Doors & glass', 'Pass-thru, stainless', inch(W) + ' W × ' + inch((o.head || 5) - (o.sill == null ? 3 : o.sill)) + ' H × ' + inch(o.depth || 2) + ' D', 1, 'ea', 33);
    else if (o.type === 'open') add('Doors & glass', 'Cased opening frame', inch(W) + ' × ' + ftin(o.head || 7), 1, 'ea', 34);
  }

  // --- Air chases
  for (const b of A.boxes) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    add('Air chases', 'Air chase', inch(Math.max(w, d)) + ' × ' + inch(Math.min(w, d)) + ' × ' + ftin(H), 1, 'ea', 40);
    if (b.grille) {
      const G = V.grilleSize(b.c, (b.grille === 'N' || b.grille === 'S') ? w : d, H), sz = inch(G.w) + ' × ' + inch(G.h);
      add('Air chases', 'Return grille', sz, 1, 'ea', 41);
      if (G.damper) add('Air chases', 'Damper, opposed blade', sz, 1, 'ea', 42);
    }
  }

  // --- Hardwall floor track and trim (linear feet; base and ceiling track on both faces)
  const floorFt = floorTrackFt(plan, A);
  if (floorFt) add('Wall panels', 'Floor track, hardwall (under all wall panels)', ftin(floorFt) + ' total', Math.ceil(floorFt), 'lin ft', 15);
  let baseFt = 0, trackFt = 0;
  for (const p of A.pieces) if (p.hard !== false) { baseFt += p.len * 2; trackFt += p.len * 2; }
  for (const i of A.opInfo) {
    if (i.hard === false) continue;
    if (i.o.type === 'glass' || i.o.type === 'pass') baseFt += i.len * 2;
    trackFt += i.len * 2;
  }
  // building walls (concrete, block, metal panel, stud): length and face area by type, thickness and height
  const shell = new Map();
  for (const p of A.pieces) {
    if (p.hard !== false) continue;
    const k = p.kind + '|' + p.t.toFixed(3) + '|' + p.h.toFixed(3), r = shell.get(k) || { kind: p.kind, t: p.t, h: p.h, len: 0, area: 0 };
    r.len += p.len; r.area += p.len * p.h; shell.set(k, r);
  }
  for (const i of A.opInfo) {
    if (i.hard !== false) continue;
    const head = Math.min(i.wallH, i.o.head || 7), sill = i.o.type === 'glass' || i.o.type === 'pass' ? (i.o.sill == null ? 3 : i.o.sill) : 0;
    const k = i.kind + '|' + i.t.toFixed(3) + '|' + i.wallH.toFixed(3), r = shell.get(k) || { kind: i.kind, t: i.t, h: i.wallH, len: 0, area: 0 };
    r.len += i.len; r.area += i.len * (i.wallH - head + sill); shell.set(k, r);
  }
  for (const r of shell.values()) {
    const K = V.WALL_KINDS[r.kind] || { label: r.kind };
    add('Building walls', K.label + ', ' + inch(r.t) + ' thick', ftin(r.h) + ' high · ' + Math.round(r.area) + ' sq ft of wall', Math.ceil(r.len), 'lin ft', 5);
  }
  for (const b of A.boxes) { const per = 2 * ((b.x1 - b.x0) + (b.z1 - b.z0)); baseFt += per; trackFt += per; }
  if (baseFt) add('Trim', 'Black rubber base, 4″', '', Math.ceil(baseFt), 'lin ft', 51);
  if (trackFt) add('Trim', 'Ceiling track', '', Math.ceil(trackFt), 'lin ft', 52);

  // --- Ceiling
  const fx = V.ceilingFixtures(plan, A);
  const nLed = fx.filter(f => f.type !== 'ffu').length, nFfu = fx.filter(f => f.type === 'ffu').length;
  const ftS = (v) => { const r = Math.round(v * 2) / 2; return (r % 1 ? r.toFixed(1) : String(r)) + '′'; };
  const fxSize = (f) => { const a = f.w || 2, b = f.h || 4, lo = Math.min(a, b), hi = Math.max(a, b); return [ftS(lo).replace('′', '') + '×' + ftS(hi).replace('′', ''), ftS(lo) + ' × ' + ftS(hi)]; };
  const FM = plan.ffuModel && Array.isArray(plan.ffuModel.sizes) && plan.ffuModel.sizes.length ? plan.ffuModel : null;
  let ffuLb = 0, ffuCfm = 0, ffuN = 0;
  for (const f of fx) {
    if (f.type === 'ffu' && FM) {
      const long = Math.max(f.w || 2, f.h || 4), nominal = '2x' + Math.max(2, Math.min(4, Math.round(long)));
      const z = FM.sizes.find(q => q.nominal === nominal) || FM.sizes[0];
      add('Ceiling', 'Fan filter unit, ' + (FM.maker ? FM.maker + ' ' : '') + (FM.model || FM.name) + ', ' + nominal.replace('x', '×'), (z.w * 12).toFixed(2) + '″ × ' + (z.d * 12).toFixed(2) + '″, ' + (FM.finishLabel || ''), 1, 'ea', 61);
      ffuLb += z.lb || 0; ffuCfm += z.cfm || 0; ffuN++;
      continue;
    }
    const [nm, sz] = fxSize(f); add('Ceiling', f.type === 'ffu' ? 'Fan filter unit, ' + nm : 'LED light, ' + nm, sz, 1, 'ea', f.type === 'ffu' ? 61 : 60);
  }
  if (ffuN && ffuLb) add('Ceiling', 'FFU weight on the grid, total', '', Math.round(ffuLb), 'lb', 65);
  if (ffuN && ffuCfm) add('Ceiling', 'FFU airflow, total at max', '', Math.round(ffuCfm), 'CFM', 66);
  if (plan.ceilingGrid && plan.ceilingGrid.length) {
    let gl = 0; for (const q of plan.ceilingGrid) gl += Math.hypot(q[2] - q[0], q[3] - q[1]);
    add('Ceiling', 'T-grid, from ceiling drawing', '', Math.ceil(gl), 'lin ft', 64);
  }
  if (!A.empty && A.hardAny) {
    const fpr = V.footprint ? V.footprint(A) : null;
    const area = fpr ? fpr.area : A.bounds.w * A.bounds.d, tiles = Math.max(0, Math.ceil(area / 8) - nLed - nFfu);
    add('Ceiling', 'Ceiling tile, 2×4 (approx.)', '2′ × 4′', tiles, 'ea', 62);
    if (!(plan.ceilingGrid && plan.ceilingGrid.length)) add('Ceiling', 'Ceiling grid (area, approx.)', '', Math.ceil(area), 'sq ft', 63);
  }

  return [...rows.values()].sort((a, b) => a.order - b.order || a.item.localeCompare(b.item) || a.size.localeCompare(b.size, undefined, { numeric: true }));
}

/* The whole project's parts list: one section per building (the main plan, then each placed building).
   With a single building there's one untitled section, as before. */
function projectParts(plan) {
  const V = global.Plan3DViewer, Z = V.zones ? V.zones(plan) : [{ name: plan.name, plan, main: true }];
  const out = [];
  for (const z of Z) {
    const A = V.analyze(z.plan); if (A.empty && !(z.plan.fixtures || []).length) continue;
    const rows = partsList(z.plan); if (!rows.length) continue;
    out.push({ title: z.main ? (z.plan.name || 'Main building') : z.name, main: z.main, rows, floorFt: floorTrackFt(z.plan, A) });
  }
  if (out.length === 1) out[0].title = '';
  return out;
}

function toCSV(rows, plan) {
  const q = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const out = [['Project', plan.name || ''], ['Ceiling height', ftin(plan.ceiling || 8)], [], ['Category', 'Item', 'Size', 'Qty', 'Unit']];
  // rows, or sections [{ title, rows }] from projectParts
  if (rows.length && rows[0].rows) rows.forEach((sec, k) => { if (sec.title) { if (k) out.push([]); out.push([sec.title.toUpperCase()]); } sec.rows.forEach(r => out.push([r.cat, r.item, r.size, r.qty, r.unit])); });
  else rows.forEach(r => out.push([r.cat, r.item, r.size, r.qty, r.unit]));
  out.push([], ['Made with Coll Plan3D · Coll Business Solutions LLC']);
  return '﻿' + out.map(r => r.map(q).join(',')).join('\r\n');
}

global.Plan3DParts = { partsList, projectParts, toCSV, floorTrackFt, ftin };
})(window);
