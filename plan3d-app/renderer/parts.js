/* Coll Plan3D — parts list (bill of materials) from a plan.
   Pieces placed in Build mode count as the unit they are; walls drawn in 2D are split on the 48″ module.
   Coll Business Solutions LLC */
(function (global) {
'use strict';
const FR = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
function inch(ft) { const e = Math.round(Math.abs(ft) * 96), i = Math.floor(e / 8), r = e % 8; return i + FR[r] + '″'; }
// a panel's width from its stud-to-stud length: H-studs are 3″ and sit 48″ on center, so a full panel is 45″
// (the most a panel can be) and a cut panel is its length less the stud
function panW(L) { const w = Math.min(45 / 12, L - 3 / 12); return w <= 0 ? inch(L) : Math.abs(w - 45 / 12) < 1 / 96 ? '45″' : inch(w); }
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
  // foundation first (concrete, rebar, gravel, anchor bolts; floor framing for a crawlspace or basement)
  if (global.Plan3DViewer.foundationTakeoff) {
    const FT = global.Plan3DViewer.foundationTakeoff(plan, A);
    FT.lines.forEach(([cat, item, size, q, unit], k) => add(cat === 'Framing' ? 'Framing' : 'Foundation', (cat === 'Rebar' ? '' : '') + item, size, unit === 'cu yd' ? Math.ceil(q * 4) / 4 : Math.ceil(q), unit, 60 + k * 0.1));
  }
  const V0 = global.Plan3DViewer, FIN = V0.finishOf ? V0.finishOf(plan) : {}, FN = (k, v) => { const e = V0.FINISH && V0.FINISH[k] && V0.FINISH[k][v]; return Array.isArray(e) ? e[0] : (e || ''); };
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
      const rc = FN('roofColor', FIN.roofColor);
      if (FIN.roof === 'metal') add('Roof', 'Standing-seam metal roofing, ' + rc, '+10% waste', Math.ceil(area * 1.1), 'sq ft', 81);
      else if (FIN.roof === 'tile') add('Roof', 'Clay roof tile, ' + rc, '+10% waste', Math.ceil(area / 100 * 1.1 * 10) / 10, 'squares', 81);
      else if (FIN.roof === 'slate') add('Roof', 'Slate roofing, ' + rc, '+10% waste', Math.ceil(area / 100 * 1.1 * 10) / 10, 'squares', 81);
      else add('Roof', 'Architectural shingles' + (rc ? ', ' + rc : ''), Math.ceil(area / 100 * 1.1 * 3) + ' bundles', Math.ceil(area / 100 * 1.1 * 10) / 10, 'squares', 81);
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
    const sName = (V0.FINISH ? V0.FINISH.siding[FIN.siding] : 'Lap siding') || 'Lap siding', sCol = FIN.sidingColor && FIN.sidingColor !== 'natural' ? ', ' + FN('sidingColor', FIN.sidingColor) : '';
    add('Siding', sName + sCol + (gableArea > 0 ? ', walls and gable ends' : ''), Math.ceil((extArea + gableArea) / 100 * 1.1 * 10) / 10 + ' squares', Math.ceil((extArea + gableArea) * 1.1), 'sq ft', 95);
    if (FIN.siding === 'brick') add('Siding', 'Brick ties and mortar (est.)', '7 bricks per sq ft', Math.ceil((extArea + gableArea) * 7 * 1.05), 'bricks', 96);
    if (FIN.siding === 'stucco') add('Siding', 'Stucco lath and three-coat system', '', Math.ceil((extArea + gableArea) * 1.1), 'sq ft', 96);
    if ((FIN.siding === 'lap' || FIN.siding === 'board' || FIN.siding === 'shake') && FIN.sidingColor !== 'natural') add('Paint', 'Exterior paint, ' + FN('sidingColor', FIN.sidingColor) + ' (2 coats)', '300 sq ft per gallon', Math.ceil((extArea + gableArea) * 2 / 300), 'gal', 104);
  }
  if (ext2x6) add('Insulation', 'Batts R-21, 2×6 walls', '', Math.ceil(ext2x6), 'sq ft', 100);
  if (ext2x4) add('Insulation', 'Batts R-15, 2×4 walls', '', Math.ceil(ext2x4), 'sq ft', 100);
  if (ceilArea && plan.__top !== false) add('Insulation', 'Attic, blown R-49', '', Math.ceil(ceilArea), 'sq ft', 101);
  if (dryArea + ceilArea) {
    add('Drywall', 'Drywall ½″, walls', '4×8 sheets', sheets(dryArea), 'sheets', 105);
    if (ceilArea) add('Drywall', 'Drywall ½″ ceiling board, ceilings', '4×8 sheets', sheets(ceilArea), 'sheets', 106);
    add('Drywall', 'Joint compound and tape (est.)', '1 box + 1 roll per 500 sq ft', Math.ceil((dryArea + ceilArea) / 500), 'sets', 107);
    add('Paint', 'Primer, walls and ceilings', '350 sq ft per gallon', Math.ceil((dryArea + ceilArea) / 350), 'gal', 108);
    add('Paint', 'Interior wall paint, ' + (FN('paint', FIN.paint) || 'warm white') + ' (2 coats)', '350 sq ft per gallon', Math.ceil(dryArea * 2 / 350), 'gal', 109);
    if (ceilArea) add('Paint', 'Ceiling paint, flat white', '350 sq ft per gallon', Math.ceil(ceilArea / 350), 'gal', 109);
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
    if (it.type === 'machine' || D.cr) continue;
    if (it.type === 'stairs' || it.type === 'stairsL') {
      // stairs: risers at 7¾″ max to the floor above, 10″ treads, three 2×12 stringers per run, rail and balusters
      const rise = plan.__rise || ((plan.ceiling || 8) + 1), n = Math.max(2, Math.ceil(rise * 12 / 7.75)), runFt = (n - 1) * 10 / 12;
      add('Stairs', D.label + ' (' + n + ' risers at ' + (Math.round(rise * 12 / n * 100) / 100) + '″, ' + (n - 1) + ' treads)', inch(w) + ' wide', 1, 'ea', 176);
      add('Stairs', 'Stair treads, oak 1″ × 11¼″', inch(w), n - 1, 'ea', 176.1);
      add('Stairs', 'Risers, primed 1×8', inch(w), n, 'ea', 176.2);
      add('Stairs', 'Stringers, 2×12', ftin(Math.hypot(runFt, rise) + 1), (it.type === 'stairsL' ? 2 : 1) * (w > 3.1 ? 3 : 2), 'ea', 176.3);
      add('Stairs', 'Handrail with brackets', '', Math.ceil(Math.hypot(runFt, rise) + 2), 'lin ft', 176.4);
      if (it.type === 'stairsL') add('Stairs', 'Landing framing and subfloor', inch(w) + ' square', 1, 'ea', 176.5);
      continue;
    }
    add(D.group, D.label, D.wv ? inch(w) + ' wide' : inch(w) + ' × ' + inch(d), 1, 'ea', ({ Kitchen: 130, Bathroom: 140, 'Laundry & utility': 150, 'Living room': 160, Dining: 165, Bedroom: 170, Lighting: 175, 'Outdoor & garage': 180 })[D.group] || 185);
    if (it.type === 'base' || it.type === 'sinkbase') { baseLf += w; counter += w * (d + 1 / 12); }
    if (it.type === 'island') counter += w * d;
    if (it.type === 'dishwasher' || it.type === 'winefridge') counter += w * (d + 1 / 12);
    if (it.type === 'pantrywall' || it.type === 'laundrycounter') counter += w * d;
    if (it.type === 'upper') upperLf += w;
  }
  const cabN = FN('cabinet', FIN.cabinet), ctN = FN('counter', FIN.counter);
  if (baseLf) add('Kitchen', 'Base cabinets, total run' + (cabN ? ', ' + cabN : ''), '', Math.round(baseLf * 10) / 10, 'lin ft', 131);
  if (upperLf) add('Kitchen', 'Upper cabinets, total run' + (cabN ? ', ' + cabN : ''), '', Math.round(upperLf * 10) / 10, 'lin ft', 132);
  if (counter) add('Kitchen', 'Countertop' + (ctN ? ', ' + ctN : ''), '', Math.ceil(counter), 'sq ft', 133);
}

function partsList(plan) {
  const V = global.Plan3DViewer, A = V.analyze(plan), H = A.H;
  const rows = new Map();
  const add = (cat, item, size, qty, unit, order) => {
    const k = cat + '|' + item + '|' + size + '|' + unit;
    const r = rows.get(k) || { cat, item, size, qty: 0, unit: unit || 'ea', order: order || 50 };
    r.qty += qty; rows.set(k, r);
  };
  // machines brought in from drawings: one line each, by name and size
  for (const it of plan.items || []) if (it.type === 'machine') add('Equipment', it.name || 'Machine', ftin(it.w || 0) + ' × ' + ftin(it.d || 0) + ' × ' + ftin(it.h || 8) + ' tall', 1, 'ea', 190);
  // cleanroom furniture and equipment: one line per kind and size, with its options
  for (const it of plan.items || []) {
    const D = V.ITEMS[it.type]; if (!D || !D.cr) continue;
    const w = it.w || D.w, d = it.d || D.d, h = D.sz && it.h > 0 ? it.h : D.h, inch = (v) => Math.round(v * 12 * 4) / 4 + '″';
    const opts = it.type === 'sstable' ? [it.shelf !== false ? 'undershelf' : '', it.splash ? 'backsplash' : '', it.casters ? 'casters' : ''].filter(Boolean) : [];
    const size = it.type === 'tackymat' ? inch(d) + ' × ' + inch(w) : D.sz ? inch(d) + ' × ' + inch(w) + ' × ' + inch(h) + (it.type === 'sstable' ? ' high' : ' tall') : D.wv ? inch(w) + ' wide' : '';
    add(D.group, D.label + (opts.length ? ', ' + opts.join(', ') : ''), size, 1, 'ea', ({ 'Cleanroom furniture': 186, 'Workstations and storage': 186.5, 'IV and compounding': 187, 'Sinks and gowning': 188, 'Air showers and ceiling': 188.5 })[D.group] || 189);
  }
  // hardwall (cleanroom) walls get panels, studs, posts, track and base; building walls get their own lines
  const walls = A.walls.filter(w => V.isHard(w)), built = new Set(walls.filter(w => w.piece).map(w => w.id));
  // panels and posts run the full wall height: up through the plenum when there is one
  const WH = A.WH || H, hgt = ' × ' + ftin(WH);

  // --- Panels: one piece up to 12′ tall; a taller wall is a 12′ panel with another stacked on it (and a
  // horizontal H-channel along the joint)
  // stacked walls split at the ceiling line (a plenum panel on top) where that works, else at 12′
  const panelRows = (ht, pc) => V.panelStack ? V.panelStack(ht, pc ? V.wallCeil(plan, A, pc) : H) : (() => { const r = []; let left = ht; while (left > 12 + 1 / 96) { r.push(12); left -= 12; } r.push(left); return r; })();
  let hJoint = 0;
  for (const w of walls) {
    if (!w.piece) continue;
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), R = panelRows(WH);
    for (const ht of R) add('Wall panels', (PIECE_NAMES[w.piece] || 'Wall panel') + (R.length > 1 ? (ht === R[R.length - 1] ? ' (upper, stacked)' : ' (lower)') : ''), inch(L) + ' × ' + ftin(ht), 1, 'ea', 10);
    hJoint += (R.length - 1) * L;
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
      const R = panelRows(p.h || WH, p); hJoint += (R.length - 1) * L;
      R.forEach((ht, k) => add('Wall panels', (p.sp ? 'S.P. panel' : 'Wall panel') + (R.length > 1 ? (k === R.length - 1 ? ' (upper, stacked)' : ' (lower)') : ''), panW(L) + ' × ' + ftin(ht), 1, 'ea', 10)); n++;
    }
    hStuds += Math.max(0, n - 1);
  }
  // Transition panels: fill the step above a lower building that carries on through a gap in this wall
  for (const q of A.transitions || []) {
    const cuts = [0]; for (let m = 4; m < q.len - 1e-6; m += 4) cuts.push(m); cuts.push(q.len);
    let n = 0;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const L = cuts[i + 1] - cuts[i]; if (L < 1 / 12) continue;
      add('Wall panels', 'Transition panel (bulkhead over opening to lower ceiling)', panW(L) + ' × ' + ftin(q.y1 - q.y0), 1, 'ea', 11); n++;
    }
    if (n > 1) add('Studs & posts', 'H-stud, 3″ with insert (transition panels)', '3″ × ' + ftin(q.y1 - q.y0), n - 1, 'ea', 20);
    // bottom edge: closure channel; ceiling track on both faces (the lower ceiling's grid on one side,
    // this area's grid on the other); hanger wire/rod to the structure over the opening
    add('Trim', 'Closure channel, bottom of transition panels', ftin(q.len), Math.ceil(q.len), 'lin ft', 53);
    tranTrack += q.len * (H - q.y0 > 0.25 ? 2 : 1);
  }

  // Wall height sections: an end cap where a wall steps, a top cap on any section not at the cleanroom's top
  for (const st of A.steps || []) add('Studs & posts', 'Step end cap (where a wall changes height)', ftin(st.y1 - st.y0), 1, 'ea', 25);
  // (the top of every wall, whatever its height, is covered by the white wall cap: see Ceiling)
  // Ceiling areas: bulkhead panels on the 48″ module where the ceiling steps across open ceiling
  for (const q of V.areaBulkheads ? V.areaBulkheads(plan, A) : []) {
    const cuts = [0]; for (let m = 4; m < q.len - 1e-6; m += 4) cuts.push(m); cuts.push(q.len);
    let n = 0;
    for (let i = 0; i + 1 < cuts.length; i++) { const L = cuts[i + 1] - cuts[i]; if (L < 1 / 12) continue; add('Wall panels', 'Bulkhead panel (ceiling height change)', panW(L) + ' × ' + ftin(q.y1 - q.y0), 1, 'ea', 12); n++; }
    if (n > 1) add('Studs & posts', 'H-stud, 3″ with insert (bulkhead panels)', '3″ × ' + ftin(q.y1 - q.y0), n - 1, 'ea', 20);
    add('Trim', 'Closure channel, bottom of bulkhead panels', '', Math.ceil(q.len), 'lin ft', 53);
    tranTrack += q.len * 2;
  }

  // Header panels over open passages: panels on the 48″ module (45″ max, H-studs make up the rest), H-studs
  // between them, closure channel along the bottom and ceiling track both faces. Their ends land on the wall
  // ends' posts, which run full height already.
  for (const q of V.headerSegs ? V.headerSegs(plan, A) : []) {
    const hh = ftin(q.y1 - q.y0), cuts = [0]; for (let m = 4; m < q.len - 1e-6; m += 4) cuts.push(m); cuts.push(q.len);
    let n = 0; for (let i = 0; i + 1 < cuts.length; i++) { const L = cuts[i + 1] - cuts[i]; if (L < 1 / 12) continue; add('Wall panels', 'Header panel (over open passage)', panW(L) + ' × ' + hh, 1, 'ea', 13); n++; }
    if (n > 1) add('Studs & posts', 'H-stud, 3″ with insert (header panels, 48″ on center)', '3″ × ' + hh, n - 1, 'ea', 20);
    add('Trim', 'Closure channel, bottom of header panels', '', Math.ceil(q.len), 'lin ft', 53);
    tranTrack += q.len * 2;
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

  // return grilles set into wall panels, and their dampers
  for (const gr of plan.grilles || []) {
    const sz = inch(gr.w || 20 / 12) + ' × ' + inch(gr.h || 20 / 12);
    add('Air chases', gr.plenum ? 'Plenum grille (in wall panel, air into the plenum)' : 'Return grille (in wall panel)', sz, 1, 'ea', 41.5);
    if (gr.damper) add('Air chases', 'Opposed-blade damper (behind wall grille)', sz, 1, 'ea', 41.6);
  }
  // --- Doors, glass, pass-thrus
  for (const i of A.opInfo) {
    const o = i.o, W = i.len;
    if (i.frame) continue; // house doors and windows are counted with the house
    const DS = V.doorSpec ? V.doorSpec(o, W) : null;
    if (DS) {
      // standard cleanroom door (built like the door drawings): leaves, vision lites, levers, frame
      const lw = inch(DS.leafW);
      add('Doors & glass', DS.n === 2 ? 'Door, pair (standard): two ' + lw + ' × 84″ leaves, no center post' : 'Door, single (standard): ' + lw + ' × 84″ leaf', inch(W) + ' frame opening × 86″ head', 1, 'ea', DS.n === 2 ? 31 : 30);
      add('Doors & glass', 'Vision lite in door, 24″ × 34″ glass (26″ × 36″ frame)', '', DS.n, 'ea', 32.5);
      add('Doors & glass', 'Lever lockset', '38″ to center', DS.n, 'ea', 32.6);
      add('Doors & glass', 'Door closer', '', DS.n, 'ea', 32.7);
    }
    else if (o.type === 'door') add('Doors & glass', 'Door, single (3070)', inch(W) + ' × ' + ftin(o.head || 7), 1, 'ea', 30);
    else if (o.type === 'door2') add('Doors & glass', 'Door, pair (6070)', inch(W) + ' × ' + ftin(o.head || 7), 1, 'ea', 31);
    else if (o.type === 'glass') add('Doors & glass', 'Glass, 1/4″', inch(W) + ' × ' + inch((o.head || 7) - (o.sill == null ? 3 : o.sill)), 1, 'ea', 32);
    else if (o.type === 'pass') add('Doors & glass', 'Pass-thru, stainless', inch(W) + ' W × ' + inch((o.head || 5) - (o.sill == null ? 3 : o.sill)) + ' H × ' + inch(o.depth || 2) + ' D', 1, 'ea', 33);
    else if (o.type === 'open') add('Doors & glass', 'Cased opening frame', inch(W) + ' × ' + ftin(o.head || 7), 1, 'ea', 34);
    else if (o.type === 'overhead') add('Doors & glass', 'Overhead door, sectional steel (with tracks, opener)', ftin(W) + ' × ' + ftin(o.head || 12), 1, 'ea', 35);
    // the header panels over a door, glass or pass-thru in a cleanroom wall: panels up to 45″ wide, an H-stud between
    if (i.hard && o.type !== 'removable') {
      const ceilHere = V.wallCeil ? V.wallCeil(plan, A, { x1: o.x1, z1: o.y1, x2: o.x2, z2: o.y2, t: i.t }) : H, top = i.wallH || WH, head = Math.min(Math.min(ceilHere, i.wallH || ceilHere), o.head || 7);
      if (top - head > 0.01) { const np = Math.max(1, Math.ceil((W + 3 / 12 - 1e-6) / (48 / 12))), pw = (W - (np - 1) * 3 / 12) / np, ns = np - 1; add('Wall panels', 'Header panel over door / glass', inch(pw) + ' × ' + ftin(top - head), np, 'ea', 10.7); if (ns) add('Studs & posts', 'H-stud, 3″ with insert (header panel over door / glass)', '3″ × ' + ftin(top - head), ns, 'ea', 20.7); }
    }
    if (o.type === 'removable' && V.removableOf) {
      // removable wall section: the same wall panels in a frame of 3″ × 3″ steel tube (posts to the lid, a header
      // tube), a 1″ white wall start inside the tubes, H-studs with inserts at the panel joints and in the
      // header panels over it (see removableLayout)
      const RL = V.removableOf(plan, A, i), paint = V.PANEL_COLORS && V.panelColorOf ? ((V.PANEL_COLORS[V.panelColorOf(plan, i.host)] || ['white'])[0]).toLowerCase() : 'white';
      add('Wall panels', 'Removable wall panel (equipment access section)', inch(RL.panelW) + ' × ' + ftin(RL.panelH), RL.n, 'ea', 10.5);
      for (const q of RL.headers) add('Wall panels', 'Header panel over removable section', inch(q.s1 - q.s0) + ' × ' + ftin(q.y1 - q.y0), 1, 'ea', 10.6);
      if (RL.studs.length) add('Studs & posts', 'H-stud, 3″ with insert (removable section joint)', '3″ × ' + ftin(RL.panelH), RL.studs.length, 'ea', 20.5);
      if (RL.hstuds.length) add('Studs & posts', 'H-stud, 3″ with insert (header panel over removable section)', '3″ × ' + ftin(RL.top - RL.head), RL.hstuds.length, 'ea', 20.6);
      add('Studs & posts', 'Removable section post, 3″ × 3″ steel tube, painted ' + paint + ' (floor to lid)', '3″ × 3″ × ' + ftin(RL.top), 2, 'ea', 25.5);
      add('Studs & posts', 'Removable section header tube, 3″ × 3″ steel, painted ' + paint, '3″ × 3″ × ' + ftin(RL.headerTube.s1 - RL.headerTube.s0), 1, 'ea', 25.6);
      add('Trim', 'Wall start, white (inside removable section frame)', '', Math.ceil(RL.startFt), 'lin ft', 53.5);
    }
  }

  // differential pressure gauges: one per room held at a pressure, reading it against outside the cleanroom
  { const pr = (plan.rooms || []).filter(r => r && r.pressure != null && r.pressure !== '' && +r.pressure !== 0);
    if (pr.length) { const mx = Math.max(...pr.map(r => Math.abs(+r.pressure))) / 249.0889; add('Air chases', 'Differential pressure gauge (Magnehelic-type), wall mount, with tubing', '0–' + (mx <= 0.2 ? '0.25' : mx <= 0.4 ? '0.5' : '1.0') + '″ w.c.', pr.length, 'ea', 43); } }
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
  if (hJoint > 0.1) add('Wall panels', 'Horizontal H-channel (joint between stacked panels, walls over 12′)', '', Math.ceil(hJoint), 'lin ft', 14.5);
  if (floorFt) add('Wall panels', 'Floor track, hardwall (under all wall panels)', ftin(floorFt) + ' total', Math.ceil(floorFt), 'lin ft', 15);
  let baseFt = 0, trackFt = 0;
  for (const p of A.pieces) if (p.hard !== false) { baseFt += p.len * 2; trackFt += p.len * 2; }
  for (const i of A.opInfo) {
    if (i.hard === false) continue;
    if (i.o.type === 'glass' || i.o.type === 'pass' || i.o.type === 'removable') baseFt += i.len * 2;
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
    const LM = plan.lightModel, LZ = LM && f.type !== 'ffu' && global.Plan3DEquipment ? global.Plan3DEquipment.lightSize(LM, f) : null;
    if (LZ && !f.em) { const [nm0] = fxSize(f); add('Ceiling', (LM.maker ? LM.maker + ' ' : '') + LM.model + ' LED panel, ' + nm0 + ', ' + LZ.model, LZ.watts + ', ' + LZ.lm + ', ' + LZ.cct, 1, 'ea', 60); continue; }
    if (f.type !== 'ffu' && f.em) { const [nm1, sz1] = fxSize(f); add('Ceiling', 'Emergency light, LED ' + nm1 + ', battery backup (90 minutes)', sz1, 1, 'ea', 60.5); continue; }
    const [nm, sz] = fxSize(f); add('Ceiling', f.type === 'ffu' ? 'Fan filter unit, ' + nm : (LM ? (LM.maker ? LM.maker + ' ' : '') + LM.name + ', ' : 'LED light, ') + nm, LM && f.type !== 'ffu' ? sz + (sz ? ', ' : '') + (LM.finishLabel || '') : sz, 1, 'ea', f.type === 'ffu' ? 61 : 60);
  }
  if (ffuN && ffuLb) add('Ceiling', 'FFU weight on the grid, total', '', Math.round(ffuLb), 'lb', 65);
  if (ffuN && ffuCfm) add('Ceiling', 'FFU airflow, total at max', '', Math.round(ffuCfm), 'CFM', 66);
  if (plan.ceilingGrid && plan.ceilingGrid.length) {
    let gl = 0; for (const q of (V.ceilingLines ? V.ceilingLines(plan, A) : plan.ceilingGrid)) gl += Math.hypot(q[2] - q[0], q[3] - q[1]);
    add('Ceiling', 'T-grid, from ceiling drawing (carried over the whole ceiling)', '', Math.ceil(gl), 'lin ft', 64);
  }
  if (!A.empty && A.hardAny) {
    const fpr = V.footprint ? V.footprint(A) : null;
    // a generated ceiling covers only the rooms it was laid out in
    const CRs = plan.ceilRects && plan.ceilRects.length && V.ceilingRects ? V.ceilingRects(plan, fpr, A) : null;
    const area = CRs ? CRs.reduce((t, r) => t + (r[2] - r[0]) * (r[3] - r[1]), 0) : fpr ? fpr.area : A.bounds.w * A.bounds.d, tiles = Math.max(0, Math.ceil(area / 8) - nLed - nFfu);
    // tiles as the grid lays them: full ones, each cut size, and how many to order
    let TT = null; try { TT = V.tileTakeoff ? V.tileTakeoff(plan, A) : null; } catch (e) { TT = null; }
    if (TT) {
      const inch = (ft) => { const e = Math.round(ft * 48), n = Math.floor(e / 4), r = e % 4; return n + ['', '¼', '½', '¾'][r] + '″'; };
      const tk = global.Plan3DViewer.tileName(plan);
      add('Ceiling', 'Ceiling tile, ' + tk + ', full 2′ × 4′', '2′ × 4′', TT.full, 'ea', 62);
      for (const c of TT.cuts) add('Ceiling', 'Ceiling tile, ' + tk + ', cut' + (c.notch ? ' and notched' : ''), inch(c.a) + ' × ' + inch(c.b) + ' opening', c.n, 'ea', 62.1);
      add('Ceiling', `Ceiling tiles to order, ${tk}, 2′ × 4′ (${TT.full} full + ${TT.cutStock} for ${TT.cutPcs} cut${TT.cutPcs === 1 ? '' : 's'}, two small cuts from one tile where they fit, +5% spare)`, '2′ × 4′', Math.ceil((TT.full + TT.cutStock) * 1.05), 'ea', 62.2);
    } else add('Ceiling', 'Ceiling tile, ' + global.Plan3DViewer.tileName(plan) + ', 2×4 (approx.)', '2′ × 4′', tiles, 'ea', 62);
    const DKs = V.deckShapes ? V.deckShapes(plan) : [];
    if (DKs.length) add('Ceiling', 'Steel roof deck / lid, from the deck drawing (' + DKs.length + ' piece' + (DKs.length === 1 ? '' : 's') + ')', 'sits on the walls, highest at ' + ftin(Math.max(...DKs.map(d => V.deckBase ? V.deckBase(plan, A, d, A.WH) : A.WH))), Math.ceil(DKs.reduce((t, d) => t + d.area, 0)), 'sq ft', 67);
    if (DKs.length && V.deckSteps) {
      // the steps in the lid: wall panels by height, with a closure channel along the bottom and a cap on top
      const byH = new Map(); let ch = 0;
      for (const q of V.deckSteps(plan, A, A.WH)) {
        if (q.y1 - q.y0 < 0.05) continue;
        const hh = ftin(q.y1 - q.y0), cuts = [0]; for (let m = 4; m < q.len - 1e-6; m += 4) cuts.push(m); cuts.push(q.len);
        let n = 0; for (let i = 0; i + 1 < cuts.length; i++) { const L = cuts[i + 1] - cuts[i]; if (L < 1 / 12) continue; add('Ceiling', 'Wall panel, lid step', panW(L) + ' × ' + hh, 1, 'ea', 67.1); n++; }
        if (n > 1) add('Ceiling', 'H-stud, 3″ with insert (lid step panels, 48″ on center)', '3″ × ' + hh, n - 1, 'ea', 67.15);
        add('Ceiling', 'End cap (lid step panels)', hh, 2, 'ea', 67.16);
        ch += 2 * q.len;
      }
      if (ch > 0) add('Ceiling', 'Lid step closure channel and cap', '', Math.ceil(ch * 1.05), 'lin ft', 67.2);
    }
    if (!DKs.length && A.PL > 0) add('Ceiling', 'Plenum lid, galvanized steel deck 1½″ (top of the cleanroom)', ftin(A.PL) + ' plenum, sits at ' + ftin(V.lidTop ? V.lidTop(plan, A) : A.WH), Math.ceil(area * 1.05), 'sq ft', 67);
    // the white cap over the top of every cleanroom wall, in 12′ lengths, notched round the beam flanges
    if (V.wallCaps) {
      const C = V.wallCaps(plan, A); let n = 0, ft = 0, notch = 0;
      for (const c of C) { n += Math.ceil(c.L / 12 - 1e-6); ft += c.L; notch += c.cuts.length; }
      if (n) add('Ceiling', 'Wall cap, white, over the top of the wall panels (down 1″ both faces)', '12′ lengths (' + Math.ceil(ft) + ' lin ft)', n, 'ea', 67.3);
      if (notch) add('Ceiling', 'Wall cap notch round a beam flange (cut in the field)', '', notch, 'ea', 67.31);
    }
    if (!(plan.ceilingGrid && plan.ceilingGrid.length)) {
      add('Ceiling', 'Ceiling grid (area, approx.)', '', Math.ceil(area), 'sq ft', 63);
      // tee takeoff from the grid as laid out
      const T = V.gridTakeoff ? V.gridTakeoff(plan, A) : null;
      // white is the standard enamel; another colour is named on each tee so it's priced and ordered on its own
      const gcol = V.gridColorOf ? V.gridColorOf(plan) : 'white', gsfx = gcol === 'white' ? '' : ', ' + V.GRID_COLORS[gcol][0].toLowerCase();
      if (T) {
        if (T.mainPcs) add('Ceiling grid', 'Main tee, 15/16″, 12′' + gsfx + ' (runs spliced, +5%)', '12′', T.mainPcs, 'ea', 70);
        if (T.cross4) add('Ceiling grid', 'Cross tee, 15/16″, 4′' + gsfx, '', T.cross4, 'ea', 71);
        if (T.framePcs) add('Ceiling grid', 'Cross tee, 15/16″, 4′' + gsfx + ', cut to frame FFUs and lights off the grid (' + Math.ceil(T.frameFt) + ' ft)', '', T.framePcs, 'ea', 71.5);
        if (T.cross2) add('Ceiling grid', 'Cross tee, 15/16″, 2′' + gsfx + ' (at 2 × 2 fixtures)', '', T.cross2, 'ea', 72);
        if (T.hangers) add('Ceiling grid', 'Hanger wire, 12 ga (every 4′ on mains + 4 per fixture)', '', T.hangers, 'ea', 73);
      }
    }
  }

  // --- Building structure: columns, roof joists, roof deck
  for (const c of plan.columns || []) add('Structure', c.kind === 'concrete' ? 'Concrete column' : 'Steel column, wide flange, with base plate', Math.round((c.size || 0.67) * 12) + '″ × ' + ftin(c.h || A.shellTop || V.shellHeight(plan, null)), 1, 'ea', 6);
  // steel beams by size: count, total length, weight
  if ((plan.beams || []).length && V.BEAMS) {
    const by = new Map(); for (const b of plan.beams) { const k = b.size && V.BEAMS[b.size] ? b.size : 'W12x26', q = V.beamSeat ? V.beamSeat(plan, A, b) : b, L = Math.hypot(q.x2 - q.x1, q.y2 - q.y1), e = by.get(k) || { n: 0, L: 0 }; e.n++; e.L += L; by.set(k, e); }
    for (const [k, e] of by) add('Structure', 'Steel beam (I-beam) ' + k.replace('x', '×') + ', ' + e.n + ' piece' + (e.n > 1 ? 's' : '') + ', about ' + Math.round(e.L * V.BEAMS[k].lb).toLocaleString() + ' lb', '', Math.ceil(e.L), 'lin ft', 6.5);
  }
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
  // fixture whips (daisy chain box to box): 9′ whips and the 12′ extensions on the longer runs
  if (Array.isArray(plan.whips) && plan.whips.length) {
    const nx = plan.whips.reduce((n, w) => n + (w.ext || 0), 0);
    add('Electrical', 'Fixture whip, Acuity RELOC OnePass OC1, 1-port, ' + (plan.whipVolt == 277 ? 277 : 120) + 'V, 12 AWG, flexible steel', '9′', plan.whips.length, 'ea', 91);
    if (nx) add('Electrical', 'Extension whip, Acuity RELOC OnePass OC1, 1-port, ' + (plan.whipVolt == 277 ? 277 : 120) + 'V, 12 AWG, flexible steel', '12′', nx, 'ea', 91.5);
  }
  if (devs.length || nFfu || nLed) {
    const recs = devs.filter(d => d.type === 'outlet' || d.type === 'gfci').length;
    const ded = devs.filter(d => d.type === 'dedicated' || d.type === 'r208' || d.type === 'jbox').length;
    let cFfu = nFfu ? Math.ceil(nFfu / 6) : 0, cLed = nLed ? Math.ceil(nLed / 24) : 0, cRec = recs ? Math.ceil(recs / 8) : 0;
    // the panel schedule's own count when it can be worked out (by load, room by room)
    try { if (global.Plan3DLoads) { const SC = global.Plan3DLoads.schedule(plan).circuits; cFfu = SC.filter(c => c.kind === 'ffu').length; cLed = SC.filter(c => c.kind === 'light').length; } } catch (e) { /* keep the estimate */ }
    if (cFfu) add('Electrical', 'Branch circuits for FFUs, 20A (by load, room by room)', '', cFfu, 'ea', 95);
    if (cLed) add('Electrical', 'Branch circuits for lights, 20A (by load, room by room)', '', cLed, 'ea', 96);
    { const zn = (plan.rooms || []).length && global.Plan3DLoads ? (() => { try { return global.Plan3DLoads.schedule(plan).zones.length; } catch (e) { return 0; } })() : 0; if (zn) add('Electrical', '0-10V dimmer (one per room)', '', zn, 'ea', 96.5); }
    if (cRec) add('Electrical', 'Branch circuits for receptacles, 20A (est., 8 per circuit)', '', cRec, 'ea', 97);
    if (ded) add('Electrical', 'Dedicated circuits (equipment)', '', ded, 'ea', 98);
  }
  const LPs = V.levelPlans && plan.levels && plan.levels.length > 1 ? V.levelPlans(plan) : null;
  if (LPs) {
    // every floor of the house; the floor system under each floor that sits on another
    for (const L of LPs) {
      const AL = V.analyze(L.plan); if (!AL.frameAny) continue;
      houseTakeoff(L.plan, AL, (cat, item, size, qty, unit, order) => add(cat, item, size, qty, unit, order));
      if (L.plan.__floorBand > 0) {
        const fp = V.footprint(AL, true), ar = fp ? fp.area : 0, per = V.houseExtWalls(L.plan, AL).reduce((t, w) => t + Math.hypot(w.x2 - w.x1, w.y2 - w.y1), 0), nm = L.name;
        add('Floor framing', 'I-joists 11⅞″ at 16″ on center, ' + nm, '', Math.ceil(ar / 1.333 * 1.1), 'lin ft', 66);
        add('Floor framing', 'Rim board 1⅛″ × 11⅞″, ' + nm, '', Math.ceil(per * 1.1), 'lin ft', 66.1);
        add('Floor framing', 'Subfloor ¾″ T&G OSB 4×8, ' + nm, '', Math.ceil(ar / 32 * 1.1), 'sheets', 66.2);
        add('Floor framing', 'Subfloor adhesive (1 tube per 2 sheets)', '', Math.ceil(ar / 32 * 1.1 / 2), 'tubes', 66.3);
      }
    }
  } else if (A.frameAny) houseTakeoff(plan, A, add);
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
