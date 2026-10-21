/* Coll Plan3D — snap-together pieces.
   PieceLogic: snapping + placement (no drawing), shared by the 3D Build tab and the 2D Plan tab.
   Palette:    the piece picker UI, used in both places.
   Builder:    the 3D Build tab.
   Every piece is stored in the same plan the 2D editor and walkthrough use.
   Plan units are feet; plan (x, y) = 3D (x, z). Coll Business Solutions LLC */
(function (global) {
'use strict';
const { fmtIn, parseLen, uid } = global.Plan3DEditor;
const V = global.Plan3DViewer;

const IN = 1 / 12;
const PIECES = {
  panel: { label: 'Panel', group: 'wall', widths: true },
  sp:    { label: 'S.P. panel', group: 'wall', widths: true },
  glass: { label: 'Glass panel', group: 'wall', widths: true, op: 'glass' },
  door:  { label: 'Door 3070', group: 'wall', w: 44 * IN, op: 'door', opW: 3 },
  door2: { label: 'Pair 6070', group: 'wall', w: 80.5 * IN, op: 'door2', opW: 6 },
  pass:  { label: 'Pass-thru', group: 'wall', w: 4, op: 'pass', opW: 2 },
  chase: { label: 'Air chase', group: 'chase' },
  led:   { label: 'LED light', group: 'fixture' },
  ffu:   { label: 'Fan filter unit', group: 'fixture' }
};
const NUM_KEYS = { 1: 'panel', 2: 'sp', 3: 'glass', 4: 'door', 5: 'door2', 6: 'pass', 7: 'chase', 8: 'led', 9: 'ffu' };
const ICONS = {
  select: '<path d="M5 3l14 8-6 1.6L10 19z"/>',
  panel: '<rect x="6" y="3" width="12" height="18" fill="none"/><path d="M12 3v18" fill="none" stroke-dasharray="2 2"/>',
  sp: '<rect x="6" y="3" width="12" height="18"/>',
  glass: '<rect x="6" y="3" width="12" height="18" fill="none"/><rect x="8.5" y="7" width="7" height="8" fill="none"/>',
  door: '<rect x="5" y="3" width="14" height="18" fill="none"/><rect x="8" y="6" width="8" height="15" fill="none"/>',
  door2: '<rect x="3" y="3" width="18" height="18" fill="none"/><path d="M12 6v15M6 6h12v15" fill="none"/>',
  pass: '<rect x="5" y="5" width="14" height="14" fill="none"/><path d="M5 5l14 14M19 5L5 19" fill="none"/>',
  chase: '<rect x="5" y="4" width="14" height="16" fill="none"/><path d="M5 10l6-6M5 16l12-12M9 20l10-10" fill="none"/>',
  led: '<rect x="8" y="3" width="8" height="18" fill="none"/><path d="M10 6v12M14 6v12" fill="none"/>',
  ffu: '<rect x="8" y="3" width="8" height="18" fill="none"/><path d="M10 6h1M13 6h1M10 9h1M13 9h1M10 12h1M13 12h1M10 15h1M13 15h1" fill="none"/>'
};
const HINT = {
  select: 'Click a piece to select it. Delete removes it.',
  wall: 'Click to place. Pieces snap to open ends and turn the corner toward the mouse. Click beside the middle of a wall to start a T. R turns a free piece.',
  unit: 'Click a panel to swap this piece in, or click an open end to add it to the run.',
  chase: 'Click to place. Chases sit flush against the nearest wall face. R turns it.',
  fixture: 'Click a ceiling grid cell to place. Click the same kind again to remove it.'
};
const hintFor = (t) => t === 'select' ? HINT.select : PIECES[t].group === 'wall' ? (PIECES[t].op && !PIECES[t].widths ? HINT.unit : HINT.wall) : HINT[PIECES[t].group];

/* ================= PieceLogic ================= */
class PieceLogic {
  constructor(ed) {
    this.ed = ed; this.tool = 'panel'; this.width = 4; this.rot = 0;
    this.chaseW = 4; this.chaseD = 15.25 * IN;
    this.onFlash = null;
  }
  get A() {
    const key = this.ed.hist.length + ':' + this.ed.fut.length + ':' + this.ed.plan.walls.length + ':' + this.ed.plan.chases.length;
    if (this._ak !== key || this._ap !== this.ed.plan) { this._a = V.analyze(this.ed.plan); this._ak = key; this._ap = this.ed.plan; }
    return this._a;
  }
  pieceLen(t) { const P = PIECES[t]; return P.widths ? this.width : P.w; }
  wallT() { return this.ed.plan.wallT || 0.25; }
  group() { return this.tool === 'select' ? 'select' : PIECES[this.tool].group; }

  // Wall pieces: open end → T off a wall → free on a 1″ grid
  snapWall(P, L) {
    const walls = this.ed.plan.walls, T = this.wallT();
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let best = null, bd = 3.0;
    for (const w of walls) {
      for (const [E, O] of [[{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }], [{ x: w.x2, y: w.y2 }, { x: w.x1, y: w.y1 }]]) {
        const d = dist(P, E); if (d < bd) { bd = d; best = { E, O }; }
      }
    }
    if (best) {
      const { E, O } = best, len = dist(E, O) || 1, u = { x: (E.x - O.x) / len, y: (E.y - O.y) / len }, n = { x: -u.y, y: u.x };
      const cand = [u, n, { x: -n.x, y: -n.y }];
      const taken = (d) => walls.some(w => {
        for (const [A, B] of [[{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }], [{ x: w.x2, y: w.y2 }, { x: w.x1, y: w.y1 }]]) {
          if (dist(A, E) < 0.03) { const l = dist(A, B) || 1; if (((B.x - A.x) / l) * d.x + ((B.y - A.y) / l) * d.y > 0.99) return true; }
        }
        return false;
      });
      const free = cand.filter(d => !taken(d));
      if (free.length) {
        const v = { x: P.x - E.x, y: P.y - E.y }, vl = Math.hypot(v.x, v.y);
        let dir = free[0];
        if (vl > 0.35) { let bs = -2; for (const d of free) { const s = (v.x * d.x + v.y * d.y) / vl; if (s > bs) { bs = s; dir = d; } } }
        return { x1: E.x, y1: E.y, x2: E.x + dir.x * L, y2: E.y + dir.y * L, mode: 'end' };
      }
    }
    let tb = null, td = 1.4;
    for (const w of walls) {
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (len < 0.5) continue;
      const ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len;
      const s = (P.x - w.x1) * ux + (P.y - w.y1) * uy, d = Math.abs((P.x - w.x1) * (-uy) + (P.y - w.y1) * ux);
      if (s > 0.25 && s < len - 0.25 && d < td && d > T / 2 + 0.05) { td = d; tb = { w, s, len, ux, uy, side: Math.sign((P.x - w.x1) * (-uy) + (P.y - w.y1) * ux) }; }
    }
    if (tb) {
      let s = tb.w.piece ? tb.s : (Math.abs(tb.s - Math.round(tb.s / 4) * 4) < 0.6 ? Math.round(tb.s / 4) * 4 : Math.round(tb.s * 12) / 12);
      s = Math.max(0.25, Math.min(tb.len - 0.25, s));
      const sx = tb.w.x1 + tb.ux * s, sy = tb.w.y1 + tb.uy * s, nx = -tb.uy * tb.side, ny = tb.ux * tb.side;
      return { x1: sx, y1: sy, x2: sx + nx * L, y2: sy + ny * L, mode: 't' };
    }
    const g = 1 / 12, sx = Math.round(P.x / g) * g, sy = Math.round(P.y / g) * g;
    const D = [[1, 0], [0, 1], [-1, 0], [0, -1]][this.rot % 4];
    return { x1: sx, y1: sy, x2: sx + D[0] * L, y2: sy + D[1] * L, mode: 'free' };
  }
  blocked(s) {
    const T = this.wallT(), L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    for (const w of this.ed.plan.walls) {
      const wl = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (wl < 0.01) continue;
      const ux = (w.x2 - w.x1) / wl, uy = (w.y2 - w.y1) / wl;
      const perp = (x, y) => Math.abs((x - w.x1) * (-uy) + (y - w.y1) * ux);
      if (perp(s.x1, s.y1) < T * 0.6 && perp(s.x2, s.y2) < T * 0.6) {
        const a = (s.x1 - w.x1) * ux + (s.y1 - w.y1) * uy, b = (s.x2 - w.x1) * ux + (s.y2 - w.y1) * uy;
        if (Math.min(Math.max(a, b), wl) - Math.max(Math.min(a, b), 0) > 0.05) return true;
      }
      const d1x = s.x2 - s.x1, d1y = s.y2 - s.y1, d2x = w.x2 - w.x1, d2y = w.y2 - w.y1, den = d1x * d2y - d1y * d2x;
      if (Math.abs(den) > 1e-9) {
        const t = ((w.x1 - s.x1) * d2y - (w.y1 - s.y1) * d2x) / den, u = ((w.x1 - s.x1) * d1y - (w.y1 - s.y1) * d1x) / den;
        if (t > 0.02 / L + 1e-6 && t < 1 - 0.02 / L && u > 0.001 && u < 0.999) return true;
      }
    }
    return false;
  }
  snapReplace(P, tool) {
    const T = this.wallT(), op = PIECES[tool].op;
    let best = null, bd = 1e9;
    for (const w of this.ed.plan.walls) {
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (len < 1) continue;
      const ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len;
      const s = (P.x - w.x1) * ux + (P.y - w.y1) * uy, d = Math.abs((P.x - w.x1) * (-uy) + (P.y - w.y1) * ux);
      if (s > 0.15 && s < len - 0.15 && d < T / 2 + 0.6 && d < bd) { bd = d; best = { w, s, len, ux, uy }; }
    }
    if (!best) return null;
    const { w, len, ux, uy } = best;
    let ow, c;
    if (w.piece) {
      ow = op === 'glass' ? len : PIECES[tool].opW; c = len / 2;
      if (op !== 'glass' && ow > len - (op === 'pass' ? 0 : 2 / 12) + 1e-6) return { w, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, mode: 'replace', bad: true, why: `A ${PIECES[tool].label} needs a panel at least ${fmtIn(op === 'pass' ? ow : ow + 2 / 12)} wide. This one is ${fmtIn(len)}.` };
    }
    else { ow = op === 'glass' ? Math.min(4, len) : Math.min(PIECES[tool].opW, len); c = Math.max(ow / 2, Math.min(len - ow / 2, Math.round(best.s * 12) / 12)); }
    return { w, x1: w.x1 + ux * (c - ow / 2), y1: w.y1 + uy * (c - ow / 2), x2: w.x1 + ux * (c + ow / 2), y2: w.y1 + uy * (c + ow / 2), mode: 'replace' };
  }
  snapChase(P) {
    const W0 = this.rot % 2 ? this.chaseD : this.chaseW, D0 = this.rot % 2 ? this.chaseW : this.chaseD;
    let best = null, bd = 2.5;
    for (const w of this.ed.plan.walls) {
      const T = (w.t || 0.25) / 2, horiz = Math.abs(w.y2 - w.y1) < 1e-3, vert = Math.abs(w.x2 - w.x1) < 1e-3;
      if (horiz) { const lo = Math.min(w.x1, w.x2), hi = Math.max(w.x1, w.x2); if (P.x > lo && P.x < hi) { const d = Math.abs(P.y - w.y1); if (d < bd) { bd = d; best = { horiz: true, w, T, lo, hi, side: P.y > w.y1 ? 1 : -1 }; } } }
      if (vert) { const lo = Math.min(w.y1, w.y2), hi = Math.max(w.y1, w.y2); if (P.y > lo && P.y < hi) { const d = Math.abs(P.x - w.x1); if (d < bd) { bd = d; best = { horiz: false, w, T, lo, hi, side: P.x > w.x1 ? 1 : -1 }; } } }
    }
    const g = 1 / 12, r = (v) => Math.round(v / g) * g, W = this.chaseW, D = this.chaseD;
    if (best && best.horiz) {
      const x0 = Math.max(best.lo, Math.min(best.hi - W, r(P.x - W / 2)));
      const y0 = best.side > 0 ? best.w.y1 + best.T : best.w.y1 - best.T - D;
      return { x0, x1: x0 + W, y0, y1: y0 + D, grille: best.side > 0 ? 'S' : 'N', mode: 'flush' };
    }
    if (best) {
      const y0 = Math.max(best.lo, Math.min(best.hi - W, r(P.y - W / 2)));
      const x0 = best.side > 0 ? best.w.x1 + best.T : best.w.x1 - best.T - D;
      return { x0, x1: x0 + D, y0, y1: y0 + W, grille: best.side > 0 ? 'E' : 'W', mode: 'flush' };
    }
    const x0 = r(P.x - W0 / 2), y0 = r(P.y - D0 / 2);
    return { x0, x1: x0 + W0, y0, y1: y0 + D0, grille: '', mode: 'free' };
  }
  fixtureCell(P) {
    const A = this.A, b = A.bounds, ox = A.empty ? 0 : b.minX, oy = A.empty ? 0 : b.minZ;
    const x0 = ox + Math.floor((P.x - ox) / 2) * 2, y0 = oy + Math.floor((P.y - oy) / 4) * 4;
    return { x: x0 + 1, y: y0 + 2, mode: 'cell' };
  }
  // Near a wall end that nothing else connects to (an open end of a run)
  nearEnd(P) {
    const walls = this.ed.plan.walls, ends = [];
    walls.forEach(w => { ends.push([w.x1, w.y1], [w.x2, w.y2]); });
    return ends.some(([x, y]) => Math.hypot(P.x - x, P.y - y) < 1.2 && ends.filter(([a, b]) => Math.hypot(a - x, b - y) < 0.03).length === 1);
  }
  // What clicking at plan point P would do, for the current tool
  ghostAt(P) {
    const P0 = PIECES[this.tool]; if (!P0) return null;
    let info = null;
    if (P0.group === 'wall') {
      if (P0.op) info = this.snapReplace(P, this.tool);
      if (info && this.nearEnd(P)) info = null;
      if (!info) { info = this.snapWall(P, this.pieceLen(this.tool)); info.bad = this.blocked(info); }
    } else if (P0.group === 'chase') info = this.snapChase(P);
    else info = this.fixtureCell(P);
    info.tool = this.tool;
    return info;
  }
  label(info) {
    const P0 = PIECES[info.tool];
    if (P0.group === 'wall') {
      const len = Math.hypot(info.x2 - info.x1, info.y2 - info.y1);
      if (info.why) return 'Too narrow for ' + P0.label;
      return (info.mode === 'replace' ? 'Swap in ' + P0.label : P0.label + ' ' + fmtIn(len)) + (info.mode === 't' ? ' · T-joint' : info.mode === 'end' ? ' · snapped' : '');
    }
    if (P0.group === 'chase') return 'Air chase ' + fmtIn(info.x1 - info.x0) + ' × ' + fmtIn(info.y1 - info.y0) + (info.mode === 'flush' ? ' · flush to wall' : '');
    return P0.label;
  }
  makeOpening(type, s, t, wallId) {
    const o = { id: uid(), type, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, t, swing: 1, unit: wallId };
    if (type === 'glass') { o.sill = 3; o.head = 7; } else if (type === 'pass') { o.sill = 3; o.head = 5; o.depth = 2; } else o.head = 7;
    return o;
  }
  // Apply a ghost to the plan. Returns false if it can't be placed.
  place(I) {
    const ed = this.ed, tool = I.tool, P0 = PIECES[tool], T = this.wallT();
    if (I.bad) { if (this.onFlash) this.onFlash(I.why || 'That spot overlaps another wall.'); return false; }
    if (P0.group === 'wall' && I.mode === 'replace') {
      ed.edit(Pl => {
        const w = Pl.walls.find(x => x.id === I.w.id); if (!w) return;
        const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
        const pr = (x, y) => (x - w.x1) * ux + (y - w.y1) * uy, pd = (x, y) => Math.abs((x - w.x1) * (-uy) + (y - w.y1) * ux);
        const c = Math.min(pr(I.x1, I.y1), pr(I.x2, I.y2)), d = Math.max(pr(I.x1, I.y1), pr(I.x2, I.y2));
        Pl.openings = Pl.openings.filter(o => {
          if (pd(o.x1, o.y1) > T || pd(o.x2, o.y2) > T) return true;
          const a = Math.min(pr(o.x1, o.y1), pr(o.x2, o.y2)), b = Math.max(pr(o.x1, o.y1), pr(o.x2, o.y2));
          return !(Math.min(b, d) - Math.max(a, c) > 0.02);
        });
        Pl.openings.push(this.makeOpening(P0.op, I, w.t || T, w.id));
        if (w.piece) { w.piece = tool; w.sp = false; }
      });
      return true;
    }
    if (P0.group === 'wall') {
      const w = { id: uid(), x1: I.x1, y1: I.y1, x2: I.x2, y2: I.y2, t: T, sp: tool === 'sp', piece: tool };
      ed.edit(Pl => {
        Pl.walls.push(w);
        if (P0.op) {
          const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ow = P0.op === 'glass' ? L : Math.min(P0.opW, L), s0 = (L - ow) / 2;
          const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
          Pl.openings.push(this.makeOpening(P0.op, { x1: w.x1 + ux * s0, y1: w.y1 + uy * s0, x2: w.x1 + ux * (s0 + ow), y2: w.y1 + uy * (s0 + ow) }, T, w.id));
        }
      });
      return true;
    }
    if (P0.group === 'chase') {
      const k = { id: uid(), x0: I.x0, y0: I.y0, x1: I.x1, y1: I.y1, grille: I.grille || ed.autoGrille(I) };
      ed.edit(Pl => Pl.chases.push(k)); return true;
    }
    ed.edit(Pl => {
      if (Pl.ceilingMode !== 'manual') { Pl.fixtures = V.ceilingFixtures(Pl).map(f => ({ id: uid(), type: f.type, x: f.x, y: f.y })); Pl.ceilingMode = 'manual'; }
      const hit = Pl.fixtures.find(f => Math.abs(f.x - I.x) < 0.5 && Math.abs(f.y - I.y) < 1);
      Pl.fixtures = Pl.fixtures.filter(f => f !== hit);
      if (!hit || hit.type !== tool) Pl.fixtures.push({ id: uid(), type: tool, x: I.x, y: I.y });
    });
    return true;
  }
}

/* ================= Palette ================= */
class Palette {
  // logic: a PieceLogic; opts: { select: bool, ceilToggle: bool, layout: 'column'|'row', onTool(t), onCeil(bool) }
  constructor(el, logic, opts) {
    this.el = el; this.L = logic; this.o = opts || {};
    const btn = (t, label, key) => `<button type="button" class="bd-tool" data-t="${t}" title="${PIECES[t] ? PIECES[t].label : 'Select'} (${key})"><svg viewBox="0 0 24 24">${ICONS[t]}</svg><span>${label}</span><kbd>${key}</kbd></button>`;
    el.classList.add('bd-pal'); if (this.o.layout === 'row') el.classList.add('row');
    el.innerHTML = `
      ${this.o.select ? `<div class="bd-sec">Tool</div><div class="bd-grid">${btn('select', 'Select', 'V')}</div>` : ''}
      <div class="bd-blk"><div class="bd-sec">Walls</div>
      <div class="bd-grid">${btn('panel', 'Panel', '1')}${btn('sp', 'S.P.', '2')}${btn('glass', 'Glass', '3')}</div></div>
      <div class="bd-blk"><div class="bd-sec">Doors &amp; pass-thrus</div>
      <div class="bd-grid">${btn('door', '3070', '4')}${btn('door2', '6070', '5')}${btn('pass', 'Pass-thru', '6')}</div></div>
      <div class="bd-blk"><div class="bd-sec">Air &amp; ceiling</div>
      <div class="bd-grid">${btn('chase', 'Chase', '7')}${btn('led', 'LED', '8')}${btn('ffu', 'FFU', '9')}</div></div>
      <div class="bd-widths" data-k="widths">
        <div class="bd-lbl">Panel width</div>
        <div class="bd-chips">${[24, 36, 48].map(w => `<button type="button" data-w="${w}">${w}″</button>`).join('')}</div>
        <input type="text" data-k="w" spellcheck="false" aria-label="Custom panel width" placeholder="Custom, e.g. 19-1/2">
      </div>
      <div class="bd-widths" data-k="chase" hidden>
        <div class="bd-lbl">Chase size</div>
        <div class="bd-two"><input type="text" data-k="cw" spellcheck="false" aria-label="Chase width"><span>×</span><input type="text" data-k="cd" spellcheck="false" aria-label="Chase depth"></div>
      </div>
      ${this.o.ceilToggle ? '<label class="bd-chk"><input type="checkbox" data-k="ceil" checked> Show ceiling items</label>' : ''}`;
    const $ = (s) => el.querySelector(s);
    el.querySelectorAll('.bd-tool').forEach(b => b.addEventListener('click', () => this.setTool(b.dataset.t)));
    el.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => { this.L.width = +b.dataset.w * IN; $('[data-k=w]').value = ''; if (PIECES[this.L.tool] && !PIECES[this.L.tool].widths) this.setTool('panel'); else this.sync(); }));
    const wIn = $('[data-k=w]');
    const setW = () => { const v = parseLen(wIn.value, 'in'); if (v > 1 / 12 && v < 20) { this.L.width = v; wIn.style.borderColor = ''; this.sync(); } else if (wIn.value.trim()) wIn.style.borderColor = 'var(--warn)'; };
    wIn.addEventListener('change', setW); wIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { setW(); wIn.blur(); } });
    const cw = $('[data-k=cw]'), cd = $('[data-k=cd]');
    cw.value = fmtIn(this.L.chaseW); cd.value = fmtIn(this.L.chaseD);
    const setC = () => { const a = parseLen(cw.value, 'in'), b = parseLen(cd.value, 'in'); if (a > 0.3) this.L.chaseW = a; if (b > 0.3) this.L.chaseD = b; cw.value = fmtIn(this.L.chaseW); cd.value = fmtIn(this.L.chaseD); };
    [cw, cd].forEach(i => { i.addEventListener('change', setC); i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { setC(); i.blur(); } }); });
    const ce = $('[data-k=ceil]'); if (ce) ce.addEventListener('change', e => this.o.onCeil && this.o.onCeil(e.target.checked));
    this.sync();
  }
  setTool(t) { this.L.tool = t; this.sync(); if (this.o.onTool) this.o.onTool(t); }
  sync() {
    const t = this.L.tool, P = PIECES[t];
    this.el.querySelectorAll('.bd-tool').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    this.el.querySelector('[data-k=widths]').hidden = !!(P && !P.widths && this.o.layout !== 'row') || t === 'select';
    this.el.querySelector('[data-k=chase]').hidden = t !== 'chase';
    if (this.o.layout === 'row' && t === 'chase') this.el.querySelector('[data-k=widths]').hidden = true;
    this.el.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.w * IN - this.L.width) < 1e-6));
  }
}

/* ================= Builder (3D Build tab) ================= */
class Builder {
  constructor(host, ed, opts) {
    this.host = host; this.ed = ed; this.o = opts || {};
    this.L = new PieceLogic(ed); this.L.onFlash = (m) => this.flash(m);
    this.showCeil = true; this.ghostInfo = null;
    host.innerHTML = `<canvas class="bd-c" tabindex="0" aria-label="3D build area"></canvas><div class="bd-palwrap"></div><div class="bd-hint"></div><div class="bd-tag" hidden></div>`;
    this.canvas = host.querySelector('.bd-c'); this.hintEl = host.querySelector('.bd-hint'); this.tagEl = host.querySelector('.bd-tag');
    this.pal = new Palette(host.querySelector('.bd-palwrap'), this.L, {
      select: true, ceilToggle: true,
      onTool: (t) => this.setTool(t, true),
      onCeil: (on) => { this.showCeil = on; if (this.built) this.built.fixtures.visible = on; }
    });
    this.three();
    this.refresh(true);
    this.setTool('panel');
  }
  get tool() { return this.L.tool; }
  setTool(t, fromPal) {
    this.L.tool = t; if (!fromPal) this.pal.sync();
    this.ghostInfo = null; if (this.ghost) this.ghost.visible = false; this.tagEl.hidden = true;
    if (t !== 'select') { this.ed.sel = null; this.ed.emit('select'); this.drawSel(); }
    this.hintEl.textContent = hintFor(t) + (t === 'select' ? ' Drag to orbit, right-drag to pan, wheel to zoom.' : '');
    this.canvas.focus();
  }
  three() {
    const T = global.THREE;
    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
    this.scene = new T.Scene(); this.scene.background = new T.Color(0x1d2427);
    this.camera = new T.PerspectiveCamera(45, 1, 0.1, 1200);
    const sc = this.scene;
    sc.add(new T.HemisphereLight(0xffffff, 0xb0b6b9, 0.64)); sc.add(new T.AmbientLight(0xffffff, 0.17));
    const sun = new T.DirectionalLight(0xffffff, 0.58); sun.position.set(-50, 80, 35); sc.add(sun);
    const fill = new T.DirectionalLight(0xf2f6ff, 0.24); fill.position.set(70, 50, -50); sc.add(fill);
    const grid = new T.GridHelper(400, 100, 0x3a454b, 0x2b3439); grid.position.y = -0.01; sc.add(grid);
    this.controls = new T.OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.1; this.controls.maxPolarAngle = 1.5; this.controls.minDistance = 4; this.controls.maxDistance = 500;
    this.controls.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN };
    this.ghostMat = new T.MeshBasicMaterial({ color: 0xf2c84b, transparent: true, opacity: 0.42, depthWrite: false });
    this.ghost = new T.Mesh(new T.BoxGeometry(1, 1, 1), this.ghostMat); this.ghost.visible = false; this.ghost.renderOrder = 5; sc.add(this.ghost);
    this.ghostEdges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), new T.LineBasicMaterial({ color: 0xf2c84b })); this.ghost.add(this.ghostEdges);
    this.selHelper = new T.Box3Helper(new T.Box3(), 0xf2c84b); this.selHelper.visible = false; sc.add(this.selHelper);
    this.ray = new T.Raycaster(); this.ndc = new T.Vector2();
    const c = this.canvas; let down = null;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, b: e.button }; c.focus(); });
    c.addEventListener('pointermove', e => { if (!e.buttons) this.hover(e); });
    c.addEventListener('pointerup', e => { if (down && down.b === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) this.click(e); down = null; });
    c.addEventListener('pointerleave', () => { this.ghost.visible = false; this.tagEl.hidden = true; });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.host);
    const loop = () => { this.raf = requestAnimationFrame(loop); if (!this.host.offsetParent) return; this.controls.update(); this.renderer.render(this.scene, this.camera); };
    loop();
  }
  resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  frame() {
    const A = this.A, b = A.bounds, T = global.THREE;
    const span = A.empty ? 40 : Math.max(b.w, b.d, 16);
    const target = A.empty ? new T.Vector3(0, 0, 0) : new T.Vector3(b.cx, 0, b.cz);
    this.controls.target.copy(target);
    this.camera.position.set(target.x - span * 0.55, span * 0.95, target.z + span * 0.95);
    this.controls.update();
  }
  refresh(first) {
    const T = global.THREE;
    this.A = V.analyze(this.ed.plan);
    if (this.built) { this.scene.remove(this.built.root); this.built.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    this.built = V.buildScene(T, this.ed.plan, this.A);
    this.built.ceilPlane.visible = false;
    this.built.fixtures.visible = this.showCeil;
    this.built.ground.visible = false;
    if (this.A.empty) this.built.floor.visible = false;
    this.scene.add(this.built.root);
    if (first) { this.resize(); this.frame(); }
    this.drawSel();
  }
  rayAt(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray;
  }
  planeHit(e, y) {
    const T = global.THREE, p = new T.Vector3();
    return this.rayAt(e).ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -y), p) ? { x: p.x, y: p.z } : null;
  }
  pickRef(e) {
    const objs = [];
    this.built.root.traverse(o => { if (o.isMesh && o.userData.ref && o.visible && o.parent.visible) objs.push(o); });
    const hit = this.rayAt(e).intersectObjects(objs, false)[0];
    return hit ? hit.object.userData.ref : null;
  }
  drawSel() {
    const s = this.ed.sel;
    if (!s || !this.built) { this.selHelper.visible = false; return; }
    const T = global.THREE, box = new T.Box3(); let any = false;
    this.built.root.traverse(o => { if (o.isMesh && o.userData.ref && o.userData.ref.kind === s.kind && o.userData.ref.id === s.id) { box.expandByObject(o); any = true; } });
    if (any) { this.selHelper.box.copy(box.expandByScalar(0.05)); this.selHelper.visible = true; } else this.selHelper.visible = false;
  }
  hover(e) {
    this._lastMove = { clientX: e.clientX, clientY: e.clientY };
    if (this.tool === 'select') { this.ghost.visible = false; return; }
    const P0 = PIECES[this.tool], H = this.A.H;
    const P = this.planeHit(e, P0.group === 'fixture' ? H : 0); if (!P) { this.ghost.visible = false; return; }
    const info = this.L.ghostAt(P), g = this.ghost;
    if (P0.group === 'wall') {
      const len = Math.hypot(info.x2 - info.x1, info.y2 - info.y1), t = this.L.wallT() + 0.08, rep = info.mode === 'replace';
      const y0 = rep && P0.op === 'pass' ? 3 : 0, y1 = rep ? (P0.op === 'pass' ? 5 : P0.op === 'glass' ? H : 7) : H;
      g.scale.set(len, y1 - y0, rep ? t + 0.15 : t);
      g.position.set((info.x1 + info.x2) / 2, (y0 + y1) / 2, (info.y1 + info.y2) / 2);
      g.rotation.set(0, Math.atan2(-(info.y2 - info.y1), info.x2 - info.x1), 0);
    } else if (P0.group === 'chase') {
      g.scale.set(info.x1 - info.x0, H, info.y1 - info.y0); g.rotation.set(0, 0, 0);
      g.position.set((info.x0 + info.x1) / 2, H / 2, (info.y0 + info.y1) / 2);
    } else {
      g.scale.set(1.9, 0.12, 3.9); g.rotation.set(0, 0, 0); g.position.set(info.x, H - 0.06, info.y);
    }
    const col = info.bad ? 0xff6a4d : 0xf2c84b; this.ghostMat.color.set(col); this.ghostEdges.material.color.set(col);
    g.visible = true; this.ghostInfo = info;
    const r = this.host.getBoundingClientRect();
    this.tagEl.textContent = this.L.label(info); this.tagEl.hidden = false;
    this.tagEl.style.transform = `translate(${e.clientX - r.left + 16}px, ${e.clientY - r.top + 14}px)`;
  }
  click(e) {
    if (this.tool === 'select') {
      const ref = this.pickRef(e);
      this.ed.sel = ref ? { kind: ref.kind, id: ref.id } : null; this.ed.emit('select'); this.drawSel(); return;
    }
    this.hover(e);
    if (this.ghostInfo && this.L.place(this.ghostInfo)) this.ghost.visible = false;
  }
  flash(text) { this.hintEl.textContent = text; this.hintEl.classList.add('warn'); clearTimeout(this._fl); this._fl = setTimeout(() => { this.hintEl.classList.remove('warn'); this.hintEl.textContent = hintFor(this.tool); }, 2200); }
  key(e) {
    const k = e.key.toLowerCase();
    if (k === 'r' && !e.ctrlKey) { this.L.rot = (this.L.rot + 1) % 4; if (this._lastMove) this.hover(this._lastMove); return true; }
    if (k === 'escape') { if (this.tool !== 'select') this.setTool('select'); else { this.ed.sel = null; this.ed.emit('select'); this.drawSel(); } return true; }
    if ((k === 'delete' || k === 'backspace') && this.ed.sel) { this.ed.deleteSel(); this.drawSel(); return true; }
    if (k === 'v' && !e.ctrlKey) { this.setTool('select'); return true; }
    if (NUM_KEYS[k] && !e.ctrlKey && !e.altKey) { this.setTool(NUM_KEYS[k]); return true; }
    if (k === 'f') { this.frame(); return true; }
    return false;
  }
}

global.Plan3DBuilder = { Builder, PieceLogic, Palette, PIECES, NUM_KEYS, hintFor };
})(window);
