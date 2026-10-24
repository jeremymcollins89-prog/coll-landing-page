/* Coll Plan3D — 2D plan editor (feet). Coll Business Solutions LLC */
(function (global) {
'use strict';

const uid = () => Math.random().toString(36).slice(2, 10);
const FR = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
function fmt(ft) {
  if (!isFinite(ft)) return '';
  const e = Math.round(Math.abs(ft) * 96), f = Math.floor(e / 96), r = e - f * 96;
  return (ft < 0 ? '-' : '') + f + '′-' + Math.floor(r / 8) + FR[r % 8] + '″';
}
function fmtIn(ft) {
  const e = Math.round(Math.abs(ft) * 96), i = Math.floor(e / 8), r = e % 8;
  return (ft < 0 ? '-' : '') + i + FR[r] + '″';
}
function parseInches(s) {
  s = s.replace(/"/g, '').replace(/(\d)\s*-\s*(\d+\/)/, '$1 $2').trim();
  const m = s.match(/^(\d+(?:\.\d+)?)?(?:\s*(\d+)\/(\d+))?$/);
  if (!m || (!m[1] && !m[2])) return NaN;
  return (m[1] ? +m[1] : 0) + (m[2] ? m[2] / m[3] : 0);
}
/* Parse a length to feet. Plain numbers use defUnit ('ft' or 'in'). */
function parseLen(s, defUnit) {
  s = String(s == null ? '' : s).trim().replace(/[′’]/g, "'").replace(/[″”]/g, '"')
    .replace(/¼/g, ' 1/4').replace(/½/g, ' 1/2').replace(/¾/g, ' 3/4').replace(/⅛/g, ' 1/8').replace(/⅜/g, ' 3/8').replace(/⅝/g, ' 5/8').replace(/⅞/g, ' 7/8').trim();
  if (!s) return NaN;
  const fi = s.indexOf("'");
  if (fi >= 0) {
    const ft = parseFloat(s.slice(0, fi)); if (isNaN(ft)) return NaN;
    const rest = s.slice(fi + 1).replace(/^[\s-]+/, '');
    if (!rest) return ft;
    const inch = parseInches(rest); return isNaN(inch) ? NaN : ft + inch / 12;
  }
  if (s.includes('"')) { const i = parseInches(s); return i / 12; }
  if (defUnit === 'in') { const mi = s.match(/^(\d+(?:\.\d+)?)[-\s]+(\d+\/\d+)$/); if (mi) return (+mi[1] + parseInches(mi[2])) / 12; }
  const m = s.match(/^(\d+)-(\d.*)$/);
  if (m) { const i = parseInches(m[2]); return isNaN(i) ? NaN : +m[1] + i / 12; }
  if (/^\d+\s+\d+\/\d+$/.test(s) || /^\d+\/\d+$/.test(s)) { const i = parseInches(s); return defUnit === 'in' ? i / 12 : i; }
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
  const v = parseFloat(s); return defUnit === 'in' ? v / 12 : v;
}
function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function segProj(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0; const tc = Math.max(0, Math.min(1, t));
  const x = x1 + dx * tc, y = y1 + dy * tc;
  return { d: Math.hypot(px - x, py - y), t, tc, x, y, len: Math.sqrt(l2) };
}

const DEFAULT_W = { door: 3, door2: 6, glass: 4, open: 3, pass: 2, window: 3 };
// houses: 2′-8″ doors, 5′ pairs, 3′ windows, 6′-8″ heads
const HOUSE_W = { door: 2 + 8 / 12, door2: 5, glass: 3, open: 3, pass: 2 };
const OPENING_TOOLS = new Set(['door', 'door2', 'glass', 'open', 'pass']);
const COL = {
  bg: '#1a2024', gridMinor: 'rgba(255,255,255,.035)', gridMajor: 'rgba(255,255,255,.08)', axis: 'rgba(255,255,255,.14)',
  wall: '#e9eef0', wallLine: '#8e9aa1', sp: '#f2d06b', chase: '#59666d', chaseLine: '#b7c2c7', grille: '#9fdbe8',
  glass: '#7fd3e3', door: '#c9d2d6', room: '#d6dee2', roomSub: '#f2c84b', sel: '#f2c84b', hover: 'rgba(242,200,75,.55)',
  draft: '#f2c84b', dim: '#aab6bc', snap: '#7fd3e3', cal: '#ff8a5c', pass: '#8c969b', passLine: '#d5dcdf'
};

class Editor {
  constructor(canvas, opts) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.o = opts || {};
    this.plan = Editor.blank();
    this.view = { ox: 60, oy: 60, s: 14 };
    this.tool = 'select'; this.sel = null; this.hover = null;
    this.draft = null; this.drag = null; this.cal = null; this.typed = '';
    this.bgImg = null; this.cursor = null; this.snapPt = null;
    this.hist = []; this.fut = []; this.showDims = true; this.ortho = true; this.snapIn = 0.25;
    this.spaceDown = false; this.dirty = false;
    this.bind();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }
  static blank() { return { version: 1, name: 'Untitled plan', ceiling: 8, wallT: 0.25, walls: [], openings: [], chases: [], rooms: [], fixtures: [], inserts: [], ceilingMode: 'auto', background: null }; }

  /* ---------- plan + history ---------- */
  setPlan(p, keepView) {
    this.plan = Object.assign(Editor.blank(), p);
    this.sel = null; this.draft = null; this.hist = []; this.fut = []; this.dirty = false;
    this.loadBg();
    if (!keepView) this.fit();
    this.emit('select'); this.emit('change', { reset: true }); this.render();
  }
  loadBg() {
    const b = this.plan.background;
    if (!b || !b.src) { this.bgImg = null; return; }
    if (this.bgImg && this.bgImg.src === b.src) return;
    const im = new Image(); im.onload = () => { this.render(); this.emit('bgload'); }; im.src = b.src; this.bgImg = im;
  }
  snapshot() { return JSON.stringify(this.plan); }
  commit(before) {
    this.hist.push(before); if (this.hist.length > 200) this.hist.shift(); this.fut = []; this.dirty = true;
    this.emit('change'); this.render();
  }
  edit(fn) { const b = this.snapshot(); fn(this.plan); this.commit(b); }
  undo() { if (!this.hist.length) return; this.fut.push(this.snapshot()); this.plan = JSON.parse(this.hist.pop()); this.afterRestore(); }
  redo() { if (!this.fut.length) return; this.hist.push(this.snapshot()); this.plan = JSON.parse(this.fut.pop()); this.afterRestore(); }
  afterRestore() { this.dirty = true; this.loadBg(); if (this.sel && !this.find(this.sel)) this.sel = null; this.emit('select'); this.emit('change'); this.render(); }
  emit(ev, d) { const f = this.o['on' + ev[0].toUpperCase() + ev.slice(1)]; if (f) f(d); }
  find(sel) {
    if (!sel) return null;
    const list = { wall: 'walls', opening: 'openings', chase: 'chases', room: 'rooms', fixture: 'fixtures', insert: 'inserts', item: 'items' }[sel.kind];
    return list ? (this.plan[list] || []).find(x => x.id === sel.id) : (sel.kind === 'bg' ? this.plan.background : null);
  }
  selected() { return this.find(this.sel); }

  /* ---------- view ---------- */
  resize() {
    const p = this.c.parentElement, dpr = Math.min(2, global.devicePixelRatio || 1);
    this.W = p.clientWidth; this.H = p.clientHeight;
    this.c.width = Math.max(1, this.W * dpr); this.c.height = Math.max(1, this.H * dpr); this.c.style.width = this.W + 'px'; this.c.style.height = this.H + 'px';
    this.dpr = dpr;
    if (this._fitPending && this.W && this.H) this.fit(); else this.render();
  }
  sx(x) { return this.view.ox + x * this.view.s; }
  sy(y) { return this.view.oy + y * this.view.s; }
  wx(px) { return (px - this.view.ox) / this.view.s; }
  wy(py) { return (py - this.view.oy) / this.view.s; }
  extents() {
    const P = this.plan; let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    const e = (x, y) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); };
    P.walls.forEach(w => { e(w.x1, w.y1); e(w.x2, w.y2); }); P.chases.forEach(k => { e(k.x0, k.y0); e(k.x1, k.y1); });
    P.rooms.forEach(r => e(r.x, r.y));
    (P.inserts || []).forEach(i => { const b = this.insBox(i); e(b.x0, b.y0); e(b.x1, b.y1); });
    if (this.bgImg && P.background && P.background.visible !== false && this.bgImg.naturalWidth) {
      const B = P.background, w = this.bgImg.naturalWidth * B.scale / 2, h = this.bgImg.naturalHeight * B.scale / 2, r = Math.hypot(w, h);
      if (!P.walls.length) { e(B.cx - r, B.cy - r); e(B.cx + r, B.cy + r); }
    }
    if (a > c) return { x0: 0, y0: 0, x1: 40, y1: 30 };
    return { x0: a, y0: b, x1: c, y1: d };
  }
  fit() {
    if (!this.W || !this.H) { this._fitPending = true; return; }
    this._fitPending = false;
    const E = this.extents(), pad = 50, w = Math.max(4, E.x1 - E.x0), h = Math.max(4, E.y1 - E.y0);
    const s = Math.max(1, Math.min((this.W - pad * 2) / w, (this.H - pad * 2) / h));
    this.view.s = s; this.view.ox = (this.W - w * s) / 2 - E.x0 * s; this.view.oy = (this.H - h * s) / 2 - E.y0 * s;
    this.render();
  }
  zoomAt(px, py, f) {
    const x = this.wx(px), y = this.wy(py);
    this.view.s = Math.max(0.6, Math.min(400, this.view.s * f));
    this.view.ox = px - x * this.view.s; this.view.oy = py - y * this.view.s; this.render();
  }

  /* ---------- tools ---------- */
  setTool(t) {
    this.tool = t; this.draft = null; this.cal = null; this.typed = ''; this.drag = null;
    if (t !== 'select') this.sel = null;
    this.emit('select'); this.emit('tool', t); this.render();
  }
  status(msg) { this.emit('status', msg); }

  snap(x, y, from, opts) {
    opts = opts || {};
    const tol = 10 / this.view.s;
    let best = null, bd = tol;
    const cand = (px, py) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { x: px, y: py }; } };
    if (!opts.noPoints) {
      for (const w of this.plan.walls) { if (opts.skip && opts.skip.includes(w)) continue; cand(w.x1, w.y1); cand(w.x2, w.y2); }
      for (const k of this.plan.chases) { cand(k.x0, k.y0); cand(k.x1, k.y0); cand(k.x0, k.y1); cand(k.x1, k.y1); }
    }
    if (best) { this.snapPt = best; return { x: best.x, y: best.y, kind: 'point' }; }
    this.snapPt = null;
    if (from && this.ortho && !opts.free) {
      if (Math.abs(x - from.x) > Math.abs(y - from.y)) y = from.y; else x = from.x;
    }
    // align to other endpoints along the free axis
    if (!opts.noPoints) {
      let ax = null, ay = null, adx = tol * 0.8, ady = tol * 0.8;
      for (const w of this.plan.walls) for (const [px, py] of [[w.x1, w.y1], [w.x2, w.y2]]) {
        if (opts.skip && opts.skip.includes(w)) continue;
        if (!(from && this.ortho && x === from.x) && Math.abs(px - x) < adx) { adx = Math.abs(px - x); ax = px; }
        if (!(from && this.ortho && y === from.y) && Math.abs(py - y) < ady) { ady = Math.abs(py - y); ay = py; }
      }
      if (ax != null) x = ax; if (ay != null) y = ay;
      if (ax != null || ay != null) return { x, y, kind: 'align', ax, ay };
    }
    const g = this.snapIn / 12;
    if (g > 0) {
      if (!(from && this.ortho && x === from.x)) x = Math.round(x / g) * g;
      if (!(from && this.ortho && y === from.y)) y = Math.round(y / g) * g;
    }
    return { x, y, kind: 'grid' };
  }

  wallAt(x, y, tolPx) {
    let best = null, bd = 1e9;
    for (const w of this.plan.walls) {
      const p = segProj(x, y, w.x1, w.y1, w.x2, w.y2);
      const lim = (w.t || 0.25) / 2 + (tolPx || 6) / this.view.s;
      if (p.d < lim && p.d < bd) { bd = p.d; best = { w, p }; }
    }
    return best;
  }
  get house() { return this.plan.mode === 'house'; }
  openingPreview(x, y, type) {
    const width = (this.house ? HOUSE_W : DEFAULT_W)[type];
    const hit = this.wallAt(x, y, 14);
    if (hit) {
      const w = hit.w, len = hit.p.len; if (len < 0.5) return null;
      const ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len;
      const wd = Math.min(width, len);
      let s = hit.p.tc * len; s = Math.round(s / (this.snapIn / 12 || 1 / 48)) * (this.snapIn / 12 || 1 / 48);
      s = Math.max(wd / 2, Math.min(len - wd / 2, s));
      const a = s - wd / 2, b = s + wd / 2;
      return { x1: w.x1 + ux * a, y1: w.y1 + uy * a, x2: w.x1 + ux * b, y2: w.y1 + uy * b, t: w.t, wall: w };
    }
    // gap between two collinear walls
    const W = this.plan.walls; let best = null, bd = 1e9;
    for (let i = 0; i < W.length; i++) for (let j = 0; j < W.length; j++) {
      if (i === j) continue;
      const A = W[i], B = W[j];
      const la = Math.hypot(A.x2 - A.x1, A.y2 - A.y1), lb = Math.hypot(B.x2 - B.x1, B.y2 - B.y1); if (la < 0.1 || lb < 0.1) continue;
      const ux = (A.x2 - A.x1) / la, uy = (A.y2 - A.y1) / la, vx = (B.x2 - B.x1) / lb, vy = (B.y2 - B.y1) / lb;
      if (Math.abs(ux * vy - uy * vx) > 0.02) continue;
      for (const [ex, ey] of [[A.x1, A.y1], [A.x2, A.y2]]) for (const [fx, fy] of [[B.x1, B.y1], [B.x2, B.y2]]) {
        const gap = Math.hypot(fx - ex, fy - ey); if (gap < 1 || gap > 16) continue;
        if (Math.abs((fx - ex) * (-uy) + (fy - ey) * ux) > 0.1) continue;
        const p = segProj(x, y, ex, ey, fx, fy); if (p.t < 0 || p.t > 1) continue;
        if (p.d < Math.max(A.t, 0.25) / 2 + 14 / this.view.s && p.d < bd) { bd = p.d; best = { x1: ex, y1: ey, x2: fx, y2: fy, t: A.t }; }
      }
    }
    return best;
  }

  /* a placed building: its box on the plan, and its plan moved into place (cached until it changes) */
  insView(ins) {
    const V = global.Plan3DViewer; if (!V || !V.zones) return null;
    const key = JSON.stringify([ins.x, ins.y, ins.rot, ins.mirror, ins.libSaved, ins.plan && ins.plan.walls && ins.plan.walls.length, ins._v]);
    if (ins.__k !== key) { Object.defineProperty(ins, '__k', { value: key, writable: true, enumerable: false }); Object.defineProperty(ins, '__z', { value: V.zones({ walls: [], inserts: [ins] }).slice(1), writable: true, enumerable: false }); Object.defineProperty(ins, '__b', { value: V.insertBox(ins), writable: true, enumerable: false }); }
    return ins.__z;
  }
  insBox(ins) { this.insView(ins); return ins.__b || { x0: ins.x - 1, y0: ins.y - 1, x1: ins.x + 1, y1: ins.y + 1 }; }
  /* where a house item goes: backed against the nearest wall (within 2½′), else free at the R angle */
  itemPlace(x, y, type, keep) {
    const V = global.Plan3DViewer, D = V && V.ITEMS[type]; if (!D) return null;
    const w = (keep && keep.w) || D.w, d = (keep && keep.d) || D.d;
    if (type !== 'island') {
      const hit = this.wallAt(x, y, 2.5 * this.view.s + 8);
      if (hit && hit.p.len > 0.5) {
        const W = hit.w, L = hit.p.len, ux = (W.x2 - W.x1) / L, uy = (W.y2 - W.y1) / L, nx = -uy, ny = ux;
        const side = ((x - hit.p.x) * nx + (y - hit.p.y) * ny) >= 0 ? 1 : -1, g = 1 / 12;
        let sAlong = Math.round(hit.p.tc * L / g) * g; sAlong = Math.max(Math.min(w / 2, L / 2), Math.min(L - Math.min(w / 2, L / 2), sAlong));
        const off = (W.t || 0.25) / 2 + d / 2;
        return { type, w, d, x: W.x1 + ux * sAlong + nx * side * off, y: W.y1 + uy * sAlong + ny * side * off, a: Math.atan2(side * uy, side * ux), wall: true };
      }
    }
    const g = this.snapIn / 12 || 1 / 48;
    return { type, w, d, x: Math.round(x / g) * g, y: Math.round(y / g) * g, a: (this.itemRot || 0) * Math.PI / 2, wall: false };
  }
  hitTest(x, y) {
    const P = this.plan, tol = 7 / this.view.s;
    for (let i = P.openings.length - 1; i >= 0; i--) { const o = P.openings[i]; if (segProj(x, y, o.x1, o.y1, o.x2, o.y2).d < (o.t || 0.25) / 2 + tol) return { kind: 'opening', id: o.id }; }
    const V = global.Plan3DViewer;
    if (V && V.itemCorners) for (let i = (P.items || []).length - 1; i >= 0; i--) { const c = V.itemCorners(P.items[i]); if (inPoly(x, y, c)) return { kind: 'item', id: P.items[i].id }; }
    for (let i = P.rooms.length - 1; i >= 0; i--) { const r = P.rooms[i]; if (Math.abs(x - r.x) < 50 / this.view.s && Math.abs(y - r.y) < 14 / this.view.s) return { kind: 'room', id: r.id }; }
    for (let i = P.chases.length - 1; i >= 0; i--) { const k = P.chases[i]; if (x >= Math.min(k.x0, k.x1) - tol && x <= Math.max(k.x0, k.x1) + tol && y >= Math.min(k.y0, k.y1) - tol && y <= Math.max(k.y0, k.y1) + tol) return { kind: 'chase', id: k.id }; }
    const h = this.wallAt(x, y, 7); if (h) return { kind: 'wall', id: h.w.id };
    for (let i = (P.inserts || []).length - 1; i >= 0; i--) { const b = this.insBox(P.inserts[i]); if (x >= b.x0 - tol && x <= b.x1 + tol && y >= b.y0 - tol && y <= b.y1 + tol) return { kind: 'insert', id: P.inserts[i].id }; }
    return null;
  }

  /* ---------- input ---------- */
  bind() {
    const c = this.c;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('wheel', e => { e.preventDefault(); const r = c.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.pow(1.0015, -e.deltaY)); }, { passive: false });
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('pointermove', e => this.move(e));
    c.addEventListener('pointerup', e => this.up(e));
    c.addEventListener('dblclick', () => { if (this.tool === 'wall') this.endChain(); });
    c.addEventListener('pointerleave', () => { this.cursor = null; this.render(); });
  }
  pt(e) { const r = this.c.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top, x: this.wx(e.clientX - r.left), y: this.wy(e.clientY - r.top) }; }
  down(e) {
    this.c.focus();
    const p = this.pt(e);
    if (e.button === 1 || e.button === 2 && this.tool !== 'wall' || this.spaceDown) {
      this.drag = { kind: 'pan', px: p.px, py: p.py, ox: this.view.ox, oy: this.view.oy }; this.c.setPointerCapture(e.pointerId); return;
    }
    if (e.button === 2 && this.tool === 'wall') { this.endChain(); return; }
    if (e.button !== 0) return;
    const T = this.tool;
    if (T === 'select') {
      // endpoint handles of selected wall
      const s = this.selected();
      if (this.sel && this.sel.kind === 'wall' && s) {
        for (const end of [1, 2]) {
          const ex = end === 1 ? s.x1 : s.x2, ey = end === 1 ? s.y1 : s.y2;
          if (Math.hypot(ex - p.x, ey - p.y) < 8 / this.view.s) {
            const linked = this.linkedEnds(ex, ey, s);
            this.drag = { kind: 'end', w: s, end, before: this.snapshot(), linked, other: end === 1 ? { x: s.x2, y: s.y2 } : { x: s.x1, y: s.y1 } };
            this.c.setPointerCapture(e.pointerId); return;
          }
        }
      }
      const hit = this.hitTest(p.x, p.y);
      this.sel = hit; this.emit('select');
      if (hit) {
        const obj = this.find(hit);
        const d = { kind: 'move', sel: hit, obj, sx: p.x, sy: p.y, before: this.snapshot(), orig: JSON.parse(JSON.stringify(obj)), moved: false };
        if (hit.kind === 'wall') {
          d.ops = this.plan.openings.filter(o => segProj(o.x1, o.y1, obj.x1, obj.y1, obj.x2, obj.y2).d < obj.t && segProj(o.x2, o.y2, obj.x1, obj.y1, obj.x2, obj.y2).d < obj.t).map(o => ({ o, x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2 }));
          d.l1 = this.linkedEnds(obj.x1, obj.y1, obj); d.l2 = this.linkedEnds(obj.x2, obj.y2, obj);
        }
        this.drag = d;
      } else this.drag = { kind: 'pan', px: p.px, py: p.py, ox: this.view.ox, oy: this.view.oy };
      this.c.setPointerCapture(e.pointerId); this.render(); return;
    }
    if (T === 'wall') {
      const from = this.draft ? this.draft.pts[this.draft.pts.length - 1] : null;
      const s = this.snap(p.x, p.y, from, { free: e.altKey });
      if (!this.draft) { this.draft = { pts: [{ x: s.x, y: s.y }] }; this.status('Click the next corner. Type a length and press Enter. Double-click or Esc to finish.'); }
      else this.addWallTo(s.x, s.y);
      this.typed = ''; this.render(); return;
    }
    if (OPENING_TOOLS.has(T)) {
      const pv = this.openingPreview(p.x, p.y, T);
      if (!pv) { this.status('Click on a wall, or in the gap between two walls.'); return; }
      const o = { id: uid(), type: T, x1: pv.x1, y1: pv.y1, x2: pv.x2, y2: pv.y2, t: pv.t, swing: 1 };
      if (this.house && T === 'glass') { o.type = 'window'; o.sill = 3; o.head = 6 + 8 / 12; }
      else if (this.house && (T === 'door' || T === 'door2' || T === 'open')) o.head = 6 + 8 / 12;
      else if (T === 'glass') { o.sill = 3; o.head = 7; }
      else if (T === 'pass') { o.sill = 3; o.head = 5; o.depth = 2; }
      else o.head = 7;
      this.edit(P => P.openings.push(o)); return;
    }
    if (T === 'piece') {
      if (!this.pieces || this.pieces.tool === 'select') return;
      const g = this.pieces.ghostAt({ x: p.x, y: p.y });
      if (g && this.pieces.place(g)) { this.pieceGhost = this.pieces.ghostAt({ x: p.x, y: p.y }); this.render(); }
      return;
    }
    if (T === 'item') {
      const q = this.itemPlace(p.x, p.y, this.itemType); if (!q) return;
      const it = { id: uid(), type: q.type, x: q.x, y: q.y, a: q.a, w: q.w, d: q.d };
      this.edit(P => { (P.items = P.items || []).push(it); }); return;
    }
    if (T === 'chase') {
      const s = this.snap(p.x, p.y, null);
      this.drag = { kind: 'chase', x0: s.x, y0: s.y, x1: s.x, y1: s.y }; this.c.setPointerCapture(e.pointerId); return;
    }
    if (T === 'room') {
      const r = { id: uid(), name: 'Room ' + (this.plan.rooms.length + 1), dims: '', x: p.x, y: p.y };
      this.edit(P => P.rooms.push(r)); this.setTool('select'); this.sel = { kind: 'room', id: r.id }; this.emit('select', { focusName: true }); this.render(); return;
    }
    if (T === 'calibrate') {
      const s = this.snap(p.x, p.y, this.cal && this.cal.p1, { free: e.altKey });
      if (!this.cal || this.cal.p2) { this.cal = { p1: { x: s.x, y: s.y } }; this.status('Click the other end of the known dimension.'); }
      else { this.cal.p2 = { x: s.x, y: s.y }; this.render(); this.emit('calibrate', this.cal); }
      this.render(); return;
    }
  }
  linkedEnds(x, y, self) {
    const L = [];
    for (const w of this.plan.walls) {
      if (w === self) continue;
      if (Math.hypot(w.x1 - x, w.y1 - y) < 0.01) L.push({ w, end: 1 });
      if (Math.hypot(w.x2 - x, w.y2 - y) < 0.01) L.push({ w, end: 2 });
    }
    return L;
  }
  move(e) {
    const p = this.pt(e); this.cursor = p;
    const D = this.drag;
    if (D && D.kind === 'pan') { this.view.ox = D.ox + p.px - D.px; this.view.oy = D.oy + p.py - D.py; this.render(); return; }
    if (D && D.kind === 'end') {
      const s = this.snap(p.x, p.y, D.other, { free: e.altKey, skip: [D.w] });
      if (D.end === 1) { D.w.x1 = s.x; D.w.y1 = s.y; } else { D.w.x2 = s.x; D.w.y2 = s.y; }
      D.linked.forEach(l => { if (l.end === 1) { l.w.x1 = s.x; l.w.y1 = s.y; } else { l.w.x2 = s.x; l.w.y2 = s.y; } });
      this.emit('live'); this.render(); return;
    }
    if (D && D.kind === 'move') {
      let dx = p.x - D.sx, dy = p.y - D.sy;
      if (!D.moved && Math.hypot(dx, dy) * this.view.s < 4) return;
      D.moved = true;
      const g = this.snapIn / 12 || 1 / 48; dx = Math.round(dx / g) * g; dy = Math.round(dy / g) * g;
      const o = D.obj, O = D.orig;
      if (D.sel.kind === 'wall') {
        o.x1 = O.x1 + dx; o.y1 = O.y1 + dy; o.x2 = O.x2 + dx; o.y2 = O.y2 + dy;
        D.l1.forEach(l => { if (l.end === 1) { l.w.x1 = o.x1; l.w.y1 = o.y1; } else { l.w.x2 = o.x1; l.w.y2 = o.y1; } });
        D.l2.forEach(l => { if (l.end === 1) { l.w.x1 = o.x2; l.w.y1 = o.y2; } else { l.w.x2 = o.x2; l.w.y2 = o.y2; } });
        D.ops.forEach(k => { k.o.x1 = k.x1 + dx; k.o.y1 = k.y1 + dy; k.o.x2 = k.x2 + dx; k.o.y2 = k.y2 + dy; });
      } else if (D.sel.kind === 'opening') {
        // slide along its own direction; snap onto a wall if dragged onto one
        const len = Math.hypot(O.x2 - O.x1, O.y2 - O.y1), ux = (O.x2 - O.x1) / len, uy = (O.y2 - O.y1) / len;
        const hit = this.wallAt(p.x, p.y, 14);
        if (hit) {
          const w = hit.w, wl = hit.p.len, wx = (w.x2 - w.x1) / wl, wy = (w.y2 - w.y1) / wl;
          let s = hit.p.tc * wl; s = Math.round(s / g) * g; s = Math.max(len / 2, Math.min(wl - len / 2, s));
          o.x1 = w.x1 + wx * (s - len / 2); o.y1 = w.y1 + wy * (s - len / 2); o.x2 = w.x1 + wx * (s + len / 2); o.y2 = w.y1 + wy * (s + len / 2); o.t = w.t;
        } else { const k = dx * ux + dy * uy; o.x1 = O.x1 + ux * k; o.y1 = O.y1 + uy * k; o.x2 = O.x2 + ux * k; o.y2 = O.y2 + uy * k; }
      } else if (D.sel.kind === 'chase') { o.x0 = O.x0 + dx; o.y0 = O.y0 + dy; o.x1 = O.x1 + dx; o.y1 = O.y1 + dy; }
      else if (D.sel.kind === 'room') { o.x = O.x + (p.x - D.sx); o.y = O.y + (p.y - D.sy); }
      else if (D.sel.kind === 'item') {
        const q = this.itemPlace(O.x + (p.x - D.sx), O.y + (p.y - D.sy), o.type, o);
        if (q) { o.x = q.x; o.y = q.y; if (q.wall) o.a = q.a; }
      }
      else if (D.sel.kind === 'insert') {
        // snap the building's box edges to nearby wall ends, otherwise move on the snap grid
        o.x = O.x + dx; o.y = O.y + dy;
        const b = this.insBox(o), tol = 10 / this.view.s; let bx = null, by = null, bdx = tol, bdy = tol;
        for (const w of this.plan.walls) for (const [px, py] of [[w.x1, w.y1], [w.x2, w.y2]]) for (const ex of [b.x0, b.x1]) for (const ey of [b.y0, b.y1]) {
          if (Math.abs(px - ex) < bdx) { bdx = Math.abs(px - ex); bx = px - ex; } if (Math.abs(py - ey) < bdy) { bdy = Math.abs(py - ey); by = py - ey; }
        }
        if (bx != null) o.x += bx; if (by != null) o.y += by;
      }
      this.emit('live'); this.render(); return;
    }
    if (D && D.kind === 'chase') { const s = this.snap(p.x, p.y, null); D.x1 = s.x; D.y1 = s.y; this.render(); return; }
    if (this.tool === 'piece' && this.pieces && this.pieces.tool !== 'select') {
      this.pieceGhost = this.pieces.ghostAt({ x: p.x, y: p.y });
      this.status(this.pieceGhost ? this.pieces.label(this.pieceGhost) : '');
      this.render(); this.emit('cursor', p); return;
    }
    // hover feedback
    if (this.tool === 'item') { const q = this.itemPlace(p.x, p.y, this.itemType); this.status(q ? (global.Plan3DViewer.ITEMS[q.type].label + (q.wall ? ' — against the wall. Click to place.' : ' — R turns it. Click to place.')) : ''); }
    if (this.tool === 'select') this.hover = this.hitTest(p.x, p.y);
    this.render();
    this.emit('cursor', p);
  }
  up(e) {
    const D = this.drag; this.drag = null;
    try { this.c.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
    if (!D) return;
    if (D.kind === 'end') { this.commit(D.before); this.emit('select'); }
    else if (D.kind === 'move') { if (D.moved) { this.commit(D.before); this.emit('select'); } }
    else if (D.kind === 'chase') {
      const x0 = Math.min(D.x0, D.x1), x1 = Math.max(D.x0, D.x1), y0 = Math.min(D.y0, D.y1), y1 = Math.max(D.y0, D.y1);
      if (x1 - x0 > 0.3 && y1 - y0 > 0.3) {
        const k = { id: uid(), x0, y0, x1, y1, grille: this.autoGrille({ x0, y0, x1, y1 }) };
        this.edit(P => P.chases.push(k)); this.sel = { kind: 'chase', id: k.id }; this.emit('select');
      }
      this.render();
    }
  }
  autoGrille(k) {
    // pick the long face whose outside is most open (farthest from walls)
    const faces = [], w = k.x1 - k.x0, h = k.y1 - k.y0;
    if (w >= h) faces.push(['N', (k.x0 + k.x1) / 2, k.y0 - 0.8], ['S', (k.x0 + k.x1) / 2, k.y1 + 0.8]);
    if (h >= w) faces.push(['W', k.x0 - 0.8, (k.y0 + k.y1) / 2], ['E', k.x1 + 0.8, (k.y0 + k.y1) / 2]);
    let best = faces[0][0], bd = -1;
    for (const [f, x, y] of faces) { let d = 1e9; for (const wl of this.plan.walls) d = Math.min(d, segProj(x, y, wl.x1, wl.y1, wl.x2, wl.y2).d); if (d > bd) { bd = d; best = f; } }
    return best;
  }
  addWallTo(x, y) {
    const pts = this.draft.pts, a = pts[pts.length - 1];
    if (Math.hypot(x - a.x, y - a.y) < 0.05) return;
    const w = { id: uid(), x1: a.x, y1: a.y, x2: x, y2: y, t: this.plan.wallT || 0.25, sp: false };
    if (this.plan.newKind && this.plan.newKind !== 'hardwall') w.kind = this.plan.newKind;
    this.edit(P => P.walls.push(w));
    pts.push({ x, y });
    // close the loop when back at the first point
    if (pts.length > 2 && Math.hypot(x - pts[0].x, y - pts[0].y) < 0.01) this.endChain();
  }
  endChain() { if (this.draft) { this.draft = null; this.typed = ''; this.status(''); this.render(); } }
  key(e) {
    const k = e.key;
    if (k === ' ') { this.spaceDown = e.type === 'keydown'; return true; }
    if (e.type !== 'keydown') return false;
    if (this.tool === 'wall' && this.draft) {
      if (/^[0-9.'"\- /]$/.test(k)) { this.typed += k; this.status('Length: ' + this.typed + '   (Enter to place)'); this.render(); return true; }
      if (k === 'Backspace' && this.typed) { this.typed = this.typed.slice(0, -1); this.status('Length: ' + this.typed); this.render(); return true; }
      if (k === 'Enter' && this.typed) {
        const L = parseLen(this.typed, 'ft'); this.typed = '';
        if (isFinite(L) && L > 0 && this.cursor) {
          const a = this.draft.pts[this.draft.pts.length - 1];
          const s = this.snap(this.cursor.x, this.cursor.y, a, { noPoints: true });
          const dx = s.x - a.x, dy = s.y - a.y, d = Math.hypot(dx, dy) || 1;
          const g = 1 / 96;
          this.addWallTo(Math.round((a.x + dx / d * L) / g) * g, Math.round((a.y + dy / d * L) / g) * g);
        }
        this.status(''); this.render(); return true;
      }
    }
    if (this.tool === 'piece' && this.pieces && (k === 'r' || k === 'R') && !e.ctrlKey) {
      this.pieces.rot = (this.pieces.rot + 1) % 4;
      if (this.cursor) this.pieceGhost = this.pieces.ghostAt({ x: this.cursor.x, y: this.cursor.y });
      this.render(); return true;
    }
    if ((k === 'r' || k === 'R') && !e.ctrlKey && this.tool === 'item') { this.itemRot = ((this.itemRot || 0) + 1) % 4; this.render(); return true; }
    if ((k === 'r' || k === 'R') && !e.ctrlKey && this.sel && this.sel.kind === 'item') { const o = this.selected(); if (o) this.edit(() => { o.a = (o.a || 0) + Math.PI / 2 * (e.shiftKey ? -1 : 1); }); return true; }
    if ((k === 'r' || k === 'R') && !e.ctrlKey && this.sel && this.sel.kind === 'insert') { const o = this.selected(); if (o) this.edit(() => { o.rot = (((o.rot || 0) + (e.shiftKey ? 3 : 1)) % 4); }); return true; }
    if (k === 'Escape') { if (this.draft) this.endChain(); else if (this.cal) { this.cal = null; this.render(); } else if (this.tool !== 'select') this.setTool('select'); else { this.sel = null; this.emit('select'); this.render(); } return true; }
    if ((k === 'Delete' || k === 'Backspace') && this.sel) { this.deleteSel(); return true; }
    return false;
  }
  deleteSel() {
    const s = this.sel; if (!s) return;
    if (s.kind === 'bg') { this.edit(P => { P.background = null; }); this.bgImg = null; }
    else { const list = { wall: 'walls', opening: 'openings', chase: 'chases', room: 'rooms', fixture: 'fixtures', insert: 'inserts', item: 'items' }[s.kind]; this.edit(P => { P[list] = (P[list] || []).filter(x => x.id !== s.id); if (s.kind === 'wall') P.openings = P.openings.filter(o => o.unit !== s.id); }); }
    this.sel = null; this.emit('select'); this.render();
  }

  applyCalibration(p1, p2, realFt) {
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y); if (!(d > 0) || !(realFt > 0)) return;
    const f = realFt / d;
    this.edit(P => {
      const S = (x, y) => [p1.x + (x - p1.x) * f, p1.y + (y - p1.y) * f];
      P.walls.forEach(w => { [w.x1, w.y1] = S(w.x1, w.y1); [w.x2, w.y2] = S(w.x2, w.y2); });
      P.openings.forEach(o => { [o.x1, o.y1] = S(o.x1, o.y1); [o.x2, o.y2] = S(o.x2, o.y2); });
      P.chases.forEach(k => { [k.x0, k.y0] = S(k.x0, k.y0); [k.x1, k.y1] = S(k.x1, k.y1); });
      P.rooms.forEach(r => { [r.x, r.y] = S(r.x, r.y); });
      if (P.background) { const B = P.background; [B.cx, B.cy] = S(B.cx, B.cy); B.scale *= f; B.calibrated = true; }
      // move so the calibrated start point becomes a clean origin-ish location stays put
    });
    this.cal = null; this.fit();
  }

  drawItem(it, ghost) {
    const g = this.g, s = this.view.s, V = global.Plan3DViewer, D = V.ITEMS[it.type]; if (!D) return;
    const c = V.itemCorners(it), P = (u, v) => { const a = it.a || 0, cs = Math.cos(a), sn = Math.sin(a); return [this.sx(it.x + cs * u - sn * v), this.sy(it.y + sn * u + cs * v)]; };
    const w = it.w || D.w, d = it.d || D.d;
    g.save();
    g.beginPath(); c.forEach((q, k) => k ? g.lineTo(this.sx(q[0]), this.sy(q[1])) : g.moveTo(this.sx(q[0]), this.sy(q[1]))); g.closePath();
    g.fillStyle = ghost ? 'rgba(242,200,75,.3)' : it.type === 'upper' ? 'rgba(160,175,182,.18)' : '#3a464c'; g.fill();
    g.strokeStyle = ghost ? COL.draft : '#b9c4c9'; g.lineWidth = 1.1; if (it.type === 'upper') g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]);
    const circ = (u, v, r) => { const [X, Y] = P(u, v); g.beginPath(); g.arc(X, Y, Math.max(1, r * s), 0, Math.PI * 2); g.stroke(); };
    const rect = (u0, v0, u1, v1) => { const q = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]; g.beginPath(); q.forEach((pt, k) => k ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])); g.closePath(); g.stroke(); };
    g.strokeStyle = ghost ? COL.draft : '#d5dde1';
    if (it.type === 'range') { for (const [u, v] of [[-0.55, -0.4], [0.55, -0.4], [-0.55, 0.4], [0.55, 0.4]]) circ(u, v, 0.32); }
    else if (it.type === 'sinkbase' || it.type === 'vanity') { rect(-Math.min(1.1, w / 2 - 0.25), -d / 2 + 0.35, Math.min(1.1, w / 2 - 0.25), d / 2 - 0.25); }
    else if (it.type === 'toilet') { rect(-w / 2 + 0.05, -d / 2, w / 2 - 0.05, -d / 2 + 0.6); const [X, Y] = P(0, 0.3); g.beginPath(); g.ellipse(X, Y, 0.6 * s, 0.8 * s, -(it.a || 0) + Math.PI / 2, 0, Math.PI * 2); g.stroke(); }
    else if (it.type === 'tub') rect(-w / 2 + 0.25, -d / 2 + 0.22, w / 2 - 0.25, d / 2 - 0.22);
    else if (it.type === 'shower') { const [a1, b1] = [P(-w / 2, -d / 2), P(w / 2, d / 2)]; g.beginPath(); g.moveTo(a1[0], a1[1]); g.lineTo(b1[0], b1[1]); g.stroke(); }
    else if (it.type === 'washer' || it.type === 'dryer') circ(0, 0.1, Math.min(w, d) * 0.32);
    else if (it.type === 'waterheater') circ(0, 0, w / 2 - 0.05);
    if (s > 12) { const [X, Y] = P(0, 0); g.font = '10px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ghost ? COL.draft : '#e8edef'; const lbl = { base: 'BASE', sinkbase: 'SINK', upper: 'UPPER', tall: 'PANTRY', island: 'ISLAND', range: '', fridge: 'REF', dishwasher: 'DW', toilet: '', vanity: '', tub: 'TUB', shower: 'SHWR', washer: 'W', dryer: 'D', waterheater: 'WH', furnace: 'FURN' }[it.type]; if (lbl && Math.min(w, d) * s > 22) g.fillText(lbl, X, Y); }
    g.restore();
  }
  /* chases, walls, openings and room labels of a plan (the main plan, or a placed building moved into place) */
  drawContent(P) {
    const g = this.g, s = this.view.s, V = global.Plan3DViewer, KC = {};
    if (V && V.WALL_KINDS) for (const k in V.WALL_KINDS) KC[k] = V.WALL_KINDS[k].plan;
    // chases
    for (const k of P.chases) {
      const X = this.sx(Math.min(k.x0, k.x1)), Y = this.sy(Math.min(k.y0, k.y1)), W = Math.abs(k.x1 - k.x0) * s, H = Math.abs(k.y1 - k.y0) * s;
      g.fillStyle = COL.chase; g.fillRect(X, Y, W, H);
      g.strokeStyle = COL.chaseLine; g.lineWidth = 1; g.strokeRect(X + 0.5, Y + 0.5, W - 1, H - 1);
      g.save(); g.beginPath(); g.rect(X, Y, W, H); g.clip(); g.strokeStyle = 'rgba(255,255,255,.12)';
      for (let d = -H; d < W; d += 7) { g.beginPath(); g.moveTo(X + d, Y + H); g.lineTo(X + d + H, Y); g.stroke(); } g.restore();
      if (Math.max(W, H) > 46 && Math.min(W, H) > 14) {
        const lbl = fmtIn(Math.abs(k.x1 - k.x0)) + ' × ' + fmtIn(Math.abs(k.y1 - k.y0));
        g.save(); g.font = '10px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw = g.measureText(lbl).width;
        if (tw + 6 < Math.max(W, H)) {
          g.translate(X + W / 2, Y + H / 2); if (H > W && tw + 6 > W) g.rotate(-Math.PI / 2);
          g.fillStyle = 'rgba(26,32,36,.8)'; g.fillRect(-tw / 2 - 3, -7, tw + 6, 14); g.fillStyle = '#e8edef'; g.fillText(lbl, 0, 0);
        }
        g.restore();
      }
      if (k.grille) {
        const horiz = k.grille === 'N' || k.grille === 'S', face = horiz ? W : H;
        const gw = global.Plan3DViewer ? Math.min(face - 2, global.Plan3DViewer.grilleSize(k, face / s, P.ceiling).w * s) : face - 6, o = (face - gw) / 2;
        g.strokeStyle = COL.grille; g.lineWidth = 3; g.beginPath();
        if (k.grille === 'N') { g.moveTo(X + o, Y + 1.5); g.lineTo(X + o + gw, Y + 1.5); }
        if (k.grille === 'S') { g.moveTo(X + o, Y + H - 1.5); g.lineTo(X + o + gw, Y + H - 1.5); }
        if (k.grille === 'W') { g.moveTo(X + 1.5, Y + o); g.lineTo(X + 1.5, Y + o + gw); }
        if (k.grille === 'E') { g.moveTo(X + W - 1.5, Y + o); g.lineTo(X + W - 1.5, Y + o + gw); }
        g.stroke();
      }
    }
    // walls
    const quad = (x1, y1, x2, y2, t) => {
      const len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len * t / 2, ny = (x2 - x1) / len * t / 2;
      g.beginPath(); g.moveTo(this.sx(x1 + nx), this.sy(y1 + ny)); g.lineTo(this.sx(x2 + nx), this.sy(y2 + ny)); g.lineTo(this.sx(x2 - nx), this.sy(y2 - ny)); g.lineTo(this.sx(x1 - nx), this.sy(y1 - ny)); g.closePath();
    };
    for (const w of P.walls) { quad(w.x1, w.y1, w.x2, w.y2, Math.max(w.t || 0.25, 1.5 / s)); g.fillStyle = w.sp ? COL.sp : (w.kind && KC[w.kind]) || COL.wall; g.fill(); }
    for (const w of P.walls) { quad(w.x1, w.y1, w.x2, w.y2, Math.max(w.t || 0.25, 1.5 / s)); g.strokeStyle = COL.wallLine; g.lineWidth = 1; g.stroke(); }
    // openings (cut + symbol)
    for (const o of P.openings) {
      const t = (o.t || 0.25) + 0.04, len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1, ux = (o.x2 - o.x1) / len, uy = (o.y2 - o.y1) / len, nx = -uy, ny = ux, sw = o.swing === -1 ? -1 : 1;
      quad(o.x1, o.y1, o.x2, o.y2, t); g.fillStyle = COL.bg; g.fill();
      g.strokeStyle = COL.wallLine; g.lineWidth = 1;
      // jamb ticks
      for (const [ex, ey] of [[o.x1, o.y1], [o.x2, o.y2]]) { g.beginPath(); g.moveTo(this.sx(ex + nx * t / 2), this.sy(ey + ny * t / 2)); g.lineTo(this.sx(ex - nx * t / 2), this.sy(ey - ny * t / 2)); g.stroke(); }
      if (o.type === 'window') {
        // house window: frame lines on both faces and the glass line in the middle
        g.strokeStyle = COL.wallLine; g.lineWidth = 1;
        for (const k of [-0.5, 0.5]) { g.beginPath(); g.moveTo(this.sx(o.x1 + nx * t * k), this.sy(o.y1 + ny * t * k)); g.lineTo(this.sx(o.x2 + nx * t * k), this.sy(o.y2 + ny * t * k)); g.stroke(); }
        g.strokeStyle = COL.glass; g.lineWidth = 1.6; g.beginPath(); g.moveTo(this.sx(o.x1), this.sy(o.y1)); g.lineTo(this.sx(o.x2), this.sy(o.y2)); g.stroke();
      } else if (o.type === 'glass') {
        g.strokeStyle = COL.glass; g.lineWidth = 1.5;
        for (const k of [-0.25, 0.25]) { g.beginPath(); g.moveTo(this.sx(o.x1 + nx * t * k), this.sy(o.y1 + ny * t * k)); g.lineTo(this.sx(o.x2 + nx * t * k), this.sy(o.y2 + ny * t * k)); g.stroke(); }
      } else if (o.type === 'pass') {
        // stainless box through the wall, drawn at its full depth with an X
        const d = Math.max(t, o.depth || 2);
        quad(o.x1, o.y1, o.x2, o.y2, d); g.fillStyle = COL.pass; g.fill(); g.strokeStyle = COL.passLine; g.lineWidth = 1.2; g.stroke();
        const c = [[o.x1 + nx * d / 2, o.y1 + ny * d / 2], [o.x2 + nx * d / 2, o.y2 + ny * d / 2], [o.x2 - nx * d / 2, o.y2 - ny * d / 2], [o.x1 - nx * d / 2, o.y1 - ny * d / 2]];
        g.beginPath(); g.moveTo(this.sx(c[0][0]), this.sy(c[0][1])); g.lineTo(this.sx(c[2][0]), this.sy(c[2][1])); g.moveTo(this.sx(c[1][0]), this.sy(c[1][1])); g.lineTo(this.sx(c[3][0]), this.sy(c[3][1])); g.stroke();
        g.strokeStyle = COL.wallLine; quad(o.x1, o.y1, o.x2, o.y2, t - 0.04); g.stroke();
      } else if (o.type === 'door' || o.type === 'door2') {
        g.strokeStyle = COL.door; g.lineWidth = 1.3;
        const leaf = (hx, hy, dir, w) => {
          const bx = hx + nx * sw * t / 2, by = hy + ny * sw * t / 2;
          const tx = bx + nx * sw * w, ty = by + ny * sw * w;
          g.beginPath(); g.moveTo(this.sx(bx), this.sy(by)); g.lineTo(this.sx(tx), this.sy(ty)); g.stroke();
          const a0 = Math.atan2(ny * sw, nx * sw), a1 = Math.atan2(uy * dir, ux * dir);
          let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
          g.save(); g.setLineDash([3, 3]); g.beginPath(); g.arc(this.sx(bx), this.sy(by), w * s, a0, a0 + da, da < 0); g.stroke(); g.restore();
        };
        if (o.type === 'door') leaf(o.x1, o.y1, 1, len); else { leaf(o.x1, o.y1, 1, len / 2); leaf(o.x2, o.y2, -1, len / 2); }
      } else {
        g.strokeStyle = COL.door; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(this.sx(o.x1), this.sy(o.y1)); g.lineTo(this.sx(o.x2), this.sy(o.y2)); g.stroke(); g.setLineDash([]);
      }
    }
    // house items (kitchen, bath, laundry)
    const V2 = global.Plan3DViewer;
    if (V2 && V2.itemCorners) for (const it of P.items || []) this.drawItem(it, false);
    // rooms
    for (const r of P.rooms) {
      g.font = '600 13px Bahnschrift, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = COL.room; g.fillText(r.name || 'Room', this.sx(r.x), this.sy(r.y) - (r.dims ? 7 : 0));
      if (r.dims) { g.font = '11px Consolas, monospace'; g.fillStyle = COL.roomSub; g.fillText(r.dims, this.sx(r.x), this.sy(r.y) + 8); }
    }
  }

  /* ---------- render ---------- */
  render() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this.draw(); });
  }
  draw() {
    const g = this.g, P = this.plan, s = this.view.s;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = COL.bg; g.fillRect(0, 0, this.W, this.H);
    // grid
    const step = s * 1 < 6 ? (s * 4 < 6 ? 16 : 4) : 1;
    const x0 = Math.floor(this.wx(0) / step) * step, x1 = this.wx(this.W), y0 = Math.floor(this.wy(0) / step) * step, y1 = this.wy(this.H);
    g.lineWidth = 1;
    for (let x = x0; x <= x1; x += step) { g.strokeStyle = (Math.round(x) % (step * 4) === 0) ? COL.gridMajor : COL.gridMinor; g.beginPath(); g.moveTo(Math.round(this.sx(x)) + 0.5, 0); g.lineTo(Math.round(this.sx(x)) + 0.5, this.H); g.stroke(); }
    for (let y = y0; y <= y1; y += step) { g.strokeStyle = (Math.round(y) % (step * 4) === 0) ? COL.gridMajor : COL.gridMinor; g.beginPath(); g.moveTo(0, Math.round(this.sy(y)) + 0.5); g.lineTo(this.W, Math.round(this.sy(y)) + 0.5); g.stroke(); }
    // background image
    const B = P.background;
    if (B && this.bgImg && this.bgImg.complete && B.visible !== false) {
      g.save(); g.globalAlpha = B.opacity == null ? 0.55 : B.opacity;
      g.translate(this.sx(B.cx), this.sy(B.cy)); g.rotate(B.rot || 0);
      const w = this.bgImg.naturalWidth * B.scale * s, h = this.bgImg.naturalHeight * B.scale * s;
      g.drawImage(this.bgImg, -w / 2, -h / 2, w, h);
      if (this.sel && this.sel.kind === 'bg') { g.globalAlpha = 1; g.strokeStyle = COL.sel; g.lineWidth = 2; g.strokeRect(-w / 2, -h / 2, w, h); }
      g.restore();
    }
    // placed buildings, then the main plan on top
    for (const ins of P.inserts || []) {
      const zs = this.insView(ins); if (!zs) continue;
      g.save(); g.globalAlpha = 0.92; for (const z of zs) this.drawContent(z.plan); g.restore();
      const b = this.insBox(ins), X = this.sx(b.x0), Y = this.sy(b.y0), W = (b.x1 - b.x0) * s, H = (b.y1 - b.y0) * s;
      const on = this.sel && this.sel.kind === 'insert' && this.sel.id === ins.id;
      g.save(); g.setLineDash([6, 4]); g.strokeStyle = on ? COL.sel : 'rgba(127,211,227,.75)'; g.lineWidth = on ? 2 : 1.2; g.strokeRect(X - 4, Y - 4, W + 8, H + 8); g.restore();
      g.font = '600 11.5px Bahnschrift, "Segoe UI", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'bottom';
      const lbl = (ins.name || 'Building') + '  ' + fmt(b.x1 - b.x0) + ' × ' + fmt(b.y1 - b.y0), tw = g.measureText(lbl).width;
      g.fillStyle = 'rgba(26,32,36,.88)'; g.fillRect(X - 4, Y - 22, tw + 12, 17); g.fillStyle = on ? COL.sel : '#9fdbe8'; g.fillText(lbl, X + 2, Y - 7);
    }
    this.drawContent(P);
    // walls (outline helper used below)
    const quad = (x1, y1, x2, y2, t) => {
      const len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len * t / 2, ny = (x2 - x1) / len * t / 2;
      g.beginPath(); g.moveTo(this.sx(x1 + nx), this.sy(y1 + ny)); g.lineTo(this.sx(x2 + nx), this.sy(y2 + ny)); g.lineTo(this.sx(x2 - nx), this.sy(y2 - ny)); g.lineTo(this.sx(x1 - nx), this.sy(y1 - ny)); g.closePath();
    };
    // dimensions
    const dimFor = (x1, y1, x2, y2, t, color, always) => {
      const len = Math.hypot(x2 - x1, y2 - y1); if (len * s < 34 && !always) return;
      let a = Math.atan2(y2 - y1, x2 - x1); let flip = false; if (a > Math.PI / 2 || a <= -Math.PI / 2) { a += Math.PI; flip = true; }
      const nx = -(y2 - y1) / len, ny = (x2 - x1) / len, off = (t / 2) * s + 9;
      g.save(); g.translate(this.sx((x1 + x2) / 2) + nx * off * (flip ? 1 : -1), this.sy((y1 + y2) / 2) + ny * off * (flip ? 1 : -1)); g.rotate(a);
      g.font = '11px Consolas, "Cascadia Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const txt = fmt(len), tw = g.measureText(txt).width;
      g.fillStyle = 'rgba(26,32,36,.85)'; g.fillRect(-tw / 2 - 3, -7, tw + 6, 14);
      g.fillStyle = color; g.fillText(txt, 0, 0); g.restore();
    };
    if (this.showDims && s > 5) for (const w of P.walls) dimFor(w.x1, w.y1, w.x2, w.y2, w.t || 0.25, COL.dim);
    // hover / selection
    const outlineSel = (sel, color, width) => {
      const o = this.find(sel); if (!o) return;
      g.strokeStyle = color; g.lineWidth = width;
      if (sel.kind === 'wall') { quad(o.x1, o.y1, o.x2, o.y2, Math.max(o.t || 0.25, 1.5 / s) + 4 / s); g.stroke(); }
      else if (sel.kind === 'opening') { quad(o.x1, o.y1, o.x2, o.y2, (o.t || 0.25) + 6 / s); g.stroke(); }
      else if (sel.kind === 'chase') { g.strokeRect(this.sx(Math.min(o.x0, o.x1)) - 2, this.sy(Math.min(o.y0, o.y1)) - 2, Math.abs(o.x1 - o.x0) * s + 4, Math.abs(o.y1 - o.y0) * s + 4); }
      else if (sel.kind === 'room') { g.strokeRect(this.sx(o.x) - 48, this.sy(o.y) - 14, 96, 28); }
      else if (sel.kind === 'item') { const c = global.Plan3DViewer.itemCorners(o); g.beginPath(); c.forEach((q, k) => k ? g.lineTo(this.sx(q[0]), this.sy(q[1])) : g.moveTo(this.sx(q[0]), this.sy(q[1]))); g.closePath(); g.stroke(); }
      else if (sel.kind === 'insert') { const b = this.insBox(o); g.strokeRect(this.sx(b.x0) - 6, this.sy(b.y0) - 6, (b.x1 - b.x0) * s + 12, (b.y1 - b.y0) * s + 12); }
    };
    if (this.hover && this.tool === 'select' && !(this.sel && this.sel.id === this.hover.id)) outlineSel(this.hover, COL.hover, 1.5);
    if (this.sel) {
      outlineSel(this.sel, COL.sel, 2);
      const o = this.selected();
      if (this.sel.kind === 'wall' && o) {
        dimFor(o.x1, o.y1, o.x2, o.y2, o.t || 0.25, COL.sel, true);
        for (const [x, y] of [[o.x1, o.y1], [o.x2, o.y2]]) { g.fillStyle = COL.bg; g.strokeStyle = COL.sel; g.lineWidth = 2; g.beginPath(); g.rect(this.sx(x) - 4.5, this.sy(y) - 4.5, 9, 9); g.fill(); g.stroke(); }
      }
      if (this.sel.kind === 'opening' && o) dimFor(o.x1, o.y1, o.x2, o.y2, (o.t || 0.25) + 0.6, COL.sel, true);
    }
    // tool previews
    const C = this.cursor;
    if (C && this.tool === 'wall') {
      const from = this.draft ? this.draft.pts[this.draft.pts.length - 1] : null;
      const sp = this.snap(C.x, C.y, from, {});
      if (from) {
        quad(from.x, from.y, sp.x, sp.y, this.plan.wallT || 0.25); g.fillStyle = 'rgba(242,200,75,.25)'; g.fill(); g.strokeStyle = COL.draft; g.lineWidth = 1.5; g.stroke();
        dimFor(from.x, from.y, sp.x, sp.y, this.plan.wallT || 0.25, COL.draft, true);
      }
      this.crosshair(sp);
    }
    if (C && OPENING_TOOLS.has(this.tool)) {
      const pv = this.openingPreview(C.x, C.y, this.tool);
      if (pv) { quad(pv.x1, pv.y1, pv.x2, pv.y2, (pv.t || 0.25) + 6 / s); g.fillStyle = 'rgba(242,200,75,.35)'; g.fill(); g.strokeStyle = COL.draft; g.lineWidth = 1.5; g.stroke(); dimFor(pv.x1, pv.y1, pv.x2, pv.y2, (pv.t || 0.25) + 0.6, COL.draft, true); }
    }
    if (C && this.tool === 'item' && global.Plan3DViewer) { const q = this.itemPlace(C.x, C.y, this.itemType); if (q) this.drawItem(q, true); }
    if (this.drag && this.drag.kind === 'chase') {
      const D = this.drag; g.fillStyle = 'rgba(242,200,75,.25)'; g.strokeStyle = COL.draft; g.lineWidth = 1.5;
      const X = this.sx(Math.min(D.x0, D.x1)), Y = this.sy(Math.min(D.y0, D.y1)), W = Math.abs(D.x1 - D.x0) * s, H = Math.abs(D.y1 - D.y0) * s;
      g.fillRect(X, Y, W, H); g.strokeRect(X, Y, W, H);
      g.font = '11px Consolas, monospace'; g.fillStyle = COL.draft; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(fmtIn(Math.abs(D.x1 - D.x0)) + ' × ' + fmtIn(Math.abs(D.y1 - D.y0)), X + W + 6, Y + H + 4);
    }
    if (C && this.tool === 'chase' && !this.drag) this.crosshair(this.snap(C.x, C.y, null));
    // ceiling fixtures (shown while placing them)
    if (this.tool === 'piece' && this.pieces && (this.pieces.tool === 'led' || this.pieces.tool === 'ffu') && global.Plan3DViewer) {
      g.save(); g.setLineDash([4, 3]); g.lineWidth = 1;
      for (const f of global.Plan3DViewer.ceilingFixtures(P)) {
        g.strokeStyle = f.type === 'ffu' ? COL.glass : COL.room; g.fillStyle = f.type === 'ffu' ? 'rgba(127,211,227,.08)' : 'rgba(255,255,255,.08)';
        const fw = f.w || 1.9, fh = f.h || 3.9;
        g.fillRect(this.sx(f.x - fw / 2), this.sy(f.y - fh / 2), fw * s, fh * s); g.strokeRect(this.sx(f.x - fw / 2), this.sy(f.y - fh / 2), fw * s, fh * s);
        if (s > 9) { g.fillStyle = g.strokeStyle; g.font = '10px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.type === 'ffu' ? 'FFU' : 'LED', this.sx(f.x), this.sy(f.y)); }
      }
      g.restore();
    }
    // piece ghost
    const PG = this.tool === 'piece' && C ? this.pieceGhost : null;
    if (PG) {
      const bad = PG.bad, fill = bad ? 'rgba(255,106,77,.35)' : 'rgba(242,200,75,.35)', line = bad ? '#ff6a4d' : COL.draft;
      g.fillStyle = fill; g.strokeStyle = line; g.lineWidth = 1.5;
      if (PG.x0 != null) { const X = this.sx(PG.x0), Y = this.sy(PG.y0), W = (PG.x1 - PG.x0) * s, H = (PG.y1 - PG.y0) * s; g.fillRect(X, Y, W, H); g.strokeRect(X, Y, W, H); }
      else if (PG.mode === 'cell') { g.fillRect(this.sx(PG.x - 0.95), this.sy(PG.y - 1.95), 1.9 * s, 3.9 * s); g.strokeRect(this.sx(PG.x - 0.95), this.sy(PG.y - 1.95), 1.9 * s, 3.9 * s); }
      else {
        const t = (this.plan.wallT || 0.25) + (PG.mode === 'replace' ? 0.5 : 0.04);
        quad(PG.x1, PG.y1, PG.x2, PG.y2, t); g.fill(); g.stroke();
        dimFor(PG.x1, PG.y1, PG.x2, PG.y2, t, line, true);
        g.fillStyle = line; g.beginPath(); g.arc(this.sx(PG.x1), this.sy(PG.y1), 3.5, 0, Math.PI * 2); g.fill();
      }
    }
    if (this.tool === 'calibrate') {
      const c1 = this.cal && this.cal.p1;
      const c2 = this.cal && (this.cal.p2 || (C && this.snap(C.x, C.y, c1, {})));
      if (c1 && c2) {
        g.strokeStyle = COL.cal; g.lineWidth = 2; g.beginPath(); g.moveTo(this.sx(c1.x), this.sy(c1.y)); g.lineTo(this.sx(c2.x), this.sy(c2.y)); g.stroke();
        for (const p of [c1, c2]) { g.beginPath(); g.arc(this.sx(p.x), this.sy(p.y), 5, 0, Math.PI * 2); g.stroke(); }
      } else if (C) this.crosshair(this.snap(C.x, C.y, null));
    }
    if (this.typed) {
      g.font = '600 13px Consolas, monospace'; g.fillStyle = COL.draft; g.textAlign = 'left'; g.textBaseline = 'top';
      if (C) g.fillText('↦ ' + this.typed, C.px + 16, C.py + 14);
    }
  }
  crosshair(p) {
    const g = this.g, X = this.sx(p.x), Y = this.sy(p.y);
    g.strokeStyle = p.kind === 'point' ? COL.snap : COL.draft; g.lineWidth = 1.2;
    if (p.kind === 'point') { g.beginPath(); g.rect(X - 6, Y - 6, 12, 12); g.stroke(); }
    else { g.beginPath(); g.moveTo(X - 8, Y); g.lineTo(X + 8, Y); g.moveTo(X, Y - 8); g.lineTo(X, Y + 8); g.stroke(); }
    if (p.kind === 'align') {
      g.save(); g.setLineDash([3, 4]); g.strokeStyle = 'rgba(127,211,227,.5)'; g.beginPath();
      if (p.ax != null) { g.moveTo(X, 0); g.lineTo(X, this.H); } if (p.ay != null) { g.moveTo(0, Y); g.lineTo(this.W, Y); }
      g.stroke(); g.restore();
    }
  }
}

global.Plan3DEditor = { Editor, fmt, fmtIn, parseLen, uid };
})(window);
