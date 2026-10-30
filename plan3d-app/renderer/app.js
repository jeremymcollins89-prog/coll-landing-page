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
  onTilesize: () => { if (ed.tool === 'grid') gridPalette(); },
  onTool: (t) => { $$('.tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); $('.pane2d').dataset.tool = t; $('#pal2d').hidden = t !== 'piece'; $('#itemPal').hidden = t !== 'item'; if (t === 'item') itemPalette(); $('#draftPal').hidden = t !== 'draft'; if (t === 'draft') { draftPalette(); $('#welcome').hidden = true; } $('#elecPal').hidden = t !== 'elec'; $('#grillePal').hidden = t !== 'grille'; if (t === 'grille') grillePalette(); if (t === 'elec') elecPalette(); $('#gridPal').hidden = t !== 'grid'; if (t === 'grid') gridPalette(); if (t === 'piece') hideBanner(); toolHint(t); },
  onStatus: (m) => msg(m || toolHintText(ed.tool)),
  onCursor: (p) => { $('#sXY').textContent = fmt(p.x) + ', ' + fmt(p.y); $('#sZoom').textContent = Math.round(ed.view.s) + ' px/ft'; },
  onCalibrate: (cal) => calibrateDialog(cal),
  onDrafttext: (pt) => draftTextDialog(pt),
  onBgload: () => updateChrome()
});
$('.pane2d').dataset.tool = 'select';
// Snap-together pieces on the 2D plan (same logic as the Build tab)
const pieces2d = new Plan3DBuilder.PieceLogic(ed);
pieces2d.onFlash = (m) => msg(m);
ed.pieces = pieces2d;
const pal2d = new Plan3DBuilder.Palette($('#pal2d'), pieces2d, { layout: 'row', onTool: (t) => { if (ed.tool !== 'piece') ed.setTool('piece'); ed.pieceGhost = null; toolHint('piece'); $('#plan').focus(); } });

function welcomeText() {
  const house = ed.plan.mode === 'house';
  $('#wTitle').textContent = house ? 'Design a project in 3D' : 'Turn a floor plan into a 3D walkthrough';
  $('#wText').textContent = house ? 'Draw the walls (wood or steel studs), add doors and windows, pick a roof, place the kitchen, bath and laundry, then walk through it. The parts list counts the framing, drywall, siding, roof and more. For any other drawing (a detail, a bracket, a site plan) pick Draft (L) on the left: lines, circles, arcs, text, dimensions, layers and blocks.' : 'Bring in an AutoCAD drawing or a photo of the plan sheet, check the walls, add doors, glass and air chases, then walk through it.';
  $('#wSampleText').textContent = house ? 'A two-story house with a basement and an attached 2-car garage' : 'A fill-and-finish suite: ISO 5 core, two ISO 7 rooms, gowning, airlock and packaging';
}
function pickMode(m) {
  modePicked = true;
  const P = Editor.blank(); if (m === 'house') houseDefaults(P); else P.mode = 'cleanroom';
  projectPath = null; ed.setPlan(P); updateChrome(); renderProps();
}
function msg(t) { $('#sMsg').textContent = t || 'Ready'; }
const HINTS = {
  grille: 'Pick a size in the bar above (20×20, 36×36 or your own) and whether it has a damper, then click on a wall panel: the return grille goes in the panel, facing the side you clicked (air flows into it from that side). Drag it to slide it along the wall.',
  header: 'Header panels close the plenum over an open passage between walls. The orange dashes are open gaps: click one to fill it, or press F to fill them all. Or click one end and then the other (ends catch on wall ends and faces). They run from the ceiling up to the top of the walls, with H-studs at 48″ on center.',
  draft: 'Drafting: pick Line, Polyline, Rectangle, Circle, Arc, Text or Dimension in the bar. It snaps to endpoints, midpoints, centers and crossings; type lengths, @x,y or length<angle and Enter. Select a drawn piece to edit it exactly, move, copy, rotate, mirror, scale, offset or array it.',
  removable: 'Click on a wall to put a removable wall section there (8′-6″ wide, 8′ header): wall panels in a 3″ × 3″ steel tube frame that come out to bring equipment in. Change its width and header in its properties; in 3D, Show removed takes the panels out.',
  overhead: 'Click on a wall to put an overhead sectional door there (12′ wide, head 2′ below the top of the wall). Change its size in its properties.',
  column: 'Click to place a building column. Its size and steel or concrete are in its properties; it runs up to the roof structure.',
  elec: 'Pick a device (the list folds away; Tab or the ⚡ chip brings it back), then click on a wall: it goes on that face of the wall, facing the room you clicked in. Heights follow the usual mounting heights; change one in its properties.',
  select: 'Click to select. Drag to move. Drag a wall end to stretch it. Drag empty space to pan. Delete removes.',
  build: 'Build mode: pick a piece and click to place it.',
  wall: 'Click corners to draw walls. Type a length (e.g. 23\'8-3/4) and press Enter. Hold Alt for free angles. Esc to finish.',
  door: 'Click on a wall, or in a gap between walls, to place a 3′ door.',
  door2: 'Click on a wall, or in a gap between walls, to place a 6′ pair of doors.',
  glass: 'Click on a wall to place a 4′ glass panel.',
  open: 'Click on a wall to place a cased opening (no door).',
  pass: 'Click on a wall to place a 24″ × 24″ stainless pass-thru.',
  chase: 'Drag a rectangle to place a full-height air chase.',
  grid: 'Grid tool. Pick what a click or drag does in the bar at the top: Rooms (click a room to put its ceiling on or take it off), Add area or Cut out (drag a box), Centre grid (click a room), Grid section (drag a box for a part on its own grid). The arrows slide the whole grid, FFUs and lights with it. Build piece by piece: Place piece (click to put a tile, FFU or light; it butts against its neighbours and is cut to fit at walls; click a piece to drag it) or Fill (drag a box to lay tiles in it). R turns the piece.',
  carea: 'Drag a rectangle over part of a room to give it its own ceiling height. Bulkhead panels fill the step where it meets the rest of the ceiling. To make that part of the room taller (walls and top too), tick Raise the walls in its panel. A whole room: set Ceiling on its room label.',
  room: 'Click inside a room to label it.',
  beam: 'Click both ends of a steel beam (I-beam). Over the cleanroom it spans wall to wall in the plenum, its top level with the top of the walls; otherwise it goes up under the roof. Pick it to change its size or height.',
  measure: 'Click two points to measure between them. Snaps to wall ends and lines up with them; Alt for any angle. Esc clears.',
  calibrate: 'Click both ends of a dimension you know, like the 40′ overall.',
  item: 'Pick an item above, then click near a wall: it backs up against the wall. R turns it. Carts, chairs, IV poles, islands, tables, rugs and lights go anywhere. Pick a placed item to change its size.',
  piece: 'Pick a piece above and click to place it, or drag to lay a whole run of panels. Drag a placed panel with Select to move it; its ends catch on nearby walls. Pieces snap to open ends and turn the corner toward the mouse. R turns a free piece. Right-drag pans.'
};
/* ---------- Floors (stories) ----------
   The floor being edited lives on the plan itself; the others are kept in plan.levels[k].data. Switching floors
   puts this one away and brings the other out (one undo step). */
function levelInit(P) { if (!P.levels || !P.levels.length) { P.levels = [{ id: Plan3DEditor.uid(), name: 'First floor' }]; P.level = 0; } }
function levelStash(P) { const k = P.level || 0, d = {}; for (const key of Plan3DViewer.LEVEL_KEYS) d[key] = JSON.parse(JSON.stringify(P[key] === undefined ? (key === 'ceiling' ? P.ceiling : []) : P[key])); P.levels[k].data = d; }
function levelLoad(P, k) { const d = P.levels[k].data || {}; for (const key of Plan3DViewer.LEVEL_KEYS) P[key] = d[key] !== undefined ? JSON.parse(JSON.stringify(d[key])) : (key === 'ceiling' ? (P.ceiling || 8) : []); delete P.levels[k].data; P.level = k; }
function switchLevel(k) {
  const P = ed.plan; if (!P.levels || k === (P.level || 0) || !P.levels[k]) return;
  ed.sel = null; ed.multi = null;
  ed.edit(Pl => { levelStash(Pl); levelLoad(Pl, k); });
  ed.fit && ed.render(); renderProps(); updateChrome(); queue3D();
  toast('Now drawing on ' + (P.levels[k].name || 'floor ' + (k + 1)) + '.');
}
function addLevel(basement) {
  ed.sel = null; ed.multi = null;
  ed.edit(Pl => {
    levelInit(Pl); levelStash(Pl);
    const cur = Pl.level || 0, uid = Plan3DEditor.uid;
    // a new floor starts with the outside walls of the floor it's on (same footprint), ready to edit
    const src = Pl.levels[cur].data, A0 = Plan3DViewer.analyze(Object.assign({}, Pl, src)), ext = new Set(Plan3DViewer.houseExtWalls(Object.assign({}, Pl, src), A0).map(w => w.id));
    const walls = (src.walls || []).filter(w => ext.has(w.id)).map(w => ({ ...w, id: uid() }));
    const data = { walls, openings: [], rooms: [], items: [], devices: [], chases: [], columns: [], beams: [], headers: [], grilles: [], ceiling: basement ? 8 : (src.ceiling || Pl.ceiling || 8) };
    const names = ['First floor', 'Second floor', 'Third floor', 'Fourth floor', 'Fifth floor'];
    if (basement) { Pl.levels.unshift({ id: uid(), name: 'Basement', below: true, data }); Pl.level = cur + 1; levelLoad(Pl, 0); }
    else { const above = Pl.levels.filter(l => !l.below).length; Pl.levels.push({ id: uid(), name: names[above] || 'Floor ' + (above + 1), data }); levelLoad(Pl, Pl.levels.length - 1); }
  });
  ed.render(); renderProps(); updateChrome(); queue3D();
  toast(basement ? 'Basement added under the house, with the outside walls to start from. Draw it, then switch floors with the buttons in the House panel.' : 'Floor added on top, with the outside walls of the floor below to start from. Add its rooms, doors and windows; stairs from below cut its stairwell.');
}
function deleteLevel() {
  const P = ed.plan; if (!P.levels || P.levels.length < 2) return;
  ed.sel = null; ed.multi = null;
  ed.edit(Pl => { const k = Pl.level || 0; Pl.levels.splice(k, 1); const n = Math.max(0, Math.min(k, Pl.levels.length - 1)); Pl.level = n; levelLoad(Pl, n); });
  ed.render(); renderProps(); updateChrome(); queue3D();
}
function grillePalette() {
  const W = ed.grW || 20, H = ed.grH || 20, key = W === 20 && H === 20 ? '20' : W === 36 && H === 36 ? '36' : 'c';
  $('#grillePal').innerHTML = `<div class="grp"><div class="row"><b style="margin-right:6px">Return grille</b>${[['20', '20″ × 20″'], ['36', '36″ × 36″'], ['c', 'Custom']].map(([k, l]) => `<button data-gs="${k}" class="${key === k ? 'on' : ''}">${l}</button>`).join('')}
    ${key === 'c' ? `<label>W <input type="text" id="gpW" value="${W}″" style="width:52px"></label><label>H <input type="text" id="gpH" value="${H}″" style="width:52px"></label>` : ''}
    <label>Bottom <input type="text" id="gpS" value="${fmtIn(ed.grSill != null ? ed.grSill : 0.5)}" style="width:52px"></label>
    <label class="chk"><input type="checkbox" id="gpD" ${ed.grDamper ? 'checked' : ''}> Damper</label></div></div>`;
  $$('#grillePal [data-gs]').forEach(b => b.onclick = () => { const k = b.dataset.gs; if (k === '20') { ed.grW = ed.grH = 20; } else if (k === '36') { ed.grW = ed.grH = 36; } else { ed.grW = ed.grW === 20 || ed.grW === 36 ? 24 : ed.grW; ed.grH = ed.grH === 20 || ed.grH === 36 ? 12 : ed.grH; } grillePalette(); });
  const inch = (id, set) => { const el = $('#' + id); if (!el) return; el.onchange = () => { const v = parseLen(el.value, 'in'); if (isFinite(v) && v > 0) set(v); grillePalette(); }; el.onkeydown = (e) => e.stopPropagation(); };
  inch('gpW', v => { ed.grW = Math.round(Math.min(96, v * 12)); }); inch('gpH', v => { ed.grH = Math.round(Math.min(96, v * 12)); }); inch('gpS', v => { ed.grSill = Math.min(10, v); });
  $('#gpD').onchange = (e) => { ed.grDamper = e.target.checked; };
}
function itemPalette() {
  // one group at a time, picked from a row of tabs, so the palette stays small over the plan
  const IT = Plan3DViewer.ITEMS, groups = {};
  // cleanroom plans get the cleanroom furniture and equipment; houses get the house items
  const crMode = ed.plan.mode !== 'house';
  for (const [k, v] of Object.entries(IT)) if (!v.hidden && !!v.cr === crMode) (groups[v.group] = groups[v.group] || []).push([k, v]);
  if (!ed.itemType || !IT[ed.itemType] || !!IT[ed.itemType].cr !== crMode) { ed.itemType = crMode ? 'sstable' : 'base'; ed.itemGroup = null; }
  const names = Object.keys(groups); if (!ed.itemGroup || !groups[ed.itemGroup]) ed.itemGroup = IT[ed.itemType].group;
  $('#itemPal').innerHTML = `<div class="grp"><div class="row">${names.map(g => `<button data-ig="${esc(g)}" class="${ed.itemGroup === g ? 'on' : ''}"><b>${esc(g)}</b></button>`).join('')}</div></div>`
    + `<div class="grp"><div class="row">${groups[ed.itemGroup].map(([k, v]) => `<button data-it="${k}" class="${ed.itemType === k ? 'on' : ''}">${esc(v.label)}</button>`).join('')}</div></div>`;
  $$('#itemPal button[data-ig]').forEach(b => b.onclick = () => { ed.itemGroup = b.dataset.ig; const first = groups[ed.itemGroup][0]; if (first && IT[ed.itemType].group !== ed.itemGroup) ed.itemType = first[0]; itemPalette(); $('#plan').focus(); });
  $$('#itemPal button[data-it]').forEach(b => b.onclick = () => { ed.itemType = b.dataset.it; itemPalette(); $('#plan').focus(); });
}
let elecOpen = true;
function elecPalette() {
  const DV = Plan3DViewer.DEVICES, groups = {};
  for (const [k, v] of Object.entries(DV)) (groups[v.group] = groups[v.group] || []).push([k, v]);
  if (!ed.deviceType) ed.deviceType = 'outlet';
  // once a device is picked the list folds down to a small chip, so the plan is clear to place it; click the
  // chip (or press Tab) to pick another
  const P = $('#elecPal'), cur = DV[ed.deviceType] || {};
  P.classList.toggle('folded', !elecOpen);
  if (!elecOpen) {
    P.innerHTML = `<button class="palchip" title="Pick a different device (Tab)"><span class="ic">⚡</span><span><small>Placing</small><b>${esc(cur.label || 'Device')}</b></span><span class="chg">Change ▾</span></button>`;
    P.querySelector('.palchip').onclick = () => { elecOpen = true; elecPalette(); };
    return;
  }
  P.innerHTML = Object.entries(groups).map(([g, list]) => `<div class="grp"><h5>${esc(g)}</h5><div class="row">${list.map(([k, v]) => `<button data-dv="${k}" class="${ed.deviceType === k ? 'on' : ''}">${esc(v.label)}</button>`).join('')}</div></div>`).join('')
    + `<div class="grp"><h5>Fixture whips</h5><div class="row"><button class="whipgo" title="Daisy-chain the lights and fan filter units room by room with 9′ OnePass whips from box to box, adding 12′ extensions where a run is longer">Wire HEPAs and lights</button><select class="whipv" title="Whip voltage (on the parts list)"><option value="120" ${(ed.plan.whipVolt || 120) == 120 ? 'selected' : ''}>120V</option><option value="277" ${ed.plan.whipVolt == 277 ? 'selected' : ''}>277V</option></select>${(ed.plan.whips || []).length ? '<button class="whipoff" title="Take all the fixture whips off">Remove whips</button>' : ''}</div></div>`
    + `<button class="palfold" title="Fold the list away">▴ Hide list</button>`;
  $$('#elecPal button[data-dv]').forEach(b => b.onclick = () => { ed.deviceType = b.dataset.dv; elecOpen = false; elecPalette(); msg(toolHintText('elec')); $('#plan').focus(); });
  P.querySelector('.palfold').onclick = () => { elecOpen = false; elecPalette(); $('#plan').focus(); };
  P.querySelector('.whipgo').onclick = () => {
    let W = []; try { W = Plan3DViewer.wireFixtures(ed.plan); } catch (e) { console.error(e); }
    if (!W.length) { toast('No lights or fan filter units to wire yet.'); return; }
    ed.edit(Q => { Q.whips = W; });
    const nx = W.reduce((n, w) => n + (w.ext || 0), 0), chains = new Set(W.map(w => w.a)).size ? (() => { const b = new Set(W.map(w => w.b)); return W.filter(w => !b.has(w.a)).length; })() : 0;
    toast(`Wired: ${W.length} whip${W.length === 1 ? '' : 's'} (9′)${nx ? ' and ' + nx + ' extension' + (nx === 1 ? '' : 's') + ' (12′)' : ''}, ${chains} chain${chains === 1 ? '' : 's'}. See them in the Plenum view; they're on the parts list.`);
    elecPalette(); queue3D();
  };
  P.querySelector('.whipv').onchange = (e) => { const v = +e.target.value; ed.edit(Q => { if (v === 277) Q.whipVolt = 277; else delete Q.whipVolt; }); toast('Fixture whips: ' + v + 'V.'); };
  const wo = P.querySelector('.whipoff'); if (wo) wo.onclick = () => { ed.edit(Q => { delete Q.whips; }); toast('Fixture whips taken off.'); elecPalette(); queue3D(); };
}
/* The Grid tool's bar: what a click or drag does, and nudges for the main grid */
const GRID_MODES = [['room', 'Rooms', 'Click a room to put its ceiling on or take it off'], ['add', 'Add area', 'Drag a box to put ceiling there'], ['cut', 'Cut out', 'Drag a box to take ceiling (and its FFUs and lights) off'], ['center', 'Centre grid', 'Click a room to centre the grid in it'], ['section', 'Grid section', 'Drag a box for a part of the ceiling on its own grid (turned or shifted)']];
const BUILD_MODES = [['place', 'Place piece', 'Click to put a tile, FFU or light down (it butts against the pieces and walls next to it, cut to fit at a wall); click a piece to drag it'], ['fill', 'Fill', 'Drag a box to lay tiles in it, cut to fit at its edges, walls and the pieces already there']];
function gridPalette() {
  if (!ed.gridMode) ed.gridMode = 'room';
  const st = ed.gridStep || 1 / 12;
  $('#gridPal').innerHTML = `<div class="grp"><h5>Click or drag does</h5><div class="row">${GRID_MODES.map(([k, l, tip]) => `<button data-gm="${k}" class="${ed.gridMode === k ? 'on' : ''}" title="${esc(tip)}">${esc(l)}</button>`).join('')}</div></div>
    <div class="grp"><h5>Slide the grid</h5><div class="row"><button data-gs="-1,0" title="Left">←</button><button data-gs="1,0" title="Right">→</button><button data-gs="0,-1" title="Up">↑</button><button data-gs="0,1" title="Down">↓</button>
      <select id="gpStep" title="How far each click slides it">${[[1 / 12, '1″'], [0.5, '6″'], [1, '1′']].map(([v, l]) => `<option value="${v}" ${Math.abs(v - st) < 1e-6 ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`;
  // building the ceiling piece by piece
  const built = ed.built(), w = ed.tileW || 2, hh = ed.tileH || 4, kind = ed.tileKind || 'tile';
  const SIZES = [[2, 4, '2 × 4'], [4, 2, '4 × 2'], [2, 2, '2 × 2']];
  $('#gridPal').innerHTML += `<div class="grp"><h5>Build piece by piece</h5><div class="row">${BUILD_MODES.map(([k, l, tip]) => `<button data-gm="${k}" class="${ed.gridMode === k ? 'on' : ''}" title="${esc(tip)}">${esc(l)}</button>`).join('')}
      <select id="gpKind" title="What Place piece puts down">${[['tile', 'Tile'], ['ffu', 'FFU'], ['led', 'Light']].map(([k, l]) => `<option value="${k}" ${kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select id="gpSize" title="Size, across × up and down (R turns it)">${SIZES.map(([a, c, l]) => `<option value="${a},${c}" ${Math.abs(a - w) < 1e-6 && Math.abs(c - hh) < 1e-6 ? 'selected' : ''}>${l}</option>`).join('')}${SIZES.some(([a, c]) => Math.abs(a - w) < 1e-6 && Math.abs(c - hh) < 1e-6) ? '' : `<option selected value="${w},${hh}">${esc(fmt(w))} × ${esc(fmt(hh))}</option>`}<option value="custom">Other size…</option></select></div>
      <div class="row">${built ? '<button id="gpUnbuild" title="Drop the separate tiles and go back to a generated grid over the same area">Back to a generated grid</button>' : '<button id="gpBuild" title="Turn the ceiling that is there into separate tiles you can move one by one">Turn this ceiling into pieces</button>'}</div></div>`;
  $$('#gridPal [data-gm]').forEach(b => b.onclick = () => { ed.gridMode = b.dataset.gm; gridPalette(); msg((GRID_MODES.concat(BUILD_MODES)).find(m => m[0] === ed.gridMode)[2] + '.'); $('#plan').focus(); });
  $('#gpKind').onchange = (e) => { ed.tileKind = e.target.value; if (ed.tileKind !== 'tile' && Math.abs(ed.tileW * ed.tileH - 8) > 0.01 && Math.abs(ed.tileW * ed.tileH - 4) > 0.01) { ed.tileW = 2; ed.tileH = 4; } ed.gridMode = 'place'; gridPalette(); $('#plan').focus(); };
  $('#gpSize').onchange = async (e) => {
    if (e.target.value === 'custom') {
      const r = await dialogOpen({ title: 'Piece size', body: fld('Across (left to right)', txt('tsW', fmt(ed.tileW || 2))) + fld('Up and down', txt('tsH', fmt(ed.tileH || 4))) + '<p class="note">For a cut tile you want to place by hand, a 2 × 2, or an odd-size fixture.</p>', buttons: [{ label: 'Cancel', ret: null }, { label: 'Use it', primary: true, value: () => [parseLen($('#tsW').value, 'ft'), parseLen($('#tsH').value, 'ft')] }] });
      if (r && r[0] > 0.1 && r[1] > 0.1) { ed.tileW = r[0]; ed.tileH = r[1]; }
    } else { const [a, c] = e.target.value.split(',').map(Number); ed.tileW = a; ed.tileH = c; }
    if (ed.gridMode !== 'fill') ed.gridMode = 'place'; gridPalette(); $('#plan').focus();
  };
  if ($('#gpBuild')) $('#gpBuild').onclick = () => { if (ed.buildFromCeiling()) { ed.gridMode = 'place'; gridPalette(); } $('#plan').focus(); };
  if ($('#gpUnbuild')) $('#gpUnbuild').onclick = () => { ed.unbuild(); ed.gridMode = 'room'; gridPalette(); $('#plan').focus(); };
  $$('#gridPal [data-gs]').forEach(b => b.onclick = () => { const [a, c] = b.dataset.gs.split(',').map(Number), d = ed.gridStep || 1 / 12; ed.shiftGrid(a * d, c * d); $('#plan').focus(); });
  $('#gpStep').onchange = (e) => { ed.gridStep = +e.target.value; $('#plan').focus(); };
}
function toolHintText(t) { return HINTS[t] || ''; }
function toolHint(t) { msg(toolHintText(t)); }

function toast(text, action) {
  const t = $('#toast'); t.innerHTML = esc(text);
  if (action) { const a = document.createElement('a'); a.textContent = action.label; a.onclick = () => { action.fn(); t.hidden = true; }; t.appendChild(a); }
  t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, action ? 7000 : 3500);
}

/* House defaults: wood stud walls 4½″ thick, 8′ walls, 6/12 gable roof with a 1′ overhang, plank floors. */
function houseDefaults(P, keepWalls) {
  P.mode = 'house';
  if (!keepWalls || !P.walls.length) { P.ceiling = 8; P.wallT = 4.5 / 12; }
  P.newKind = 'wood';
  if (!P.roof) P.roof = { type: 'gable', pitch: 6, overhang: 1 };
  if (!P.floorType) P.floorType = 'lvp';
  if (!P.items) P.items = [];
  if (!P.name || P.name === 'Untitled plan') P.name = 'Untitled house';
}
let modePicked = false;
function updateChrome() {
  const P = ed.plan, house = P.mode === 'house';
  document.body.dataset.mode = house ? 'house' : 'cleanroom';
  $('#modeChip').textContent = house ? 'Project' : 'Cleanroom';
  $('#docName').textContent = (P.name || 'Untitled plan') + (ed.dirty ? ' •' : '');
  document.title = (P.name || 'Untitled plan') + ' — Coll Plan3D';
  const cb = $('#bCeilingLbl'); if (cb) cb.textContent = (P.ceilingSource || (P.ceilingMode === 'manual' && (P.fixtures || []).length)) ? 'Edit ceiling' : 'Add ceiling';
  const empty = !P.walls.length && !(P.draft && P.draft.ents.length) && !P.chases.length && !P.background && !(P.inserts || []).length && !(P.beams || []).length && !(P.columns || []).length && !(P.ceilTiles || []).length && !(P.ceilingGrid || []).length && !(P.ceilingMode === 'manual' && (P.fixtures || []).length);
  $('#welcome').hidden = !empty;
  if (empty) { $('#wPick').hidden = modePicked; $('#wNext').hidden = !modePicked; welcomeText(); }
}

/* ---------- 3D ---------- */
function ensureViewer() {
  if (viewer) return viewer;
  viewer = Plan3DViewer.mount($('#view3d'), clonePlan(), { superSrc: 'vendor/superrender.js', onSnapshot: (sn) => { ed.edit(P => { P.snaps = (P.snaps || []).concat([sn]); }); toast('Snapshot saved with the plan.', { label: 'Review snapshots', fn: () => snapsDialog() }); } });
  return viewer;
}
// the 3D view doesn't need the background drawing or the snapshot pictures (big), so they stay out of its copy
// a copy for the customer: no prices, markup, purchase orders or the app's own records
function linkPlan() { const p = clonePlan(); for (const k of ['quote', 'pos', 'baseline', 'changeOrders', 'published', 'approvals', 'submittal', 'install']) delete p[k]; return p; }
function clonePlan() { const sn = ed.plan.snaps; if (sn) delete ed.plan.snaps; let p; try { p = JSON.parse(JSON.stringify(ed.plan)); } finally { if (sn) ed.plan.snaps = sn; } delete p.background; return p; }
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
$('#optPosts').addEventListener('change', e => { ed.showPosts = e.target.checked; ed.render(); });

const TOOL_KEYS = { l: 'draft', q: 'grille', j: 'header', v: 'select', n: 'piece', w: 'wall', d: 'door', f: 'door2', g: 'glass', o: 'open', p: 'pass', c: 'chase', r: 'room', k: 'calibrate', m: 'measure', b: 'beam', i: 'item', e: 'elec', h: 'overhead', u: 'column', a: 'carea', t: 'grid' };
const HOUSE_ONLY = new Set(['draft']), CLEANROOM_ONLY = new Set(['piece', 'pass', 'chase', 'column', 'carea', 'grid']);
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
    if (view !== '3d' && view !== 'build') {
      if (k === 'g') { ed.groupSel(!e.shiftKey); renderProps(); e.preventDefault(); return; }
      if (k === 'a') { ed.setTool('select'); ed.setMulti(ed.allRefs()); e.preventDefault(); return; }
      if (k === 'c') { copyPieces(); e.preventDefault(); return; }
      if (k === 'v') { pastePiecesHere(); e.preventDefault(); return; }
    }
    return;
  }
  if (view === '3d') return;
  if (e.key === 'Tab' && ed.tool === 'elec' && !e.ctrlKey && !e.altKey && !/^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '')) { elecOpen = !elecOpen; elecPalette(); e.preventDefault(); return; }
  if (view === 'build') { if (builder && builder.key(e)) e.preventDefault(); return; }
  if (ed.key(e)) { e.preventDefault(); return; }
  if (Plan3DBuilder.NUM_KEYS[e.key] && !e.altKey) { ed.setTool('piece'); pal2d.setTool(Plan3DBuilder.NUM_KEYS[e.key]); e.preventDefault(); return; }
  const t = TOOL_KEYS[e.key.toLowerCase()], hm = ed.plan.mode === 'house';
  if (t && !e.altKey && !(hm && CLEANROOM_ONLY.has(t)) && !(!hm && HOUSE_ONLY.has(t))) { ed.setTool(t); e.preventDefault(); }
});
window.addEventListener('keyup', e => { if (e.key === ' ') ed.key(e); });

/* ---------- Properties panel ---------- */
function fld(label, html) { return `<div class="fld"><label>${label}</label>${html}</div>`; }
function txt(id, val, ph) { return `<input type="text" id="${id}" value="${esc(val)}" spellcheck="false"${ph ? ` placeholder="${esc(ph)}"` : ''}>`; }
function bindLen(id, unit, apply) {
  const el = $('#' + id); if (!el) return;
  const go = () => { const v = parseLen(el.value, unit); if (isFinite(v) && v >= 0) apply(v); else { el.style.borderColor = 'var(--warn)'; setTimeout(() => el.style.borderColor = '', 900); } };
  el.addEventListener('change', go); el.addEventListener('keydown', e => { if (e.key === 'Enter') { go(); el.blur(); } });
}
// a hardwall's usual height: the top of the tallest ceiling area it bounds (rooms can have their own ceiling and plenum)
/* Make a wall h tall (floor to top). A building or framed wall takes its own height; a cleanroom hardwall gets
   one height section the length of the wall (its default height again: the section goes). */
function setWallHeight(P, w, h) {
  const hard = Plan3DViewer.isHard(w);
  if (!hard) { w.h = Math.max(6, Math.min(80, h)); return; }
  const def = wallTopOf(P, w), L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  if (Math.abs(h - def) < 1 / 96) delete w.sections; else w.sections = [{ a: 0, b: +L.toFixed(4), h: Math.max(6, Math.min(80, h)) }];
}
function wallHeightOf(P, w) {
  if (!Plan3DViewer.isHard(w)) return Plan3DViewer.WALL_KINDS[w.kind] && Plan3DViewer.WALL_KINDS[w.kind].frame ? (w.h || P.ceiling || 8) : Plan3DViewer.shellHeight(P, w);
  const secs = w.sections || [], L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  return secs.length === 1 && Math.min(secs[0].a, secs[0].b) < 0.01 && Math.max(secs[0].a, secs[0].b) > L - 0.01 ? secs[0].h : wallTopOf(P, w);
}
// several walls picked: one height for all of them
async function wallHeightDialog() {
  const P = ed.plan, W = (ed.multi || (ed.sel ? [ed.sel] : [])).filter(r => r.kind === 'wall').map(r => ed.find(r)).filter(Boolean);
  if (!W.length) { toast('Pick the walls first: Shift-drag a box around them, or Shift+click them.'); return; }
  const hs = [...new Set(W.map(w => +wallHeightOf(P, w).toFixed(3)))];
  const v = await dialogOpen({ title: 'Wall height', body: `<p>${W.length} wall${W.length === 1 ? '' : 's'} picked, ${hs.length === 1 ? 'all ' + esc(fmt(hs[0])) + ' tall' : 'now ' + hs.map(fmt).map(esc).join(', ') + ' tall'}.</p>${fld('Make them', txt('whH', fmt(Math.max(...hs))))}<p class="note">Floor to top. Cleanroom walls run on up past the ceiling to this height (the panels and posts on the parts list grow with them); the rest of the cleanroom stays as it is. To raise the ceiling over a room along with its walls, use a <b>Ceiling area</b> (A) with <b>Raise the walls and the top with it</b>.</p>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Back to normal', ret: 'reset' }, { label: 'Set height', primary: true, value: () => parseLen($('#whH').value, 'ft') }], onOpen: () => { $('#whH').focus(); $('#whH').select(); } });
  if (v == null) return;
  if (v === 'reset') { ed.edit(() => { for (const w of W) { if (Plan3DViewer.isHard(w)) delete w.sections; else delete w.h; } }); toast('Walls back to their normal height.'); renderProps(); queue3D(); return; }
  if (!(v > 1)) { toast('Type a height like 12 ft or 14 ft 6 in.'); return; }
  ed.edit(() => { for (const w of W) setWallHeight(P, w, v); });
  toast(`${W.length} wall${W.length === 1 ? '' : 's'} now ${fmt(v)} tall.`); renderProps(); queue3D();
}
/* FFUs and lights set into the ceiling's openings: the imported drawing's holes (each one moves up to 1′ to
   the opening it's over), or the grid's cells. ids: just those fixtures (null: all of them). */
function snapFixturesIn(ids) {
  let moved = 0, holes = 0, n = 0; const drawn = Array.isArray(ed.plan.ceilingGrid) && ed.plan.ceilingGrid.length;
  ed.edit(Q => { for (const f of Q.fixtures || []) {
    if (ids && !ids.has(f.id)) continue; n++;
    let q;
    if (drawn) { const d = Plan3DViewer.snapToDrawn(Q, f, 1); q = d && d.caught ? d : f; if (d && d.inHole) holes++; }
    else { const G = Plan3DViewer.gridAt(Q, f.x, f.y), w = f.w || (G.swap ? 4 : 2), h = f.h || (G.swap ? 2 : 4); q = Plan3DViewer.snapFixture({ ...f, w, h }, G); f.w = w; f.h = h; }
    if (Math.hypot(q.x - f.x, q.y - f.y) > 0.004) { moved++; f.x = q.x; f.y = q.y; }
  } });
  toast(drawn ? `${holes} of ${n} FFUs and lights sit in an opening of the ceiling drawing${moved ? ` (${moved} moved into place)` : ''}.${holes < n ? ' The others are more than 1′ from an opening that fits them: drag them over one, or nudge them with the arrow keys.' : ''}` : moved ? `Moved ${moved} fixture${moved === 1 ? '' : 's'} into the grid cells.` : 'Everything already sits in the grid.');
}
// cleanroom walls with one height section along their whole length (set with Wall height or the Height field)
function ownHeightWalls(P) { return (P.walls || []).filter(w => Plan3DViewer.isHard(w) && Array.isArray(w.sections) && w.sections.length === 1 && Math.min(w.sections[0].a, w.sections[0].b) < 0.01 && Math.max(w.sections[0].a, w.sections[0].b) > Math.hypot(w.x2 - w.x1, w.y2 - w.y1) - 0.05); }
function wallTopOf(P, w) {
  try { for (const z of Plan3DViewer.zones(P)) if ((z.plan.walls || []).includes(w)) return Math.max(6, z.plan.ceiling || 8) + Math.max(0, +z.plan.plenum || 0); } catch (e) { /* fall back to the building's */ }
  const K = Plan3DViewer.roomKey(P, null); return K.H + K.PL;
}
// panel colour picker: a swatch dot by each name; first option is "the plan's colour" when picking for one wall
function panelColorSelect(id, cur, planDefault) {
  const PC = Plan3DViewer.PANEL_COLORS;
  const opts = (planDefault ? [`<option value="" ${!cur ? 'selected' : ''}>Same as the plan (${esc(PC[planDefault][0])})</option>`] : [])
    .concat(Object.entries(PC).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(v[0])}</option>`));
  const sw = (PC[cur || planDefault] || PC.white)[1];
  return `<div style="display:flex;gap:6px;align-items:center"><span id="${id}Sw" style="width:18px;height:18px;border-radius:4px;border:1px solid var(--line);flex:0 0 auto;background:${sw}"></span><select id="${id}" style="flex:1">${opts.join('')}</select></div>`;
}
function renderProps(opt) {
  const box = $('#props'), P = ed.plan, s = ed.sel, o = ed.selected();
  let h = '';
  // general drafting: its own panel (exact sizes, layer, the edit commands)
  if (ed.multi && ed.multi.length > 1 && ed.multi.every(r => r.kind === 'dent')) { draftProps(box, null); return; }
  if (s && o && s.kind === 'dent' && !(ed.multi && ed.multi.length > 1)) { draftProps(box, o); return; }
  if (ed.multi && ed.multi.length > 1) {
    const M = ed.multi, cnt = {}, NAMES = { grille: 'return grille', header: 'header panel run', lstep: 'lid step panel run', deck: 'lid piece', tile: 'ceiling tile', dent: 'drawing piece', wall: 'wall', opening: 'doors and windows', chase: 'chase', room: 'room label', device: 'device', item: 'item', column: 'column', insert: 'building', beam: 'beam', carea: 'ceiling area', gzone: 'grid section', fixture: 'FFUs and lights' };
    M.forEach(r => { cnt[r.kind] = (cnt[r.kind] || 0) + 1; });
    const grouped = M.every(r => { const x = ed.find(r); return x && x.gid && x.gid === ed.find(M[0]).gid; });
    box.innerHTML = `<div class="hd"><span class="kind">${M.length} pieces selected${grouped ? ' (a group)' : ''}</span><button class="btn small danger" id="mDel">Delete</button></div>
      <div class="grp"><div class="stats">${Object.entries(cnt).map(([k, n]) => `<span>${esc(NAMES[k] || k)}${n > 1 && k !== 'opening' && k !== 'fixture' ? 's' : ''}</span><span>${n}</span>`).join('')}</div></div>
      <div class="row">${grouped ? '<button class="btn small" id="mUngroup">Ungroup</button>' : '<button class="btn small" id="mGroup">Group them</button>'}<button class="btn small" id="mCopy">Copy</button><button class="btn small" id="mSize">Resize…</button>${M.some(r => r.kind === 'wall') ? '<button class="btn small" id="mWH">Wall height…</button>' : ''}${M.some(r => r.kind === 'fixture') ? '<button class="btn small" id="mSnapFx" title="Set the FFUs and lights picked into the ceiling grid\'s openings">Snap into the grid</button>' : ''}</div>
      ${M.some(r => r.kind === 'wall') ? `<div class="grp">${fld('Panel color', panelColorSelect('mPC', '', Plan3DViewer.panelColorOf(P)))}</div>` : ''}
      <div class="row"><button class="btn small primary" id="mSave">Save to the library…</button></div>
      <p class="note">Drag any of them to move them all; their walls catch on nearby wall ends (hold Alt to move freely). Shift+click adds or takes out one piece; Shift-drag a box adds more. A group stays together: clicking one piece picks up the whole group. Ctrl+G groups, Ctrl+Shift+G ungroups, Ctrl+C / Ctrl+V copy and paste.</p>`;
    $('#mDel').onclick = () => ed.deleteSel();
    if ($('#mPC')) $('#mPC').onchange = e => { const v = e.target.value, W = M.filter(r => r.kind === 'wall').map(r => ed.find(r)).filter(Boolean); ed.edit(() => { W.forEach(w => { if (v) w.color = v; else delete w.color; }); }); toast(`${W.length} wall${W.length === 1 ? '' : 's'} ${v ? 'set to ' + Plan3DViewer.PANEL_COLORS[v][0].toLowerCase() : 'back to the plan color'}.`); renderProps(); queue3D(); };
    if ($('#mGroup')) $('#mGroup').onclick = () => { ed.groupSel(true); renderProps(); };
    if ($('#mUngroup')) $('#mUngroup').onclick = () => { ed.groupSel(false); renderProps(); };
    $('#mCopy').onclick = copyPieces; $('#mSave').onclick = saveGroupDialog; $('#mSize').onclick = resizeSelection; if ($('#mWH')) $('#mWH').onclick = wallHeightDialog; if ($('#mSnapFx')) $('#mSnapFx').onclick = () => snapFixturesIn(new Set(M.filter(r => r.kind === 'fixture').map(r => r.id)));
    return;
  }
  if (s && o && s.kind === 'wall') {
    const len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
    const KINDS = Plan3DViewer.WALL_KINDS, kind = Plan3DViewer.isHard(o) ? 'hardwall' : o.kind, hard = kind === 'hardwall';
    const kindOrder = Object.entries(KINDS).sort((a, b) => P.mode === 'house' ? (!!b[1].frame - !!a[1].frame) : 0);
    h = `<div class="hd"><span class="kind">${hard ? 'Wall' : esc(KINDS[kind].short) + ' wall'}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Wall type', `<select id="pKind">${kindOrder.map(([k, v]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>`)}
      ${fld('Length', txt('pLen', fmt(len)))}
      ${fld('Thickness', txt('pT', fmtIn(o.t || 0.25)))}
      ${hard ? fld('S.P. panel', `<label class="chk"><input type="checkbox" id="pSP" ${o.sp ? 'checked' : ''}> Highlight yellow</label>`) : ''}${hard ? fld('Panel color', panelColorSelect('pPC', o.color || '', Plan3DViewer.panelColorOf(P))) : ''}${fld('Height', txt('pWH', fmt(wallHeightOf(P, o))))}
      ${KINDS[kind].frame ? fld('Studs', `<select id="pStud">${(kind === 'steel' ? [['', 'Auto (6″ outside, 3⅝″ inside)'], ['3⅝″', '3⅝″ steel'], ['6″', '6″ steel']] : [['', 'Auto (2×6 outside, 2×4 inside)'], ['2×4', '2×4'], ['2×6', '2×6']]).map(([v, l]) => `<option value="${v}" ${(o.stud || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)
        + fld('Exterior wall', `<select id="pExt"><option value="" ${o.ext == null ? 'selected' : ''}>Auto (outside walls)</option><option value="1" ${o.ext === true ? 'selected' : ''}>Yes: sheathing, wrap, siding</option><option value="0" ${o.ext === false ? 'selected' : ''}>No: drywall both sides</option></select>`) : ''}
      ${hard ? (() => {
        const def = wallTopOf(P, o), secs = Array.isArray(o.sections) ? o.sections : [];
        return `<div class="grp"><h3>Height sections</h3>
        ${secs.map((q, i) => `<div class="fld"><label>Section ${i + 1}</label><div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:4px">${txt('pSa' + i, fmt(Math.min(q.a, q.b)), 'from')}${txt('pSb' + i, fmt(Math.max(q.a, q.b)), 'to')}${txt('pSh' + i, fmt(q.h), 'height')}<button class="btn small" id="pSx${i}" title="Remove this section">✕</button></div></div>`).join('')}
        <div class="row"><button class="btn small" id="pSecAdd">Add a section</button></div>
        <p class="note">${secs.length ? 'From and to are measured along the wall from its first end; height is floor to top. ' : ''}The rest of the wall is ${esc(fmt(def))} tall. Where the height steps, the panels split and the step gets an end cap; a section not at the cleanroom's top gets a top cap. Both go on the parts list.</p></div>`;
      })() : ''}
      <div class="row"><button class="btn small" id="pSplit">Split in half</button><button class="btn small" id="pAllT">Use this thickness on all walls</button></div>
      ${hard ? '' : '<div class="row"><button class="btn small" id="pAllK">Make every connected wall this type</button></div>'}
      <p class="note">${hard ? 'Hardwall panels are cleanroom walls: panels, studs, floor track, base and the grid ceiling.' : KINDS[kind].frame ? 'House wall: studs at 16″, plates and headers; drywall inside; sheathing, wrap and siding on outside walls.' : 'Building walls run to their own height, have no cleanroom ceiling, and go on the parts list by length and area.'} Length changes move the second end.</p>`;
    box.innerHTML = h;
    $('#pKind').onchange = e => ed.edit(() => {
      const k = e.target.value;
      if (k === 'hardwall') { delete o.kind; delete o.h; if ((o.t || 0) > 0.4) o.t = P.wallT && P.wallT < 0.4 ? P.wallT : 0.25; }
      else { o.kind = k; o.sp = false; o.t = KINDS[k].t; }
    });
    bindLen('pWH', 'ft', v => { ed.edit(() => setWallHeight(P, o, v)); renderProps(); });
    if ($('#pStud')) $('#pStud').onchange = e => ed.edit(() => { if (e.target.value) o.stud = e.target.value; else delete o.stud; });
    if ($('#pExt')) $('#pExt').onchange = e => ed.edit(() => { if (e.target.value === '') delete o.ext; else o.ext = e.target.value === '1'; });
    if ($('#pAllK')) $('#pAllK').onclick = () => ed.edit(Pl => {
      // walk along walls joined end to end
      const todo = [o], done = new Set([o]), near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05;
      while (todo.length) { const w = todo.pop(); for (const q of Pl.walls) { if (done.has(q)) continue; const e1 = [[w.x1, w.y1], [w.x2, w.y2]], e2 = [[q.x1, q.y1], [q.x2, q.y2]]; if (e1.some(a => e2.some(b => near(a, b)))) { done.add(q); todo.push(q); } } }
      done.forEach(q => { q.kind = o.kind; q.t = o.t; q.sp = false; if (o.h) q.h = o.h; else delete q.h; });
      toast(done.size + ' walls set to ' + KINDS[o.kind].short + '.');
    });
    bindLen('pLen', 'ft', v => ed.edit(() => { const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1; const ux = (o.x2 - o.x1) / L, uy = (o.y2 - o.y1) / L; const linked = ed.linkedEnds(o.x2, o.y2, o); o.x2 = o.x1 + ux * v; o.y2 = o.y1 + uy * v; linked.forEach(l => { if (l.end === 1) { l.w.x1 = o.x2; l.w.y1 = o.y2; } else { l.w.x2 = o.x2; l.w.y2 = o.y2; } }); }));
    bindLen('pT', 'in', v => ed.edit(() => { o.t = Math.max(1 / 48, v); }));
    if ($('#pSP')) $('#pSP').onchange = e => ed.edit(() => { o.sp = e.target.checked; });
    if ($('#pPC')) $('#pPC').onchange = e => { ed.edit(() => { if (e.target.value) o.color = e.target.value; else delete o.color; }); renderProps(); queue3D(); };
    if (hard) {
      const def = wallTopOf(P, o), secs = Array.isArray(o.sections) ? o.sections : [];
      secs.forEach((q, i) => {
        const clampS = v => Math.max(0, Math.min(len, v));
        bindLen('pSa' + i, 'ft', v => ed.edit(() => { q.a = clampS(v); }));
        bindLen('pSb' + i, 'ft', v => ed.edit(() => { q.b = clampS(v); }));
        bindLen('pSh' + i, 'ft', v => ed.edit(() => { q.h = Math.max(1, Math.min(40, v)); }));
        $('#pSx' + i).onclick = () => ed.edit(() => { o.sections.splice(i, 1); if (!o.sections.length) delete o.sections; });
      });
      // a new section: the last 4′ of the wall past the last section, 2′ lower than the rest
      $('#pSecAdd').onclick = () => ed.edit(() => {
        const end = secs.reduce((m, q) => Math.max(m, q.a, q.b), 0), a = end > 0 && end < len - 1 ? end : Math.max(0, len - 4);
        (o.sections = o.sections || []).push({ a: +a.toFixed(4), b: +Math.min(len, a + 4).toFixed(4), h: Math.max(6, def - 2) });
      });
    }
    $('#pSplit').onclick = () => ed.edit(Pl => { const mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2; const n = { ...o, id: Plan3DEditor.uid(), x1: mx, y1: my }; o.x2 = mx; o.y2 = my; Pl.walls.push(n);
      // height sections go with the half they're on (cut at the middle)
      if (Array.isArray(o.sections)) { const half = len / 2, all = o.sections; o.sections = all.map(q => ({ a: Math.min(q.a, q.b), b: Math.min(Math.max(q.a, q.b), half), h: q.h })).filter(q => q.b - q.a > 0.01); n.sections = all.map(q => ({ a: Math.max(Math.min(q.a, q.b), half) - half, b: Math.max(q.a, q.b) - half, h: q.h })).filter(q => q.b - q.a > 0.01); if (!o.sections.length) delete o.sections; if (!n.sections.length) delete n.sections; } });
    $('#pAllT').onclick = () => ed.edit(Pl => { Pl.walls.forEach(w => { w.t = o.t; }); Pl.wallT = o.t; });
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'opening') {
    const len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
    const types = P.mode === 'house' ? [['door', 'Door'], ['door2', 'Double door'], ['window', 'Window'], ['open', 'Cased opening'], ['glass', 'Glass panel'], ['overhead', 'Overhead door']] : [['door', 'Single door'], ['door2', 'Pair of doors'], ['glass', 'Glass panel'], ['window', 'Window'], ['open', 'Cased opening'], ['pass', 'Pass-thru'], ['overhead', 'Overhead door'], ['removable', 'Removable wall section']];
    const isPass = o.type === 'pass', sill = o.sill == null ? 3 : o.sill;
    h = `<div class="hd"><span class="kind">${esc(types.find(t => t[0] === o.type)[1])}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Type', `<select id="pType">${types.map(t => `<option value="${t[0]}" ${t[0] === o.type ? 'selected' : ''}>${t[1]}</option>`).join('')}</select>`)}
      ${fld('Width', txt('pW', fmt(len)))}
      ${isPass ? fld('Height', txt('pPH', fmtIn((o.head || 5) - sill))) + fld('Bottom at', txt('pSill', fmt(sill))) + fld('Depth', txt('pDepth', fmtIn(o.depth || 2))) : fld(o.type === 'glass' || o.type === 'window' ? 'Top' : o.type === 'removable' ? 'Header height' : 'Head height', txt('pHead', fmt(o.head || 7)))}
      ${o.type === 'glass' || o.type === 'window' ? fld('Sill height', txt('pSill', fmt(sill))) : ''}
      ${o.type === 'overhead' ? `<div class="row"><button class="btn small" id="pSwing">Flip inside face</button></div>` : ''}
      ${o.type === 'door' || o.type === 'door2' ? `${fld('Build', `<label class="chk"><input type="checkbox" id="pStd" ${o.style === 'cr' ? 'checked' : ''}> Standard door (frame, 84″ leaves, vision lite, lever)</label>`)}${o.style === 'cr' ? fld('Leaf width', txt('pLeafW', fmtIn(o.leafW || 3))) : ''}` : ''}
      ${(o.type === 'door' || o.type === 'door2') && P.mode !== 'house' && P.openings.some(q => (q.type === 'door' || q.type === 'door2') && q.style !== 'cr') ? `<div class="row"><button class="btn small" id="pStdAll" title="Every door and pair on the plan becomes the standard door (frame, 84″ leaves, vision lite, lever), the same opening width it has now">Make all doors standard</button></div>` : ''}
      ${o.type === 'door' || o.type === 'door2' ? `<div class="row"><button class="btn small" id="pSwing">Flip swing side</button>${o.type === 'door' ? '<button class="btn small" id="pHinge">Swap hinge side</button>' : ''}</div>` : ''}
      ${o.type === 'removable' ? (() => { const RL = Plan3DViewer.removableLayout(len, o.head || 8, 99); return `<div class="stats"><span>Panels</span><span>${RL.n} × ${fmtIn(RL.panelW)} wide × ${fmt(RL.panelH)}</span><span>Frame</span><span>3″ × 3″ steel tube posts to the lid, painted to match the room, header tube, 1″ white wall start</span><span>Joints</span><span>${RL.n - 1 ? (RL.n - 1) + ' H-stud' + (RL.n > 2 ? 's' : '') + ' with insert, and in the header panel above' : 'none (one panel)'}</span></div>`; })() : ''}
      <p class="note">${isPass ? 'Stainless box with a door on each face. Depth is front to back through the wall. ' : ''}${o.type === 'removable' ? 'The wall panels in it come out to bring equipment through; the parts list, fabrication sheets and PO list them as removable. ' : ''}Drag along the wall to slide it. Drag it onto another wall to move it there.</p>`;
    box.innerHTML = h;
    $('#pType').onchange = e => ed.edit(() => { const was = o.type; o.type = e.target.value; if (o.type === 'window' && was !== 'window') { o.sill = 3; o.head = 6 + 8 / 12; } if (o.type === 'glass' && o.sill == null) o.sill = 3; if (o.type === 'removable') { delete o.sill; o.head = Math.min(8, P.ceiling || 8); } if (o.type === 'pass') { o.sill = 3; o.head = 5; o.depth = o.depth || 2; } else if (was === 'pass') { o.head = 7; if (o.type !== 'glass') delete o.sill; } });
    bindLen('pW', 'ft', v => ed.edit(() => { const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1, ux = (o.x2 - o.x1) / L, uy = (o.y2 - o.y1) / L, cx = (o.x1 + o.x2) / 2, cy = (o.y1 + o.y2) / 2; o.x1 = cx - ux * v / 2; o.y1 = cy - uy * v / 2; o.x2 = cx + ux * v / 2; o.y2 = cy + uy * v / 2; }));
    // openings in building walls can be taller than the cleanroom ceiling (an overhead door, say)
    const topFor = () => { let best = null, bd = 1.5; for (const w of P.walls) { const d = Plan3DViewer.segDist((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, w.x1, w.y1, w.x2, w.y2); if (d < bd) { bd = d; best = w; } } return best && !Plan3DViewer.isHard(best) ? Plan3DViewer.shellHeight(P, best) : P.ceiling; };
    bindLen('pHead', 'ft', v => ed.edit(() => { o.head = Math.min(topFor(), Math.max(1, v)); }));
    bindLen('pSill', 'ft', v => ed.edit(() => { const h = (o.head || 5) - (o.sill == null ? 3 : o.sill); o.sill = Math.max(0, v); if (isPass) o.head = Math.min(P.ceiling - 0.25, o.sill + h); }));
    bindLen('pPH', 'in', v => ed.edit(() => { o.head = Math.min(P.ceiling - 0.25, (o.sill == null ? 3 : o.sill) + Math.max(0.5, v)); }));
    bindLen('pDepth', 'in', v => ed.edit(() => { o.depth = Math.max(o.t || 0.25, v); }));
    if ($('#pSwing')) $('#pSwing').onclick = () => ed.edit(() => { o.swing = o.swing === -1 ? 1 : -1; });
    if ($('#pStd')) $('#pStd').onchange = (e) => ed.edit(() => { if (e.target.checked) { o.style = 'cr'; o.head = 86 / 12; } else { delete o.style; delete o.leafW; o.head = 7; } });
    bindLen('pLeafW', 'in', v => ed.edit(() => { o.leafW = Math.max(1.5, Math.min(5, v)); }));
    if ($('#pStdAll')) $('#pStdAll').onclick = () => { let n = 0; ed.edit(Pl => { n = standardDoors(Pl); }); toast(n ? `${n} door${n === 1 ? '' : 's'} made standard, same openings.` : 'Every door is standard already.'); };
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
      ${o.grille ? (() => {
        const face = (o.grille === 'N' || o.grille === 'S') ? w : d, G = Plan3DViewer.grilleSize(o, face, P.ceiling);
        const sizes = [[12, 12], [18, 12], [20, 20], [24, 12], [24, 18], [24, 24], [36, 12], [36, 18], [48, 12], [48, 18]];
        const cur = Math.round(G.w * 12) + 'x' + Math.round(G.h * 12);
        return `${fld('Grille size', `<select id="pGrSz"><option value="">Custom</option>${sizes.filter(([a]) => a / 12 <= face - 0.1 + 1e-6).map(([a, b]) => `<option value="${a}x${b}" ${cur === a + 'x' + b ? 'selected' : ''}>${a}″ × ${b}″</option>`).join('')}</select>`)}
          ${fld('Grille width', txt('pGrW', fmtIn(G.w)))}
          ${fld('Grille height', txt('pGrH', fmtIn(G.h)))}
          ${fld('Bottom above floor', txt('pGrS', fmtIn(G.sill)))}
          ${fld('Damper', `<label class="chk"><input type="checkbox" id="pDmp" ${G.damper ? 'checked' : ''}> Opposed-blade damper behind the grille</label>`)}
          <div class="row"><button class="btn small" id="pGrAll">Use this grille on every chase</button></div>`;
      })() : ''}
      <p class="note">Runs full height, floor to ceiling. The grille is centred on the face you pick; its size and damper go on the parts list.</p>`;
    box.innerHTML = h;
    bindLen('pCW', 'in', v => ed.edit(() => { const x = Math.min(o.x0, o.x1); o.x0 = x; o.x1 = x + Math.max(0.1, v); }));
    bindLen('pCD', 'in', v => ed.edit(() => { const y = Math.min(o.y0, o.y1); o.y0 = y; o.y1 = y + Math.max(0.1, v); }));
    $$('#pGr button').forEach(b => b.onclick = () => ed.edit(() => { o.grille = b.dataset.f; }));
    if (o.grille) {
      bindLen('pGrW', 'in', v => ed.edit(() => { o.grW = Math.max(0.25, v); }));
      bindLen('pGrH', 'in', v => ed.edit(() => { o.grH = Math.max(0.25, v); }));
      bindLen('pGrS', 'in', v => ed.edit(() => { o.grSill = Math.max(0, v); }));
      $('#pGrSz').onchange = (e) => { if (!e.target.value) return; const [a, b] = e.target.value.split('x').map(Number); ed.edit(() => { o.grW = a / 12; o.grH = b / 12; }); };
      $('#pDmp').onchange = (e) => ed.edit(() => { o.damper = e.target.checked; });
      $('#pGrAll').onclick = () => {
        const face = (o.grille === 'N' || o.grille === 'S') ? w : d, G = Plan3DViewer.grilleSize(o, face, P.ceiling);
        let n = 0;
        ed.edit(Q => { for (const c of Q.chases || []) { if (!c.grille) continue; c.grW = G.w; c.grH = G.h; c.grSill = G.sill; c.damper = G.damper; n++; } });
        toast(`Grille ${fmtIn(G.w)} × ${fmtIn(G.h)}${G.damper ? ' with damper' : ''} set on ${n} chase${n === 1 ? '' : 's'}. Grilles wider than a chase face are trimmed to fit.`);
      };
    }
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'gzone') {
    const V = Plan3DViewer, G0 = V.ceilingGrid(P), Z = V.zoneGrid(o), b = { x0: Math.min(o.x0, o.x1), x1: Math.max(o.x0, o.x1), y0: Math.min(o.y0, o.y1), y1: Math.max(o.y0, o.y1) };
    h = `<div class="hd"><span class="kind">Grid section</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Tiles run', `<select id="pGzS"><option value="0" ${!o.swap ? 'selected' : ''}>4′ side up and down the plan</option><option value="1" ${o.swap ? 'selected' : ''}>4′ side across the plan</option></select>`)}
      ${fld('Lines start at', `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${txt('pGzX', fmt(Z.ox), 'x')}${txt('pGzY', fmt(Z.oz), 'y')}</div>`)}
      <div class="row"><button class="btn small" id="pGzL">← 1″</button><button class="btn small" id="pGzR">1″ →</button><button class="btn small" id="pGzU">↑ 1″</button><button class="btn small" id="pGzD">1″ ↓</button><button class="btn small" id="pGzL6">← 6″</button><button class="btn small" id="pGzR6">6″ →</button><button class="btn small" id="pGzU6">↑ 6″</button><button class="btn small" id="pGzD6">6″ ↓</button></div>
      <div class="row"><button class="btn small" id="pGzC">Start at this section's corner</button><button class="btn small" id="pGzM">Line up with the main grid</button><button class="btn small" id="pGzCt">Centre in the section</button></div>
      <div class="row"><button class="btn small" id="pGzF">Fit the FFUs and lights into it</button></div>
      ${fld('Size', `<span class="mono">${esc(fmt(b.x1 - b.x0))} × ${esc(fmt(b.y1 - b.y0))}</span>`)}
      <p class="note">This part of the ceiling gets its own grid: turned, or shifted so its lines meet a wall or another grid where you want. The 3D view, plenum tees, plan and parts list follow it. Drag its outline or label to move it (its lines move with it).</p>`;
    box.innerHTML = h;
    const set = (fn) => ed.edit(() => { fn(); });
    $('#pGzS').onchange = e => set(() => { o.swap = e.target.value === '1'; });
    bindLen('pGzX', 'ft', v => set(() => { o.ox = v; })); bindLen('pGzY', 'ft', v => set(() => { o.oy = v; }));
    const nudge = (dx, dy) => set(() => { o.ox = +(Z.ox + dx).toFixed(4); o.oy = +(Z.oz + dy).toFixed(4); });
    for (const [id, dx, dy] of [['pGzL', -1 / 12, 0], ['pGzR', 1 / 12, 0], ['pGzU', 0, -1 / 12], ['pGzD', 0, 1 / 12], ['pGzL6', -0.5, 0], ['pGzR6', 0.5, 0], ['pGzU6', 0, -0.5], ['pGzD6', 0, 0.5]]) $('#' + id).onclick = () => nudge(dx, dy);
    $('#pGzC').onclick = () => set(() => { delete o.ox; delete o.oy; });
    $('#pGzM').onclick = () => set(() => { o.ox = G0.ox; o.oy = G0.oz; });
    $('#pGzCt').onclick = () => set(() => { o.ox = +((b.x0 + b.x1) / 2).toFixed(4); o.oy = +((b.y0 + b.y1) / 2).toFixed(4); });
    $('#pGzF').onclick = () => { let n = 0; ed.edit(Q => { for (const f of Q.fixtures || []) { if (f.x < b.x0 || f.x > b.x1 || f.y < b.y0 || f.y > b.y1) continue; const G = V.zoneGrid(o), long = Math.max(f.w || 2, f.h || 4), short = Math.min(f.w || 2, f.h || 4), w = G.cw > G.cl ? long : short, hh = G.cw > G.cl ? short : long, q = V.snapFixture({ ...f, w, h: hh }, G); f.w = w; f.h = hh; f.x = q.x; f.y = q.y; n++; } }); toast(n ? `Fitted ${n} FFU${n === 1 ? '' : 's'} and lights into this section's grid.` : 'No FFUs or lights in this section.'); };
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'carea') {
    const K = Plan3DViewer.roomKey(P, null), top = K.H + K.PL, w = Math.abs(o.x1 - o.x0), d = Math.abs(o.y1 - o.y0);
    h = `<div class="hd"><span class="kind">Ceiling area</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Ceiling', txt('pCaH', fmt(+o.ceiling || K.H)))}
      ${fld('Walls', `<label class="chk"><input type="checkbox" id="pCaR" ${o.raise ? 'checked' : ''}> Raise the walls and the top with it (a taller section)</label>`)}
      ${fld('No walls', `<label class="chk"><input type="checkbox" id="pCaH" ${o.hang ? 'checked' : ''}> Hang the grid here even without walls round it (an open area, a canopy)</label>`)}
      ${fld('Size', `<span class="mono">${esc(fmt(Math.max(w, d)))} × ${esc(fmt(Math.min(w, d)))}</span>`)}
      <p class="note">This part of the room gets its own ceiling, raised or dropped. Where its edge crosses open ceiling, bulkhead panels fill the step (on the parts list with their H-studs and closure channel); along walls the ceiling track follows it. ${o.raise ? `The walls in and around it go up to its ceiling plus the plenum (${esc(fmt((+o.ceiling || K.H) + K.PL))}), and the top steps up over it with panels closing the step.` : `It stays at least 3″ under the top of the walls (${esc(fmt(top))}); tick <b>Raise the walls</b> to make this part of the room taller.`} Drag its outline or label to move it.</p>`;
    box.innerHTML = h;
    bindLen('pCaH', 'ft', v => ed.edit(() => { o.ceiling = Math.max(6, Math.min(40, v)); }));
    $('#pCaR').onchange = (e) => { ed.edit(() => { if (e.target.checked) o.raise = true; else delete o.raise; }); renderProps(); };
    $('#pCaH').onchange = (e) => { ed.edit(() => { if (e.target.checked) o.hang = true; else delete o.hang; }); renderProps(); };
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'grille') {
    const Wi = Math.round(o.w * 12), Hi = Math.round(o.h * 12), key = Wi === 20 && Hi === 20 ? '20' : Wi === 36 && Hi === 36 ? '36' : 'c';
    box.innerHTML = `<div class="hd"><span class="kind">${o.plenum ? 'Plenum grille' : 'Return grille'}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Size', `<select id="pGS"><option value="20" ${key === '20' ? 'selected' : ''}>20″ × 20″</option><option value="36" ${key === '36' ? 'selected' : ''}>36″ × 36″</option><option value="c" ${key === 'c' ? 'selected' : ''}>Custom</option></select>`)}
      ${fld('Width', txt('pGW', fmtIn(o.w)))}${fld('Height', txt('pGH', fmtIn(o.h)))}
      ${fld('Bottom above floor', txt('pGSill', fmtIn(o.sill == null ? 0.5 : o.sill)))}
      ${fld('Damper', `<label class="chk"><input type="checkbox" id="pGD" ${o.damper ? 'checked' : ''}> Opposed-blade damper behind the grille</label>`)}
      ${fld('Air', `<div class="seg" id="pGFlow">${[['in', 'Into the grille (return)'], ['out', 'Out of the grille']].map(([k, l]) => `<button type="button" data-f="${k}" class="${((o.flow || (o.plenum ? 'out' : 'in')) === k) ? 'on' : ''}">${l}</button>`).join('')}</div>`)}
      ${fld('Room side', `<div class="seg" id="pGSide">${[['1', 'This side'], ['-1', 'Other side'], ['0', 'Both (transfer)']].map(([k, l]) => `<button type="button" data-s="${k}" class="${String(o.side == null ? 1 : o.side) === k ? 'on' : ''}">${l}</button>`).join('')}</div>`)}
      <p class="note">Set into the wall panel; the panel stays on the parts list with the grille and damper. Drag it to slide it along the wall or onto another wall. With Airflow on in 3D, purple arrows show the return air going in.</p>`;
    $('#pGS').onchange = (e) => ed.edit(() => { if (e.target.value === '20') o.w = o.h = 20 / 12; if (e.target.value === '36') o.w = o.h = 3; });
    bindLen('pGW', 'in', v => ed.edit(() => { o.w = Math.max(0.25, Math.min(8, v)); }));
    bindLen('pGH', 'in', v => ed.edit(() => { o.h = Math.max(0.25, Math.min(8, v)); }));
    bindLen('pGSill', 'in', v => ed.edit(() => { o.sill = Math.max(0, Math.min(12, v)); }));
    $('#pGD').onchange = (e) => ed.edit(() => { o.damper = e.target.checked; });
    $$('#pGSide button').forEach(b => b.onclick = () => ed.edit(() => { o.side = +b.dataset.s; }));
    $$('#pGFlow button').forEach(b => b.onclick = () => ed.edit(() => { o.flow = b.dataset.f; }));
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'header') {
    const An = Plan3DViewer.analyze(P), q = Plan3DViewer.headerSegs(P, An).find(t => t.id === o.id), L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1), n = Math.ceil(L / 4 - 1e-6);
    box.innerHTML = `<div class="hd"><span class="kind">Header panels</span><button class="btn small danger" id="pDel">Delete</button></div>
      <div class="grp"><div class="stats"><span>Length</span><span>${fmt(L)}</span><span>Panels</span><span>${n} (45″ wide, H-studs 48″ on center)</span><span>Height</span><span>${q ? fmt(q.y0) + ' to ' + fmt(q.y1) + ' (' + fmt(q.y1 - q.y0) + ')' : '—'}</span></div></div>
      ${fld('Bottom at', txt('pHB', o.bot > 0 ? fmt(o.bot) : '', 'The ceiling (' + (q ? fmt(q.y0) : '') + ')'))}
      <div class="row"><button class="btn small" id="pHTool">Add more headers</button></div>
      <p class="note">Wall panels across the gap from the bottom up to the top of the walls on either side, closure channel along the bottom and ceiling track on both faces. Leave Bottom blank to start at the ceiling, or set it (a door head height, say). Drag to move.</p>`;
    $('#pHB').addEventListener('change', e => { if (!e.target.value.trim()) ed.edit(() => { delete o.bot; }); });
    if ($('#pHB')) bindLen('pHB', 'ft', v => ed.edit(() => { if (v > 0) o.bot = Math.min(40, v); else delete o.bot; }));
    $('#pHTool').onclick = () => ed.setTool('header'); $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'lstep') {
    const An = Plan3DViewer.analyze(P), q = Plan3DViewer.deckSteps(P, An, An.WH).find(t => t.id === o.id), L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
    box.innerHTML = `<div class="hd"><span class="kind">Lid step panels</span><button class="btn small danger" id="pDel">Delete</button></div>
      <div class="grp"><div class="stats"><span>Length</span><span>${fmt(L)}</span><span>Panels</span><span>${Math.ceil(L / 4 - 1e-6)} × 4′ wide</span><span>Height</span><span>${q ? fmt(q.y0) + ' to ' + fmt(q.y1) + ' (' + fmt(q.y1 - q.y0) + ')' : '—'}</span></div></div>
      <div class="row"><button class="btn small" id="pStepTool">Draw more</button></div>
      <p class="note">Wall panels standing on the lower lid up to the higher one (H-mold at each 4′ joint). Where the lid is the same height both sides, they close the plenum from the ceiling up to the lid. Drag to move; its ends catch on wall ends and lid corners.</p>`;
    $('#pDel').onclick = () => ed.deleteSel(); $('#pStepTool').onclick = () => stepPanelTool();
    return;
  }
  if (s && o && s.kind === 'deck') {
    const Dk = (Plan3DViewer.deckShapes(P) || []).find(d => d.id === o.id);
    box.innerHTML = `<div class="hd"><span class="kind">Lid piece</span><button class="btn small danger" id="pDel">Delete</button></div>
      <div class="grp"><div class="stats"><span>Area</span><span>${Dk ? Math.round(Dk.area) + ' sq ft' : '—'}</span><span>From</span><span>${esc(P.deckSource || 'deck drawing')}</span></div></div>
      <div class="row"><button class="btn small" id="pDkL">⟲ Turn left</button><button class="btn small" id="pDkR">⟳ Turn right</button></div>
      <p class="note">Drag it by its outline or its LID label; its corners catch on wall ends (Alt moves it freely, arrow keys nudge 1″). It sits on top of the walls. In 3D, the Lid button shows it in every view.</p>`;
    $('#pDkL').onclick = () => ed.turnDeck(o, true); $('#pDkR').onclick = () => ed.turnDeck(o, false); $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'tile') {
    const whole = (Math.abs(o.w - 2) < 0.01 && Math.abs(o.h - 4) < 0.01) || (Math.abs(o.w - 4) < 0.01 && Math.abs(o.h - 2) < 0.01);
    h = `<div class="hd"><span class="kind">Ceiling tile${whole ? '' : ', cut'}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Across', txt('pTw', fmt(o.w)))}
      ${fld('Up and down', txt('pTh', fmt(o.h)))}
      <div class="row"><button class="btn small" id="pTTurn">Turn 90° (R)</button><button class="btn small" id="pTFit">Fit to the space</button><button class="btn small" id="pTDup">Copy next to it</button></div>
      <p class="note">One piece of a ceiling built piece by piece. Drag it: its edges catch on the tiles, FFUs, lights and walls next to it (Alt moves it freely; arrow keys nudge 1″). <b>Fit to the space</b> stretches it to fill the gap it's in, up to a full 2′ × 4′. The parts list counts it as a full tile or a cut one at this size.</p>`;
    box.innerHTML = h;
    const setSize = (k, v) => { if (!(v > 0.1)) return; ed.edit(() => { const x0 = o.x - o.w / 2, y0 = o.y - o.h / 2; o[k] = Math.min(8, v); o.x = x0 + o.w / 2; o.y = y0 + o.h / 2; }); };
    bindLen('pTw', 'ft', v => setSize('w', v)); bindLen('pTh', 'ft', v => setSize('h', v));
    $('#pTTurn').onclick = () => { ed.turnTile(o); renderProps(); };
    $('#pTFit').onclick = () => {
      // grow from its corner up to 2 × 4 (or 4 × 2, the way it lies), then trim to what's free around it
      const lw = o.w >= o.h ? 4 : 2, lh = o.w >= o.h ? 2 : 4, r = [o.x - o.w / 2 - (lw - o.w), o.y - o.h / 2 - (lh - o.h), o.x + o.w / 2 + (lw - o.w), o.y + o.h / 2 + (lh - o.h)];
      const f = ed.freePart(r, { x: o.x, y: o.y }, new Set([o.id])); if (!f) return;
      const nw = Math.min(lw, f[2] - f[0]), nh = Math.min(lh, f[3] - f[1]), cx = Math.max(f[0] + nw / 2, Math.min(f[2] - nw / 2, o.x)), cy = Math.max(f[1] + nh / 2, Math.min(f[3] - nh / 2, o.y));
      ed.edit(() => { o.w = nw; o.h = nh; o.x = cx; o.y = cy; }); renderProps();
    };
    $('#pTDup').onclick = () => { const n = { ...o, id: Plan3DEditor.uid(), x: o.x + o.w }; delete n.gid; const f = ed.freePart([n.x - n.w / 2, n.y - n.h / 2, n.x + n.w / 2, n.y + n.h / 2], { x: n.x, y: n.y }); if (!f) { toast('No room next to it.'); return; } n.x = (f[0] + f[2]) / 2; n.y = (f[1] + f[3]) / 2; n.w = f[2] - f[0]; n.h = f[3] - f[1]; ed.edit(Pl => Pl.ceilTiles.push(n)); ed.sel = { kind: 'tile', id: n.id }; ed.emit('select'); };
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'fixture') {
    h = `<div class="hd"><span class="kind">${o.type === 'ffu' ? 'Fan filter unit' : o.em ? 'Emergency light' : 'LED light'}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Type', `<select id="pFx"><option value="led" ${o.type !== 'ffu' && !o.em ? 'selected' : ''}>LED light, 2×4</option><option value="em" ${o.type !== 'ffu' && o.em ? 'selected' : ''}>Emergency light, 2×4 (battery backup)</option><option value="ffu" ${o.type === 'ffu' ? 'selected' : ''}>Fan filter unit, 2×4</option></select>`)}
      <div class="row"><button class="btn small" id="pFxTurn">Turn 90° (R)</button><button class="btn small" id="pFxSnap">Snap into the grid</button></div>
      ${o.type === 'ffu' ? `<label class="chk" title="It looks like every other filter. In the 3D view, walkthroughs and the phone viewer, clicking it plays a fart and puffs out a cloud of green gas."><input type="checkbox" id="pFxSur" ${o.surprise ? 'checked' : ''}> 💨 Surprise filter (hidden: click it in 3D)</label>` : ''}
      <p class="note">Sits in the 2′ × 4′ ceiling grid. Turned across the grid, it takes half of two cells side by side: the cross tee moves to its edge and the other half gets one 2′ × 4′ tile laid the same way.</p>`;
    box.innerHTML = h;
    $('#pFx').onchange = e => ed.edit(() => { const v = e.target.value; o.type = v === 'em' ? 'led' : v; if (v === 'em') o.em = true; else delete o.em; });
    if ($('#pFxSur')) $('#pFxSur').onchange = e => ed.edit(() => { if (e.target.checked) o.surprise = true; else delete o.surprise; });
    $('#pFxTurn').onclick = () => ed.turnFixture(o); $('#pFxSnap').onclick = () => snapFixturesIn(new Set([o.id]));
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'insert') { insertProps(box, o); return; }
  if (s && o && s.kind === 'beam') {
    const BM = Plan3DViewer.BEAMS, len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1), auto = Plan3DViewer.beamBottom(ed.plan, null, { ...o, bot: 0 });
    h = `<div class="hd"><span class="kind">Steel beam</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Size', `<select id="pBmS">${Object.keys(BM).map(k => `<option value="${k}" ${(o.size || 'W12x26') === k ? 'selected' : ''}>${k.replace('x', ' × ')} (${BM[k].d.toFixed(1)}″ deep)</option>`).join('')}</select>`)}
      ${fld('Length', txt('pBmL', fmt(len)))}
      ${fld('Bottom of beam at', txt('pBmB', o.bot ? fmt(o.bot) : '', 'Auto (' + fmt(auto) + ')'))}
      <div class="row"><button class="btn small" id="pBmDup">Add another 8′ over</button></div>
      <p class="note">Auto: over the cleanroom it spans from wall to wall in the plenum, its top level with the top of the walls (the plan shows where it lands); otherwise up under the roof. Beams go on the parts list (length and weight) and into the Revit export. Drag it to move it: an end catches on a stud of a cleanroom wall (the H-studs every 48″ and the posts, shown as small squares) when it comes near one. Drag either round end to move just that end. Hold Alt for anywhere. Shift-drag a box to move a set of them.</p>`;
    box.innerHTML = h;
    $('#pBmS').onchange = e => ed.edit(() => { o.size = e.target.value; ed.beamSize = o.size; });
    bindLen('pBmL', 'ft', v => ed.edit(() => { const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1, ux = (o.x2 - o.x1) / L, uy = (o.y2 - o.y1) / L; o.x2 = o.x1 + ux * Math.max(0.5, v); o.y2 = o.y1 + uy * Math.max(0.5, v); }));
    const bb = $('#pBmB'); bb.onchange = () => { const raw = bb.value.trim(); if (!raw) { ed.edit(() => { delete o.bot; }); renderProps(); return; } const v = parseLen(raw, 'ft'); if (isFinite(v) && v > 0) ed.edit(() => { o.bot = Math.min(80, v); }); };
    $('#pBmDup').onclick = () => { const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1, nx = -(o.y2 - o.y1) / L * 8, ny = (o.x2 - o.x1) / L * 8, n = { ...o, id: Plan3DEditor.uid(), x1: o.x1 + nx, y1: o.y1 + ny, x2: o.x2 + nx, y2: o.y2 + ny }; delete n.gid; ed.edit(Pl => Pl.beams.push(n)); ed.sel = { kind: 'beam', id: n.id }; ed.emit('select'); };
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'column') {
    h = `<div class="hd"><span class="kind">Column</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Type', `<select id="pColK"><option value="steel" ${o.kind !== 'concrete' ? 'selected' : ''}>Steel, wide flange</option><option value="concrete" ${o.kind === 'concrete' ? 'selected' : ''}>Concrete</option></select>`)}
      ${fld('Size', txt('pColS', fmtIn(o.size || 0.67)))}
      ${fld('Height', txt('pColH', o.h ? fmt(o.h) : '', 'Up to the roof (' + fmt(Plan3DViewer.analyze(ed.plan).shellTop || ed.plan.shellH || 20) + ')'))}
      <div class="row"><button class="btn small" id="pColDup">Add another 25′ over</button></div>
      <p class="note">Columns go on the parts list and into the Revit export. Drag to move.</p>`;
    box.innerHTML = h;
    $('#pColK').onchange = e => ed.edit(() => { o.kind = e.target.value; ed.columnKind = o.kind; });
    bindLen('pColS', 'in', v => ed.edit(() => { o.size = Math.max(0.25, Math.min(4, v)); ed.columnSize = o.size; }));
    const ch = $('#pColH'); ch.onchange = () => { const raw = ch.value.trim(); if (!raw) { ed.edit(() => { delete o.h; }); return; } const v = parseLen(raw, 'ft'); if (isFinite(v) && v > 0) ed.edit(() => { o.h = Math.max(6, Math.min(80, v)); }); };
    $('#pColDup').onclick = () => { const n = { ...o, id: Plan3DEditor.uid(), x: o.x + 25 }; ed.edit(Pl => Pl.columns.push(n)); ed.sel = { kind: 'column', id: n.id }; ed.emit('select'); };
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'device') {
    const DV = Plan3DViewer.DEVICES, D = DV[o.type] || { label: o.type, h: 1.5 };
    h = `<div class="hd"><span class="kind">${esc(D.label)}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Type', `<select id="pDvT">${Object.entries(DV).map(([k, v]) => `<option value="${k}" ${o.crType === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>`)}
      ${fld('Height to center', txt('pDvH', fmtIn(o.h != null ? o.h : D.h)))}
      <div class="row"><button class="btn small" id="pDvDup">Add another 6′ along</button></div>
      <p class="note">Drag it along a wall; it stays on the wall face. It goes on the parts list under Electrical and into the Revit export.</p>`;
    box.innerHTML = h;
    $('#pDvT').onchange = e => ed.edit(() => { o.type = e.target.value; o.h = (DV[o.type] || D).h; });
    bindLen('pDvH', 'in', v => ed.edit(() => { o.h = Math.max(0.25, Math.min(12, v)); }));
    $('#pDvDup').onclick = () => { const c = Math.cos((o.a || 0) + Math.PI / 2), sn = Math.sin((o.a || 0) + Math.PI / 2); const q = ed.devicePlace(o.x + c * 6 - Math.cos(o.a || 0) * 0.3, o.y + sn * 6 - Math.sin(o.a || 0) * 0.3, o.type, o); if (!q) { msg('No wall 6′ along to put it on.'); return; } const n = { ...o, id: Plan3DEditor.uid(), x: q.x, y: q.y, a: q.a }; ed.edit(Pl => Pl.devices.push(n)); ed.sel = { kind: 'device', id: n.id }; ed.emit('select'); };
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'item' && o.type === 'machine') {
    box.innerHTML = `<div class="hd"><span class="kind">Machine</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Name', txt('pMName', o.name || 'Machine'))}
      <div class="grp"><div class="stats"><span>Size</span><span>${fmt(o.w)} × ${fmt(o.d)}</span><span>Turned</span><span>${Math.round(((((o.a || 0) * 180 / Math.PI) % 360) + 360) % 360)}°</span><span>From</span><span>${esc(o.source || 'a drawing')}</span></div></div>
      ${fld('Height', txt('pMH', fmt(o.h || 8)))}
      ${fld('Left side at', txt('pMX', fmt(Plan3DViewer.itemCorners(o).reduce((t, q) => Math.min(t, q[0]), 1e9))))}
      ${fld('Top side at', txt('pMY', fmt(Plan3DViewer.itemCorners(o).reduce((t, q) => Math.min(t, q[1]), 1e9))))}
      <div class="row"><button class="btn small" id="pIL">⟲ Turn left</button><button class="btn small" id="pIR">⟳ Turn right</button><button class="btn small" id="pMDup">Place another</button></div>
      <p class="note">Drag it on the plan to move it; its edges catch on wall faces (Alt moves it freely, arrow keys nudge). R turns it. It's in the Library under Machines for other projects, and on the parts list under Equipment.</p>`;
    const nm = $('#pMName'); nm.onchange = () => ed.edit(() => { o.name = nm.value.trim() || 'Machine'; });
    bindLen('pMH', 'ft', v => ed.edit(() => { o.h = Math.max(1, Math.min(40, v)); }));
    bindLen('pMX', 'ft', v => ed.edit(() => { o.x += v - Plan3DViewer.itemCorners(o).reduce((t, q) => Math.min(t, q[0]), 1e9); }));
    bindLen('pMY', 'ft', v => ed.edit(() => { o.y += v - Plan3DViewer.itemCorners(o).reduce((t, q) => Math.min(t, q[1]), 1e9); }));
    $('#pIL').onclick = () => ed.edit(() => { o.a = (o.a || 0) - Math.PI / 2; });
    $('#pIR').onclick = () => ed.edit(() => { o.a = (o.a || 0) + Math.PI / 2; });
    $('#pMDup').onclick = () => { const n = { ...o, id: Plan3DEditor.uid(), x: o.x + Math.max(o.w, o.d) + 2 }; ed.edit(Pl => Pl.items.push(n)); ed.sel = { kind: 'item', id: n.id }; ed.emit('select'); };
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'item') {
    const D = Plan3DViewer.ITEMS[o.type] || { label: o.type };
    const TABLE_SIZES = [[2, 4], [2.5, 4], [2.5, 5], [2.5, 6], [2.5, 8], [3, 6], [3, 8]];
    h = `<div class="hd"><span class="kind">${esc(D.label)}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${D.wv || D.sz ? fld('Width', txt('pIW', fmtIn(o.w || D.w))) : fld('Size', `<span>${fmtIn(o.w || D.w)} × ${fmtIn(o.d || D.d)}</span>`)}
      ${o.type === 'island' || o.type === 'shower' || D.sz ? fld('Depth', txt('pID', fmtIn(o.d || D.d))) : ''}
      ${D.sz && o.type !== 'tackymat' ? fld(o.type === 'sstable' ? 'Top height' : 'Height', txt('pIH', fmtIn(o.h > 0 ? o.h : D.h))) : ''}
      ${o.type === 'sstable' ? `<div class="row" style="flex-wrap:wrap;gap:4px"><span class="note" style="margin:0 6px 0 0">Common sizes</span>${TABLE_SIZES.map(([dd, ww]) => `<button class="btn small" data-tsz="${ww},${dd}">${Math.round(dd * 12)}″ × ${Math.round(ww * 12)}″</button>`).join('')}</div>
      <div class="row" style="flex-wrap:wrap;gap:12px"><label class="chk"><input type="checkbox" id="pTShelf" ${o.shelf !== false ? 'checked' : ''}> Undershelf</label><label class="chk"><input type="checkbox" id="pTSplash" ${o.splash ? 'checked' : ''}> Backsplash</label><label class="chk"><input type="checkbox" id="pTCas" ${o.casters ? 'checked' : ''}> Casters</label></div>` : ''}
      <div class="row"><button class="btn small" id="pIL">⟲ Turn</button><button class="btn small" id="pIR">⟳ Turn</button><button class="btn small" id="pIDup">Add another beside it</button></div>
      <p class="note">${D.free ? 'Drag it anywhere. R turns it.' : 'Drag it along a wall; it stays backed against the wall. R turns it.'} It goes on the parts list${o.type === 'base' || o.type === 'sinkbase' || o.type === 'island' ? ' with its countertop' : ''}.</p>`;
    box.innerHTML = h;
    bindLen('pIW', 'in', v => ed.edit(() => { o.w = Math.max(0.75, Math.min(16, v)); }));
    bindLen('pID', 'in', v => ed.edit(() => { o.d = Math.max(D.sz ? 0.5 : 1, Math.min(10, v)); }));
    bindLen('pIH', 'in', v => ed.edit(() => { o.h = Math.max(0.5, Math.min(10, v)); }));
    $$('[data-tsz]').forEach(b => b.onclick = () => { const [ww, dd] = b.dataset.tsz.split(',').map(Number); ed.edit(() => { o.w = ww; o.d = dd; }); renderProps(); });
    if ($('#pTShelf')) { $('#pTShelf').onchange = e => ed.edit(() => { if (e.target.checked) delete o.shelf; else o.shelf = false; }); $('#pTSplash').onchange = e => ed.edit(() => { if (e.target.checked) o.splash = true; else delete o.splash; }); $('#pTCas').onchange = e => ed.edit(() => { if (e.target.checked) o.casters = true; else delete o.casters; }); }
    $('#pIL').onclick = () => ed.edit(() => { o.a = (o.a || 0) - Math.PI / 2; });
    $('#pIR').onclick = () => ed.edit(() => { o.a = (o.a || 0) + Math.PI / 2; });
    $('#pIDup').onclick = () => { const w = o.w || D.w, c = Math.cos(o.a || 0), sn = Math.sin(o.a || 0), n = { ...o, id: Plan3DEditor.uid(), x: o.x + c * w, y: o.y + sn * w }; ed.edit(Pl => Pl.items.push(n)); ed.sel = { kind: 'item', id: n.id }; ed.emit('select'); };
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'room') {
    h = `<div class="hd"><span class="kind">Room label</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Name', txt('pName', o.name))}
      ${fld('Size note', txt('pDims', o.dims || ''))}
      ${P.mode === 'house' ? fld('Floor', `<select id="pRFloor"><option value="">Same as the house (${esc(Plan3DViewer.FLOORS[P.floorType || 'lvp'])})</option>${Object.entries(Plan3DViewer.FLOORS).map(([k, l]) => `<option value="${k}" ${o.floor === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`) : ''}
      ${P.mode === 'house' ? '' : fld('Ceiling', txt('pRCeil', o.ceiling > 0 ? fmt(o.ceiling) : '', 'Same as the building (' + fmt(P.ceiling || 8) + ')')) + fld('Plenum above', txt('pRPlen', o.plenum != null && o.plenum !== '' ? fmt(+o.plenum) : '', 'Same as the building (' + fmt(+P.plenum || 0) + ')'))}
      ${P.mode === 'house' ? '' : fld('Generated ceiling', `<select id="pRGen"><option value="" ${!o.ceil ? 'selected' : ''}>Auto: a ceiling when hardwall walls it in</option><option value="always" ${o.ceil === 'always' ? 'selected' : ''}>Always give it a ceiling</option><option value="lights" ${o.ceil === 'lights' ? 'selected' : ''}>Ceiling and lights, no FFUs</option><option value="none" ${o.ceil === 'none' ? 'selected' : ''}>No ceiling</option></select>`)}
      ${P.mode === 'house' ? '' : `<p class="note" style="margin-top:-4px">Give a room its own ceiling height and plenum. Its walls run up to its top (${esc(fmt(Plan3DViewer.roomKey(P, o).H + Plan3DViewer.roomKey(P, o).PL))}); where it meets a lower room through an opening, transition panels fill the step. Leave blank to use the building's.</p>`}
      ${P.mode === 'house' ? '' : roomCheckHtml(P, o)}
      <p class="note">Rooms show as jump buttons in the walkthrough. The size note is optional, e.g. 15′-5½″ × 29′-4⅞″.</p>`;
    box.innerHTML = h;
    const nm = $('#pName'); nm.onchange = () => ed.edit(() => { o.name = nm.value.trim() || 'Room'; });
    $('#pDims').onchange = e => ed.edit(() => { o.dims = e.target.value.trim(); });
    if ($('#pRFloor')) $('#pRFloor').onchange = e => ed.edit(() => { if (e.target.value) o.floor = e.target.value; else delete o.floor; });
    const roomLen = (id, key, lo, hi) => { const el = $('#' + id); if (!el) return; const go = () => { const raw = el.value.trim(); if (!raw) { ed.edit(() => { delete o[key]; }); renderProps(); return; } const v = parseLen(raw, 'ft'); if (isFinite(v) && v >= 0) { ed.edit(() => { o[key] = Math.max(lo, Math.min(hi, v)); }); renderProps(); } else { el.style.borderColor = 'var(--warn)'; setTimeout(() => el.style.borderColor = '', 900); } }; el.addEventListener('change', go); el.addEventListener('keydown', e => { if (e.key === 'Enter') { go(); el.blur(); } }); };
    roomLen('pRCeil', 'ceiling', 6, 30); roomLen('pRPlen', 'plenum', 0, 20);
    if ($('#pRGen')) $('#pRGen').onchange = e => ed.edit(() => { if (e.target.value) o.ceil = e.target.value; else delete o.ceil; });
    if ($('#pRType')) $('#pRType').onchange = e => { ed.edit(() => { if (e.target.value) { o.crType = e.target.value; const T = Plan3DViewer.ROOM_TYPES[o.crType]; if (T.iso && !o.iso) o.iso = T.iso; } else delete o.crType; }); renderProps(); };
    if ($('#pRIso')) $('#pRIso').onchange = e => { ed.edit(() => { if (e.target.value) o.iso = +e.target.value; else delete o.iso; }); renderProps(); };
    const numIn = (id, key, lo, hi) => { const el = $('#' + id); if (!el) return; el.onchange = () => { const raw = el.value.trim(); if (!raw) { ed.edit(() => { delete o[key]; }); renderProps(); return; } const v = parseFloat(raw.replace(/[^\d.+-]/g, '')); if (isFinite(v)) { ed.edit(() => { o[key] = Math.max(lo, Math.min(hi, v)); }); renderProps(); } }; };
    numIn('pRAch', 'ach', 0, 1000); numIn('pRPpl', 'people', 0, 500); numIn('pREqW', 'equipW', 0, 1000000);
    // pressure in Pa, or in inches of water as a gauge reads it (0.05″, .05 in, 0.05 wc)
    { const el = $('#pRPa'); if (el) el.onchange = () => { const raw = el.value.trim(); if (!raw) { ed.edit(() => { delete o.pressure; }); renderProps(); return; } let v = parseFloat(raw.replace(/[^\d.+-]/g, '')); if (!isFinite(v)) return; if (/(″|"|in\b|inch|w\.?c)/i.test(raw)) v = Math.round(v / Plan3DViewer.PA_TO_INWC * 10) / 10; ed.edit(() => { o.pressure = Math.max(-200, Math.min(200, v)); }); renderProps(); }; }
    $('#pDel').onclick = () => ed.deleteSel();
    if (opt && opt.focusName) { nm.focus(); nm.select(); }
    return;
  }
  // No selection: plan settings
  const B = P.background;
  const partsHtml = partsGroup();
  const ext = ed.extents(), hasGeo = P.walls.length > 0, house = P.mode === 'house', R = P.roof || {};
  const kindList = Object.entries(Plan3DViewer.WALL_KINDS).sort((a, b) => house ? (!!b[1].frame - !!a[1].frame) : 0);
  const shellNew = P.newKind && P.newKind !== 'hardwall' && !(Plan3DViewer.WALL_KINDS[P.newKind] || {}).frame;
  h = `<div class="hd"><span class="kind">${house ? 'Project' : 'Plan'}</span></div>
    ${fld('Name', txt('pPName', P.name))}
    ${fld(house ? 'Wall height' : 'Ceiling', txt('pCeil', fmt(P.ceiling)))}
    ${house ? '' : fld('Plenum above', txt('pPlen', fmt(P.plenum || 0))) + `<p class="note" style="margin-top:-4px">Plenum: the space between the grid ceiling and the top of the cleanroom. Walls are ${esc(fmt((P.ceiling || 8) + (P.plenum || 0)))} tall.</p>${ownHeightWalls(P).length ? `<p class="note" style="color:var(--warn)">${ownHeightWalls(P).length} walls have their own height set, so they don't follow this. <button class="btn small" id="pWallsFollow">Make them follow</button></p>` : ''}`}
    ${house ? '' : fld('Panel color', panelColorSelect('pPCall', Plan3DViewer.panelColorOf(P), null))}
    ${house ? '' : fld('Ceiling tiles', `<select id="pTile">${Object.entries(Plan3DViewer.TILE_TYPES).map(([k, v]) => `<option value="${k}" ${Plan3DViewer.tileTypeOf(P) === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>`)}
    ${!house && Plan3DViewer.tileTypeOf(P) === 'alum' ? fld('Tile color', (() => { const c = Plan3DViewer.tileColorOf(P), PC = Plan3DViewer.PANEL_COLORS; return `<div style="display:flex;gap:6px;align-items:center"><span style="width:18px;height:18px;border-radius:4px;border:1px solid var(--line);flex:0 0 auto;background:${c === 'natural' ? 'linear-gradient(135deg,#e6e9eb,#a9afb3)' : PC[c][1]}"></span><select id="pTileC" style="flex:1"><option value="natural" ${c === 'natural' ? 'selected' : ''}>Natural aluminum</option>${Object.entries(PC).map(([k, v]) => `<option value="${k}" ${c === k ? 'selected' : ''}>Painted ${esc(v[0].toLowerCase())}</option>`).join('')}</select></div>`; })()) : ''}
    ${house ? '' : fld('Ceiling grid', (() => { const g = Plan3DViewer.gridColorOf(P), GC = Plan3DViewer.GRID_COLORS; return `<div style="display:flex;gap:6px;align-items:center"><span style="width:18px;height:18px;border-radius:4px;border:1px solid var(--line);flex:0 0 auto;background:#${GC[g][1].toString(16).padStart(6, '0')}"></span><select id="pGrid" style="flex:1">${Object.entries(GC).map(([k, v]) => `<option value="${k}" ${g === k ? 'selected' : ''}>${esc(v[0])} 15/16″ tee</option>`).join('')}</select></div>`; })())}
    ${fld('New wall type', `<select id="pNK">${kindList.map(([k, v]) => `<option value="${k}" ${(P.newKind || (house ? 'wood' : 'hardwall')) === k ? 'selected' : ''}>${esc(v.short)}</option>`).join('')}</select>`)}
    ${fld('New walls', txt('pWT', fmtIn(P.wallT || 0.25)))}
    ${(P.walls.some(w => !Plan3DViewer.isHard(w) && !Plan3DViewer.isFrame(w)) || shellNew) ? fld('Building wall height', txt('pSH', fmt(P.shellH || 20))) : ''}
    ${house ? `<div class="grp"><h3>Roof and floors</h3>
      ${fld('Roof', `<select id="pRoof">${[['gable', 'Gable'], ['hip', 'Hip'], ['flat', 'Flat (low slope)'], ['none', 'No roof']].map(([k, l]) => `<option value="${k}" ${(R.type || 'none') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${R.type && R.type !== 'none' && R.type !== 'flat' ? fld('Pitch (rise in 12)', txt('pPitch', String(R.pitch == null ? 6 : R.pitch))) : ''}
      ${R.type && R.type !== 'none' ? fld('Overhang', txt('pOver', fmt(R.overhang == null ? 1 : R.overhang))) : ''}
      ${fld('Floors', `<select id="pFloor">${Object.entries(Plan3DViewer.FLOORS).map(([k, l]) => `<option value="${k}" ${(P.floorType || 'lvp') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      <p class="note">Pick a room label to give that room its own floor. Pick a wall for its framing (wood or steel), stud size and exterior / interior.</p></div>
    <div class="grp"><h3>Floors (stories)</h3>
      ${(() => { const L = P.levels && P.levels.length ? P.levels : [{ name: 'First floor' }], cur = P.level || 0;
        return `<div class="row" style="flex-wrap:wrap;gap:6px">${L.map((l, k) => `<button class="btn small${k === cur ? ' primary' : ''}" data-lvl="${k}">${esc(l.name || 'Floor ' + (k + 1))}</button>`).join('')}</div>
        <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px"><button class="btn small" id="lvAdd">+ Floor above</button><button class="btn small" id="lvBase" ${L[0] && L[0].below ? 'disabled' : ''}>+ Basement</button>${L.length > 1 ? '<button class="btn small" id="lvRen">Rename</button><button class="btn small danger" id="lvDel">Delete this floor</button>' : ''}</div>
        ${L.length > 1 ? fld('Floor system', txt('lvDepth', fmtIn(Plan3DViewer.floorDepthOf(P)))) : ''}
        <p class="note">You're drawing on <b>${esc((L[cur] && L[cur].name) || 'First floor')}</b>. The floor below shows dashed blue so walls and stairs line up. Stairs (Items → Stairs) rise to the floor above and cut its stairwell. In 3D, Dollhouse shows up to this floor.</p>`; })()}</div>
    <div class="grp"><h3>Foundation</h3>
      ${(() => { const F = Plan3DViewer.foundationOf(P), FT = Plan3DViewer.foundationTakeoff(P), tp = F.type;
        const inch = (id, v) => txt(id, fmtIn(v));
        return fld('Type', `<select id="fType">${Object.entries(Plan3DViewer.FOUNDATIONS).map(([k, v]) => `<option value="${k}" ${tp === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>`)
          + (tp === 'none' ? '' : fld('Footing / edge W × D', `<span class="row" style="gap:4px">${inch('fFW', F.footW)}×${inch('fFD', F.footD)}</span>`)
          + (tp !== 'crawl' ? fld('Slab', inch('fSlab', F.slabT)) : '')
          + (tp === 'stem' ? fld('Stem wall height', inch('fStemH', F.stemH)) : tp === 'crawl' ? fld('Crawlspace wall height', inch('fCrawlH', F.crawlH)) : tp === 'basement' ? fld('Basement wall height', txt('fBaseH', fmt(F.baseH))) : '')
          + (tp !== 'slab' ? fld('Wall thickness', inch('fStemT', F.stemT)) : '')
          + (tp !== 'crawl' ? fld('Slab steel', `<select id="fMesh"><option value="wwm" ${F.mesh !== 'rebar' ? 'selected' : ''}>Welded wire mesh</option><option value="rebar" ${F.mesh === 'rebar' ? 'selected' : ''}>#4 rebar at 18″</option></select>`) : '')
          + `<div class="stats"><span>Perimeter</span><span>${Math.round(FT.perim)} lin ft</span><span>Footprint</span><span>${Math.round(FT.area)} sq ft</span><span>Concrete</span><span>${(Math.ceil(FT.lines.filter(l => l[4] === 'cu yd' && /^Concrete,/.test(l[1])).reduce((t, l) => t + l[3], 0) * 4) / 4).toFixed(2)} cu yd</span></div>`)
          + '<p class="note">Under the outside walls; the footing shows dashed on the plan, the exposed concrete at the foot of the walls in 3D. Concrete, rebar, gravel, vapor barrier and anchor bolts are on the parts list.</p>'; })()}</div>
    <div class="grp"><h3>Finishes</h3>
      ${(() => { const FN = Plan3DViewer.FINISH, F = Plan3DViewer.finishOf(P), sel = (id, key, list) => `<select id="${id}">${Object.entries(list).map(([k, v]) => `<option value="${k}" ${F[key] === k ? 'selected' : ''}>${esc(Array.isArray(v) ? v[0] : v)}</option>`).join('')}</select>`;
        return fld('Siding', sel('fSid', 'siding', FN.siding)) + fld('Siding color', sel('fSidC', 'sidingColor', FN.sidingColor)) + fld('Roofing', sel('fRoof', 'roof', FN.roof)) + fld('Roof color', sel('fRoofC', 'roofColor', FN.roofColor))
          + fld('Wall paint', sel('fPaint', 'paint', FN.paint)) + fld('Cabinets', sel('fCab', 'cabinet', FN.cabinet)) + fld('Countertops', sel('fCtr', 'counter', FN.counter)); })()}
      <p class="note">Shown in 3D and named on the parts list (siding or brick, roofing, paint in gallons, cabinets and countertops).</p></div>` : ''}
    ${fld('Snap to', `<select id="pSnap">${[[0, 'Off'], [0.125, '⅛″'], [0.25, '¼″'], [1, '1″'], [6, '6″'], [12, '1′']].map(([v, l]) => `<option value="${v}" ${ed.snapIn === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
    <div class="grp"><h3>Contents</h3><div class="stats">
      <span>Overall</span><span>${hasGeo ? fmt(ext.x1 - ext.x0) + ' × ' + fmt(ext.y1 - ext.y0) : '—'}</span>
      <span>Walls</span><span>${P.walls.length}</span>
      <span>${house ? 'Doors &amp; windows' : 'Doors &amp; glass'}</span><span>${P.openings.length}</span>
      ${house ? `<span>Items</span><span>${(P.items || []).length}</span>` : `<span>Air chases</span><span>${P.chases.length}</span>`}
      <span>Rooms</span><span>${P.rooms.length}</span>
      ${(P.devices || []).length ? `<span>Electrical devices</span><span>${P.devices.length}</span>` : ''}
      ${(P.inserts || []).length ? `<span>Placed buildings</span><span>${P.inserts.length}</span>` : ''}
      ${hasGeo || (P.inserts || []).length ? (() => { const ft = Plan3DParts.projectParts(P).reduce((t, q) => t + q.floorFt, 0); return ft > 0 ? `<span>Floor track</span><span>${Math.ceil(ft)} lin ft <small>(${Plan3DParts.ftin(ft)})</small></span>` : ''; })() : ''}</div>
      ${hasGeo ? '<div class="row"><button class="btn small" id="pClearAuto">Clear all walls</button></div>' : ''}
    </div>
    ${house ? '' : ffuPanelHtml(P) + lightPanelHtml(P)}
    ${house ? '' : checkGroupHtml(P) + flowGroupHtml(P) + loadsGroupHtml(P)}
    ${snapsGroupHtml(P)}
    ${commentsGroupHtml(P)}
    ${fld('Project type', `<select id="pMode"><option value="cleanroom" ${house ? '' : 'selected'}>Cleanroom</option><option value="house" ${house ? 'selected' : ''}>Project (house, building, drafting)</option></select>`)}`;
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
  // the project's ceiling height or plenum: for the whole project, every placed building and every room
  // label that had its own value too (so "a 3′ plenum" means all the walls)
  const allLevels = (key, v, lo, hi, what) => {
    const val = Math.max(lo, Math.min(hi, v)); let nb = 0, nr = 0;
    ed.edit(Pl => {
      const old = key === 'plenum' ? +Pl.plenum || 0 : Pl.ceiling || 8; Pl[key] = val;
      for (const r of Pl.rooms || []) if (key === 'plenum' ? r.plenum != null && r.plenum !== '' && +r.plenum !== val : r.ceiling > 0 && r.ceiling !== val) { if (key === 'plenum') r.plenum = val; else r.ceiling = val; nr++; }
      for (const ins of Pl.inserts || []) if (ins.plan) { const cur = key === 'plenum' ? +ins.plan.plenum || 0 : ins.plan.ceiling || 8; if (cur !== val) { ins.plan[key] = val; nb++; } for (const r of ins.plan.rooms || []) if (key === 'plenum' ? r.plenum != null && r.plenum !== '' : r.ceiling > 0) { if (key === 'plenum') r.plenum = val; else r.ceiling = val; nr++; } }
      void old;
    });
    // walls given their own height (Wall height…) don't follow the plenum: offer to put them back
    const own = ownHeightWalls(ed.plan);
    if (own.length) { dialogOpen({ title: 'Walls with their own height', body: `<p>${own.length} wall${own.length === 1 ? ' has' : 's have'} a height set on ${own.length === 1 ? 'it' : 'them'} (${[...new Set(own.map(w => fmt(w.sections[0].h)))].join(', ')}), so ${own.length === 1 ? 'it doesn\'t' : 'they don\'t'} follow the ${what.toLowerCase()}. Put ${own.length === 1 ? 'it' : 'them'} back to the ceiling plus plenum (${fmt(wallTopOf(ed.plan, own[0]))})?</p>`, buttons: [{ label: 'Keep their heights', ret: null }, { label: 'Follow the ' + what.toLowerCase(), primary: true, ret: true }] }).then(a => { if (a) { ed.edit(() => { for (const w of own) delete w.sections; }); toast(`${own.length} wall${own.length === 1 ? '' : 's'} now follow the ceiling and plenum.`); renderProps(); queue3D(); } }); }
    else if (nb || nr) toast(`${what} set to ${fmt(val)} for the whole project${nb ? `, including ${nb} placed building${nb === 1 ? '' : 's'}` : ''}${nr ? `${nb ? ' and' : ', including'} ${nr} room${nr === 1 ? '' : 's'} that had ${nr === 1 ? 'its' : 'their'} own` : ''}. Set one room's or building's own on its label or panel.`);
    renderProps(); queue3D();
  };
  bindLen('pCeil', 'ft', v => allLevels('ceiling', v, 6, 30, 'Ceiling'));
  bindLen('pPlen', 'ft', v => allLevels('plenum', v, 0, 20, 'Plenum'));
  if ($('#pWallsFollow')) $('#pWallsFollow').onclick = () => { const own = ownHeightWalls(ed.plan); ed.edit(() => { for (const w of own) delete w.sections; }); toast(`${own.length} walls now follow the ceiling and plenum.`); renderProps(); queue3D(); };
  if ($('#pRoof')) $('#pRoof').onchange = e => ed.edit(Pl => { Pl.roof = Object.assign({ pitch: 6, overhang: 1 }, Pl.roof || {}, { type: e.target.value }); });
  const fset = (k, v) => ed.edit(Pl => { Pl.foundation = Object.assign({}, Pl.foundation || {}, { [k]: v }); });
  $$('[data-lvl]').forEach(b => b.onclick = () => switchLevel(+b.dataset.lvl));
  if ($('#lvAdd')) $('#lvAdd').onclick = () => addLevel(false);
  if ($('#lvBase')) $('#lvBase').onclick = () => addLevel(true);
  if ($('#lvRen')) $('#lvRen').onclick = async () => { const L = ed.plan.levels, k = ed.plan.level || 0; const v = await dialogOpen({ title: 'Rename floor', body: fld('Name', txt('lvName', L[k].name || '')), buttons: [{ label: 'Cancel', ret: null }, { label: 'Rename', primary: true, value: () => $('#lvName').value.trim() }] }); if (v) ed.edit(Pl => { Pl.levels[k].name = v; }); };
  if ($('#lvDel')) $('#lvDel').onclick = async () => { if (await confirmDlg('Delete this floor?', 'Its walls, doors, windows, rooms and items go too. Ctrl+Z brings it back.', 'Delete')) deleteLevel(); };
  bindLen('lvDepth', 'in', v => ed.edit(Pl => { Pl.floorDepth = Math.max(0.5, Math.min(3, v)); }));
  if ($('#fType')) $('#fType').onchange = e => fset('type', e.target.value);
  if ($('#fMesh')) $('#fMesh').onchange = e => fset('mesh', e.target.value);
  for (const [id, k, u, lo, hi] of [['fFW', 'footW', 'in', 0.5, 4], ['fFD', 'footD', 'in', 0.33, 4], ['fSlab', 'slabT', 'in', 0.25, 1.5], ['fStemH', 'stemH', 'in', 0.5, 8], ['fCrawlH', 'crawlH', 'in', 1, 8], ['fBaseH', 'baseH', 'ft', 6, 14], ['fStemT', 'stemT', 'in', 0.5, 1.5]]) bindLen(id, u, v => fset(k, Math.max(lo, Math.min(hi, v))));
  if ($('#pPitch')) $('#pPitch').onchange = e => { const v = parseFloat(e.target.value); if (v >= 0 && v <= 24) ed.edit(Pl => { Pl.roof.pitch = v; }); };
  bindLen('pOver', 'ft', v => ed.edit(Pl => { Pl.roof.overhang = Math.max(0, Math.min(4, v)); }));
  if ($('#pFloor')) $('#pFloor').onchange = e => ed.edit(Pl => { Pl.floorType = e.target.value; });
  for (const [id, key] of [['fSid', 'siding'], ['fSidC', 'sidingColor'], ['fRoof', 'roof'], ['fRoofC', 'roofColor'], ['fPaint', 'paint'], ['fCab', 'cabinet'], ['fCtr', 'counter']]) if ($('#' + id)) $('#' + id).onchange = e => ed.edit(Pl => { Pl.finish = Object.assign({}, Pl.finish || {}, { [key]: e.target.value }); });
  $('#pMode').onchange = e => { const m = e.target.value; ed.edit(Pl => { if (m === 'house') houseDefaults(Pl, true); else Pl.mode = 'cleanroom'; }); updateChrome(); renderProps(); };
  bindLen('pWT', 'in', v => { ed.plan.wallT = Math.max(1 / 48, v); renderProps(); });
  if ($('#pGrid')) $('#pGrid').onchange = e => { const v = e.target.value; ed.edit(Q => { if (v === 'white') delete Q.gridColor; else Q.gridColor = v; }); toast('Ceiling grid: ' + Plan3DViewer.GRID_COLORS[v][0].toLowerCase() + '.'); renderProps(); queue3D(); };
  if ($('#pTileC')) $('#pTileC').onchange = e => { const v = e.target.value; ed.edit(Q => { if (v === 'natural') delete Q.tileColor; else Q.tileColor = v; }); toast('Ceiling tiles: ' + Plan3DViewer.tileName(ed.plan) + '.'); renderProps(); queue3D(); };
  if ($('#pTile')) $('#pTile').onchange = e => { const v = e.target.value; ed.edit(Q => { if (v === 'vcg') delete Q.tileType; else Q.tileType = v; }); toast('Ceiling tiles: ' + Plan3DViewer.TILE_TYPES[v].label.toLowerCase() + '. The parts list, quote and exports follow.'); renderProps(); queue3D(); };
  if ($('#pPCall')) $('#pPCall').onchange = e => { const v = e.target.value, own = (P.walls || []).filter(w => w.color && w.color !== v).length; ed.edit(Q => { if (v === 'white') delete Q.panelColor; else Q.panelColor = v; }); toast(`Panels are ${Plan3DViewer.PANEL_COLORS[v][0].toLowerCase()}${own ? ` (${own} wall${own === 1 ? ' keeps its' : 's keep their'} own color)` : ''}.`); renderProps(); queue3D(); };
  $('#pNK').onchange = e => { const k = e.target.value, K = Plan3DViewer.WALL_KINDS[k]; ed.plan.newKind = k === 'hardwall' && !house ? undefined : k; ed.plan.wallT = k === 'hardwall' ? 0.25 : K.t; ed.dirty = true; renderProps(); msg(k === 'hardwall' ? 'New walls: hardwall cleanroom panels.' : 'New walls: ' + K.label + ', ' + fmtIn(K.t) + ' thick. Draw them with the Wall tool (W).'); };
  bindLen('pSH', 'ft', v => ed.edit(Pl => { Pl.shellH = Math.max(6, Math.min(80, v)); }));
  $('#pSnap').onchange = e => { ed.snapIn = +e.target.value; };
  bindParts();
  bindComments(P); bindSnaps(P);
  if (!house) { bindFfuPanel(P); bindLightPanel(P); bindLoads(P); bindFlows(P); }
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

/* ---------- Cleanroom check (ISO class, air changes, filter coverage, pressure) ---------- */
// Pa → inches of water column, the way a pressure gauge reads (+0.050″ w.c.)
const inWC = (pa) => (pa > 0 ? '+' : pa < 0 ? '−' : '') + (Math.abs(pa) * Plan3DViewer.PA_TO_INWC).toFixed(3) + '″ w.c.';
function roomCheckHtml(P, o) {
  const C = (() => { try { return Plan3DViewer.cleanroomCheck(P); } catch (e) { return null; } })(), q = C && C.rooms.find(x => x.room === o);
  let h = `<div class="grp"><h3>Cleanroom class and pressure</h3>
    ${fld('Room type', `<select id="pRType"><option value="">General cleanroom</option>${Object.entries(Plan3DViewer.ROOM_TYPES).map(([k, t]) => `<option value="${k}" ${o.type === k ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>`)}
    ${fld('ISO class', `<select id="pRIso"><option value="">Not set</option>${[5, 6, 7, 8, 9].map(k => `<option value="${k}" ${+o.iso === k ? 'selected' : ''}>ISO ${k}${k === 5 ? ' (Class 100)' : k === 6 ? ' (Class 1,000)' : k === 7 ? ' (Class 10,000)' : k === 8 ? ' (Class 100,000)' : ''}</option>`).join('')}</select>`)}
    ${fld('Pressure', txt('pRPa', o.pressure != null && o.pressure !== '' ? String(o.pressure) : '', 'Pa, or inches: 12.5 or 0.05″'))}
    ${fld('People', txt('pRPpl', o.people != null && o.people !== '' ? String(o.people) : '', 'auto, about 1 per 150 sq ft'))}
    ${fld('Equipment heat', txt('pREqW', o.equipW > 0 ? String(o.equipW) : '', 'W, e.g. 1500'))}
    ${fld('Air changes target', txt('pRAch', o.ach > 0 ? String(o.ach) : '', q && q.iso ? 'ISO ' + q.iso + ' typical: ' + C.targets[q.iso].ach + '/hr' : 'per hour'))}`;
  if (q) {
    h += `<div class="stats">
      <span>Floor area</span><span>${Math.round(q.area)} sq ft</span>
      <span>Volume</span><span>${Math.round(q.volume).toLocaleString()} cu ft <small>(${esc(fmt(q.H))} ceiling)</small></span>
      <span>FFUs over it</span><span>${q.ffus} · ${Math.round(q.cfm).toLocaleString()} CFM</span>
      <span>Air changes</span><span${q.achTarget ? ` style="color:${q.ach >= q.achTarget ? '#6fd08c' : '#ff7a6b'}"` : ''}>${Math.round(q.ach)} /hr${q.achTarget ? ' <small>(needs ' + q.achTarget + ')</small>' : ''}</span>
      <span>Filter coverage</span><span${q.covTarget ? ` style="color:${q.coverage >= q.covTarget ? '#6fd08c' : '#ff7a6b'}"` : ''}>${Math.round(q.coverage)}%${q.covTarget ? ' <small>(needs ' + q.covTarget + '%)</small>' : ''}</span>
      <span>Return grilles</span><span${q.cfm > 0 ? ` style="color:${q.retWarn ? '#f2b84b' : '#6fd08c'}"` : ''}>${q.returns} · ${q.returnArea.toFixed(1)} sq ft${q.returnFpm != null ? ' <small>(' + Math.round(q.returnFpm) + ' fpm)</small>' : ''}</span>
      <span>Return capacity</span><span>${Math.round(q.returnCap).toLocaleString()} CFM <small>of ${Math.round(q.cfm).toLocaleString()} supplied</small></span>
      ${q.pressure != null ? `<span>Pressure</span><span>${q.pressure > 0 ? '+' : ''}${q.pressure} Pa <small>(${inWC(q.pressure)})</small></span>` : ''}</div>`;
    if (q.retWarn) h += `<p class="note" style="color:#f2b84b">Air balance: ${esc(q.retWarn)}${q.retMore ? `; add about ${q.retMore} more 24″ × 24″ return grille${q.retMore === 1 ? '' : 's'} (Grille tool)` : ''}.</p>`;
    if (q.typeIssues && q.typeIssues.length) h += `<p class="note" style="color:#ff7a6b"><b>${esc(Plan3DViewer.ROOM_TYPES[o.crType].label)}:</b> ${q.typeIssues.map(esc).join('; ')}.</p>`;
    else if (o.crType && Plan3DViewer.ROOM_TYPES[o.crType]) h += `<p class="note" style="color:#6fd08c">Meets the ${esc(Plan3DViewer.ROOM_TYPES[o.crType].label)} checks in the plan.</p>`;
    if (q.iso) h += `<p class="note" style="color:${q.ok ? '#6fd08c' : '#ff7a6b'}">${q.ok ? 'Meets typical ISO ' + q.iso + ' design airflow.' : 'Short for ISO ' + q.iso + ': ' + esc(q.short.join('; ')) + '.'}</p>`;
  } else h += `<p class="note">Put this label inside walls to see its airflow.</p>`;
  h += `<p class="note">Pressure is relative to outside the cleanroom (0 Pa). On the plan, arrows at doors show which way air flows; red means it flows from the less clean side or the difference is under 5 Pa. Targets are typical design ranges, not a certification.</p></div>`;
  return h;
}
/* ---------- People and material flow (plan.flows): the gowning route in and the material route through,
   room by room; arrows on the plan and on the 3D floor, and a guided tour along the people route ---------- */
function flowGroupHtml(P) {
  const R = (P.rooms || []).filter(r => r.id); if (R.length < 2) return '';
  const F = P.flows || {}, nm = (k) => k === 'out' ? 'Outside' : esc((R.find(r => r.id === k) || {}).name || 'Room');
  let FR = null; try { FR = Plan3DViewer.flowRoutes(P); } catch (e) { FR = null; }
  const row = (key, label, col) => {
    const list = F[key] || [], miss = FR && FR[key] ? FR[key].miss : [];
    return `<div class="fld"><label style="color:${col}">${label}</label><div class="flow">${list.map((k, i) => `<span class="fchip">${i ? '→ ' : ''}${nm(k)}<button data-fk="${key}" data-fi="${i}" title="Take it out">×</button></span>`).join('')}
      <select data-fadd="${key}"><option value="">+ add</option><option value="out">Outside</option>${R.map(r => `<option value="${esc(r.id)}">${esc(r.name || 'Room')}</option>`).join('')}</select></div></div>
      ${miss.length ? `<p class="note" style="color:#f2b84b">No door between ${miss.map(([a, b]) => esc(a ? a.name || 'Room' : 'Outside') + ' and ' + esc(b ? b.name || 'Room' : 'Outside')).join(', ')}: the route crosses straight there.</p>` : ''}`;
  };
  return `<div class="grp"><h3>People and material flow</h3>${row('people', 'People (gowning)', '#3fd07a')}${row('material', 'Material', '#f09a3a')}
    <p class="note">Pick the rooms in the order people and material go through them. The routes show as arrows on the plan and on the 3D floor (the Airflow button shows and hides them), and the 3D view, walkthroughs and the phone viewer get a ▶ Gowning tour along the people route.</p></div>`;
}
function bindFlows(P) {
  $$('[data-fadd]').forEach(el => el.onchange = () => { const k = el.dataset.fadd, v = el.value; if (!v) return; ed.edit(Q => { Q.flows = { ...(Q.flows || {}) }; Q.flows[k] = [...(Q.flows[k] || []), v]; }); });
  $$('[data-fk]').forEach(b => b.onclick = () => { const k = b.dataset.fk, i = +b.dataset.fi; ed.edit(Q => { Q.flows = { ...(Q.flows || {}) }; Q.flows[k] = (Q.flows[k] || []).filter((_, j) => j !== i); if (!Q.flows[k].length) delete Q.flows[k]; }); });
}

/* ---------- Heat load and power (Plan3DLoads) ---------- */
function loadsGroupHtml(P) {
  if (!window.Plan3DLoads || !(P.rooms || []).length) return '';
  const L = Plan3DLoads.rooms(P); if (!L.rooms.length) return '';
  const S = Plan3DLoads.schedule(P), E = L.E, T = L.total, cnt = (k) => S.circuits.filter(c => c.kind === k).length;
  const rows = L.rooms.map(r => `<div class="pl-row"><span>${esc(r.name)}<small>${Math.round(r.wL)} W lights · ${Math.round(r.wF)} W FFUs${r.wEq ? ' · ' + Math.round(r.wEq) + ' W equipment' : ''} · ${r.people} ${r.people === 1 ? 'person' : 'people'}</small></span><b>${Math.round(r.btuS).toLocaleString()} <small>BTU/hr</small></b></div>`).join('');
  return `<div class="grp"><h3>Heat and power</h3>
    ${fld('FFU motor, 2×4', `<input type="text" id="pLdF" value="${E.ffuW}"> <small>W each (2×2: ${E.ffuW2} W)</small>`)}
    ${fld('Circuits at', `<select id="pLdV"><option value="120" ${E.volts === 120 ? 'selected' : ''}>120 V</option><option value="277" ${E.volts === 277 ? 'selected' : ''}>277 V</option></select>`)}
    ${fld('Safety margin', `<input type="text" id="pLdS" value="${E.safety}"> <small>% on the cooling</small>`)}
    <div class="pl">${rows}</div>
    <div class="stats"><span>Cooling</span><span><b>${Math.round(T.btuS).toLocaleString()} BTU/hr</b> · ${T.tons.toFixed(1)} tons</span>
      <span>Circuits</span><span>${S.circuits.length} <small>(${cnt('ffu')} FFU, ${cnt('light')} lights${cnt('rec') ? ', ' + cnt('rec') + ' receptacle' : ''}${cnt('ded') ? ', ' + cnt('ded') + ' dedicated' : ''})</small></span>
      <span>Connected load</span><span>${(S.connectedW / 1000).toFixed(1)} kW · ${Math.round(S.amps)} A at ${E.volts} V</span>
      <span>Dimming zones</span><span>${S.zones.length} <small>(0-10 V, one per room)</small></span></div>
    <div class="row"><button class="btn small" id="pLdSch">Panel schedule…</button></div>
    <p class="note">Heat from the lights, FFU motors, people (${Plan3DLoads.BTU_PERSON} BTU/hr each, gowned, light work) and equipment you enter on a room label. Planning numbers for sizing the AC and the panel, not a stamped design.</p></div>`;
}
function bindLoads(P) {
  const set = (k, v) => ed.edit(Q => { Q.loads = { ...(Q.loads || {}), [k]: v }; });
  const n = (id, k, lo, hi) => { const el = $('#' + id); if (el) el.onchange = () => { const v = parseFloat(el.value); if (isFinite(v)) set(k, Math.max(lo, Math.min(hi, v))); }; };
  n('pLdF', 'ffuW', 20, 2000); n('pLdS', 'safety', 0, 100);
  if ($('#pLdV')) $('#pLdV').onchange = (e) => set('volts', +e.target.value);
  if ($('#pLdSch')) $('#pLdSch').onclick = panelScheduleDialog;
}
function panelScheduleDialog() {
  const P = ed.plan, S = Plan3DLoads.schedule(P);
  dialogOpen({
    title: 'Panel schedule',
    body: `<table class="qt"><thead><tr><th>Ckt</th><th>Description</th><th>Breaker</th><th class="n">Load</th><th class="n">Amps</th></tr></thead><tbody>
      ${S.circuits.map(c => `<tr><td>${c.n}</td><td>${esc(c.desc)}</td><td>${c.breaker}</td><td class="n">${c.load ? Math.round(c.load) + ' W' : '—'}</td><td class="n">${c.amps ? c.amps.toFixed(1) : '—'}</td></tr>`).join('')}
      </tbody></table>
      <p class="note">${S.circuits.length} circuits, ${(S.connectedW / 1000).toFixed(1)} kW connected (${Math.round(S.amps)} A at ${S.E.volts} V). FFUs and lights are loaded to 16 A on 20 A breakers, room by room; receptacles 8 to a circuit. Dimming: ${S.zones.map(z => esc(z.room) + ' (' + z.lights + ')').join(', ') || 'none'}.</p>`,
    buttons: [{ label: 'Close', ret: null }, { label: 'Export (.csv)', primary: true, ret: 'csv' }],
    onOpen: (d) => d.classList.add('wide-xl')
  }).then(async (r) => {
    $('#dlg').classList.remove('wide-xl');
    if (r !== 'csv' || !api.exportFile) return;
    const p = await api.exportFile(Plan3DLoads.scheduleCSV(P), P.name + ' panel schedule', 'csv');
    if (p) toast('Panel schedule saved.', { label: 'Open it', fn: () => api.openPath(p) });
  });
}
function checkGroupHtml(P) {
  if (!(P.rooms || []).some(r => r.iso || r.crType || (r.pressure != null && r.pressure !== ''))) return `<div class="grp"><h3>Cleanroom check</h3><p class="note">Pick a room label and set its ISO class and pressure to check air changes, filter coverage and the pressure cascade.</p></div>`;
  const C = (() => { try { return Plan3DViewer.cleanroomCheck(P); } catch (e) { return null; } })(); if (!C) return '';
  const rows = C.rooms.filter(q => q.iso || q.pressure != null || q.room.crType).map(q => `<div class="pl-row"><span>${esc(q.room.name || 'Room')}<small>${q.iso ? 'ISO ' + q.iso + ' · ' : ''}${Math.round(q.ach)} ACH${q.achTarget ? ' / ' + q.achTarget : ''} · ${Math.round(q.coverage)}% coverage${q.pressure != null ? ' · ' + (q.pressure > 0 ? '+' : '') + q.pressure + ' Pa (' + inWC(q.pressure) + ')' : ''}${q.typeIssues && q.typeIssues.length ? '<br><span style="color:#ff7a6b">' + esc(q.typeIssues[0]) + (q.typeIssues.length > 1 ? ' (+' + (q.typeIssues.length - 1) + ' more)' : '') + '</span>' : ''}${q.retWarn ? '<br><span style="color:#f2b84b">' + esc(q.retWarn) + '</span>' : q.returns ? ' · returns ' + Math.round(q.returnFpm) + ' fpm' : ''}</small></span><b style="color:${!q.iso ? 'inherit' : q.ok ? '#6fd08c' : '#ff7a6b'}">${!q.iso ? '–' : q.ok ? '✓' : '✗'}</b></div>`).join('');
  const nm = (r) => r ? esc(r.name || 'Room') : 'outside';
  const dw = C.doors.filter(d => d.warn).map(d => `<div class="pl-row"><span>${nm(d.a)} ↔ ${nm(d.b)}<small>${esc(d.warn)}</small></span><b style="color:#ff7a6b">!</b></div>`).join('');
  return `<div class="grp"><h3>Cleanroom check</h3><div class="pl">${rows}${dw ? '<div class="pl-cat">Doors</div>' + dw : ''}</div>
    <p class="note">Air changes and filter coverage from the FFUs over each room, against typical ISO class design ranges; return air through the room's return grilles (aim for 400 fpm or less through them). Pressure arrows on the plan show the cascade. 12.5 Pa = 0.05″ w.c.</p></div>`;
}

/* ---------- Customer comments (from the walkthrough page) ----------
   Each plan gets a share id and a private key (plan.share). Walkthroughs and the phone viewer send comments
   to the share id on Coll Business Solutions' server; this app reads them back with the key, every minute
   while the plan is open, and adds them to the plan. A comments file still works (Import comments file). */
const PLAN3D_CLOUD = 'https://cleanroom-cloud-production.up.railway.app/api/plan3d';
const rid = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
let shareReg = '';
function ensureShare() {
  const P = ed.plan;
  if (!P.share || !P.share.id || !P.share.key) { P.share = { id: rid(18), key: rid(24), seen: 0 }; ed.dirty = true; }
  registerShare(); trackJob();
  return P.share;
}
async function registerShare() {
  const S = ed.plan.share; if (!S || !S.key || shareReg === S.id) return;
  try { const r = await fetch(PLAN3D_CLOUD + '/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareId: S.id, key: S.key, project: ed.plan.name || '' }) }); if (r.ok) shareReg = S.id; } catch (e) { /* offline: tried again on the next check */ }
}
// a customer's decision on a walkthrough link (Approve / Request changes) arrives as a comment marked
// ref.kind 'approval', ref.id the version of the link they looked at
const isApproval = (c) => !!(c && c.ref && c.ref.kind === 'approval');
function mergeApprovals(list) {
  const got = [];
  for (const c of list) {
    if (!isApproval(c) || (ed.plan.approvals || []).some(a => a.id === String(c.id))) continue;
    const a = { id: String(c.id), decision: c.target === 'approve' ? 'approve' : 'changes', by: String(c.by || '').slice(0, 60), at: String(c.at || ''), text: String(c.text || '').slice(0, 2000), ver: String(c.ref.id || '') };
    const pubs = ed.plan.published || [], pub = pubs.find(q => q.ver === a.ver);
    a.matched = !!pub;
    ed.edit(Q => { Q.approvals = (Q.approvals || []).concat([a]); if (a.decision === 'approve' && pub) Q.baseline = Object.assign({}, pub.snap, { label: 'approved by ' + (a.by || 'the customer') + ' on the walkthrough link', date: a.at || pub.snap.date }); });
    got.push(a);
  }
  for (const a of got) {
    if (a.decision === 'approve') toast(`✓ ${a.by || 'Your customer'} approved “${ed.plan.name || 'this plan'}”.` + (a.matched ? ' Saved as the approved version: change orders compare against it.' : ' (an earlier version of the link than this plan: mark the approved version yourself if it still matches)'), a.matched ? null : { label: 'Mark approved', fn: () => markApproved('approved by ' + (a.by || 'the customer')) });
    else toast(`${a.by || 'Your customer'} asked for changes on “${ed.plan.name || 'this plan'}”${a.text ? ': ' + a.text.slice(0, 120) : '.'}`);
  }
  if (got.length) { renderProps(); updateChrome(); }
  return got.length;
}
function mergeComments(list) {
  let n = 0; const who = new Set();
  n += mergeApprovals(list); list = list.filter(c => !isApproval(c));
  ed.edit(Pl => { Pl.comments = Pl.comments || []; for (const c of list) { if (!c || !c.text || !isFinite(c.x) || !isFinite(c.y)) continue; const old = Pl.comments.find(q => q.id === String(c.id)); if (old) { if (old.text !== c.text) { old.text = String(c.text).slice(0, 2000); n++; } continue; } Pl.comments.push({ id: String(c.id || Plan3DEditor.uid()), x: +c.x, y: +c.y, h: +c.h || 0, text: String(c.text).slice(0, 2000), by: String(c.by || '').slice(0, 60), at: String(c.at || ''), ref: c.ref || null }); n++; if (c.by) who.add(c.by); } });
  return { n, who: [...who] };
}
let commentBusy = false;
async function checkComments(loud) {
  const S = ed.plan.share; if (!S || !S.key || commentBusy) return;
  commentBusy = true;
  try {
    await registerShare();
    const r = await fetch(PLAN3D_CLOUD + '/comments/' + encodeURIComponent(S.id) + '?after=' + (S.seen || 0), { headers: { 'X-Plan3D-Key': S.key } });
    if (r.status === 404) shareReg = '';  // the server doesn't have this plan's key: register again next time
    if (!r.ok) { if (loud) toast('Couldn’t check for comments right now.'); return; }
    const d = await r.json(), list = d.comments || [];
    if (d.last > (S.seen || 0)) { S.seen = d.last; ed.dirty = true; }
    const { n, who } = list.length ? mergeComments(list) : { n: 0, who: [] };
    if (n) { renderProps(); updateChrome(); toast(`${n} new comment${n === 1 ? '' : 's'}${who.length ? ' from ' + who.slice(0, 2).join(' and ') : ''} on “${ed.plan.name || 'this plan'}”. Pins show where.`); }
    else if (loud) toast('No new comments.');
  } catch (e) { if (loud) toast('Couldn’t reach the comments server. Check your internet connection.'); }
  finally { commentBusy = false; }
}
setInterval(() => { if (document.visibilityState === 'visible') checkComments(false); }, 60000);

/* ---------- Comment notifications: every job you've sent a walkthrough or phone link for ----------
   Each plan with a share is remembered on this computer (its name, file and key). Every minute and a half the
   app asks the comments server about all of them, even when they aren't open; new comments light up the bell
   (and a Windows notification). Clicking a job opens its file and shows its comments. */
const JOBS = {
  get() { try { return JSON.parse(localStorage.getItem('p3.jobs') || '{}') || {}; } catch (e) { return {}; } },
  set(j) { try { localStorage.setItem('p3.jobs', JSON.stringify(j)); } catch (e) { /* storage full */ } }
};
function trackJob() {
  const S = ed.plan.share; if (!S || !S.id || !S.key) return;
  const J = JOBS.get(), o = J[S.id] || { id: S.id, notified: S.seen || 0, unread: 0 };
  o.key = S.key; o.name = ed.plan.name || o.name || 'Untitled plan'; if (projectPath) o.path = projectPath;
  J[S.id] = o; JOBS.set(J); refreshBell();
}
const ago = (iso) => { const t = Date.parse(iso || ''); if (!isFinite(t)) return ''; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' hr ago' : Math.round(m / 1440) + ' days ago'; };
function refreshBell() {
  const J = Object.values(JOBS.get()), n = J.reduce((t, o) => t + (o.unread || 0), 0), badge = $('#bBell .badge');
  if (badge) { badge.hidden = !n; badge.textContent = n > 99 ? '99+' : String(n); }
  $('#bBell') && $('#bBell').setAttribute('title', n ? `${n} new customer comment${n === 1 ? '' : 's'}` : 'Customer comments: new ones on any of your jobs');
  const P2 = $('#bellPanel'); if (!P2 || P2.hidden) return;
  const L = J.filter(o => o.lastAt || o.unread).sort((a, b) => (b.unread || 0) - (a.unread || 0) || (b.newAt || 0) - (a.newAt || 0));
  P2.innerHTML = `<h4>Customer comments ${L.some(o => o.unread) ? '<button id="bellAll">Mark all read</button>' : ''}</h4>` + (L.length ? L.map(o => `<button class="bjob${o.unread ? '' : ' read'}" data-job="${esc(o.id)}"><b>${esc(o.name || 'Untitled plan')}${o.unread ? `<span>${o.unread} new</span>` : ''}</b><small>${esc(o.path ? o.path.split(/[\\/]/).pop() : 'not saved to a file yet')}${o.lastAt ? ' · ' + esc(ago(o.lastAt)) : ''}</small>${o.lastText ? `<q>${esc(o.lastText)}</q>${o.lastBy ? `<small>— ${esc(o.lastBy)}</small>` : ''}` : ''}</button>`).join('') : `<div class="empty">No comments yet. When a customer sends comments from a walkthrough or the phone viewer, the job shows up here${J.length ? ` (watching ${J.length} job${J.length === 1 ? '' : 's'})` : ''}.</div>`);
  $$('#bellPanel [data-job]').forEach(b => b.onclick = () => openJob(b.dataset.job));
  if ($('#bellAll')) $('#bellAll').onclick = (e) => { e.stopPropagation(); const J2 = JOBS.get(); for (const o of Object.values(J2)) o.unread = 0; JOBS.set(J2); refreshBell(); };
}
function showCommentsPanel() {
  ed.sel = null; ed.multi = null; renderProps();
  requestAnimationFrame(() => { const h = [...document.querySelectorAll('.grp h3')].find(x => /Customer comments/.test(x.textContent)); if (h) { const g = h.closest('.grp'); g.scrollIntoView({ behavior: 'smooth', block: 'start' }); g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash'); } });
}
async function openJob(id) {
  const J = JOBS.get(), o = J[id]; if (!o) return;
  $('#bellPanel').hidden = true; $('#bBell').setAttribute('aria-expanded', 'false');
  const here = ed.plan.share && ed.plan.share.id === id;
  if (!here) {
    if (!o.path) { toast(`“${o.name}” hasn’t been saved to a file yet. Open it and Save once, then it opens from here.`); return; }
    if (!(await guardUnsaved())) return;
    const r = api.loadPath ? await api.loadPath(o.path) : null;
    if (!r || r.kind === 'error') { toast(`Couldn’t open ${o.path.split(/[\\/]/).pop()}. It may have been moved or renamed.`); return; }
    await handleLoaded(r);
  }
  const J2 = JOBS.get(); if (J2[id]) { J2[id].unread = 0; JOBS.set(J2); } refreshBell();
  await checkComments(false);
  showCommentsPanel();
}
function desktopNotify(o, n) {
  try {
    if (!('Notification' in window)) return;
    const title = o.lastDecision === 'approve' ? `✓ ${o.lastBy || 'Your customer'} approved ${o.name || 'a job'}` : o.lastDecision === 'changes' ? `${o.lastBy || 'Your customer'} asked for changes on ${o.name || 'a job'}` : `${n} new comment${n === 1 ? '' : 's'} on ${o.name || 'a job'}`;
    const go = () => { const nt = new Notification(title, { body: (o.lastBy ? o.lastBy + ': ' : '') + (o.lastText || ''), silent: false }); nt.onclick = () => { window.focus(); openJob(o.id); }; };
    if (Notification.permission === 'granted') go(); else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') go(); });
  } catch (e) { /* no notifications here */ }
}
let jobsBusy = false;
async function pollJobs() {
  if (jobsBusy || !navigator.onLine) return; jobsBusy = true;
  try {
    const J = JOBS.get(); let changed = false; const fresh = [];
    for (const o of Object.values(J)) {
      if (!o || !o.id || !o.key) continue;
      try {
        const ask = () => fetch(PLAN3D_CLOUD + '/comments/' + encodeURIComponent(o.id) + '?after=' + (o.notified || 0), { headers: { 'X-Plan3D-Key': o.key } });
        let r = await ask();
        if (r.status === 404) {
          // the server doesn't know this job's key yet (registering it missed, or comments came in first): register, ask again
          const g = await fetch(PLAN3D_CLOUD + '/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareId: o.id, key: o.key, project: o.name || '' }) });
          if (g.ok) r = await ask();
        }
        if (!r.ok) continue;
        const d = await r.json(), list = (d.comments || []).filter(c => c && c.text);
        if (d.last > (o.notified || 0)) { o.notified = d.last; changed = true; }
        if (list.length) {
          const c = list[list.length - 1]; o.lastText = String(c.text).slice(0, 160); o.lastDecision = isApproval(c) ? (c.target === 'approve' ? 'approve' : 'changes') : ''; o.lastBy = String(c.by || '').slice(0, 60); o.lastAt = c.at || new Date().toISOString(); o.newAt = Date.now();
          // the job that's open and on screen gets them straight into its comments (checkComments); still listed
          const open = ed.plan.share && ed.plan.share.id === o.id && document.hasFocus();
          if (!open) { o.unread = (o.unread || 0) + list.length; fresh.push([o, list.length]); }
          changed = true;
        }
      } catch (e) { /* this one again next time */ }
    }
    if (changed) JOBS.set(J);
    refreshBell();
    for (const [o, n] of fresh) desktopNotify(o, n);
  } finally { jobsBusy = false; }
}
setInterval(pollJobs, 90000); setTimeout(pollJobs, 5000); window.addEventListener('focus', () => pollJobs());
document.addEventListener('click', (e) => { const P2 = $('#bellPanel'); if (P2 && !P2.hidden && !e.target.closest('.bellwrap')) { P2.hidden = true; $('#bBell').setAttribute('aria-expanded', 'false'); } });
setTimeout(() => { const b = $('#bBell'); if (!b) return; b.onclick = (e) => { e.stopPropagation(); const P2 = $('#bellPanel'), open = P2.hidden; P2.hidden = !open; b.setAttribute('aria-expanded', String(open)); if (open) { refreshBell(); pollJobs(); } }; refreshBell(); }, 0);
window.addEventListener('focus', () => checkComments(false));
/* ---------- Customer comments (from the walkthrough page) ---------- */
/* ---------- General drafting (the Build a project side): the tool bar, layers, text, exact edits ---------- */
const DTOOLS = [['line', 'Line'], ['pline', 'Polyline'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['arc', 'Arc'], ['text', 'Text'], ['dim', 'Dimension'], ['insert', 'Block'], ['trim', 'Trim'], ['extend', 'Extend']];
// a length that may be negative (-3'6")
const lenS = (v) => { v = String(v || '').trim(); const neg = v.startsWith('-'); const L = parseLen(neg ? v.slice(1) : v, 'ft'); return neg ? -L : L; };
const ccw = (rad) => +((((-rad * 180 / Math.PI) % 360) + 360) % 360).toFixed(2);
function draftPalette() {
  const DR = Plan3DDraft, D = DR.data(ed.plan, false), L = D ? D.layers : [{ id: '0', name: '0' }], cur = D ? D.cur : '0', blocks = D ? Object.keys(D.blocks) : [];
  if (!ed.dtool) ed.dtool = 'line';
  if (ed.dtool === 'insert' && (!ed.dblock || !blocks.includes(ed.dblock))) ed.dblock = blocks[0] || null;
  $('#draftPal').innerHTML = `<div class="grp"><div class="row">${DTOOLS.map(([k, l]) => `<button data-dt="${k}" class="${ed.dtool === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="grp"><div class="row" style="align-items:center">
      <label class="dpl">Layer <select id="dpLay">${L.map(l => `<option value="${esc(l.id)}" ${l.id === cur ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
      <button data-da="layers">Layers…</button>
      <label class="dpl">Text scale <select id="dpSc">${DR.SCALES.map(([v, l]) => `<option value="${v}" ${+(D ? D.ascale : 48) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      ${ed.dtool === 'insert' ? `<label class="dpl">Block <select id="dpBlk">${blocks.length ? blocks.map(b => `<option ${ed.dblock === b ? 'selected' : ''}>${esc(b)}</option>`).join('') : '<option value="">No blocks yet: select drawing, Make block</option>'}</select></label>` : ''}
      <button data-da="attach" title="Bring in a DWG or DXF as a reference (an xref): its lines on a locked layer of its own, to draw over">Attach drawing…</button>
    </div></div>`;
  $$('#draftPal [data-dt]').forEach(b => b.onclick = () => { ed.dtool = b.dataset.dt; ed.dd = null; if (ed.tool !== 'draft') ed.setTool('draft'); else { ed.render(); } draftPalette(); Plan3DDraft.status(ed); $('#plan').focus(); });
  $('#dpLay').onchange = (e) => { const v = e.target.value; ed.edit(P => { Plan3DDraft.data(P, true).cur = v; }); $('#plan').focus(); };
  $('#dpSc').onchange = (e) => { const v = +e.target.value; ed.edit(P => { Plan3DDraft.data(P, true).ascale = v; }); toast('Text and dimensions now sized for ' + Plan3DDraft.SCALES.find(q => q[0] === v)[1] + '.'); $('#plan').focus(); };
  if ($('#dpBlk')) $('#dpBlk').onchange = (e) => { ed.dblock = e.target.value || null; $('#plan').focus(); };
  $$('#draftPal [data-da]').forEach(b => b.onclick = () => { if (b.dataset.da === 'layers') layersDialog(); else attachDrawing(); });
}
function layersDialog() {
  const DR = Plan3DDraft;
  const body = () => { const D = DR.data(ed.plan, true), cnt = {}; for (const e of D.ents) cnt[e.layer] = (cnt[e.layer] || 0) + 1;
    return `<table class="lyt"><thead><tr><th>Current</th><th>Name</th><th>Color</th><th>On</th><th>Locked</th><th>Pieces</th><th></th></tr></thead><tbody>${D.layers.map(l => `<tr data-l="${esc(l.id)}">
      <td><input type="radio" name="lyCur" ${D.cur === l.id ? 'checked' : ''}></td><td><input type="text" class="lyN" value="${esc(l.name)}" ${l.id === '0' ? 'disabled' : ''}></td>
      <td><select class="lyC">${DR.COLORS.map(c => `<option value="${c[0]}" ${l.color === c[0] ? 'selected' : ''}>${c[2]}</option>`).join('')}</select> <i class="lysw" style="background:${esc(l.color)}"></i></td>
      <td><input type="checkbox" class="lyO" ${l.on !== false ? 'checked' : ''}></td><td><input type="checkbox" class="lyL" ${l.lock ? 'checked' : ''}></td><td>${cnt[l.id] || 0}${l.xref ? ' (xref)' : ''}</td>
      <td>${l.id !== '0' ? `<button class="btn small danger lyD" title="${cnt[l.id] ? 'Delete the layer and its ' + cnt[l.id] + ' pieces' : 'Delete the layer'}">✕</button>` : ''}</td></tr>`).join('')}</tbody></table>
      <div class="row" style="margin-top:8px"><button class="btn small" id="lyAdd">Add a layer</button></div>
      <p class="note">New drawing goes on the current layer. A layer that's off doesn't show, print or export; a locked one shows but can't be picked or changed (an attached drawing comes in locked). They go out to AutoCAD as layers with these names and colors.</p>`; };
  const bind = () => {
    const set = (tr, fn) => ed.edit(P => { const l = DR.data(P, true).layers.find(q => q.id === tr.dataset.l); if (l) fn(l, P); });
    $$('.lyt tr[data-l]').forEach(tr => {
      tr.querySelector('[name=lyCur]').onchange = () => { ed.edit(P => { DR.data(P, true).cur = tr.dataset.l; }); };
      const n = tr.querySelector('.lyN'); if (n) n.onchange = () => set(tr, l => { l.name = n.value.trim() || l.name; });
      tr.querySelector('.lyC').onchange = (e) => { set(tr, l => { l.color = e.target.value; }); tr.querySelector('.lysw').style.background = e.target.value; };
      tr.querySelector('.lyO').onchange = (e) => set(tr, l => { l.on = e.target.checked; });
      tr.querySelector('.lyL').onchange = (e) => set(tr, l => { l.lock = e.target.checked; });
      const d = tr.querySelector('.lyD'); if (d) d.onclick = () => { ed.edit(P => { const D = DR.data(P, true), id = tr.dataset.l; D.layers = D.layers.filter(q => q.id !== id); D.ents = D.ents.filter(e => e.layer !== id); if (D.cur === id) D.cur = D.layers[0].id; }); ed.sel = null; ed.multi = null; ed.emit('select'); redraw(); };
    });
    $('#lyAdd').onclick = () => { ed.edit(P => { const D = DR.data(P, true), id = Plan3DEditor.uid(); D.layers.push({ id, name: 'Layer ' + D.layers.length, color: DR.COLORS[D.layers.length % DR.COLORS.length][0], on: true, lock: false }); D.cur = id; }); redraw(); };
  };
  const redraw = () => { $('#dlgBody').innerHTML = body(); bind(); if (ed.tool === 'draft') draftPalette(); };
  dialogOpen({ title: 'Layers', wide: true, body: body(), buttons: [{ label: 'Done', primary: true, ret: null }], onOpen: () => bind() }).then(() => { if (ed.tool === 'draft') draftPalette(); renderProps(); });
}
const TEXT_H = [[3 / 32, '3/32″'], [1 / 8, '1/8″'], [3 / 16, '3/16″'], [1 / 4, '1/4″'], [3 / 8, '3/8″'], [1 / 2, '1/2″'], [3 / 4, '3/4″'], [1, '1″']];
async function draftTextDialog(pt) {
  const last = ed.lastTextH || 1 / 8;
  const v = await dialogOpen({ title: 'Text', body: fld('Text', '<input type="text" id="dtS" style="width:100%" spellcheck="true">') + fld('Height when printed', `<select id="dtH">${TEXT_H.map(([h, l]) => `<option value="${h}" ${Math.abs(h - last) < 1e-6 ? 'selected' : ''}>${l}</option>`).join('')}</select>`) + fld('Angle', txt('dtA', '0', 'degrees, counterclockwise')) + '<p class="note">Its size on the drawing follows the text scale in the bar, so it prints at this height.</p>',
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Place it', primary: true, value: () => ({ s: $('#dtS').value, h: +$('#dtH').value, a: +$('#dtA').value || 0 }) }], onOpen: () => { const i = $('#dtS'); i.focus(); i.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#dlgBtns .primary').click(); } }; } });
  if (!v || !v.s.trim()) return;
  ed.lastTextH = v.h; Plan3DDraft.add(ed, { t: 'text', x: pt.x, y: pt.y, str: v.s, ph: v.h, rot: -v.a * Math.PI / 180 });
}
const DNAME = { line: 'Line', pline: 'Polyline', circle: 'Circle', arc: 'Arc', text: 'Text', dim: 'Dimension', insert: 'Block' };
function draftProps(box, o) {
  const DR = Plan3DDraft, P = ed.plan, D = DR.data(P, true), sel = DR.selEnts(ed), n = sel.length;
  const layerSel = (cur) => `<select id="dlLay">${D.layers.map(l => `<option value="${esc(l.id)}" ${l.id === cur ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>`;
  let f = '';
  if (o && o.t === 'line') { const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1); f = fld('Start X', txt('dX1', fmt(o.x1))) + fld('Start Y', txt('dY1', fmt(o.y1))) + fld('End X', txt('dX2', fmt(o.x2))) + fld('End Y', txt('dY2', fmt(o.y2))) + fld('Length', txt('dLen', fmt(L))) + fld('Angle', txt('dAng', String(ccw(Math.atan2(o.y2 - o.y1, o.x2 - o.x1))), '°')); }
  else if (o && o.t === 'circle') f = fld('Center X', txt('dCX', fmt(o.cx))) + fld('Center Y', txt('dCY', fmt(o.cy))) + fld('Radius', txt('dR', fmt(o.r))) + fld('Diameter', txt('dDia', fmt(o.r * 2)));
  else if (o && o.t === 'arc') f = fld('Center X', txt('dCX', fmt(o.cx))) + fld('Center Y', txt('dCY', fmt(o.cy))) + fld('Radius', txt('dR', fmt(o.r))) + fld('Starts at', txt('dA1', String(ccw(o.a1)), '°')) + fld('Ends at', txt('dA0', String(ccw(o.a0)), '°'));
  else if (o && o.t === 'pline') { let per = 0; for (const q of DR.pieces(P, o)) per += Math.hypot(q[2] - q[0], q[3] - q[1]); f = `<div class="stats"><span>Corners</span><span>${o.pts.length}</span><span>${o.closed ? 'Perimeter' : 'Length'}</span><span>${esc(fmt(per))}</span></div>` + fld('Closed', `<label class="chk"><input type="checkbox" id="dClosed" ${o.closed ? 'checked' : ''}> Closed shape</label>`); }
  else if (o && o.t === 'text') f = fld('Text', txt('dStr', o.str || '')) + fld('Height when printed', `<select id="dPH">${TEXT_H.map(([h, l]) => `<option value="${h}" ${Math.abs(h - (o.ph || 0.125)) < 1e-6 ? 'selected' : ''}>${l}</option>`).join('')}</select>`) + fld('Angle', txt('dAng', String(ccw(o.rot || 0)), '°')) + fld('X', txt('dX', fmt(o.x))) + fld('Y', txt('dY', fmt(o.y)));
  else if (o && o.t === 'dim') f = `<div class="stats"><span>Measures</span><span>${esc(fmt(Math.hypot(o.x2 - o.x1, o.y2 - o.y1)))}</span></div>` + fld('Text', txt('dDT', o.text || '', 'the measured length')) + fld('Line offset', txt('dOff', fmt(o.off || 0))) + fld('Text height', `<select id="dPH">${TEXT_H.map(([h, l]) => `<option value="${h}" ${Math.abs(h - (o.ph || 3 / 32)) < 1e-6 ? 'selected' : ''}>${l}</option>`).join('')}</select>`);
  else if (o && o.t === 'insert') f = `<div class="stats"><span>Block</span><span>${esc(o.block)}</span></div>` + fld('X', txt('dX', fmt(o.x))) + fld('Y', txt('dY', fmt(o.y))) + fld('Rotation', txt('dAng', String(ccw(o.rot || 0)), '°')) + fld('Scale', txt('dSc', String(+(o.sc || 1).toFixed(4))));
  const hasEx = sel.some(e => e.t === 'insert' || e.t === 'pline');
  box.innerHTML = `<div class="hd"><span class="kind">${o ? DNAME[o.t] || 'Drawing' : n + ' drawing pieces'}</span><button class="btn small danger" id="dDel">Delete</button></div>
    ${fld('Layer', layerSel(o ? o.layer : (sel[0] && sel[0].layer)))}
    ${f}
    <div class="grp"><h3>Edit</h3><div class="row dcmds"><button class="btn small" data-dc="move">Move…</button><button class="btn small" data-dc="copy">Copy…</button><button class="btn small" data-dc="rotate">Rotate…</button><button class="btn small" data-dc="mirror">Mirror…</button><button class="btn small" data-dc="scale">Scale…</button><button class="btn small" data-dc="offset">Offset…</button><button class="btn small" data-dc="array">Array…</button><button class="btn small" data-dc="block">Make block…</button>${hasEx ? '<button class="btn small" data-dc="explode">Explode</button>' : ''}</div></div>
    <p class="note">Drag it to move it: it catches on endpoints, midpoints, centers and crossings (Alt: freely). Arrow keys nudge 1″ (Shift 6″). Shift+click or Shift-drag a box to pick more.</p>`;
  $('#dDel').onclick = () => ed.deleteSel();
  $('#dlLay').onchange = (e) => DR.cmd.layer(ed, e.target.value);
  const upd = (fn) => ed.edit(() => { const x = ed.selected(); if (x) fn(x); });
  const num = (id, fn) => { const el = $('#' + id); if (!el) return; el.addEventListener('change', () => { const v = lenS(el.value); if (isFinite(v)) upd(x => fn(x, v)); }); el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); }); };
  const deg = (id, fn) => { const el = $('#' + id); if (!el) return; el.addEventListener('change', () => { const v = +el.value; if (isFinite(v)) upd(x => fn(x, -v * Math.PI / 180)); }); el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); }); };
  if (o) {
    num('dX1', (x, v) => { x.x1 = v; }); num('dY1', (x, v) => { x.y1 = v; }); num('dX2', (x, v) => { x.x2 = v; }); num('dY2', (x, v) => { x.y2 = v; });
    num('dLen', (x, v) => { const a = Math.atan2(x.y2 - x.y1, x.x2 - x.x1); x.x2 = x.x1 + Math.cos(a) * v; x.y2 = x.y1 + Math.sin(a) * v; });
    if (o.t === 'line') deg('dAng', (x, a) => { const L = Math.hypot(x.x2 - x.x1, x.y2 - x.y1); x.x2 = x.x1 + Math.cos(a) * L; x.y2 = x.y1 + Math.sin(a) * L; });
    else deg('dAng', (x, a) => { x.rot = a; });
    num('dCX', (x, v) => { x.cx = v; }); num('dCY', (x, v) => { x.cy = v; }); num('dR', (x, v) => { if (v > 0) x.r = v; }); num('dDia', (x, v) => { if (v > 0) x.r = v / 2; });
    deg('dA0', (x, a) => { x.a0 = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); }); deg('dA1', (x, a) => { x.a1 = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); });
    num('dX', (x, v) => { x.x = v; }); num('dY', (x, v) => { x.y = v; }); num('dOff', (x, v) => { x.off = v; });
    if ($('#dSc')) $('#dSc').onchange = (e) => { const v = +e.target.value; if (v > 0) upd(x => { x.sc = v; }); };
    if ($('#dClosed')) $('#dClosed').onchange = (e) => upd(x => { x.closed = e.target.checked; });
    if ($('#dStr')) $('#dStr').onchange = (e) => upd(x => { x.str = e.target.value; });
    if ($('#dDT')) $('#dDT').onchange = (e) => upd(x => { if (e.target.value.trim()) x.text = e.target.value; else delete x.text; });
    if ($('#dPH')) $('#dPH').onchange = (e) => upd(x => { x.ph = +e.target.value; });
  }
  $$('[data-dc]').forEach(b => b.onclick = () => draftCommand(b.dataset.dc));
}
async function draftCommand(c) {
  const DR = Plan3DDraft, ask = (title, body, val) => dialogOpen({ title, body, buttons: [{ label: 'Cancel', ret: null }, { label: 'OK', primary: true, value: val }], onOpen: () => { const i = $('#dlgBody input'); if (i) { i.focus(); i.select && i.select(); } } });
  const xy = (dx, dy) => fld('Across (+ right)', txt('cdX', dx)) + fld('Up/down (+ down)', txt('cdY', dy));
  const rd = () => [lenS($('#cdX').value), lenS($('#cdY').value)];
  if (c === 'move') { const v = await ask('Move', xy("0'", "0'"), rd); if (v && isFinite(v[0]) && isFinite(v[1])) DR.cmd.move(ed, v[0], v[1]); }
  else if (c === 'copy') { const v = await ask('Copy', xy("4'", "0'") + fld('How many copies', txt('cdN', '1')), () => [...rd(), Math.max(1, Math.min(500, Math.round(+$('#cdN').value || 1)))]); if (v && isFinite(v[0]) && isFinite(v[1])) DR.cmd.copy(ed, v[0], v[1], v[2]); }
  else if (c === 'rotate') { const v = await ask('Rotate', fld('Angle', txt('cdA', '90', 'degrees, counterclockwise')) + '<label class="chk"><input type="checkbox" id="cdK"> Keep the original (rotate a copy)</label><p class="note">Turns about the middle of what\'s selected.</p>', () => [+$('#cdA').value, $('#cdK').checked]); if (v && isFinite(v[0])) DR.cmd.rotate(ed, v[0], v[1]); }
  else if (c === 'mirror') { const v = await ask('Mirror', fld('Flip', '<select id="cdM"><option value="v">Left ↔ right</option><option value="h">Top ↕ bottom</option></select>') + '<label class="chk"><input type="checkbox" id="cdK" checked> Keep the original</label>', () => [$('#cdM').value, $('#cdK').checked]); if (v) DR.cmd.mirror(ed, v[0], v[1]); }
  else if (c === 'scale') { const v = await ask('Scale', fld('Scale by', txt('cdS', '2', 'e.g. 2, 0.5')) + '<p class="note">From the middle of what\'s selected.</p>', () => +$('#cdS').value); if (v > 0) DR.cmd.scale(ed, v); }
  else if (c === 'offset') { const v = await ask('Offset', fld('Distance', txt('cdD', fmt(ed.doffset || 0.5))) + '<p class="note">Then click on the side to put the copy on.</p>', () => lenS($('#cdD').value)); if (v > 0) { ed.doffset = v; ed.dtool = 'offset'; ed.setTool('draft'); msg('Offset ' + fmt(v) + ': click the side to put the copy on. Esc when done.'); } }
  else if (c === 'array') { const v = await ask('Array', fld('Rows', txt('cdR', '1')) + fld('Columns', txt('cdC', '3')) + fld('Row spacing (+ down)', txt('cdRY', "4'")) + fld('Column spacing (+ right)', txt('cdCX', "4'")), () => [Math.round(+$('#cdR').value || 1), Math.round(+$('#cdC').value || 1), lenS($('#cdRY').value), lenS($('#cdCX').value)]); if (v && v[0] * v[1] <= 2500 && isFinite(v[2]) && isFinite(v[3])) { const k = DR.cmd.array(ed, Math.max(1, v[0]), Math.max(1, v[1]), v[3], v[2]); toast(k + ' pieces added.'); } }
  else if (c === 'block') { const D = DR.data(ed.plan, true), v = await ask('Make block', fld('Block name', txt('cdB', 'Block ' + (Object.keys(D.blocks).length + 1))) + '<p class="note">The selection becomes one block you can insert again from Drafting → Block. It goes to AutoCAD as its pieces.</p>', () => $('#cdB').value.trim()); if (v) { if (D.blocks[v] && !(await confirmDlg('Replace the block?', 'There is a block called ' + v + ' already. Replace it?', 'Replace'))) return; DR.cmd.block(ed, v); toast('Block “' + v + '” made. Insert more from Drafting → Block.'); } }
  else if (c === 'explode') { const k = DR.cmd.explode(ed); toast(k ? 'Exploded into its pieces.' : 'Nothing to explode.'); }
  renderProps();
}
async function attachDrawing() {
  const r = await api.openFile('ceiling'); if (!r) return;
  if (r.kind !== 'dxf') { toast('Pick a DWG or DXF drawing to attach.'); return; }
  const n = Plan3DDraft.attach(ed, r, (r.name || 'drawing').replace(/\.(dwg|dxf)$/i, ''));
  if (ed.tool === 'draft') draftPalette();
  toast(n ? `Attached ${n} pieces on a locked layer “XREF ${r.name || ''}”. Turn it off or unlock it in Layers.` : 'Nothing to attach in that drawing.');
}
/* Every cleanroom door and pair on the plan becomes the standard door (o.style 'cr': its frame fills the
   opening, 84″ leaves with the vision lite and lever, 86″ head), keeping the opening it has: the leaves are
   sized to leave a 2″ frame jamb each side (a pair's leaves meet in the middle). Returns how many changed. */
function standardDoors(Pl) {
  let n = 0;
  for (const o of Pl.openings || []) {
    if ((o.type !== 'door' && o.type !== 'door2') || o.style === 'cr') continue;
    // only doors in the cleanroom's walls: a door in the building (metal, concrete, stud) stays as it is
    { const V = Plan3DViewer, mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2; let host = null, bd = 1e9; for (const w of Pl.walls || []) { const d = V.segDist(mx, my, w.x1, w.y1, w.x2, w.y2); if (d < bd) { bd = d; host = w; } } if (host && !V.isHard(host)) continue; }
    const len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1), k = o.type === 'door2' ? 2 : 1, gap = k === 2 ? 7.5 / 12 : 0;
    const leaf = Math.round(((len - 4 / 12 - gap) / k) * 96) / 96;
    if (leaf < 1.5) continue;
    o.style = 'cr'; o.leafW = Math.min(5, leaf); o.head = 86 / 12; n++;
  }
  return n;
}
/* ---------- Snapshots: pictures taken in the 3D view (📷), each with a note and the camera it was taken from ---------- */
function snapsGroupHtml(P) {
  const L = P.snaps || [];
  if (!L.length) return `<div class="grp"><h3>Snapshots</h3><p class="note">In 3D, press 📷 Snapshot (or P) to save a picture of an area you want to work on, with a note. They're listed here; Go there flies the 3D view back to the spot.</p></div>`;
  return `<div class="grp"><h3>Snapshots <small>${L.filter(x => !x.done).length} open</small></h3><div class="row" style="margin-bottom:6px"><button class="btn small" data-sview="1">View them large…</button></div><div class="snaps">${L.map((x, i) => `<div class="snap${x.done ? ' done' : ''}"><img src="${x.img}" alt=""><div><b>${i + 1}.</b> ${esc(x.note || 'No note')}<small>${esc((x.at || '').slice(0, 16).replace('T', ' '))}${x.meas && x.meas.length ? ' · ' + x.meas.length + ' measurement' + (x.meas.length === 1 ? '' : 's') : ''}</small>
    <div class="row"><button class="btn small" data-sgo="${x.id}">Go there</button><button class="btn small" data-sdone="${x.id}">${x.done ? 'Reopen' : 'Done'}</button><button class="btn small" data-ssave="${x.id}">Save picture</button><button class="btn small danger" data-sdel="${x.id}">Delete</button></div></div></div>`).join('')}</div></div>`;
}
function bindSnaps(P) {
  const find = (id) => (ed.plan.snaps || []).find(x => x.id === id);
  $$('[data-sgo]').forEach(b => b.onclick = () => { const x = find(b.dataset.sgo); if (!x) return; if (view === '2d') setView('split'); requestAnimationFrame(() => { if (viewer && viewer.flyTo) viewer.flyTo(x.cam); }); });
  $$('[data-sdone]').forEach(b => b.onclick = () => ed.edit(Q => { const x = (Q.snaps || []).find(y => y.id === b.dataset.sdone); if (x) x.done = !x.done; }));
  $$('[data-sdel]').forEach(b => b.onclick = () => ed.edit(Q => { Q.snaps = (Q.snaps || []).filter(y => y.id !== b.dataset.sdel); }));
  $$('[data-ssave]').forEach(b => b.onclick = () => saveSnapPicture(find(b.dataset.ssave)));
  $$('[data-sview]').forEach(b => b.onclick = () => snapsDialog());
  $$('.snaps .snap img').forEach((im, i) => { im.style.cursor = 'zoom-in'; im.title = 'View it large'; im.onclick = () => snapsDialog((ed.plan.snaps || [])[i] && ed.plan.snaps[i].id); });
}
async function saveSnapPicture(x) {
  if (!x || !api.exportFile) return;
  const bin = atob(x.img.split(',')[1]); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const p = await api.exportFile(u, (ed.plan.name || 'Plan3D') + ' snapshot ' + ((ed.plan.snaps || []).indexOf(x) + 1), 'jpg');
  if (p) toast('Picture saved.', { label: 'Open it', fn: () => api.openPath(p) });
}
/* Snapshots, large: every picture taken in 3D in one place, as a gallery of thumbnails with a filter (open,
   done, all). Clicking one shows it big with its note (which can be edited), date and measurements; arrows
   or ← → step through them, and Go there flies the 3D view back to where it was taken. */
function snapsDialog(startId) {
  closeMenus();
  const all = () => ed.plan.snaps || [];
  if (!all().length) { toast('No snapshots yet. In the 3D view, press 📷 Snapshot (or P) to save a picture of a spot with a note.', { label: 'Open 3D', fn: () => setView('3d') }); return; }
  let filter = 'open', cur = startId || null;
  if (startId) { const x = all().find(y => y.id === startId); if (x && x.done) filter = 'all'; }
  if (!all().some(x => !x.done) && !startId) filter = 'all';
  const list = () => all().filter(x => filter === 'all' || (filter === 'done' ? x.done : !x.done));
  const when = (x) => { const d = new Date(x.at || ''); return isNaN(d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const num = (x) => all().indexOf(x) + 1;
  const render = () => {
    const L = list(), B = $('#sgBody'); if (!B) return;
    const nOpen = all().filter(x => !x.done).length, nDone = all().length - nOpen;
    $('#sgTabs').innerHTML = [['open', 'Open', nOpen], ['done', 'Done', nDone], ['all', 'All', all().length]].map(([k, l, n]) => `<button class="btn small${filter === k ? ' primary' : ''}" data-sf="${k}">${l} <small>${n}</small></button>`).join('');
    $$('#sgTabs [data-sf]').forEach(b => b.onclick = () => { filter = b.dataset.sf; cur = null; render(); });
    const x = cur && L.find(y => y.id === cur);
    if (!x) {
      cur = null;
      B.innerHTML = L.length ? `<div class="sg-grid">${L.map(y => `<button class="sg-th${y.done ? ' done' : ''}" data-sid="${y.id}"><img src="${y.img}" alt=""><span><b>${num(y)}.</b> ${esc(y.note || 'No note')}</span><small>${esc(when(y))}${y.done ? ' · done' : ''}</small></button>`).join('')}</div>`
        : `<p class="note" style="padding:20px 4px">${filter === 'done' ? 'None marked done yet.' : 'Nothing open: every snapshot is marked done.'}</p>`;
      $$('#sgBody [data-sid]').forEach(b => b.onclick = () => { cur = b.dataset.sid; render(); });
      return;
    }
    const i = L.indexOf(x);
    B.innerHTML = `<div class="sg-one">
      <div class="sg-pic"><button class="sg-nav" data-nav="-1" title="Previous (←)"${i > 0 ? '' : ' disabled'}>‹</button><img src="${x.img}" alt=""><button class="sg-nav r" data-nav="1" title="Next (→)"${i < L.length - 1 ? '' : ' disabled'}>›</button></div>
      <div class="sg-info"><b>${num(x)}.</b> <small>${esc(when(x))}${x.meas && x.meas.length ? ' · ' + x.meas.length + ' measurement' + (x.meas.length === 1 ? '' : 's') + ' (shown when you go there)' : ''}${x.done ? ' · done' : ''} · ${i + 1} of ${L.length}</small></div>
      <textarea id="sgNote" rows="2" placeholder="What needs work here?">${esc(x.note || '')}</textarea>
      <div class="row"><button class="btn small" data-sa="back">◂ All pictures</button><span style="flex:1"></span><button class="btn small primary" data-sa="go">Go there in 3D</button><button class="btn small" data-sa="done">${x.done ? 'Reopen' : 'Mark done'}</button><button class="btn small" data-sa="save">Save picture</button><button class="btn small danger" data-sa="del">Delete</button></div></div>`;
    const keepNote = () => { const t = $('#sgNote'); if (t && t.value !== (x.note || '')) { const v = t.value; ed.edit(Q => { const y = (Q.snaps || []).find(z => z.id === x.id); if (y) y.note = v; }); } };
    $('#sgNote').onblur = keepNote;
    $$('#sgBody [data-nav]').forEach(b => b.onclick = () => { keepNote(); const y = L[i + +b.dataset.nav]; if (y) { cur = y.id; render(); } });
    $$('#sgBody [data-sa]').forEach(b => b.onclick = () => {
      const a = b.dataset.sa; keepNote();
      if (a === 'back') { cur = null; render(); }
      else if (a === 'go') { $('#dlg').close(); if (view === '2d') setView('split'); setTimeout(() => { if (viewer && viewer.flyTo) viewer.flyTo(x.cam); }, 60); }
      else if (a === 'done') { ed.edit(Q => { const y = (Q.snaps || []).find(z => z.id === x.id); if (y) y.done = !y.done; }); const L2 = list(); if (!L2.some(y => y.id === x.id)) cur = (L2[i] || L2[i - 1] || {}).id || null; render(); }
      else if (a === 'save') saveSnapPicture(x);
      else if (a === 'del') { ed.edit(Q => { Q.snaps = (Q.snaps || []).filter(y => y.id !== x.id); }); if (!all().length) { $('#dlg').close(); toast('Snapshot deleted.'); return; } const L2 = list(); cur = (L2[i] || L2[i - 1] || {}).id || null; render(); }
    });
  };
  dialogOpen({ title: 'Snapshots', wide: true, body: `<div id="sgTabs" class="row sg-tabs"></div><div id="sgBody"></div>`, buttons: [{ label: 'Close', ret: null }],
    onOpen: (d) => {
      d.classList.add('snapsdlg'); render();
      d.onkeydown = (e) => { if (e.target && e.target.tagName === 'TEXTAREA') return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const b = $(`#sgBody [data-nav="${e.key === 'ArrowLeft' ? -1 : 1}"]`); if (b && !b.disabled) { e.preventDefault(); b.click(); } } else if (e.key === 'Backspace' && cur) { e.preventDefault(); cur = null; render(); } };
      const cl = d.onclose; d.onclose = () => {
        // a note typed and not yet left keeps on close too
        const t = $('#sgNote'), id = cur; if (t && id) { const v = t.value, y0 = all().find(z => z.id === id); if (y0 && v !== (y0.note || '')) ed.edit(Q => { const y = (Q.snaps || []).find(z => z.id === id); if (y) y.note = v; }); }
        d.classList.remove('snapsdlg'); d.onkeydown = null; if (cl) cl();
      };
    } });
}
function commentsGroupHtml(P) {
  const L = P.comments || [];
  const rows = L.map((c, i) => `<div class="pl-row"><span><b>${i + 1}.</b> ${esc(c.text)}<small>${esc(c.by || 'Customer')} · ${esc((c.at || '').slice(0, 10))}${c.done ? ' · done' : ''}</small></span><b><button class="btn small" data-cdone="${esc(c.id)}" title="${c.done ? 'Mark open' : 'Mark done'}">${c.done ? '↺' : '✓'}</button><button class="btn small danger" data-cdel="${esc(c.id)}" title="Delete">✕</button></b></div>`).join('');
  const AP = (P.approvals || []).slice(-4).reverse();
  const apHtml = AP.length ? `<div class="pl" style="margin-bottom:8px">${AP.map(a => `<div class="pl-row"><span>${a.decision === 'approve' ? '<b style="color:#3fb36b">✓ Approved</b>' : '<b style="color:#e0a43a">Changes requested</b>'} ${esc(a.text && a.decision !== 'approve' ? a.text : '')}<small>${esc(a.by || 'Customer')} · ${esc((a.at || '').slice(0, 10))}${a.decision === 'approve' && !a.matched ? ' · an earlier version of the link' : ''}</small></span></div>`).join('')}</div>` : '';
  return `<div class="grp"><h3>Customer comments</h3>${apHtml}${L.length ? `<div class="pl">${rows}</div>` : '<p class="note">Export a walkthrough page and send it, or open the plan in the phone viewer. Your customer clicks 💬 Comment, leaves notes on anything and taps Send comments: they show up here on their own, with pins where they were left.</p>'}
    <div class="row">${P.share && P.share.key ? '<button class="btn small" id="pCChk">Check for comments</button>' : ''}<button class="btn small" id="pCImp">Import comments file…</button></div>
    ${L.length ? '<p class="note">Numbered pins show on the plan and in 3D where each comment was left. Comments go out with the next walkthrough you send, so your customer sees what you marked done.</p>' : ''}</div>`;
}
function bindComments(P) {
  const chk = $('#pCChk'); if (chk) chk.onclick = () => checkComments(true);
  const imp = $('#pCImp'); if (imp) imp.onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => {
      let d; try { d = JSON.parse(rd.result); } catch (e) { toast('That file isn’t a comments file.'); return; }
      const list = Array.isArray(d) ? d : d && Array.isArray(d.comments) ? d.comments : null; if (!list) { toast('That file isn’t a comments file.'); return; }
      const { n } = mergeComments(list);
      toast(n ? `Imported ${n} comment${n === 1 ? '' : 's'}${d.project ? ' on “' + d.project + '”' : ''}.` : 'No new comments in that file.');
    }; rd.readAsText(f); };
    inp.click();
  };
  $$('[data-cdel]').forEach(b => b.onclick = () => ed.edit(Pl => { Pl.comments = (Pl.comments || []).filter(c => c.id !== b.dataset.cdel); }));
  $$('[data-cdone]').forEach(b => b.onclick = () => ed.edit(Pl => { const c = (Pl.comments || []).find(q => q.id === b.dataset.cdone); if (c) c.done = !c.done; }));
}

/* ---------- Parts list ---------- */
function partsGroup() {
  if (!ed.plan.walls.length && !ed.plan.chases.length && !(ed.plan.inserts || []).length) return '';
  // one list, a section per building (the main plan, then each placed building)
  let body = '', secs = [];
  // a parts list that can't be worked out never stops the plan from opening
  try { secs = Plan3DParts.projectParts(ed.plan); } catch (e) { console.error(e); return '<div class="grp"><h3>Parts list</h3><p class="note">The parts list couldn\'t be worked out for this plan. The rest of the app works; please send this plan to Coll Business Solutions.</p></div>'; }
  for (const sec of secs) {
    if (sec.title) body += `<div class="pl-sec">${esc(sec.title)}</div>`;
    let cat = '';
    for (const r of sec.rows) {
      if (r.cat !== cat) { cat = r.cat; body += `<div class="pl-cat">${esc(cat)}</div>`; }
      body += `<div class="pl-row"><span>${esc(r.item)}${r.size ? `<small>${esc(r.size)}</small>` : ''}</span><b>${r.qty}${r.unit !== 'ea' ? ' <small>' + esc(r.unit) + '</small>' : ''}</b></div>`;
    }
  }
  return `<div class="grp"><h3>Parts list</h3><div class="pl">${body}</div>
    <div class="row"><button class="btn small primary" id="pPartsCsv">Export parts list (.csv)</button></div>
    <p class="note">Opens in Excel. Counts update as you build. Ceiling tile and grid figures are estimates.</p></div>`;
}
function bindParts() { const b = $('#pPartsCsv'); if (b) b.onclick = exportParts; }
async function exportParts() {
  const csv = Plan3DParts.toCSV(Plan3DParts.projectParts(ed.plan), ed.plan);
  if (!api.exportFile) return;
  const p = await api.exportFile(csv, ed.plan.name + ' parts list', 'csv');
  if (p) toast('Parts list saved.', { label: 'Open it', fn: () => api.openPath(p) });
}

/* ---------- Quote and proposal ----------
   Prices live in a price book on this computer (one price per part, for every project); the customer, scope
   and the job's own numbers (labor, freight, markup, tax) are saved in the plan (plan.quote). */
const QS = { get(k, d) { try { const v = localStorage.getItem('p3.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('p3.' + k, JSON.stringify(v)); } catch (e) { /* full */ } } };
// 1.5.97 named the tile type in the ceiling tile parts ("Ceiling tile, vinyl-covered gypsum, full 2′ × 4′"); the
// prices saved under the old names move to the vinyl-covered gypsum ones, once
(function migrateTilePrices() {
  if (QS.get('mig.tiles', false)) return;
  const P = QS.get('prices', null);
  if (P) {
    let n = 0;
    for (const k of Object.keys(P)) {
      const f = k.split('|');
      if (f[0] !== 'Ceiling' || !/^Ceiling tile, (full|cut|2×4)/.test(f[1] || '')) continue;
      f[1] = f[1].replace(/^Ceiling tile, /, 'Ceiling tile, vinyl-covered gypsum, ');
      const nk = f.join('|'); if (P[nk] == null) { P[nk] = P[k]; n++; }
    }
    if (n) QS.set('prices', P);
  }
  QS.set('mig.tiles', true);
})();
const QDEF = { markup: 25, tax: 0, laborMode: 'sqft', laborRate: 0, laborLump: 0, freight: 0, showLines: false, validDays: 30,
  terms: 'Prices are good for 30 days. 50% deposit to order, balance due on completion.\nIncludes the cleanroom shown: panels, doors, ceiling grid, fan filter units, lights and listed equipment, delivered and installed.\nNot included unless listed: HVAC and building tie-ins, electrical service to the cleanroom panel, permits, fire sprinkler work and cleanroom certification.' };
function quoteDialog() {
  const P = ed.plan; if (!P.walls.length && !(P.inserts || []).length) { toast('Add some walls first.'); return; }
  const Q = Plan3DQuote, L = Q.lines(P), area = Q.floorArea(P), prices = QS.get('prices', {});
  const co = QS.get('company', { name: 'Coll Business Solutions LLC', phone: '', email: 'collbusinesssolutions@gmail.com', web: 'collbusinesssolutions.com', logo: '' });
  const d0 = QS.get('quoteDefaults', {}), pq = P.quote || {};
  const S = { ...QDEF, ...d0, ...pq.money };
  const cust = { name: '', company: '', address: '', project: P.name || '', scope: '', ...pq.cust };
  const now = new Date(), pad = (v) => String(v).padStart(2, '0');
  const number = pq.number || 'Q' + String(now.getFullYear()).slice(2) + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
  const sr = null, picOpts = [...(sr ? [['sr', 'Last Super render']] : []), ['view', 'The 3D view as it is now'], ['file', 'A picture file…'], ['none', 'No picture']];
  let picFile = null;
  let cat = '';
  const rowsHtml = L.map((r, i) => { const h = (r.cat !== cat ? `<tr class="qc"><td colspan="4">${esc(cat = r.cat)}</td></tr>` : ''); return h + `<tr><td>${esc(r.item)}${r.size ? `<small>${esc(r.size)}</small>` : ''}</td><td class="n">${r.qty.toLocaleString()} ${r.unit === 'ea' ? '' : esc(r.unit)}</td><td class="n"><input type="text" inputmode="decimal" data-i="${i}" value="${prices[r.key] ? (+prices[r.key]).toFixed(2) : ''}" placeholder="0.00"></td><td class="n" id="qL${i}"></td></tr>`; }).join('');
  const inp = (id, v, ph) => `<input type="text" id="${id}" value="${esc(v == null ? '' : v)}" ${ph ? `placeholder="${esc(ph)}"` : ''}>`;
  dialogOpen({
    title: 'Quote & proposal',
    body: `<div class="qd">
      <div class="qcol">
        <h4>Customer and project</h4>
        ${fld('Customer', inp('qCn', cust.name, 'Name'))}${fld('Company', inp('qCc', cust.company))}
        ${fld('Address', `<textarea id="qCa" rows="2">${esc(cust.address)}</textarea>`)}${fld('Project', inp('qCp', cust.project))}
        ${fld('Proposal no.', inp('qNo', number))}
        ${fld('Scope', `<textarea id="qSc" rows="3" placeholder="A sentence or two on the job, for the customer">${esc(cust.scope)}</textarea>`)}
        <h4>Labor, freight, markup</h4>
        ${fld('Labor', `<select id="qLm"><option value="sqft" ${S.laborMode !== 'lump' ? 'selected' : ''}>Per sq ft of cleanroom (${area.toLocaleString()} sq ft)</option><option value="lump" ${S.laborMode === 'lump' ? 'selected' : ''}>One amount</option></select>`)}
        ${fld('Labor rate', inp('qLr', S.laborMode === 'lump' ? S.laborLump : S.laborRate, S.laborMode === 'lump' ? '$ total' : '$ per sq ft'))}
        ${fld('Freight', inp('qFr', S.freight || '', '$'))}${fld('Markup', inp('qMk', S.markup, '% on materials'))}${fld('Sales tax', inp('qTx', S.tax || '', '% on materials'))}
        <div class="qtot" id="qTot"></div>
        <h4>Proposal</h4>
        ${fld('Picture', `<select id="qPic">${picOpts.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>`)}
        <label class="chk"><input type="checkbox" id="qLines" ${S.showLines ? 'checked' : ''}> Show every line with its price (otherwise totals by category)</label>
        ${fld('Terms', `<textarea id="qTe" rows="4">${esc(S.terms)}</textarea>`)}
        <details class="qco"><summary>Your company on the proposal</summary>
          ${fld('Name', inp('qKn', co.name))}${fld('Phone', inp('qKp', co.phone))}${fld('Email', inp('qKe', co.email))}${fld('Website', inp('qKw', co.web))}
          ${fld('Logo', `<button class="btn small" id="qKl">${co.logo ? 'Change logo…' : 'Add logo…'}</button>${co.logo ? ' <button class="btn small" id="qKx">Remove</button>' : ''}`)}
        </details>
        <div class="row"><button class="btn small" id="qCsv">Export quote (.csv)</button></div>
      </div>
      <div class="qcol qprices"><h4>Prices <small>your cost per unit; saved for every project</small></h4>
        <table class="qt"><thead><tr><th>Part</th><th class="n">Qty</th><th class="n">Unit cost</th><th class="n">Cost</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
    </div>`,
    buttons: [{ label: 'Close', ret: 'close' }, { label: 'Make proposal PDF', primary: true, ret: 'pdf' }],
    onOpen: (dlg) => {
      dlg.classList.add('wide-xl');
      const num = (id) => { const v = parseFloat(($('#' + id).value || '').replace(/[^\d.-]/g, '')); return isFinite(v) ? v : 0; };
      const read = () => {
        Object.assign(S, { laborMode: $('#qLm').value, markup: num('qMk'), tax: num('qTx'), freight: num('qFr'), showLines: $('#qLines').checked, terms: $('#qTe').value });
        if (S.laborMode === 'lump') S.laborLump = num('qLr'); else S.laborRate = num('qLr');
        Object.assign(cust, { name: $('#qCn').value.trim(), company: $('#qCc').value.trim(), address: $('#qCa').value.trim(), project: $('#qCp').value.trim(), scope: $('#qSc').value.trim() });
        Object.assign(co, { name: $('#qKn').value.trim(), phone: $('#qKp').value.trim(), email: $('#qKe').value.trim(), web: $('#qKw').value.trim() });
      };
      const show = () => {
        read(); const T = Q.totals(L, prices, S, area);
        T.rows.forEach((r, i) => { const c = $('#qL' + i); if (c) c.textContent = r.cost ? Q.money(r.cost) : ''; });
        $('#qTot').innerHTML = `<div><span>Materials, your cost</span><b>${Q.money(T.material)}</b></div><div><span>Materials with ${S.markup || 0}% markup</span><b>${Q.money(T.materialSell)}</b></div>
          <div><span>Labor</span><b>${Q.money(T.labor)}</b></div><div><span>Freight</span><b>${Q.money(T.freight)}</b></div>${T.tax ? `<div><span>Sales tax</span><b>${Q.money(T.tax)}</b></div>` : ''}
          <div class="big"><span>Customer price</span><b>${Q.money(T.total)}</b></div><div><span>Markup earned</span><b>${Q.money(T.profit)}</b></div>
          <p class="note">${T.priced} of ${L.length} parts priced.${T.priced < L.length ? ' Parts without a price count as $0.' : ''}</p>`;
        return T;
      };
      dlg.querySelectorAll('.qt input').forEach(el => el.addEventListener('input', () => { const r = L[+el.dataset.i], v = parseFloat(el.value.replace(/[^\d.]/g, '')); if (isFinite(v) && v > 0) prices[r.key] = v; else delete prices[r.key]; QS.set('prices', prices); show(); }));
      dlg.querySelectorAll('.qd .qcol:first-child input, .qd .qcol:first-child textarea, .qd .qcol:first-child select').forEach(el => el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', show));
      $('#qLm').addEventListener('change', () => { $('#qLr').value = (S.laborMode === 'lump' ? S.laborLump : S.laborRate) || ''; $('#qLr').placeholder = S.laborMode === 'lump' ? '$ total' : '$ per sq ft'; show(); });
      const pickImg = (cb) => { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = () => { const x = f.files && f.files[0]; if (!x) return; const rd = new FileReader(); rd.onload = () => cb(rd.result); rd.readAsDataURL(x); }; f.click(); };
      $('#qPic').addEventListener('change', (e) => { if (e.target.value === 'file') pickImg(u => { picFile = u; }); });
      $('#qKl').onclick = () => pickImg(u => { co.logo = u; QS.set('company', co); $('#qKl').textContent = 'Change logo…'; });
      if ($('#qKx')) $('#qKx').onclick = () => { co.logo = ''; QS.set('company', co); $('#qKx').remove(); $('#qKl').textContent = 'Add logo…'; };
      $('#qCsv').onclick = async () => { const T = show(); if (!api.exportFile) return; const p = await api.exportFile(Q.quoteCSV(P, T, S), (cust.project || P.name) + ' quote', 'csv'); if (p) toast('Quote saved.', { label: 'Open it', fn: () => api.openPath(p) }); };
      dlg.__qshow = show;
    }
  }).then(async (r) => {
    const dlg = $('#dlg'); const show = dlg.__qshow; dlg.classList.remove('wide-xl'); delete dlg.__qshow;
    if (!show) return;
    const T = show(), pic = $('#qPic') ? $('#qPic').value : 'none';
    // keep it all: the job's numbers and customer with the plan, company and defaults on this computer
    const { terms, markup, tax, laborMode, laborRate } = S; QS.set('quoteDefaults', { terms, markup, tax, laborMode, laborRate }); QS.set('company', co);
    const no = ($('#qNo') && $('#qNo').value.trim()) || number;
    ed.edit(Q2 => { Q2.quote = { number: no, cust: { ...cust }, money: { ...S } }; });
    if (r !== 'pdf') return;
    if (!api.exportPDF) return;
    let picture = null;
    if (pic === 'sr' && window.__p3sr && window.__p3sr.canvas) { try { picture = window.__p3sr.canvas.toDataURL('image/jpeg', 0.9); } catch (e) { picture = null; } }
    else if (pic === 'view') { picture = viewer && viewer.snapshot ? viewer.snapshot() : null; if (!picture) toast('Open the 3D view and frame the shot to put a picture of it on the proposal.'); }
    else if (pic === 'file') picture = picFile;
    let sheetSvg = '';
    try { if (P.walls.length) sheetSvg = Plan3DSheet.makeSheet(P, { page: 'letter', rotate: 'auto' }).svg; } catch (e) { console.error(e); }
    const dt = new Date(), until = new Date(dt.getTime() + (+S.validDays || 30) * 864e5), f = (x) => x.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = Q.proposalHTML(P, { co, cust, opts: S, T, picture, sheetSvg, number: no, date: f(dt), valid: f(until) });
    const p = await api.exportPDF(html, (cust.project || P.name || 'Cleanroom') + ' proposal ' + no, 8.5, 11);
    if (p) toast('Proposal saved.', { label: 'Open it', fn: () => api.openPath(p) });
  });
}

/* ---------- Fabrication sheets (Plan3DFab): wall elevations, panel numbers, cut-outs, cut list ---------- */
async function fabSheets() {
  const P = ed.plan; if (!P.walls.length) { toast('Add some walls first.'); return; }
  let R; try { R = Plan3DFab.html(P, { project: P.name || 'Cleanroom', company: (QS.get('company', {}) || {}).name || 'Coll Business Solutions LLC', date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }); } catch (e) { console.error(e); toast('The fabrication sheets couldn’t be drawn for this plan.'); return; }
  if (!R.S.W.walls.length) { toast('No cleanroom (hardwall) walls to draw.'); return; }
  if (!api.exportPDF) return;
  const p = await api.exportPDF(R.html, (P.name || 'Cleanroom') + ' fabrication sheets', 17, 11);
  if (p) toast(`Fabrication sheets saved: ${R.S.W.walls.length} walls, ${R.S.rows.length} panels, ${(R.crates || []).length} crates.`, { label: 'Open it', fn: () => api.openPath(p) });
}

/* ---------- Project documents (Plan3DDocs): submittal, purchase orders, install schedule, certification ---------- */
function docCtx() {
  const P = ed.plan, pq = P.quote || {};
  const co = QS.get('company', { name: 'Coll Business Solutions LLC', phone: '', email: 'collbusinesssolutions@gmail.com', web: 'collbusinesssolutions.com', logo: '' });
  const cust = { name: '', company: '', address: '', project: P.name || '', scope: '', ...pq.cust };
  const d = new Date(), pad = (v) => String(v).padStart(2, '0'), stamp = String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate());
  return { P, co, cust, stamp, date: d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) };
}
const needWalls = () => { if (!ed.plan.walls.length && !(ed.plan.inserts || []).length) { toast('Add some walls first.'); return false; } return true; };
const custNote = (c) => c.cust.name || c.cust.company ? '' : '<p class="note">Customer details come from Quote &amp; proposal; fill them in there to put them on the documents.</p>';
async function pdfOut(html, name, msgText) { if (!api.exportPDF) return; const p = await api.exportPDF(html, name, 8.5, 11); if (p) toast(msgText, { label: 'Open it', fn: () => api.openPath(p) }); }
function submittalDialog() {
  if (!needWalls()) return; const c = docCtx(), P = c.P, sd = P.submittal || {};
  const inp = (id, v) => `<input type="text" id="${id}" value="${esc(v == null ? '' : v)}">`;
  dialogOpen({ title: 'Submittal package', body: `${fld('Submittal no.', inp('sbNo', sd.number || 'S' + c.stamp))}${fld('Revision', inp('sbRev', sd.rev != null ? sd.rev : '0'))}
    ${fld('Picture', `<select id="sbPic"><option value="view">The 3D view as it is now</option><option value="none">No picture</option></select>`)}
    <p class="note">Cover with an approval stamp, contents, floor plan, a data sheet for every room (ISO class, air changes, pressure), FFU and light cut sheets, wall panel and ceiling spec, electrical summary and the materials list.</p>${custNote(c)}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Make PDF', primary: true, value: () => ({ number: $('#sbNo').value.trim() || 'S' + c.stamp, rev: $('#sbRev').value.trim(), pic: $('#sbPic').value }) }] }).then(async (r) => {
    if (!r) return;
    ed.edit(Q2 => { Q2.submittal = { number: r.number, rev: r.rev }; });
    const picture = r.pic === 'view' && viewer && viewer.snapshot ? viewer.snapshot() : null;
    let sheetSvg = ''; try { if (P.walls.length) sheetSvg = Plan3DSheet.makeSheet(P, { page: 'letter', rotate: 'auto' }).svg; } catch (e) { console.error(e); }
    let html; try { html = Plan3DDocs.submittalHTML(P, { co: c.co, cust: c.cust, number: r.number, rev: r.rev, date: c.date, picture, sheetSvg }); } catch (e) { console.error(e); toast('Couldn’t make the submittal: ' + e.message); return; }
    await pdfOut(html, (c.cust.project || P.name || 'Cleanroom') + ' submittal ' + r.number + (r.rev ? ' rev ' + r.rev : ''), 'Submittal package saved.');
  });
}
function poDialog() {
  if (!needWalls()) return; const c = docCtx(), P = c.P, G = Plan3DDocs.poGroups(P), sup = QS.get('suppliers', {}), pq = P.pos || {};
  if (!G.length) { toast('Nothing on the parts list to order yet.'); return; }
  const inp = (id, v, ph, w) => `<input type="text" id="${id}" value="${esc(v == null ? '' : v)}" placeholder="${esc(ph || '')}"${w ? ` style="width:${w}"` : ''}>`;
  const need = pq.needBy || '';
  dialogOpen({ title: 'Purchase orders', body: `<p class="note">One PO for each supplier, with every part it supplies, your unit costs from the price book (Quote &amp; proposal), and the order-by date worked back from when you need it on site. Suppliers are saved for every project.</p>
    <div class="row" style="gap:12px">${fld('Need on site by', `<input type="date" id="poNeed" value="${esc(need)}">`)}${fld('PO no. starts', inp('poNo', pq.number || 'PO' + c.stamp))}</div>
    ${fld('Ship to', `<textarea id="poShip" rows="2" placeholder="Job site address (defaults to the customer's address)">${esc(pq.shipTo || '')}</textarea>`)}
    <table class="qt" style="width:100%"><thead><tr><th>Supplies</th><th>Supplier</th><th>Phone</th><th>Email</th><th class="n">Lead (days)</th><th class="n">Lines</th></tr></thead><tbody>
    ${G.map(g => { const s = sup[g.k] || {}; return `<tr><td>${esc(g.label)}</td><td>${inp('poN_' + g.k, s.name, 'Name', '100%')}</td><td>${inp('poP_' + g.k, s.phone, '', '100%')}</td><td>${inp('poE_' + g.k, s.email, '', '100%')}</td><td class="n">${inp('poL_' + g.k, s.lead || Plan3DDocs.LEAD_DAYS[g.k], '', '50px')}</td><td class="n">${g.lines.length}</td></tr>`; }).join('')}</tbody></table>${custNote(c)}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Export (.csv)', value: () => 'csv' }, { label: 'Make PDF', primary: true, value: () => 'pdf' }],
    onOpen: (d) => d.classList.add('wide-xl'),
  }).then(async (r) => {
    const d = $('#dlg'); d.classList.remove('wide-xl');
    if (!r) return;
    for (const g of G) sup[g.k] = { name: ($('#poN_' + g.k) || {}).value || '', phone: ($('#poP_' + g.k) || {}).value || '', email: ($('#poE_' + g.k) || {}).value || '', lead: parseInt(($('#poL_' + g.k) || {}).value, 10) || Plan3DDocs.LEAD_DAYS[g.k] };
    QS.set('suppliers', sup);
    const needBy = $('#poNeed').value, number = $('#poNo').value.trim() || 'PO' + c.stamp, shipTo = $('#poShip').value.trim();
    ed.edit(Q2 => { Q2.pos = { needBy, number, shipTo }; });
    const X = { co: c.co, cust: c.cust, number, date: c.date, needBy: needBy ? new Date(needBy + 'T12:00:00') : null, suppliers: sup, prices: QS.get('prices', {}), shipTo };
    const name = (c.cust.project || P.name || 'Cleanroom') + ' purchase orders';
    if (r === 'csv') { if (!api.exportFile) return; const p = await api.exportFile(Plan3DDocs.posCSV(P, X), name, 'csv'); if (p) toast('Purchase orders saved.', { label: 'Open it', fn: () => api.openPath(p) }); return; }
    const R = Plan3DDocs.posHTML(P, X);
    await pdfOut(R.html, name, `${R.groups.length} purchase order${R.groups.length === 1 ? '' : 's'} saved.`);
  });
}
function scheduleDialog() {
  if (!needWalls()) return; const c = docCtx(), P = c.P, sp = P.install || {};
  const today = new Date(), iso = (d) => d.toISOString().slice(0, 10);
  dialogOpen({ title: 'Install schedule & punch list', body: `<div class="row" style="gap:12px">${fld('Start', `<input type="date" id="isStart" value="${esc(sp.start || iso(new Date(today.getTime() + 14 * 864e5)))}">`)}${fld('Crew', `<input type="number" id="isCrew" min="1" max="20" value="${sp.crew || 3}" style="width:70px"> installers`)}</div>
    <div id="isPrev" class="note"></div><p class="note">Order of work with crew-days from the plan's quantities, start and finish dates (Monday to Friday), crew-days for each room, and a punch list page for every room.</p>${custNote(c)}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Make PDF', primary: true, value: () => ({ start: $('#isStart').value, crew: +$('#isCrew').value || 3 }) }],
    onOpen: () => { const prev = () => { try { const X = Plan3DDocs.installPlan(P, { crew: +$('#isCrew').value || 3, start: new Date(($('#isStart').value || iso(today)) + 'T12:00:00') }); $('#isPrev').innerHTML = `<b>${X.total.toFixed(1)} working days</b> with ${X.crew} installers: ${X.start.toLocaleDateString()} to ${X.finish.toLocaleDateString()}.`; } catch (e) { $('#isPrev').textContent = ''; } }; $('#isCrew').oninput = prev; $('#isStart').onchange = prev; prev(); }
  }).then(async (r) => {
    if (!r) return;
    ed.edit(Q2 => { Q2.install = { start: r.start, crew: r.crew }; });
    const R = Plan3DDocs.scheduleHTML(P, { co: c.co, cust: c.cust, crew: r.crew, start: new Date((r.start || iso(today)) + 'T12:00:00') });
    await pdfOut(R.html, (c.cust.project || P.name || 'Cleanroom') + ' install schedule', `Install schedule saved: ${R.P.total.toFixed(1)} working days.`);
  });
}
/* ---------- Change orders: the plan now against the version the customer approved ---------- */
function markApproved(label, snap) {
  const S = snap || Plan3DDocs.snapshot(ed.plan, label);
  ed.edit(Q => { Q.baseline = S; });
  toast('Saved as the approved version' + (label ? ' (' + label + ')' : '') + '. Change orders compare against it.');
}
async function compareFile() {
  const r = await api.openFile('project'); if (!r) return null;
  if (r.kind !== 'project') { toast("That file couldn't be read."); return null; }
  let p; try { p = JSON.parse(r.json); } catch (e) { toast('That project file is damaged.'); return null; }
  if (!p.walls) { toast('That isn’t a Plan3D plan.'); return null; }
  const S = Plan3DDocs.snapshot(p, r.name || p.name || 'from a file'); S.fromFile = true; return S;
}
async function changeOrderDialog(base0) {
  if (!needWalls()) return; const c = docCtx(), P = c.P;
  let base = base0 || P.baseline || null;
  if (!base) {
    const r = await dialogOpen({ title: 'Change order', body: `<p>A change order compares this plan with the version the customer approved and prices the difference.</p><p class="note">There's no approved version saved in this plan yet. If this plan is what the customer approved, mark it now, make the changes, then come back here. Or compare with a copy of the plan saved before the changes.</p>`,
      buttons: [{ label: 'Cancel', ret: null }, { label: 'Compare with a plan file…', ret: 'file' }, { label: 'Mark this version approved', primary: true, ret: 'mark' }] });
    if (r === 'mark') markApproved(''); 
    if (r === 'file') { const S = await compareFile(); if (S) changeOrderDialog(S); }
    return;
  }
  const prices = QS.get('prices', {}), S = { ...QDEF, ...QS.get('quoteDefaults', {}), ...((P.quote || {}).money || {}) };
  const hist = P.changeOrders || [], next = 'CO-' + String(hist.length + 1).padStart(3, '0');
  const lastAmt = hist.length && hist[hist.length - 1].after != null ? hist[hist.length - 1].after : '';
  const C0 = Plan3DDocs.changes(base, P, prices, S, {});
  const money = (v) => (v < 0 ? '−$' : '$') + Math.abs(Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inp = (id, v, ph) => `<input type="text" id="${id}" value="${esc(v == null ? '' : v)}" ${ph ? `placeholder="${esc(ph)}"` : ''}>`;
  const bdate = new Date(base.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const r = await dialogOpen({ title: 'Change order', wide: true, body: `
    <p class="note">Compared with ${base.fromFile ? 'the plan file <b>' + esc(base.label) + '</b>' : 'the version approved <b>' + esc(bdate) + '</b>' + (base.label ? ' (' + esc(base.label) + ')' : '')}.</p>
    <div id="coPrev" style="max-height:230px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:6px 0 10px;font-size:12px"></div>
    <div class="row" style="gap:10px;flex-wrap:wrap">${fld('Number', inp('coNo', next))}${fld('Schedule', inp('coSch', 'No change', 'e.g. adds 2 working days'))}</div>
    ${fld('Description', `<textarea id="coDesc" rows="2" placeholder="What the customer asked for, in a sentence or two"></textarea>`)}
    <div class="row" style="gap:10px;flex-wrap:wrap">${fld('Labor', inp('coLab', S.laborMode === 'lump' ? '' : Math.round(C0.labor * 100) / 100, '$ for this change'))}${fld('Other', inp('coOth', '', '$ (+ or −)'))}${fld('Other is for', inp('coOthD', '', 'e.g. freight, engineering'))}</div>
    ${fld('Contract so far', inp('coCon', lastAmt, '$ before this change (optional)'))}
    <label class="chk"><input type="checkbox" id="coNext" checked> After making it, this plan becomes the approved version (for the next change order)</label>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Compare with a file…', ret: 'file' }, { label: 'Make change order PDF', primary: true, value: () => ({ number: $('#coNo').value.trim() || next, schedule: $('#coSch').value.trim(), desc: $('#coDesc').value.trim(), labor: $('#coLab').value.replace(/[^\d.-]/g, ''), other: $('#coOth').value.replace(/[^\d.-]/g, ''), otherDesc: $('#coOthD').value.trim(), contract: $('#coCon').value.replace(/[^\d.-]/g, ''), next: $('#coNext').checked }) }],
    onOpen: () => {
      const show = () => {
        const C = Plan3DDocs.changes(base, P, prices, S, { labor: $('#coLab').value.replace(/[^\d.-]/g, ''), other: $('#coOth').value.replace(/[^\d.-]/g, '') });
        $('#coPrev').innerHTML = (C.notes.length ? `<ul style="margin:0 0 6px;padding-left:16px">${C.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '')
          + (C.rows.length ? `<table style="width:100%;border-collapse:collapse">${C.rows.map(q => `<tr><td>${esc(q.item)}${q.size ? ` <span style="opacity:.6">${esc(q.size)}</span>` : ''}</td><td style="text-align:right;white-space:nowrap">${q.d > 0 ? '+' : '−'}${Math.abs(q.d).toLocaleString()} ${q.unit === 'ea' ? '' : esc(q.unit)}</td><td style="text-align:right;white-space:nowrap">${q.priced ? money(q.ext) : '<span style="opacity:.6">no price</span>'}</td></tr>`).join('')}</table>` : '<p style="margin:0">No change to the materials.</p>')
          + `<p style="margin:8px 0 0"><b>Change order total: ${money(C.total)}</b>${C.unpriced ? ` · <span style="opacity:.7">${C.unpriced} part${C.unpriced === 1 ? '' : 's'} not priced (Quote &amp; proposal)</span>` : ''}</p>`;
      };
      ['#coLab', '#coOth'].forEach(id => $(id).addEventListener('input', show)); show();
    } });
  if (r === 'file') { const S2 = await compareFile(); if (S2) changeOrderDialog(S2); return; }
  if (!r) return;
  const C = Plan3DDocs.changes(base, P, prices, S, { labor: r.labor, other: r.other });
  const html = Plan3DDocs.changeOrderHTML(P, { co: c.co, cust: c.cust, number: r.number, date: c.date, base, C, desc: r.desc, otherDesc: r.otherDesc, schedule: r.schedule, contract: r.contract });
  await pdfOut(html, (c.cust.project || P.name || 'Cleanroom') + ' change order ' + r.number, `Change order ${r.number} saved: ${money(C.total)}.`);
  const before = r.contract !== '' && isFinite(+r.contract) ? +r.contract : null;
  ed.edit(Q => { Q.changeOrders = (Q.changeOrders || []).concat([{ number: r.number, date: new Date().toISOString(), total: Math.round(C.total * 100) / 100, before, after: before != null ? Math.round((before + C.total) * 100) / 100 : null }]); if (r.next) Q.baseline = Plan3DDocs.snapshot(Q, 'after ' + r.number); });
}
async function certExport() {
  if (!needWalls()) return; const c = docCtx(), P = c.P;
  const R = Plan3DDocs.roomsOf(P);
  if (!R.length) { toast('Label the rooms (Room tool) and set their type to get a certification page for each.'); }
  await pdfOut(Plan3DDocs.certHTML(P, { co: c.co, cust: c.cust }), (c.cust.project || P.name || 'Cleanroom') + ' certification checklist', `Certification checklist saved: ${R.length} room${R.length === 1 ? '' : 's'}.`);
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

/* ---------- AutoCAD drawing (DWG / DXF) ---------- */
const DWG_VERS = [['ACAD2018', 'AutoCAD 2018 – 2026'], ['ACAD2013', 'AutoCAD 2013 – 2017'], ['ACAD2010', 'AutoCAD 2010 – 2012'], ['ACAD2007', 'AutoCAD 2007 – 2009'], ['ACAD2004', 'AutoCAD 2004 – 2006'], ['ACAD2000', 'AutoCAD 2000 – 2002']];
let cadFmt = 'dwg', cadVer = 'ACAD2018', cadDims = true, cadFix = true;
async function cadDialog() {
  if (!ed.plan.walls.length) { toast('Add some walls first.'); return; }
  const conv = api.hasDwgConverter ? await api.hasDwgConverter() : {};
  const hasOda = !!(conv && conv.oda), hasDwg = hasOda || !!(conv && conv.builtin);
  // without ODA File Converter, the built-in converter saves the AutoCAD 2000 DWG format (every AutoCAD version opens it)
  const vers = hasOda ? DWG_VERS : [['ACAD2000', 'AutoCAD 2000 format (opens in every AutoCAD version)']];
  const o = await dialogOpen({
    title: 'Save for AutoCAD or Revit',
    body: `<p>DWG and DXF save the floor plan 1:1 in inches on standard layers (A-WALL, A-DOOR, A-GLAZ, A-CHASE, A-DIMS …). IFC saves the whole room as a 3D model for Revit.</p>
      ${fld('File type', `<select id="cadFmt"><option value="dwg" ${cadFmt === 'dwg' ? 'selected' : ''}>DWG – AutoCAD drawing</option><option value="dxf" ${cadFmt === 'dxf' ? 'selected' : ''}>DXF – works in any CAD program</option><option value="ifc" ${cadFmt === 'ifc' ? 'selected' : ''}>Revit 3D model (IFC) – opens in Revit, save it there as .rvt</option></select>`)}
      <div id="cadVerRow">${fld('Version', `<select id="cadVer">${vers.map(([v, l]) => `<option value="${v}" ${v === cadVer ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
      <label class="chk"><input type="checkbox" id="cadDims" ${cadDims ? 'checked' : ''}> Dimension strings</label>
      <label class="chk"><input type="checkbox" id="cadFix" ${cadFix ? 'checked' : ''}> Ceiling lights and fan filter units</label>
      <p class="sizeline" id="cadNote"></p>
      <p>Opening the file in Coll Plan3D again brings back the doors, glass, chases and rooms exactly.</p>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Save', primary: true, value: () => ({ format: $('#cadFmt').value, version: $('#cadVer').value, dims: $('#cadDims').checked, fixtures: $('#cadFix').checked }) }],
    onOpen: () => {
      const upd = () => {
        const dwg = $('#cadFmt').value === 'dwg';
        $('#cadVerRow').hidden = !dwg;
        if ($('#cadFmt').value === 'ifc') { $('#cadNote').textContent = 'A full 3D model: walls, posts, doors, glass, pass-thrus, chases, ceiling, lights and FFUs. In Revit: File → Open → IFC, then File → Save As → Project to keep it as an .rvt. Or Insert → Link IFC to drop it into a building model.'; return; }
        $('#cadNote').textContent = dwg ? (hasOda ? 'DWG files are made with ODA File Converter, found on this computer.' : hasDwg ? 'Saved with the built-in DWG converter. Newer AutoCAD versions open it and can save it in their own format.' : 'DWG isn’t available on this computer. Save a DXF; AutoCAD opens DXF files too.') : 'DXF opens in AutoCAD, DraftSight, LibreCAD, SketchUp and most CAD programs.';
      };
      $('#cadFmt').onchange = upd; upd();
    }
  });
  if (!o) return;
  cadFmt = o.format; cadVer = o.version; cadDims = o.dims; cadFix = o.fixtures;
  if (o.format === 'ifc') { exportIfc(o.fixtures); return; }
  let fmtNow = o.format;
  if (fmtNow === 'dwg' && !hasDwg) {
    const a = await dialogOpen({
      title: 'DWG needs one free program',
      body: `<p>Coll Plan3D makes DWG files with the free <b>ODA File Converter</b>. Install it once and DWG saving and opening both work from then on.</p>
        <ol class="help"><li>Click <b>Get ODA File Converter</b> and download the Windows version.</li><li>Run the installer with the normal settings.</li><li>Come back and save as DWG again.</li></ol>`,
      buttons: [{ label: 'Cancel', ret: null }, { label: 'Save DXF instead', ret: 'dxf' }, { label: 'Get ODA File Converter', primary: true, ret: 'oda' }]
    });
    if (a === 'oda' && api.openUrl) api.openUrl('https://www.opendesign.com/guestfiles/oda_file_converter');
    if (a !== 'dxf') return;
    fmtNow = 'dxf';
  }
  let dxf;
  try { dxf = Plan3DCad.toDxf(clonePlan(), { dims: o.dims, fixtures: o.fixtures, plainText: fmtNow === 'dwg' }); }
  catch (e) { toast('Couldn’t make the drawing: ' + e.message); return; }
  msg(fmtNow === 'dwg' ? 'Making the DWG…' : 'Saving the DXF…');
  const r = await api.exportCad({ dxf, name: ed.plan.name, format: fmtNow, version: o.version });
  msg('');
  if (!r) return;
  if (r.error) {
    const text = r.error === 'nodwg' ? 'No DWG converter was found. Save as DXF; AutoCAD opens DXF files too.'
      : r.error === 'dwgsavefail' ? 'The DWG couldn’t be made from this plan. Save as DXF instead; AutoCAD opens DXF files too.'
      : 'Couldn’t save the file. ' + (r.message || '');
    dialogOpen({ title: 'Not saved', body: `<p>${esc(text)}</p>`, buttons: [{ label: 'OK', primary: true, ret: null }] });
    return;
  }
  toast((fmtNow === 'dwg' ? 'DWG' : 'DXF') + ' saved.', { label: 'Show in folder', fn: () => api.showInFolder(r.path) });
}

/* A drawing Coll Plan3D saved: bring the project back. Returns true if handled. */
async function openCadProject(r) {
  if (!r.texts || !r.texts.length || !window.Plan3DCad) return false;
  const C = Plan3DCad;
  const wallSegs = r.segs.filter(s => C.WALL_LAYERS.includes(s[4])).map(s => s.slice(0, 4));
  const got = C.readEmbedded(r.texts, wallSegs);
  if (!got || !got.plan || !Array.isArray(got.plan.walls)) return false;
  let use = 'project';
  if (got.edited) {
    use = await dialogOpen({
      title: 'This drawing was changed in CAD',
      body: `<p>${esc(r.name)} was saved by Coll Plan3D, and its walls have been edited since.</p>
        <p><b>Use the CAD walls</b> imports the walls as they are now in the drawing; doors, glass and chases are added again by hand.<br><b>Open the saved project</b> restores everything as it was when it was saved from Coll Plan3D, without the CAD edits.</p>`,
      buttons: [{ label: 'Cancel', ret: null }, { label: 'Open the saved project', ret: 'project' }, { label: 'Use the CAD walls', primary: true, ret: 'walls' }]
    });
    if (!use) return true;
    if (use === 'walls') { dxfDialog(r, { layers: C.WALL_LAYERS, unit: 1, keepOrigin: true }); return true; }
  }
  const p = got.plan;
  if (!p.name) p.name = r.name;
  if (adoptImported(p)) return;
  projectPath = null; ed.setPlan(p); ed.dirty = true; hideBanner(); updateChrome();
  if (view !== '2d' && viewer) viewer.loadPlan(clonePlan());
  toast('Opened ' + (p.name || r.name) + ' from the ' + (/\.dwg$/i.test(r.path || '') ? 'DWG' : 'DXF') + '. Save it as a project to keep working.');
  return true;
}

/* ---------- Generate ceiling: grid, FFUs and lights laid out inside the cleanroom walls ---------- */
/* ---------- Lights from a lighting drawing: put the fixtures on the plan to move by hand ----------
   Reads every light in a DWG / DXF however it was drawn (blocks, polylines, four loose lines) and what's in it
   (a diagonal: a light; cross-hatching: an emergency light), lines it up with the floor plan (the same drawing
   origin when the plan came from a drawing in the same coordinates, else centred on the building), and puts
   them on the plan as fixtures you can drag. Lights already on the plan at the same spots are matched, not
   doubled: a hatched one there is marked emergency. */
async function lightsDrawingDialog(r0) {
  const P = ed.plan; if (!P.walls.length) { toast('Add or import the floor plan first, then the lights on top of it.'); return; }
  const r = r0 && r0.kind ? r0 : await api.openFile('ceiling'); if (!r) return;
  if (r.kind === 'error') { handleLoaded(r); return; }
  if (r.kind !== 'dxf') { toast('Pick the lighting drawing as a DWG or DXF.'); return; }
  const k = IMP.UNIT_FT[r.insunits] || 1 / 12;
  let L = []; try { L = Plan3DCeiling.lightsFromDrawing(r, k); } catch (e) { console.error(e); }
  if (!L.length) { await dialogOpen({ title: 'No lights found', body: `<p>No light fixtures in <b>${esc(r.name)}</b>. Lights are found as rectangles 1′ to 6′ a side with a diagonal across them (a light) or cross-hatched (an emergency light).</p>`, buttons: [{ label: 'OK', primary: true, ret: null }] }); return; }
  const A = Plan3DViewer.analyze(P), FP = Plan3DViewer.footprint(A, true), B = A.bounds, O = P.dxfOrigin;
  const inside = (x, y) => FP ? FP.has(x, y) : (x >= B.minX && x <= B.maxX && y >= B.minZ && y <= B.maxZ);
  // Where they go: on the lights already on the plan when there are some (the shift that lands the most of them
  // on one), else the project's own drawing origin, else centred on the building
  let tf = null, how = '';
  const ex = (P.ceilingMode === 'manual' ? (P.fixtures || []) : Plan3DViewer.ceilingFixtures(P)).filter(f => f.type !== 'ffu');
  if (ex.length >= 3) {
    const votes = new Map(), q2 = (v) => Math.round(v / 0.25);
    for (const q of L.slice(0, 120)) for (const e of ex) { if (Math.abs(Math.max(q.w, q.h) - Math.max(e.w || 2, e.h || 4)) > 0.6) continue; const kk = q2(e.x - q.cx * k) + ',' + q2(e.y + q.cy * k); votes.set(kk, (votes.get(kk) || 0) + 1); }
    let best = null, bn = 0; for (const [kk, n] of votes) if (n > bn) { bn = n; best = kk; }
    if (best && bn >= Math.min(3, L.length)) {
      // refine: the average offset of the pairs that agree with the winner
      const [bx, by] = best.split(',').map(v => +v * 0.25); let sx = 0, sy = 0, n = 0;
      for (const q of L) { const e = ex.find(f => Math.abs(f.x - (q.cx * k + bx)) < 0.4 && Math.abs(f.y - (-q.cy * k + by)) < 0.4); if (e) { sx += e.x - q.cx * k; sy += e.y + q.cy * k; n++; } }
      const dx = n ? sx / n : bx, dy = n ? sy / n : by; tf = (x, y) => [x * k + dx, -y * k + dy]; how = `lined up on the ${n} light${n === 1 ? '' : 's'} already on the plan`;
    }
  }
  const frac = (f) => L.filter(q => { const [x, y] = f(q.cx, q.cy); return inside(x, y); }).length / L.length;
  if (!tf && O && frac((x, y) => [x * k - O.x0, O.y0 - y * k]) >= 0.5) { tf = (x, y) => [x * k - O.x0, O.y0 - y * k]; how = 'at the drawing’s own coordinates (same as the floor plan)'; }
  if (!tf) {
    let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; for (const q of L) { const x = q.cx * k, y = -q.cy * k; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const mx = B.cx - (x0 + x1) / 2, my = B.cz - (y0 + y1) / 2; tf = (x, y) => [x * k + mx, -y * k + my]; how = 'centred on the building (move the whole set with the arrow keys after selecting them, or one at a time)';
  }
  const placed = L.map(q => { const [x, y] = tf(q.cx, q.cy); return { ...q, x, y }; }), kept = placed.filter(q => inside(q.x, q.y)), nEm = kept.filter(q => q.em).length;
  const fx0 = P.ceilingMode === 'manual' ? (P.fixtures || []) : Plan3DViewer.ceilingFixtures(P);
  const match = (q) => fx0.find(f => Math.hypot(f.x - q.x, f.y - q.y) < 0.75);
  const nMatch = kept.filter(match).length;
  const choice = await dialogOpen({ title: 'Lights from ' + r.name, body: `<p>Found <b>${kept.length} light${kept.length === 1 ? '' : 's'}</b>${nEm ? `, <b>${nEm} of them emergency lights</b> (cross-hatched: battery backup)` : ''}, ${how}.${placed.length > kept.length ? ` ${placed.length - kept.length} outside the building (a legend or notes) are left off.` : ''}</p>
      ${nMatch ? `<p>${nMatch} sit where lights already are on the plan: those are matched, not doubled${nEm ? ', and the cross-hatched ones are marked emergency' : ''}.</p>` : ''}
      <p class="note">On the plan, emergency lights are drawn cross-hatched. Drag any light where you want it; click one to change its type or turn it.</p>`,
    buttons: [{ label: 'Cancel', ret: null }, ...(fx0.some(f => f.type !== 'ffu') ? [{ label: 'Replace the plan’s lights with these', ret: 'replace' }] : []), { label: kept.length - nMatch ? `Add ${kept.length - nMatch} new and mark emergency` : 'Mark emergency lights', primary: true, ret: 'merge' }] });
  if (!choice) return;
  let nNew = 0, nMarked = 0;
  ed.edit(Q => {
    if (Q.ceilingMode !== 'manual') { Q.fixtures = Plan3DViewer.ceilingFixtures(Q).map(f => ({ ...f, id: f.id || Plan3DEditor.uid() })); Q.ceilingMode = 'manual'; }
    Q.fixtures = Q.fixtures || [];
    if (choice === 'replace') Q.fixtures = Q.fixtures.filter(f => f.type === 'ffu');
    for (const q of kept) {
      const f = Q.fixtures.find(g => Math.hypot(g.x - q.x, g.y - q.y) < 0.75);
      if (f) { if (f.type !== 'ffu' && q.em && !f.em) { f.em = true; nMarked++; } continue; }
      Q.fixtures.push({ id: Plan3DEditor.uid(), type: 'led', x: q.x, y: q.y, w: q.w, h: q.h, ...(q.em ? { em: true } : {}) }); nNew++;
    }
    Q.lightsSource = r.name;
  });
  toast(`${nNew} light${nNew === 1 ? '' : 's'} added${nMarked ? `, ${nMarked} marked emergency` : ''}. Drag them where you want them.`);
  if (view === '3d') setView('split');
}
async function generateCeilingDialog() {
  const P = ed.plan;
  if (!P.walls.length) { toast('Draw or import the cleanroom walls first, then generate the ceiling inside them.'); return; }
  const G0 = Plan3DViewer.ceilingGrid(P), has = P.ceilingSource || (P.ceilingGrid && P.ceilingGrid.length) || P.ceilingImage || (P.ceilingMode === 'manual' && (P.fixtures || []).length);
  const nF0 = (P.fixtures || []).filter(f => f.type === 'ffu').length, nL0 = (P.fixtures || []).length - nF0;
  const FM = P.ffuModel && P.ffuModel.sizes && P.ffuModel.sizes.length ? P.ffuModel : null;
  const opts = await dialogOpen({
    title: 'Generate ceiling',
    body: `<p>Lays out a 2′ × 4′ grid centred in the biggest room (so the cut tiles at its two walls match), then in every room inside the cleanroom walls: enough fan filter units for the room's cleanroom class, and lights spread evenly in the cells left over. Cells against walls, chases and ceiling-area edges are skipped. Everything stays editable: drag, delete, add or turn (R) any FFU or light afterwards.</p>
      ${(P.fixtures || []).length ? fld('FFUs and lights already placed', `<select id="gcKeep"><option value="keep" selected>Keep them where they are: line the grid up with them and lay the ceiling around them</option><option value="keepL">Keep them, and add lights in the free cells</option><option value="new">Replace them with a new layout</option></select>`) : ''}
      ${fld('Class for rooms without one', `<select id="gcIso">${[5, 6, 7, 8, 9].map(n => `<option value="${n}" ${n === 7 ? 'selected' : ''}>ISO ${n} (${Plan3DViewer.ISO_TARGETS[n].ach} air changes, ${Plan3DViewer.ISO_TARGETS[n].cov}% FFU coverage)</option>`).join('')}</select>`)}
      ${fld('Lights', `<select id="gcLt"><option value="48">Bright: one per 48 sq ft</option><option value="64" selected>Standard: one per 64 sq ft</option><option value="80">One per 80 sq ft</option><option value="100">Low: one per 100 sq ft</option></select>`)}
      ${fld('Grid', `<select id="gcSw"><option value="0" ${!G0.swap ? 'selected' : ''}>4′ side of the tiles runs up and down the plan</option><option value="1" ${G0.swap ? 'selected' : ''}>4′ side of the tiles runs across the plan</option></select>`)}
      <p class="note">FFU airflow: ${FM ? esc(FM.name) + ', ' + ((FM.sizes.find(q => q.nominal === '2x4') || FM.sizes[0]).cfm || '?') + ' CFM per 2×4 (pick another model in the Plan panel)' : 'no FFU model picked, so 720 CFM per 2×4 (90 fpm); pick a model in the Plan panel for its real airflow'}. A room's own class (set on its room label) wins over the one above. A room label's <b>Generated ceiling</b> setting can also give a room a ceiling no matter what, lights but no FFUs, or no ceiling. Gaps of up to 20′ between cleanroom wall ends count as closed. Afterwards, the <b>Grid</b> tool (T) takes ceiling off a space or puts it back with a click, and makes grid sections you can turn or shift; generating again keeps those choices.</p>
      ${nF0 ? `<p class="note">Keeping them: the grid runs the way most of your FFUs face and sits on the edges most of them are on. A room whose FFUs face the other way, or sit on other lines, gets its own grid section lined up with them, so the tiles between them stay whole. Any room with one of them gets a ceiling. Nothing you placed is moved, removed or added to (the Grid choice above is set by your FFUs).</p>` : ''}
      ${has ? `<p class="note" style="color:var(--warn)">This replaces the current ceiling${P.ceilingSource ? ' from ' + esc(P.ceilingSource) : ''} (${nF0} FFUs, ${nL0} lights). Ctrl+Z puts it back.</p>` : ''}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Generate', primary: true, value: () => { const k = $('#gcKeep') ? $('#gcKeep').value : 'new'; return { iso: +$('#gcIso').value, sqftPerLight: +$('#gcLt').value, swap: $('#gcSw').value === '1', keep: k !== 'new', addLights: k === 'keepL' }; } }]
  });
  if (!opts) return;
  const R = Plan3DViewer.generateCeiling(P, opts);
  if (!R || !R.rooms.length) { await dialogOpen({ title: 'No closed-in rooms found', body: '<p>Generate ceiling only puts grid where the cleanroom walls close a room in, so it never runs out into the warehouse. None of the rooms here are closed in: a wall is missing or stops short somewhere (gaps up to 10′ are closed for it).</p><p>Pick the <b>Grid</b> tool (T), choose <b>Add area</b> and drag a box over each room, then Generate ceiling again to fill them with FFUs and lights. Or close the gaps in the walls.</p>', buttons: [{ label: 'Use the Grid tool', primary: true, ret: 'grid' }, { label: 'Close', ret: null }] }).then(a => { if (a === 'grid') { setView(view === '3d' || view === 'build' ? 'split' : view); ed.setTool('grid'); ed.gridMode = 'add'; gridPalette(); } }); return; }
  ed.edit(Q => { delete Q.ceilTiles; Q.ceilGrid = R.ceilGrid; if (R.gridZones) { if (R.gridZones.length) Q.gridZones = R.gridZones; else delete Q.gridZones; } if (R.keep && R.snapped && R.snapped.length) { const m = new Map(R.snapped.map(q => [q.id, q])); for (const f of Q.fixtures || []) { const q = m.get(f.id); if (q) { f.x = q.x; f.y = q.y; } } } Q.fixtures = R.keep ? (Q.fixtures || []).concat(R.fixtures) : R.fixtures; Q.ceilRects = R.ceilRects; Q.ceilingMode = 'manual'; Q.ceilingSource = 'Generated'; delete Q.ceilingGrid; delete Q.ceilingImage; delete Q.fixturesFinal; });
  updateChrome(); renderProps();
  const short = R.rooms.filter(r => r.ffu < r.need);
  await dialogOpen({
    title: 'Ceiling generated',
    wide: true,
    body: `<p>${R.keep ? `Ceiling laid around your ${R.rooms.reduce((t, r) => t + r.ffu, 0)} FFUs${R.fixtures.length ? `, with ${R.fixtures.length} new light${R.fixtures.length === 1 ? '' : 's'} in the free cells` : ''}, in ${R.rooms.length} room${R.rooms.length === 1 ? '' : 's'}.` : `${R.fixtures.filter(f => f.type === 'ffu').length} FFUs and ${R.fixtures.filter(f => f.type !== 'ffu').length} lights in ${R.rooms.length} room${R.rooms.length === 1 ? '' : 's'}.`}</p>
      ${R.gridZones && R.gridZones.some(q => q.auto) ? `<p class="note">${R.gridZones.filter(q => q.auto).length} room${R.gridZones.filter(q => q.auto).length === 1 ? '' : 's'} got ${R.gridZones.filter(q => q.auto).length === 1 ? 'its' : 'their'} own grid section, turned or shifted to match ${R.gridZones.filter(q => q.auto).length === 1 ? 'its' : 'their'} FFUs (pick it in the plan with the Grid tool to turn, shift or delete it).</p>` : ''}
      ${R.snapped && R.snapped.length ? `<p class="note">${R.snapped.length} of your FFUs/lights sat a little off the grid (up to 6″) and were set into their cells.</p>` : ''}
      ${R.bare ? `<p class="note" style="color:var(--warn)">${R.bare} of your FFUs/lights have no ceiling over them: they're in a space the walls don't close in. Close the room's walls, or use the Grid tool's Add area to box the room in.</p>` : ''}
      ${R.open ? `<p class="note" style="color:var(--warn)">${R.open} room${R.open === 1 ? ' is' : 's are'} not closed in by walls, so ${R.open === 1 ? 'it' : 'they'} got no grid. Box ${R.open === 1 ? 'it' : 'them'} in with the Grid tool's Add area.</p>` : ''}
      ${R.offices ? `<p class="note">${R.offices} room${R.offices === 1 ? '' : 's'} built onto the building's walls (offices, restrooms) got no ceiling. Click one with the Grid tool (Rooms) if it should have one.</p>` : ''}
      ${R.keep && R.offGrid ? `<p class="note" style="color:var(--warn)">${R.offGrid} of your fixtures sit off the grid lines, so tees run across them. Select one and use Snap to grid in Edit ceiling, or nudge it with the arrow keys.</p>` : ''}
      <div class="layers"><label style="grid-template-columns:1.6fr .6fr .8fr .9fr .6fr .9fr;cursor:default"><b>Room</b><b>Class</b><b>Area</b><b>FFUs</b><b>Lights</b><b>Air changes</b></label>
      ${R.rooms.map(r => `<label style="grid-template-columns:1.6fr .6fr .8fr .9fr .6fr .9fr;cursor:default"><span>${esc(r.name)}</span><span>ISO ${r.iso}</span><span>${Math.round(r.area)} sq ft</span><span${r.ffu < r.need ? ' style="color:var(--warn)"' : ''}>${r.ffu}${r.ffu < r.need ? ' of ' + r.need : ''}</span><span>${r.led}${r.lightsOnly ? ' (no FFUs)' : ''}</span><span>${Math.round(r.achGot)} / ${r.ach}</span></label>`).join('')}</div>
      ${short.length ? `<p class="note" style="color:var(--warn)">${short.map(r => esc(r.name)).join(', ')}: ${R.keep ? 'fewer FFUs than that class needs.' : 'not enough whole ceiling cells for the FFUs that class needs. Pick a bigger FFU model, a lower class, or move a chase or wall.'}</p>` : ''}
      <p class="note">Open the 3D view to walk under it. Move, delete or turn (R) any FFU or light in the plan; Edit ceiling has Snap to grid and Remove.</p>`,
    buttons: [{ label: 'OK', primary: true, ret: true }]
  });
}

/* ---------- Ceiling drawing ---------- */
async function ceilingMenu() {
  if (!ed.plan.walls.length) { toast('Add or import the floor plan first, then add the ceiling on top of it.'); return; }
  const P = ed.plan;
  if (P.ceilingSource || (P.ceilingMode === 'manual' && (P.fixtures || []).length)) {
    const nF = (P.fixtures || []).filter(f => f.type === 'ffu').length, nL = (P.fixtures || []).length - nF;
    const a = await dialogOpen({
      title: 'Edit ceiling',
      body: `<p>${P.ceilingSource ? `The ceiling came from <b>${esc(P.ceilingSource)}</b>. ` : ''}It has ${nF} FFU${nF === 1 ? '' : 's'} and ${nL} light${nL === 1 ? '' : 's'}.</p>
        <ul class="help"><li><b>Place or remove FFUs and lights</b> opens Build with the FFU piece picked: click a cell to add one, click one to take it out.</li>
        <li><b>Snap them to the grid</b> fits every FFU and light into whole cells of the ceiling grid.</li>
        <li><b>Move or turn</b> slides the whole ceiling (grid and fixtures) left, right, up or down.</li></ul>`,
      buttons: [{ label: 'Remove it', danger: true, ret: 'remove' }, { label: 'Use another drawing', ret: 'new' }, { label: 'Move or turn', ret: 'move' }, { label: 'Snap them to the grid', ret: 'snap' }, { label: 'Place or remove FFUs and lights', primary: true, ret: 'place' }]
    });
    if (a === 'remove') { ed.edit(Q => Plan3DCeiling.removeCeiling(Q)); updateChrome(); toast('Ceiling removed. The automatic light layout is back.'); return; }
    if (a === 'move') { moveCeilingDialog(); return; }
    if (a === 'snap') {
      snapFixturesIn(null); return;
    }
    if (a === 'place') { setView('build'); if (builder) builder.setTool('ffu'); toast('Click a ceiling cell to add an FFU; click one to take it out. Pick LED light in the pieces for lights.'); return; }
    if (a !== 'new') return;
  }
  const r = await api.openFile('ceiling');
  if (!r) return;
  if (r.kind === 'error') { handleLoaded(r); return; }
  if (r.kind === 'image') { imageCeilingDialog(r); return; }
  if (r.kind === 'dxf') { cadCeilingDialog(r); return; }
  toast('Pick a DWG, DXF or picture of the ceiling.');
}

function ceilingApplied(what) {
  if (view === '2d') setView('3d');
  toast(what + ' Walk view shows it overhead; Dollhouse hides the ceiling.');
}

/* Ceiling position: arrows move it left / right / up / down by the step; drag it in the preview; it snaps to
   the step, and to the walls when a grid line or its edge comes near a wall face. */
function nudgeFields() {
  return `<div class="row ce-nudge" style="gap:12px;align-items:flex-end;flex-wrap:wrap">
    ${fld('Turn', `<select id="ceRot"><option value="0">As drawn</option><option value="90">90° right</option><option value="180">180°</option><option value="270">90° left</option></select>`)}
    <div class="ce-pad" aria-label="Move the ceiling"><button type="button" class="btn small" data-mv="0,-1" title="Up">↑</button><div><button type="button" class="btn small" data-mv="-1,0" title="Left">←</button><button type="button" class="btn small" data-mv="1,0" title="Right">→</button></div><button type="button" class="btn small" data-mv="0,1" title="Down">↓</button></div>
    ${fld('Step', `<select id="ceStep"><option value="0.0833333">1″</option><option value="0.5">6″</option><option value="1" selected>1′</option><option value="2">2′ (half a tile)</option><option value="4">4′ (a tile)</option></select>`)}
    ${fld('Right (−left)', '<input type="text" id="ceDx" value="0" style="width:90px">')}${fld('Down (−up)', '<input type="text" id="ceDy" value="0" style="width:90px">')}
    <label class="chk"><input type="checkbox" id="ceSnapW" checked> Snap to walls</label></div>
    <p class="note" style="margin-top:4px">Drag the ceiling in the preview, use the arrows (or the arrow keys while the preview has focus), or type a distance; a minus sign goes left or up.</p>`;
}
// a distance that may start with a minus sign: -3'-6" is 3½′ the other way
const signedLen = (v) => { v = String(v || '').trim(); if (!v) return 0; const neg = /^[-−]/.test(v); const n = parseLen(v.replace(/^[-−]\s*/, ''), 'ft'); return isFinite(n) ? (neg ? -n : n) : 0; };
const readNudge = () => ({ rot: +$('#ceRot').value, dx: signedLen($('#ceDx').value), dy: signedLen($('#ceDy').value) });
const fmtSigned = (v) => (v < -1e-9 ? '-' : '') + fmt(Math.abs(v));
/* Hook up the arrows, typing and dragging. lines(): the ceiling's current grid lines [[x1,y1,x2,y2]] in plan
   feet (for snapping); onChange(): redraw with the new numbers. */
function bindNudge(onChange, lines) {
  const cv = $('#cePrev'), set = (dx, dy) => { $('#ceDx').value = fmtSigned(dx); $('#ceDy').value = fmtSigned(dy); onChange(); };
  const step = () => +$('#ceStep').value || 1;
  $$('.ce-pad [data-mv]').forEach(b => b.onclick = () => { const [sx, sy] = b.dataset.mv.split(',').map(Number), n = readNudge(); set(n.dx + sx * step(), n.dy + sy * step()); });
  $('#ceRot').onchange = onChange; $('#ceDx').onchange = onChange; $('#ceDy').onchange = onChange;
  $('#ceDx').oninput = onChange; $('#ceDy').oninput = onChange;
  // wall faces running straight up/down (x) and across (y) on the plan
  const A = Plan3DViewer.analyze(ed.plan), faceX = [], faceY = [];
  for (const p of A.pieces) { if (Math.abs(p.x1 - p.x2) < 0.01) faceX.push(p.x1 - p.t / 2, p.x1 + p.t / 2); else if (Math.abs(p.z1 - p.z2) < 0.01) faceY.push(p.z1 - p.t / 2, p.z1 + p.t / 2); }
  const B = A.bounds, pad = 18, scale = () => Math.min((cv.width - pad * 2) / (B.w + 2), (cv.height - pad * 2) / (B.d + 2)) * (cv.getBoundingClientRect().width / cv.width);
  const snapAxis = (want, cur, coords, faces, tol) => {
    // coords are the ceiling's line positions at offset cur; find a shift near want that puts one on a face
    let best = null;
    for (const c of coords) for (const f of faces) { const d = f - c + cur; if (Math.abs(d - want) <= tol && (!best || Math.abs(d - want) < Math.abs(best - want))) best = d; }
    return best;
  };
  const snapTo = (dx, dy) => {
    const n = readNudge(), st = step(), r = (v) => Math.round(v / st) * st;
    let ox = r(dx), oy = r(dy);
    if ($('#ceSnapW').checked) {
      const L = lines(), xs = [], ys = [], tol = Math.max(0.25, 10 / scale());
      for (const q of L) { if (Math.abs(q[0] - q[2]) < 0.02) xs.push(q[0]); if (Math.abs(q[1] - q[3]) < 0.02) ys.push(q[1]); }
      const sx = snapAxis(dx, n.dx, [...new Set(xs.map(v => +v.toFixed(3)))], faceX, tol), sy = snapAxis(dy, n.dy, [...new Set(ys.map(v => +v.toFixed(3)))], faceY, tol);
      if (sx != null) ox = sx; if (sy != null) oy = sy;
    }
    return [ox, oy];
  };
  let drag = null;
  cv.style.cursor = 'grab'; cv.tabIndex = 0;
  cv.onpointerdown = (e) => { const n = readNudge(); drag = { x: e.clientX, y: e.clientY, dx: n.dx, dy: n.dy }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; cv.focus(); };
  cv.onpointermove = (e) => { if (!drag) return; const k = scale(); const [ox, oy] = snapTo(drag.dx + (e.clientX - drag.x) / k, drag.dy + (e.clientY - drag.y) / k); set(ox, oy); };
  cv.onpointerup = cv.onpointercancel = () => { drag = null; cv.style.cursor = 'grab'; };
  cv.onkeydown = (e) => { const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!m) return; e.preventDefault(); const n = readNudge(), st = e.shiftKey ? 4 : step(); set(n.dx + m[0] * st, n.dy + m[1] * st); };
}

function cadCeilingDialog(data) {
  const C = Plan3DCeiling, iu = data.insunits;
  const unitOpts = [[1, 'Inches'], [2, 'Feet'], [4, 'Millimeters'], [5, 'Centimeters'], [6, 'Meters']];
  const defUnit = IMP.UNIT_FT[iu] && iu ? iu : 1;
  const layers = C.gridLayerList(data);
  const refDefault = (layers.find(l => l.wall) || {}).name || '';
  const types = {};
  let groups = [], placed = null;
  dialogOpen({
    wide: true, title: 'Add ceiling: ' + data.name,
    body: `<p>Lights and fan filter units are read from the fixture outlines; the T-grid from the layers you tick. It's centred on your room. Check the preview, then add it.</p>
      <canvas id="cePrev" width="620" height="330" style="width:100%;border-radius:8px;display:block"></canvas>
      <p class="sizeline" id="ceSum"></p>
      ${fld('Drawing units', `<select id="ceU">${unitOpts.map(([v, l]) => `<option value="${v}" ${v === defUnit ? 'selected' : ''}>${l}${v === iu ? ' (from file)' : ''}</option>`).join('')}</select>`)}
      <h4 style="margin:12px 0 6px">Fixtures found</h4><div class="layers" id="ceGroups" style="max-height:170px"></div>
      <h4 style="margin:12px 0 6px">Grid layers</h4><div class="layers" id="ceGrid" style="max-height:130px">${layers.map(l => `<label><input type="checkbox" value="${esc(l.name)}" ${l.grid ? 'checked' : ''}><span>${esc(l.name)}</span><small>${l.count} lines</small></label>`).join('')}</div>
      ${fld('Line up using', `<select id="ceRef"><option value="">The grid and fixtures</option>${layers.map(l => `<option value="${esc(l.name)}" ${l.name === refDefault ? 'selected' : ''}>Layer ${esc(l.name)}${l.wall ? ' (walls)' : ''}</option>`).join('')}</select>`)}
      ${nudgeFields()}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Add to the 3D model', primary: true, value: () => (placed && (placed.grid.length || placed.fixtures.length)) ? 'ok' : (toast('Nothing to add yet. Tick the grid layers or set fixtures to LED / FFU.'), false) }],
    onOpen: (d) => {
      d.classList.add('wide-xl');
      const unitFt = () => IMP.UNIT_FT[+$('#ceU').value] || 1 / 12;
      const drawGroups = () => {
        groups = C.fixtureGroups(data, unitFt());
        $('#ceGroups').innerHTML = groups.length ? groups.slice(0, 40).map((g, i) => `<label style="grid-template-columns:1fr auto auto"><span>${esc(g.name ? g.name + ' · ' : '')}${esc(g.layer)} <small>${g.w}′ × ${g.h}′${g.tag ? ' · “' + esc(g.tag) + '”' : ''}</small></span><small>${g.count}</small>
          <select data-k="${i}"><option value="led" ${(types[g.key] || g.type) === 'led' ? 'selected' : ''}>LED light</option><option value="ffu" ${(types[g.key] || g.type) === 'ffu' ? 'selected' : ''}>Fan filter unit</option><option value="ignore" ${(types[g.key] || g.type) === 'ignore' ? 'selected' : ''}>Not a fixture</option></select></label>`).join('')
          : '<p style="margin:6px">No fixture-sized rectangles or blocks. Check the drawing units.</p>';
        $$('#ceGroups select').forEach(sel => sel.onchange = () => { types[groups[+sel.dataset.k].key] = sel.value; upd(); });
      };
      const upd = () => {
        const n = readNudge();
        placed = C.placeCad(data, ed.plan, { unitFt: unitFt(), gridLayers: new Set($$('#ceGrid input').filter(i => i.checked).map(i => i.value)), types, groups, refLayer: $('#ceRef').value, rot: n.rot, dx: n.dx, dy: n.dy });
        C.drawPreview($('#cePrev'), ed.plan, placed);
        const B = Plan3DViewer.analyze(ed.plan).bounds;
        const nL = placed.fixtures.filter(f => f.type === 'led').length, nF = placed.fixtures.filter(f => f.type === 'ffu').length;
        $('#ceSum').textContent = `${placed.grid.length} grid lines · ${nL} lights · ${nF} FFUs` + (placed.ref ? ` · lined-up outline ${fmt(placed.ref.w)} × ${fmt(placed.ref.h)}, room ${fmt(B.w)} × ${fmt(B.d)}` : '') + (placed.outside ? ` · ${placed.outside} outside the room left off` : '');
      };
      $('#ceU').onchange = () => { drawGroups(); upd(); };
      $('#ceGrid').addEventListener('change', upd); $('#ceRef').onchange = upd;
      bindNudge(upd, () => (placed && placed.grid) || []);
      drawGroups(); upd();
    }
  }).then(ok => {
    $('#dlg').classList.remove('wide-xl');
    if (ok !== 'ok' || !placed) return;
    ed.edit(P => { P.ceilingGrid = placed.grid; P.fixtures = placed.fixtures; P.ceilingMode = 'manual'; delete P.ceilRects; delete P.ceilTiles; P.ceilingSource = data.name; delete P.ceilingImage; });
    ceilingApplied(`Ceiling added: ${placed.fixtures.length} fixtures and ${placed.grid.length} grid lines.`);
  });
}

function imageCeilingDialog(r) {
  const C = Plan3DCeiling, img = new Image();
  let placed = null;
  const upd = () => { const n = readNudge(); placed = { image: C.placeImage(ed.plan, r.dataUrl, n) }; C.drawPreview($('#cePrev'), ed.plan, placed, img); };
  img.onload = () => { if ($('#cePrev')) upd(); };
  img.src = r.dataUrl;
  dialogOpen({
    wide: true, title: 'Add ceiling picture: ' + r.name,
    body: `<p>The picture is stretched over the room's outline. For a good fit, crop it to the room's outside walls first.</p>
      <canvas id="cePrev" width="620" height="330" style="width:100%;border-radius:8px;display:block"></canvas>
      ${nudgeFields()}
      <label class="chk"><input type="checkbox" id="ceHide" checked> Hide the automatic lights and FFUs (the picture shows them)</label>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Add to the 3D model', primary: true, value: () => ({ hide: $('#ceHide').checked }) }],
    onOpen: () => { bindNudge(upd, () => { const I = placed && placed.image; if (!I) return []; const q = (I.rot || 0) % 180 ? [I.h, I.w] : [I.w, I.h]; const x0 = I.x - q[0] / 2, x1 = I.x + q[0] / 2, y0 = I.y - q[1] / 2, y1 = I.y + q[1] / 2; return [[x0, y0, x0, y1], [x1, y0, x1, y1], [x0, y0, x1, y0], [x0, y1, x1, y1]]; }); if (img.complete) upd(); }
  }).then(o => {
    if (!o || !placed) return;
    ed.edit(P => { P.ceilingImage = placed.image; delete P.ceilRects; P.ceilingSource = r.name; delete P.ceilingGrid; if (o.hide) { P.ceilingMode = 'manual'; P.fixtures = []; } });
    ceilingApplied('Ceiling picture added.');
  });
}

function moveCeilingDialog() {
  const C = Plan3DCeiling;
  let img = null;
  const draw = () => {
    const n = readNudge(), Q = clonePlan(); C.shiftCeiling(Q, n.dx, n.dy, n.rot);
    C.drawPreview($('#cePrev'), Q, { grid: Q.ceilingGrid || [], fixtures: (Q.fixtures || []).map(f => ({ w: 1.9, h: 3.9, ...f })), image: Q.ceilingImage }, img);
  };
  if (ed.plan.ceilingImage) { img = new Image(); img.onload = () => { if ($('#cePrev')) draw(); }; img.src = ed.plan.ceilingImage.dataUrl; }
  dialogOpen({
    wide: true, title: 'Move or turn the ceiling',
    body: `<canvas id="cePrev" width="620" height="330" style="width:100%;border-radius:8px;display:block"></canvas>${nudgeFields()}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Apply', primary: true, value: () => readNudge() }],
    onOpen: () => { bindNudge(draw, () => { const n = readNudge(), Q = clonePlan(); C.shiftCeiling(Q, n.dx, n.dy, n.rot); return Q.ceilingGrid || []; }); draw(); }
  }).then(n => {
    if (!n || (!n.dx && !n.dy && !n.rot)) return;
    ed.edit(P => C.shiftCeiling(P, n.dx, n.dy, n.rot));
    toast('Ceiling moved.');
  });
}

/* ---------- The lid / roof deck: a drawing of its outline (one piece, or several to move on their own) ----------
   The drawing's lines are joined into closed outlines; an outline inside another is a hole in it. Each piece is
   placed where it is on the drawing when the project came from a drawing in the same coordinates, otherwise
   lined up on the walls. Pick which pieces to use (a drawing can hold more than one way of doing it). */
function deckPiecesFromDxf(data) {
  // the drawing's lines as a planar graph (split where lines cross or one ends on another, loose ends trimmed
  // off); every closed face of it is a piece. A face inside another one (not touching it) is a hole in it.
  const k = IMP.UNIT_FT[data.insunits] || 1 / 12, tol = 0.5 / 12 / k;
  const S = data.segs.map(q => [q[0], q[1], q[2], q[3]]).filter(q => Math.hypot(q[2] - q[0], q[3] - q[1]) > tol);
  const cuts = S.map(q => [0, 1]);
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    const a = S[i], b = S[j], rx = a[2] - a[0], ry = a[3] - a[1], sx = b[2] - b[0], sy = b[3] - b[1], den = rx * sy - ry * sx;
    const La = Math.hypot(rx, ry), Lb = Math.hypot(sx, sy), ea = tol / La, eb = tol / Lb;
    if (Math.abs(den) < 1e-12) {
      // collinear overlaps: each one's ends on the other
      for (const [P, Q, cq, L] of [[a, b, cuts[i], La], [b, a, cuts[j], Lb]]) for (const [x, y] of [[Q[0], Q[1]], [Q[2], Q[3]]]) { const ux = (P[2] - P[0]) / L, uy = (P[3] - P[1]) / L, t = ((x - P[0]) * ux + (y - P[1]) * uy) / L, d = Math.abs((x - P[0]) * uy - (y - P[1]) * ux); if (d < tol && t > 0 && t < 1) cq.push(t); }
      continue;
    }
    const t = ((b[0] - a[0]) * sy - (b[1] - a[1]) * sx) / den, u = ((b[0] - a[0]) * ry - (b[1] - a[1]) * rx) / den;
    if (t >= -ea && t <= 1 + ea && u >= -eb && u <= 1 + eb) { cuts[i].push(Math.max(0, Math.min(1, t))); cuts[j].push(Math.max(0, Math.min(1, u))); }
  }
  const nodes = [], nodeAt = (x, y) => { for (let n = 0; n < nodes.length; n++) if (Math.abs(nodes[n][0] - x) < tol && Math.abs(nodes[n][1] - y) < tol) return n; nodes.push([x, y]); return nodes.length - 1; };
  const E = new Set();
  S.forEach((q, i) => { const T = [...new Set(cuts[i].map(t => +t.toFixed(9)))].sort((p, r) => p - r); for (let m = 0; m + 1 < T.length; m++) { const a = nodeAt(q[0] + (q[2] - q[0]) * T[m], q[1] + (q[3] - q[1]) * T[m]), b = nodeAt(q[0] + (q[2] - q[0]) * T[m + 1], q[1] + (q[3] - q[1]) * T[m + 1]); if (a !== b) E.add(Math.min(a, b) + ',' + Math.max(a, b)); } });
  const adj = new Map(); const addE = (a, b) => { (adj.get(a) || adj.set(a, new Set()).get(a)).add(b); };
  for (const e of E) { const [a, b] = e.split(',').map(Number); addE(a, b); addE(b, a); }
  // trim loose ends
  let changed = true; while (changed) { changed = false; for (const [n, L] of adj) if (L.size < 2) { for (const m of L) adj.get(m).delete(n); adj.delete(n); changed = true; } }
  const ang = (a, b) => Math.atan2(nodes[b][1] - nodes[a][1], nodes[b][0] - nodes[a][0]);
  const order = new Map(); for (const [n, L] of adj) order.set(n, [...L].sort((p, q) => ang(n, p) - ang(n, q)));
  const seen = new Set(), faces = [];
  for (const [a, L] of adj) for (const b of L) {
    if (seen.has(a + '>' + b)) continue;
    const cyc = []; let u = a, v = b, guard = 0;
    while (!seen.has(u + '>' + v) && guard++ < 10000) { seen.add(u + '>' + v); cyc.push(u); const O = order.get(v), i = O.indexOf(u); const w = O[(i - 1 + O.length) % O.length]; u = v; v = w; }
    if (cyc.length >= 3) faces.push(cyc.map(n => nodes[n]));
  }
  const sarea = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
  const inside = (pt, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
  const tidy = (P) => P.filter((p, i) => { const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length]; return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > tol * tol * 4; });
  // faces turning one way are the pieces; the other way round are the outside of a separate outline (its hole
  // in whatever face holds it, if any)
  const pos = faces.filter(F => sarea(F) > 0).map(F => ({ outer: tidy(F), raw: F, holes: [], a: sarea(F) })).filter(p => p.outer.length >= 3 && p.a > tol * tol * 100);
  const neg = faces.filter(F => sarea(F) < 0).map(F => tidy(F));
  for (const N of neg) {
    const pt = N[0], host = pos.filter(p => p.outer !== N && inside([pt[0] + tol, pt[1] + tol], p.outer) && Math.abs(sarea(N)) < p.a).sort((p, q) => p.a - q.a)[0];
    if (host && !N.every(q => host.outer.some(r => Math.abs(r[0] - q[0]) < tol && Math.abs(r[1] - q[1]) < tol))) { host.holes.push(N.slice().reverse()); host.a -= Math.abs(sarea(N)); }
  }
  return { pieces: pos.sort((p, q) => (p.outer[0][0] - q.outer[0][0])), k };
}
// pieces that share an edge, joined into one: their outlines' edges, with the shared ones (run both ways)
// cancelled out, chained back into loops; the loop going round the right way is the outline, any others holes
function joinDeckPieces(L) {
  const key = (q) => q[0].toFixed(5) + ',' + q[1].toFixed(5), sarea = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
  const edgesOf = (p) => { const out = [], add = (R) => R.forEach((q, i) => out.push([q, R[(i + 1) % R.length]])); add(p.raw || p.outer); (p.holes || []).forEach(add); return out; };
  // which pieces share an edge
  const par = L.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
  const E = L.map(p => new Set(edgesOf(p).map(([a, b]) => key(a) + '>' + key(b))));
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) for (const e of E[j]) { const [a, b] = e.split('>'); if (E[i].has(b + '>' + a)) { par[find(i)] = find(j); break; } }
  const groups = new Map(); L.forEach((p, i) => { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(p); });
  const out = [];
  for (const G of groups.values()) {
    if (G.length === 1) { out.push(G[0]); continue; }
    const all = [].concat(...G.map(edgesOf)), pts = new Map(), es = new Map();
    for (const [a, b] of all) { pts.set(key(a), a); pts.set(key(b), b); const f = key(a) + '>' + key(b), r = key(b) + '>' + key(a); if (es.has(r)) es.delete(r); else es.set(f, [key(a), key(b)]); }
    const from = new Map(); for (const [, [a, b]] of es) (from.get(a) || from.set(a, []).get(a)).push(b);
    const loops = [];
    for (const [a] of from) while ((from.get(a) || []).length) { const loop = [a]; let cur = from.get(a).pop(), g = 0; while (cur !== a && g++ < 10000) { loop.push(cur); const nx = from.get(cur); if (!nx || !nx.length) break; cur = nx.pop(); } loops.push(loop.map(k => pts.get(k))); }
    const tidy = (P) => P.filter((p, i) => { const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length]; return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-6; });
    // (the drawing's y runs up, the plan's down, so which way round the outline goes isn't fixed: the biggest loop is it)
    const outer = loops.slice().sort((p, q) => Math.abs(sarea(q)) - Math.abs(sarea(p)))[0];
    if (!outer) { out.push(...G); continue; }
    out.push({ outer: tidy(outer), raw: outer, holes: loops.filter(P => P !== outer).map(tidy), a: G.reduce((t, p) => t + p.a, 0) });
  }
  return out;
}
function stepPanelTool() {
  if (view === '3d' || view === 'build') setView('split');
  ed.setTool('lstep');
  const n = (ed.autoSteps || []).length;
  ed.status((n ? `Step panels: the dotted blue lines are the ${n} step${n === 1 ? '' : 's'} already filled automatically. ` : 'Step panels: ') + 'Click one end and then the other to add a run of wall panels (ends catch on wall ends and lid corners). Esc when done.');
}
async function lidMenu() {
  const P = ed.plan, D = P.deckPieces || [];
  if (!D.length) { importDeck(); return; }
  const An = Plan3DViewer.analyze(P), steps = Plan3DViewer.deckSteps(P, An, An.WH), auto = steps.filter(q => q.auto), stepFt = steps.reduce((t, q) => t + q.len, 0);
  const a = await dialogOpen({ title: 'Lid', body: `<p>The lid over the cleanroom is ${D.length} piece${D.length === 1 ? '' : 's'} from <b>${esc(P.deckSource || 'a deck drawing')}</b>. On the plan each piece is a dashed violet outline: drag it by its outline or its LID label (its corners catch on wall ends), R turns it, Delete removes it.</p>
    <p>Where the lid steps up and no wall reaches the higher part, <b>wall panels</b> close the step (H-mold at each 4′ joint): ${auto.length ? `${auto.length} run${auto.length === 1 ? '' : 's'} found automatically` : P.lidStepsAuto === false ? 'automatic ones are off' : 'none needed automatically'}${(P.lidSteps || []).length ? `, ${(P.lidSteps || []).length} drawn by hand` : ''}${stepFt ? `, ${Math.ceil(stepFt)} ft in all` : ''}. Use <b>Draw step panels</b> to add runs yourself, like drawing walls: click one end, then the other; the panels fill from the lower lid up to the higher one along the run.</p><p class="note">In 3D the <b>Lid</b> button turns the lid on in every view, Dollhouse too, or back off.</p>
    <label class="chk"><input type="checkbox" id="lidAuto" ${P.lidStepsAuto !== false ? 'checked' : ''}> Put step panels in automatically where the lid steps up</label>`,
    buttons: [{ label: 'Remove the lid drawing', danger: true, ret: 'remove' }, { label: 'Use another drawing', ret: 'new' }, { label: 'Draw step panels', ret: 'step' }, { label: 'OK', primary: true, ret: null }],
    onOpen: () => { $('#lidAuto').onchange = (e) => { ed.edit(Q => { if (e.target.checked) delete Q.lidStepsAuto; else Q.lidStepsAuto = false; }); queue3D(); }; } });
  if (a === 'remove') { ed.edit(Q => { delete Q.deckPieces; delete Q.deckSource; delete Q.lidSteps; }); toast('Lid drawing removed. The cleanroom gets its own lid over the plenum again.'); queue3D(); }
  if (a === 'new') importDeck();
  if (a === 'step') stepPanelTool();
}
async function importDeck() {
  const r = await api.openFile('ceiling'); if (!r) return;
  if (r.kind === 'error') { handleLoaded(r); return; }
  if (r.kind !== 'dxf') { toast('Pick the deck drawing as a DWG or DXF.'); return; }
  const { pieces, k } = deckPiecesFromDxf(r);
  if (!pieces.length) { await dialogOpen({ title: 'No outline found', body: '<p>No closed outlines in that drawing. Draw the lid as closed shapes (lines that meet end to end, or closed polylines) and save it again.</p>', buttons: [{ label: 'OK', primary: true, ret: null }] }); return; }
  const P = ed.plan, O = P.dxfOrigin;
  // drawing units to the plan's feet: the project's own drawing origin when it has one
  let tf = (x, y) => [x * k, -y * k], how = 'where it is on the drawing';
  if (O) tf = (x, y) => [x * k - O.x0, O.y0 - y * k];
  let placed = pieces.map(p => ({ outer: p.outer.map(q => tf(q[0], q[1])), raw: p.raw.map(q => tf(q[0], q[1])), holes: p.holes.map(h => h.map(q => tf(q[0], q[1]))), a: p.a * k * k }));
  // A deck drawing often shows the lid more than one way (one piece, or the same lid cut in pieces and drawn
  // apart), each away from where it goes. Pieces drawn touching are one item (joined); each item lines up on
  // the walls by itself, so every option lands over the building.
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; P.walls.forEach(w => { bx0 = Math.min(bx0, w.x1, w.x2); bx1 = Math.max(bx1, w.x1, w.x2); by0 = Math.min(by0, w.y1, w.y2); by1 = Math.max(by1, w.y1, w.y2); });
  const boxOf = (p) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; p.outer.forEach(q => { a = Math.min(a, q[0]); c = Math.max(c, q[0]); b = Math.min(b, q[1]); d = Math.max(d, q[1]); }); return [a, b, c, d]; };
  const par = placed.map((_, i) => i), find = (i) => par[i] === i ? i : (par[i] = find(par[i]));
  const bxs = placed.map(boxOf);
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) { const A = bxs[i], B = bxs[j]; if (A[0] <= B[2] + 0.05 && B[0] <= A[2] + 0.05 && A[1] <= B[3] + 0.05 && B[1] <= A[3] + 0.05) par[find(i)] = find(j); }
  const groups = new Map(); placed.forEach((p, i) => (groups.get(find(i)) || groups.set(find(i), []).get(find(i))).push(p));
  let lined = 0;
  placed = [];
  for (const G of groups.values()) {
    let items = G.length > 1 ? joinDeckPieces(G) : G;
    if (P.walls.length) {
      // the outline cut into short bits, so every stretch of it counts in how well it sits on the walls
      const lines = [];
      items.forEach(p => p.outer.forEach((q, i) => { const b = p.outer[(i + 1) % p.outer.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - q[0], b[1] - q[1]) / 2)); for (let j = 0; j < n; j++) lines.push([q[0] + (b[0] - q[0]) * j / n, q[1] + (b[1] - q[1]) * j / n, q[0] + (b[0] - q[0]) * (j + 1) / n, q[1] + (b[1] - q[1]) * (j + 1) / n]); }));
      // a lid piece sits against the building's outside walls: favour places where two or more of its sides do
      const edge = (x0, y0, x1, y1) => 0.05 * [x0 - bx0, y0 - by0, x1 - bx1, y1 - by1].reduce((t, d) => t + Math.max(0, 1 - Math.abs(d)), 0);
      const al = IMP.alignToWalls(lines, P.walls, edge);
      if (al && al.score >= 0.25) { const mv = (q) => [q[0] + al.dx, q[1] + al.dy]; items = items.map(p => ({ ...p, outer: p.outer.map(mv), raw: (p.raw || p.outer).map(mv), holes: p.holes.map(h => h.map(mv)) })); lined++; }
    }
    placed.push(...items);
  }
  placed.sort((p, q) => boxOf(p)[0] - boxOf(q)[0]);
  if (lined) how = lined === groups.size ? 'each lined up on the walls' : 'lined up on the walls where they fit';
  else if (!O) how = 'where it is on the drawing (move it into place)';
  // which pieces sit on the plan: picked to start with
  const onPlan = (p) => { const c = p.outer.reduce((t, q) => [t[0] + q[0] / p.outer.length, t[1] + q[1] / p.outer.length], [0, 0]); return c[0] > bx0 - 2 && c[0] < bx1 + 2 && c[1] > by0 - 2 && c[1] < by1 + 2; };
  const thumb = (p) => { let [a, b, c, d] = boxOf(p); if (P.walls.length) { a = Math.min(a, bx0); b = Math.min(b, by0); c = Math.max(c, bx1); d = Math.max(d, by1); } const pad = Math.max(c - a, d - b) * 0.06, sw = (Math.max(c - a, d - b) / 90).toFixed(3); const path = (R) => 'M' + R.map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L') + 'Z'; const wl = P.walls.map(w => `M${w.x1.toFixed(2)} ${w.y1.toFixed(2)}L${w.x2.toFixed(2)} ${w.y2.toFixed(2)}`).join(''); return `<svg viewBox="${(a - pad).toFixed(2)} ${(b - pad).toFixed(2)} ${(c - a + 2 * pad).toFixed(2)} ${(d - b + 2 * pad).toFixed(2)}" style="width:150px;height:96px;background:#1b2023;border-radius:6px"><path d="${wl}" stroke="#5d6a70" stroke-width="${sw}" fill="none"/><path d="${path(p.outer)}${p.holes.map(path).join('')}" fill="rgba(190,150,255,.3)" fill-rule="evenodd" stroke="#c9a6ff" stroke-width="${(sw * 1.6).toFixed(3)}"/></svg>`; };
  // pieces that land on top of each other are different ways of doing the same lid: start with the biggest one ticked
  const big = placed.reduce((m, p, i) => (p.a > placed[m].a ? i : m), 0);
  const pick = await dialogOpen({ wide: true, title: 'Lid from ' + r.name, body: `<p>${placed.length} piece${placed.length === 1 ? '' : 's'} in the drawing, placed ${how}. Tick the pieces to use; each one comes in as its own piece you can drag, turn (R) and delete on the plan.${placed.length > 1 ? ' When the drawing shows the lid more than one way (one piece, or the same lid in several pieces), tick the pieces for the way you want: the one big piece, or the smaller pieces together.' : ''}</p>
    <label class="chk"><input type="checkbox" id="dkJoin"> Join ticked pieces that touch into one piece (one solid lid). Leave it off to move each piece on its own.</label>
    <div class="row" style="gap:10px;flex-wrap:wrap">${placed.map((p, i) => `<label class="chk" style="display:flex;flex-direction:column;align-items:center;gap:4px">${thumb(p)}<span><input type="checkbox" data-dk="${i}" ${(placed.length === 1 || i === big) ? 'checked' : ''}> Piece ${i + 1} · ${Math.round(p.a)} sq ft${onPlan(p) ? '' : ' · off the plan'}</span></label>`).join('')}</div>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Use the ticked pieces', primary: true, value: () => ({ pick: $$('[data-dk]').filter(c => c.checked).map(c => +c.dataset.dk), join: $('#dkJoin').checked }) }] });
  if (!pick || !pick.pick.length) return;
  let out = pick.join ? joinDeckPieces(pick.pick.map(i => placed[i])) : pick.pick.map(i => placed[i]);
  // pieces of one lid that nearly meet (each lined up on the walls on its own, a few inches out) are butted
  // together: the smaller one moves to meet the bigger one, so there's no gap or overlap at the joint
  out = out.map(p => ({ ...p }));
  const bb = (p) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; p.outer.forEach(q => { a = Math.min(a, q[0]); c = Math.max(c, q[0]); b = Math.min(b, q[1]); d = Math.max(d, q[1]); }); return [a, b, c, d]; };
  const mv = (p, dx, dy) => { const f = (q) => [q[0] + dx, q[1] + dy]; p.outer = p.outer.map(f); if (p.raw) p.raw = p.raw.map(f); p.holes = p.holes.map(h => h.map(f)); };
  const bySize = out.slice().sort((p, q) => q.a - p.a);
  for (let i = 1; i < bySize.length; i++) for (let j = 0; j < i; j++) {
    const S = bySize[i], B = bySize[j], s = bb(S), b = bb(B), ovY = Math.min(s[3], b[3]) - Math.max(s[1], b[1]), ovX = Math.min(s[2], b[2]) - Math.max(s[0], b[0]);
    if (ovY > 1) { if (Math.abs(s[0] - b[2]) < 0.6) mv(S, b[2] - s[0], 0); else if (Math.abs(s[2] - b[0]) < 0.6) mv(S, b[0] - s[2], 0); }
    else if (ovX > 1) { if (Math.abs(s[1] - b[3]) < 0.6) mv(S, 0, b[3] - s[1]); else if (Math.abs(s[3] - b[1]) < 0.6) mv(S, 0, b[1] - s[3]); }
  }
  ed.edit(Q => { Q.deckPieces = out.map(p => ({ id: Plan3DEditor.uid(), outer: p.outer, holes: p.holes })); Q.deckSource = r.name; });
  const off = out.filter(p => !onPlan(p)).length;
  if (view === '3d' || view === 'build') setView('split');
  ed.fit(); updateChrome(); queue3D();
  toast(`Lid placed: ${out.length} piece${out.length === 1 ? '' : 's'}.${off ? ` ${off} ${off === 1 ? 'is' : 'are'} off the plan: drag ${off === 1 ? 'it' : 'each'} by its outline or LID label onto the walls (corners catch on wall ends).` : ''} In 3D, the Lid button shows it in every view.`);
}

/* ---------- Revit / IFC ---------- */
async function exportIfc(withCeiling) {
  if (!ed.plan.walls.length) { toast('Add some walls first.'); return; }
  let ifc;
  try { ifc = Plan3DIfc.toIfc(clonePlan(), { ceiling: withCeiling !== false }); }
  catch (e) { toast('Couldn’t make the IFC: ' + e.message); return; }
  const p = await api.exportFile(ifc, ed.plan.name, 'ifc');
  if (p) {
    dialogOpen({
      title: 'Revit 3D model saved',
      body: `<p>To make it a Revit .rvt file:</p><ol class="help"><li>In Revit: <b>File → Open → IFC</b> and pick this file.</li><li><b>File → Save As → Project</b>. That's your .rvt.</li></ol><p>To add the cleanroom to an existing building model instead, use <b>Insert → Link IFC</b>.</p>`,
      buttons: [{ label: 'Show in folder', ret: 'show' }, { label: 'OK', primary: true, ret: null }]
    }).then(a => { if (a === 'show') api.showInFolder(p); });
  }
}

function revitHelp(name) {
  dialogOpen({
    wide: true, title: 'Revit files need one export step',
    body: `<p>${esc(name ? name + ' is a Revit file. ' : '')}Revit's own .rvt format can only be opened by Autodesk software, so Coll Plan3D reads the open <b>IFC</b> format Revit exports.</p>
      <ol class="help"><li>Open the model in Revit.</li><li><b>File → Export → IFC</b>. The standard settings are fine (IFC4 or IFC 2x3).</li><li>Import the .ifc here. Walls, doors, windows, rooms, ceiling height, lights and FFUs come across and can be edited.</li></ol>
      <p>For a single floor plan you can also use <b>File → Export → CAD Formats → DWG</b> on a plan view and import the DWG.</p>
      <p>Going back to Revit: <b>Save DWG / IFC</b> → Revit 3D model, then in Revit <b>File → Open → IFC</b> and <b>Save As → Project</b> for an .rvt.</p>`,
    buttons: [{ label: 'OK', primary: true, ret: null }]
  });
}

function ifcDialog(data) {
  const X = Plan3DIfc;
  const saved = X.embeddedPlan(data);
  const levels = (data.storeys || []).filter(s => s.walls > 0);
  if (!levels.length && !saved) {
    dialogOpen({ title: 'No walls found', body: `<p>${esc(data.name)} has no walls Coll Plan3D can read. Check that the IFC export included walls, doors and windows (Revit: File → Export → IFC, default settings).</p>`, buttons: [{ label: 'OK', primary: true, ret: null }] });
    return;
  }
  const best = levels.slice().sort((a, b) => b.walls - a.walls)[0];
  let res = null;
  dialogOpen({
    wide: true, title: 'Import ' + data.name,
    body: `${saved ? '<p><b>This file was saved by Coll Plan3D.</b> Open the saved project to get everything back exactly, or import it like any Revit model.</p>' : '<p>Pick the level with the cleanroom. Walls, doors, windows and rooms become an editable plan.</p>'}
      <canvas id="ifPrev" width="620" height="300" style="width:100%;border-radius:8px;display:block"></canvas>
      <p class="sizeline" id="ifSum"></p>
      ${levels.length ? fld('Level', `<select id="ifLv">${levels.map(l => `<option value="${l.id}" ${l === best ? 'selected' : ''}>${esc(l.name)} · ${l.walls} walls, ${l.doors} doors</option>`).join('')}</select>`) : ''}
      <label class="chk"><input type="checkbox" id="ifDoors" checked> Doors</label>
      <label class="chk"><input type="checkbox" id="ifGlass" checked> Windows as vision glass</label>
      <label class="chk"><input type="checkbox" id="ifRooms" checked> Room names</label>`,
    buttons: saved
      ? [{ label: 'Cancel', ret: null }, { label: 'Import as a model', ret: 'model' }, { label: 'Open the saved project', primary: true, ret: 'saved' }]
      : [{ label: 'Cancel', ret: null }, { label: 'Import', primary: true, ret: 'model' }],
    onOpen: () => {
      const upd = () => {
        if (!levels.length) { $('#ifSum').textContent = ''; return; }
        res = X.planFromIfc(data, { level: +$('#ifLv').value, doors: $('#ifDoors').checked, glass: $('#ifGlass').checked, rooms: $('#ifRooms').checked });
        const c = res.counts, B = Plan3DViewer.analyze(res.plan).bounds;
        Plan3DCeiling.drawPreview($('#ifPrev'), res.plan, { grid: [], fixtures: (res.plan.fixtures || []).map(f => ({ w: 1.9, h: 3.9, ...f })) });
        $('#ifSum').textContent = `${c.walls} walls · ${c.doors} doors · ${c.glass} windows · ${c.rooms} rooms` + (c.fixtures ? ` · ${c.fixtures} lights / FFUs` : '') + ` · ${fmt(B.w)} × ${fmt(B.d)} · ${fmt(res.plan.ceiling)} ceiling`;
      };
      if (levels.length) { $('#ifLv').onchange = upd; ['#ifDoors', '#ifGlass', '#ifRooms'].forEach(k => $(k).onchange = upd); }
      upd();
    }
  }).then(a => {
    if (!a) return;
    let p;
    if (a === 'saved') p = saved;
    else { if (!res) return; p = res.plan; }
    if (!p.name) p.name = data.name;
    if (adoptImported(p)) return;
    projectPath = null; ed.setPlan(p); ed.dirty = true; hideBanner(); updateChrome();
    if (view === '2d') setView('split'); else if (viewer) viewer.loadPlan(clonePlan());
    toast(a === 'saved' ? 'Opened ' + p.name + ' from the IFC.' : `Imported ${p.walls.length} walls and ${p.openings.length} doors and windows from ${data.name}. Edit anything, then Save.`);
  });
}

/* ---------- Fan filter unit model (manufacturer data, Revit families) ---------- */
let equipLib = [];
if (api.equipLib) api.equipLib().then(l => { equipLib = Array.isArray(l) ? l : []; if (!ed.sel) renderProps(); });
const allFfuModels = () => [...Plan3DEquipment.BUILT_IN, ...equipLib.filter(m => m.kind !== 'light' && !Plan3DEquipment.BUILT_IN.some(b => b.id === m.id))];
const allLightModels = () => [...Plan3DEquipment.LIGHTS, ...equipLib.filter(m => m.kind === 'light' && !Plan3DEquipment.LIGHTS.some(b => b.id === m.id))];
function ffuPanelHtml(P) {
  const cur = P.ffuModel, models = allFfuModels(), m = cur && models.find(x => x.id === cur.id);
  const n = Plan3DViewer.ceilingFixtures(P).filter(f => f.type === 'ffu').length;
  let h = `<div class="grp"><h3>Fan filter units</h3>
    ${fld('Model', `<select id="pFfuM"><option value="">Generic 2×4 (flat)</option>${models.map(x => `<option value="${esc(x.id)}" ${cur && cur.id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}${cur && !m ? `<option value="${esc(cur.id)}" selected>${esc(cur.name)}</option>` : ''}<option value="+rfa">Add from Revit family (.rfa)…</option></select>`)}`;
  if (cur) {
    const src = m || { finishes: [{ key: cur.finish, label: cur.finishLabel }], fits: [{ key: cur.fit, label: cur.fitLabel }] };
    h += fld('Finish', `<select id="pFfuF">${src.finishes.map(f => `<option value="${f.key}" ${f.key === cur.finish ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select>`);
    if (src.fits.length > 1) h += fld('Fits grid', `<select id="pFfuG">${src.fits.map(f => `<option value="${f.key}" ${f.key === cur.fit ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select>`);
    const s4 = cur.sizes.find(z => z.nominal === '2x4') || cur.sizes[0];
    h += `<p class="note">${n} FFU${n === 1 ? '' : 's'} on this plan. ${s4 ? `2×4: ${(s4.w * 12).toFixed(2)}″ × ${(s4.d * 12).toFixed(2)}″, ${(s4.overall * 12).toFixed(2)}″ tall above the grid${s4.cfm ? ', ' + s4.cfm + ' CFM' : ''}${s4.lb ? ', ' + s4.lb + ' lb' : ''}.` : ''} Dollhouse view shows the units above the ceiling.</p>`;
  } else h += `<p class="note">Pick a manufacturer model to see each FFU as the real unit in 3D and on the parts list.</p>`;
  return h + '</div>';
}
function lightPanelHtml(P) {
  const cur = P.lightModel, models = allLightModels(), m = cur && models.find(x => x.id === cur.id);
  const n = Plan3DViewer.ceilingFixtures(P).filter(f => f.type !== 'ffu').length;
  let h = `<div class="grp"><h3>Lights</h3>
    ${fld('Model', `<select id="pLtM"><option value="">Generic LED flat panel</option>${models.map(x => `<option value="${esc(x.id)}" ${cur && cur.id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}${cur && !m ? `<option value="${esc(cur.id)}" selected>${esc(cur.name)}</option>` : ''}<option value="+rfa">Add from Revit family (.rfa)…</option></select>`)}`;
  if (cur) {
    const fins = (m && m.finishes) || [{ key: cur.finish, label: cur.finishLabel }];
    h += fld('Finish', `<select id="pLtF">${fins.map(f => `<option value="${f.key}" ${f.key === cur.finish ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select>`);
    h += `<p class="note">${n} light${n === 1 ? '' : 's'} on this plan, each in its own ceiling cell, ${Math.round(cur.hh * 12 * 10) / 10}″ housing above the grid. Shown in 3D, on the parts list and in the Revit export.</p>`;
  } else h += `<p class="note">Pick a light model to show every light as that fixture in 3D, on the parts list and in the Revit export. Place lights with the LED piece (key 8), like FFUs.</p>`;
  return h + '</div>';
}
function bindLightPanel(P) {
  const sel = $('#pLtM'); if (!sel) return;
  sel.onchange = async () => {
    const v = sel.value;
    if (v === '+rfa') { await addRevitFamily('light'); renderProps(); return; }
    if (!v) { ed.edit(Q => { delete Q.lightModel; }); return; }
    const m = allLightModels().find(x => x.id === v); if (!m) return;
    ed.edit(Q => { Q.lightModel = Plan3DEquipment.lightSpec(m, Q.lightModel && Q.lightModel.finish); });
  };
  if ($('#pLtF')) $('#pLtF').onchange = (e) => { const m = allLightModels().find(x => x.id === P.lightModel.id) || P.lightModel; ed.edit(Q => { Q.lightModel = Plan3DEquipment.lightSpec(m.finishes ? m : { ...m, finishes: [{ key: e.target.value, label: e.target.selectedOptions[0].textContent }] }, e.target.value); }); };
}
function bindFfuPanel(P) {
  const sel = $('#pFfuM'); if (!sel) return;
  sel.onchange = async () => {
    const v = sel.value;
    if (v === '+rfa') { await addRevitFamily(); renderProps(); return; }
    if (!v) { ed.edit(Q => { delete Q.ffuModel; }); return; }
    const m = allFfuModels().find(x => x.id === v); if (!m) return;
    ed.edit(Q => { Q.ffuModel = Plan3DEquipment.planSpec(m, (Q.ffuModel && Q.ffuModel.fit) || null, (Q.ffuModel && Q.ffuModel.finish) || null); });
  };
  const re = (fit, finish) => { const m = allFfuModels().find(x => x.id === P.ffuModel.id); if (!m) return; ed.edit(Q => { Q.ffuModel = Plan3DEquipment.planSpec(m, fit, finish); }); };
  if ($('#pFfuF')) $('#pFfuF').onchange = (e) => re(P.ffuModel.fit, e.target.value);
  if ($('#pFfuG')) $('#pFfuG').onchange = (e) => re(e.target.value, P.ffuModel.finish);
}
async function addRevitFamily(kind) {
  if (!api.readRfa) return;
  const r = await api.readRfa(); if (!r) return;
  if (kind === 'light' && !r.error) {
    let m;
    try { m = Plan3DEquipment.readLightFamily(r.xml, r.name); }
    catch (e) { dialogOpen({ title: 'Can’t use that family', body: `<p>${esc(e.message)}</p><p>Coll Plan3D reads a light family's sizes (width, depth, height) from its type table.</p>`, buttons: [{ label: 'OK', primary: true, ret: null }] }); return; }
    equipLib = equipLib.filter(x => x.id !== m.id).concat([m]);
    if (api.equipLibSave) await api.equipLibSave(equipLib);
    ed.edit(Q => { Q.lightModel = Plan3DEquipment.lightSpec(m); });
    toast(`Added ${m.name}. It's saved for your other projects too.`); return;
  }
  if (r.error) { dialogOpen({ title: 'Can’t use that family', body: `<p>${esc(r.error)}</p>`, buttons: [{ label: 'OK', primary: true, ret: null }] }); return; }
  let m;
  try { m = Plan3DEquipment.readRevitFamily(r.xml, r.name); }
  catch (e) { dialogOpen({ title: 'Can’t use that family', body: `<p>${esc(e.message)}</p><p>Coll Plan3D reads a family's sizes (width, depth, height, housing) from its type table. Fan filter unit families from Envirco, Price, Terra and others usually have them.</p>`, buttons: [{ label: 'OK', primary: true, ret: null }] }); return; }
  const sizes = m.fits.reduce((a, f) => a + f.sizes.length, 0);
  equipLib = equipLib.filter(x => x.id !== m.id).concat([m]);
  if (api.equipLibSave) await api.equipLibSave(equipLib);
  ed.edit(Q => { Q.ffuModel = Plan3DEquipment.planSpec(m); });
  toast(`Added ${m.name}: ${sizes} size${sizes === 1 ? '' : 's'}, ${m.finishes.length} finish${m.finishes.length === 1 ? '' : 'es'}. It's saved for your other projects too.`);
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
    // a close left over from the dialog before (one dialog opening right after another closes) arrives after
    // this one is up: ignore it while this one is still open
    d.onclose = () => { if (!d.open) resolve(undefined); };
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
/* The rest of the sheet: a ceiling grid, FFU / light layouts and steel beams drawn off to the side. The grid
   is slid onto the walls where its ends land on walls best (inside the building, if there's one); beams are
   centred on the same spot; FFU layouts can't be matched to a room, so each comes in as a group just below
   the cleanroom, ready to drag into its room (they land in the grid's cells). */
function sheetExtrasToPlan(data, o, walls, bld, p) {
  const ex = IMP.sheetExtras(data, o), F = IMP.dxfFrame(data, o), k = o.unitFt, said = [];
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; walls.forEach(w => { if (bld && bld.has && bld.has(w.id)) { bx0 = Math.min(bx0, w.x1, w.x2); bx1 = Math.max(bx1, w.x1, w.x2); by0 = Math.min(by0, w.y1, w.y2); by1 = Math.max(by1, w.y1, w.y2); } });
  const inBld = bx0 < bx1 ? (a, b, c, d) => a >= bx0 - 1 && c <= bx1 + 1 && b >= by0 - 1 && d <= by1 + 1 : null;
  let target = null, dx = 0, dy = 0;
  const g = (p.ceilingGrid || []).length ? null : ex.grids[0];
  if (g) {
    const al = IMP.alignToWalls(g.lines, walls, inBld);
    if (al.score >= 0.35) { dx = al.dx; dy = al.dy; target = { x0: g.box.x0 + dx, y0: g.box.y0 + dy, x1: g.box.x1 + dx, y1: g.box.y1 + dy }; }
    p.ceilingGrid = g.lines.map(q => [q[0] + dx, q[1] + dy, q[2] + dx, q[3] + dy]); delete p.ceilTiles;
    p.ceilingMode = 'manual'; delete p.ceilRects; p.ceilingSource = data.name; p.fixtures = p.fixtures || [];
    said.push(target ? 'The ceiling grid is laid on the cleanroom' : 'The ceiling grid couldn\'t be matched to the walls; use Edit ceiling → Move or turn to line it up');
  }
  if (ex.beams.length) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; ex.beams.forEach(b => { x0 = Math.min(x0, b.x1, b.x2); x1 = Math.max(x1, b.x1, b.x2); y0 = Math.min(y0, b.y1, b.y2); y1 = Math.max(y1, b.y1, b.y2); });
    let mx = 0, my = 0;
    const fits = target && Math.abs((x1 - x0) - (target.x1 - target.x0)) < Math.max(6, 0.15 * (target.x1 - target.x0)) && Math.abs((y1 - y0) - (target.y1 - target.y0)) < Math.max(6, 0.15 * (target.y1 - target.y0));
    if (fits) { mx = (target.x0 + target.x1) / 2 - (x0 + x1) / 2; my = (target.y0 + target.y1) / 2 - (y0 + y1) / 2; }
    else { const al = IMP.alignToWalls(ex.beams.map(b => [b.x1, b.y1, b.x2, b.y2]), walls, inBld); if (al.score >= 0.5) { mx = al.dx; my = al.dy; } }
    const q = (v) => Math.round(v * 48) / 48;
    p.beams = (p.beams || []).concat(ex.beams.map(b => ({ id: Plan3DEditor.uid(), x1: q(b.x1 + mx), y1: q(b.y1 + my), x2: q(b.x2 + mx), y2: q(b.y2 + my), size: 'W12x26' })));
    said.push(`${ex.beams.length} steel beam${ex.beams.length > 1 ? 's' : ''} ${fits || mx || my ? 'over the cleanroom' : 'where they are on the sheet'} (W12×26; pick one to change the size or height)`);
  }
  // FFUs and lights
  const C = window.Plan3DCeiling;
  if (C) {
    const groups = C.fixtureGroups(data, k).filter(gr => gr.type !== 'ignore' && !o.layers.has(gr.layer));
    const fx = [];
    for (const gr of groups) for (const r of gr.items) { const [x, y] = F.P(r.cx, r.cy); if (fx.some(f => Math.abs(f.x - x) < 0.3 && Math.abs(f.y - y) < 0.3)) continue; fx.push({ type: gr.type, x, y, w: r.w * k, h: r.h * k }); }
    if (fx.length) {
      // layouts: fixtures within 6′ of each other
      const par = fx.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
      for (let i = 0; i < fx.length; i++) for (let j = i + 1; j < fx.length; j++) if (Math.abs(fx[i].x - fx[j].x) < (fx[i].w + fx[j].w) / 2 + 6 && Math.abs(fx[i].y - fx[j].y) < (fx[i].h + fx[j].h) / 2 + 6) par[find(i)] = find(j);
      const lay = new Map(); fx.forEach((f, i) => { const r = find(i); (lay.get(r) || lay.set(r, []).get(r)).push(f); });
      const L = [...lay.values()];
      // drawn over the cleanroom already (on a ceiling drawing laid on the plan)? keep them; otherwise line the layouts up below it
      const over = (f) => target && f.x > target.x0 && f.x < target.x1 && f.y > target.y0 && f.y < target.y1;
      // below the cleanroom, and outside the building if the cleanroom is in one
      const inside = target && bx0 < bx1 && target.x0 >= bx0 - 1 && target.x1 <= bx1 + 1 && target.y0 >= by0 - 1 && target.y1 <= by1 + 1;
      let cx = target ? target.x0 : null; const cy = target ? (inside ? by1 : target.y1) + 4 : null;
      if (p.ceilingMode !== 'manual') { p.fixtures = []; p.ceilingMode = 'manual'; }
      for (const lay1 of L) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9; lay1.forEach(f => { x0 = Math.min(x0, f.x - f.w / 2); x1 = Math.max(x1, f.x + f.w / 2); y0 = Math.min(y0, f.y - f.h / 2); });
        let mx = 0, my = 0;
        if (target && !lay1.every(over)) { mx = cx - x0; my = cy - y0; cx += (x1 - x0) + 4; }
        const gid = Plan3DEditor.uid();
        for (const f of lay1) p.fixtures.push({ id: Plan3DEditor.uid(), type: f.type, x: f.x + mx, y: f.y + my, w: f.w, h: f.h, gid });
      }
      const nF = fx.filter(f => f.type === 'ffu').length, nL = fx.length - nF;
      said.push(`${[nF ? nF + ' FFU' + (nF > 1 ? 's' : '') : '', nL ? nL + ' light' + (nL > 1 ? 's' : '') : ''].filter(Boolean).join(' and ')} in ${L.length} layout${L.length > 1 ? 's' : ''}${target ? ' set out just below the building: drag each into its room on the Plan (it lands in the grid)' : ''}`);
    }
  }
  return said.length ? { text: 'Also from the sheet: ' + said.join('; ') + '.' } : null;
}
/* What a layer of a DWG / DXF can bring in, and a first guess from its name */
const LAYER_ROLES = [['wall', 'Walls'], ['beam', 'Steel beams'], ['ffu', 'FFUs'], ['led', 'Lights'], ['column', 'Columns'], ['chase', 'Air chases'], ['grid', 'Ceiling grid'], ['ignore', 'Leave out']];
const LAYER_GUESS = [['beam', /beam|s-?bm|girder|joist|\bw\d+x\d+/i], ['ffu', /ffu|hepa|fan.?filt/i], ['led', /light|lite|lumin|\bled\b|e-?lite|lght/i], ['column', /\bcol(umn)?s?\b|s-?col/i], ['chase', /chase/i], ['grid', /clg|ceil|rcp|t-?bar|tee.?grid|grid.?ceil/i]];
/* The pieces on layers given a role other than walls, placed where they are on the drawing (the same frame as
   its walls): beams (a centreline, or two flange lines, or a long thin outline), FFUs and lights (their
   rectangles), columns (small outlines), air chases (outlines) and ceiling grid (its lines). Adds them to p;
   returns a line saying what came in, or ''. */
function layerPieces(data, o, p) {
  const roles = o.roles || {}, by = {}; for (const [l, r] of Object.entries(roles)) (by[r] = by[r] || new Set()).add(l);
  if (!Object.keys(by).length) return '';
  const F = IMP.dxfFrame(data, o), k = o.unitFt, uid = Plan3DEditor.uid, said = [];
  const segsOn = (S) => data.segs.filter(q => S.has(q[4])).map(q => { const a = F.P(q[0], q[1]), b = F.P(q[2], q[3]); return [a[0], a[1], b[0], b[1]]; });
  const rectsOn = (S) => { const out = []; for (const r of data.rects || []) { if (!S.has(r.layer)) continue; const [x, y] = F.P(r.cx, r.cy), w = r.w * k, h = r.h * k; if (out.some(q => Math.abs(q.x - x) < 0.3 && Math.abs(q.y - y) < 0.3)) continue; out.push({ x, y, w, h }); } return out; };
  // steel beams
  if (by.beam) {
    const S = segsOn(by.beam).filter(q => Math.hypot(q[2] - q[0], q[3] - q[1]) >= 3), used = new Set(), out = [];
    const dir = (q) => { const L = Math.hypot(q[2] - q[0], q[3] - q[1]); return [(q[2] - q[0]) / L, (q[3] - q[1]) / L, L]; };
    for (let i = 0; i < S.length; i++) {
      if (used.has(i)) continue; const a = S[i], [ux, uy, La] = dir(a); let mate = -1, md = 1.3;
      for (let j = i + 1; j < S.length; j++) {
        if (used.has(j)) continue; const b = S[j], [vx, vy, Lb] = dir(b); if (Math.abs(ux * vy - uy * vx) > 0.03) continue;
        const d = Math.abs((b[0] - a[0]) * -uy + (b[1] - a[1]) * ux); if (d < 0.05 || d > md) continue;
        const t0 = (b[0] - a[0]) * ux + (b[1] - a[1]) * uy, t1 = (b[2] - a[0]) * ux + (b[3] - a[1]) * uy, ov = Math.min(La, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
        if (ov > 0.7 * Math.min(La, Lb)) { md = d; mate = j; }
      }
      if (mate >= 0) { const b = S[mate], s2 = (b[0] - a[0]) * ux + (b[1] - a[1]) * uy > ((b[2] - a[0]) * ux + (b[3] - a[1]) * uy) ? [b[2], b[3], b[0], b[1]] : b; used.add(mate); out.push([(a[0] + s2[0]) / 2, (a[1] + s2[1]) / 2, (a[2] + s2[2]) / 2, (a[3] + s2[3]) / 2]); }
      else out.push(a);
      used.add(i);
    }
    // a beam drawn as a long thin closed outline
    for (const r of rectsOn(by.beam)) { const lo = Math.min(r.w, r.h), hi = Math.max(r.w, r.h); if (hi >= 3 && hi / lo >= 4 && lo <= 2) out.push(r.w >= r.h ? [r.x - r.w / 2, r.y, r.x + r.w / 2, r.y] : [r.x, r.y - r.h / 2, r.x, r.y + r.h / 2]); }
    const q = (v) => Math.round(v * 48) / 48;
    p.beams = (p.beams || []).concat(out.map(b => ({ id: uid(), x1: q(b[0]), y1: q(b[1]), x2: q(b[2]), y2: q(b[3]), size: 'W12x26' })));
    if (out.length) said.push(out.length + ' steel beam' + (out.length > 1 ? 's' : '') + ' (W12×26: pick one to change it)');
  }
  // FFUs and lights: their rectangles, at their own size
  let nF = 0, nL = 0;
  for (const [role, type] of [['ffu', 'ffu'], ['led', 'led']]) {
    if (!by[role]) continue;
    for (const r of rectsOn(by[role])) {
      const lo = Math.min(r.w, r.h), hi = Math.max(r.w, r.h); if (lo < 0.9 || hi > 6.2) continue;
      if ((p.fixtures || []).some(f => Math.abs(f.x - r.x) < 0.3 && Math.abs(f.y - r.y) < 0.3)) continue;
      (p.fixtures = p.fixtures || []).push({ id: uid(), type, x: r.x, y: r.y, w: r.w, h: r.h }); if (type === 'ffu') nF++; else nL++;
    }
  }
  if (nF || nL) {
    // each layout (fixtures within 6′ of each other) is a group, to drag into its room as one
    const F2 = p.fixtures, par = F2.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
    for (let i = 0; i < F2.length; i++) for (let j = i + 1; j < F2.length; j++) if (Math.abs(F2[i].x - F2[j].x) < (F2[i].w + F2[j].w) / 2 + 6 && Math.abs(F2[i].y - F2[j].y) < (F2[i].h + F2[j].h) / 2 + 6) par[find(i)] = find(j);
    const gids = new Map(); F2.forEach((f, i) => { const r = find(i); if (!f.gid) f.gid = gids.get(r) || (gids.set(r, uid()), gids.get(r)); });
    p.ceilingMode = 'manual'; said.push([nF ? nF + ' FFU' + (nF > 1 ? 's' : '') : '', nL ? nL + ' light' + (nL > 1 ? 's' : '') : ''].filter(Boolean).join(' and ')); }
  // columns
  if (by.column) {
    const C = rectsOn(by.column).filter(r => Math.max(r.w, r.h) <= 4 && Math.min(r.w, r.h) >= 0.2);
    p.columns = (p.columns || []).concat(C.map(r => ({ id: uid(), x: r.x, y: r.y, size: Math.round(Math.max(r.w, r.h) * 12) / 12, kind: Math.max(r.w, r.h) > 1.1 ? 'concrete' : 'steel' })));
    if (C.length) said.push(C.length + ' column' + (C.length > 1 ? 's' : ''));
  }
  // air chases
  if (by.chase) {
    const C = rectsOn(by.chase).filter(r => Math.min(r.w, r.h) >= 0.5);
    p.chases = (p.chases || []).concat(C.map(r => ({ id: uid(), x0: r.x - r.w / 2, y0: r.y - r.h / 2, x1: r.x + r.w / 2, y1: r.y + r.h / 2 })));
    if (C.length) said.push(C.length + ' air chase' + (C.length > 1 ? 's' : ''));
  }
  // ceiling grid
  if (by.grid) {
    const G = segsOn(by.grid).filter(q => Math.hypot(q[2] - q[0], q[3] - q[1]) >= 0.5);
    if (G.length) { p.ceilingGrid = (p.ceilingGrid || []).concat(G); p.ceilingMode = 'manual'; p.ceilingSource = p.ceilingSource || data.name; delete p.ceilRects; p.fixtures = p.fixtures || []; said.push('the ceiling grid (' + G.length + ' lines)'); }
  }
  return said.length ? 'From the other layers: ' + said.join(', ') + '.' : '';
}
function dxfDialog(data, preset) {
  preset = preset || {};
  const opTypes = {};
  const names = Object.keys(data.layers).sort((a, b) => data.layers[b] - data.layers[a]);
  if (!names.length) { dialogOpen({ title: 'Nothing to import', body: '<p>This drawing has no lines or polylines Coll Plan3D can read. If the walls are inside blocks or xrefs, explode or bind them in AutoCAD and save as DXF again.</p>', buttons: [{ label: 'OK', primary: true, ret: null }] }); return; }
  const wallish = names.filter(n => /wall|partition|panel|a-wall|^wa/i.test(n) && !/detl|detail|path|walk|egress|patt/i.test(n));
  const notWall = /title|dim|text|anno|defpoints|border|logo|watermark|hatch|furn|grid|tag|note|symbol|xref|viewport|detl|detail|path|walk|egress|patt|^0$/i;
  const pre = new Set(preset.layers ? names.filter(n => preset.layers.includes(n)) : wallish.length ? wallish : names.filter(n => !notWall.test(n)).length ? names.filter(n => !notWall.test(n)) : names);
  // what each layer brings in: walls, or another kind of piece, placed where it is on the drawing
  // a drawing named for one kind of piece ("Beams", "Filters", "Ceiling grid") whose layers don't say what
  // they are: its drawn layers are that kind
  const fileRole = (LAYER_GUESS.concat([['ffu', /filter/i]]).find(([, rx]) => rx.test(data.name || '')) || [null])[0];
  const named = names.some(n => wallish.includes(n) || LAYER_GUESS.some(([, rx]) => rx.test(n)));
  const roleOf = (n) => fileRole && !named && !/dim|text|anno|title|border|defpoints|viewport/i.test(n) ? fileRole : pre.has(n) && !LAYER_GUESS.some(([r, rx]) => r !== 'wall' && rx.test(n)) ? 'wall' : (LAYER_GUESS.find(([, rx]) => rx.test(n)) || ['ignore'])[0];
  const iu = data.insunits;
  const unitOpts = [[1, 'Inches'], [2, 'Feet'], [4, 'Millimeters'], [5, 'Centimeters'], [6, 'Meters']];
  const defUnit = preset.unit || (IMP.UNIT_FT[iu] && iu ? iu : 1);
  dialogOpen({
    wide: true,
    title: 'Import ' + data.name,
    body: `<p>Say what each layer holds. <b>Walls</b> become walls; steel beams, FFUs, lights, columns, air chases and ceiling grid come in as those pieces, right where they are on the drawing. Leave dimension, text and furniture layers on <b>Leave out</b> for a cleaner result.</p>
      <div class="layers" id="dxLayers">${names.map(n => `<label style="grid-template-columns:132px 1fr auto"><select data-l="${esc(n)}">${LAYER_ROLES.map(([k, l]) => `<option value="${k}" ${roleOf(n) === k ? 'selected' : ''}>${l}</option>`).join('')}</select><span>${esc(n)}</span><small>${data.layers[n]} lines</small></label>`).join('')}</div>
      <div class="row"><button type="button" class="btn small" id="dxAll">All walls</button><button type="button" class="btn small" id="dxNone">Leave all out</button></div>
      ${fld('Drawing units', `<select id="dxU">${unitOpts.map(([v, l]) => `<option value="${v}" ${v === defUnit ? 'selected' : ''}>${l}${v === iu ? ' (from file)' : ''}</option>`).join('')}</select>`)}
      ${fld('Walls drawn as', `<select id="dxM"><option value="double">Two parallel lines</option><option value="single">Single centerline</option></select>`)}
      ${fld('Wall thickness', '<input type="text" id="dxT" value="2&quot; to 8&quot;">')}
      ${fld('Separate drawings', `<select id="dxC"><option value="all">Everything on the sheet</option><option value="main">Only the main building (skip copies and loose bits off to the side)</option></select>`)}
      ${fld('Also look for', `<label class="chk"><input type="checkbox" id="dxX" checked> Ceiling grid, FFU layouts and steel beams drawn elsewhere on the sheet (on layers left out above), lined up on the cleanroom</label>`)}
      ${fld('Outside walls', `<select id="dxB"><option value="auto">Building walls when a cleanroom stands inside them (warehouse)</option><option value="all">Always building walls</option><option value="none">Cleanroom hardwall</option></select>`)}
      ${fld('Building walls are', `<select id="dxBK"><option value="auto">Metal panel up to 6″, concrete if thicker</option><option value="metal">Metal panel</option><option value="concrete">Concrete</option><option value="cmu">Concrete block</option><option value="stud">Steel stud and drywall</option></select>`)}
      <p class="sizeline" id="dxSize"></p>
      <div id="dxOpsWrap"><h4 style="margin:12px 0 6px">Doors and windows in the drawing</h4><div class="layers" id="dxOps" style="max-height:150px"></div></div>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Import', primary: true, value: () => readDx() }],
    onOpen: () => {
      const KINDS = [['door', 'Door'], ['door2', 'Pair of doors'], ['glass', 'Vision glass'], ['pass', 'Pass-thru'], ['none', 'Ignore']];
      const drawOps = () => {
        const list = IMP.dxfOpeningBlocks(data, readDx().unitFt);
        $('#dxOpsWrap').hidden = !list.length;
        $('#dxOps').innerHTML = list.map(b => { const cur = opTypes[b.name] || (b.kind === 'door' && b.w > 4.6 ? 'door2' : b.kind); return `<label style="grid-template-columns:1fr auto auto"><span>${esc(b.name)} <small>${esc(b.layer)} · ${fmt(b.w)}</small></span><small>${b.n}</small><select data-b="${esc(b.name)}">${KINDS.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`; }).join('');
        $$('#dxOps select').forEach(sel => sel.onchange = () => { opTypes[sel.dataset.b] = sel.value; });
      };
      const upd = () => { const o = readDx(); const sz = IMP.dxfSize(data, o.layers, o.unitFt); $('#dxSize').textContent = sz ? `Size with these units: ${fmt(sz.w)} × ${fmt(sz.h)} · ${sz.n} lines` : 'No layers selected.'; drawOps(); };
      $('#dxLayers').addEventListener('change', upd); $('#dxU').addEventListener('change', upd);
      $('#dxAll').onclick = () => { $$('#dxLayers select').forEach(i => i.value = 'wall'); upd(); };
      $('#dxNone').onclick = () => { $$('#dxLayers select').forEach(i => i.value = 'ignore'); upd(); };
      $('#dxM').onchange = () => { $('#dxT').value = $('#dxM').value === 'single' ? '3"' : '2" to 8"'; };
      try { const c = localStorage.getItem('p3d.dxClusters'); if (c && $('#dxC')) $('#dxC').value = c; } catch (e) { /* no storage */ }
      upd();
    }
  }).then(o => {
    if (!o) return;
    try { localStorage.setItem('p3d.dxClusters', o.clusters); } catch (e) { /* no storage */ }
    // no walls on the drawing (a beam or FFU drawing on its own): its other pieces set where (0, 0) is
    if (!data.segs.some(q => o.layers.has(q[4]))) o.frameLayers = new Set(Object.keys(o.roles || {}));
    // added to a project imported from a drawing: the same origin, so a beam or FFU drawing in the same
    // coordinates (exported from the same AutoCAD file) lands right on the plan
    const plF = addMode && ed.plan.dxfOrigin && !preset.keepOrigin ? ed.plan.dxfOrigin : null; if (plF) o.frame = plF;
    let walls = IMP.wallsFromDxf(data, o), skipped = 0;
    // a second copy of the plan or loose bits elsewhere on the sheet: keep the main building
    if (o.clusters === 'main' && IMP.wallClusters && walls.length) { const C = IMP.wallClusters(walls, 30); if (C.length > 1) { skipped = walls.length - C[0].walls.length; walls = C[0].walls; } }
    const ops0 = walls.length ? IMP.openingsFromDxf(data, walls, o, opTypes) : { openings: [], found: {} };
    // doors drawn as a plain swing arc in a gap (not a door symbol): fill the gap with a door
    const ad = IMP.arcDoors && walls.length ? IMP.arcDoors(data, walls, o, ops0.openings) : { walls: [], openings: [], found: { door: 0, door2: 0 } };
    walls.push(...ad.walls);
    // each separate drawing on the sheet is looked at on its own (its own outside walls, its own strays)
    const eachDrawing = (W, ops, mode) => {
      const C = o.clusters === 'all' && IMP.wallClusters ? IMP.wallClusters(W, 30) : [{ walls: W }], out = new Set(); out.strays = new Set();
      for (const c of C) { const r = IMP.buildingWalls(c.walls, ops, mode); r.forEach(id => out.add(id)); r.strays.forEach(id => out.strays.add(id)); }
      return out;
    };
    // lone walls standing outside the building (a curb, a sign, a bench on a wall layer) are left out
    const pre = IMP.buildingWalls ? eachDrawing(walls, ops0.openings.concat(ad.openings), o.bldMode === 'none' ? 'auto' : o.bldMode) : null;
    if (pre && pre.strays.size) { skipped += pre.strays.size; walls = walls.filter(w => !pre.strays.has(w.id)); }
    const ops = pre && pre.strays.size ? IMP.openingsFromDxf(data, walls, o, opTypes) : ops0;
    { const kept = new Set(walls.map(w => w.id)); for (let i = 0; i < ad.walls.length; i++) if (kept.has(ad.walls[i].id)) { ops.openings.push(ad.openings[i]); ops.found[ad.openings[i].type] = (ops.found[ad.openings[i].type] || 0) + 1; } }
    // a warehouse drawn around the cleanroom: its outside walls become building walls (taller, with a roof)
    const bld = IMP.buildingWalls ? eachDrawing(walls, ops.openings, o.bldMode) : new Set();
    for (const w of walls) if (bld.has(w.id)) w.kind = o.bldKind === 'auto' ? (w.t <= 0.5 + 1e-6 ? 'metal' : 'concrete') : o.bldKind;
    const p = Editor.blank(); p.name = data.name; p.walls = walls; p.openings = ops.openings; p.wallT = o.mode === 'single' ? o.tFt : 0.25;
    { const F0 = IMP.dxfFrame(data, o); p.dxfOrigin = { x0: F0.minX * F0.k, y0: F0.maxY * F0.k }; if (plF) p.__inPlace = true; }
    const rp = layerPieces(data, o, p);
    let extra = o.extras && walls.length ? sheetExtrasToPlan(data, { ...o, layers: new Set([...o.layers, ...Object.keys(o.roles || {})]) }, walls, bld, p) : null;
    if (rp && extra) extra.text = rp + ' ' + extra.text; else if (rp && !extra) extra = { text: rp };
    if (walls.length) { const t = walls.map(w => w.t).sort((a, b) => a - b); p.wallT = t[t.length >> 1]; }
    // added to a plan that has no drawing origin on record (imported before this version, or drawn by hand):
    // a beam or grid drawing still lines up when its line ends land on this plan's walls
    if (addMode && !plF && !walls.length && ed.plan.walls.length && ((p.beams || []).length || (p.ceilingGrid || []).length)) {
      const L = (p.beams || []).map(b => [b.x1, b.y1, b.x2, b.y2]).concat(p.ceilingGrid || []), al = IMP.alignToWalls(L, ed.plan.walls);
      if (al && al.score >= 0.5) {
        const dx = al.dx, dy = al.dy;
        for (const b of p.beams || []) { b.x1 += dx; b.x2 += dx; b.y1 += dy; b.y2 += dy; }
        if (p.ceilingGrid) p.ceilingGrid = p.ceilingGrid.map(q => [q[0] + dx, q[1] + dy, q[2] + dx, q[3] + dy]);
        for (const f of p.fixtures || []) { f.x += dx; f.y += dy; } for (const c of p.columns || []) { c.x += dx; c.y += dy; }
        for (const k of p.chases || []) { k.x0 += dx; k.x1 += dx; k.y0 += dy; k.y1 += dy; }
        p.__inPlace = true;
      }
    }
    if (adoptImported(p, extra && extra.text)) return;
    projectPath = null; ed.setPlan(p); ed.dirty = true; updateChrome();
    const f = ops.found, parts = [];
    if (f.door) parts.push(f.door + ' door' + (f.door > 1 ? 's' : '')); if (f.door2) parts.push(f.door2 + ' pair' + (f.door2 > 1 ? 's' : '') + ' of doors');
    if (f.glass) parts.push(f.glass + ' window' + (f.glass > 1 ? 's' : '')); if (f.pass) parts.push(f.pass + ' pass-thru' + (f.pass > 1 ? 's' : ''));
    const exText = extra && extra.text ? ' ' + extra.text : '';
    const opsText = parts.length ? ' and ' + parts.join(', ') : '. No door or window symbols were found; add them with the Door, Pair and Glass tools';
    const bldText = bld.size ? ` The ${bld.size} outside walls are the building (${Plan3DViewer.WALL_KINDS[walls.find(w => bld.has(w.id)).kind].short.toLowerCase()}); pick one to change it.` : '';
    const skipText = !skipped ? '' : o.clusters === 'all' ? ` Left out ${skipped} loose wall bit${skipped === 1 ? '' : 's'} standing on ${skipped === 1 ? 'its' : 'their'} own (a curb or a sign on a wall layer).` : ` Left out ${skipped} wall${skipped === 1 ? '' : 's'} away from the main building (a copy off to the side, loose bits); import again with “Separate drawings: Everything on the sheet” to keep them.`;
    if (walls.length) showBanner(`Imported ${walls.length} walls${opsText}.${bldText}${skipText}${exText} Check them, then add chases and rooms.`, [{ label: 'View in 3D', primary: true, fn: () => { hideBanner(); setView('split'); } }]);
    else if (rp) showBanner(rp + ' No walls came in (no layer set to Walls).', [{ label: 'View in 3D', primary: true, fn: () => { hideBanner(); setView('split'); } }]);
    else showBanner('No walls were found with these settings. Try "Single centerline", a wider thickness range, or other layers.', [{ label: 'Try again', primary: true, fn: () => dxfDialog(data, preset) }]);
  });
  function readDx() {
    const layers = new Set($$('#dxLayers select').filter(i => i.value === 'wall').map(i => i.dataset.l)), roles = {};
    $$('#dxLayers select').forEach(i => { if (i.value !== 'wall' && i.value !== 'ignore') roles[i.dataset.l] = i.value; });
    const unitFt = IMP.UNIT_FT[+$('#dxU').value] || 1 / 12, mode = $('#dxM').value;
    const tv = $('#dxT').value.split(/to|-|–/i).map(s => parseLen(s.trim(), 'in')).filter(v => v > 0);
    const minT = tv.length > 1 ? Math.min(...tv) : (tv[0] || 0.25) * 0.6, maxT = tv.length > 1 ? Math.max(...tv) : (tv[0] || 0.25) * 1.5;
    return { layers, unitFt, mode, minT, maxT, tFt: tv[0] || 0.25, minLen: 0.75, keepOrigin: !!preset.keepOrigin, bldMode: ($('#dxB') || {}).value || 'auto', bldKind: ($('#dxBK') || {}).value || 'auto', clusters: ($('#dxC') || {}).value || 'all', extras: !$('#dxX') || $('#dxX').checked, roles };
  }
}

/* ---------- Buildings: a library of saved buildings, and buildings placed in a plan ----------
   A placed building is a full copy of the saved one (plan.inserts[].plan). It never changes on its own: when
   the library has a newer version you update it from its panel, or swap it for another building. */
let bldLib = null;
async function loadBldLib() { if (!bldLib) { try { bldLib = (api.bldLib ? await api.bldLib() : []) || []; } catch (e) { bldLib = []; } } return bldLib; }
async function saveBldLib() { if (api.bldLibSave) await api.bldLibSave(bldLib); }
const fmtDate = (iso) => { try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso || ''; } };
function planThumb(plan) {
  const F = Plan3DViewer.flatten(plan), W = F.walls || [];
  if (!W.length) return '<svg viewBox="0 0 96 64"></svg>';
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; W.forEach(w => { x0 = Math.min(x0, w.x1, w.x2); y0 = Math.min(y0, w.y1, w.y2); x1 = Math.max(x1, w.x1, w.x2); y1 = Math.max(y1, w.y1, w.y2); });
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06 + 0.5, K = Plan3DViewer.WALL_KINDS;
  return `<svg viewBox="${(x0 - pad).toFixed(2)} ${(y0 - pad).toFixed(2)} ${(x1 - x0 + pad * 2).toFixed(2)} ${(y1 - y0 + pad * 2).toFixed(2)}" preserveAspectRatio="xMidYMid meet">` +
    W.map(w => `<line x1="${w.x1.toFixed(2)}" y1="${w.y1.toFixed(2)}" x2="${w.x2.toFixed(2)}" y2="${w.y2.toFixed(2)}" stroke="${w.kind && K[w.kind] ? K[w.kind].plan : '#e9eef0'}" stroke-width="${Math.max(w.t || 0.25, (x1 - x0) / 90).toFixed(3)}" stroke-linecap="square"/>`).join('') + '</svg>';
}
function bldSize(plan) { const b = Plan3DViewer.insertBox({ x: 0, y: 0, rot: 0, plan }); return fmt(b.x1 - b.x0) + ' × ' + fmt(b.y1 - b.y0); }

async function saveBuildingDialog() {
  const P = ed.plan;
  if (!P.walls.length && !(P.inserts || []).length) { toast('Draw or import a building first.'); return; }
  const lib = await loadBldLib(), prev = P.libId ? lib.find(x => x.id === P.libId) : null;
  const r = await dialogOpen({
    title: 'Save this building to the library',
    body: `<p>Saves this whole plan, with its doors, chases, ceiling, FFUs and wall types, so you can place it in other projects with <b>Library → Insert from the library</b>.</p>
      ${fld('Name', txt('bName', prev ? prev.name : (P.name || 'Building')))}
      <p class="note">${prev ? `This plan was saved before as “${esc(prev.name)}” (${esc(fmtDate(prev.savedAt))}). Updating it doesn't change copies already placed in other projects; each of those can be updated from its own panel.` : 'Copies you place are independent: changing the library later never changes them on its own.'}</p>`,
    buttons: prev ? [{ label: 'Cancel', ret: null }, { label: 'Save as new', value: () => ({ asNew: true, name: $('#bName').value.trim() }) }, { label: 'Update “' + prev.name + '”', primary: true, value: () => ({ asNew: false, name: $('#bName').value.trim() }) }]
      : [{ label: 'Cancel', ret: null }, { label: 'Save', primary: true, value: () => ({ asNew: true, name: $('#bName').value.trim() }) }],
    onOpen: () => { const n = $('#bName'); n.focus(); n.select(); }
  });
  if (!r) return;
  const plan = Plan3DViewer.centredCopy(clonePlan()); delete plan.libId;
  const now = new Date().toISOString(), name = r.name || P.name || 'Building';
  let entry;
  if (!r.asNew && prev) { entry = prev; Object.assign(entry, { name, savedAt: now, plan }); }
  else { entry = { id: Plan3DEditor.uid() + Plan3DEditor.uid(), name, savedAt: now, plan }; lib.unshift(entry); }
  entry.size = bldSize(plan);
  await saveBldLib();
  ed.plan.libId = entry.id; ed.dirty = true; updateChrome();
  toast(`Saved “${name}” to the library (${entry.size}).`);
}

/* Pick a building from the library. Resolves to the entry, or null. */
async function pickBuilding(title, okLabel) {
  const all = await loadBldLib(), lib = all.filter(e => (e.type || 'building') === 'building'); let picked = null;
  const list = () => lib.length ? lib.map(e => `<div class="blib-item" data-id="${esc(e.id)}">${planThumb(e.plan)}<div><b>${esc(e.name)}</b><small>${esc(e.size || bldSize(e.plan))} · ${esc(Plan3DViewer.zones(e.plan).filter(z => !z.virtual).length > 1 ? Plan3DViewer.zones(e.plan).filter(z => !z.virtual).length + ' buildings · ' : '')}${esc(fmt(e.plan.ceiling || 8))} ceiling</small><small>Saved ${esc(fmtDate(e.savedAt))}</small></div>
      <div class="row"><button class="btn small primary" data-use="${esc(e.id)}">${esc(okLabel)}</button><button class="btn small danger" data-del="${esc(e.id)}" title="Remove from the library (placed copies stay)">Delete</button></div></div>`).join('')
    : '<div class="blib-empty">No saved buildings yet. Open or draw a building, then use <b>Library → Save this building</b>.</div>';
  await dialogOpen({
    wide: true, title,
    body: `<div class="blib" id="blib">${list()}</div><p class="note">Saved on this computer. A placed building is its own copy; deleting it here doesn't remove copies already placed.</p>`,
    buttons: [{ label: 'Close', ret: null }],
    onOpen: (d) => {
      const bind = () => {
        $$('#blib [data-use]').forEach(b => b.onclick = () => { picked = lib.find(x => x.id === b.dataset.use); d.close(); });
        $$('#blib [data-del]').forEach(b => b.onclick = async () => {
          const e = lib.find(x => x.id === b.dataset.del); if (!e) return;
          if (!window.confirm(`Remove “${e.name}” from the library? Copies already placed in projects stay.`)) return;
          lib.splice(lib.indexOf(e), 1); all.splice(all.indexOf(e), 1); await saveBldLib(); $('#blib').innerHTML = list(); bind();
        });
      };
      bind();
    }
  });
  return picked;
}
function placeBuilding(src, name, libId, libSaved, at) {
  const plan = Plan3DViewer.centredCopy(src); delete plan.libId;
  const g = at ? 1 / 96 : 0.5, cx = at ? at.x : ed.W ? ed.wx(ed.W / 2) : 0, cy = at ? at.y : ed.H ? ed.wy(ed.H / 2) : 0;
  const ins = { id: Plan3DEditor.uid(), name: name || plan.name || 'Building', libId: libId || null, libSaved: libSaved || null, x: Math.round(cx / g) * g, y: Math.round(cy / g) * g, rot: 0, mirror: false, plan };
  ed.edit(P => { (P.inserts = P.inserts || []).push(ins); });
  ed.setTool('select'); ed.sel = { kind: 'insert', id: ins.id }; ed.emit('select'); ed.render(); queue3D();
  toast(`Placed “${ins.name}”. Drag it into place; R turns it. Its parts are a separate section of the parts list.`);
}
async function insertBuildingDialog() { return libraryDialog('building'); }

/* ---------- The library: buildings, groups of pieces, ceilings ----------
   A group is any set of pieces (walls, doors, chases, devices, items …) saved together and placed as a
   group you can drag; a ceiling is a ceiling drawing's grid and fixtures, laid on a plan from its corner. */
const LIB_TYPES = { building: 'Buildings', group: 'Groups of pieces', ceiling: 'Ceilings', machine: 'Machines' };
const PIECE_LISTS = ['walls', 'openings', 'chases', 'rooms', 'devices', 'items', 'columns', 'beams', 'fixtures'];
// the selected pieces (with the doors in their walls), copied and centred on 0,0
function collectPieces(refs) {
  const R2 = ed.withOpenings(refs), out = {}, LIST = { wall: 'walls', opening: 'openings', chase: 'chases', room: 'rooms', device: 'devices', item: 'items', column: 'columns', beam: 'beams', fixture: 'fixtures' };
  PIECE_LISTS.forEach(k => { out[k] = []; });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  out.dents = [];
  for (const r of R2) { if (r.kind === 'dent') { const o = ed.find(r); if (o) { out.dents.push(JSON.parse(JSON.stringify(o))); for (const [x, y] of ed.refPts(r)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } } continue; }
    const L = LIST[r.kind], o = ed.find(r); if (!L || !o) continue; out[L].push(JSON.parse(JSON.stringify(o))); for (const [x, y] of ed.refPts(r)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  if (!(x0 <= x1)) return null;
  const cx = Math.round((x0 + x1) / 2 * 12) / 12, cy = Math.round((y0 + y1) / 2 * 12) / 12;
  const mv = (o) => { if ('x1' in o && 'x0' in o) { o.x0 -= cx; o.x1 -= cx; o.y0 -= cy; o.y1 -= cy; } else if ('x1' in o) { o.x1 -= cx; o.x2 -= cx; o.y1 -= cy; o.y2 -= cy; } else { o.x -= cx; o.y -= cy; } delete o.gid; };
  PIECE_LISTS.forEach(k => out[k].forEach(mv));
  out.dents = out.dents.map(e => { const z = Plan3DDraft.xform(e, Plan3DDraft.MOVE(-cx, -cy)); delete z.gid; return z; });
  out.w = x1 - x0; out.h = y1 - y0;
  return out;
}
// put a copy of saved pieces in the plan around (x, y); new ids; selected (and grouped, if asked) afterwards
function pastePieces(data, x, y, group) {
  const g = 1 / 12; x = Math.round(x / g) * g; y = Math.round(y / g) * g;
  const ids = new Map(), gid = group ? Plan3DEditor.uid() : null, refs = [], KIND = { walls: 'wall', openings: 'opening', chases: 'chase', rooms: 'room', devices: 'device', items: 'item', columns: 'column', beams: 'beam', fixtures: 'fixture' };
  ed.edit(P => {
    // FFUs and lights join a drawn ceiling: an automatic one becomes hand-placed first
    // (an FFU layout replaces the automatic placeholder one; lights alone join it)
    if ((data.fixtures || []).length && P.ceilingMode !== 'manual') { P.fixtures = data.fixtures.some(f => f.type === 'ffu') ? [] : Plan3DViewer.ceilingFixtures(P).map(f => ({ id: Plan3DEditor.uid(), type: f.type, x: f.x, y: f.y })); P.ceilingMode = 'manual'; }
    for (const k of PIECE_LISTS) for (const src of data[k] || []) {
      const o = JSON.parse(JSON.stringify(src)), nid = Plan3DEditor.uid(); ids.set(o.id, nid); o.id = nid;
      if ('x0' in o && 'x1' in o) { o.x0 += x; o.x1 += x; o.y0 += y; o.y1 += y; } else if ('x2' in o) { o.x1 += x; o.x2 += x; o.y1 += y; o.y2 += y; } else { o.x += x; o.y += y; }
      if (gid) o.gid = gid; else delete o.gid;
      (P[k] = P[k] || []).push(o); refs.push({ kind: KIND[k], id: nid });
    }
    for (const o of P.openings) if (o.unit && ids.has(o.unit)) o.unit = ids.get(o.unit);
    // drafting comes along on its own layers (a layer it was on that isn't here any more: the current layer)
    if ((data.dents || []).length) { const D = Plan3DDraft.data(P, true); for (const src of data.dents) { const e = Plan3DDraft.xform(JSON.parse(JSON.stringify(src)), Plan3DDraft.MOVE(x, y)); e.id = Plan3DEditor.uid(); if (!D.layers.some(l => l.id === e.layer)) e.layer = D.cur; if (gid) e.gid = gid; else delete e.gid; D.ents.push(e); refs.push({ kind: 'dent', id: e.id }); } }
  });
  ed.setTool('select'); ed.setMulti(refs);
  return refs.length;
}
/* Resize the selected pieces about their middle: for a group that came in at the wrong scale (drawn in inches
   but read as feet, millimetres …). Wall thicknesses, door sizes and fixture sizes stay as they are. */
async function resizeSelection() {
  const refs = ed.withOpenings(ed.multi || (ed.sel ? [ed.sel] : [])); if (!refs.length) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of refs) for (const [x, y] of ed.refPts(r)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const W = x1 - x0, H = y1 - y0;
  const k = await dialogOpen({ title: 'Resize the selection', body: `<p>It measures <b>${fmt(W)} × ${fmt(H)}</b> now. Type the width it should be, or pick a fix for a drawing read in the wrong units.</p>
    ${fld('Width should be', txt('rzW', fmt(W)))}
    ${fld('Or', `<select id="rzK"><option value="">(use the width above)</option><option value="${1 / 12}">It's 12 times too big (inches read as feet)</option><option value="12">It's 12 times too small (feet read as inches)</option><option value="${1 / 25.4}">It's 25.4 times too big (millimetres read as inches)</option><option value="0.5">Half the size</option><option value="2">Twice the size</option></select>`)}
    <p class="note">Walls stay their thickness, and doors, FFUs and lights keep their sizes; only where everything sits changes. Ctrl+Z undoes it.</p>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Resize', primary: true, value: () => { const f = +$('#rzK').value; if (f > 0) return f; const v = parseLen($('#rzW').value, 'ft'); return v > 0 && W > 0 ? v / W : null; } }],
    onOpen: () => { $('#rzW').focus(); $('#rzW').select(); } });
  if (!k || Math.abs(k - 1) < 1e-6) return;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, S = (v, c) => c + (v - c) * k;
  ed.edit(() => {
    for (const r of refs) {
      const o = ed.find(r); if (!o) continue;
      if (r.kind === 'opening') { const mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2, nx = S(mx, cx) - mx, ny = S(my, cy) - my; o.x1 += nx; o.x2 += nx; o.y1 += ny; o.y2 += ny; }
      else if ('x2' in o) { o.x1 = S(o.x1, cx); o.x2 = S(o.x2, cx); o.y1 = S(o.y1, cy); o.y2 = S(o.y2, cy); }
      else if ('x0' in o && 'x1' in o) { o.x0 = S(o.x0, cx); o.x1 = S(o.x1, cx); o.y0 = S(o.y0, cy); o.y1 = S(o.y1, cy); }
      else if ('x' in o) { o.x = S(o.x, cx); o.y = S(o.y, cy); }
    }
  });
  renderProps(); toast(`Resized to ${fmt(W * k)} × ${fmt(H * k)}.`);
}
let pieceClip = null;
function copyPieces() { const refs = ed.multi || (ed.sel ? [ed.sel] : []); const d = refs.length ? collectPieces(refs) : null; if (d) { pieceClip = d; toast('Copied ' + refs.length + ' piece' + (refs.length > 1 ? 's' : '') + '. Ctrl+V pastes them.'); } }
function pastePiecesHere() { if (!pieceClip) return; const C = ed.cursor || { x: ed.wx(ed.W / 2), y: ed.wy(ed.H / 2) }; const n = pastePieces(pieceClip, C.x, C.y, false); toast(`Pasted ${n} piece${n > 1 ? 's' : ''}. Drag them into place.`); }
function libThumb(e) {
  if (e.type === 'machine') {
    const M = e.machine, pad = Math.max(M.w, M.d) * 0.06 + 0.3, sw = Math.max(M.w, M.d) / 160;
    return `<svg viewBox="${(-M.w / 2 - pad).toFixed(2)} ${(-M.d / 2 - pad).toFixed(2)} ${(M.w + 2 * pad).toFixed(2)} ${(M.d + 2 * pad).toFixed(2)}" preserveAspectRatio="xMidYMid meet">` + (M.lines || []).map(q => `<line x1="${q[0].toFixed(2)}" y1="${q[1].toFixed(2)}" x2="${q[2].toFixed(2)}" y2="${q[3].toFixed(2)}" stroke="#c9d3d8" stroke-width="${sw.toFixed(3)}"/>`).join('') + (M.swings || []).map(P => `<polyline points="${P.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ')}" fill="none" stroke="#7d8a90" stroke-width="${sw.toFixed(3)}"/>`).join('') + '</svg>';
  }
  if (e.type === 'group') return planThumb({ walls: e.pieces.walls || [], openings: [], chases: [], rooms: [] });
  if (e.type === 'ceiling') {
    const C = e.ceiling, L = C.grid || [], F = C.fixtures || []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    L.forEach(q => { x0 = Math.min(x0, q[0], q[2]); x1 = Math.max(x1, q[0], q[2]); y0 = Math.min(y0, q[1], q[3]); y1 = Math.max(y1, q[1], q[3]); }); F.forEach(f => { x0 = Math.min(x0, f.x - 1); x1 = Math.max(x1, f.x + 1); y0 = Math.min(y0, f.y - 2); y1 = Math.max(y1, f.y + 2); });
    if (!(x0 < x1)) return '<svg viewBox="0 0 96 64"></svg>';
    const pad = Math.max(x1 - x0, y1 - y0) * 0.05 + 0.5, sw = Math.max(x1 - x0, y1 - y0) / 220;
    return `<svg viewBox="${(x0 - pad).toFixed(2)} ${(y0 - pad).toFixed(2)} ${(x1 - x0 + 2 * pad).toFixed(2)} ${(y1 - y0 + 2 * pad).toFixed(2)}" preserveAspectRatio="xMidYMid meet">` + L.map(q => `<line x1="${q[0].toFixed(2)}" y1="${q[1].toFixed(2)}" x2="${q[2].toFixed(2)}" y2="${q[3].toFixed(2)}" stroke="#9fb0b7" stroke-width="${sw.toFixed(3)}"/>`).join('') + F.map(f => { const w = (f.w || 2) - 0.2, h = (f.h || 4) - 0.2; return `<rect x="${(f.x - w / 2).toFixed(2)}" y="${(f.y - h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${f.type === 'ffu' ? '#7fd3e3' : '#f2f2f2'}"/>`; }).join('') + '</svg>';
  }
  return planThumb(e.plan);
}
function libSub(e) {
  if (e.type === 'machine') return `Machine · ${fmt(e.machine.w)} × ${fmt(e.machine.d)} · ${fmt(e.machine.h || 8)} tall${e.machine.source ? ' · from ' + esc(e.machine.source) : ''}`;
  if (e.type === 'group') { const p = e.pieces, n = PIECE_LISTS.reduce((t, k) => t + (p[k] || []).length, 0); return `${n} piece${n === 1 ? '' : 's'} · ${fmt(p.w || 0)} × ${fmt(p.h || 0)}`; }
  if (e.type === 'ceiling') { const C = e.ceiling, f = C.fixtures || []; return `${(C.grid || []).length ? 'Grid' : C.image ? 'Picture' : 'Grid'} · ${f.filter(x => x.type === 'ffu').length} FFUs · ${f.filter(x => x.type !== 'ffu').length} lights${C.source ? ' · from ' + esc(C.source) : ''}`; }
  return `${esc(e.size || bldSize(e.plan))} · ${esc(fmt(e.plan.ceiling || 8))} ceiling`;
}
async function saveToLib(type, name, data) {
  const lib = await loadBldLib(), entry = { id: Plan3DEditor.uid() + Plan3DEditor.uid(), type, name, savedAt: new Date().toISOString(), ...data };
  lib.unshift(entry); await saveBldLib(); return entry;
}
async function saveGroupDialog() {
  const refs = ed.multi || (ed.sel ? [ed.sel] : []);
  if (!refs.length) { toast('Select the pieces first: Shift-drag a box around them on the plan, or Shift+click them.'); setView(view === '3d' ? 'split' : view); return; }
  const d = collectPieces(refs); if (!d) return;
  const r = await dialogOpen({ title: 'Save these pieces to the library', body: `<p>Saves the ${refs.length} selected piece${refs.length > 1 ? 's' : ''} (and the doors and windows in their walls) as a group you can place again in any project from <b>Library → Insert from the library</b>.</p>${fld('Name', txt('gName', 'Group ' + fmt(d.w) + ' × ' + fmt(d.h)))}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Save', primary: true, value: () => $('#gName').value.trim() }], onOpen: () => { $('#gName').focus(); $('#gName').select(); } });
  if (r == null) return;
  const e = await saveToLib('group', r || 'Group', { pieces: d });
  toast(`Saved “${e.name}” to the library.`);
}
async function saveCeilingDialog() {
  const P = ed.plan, has = (P.ceilingGrid && P.ceilingGrid.length) || (P.ceilTiles && P.ceilTiles.length) || P.ceilingImage || (P.ceilingMode === 'manual' && (P.fixtures || []).length);
  if (!has) { toast('This plan has no ceiling of its own to save yet. Add a ceiling drawing or place FFUs and lights first.'); return; }
  const A = Plan3DViewer.analyze(P), ox = A.empty ? 0 : A.bounds.minX, oy = A.empty ? 0 : A.bounds.minZ;
  const r = await dialogOpen({ title: 'Save this ceiling to the library', body: `<p>Saves the ceiling grid, FFUs and lights (and a ceiling picture, if there is one), measured from the building's corner, so you can lay it on another plan from <b>Library → Insert from the library</b>.</p>${fld('Name', txt('cName', (P.ceilingSource || P.name || 'Ceiling').replace(/\.(dwg|dxf|png|jpe?g)$/i, '') + ' ceiling'))}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Save', primary: true, value: () => $('#cName').value.trim() }], onOpen: () => { $('#cName').focus(); $('#cName').select(); } });
  if (r == null) return;
  const C = { source: P.ceilingSource || '', grid: (P.ceilingGrid || []).map(q => [q[0] - ox, q[1] - oy, q[2] - ox, q[3] - oy]), fixtures: (P.ceilingMode === 'manual' ? P.fixtures || [] : []).map(f => ({ ...f, x: f.x - ox, y: f.y - oy })) };
  if (P.ceilingImage) C.image = { ...P.ceilingImage, x: P.ceilingImage.x - ox, y: P.ceilingImage.y - oy };
  if ((P.ceilTiles || []).length) C.tiles = P.ceilTiles.map(t => ({ ...t, x: t.x - ox, y: t.y - oy }));
  const e = await saveToLib('ceiling', r || 'Ceiling', { ceiling: C });
  toast(`Saved “${e.name}” to the library.`);
}
function applyCeiling(e) {
  const C = e.ceiling, A = Plan3DViewer.analyze(ed.plan), ox = A.empty ? 0 : A.bounds.minX, oy = A.empty ? 0 : A.bounds.minZ;
  ed.edit(P => {
    if ((C.grid || []).length) P.ceilingGrid = C.grid.map(q => [q[0] + ox, q[1] + oy, q[2] + ox, q[3] + oy]); else delete P.ceilingGrid;
    if (C.image) P.ceilingImage = { ...C.image, x: C.image.x + ox, y: C.image.y + oy }; else delete P.ceilingImage;
    P.fixtures = (C.fixtures || []).map(f => ({ ...f, id: Plan3DEditor.uid(), x: f.x + ox, y: f.y + oy }));
    P.ceilingMode = 'manual'; delete P.ceilRects; P.ceilingSource = e.name;
    if ((C.tiles || []).length) { P.ceilTiles = C.tiles.map(t => ({ ...t, id: Plan3DEditor.uid(), x: t.x + ox, y: t.y + oy })); P.ceilRects = Plan3DViewer.builtRects(P); } else delete P.ceilTiles;
  });
  updateChrome(); queue3D();
  showBanner(`Laid “${e.name}” on this plan from its corner. Move or turn it if it needs lining up.`, [{ label: 'Move or turn it', primary: true, fn: () => { hideBanner(); moveCeilingDialog(); } }]);
}
/* ---------- Machines: equipment brought in from a drawing ----------
   Its plan linework (lines, and door swings as arcs) is kept in feet about its centre, so it can be placed,
   moved and turned like any item; in 3D the lines stand up as its enclosure. Saved in the Library. */
function machineFromDxf(data) {
  const k = IMP.UNIT_FT[data.insunits] || 1 / 12, F = (x, y) => [x * k, -y * k];
  const lines = data.segs.map(q => [...F(q[0], q[1]), ...F(q[2], q[3])]).filter(q => Math.hypot(q[2] - q[0], q[3] - q[1]) > 0.01);
  const swings = [];
  const arcPts = (cx, cy, r, a0, a1, map) => { let A1 = a1; while (A1 <= a0) A1 += Math.PI * 2; const n = Math.max(6, Math.ceil((A1 - a0) / (Math.PI / 24))), P = []; for (let i = 0; i <= n; i++) { const t = a0 + (A1 - a0) * i / n; P.push(map(cx + r * Math.cos(t), cy + r * Math.sin(t))); } return P; };
  for (const b of data.blocks || []) for (const a of b.arcs || []) { if (a.a0 == null) continue; const W = (x, y) => F(b.o[0] + b.u[0] * x + b.v[0] * y, b.o[1] + b.u[1] * x + b.v[1] * y); swings.push(arcPts(a.x, a.y, a.r, a.a0, a.a1, W)); }
  for (const a of data.arcs || []) swings.push(arcPts(a.x, a.y, a.r, a.a0 * (Math.abs(a.a0) > 6.3 ? Math.PI / 180 : 1), a.a1 * (Math.abs(a.a1) > 6.3 ? Math.PI / 180 : 1), F));
  if (!lines.length) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const ext = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  lines.forEach(q => { ext(q[0], q[1]); ext(q[2], q[3]); }); swings.forEach(P => P.forEach(q => ext(q[0], q[1])));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r4 = (v) => Math.round(v * 1e4) / 1e4;
  return { w: x1 - x0, d: y1 - y0, lines: lines.map(q => [q[0] - cx, q[1] - cy, q[2] - cx, q[3] - cy].map(r4)), swings: swings.map(P => P.map(q => [r4(q[0] - cx), r4(q[1] - cy)])) };
}
async function addMachineDialog() {
  const r = await api.openFile('ceiling'); if (!r) return;
  if (r.kind === 'error') { handleLoaded(r); return; }
  if (r.kind !== 'dxf') { toast('Pick the machine drawing as a DWG or DXF.'); return; }
  const M = machineFromDxf(r); if (!M) { toast('No lines in that drawing.'); return; }
  // a name from the drawing's biggest block (the machine is often one block), else the file name
  const blk = (r.blocks || []).slice().sort((a, b) => (b.sn || 0) - (a.sn || 0))[0];
  let name = blk && blk.name ? blk.name.split(' - ')[0].replace(/^SPCL-/i, '').replace(/_/g, ' ').trim() : '';
  if (!name || name.length > 60) name = (r.name || 'Machine').replace(/\.(dwg|dxf)$/i, '').replace(/_/g, ' ');
  M.source = r.name; M.h = 8;
  const thumb = libThumb({ type: 'machine', machine: M }).replace('<svg ', '<svg style="width:220px;height:180px;background:#1b2023;border-radius:8px" ');
  const res = await dialogOpen({ title: 'Add a machine', body: `<div class="row" style="gap:14px;align-items:flex-start">${thumb}<div style="flex:1">
      ${fld('Name', txt('mName', name))}${fld('Height', txt('mH', fmt(8)))}
      <p class="note">${fmt(M.w)} × ${fmt(M.d)} on the plan, from ${esc(r.name)}. Its lines stand up as its walls in 3D; door swings show on the plan.</p></div></div>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Save to the library', value: () => ({ go: false, name: $('#mName').value.trim(), h: parseLen($('#mH').value, 'ft') }) }, { label: 'Save and place it', primary: true, value: () => ({ go: true, name: $('#mName').value.trim(), h: parseLen($('#mH').value, 'ft') }) }] });
  if (!res) return;
  M.h = res.h > 0 ? Math.min(40, res.h) : 8;
  const e = await saveToLib('machine', res.name || name, { machine: M });
  if (res.go) placeMachine(e); else toast(`Saved “${e.name}” to the library under Machines. Library → Insert from the library to place it.`);
}
function placeMachine(e) {
  if (view === '3d') setView('split');
  const M = e.machine, cx = ed.W ? ed.wx(ed.W / 2) : 0, cy = ed.H ? ed.wy(ed.H / 2) : 0, g = 1 / 12;
  const it = { id: Plan3DEditor.uid(), type: 'machine', name: e.name, libId: e.id, source: M.source, x: Math.round(cx / g) * g, y: Math.round(cy / g) * g, a: 0, w: M.w, d: M.d, h: M.h || 8, lines: M.lines, swings: M.swings };
  ed.edit(P => { (P.items = P.items || []).push(it); });
  ed.sel = { kind: 'item', id: it.id }; ed.emit('select'); ed.render(); queue3D();
  toast(`Placed “${e.name}” in the middle of the view. Drag it where you want it (its edges catch on wall faces); R turns it.`);
}
async function libraryDialog(only) {
  const lib = await loadBldLib(); let tab = only || 'all';
  const list = () => {
    const L = lib.filter(e => tab === 'all' || (e.type || 'building') === tab);
    if (!L.length) return `<div class="blib-empty">${tab === 'machine' ? 'No machines yet. Use <b>Library → Add a machine from a drawing…</b> to bring one in from a DWG or DXF.' : tab === 'group' ? 'No saved groups yet. Select pieces on the plan (Shift-drag a box around them), then <b>Library → Save selected pieces</b>.' : tab === 'ceiling' ? 'No saved ceilings yet. Add a ceiling to a plan, then <b>Library → Save this ceiling</b>.' : 'Nothing saved yet. Use the Library menu to save a building, a group of pieces or a ceiling.'}</div>`;
    return L.map(e => { const t = e.type || 'building', ok = t === 'group' || t === 'machine' ? 'Place' : t === 'ceiling' ? 'Use on this plan' : 'Insert';
      return `<div class="blib-item">${libThumb(e)}<div><b>${esc(e.name)}</b><small>${t === 'machine' ? '' : ({ building: 'Building', group: 'Group of pieces', ceiling: 'Ceiling' })[t] + ' · '}${libSub(e)}</small><small>Saved ${esc(fmtDate(e.savedAt))}</small></div>
        <div class="row"><button class="btn small primary" data-use="${esc(e.id)}">${ok}</button><button class="btn small" data-ren="${esc(e.id)}">Rename</button><button class="btn small danger" data-del="${esc(e.id)}">Delete</button></div></div>`; }).join('');
  };
  let picked = null;
  await dialogOpen({
    wide: true, title: 'Library',
    body: `<div class="row" id="libTabs">${[['all', 'Everything'], ...Object.entries(LIB_TYPES)].map(([k, l]) => `<button class="btn small${k === tab ? ' primary' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div class="blib" id="blib" style="margin-top:8px">${list()}</div><p class="note">Saved on this computer. Anything you place is its own copy: changing or deleting it here doesn't change projects it's already in.</p>`,
    buttons: [{ label: 'Close', ret: null }],
    onOpen: (d) => {
      const bind = () => {
        $$('#libTabs [data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; $$('#libTabs [data-tab]').forEach(x => x.classList.toggle('primary', x === b)); $('#blib').innerHTML = list(); bind(); });
        $$('#blib [data-use]').forEach(b => b.onclick = () => { picked = lib.find(x => x.id === b.dataset.use); d.close(); });
        // rename in place: the name turns into a box; Enter or leaving it saves
        $$('#blib [data-ren]').forEach(b => b.onclick = () => {
          const e = lib.find(x => x.id === b.dataset.ren), nm = b.closest('.blib-item').querySelector('b'); if (!e || !nm) return;
          const inp = document.createElement('input'); inp.type = 'text'; inp.value = e.name; inp.style.width = '100%'; nm.replaceWith(inp); inp.focus(); inp.select();
          let done = false; const fin = async (save) => { if (done) return; done = true; if (save && inp.value.trim()) { e.name = inp.value.trim(); await saveBldLib(); } $('#blib').innerHTML = list(); bind(); };
          inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); fin(true); } if (ev.key === 'Escape') { ev.preventDefault(); fin(false); } };
          inp.onblur = () => fin(true);
        });
        $$('#blib [data-del]').forEach(b => b.onclick = async () => {
          const e = lib.find(x => x.id === b.dataset.del); if (!e) return;
          if (!window.confirm(`Remove “${e.name}” from the library? Copies already placed in projects stay.`)) return;
          lib.splice(lib.indexOf(e), 1); await saveBldLib(); $('#blib').innerHTML = list(); bind();
        });
      };
      bind();
    }
  });
  if (!picked) return;
  const t = picked.type || 'building';
  if (t === 'building') placeBuilding(picked.plan, picked.name, picked.id, picked.savedAt);
  else if (t === 'machine') placeMachine(picked);
  else if (t === 'group') { if (view === '3d') setView('split'); const cx = ed.W ? ed.wx(ed.W / 2) : 0, cy = ed.H ? ed.wy(ed.H / 2) : 0; const n = pastePieces(picked.pieces, cx, cy, true); queue3D(); toast(`Placed “${picked.name}” (${n} pieces) as a group in the middle of the view. Drag it into place; its walls catch on wall ends.`); }
  else applyCeiling(picked);
}
async function insertFromFile() {
  if (!api.openFile) return;
  const r = await api.openFile('project');
  if (!r || r.kind !== 'project') { if (r && r.kind === 'error') toast("That file couldn't be read."); return; }
  let p; try { p = JSON.parse(r.json); } catch (e) { toast('That project file is damaged.'); return; }
  if (!p.walls || (!p.walls.length && !(p.inserts || []).length)) { toast('That project has no walls.'); return; }
  placeBuilding(p, p.name || r.name, null, null);
}
async function insertProps(box, o) {
  const b = ed.insBox(o), lib = await loadBldLib(), L = o.libId ? lib.find(x => x.id === o.libId) : null;
  if (ed.sel && ed.sel.kind === 'insert' && ed.sel.id !== o.id) return;
  const newer = L && o.libSaved && L.savedAt > o.libSaved;
  box.innerHTML = `<div class="hd"><span class="kind">Placed building</span><button class="btn small danger" id="pDel">Delete</button></div>
    ${fld('Name', txt('iName', o.name || ''))}
    <div class="grp"><div class="stats"><span>Size</span><span>${fmt(b.x1 - b.x0)} × ${fmt(b.y1 - b.y0)}</span><span>Turned</span><span>${((o.rot || 0) % 4) * 90}°${o.mirror ? ', mirrored' : ''}</span>
      <span>From</span><span>${L ? 'Library: ' + esc(L.name) : o.libId ? 'Library (removed since)' : 'Project file'}</span>${o.libSaved ? `<span>Version</span><span>${esc(fmtDate(o.libSaved))}</span>` : ''}</div></div>
    ${fld('Left side at', txt('iX', fmt(b.x0)))}
    ${fld('Top side at', txt('iY', fmt(b.y0)))}
    ${fld('Ceiling', txt('iCeil', fmt(o.plan.ceiling || 8)))}
    ${fld('Plenum above', txt('iPlen', fmt(o.plan.plenum || 0)))}
    <div class="row"><button class="btn small" id="iL">⟲ Turn left</button><button class="btn small" id="iR">⟳ Turn right</button><button class="btn small" id="iM">Mirror</button></div>
    ${newer ? `<p class="note" style="color:#f2c84b">A newer version of “${esc(L.name)}” is in the library (saved ${esc(fmtDate(L.savedAt))}).</p><div class="row"><button class="btn small primary" id="iUpd">Update to the newer version</button></div>` : ''}
    <div class="row"><button class="btn small" id="iSwap">Replace with another building…</button></div>
    <div class="row"><button class="btn small" id="iUngroup">Ungroup into plain walls</button></div>
    <p class="note">Drag it on the plan to move it (its edges snap to wall ends); R turns it. It keeps its own ceiling, FFUs and parts-list section. Placed copies don't change when the library does; update or replace them here.</p>`;
  const nm = $('#iName'); nm.onchange = () => ed.edit(() => { o.name = nm.value.trim() || 'Building'; });
  bindLen('iX', 'ft', v => ed.edit(() => { o.x += v - b.x0; }));
  bindLen('iY', 'ft', v => ed.edit(() => { o.y += v - b.y0; }));
  bindLen('iCeil', 'ft', v => ed.edit(() => { o.plan.ceiling = Math.max(6, Math.min(30, v)); o._v = Date.now(); }));
  bindLen('iPlen', 'ft', v => ed.edit(() => { o.plan.plenum = Math.max(0, Math.min(20, v)); o._v = Date.now(); }));
  $('#iL').onclick = () => ed.edit(() => { o.rot = ((o.rot || 0) + 3) % 4; });
  $('#iR').onclick = () => ed.edit(() => { o.rot = ((o.rot || 0) + 1) % 4; });
  $('#iM').onclick = () => ed.edit(() => { o.mirror = !o.mirror; });
  const swapIn = (e) => ed.edit(() => { o.plan = Plan3DViewer.centredCopy(e.plan); delete o.plan.libId; o.libId = e.id; o.libSaved = e.savedAt; o.name = e.name; o._v = Date.now(); });
  if ($('#iUpd')) $('#iUpd').onclick = () => { swapIn(L); toast(`Updated to the ${fmtDate(L.savedAt)} version of “${L.name}”.`); };
  $('#iSwap').onclick = async () => { const e = await pickBuilding('Replace “' + (o.name || 'building') + '” with…', 'Use this'); if (e) { swapIn(e); toast(`Replaced with “${e.name}”, in the same spot.`); } };
  $('#iUngroup').onclick = async () => {
    const H0 = ed.plan.ceiling || 8, H1 = o.plan.ceiling || 8;
    const ok = await confirmDlg('Ungroup this building?', `Its walls, doors, chases and rooms become part of this plan, so you can edit them one by one. It stops being a separate building and joins the main parts-list section.${Math.abs(H0 - H1) > 0.01 ? ' Its rooms keep their ' + fmt(H1) + ' ceiling.' : ''} Ctrl+Z undoes it.`, 'Ungroup');
    if (!ok) return;
    ed.edit(Pl => {
      const zs = Plan3DViewer.zones({ walls: [], inserts: [o] }).slice(1), uid = Plan3DEditor.uid;
      if (zs.some(z => z.plan.ceilingMode === 'manual' && (z.plan.fixtures || []).length) && Pl.ceilingMode !== 'manual') { Pl.fixtures = Plan3DViewer.ceilingFixtures(Pl).map(f => ({ ...f, id: uid() })); Pl.ceilingMode = 'manual'; }
      for (const z of zs) {
        const ids = {}, nid = (id) => (ids[id] = ids[id] || uid());
        for (const w of z.plan.walls || []) Pl.walls.push({ ...w, id: nid(w.id) });
        for (const op of z.plan.openings || []) Pl.openings.push({ ...op, id: uid(), ...(op.unit ? { unit: nid(op.unit) } : {}) });
        for (const k of z.plan.chases || []) Pl.chases.push({ ...k, id: uid() });
        // its rooms keep its ceiling and plenum, so it stays at its own height inside this building
        const zk = { ceiling: z.plan.ceiling || 8, plenum: +z.plan.plenum || 0 };
        for (const r of z.plan.rooms || []) { const nr = { ...r, id: uid() }; if (!(nr.ceiling > 0) && Math.abs(zk.ceiling - (Pl.ceiling || 8)) > 0.01) nr.ceiling = zk.ceiling; if ((nr.plenum == null || nr.plenum === '') && Math.abs(zk.plenum - (+Pl.plenum || 0)) > 0.01) nr.plenum = zk.plenum; Pl.rooms.push(nr); }
        if (Pl.ceilingMode === 'manual') for (const f of Plan3DViewer.ceilingFixtures(z.plan)) Pl.fixtures.push({ ...f, id: uid() });
        if (!Pl.ffuModel && z.plan.ffuModel) Pl.ffuModel = z.plan.ffuModel;
      }
      Pl.inserts = Pl.inserts.filter(x => x !== o);
    });
    ed.sel = null; ed.emit('select'); toast('Ungrouped. Its walls are now part of this plan.');
  };
  $('#pDel').onclick = () => ed.deleteSel();
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
  if (r.kind === 'error' && r.code === 'revit') { revitHelp(r.name + r.ext); return; }
  if (r.kind === 'error') {
    const text = r.code === 'nodwg'
      ? `<p>DWG files need a free converter. Either:</p><ol class="help"><li>In AutoCAD, use <b>Save As → AutoCAD DXF (*.dxf)</b> and import the DXF, or</li><li>Install the free <b>ODA File Converter</b>, then import the DWG again. Coll Plan3D finds it automatically.</li></ol>`
      : r.code === 'dwgfail' ? `<p>The built-in DWG reader couldn't open ${esc(r.name)}. Either:</p><ol class="help"><li>In AutoCAD, use <b>Save As → AutoCAD DXF (*.dxf)</b> and import the DXF, or</li><li>Install the free <b>ODA File Converter</b>. Coll Plan3D uses it automatically for DWGs it can't read on its own.</li></ol>`
      : r.code === 'unsupported' ? `<p>Coll Plan3D can't read ${esc(r.ext)} files. Use DXF, DWG, PNG, JPG or a saved .plan3d project. For a PDF plan, export the page as PNG first.</p>`
      : `<p>Couldn't read ${esc(r.name)}. ${esc(r.message || '')}</p>`;
    const btns = [{ label: 'OK', primary: true, ret: null }];
    if (r.code === 'nodwg' || r.code === 'dwgfail') btns.unshift({ label: 'Get ODA File Converter', ret: 'oda' });
    const a = await dialogOpen({ title: r.code === 'nodwg' ? 'DWG needs one extra step' : "Can't open that file", body: text, buttons: btns });
    if (a === 'oda' && api.openUrl) api.openUrl('https://www.opendesign.com/guestfiles/oda_file_converter');
    return;
  }
  if (r.kind === 'project') {
    let p; try { p = JSON.parse(r.json); } catch (e) { toast('That project file is damaged.'); return; }
    if (adoptImported(p)) return;
    projectPath = r.path; modePicked = true; ed.setPlan(p); hideBanner(); updateChrome(); if (view !== '2d' && viewer) viewer.loadPlan(clonePlan());
    toast('Opened ' + (p.name || r.name)); trackJob(); setTimeout(() => checkComments(false), 1500); return;
  }
  if (r.kind === 'dxf') { if (await openCadProject(r)) return; dxfDialog(r); return; }
  if (r.kind === 'ifc') { ifcDialog(r); return; }
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
/* Import: into a new project, or (when this one already has a plan) added to it, so several buildings or
   drawings can be put together in one project */
let addMode = false;
async function importPlan() {
  if (!api.openFile) return;
  addMode = false;
  const P = ed.plan, has = (P.walls || []).length || (P.inserts || []).length;
  if (has) {
    const a = await dialogOpen({ title: 'Import', body: `<p>This project already has a plan in it. <b>Add</b> the file to it (another building, or more of the drawing to put together with what's here), or <b>replace</b> what's here with it?</p><p class="note">Added files come in at the middle of the screen as a group you drag into place. A Coll Plan3D project, DWG, DXF or Revit IFC can be added.</p>`, buttons: [{ label: 'Cancel', ret: null }, { label: 'Replace this plan', ret: 'new' }, { label: 'Add it to this project', primary: true, ret: 'add' }] });
    if (!a) return;
    if (a === 'add') { const r = await api.openFile('plan'); if (!r) return; if (r.kind === 'image') { toast('A picture can\'t be added to a project: import it on its own, or trace it into walls first.'); return; } addMode = true; handleLoaded(r); return; }
  }
  if (!(await guardUnsaved())) return;
  handleLoaded(await api.openFile('plan'));
}
// a plan read from a file while adding: put it in this project instead of replacing it. Asks how: as a building
// (moved and turned as one, its parts listed on their own) or as loose pieces (grouped, to drag into place and
// then join to what's here). Returns true when it took the plan.
function adoptImported(p, note) {
  if (!addMode) return false;
  addMode = false;
  const name = p.name || 'Imported plan', nW = (p.walls || []).length;
  if (!nW && !(p.inserts || []).length && !PIECE_LISTS.some(k => (p[k] || []).length) && !(p.ceilingGrid || []).length) { toast('Nothing to add: no walls came in from that file.'); return true; }
  (async () => {
    const inPlace = !!p.__inPlace; delete p.__inPlace;
    const a = await dialogOpen({ title: 'Add ' + name, body: `<p>${[nW ? nW + ' wall' + (nW === 1 ? '' : 's') : '', (p.beams || []).length ? p.beams.length + ' beam' + (p.beams.length === 1 ? '' : 's') : '', (p.fixtures || []).length ? p.fixtures.length + ' FFUs and lights' : '', (p.columns || []).length ? p.columns.length + ' columns' : '', (p.chases || []).length ? p.chases.length + ' chases' : '', (p.ceilingGrid || []).length ? 'a ceiling grid' : ''].filter(Boolean).join(', ')} from <b>${esc(name)}</b>.${inPlace ? ' It\'s set where it is on the drawing, lined up with this plan (both came from drawings in the same coordinates).' : ''} How should it go into this project?</p>
      <ul class="help"><li><b>As a separate building</b>: moved and turned as one (R turns it), with its own height, ceiling and section of the parts list. Good for another building on the site.</li>
      <li><b>As pieces of this plan</b>: its walls, doors, chases, rooms, FFUs and lights join this plan as a group. Drag the group into place (its walls catch on wall ends), then Ungroup to work on them like any other walls. Good for adding a room or a wing.</li></ul>${note ? `<p class="note">${esc(note)}</p>` : ''}`,
      buttons: nW && !inPlace ? [{ label: 'Cancel', ret: null }, { label: 'As pieces of this plan', ret: 'pieces' }, { label: 'As a separate building', primary: true, ret: 'bld' }] : [{ label: 'Cancel', ret: null }, { label: 'As a separate building', ret: 'bld' }, { label: 'As pieces of this plan', primary: true, ret: 'pieces' }] });
    if (!a) return;
    if (view === '3d' || view === 'build') setView('split');
    if (a === 'bld') {
      // lined up: the building goes where its walls are on the drawing
      let at = null; if (inPlace && nW) { let a0 = 1e9, b0 = 1e9, a1 = -1e9, b1 = -1e9; p.walls.forEach(w => { a0 = Math.min(a0, w.x1, w.x2); a1 = Math.max(a1, w.x1, w.x2); b0 = Math.min(b0, w.y1, w.y2); b1 = Math.max(b1, w.y1, w.y2); }); (p.chases || []).forEach(k => { a0 = Math.min(a0, k.x0, k.x1); a1 = Math.max(a1, k.x0, k.x1); b0 = Math.min(b0, k.y0, k.y1); b1 = Math.max(b1, k.y0, k.y1); }); at = { x: (a0 + a1) / 2, y: (b0 + b1) / 2 }; }
      placeBuilding(p, name, null, null, at); return;
    }
    // pieces: centred on their middle, put down at the middle of the screen, grouped and picked up
    const d = {}; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const e = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    (p.walls || []).forEach(w => { e(w.x1, w.y1); e(w.x2, w.y2); });
    // nothing but other pieces (beams, FFUs …): their spread
    if (!(x0 <= x1)) { for (const k of PIECE_LISTS) for (const o of p[k] || []) { if ('x0' in o && 'x1' in o) { e(o.x0, o.y0); e(o.x1, o.y1); } else if ('x2' in o) { e(o.x1, o.y1); e(o.x2, o.y2); } else if (isFinite(o.x)) e(o.x, o.y); } (p.ceilingGrid || []).forEach(q => { e(q[0], q[1]); e(q[2], q[3]); }); }
    const fx = p.ceilingMode === 'manual' ? p.fixtures || [] : [];
    for (const k of PIECE_LISTS) d[k] = JSON.parse(JSON.stringify(k === 'fixtures' ? fx : p[k] || []));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (const k of PIECE_LISTS) for (const o of d[k]) { if ('x0' in o && 'x1' in o) { o.x0 -= cx; o.x1 -= cx; o.y0 -= cy; o.y1 -= cy; } else if ('x2' in o) { o.x1 -= cx; o.x2 -= cx; o.y1 -= cy; o.y2 -= cy; } else { o.x -= cx; o.y -= cy; } }
    // lined up with the plan (same drawing coordinates): put back exactly where it was
    const px = inPlace ? cx : ed.wx(ed.W / 2), py = inPlace ? cy : ed.wy(ed.H / 2);
    const n = pastePieces(d, px, py, true);
    // its imported ceiling drawing comes along when this plan has none
    const withCeil = Array.isArray(p.ceilingGrid) && p.ceilingGrid.length && !(ed.plan.ceilingGrid || []).length;
    if (withCeil) { const gx = Math.round(px * 12) / 12 - cx, gy = Math.round(py * 12) / 12 - cy; ed.edit(Q => { Q.ceilingGrid = p.ceilingGrid.map(q => [q[0] + gx, q[1] + gy, q[2] + gx, q[3] + gy]); Q.ceilingMode = 'manual'; Q.ceilingSource = Q.ceilingSource || name; }); }
    ed.fit(); updateChrome(); queue3D();
    toast(`Added ${n} pieces from ${name} as a group${inPlace ? ', where they are on the drawing' : '. Drag it into place'}; Ctrl+Shift+G ungroups it.${withCeil ? ' Its ceiling drawing came too: once the walls are in place, line it up with Edit ceiling → Move or turn.' : ''}`);
  })();
  return true;
}
async function openProject() {
  if (!api.openFile) return;
  addMode = false;
  if (!(await guardUnsaved())) return;
  handleLoaded(await api.openFile('project'));
}
async function openSample() {
  if (!(await guardUnsaved())) return;
  handleLoaded(await api.loadSample(ed.plan.mode === 'house' ? 'house' : 'cleanroom'));
}
async function save(as) {
  if (!api.saveProject) return null;
  if (ed.plan.walls.length) ensureShare();
  // a plan sent as a link: the version the link is about to show is recorded in the file being saved
  const pubVer = ed.plan.share && ed.plan.share.pub ? recordPublished() : null;
  const p = await api.saveProject(JSON.stringify(ed.plan), as ? null : projectPath, ed.plan.name);
  if (p) {
    projectPath = p; ed.dirty = false; updateChrome(); trackJob();
    // a plan sent as a link: the link now shows what was just saved
    const pub = ed.plan.share && ed.plan.share.pub;
    toast(pub ? 'Saved. Updating the walkthrough link…' : 'Saved', { label: 'Show in folder', fn: () => api.showInFolder(p) });
    if (pub) publishLink(pubVer).then(() => toast('Saved. The walkthrough link shows this version.', { label: 'Show in folder', fn: () => api.showInFolder(p) })).catch(() => toast('Saved. The walkthrough link couldn’t update (no connection?); it will next time you save.'));
  }
  return p;
}
/* ---------- Walkthrough link: the plan goes up to Coll Business Solutions' server (without its private key)
   and opens from collbusinesssolutions.com/plan3d-viewer/?w=… on any phone or browser: nothing to attach or
   download. Saving the plan afterwards updates what the link shows. */
const VIEWER_LINK = 'https://collbusinesssolutions.com/plan3d-viewer/?w=';
function recordPublished() {
  const ver = new Date().toISOString();
  try { const snap = Plan3DDocs.snapshot(ed.plan, 'walkthrough link ' + ver.slice(0, 10)); ed.plan.published = (ed.plan.published || []).concat([{ ver, snap }]).slice(-6); } catch (e) { console.error(e); }
  return ver;
}
async function publishLink(verIn) {
  const S = ensureShare();
  const ver = verIn || recordPublished(); if (!verIn) ed.dirty = true;
  const put = async () => { await registerShare(); const plan = linkPlan(); plan.share = { id: S.id }; plan.ver = ver; return fetch(PLAN3D_CLOUD + '/walkthroughs/' + encodeURIComponent(S.id), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Plan3D-Key': S.key }, body: JSON.stringify({ plan }) }); };
  let r = await put();
  if (r.status === 404) { shareReg = ''; r = await put(); }  // the server didn't have this plan's key yet
  if (!r.ok) { let m = ''; try { m = (await r.json()).error; } catch (e) { /* not json */ } throw new Error(m || 'The server said ' + r.status + '.'); }
  if (!S.pub) { S.pub = true; ed.dirty = true; updateChrome(); }
  return VIEWER_LINK + S.id;
}
async function linkDialog() {
  if (!ed.plan.walls.length) { toast('Add some walls first.'); return; }
  toast('Making the link…');
  let url;
  try { url = await publishLink(); } catch (e) { toast('Couldn’t make the link: ' + ((e && e.message && !/fetch/i.test(e.message)) ? e.message : 'check your internet connection.')); return; }
  const copy = async () => { try { await navigator.clipboard.writeText(url); return true; } catch (e) { const i = $('#lnkUrl'); if (i) { i.select(); try { return document.execCommand('copy'); } catch (e2) { return false; } } return false; } };
  const copied = await copy();
  dialogOpen({ title: 'Walkthrough link', body: `<p>${copied ? '<b>Copied.</b> ' : ''}Paste it into a text or an email to your customer.</p>
    <input id="lnkUrl" readonly value="${esc(url)}" style="width:100%;font:13px Consolas,ui-monospace,monospace;padding:8px;border-radius:8px">
    <p class="note">It opens on any phone, tablet or computer, in Safari, Chrome, Edge or Firefox. There's nothing to download. Your customer can walk through it and leave comments; they show up under the 🔔. When you save changes to this plan, the link shows the new version (save first if you have unsaved changes).</p>`,
    onOpen: () => { const i = $('#lnkUrl'); if (i) { i.focus(); i.select(); } },
    buttons: [{ label: 'Open it', value: () => { if (api.openUrl) api.openUrl(url); return false; } }, { label: 'Copy link', value: () => { copy().then(ok => toast(ok ? 'Link copied.' : 'Select the link and press Ctrl+C.')); return false; } }, { label: 'Done', primary: true, ret: true }] });
}
async function exportHtml() {
  if (!ed.plan.walls.length) { toast('Add some walls first.'); return; }
  const a = await api.getAssets();
  const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
  const S = ensureShare();
  const plan = linkPlan(); plan.share = { id: S.id };  // the walkthrough can send comments, never read them
  plan.ver = recordPublished(); ed.dirty = true;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(plan.name)} — 3D Walkthrough</title>
<style>html,body{margin:0;height:100%;background:#121719}#v{position:fixed;inset:0}
:root{--st:env(safe-area-inset-top,0px);--sb:env(safe-area-inset-bottom,0px);--sl:env(safe-area-inset-left,0px);--sr:env(safe-area-inset-right,0px)}
/* a phone or tablet: the same layout as the online phone viewer */
#v.p3v-touch .p3v-right > .p3v-look:not(.p3v-lidb):not(.p3v-air){display:none}
@media (max-width:640px){#v .p3v-card{max-width:58vw}#v .p3v-mini{width:96px;height:110px}#v .p3v-hint{font-size:13px;white-space:normal;text-align:center;border-radius:14px}}
@media (orientation:landscape) and (max-height:540px){
#v .p3v-top{top:calc(8px + var(--st));left:calc(8px + var(--sl));right:calc(8px + var(--sr))}
#v .p3v-card{display:none}
#v .p3v-right{margin-left:auto;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:6px;max-width:calc(100vw - 28px - var(--sr))}
#v .p3v-modes{display:flex;overflow-x:auto;scrollbar-width:none;flex:0 1 auto;min-width:0}#v .p3v-modes::-webkit-scrollbar{display:none}
#v .p3v-modes button{flex:0 0 auto;padding:6px 11px;font-size:12.5px}#v .p3v-right > *{flex:0 0 auto}#v .p3v-right > .p3v-modes{flex:0 1 auto}
#v .p3v-cbtn{padding:6px 11px;font-size:13px;border-radius:999px}
#v.p3v-touch .p3v-clist{top:calc(50px + var(--st));right:calc(10px + var(--sr));max-height:calc(100% - 64px - var(--st) - var(--sb))}
#v .p3v-look{padding:6px 10px;font-size:12px}
#v .p3v-bottom{left:calc(10px + var(--sl));right:calc(10px + var(--sr));bottom:calc(8px + var(--sb));gap:6px}
#v .p3v-mini{width:104px;height:84px}#v .p3v-chips button{padding:6px 11px;font-size:12.5px}
#v .p3v-joy{left:calc(14px + var(--sl));bottom:calc(52px + var(--sb));width:112px;height:112px}#v .p3v-joy b{display:none}#v .p3v-hint{font-size:13px}}
</style></head>
<body><div id="v"></div>
<script>${safe(a.three)}</script>
<script>${safe(a.orbit)}</script>
<script>${safe(a.post || '')}</script>
<script>${safe(a.exporter || '')}</script>
<script>${safe(a.viewer)}</script>
<script>Plan3DViewer.mount(document.getElementById('v'), ${safe(JSON.stringify(plan))}, { joystick: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches), comments: true, startOutside: true, startMode: 'plenum', views: ['plenum', 'walk'], airflow: false, measure: false });</script>
<!-- Made with Coll Plan3D · Coll Business Solutions LLC -->
</body></html>`;
  const p = await api.exportFile(html, plan.name + ' walkthrough', 'html');
  if (p) toast('Walkthrough saved. It opens in any browser and can be emailed or texted. Your customer clicks 💬 Comment, leaves notes on anything and taps Send comments; they show up here on their own.', { label: 'Open it', fn: () => api.openPath(p) });
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
async function exportTwinmotion() {
  if (!ed.plan.walls.length) { toast('Add some walls first.'); return; }
  const v = ensureViewer(); viewer.setPlan(clonePlan());
  toast('Making the Twinmotion model…');
  let buf; try { buf = await v.exportTwinmotion(); } catch (e) { toast('Export failed: ' + e.message); return; }
  const p = await api.exportFile(buf, (ed.plan.name || 'Cleanroom') + ' for Twinmotion', 'glb'); if (!p) return;
  dialogOpen({ title: 'Twinmotion model saved', body: `<ol style="margin:0 0 8px 18px;padding:0;line-height:1.6">
    <li>In Twinmotion: <b>Import</b> → pick the .glb file. Leave <b>Collapse</b> off so the groups (Walls, Doors and glass, Ceiling, Fan filter units, Lights, Floor, Lid and structure) stay separate. Units are already metres, so it comes in at real size.</li>
    <li>Every material has a name (<i>Wall panel, white</i>, <i>Ceiling grid, aluminum</i>, <i>Floor, cleanroom coating</i>…) and a starting finish. To make it photo-real, drag Twinmotion materials onto them: painted metal on the wall panels, brushed aluminum on the grid and track, glass on the glass, a glossy epoxy or vinyl on the floor.</li>
    <li>Turn on <b>Path tracer</b>, set the camera at eye height (about 5′-6″) with a 24–35 mm lens, add a few people in gowns, and export the image or a video.</li></ol>
    <p class="note">The light lenses glow on their own; for real light, add rectangle lights under them in Twinmotion. Saving a new version of the plan and exporting again gives you an updated model to re-import.</p>`,
    buttons: [{ label: 'Show in folder', value: () => { api.showInFolder(p); return false; } }, { label: 'Done', primary: true, ret: true }] });
}
async function newPlan() { if (!(await guardUnsaved())) return; projectPath = null; modePicked = false; ed.setPlan(Editor.blank()); hideBanner(); updateChrome(); }

function helpDialog() {
  dialogOpen({
    wide: true, title: 'Quick guide',
    body: `<div class="help">
      <h4>From AutoCAD</h4><ol><li>Import plan → pick your .dwg or .dxf. DWG works right away; nothing else to install.</li><li>Tick the wall layers, check the size line reads right, and import.</li><li>Add doors, glass and air chases, label rooms, then switch to 3D.</li></ol>
      <h4>From a photo or scan</h4><ol><li>Shoot the sheet flat and straight-on. Import the image.</li><li>Rotate it upright in the right panel, then use Scale: click both ends of a known dimension and type it.</li><li>Detect walls, or trace them with the Wall tool. Typing a length while drawing places the wall exactly.</li></ol>
      <h4>Ceiling</h4><ul><li>Add ceiling picks a ceiling drawing (DWG, DXF) or a picture of one. Lights, fan filter units and the T-grid are placed over your room and show in 3D.</li><li>Click Add ceiling again to move, turn, replace or remove it.</li></ul>
      <h4>Revit</h4><ul><li>In Revit: File → Export → IFC, then Import plan here and pick the .ifc. Walls, doors, windows, rooms, lights and FFUs become an editable plan.</li><li>Save DWG / IFC → Revit 3D model saves the whole room in 3D. In Revit: File → Open → IFC, then Save As → Project for an .rvt.</li></ul>
      <h4>Back to AutoCAD</h4><ul><li>Save DWG / IFC (Ctrl+D) saves the plan 1:1 in inches on standard layers, with dimensions. DWG is built in (AutoCAD 2000 format, which every AutoCAD opens); with the free ODA File Converter installed you can also pick newer DWG versions.</li><li>Open that file in Coll Plan3D again and the doors, glass, chases and rooms come back exactly.</li></ul>
      <h4>Library</h4><ul><li>Library → Save this building keeps the whole plan (walls, doors, chases, ceiling, FFUs) on this computer.</li><li>Library → Insert from the library places a copy in the current plan, a cleanroom inside a warehouse for example. Drag it, R turns it; its panel can mirror it, set its ceiling, update it to a newer library version, swap it for another, or ungroup it into plain walls.</li><li>Placed copies never change on their own. Each building gets its own section of the parts list.</li><li>Groups: Shift-drag a box around pieces (or Shift+click them) on the plan, then Library → Save selected pieces as a group. Placing a group from the library drops it in the middle of the view; drag it into place. Ctrl+G groups pieces in the plan, Ctrl+Shift+G ungroups, Ctrl+C / Ctrl+V copy and paste, Ctrl+A selects everything.</li><li>Ceilings: Library → Save this ceiling keeps the grid, FFUs and lights; using one on another plan lays it from the building's corner, then Move or turn lines it up.</li><li>Pick a wall and set its Wall type: hardwall cleanroom panel, concrete, block, metal panel or stud/drywall. Set New wall type in the Plan panel to draw building walls with the Wall tool.</li></ul>
      <h4>Projects (houses, buildings, drafting)</h4><ul><li>Start with Build a project (or set Project type to Project in the Plan panel). Drafting (L) draws lines, polylines, rectangles, circles, arcs, text and dimensions on layers, with blocks, snaps and exact input.</li><li> New walls are wood studs; pick a wall to switch it to steel, set 2×4 / 2×6, or mark it exterior / interior.</li><li>Window (G) places 3′ windows; doors are 2′-8″ panel doors with 6′-8″ heads. Items (I) places kitchen, bath and laundry items that back up against the nearest wall; R turns them.</li><li>Roof: gable, hip or flat, with pitch and overhang, in the Plan panel. The Exterior view in 3D shows it.</li><li>Floors: one finish for the house, and per room from a room label. The parts list counts framing, sheathing, wrap, siding, insulation, drywall, roof, floors, doors, windows, trim, cabinets, counters and fixtures.</li></ul>
      <h4>Cleanroom check</h4><ul><li>Pick a room label and set its ISO class and pressure (Pa). The room shows its air changes per hour and filter coverage from the FFUs over it, green when it meets the class, red with how many FFUs it's short.</li><li>On the plan, arrows at doors show which way air flows; red means it flows from the less clean side or the difference is under 5 Pa. The same arrows show on the floor in 3D. The Plan panel lists every room and door that needs a look.</li></ul>
      <h4>Electrical</h4><ul><li>Electrical (E): pick a receptacle, switch, data jack, FFU controller, pressure monitor or panel, and click on a wall. It goes on that face at the usual mounting height.</li><li>Devices show in 3D and in the Revit export, and the parts list counts them with an estimate of branch circuits for FFUs, lights and receptacles.</li></ul>
      <h4>Warehouses</h4><ul><li>Overhead (H) puts an overhead sectional door in a wall; Column (U) places a steel or concrete column. Over building walls the roof gets open-web steel joists 5′ on center under the deck. All of it goes on the parts list and into Revit.</li></ul>
      <h4>Sharing and comments</h4><ul><li>Export walkthrough saves one .html file. Anyone can open it in a browser, on a phone too. Or send the .plan3d file to someone with the phone viewer (collbusinesssolutions.com/plan3d-viewer).</li><li>Your customer clicks 💬 Comment, clicks anything in the model, types a note and taps Send comments. The comments come straight to this app: it checks every minute while the plan is open (or click Check for comments in the Plan panel) and shows numbered pins on the plan and in 3D. With no internet they save a comments file instead, and Import comments file reads it.</li><li>Export .glb opens in Windows 3D Viewer, SketchUp, Blender and most 3D tools.</li></ul>
      <h4>Ceiling grid takeoff</h4><ul><li>The parts list counts main tees (12′), 4′ cross tees, 2′ cross tees at 2 × 2 fixtures and hanger wires from the grid as laid out over each room.</li></ul></div>`,
    buttons: [{ label: 'Close', primary: true, ret: null }]
  });
}

$('#bSave').onclick = () => save(false);
/* ---------- The top menus: File, Ceiling, Library, Job, Share ----------
   They work like a menu bar: click one to open it, and while one is open, moving over another opens that
   one. Arrow keys move through the items (← → to the next menu), Esc closes. */
const MENUS = [...document.querySelectorAll('.actions .dd > .btn[aria-haspopup="menu"]')].map(btn => ({ btn, menu: btn.parentElement.querySelector('.menu') }));
const openMenu = () => MENUS.find(m => !m.menu.hidden) || null;
function closeMenus() { for (const m of MENUS) { m.menu.hidden = true; m.btn.setAttribute('aria-expanded', 'false'); } }
function showMenu(m, focus) {
  closeMenus(); m.menu.hidden = false; m.btn.setAttribute('aria-expanded', 'true');
  // keep it on screen at the right edge of a narrow window
  m.menu.style.left = ''; const r = m.menu.getBoundingClientRect(); if (r.right > innerWidth - 8) m.menu.style.left = (innerWidth - 8 - r.right) + 'px';
  if (focus) { const b = [...m.menu.querySelectorAll('button')].find(x => x.offsetParent); if (b) b.focus(); }
}
const visibleMenus = () => MENUS.filter(m => m.btn.offsetParent);
for (const m of MENUS) {
  m.btn.onclick = (e) => { e.stopPropagation(); if (!m.menu.hidden) closeMenus(); else showMenu(m, e.detail === 0); };
  m.btn.addEventListener('mouseenter', () => { const o = openMenu(); if (o && o !== m) showMenu(m, false); });
  m.menu.addEventListener('keydown', (e) => {
    const items = [...m.menu.querySelectorAll('button')].filter(x => x.offsetParent), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const V = visibleMenus(), k = V.indexOf(m); showMenu(V[(k + (e.key === 'ArrowRight' ? 1 : V.length - 1)) % V.length], true); }
  });
}
document.addEventListener('click', (e) => { const o = openMenu(); if (o && !o.menu.contains(e.target)) closeMenus(); });
document.addEventListener('keydown', (e) => { const o = openMenu(); if (e.key === 'Escape' && o) { closeMenus(); o.btn.focus(); } });
{
  const item = (id, fn) => { const b = $(id); if (b) b.onclick = (e) => { closeMenus(); fn(e); }; };
  // File
  item('#bOpen', openProject); item('#bImport', importPlan); item('#bOpenSample', openSample); item('#bSave2', () => save(false)); item('#bSaveAs', () => save(true)); item('#bNewPlan', newPlan);
  // Ceiling
  item('#bCeiling', (e) => ceilingMenu(e)); item('#bGenCeil', generateCeilingDialog); item('#bLightsDwg', lightsDrawingDialog); item('#bLid', lidMenu);
  // Library
  item('#bBldInsert', () => libraryDialog()); item('#bBldFile', insertFromFile); item('#bBldSave', saveBuildingDialog);
  item('#bLibGroup', saveGroupDialog); item('#bLibCeil', saveCeilingDialog); item('#bLibMach', addMachineDialog);
  // Job and Share
  item('#bExportLink', linkDialog); item('#bExportHtml', exportHtml); item('#bSubm', submittalDialog); item('#bPOs', poDialog); item('#bSched', scheduleDialog); item('#bCert', certExport); item('#bSnaps', () => snapsDialog()); item('#bCO', () => changeOrderDialog()); item('#bApproved', () => markApproved('')); item('#bSheet', sheetDialog); item('#bQuote', quoteDialog); item('#bFab', fabSheets); item('#bExportCad', () => { cadFmt = cadFmt === 'ifc' ? 'dwg' : cadFmt; cadDialog(); });
  item('#bExportIfc', () => exportIfc(true)); item('#bExportGlb', exportGlb); item('#bExportTm', exportTwinmotion); item('#bExportParts', exportParts);
}
/* ---------- Find (Ctrl+K): every menu command and tool, by what you type ---------- */
function findDialog() {
  closeMenus();
  const L = [];
  for (const b of document.querySelectorAll('.actions .menu [role=menuitem]')) {
    const dd = b.closest('.dd'); if (dd && getComputedStyle(dd).display === 'none') continue;
    const sp = b.querySelector('span'), sm = sp && sp.querySelector('small'), name = sp ? sp.firstChild.textContent.trim() || sp.textContent.trim() : b.textContent.trim();
    const menuName = dd ? dd.querySelector('.btn').firstChild.textContent.trim() : '';
    L.push({ name, sub: sm ? sm.textContent : '', where: menuName, kbd: (b.querySelector('kbd') || {}).textContent || '', run: () => b.click() });
  }
  for (const b of document.querySelectorAll('nav.tools [data-tool]')) {
    if (getComputedStyle(b).display === 'none') continue;
    const sp = [...b.querySelectorAll('span')].find(x => getComputedStyle(x).display !== 'none');
    L.push({ name: (sp ? sp.textContent : b.dataset.tool) + ' tool', sub: (b.title || '').replace(/\s*\([^)]*\)\s*$/, ''), where: 'Tools', kbd: (b.querySelector('kbd') || {}).textContent || '', run: () => b.click() });
  }
  for (const b of document.querySelectorAll('.views [data-view]')) if (getComputedStyle(b).display !== 'none') L.push({ name: b.textContent.trim() + ' view', sub: '', where: 'View', kbd: { '2d': 'F1', split: 'F2', '3d': 'F3', build: 'F4' }[b.dataset.view] || '', run: () => b.click() });
  let pick = 0, shown = L;
  const score = (o, q) => { const t = (o.name + ' ' + o.sub + ' ' + o.where).toLowerCase(), n = o.name.toLowerCase(); if (!q) return 1; let s = 0; for (const w of q.split(/\s+/).filter(Boolean)) { if (n.startsWith(w)) s += 4; else if (n.includes(w)) s += 3; else if (t.includes(w)) s += 1; else return 0; } return s; };
  const render = () => {
    const q = $('#fdQ').value.trim().toLowerCase();
    shown = L.map(o => [o, score(o, q)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 12);
    pick = Math.min(pick, Math.max(0, shown.length - 1));
    $('#fdL').innerHTML = shown.length ? shown.map((o, i) => `<button class="fdi${i === pick ? ' on' : ''}" data-i="${i}"><span><b>${esc(o.name)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span><em>${esc(o.where)}${o.kbd ? ' · ' + esc(o.kbd) : ''}</em></button>`).join('') : '<p class="note" style="padding:8px 10px">Nothing matches. Try a different word.</p>';
    $$('#fdL [data-i]').forEach(b => b.onclick = () => go(+b.dataset.i));
  };
  const go = (i) => { const o = shown[i]; if (!o) return; $('#dlg').close(); setTimeout(o.run, 30); };
  dialogOpen({ title: 'Find a command', body: `<input id="fdQ" placeholder="Type what you want to do: quote, door, ceiling, AutoCAD…" autocomplete="off" style="width:100%;padding:9px 10px;font-size:14px"><div id="fdL" class="fdl"></div>`, buttons: [{ label: 'Close', ret: null }],
    onOpen: (d) => { d.classList.add('finddlg'); const q = $('#fdQ'); q.focus(); render(); q.oninput = () => { pick = 0; render(); };
      q.onkeydown = (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); pick = (pick + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % Math.max(1, shown.length); render(); } else if (e.key === 'Enter') { e.preventDefault(); go(pick); } }; } });
}
$('#bFind').onclick = findDialog;
// Shift+P: the snapshots, large (P on its own takes one in 3D)
document.addEventListener('keydown', (e) => { if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'p' && !e.repeat && !document.querySelector('dialog[open]') && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') && !(e.target && e.target.isContentEditable)) { e.preventDefault(); snapsDialog(); } });
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) { e.preventDefault(); findDialog(); } });
 $('#wImport').onclick = importPlan; $('#wSample').onclick = openSample;
$('#wCleanroom').onclick = () => pickMode('cleanroom'); $('#wHouse').onclick = () => pickMode('house');
$('#wBack').onclick = (e) => { e.preventDefault(); modePicked = false; updateChrome(); };
$('#wDraw').onclick = () => { $('#welcome').hidden = true; ed.setTool('wall'); $('#plan').focus(); };

if (api.onMenu) api.onMenu(async (a) => {
  ({ import: importPlan, open: openProject, sample: openSample, save: () => save(false), saveas: () => save(true), 'export-html': exportHtml, 'export-glb': exportGlb,
     new: newPlan, undo: () => ed.undo(), redo: () => ed.redo(), 'view-2d': () => setView('2d'), 'view-split': () => setView('split'), 'view-3d': () => setView('3d'), 'view-build': () => setView('build'), 'export-parts': exportParts, sheet: sheetDialog, 'export-cad': cadDialog, 'export-ifc': () => exportIfc(true), ceiling: ceilingMenu,
     fit: () => ed.fit(), help: helpDialog,
     'request-close': async () => {
       if (!ed.dirty) return api.confirmClose();
       if (api.closeDialog) api.closeDialog(true);
       if (await guardUnsaved()) api.confirmClose(); else if (api.closeCancelled) api.closeCancelled();
     } }[a] || (() => {}))();
});
/* ---------- Updates: a new version downloads in the background, then Update now installs it ---------- */
if (api.onUpdate) {
  const b = $('#bUpdate');
  api.onUpdate((u) => {
    if (u.state === 'downloading') { b.hidden = false; b.disabled = true; b.textContent = 'Update ' + (u.percent ? u.percent + '%' : '…'); b.title = 'Downloading the new version of Coll Plan3D'; }
    else if (u.state === 'ready') {
      b.hidden = false; b.disabled = false; b.textContent = 'Update now' + (u.version ? ' to ' + u.version : '');
      toast('Coll Plan3D ' + (u.version || '') + ' is ready to install.', { label: 'Update now', fn: () => b.click() });
    }
    else if (u.state === 'checking') toast('Checking for updates…');
    else if (u.state === 'current') toast('You have the latest version (' + u.version + ').');
    else if (u.state === 'error') toast("Couldn't check for updates. " + (u.message || ''));
  });
  b.onclick = async () => {
    if (b.disabled) return;
    if (!(await guardUnsaved())) return;
    b.disabled = true; b.textContent = 'Installing…';
    const ok = await api.installUpdate();
    if (!ok) { b.disabled = false; b.textContent = 'Update now'; toast("The update isn't ready yet."); }
  };
}
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
if (api.rendererReady) api.rendererReady();
window.__app = { standardDoors, snapsDialog, lightsDrawingDialog, ensureShare, checkComments, recordPublished, linkPlan, mergeComments, markApproved, changeOrderDialog, exportHtml, wallHeightDialog, setAddMode: (v) => { addMode = v; }, adoptImported, libraryDialog, saveGroupDialog, saveCeilingDialog, collectPieces, pastePieces, applyCeiling, ed, setView, handleLoaded, placeBuilding, saveBuildingDialog, insertBuildingDialog, loadBldLib, ceilingDialogs: { cad: cadCeilingDialog, image: imageCeilingDialog, move: moveCeilingDialog }, exportIfc, get viewer() { return viewer; }, get builder() { return builder; } };
})();
