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
  onTool: (t) => { $$('.tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); $('.pane2d').dataset.tool = t; $('#pal2d').hidden = t !== 'piece'; $('#itemPal').hidden = t !== 'item'; if (t === 'item') itemPalette(); $('#elecPal').hidden = t !== 'elec'; if (t === 'elec') elecPalette(); if (t === 'piece') hideBanner(); toolHint(t); },
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

function welcomeText() {
  const house = ed.plan.mode === 'house';
  $('#wTitle').textContent = house ? 'Design a house in 3D' : 'Turn a floor plan into a 3D walkthrough';
  $('#wText').textContent = house ? 'Draw the walls (wood or steel studs), add doors and windows, pick a roof, place the kitchen, bath and laundry, then walk through it. The parts list counts the framing, drywall, siding, roof and more.' : 'Bring in an AutoCAD drawing or a photo of the plan sheet, check the walls, add doors, glass and air chases, then walk through it.';
  $('#wSampleText').textContent = house ? 'A 3-bedroom ranch house with kitchen, two baths and laundry' : 'SOM base cleanroom: 8′-6″ and 11′ grids, 3′ plenum, MAC 10 FFUs';
}
function pickMode(m) {
  modePicked = true;
  const P = Editor.blank(); if (m === 'house') houseDefaults(P); else P.mode = 'cleanroom';
  projectPath = null; ed.setPlan(P); updateChrome(); renderProps();
}
function msg(t) { $('#sMsg').textContent = t || 'Ready'; }
const HINTS = {
  overhead: 'Click on a wall to put an overhead sectional door there (12′ wide, head 2′ below the top of the wall). Change its size in its properties.',
  column: 'Click to place a building column. Its size and steel or concrete are in its properties; it runs up to the roof structure.',
  elec: 'Pick a device above, then click on a wall: it goes on that face of the wall, facing the room you clicked in. Heights follow the usual mounting heights; change one in its properties.',
  select: 'Click to select. Drag to move. Drag a wall end to stretch it. Drag empty space to pan. Delete removes.',
  build: 'Build mode: pick a piece and click to place it.',
  wall: 'Click corners to draw walls. Type a length (e.g. 23\'8-3/4) and press Enter. Hold Alt for free angles. Esc to finish.',
  door: 'Click on a wall, or in a gap between walls, to place a 3′ door.',
  door2: 'Click on a wall, or in a gap between walls, to place a 6′ pair of doors.',
  glass: 'Click on a wall to place a 4′ glass panel.',
  open: 'Click on a wall to place a cased opening (no door).',
  pass: 'Click on a wall to place a 24″ × 24″ stainless pass-thru.',
  chase: 'Drag a rectangle to place a full-height air chase.',
  carea: 'Drag a rectangle inside a room to give that part of it its own ceiling height. Bulkhead panels fill the step where it meets the rest of the ceiling.',
  room: 'Click inside a room to label it.',
  beam: 'Click both ends of a steel beam (I-beam). Over the cleanroom it spans wall to wall in the plenum, its top level with the top of the walls; otherwise it goes up under the roof. Pick it to change its size or height.',
  measure: 'Click two points to measure between them. Snaps to wall ends and lines up with them; Alt for any angle. Esc clears.',
  calibrate: 'Click both ends of a dimension you know, like the 40′ overall.',
  item: 'Pick an item above, then click near a wall: it backs up against the wall. R turns it. Islands, tables, rugs, lights, cars and outdoor pieces go anywhere.',
  piece: 'Pick a piece above and click to place it, or drag to lay a whole run of panels. Drag a placed panel with Select to move it; its ends catch on nearby walls. Pieces snap to open ends and turn the corner toward the mouse. R turns a free piece. Right-drag pans.'
};
function itemPalette() {
  // one group at a time, picked from a row of tabs, so the palette stays small over the plan
  const IT = Plan3DViewer.ITEMS, groups = {};
  for (const [k, v] of Object.entries(IT)) (groups[v.group] = groups[v.group] || []).push([k, v]);
  if (!ed.itemType || !IT[ed.itemType]) ed.itemType = 'base';
  const names = Object.keys(groups); if (!ed.itemGroup || !groups[ed.itemGroup]) ed.itemGroup = IT[ed.itemType].group;
  $('#itemPal').innerHTML = `<div class="grp"><div class="row">${names.map(g => `<button data-ig="${esc(g)}" class="${ed.itemGroup === g ? 'on' : ''}"><b>${esc(g)}</b></button>`).join('')}</div></div>`
    + `<div class="grp"><div class="row">${groups[ed.itemGroup].map(([k, v]) => `<button data-it="${k}" class="${ed.itemType === k ? 'on' : ''}">${esc(v.label)}</button>`).join('')}</div></div>`;
  $$('#itemPal button[data-ig]').forEach(b => b.onclick = () => { ed.itemGroup = b.dataset.ig; const first = groups[ed.itemGroup][0]; if (first && IT[ed.itemType].group !== ed.itemGroup) ed.itemType = first[0]; itemPalette(); $('#plan').focus(); });
  $$('#itemPal button[data-it]').forEach(b => b.onclick = () => { ed.itemType = b.dataset.it; itemPalette(); $('#plan').focus(); });
}
function elecPalette() {
  const DV = Plan3DViewer.DEVICES, groups = {};
  for (const [k, v] of Object.entries(DV)) (groups[v.group] = groups[v.group] || []).push([k, v]);
  if (!ed.deviceType) ed.deviceType = 'outlet';
  $('#elecPal').innerHTML = Object.entries(groups).map(([g, list]) => `<div class="grp"><h5>${esc(g)}</h5><div class="row">${list.map(([k, v]) => `<button data-dv="${k}" class="${ed.deviceType === k ? 'on' : ''}">${esc(v.label)}</button>`).join('')}</div></div>`).join('');
  $$('#elecPal button').forEach(b => b.onclick = () => { ed.deviceType = b.dataset.dv; elecPalette(); $('#plan').focus(); });
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
  $('#modeChip').textContent = house ? 'House' : 'Cleanroom';
  $('#docName').textContent = (P.name || 'Untitled plan') + (ed.dirty ? ' •' : '');
  document.title = (P.name || 'Untitled plan') + ' — Coll Plan3D';
  const cb = $('#bCeiling'); if (cb) cb.textContent = (P.ceilingSource || (P.ceilingMode === 'manual' && (P.fixtures || []).length)) ? 'Edit ceiling' : 'Add ceiling';
  const empty = !P.walls.length && !P.chases.length && !P.background && !(P.inserts || []).length;
  $('#welcome').hidden = !empty;
  if (empty) { $('#wPick').hidden = modePicked; $('#wNext').hidden = !modePicked; welcomeText(); }
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

const TOOL_KEYS = { v: 'select', n: 'piece', w: 'wall', d: 'door', f: 'door2', g: 'glass', o: 'open', p: 'pass', c: 'chase', r: 'room', k: 'calibrate', m: 'measure', b: 'beam', i: 'item', e: 'elec', h: 'overhead', u: 'column', a: 'carea' };
const HOUSE_ONLY = new Set(['item']), CLEANROOM_ONLY = new Set(['piece', 'pass', 'chase', 'column', 'carea']);
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
function wallTopOf(P, w) {
  try { for (const z of Plan3DViewer.zones(P)) if ((z.plan.walls || []).includes(w)) return Math.max(6, z.plan.ceiling || 8) + Math.max(0, +z.plan.plenum || 0); } catch (e) { /* fall back to the building's */ }
  const K = Plan3DViewer.roomKey(P, null); return K.H + K.PL;
}
function renderProps(opt) {
  const box = $('#props'), P = ed.plan, s = ed.sel, o = ed.selected();
  let h = '';
  if (ed.multi && ed.multi.length > 1) {
    const M = ed.multi, cnt = {}, NAMES = { wall: 'wall', opening: 'doors and windows', chase: 'chase', room: 'room label', device: 'device', item: 'item', column: 'column', insert: 'building', beam: 'beam', carea: 'ceiling area', fixture: 'FFUs and lights' };
    M.forEach(r => { cnt[r.kind] = (cnt[r.kind] || 0) + 1; });
    const grouped = M.every(r => { const x = ed.find(r); return x && x.gid && x.gid === ed.find(M[0]).gid; });
    box.innerHTML = `<div class="hd"><span class="kind">${M.length} pieces selected${grouped ? ' (a group)' : ''}</span><button class="btn small danger" id="mDel">Delete</button></div>
      <div class="grp"><div class="stats">${Object.entries(cnt).map(([k, n]) => `<span>${esc(NAMES[k] || k)}${n > 1 && k !== 'opening' && k !== 'fixture' ? 's' : ''}</span><span>${n}</span>`).join('')}</div></div>
      <div class="row">${grouped ? '<button class="btn small" id="mUngroup">Ungroup</button>' : '<button class="btn small" id="mGroup">Group them</button>'}<button class="btn small" id="mCopy">Copy</button></div>
      <div class="row"><button class="btn small primary" id="mSave">Save to the library…</button></div>
      <p class="note">Drag any of them to move them all; their walls catch on nearby wall ends (hold Alt to move freely). Shift+click adds or takes out one piece; Shift-drag a box adds more. A group stays together: clicking one piece picks up the whole group. Ctrl+G groups, Ctrl+Shift+G ungroups, Ctrl+C / Ctrl+V copy and paste.</p>`;
    $('#mDel').onclick = () => ed.deleteSel();
    if ($('#mGroup')) $('#mGroup').onclick = () => { ed.groupSel(true); renderProps(); };
    if ($('#mUngroup')) $('#mUngroup').onclick = () => { ed.groupSel(false); renderProps(); };
    $('#mCopy').onclick = copyPieces; $('#mSave').onclick = saveGroupDialog;
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
      ${hard ? fld('S.P. panel', `<label class="chk"><input type="checkbox" id="pSP" ${o.sp ? 'checked' : ''}> Highlight yellow</label>`) : fld('Height', txt('pWH', fmt(KINDS[kind].frame ? (o.h || P.ceiling || 8) : Plan3DViewer.shellHeight(P, o))))}
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
    bindLen('pWH', 'ft', v => ed.edit(() => { o.h = Math.max(6, Math.min(80, v)); }));
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
    const types = P.mode === 'house' ? [['door', 'Door'], ['door2', 'Double door'], ['window', 'Window'], ['open', 'Cased opening'], ['glass', 'Glass panel'], ['overhead', 'Overhead door']] : [['door', 'Single door'], ['door2', 'Pair of doors'], ['glass', 'Glass panel'], ['window', 'Window'], ['open', 'Cased opening'], ['pass', 'Pass-thru'], ['overhead', 'Overhead door']];
    const isPass = o.type === 'pass', sill = o.sill == null ? 3 : o.sill;
    h = `<div class="hd"><span class="kind">${esc(types.find(t => t[0] === o.type)[1])}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Type', `<select id="pType">${types.map(t => `<option value="${t[0]}" ${t[0] === o.type ? 'selected' : ''}>${t[1]}</option>`).join('')}</select>`)}
      ${fld('Width', txt('pW', fmt(len)))}
      ${isPass ? fld('Height', txt('pPH', fmtIn((o.head || 5) - sill))) + fld('Bottom at', txt('pSill', fmt(sill))) + fld('Depth', txt('pDepth', fmtIn(o.depth || 2))) : fld(o.type === 'glass' || o.type === 'window' ? 'Top' : 'Head height', txt('pHead', fmt(o.head || 7)))}
      ${o.type === 'glass' || o.type === 'window' ? fld('Sill height', txt('pSill', fmt(sill))) : ''}
      ${o.type === 'overhead' ? `<div class="row"><button class="btn small" id="pSwing">Flip inside face</button></div>` : ''}
      ${o.type === 'door' || o.type === 'door2' ? `<div class="row"><button class="btn small" id="pSwing">Flip swing side</button>${o.type === 'door' ? '<button class="btn small" id="pHinge">Swap hinge side</button>' : ''}</div>` : ''}
      <p class="note">${isPass ? 'Stainless box with a door on each face. Depth is front to back through the wall. ' : ''}Drag along the wall to slide it. Drag it onto another wall to move it there.</p>`;
    box.innerHTML = h;
    $('#pType').onchange = e => ed.edit(() => { const was = o.type; o.type = e.target.value; if (o.type === 'window' && was !== 'window') { o.sill = 3; o.head = 6 + 8 / 12; } if (o.type === 'glass' && o.sill == null) o.sill = 3; if (o.type === 'pass') { o.sill = 3; o.head = 5; o.depth = o.depth || 2; } else if (was === 'pass') { o.head = 7; if (o.type !== 'glass') delete o.sill; } });
    bindLen('pW', 'ft', v => ed.edit(() => { const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1, ux = (o.x2 - o.x1) / L, uy = (o.y2 - o.y1) / L, cx = (o.x1 + o.x2) / 2, cy = (o.y1 + o.y2) / 2; o.x1 = cx - ux * v / 2; o.y1 = cy - uy * v / 2; o.x2 = cx + ux * v / 2; o.y2 = cy + uy * v / 2; }));
    // openings in building walls can be taller than the cleanroom ceiling (an overhead door, say)
    const topFor = () => { let best = null, bd = 1.5; for (const w of P.walls) { const d = Plan3DViewer.segDist((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, w.x1, w.y1, w.x2, w.y2); if (d < bd) { bd = d; best = w; } } return best && !Plan3DViewer.isHard(best) ? Plan3DViewer.shellHeight(P, best) : P.ceiling; };
    bindLen('pHead', 'ft', v => ed.edit(() => { o.head = Math.min(topFor(), Math.max(1, v)); }));
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
  if (s && o && s.kind === 'carea') {
    const K = Plan3DViewer.roomKey(P, null), top = K.H + K.PL, w = Math.abs(o.x1 - o.x0), d = Math.abs(o.y1 - o.y0);
    h = `<div class="hd"><span class="kind">Ceiling area</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Ceiling', txt('pCaH', fmt(+o.ceiling || K.H)))}
      ${fld('Size', `<span class="mono">${esc(fmt(Math.max(w, d)))} × ${esc(fmt(Math.min(w, d)))}</span>`)}
      <p class="note">This part of the room gets its own ceiling, raised or dropped. Where its edge crosses open ceiling, bulkhead panels fill the step (on the parts list with their H-studs and closure channel); along walls the ceiling track follows it. It stays at least 3″ under the top of the walls (${esc(fmt(top))}); to go higher, raise the plenum or the walls. Drag its outline or label to move it.</p>`;
    box.innerHTML = h;
    bindLen('pCaH', 'ft', v => ed.edit(() => { o.ceiling = Math.max(6, Math.min(40, v)); }));
    $('#pDel').onclick = () => ed.deleteSel();
    return;
  }
  if (s && o && s.kind === 'fixture') {
    h = `<div class="hd"><span class="kind">${o.type === 'ffu' ? 'Fan filter unit' : 'LED light'}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${fld('Type', `<select id="pFx"><option value="led" ${o.type !== 'ffu' ? 'selected' : ''}>LED light, 2×4</option><option value="ffu" ${o.type === 'ffu' ? 'selected' : ''}>Fan filter unit, 2×4</option></select>`)}
      <div class="row"><button class="btn small" id="pFxTurn">Turn 90° (R)</button></div>
      <p class="note">Sits in the 2′ × 4′ ceiling grid. Turned across the grid, it takes half of two cells side by side: the cross tee moves to its edge and the other half gets one 2′ × 4′ tile laid the same way.</p>`;
    box.innerHTML = h;
    $('#pFx').onchange = e => ed.edit(() => { o.type = e.target.value; });
    $('#pFxTurn').onclick = () => ed.turnFixture(o);
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
      <p class="note">Auto: over the cleanroom it spans from wall to wall in the plenum, its top level with the top of the walls (the plan shows where it lands); otherwise up under the roof. Beams go on the parts list (length and weight) and into the Revit export. Drag to move; Shift-drag a box to move a set of them.</p>`;
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
      ${fld('Type', `<select id="pDvT">${Object.entries(DV).map(([k, v]) => `<option value="${k}" ${o.type === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>`)}
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
  if (s && o && s.kind === 'item') {
    const D = Plan3DViewer.ITEMS[o.type] || { label: o.type };
    h = `<div class="hd"><span class="kind">${esc(D.label)}</span><button class="btn small danger" id="pDel">Delete</button></div>
      ${D.wv ? fld('Width', txt('pIW', fmtIn(o.w || D.w))) : fld('Size', `<span>${fmtIn(o.w || D.w)} × ${fmtIn(o.d || D.d)}</span>`)}
      ${o.type === 'island' || o.type === 'shower' ? fld('Depth', txt('pID', fmtIn(o.d || D.d))) : ''}
      <div class="row"><button class="btn small" id="pIL">⟲ Turn</button><button class="btn small" id="pIR">⟳ Turn</button><button class="btn small" id="pIDup">Add another beside it</button></div>
      <p class="note">Drag it along a wall; it stays backed against the wall. R turns it. It goes on the parts list${o.type === 'base' || o.type === 'sinkbase' || o.type === 'island' ? ' with its countertop' : ''}.</p>`;
    box.innerHTML = h;
    bindLen('pIW', 'in', v => ed.edit(() => { o.w = Math.max(0.75, Math.min(16, v)); }));
    bindLen('pID', 'in', v => ed.edit(() => { o.d = Math.max(1, Math.min(10, v)); }));
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
    if ($('#pRIso')) $('#pRIso').onchange = e => { ed.edit(() => { if (e.target.value) o.iso = +e.target.value; else delete o.iso; }); renderProps(); };
    const numIn = (id, key, lo, hi) => { const el = $('#' + id); if (!el) return; el.onchange = () => { const raw = el.value.trim(); if (!raw) { ed.edit(() => { delete o[key]; }); renderProps(); return; } const v = parseFloat(raw.replace(/[^\d.+-]/g, '')); if (isFinite(v)) { ed.edit(() => { o[key] = Math.max(lo, Math.min(hi, v)); }); renderProps(); } }; };
    numIn('pRPa', 'pressure', -200, 200); numIn('pRAch', 'ach', 0, 1000);
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
  h = `<div class="hd"><span class="kind">${house ? 'House' : 'Plan'}</span></div>
    ${fld('Name', txt('pPName', P.name))}
    ${fld(house ? 'Wall height' : 'Ceiling', txt('pCeil', fmt(P.ceiling)))}
    ${house ? '' : fld('Plenum above', txt('pPlen', fmt(P.plenum || 0))) + `<p class="note" style="margin-top:-4px">Plenum: the space between the grid ceiling and the top of the cleanroom. Walls are ${esc(fmt((P.ceiling || 8) + (P.plenum || 0)))} tall.</p>`}
    ${fld('New wall type', `<select id="pNK">${kindList.map(([k, v]) => `<option value="${k}" ${(P.newKind || (house ? 'wood' : 'hardwall')) === k ? 'selected' : ''}>${esc(v.short)}</option>`).join('')}</select>`)}
    ${fld('New walls', txt('pWT', fmtIn(P.wallT || 0.25)))}
    ${(P.walls.some(w => !Plan3DViewer.isHard(w) && !Plan3DViewer.isFrame(w)) || shellNew) ? fld('Building wall height', txt('pSH', fmt(P.shellH || 20))) : ''}
    ${house ? `<div class="grp"><h3>Roof and floors</h3>
      ${fld('Roof', `<select id="pRoof">${[['gable', 'Gable'], ['hip', 'Hip'], ['flat', 'Flat (low slope)'], ['none', 'No roof']].map(([k, l]) => `<option value="${k}" ${(R.type || 'none') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${R.type && R.type !== 'none' && R.type !== 'flat' ? fld('Pitch (rise in 12)', txt('pPitch', String(R.pitch == null ? 6 : R.pitch))) : ''}
      ${R.type && R.type !== 'none' ? fld('Overhang', txt('pOver', fmt(R.overhang == null ? 1 : R.overhang))) : ''}
      ${fld('Floors', `<select id="pFloor">${Object.entries(Plan3DViewer.FLOORS).map(([k, l]) => `<option value="${k}" ${(P.floorType || 'lvp') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      <p class="note">Pick a room label to give that room its own floor. Pick a wall for its framing (wood or steel), stud size and exterior / interior.</p></div>
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
    ${house ? '' : ffuPanelHtml(P)}
    ${house ? '' : checkGroupHtml(P)}
    ${commentsGroupHtml(P)}
    ${fld('Project type', `<select id="pMode"><option value="cleanroom" ${house ? '' : 'selected'}>Cleanroom</option><option value="house" ${house ? 'selected' : ''}>House</option></select>`)}`;
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
  bindLen('pPlen', 'ft', v => ed.edit(Pl => { Pl.plenum = Math.max(0, Math.min(20, v)); }));
  if ($('#pRoof')) $('#pRoof').onchange = e => ed.edit(Pl => { Pl.roof = Object.assign({ pitch: 6, overhang: 1 }, Pl.roof || {}, { type: e.target.value }); });
  if ($('#pPitch')) $('#pPitch').onchange = e => { const v = parseFloat(e.target.value); if (v >= 0 && v <= 24) ed.edit(Pl => { Pl.roof.pitch = v; }); };
  bindLen('pOver', 'ft', v => ed.edit(Pl => { Pl.roof.overhang = Math.max(0, Math.min(4, v)); }));
  if ($('#pFloor')) $('#pFloor').onchange = e => ed.edit(Pl => { Pl.floorType = e.target.value; });
  for (const [id, key] of [['fSid', 'siding'], ['fSidC', 'sidingColor'], ['fRoof', 'roof'], ['fRoofC', 'roofColor'], ['fPaint', 'paint'], ['fCab', 'cabinet'], ['fCtr', 'counter']]) if ($('#' + id)) $('#' + id).onchange = e => ed.edit(Pl => { Pl.finish = Object.assign({}, Pl.finish || {}, { [key]: e.target.value }); });
  $('#pMode').onchange = e => { const m = e.target.value; ed.edit(Pl => { if (m === 'house') houseDefaults(Pl, true); else Pl.mode = 'cleanroom'; }); updateChrome(); renderProps(); };
  bindLen('pWT', 'in', v => { ed.plan.wallT = Math.max(1 / 48, v); renderProps(); });
  $('#pNK').onchange = e => { const k = e.target.value, K = Plan3DViewer.WALL_KINDS[k]; ed.plan.newKind = k === 'hardwall' && !house ? undefined : k; ed.plan.wallT = k === 'hardwall' ? 0.25 : K.t; ed.dirty = true; renderProps(); msg(k === 'hardwall' ? 'New walls: hardwall cleanroom panels.' : 'New walls: ' + K.label + ', ' + fmtIn(K.t) + ' thick. Draw them with the Wall tool (W).'); };
  bindLen('pSH', 'ft', v => ed.edit(Pl => { Pl.shellH = Math.max(6, Math.min(80, v)); }));
  $('#pSnap').onchange = e => { ed.snapIn = +e.target.value; };
  bindParts();
  bindComments(P);
  if (!house) bindFfuPanel(P);
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
function roomCheckHtml(P, o) {
  const C = (() => { try { return Plan3DViewer.cleanroomCheck(P); } catch (e) { return null; } })(), q = C && C.rooms.find(x => x.room === o);
  let h = `<div class="grp"><h3>Cleanroom class and pressure</h3>
    ${fld('ISO class', `<select id="pRIso"><option value="">Not set</option>${[5, 6, 7, 8, 9].map(k => `<option value="${k}" ${+o.iso === k ? 'selected' : ''}>ISO ${k}${k === 5 ? ' (Class 100)' : k === 6 ? ' (Class 1,000)' : k === 7 ? ' (Class 10,000)' : k === 8 ? ' (Class 100,000)' : ''}</option>`).join('')}</select>`)}
    ${fld('Pressure', txt('pRPa', o.pressure != null && o.pressure !== '' ? String(o.pressure) : '', 'Pa, e.g. 15'))}
    ${fld('Air changes target', txt('pRAch', o.ach > 0 ? String(o.ach) : '', q && q.iso ? 'ISO ' + q.iso + ' typical: ' + C.targets[q.iso].ach + '/hr' : 'per hour'))}`;
  if (q) {
    h += `<div class="stats">
      <span>Floor area</span><span>${Math.round(q.area)} sq ft</span>
      <span>Volume</span><span>${Math.round(q.volume).toLocaleString()} cu ft <small>(${esc(fmt(q.H))} ceiling)</small></span>
      <span>FFUs over it</span><span>${q.ffus} · ${Math.round(q.cfm).toLocaleString()} CFM</span>
      <span>Air changes</span><span${q.achTarget ? ` style="color:${q.ach >= q.achTarget ? '#6fd08c' : '#ff7a6b'}"` : ''}>${Math.round(q.ach)} /hr${q.achTarget ? ' <small>(needs ' + q.achTarget + ')</small>' : ''}</span>
      <span>Filter coverage</span><span${q.covTarget ? ` style="color:${q.coverage >= q.covTarget ? '#6fd08c' : '#ff7a6b'}"` : ''}>${Math.round(q.coverage)}%${q.covTarget ? ' <small>(needs ' + q.covTarget + '%)</small>' : ''}</span></div>`;
    if (q.iso) h += `<p class="note" style="color:${q.ok ? '#6fd08c' : '#ff7a6b'}">${q.ok ? 'Meets typical ISO ' + q.iso + ' design airflow.' : 'Short for ISO ' + q.iso + ': ' + esc(q.short.join('; ')) + '.'}</p>`;
  } else h += `<p class="note">Put this label inside walls to see its airflow.</p>`;
  h += `<p class="note">Pressure is relative to outside the cleanroom (0 Pa). On the plan, arrows at doors show which way air flows; red means it flows from the less clean side or the difference is under 5 Pa. Targets are typical design ranges, not a certification.</p></div>`;
  return h;
}
function checkGroupHtml(P) {
  if (!(P.rooms || []).some(r => r.iso || (r.pressure != null && r.pressure !== ''))) return `<div class="grp"><h3>Cleanroom check</h3><p class="note">Pick a room label and set its ISO class and pressure to check air changes, filter coverage and the pressure cascade.</p></div>`;
  const C = (() => { try { return Plan3DViewer.cleanroomCheck(P); } catch (e) { return null; } })(); if (!C) return '';
  const rows = C.rooms.filter(q => q.iso || q.pressure != null).map(q => `<div class="pl-row"><span>${esc(q.room.name || 'Room')}<small>${q.iso ? 'ISO ' + q.iso + ' · ' : ''}${Math.round(q.ach)} ACH${q.achTarget ? ' / ' + q.achTarget : ''} · ${Math.round(q.coverage)}% coverage${q.pressure != null ? ' · ' + (q.pressure > 0 ? '+' : '') + q.pressure + ' Pa' : ''}</small></span><b style="color:${!q.iso ? 'inherit' : q.ok ? '#6fd08c' : '#ff7a6b'}">${!q.iso ? '–' : q.ok ? '✓' : '✗'}</b></div>`).join('');
  const nm = (r) => r ? esc(r.name || 'Room') : 'outside';
  const dw = C.doors.filter(d => d.warn).map(d => `<div class="pl-row"><span>${nm(d.a)} ↔ ${nm(d.b)}<small>${esc(d.warn)}</small></span><b style="color:#ff7a6b">!</b></div>`).join('');
  return `<div class="grp"><h3>Cleanroom check</h3><div class="pl">${rows}${dw ? '<div class="pl-cat">Doors</div>' + dw : ''}</div>
    <p class="note">Air changes and filter coverage from the FFUs over each room, against typical ISO class design ranges. Pressure arrows on the plan show the cascade.</p></div>`;
}

/* ---------- Customer comments (from the walkthrough page) ---------- */
function commentsGroupHtml(P) {
  const L = P.comments || [];
  const rows = L.map((c, i) => `<div class="pl-row"><span><b>${i + 1}.</b> ${esc(c.text)}<small>${esc(c.by || 'Customer')} · ${esc((c.at || '').slice(0, 10))}${c.done ? ' · done' : ''}</small></span><b><button class="btn small" data-cdone="${esc(c.id)}" title="${c.done ? 'Mark open' : 'Mark done'}">${c.done ? '↺' : '✓'}</button><button class="btn small danger" data-cdel="${esc(c.id)}" title="Delete">✕</button></b></div>`).join('');
  return `<div class="grp"><h3>Customer comments</h3>${L.length ? `<div class="pl">${rows}</div>` : '<p class="note">Export a walkthrough page and send it. Your customer clicks 💬 Comment, leaves notes on anything, and sends you back a comments file.</p>'}
    <div class="row"><button class="btn small" id="pCImp">Import comments file…</button></div>
    ${L.length ? '<p class="note">Numbered pins show on the plan and in 3D where each comment was left. Comments go out with the next walkthrough you send, so your customer sees what you marked done.</p>' : ''}</div>`;
}
function bindComments(P) {
  const imp = $('#pCImp'); if (imp) imp.onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => {
      let d; try { d = JSON.parse(rd.result); } catch (e) { toast('That file isn’t a comments file.'); return; }
      const list = Array.isArray(d) ? d : d && Array.isArray(d.comments) ? d.comments : null; if (!list) { toast('That file isn’t a comments file.'); return; }
      let n = 0; ed.edit(Pl => { Pl.comments = Pl.comments || []; for (const c of list) { if (!c || !c.text || !isFinite(c.x) || !isFinite(c.y)) continue; if (Pl.comments.some(q => q.id === c.id)) continue; Pl.comments.push({ id: String(c.id || Plan3DEditor.uid()), x: +c.x, y: +c.y, h: +c.h || 0, text: String(c.text).slice(0, 2000), by: String(c.by || '').slice(0, 60), at: String(c.at || ''), ref: c.ref || null }); n++; } });
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
  try { dxf = Plan3DCad.toDxf(clonePlan(), { dims: o.dims, fixtures: o.fixtures }); }
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
  projectPath = null; ed.setPlan(p); ed.dirty = true; hideBanner(); updateChrome();
  if (view !== '2d' && viewer) viewer.loadPlan(clonePlan());
  toast('Opened ' + (p.name || r.name) + ' from the ' + (/\.dwg$/i.test(r.path || '') ? 'DWG' : 'DXF') + '. Save it as a project to keep working.');
  return true;
}

/* ---------- Generate ceiling: grid, FFUs and lights laid out inside the cleanroom walls ---------- */
async function generateCeilingDialog() {
  const P = ed.plan;
  if (!P.walls.length) { toast('Draw or import the cleanroom walls first, then generate the ceiling inside them.'); return; }
  const G0 = Plan3DViewer.ceilingGrid(P), has = P.ceilingSource || (P.ceilingGrid && P.ceilingGrid.length) || P.ceilingImage || (P.ceilingMode === 'manual' && (P.fixtures || []).length);
  const nF0 = (P.fixtures || []).filter(f => f.type === 'ffu').length, nL0 = (P.fixtures || []).length - nF0;
  const FM = P.ffuModel && P.ffuModel.sizes && P.ffuModel.sizes.length ? P.ffuModel : null;
  const opts = await dialogOpen({
    title: 'Generate ceiling',
    body: `<p>Lays out a 2′ × 4′ grid centred in the biggest room (so the cut tiles at its two walls match), then in every room inside the cleanroom walls: enough fan filter units for the room's cleanroom class, and lights spread evenly in the cells left over. Cells against walls, chases and ceiling-area edges are skipped. Everything stays editable: drag, delete, add or turn (R) any FFU or light afterwards.</p>
      ${fld('Class for rooms without one', `<select id="gcIso">${[5, 6, 7, 8, 9].map(n => `<option value="${n}" ${n === 7 ? 'selected' : ''}>ISO ${n} (${Plan3DViewer.ISO_TARGETS[n].ach} air changes, ${Plan3DViewer.ISO_TARGETS[n].cov}% FFU coverage)</option>`).join('')}</select>`)}
      ${fld('Lights', `<select id="gcLt"><option value="48">Bright: one per 48 sq ft</option><option value="64" selected>Standard: one per 64 sq ft</option><option value="80">One per 80 sq ft</option><option value="100">Low: one per 100 sq ft</option></select>`)}
      ${fld('Grid', `<select id="gcSw"><option value="0" ${!G0.swap ? 'selected' : ''}>4′ side of the tiles runs up and down the plan</option><option value="1" ${G0.swap ? 'selected' : ''}>4′ side of the tiles runs across the plan</option></select>`)}
      <p class="note">FFU airflow: ${FM ? esc(FM.name) + ', ' + ((FM.sizes.find(q => q.nominal === '2x4') || FM.sizes[0]).cfm || '?') + ' CFM per 2×4 (pick another model in the Plan panel)' : 'no FFU model picked, so 720 CFM per 2×4 (90 fpm); pick a model in the Plan panel for its real airflow'}. A room's own class (set on its room label) wins over the one above. A room label's <b>Generated ceiling</b> setting can also give a room a ceiling no matter what, lights but no FFUs, or no ceiling. Gaps of up to 20′ between cleanroom wall ends count as closed.</p>
      ${has ? `<p class="note" style="color:var(--warn)">This replaces the current ceiling${P.ceilingSource ? ' from ' + esc(P.ceilingSource) : ''} (${nF0} FFUs, ${nL0} lights). Ctrl+Z puts it back.</p>` : ''}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Generate', primary: true, value: () => ({ iso: +$('#gcIso').value, sqftPerLight: +$('#gcLt').value, swap: $('#gcSw').value === '1' }) }]
  });
  if (!opts) return;
  const R = Plan3DViewer.generateCeiling(P, opts);
  if (!R || !R.rooms.length) { toast('No room inside cleanroom (hardwall) walls was found to put a ceiling in.'); return; }
  ed.edit(Q => { Q.ceilGrid = R.ceilGrid; Q.fixtures = R.fixtures; Q.ceilRects = R.ceilRects; Q.ceilingMode = 'manual'; Q.ceilingSource = 'Generated'; delete Q.ceilingGrid; delete Q.ceilingImage; delete Q.fixturesFinal; });
  updateChrome(); renderProps();
  const short = R.rooms.filter(r => r.ffu < r.need);
  await dialogOpen({
    title: 'Ceiling generated',
    wide: true,
    body: `<p>${R.fixtures.filter(f => f.type === 'ffu').length} FFUs and ${R.fixtures.filter(f => f.type !== 'ffu').length} lights in ${R.rooms.length} room${R.rooms.length === 1 ? '' : 's'}.</p>
      <div class="layers"><label style="grid-template-columns:1.6fr .6fr .8fr .9fr .6fr .9fr;cursor:default"><b>Room</b><b>Class</b><b>Area</b><b>FFUs</b><b>Lights</b><b>Air changes</b></label>
      ${R.rooms.map(r => `<label style="grid-template-columns:1.6fr .6fr .8fr .9fr .6fr .9fr;cursor:default"><span>${esc(r.name)}</span><span>ISO ${r.iso}</span><span>${Math.round(r.area)} sq ft</span><span${r.ffu < r.need ? ' style="color:var(--warn)"' : ''}>${r.ffu}${r.ffu < r.need ? ' of ' + r.need : ''}</span><span>${r.led}${r.lightsOnly ? ' (no FFUs)' : ''}</span><span>${Math.round(r.achGot)} / ${r.ach}</span></label>`).join('')}</div>
      ${short.length ? `<p class="note" style="color:var(--warn)">${short.map(r => esc(r.name)).join(', ')}: not enough whole ceiling cells for the FFUs that class needs. Pick a bigger FFU model, a lower class, or move a chase or wall.</p>` : ''}
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
      const G = Plan3DViewer.ceilingGrid(P); let moved = 0;
      ed.edit(Q => { Q.fixtures = (Q.fixtures || []).map(f => { const w = f.w || (G.swap ? 4 : 2), h = f.h || (G.swap ? 2 : 4), n = Plan3DViewer.snapFixture({ ...f, w, h }, G); if (Math.hypot(n.x - f.x, n.y - f.y) > 0.01) moved++; return { ...f, x: n.x, y: n.y, w, h }; }); });
      toast(moved ? `Moved ${moved} fixture${moved === 1 ? '' : 's'} into the grid cells.` : 'Everything already sits in the grid.'); return;
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
    ed.edit(P => { P.ceilingGrid = placed.grid; P.fixtures = placed.fixtures; P.ceilingMode = 'manual'; delete P.ceilRects; P.ceilingSource = data.name; delete P.ceilingImage; });
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
    projectPath = null; ed.setPlan(p); ed.dirty = true; hideBanner(); updateChrome();
    if (view === '2d') setView('split'); else if (viewer) viewer.loadPlan(clonePlan());
    toast(a === 'saved' ? 'Opened ' + p.name + ' from the IFC.' : `Imported ${p.walls.length} walls and ${p.openings.length} doors and windows from ${data.name}. Edit anything, then Save.`);
  });
}

/* ---------- Fan filter unit model (manufacturer data, Revit families) ---------- */
let equipLib = [];
if (api.equipLib) api.equipLib().then(l => { equipLib = Array.isArray(l) ? l : []; if (!ed.sel) renderProps(); });
const allFfuModels = () => [...Plan3DEquipment.BUILT_IN, ...equipLib.filter(m => !Plan3DEquipment.BUILT_IN.some(b => b.id === m.id))];
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
async function addRevitFamily() {
  if (!api.readRfa) return;
  const r = await api.readRfa(); if (!r) return;
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
/* The rest of the sheet: a ceiling grid, FFU / light layouts and steel beams drawn off to the side. The grid
   is slid onto the walls where its ends land on walls best (inside the building, if there's one); beams are
   centred on the same spot; FFU layouts can't be matched to a room, so each comes in as a group just below
   the cleanroom, ready to drag into its room (they land in the grid's cells). */
function sheetExtrasToPlan(data, o, walls, bld, p) {
  const ex = IMP.sheetExtras(data, o), F = IMP.dxfFrame(data, o), k = o.unitFt, said = [];
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; walls.forEach(w => { if (bld && bld.has && bld.has(w.id)) { bx0 = Math.min(bx0, w.x1, w.x2); bx1 = Math.max(bx1, w.x1, w.x2); by0 = Math.min(by0, w.y1, w.y2); by1 = Math.max(by1, w.y1, w.y2); } });
  const inBld = bx0 < bx1 ? (a, b, c, d) => a >= bx0 - 1 && c <= bx1 + 1 && b >= by0 - 1 && d <= by1 + 1 : null;
  let target = null, dx = 0, dy = 0;
  const g = ex.grids[0];
  if (g) {
    const al = IMP.alignToWalls(g.lines, walls, inBld);
    if (al.score >= 0.35) { dx = al.dx; dy = al.dy; target = { x0: g.box.x0 + dx, y0: g.box.y0 + dy, x1: g.box.x1 + dx, y1: g.box.y1 + dy }; }
    p.ceilingGrid = g.lines.map(q => [q[0] + dx, q[1] + dy, q[2] + dx, q[3] + dy]);
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
    p.beams = ex.beams.map(b => ({ id: Plan3DEditor.uid(), x1: q(b.x1 + mx), y1: q(b.y1 + my), x2: q(b.x2 + mx), y2: q(b.y2 + my), size: 'W12x26' }));
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
function dxfDialog(data, preset) {
  preset = preset || {};
  const opTypes = {};
  const names = Object.keys(data.layers).sort((a, b) => data.layers[b] - data.layers[a]);
  if (!names.length) { dialogOpen({ title: 'Nothing to import', body: '<p>This drawing has no lines or polylines Coll Plan3D can read. If the walls are inside blocks or xrefs, explode or bind them in AutoCAD and save as DXF again.</p>', buttons: [{ label: 'OK', primary: true, ret: null }] }); return; }
  const wallish = names.filter(n => /wall|partition|panel|a-wall|^wa/i.test(n) && !/detl|detail|path|walk|egress|patt/i.test(n));
  const notWall = /title|dim|text|anno|defpoints|border|logo|watermark|hatch|furn|grid|tag|note|symbol|xref|viewport|detl|detail|path|walk|egress|patt|^0$/i;
  const pre = new Set(preset.layers ? names.filter(n => preset.layers.includes(n)) : wallish.length ? wallish : names.filter(n => !notWall.test(n)).length ? names.filter(n => !notWall.test(n)) : names);
  const iu = data.insunits;
  const unitOpts = [[1, 'Inches'], [2, 'Feet'], [4, 'Millimeters'], [5, 'Centimeters'], [6, 'Meters']];
  const defUnit = preset.unit || (IMP.UNIT_FT[iu] && iu ? iu : 1);
  dialogOpen({
    wide: true,
    title: 'Import ' + data.name,
    body: `<p>Pick the layers that hold the walls. Turning off dimension, text and furniture layers gives a cleaner result.</p>
      <div class="layers" id="dxLayers">${names.map(n => `<label><input type="checkbox" value="${esc(n)}" ${pre.has(n) ? 'checked' : ''}><span>${esc(n)}</span><small>${data.layers[n]} lines</small></label>`).join('')}</div>
      <div class="row"><button type="button" class="btn small" id="dxAll">All</button><button type="button" class="btn small" id="dxNone">None</button></div>
      ${fld('Drawing units', `<select id="dxU">${unitOpts.map(([v, l]) => `<option value="${v}" ${v === defUnit ? 'selected' : ''}>${l}${v === iu ? ' (from file)' : ''}</option>`).join('')}</select>`)}
      ${fld('Walls drawn as', `<select id="dxM"><option value="double">Two parallel lines</option><option value="single">Single centerline</option></select>`)}
      ${fld('Wall thickness', '<input type="text" id="dxT" value="2&quot; to 8&quot;">')}
      ${fld('Separate drawings', `<select id="dxC"><option value="all">Everything on the sheet</option><option value="main">Only the main building (skip copies and loose bits off to the side)</option></select>`)}
      ${fld('Also bring in', `<label class="chk"><input type="checkbox" id="dxX" checked> Ceiling grid, FFUs and lights, and steel beams drawn on the sheet, lined up on the cleanroom</label>`)}
      ${fld('Outside walls', `<select id="dxB"><option value="auto">Building walls when a cleanroom stands inside them (warehouse)</option><option value="all">Always building walls</option><option value="none">Cleanroom hardwall</option></select>`)}
      ${fld('Building walls are', `<select id="dxBK"><option value="auto">Metal panel up to 6″, concrete if thicker</option><option value="metal">Metal panel</option><option value="concrete">Concrete</option><option value="cmu">Concrete block</option><option value="stud">Steel stud and drywall</option></select>`)}
      <p class="sizeline" id="dxSize"></p>
      <div id="dxOpsWrap"><h4 style="margin:12px 0 6px">Doors and windows in the drawing</h4><div class="layers" id="dxOps" style="max-height:150px"></div></div>`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Import walls', primary: true, value: () => readDx() }],
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
      $('#dxAll').onclick = () => { $$('#dxLayers input').forEach(i => i.checked = true); upd(); };
      $('#dxNone').onclick = () => { $$('#dxLayers input').forEach(i => i.checked = false); upd(); };
      $('#dxM').onchange = () => { $('#dxT').value = $('#dxM').value === 'single' ? '3"' : '2" to 8"'; };
      try { const c = localStorage.getItem('p3d.dxClusters'); if (c && $('#dxC')) $('#dxC').value = c; } catch (e) { /* no storage */ }
      upd();
    }
  }).then(o => {
    if (!o) return;
    try { localStorage.setItem('p3d.dxClusters', o.clusters); } catch (e) { /* no storage */ }
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
    const extra = o.extras && walls.length ? sheetExtrasToPlan(data, o, walls, bld, p) : null;
    if (walls.length) { const t = walls.map(w => w.t).sort((a, b) => a - b); p.wallT = t[t.length >> 1]; }
    projectPath = null; ed.setPlan(p); ed.dirty = true; updateChrome();
    const f = ops.found, parts = [];
    if (f.door) parts.push(f.door + ' door' + (f.door > 1 ? 's' : '')); if (f.door2) parts.push(f.door2 + ' pair' + (f.door2 > 1 ? 's' : '') + ' of doors');
    if (f.glass) parts.push(f.glass + ' window' + (f.glass > 1 ? 's' : '')); if (f.pass) parts.push(f.pass + ' pass-thru' + (f.pass > 1 ? 's' : ''));
    const exText = extra && extra.text ? ' ' + extra.text : '';
    const opsText = parts.length ? ' and ' + parts.join(', ') : '. No door or window symbols were found; add them with the Door, Pair and Glass tools';
    const bldText = bld.size ? ` The ${bld.size} outside walls are the building (${Plan3DViewer.WALL_KINDS[walls.find(w => bld.has(w.id)).kind].short.toLowerCase()}); pick one to change it.` : '';
    const skipText = !skipped ? '' : o.clusters === 'all' ? ` Left out ${skipped} loose wall bit${skipped === 1 ? '' : 's'} standing on ${skipped === 1 ? 'its' : 'their'} own (a curb or a sign on a wall layer).` : ` Left out ${skipped} wall${skipped === 1 ? '' : 's'} away from the main building (a copy off to the side, loose bits); import again with “Separate drawings: Everything on the sheet” to keep them.`;
    if (walls.length) showBanner(`Imported ${walls.length} walls${opsText}.${bldText}${skipText}${exText} Check them, then add chases and rooms.`, [{ label: 'View in 3D', primary: true, fn: () => { hideBanner(); setView('split'); } }]);
    else showBanner('No walls were found with these settings. Try "Single centerline", a wider thickness range, or other layers.', [{ label: 'Try again', primary: true, fn: () => dxfDialog(data, preset) }]);
  });
  function readDx() {
    const layers = new Set($$('#dxLayers input').filter(i => i.checked).map(i => i.value));
    const unitFt = IMP.UNIT_FT[+$('#dxU').value] || 1 / 12, mode = $('#dxM').value;
    const tv = $('#dxT').value.split(/to|-|–/i).map(s => parseLen(s.trim(), 'in')).filter(v => v > 0);
    const minT = tv.length > 1 ? Math.min(...tv) : (tv[0] || 0.25) * 0.6, maxT = tv.length > 1 ? Math.max(...tv) : (tv[0] || 0.25) * 1.5;
    return { layers, unitFt, mode, minT, maxT, tFt: tv[0] || 0.25, minLen: 0.75, keepOrigin: !!preset.keepOrigin, bldMode: ($('#dxB') || {}).value || 'auto', bldKind: ($('#dxBK') || {}).value || 'auto', clusters: ($('#dxC') || {}).value || 'all', extras: !$('#dxX') || $('#dxX').checked };
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
function placeBuilding(src, name, libId, libSaved) {
  const plan = Plan3DViewer.centredCopy(src); delete plan.libId;
  const g = 0.5, cx = ed.W ? ed.wx(ed.W / 2) : 0, cy = ed.H ? ed.wy(ed.H / 2) : 0;
  const ins = { id: Plan3DEditor.uid(), name: name || plan.name || 'Building', libId: libId || null, libSaved: libSaved || null, x: Math.round(cx / g) * g, y: Math.round(cy / g) * g, rot: 0, mirror: false, plan };
  ed.edit(P => { (P.inserts = P.inserts || []).push(ins); });
  ed.setTool('select'); ed.sel = { kind: 'insert', id: ins.id }; ed.emit('select'); ed.render(); queue3D();
  toast(`Placed “${ins.name}”. Drag it into place; R turns it. Its parts are a separate section of the parts list.`);
}
async function insertBuildingDialog() { return libraryDialog('building'); }

/* ---------- The library: buildings, groups of pieces, ceilings ----------
   A group is any set of pieces (walls, doors, chases, devices, items …) saved together and placed as a
   group you can drag; a ceiling is a ceiling drawing's grid and fixtures, laid on a plan from its corner. */
const LIB_TYPES = { building: 'Buildings', group: 'Groups of pieces', ceiling: 'Ceilings' };
const PIECE_LISTS = ['walls', 'openings', 'chases', 'rooms', 'devices', 'items', 'columns', 'beams', 'fixtures'];
// the selected pieces (with the doors in their walls), copied and centred on 0,0
function collectPieces(refs) {
  const R2 = ed.withOpenings(refs), out = {}, LIST = { wall: 'walls', opening: 'openings', chase: 'chases', room: 'rooms', device: 'devices', item: 'items', column: 'columns', beam: 'beams', fixture: 'fixtures' };
  PIECE_LISTS.forEach(k => { out[k] = []; });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const r of R2) { const L = LIST[r.kind], o = ed.find(r); if (!L || !o) continue; out[L].push(JSON.parse(JSON.stringify(o))); for (const [x, y] of ed.refPts(r)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  if (!(x0 <= x1)) return null;
  const cx = Math.round((x0 + x1) / 2 * 12) / 12, cy = Math.round((y0 + y1) / 2 * 12) / 12;
  const mv = (o) => { if ('x1' in o && 'x0' in o) { o.x0 -= cx; o.x1 -= cx; o.y0 -= cy; o.y1 -= cy; } else if ('x1' in o) { o.x1 -= cx; o.x2 -= cx; o.y1 -= cy; o.y2 -= cy; } else { o.x -= cx; o.y -= cy; } delete o.gid; };
  PIECE_LISTS.forEach(k => out[k].forEach(mv));
  out.w = x1 - x0; out.h = y1 - y0;
  return out;
}
// put a copy of saved pieces in the plan around (x, y); new ids; selected (and grouped, if asked) afterwards
function pastePieces(data, x, y, group) {
  const g = 1 / 12; x = Math.round(x / g) * g; y = Math.round(y / g) * g;
  const ids = new Map(), gid = group ? Plan3DEditor.uid() : null, refs = [], KIND = { walls: 'wall', openings: 'opening', chases: 'chase', rooms: 'room', devices: 'device', items: 'item', columns: 'column', beams: 'beam', fixtures: 'fixture' };
  ed.edit(P => {
    // FFUs and lights join a drawn ceiling: an automatic one becomes hand-placed first
    if ((data.fixtures || []).length && P.ceilingMode !== 'manual') { P.fixtures = Plan3DViewer.ceilingFixtures(P).map(f => ({ id: Plan3DEditor.uid(), type: f.type, x: f.x, y: f.y })); P.ceilingMode = 'manual'; }
    for (const k of PIECE_LISTS) for (const src of data[k] || []) {
      const o = JSON.parse(JSON.stringify(src)), nid = Plan3DEditor.uid(); ids.set(o.id, nid); o.id = nid;
      if ('x0' in o && 'x1' in o) { o.x0 += x; o.x1 += x; o.y0 += y; o.y1 += y; } else if ('x2' in o) { o.x1 += x; o.x2 += x; o.y1 += y; o.y2 += y; } else { o.x += x; o.y += y; }
      if (gid) o.gid = gid; else delete o.gid;
      (P[k] = P[k] || []).push(o); refs.push({ kind: KIND[k], id: nid });
    }
    for (const o of P.openings) if (o.unit && ids.has(o.unit)) o.unit = ids.get(o.unit);
  });
  ed.setTool('select'); ed.setMulti(refs);
  return refs.length;
}
let pieceClip = null;
function copyPieces() { const refs = ed.multi || (ed.sel ? [ed.sel] : []); const d = refs.length ? collectPieces(refs) : null; if (d) { pieceClip = d; toast('Copied ' + refs.length + ' piece' + (refs.length > 1 ? 's' : '') + '. Ctrl+V pastes them.'); } }
function pastePiecesHere() { if (!pieceClip) return; const C = ed.cursor || { x: ed.wx(ed.W / 2), y: ed.wy(ed.H / 2) }; const n = pastePieces(pieceClip, C.x, C.y, false); toast(`Pasted ${n} piece${n > 1 ? 's' : ''}. Drag them into place.`); }
function libThumb(e) {
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
  const P = ed.plan, has = (P.ceilingGrid && P.ceilingGrid.length) || P.ceilingImage || (P.ceilingMode === 'manual' && (P.fixtures || []).length);
  if (!has) { toast('This plan has no ceiling of its own to save yet. Add a ceiling drawing or place FFUs and lights first.'); return; }
  const A = Plan3DViewer.analyze(P), ox = A.empty ? 0 : A.bounds.minX, oy = A.empty ? 0 : A.bounds.minZ;
  const r = await dialogOpen({ title: 'Save this ceiling to the library', body: `<p>Saves the ceiling grid, FFUs and lights (and a ceiling picture, if there is one), measured from the building's corner, so you can lay it on another plan from <b>Library → Insert from the library</b>.</p>${fld('Name', txt('cName', (P.ceilingSource || P.name || 'Ceiling').replace(/\.(dwg|dxf|png|jpe?g)$/i, '') + ' ceiling'))}`,
    buttons: [{ label: 'Cancel', ret: null }, { label: 'Save', primary: true, value: () => $('#cName').value.trim() }], onOpen: () => { $('#cName').focus(); $('#cName').select(); } });
  if (r == null) return;
  const C = { source: P.ceilingSource || '', grid: (P.ceilingGrid || []).map(q => [q[0] - ox, q[1] - oy, q[2] - ox, q[3] - oy]), fixtures: (P.ceilingMode === 'manual' ? P.fixtures || [] : []).map(f => ({ ...f, x: f.x - ox, y: f.y - oy })) };
  if (P.ceilingImage) C.image = { ...P.ceilingImage, x: P.ceilingImage.x - ox, y: P.ceilingImage.y - oy };
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
  });
  updateChrome(); queue3D();
  showBanner(`Laid “${e.name}” on this plan from its corner. Move or turn it if it needs lining up.`, [{ label: 'Move or turn it', primary: true, fn: () => { hideBanner(); moveCeilingDialog(); } }]);
}
async function libraryDialog(only) {
  const lib = await loadBldLib(); let tab = only || 'all';
  const list = () => {
    const L = lib.filter(e => tab === 'all' || (e.type || 'building') === tab);
    if (!L.length) return `<div class="blib-empty">${tab === 'group' ? 'No saved groups yet. Select pieces on the plan (Shift-drag a box around them), then <b>Library → Save selected pieces</b>.' : tab === 'ceiling' ? 'No saved ceilings yet. Add a ceiling to a plan, then <b>Library → Save this ceiling</b>.' : 'Nothing saved yet. Use the Library menu to save a building, a group of pieces or a ceiling.'}</div>`;
    return L.map(e => { const t = e.type || 'building', ok = t === 'group' ? 'Place' : t === 'ceiling' ? 'Use on this plan' : 'Insert';
      return `<div class="blib-item">${libThumb(e)}<div><b>${esc(e.name)}</b><small>${({ building: 'Building', group: 'Group of pieces', ceiling: 'Ceiling' })[t]} · ${libSub(e)}</small><small>Saved ${esc(fmtDate(e.savedAt))}</small></div>
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
    projectPath = r.path; modePicked = true; ed.setPlan(p); hideBanner(); updateChrome(); if (view !== '2d' && viewer) viewer.loadPlan(clonePlan());
    toast('Opened ' + (p.name || r.name)); return;
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
  handleLoaded(await api.loadSample(ed.plan.mode === 'house' ? 'house' : 'cleanroom'));
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
<script>Plan3DViewer.mount(document.getElementById('v'), ${safe(JSON.stringify(plan))}, { comments: true });</script>
<!-- Made with Coll Plan3D · Coll Business Solutions LLC -->
</body></html>`;
  const p = await api.exportFile(html, plan.name + ' walkthrough', 'html');
  if (p) toast('Walkthrough saved. It opens in any browser and can be emailed or texted. Your customer can click 💬 Comment, leave notes on anything, and send you the comments file.', { label: 'Open it', fn: () => api.openPath(p) });
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
      <h4>Houses</h4><ul><li>Start with Build a house (or set Project type to House in the Plan panel). New walls are wood studs; pick a wall to switch it to steel, set 2×4 / 2×6, or mark it exterior / interior.</li><li>Window (G) places 3′ windows; doors are 2′-8″ panel doors with 6′-8″ heads. Items (I) places kitchen, bath and laundry items that back up against the nearest wall; R turns them.</li><li>Roof: gable, hip or flat, with pitch and overhang, in the Plan panel. The Exterior view in 3D shows it.</li><li>Floors: one finish for the house, and per room from a room label. The parts list counts framing, sheathing, wrap, siding, insulation, drywall, roof, floors, doors, windows, trim, cabinets, counters and fixtures.</li></ul>
      <h4>Cleanroom check</h4><ul><li>Pick a room label and set its ISO class and pressure (Pa). The room shows its air changes per hour and filter coverage from the FFUs over it, green when it meets the class, red with how many FFUs it's short.</li><li>On the plan, arrows at doors show which way air flows; red means it flows from the less clean side or the difference is under 5 Pa. The same arrows show on the floor in 3D. The Plan panel lists every room and door that needs a look.</li></ul>
      <h4>Electrical</h4><ul><li>Electrical (E): pick a receptacle, switch, data jack, FFU controller, pressure monitor or panel, and click on a wall. It goes on that face at the usual mounting height.</li><li>Devices show in 3D and in the Revit export, and the parts list counts them with an estimate of branch circuits for FFUs, lights and receptacles.</li></ul>
      <h4>Warehouses</h4><ul><li>Overhead (H) puts an overhead sectional door in a wall; Column (U) places a steel or concrete column. Over building walls the roof gets open-web steel joists 5′ on center under the deck. All of it goes on the parts list and into Revit.</li></ul>
      <h4>Sharing and comments</h4><ul><li>Export walkthrough saves one .html file. Anyone can open it in a browser, on a phone too.</li><li>Your customer clicks 💬 Comment, clicks anything in the model and types a note, then Send comments saves a small file they email back. In the Plan panel, Customer comments → Import comments file shows numbered pins on the plan and in 3D.</li><li>Export .glb opens in Windows 3D Viewer, SketchUp, Blender and most 3D tools.</li></ul>
      <h4>Ceiling grid takeoff</h4><ul><li>The parts list counts main tees (12′), 4′ cross tees, 2′ cross tees at 2 × 2 fixtures and hanger wires from the grid as laid out over each room.</li></ul></div>`,
    buttons: [{ label: 'Close', primary: true, ret: null }]
  });
}

$('#bImport').onclick = importPlan; $('#bOpen').onclick = openProject; $('#bSave').onclick = () => save(false);
// Export dropdown
{
  const btn = $('#bExport'), menu = $('#exportMenu');
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.onclick = (e) => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('button').focus(); };
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault(); const items = [...menu.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
  });
  const item = (id, fn) => { $(id).onclick = () => { close(); fn(); }; };
  item('#bExportHtml', exportHtml); item('#bSheet', sheetDialog); item('#bExportCad', () => { cadFmt = cadFmt === 'ifc' ? 'dwg' : cadFmt; cadDialog(); });
  item('#bExportIfc', () => exportIfc(true)); item('#bExportGlb', exportGlb); item('#bExportParts', exportParts);
}
// Buildings dropdown
{
  const btn = $('#bBld'), menu = $('#bldMenu');
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.onclick = (e) => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('button').focus(); };
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });
  const item = (id, fn) => { $(id).onclick = () => { close(); fn(); }; };
  item('#bBldInsert', () => libraryDialog()); item('#bBldFile', insertFromFile); item('#bBldSave', saveBuildingDialog);
  item('#bLibGroup', saveGroupDialog); item('#bLibCeil', saveCeilingDialog);
}
$('#bCeiling').onclick = ceilingMenu; $('#bGenCeil').onclick = generateCeilingDialog; $('#wImport').onclick = importPlan; $('#wSample').onclick = openSample;
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
    if (u.state === 'downloading') { b.hidden = false; b.disabled = true; b.textContent = 'Downloading update' + (u.percent ? ' ' + u.percent + '%' : '…'); }
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
window.__app = { libraryDialog, saveGroupDialog, saveCeilingDialog, collectPieces, pastePieces, applyCeiling, ed, setView, handleLoaded, placeBuilding, saveBuildingDialog, insertBuildingDialog, loadBldLib, ceilingDialogs: { cad: cadCeilingDialog, image: imageCeilingDialog, move: moveCeilingDialog }, exportIfc, get viewer() { return viewer; }, get builder() { return builder; } };
})();
