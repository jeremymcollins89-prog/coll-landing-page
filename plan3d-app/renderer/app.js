/* Coll Plan3D — app wiring. Coll Business Solutions LLC */
(function () {
'use strict';
const { Editor, fmt, fmtIn, parseLen } = window.Plan3DEditor;
const IMP = window.Plan3DImport;
const api = window.api || {};
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let projectPath = null, viewer = null, builder = null, view = '2d', liveTimer = 0;

/* ---------- Editor ---------- */
const ed = new Editor($('#plan'), {
  onChange: () => { updateChrome(); queue3D(); if (builder && view === 'build') builder.refresh(); renderProps(); },
  onLive: () => queue3D(),
  onSelect: (d) => { renderProps(d); if (builder && view === 'build') builder.drawSel(); },
  onTool: (t) => { $$('.tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); $('.pane2d').dataset.tool = t; $('#pal2d').hidden = t !== 'piece'; if (t === 'piece') hideBanner(); toolHint(t); },
  onStatus: (m) => msg(m || toolHintText(ed.tool)),
  onCursor: (p) => { $('#sXY').textContent = fmt(p.x) + ', ' + fmt(p.y); $('#sZoom').textContent = Math.round(ed.view.s) + ' px/ft'; },
  onCalibrate: (cal) => calibrateDialog(cal),
  onBgload: () => updateChrome()
});
$('.pane2d').dataset.tool = 'select';
// Snap-together pieces on the 2D plan (same logic as the Build tab)
const pieces2d = new Plan3DBuilder.PieceLogic(ed);
pieces2d.onFlash = (m) => msg(m);
ed.pieces = pieces2d;
const pal2d = new Plan3DBuilder.Palette($('#pal2d'), pieces2d, { layout: 'row', onTool: (t) => { if (ed.tool !== 'piece') ed.setTool('piece'); ed.pieceGhost = null; toolHint('piece'); $('#plan').focus(); } });

function msg(t) { $('#sMsg').textContent = t || 'Ready'; }
const HINTS = {
  select: 'Click to select. Drag to move. Drag a wall end to stretch it. Drag empty space to pan. Delete removes.',
  build: 'Build mode: pick a piece and click to place it.',
  wall: 'Click corners to draw walls. Type a length (e.g. 23\'8-3/4) and press Enter. Hold Alt for free angles. Esc to finish.',
  door: 'Click on a wall, or in a gap between walls, to place a 3′ door.',
  door2: 'Click on a wall, or in a gap between walls, to place a 6′ pair of doors.',
  glass: 'Click on a wall to place a 4′ glass panel.',
  open: 'Click on a wall to place a cased opening (no door).',
  pass: 'Click on a wall to place a 24″ × 24″ stainless pass-thru.',
  chase: 'Drag a rectangle to place a full-height air chase.',
  room: 'Click inside a room to label it.',
  calibrate: 'Click both ends of a dimension you know, like the 40′ overall.',
  piece: 'Pick a piece above and click to place it. Pieces snap to open ends and turn the corner toward the mouse. R turns a free piece. Right-drag pans.'
};
function toolHintText(t) { return HINTS[t] || ''; }
function toolHint(t) { msg(toolHintText(t)); }

function toast(text, action) {
  const t = $('#toast'); t.innerHTML = esc(text);
  if (action) { const a = document.createElement('a'); a.textContent = action.label; a.onclick = () => { action.fn(); t.hidden = true; }; t.appendChild(a); }
  t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, action ? 7000 : 3500);
}

function updateChrome() {
  const P = ed.plan;
  $('#docName').textContent = (P.name || 'Untitled plan') + (ed.dirty ? ' •' : '');
  document.title = (P.name || 'Untitled plan') + ' — Coll Plan3D';
  const empty = !P.walls.length && !P.chases.length && !P.background;
  $('#welcome').hidden = !empty;
}

/* ---------- 3D ---------- */
function ensureViewer() {
  if (viewer) return viewer;
  viewer = Plan3DViewer.mount($('#view3d'), clonePlan(), {});
  return viewer;
}
function clonePlan() { const p = JSON.parse(JSON.stringify(ed.plan)); delete p.background; return p; }
function queue3D() {
  if (view === '2d' || !viewer) return;
  clearTimeout(liveTimer); liveTimer = setTimeout(() => viewer.setPlan(clonePlan()), view === 'split' ? 250 : 0);
}
function setView(v) {
  view = v; $('#main').dataset.view = v;
  $$('.views button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  hideBanner();
  if (v === 'build') {
    const fresh = !builder;
    if (fresh) builder = new Plan3DBuilder.Builder($('#viewBuild'), ed, {});
    else builder.refresh();
    $('#welcome').hidden = true;
    requestAnimationFrame(() => { builder.resize(); if (fresh) builder.frame(); $('#viewBuild canvas').focus(); });
    renderProps(); return;
  }
  updateChrome(); renderProps();
  if (v !== '2d') {
    const fresh = !viewer; ensureViewer();
    if (!fresh) viewer.setPlan(clonePlan());
    requestAnimationFrame(() => { viewer.resize(); if (v === '3d') $('#view3d canvas').focus(); });
  }
  requestAnimationFrame(() => { ed.resize(); if (v !== '3d') ed.fit(); });
}
$$('.views button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

/* ---------- Tools ---------- */
$$('.tools button').forEach(b => b.addEventListener('click', () => { ed.setTool(b.dataset.tool); $('#plan').focus(); }));
$('#optOrtho').addEventListener('change', e => { ed.ortho = e.target.checked; });
$('#optDims').addEventListener('change', e => { ed.showDims = e.target.checked; ed.render(); });

const TOOL_KEYS = { v: 'select', n: 'piece', w: 'wall', d: 'door', f: 'door2', g: 'glass', o: 'open', p: 'pass', c: 'chase', r: 'room', k: 'calibrate' };
function inField(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA'); }
window.addEventListener('keydown', e => {
  if ($('#dlg').open || inField(e)) return;
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#view3d')) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { ed.undo(); e.preventDefault(); return; }
    if (k === 'y' || (k === 'z' && e.shiftKey)) { ed.redo(); e.preventDefault(); return; }
    if (k === 's') { save(e.shiftKey); e.preventDefault(); return; }
    if (k === 'o') { openProject(); e.preventDefault(); return; }
    if (k === 'i') { importPlan(); e.preventDefault(); return; }
    if (k === 'e') { exportHtml(); e.preventDefault(); return; }
    if (k === '0') { ed.fit(); e.preventDefault(); return; }
    return;
  }
  if (view === '3d') return;
  if (view === 'build') { if (builder && builder.key(e)) e.preventDefault(); return; }
  if (ed.key(e)) { e.preventDefault(); return; }
  if (Plan3DBuilder.NUM_KEYS[e.key] && !e.altKey) { ed.setTool('piece'); pal2d.setTool(Plan3DBuilder.NUM_KEYS[e.key]); e.preventDefault(); return; }
  const t = TOOL_KEYS[e.key.toLowerCase()];
  if (t && !e.altKey) { ed.setTool(t); e.preventDefault(); }
});
window.addEventListener('keyup', e => { if (e.key === ' ') ed.key(e); });

/* ---------- Properties panel ---------- */
function fld(label, html) { return `<div class="fld"><label>${label}</label>${html}</div>`; }
function txt(id, val) { return `<input type="text" id="${id}" value="${esc(val)}" spellcheck="false">`; }
function bindLen(id, unit, apply) {
  const el = $('#' + id); if (!el) return;
  const go = () => { const v = parseLen(el.value, unit); if (isFinite(v) && v >= 0) apply(v); else { el.style.borderColor = 'var(--warn)'; setTimeout(() => el.style.borderColor = '', 900); } };
  el.addEventListener('change', go); el.addEventListener('keydown', e => { if (e.key === 'Enter') { go(); el.blur(); } });
}
function renderProps(opt) {
  const box = $('#props'), P = ed.plan, s = ed.sel, o = ed.selected();
  let h = '';
  if (s && o && s.kind === 'wall') {
    const len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
    h = `<div class="hd"><span class="kind">Wall</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Length', txt('pLen', fmt(len)))}
      ${fld('Thickness', txt('pT', fmtIn(o.t || 0.25)))}
      ${fld('S.P. panel', `<label class="chk"><input type="checkbox" id="pSP" ${o.sp ? 'checked' : ''}> Highlight yellow</label>`)}
      <div class="row"><button class="btn small" id="pSplit">Split in half</button><button class="btn small" id="pAllT">Use this thickness on all walls</button></div>
      <p class="note">Length changes move the second end. Drag the square handles on the plan to stretch.</p>`;
    box.innerHTML = h;
    bindLen('pLen', 'ft', v => ed.edit(() => { const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1; const ux = (o.x2 - o.x1) / L, uy = (o.y2 - o.y1) / L; const linked = ed.linkedEnds(o.x2, o.y2, o); o.x2 = o.x1 + ux * v; o.y2 = o.y1 + uy * v; linked.forEach(l => { if (l.end === 1) { l.w.x1 = o.x2; l.w.y1 = o.y2; } else { l.w.x2 = o.x2; l.w.y2 = o.y2; } }); }));
    bindLen('pT', 'in', v => ed.edit(() => { o.t = Math.max(1 / 48, v); }));
    $('#pSP').onchange = e => ed.edit(() => { o.sp = e.target.checked; });
    $('#pSplit').onclick = () => ed.edit(Pl => { const mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2; const n = { ...o, id: Plan3DEditor.uid(), x1: mx, y1: my }; o.x2 = mx; o.y2 = my; Pl.walls.push(n); });
    $('#pAllT').onclick = () => ed.edit(Pl => { Pl.walls.forEach(w => { w.t = o.t; }); Pl.wallT = o.t; });
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'opening') {
    const len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
    const types = [['door', 'Single door'], ['door2', 'Pair of doors'], ['glass', 'Glass panel'], ['open', 'Cased opening'], ['pass', 'Pass-thru']];
    const isPass = o.type === 'pass', sill = o.sill == null ? 3 : o.sill;
    h = `<div class="hd"><span class="kind">${esc(types.find(t => t[0] === o.type)[1])}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Type', `<select id="pType">${types.map(t => `<option value="${t[0]}" ${t[0] === o.type ? 'selected' : ''}>${t[1]}</option>`).join('')}</select>`)}
      ${fld('Width', txt('pW', fmt(len)))}
      ${isPass ? fld('Height', txt('pPH', fmtIn((o.head || 5) - sill))) + fld('Bottom at', txt('pSill', fmt(sill))) + fld('Depth', txt('pDepth', fmtIn(o.depth || 2))) : fld(o.type === 'glass' ? 'Top' : 'Head height', txt('pHead', fmt(o.head || 7)))}
      ${o.type === 'glass' ? fld('Sill height', txt('pSill', fmt(sill))) : ''}
      ${o.type === 'door' || o.type === 'door2' ? `<div class="row"><button class="btn small" id="pSwing">Flip swing side</button>${o.type === 'door' ? '<button class="btn small" id="pHinge">Swap hinge side</button>' : ''}</div>` : ''}
      <p class="note">${isPass ? 'Stainless box with a door on each face. Depth is front to back through the wall. ' : ''}Drag along the wall to slide it. Drag it onto another wall to move it there.</p>`;
    box.innerHTML = h;
    $('#pType').onchange = e => ed.edit(() => { const was = o.type; o.type = e.target.value; if (o.type === 'glass' && o.sill == null) o.sill = 3; if (o.type === 'pass') { o.sill = 3; o.head = 5; o.depth = o.depth || 2; } else if (was === 'pass') { o.head = 7; if (o.type !== 'glass') delete o.sill; } });
    bindLen('pW', 'ft', v => ed.edit(() => { const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1, ux = (o.x2 - o.x1) / L, uy = (o.y2 - o.y1) / L, cx = (o.x1 + o.x2) / 2, cy = (o.y1 + o.y2) / 2; o.x1 = cx - ux * v / 2; o.y1 = cy - uy * v / 2; o.x2 = cx + ux * v / 2; o.y2 = cy + uy * v / 2; }));
    bindLen('pHead', 'ft', v => ed.edit(() => { o.head = Math.min(P.ceiling, Math.max(1, v)); }));
    bindLen('pSill', 'ft', v => ed.edit(() => { const h = (o.head || 5) - (o.sill == null ? 3 : o.sill); o.sill = Math.max(0, v); if (isPass) o.head = Math.min(P.ceiling - 0.25, o.sill + h); }));
    bindLen('pPH', 'in', v => ed.edit(() => { o.head = Math.min(P.ceiling - 0.25, (o.sill == null ? 3 : o.sill) + Math.max(0.5, v)); }));
    bindLen('pDepth', 'in', v => ed.edit(() => { o.depth = Math.max(o.t || 0.25, v); }));
    if ($('#pSwing')) $('#pSwing').onclick = () => ed.edit(() => { o.swing = o.swing === -1 ? 1 : -1; });
    if ($('#pHinge')) $('#pHinge').onclick = () => ed.edit(() => { [o.x1, o.y1, o.x2, o.y2] = [o.x2, o.y2, o.x1, o.y1]; o.swing = o.swing === -1 ? 1 : -1; });
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'chase') {
    const w = Math.abs(o.x1 - o.x0), d = Math.abs(o.y1 - o.y0);
    h = `<div class="hd"><span class="kind">Air chase</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Width (E–W)', txt('pCW', fmtIn(w)))}
      ${fld('Depth (N–S)', txt('pCD', fmtIn(d)))}
      ${fld('Return grille', `<div class="seg" id="pGr">${['', 'N', 'E', 'S', 'W'].map(f => `<button type="button" data-f="${f}" class="${(o.grille || '') === f ? 'on' : ''}">${f || 'None'}</button>`).join('')}</div>`)}
      <p class="note">Runs full height, floor to ceiling. The grille shows on the face you pick.</p>`;
    box.innerHTML = h;
    bindLen('pCW', 'in', v => ed.edit(() => { const x = Math.min(o.x0, o.x1); o.x0 = x; o.x1 = x + Math.max(0.1, v); }));
    bindLen('pCD', 'in', v => ed.edit(() => { const y = Math.min(o.y0, o.y1); o.y0 = y; o.y1 = y + Math.max(0.1, v); }));
    $$('#pGr button').forEach(b => b.onclick = () => ed.edit(() => { o.grille = b.dataset.f; }));
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'fixture') {
    h = `<div class="hd"><span class="kind">${o.type === 'ffu' ? 'Fan filter unit' : 'LED light'}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Type', `<select id="pFx"><option value="led" ${o.type !== 'ffu' ? 'selected' : ''}>LED light, 2×4</option><option value="ffu" ${o.type === 'ffu' ? 'selected' : ''}>Fan filter unit, 2×4</option></select>`)}
      <p class="note">Sits in the 2′ × 4′ ceiling grid.</p>`;
    box.innerHTML = h;
    $('#pFx').onchange = e => ed.edit(() => { o.type = e.target.value; });
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'room') {
    h = `<div class="hd"><span class="kind">Room label</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Name', txt('pName', o.name))}
      ${fld('Size note', txt('pDims', o.dims || ''))}
      <p class="note">Rooms show as jump buttons in the walkthrough. The size note is optional, e.g. 15′-5½″ × 29′-4⅞″.</p>`;
    box.innerHTML = h;
    const nm = $('#pName'); nm.onchange = () => ed.edit(() => { o.name = nm.value.trim() || 'Room'; });
    $('#pDims').onchange = e => ed.edit(() => { o.dims = e.target.value.trim(); });
    $('#pDel').onclick = () => ed.deleteSel();
    if (opt && opt.focusName) { nm.focus(); nm.select(); }
    return;
  }
  // No selection: plan settings
  const B = P.background;
  const partsHtml = partsGroup();
  const ext = ed.extents(), hasGeo = P.walls.length > 0;
  h = `<div class="hd"><span class="kind">Plan</span></div>
    ${fld('Name', txt('pPName', P.name))}
    ${fld('Ceiling', txt('pCeil', fmt(P.ceiling)))}
    ${fld('New walls', txt('pWT', fmtIn(P.wallT || 0.25)))}
    ${fld('Snap to', `<select id="pSnap">${[[0, 'Off'], [0.125, '⅛″'], [0.25, '¼″'], [1, '1″'], [6, '6″'], [12, '1′']].map(([v, l]) => `<option value="${v}" ${ed.snapIn === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
    <div class="grp"><h3>Contents</h3><div class="stats">
      <span>Overall</span><span>${hasGeo ? fmt(ext.x1 - ext.x0) + ' × ' + fmt(ext.y1 - ext.y0) : '—'}</span>
      <span>Walls</span><span>${P.walls.length}</span>
      <span>Doors &amp; glass</span><span>${P.openings.length}</span>
      <span>Air chases</span><span>${P.chases.length}</span>
      <span>Rooms</span><span>${P.rooms.length}</span></div>
      ${hasGeo ? '<div class="row"><button class="btn small" id="pClearAuto">Clear all walls</button></div>' : ''}
    </div>`;
  if (view === 'build') h = `<div class="hd"><span class="kind">Build</span></div>
    <p class="note">Pick a piece on the left and click to place it. Pieces snap to open ends, turn corners toward the mouse, and start T-joints off the middle of a wall.</p>` + partsHtml + h.replace('<div class="hd"><span class="kind">Plan</span></div>', '<div class="grp"><h3>Plan</h3>') + '</div>';
  else h += partsHtml;
  if (B) {
    h += `<div class="grp"><h3>Background image</h3>
      ${fld('Show', `<label class="chk"><input type="checkbox" id="pBgVis" ${B.visible !== false ? 'checked' : ''}> Visible</label>`)}
      ${fld('Opacity', `<input type="range" id="pBgOp" min="0.1" max="1" step="0.05" value="${B.opacity == null ? 0.55 : B.opacity}">`)}
      ${fld('Rotate', `<input type="range" id="pBgRot" min="-10" max="10" step="0.1" value="${(((B.rot || 0) - Math.round((B.rot || 0) / (Math.PI / 2)) * (Math.PI / 2)) * 180 / Math.PI).toFixed(1)}">`)}
      <div class="row"><button class="btn small" id="pBgL">⟲ 90°</button><button class="btn small" id="pBgR">⟳ 90°</button><button class="btn small" id="pBgCal">Set scale</button></div>
      <div class="row"><button class="btn small" id="pBgDetect">Detect walls</button><button class="btn small danger" id="pBgDel">Remove image</button></div>
      <p class="note">${B.calibrated ? 'Scale is set. Trace walls over the image, or try Detect walls.' : 'Set the scale first: click both ends of a known dimension.'}</p></div>`;
  }
  h += `<div class="grp"><h3>Shortcuts</h3><div class="keys">
    <kbd>Wheel</kbd><span>Zoom</span><kbd>Right-drag</kbd><span>Pan (or Space + drag)</span>
    <kbd>Ctrl Z / Y</kbd><span>Undo / redo</span><kbd>Esc</kbd><span>Finish wall / cancel</span>
    <kbd>Alt</kbd><span>Free angle while drawing</span><kbd>F1 F2 F3</kbd><span>Plan / split / 3D</span></div></div>`;
  box.innerHTML = h;
  $('#pPName').onchange = e => ed.edit(Pl => { Pl.name = e.target.value.trim() || 'Untitled plan'; });
  bindLen('pCeil', 'ft', v => ed.edit(Pl => { Pl.ceiling = Math.max(6, Math.min(30, v)); }));
  bindLen('pWT', 'in', v => { ed.plan.wallT = Math.max(1 / 48, v); renderProps(); });
  $('#pSnap').onchange = e => { ed.snapIn = +e.target.value; };
  bindParts();
  if ($('#pClearAuto')) $('#pClearAuto').onclick = () => confirmDlg('Clear all walls?', 'This removes every wall, door, glass panel and chase. Room labels and the background stay. You can undo with Ctrl+Z.', 'Clear walls').then(ok => { if (ok) ed.edit(Pl => { Pl.walls = []; Pl.openings = []; Pl.chases = []; }); });
  if (B) {
    $('#pBgVis').onchange = e => ed.edit(() => { B.visible = e.target.checked; });
    $('#pBgOp').oninput = e => { B.opacity = +e.target.value; ed.render(); };
    $('#pBgOp').onchange = () => { ed.dirty = true; };
    const base = Math.round((B.rot || 0) / (Math.PI / 2)) * (Math.PI / 2);
    $('#pBgRot').oninput = e => { B.rot = base + (+e.target.value) * Math.PI / 180; ed.render(); };
    $('#pBgRot').onchange = () => { ed.dirty = true; updateChrome(); };
    $('#pBgL').onclick = () => ed.edit(() => { B.rot = (B.rot || 0) - Math.PI / 2; });
    $('#pBgR').onclick = () => ed.edit(() => { B.rot = (B.rot || 0) + Math.PI / 2; });
    $('#pBgCal').onclick = () => { ed.setTool('calibrate'); };
    $('#pBgDetect').onclick = () => detectDialog();
    $('#pBgDel').onclick = () => { ed.sel = { kind: 'bg' }; ed.deleteSel(); };
  }
}

/* ---------- Parts list ---------- */
function partsGroup() {
  if (!ed.plan.walls.length && !ed.plan.chases.length) return '';
  const rows = Plan3DParts.partsList(ed.plan);
  let cat = '', body = '';
  for (const r of rows) {
    if (r.cat !== cat) { cat = r.cat; body += `<div class="pl-cat">${esc(cat)}</div>`; }
    body += `<div class="pl-row"><span>${esc(r.item)}${r.size ? `<small>${esc(r.size)}</small>` : ''}</span><b>${r.qty}${r.unit !== 'ea' ? ' <small>' + esc(r.unit) + '</small>' : ''}</b></div>`;
  }
  return `<div class="grp"><h3>Parts list</h3><div class="pl">${body}</div>
    <div class="row"><button class="btn small primary" id="pPartsCsv">Export parts list (.csv)</button></div>
    <p class="note">Opens in Excel. Counts update as you build. Ceiling tile and grid figures are estimates.</p></div>`;
}
function bindParts() { const b = $('#pPartsCsv'); if (b) b.onclick = exportParts; }
async function exportParts() {
  const csv = Plan3DParts.toCSV(Plan3DParts.partsList(ed.plan), ed.plan);
  if (!api.exportFile) return;
  const p = await api.exportFile(csv, ed.plan.name + ' parts list', 'csv');
  if (p) toast('Parts list saved.', { label: 'Open it', fn: () => api.openPath(p) });
}

/* ---------- Plan sheet (PDF) ---------- */
let sheetPage = 'tabloid', sheetRot = 'auto';
function sheetDialog() {
  if (!ed.plan.walls.length) { toast('Add some walls first.'); return; }
  const S = Plan3DSheet, opts = Object.entries(S.PAGES).map(([k, p]) => `<option value="${k}" ${k === sheetPage ? 'selected' : ''}>${p.label}</option>`).join('');
  let sheet = null;
  const draw = () => { sheet = S.makeSheet(ed.plan, { page: sheetPage, rotate: sheetRot === 'auto' ? 'auto' : +sheetRot }); $('#shPrev').innerHTML = sheet.svg; $('#shScale').textContent = 'Scale ' + sheet.scaleLabel + (sheet.rotated ? ' · turned to fit' : ''); };
  dialogOpen({
    title: 'Plan sheet',
    body: `<div class="row" style="align-items:center;gap:12px">${fld('Paper', `<select id="shPage">${opts}</select>`)}${fld('Orientation', `<select id="shRot"><option value="auto" ${sheetRot === 'auto' ? 'selected' : ''}>Best fit</option><option value="0" ${sheetRot === '0' ? 'selected' : ''}>As drawn</option><option value="90" ${sheetRot === '90' ? 'selected' : ''}>Turned 90°</option></select>`)}<span class="sizeline" id="shScale"></span></div>
      <div class="sheet-prev" id="shPrev"></div>
      <p>Panel widths are chained along every wall, with overall dimensions outside. Doors are tagged 3070 / 6070, glass G, pass-thrus PT, and S.P. panels are highlighted.</p>`,
    buttons: [{ label: 'Close', ret: null }, { label: 'Export PDF', primary: true, value: () => 'pdf' }],
    onOpen: (d) => { d.classList.add('wide-xl'); draw(); $('#shPage').onchange = (e) => { sheetPage = e.target.value; draw(); }; $('#shRot').onchange = (e) => { sheetRot = e.target.value; draw(); }; }
  }).then(async (r) => {
    $('#dlg').classList.remove('wide-xl');
    if (r !== 'pdf' || !api.exportPDF) return;
    const p = await api.exportPDF(S.sheetHTML(sheet, ed.plan.name), ed.plan.name + ' floor plan', sheet.page.w, sheet.page.h);
    if (p) toast('Plan sheet saved.', { label: 'Open it', fn: () => api.openPath(p) });
  });
}

/* ---------- Dialog helper ---------- */
function dialogOpen({ title, body, buttons, onOpen, wide }) {
  return new Promise(resolve => {
    const d = $('#dlg');
    $('#dlgTitle').textContent = title; $('#dlgBody').innerHTML = body;
    d.style.width = wide ? 'min(680px, calc(100vw - 40px))' : '';
    const m = $('#dlgBtns'); m.innerHTML = '';
    buttons.forEach(b => {
      const el = document.createElement('button'); el.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''); el.textContent = b.label; el.type = 'button';
      el.onclick = () => { const r = b.value ? b.value() : b.ret; if (r === false) return; d.close(); resolve(r); };
      m.appendChild(el);
    });
    d.onclose = () => resolve(undefined);
    d.oncancel = () => resolve(undefined);
    d.showModal();
    if (onOpen) onOpen(d);
  });
}
function confirmDlg(title, text, okLabel) {
  return dialogOpen({ title, body: `<p>${esc(text)}</p>`, buttons: [{ label: 'Cancel', ret: false }, { label: okLabel || 'OK', primary: true, ret: true }] }).then(r => !!r);
}

/* ---------- Calibrate ---------- */
function calibrateDialog(cal) {
  const cur = Math.hypot(cal.p2.x - cal.p1.x, cal.p2.y - cal.p1.y);
  dialogOpen({
    title: 'Set the scale',
    body: `<p>How long is the line you just drew in real life? Use feet and inches, like <b>40'</b> or <b>23'8-3/4"</b>.</p>
      <input class="big" id="calIn" placeholder="40'" autofocus>
      <p>Right now it measures ${esc(fmt(cur))}. Everything in the plan will be resized to match.</p>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Set scale', primary: true, value: () => { const v = parseLen($('#calIn').value, 'ft'); if (!(v > 0)) { $('#calIn').style.borderColor = 'var(--warn)'; return false; } return v; } }],
    onOpen: () => { const i = $('#calIn'); i.focus(); i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#dlgBtns .primary').click(); } }); }
  }).then(v => {
    if (v > 0) {
      ed.applyCalibration(cal.p1, cal.p2, v); ed.setTool('select');
      if (ed.plan.background && !ed.plan.walls.length) showBanner('Scale set. Try detecting the walls automatically, or trace them with the Wall tool.', [{ label: 'Detect walls', primary: true, fn: detectDialog }, { label: 'Trace by hand', fn: () => { hideBanner(); ed.setTool('wall'); } }]);
      else hideBanner();
    } else { ed.cal = null; ed.render(); }
  });
}

/* ---------- Banner ---------- */
function showBanner(text, btns) {
  $('#bannerText').textContent = text; const b = $('#bannerBtns'); b.innerHTML = '';
  (btns || []).concat([{ label: 'Dismiss', fn: hideBanner }]).forEach(x => { const e = document.createElement('button'); e.className = 'btn small' + (x.primary ? ' primary' : ''); e.textContent = x.label; e.onclick = x.fn; b.appendChild(e); });
  $('#banner').hidden = false;
}
function hideBanner() { $('#banner').hidden = true; }

/* ---------- Image wall detection ---------- */
function detectDialog() {
  const B = ed.plan.background;
  if (!B || !ed.bgImg) return;
  if (!B.calibrated) { toast('Set the scale first, then detect walls.'); ed.setTool('calibrate'); return; }
  hideBanner();
  dialogOpen({
    title: 'Detect walls in the image',
    body: `<p>Finds walls drawn as two parallel lines. Works best on a straight-on, evenly lit scan. Check the result and fix anything it missed.</p>
      ${fld('Wall thickness', '<input type="text" id="dT" value="3&quot;">')}
      ${fld('Shortest wall', '<input type="text" id="dMin" value="2\'">')}
      ${fld('Sensitivity', '<input type="range" id="dSens" min="0.65" max="0.95" step="0.01" value="0.82">')}
      ${ed.plan.walls.length ? '<label class="chk"><input type="checkbox" id="dReplace" checked> Replace the walls already on the plan</label>' : ''}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Detect', primary: true, value: () => ({ t: parseLen($('#dT').value, 'in'), min: parseLen($('#dMin').value, 'ft'), sens: +$('#dSens').value, replace: !$('#dReplace') || $('#dReplace').checked }) }]
  }).then(o => {
    if (!o || !(o.t > 0)) return;
    msg('Detecting walls…');
    setTimeout(() => {
      try {
        const walls = IMP.wallsFromImage(ed.bgImg, B, { tFt: o.t, minLen: o.min > 0 ? o.min : 2, sensitivity: o.sens });
        ed.edit(Pl => { if (o.replace) { Pl.walls = []; Pl.openings = []; } Pl.walls.push(...walls); Pl.wallT = o.t; });
        msg('Found ' + walls.length + ' walls.');
        if (walls.length) showBanner(`Found ${walls.length} walls. Delete extras, draw anything missing, then add doors, glass and chases.`, [{ label: 'Hide image', fn: () => { ed.edit(() => { B.visible = false; }); renderProps(); } }, { label: 'View in 3D', primary: true, fn: () => { hideBanner(); setView('split'); } }]);
        else showBanner('No walls found. Try a higher sensitivity or a thicker wall setting, or trace with the Wall tool.', [{ label: 'Try again', primary: true, fn: detectDialog }, { label: 'Trace by hand', fn: () => { hideBanner(); ed.setTool('wall'); } }]);
      } catch (err) { msg('Detection failed: ' + err.message); }
    }, 30);
  });
}

/* ---------- DXF import ---------- */
function dxfDialog(data) {
  const names = Object.keys(data.layers).sort((a, b) => data.layers[b] - data.layers[a]);
  if (!names.length) { dialogOpen({ title: 'Nothing to import', body: '<p>This drawing has no lines or polylines Coll Plan3D can read. If the walls are inside blocks or xrefs, explode or bind them in AutoCAD and save as DXF again.</p>', buttons: [{ label: 'OK', primary: true, ret: null }] }); return; }
  const wallish = names.filter(n => /wall|partition|panel|a-wall|^wa/i.test(n));
  const pre = new Set(wallish.length ? wallish : names);
  const iu = data.insunits;
  const unitOpts = [[1, 'Inches'], [2, 'Feet'], [4, 'Millimeters'], [5, 'Centimeters'], [6, 'Meters']];
  const defUnit = IMP.UNIT_FT[iu] && iu ? iu : 1;
  dialogOpen({
    wide: true,
    title: 'Import ' + data.name,
    body: `<p>Pick the layers that hold the walls. Turning off dimension, text and furniture layers gives a cleaner result.</p>
      <div class="layers" id="dxLayers">${names.map(n => `<label><input type="checkbox" value="${esc(n)}" ${pre.has(n) ? 'checked' : ''}><span>${esc(n)}</span><small>${data.layers[n]} lines</small></label>`).join('')}</div>
      <div class="row"><button type="button" class="btn small" id="dxAll">All</button><button type="button" class="btn small" id="dxNone">None</button></div>
      ${fld('Drawing units', `<select id="dxU">${unitOpts.map(([v, l]) => `<option value="${v}" ${v === defUnit ? 'selected' : ''}>${l}${v === iu ? ' (from file)' : ''}</option>`).join('')}</select>`)}
      ${fld('Walls drawn as', `<select id="dxM"><option value="double">Two parallel lines</option><option value="single">Single centerline</option></select>`)}
      ${fld('Wall thickness', '<input type="text" id="dxT" value="2&quot; to 8&quot;">')}
      <p class="sizeline" id="dxSize"></p>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Import walls', primary: true, value: () => readDx() }],
    onOpen: () => {
      const upd = () => { const o = readDx(); const sz = IMP.dxfSize(data, o.layers, o.unitFt); $('#dxSize').textContent = sz ? `Size with these units: ${fmt(sz.w)} × ${fmt(sz.h)} · ${sz.n} lines` : 'No layers selected.'; };
      $('#dxLayers').addEventListener('change', upd); $('#dxU').addEventListener('change', upd);
      $('#dxAll').onclick = () => { $$('#dxLayers input').forEach(i => i.checked = true); upd(); };
      $('#dxNone').onclick = () => { $$('#dxLayers input').forEach(i => i.checked = false); upd(); };
      $('#dxM').onchange = () => { $('#dxT').value = $('#dxM').value === 'single' ? '3"' : '2" to 8"'; };
      upd();
    }
  }).then(o => {
    if (!o) return;
    const walls = IMP.wallsFromDxf(data, o);
    const p = Editor.blank(); p.name = data.name; p.walls = walls; p.wallT = o.mode === 'single' ? o.tFt : 0.25;
    if (walls.length) { const t = walls.map(w => w.t).sort((a, b) => a - b); p.wallT = t[t.length >> 1]; }
    projectPath = null; ed.setPlan(p); ed.dirty = true; updateChrome();
    if (walls.length) showBanner(`Imported ${walls.length} walls. Doors and glass don't come across from CAD yet. Add them with the Door, Pair and Glass tools.`, [{ label: 'View in 3D', primary: true, fn: () => { hideBanner(); setView('split'); } }]);
    else showBanner('No walls were found with these settings. Try "Single centerline", a wider thickness range, or other layers.', [{ label: 'Try again', primary: true, fn: () => dxfDialog(data) }]);
  });
  function readDx() {
    const layers = new Set($$('#dxLayers input').filter(i => i.checked).map(i => i.value));
    const unitFt = IMP.UNIT_FT[+$('#dxU').value] || 1 / 12, mode = $('#dxM').value;
    const tv = $('#dxT').value.split(/to|-|–/i).map(s => parseLen(s.trim(), 'in')).filter(v => v > 0);
    const minT = tv.length > 1 ? Math.min(...tv) : (tv[0] || 0.25) * 0.6, maxT = tv.length > 1 ? Math.max(...tv) : (tv[0] || 0.25) * 1.5;
    return { layers, unitFt, mode, minT, maxT, tFt: tv[0] || 0.25, minLen: 0.75 };
  }
}

/* ---------- Files ---------- */
async function guardUnsaved() {
  if (!ed.dirty) return true;
  const r = await dialogOpen({ title: 'Save changes?', body: `<p>${esc(ed.plan.name)} has unsaved changes.</p>`, buttons: [{ label: 'Cancel', ret: 'cancel' }, { label: "Don't save", ret: 'discard' }, { label: 'Save', primary: true, ret: 'save' }] });
  if (r === 'save') return !!(await save(false));
  return r === 'discard';
}
async function handleLoaded(r) {
  if (!r) return;
  if (r.kind === 'error') {
    const text = r.code === 'nodwg'
      ? `<p>DWG files need a free converter. Either:</p><ol class="help"><li>In AutoCAD, use <b>Save As → AutoCAD DXF (*.dxf)</b> and import the DXF, or</li><li>Install the free <b>ODA File Converter</b>, then import the DWG again. Coll Plan3D finds it automatically.</li></ol>`
      : r.code === 'unsupported' ? `<p>Coll Plan3D can't read ${esc(r.ext)} files. Use DXF, DWG, PNG, JPG or a saved .plan3d project. For a PDF plan, export the page as PNG first.</p>`
      : `<p>Couldn't read ${esc(r.name)}. ${esc(r.message || '')}</p>`;
    const btns = [{ label: 'OK', primary: true, ret: null }];
    if (r.code === 'nodwg') btns.unshift({ label: 'Get ODA File Converter', ret: 'oda' });
    const a = await dialogOpen({ title: r.code === 'nodwg' ? 'DWG needs one extra step' : "Can't open that file", body: text, buttons: btns });
    if (a === 'oda' && api.openUrl) api.openUrl('https://www.opendesign.com/guestfiles/oda_file_converter');
    return;
  }
  if (r.kind === 'project') {
    let p; try { p = JSON.parse(r.json); } catch (e) { toast('That project file is damaged.'); return; }
    projectPath = r.path; ed.setPlan(p); hideBanner(); updateChrome(); if (view !== '2d' && viewer) viewer.loadPlan(clonePlan());
    toast('Opened ' + (p.name || r.name)); return;
  }
  if (r.kind === 'dxf') { dxfDialog(r); return; }
  if (r.kind === 'image') {
    const im = new Image();
    im.onload = () => {
      const p = Editor.blank(); p.name = r.name;
      const scale = 60 / Math.max(im.naturalWidth, im.naturalHeight); // provisional: longest side = 60 ft
      p.background = { src: r.dataUrl, cx: im.naturalWidth * scale / 2, cy: im.naturalHeight * scale / 2, scale, rot: 0, opacity: 0.6, visible: true, calibrated: false };
      projectPath = null; ed.setPlan(p); ed.dirty = true; updateChrome(); renderProps();
      ed.setTool('calibrate');
      showBanner('Set the scale: click both ends of a dimension you know, like the 40′ overall. Rotate the image first in the right panel if it is sideways.', []);
    };
    im.src = r.dataUrl;
  }
}
async function importPlan() {
  if (!api.openFile) return;
  if (!(await guardUnsaved())) return;
  handleLoaded(await api.openFile('plan'));
}
async function openProject() {
  if (!api.openFile) return;
  if (!(await guardUnsaved())) return;
  handleLoaded(await api.openFile('project'));
}
async function openSample() {
  if (!(await guardUnsaved())) return;
  handleLoaded(await api.loadSample());
}
async function save(as) {
  if (!api.saveProject) return null;
  const p = await api.saveProject(JSON.stringify(ed.plan), as ? null : projectPath, ed.plan.name);
  if (p) { projectPath = p; ed.dirty = false; updateChrome(); toast('Saved', { label: 'Show in folder', fn: () => api.showInFolder(p) }); }
  return p;
}
async function exportHtml() {
  if (!ed.plan.walls.length) { toast('Add some walls first.'); return; }
  const a = await api.getAssets();
  const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
  const plan = clonePlan();
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(plan.name)} — 3D Walkthrough</title>
<style>html,body{margin:0;height:100%;background:#121719}#v{position:fixed;inset:0}</style></head>
<body><div id="v"></div>
<script>${safe(a.three)}</script>
<script>${safe(a.orbit)}</script>
<script>${safe(a.viewer)}</script>
<script>Plan3DViewer.mount(document.getElementById('v'), ${safe(JSON.stringify(plan))});</script>
<!-- Made with Coll Plan3D · Coll Business Solutions LLC -->
</body></html>`;
  const p = await api.exportFile(html, plan.name + ' walkthrough', 'html');
  if (p) toast('Walkthrough saved. It opens in any browser and can be emailed or texted.', { label: 'Open it', fn: () => api.openPath(p) });
}
async function exportGlb() {
  if (!ed.plan.walls.length) { toast('Add some walls first.'); return; }
  const v = ensureViewer(); viewer.setPlan(clonePlan());
  try {
    const buf = await v.exportGLB();
    const p = await api.exportFile(buf, ed.plan.name, 'glb');
    if (p) toast('3D model saved.', { label: 'Open it', fn: () => api.openPath(p) });
  } catch (e) { toast('Export failed: ' + e.message); }
}
async function newPlan() { if (!(await guardUnsaved())) return; projectPath = null; ed.setPlan(Editor.blank()); hideBanner(); updateChrome(); }

function helpDialog() {
  dialogOpen({
    wide: true, title: 'Quick guide',
    body: `<div class="help">
      <h4>From AutoCAD</h4><ol><li>Import plan → pick your .dxf (or .dwg with ODA File Converter installed).</li><li>Tick the wall layers, check the size line reads right, and import.</li><li>Add doors, glass and air chases, label rooms, then switch to 3D.</li></ol>
      <h4>From a photo or scan</h4><ol><li>Shoot the sheet flat and straight-on. Import the image.</li><li>Rotate it upright in the right panel, then use Scale: click both ends of a known dimension and type it.</li><li>Detect walls, or trace them with the Wall tool. Typing a length while drawing places the wall exactly.</li></ol>
      <h4>Sharing</h4><ul><li>Export walkthrough saves one .html file. Anyone can open it in a browser, on a phone too.</li><li>Export .glb opens in Windows 3D Viewer, SketchUp, Blender and most 3D tools.</li></ul></div>`,
    buttons: [{ label: 'Close', primary: true, ret: null }]
  });
}

$('#bImport').onclick = importPlan; $('#bOpen').onclick = openProject; $('#bSave').onclick = () => save(false);
$('#bExportHtml').onclick = exportHtml; $('#bSheet').onclick = sheetDialog; $('#bExportGlb').onclick = exportGlb;
$('#wImport').onclick = importPlan; $('#wSample').onclick = openSample;
$('#wDraw').onclick = () => { $('#welcome').hidden = true; ed.setTool('wall'); $('#plan').focus(); };

if (api.onMenu) api.onMenu(async (a) => {
  ({ import: importPlan, open: openProject, sample: openSample, save: () => save(false), saveas: () => save(true), 'export-html': exportHtml, 'export-glb': exportGlb,
     new: newPlan, undo: () => ed.undo(), redo: () => ed.redo(), 'view-2d': () => setView('2d'), 'view-split': () => setView('split'), 'view-3d': () => setView('3d'), 'view-build': () => setView('build'), 'export-parts': exportParts, sheet: sheetDialog,
     fit: () => ed.fit(), help: helpDialog,
     'request-close': async () => { if (await guardUnsaved()) api.confirmClose(); } }[a] || (() => {}))();
});
if (api.onOpenPath) api.onOpenPath(async p => handleLoaded(await api.loadPath(p)));

// Drag and drop
let dragDepth = 0;
window.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; $('#dropzone').hidden = false; });
window.addEventListener('dragleave', e => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; $('#dropzone').hidden = true; } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', async e => {
  e.preventDefault(); dragDepth = 0; $('#dropzone').hidden = true;
  const f = e.dataTransfer.files[0]; if (!f) return;
  const p = api.pathForFile && api.pathForFile(f);
  if (p) { if (await guardUnsaved()) handleLoaded(await api.loadPath(p)); }
});

renderProps(); updateChrome(); toolHint('select');
window.__app = { ed, setView, handleLoaded, get viewer() { return viewer; }, get builder() { return builder; } };
})();
