/* Coll Plan3D — fabrication sheets.
   Every hardwall (cleanroom) wall drawn as an elevation for the shop: its panels on the 48″ module from the
   wall's start (the same panels the parts list counts), each with a number (W3-02, and L / U for the lower and
   upper panel of a stacked wall), the doors, glass and pass-thrus, the return grilles and dampers cut into
   the panels, and the electrical boxes. A key plan shows where each wall is, and a cut list gives every
   panel's size and the cut-outs to make in it, measured from the panel's left edge and bottom, and a crate list
   packs the panels wall by wall for shipping.
   Elevations look at the wall from its left side as drawn (start on the left, end on the right).
   Coll Business Solutions LLC */
(function (global) {
'use strict';
const V = () => global.Plan3DViewer, SH = () => global.Plan3DSheet;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n3 = (v) => +(+v).toFixed(3);
const dim = (ft) => SH().dimText(ft);
const PIECE_NAMES = { panel: 'Wall panel', sp: 'S.P. panel', glass: 'Glass panel', door: 'Door panel, 3070', door2: 'Door panel, pair 6070', pass: 'Pass-thru panel' };
const OPEN_NAMES = { door: 'Door 3070', door2: 'Door pair 6070', glass: 'Glass', window: 'Window', pass: 'Pass-thru', open: 'Opening', overhead: 'Overhead door', removable: 'Removable section' };

/* Every straight run of hardwall (cleanroom) wall with its panels, openings, grilles and boxes, measured along
   the run from its start (ft). Walls drawn as several pieces in a straight line, end to end, make one run, so
   the shop gets one elevation per straight wall. */
function walls(plan) {
  if (V().flatten && plan.inserts && plan.inserts.length) plan = V().flatten(plan);
  const A = V().analyze(plan); if (A.empty) return { A, walls: [], plan };
  const WH = A.WH || A.H, out = [];
  const hard = A.walls.filter(w => V().isHard(w) && Math.hypot(w.x2 - w.x1, w.y2 - w.y1) >= 0.1), used = new Set();
  const dirOf = (w) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); return [(w.x2 - w.x1) / L, (w.y2 - w.y1) / L]; };
  for (const w0 of hard) {
    if (used.has(w0)) continue;
    used.add(w0);
    const [ux, uy] = dirOf(w0), off = (x, y) => (x - w0.x1) * -uy + (y - w0.y1) * ux, run = [w0];
    const proj = (x, y) => (x - w0.x1) * ux + (y - w0.y1) * uy;
    let lo = Math.min(proj(w0.x1, w0.y1), proj(w0.x2, w0.y2)), hi = Math.max(proj(w0.x1, w0.y1), proj(w0.x2, w0.y2)), grew = true;
    while (grew) {
      grew = false;
      for (const h of hard) {
        if (used.has(h)) continue;
        const [hx, hy] = dirOf(h);
        if (Math.abs(ux * hy - uy * hx) > 0.01 || Math.abs(off(h.x1, h.y1)) > 0.08 || Math.abs(off(h.x2, h.y2)) > 0.08) continue;
        const a = Math.min(proj(h.x1, h.y1), proj(h.x2, h.y2)), b = Math.max(proj(h.x1, h.y1), proj(h.x2, h.y2));
        if (a > hi + 0.35 || b < lo - 0.35) continue;
        run.push(h); used.add(h); lo = Math.min(lo, a); hi = Math.max(hi, b); grew = true;
      }
    }
    const S = (x, y) => proj(x, y) - lo, L = hi - lo; if (L < 0.25) continue;
    const ids = new Set(run.map(w => w.id)), tag = 'W' + (out.length + 1), panels = [];
    for (const w of run) {
      const wl = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), fwd = ((w.x2 - w.x1) * ux + (w.y2 - w.y1) * uy) > 0, s0w = S(w.x1, w.y1);
      const toRun = (s) => fwd ? s0w + s : s0w - s;
      if (w.piece) { panels.push({ s0: Math.min(toRun(0), toRun(wl)), s1: Math.max(toRun(0), toRun(wl)), h: WH, rows: V().panelStack(WH, A.H), type: PIECE_NAMES[w.piece] || 'Wall panel', sp: w.piece === 'sp' }); continue; }
      for (const p of A.pieces.filter(q => q.id === w.id && q.hard !== false)) {
        // the 48″ module from this wall's own start, as the parts list counts it
        const a = p.s0, b = p.s0 + p.len, cuts = [a];
        for (let m = Math.floor(a / 4 + 1e-6) * 4 + 4; m < b - 1e-6; m += 4) cuts.push(m);
        cuts.push(b);
        const h = p.h || WH, rows = V().panelStack(h, V().wallCeil(plan, A, p));
        for (let i = 0; i + 1 < cuts.length; i++) if (cuts[i + 1] - cuts[i] >= 1 / 12) { const x = toRun(cuts[i]), y = toRun(cuts[i + 1]); panels.push({ s0: Math.min(x, y), s1: Math.max(x, y), h, rows, type: p.sp ? 'S.P. panel' : 'Wall panel', sp: !!p.sp }); }
      }
    }
    // removable wall sections: their panels (and the header panels over them) are panels on this wall too,
    // marked R; the frame (tube posts, header tube, white start) is drawn round them
    const rems = [];
    for (const i of A.opInfo) {
      if (i.o.type !== 'removable' || !i.host || !ids.has(i.host.id) || !V().removableOf) continue;
      const RL = V().removableOf(plan, A, i), a = S(i.o.x1, i.o.y1), b = S(i.o.x2, i.o.y2), at = (q) => { const x = a < b ? a + q : a - q; return x; };
      const span = (q) => ({ s0: Math.min(at(q.s0), at(q.s1)), s1: Math.max(at(q.s0), at(q.s1)), y0: q.y0, y1: q.y1 });
      for (const q of RL.panels) { const r = span(q); panels.push({ s0: r.s0, s1: r.s1, y0: r.y0, h: r.y1 - r.y0, rows: [r.y1 - r.y0], type: 'Removable panel', rem: true, gs: Math.min(a, b), hdr: 0 }); }
      for (const q of RL.headers) { const r = span(q); panels.push({ s0: r.s0, s1: r.s1, y0: r.y0, h: r.y1 - r.y0, rows: [r.y1 - r.y0], type: 'Header panel over removable section', rem: true, gs: Math.min(a, b), hdr: 1 }); }
      rems.push({ s0: Math.min(a, b), s1: Math.max(a, b), RL, posts: RL.posts.map(span), tube: span(RL.headerTube), starts: RL.starts.map(span), studs: RL.studs.concat(RL.hstuds).map(span) });
    }
    // a removable section's panels number together: the ones that come out first, then the header panels over them
    const key = (q) => q.rem ? q.gs : q.s0;
    panels.sort((a, b) => key(a) - key(b) || (a.hdr || 0) - (b.hdr || 0) || a.s0 - b.s0);
    panels.forEach((q, k) => { q.id = tag + '-' + String(k + 1).padStart(2, '0') + (q.rem ? 'R' : ''); });
    const ops = A.opInfo.filter(i => i.host && ids.has(i.host.id)).map(i => { const a = S(i.o.x1, i.o.y1), b = S(i.o.x2, i.o.y2), o = i.o, head = o.head || (o.type === 'pass' ? 4 : 7), sill = o.type === 'door' || o.type === 'door2' || o.type === 'open' || o.type === 'overhead' ? 0 : (o.sill == null ? 3 : +o.sill);
      return { s0: Math.min(a, b), s1: Math.max(a, b), type: o.type || 'open', head: Math.min(head, WH), sill: Math.max(0, Math.min(sill, head - 0.25)), name: OPEN_NAMES[o.type] || 'Opening' }; }).sort((a, b) => a.s0 - b.s0);
    const near = (x, y, pad) => run.some(w => V().segDist(x, y, w.x1, w.y1, w.x2, w.y2) < (w.t || 0.25) / 2 + pad);
    const grilles = (plan.grilles || []).filter(g => ids.has(g.wall) || (!g.wall && near(g.x, g.y, 0.05))).map(g => {
      const gw = Math.max(0.25, +g.w || 20 / 12), gh = Math.max(0.25, +g.h || 20 / 12), s = S(g.x, g.y);
      return { s0: s - gw / 2, s1: s + gw / 2, sill: Math.max(0, g.sill == null ? 0.5 : +g.sill), w: gw, h: gh, damper: !!g.damper, plenum: !!g.plenum }; });
    const DV = V().DEVICES || {};
    const boxes = (plan.devices || []).filter(d => DV[d.type] && near(d.x, d.y, 0.2)).map(d => {
      const D = DV[d.type], s = S(d.x, d.y), h = d.h != null ? +d.h : D.h;
      return { s0: s - D.w / 2, s1: s + D.w / 2, y0: h - D.hh / 2, y1: h + D.hh / 2, label: D.short, name: D.label }; });
    const sx = w0.x1 + ux * (lo - proj(w0.x1, w0.y1)) , sy = w0.y1 + uy * (lo - proj(w0.x1, w0.y1));
    out.push({ w: { x1: sx, y1: sy, x2: sx + ux * L, y2: sy + uy * L, t: w0.t }, members: run, tag, L, WH, ux, uy, panels, ops, grilles, boxes, rems });
  }
  return { A, walls: out, plan };
}

/* What gets cut into each panel (and each row of a stacked panel): grilles and boxes over it, measured from
   the panel's left edge and its bottom. */
function cutList(W) {
  const rows = [];
  for (const wl of W.walls) for (const p of wl.panels) {
    let y = p.y0 || 0;
    p.rows.forEach((ht, k) => {
      const y0 = y, y1 = y + ht; y = y1;
      const id = p.id + (p.rows.length > 1 ? (k === p.rows.length - 1 ? 'U' : k === 0 ? 'L' : 'M' + k) : '');
      const cuts = [];
      for (const g of wl.grilles) { const a = Math.max(g.s0, p.s0), b = Math.min(g.s1, p.s1), gy0 = Math.max(g.sill, y0), gy1 = Math.min(g.sill + g.h, y1); if (b - a > 0.02 && gy1 - gy0 > 0.02) cuts.push(`${g.plenum ? 'Plenum grille' : 'Grille'} ${dim(b - a)} × ${dim(gy1 - gy0)} at ${dim(a - p.s0)} from left, ${dim(gy0 - y0)} up${g.damper ? ', with damper' : ''}${b - a < g.w - 0.02 ? ' (part of a ' + dim(g.w) + ' grille across the joint)' : ''}`); }
      for (const d of wl.boxes) { const a = Math.max(d.s0, p.s0), b = Math.min(d.s1, p.s1); if (b - a > 0.01 && d.y1 > y0 && d.y0 < y1) cuts.push(`${d.name} box ${dim(d.s1 - d.s0)} × ${dim(d.y1 - d.y0)} at ${dim(d.s0 - p.s0)} from left, ${dim(d.y0 - y0)} up`); }
      rows.push({ id, wall: wl.tag, type: p.type + (p.rows.length > 1 ? (k === p.rows.length - 1 ? ' (upper)' : ' (lower)') : ''), w: p.s1 - p.s0, h: ht, cuts, sp: p.sp });
    });
  }
  return rows;
}

const SCALES = [[1 / 2, '1/2" = 1\'-0"'], [3 / 8, '3/8" = 1\'-0"'], [1 / 4, '1/4" = 1\'-0"'], [3 / 16, '3/16" = 1\'-0"'], [1 / 8, '1/8" = 1\'-0"'], [3 / 32, '3/32" = 1\'-0"'], [1 / 16, '1/16" = 1\'-0"']];
const PW = 17, PH = 11, M = 0.5, TB = 0.75; // tabloid landscape, margins, title block height

function titleBlock(info, sheet, title) {
  const y = PH - M - TB, w = PW - 2 * M;
  return `<g font-family="Segoe UI, Arial, sans-serif"><rect x="${M}" y="${y}" width="${w}" height="${TB}" fill="#fff" stroke="#111" stroke-width="0.02"/>
    <line x1="${M + 5}" y1="${y}" x2="${M + 5}" y2="${y + TB}" stroke="#111" stroke-width="0.01"/><line x1="${M + 11}" y1="${y}" x2="${M + 11}" y2="${y + TB}" stroke="#111" stroke-width="0.01"/><line x1="${M + 14}" y1="${y}" x2="${M + 14}" y2="${y + TB}" stroke="#111" stroke-width="0.01"/>
    <text x="${M + 0.15}" y="${y + 0.3}" font-size="0.2" font-weight="700">${esc(info.company || 'Coll Business Solutions LLC')}</text><text x="${M + 0.15}" y="${y + 0.55}" font-size="0.13" fill="#555">Fabrication sheets · panels, cut-outs, cut list</text>
    <text x="${M + 5.15}" y="${y + 0.25}" font-size="0.11" fill="#666">PROJECT</text><text x="${M + 5.15}" y="${y + 0.52}" font-size="0.2" font-weight="600">${esc(info.project)}</text>
    <text x="${M + 11.15}" y="${y + 0.25}" font-size="0.11" fill="#666">${esc(title ? 'SHOWS' : 'DATE')}</text><text x="${M + 11.15}" y="${y + 0.52}" font-size="0.16">${esc(title || info.date)}</text>
    <text x="${M + 14.15}" y="${y + 0.25}" font-size="0.11" fill="#666">SHEET</text><text x="${M + 14.15}" y="${y + 0.55}" font-size="0.26" font-weight="700">${esc(sheet)}</text></g>`;
}

/* The key plan: every hardwall wall with its tag, so the shop knows which elevation is which. */
function keyPlan(W, box) {
  const A = W.A, b = A.bounds, pad = 2, sc = Math.min(box.w / (b.w + 2 * pad), box.h / (b.d + 2 * pad)), ox = box.x + (box.w - b.w * sc) / 2, oy = box.y + (box.h - b.d * sc) / 2;
  const X = (x) => n3(ox + (x - b.minX) * sc), Y = (y) => n3(oy + (y - b.minZ) * sc);
  let s = '';
  for (const w of A.walls) s += `<line x1="${X(w.x1)}" y1="${Y(w.y1)}" x2="${X(w.x2)}" y2="${Y(w.y2)}" stroke="${V().isHard(w) ? '#222' : '#aaa'}" stroke-width="${n3(Math.max(0.02, (w.t || 0.25) * sc))}"/>`;
  for (const wl of W.walls) {
    const w = wl.w, mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2, nx = -wl.uy, ny = wl.ux, off = 0.28 / sc + (w.t || 0.25);
    // the tag sits on the side the elevation looks from, with an arrow toward the wall
    const tx = X(mx + nx * off), ty = Y(my + ny * off);
    s += `<g><circle cx="${tx}" cy="${ty}" r="0.17" fill="#fff" stroke="#c0392b" stroke-width="0.02"/><text x="${tx}" y="${n3(ty + 0.055)}" font-size="0.14" text-anchor="middle" font-weight="700" fill="#c0392b" font-family="Segoe UI, Arial, sans-serif">${wl.tag}</text></g>`;
  }
  for (const o of W.plan.openings || []) s += `<line x1="${X(o.x1)}" y1="${Y(o.y1)}" x2="${X(o.x2)}" y2="${Y(o.y2)}" stroke="#fff" stroke-width="${n3(Math.max(0.03, 0.18 * sc))}"/>`;
  for (const r of W.plan.rooms || []) if (r.name) s += `<text x="${X(r.x)}" y="${Y(r.y)}" font-size="0.13" text-anchor="middle" fill="#666" font-family="Segoe UI, Arial, sans-serif">${esc(r.name)}</text>`;
  return s;
}

/* One wall's elevation, its bottom-left at (x0, yb) inches, at scale sc (inches per foot). */
function elevation(wl, x0, yb, sc) {
  const X = (s) => n3(x0 + s * sc), Y = (y) => n3(yb - y * sc), WH = wl.WH;
  let s = '';
  const tiny = sc < 0.2;
  // panels (rows), numbered
  for (const p of wl.panels) {
    const y0 = p.y0 || 0; let y = y0;
    p.rows.forEach((ht, k) => {
      s += `<rect x="${X(p.s0)}" y="${Y(y + ht)}" width="${n3((p.s1 - p.s0) * sc)}" height="${n3(ht * sc)}" fill="${p.sp ? '#fff3b0' : /Glass/.test(p.type) ? '#e3f4f8' : p.rem ? '#fff6ea' : '#fff'}" stroke="#222" stroke-width="0.012"/>`;
      y += ht;
    });
    const cx = X((p.s0 + p.s1) / 2), wIn = (p.s1 - p.s0) * sc, fs = n3(Math.min(0.13, Math.max(0.06, wIn * 0.22))), ly = Y(y0 + p.h * 0.55);
    if (wIn > 0.18) s += `<text x="${cx}" y="${ly}" font-size="${fs}" text-anchor="middle" ${wIn < 0.45 ? `transform="rotate(-90 ${cx} ${ly})"` : ''} fill="${p.rem ? '#b5651d' : '#1d5fa8'}" font-weight="600">${p.id.split('-')[1]}</text>`;
  }
  // removable sections: the tube posts (to the top) and header tube in grey, the white start, the H-studs, a
  // dashed outline round the panels that come out and the note REMOVABLE
  for (const r of wl.rems || []) {
    const rect = (q, fill, sw) => `<rect x="${X(q.s0)}" y="${Y(q.y1)}" width="${n3(Math.max(0.006, (q.s1 - q.s0) * sc))}" height="${n3((q.y1 - q.y0) * sc)}" fill="${fill}" stroke="#222" stroke-width="${sw || 0.008}"/>`;
    // 3″ × 3″ steel tube, painted to match the room: drawn white, a heavier outline
    for (const q of r.posts) s += rect(q, '#ffffff', 0.016); s += rect(r.tube, '#ffffff', 0.016);
    for (const q of r.starts) s += rect(q, '#ffffff', 0.006);
    for (const q of r.studs) s += rect(q, '#eef1f2', 0.006);
    const P0 = r.RL.panels, lo = Math.min(...r.starts.map(q => q.s0)), hi = Math.max(...r.starts.map(q => q.s1)), ph = r.RL.panelH;
    s += `<rect x="${X(lo + 0.06)}" y="${Y(ph - 0.06)}" width="${n3((hi - lo - 0.12) * sc)}" height="${n3((ph - 0.12) * sc)}" fill="none" stroke="#e0a43a" stroke-width="0.02" stroke-dasharray="0.08 0.05"/>`;
    s += `<text x="${X((r.s0 + r.s1) / 2)}" y="${Y(ph * 0.3)}" font-size="${tiny ? 0.07 : 0.1}" text-anchor="middle" fill="#b5651d" font-weight="700">REMOVABLE</text>`;
    if (!tiny) s += `<text x="${X((r.s0 + r.s1) / 2)}" y="${n3(Y(ph * 0.3) + 0.13)}" font-size="0.075" text-anchor="middle" fill="#8a5a2b">${dim(r.s1 - r.s0)} section · ${P0.length} panel${P0.length === 1 ? '' : 's'} ${dim(r.RL.panelW)} × ${dim(ph)}</text>`;
  }
  // openings: doors, glass, pass-thrus; the panel over each one (header) hatched
  for (const o of wl.ops) {
    if (o.type === 'removable') continue;
    const w = n3((o.s1 - o.s0) * sc);
    s += `<rect x="${X(o.s0)}" y="${Y(WH)}" width="${w}" height="${n3((WH - o.head) * sc)}" fill="url(#hatch)" stroke="#222" stroke-width="0.01"/>`;
    if (o.sill > 0) s += `<rect x="${X(o.s0)}" y="${Y(o.sill)}" width="${w}" height="${n3(o.sill * sc)}" fill="url(#hatch)" stroke="#222" stroke-width="0.01"/>`;
    s += `<rect x="${X(o.s0)}" y="${Y(o.head)}" width="${w}" height="${n3((o.head - o.sill) * sc)}" fill="${/glass|window/.test(o.type) ? '#d9eff6' : '#f1f3f4'}" stroke="#222" stroke-width="0.016"/>`;
    if (o.type === 'door2') s += `<line x1="${X((o.s0 + o.s1) / 2)}" y1="${Y(o.head)}" x2="${X((o.s0 + o.s1) / 2)}" y2="${Y(0)}" stroke="#222" stroke-width="0.01"/>`;
    if (/glass|window/.test(o.type)) s += `<line x1="${X(o.s0 + 0.3)}" y1="${Y(o.head - 0.6)}" x2="${X(o.s0 + 1)}" y2="${Y(o.head - 0.2)}" stroke="#7aa" stroke-width="0.008"/>`;
    s += `<text x="${X((o.s0 + o.s1) / 2)}" y="${Y((o.head + o.sill) / 2)}" font-size="${tiny ? 0.07 : 0.1}" text-anchor="middle" fill="#333">${esc(o.name)}</text>`;
    if (!tiny) s += `<text x="${X((o.s0 + o.s1) / 2)}" y="${n3(Y((o.head + o.sill) / 2) + 0.13)}" font-size="0.08" text-anchor="middle" fill="#666">${dim(o.s1 - o.s0)} × ${dim(o.head - o.sill)}${o.sill > 0 ? ', ' + dim(o.sill) + ' sill' : ''}</text>`;
  }
  // grilles with louvres; damper as a heavy frame
  for (const g of wl.grilles) {
    s += `<rect x="${X(g.s0)}" y="${Y(g.sill + g.h)}" width="${n3(g.w * sc)}" height="${n3(g.h * sc)}" fill="#eef0f1" stroke="${g.damper ? '#000' : '#444'}" stroke-width="${g.damper ? 0.03 : 0.012}"/>`;
    for (let y = g.sill + 2 / 12; y < g.sill + g.h - 0.05; y += 2 / 12) s += `<line x1="${X(g.s0 + 0.05)}" y1="${Y(y)}" x2="${X(g.s1 - 0.05)}" y2="${Y(y)}" stroke="#888" stroke-width="0.006"/>`;
    s += `<text x="${X((g.s0 + g.s1) / 2)}" y="${n3(Y(g.sill + g.h) - 0.05)}" font-size="0.075" text-anchor="middle" fill="#333">${dim(g.w)}×${dim(g.h)}${g.damper ? ' D' : ''}</text>`;
  }
  for (const d of wl.boxes) s += `<rect x="${X(d.s0)}" y="${Y(d.y1)}" width="${n3(Math.max(0.03, (d.s1 - d.s0) * sc))}" height="${n3(Math.max(0.03, (d.y1 - d.y0) * sc))}" fill="#fde2c4" stroke="#a65" stroke-width="0.008"/><text x="${X(d.s1) + 0.03}" y="${Y(d.y0)}" font-size="0.065" fill="#a65">${esc(d.label)}</text>`;
  // floor line, panel widths chained under, overall over, height at the left
  s += `<line x1="${X(-0.5)}" y1="${Y(0)}" x2="${X(wl.L + 0.5)}" y2="${Y(0)}" stroke="#000" stroke-width="0.025"/>`;
  const ch = [0, ...wl.panels.map(p => p.s1)].concat(wl.ops.flatMap(o => [o.s0, o.s1])).filter((v, i, a) => a.findIndex(u => Math.abs(u - v) < 0.01) === i).sort((a, b) => a - b);
  const yd = n3(Y(0) + 0.2);
  s += `<line x1="${X(0)}" y1="${yd}" x2="${X(wl.L)}" y2="${yd}" stroke="#333" stroke-width="0.008"/>`;
  ch.forEach((v, i) => { s += `<line x1="${X(v)}" y1="${n3(yd - 0.05)}" x2="${X(v)}" y2="${n3(yd + 0.05)}" stroke="#333" stroke-width="0.01"/>`; if (i && (v - ch[i - 1]) * sc > 0.28) s += `<text x="${X((v + ch[i - 1]) / 2)}" y="${n3(yd - 0.04)}" font-size="0.075" text-anchor="middle">${dim(v - ch[i - 1])}</text>`; });
  const yo = n3(Y(WH) - 0.2);
  s += `<line x1="${X(0)}" y1="${yo}" x2="${X(wl.L)}" y2="${yo}" stroke="#333" stroke-width="0.008"/><line x1="${X(0)}" y1="${n3(yo - 0.05)}" x2="${X(0)}" y2="${n3(yo + 0.05)}" stroke="#333" stroke-width="0.01"/><line x1="${X(wl.L)}" y1="${n3(yo - 0.05)}" x2="${X(wl.L)}" y2="${n3(yo + 0.05)}" stroke="#333" stroke-width="0.01"/>
    <text x="${X(wl.L / 2)}" y="${n3(yo - 0.05)}" font-size="0.1" text-anchor="middle" font-weight="600">${dim(wl.L)}</text>`;
  const xh = n3(X(0) - 0.22);
  s += `<line x1="${xh}" y1="${Y(0)}" x2="${xh}" y2="${Y(WH)}" stroke="#333" stroke-width="0.008"/><text x="${n3(xh - 0.05)}" y="${Y(WH / 2)}" font-size="0.09" text-anchor="middle" transform="rotate(-90 ${n3(xh - 0.05)} ${Y(WH / 2)})">${dim(WH)}</text>`;
  // tag and title
  const look = Math.abs(wl.ux) > Math.abs(wl.uy) ? (wl.ux > 0 ? 'looking toward the top of the plan' : 'looking toward the bottom of the plan') : (wl.uy > 0 ? 'looking toward the right of the plan' : 'looking toward the left of the plan');
  s += `<g font-family="Segoe UI, Arial, sans-serif"><circle cx="${n3(x0 - 0.05)}" cy="${n3(yb + 0.62)}" r="0.2" fill="#fff" stroke="#c0392b" stroke-width="0.025"/><text x="${n3(x0 - 0.05)}" y="${n3(yb + 0.68)}" font-size="0.16" text-anchor="middle" font-weight="700" fill="#c0392b">${wl.tag}</text>
    <text x="${n3(x0 + 0.25)}" y="${n3(yb + 0.62)}" font-size="0.15" font-weight="700">WALL ${wl.tag} ELEVATION</text><text x="${n3(x0 + 0.25)}" y="${n3(yb + 0.8)}" font-size="0.1" fill="#555">${dim(wl.L)} long × ${dim(wl.WH)} · ${wl.panels.length} panel${wl.panels.length === 1 ? '' : 's'}</text><text x="${n3(x0 + 0.25)}" y="${n3(yb + 0.95)}" font-size="0.09" fill="#777">${look}, start on the left</text></g>`;
  return s;
}

function sheets(plan, info) {
  const W = walls(plan); if (!W.walls.length) return { W, pages: [], rows: [] };
  const maxL = Math.max(...W.walls.map(w => w.L)), WH = W.walls[0].WH, availW = PW - 2 * M - 0.9, availH = PH - 2 * M - TB - 0.65;
  let pick = SCALES[SCALES.length - 1];
  for (const S of SCALES) { if (maxL * S[0] <= availW && (WH * S[0] + 1.55) * 2 <= availH) { pick = S; break; } }
  const sc = pick[0], strip = WH * sc + 1.55, perPage = Math.max(1, Math.floor(availH / strip));
  const defs = `<defs><pattern id="hatch" width="0.08" height="0.08" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="0.08" stroke="#999" stroke-width="0.008"/></pattern></defs>`;
  const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}in" height="${PH}in" viewBox="0 0 ${PW} ${PH}" font-family="Segoe UI, Arial, sans-serif">${defs}<rect x="0" y="0" width="${PW}" height="${PH}" fill="#fff"/><rect x="${M}" y="${M}" width="${PW - 2 * M}" height="${PH - 2 * M}" fill="none" stroke="#111" stroke-width="0.03"/>${body}</svg>`;
  const pages = [];
  // F-0: key plan
  pages.push(svg(`<text x="${M + 0.3}" y="${M + 0.5}" font-size="0.26" font-weight="700">WALL KEY PLAN</text><text x="${M + 0.3}" y="${M + 0.75}" font-size="0.13" fill="#555">Each tag sits on the side its elevation looks from. Panels are numbered from the start of each wall.</text>${keyPlan(W, { x: M + 0.4, y: M + 1, w: PW - 2 * M - 0.8, h: PH - 2 * M - TB - 1.3 })}${titleBlock(info, 'F-0', 'Key plan')}`));
  // short walls share a row, side by side, as many as fit across the sheet (each needs room for its title)
  const rowsOf = []; let cur = [], used = 0;
  for (const wl of W.walls) { const need = Math.max(wl.L * sc, 3.6) + 1.1; if (cur.length && used + need > availW + 0.9) { rowsOf.push(cur); cur = []; used = 0; } cur.push(wl); used += need; }
  if (cur.length) rowsOf.push(cur);
  for (let i = 0; i < rowsOf.length; i += perPage) {
    const grp = rowsOf.slice(i, i + perPage); let body = '', y = M + 0.85;
    for (const row of grp) { y += WH * sc + 0.15; let x = M + 0.85; for (const wl of row) { body += elevation(wl, x, y, sc); x += Math.max(wl.L * sc, 3.6) + 1.1; } y += 1.4; }
    pages.push(svg(body + `<text x="${PW - M - 0.2}" y="${PH - M - TB - 0.15}" font-size="0.12" text-anchor="end" fill="#555">Scale ${pick[1]}</text>` + titleBlock(info, 'F-' + pages.length, grp.flat().map(w => w.tag).join(', '))));
  }
  return { W, pages, rows: cutList(W), scale: pick[1] };
}

function html(plan, info) {
  const S = sheets(plan, info);
  const rows = S.rows, perPage = 30, cut = [];
  for (let i = 0; i < rows.length; i += perPage) cut.push(rows.slice(i, i + perPage));
  const sizes = new Map(); for (const r of rows) { const k = r.type.replace(/ \((upper|lower)\)/, '') + ' ' + dim(r.w) + ' × ' + dim(r.h); sizes.set(k, (sizes.get(k) || 0) + 1); }
  const cutPages = cut.map((c, k) => `<section class="cl"><h2>Cut list${cut.length > 1 ? ` (${k + 1} of ${cut.length})` : ''}</h2>
    <table><thead><tr><th>Panel</th><th>Type</th><th>Width</th><th>Height</th><th>Cut-outs (from the panel's left edge and bottom, seen as on the elevation)</th></tr></thead><tbody>
    ${c.map(r => `<tr${r.cuts.length ? ' class="has"' : ''}><td><b>${esc(r.id)}</b></td><td>${esc(r.type)}</td><td>${dim(r.w)}</td><td>${dim(r.h)}</td><td>${r.cuts.length ? r.cuts.map(esc).join('<br>') : '—'}</td></tr>`).join('')}
    </tbody></table>${k === cut.length - 1 ? `<h2>Panels by size</h2><table class="sz"><tbody>${[...sizes].sort().map(([k2, n]) => `<tr><td>${esc(k2)}</td><td>${n}</td></tr>`).join('')}</tbody></table>` : ''}
    <footer>${esc(info.company || 'Coll Business Solutions LLC')} · ${esc(info.project)} · ${esc(info.date)}</footer></section>`).join('');
  // crate list: panels packed wall by wall (so a crate opens next to the wall it builds), up to 16 panels or
  // 1,800 lb a crate; weights at about 3.2 lb per sq ft of panel
  const D = global.Plan3DDocs, CR = D ? D.crates(rows) : [];
  const crPages = [];
  for (let i = 0; i < CR.length; i += 8) {
    const grp = CR.slice(i, i + 8);
    crPages.push(`<section class="cl"><h2>Crate and packing list${CR.length > 8 ? ` (${i / 8 + 1} of ${Math.ceil(CR.length / 8)})` : ''}</h2>
    <table><thead><tr><th>Crate</th><th>Walls</th><th>Panels (in the order they go up)</th><th>Count</th><th>Longest</th><th>Weight, about</th></tr></thead><tbody>
    ${grp.map(c => `<tr><td><b>C-${String(c.n).padStart(2, '0')}</b></td><td>${esc([...c.walls].join(', '))}</td><td>${c.items.map(r => esc(r.id)).join(', ')}</td><td>${c.items.length}</td><td>${dim(c.maxH)}</td><td>${Math.round(c.lb).toLocaleString()} lb</td></tr>`).join('')}
    </tbody></table>${i + 8 >= CR.length ? `<p style="margin-top:14px;font-size:10pt"><b>${CR.length} crates · ${rows.length} panels · about ${Math.round(CR.reduce((t, c) => t + c.lb, 0)).toLocaleString()} lb of panels.</b> Mark each crate with its number, the project and the walls it holds. Panel numbers match the elevations and the cut list.</p>` : ''}
    <footer>${esc(info.company || 'Coll Business Solutions LLC')} · ${esc(info.project)} · ${esc(info.date)}</footer></section>`);
  }
  return { S, crates: CR, html: `<!doctype html><html><head><meta charset="utf-8"><title>${esc(info.project)} fabrication sheets</title><style>
@page{size:17in 11in;margin:0}html,body{margin:0;padding:0;background:#fff;font-family:"Segoe UI",Arial,sans-serif;color:#111}
svg{display:block;page-break-after:always}
.cl{width:17in;height:11in;box-sizing:border-box;padding:.6in .7in;page-break-after:always;position:relative}.cl:last-child{page-break-after:auto}
.cl h2{font-size:18pt;margin:0 0 10px}.cl table{width:100%;border-collapse:collapse;font-size:9.5pt}.cl th{text-align:left;border-bottom:2px solid #111;padding:4px 6px;font-size:8pt;text-transform:uppercase;letter-spacing:.05em;color:#444}
.cl td{border-bottom:1px solid #ddd;padding:4px 6px;vertical-align:top}.cl tr.has td{background:#fffbea}.cl table.sz{width:auto;margin-top:6px}.cl table.sz td{padding:2px 14px 2px 0}
.cl footer{position:absolute;left:.7in;right:.7in;bottom:.4in;font-size:8pt;color:#777;border-top:1px solid #ddd;padding-top:5px}
</style></head><body>${S.pages.join('')}${cutPages}${crPages.join('')}</body></html>` };
}

global.Plan3DFab = { walls, cutList, sheets, html };
})(window);
