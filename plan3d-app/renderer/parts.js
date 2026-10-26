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

/* ---------- House takeoff: framing, sheathing, insulation, drywall, siding, roof, floors, doors, windows,
   trim and the kitchen / bath / laundry items. Estimates use common rules of thumb (studs at 16″ on centre,
   triple plates, 10% waste on sheet goods and shingles); check them against your supplier's takeoff. */
function houseTakeoff(plan, A, add) {
  const V = global.Plan3DViewer, H = A.H, OC = 16 / 12, FPall = V.footprint(A, true);
  const outside = (x, z) => !FPall || !FPall.has(x, z);
  const walls = A.walls.filter(w => V.isFrame(w));
  const ops = A.opInfo.filter(i => i.frame);
  const opsOn = (w) => ops.filter(i => V.segDist((i.o.x1 + i.o.x2) / 2, (i.o.y1 + i.o.y2) / 2, w.x1, w.y1, w.x2, w.y2) < (w.t || 0.25));
  const sheets = (area) => Math.ceil(area / 32 * 1.1);
  const opH = (i) => i.o.type === 'window' ? (i.o.head || 6.67) - (i.o.sill == null ? 3 : i.o.sill) : (i.o.head || 6.67);
  let extArea = 0, dryArea = 0, baseFt = 0, casingFt = 0, stoolFt = 0, ext2x6 = 0, ext2x4 = 0;
  const studs = new Map(), plates = new Map(), headers = new Map();
  const bump = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const w of walls) {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 0.2) continue;
    const h = Math.max(6, w.h || H), t = w.t || 0.375, nx = -(w.y2 - w.y1) / L, nz = (w.x2 - w.x1) / L, cx = (w.x1 + w.x2) / 2, cz = (w.y1 + w.y2) / 2, off = t / 2 + 0.8;
    const sideOut = [outside(cx + nx * off, cz + nz * off), outside(cx - nx * off, cz - nz * off)];
    const ext = w.ext != null ? !!w.ext : (sideOut[0] || sideOut[1]);
    const steel = w.kind === 'steel', size = w.stud || (steel ? (ext ? '6″' : '3⅝″') : (ext ? '2×6' : '2×4'));
    const on = opsOn(w), opArea = on.reduce((a, i) => a + i.len * opH(i), 0), opW = on.reduce((a, i) => a + i.len, 0);
    // studs: one every 16″ plus one, plus kings and jacks at each opening and a stud at each end
    let n = Math.ceil(L / OC) + 1 + 2;
    for (const i of on) { n += 4 - Math.floor(i.len / OC); if (i.o.type === 'window') n += Math.ceil(i.len / OC) + 1; }
    const studLen = h - 0.28, key = (steel ? 'Steel stud ' : 'Stud ') + size + '|' + ftin(studLen) + (steel ? '' : ' (precut)');
    bump(studs, key, Math.max(2, n));
    if (steel) bump(plates, 'Steel track ' + size, 2 * L);
    else { bump(plates, (ext ? 'Bottom plate, pressure-treated ' : 'Bottom plate ') + size, L); bump(plates, 'Top plates (double) ' + size, 2 * L); }
    for (const i of on) {
      if (i.o.type === 'open' && i.len < 3.1) continue;
      const W = i.len, hs = steel ? 'Box header, steel' : (W <= 3.5 ? '2-2×6 header' : W <= 5 ? '2-2×8 header' : W <= 6.5 ? '2-2×10 header' : '2-2×12 header');
      bump(headers, hs + '|' + ftin(W + 0.25), 1);
    }
    const net = Math.max(0, L * h - opArea);
    if (ext) { extArea += net; if (size === '2×6' || size === '6″') ext2x6 += net; else ext2x4 += net; dryArea += net; baseFt += L - opW; }
    else { dryArea += net * 2; baseFt += 2 * (L - on.filter(i => i.o.type !== 'window').reduce((a, i) => a + i.len, 0)); }
    for (const i of on) {
      if (i.o.type === 'window') { casingFt += 2 * opH(i) + i.len + 0.6; stoolFt += i.len + 0.6; if (!ext) casingFt += 2 * opH(i) + i.len + 0.6; }
      else { const f = ext ? 1 : 2; casingFt += f * (2 * (i.o.head || 6.67) + i.len + 0.6); }
    }
  }
  for (const [k, v] of studs) { const [item, size] = k.split('|'); add('Framing', item, size, v, 'ea', 70); }
  for (const [k, v] of plates) add('Framing', k, Math.ceil(v / 16) + ' × 16′ boards', Math.ceil(v), 'lin ft', 71);
  for (const [k, v] of headers) { const [item, size] = k.split('|'); add('Framing', item, size, v, 'ea', 72); }
  // roof: surface from the roof's height field
  let gableArea = 0;
  const R = plan.roof || {};
  if (R.type && R.type !== 'none' && FPall) {
    const F = V.roofField(A, plan, FPall), s2 = F.s * F.s, k = F.type === 'flat' ? 1 : Math.sqrt(1 + F.slope * F.slope);
    let cells = 0, edge = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let j = 0; j < F.nz; j++) for (let i = 0; i < F.nx; i++) {
      if (!F.roofed[j * F.nx + i]) continue; cells++;
      x0 = Math.min(x0, i); x1 = Math.max(x1, i); z0 = Math.min(z0, j); z1 = Math.max(z1, j);
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) if (a < 0 || b < 0 || a >= F.nx || b >= F.nz || !F.roofed[b * F.nx + a]) edge++;
    }
    const area = cells * s2 * k, perim = edge * F.s, Lx = (x1 - x0 + 1) * F.s, Lz = (z1 - z0 + 1) * F.s, long = Math.max(Lx, Lz), short = Math.min(Lx, Lz);
    const RT = { gable: 'Gable', hip: 'Hip', flat: 'Low-slope' }[F.type] || F.type;
    add('Roof', RT + ' roof surface', (F.type === 'flat' ? 'low slope' : (R.pitch == null ? 6 : R.pitch) + '/12 pitch') + ', ' + ftin(F.ov) + ' overhang', Math.ceil(area), 'sq ft', 80);
    if (F.type === 'flat') add('Roof', 'Membrane roofing (TPO/EPDM)', '', Math.ceil(area * 1.1), 'sq ft', 81);
    else {
      add('Roof', 'Architectural shingles', Math.ceil(area / 100 * 1.1 * 3) + ' bundles', Math.ceil(area / 100 * 1.1 * 10) / 10, 'squares', 81);
      add('Roof', 'Synthetic underlayment', '10 squares per roll', Math.ceil(area * 1.1 / 1000), 'rolls', 82);
      add('Roof', 'Ridge' + (F.type === 'hip' ? ' & hip' : '') + ' cap (est.)', '', Math.ceil(F.type === 'hip' ? (long - short) + 4 * (short / 2) * Math.sqrt(2 + F.slope * F.slope) : long), 'lin ft', 84);
      add('Roof', (F.type === 'gable' ? 'Trusses, common' : 'Trusses / rafters (est.)') + ' at 24″ o.c.', ftin(short) + ' span', Math.ceil(long / 2) + 1, 'ea', 85);
    }
    add('Roof', 'Roof decking, OSB 7/16″ 4×8', '', sheets(area), 'sheets', 83);
    add('Roof', 'Drip edge, fascia', '', Math.ceil(perim), 'lin ft', 86);
    if (F.ov > 0) add('Roof', 'Soffit', ftin(F.ov) + ' wide', Math.ceil(perim * F.ov), 'sq ft', 87);
    // gable ends: wall above the plates under the roof
    for (const p of A.pieces) { if (!p.frame) continue; const n = Math.max(1, Math.ceil(p.len / 0.5)); for (let q = 0; q < n; q++) { const u = (q + 0.5) / n, hh = F.at(p.x1 + (p.x2 - p.x1) * u, p.z1 + (p.z2 - p.z1) * u) - p.h; if (hh > 0.05) gableArea += hh * p.len / n; } }
  }
  // sheathing, wrap, siding, insulation, drywall
  const ceilArea = (() => { const fp = V.footprint(A); return fp ? fp.area : 0; })();
  if (extArea + gableArea > 0) {
    add('Sheathing & wrap', 'Wall sheathing, OSB 7/16″ 4×8', '', sheets(extArea + gableArea), 'sheets', 90);
    add('Sheathing & wrap', 'House wrap', '', Math.ceil((extArea + gableArea) * 1.1), 'sq ft', 91);
    add('Siding', 'Lap siding' + (gableArea > 0 ? ', walls and gable ends' : ''), Math.ceil((extArea + gableArea) / 100 * 1.1 * 10) / 10 + ' squares', Math.ceil((extArea + gableArea) * 1.1), 'sq ft', 95);
  }
  if (ext2x6) add('Insulation', 'Batts R-21, 2×6 walls', '', Math.ceil(ext2x6), 'sq ft', 100);
  if (ext2x4) add('Insulation', 'Batts R-15, 2×4 walls', '', Math.ceil(ext2x4), 'sq ft', 100);
  if (ceilArea) add('Insulation', 'Attic, blown R-49', '', Math.ceil(ceilArea), 'sq ft', 101);
  if (dryArea + ceilArea) {
    add('Drywall', 'Drywall ½″, walls', '4×8 sheets', sheets(dryArea), 'sheets', 105);
    if (ceilArea) add('Drywall', 'Drywall ½″ ceiling board, ceilings', '4×8 sheets', sheets(ceilArea), 'sheets', 106);
    add('Drywall', 'Joint compound and tape (est.)', '1 box + 1 roll per 500 sq ft', Math.ceil((dryArea + ceilArea) / 500), 'sets', 107);
  }
  // floors by room (room labels can set a floor finish; the rest uses the house floor)
  if (FPall) {
    let total = 0; for (let k = 0; k < FPall.inside.length; k++) if (FPall.inside[k] && !FPall.wall[k]) total++;
    total *= FPall.cell * FPall.cell;
    const def = plan.floorType || 'lvp', by = new Map(); let used = 0;
    for (const r of V.roomRegions(A, plan)) { const f = r.room.floor || def; bump(by, f, r.area); used += r.area; }
    bump(by, def, Math.max(0, total - used));
    for (const [f, a] of by) if (a > 1) add('Floors', (V.FLOORS[f] || f), '+10% waste', Math.ceil(a * 1.1), 'sq ft', 110);
  }
  // doors and windows
  for (const i of ops) {
    const o = i.o, W = i.len, w = A.walls.find(q => V.segDist((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, q.x1, q.y1, q.x2, q.y2) < (q.t || 0.25));
    const L = w ? Math.hypot(w.x2 - w.x1, w.y2 - w.y1) : 1, nx = w ? -(w.y2 - w.y1) / L : 0, nz = w ? (w.x2 - w.x1) / L : 1, cx = (o.x1 + o.x2) / 2, cz = (o.y1 + o.y2) / 2, off = (i.t || 0.375) / 2 + 0.8;
    const ext = w && w.ext != null ? !!w.ext : (outside(cx + nx * off, cz + nz * off) || outside(cx - nx * off, cz - nz * off));
    if (o.type === 'window') add('Doors & windows', 'Window, vinyl double-hung', inch(W) + ' × ' + inch(opH(i)), 1, 'ea', 115);
    else if (o.type === 'door') add('Doors & windows', ext ? 'Exterior door, prehung' : 'Interior door, prehung', inch(W) + ' × ' + inch(o.head || 6.67), 1, 'ea', 116);
    else if (o.type === 'door2') add('Doors & windows', ext ? 'Exterior double door, prehung' : 'Interior double door', inch(W) + ' × ' + inch(o.head || 6.67), 1, 'ea', 117);
    else if (o.type === 'open') add('Doors & windows', 'Cased opening', inch(W) + ' × ' + inch(o.head || 6.67), 1, 'ea', 118);
    else if (o.type === 'overhead') add('Doors & windows', 'Garage door, sectional (with opener)', ftin(W) + ' × ' + ftin(o.head || 7), 1, 'ea', 119);
  }
  if (baseFt > 0) add('Trim', 'Baseboard', '', Math.ceil(baseFt * 1.1), 'lin ft', 120);
  if (casingFt > 0) add('Trim', 'Door and window casing', '', Math.ceil(casingFt * 1.1), 'lin ft', 121);
  if (stoolFt > 0) add('Trim', 'Window stool', '', Math.ceil(stoolFt), 'lin ft', 122);
  // kitchen, bath, laundry
  let baseLf = 0, upperLf = 0, counter = 0;
  for (const it of plan.items || []) {
    const D = V.ITEMS[it.type]; if (!D) continue;
    const w = it.w || D.w, d = it.d || D.d;
    add(D.group, D.label, D.wv ? inch(w) + ' wide' : inch(w) + ' × ' + inch(d), 1, 'ea', D.group === 'Kitchen' ? 130 : D.group === 'Bathroom' ? 140 : 150);
    if (it.type === 'base' || it.type === 'sinkbase') { baseLf += w; counter += w * (d + 1 / 12); }
    if (it.type === 'island') counter += w * d;
    if (it.type === 'dishwasher') counter += w * (d + 1 / 12);
    if (it.type === 'upper') upperLf += w;
  }
  if (baseLf) add('Kitchen', 'Base cabinets, total run', '', Math.round(baseLf * 10) / 10, 'lin ft', 131);
  if (upperLf) add('Kitchen', 'Upper cabinets, total run', '', Math.round(upperLf * 10) / 10, 'lin ft', 132);
  if (counter) add('Kitchen', 'Countertop', '', Math.ceil(counter), 'sq ft', 133);
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
  // panels and posts run the full wall height: up through the plenum when there is one
  const WH = A.WH || H, hgt = ' × ' + ftin(WH);

  // --- Panels
  for (const w of walls) {
    if (!w.piece) continue;
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    add('Wall panels', PIECE_NAMES[w.piece] || 'Wall panel', inch(L) + hgt, 1, 'ea', 10);
  }
  let hStuds = 0, tranTrack = 0;
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
  // Transition panels: fill the step above a lower building that carries on through a gap in this wall
  for (const q of A.transitions || []) {
    const cuts = [0]; for (let m = 4; m < q.len - 1e-6; m += 4) cuts.push(m); cuts.push(q.len);
    let n = 0;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const L = cuts[i + 1] - cuts[i]; if (L < 1 / 12) continue;
      add('Wall panels', 'Transition panel (bulkhead over opening to lower ceiling)', (Math.abs(L - 4) < 1 / 96 ? '48″' : inch(L)) + ' × ' + ftin(q.y1 - q.y0), 1, 'ea', 11); n++;
    }
    if (n > 1) add('Studs & posts', 'H-stud, 3″ with insert (transition panels)', '3″ × ' + ftin(q.y1 - q.y0), n - 1, 'ea', 20);
    // bottom edge: closure channel; ceiling track on both faces (the lower ceiling's grid on one side,
    // this area's grid on the other); hanger wire/rod to the structure over the opening
    add('Trim', 'Closure channel, bottom of transition panels', ftin(q.len), Math.ceil(q.len), 'lin ft', 53);
    tranTrack += q.len * (H - q.y0 > 0.25 ? 2 : 1);
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
  if (hStuds) add('Studs & posts', 'H-stud, 3″ with insert (panel joint)', '3″ × ' + ftin(WH), hStuds, 'ea', 20);
  if (corners) add('Studs & posts', 'Corner post', '4″ × 4″ × ' + ftin(WH), corners, 'ea', 21);
  if (tees) add('Studs & posts', 'T-post', ftin(WH), tees, 'ea', 22);
  if (crosses) add('Studs & posts', 'Cross post', ftin(WH), crosses, 'ea', 23);
  if (caps) add('Studs & posts', 'End cap', ftin(WH), caps, 'ea', 24);

  // --- Doors, glass, pass-thrus
  for (const i of A.opInfo) {
    const o = i.o, W = i.len;
    if (i.frame) continue; // house doors and windows are counted with the house
    if (o.type === 'door') add('Doors & glass', 'Door, single (3070)', inch(W) + ' × ' + ftin(o.head || 7), 1, 'ea', 30);
    else if (o.type === 'door2') add('Doors & glass', 'Door, pair (6070)', inch(W) + ' × ' + ftin(o.head || 7), 1, 'ea', 31);
    else if (o.type === 'glass') add('Doors & glass', 'Glass, 1/4″', inch(W) + ' × ' + inch((o.head || 7) - (o.sill == null ? 3 : o.sill)), 1, 'ea', 32);
    else if (o.type === 'pass') add('Doors & glass', 'Pass-thru, stainless', inch(W) + ' W × ' + inch((o.head || 5) - (o.sill == null ? 3 : o.sill)) + ' H × ' + inch(o.depth || 2) + ' D', 1, 'ea', 33);
    else if (o.type === 'open') add('Doors & glass', 'Cased opening frame', inch(W) + ' × ' + ftin(o.head || 7), 1, 'ea', 34);
    else if (o.type === 'overhead') add('Doors & glass', 'Overhead door, sectional steel (with tracks, opener)', ftin(W) + ' × ' + ftin(o.head || 12), 1, 'ea', 35);
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
    if (p.hard !== false || p.frame) continue;
    const k = p.kind + '|' + p.t.toFixed(3) + '|' + p.h.toFixed(3), r = shell.get(k) || { kind: p.kind, t: p.t, h: p.h, len: 0, area: 0 };
    r.len += p.len; r.area += p.len * p.h; shell.set(k, r);
  }
  for (const i of A.opInfo) {
    if (i.hard !== false || i.frame) continue;
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
  trackFt += tranTrack;
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
    let gl = 0; for (const q of (V.ceilingLines ? V.ceilingLines(plan, A) : plan.ceilingGrid)) gl += Math.hypot(q[2] - q[0], q[3] - q[1]);
    add('Ceiling', 'T-grid, from ceiling drawing (carried over the whole ceiling)', '', Math.ceil(gl), 'lin ft', 64);
  }
  if (!A.empty && A.hardAny) {
    const fpr = V.footprint ? V.footprint(A) : null;
    const area = fpr ? fpr.area : A.bounds.w * A.bounds.d, tiles = Math.max(0, Math.ceil(area / 8) - nLed - nFfu);
    add('Ceiling', 'Ceiling tile, 2×4 (approx.)', '2′ × 4′', tiles, 'ea', 62);
    if (A.PL > 0) add('Ceiling', 'Plenum lid (top of the cleanroom)', ftin(A.PL) + ' plenum above the grid, top at ' + ftin(A.WH), Math.ceil(area), 'sq ft', 67);
    if (!(plan.ceilingGrid && plan.ceilingGrid.length)) {
      add('Ceiling', 'Ceiling grid (area, approx.)', '', Math.ceil(area), 'sq ft', 63);
      // tee takeoff from the grid as laid out
      const T = V.gridTakeoff ? V.gridTakeoff(plan, A) : null;
      if (T) {
        if (T.mainPcs) add('Ceiling grid', 'Main tee, 15/16″, 12′ (runs spliced, +5%)', '12′', T.mainPcs, 'ea', 70);
        if (T.cross4) add('Ceiling grid', 'Cross tee, 15/16″, 4′', '', T.cross4, 'ea', 71);
        if (T.cross2) add('Ceiling grid', 'Cross tee, 15/16″, 2′ (at 2 × 2 fixtures)', '', T.cross2, 'ea', 72);
        if (T.hangers) add('Ceiling grid', 'Hanger wire, 12 ga (every 4′ on mains + 4 per fixture)', '', T.hangers, 'ea', 73);
      }
    }
  }

  // --- Building structure: columns, roof joists, roof deck
  for (const c of plan.columns || []) add('Structure', c.kind === 'concrete' ? 'Concrete column' : 'Steel column, wide flange, with base plate', Math.round((c.size || 0.67) * 12) + '″ × ' + ftin(c.h || A.shellTop || V.shellHeight(plan, null)), 1, 'ea', 6);
  const RS = V.roofStructure ? V.roofStructure(plan, A) : null;
  if (RS) {
    const byLen = new Map(); for (const j of RS.joists) { const L = Math.ceil(j.len); byLen.set(L, (byLen.get(L) || 0) + 1); }
    for (const [L, n] of byLen) add('Structure', 'Open-web steel joist, ' + Math.round(RS.depth * 12) + 'K (' + RS.spacing + '′ on center)', L + '′ long', n, 'ea', 7);
    const fpa = V.footprint ? V.footprint(A, true) : null;
    if (fpa) add('Structure', 'Metal roof deck, 1½″', '', Math.ceil(fpa.area * 1.05), 'sq ft', 8);
  }
  // --- Electrical: devices as placed, and a branch-circuit estimate (20A, 120V) for the planner
  const DV = V.DEVICES || {}, devs = (plan.devices || []).filter(d => DV[d.type]);
  for (const d of devs) add('Electrical', DV[d.type].label, '', 1, 'ea', 90);
  if (devs.length || nFfu || nLed) {
    const recs = devs.filter(d => d.type === 'outlet' || d.type === 'gfci').length;
    const ded = devs.filter(d => d.type === 'dedicated' || d.type === 'r208' || d.type === 'jbox').length;
    const cFfu = nFfu ? Math.ceil(nFfu / 6) : 0, cLed = nLed ? Math.ceil(nLed / 24) : 0, cRec = recs ? Math.ceil(recs / 8) : 0;
    if (cFfu) add('Electrical', 'Branch circuits for FFUs, 20A (est., 6 FFUs per circuit)', '', cFfu, 'ea', 95);
    if (cLed) add('Electrical', 'Branch circuits for lights, 20A (est., 24 fixtures per circuit)', '', cLed, 'ea', 96);
    if (cRec) add('Electrical', 'Branch circuits for receptacles, 20A (est., 8 per circuit)', '', cRec, 'ea', 97);
    if (ded) add('Electrical', 'Dedicated circuits (equipment)', '', ded, 'ea', 98);
  }
  if (A.frameAny) houseTakeoff(plan, A, add);
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
    const floorFt = floorTrackFt(z.plan, A);
    // the areas of one building with several ceiling heights share their building's section
    const home = z.virtual ? out.find(q => q.key === (z.of || '__main')) : null;
    if (home) {
      for (const r of rows) {
        // counted items match on size; running totals (lin ft, sq ft…) add up whatever their size note says
        const m = home.rows.find(q => q.cat === r.cat && q.item === r.item && q.unit === r.unit && (r.unit !== 'ea' || q.size === r.size));
        if (!m) { home.rows.push({ ...r }); continue; }
        m.qty = Math.round((m.qty + r.qty) * 100) / 100;
        if (m.size !== r.size) m.size = /total$/.test(m.size) && m.unit === 'lin ft' ? ftin(m.qty) + ' total' : '';
      }
      home.rows.sort((a, b) => (a.order || 0) - (b.order || 0) || a.item.localeCompare(b.item) || String(a.size).localeCompare(String(b.size), undefined, { numeric: true }));
      home.floorFt += floorFt;
      continue;
    }
    out.push({ key: z.main ? '__main' : z.id, title: z.main ? (z.plan.name || 'Main building') : z.name, main: z.main, rows, floorFt });
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
