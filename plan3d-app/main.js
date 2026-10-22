// Coll Plan3D — Electron main process
// Coll Business Solutions LLC
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const DxfParser = require('dxf-parser');

let win;

function send(action) { if (win) win.webContents.send('menu', action); }

function buildMenu() {
  const tpl = [
    {
      label: 'File',
      submenu: [
        { label: 'Import Plan (DXF, DWG, Image)…', accelerator: 'CmdOrCtrl+I', click: () => send('import') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: 'Open Sample Cleanroom', click: () => send('sample') },
        { type: 'separator' },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'Save Project As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveas') },
        { type: 'separator' },
        { label: 'Export Walkthrough (.html)…', accelerator: 'CmdOrCtrl+E', click: () => send('export-html') },
        { label: 'Export 3D Model (.glb)…', click: () => send('export-glb') },
        { label: 'Export Parts List (.csv)…', click: () => send('export-parts') },
        { label: 'Plan Sheet (PDF)…', accelerator: 'CmdOrCtrl+P', click: () => send('sheet') },
        { label: 'Add Ceiling Drawing…', click: () => send('ceiling') },
        { label: 'Save 3D Model for Revit (IFC)…', click: () => send('export-ifc') },
        { label: 'Save for AutoCAD (DWG / DXF)…', accelerator: 'CmdOrCtrl+D', click: () => send('export-cad') },
        { type: 'separator' },
        { label: 'New Blank Plan', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => send('redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Plan Editor', accelerator: 'F1', click: () => send('view-2d') },
        { label: 'Split', accelerator: 'F2', click: () => send('view-split') },
        { label: '3D Walkthrough', accelerator: 'F3', click: () => send('view-3d') },
        { label: 'Build in 3D', accelerator: 'F4', click: () => send('view-build') },
        { label: 'Zoom to Fit', accelerator: 'CmdOrCtrl+0', click: () => send('fit') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Quick Guide', click: () => send('help') },
        { label: 'About Coll Plan3D', click: () => dialog.showMessageBox(win, {
          type: 'info', title: 'About Coll Plan3D',
          message: 'Coll Plan3D ' + app.getVersion(),
          detail: 'Floor plan to 3D walkthrough.\nColl Business Solutions LLC\ncollbusinesssolutions@gmail.com'
        }) }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1520, height: 960, minWidth: 980, minHeight: 640,
    backgroundColor: '#14191c',
    title: 'Coll Plan3D',
    icon: path.join(__dirname, 'renderer', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('close', (e) => {
    // Ask the window whether there are unsaved changes. If it doesn't answer quickly
    // (page broken, crashed or still loading), close anyway so the app never hangs or lingers.
    if (win.__allowClose) return;
    e.preventDefault();
    if (win.__closeAsked) return;
    win.__closeAsked = true;
    const wc = win.webContents;
    if (wc.isCrashed() || wc.isLoading() || !win.__rendererReady) return forceClose();
    win.__closeTimer = setTimeout(() => { if (!win.__dialogOpen) forceClose(); }, 2500);
    wc.send('menu', 'request-close');
  });
  win.on('closed', () => { win = null; });
  win.webContents.on('render-process-gone', () => { if (win) win.__rendererReady = false; });
}

function forceClose() {
  if (!win) return;
  clearTimeout(win.__closeTimer);
  win.__allowClose = true;
  win.close();
}

// Renderer says it is up and running (3D libraries loaded)
ipcMain.on('renderer-ready', () => { if (win) win.__rendererReady = true; });
// Renderer is showing the "unsaved changes" question: wait for the person's answer
ipcMain.on('close-dialog', (e, open) => {
  if (!win) return;
  win.__dialogOpen = !!open;
  if (open) clearTimeout(win.__closeTimer);
});
// Renderer answered "don't close" (Cancel)
ipcMain.on('close-cancelled', () => { if (win) { clearTimeout(win.__closeTimer); win.__closeAsked = false; win.__dialogOpen = false; } });
ipcMain.handle('confirm-close', () => forceClose());

// ---------- File loading ----------
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.gif'];

function flattenDxf(dxf) {
  const segs = [];
  const layers = {};
  const blocks = dxf.blocks || {};
  function add(x1, y1, x2, y2, layer) {
    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;
    if (Math.hypot(x2 - x1, y2 - y1) < 1e-9) return;
    segs.push([x1, y1, x2, y2, layer]);
    layers[layer] = (layers[layer] || 0) + 1;
  }
  const texts = [];
  // For ceiling drawings: closed rectangles and block outlines (light fixtures, FFUs) and short labels
  const rects = [], labels = [];
  function rectFrom(i0, layer, name, kind) {
    const n = segs.length - i0; if (n < 3) return;
    let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
    for (let i = i0; i < segs.length; i++) { const q = segs[i]; x0 = Math.min(x0, q[0], q[2]); x1 = Math.max(x1, q[0], q[2]); y0 = Math.min(y0, q[1], q[3]); y1 = Math.max(y1, q[1], q[3]); }
    if (rects.length < 20000) rects.push({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, layer, name: name || '', kind, si: i0, sn: n });
  }
  function walk(entities, xf, depth, parentLayer) {
    if (!entities || depth > 6) return;
    for (const e of entities) {
      let layer = e.layer || parentLayer || '0';
      if (layer === '0' && parentLayer) layer = parentLayer;
      const T = (p) => xf(p.x || 0, p.y || 0);
      try {
        if ((e.type === 'TEXT' || e.type === 'MTEXT') && typeof e.text === 'string' && e.text.startsWith('COLLPLAN3D')) {
          // project data saved by Coll Plan3D's DWG / DXF export
          texts.push({ layer, text: e.text.trim() });
        } else if ((e.type === 'TEXT' || e.type === 'MTEXT') && typeof e.text === 'string') {
          const t = e.text.replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, '').trim();
          const p = e.startPoint || e.position;
          if (t && t.length <= 16 && p && labels.length < 20000) { const q = T(p); labels.push({ x: q[0], y: q[1], text: t, layer }); }
        } else if (e.type === 'LINE' && e.vertices && e.vertices.length >= 2) {
          const a = T(e.vertices[0]), b = T(e.vertices[1]);
          add(a[0], a[1], b[0], b[1], layer);
        } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices) {
          const v = e.vertices.filter(p => p && isFinite(p.x));
          const i0 = segs.length;
          for (let i = 0; i + 1 < v.length; i++) {
            const a = T(v[i]), b = T(v[i + 1]);
            add(a[0], a[1], b[0], b[1], layer);
          }
          if ((e.shape || e.closed) && v.length > 2) {
            const a = T(v[v.length - 1]), b = T(v[0]);
            add(a[0], a[1], b[0], b[1], layer);
          }
          const closed = (e.shape || e.closed) || (v.length > 3 && Math.hypot(v[0].x - v[v.length - 1].x, v[0].y - v[v.length - 1].y) < 1e-6);
          if (closed && (segs.length - i0 === 4)) rectFrom(i0, layer, '', 'pline');
        } else if (e.type === 'INSERT' && blocks[e.name]) {
          const bl = blocks[e.name];
          const bx = (bl.position && bl.position.x) || 0, by = (bl.position && bl.position.y) || 0;
          const sx = e.xScale || 1, sy = e.yScale || 1;
          const r = (e.rotation || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
          const px = (e.position && e.position.x) || 0, py = (e.position && e.position.y) || 0;
          const cols = Math.max(1, e.columnCount || 1), rows = Math.max(1, e.rowCount || 1);
          for (let ci = 0; ci < cols; ci++) for (let ri = 0; ri < rows; ri++) {
            const ox = ci * (e.columnSpacing || 0), oy = ri * (e.rowSpacing || 0);
            const inner = (x, y) => {
              const lx = (x - bx) * sx + ox, ly = (y - by) * sy + oy;
              return xf(px + lx * c - ly * s, py + lx * s + ly * c);
            };
            const i0 = segs.length;
            walk(bl.entities, inner, depth + 1, layer);
            rectFrom(i0, layer, e.name, 'block');
          }
        }
      } catch (err) { /* skip bad entity */ }
    }
  }
  walk(dxf.entities, (x, y) => [x, y], 0, null);
  const insunits = (dxf.header && dxf.header.$INSUNITS) || 0;
  return { segs, layers, insunits, texts, rects, labels };
}

function findOdaConverter() {
  const roots = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], 'C:\\Program Files', 'C:\\Program Files (x86)'].filter(Boolean);
  for (const r of roots) {
    const oda = path.join(r, 'ODA');
    try {
      for (const d of fs.readdirSync(oda)) {
        if (/^ODAFileConverter/i.test(d)) {
          const exe = path.join(oda, d, 'ODAFileConverter.exe');
          if (fs.existsSync(exe)) return exe;
        }
      }
    } catch (e) { /* not installed here */ }
  }
  return null;
}

// Run the free ODA File Converter on one file. type: 'DXF' or 'DWG'; version like 'ACAD2018'.
function odaConvert(file, type, version) {
  return new Promise((resolve) => {
    const exe = findOdaConverter();
    if (!exe) return resolve({ error: 'nodwg' });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plan3d-'));
    const inDir = path.join(tmp, 'in'), outDir = path.join(tmp, 'out');
    fs.mkdirSync(inDir); fs.mkdirSync(outDir);
    const base = path.basename(file);
    fs.copyFileSync(file, path.join(inDir, base));
    execFile(exe, [inDir, outDir, version || 'ACAD2018', type, '0', '1', base], { timeout: 120000, windowsHide: true }, () => {
      const out = path.join(outDir, base.replace(/\.[^.]+$/, '.' + type.toLowerCase()));
      if (fs.existsSync(out)) resolve({ path: out, tmp });
      else resolve({ error: type === 'DWG' ? 'dwgsavefail' : 'dwgfail' });
    });
  });
}
async function convertDwg(file) {
  const r = await odaConvert(file, 'DXF', 'ACAD2018');
  return r.error ? r : { dxfPath: r.path };
}

// ---------- IFC (from Revit, ArchiCAD and other BIM programs) ----------
// Reads walls, doors, windows, rooms, ceilings and columns with web-ifc. Each element comes back as its
// footprint (convex hull, plan feet: x east, y south) with its bottom and top heights, grouped by level.
let ifcApi = null;
/* web-ifc gives geometry in the file's own length unit (mm, feet, inches …): feet per unit, from IfcUnitAssignment. */
const SI_PREFIX = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 1e2, DECA: 10, DECI: 0.1, CENTI: 0.01, MILLI: 0.001, MICRO: 1e-6, NANO: 1e-9 };
const enumVal = (v) => (v && (v.value != null ? v.value : v)) || '';

/* Feet per model length unit, from the file's IfcUnitAssignment (web-ifc returns geometry in model units). */
function lengthToFt(api, model) {
  const toMetres = (id, depth) => {
    if (id == null || depth > 4) return null;
    const u = api.GetLine(model, id);
    if (!u) return null;
    if (String(enumVal(u.UnitType)).toUpperCase() !== 'LENGTHUNIT') return null;
    if (u.Name && String(enumVal(u.Name)).toUpperCase() === 'METRE' && u.ConversionFactor == null) {
      return SI_PREFIX[String(enumVal(u.Prefix)).toUpperCase()] || 1;
    }
    if (u.ConversionFactor) { // e.g. foot = 0.3048 × metre
      const mw = api.GetLine(model, u.ConversionFactor.value);
      const val = mw && mw.ValueComponent && +enumVal(mw.ValueComponent);
      const base = mw && mw.UnitComponent ? toMetres(mw.UnitComponent.value, depth + 1) : 1;
      if (val > 0 && base > 0) return val * base;
    }
    const nm = String(enumVal(u.Name)).toLowerCase();
    if (/foot|feet/.test(nm)) return 0.3048;
    if (/inch/.test(nm)) return 0.0254;
    return null;
  };
  try {
    const ids = api.GetLineIDsWithType(model, require('web-ifc').IFCUNITASSIGNMENT);
    for (let i = 0; i < ids.size(); i++) {
      const ua = api.GetLine(model, ids.get(i));
      for (const u of ua.Units || []) { const m = toMetres(u.value, 0); if (m) return m * 3.280839895; }
    }
  } catch (e) { /* fall through */ }
  return 3.280839895; // IFC's default unit is the metre
}

function hull2(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-12) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
async function loadIfc(file) {
  const W = require('web-ifc');
  if (!ifcApi) { ifcApi = new W.IfcAPI(); ifcApi.SetWasmPath(path.dirname(require.resolve('web-ifc')) + path.sep, true); await ifcApi.Init(); }
  const api = ifcApi;
  const m = api.OpenModel(new Uint8Array(fs.readFileSync(file)), { COORDINATE_TO_ORIGIN: false });
  try {
    const FT = lengthToFt(api, m);
    const str = (v) => (v && v.value != null ? String(v.value) : '');
    const kinds = {};
    const add = (code, k) => { if (code != null) kinds[code] = k; };
    add(W.IFCWALL, 'wall'); add(W.IFCWALLSTANDARDCASE, 'wall'); add(W.IFCWALLELEMENTEDCASE, 'wall'); add(W.IFCCURTAINWALL, 'wall');
    add(W.IFCDOOR, 'door'); add(W.IFCDOORSTANDARDCASE, 'door'); add(W.IFCWINDOW, 'window'); add(W.IFCWINDOWSTANDARDCASE, 'window');
    add(W.IFCSPACE, 'space'); add(W.IFCCOVERING, 'covering'); add(W.IFCCOLUMN, 'column'); add(W.IFCCOLUMNSTANDARDCASE, 'column');
    add(W.IFCBUILDINGELEMENTPROXY, 'proxy'); add(W.IFCFLOWTERMINAL, 'terminal'); add(W.IFCLIGHTFIXTURE, 'light'); add(W.IFCAIRTERMINAL, 'terminal');
    // levels, and which level each element sits on
    const storeys = [], where = {};
    const sIds = api.GetLineIDsWithType(m, W.IFCBUILDINGSTOREY);
    for (let i = 0; i < sIds.size(); i++) { const L = api.GetLine(m, sIds.get(i)); storeys.push({ id: sIds.get(i), name: str(L.LongName) || str(L.Name) || ('Level ' + (i + 1)) }); }
    const rel = (type, from, to) => { const ids = api.GetLineIDsWithType(m, type); for (let i = 0; i < ids.size(); i++) { const L = api.GetLine(m, ids.get(i)); const s = L[from] && L[from].value; for (const e of (L[to] || [])) if (e && e.value != null && s != null) where[e.value] = s; } };
    rel(W.IFCRELCONTAINEDINSPATIALSTRUCTURE, 'RelatingStructure', 'RelatedElements');
    rel(W.IFCRELAGGREGATES, 'RelatingObject', 'RelatedObjects');
    // walk up to a level (an element may be in a space, or part of an assembly)
    const sSet = new Set(storeys.map(s => s.id));
    const levelOf = (id) => { let k = id; for (let n = 0; n < 8 && k != null; n++) { if (sSet.has(k)) return k; k = where[k]; } return null; };
    // Coll Plan3D's own project, if this file was saved by Coll Plan3D
    let embedded = '';
    try {
      const ps = api.GetLineIDsWithType(m, W.IFCPROPERTYSET);
      for (let i = 0; i < ps.size(); i++) {
        const L = api.GetLine(m, ps.get(i));
        if (str(L.Name) !== 'CollPlan3D_Project') continue;
        const parts = (L.HasProperties || []).map(h => api.GetLine(m, h.value)).filter(p => /^Data\d+$/.test(str(p.Name))).sort((a, b) => +str(a.Name).slice(4) - +str(b.Name).slice(4));
        embedded = parts.map(p => str(p.NominalValue)).join('');
      }
    } catch (e) { embedded = ''; }
    const els = [];
    const streamed = new Set();
    const take = (mesh) => {
      const id = mesh.expressID; if (streamed.has(id)) return; streamed.add(id);
      const code = api.GetLineType(m, id), kind = kinds[code]; if (!kind) return;
      const pts = []; let y0 = 1e18, y1 = -1e18;
      for (let i = 0; i < mesh.geometries.size(); i++) {
        const pg = mesh.geometries.get(i), g = api.GetGeometry(m, pg.geometryExpressID);
        const v = api.GetVertexArray(g.GetVertexData(), g.GetVertexDataSize()), T = pg.flatTransformation;
        for (let k = 0; k < v.length; k += 6) {
          const x = v[k], y = v[k + 1], z = v[k + 2];
          const X = T[0] * x + T[4] * y + T[8] * z + T[12], Y = T[1] * x + T[5] * y + T[9] * z + T[13], Z = T[2] * x + T[6] * y + T[10] * z + T[14];
          pts.push([X, Z]); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); // raw; scaled to feet below
        }
        if (g.delete) g.delete();
      }
      if (!pts.length) return;
      const L = api.GetLine(m, id);
      const pdt = kind === 'covering' ? str(L.PredefinedType) : '';
      if (kind === 'covering' && pdt && !/CEILING/i.test(pdt)) return;
      els.push({ id, kind, level: levelOf(id), hull: hull2(pts), y0, y1, name: str(L.LongName) || str(L.Name), num: kind === 'space' ? str(L.Name) : '', type: str(L.ObjectType) });
    };
    api.StreamAllMeshes(m, take);
    const extra = [W.IFCSPACE, W.IFCCOVERING].filter(c => c != null);
    try { api.StreamAllMeshesWithTypes(m, extra, take); } catch (e) { /* older files: no spaces */ }
    // web-ifc sometimes returns the file's own units and sometimes metres. Measure it: a wall's extrusion
    // depth (or a door's / window's stated height) in file units against the height of its 3D shape.
    const ratios = [];
    const extrusionDepth = (L) => {
      try {
        const shp = L.Representation && api.GetLine(m, L.Representation.value);
        for (const r of (shp && shp.Representations) || []) {
          const rep = api.GetLine(m, r.value);
          for (const it of rep.Items || []) {
            const item = api.GetLine(m, it.value);
            if (item && item.Depth != null && item.ExtrudedDirection) {
              const dir = api.GetLine(m, item.ExtrudedDirection.value), d = dir && dir.DirectionRatios && dir.DirectionRatios.map(v => +(v.value != null ? v.value : v));
              if (d && Math.abs(d[2]) > 0.999) return +(item.Depth.value != null ? item.Depth.value : item.Depth);
            }
          }
        }
      } catch (e) { /* not an extrusion */ }
      return 0;
    };
    for (const e of els) {
      if (ratios.length >= 25) break;
      const span = e.y1 - e.y0; if (!(span > 0)) continue;
      const L = api.GetLine(m, e.id);
      let D = 0;
      if (e.kind === 'wall') D = extrusionDepth(L);
      else if ((e.kind === 'door' || e.kind === 'window') && L.OverallHeight) D = +(L.OverallHeight.value != null ? L.OverallHeight.value : L.OverallHeight);
      if (D > 0) ratios.push(span / D);
    }
    let K = 3.280839895; // feet per unit of what web-ifc returned: metres for well-formed files
    if (ratios.length) {
      ratios.sort((a, b) => a - b);
      const r = ratios[ratios.length >> 1];
      K = FT / r; // r = returned units per file unit
    }
    const q = (v) => Math.round(v * K * 384) / 384;
    for (const e of els) { e.hull = e.hull.map(p => [q(p[0]), q(p[1])]); e.y0 *= K; e.y1 *= K; }
    // level heights from the floor of the walls on each level
    for (const s of storeys) {
      const ws = els.filter(e => e.level === s.id && e.kind === 'wall');
      s.walls = ws.length; s.doors = els.filter(e => e.level === s.id && e.kind === 'door').length;
      s.floor = ws.length ? Math.min(...ws.map(e => e.y0)) : 0;
    }
    storeys.sort((a, b) => a.floor - b.floor);
    return { kind: 'ifc', name: path.basename(file, path.extname(file)), path: file, storeys, els, embedded, schema: api.GetModelSchema ? api.GetModelSchema(m) : '' };
  } finally { api.CloseModel(m); }
}

async function loadAny(file) {
  const ext = path.extname(file).toLowerCase();
  const name = path.basename(file, ext);
  try {
    if (IMAGE_EXT.includes(ext)) {
      const buf = fs.readFileSync(file);
      const mime = ext === '.jpg' ? 'image/jpeg' : 'image/' + ext.slice(1);
      return { kind: 'image', name, path: file, dataUrl: 'data:' + mime + ';base64,' + buf.toString('base64') };
    }
    if (ext === '.ifc') return await loadIfc(file);
    if (ext === '.rvt' || ext === '.rfa' || ext === '.rte') return { kind: 'error', code: 'revit', name, ext };
    if (ext === '.plan3d' || ext === '.json') {
      return { kind: 'project', name, path: file, json: fs.readFileSync(file, 'utf8') };
    }
    let dxfFile = file;
    if (ext === '.dwg') {
      const r = await convertDwg(file);
      if (r.error) return { kind: 'error', code: r.error, name };
      dxfFile = r.dxfPath;
    } else if (ext !== '.dxf') {
      return { kind: 'error', code: 'unsupported', name, ext };
    }
    const text = fs.readFileSync(dxfFile, 'utf8');
    const parser = new DxfParser();
    const dxf = parser.parseSync(text);
    const flat = flattenDxf(dxf);
    return { kind: 'dxf', name, path: file, ...flat };
  } catch (err) {
    return { kind: 'error', code: 'read', name, message: String(err && err.message || err) };
  }
}

ipcMain.handle('open-file', async (e, which) => {
  const filters = which === 'project'
    ? [{ name: 'Plan3D Project', extensions: ['plan3d', 'json'] }]
    : which === 'ceiling'
    ? [{ name: 'Ceiling drawings', extensions: ['dxf', 'dwg', 'png', 'jpg', 'jpeg', 'bmp', 'webp'] }, { name: 'All files', extensions: ['*'] }]
    : [
        { name: 'Floor plans', extensions: ['dxf', 'dwg', 'ifc', 'rvt', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'plan3d'] },
        { name: 'AutoCAD', extensions: ['dxf', 'dwg'] },
        { name: 'Revit / BIM (IFC)', extensions: ['ifc', 'rvt'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] },
        { name: 'All files', extensions: ['*'] }
      ];
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
  if (r.canceled || !r.filePaths[0]) return null;
  return loadAny(r.filePaths[0]);
});

ipcMain.handle('load-path', (e, p) => loadAny(p));

ipcMain.handle('load-sample', () => {
  const p = path.join(__dirname, 'samples', 'Cleanroom 40x64.plan3d');
  return { kind: 'project', name: 'Cleanroom 40x64', path: null, json: fs.readFileSync(p, 'utf8') };
});

ipcMain.handle('save-project', async (e, json, current, suggested) => {
  let p = current;
  if (!p) {
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.join(app.getPath('documents'), (suggested || 'Floor plan') + '.plan3d'),
      filters: [{ name: 'Plan3D Project', extensions: ['plan3d'] }]
    });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  fs.writeFileSync(p, json, 'utf8');
  return p;
});

ipcMain.handle('export-file', async (e, { data, name, ext }) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), (name || 'Walkthrough') + '.' + ext),
    filters: [{ name: ext === 'html' ? 'Web page' : ext === 'csv' ? 'Spreadsheet (CSV)' : ext === 'ifc' ? 'IFC for Revit / BIM' : '3D model (glTF binary)', extensions: [ext] }]
  });
  if (r.canceled || !r.filePath) return null;
  if (typeof data === 'string') fs.writeFileSync(r.filePath, data, 'utf8');
  else fs.writeFileSync(r.filePath, Buffer.from(data));
  return r.filePath;
});

// Floor plan → AutoCAD drawing. The renderer makes the DXF; a DWG is made from it with ODA File Converter.
const DWG_VERSIONS = ['ACAD2018', 'ACAD2013', 'ACAD2010', 'ACAD2007', 'ACAD2004', 'ACAD2000'];
ipcMain.handle('has-dwg-converter', () => !!findOdaConverter());
ipcMain.handle('export-cad', async (e, { dxf, name, format, version }) => {
  const dwg = format === 'dwg';
  if (dwg && !findOdaConverter()) return { error: 'nodwg' };
  const filters = dwg ? [{ name: 'AutoCAD Drawing (DWG)', extensions: ['dwg'] }] : [{ name: 'AutoCAD DXF', extensions: ['dxf'] }];
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), (name || 'Floor plan') + (dwg ? '.dwg' : '.dxf')), filters });
  if (r.canceled || !r.filePath) return null;
  let out = r.filePath;
  try {
    if (!dwg) { fs.writeFileSync(out, dxf, 'latin1'); return { path: out }; }
    if (!/\.dwg$/i.test(out)) out += '.dwg';
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plan3d-'));
    const src = path.join(tmp, path.basename(out).replace(/\.dwg$/i, '.dxf'));
    fs.writeFileSync(src, dxf, 'latin1');
    const c = await odaConvert(src, 'DWG', DWG_VERSIONS.includes(version) ? version : 'ACAD2018');
    if (c.error) return { error: c.error };
    fs.copyFileSync(c.path, out);
    return { path: out };
  } catch (err) {
    return { error: 'write', message: String(err && err.message || err) };
  }
});

// Plan sheet → PDF: render the sheet HTML in a hidden window and print it at the sheet's paper size
ipcMain.handle('export-pdf', async (e, { html, name, w, h }) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), (name || 'Floor plan') + '.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (r.canceled || !r.filePath) return null;
  const tmp = path.join(os.tmpdir(), 'plan3d-sheet-' + Date.now() + '.html');
  fs.writeFileSync(tmp, html, 'utf8');
  const pw = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  pw.__allowClose = true;
  try {
    await pw.loadFile(tmp);
    const pdf = await pw.webContents.printToPDF({ pageSize: { width: w, height: h }, printBackground: true, margins: { marginType: 'none' }, preferCSSPageSize: true });
    fs.writeFileSync(r.filePath, pdf);
    return r.filePath;
  } finally {
    pw.destroy();
    try { fs.unlinkSync(tmp); } catch (err) { /* already gone */ }
  }
});

ipcMain.handle('get-assets', () => {
  // three.js ships inside the app (renderer/vendor) so the installed app never depends on node_modules for 3D
  const rd = (f) => fs.readFileSync(path.join(__dirname, 'renderer', 'vendor', f), 'utf8');
  return {
    three: rd('three.min.js'),
    orbit: rd('OrbitControls.js'),
    viewer: fs.readFileSync(path.join(__dirname, 'renderer', 'viewer.js'), 'utf8')
  };
});

ipcMain.handle('open-path', (e, p) => shell.openPath(p));
ipcMain.handle('show-in-folder', (e, p) => shell.showItemInFolder(p));
ipcMain.handle('open-url', (e, u) => { if (/^https:\/\//.test(u)) shell.openExternal(u); });

// Only one copy of the app at a time: opening it again (or double-clicking a .plan3d file)
// brings the existing window forward instead of starting a second copy.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const f = argv.slice(1).find(a => /\.(dxf|dwg|ifc|rvt|png|jpe?g|bmp|webp|plan3d)$/i.test(a));
    if (f) win.webContents.send('open-path', f);
  });
}

app.whenReady().then(() => {
  if (!app.hasSingleInstanceLock()) return;
  buildMenu();
  createWindow();
  // File passed on the command line / "Open with"
  const arg = process.argv.slice(1).find(a => /\.(dxf|dwg|ifc|rvt|png|jpe?g|bmp|webp|plan3d)$/i.test(a));
  if (arg) win.webContents.once('did-finish-load', () => win.webContents.send('open-path', arg));
});
app.on('window-all-closed', () => app.quit());
