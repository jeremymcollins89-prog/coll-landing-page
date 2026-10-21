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
    // Ask renderer whether there are unsaved changes
    if (win.__allowClose) return;
    e.preventDefault();
    win.webContents.send('menu', 'request-close');
  });
}

ipcMain.handle('confirm-close', () => { win.__allowClose = true; win.close(); });

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
  function walk(entities, xf, depth, parentLayer) {
    if (!entities || depth > 6) return;
    for (const e of entities) {
      let layer = e.layer || parentLayer || '0';
      if (layer === '0' && parentLayer) layer = parentLayer;
      const T = (p) => xf(p.x || 0, p.y || 0);
      try {
        if (e.type === 'LINE' && e.vertices && e.vertices.length >= 2) {
          const a = T(e.vertices[0]), b = T(e.vertices[1]);
          add(a[0], a[1], b[0], b[1], layer);
        } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices) {
          const v = e.vertices.filter(p => p && isFinite(p.x));
          for (let i = 0; i + 1 < v.length; i++) {
            const a = T(v[i]), b = T(v[i + 1]);
            add(a[0], a[1], b[0], b[1], layer);
          }
          if ((e.shape || e.closed) && v.length > 2) {
            const a = T(v[v.length - 1]), b = T(v[0]);
            add(a[0], a[1], b[0], b[1], layer);
          }
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
            walk(bl.entities, inner, depth + 1, layer);
          }
        }
      } catch (err) { /* skip bad entity */ }
    }
  }
  walk(dxf.entities, (x, y) => [x, y], 0, null);
  const insunits = (dxf.header && dxf.header.$INSUNITS) || 0;
  return { segs, layers, insunits };
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

function convertDwg(file) {
  return new Promise((resolve) => {
    const exe = findOdaConverter();
    if (!exe) return resolve({ error: 'nodwg' });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plan3d-'));
    const inDir = path.join(tmp, 'in'), outDir = path.join(tmp, 'out');
    fs.mkdirSync(inDir); fs.mkdirSync(outDir);
    const base = path.basename(file);
    fs.copyFileSync(file, path.join(inDir, base));
    execFile(exe, [inDir, outDir, 'ACAD2018', 'DXF', '0', '1', base], { timeout: 120000 }, () => {
      const out = path.join(outDir, base.replace(/\.dwg$/i, '.dxf'));
      if (fs.existsSync(out)) resolve({ dxfPath: out });
      else resolve({ error: 'dwgfail' });
    });
  });
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
    : [
        { name: 'Floor plans', extensions: ['dxf', 'dwg', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'plan3d'] },
        { name: 'AutoCAD', extensions: ['dxf', 'dwg'] },
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
    filters: [{ name: ext === 'html' ? 'Web page' : ext === 'csv' ? 'Spreadsheet (CSV)' : '3D model (glTF binary)', extensions: [ext] }]
  });
  if (r.canceled || !r.filePath) return null;
  if (typeof data === 'string') fs.writeFileSync(r.filePath, data, 'utf8');
  else fs.writeFileSync(r.filePath, Buffer.from(data));
  return r.filePath;
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
  const rd = (p) => fs.readFileSync(require.resolve(p), 'utf8');
  return {
    three: rd('three/build/three.min.js'),
    orbit: rd('three/examples/js/controls/OrbitControls.js'),
    viewer: fs.readFileSync(path.join(__dirname, 'renderer', 'viewer.js'), 'utf8')
  };
});

ipcMain.handle('open-path', (e, p) => shell.openPath(p));
ipcMain.handle('show-in-folder', (e, p) => shell.showItemInFolder(p));
ipcMain.handle('open-url', (e, u) => { if (/^https:\/\//.test(u)) shell.openExternal(u); });

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  // File passed on the command line / "Open with"
  const arg = process.argv.slice(1).find(a => /\.(dxf|dwg|png|jpe?g|bmp|webp|plan3d)$/i.test(a));
  if (arg) win.webContents.once('did-finish-load', () => win.webContents.send('open-path', arg));
});
app.on('window-all-closed', () => app.quit());
