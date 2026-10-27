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

const DEFAULT_W = { door: 3, door2: 6, glass: 4, open: 3, pass: 2, window: 3, overhead: 12 };
// houses: 2′-8″ doors, 5′ pairs, 3′ windows, 6′-8″ heads
const HOUSE_W = { door: 2 + 8 / 12, door2: 5, glass: 3, open: 3, pass: 2, overhead: 16 };
const OPENING_TOOLS = new Set(['door', 'door2', 'glass', 'open', 'pass', 'overhead']);
const LISTS = { wall: 'walls', opening: 'openings', chase: 'chases', room: 'rooms', fixture: 'fixtures', insert: 'inserts', item: 'items', device: 'devices', column: 'columns', beam: 'beams', carea: 'ceilAreas', gzone: 'gridZones' };
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
    this._chk = undefined; this._seats = null; this._lights = null; this._gridKey = null; this.emit('change'); this.render();
  }
  /* the cleanroom check (airflow per room, pressure across doors), worked out once per change */
  check() {
    const V2 = global.Plan3DViewer, P = this.plan;
    if (this._chk !== undefined) return this._chk;
    this._chk = V2 && V2.cleanroomCheck && (P.rooms || []).some(r => r.iso || (r.pressure != null && r.pressure !== '')) ? (() => { try { return V2.cleanroomCheck(P); } catch (e) { return null; } })() : null;
    return this._chk;
  }
  /* the Grid tool's click: take the generated ceiling off the closed-off space under the point (its FFUs and
     lights go too), or put ceiling back on a space that has none. Generate ceiling remembers both. */
  toggleCeilingAt(x, y) {
    const V = global.Plan3DViewer, P = this.plan;
    if (!(Array.isArray(P.ceilRects) && P.ceilRects.length)) { this.status('Generate the ceiling first (Generate ceiling at the top), then click spaces to take it off or put it back.'); return; }
    const sp = V.ceilingSpaceAt(P, x, y); if (!sp) { this.status('No closed-off space there.'); return; }
    const inR = (rs, px, py) => rs.some(r => px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3]);
    const over = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const has = P.ceilRects.reduce((t, r) => t + sp.rects.reduce((u, q) => u + over(r, q), 0), 0) > Math.min(4, sp.area * 0.3);
    this.edit(Q => {
      const pt = { x: +x.toFixed(2), y: +y.toFixed(2) };
      if (has) {
        Q.ceilRects = V.rectsMinus(Q.ceilRects, sp.rects);
        Q.fixtures = (Q.fixtures || []).filter(f => !inR(sp.rects, f.x, f.y));
        Q.ceilForce = (Q.ceilForce || []).filter(q => !inR(sp.rects, q.x, q.y)); (Q.ceilSkip = Q.ceilSkip || []).push(pt);
      } else {
        Q.ceilRects = Q.ceilRects.concat(sp.rects);
        Q.ceilSkip = (Q.ceilSkip || []).filter(q => !inR(sp.rects, q.x, q.y)); (Q.ceilForce = Q.ceilForce || []).push(pt);
      }
    });
    this.status(has ? 'Ceiling taken off ' + (sp.room ? sp.room.name || 'this room' : 'this space') + ' (with its FFUs and lights). Click again to put it back.' : 'Ceiling put on ' + (sp.room ? sp.room.name || 'this room' : 'this space') + '. Generate ceiling again to fill it with FFUs and lights, or place them.');
  }
  /* turn an FFU or light a quarter turn in the grid: a 2 × 4 laid across the grid takes half of two cells side by
     side, and the T-grid and tiles around it are worked out from that */
  turnFixture(o) {
    const V2 = global.Plan3DViewer; if (!V2) return;
    const G = V2.gridAt ? V2.gridAt(this.plan, o.x, o.y) : V2.ceilingGrid(this.plan), w = o.w || (G.swap ? 4 : 2), h = o.h || (G.swap ? 2 : 4);
    if (Math.abs(w - h) < 0.1) { this.status('A square fixture looks the same turned.'); return; }
    this.edit(() => { const q = V2.snapFixture({ x: o.x, y: o.y, w: h, h: w }, G); o.w = h; o.h = w; o.x = q.x; o.y = q.y; });
    const turned = V2.fixtureTurned ? V2.fixtureTurned(o, G) : false;
    this.status(turned ? 'Turned across the grid. Tees frame it on all four sides and the tiles around it are cut to fit.' : 'Back in line with the grid.');
  }
  /* the ceiling lights (not FFUs) a switch can work, from the ceiling as laid out; worked out once per change */
  lights() {
    const V2 = global.Plan3DViewer;
    if (!this._lights) { try { this._lights = V2 && V2.ceilingFixtures ? V2.ceilingFixtures(this.plan).filter(f => f.type !== 'ffu') : []; } catch (e) { this._lights = []; } }
    return this._lights;
  }
  lightAt(x, y) { return this.lights().find(f => Math.abs(x - f.x) < (f.w || 2) / 2 && Math.abs(y - f.y) < (f.h || 4) / 2) || null; }
  linkStatus(sw) { const n = (sw.lights || []).length; this.status('Light switch: ' + n + ' light' + (n === 1 ? '' : 's') + ' on it. Click a light to add or take it off, or drag a box around several. Enter or Esc when done.'); }
  /* where each beam really sits (spanning cleanroom walls in the plenum, or up at the roof), worked out once per change */
  seats() {
    const V2 = global.Plan3DViewer, P = this.plan, B = P.beams || [];
    const key = B.map(b => [b.x1, b.y1, b.x2, b.y2, b.size, b.bot].join(',')).join(';') + '|' + P.walls.length;
    if (this._seats && this._seatsKey === key) return this._seats;
    const m = new Map();
    if (V2 && V2.beamSeat && B.length) { try { const A = V2.analyze(P); for (const b of B) m.set(b, V2.beamSeat(P, A, b)); } catch (e) { /* drawn as placed */ } }
    this._seatsKey = key; return (this._seats = m);
  }
  edit(fn) { const b = this.snapshot(); fn(this.plan); this.commit(b); }
  undo() { if (!this.hist.length) return; this.fut.push(this.snapshot()); this.plan = JSON.parse(this.hist.pop()); this.afterRestore(); }
  redo() { if (!this.fut.length) return; this.hist.push(this.snapshot()); this.plan = JSON.parse(this.fut.pop()); this.afterRestore(); }
  afterRestore() { this._chk = undefined; this._seats = null; this._lights = null; this.dirty = true; this.loadBg(); if (this.sel && !this.find(this.sel)) this.sel = null; if (this.multi) { this.multi = this.multi.filter(r => this.find(r)); if (this.multi.length < 2) this.multi = null; } this.emit('select'); this.emit('change'); this.render(); }
  emit(ev, d) { const f = this.o['on' + ev[0].toUpperCase() + ev.slice(1)]; if (f) f(d); }
  find(sel) {
    if (!sel) return null;
    const list = LISTS[sel.kind];
    return list ? (this.plan[list] || []).find(x => x.id === sel.id) : (sel.kind === 'bg' ? this.plan.background : null);
  }
  selected() { return this.find(this.sel); }

  /* ---------- several things at once: box select, Shift+click, groups ---------- */
  // every piece in the plan as a selection ref
  allRefs() {
    const out = [];
    for (const [kind, list] of Object.entries(LISTS)) if (kind !== 'insert' && (kind !== 'fixture' || this.plan.ceilingMode === 'manual')) for (const o of this.plan[list] || []) if (o.id) out.push({ kind, id: o.id });
    for (const o of this.plan.inserts || []) out.push({ kind: 'insert', id: o.id });
    return out;
  }
  // the points that place a piece (for box select and moving)
  refPts(r) {
    const o = this.find(r); if (!o) return [];
    if (r.kind === 'wall' || r.kind === 'opening' || r.kind === 'beam') return [[o.x1, o.y1], [o.x2, o.y2]];
    if (r.kind === 'chase' || r.kind === 'carea' || r.kind === 'gzone') return [[o.x0, o.y0], [o.x1, o.y1]];
    if (r.kind === 'insert') { const b = this.insBox(o); return [[b.x0, b.y0], [b.x1, b.y1]]; }
    return [[o.x, o.y]];
  }
  // a piece moved by (dx, dy) from its original copy O
  shiftRef(kind, o, O, dx, dy) {
    if (kind === 'wall' || kind === 'opening' || kind === 'beam') { o.x1 = O.x1 + dx; o.y1 = O.y1 + dy; o.x2 = O.x2 + dx; o.y2 = O.y2 + dy; }
    else if (kind === 'chase' || kind === 'carea' || kind === 'gzone') { o.x0 = O.x0 + dx; o.y0 = O.y0 + dy; o.x1 = O.x1 + dx; o.y1 = O.y1 + dy; if (kind === 'gzone') { if (isFinite(O.ox)) o.ox = O.ox + dx; if (isFinite(O.oy)) o.oy = O.oy + dy; } }
    else { o.x = O.x + dx; o.y = O.y + dy; }
  }
  isMulti(r) { return !!(this.multi && r && this.multi.some(m => m.kind === r.kind && m.id === r.id)); }
  setMulti(list) {
    const seen = new Set(), L = (list || []).filter(r => { const k = r.kind + ':' + r.id; if (seen.has(k) || !this.find(r)) return false; seen.add(k); return true; });
    if (L.length > 1) { this.multi = L; this.sel = null; } else { this.multi = null; this.sel = L[0] || null; }
    this.emit('select'); this.render();
  }
  // everything grouped with r (Ctrl+G), or just r
  groupOf(r) {
    const o = this.find(r); if (!o || !o.gid) return [r];
    return this.allRefs().filter(q => { const x = this.find(q); return x && x.gid === o.gid; });
  }
  // the doors and windows sitting in a set of walls go with them
  withOpenings(refs) {
    const ws = refs.filter(r => r.kind === 'wall').map(r => this.find(r)).filter(Boolean), out = refs.slice();
    for (const op of this.plan.openings) {
      if (refs.some(r => r.kind === 'opening' && r.id === op.id)) continue;
      if (ws.some(w => op.unit === w.id || (segProj(op.x1, op.y1, w.x1, w.y1, w.x2, w.y2).d < (w.t || 0.25) && segProj(op.x2, op.y2, w.x1, w.y1, w.x2, w.y2).d < (w.t || 0.25)))) out.push({ kind: 'opening', id: op.id });
    }
    return out;
  }
  groupSel(on) {
    const refs = this.multi || (this.sel ? [this.sel] : []); if (!refs.length) return;
    const gid = on ? uid() : null;
    this.edit(() => { for (const r of refs) { const o = this.find(r); if (!o) continue; if (gid) o.gid = gid; else delete o.gid; } });
    this.emit('select'); this.render();
  }

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
    this.tool = t; this.draft = null; this.cal = null; this.meas = null; this.beamA = null; this.typed = ''; this.drag = null;
    if (t !== 'select') { this.sel = null; this.multi = null; }
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
    // most items back up against a wall; free ones (an island, a table, a rug, a light) go anywhere
    if (!D.free) {
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
  /* where an electrical device goes: on the face of the nearest wall (within 2′), facing into the room */
  devicePlace(x, y, type, keep) {
    const V = global.Plan3DViewer, D = V && V.DEVICES[type]; if (!D) return null;
    const hit = this.wallAt(x, y, 2 * this.view.s + 8); if (!hit || hit.p.len < 0.3) return null;
    const W = hit.w, L = hit.p.len, ux = (W.x2 - W.x1) / L, uy = (W.y2 - W.y1) / L, nx = -uy, ny = ux;
    const side = ((x - hit.p.x) * nx + (y - hit.p.y) * ny) >= 0 ? 1 : -1, g = 1 / 12;
    let sAlong = Math.round(hit.p.tc * L / g) * g; sAlong = Math.max(D.w / 2, Math.min(L - D.w / 2, sAlong));
    const off = (W.t || 0.25) / 2;
    return { type, x: W.x1 + ux * sAlong + nx * side * off, y: W.y1 + uy * sAlong + ny * side * off, a: Math.atan2(ny * side, nx * side), h: keep && keep.h != null ? keep.h : D.h };
  }
  drawDevice(dv, ghost) {
    const V = global.Plan3DViewer, D = V && V.DEVICES[dv.type]; if (!D) return;
    const g = this.g, X = this.sx(dv.x), Y = this.sy(dv.y), ca = Math.cos(dv.a || 0), sa = Math.sin(dv.a || 0), r = Math.max(5, Math.min(9, this.view.s * 0.35));
    const cx = X + ca * r * 1.1, cy = Y + sa * r * 1.1;
    g.save(); g.lineWidth = 1.4; g.strokeStyle = ghost ? COL.draft : '#f2c84b'; g.fillStyle = ghost ? 'rgba(242,200,75,.25)' : '#2a3338';
    g.beginPath(); g.moveTo(X, Y); g.lineTo(cx - ca * r, cy - sa * r); g.stroke();
    g.beginPath(); if (dv.type === 'panel') g.rect(cx - r, cy - r * 0.7, r * 2, r * 1.4); else g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = ghost ? COL.draft : '#f2c84b'; g.font = `600 ${D.short.length > 2 ? 7 : 9}px Consolas, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(D.short, cx, cy + 0.5);
    g.restore();
  }
  hitTest(x, y) {
    const P = this.plan, tol = 7 / this.view.s;
    for (let i = (P.beams || []).length - 1; i >= 0; i--) { const b = P.beams[i], bw = (global.Plan3DViewer ? global.Plan3DViewer.beamSize(b).bf / 12 : 0.5) / 2 + tol; if (segProj(x, y, b.x1, b.y1, b.x2, b.y2).d < bw) return { kind: 'beam', id: b.id }; }
    for (let i = (P.columns || []).length - 1; i >= 0; i--) { const c = P.columns[i], r = (c.size || 0.67) / 2 + tol; if (Math.abs(x - c.x) < r && Math.abs(y - c.y) < r) return { kind: 'column', id: c.id }; }
    for (let i = (P.devices || []).length - 1; i >= 0; i--) { const dv = P.devices[i], r = Math.max(5, Math.min(9, this.view.s * 0.35)) / this.view.s; if (Math.hypot(x - (dv.x + Math.cos(dv.a || 0) * r * 1.1), y - (dv.y + Math.sin(dv.a || 0) * r * 1.1)) < r * 1.3) return { kind: 'device', id: dv.id }; }
    for (let i = P.openings.length - 1; i >= 0; i--) { const o = P.openings[i]; if (segProj(x, y, o.x1, o.y1, o.x2, o.y2).d < (o.t || 0.25) / 2 + tol) return { kind: 'opening', id: o.id }; }
    const V = global.Plan3DViewer;
    if (V && V.itemCorners) for (let i = (P.items || []).length - 1; i >= 0; i--) { const c = V.itemCorners(P.items[i]); if (inPoly(x, y, c)) return { kind: 'item', id: P.items[i].id }; }
    for (let i = P.rooms.length - 1; i >= 0; i--) { const r = P.rooms[i]; if (Math.abs(x - r.x) < 50 / this.view.s && Math.abs(y - r.y) < 14 / this.view.s) return { kind: 'room', id: r.id }; }
    for (let i = P.chases.length - 1; i >= 0; i--) { const k = P.chases[i]; if (x >= Math.min(k.x0, k.x1) - tol && x <= Math.max(k.x0, k.x1) + tol && y >= Math.min(k.y0, k.y1) - tol && y <= Math.max(k.y0, k.y1) + tol) return { kind: 'chase', id: k.id }; }
    for (let i = (P.gridZones || []).length - 1; i >= 0; i--) {
      const k = P.gridZones[i], x0 = Math.min(k.x0, k.x1), x1 = Math.max(k.x0, k.x1), y0 = Math.min(k.y0, k.y1), y1 = Math.max(k.y0, k.y1);
      const onLabel = x <= x1 && x >= x1 - 80 / this.view.s && y >= y0 && y <= y0 + 18 / this.view.s;
      const onEdge = x >= x0 - tol && x <= x1 + tol && y >= y0 - tol && y <= y1 + tol && !(x > x0 + tol && x < x1 - tol && y > y0 + tol && y < y1 - tol);
      if (onLabel || onEdge) return { kind: 'gzone', id: k.id };
    }
    for (let i = (P.ceilAreas || []).length - 1; i >= 0; i--) {
      const k = P.ceilAreas[i], x0 = Math.min(k.x0, k.x1), x1 = Math.max(k.x0, k.x1), y0 = Math.min(k.y0, k.y1), y1 = Math.max(k.y0, k.y1);
      const onLabel = x >= x0 && x <= x0 + 90 / this.view.s && y >= y0 && y <= y0 + 18 / this.view.s;
      const onEdge = x >= x0 - tol && x <= x1 + tol && y >= y0 - tol && y <= y1 + tol && !(x > x0 + tol && x < x1 - tol && y > y0 + tol && y < y1 - tol);
      if (onLabel || onEdge) return { kind: 'carea', id: k.id };
    }
    const h = this.wallAt(x, y, 7); if (h) return { kind: 'wall', id: h.w.id };
    if (P.ceilingMode === 'manual' && this.showCeil !== false) for (let i = (P.fixtures || []).length - 1; i >= 0; i--) { const f = P.fixtures[i]; if (f.id && Math.abs(x - f.x) < (f.w || 2) / 2 && Math.abs(y - f.y) < (f.h || 4) / 2) return { kind: 'fixture', id: f.id }; }
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
    if (this.linkSw) {
      const sw = (this.plan.devices || []).find(d => d.id === this.linkSw), V2 = global.Plan3DViewer;
      if (!sw || T !== 'select') this.linkSw = null;
      else {
        const f = this.lightAt(p.x, p.y);
        if (f) { const k = V2.lightKey(f); this.edit(() => { const L = sw.lights = Array.isArray(sw.lights) ? sw.lights : []; const i = L.indexOf(k); if (i >= 0) L.splice(i, 1); else L.push(k); }); this.linkStatus(sw); return; }
        this.drag = { kind: 'linkbox', x0: p.x, y0: p.y, x1: p.x, y1: p.y }; this.c.setPointerCapture(e.pointerId); return;
      }
    }
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
      // Shift: add to or take out of the selection; Shift-drag on empty space draws a box around things
      if (e.shiftKey) {
        if (!hit) { this.drag = { kind: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: true }; this.c.setPointerCapture(e.pointerId); return; }
        const cur = this.multi ? this.multi.slice() : (this.sel ? [this.sel] : []), grp = this.groupOf(hit);
        const inIt = cur.some(m => m.kind === hit.kind && m.id === hit.id);
        this.setMulti(inIt ? cur.filter(m => !grp.some(g => g.kind === m.kind && g.id === m.id)) : cur.concat(grp)); return;
      }
      // several things selected (or a group): dragging one of them moves them all
      const grp = hit && !this.isMulti(hit) ? this.groupOf(hit) : null;
      if (hit && (this.isMulti(hit) || (grp && grp.length > 1))) {
        if (!this.isMulti(hit)) this.setMulti(grp);
        const refs = this.withOpenings(this.multi);
        this.drag = { kind: 'gmove', sx: p.x, sy: p.y, before: this.snapshot(), moved: false, items: refs.map(r => { const o = this.find(r); return o && { r, o, O: JSON.parse(JSON.stringify(o)) }; }).filter(Boolean) };
        this.c.setPointerCapture(e.pointerId); this.render(); return;
      }
      this.multi = null;
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
      else if (T === 'overhead') { const W = pv.wall, V = global.Plan3DViewer, wh = W && V ? (V.isHard(W) ? (this.plan.ceiling || 8) : V.isFrame(W) ? (W.h || this.plan.ceiling || 8) : V.shellHeight(this.plan, W)) : 16; o.head = Math.max(7, Math.min(14, wh - 2)); }
      else o.head = 7;
      this.edit(P => P.openings.push(o)); return;
    }
    if (T === 'piece') {
      if (!this.pieces || this.pieces.tool === 'select') return;
      const g = this.pieces.ghostAt({ x: p.x, y: p.y }); if (!g) return;
      const PC = global.Plan3DBuilder && global.Plan3DBuilder.PIECES[this.pieces.tool];
      // a panel: drag to lay a whole run of them (a plain click still places one)
      if (PC && PC.widths && g.mode !== 'replace') { this.drag = { kind: 'run', S: g, px: p.px, py: p.py }; this.c.setPointerCapture(e.pointerId); return; }
      if (this.pieces.place(g)) { this.pieceGhost = this.pieces.ghostAt({ x: p.x, y: p.y }); this.render(); }
      return;
    }
    if (T === 'beam') {
      const s = this.snap(p.x, p.y, this.beamA || null, { free: e.altKey });
      if (!this.beamA) { this.beamA = { x: s.x, y: s.y }; this.status('Click the other end of the beam. Esc to stop.'); }
      else { const b = { id: uid(), x1: this.beamA.x, y1: this.beamA.y, x2: s.x, y2: s.y, size: this.beamSize || 'W12x26' }; if (Math.hypot(b.x2 - b.x1, b.y2 - b.y1) > 0.5) this.edit(P => { (P.beams = P.beams || []).push(b); }); this.beamA = null; this.status('Beam placed. Click to start another.'); }
      this.render(); return;
    }
    if (T === 'measure') {
      const s = this.snap(p.x, p.y, this.meas && !this.meas.p2 ? this.meas.p1 : null, { free: e.altKey });
      if (!this.meas || this.meas.p2) { this.meas = { p1: { x: s.x, y: s.y } }; this.status('Click the other end. Alt for any angle.'); }
      else { this.meas.p2 = { x: s.x, y: s.y }; const d = Math.hypot(this.meas.p2.x - this.meas.p1.x, this.meas.p2.y - this.meas.p1.y); this.status('Measured ' + fmt(d) + '. Click to start another, Esc to clear.'); }
      this.render(); return;
    }
    if (T === 'column') {
      const g = this.snapIn / 12 || 1 / 12, c = { id: uid(), x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g, size: this.columnSize || 0.67, kind: this.columnKind || 'steel' };
      this.edit(P => { (P.columns = P.columns || []).push(c); }); return;
    }
    if (T === 'elec') {
      const q = this.devicePlace(p.x, p.y, this.deviceType || 'outlet'); if (!q) { this.status('Click on or next to a wall to put it there.'); return; }
      const dv = { id: uid(), type: q.type, x: q.x, y: q.y, a: q.a, h: q.h };
      this.edit(P => { (P.devices = P.devices || []).push(dv); }); return;
    }
    if (T === 'item') {
      const q = this.itemPlace(p.x, p.y, this.itemType); if (!q) return;
      const it = { id: uid(), type: q.type, x: q.x, y: q.y, a: q.a, w: q.w, d: q.d };
      this.edit(P => { (P.items = P.items || []).push(it); }); return;
    }
    if (T === 'grid') {
      const s = this.snap(p.x, p.y, null);
      this.drag = { kind: 'gzone', x0: s.x, y0: s.y, x1: s.x, y1: s.y, px: p.x, py: p.y }; this.c.setPointerCapture(e.pointerId); return;
    }
    if (T === 'carea') {
      const s = this.snap(p.x, p.y, null);
      this.drag = { kind: 'carea', x0: s.x, y0: s.y, x1: s.x, y1: s.y }; this.c.setPointerCapture(e.pointerId); return;
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
    if (D && D.kind === 'box') { D.x1 = p.x; D.y1 = p.y; this.render(); return; }
    if (D && D.kind === 'linkbox') { D.x1 = p.x; D.y1 = p.y; this.render(); return; }
    if (D && D.kind === 'gmove') {
      let dx = p.x - D.sx, dy = p.y - D.sy;
      if (!D.moved && Math.hypot(dx, dy) * this.view.s < 4) return;
      D.moved = true;
      // catch on a wall end: the nearest moved wall end to any other wall end, within 10 px
      const moving = new Set(D.items.filter(it => it.r.kind === 'wall').map(it => it.o)), tol = 10 / this.view.s; let best = null, bd = tol;
      if (!e.altKey) for (const it of D.items) if (it.r.kind === 'wall') for (const [ex, ey] of [[it.O.x1 + dx, it.O.y1 + dy], [it.O.x2 + dx, it.O.y2 + dy]]) for (const w of this.plan.walls) { if (moving.has(w)) continue; for (const [px, py] of [[w.x1, w.y1], [w.x2, w.y2]]) { const d = Math.hypot(px - ex, py - ey); if (d < bd) { bd = d; best = [px - ex, py - ey]; } } }
      if (best) { dx += best[0]; dy += best[1]; } else { const g = this.snapIn / 12 || 1 / 48; dx = Math.round(dx / g) * g; dy = Math.round(dy / g) * g; }
      // FFUs and lights moving together land in the ceiling grid's cells
      const fx = D.items.find(it => it.r.kind === 'fixture');
      if (fx && !best && !e.altKey && global.Plan3DViewer) { const V = global.Plan3DViewer, q = V.snapFixture({ x: fx.O.x + dx, y: fx.O.y + dy, w: fx.O.w || 2, h: fx.O.h || 4 }, V.gridAt(this.plan, fx.O.x + dx, fx.O.y + dy)); dx = q.x - fx.O.x; dy = q.y - fx.O.y; }
      for (const it of D.items) this.shiftRef(it.r.kind, it.o, it.O, dx, dy);
      // and each one sits in a cell of its own (a layout drawn a hair off the grid still lands cleanly)
      if (fx && !best && !e.altKey && global.Plan3DViewer) {
        const V = global.Plan3DViewer, taken = new Set();
        for (const it of D.items) if (it.r.kind === 'fixture') { const q = V.snapFixture({ x: it.o.x, y: it.o.y, w: it.o.w || 2, h: it.o.h || 4 }, V.gridAt(this.plan, it.o.x, it.o.y)), k = Math.round(q.x * 4) + ',' + Math.round(q.y * 4); if (!taken.has(k)) { taken.add(k); it.o.x = q.x; it.o.y = q.y; } }
      }
      this.status('Moving ' + this.multi.length + ' pieces: ' + fmt(Math.hypot(dx, dy)) + (best ? ' · caught on a wall end' : ''));
      this.emit('live'); this.render(); return;
    }
    if (D && D.kind === 'move') {
      let dx = p.x - D.sx, dy = p.y - D.sy;
      if (!D.moved && Math.hypot(dx, dy) * this.view.s < 4) return;
      D.moved = true;
      const g = this.snapIn / 12 || 1 / 48; dx = Math.round(dx / g) * g; dy = Math.round(dy / g) * g;
      const o = D.obj, O = D.orig;
      if (D.sel.kind === 'wall' && o.piece) {
        // a snap-together panel moves on its own; its ends catch on other walls' ends
        const tol = 12 / this.view.s; let best = null, bd = tol;
        const rx = p.x - D.sx, ry = p.y - D.sy;
        for (const w of this.plan.walls) { if (w === o) continue; for (const [px, py] of [[w.x1, w.y1], [w.x2, w.y2]]) for (const [ex, ey] of [[O.x1 + rx, O.y1 + ry], [O.x2 + rx, O.y2 + ry]]) { const d = Math.hypot(px - ex, py - ey); if (d < bd) { bd = d; best = [px - ex + rx, py - ey + ry]; } } }
        if (best) { dx = best[0]; dy = best[1]; }
        o.x1 = O.x1 + dx; o.y1 = O.y1 + dy; o.x2 = O.x2 + dx; o.y2 = O.y2 + dy;
        D.ops.forEach(k => { k.o.x1 = k.x1 + dx; k.o.y1 = k.y1 + dy; k.o.x2 = k.x2 + dx; k.o.y2 = k.y2 + dy; });
        this.snapPt = best ? { x: o.x1, y: o.y1 } : null;
      } else if (D.sel.kind === 'wall') {
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
      } else if (D.sel.kind === 'beam') { o.x1 = O.x1 + dx; o.y1 = O.y1 + dy; o.x2 = O.x2 + dx; o.y2 = O.y2 + dy; }
      else if (D.sel.kind === 'fixture' && e.altKey) { o.x = O.x + (p.x - D.sx); o.y = O.y + (p.y - D.sy); this.status('Moving freely (Alt): ' + fmt(Math.hypot(o.x - O.x, o.y - O.y))); }
      else if (D.sel.kind === 'fixture') { const V = global.Plan3DViewer, G = V.gridAt(this.plan, O.x + (p.x - D.sx), O.y + (p.y - D.sy)), q = V.snapFixture({ x: O.x + (p.x - D.sx), y: O.y + (p.y - D.sy), w: O.w || 2, h: O.h || 4 }, G); o.x = q.x; o.y = q.y; }
      else if (D.sel.kind === 'gzone') { this.shiftRef('gzone', o, O, dx, dy); }
      else if (D.sel.kind === 'chase' || D.sel.kind === 'carea') { o.x0 = O.x0 + dx; o.y0 = O.y0 + dy; o.x1 = O.x1 + dx; o.y1 = O.y1 + dy; }
      else if (D.sel.kind === 'room') { o.x = O.x + (p.x - D.sx); o.y = O.y + (p.y - D.sy); }
      else if (D.sel.kind === 'column') { const g = this.snapIn / 12 || 1 / 12; o.x = Math.round((O.x + (p.x - D.sx)) / g) * g; o.y = Math.round((O.y + (p.y - D.sy)) / g) * g; }
      else if (D.sel.kind === 'device') {
        const q = this.devicePlace(O.x + (p.x - D.sx), O.y + (p.y - D.sy), o.type, o);
        if (q) { o.x = q.x; o.y = q.y; o.a = q.a; }
      }
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
    if (D && (D.kind === 'chase' || D.kind === 'carea' || D.kind === 'gzone')) { const s = this.snap(p.x, p.y, null); D.x1 = s.x; D.y1 = s.y; this.render(); return; }
    if (D && D.kind === 'run') {
      if (!D.moved && Math.hypot(p.px - D.px, p.py - D.py) < 5) return;
      D.moved = true; D.run = this.pieces.runAt(D.S, { x: p.x, y: p.y }); this.pieceGhost = D.run;
      const R = D.run; this.status(R.n > 1 ? R.n + ' panels, ' + fmt(R.w * R.n) + ' — let go to place them' : this.pieces.label({ ...R.pieces[0], tool: R.tool, mode: R.mode }));
      this.render(); return;
    }
    if (this.tool === 'piece' && this.pieces && this.pieces.tool !== 'select') {
      this.pieceGhost = this.pieces.ghostAt({ x: p.x, y: p.y });
      this.status(this.pieceGhost ? this.pieces.label(this.pieceGhost) : '');
      this.render(); this.emit('cursor', p); return;
    }
    // hover feedback
    if (this.tool === 'elec') { const V = global.Plan3DViewer, q = this.devicePlace(p.x, p.y, this.deviceType || 'outlet'); this.status(q ? V.DEVICES[q.type].label + ' at ' + fmtIn(q.h) + ' to center. Click to place.' : 'Move onto a wall.'); }
    if (this.tool === 'item') { const q = this.itemPlace(p.x, p.y, this.itemType); this.status(q ? (global.Plan3DViewer.ITEMS[q.type].label + (q.wall ? ' — against the wall. Click to place.' : ' — R turns it. Click to place.')) : ''); }
    if (this.tool === 'select') this.hover = this.hitTest(p.x, p.y);
    this.render();
    this.emit('cursor', p);
  }
  up(e) {
    const D = this.drag; this.drag = null;
    try { this.c.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
    if (!D) return;
    if (D.kind === 'linkbox') {
      const sw = (this.plan.devices || []).find(d => d.id === this.linkSw), V2 = global.Plan3DViewer;
      const x0 = Math.min(D.x0, D.x1), x1 = Math.max(D.x0, D.x1), y0 = Math.min(D.y0, D.y1), y1 = Math.max(D.y0, D.y1);
      const add = this.lights().filter(f => f.x >= x0 && f.x <= x1 && f.y >= y0 && f.y <= y1).map(f => V2.lightKey(f));
      if (sw && add.length) { this.edit(() => { const L = sw.lights = Array.isArray(sw.lights) ? sw.lights : []; for (const k of add) if (!L.includes(k)) L.push(k); }); this.linkStatus(sw); }
      this.render(); return;
    }
    if (D.kind === 'box') {
      const x0 = Math.min(D.x0, D.x1), x1 = Math.max(D.x0, D.x1), y0 = Math.min(D.y0, D.y1), y1 = Math.max(D.y0, D.y1);
      if (x1 - x0 > 1e-6 && y1 - y0 > 1e-6) {
        const inside = this.allRefs().filter(r => { const P = this.refPts(r); return P.length && P.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1); });
        const cur = D.add ? (this.multi ? this.multi.slice() : (this.sel ? [this.sel] : [])) : [];
        this.setMulti(cur.concat(inside));
        if (this.multi) this.status(this.multi.length + ' pieces selected. Drag one to move them all; Delete removes them; Ctrl+G groups them.');
      }
      this.render(); return;
    }
    if (D.kind === 'gmove') { if (D.moved) { this.commit(D.before); this.emit('select'); } this.status(''); this.render(); return; }
    if (D.kind === 'end') { this.commit(D.before); this.emit('select'); }
    else if (D.kind === 'move') { if (D.moved) { this.commit(D.before); this.emit('select'); } }
    else if (D.kind === 'run') {
      const P = this.cursor || { x: D.S.x1, y: D.S.y1 };
      if (D.moved && D.run) this.pieces.placeRun(D.run); else this.pieces.place(D.S);
      this.pieceGhost = this.pieces.ghostAt({ x: P.x, y: P.y }); this.render();
    }
    else if (D.kind === 'gzone') {
      const x0 = Math.min(D.x0, D.x1), x1 = Math.max(D.x0, D.x1), y0 = Math.min(D.y0, D.y1), y1 = Math.max(D.y0, D.y1);
      if (x1 - x0 < 1 && y1 - y0 < 1) { this.toggleCeilingAt(D.px, D.py); this.render(); return; }
      if (x1 - x0 > 2 && y1 - y0 > 2) {
        const V = global.Plan3DViewer, G = V.ceilingGrid(this.plan);
        // a new section starts turned a quarter turn from the main grid, its lines from its own corner
        const k = { id: uid(), x0, y0, x1, y1, swap: !G.swap };
        this.edit(Q => (Q.gridZones = Q.gridZones || []).push(k)); this.sel = { kind: 'gzone', id: k.id }; this.emit('select');
        this.status('Grid section placed, turned a quarter turn. Change its direction or where its lines start on the right.');
      }
      this.render();
    }
    else if (D.kind === 'carea') {
      const x0 = Math.min(D.x0, D.x1), x1 = Math.max(D.x0, D.x1), y0 = Math.min(D.y0, D.y1), y1 = Math.max(D.y0, D.y1);
      if (x1 - x0 > 1 && y1 - y0 > 1) {
        // starts a foot above the room's ceiling when the plenum has room for it, otherwise a foot below
        const V = global.Plan3DViewer, P = this.plan, H = P.ceiling || 8, PL = +P.plenum || 0;
        const k = { id: uid(), x0, y0, x1, y1, ceiling: PL >= 1.5 ? H + 1 : Math.max(6, H - 1) };
        this.edit(Q => (Q.ceilAreas = Q.ceilAreas || []).push(k)); this.sel = { kind: 'carea', id: k.id }; this.emit('select');
        this.status('Ceiling area placed. Set its height on the right; bulkheads fill the step where it meets the rest of the ceiling.');
      }
      this.render();
    }
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
    // arrow keys nudge what's selected: 1″, Shift 6″, Alt ⅛″ (no snapping, so FFUs and lights can go exactly where you want)
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (dir && !e.ctrlKey && !e.metaKey && (this.multi || (this.sel && this.sel.kind !== 'bg'))) {
      const st = (e.shiftKey ? 6 : e.altKey ? 0.125 : 1) / 12, refs = this.withOpenings(this.multi || [this.sel]);
      this.edit(() => { for (const r of refs) { const o = this.find(r); if (o) this.shiftRef(r.kind, o, JSON.parse(JSON.stringify(o)), dir[0] * st, dir[1] * st); } });
      this.status('Nudged ' + (e.shiftKey ? '6″' : e.altKey ? '⅛″' : '1″') + '. Arrow keys: 1″ · Shift 6″ · Alt ⅛″. Hold Alt while dragging to move without snapping.');
      return true;
    }
    if (this.linkSw && (k === 'Escape' || k === 'Enter' || k === 'l' || k === 'L')) { this.linkSw = null; this.status(''); this.render(); return true; }
    if ((k === 'l' || k === 'L') && !e.ctrlKey && !e.metaKey && this.tool === 'select' && this.sel && this.sel.kind === 'device') {
      const o = this.selected(); if (o && o.type === 'switch') { this.linkSw = o.id; this.linkStatus(o); this.render(); return true; }
    }
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
    if ((k === 'r' || k === 'R') && !e.ctrlKey && this.sel && this.sel.kind === 'fixture') { const o = this.selected(); if (o) this.turnFixture(o); return true; }
    if ((k === 'r' || k === 'R') && !e.ctrlKey && this.tool === 'item') { this.itemRot = ((this.itemRot || 0) + 1) % 4; this.render(); return true; }
    if ((k === 'r' || k === 'R') && !e.ctrlKey && this.sel && this.sel.kind === 'item') { const o = this.selected(); if (o) this.edit(() => { o.a = (o.a || 0) + Math.PI / 2 * (e.shiftKey ? -1 : 1); }); return true; }
    if ((k === 'r' || k === 'R') && !e.ctrlKey && this.sel && this.sel.kind === 'insert') { const o = this.selected(); if (o) this.edit(() => { o.rot = (((o.rot || 0) + (e.shiftKey ? 3 : 1)) % 4); }); return true; }
    if (k === 'Escape' && this.multi) { this.multi = null; this.emit('select'); this.render(); return true; }
    if (k === 'Escape' && this.beamA) { this.beamA = null; this.status(''); this.render(); return true; }
    if (k === 'Escape' && this.meas) { this.meas = null; this.status(''); this.render(); return true; }
    if (k === 'Escape') { if (this.draft) this.endChain(); else if (this.cal) { this.cal = null; this.render(); } else if (this.tool !== 'select') this.setTool('select'); else { this.sel = null; this.emit('select'); this.render(); } return true; }
    if ((k === 'Delete' || k === 'Backspace') && (this.sel || this.multi)) { this.deleteSel(); return true; }
    return false;
  }
  deleteSel() {
    if (this.multi) {
      const M = this.withOpenings(this.multi);
      this.edit(P => { for (const r of M) { const L = LISTS[r.kind]; if (L) P[L] = (P[L] || []).filter(x => x.id !== r.id); } const gone = new Set(M.filter(r => r.kind === 'wall').map(r => r.id)); P.openings = P.openings.filter(o => !gone.has(o.unit)); });
      this.multi = null; this.emit('select'); this.render(); return;
    }
    const s = this.sel; if (!s) return;
    if (s.kind === 'bg') { this.edit(P => { P.background = null; }); this.bgImg = null; }
    else { const list = LISTS[s.kind]; this.edit(P => { P[list] = (P[list] || []).filter(x => x.id !== s.id); if (s.kind === 'wall') P.openings = P.openings.filter(o => o.unit !== s.id); }); }
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
    // things up on the wall or hung from the ceiling are drawn dashed, see-through
    const up = it.type === 'upper' || !!D.ceil || (D.z || 0) > 3;
    g.fillStyle = ghost ? 'rgba(242,200,75,.3)' : up ? 'rgba(160,175,182,.18)' : it.type === 'rug' ? 'rgba(160,150,130,.25)' : '#3a464c'; g.fill();
    g.strokeStyle = ghost ? COL.draft : '#b9c4c9'; g.lineWidth = 1.1; if (up) g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]);
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
    if (s > 12) { const [X, Y] = P(0, 0); g.font = '10px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ghost ? COL.draft : '#e8edef'; const lbl = { base: 'BASE', sinkbase: 'SINK', upper: 'UPPER', tall: 'PANTRY', island: 'ISLAND', range: '', fridge: 'REF', dishwasher: 'DW', toilet: '', vanity: '', tub: 'TUB', shower: 'SHWR', washer: 'W', dryer: 'D', waterheater: 'WH', furnace: 'FURN' }[it.type] ?? D.label.toUpperCase().replace(/ \(.*\)| WITH .*| AND .*|, .*/g, ''); if (lbl && Math.min(w, d) * s > 22) g.fillText(lbl, X, Y); }
    g.restore();
  }
  /* chases, walls, openings and room labels of a plan (the main plan, or a placed building moved into place) */
  drawContent(P) {
    const g = this.g, s = this.view.s, V = global.Plan3DViewer, KC = {};
    if (V && V.WALL_KINDS) for (const k in V.WALL_KINDS) KC[k] = V.WALL_KINDS[k].plan;
    // ceiling areas: a dashed outline with the area's ceiling height
    for (const k of P.ceilAreas || []) {
      const X = this.sx(Math.min(k.x0, k.x1)), Y = this.sy(Math.min(k.y0, k.y1)), W = Math.abs(k.x1 - k.x0) * s, H = Math.abs(k.y1 - k.y0) * s;
      g.save(); g.fillStyle = 'rgba(127,211,227,.07)'; g.fillRect(X, Y, W, H);
      g.strokeStyle = 'rgba(127,211,227,.85)'; g.lineWidth = 1.4; g.setLineDash([8, 5]); g.strokeRect(X, Y, W, H); g.setLineDash([]);
      g.font = '600 11px Consolas, monospace'; g.fillStyle = '#9fdbe8'; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText('CLG ' + (V && V.fmtFt ? V.fmtFt(+k.ceiling || P.ceiling || 8) : (k.ceiling || '')), X + 5, Y + 4); g.restore();
    }
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
      } else if (o.type === 'overhead') {
        // overhead door: the curtain line and the dashed outline of the door when it's up, inside
        g.strokeStyle = '#c9d2d6'; g.lineWidth = 2; g.beginPath(); g.moveTo(this.sx(o.x1), this.sy(o.y1)); g.lineTo(this.sx(o.x2), this.sy(o.y2)); g.stroke();
        const dd = Math.min(len, (o.head || 12)) * 0.9, sd = sw;
        g.setLineDash([6, 4]); g.lineWidth = 1; g.strokeStyle = COL.wallLine; g.beginPath();
        g.moveTo(this.sx(o.x1 + nx * sd * t / 2), this.sy(o.y1 + ny * sd * t / 2)); g.lineTo(this.sx(o.x1 + nx * sd * (t / 2 + dd)), this.sy(o.y1 + ny * sd * (t / 2 + dd))); g.lineTo(this.sx(o.x2 + nx * sd * (t / 2 + dd)), this.sy(o.y2 + ny * sd * (t / 2 + dd))); g.lineTo(this.sx(o.x2 + nx * sd * t / 2), this.sy(o.y2 + ny * sd * t / 2)); g.stroke(); g.setLineDash([]);
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
    // building columns: a filled square with its cross
    // steel beams: the flange outline, dashed (they're overhead), with the centre line. A beam that bears on
    // the cleanroom walls is drawn where it sits, with a bearing mark on each wall; the rest of the line as
    // drawn or imported stays faint.
    const seats = this.seats();
    for (const b of P.beams || []) {
      const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1); if (L < 0.05) continue;
      const hw = (global.Plan3DViewer ? global.Plan3DViewer.beamSize(b).bf / 12 : 0.5) / 2, q = seats.get(b);
      const run = (a, faint) => {
        const l = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) || 1, nx = -(a.y2 - a.y1) / l * hw, ny = (a.x2 - a.x1) / l * hw;
        g.save(); g.strokeStyle = faint ? 'rgba(201,166,107,.3)' : '#c9a66b'; g.lineWidth = 1.3; g.setLineDash([7, 4]); g.beginPath();
        for (const sd of [1, -1]) { g.moveTo(this.sx(a.x1 + nx * sd), this.sy(a.y1 + ny * sd)); g.lineTo(this.sx(a.x2 + nx * sd), this.sy(a.y2 + ny * sd)); }
        g.stroke(); g.setLineDash([12, 3, 2, 3]); g.lineWidth = 0.8; g.beginPath(); g.moveTo(this.sx(a.x1), this.sy(a.y1)); g.lineTo(this.sx(a.x2), this.sy(a.y2)); g.stroke(); g.restore();
      };
      if (q && q.onWalls) {
        if (Math.hypot(q.x1 - b.x1, q.y1 - b.y1) + Math.hypot(q.x2 - b.x2, q.y2 - b.y2) > 0.1) run(b, true);
        run(q, false);
        g.save(); g.fillStyle = '#c9a66b'; for (const [x, y] of [[q.x1, q.y1], [q.x2, q.y2]]) { const r = Math.max(3, hw * this.view.s); g.fillRect(this.sx(x) - r, this.sy(y) - r, 2 * r, 2 * r); } g.restore();
      } else run(b, false);
    }
    if (this.tool === 'beam' && this.beamA && this.cursor) { const q = this.snap(this.cursor.x, this.cursor.y, this.beamA, {}); g.save(); g.strokeStyle = COL.draft; g.setLineDash([7, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(this.sx(this.beamA.x), this.sy(this.beamA.y)); g.lineTo(this.sx(q.x), this.sy(q.y)); g.stroke(); g.restore(); this.status('Beam ' + fmt(Math.hypot(q.x - this.beamA.x, q.y - this.beamA.y)) + ' — click the other end.'); }
    // a generated ceiling: its T-grid, drawn over the rooms it was laid out in
    if (Array.isArray(P.ceilRects) && P.ceilRects.length && this.showCeil !== false && V2 && V2.ceilingGrid) {
      const key = JSON.stringify([P.ceilRects.length, P.ceilRects[0], P.gridZones || [], P.ceilGrid || null, P.walls.length, (P.fixtures || []).map(f => [f.x, f.y, f.w, f.h])]);
      if (this._gridKey !== key) { try { this._gridLines = V2.generatedGridLines(P) || []; } catch (e) { this._gridLines = []; } this._gridKey = key; }
      g.save(); g.strokeStyle = 'rgba(127,211,227,.32)'; g.lineWidth = 1; g.beginPath();
      for (const q of this._gridLines) { g.moveTo(this.sx(q[0]), this.sy(q[1])); g.lineTo(this.sx(q[2]), this.sy(q[3])); }
      g.stroke(); g.restore();
    }
    // grid sections: an amber outline with which way their tiles run
    for (const k of (Array.isArray(P.ceilRects) && P.ceilRects.length ? P.gridZones || [] : [])) {
      const X = this.sx(Math.min(k.x0, k.x1)), Y = this.sy(Math.min(k.y0, k.y1)), W = Math.abs(k.x1 - k.x0) * s, H = Math.abs(k.y1 - k.y0) * s;
      g.save(); g.strokeStyle = 'rgba(242,200,75,.85)'; g.lineWidth = 1.4; g.setLineDash([6, 4]); g.strokeRect(X, Y, W, H); g.setLineDash([]);
      g.font = '600 11px Consolas, monospace'; g.fillStyle = '#f2c84b'; g.textAlign = 'right'; g.textBaseline = 'top';
      g.fillText('GRID ' + (k.swap ? '4′ ↔' : '4′ ↕'), X + W - 5, Y + 4); g.restore();
    }
    // FFUs and lights from a drawn ceiling (drag them; they land in the grid's cells)
    if (P.ceilingMode === 'manual' && this.showCeil !== false && !(this.tool === 'piece' && this.pieces && (this.pieces.tool === 'led' || this.pieces.tool === 'ffu'))) {
      g.save(); g.lineWidth = 1;
      for (const f of P.fixtures || []) { const fw = (f.w || 2) - 0.1, fh = (f.h || 4) - 0.1; g.strokeStyle = f.type === 'ffu' ? 'rgba(127,211,227,.75)' : 'rgba(230,236,238,.7)'; g.fillStyle = f.type === 'ffu' ? 'rgba(127,211,227,.10)' : 'rgba(255,255,255,.07)'; g.fillRect(this.sx(f.x - fw / 2), this.sy(f.y - fh / 2), fw * s, fh * s); g.strokeRect(this.sx(f.x - fw / 2), this.sy(f.y - fh / 2), fw * s, fh * s); }
      g.restore();
    }
    for (const c of P.columns || []) { const r = (c.size || 0.67) / 2, X0 = this.sx(c.x - r), Y0 = this.sy(c.y - r), W = 2 * r * this.view.s; g.save(); g.fillStyle = c.kind === 'concrete' ? '#8d8a84' : '#6f777c'; g.strokeStyle = '#e8edef'; g.lineWidth = 1.2; g.fillRect(X0, Y0, W, W); g.strokeRect(X0, Y0, W, W); g.beginPath(); g.moveTo(X0, Y0); g.lineTo(X0 + W, Y0 + W); g.moveTo(X0 + W, Y0); g.lineTo(X0, Y0 + W); g.stroke(); g.restore(); }
    if (V2 && V2.DEVICES) for (const dv of P.devices || []) this.drawDevice(dv, false);
    // customer comments: numbered pins where they were left
    (P.comments || []).forEach((c, i) => { const X = this.sx(c.x), Y = this.sy(c.y); g.save(); g.fillStyle = c.done ? '#6fd08c' : '#f2c84b'; g.strokeStyle = '#1a1f22'; g.lineWidth = 2; g.beginPath(); g.arc(X, Y - 12, 9, 0, Math.PI * 2); g.moveTo(X - 4, Y - 5); g.lineTo(X, Y); g.lineTo(X + 4, Y - 5); g.fill(); g.stroke(); g.fillStyle = '#1a1f22'; g.font = 'bold 10px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), X, Y - 11.5); g.restore(); });
    // rooms
    for (const r of P.rooms) {
      g.font = '600 13px Bahnschrift, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = COL.room; g.fillText(r.name || 'Room', this.sx(r.x), this.sy(r.y) - (r.dims ? 7 : 0));
      if (r.dims) { g.font = '11px Consolas, monospace'; g.fillStyle = COL.roomSub; g.fillText(r.dims, this.sx(r.x), this.sy(r.y) + 8); }
      // cleanroom check: class, air changes and pressure under the name, green when it meets the class
      const CK = this.check(), q = CK && CK.rooms.find(x => x.room === r);
      let extra = 0;
      if (q && (q.iso || q.pressure != null)) {
        const bits = [];
        if (q.iso) bits.push('ISO ' + q.iso, Math.round(q.ach) + ' ACH');
        if (q.pressure != null) bits.push((q.pressure > 0 ? '+' : '') + q.pressure + ' Pa');
        g.font = '600 11px Consolas, monospace'; g.fillStyle = !q.iso ? COL.roomSub : q.ok ? '#6fd08c' : '#ff7a6b';
        g.fillText(bits.join(' · ') + (q.iso ? (q.ok ? '  ✓' : '  ✗') : ''), this.sx(r.x), this.sy(r.y) - (r.dims ? 21 : 14));
        extra = 1;
      }
      // a room with its own ceiling height says so
      if (V2 && V2.roomKey && (r.ceiling > 0 || (r.plenum != null && r.plenum !== ''))) { const k = V2.roomKey(P, r); g.font = '11px Consolas, monospace'; g.fillStyle = COL.roomSub; g.fillText('ceiling ' + V2.fmtFt(k.H) + (k.PL ? ' · plenum ' + V2.fmtFt(k.PL) : ''), this.sx(r.x), this.sy(r.y) + (r.dims ? 22 : 14)); }
    }
    // pressure: an arrow through each door the way the air goes (high to low), red when it's wrong or weak
    const CK2 = this.check();
    if (CK2) for (const d of CK2.doors) {
      if (d.dp == null || Math.abs(d.dp) < 0.5) continue;
      const sg = d.dp > 0 ? -1 : 1, L = 1.6, cx = this.sx(d.mx), cy = this.sy(d.my);
      const ex = this.sx(d.mx + d.nx * sg * L), ey = this.sy(d.my + d.ny * sg * L), bx = this.sx(d.mx - d.nx * sg * L), by = this.sy(d.my - d.ny * sg * L);
      const col = d.warn ? '#ff7a6b' : '#6fd08c';
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
      const ang = Math.atan2(ey - by, ex - bx), hs = 8;
      g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - hs * Math.cos(ang - 0.45), ey - hs * Math.sin(ang - 0.45)); g.lineTo(ex - hs * Math.cos(ang + 0.45), ey - hs * Math.sin(ang + 0.45)); g.closePath(); g.fill();
      g.font = '600 10px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(Math.round(Math.abs(d.dp) * 10) / 10 + ' Pa', cx + (ey - by) / Math.hypot(ex - bx, ey - by) * 14, cy - (ex - bx) / Math.hypot(ex - bx, ey - by) * 14);
    }
    // walls with height sections: a tick where the height changes, and each section's height while selected
    for (const w of P.walls) {
      if (!Array.isArray(w.sections) || !w.sections.length) continue;
      const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 0.1) continue;
      const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, nx = -uy, ny = ux, t = Math.max(w.t || 0.25, 10 / s), isSel = this.sel && this.sel.kind === 'wall' && this.sel.id === w.id;
      g.save(); g.strokeStyle = '#9fdbe8'; g.lineWidth = 2;
      for (const q of w.sections) for (const v of [q.a, q.b]) { if (!(v > 0.01 && v < L - 0.01)) continue; const x = w.x1 + ux * v, y = w.y1 + uy * v; g.beginPath(); g.moveTo(this.sx(x + nx * t), this.sy(y + ny * t)); g.lineTo(this.sx(x - nx * t), this.sy(y - ny * t)); g.stroke(); }
      if (isSel && V && V.fmtFt) {
        g.font = '600 10px Consolas, monospace'; g.fillStyle = '#9fdbe8'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const q of w.sections) { const m = (Math.min(q.a, q.b) + Math.max(q.a, q.b)) / 2; g.fillText('↕ ' + V.fmtFt(+q.h), this.sx(w.x1 + ux * m + nx * (t + 14 / s)), this.sy(w.y1 + uy * m + ny * (t + 14 / s))); }
      }
      g.restore();
    }
    // light switches: while one is selected (or being linked, L), dashed lines run to the lights it works
    const swSel = this.linkSw ? (P.devices || []).find(d => d.id === this.linkSw) : (this.sel && this.sel.kind === 'device' ? this.selected() : null);
    if (swSel && swSel.type === 'switch' && V2 && V2.lightKey) {
      const on = new Set(swSel.lights || []), L = this.lights(), sx0 = this.sx(swSel.x), sy0 = this.sy(swSel.y);
      g.save(); g.lineWidth = 1.2;
      for (const f of L) {
        const linked = on.has(V2.lightKey(f)), fw = (f.w || 2) - 0.1, fh = (f.h || 4) - 0.1;
        if (!linked && !this.linkSw) continue;
        g.setLineDash([]); g.strokeStyle = linked ? '#f2c84b' : 'rgba(230,236,238,.55)'; g.fillStyle = linked ? 'rgba(242,200,75,.22)' : 'rgba(255,255,255,.05)';
        g.fillRect(this.sx(f.x - fw / 2), this.sy(f.y - fh / 2), fw * s, fh * s); g.strokeRect(this.sx(f.x - fw / 2), this.sy(f.y - fh / 2), fw * s, fh * s);
        if (linked) { g.setLineDash([5, 4]); g.beginPath(); g.moveTo(sx0, sy0); g.lineTo(this.sx(f.x), this.sy(f.y)); g.stroke(); }
      }
      g.setLineDash([]);
      if (!this.linkSw) { g.font = '600 11px Consolas, monospace'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#f2c84b'; g.fillText((on.size ? on.size + ' lights · ' : '') + 'L to link lights', sx0 + 16, sy0 - 14); }
      const D = this.drag; if (D && D.kind === 'linkbox') { g.strokeStyle = '#f2c84b'; g.setLineDash([4, 3]); g.strokeRect(this.sx(Math.min(D.x0, D.x1)), this.sy(Math.min(D.y0, D.y1)), Math.abs(D.x1 - D.x0) * s, Math.abs(D.y1 - D.y0) * s); }
      g.restore();
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
      else if (sel.kind === 'chase' || sel.kind === 'carea' || sel.kind === 'gzone') { g.strokeRect(this.sx(Math.min(o.x0, o.x1)) - 2, this.sy(Math.min(o.y0, o.y1)) - 2, Math.abs(o.x1 - o.x0) * s + 4, Math.abs(o.y1 - o.y0) * s + 4); }
      else if (sel.kind === 'room') { g.strokeRect(this.sx(o.x) - 48, this.sy(o.y) - 14, 96, 28); }
      else if (sel.kind === 'column') { const r = (o.size || 0.67) / 2; g.strokeRect(this.sx(o.x - r) - 4, this.sy(o.y - r) - 4, 2 * r * s + 8, 2 * r * s + 8); }
      else if (sel.kind === 'device') { const r = Math.max(5, Math.min(9, this.view.s * 0.35)); g.beginPath(); g.arc(this.sx(o.x) + Math.cos(o.a || 0) * r * 1.1, this.sy(o.y) + Math.sin(o.a || 0) * r * 1.1, r + 4, 0, Math.PI * 2); g.stroke(); }
      else if (sel.kind === 'item') { const c = global.Plan3DViewer.itemCorners(o); g.beginPath(); c.forEach((q, k) => k ? g.lineTo(this.sx(q[0]), this.sy(q[1])) : g.moveTo(this.sx(q[0]), this.sy(q[1]))); g.closePath(); g.stroke(); }
      else if (sel.kind === 'beam') { quad(o.x1, o.y1, o.x2, o.y2, (global.Plan3DViewer ? global.Plan3DViewer.beamSize(o).bf / 12 : 0.5) + 6 / s); g.stroke(); }
      else if (sel.kind === 'fixture') { const fw = o.w || 2, fh = o.h || 4; g.strokeRect(this.sx(o.x - fw / 2) - 2, this.sy(o.y - fh / 2) - 2, fw * s + 4, fh * s + 4); }
      else if (sel.kind === 'insert') { const b = this.insBox(o); g.strokeRect(this.sx(b.x0) - 6, this.sy(b.y0) - 6, (b.x1 - b.x0) * s + 12, (b.y1 - b.y0) * s + 12); }
    };
    if (this.hover && this.tool === 'select' && !(this.sel && this.sel.id === this.hover.id) && !this.isMulti(this.hover)) outlineSel(this.hover, COL.hover, 1.5);
    if (this.multi) for (const r of this.multi) outlineSel(r, COL.sel, 2);
    if (this.drag && this.drag.kind === 'box') { const D = this.drag; g.save(); g.setLineDash([5, 4]); g.strokeStyle = COL.snap; g.fillStyle = 'rgba(127,211,227,.08)'; g.lineWidth = 1; const X = this.sx(Math.min(D.x0, D.x1)), Y = this.sy(Math.min(D.y0, D.y1)), W = Math.abs(D.x1 - D.x0) * s, H = Math.abs(D.y1 - D.y0) * s; g.fillRect(X, Y, W, H); g.strokeRect(X, Y, W, H); g.restore(); }
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
    if (C && this.tool === 'elec' && global.Plan3DViewer) { const q = this.devicePlace(C.x, C.y, this.deviceType || 'outlet'); if (q) this.drawDevice(q, true); }
    if (C && this.tool === 'item' && global.Plan3DViewer) { const q = this.itemPlace(C.x, C.y, this.itemType); if (q) this.drawItem(q, true); }
    if (this.drag && (this.drag.kind === 'chase' || this.drag.kind === 'carea' || this.drag.kind === 'gzone')) {
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
      else if (PG.mode === 'cell') { const fw = (PG.w || 2) - 0.1, fh = (PG.h || 4) - 0.1; g.fillRect(this.sx(PG.x - fw / 2), this.sy(PG.y - fh / 2), fw * s, fh * s); g.strokeRect(this.sx(PG.x - fw / 2), this.sy(PG.y - fh / 2), fw * s, fh * s); }
      else {
        const t = (this.plan.wallT || 0.25) + (PG.mode === 'replace' ? 0.5 : 0.04);
        quad(PG.x1, PG.y1, PG.x2, PG.y2, t); g.fill(); g.stroke();
        dimFor(PG.x1, PG.y1, PG.x2, PG.y2, t, line, true);
        g.fillStyle = line; g.beginPath(); g.arc(this.sx(PG.x1), this.sy(PG.y1), 3.5, 0, Math.PI * 2); g.fill();
        if (PG.pieces && PG.n > 1) { const L = Math.hypot(PG.x2 - PG.x1, PG.y2 - PG.y1) || 1, nx = -(PG.y2 - PG.y1) / L * t * 0.8, ny = (PG.x2 - PG.x1) / L * t * 0.8; g.beginPath(); for (const q of PG.pieces.slice(1)) { g.moveTo(this.sx(q.x1 - nx), this.sy(q.y1 - ny)); g.lineTo(this.sx(q.x1 + nx), this.sy(q.y1 + ny)); } g.stroke(); }
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
    if (this.tool === 'measure') {
      const m1 = this.meas && this.meas.p1;
      const m2 = this.meas && (this.meas.p2 || (C && this.snap(C.x, C.y, m1, {})));
      if (m1 && m2) {
        const X1 = this.sx(m1.x), Y1 = this.sy(m1.y), X2 = this.sx(m2.x), Y2 = this.sy(m2.y), L = Math.hypot(X2 - X1, Y2 - Y1) || 1, nx = -(Y2 - Y1) / L * 6, ny = (X2 - X1) / L * 6;
        g.save(); g.strokeStyle = COL.snap; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(X1, Y1); g.lineTo(X2, Y2); g.moveTo(X1 - nx, Y1 - ny); g.lineTo(X1 + nx, Y1 + ny); g.moveTo(X2 - nx, Y2 - ny); g.lineTo(X2 + nx, Y2 + ny); g.stroke();
        const d = Math.hypot(m2.x - m1.x, m2.y - m1.y), dx = Math.abs(m2.x - m1.x), dy = Math.abs(m2.y - m1.y);
        const txt = fmt(d) + (dx > 0.5 && dy > 0.5 ? `  (${fmt(dx)} × ${fmt(dy)})` : '');
        g.font = '600 12px Consolas, monospace'; const tw = g.measureText(txt).width, mx = (X1 + X2) / 2 + nx * 2.2, my = (Y1 + Y2) / 2 + ny * 2.2;
        g.fillStyle = 'rgba(23,29,32,.92)'; g.fillRect(mx - tw / 2 - 5, my - 9, tw + 10, 18);
        g.fillStyle = COL.snap; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, mx, my);
        g.restore();
      }
      if (C && !(this.meas && this.meas.p2)) this.crosshair(this.snap(C.x, C.y, m1 || null));
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
