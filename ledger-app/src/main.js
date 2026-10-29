// Coll Ledger — main process
// Keeps all books in one JSON file in the user's app-data folder, writes it
// safely (temp file + rename), keeps 30 days of daily backups, renders invoices
// and reports to PDF, and checks for app updates in the background.

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isMac = process.platform === 'darwin';
let win;

// One window only, so two copies never write the same books file.
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function dataDir() {
  const dir = path.join(app.getPath('userData'), 'books');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const dataFile = () => path.join(dataDir(), 'ledger.json');

function writeBooks(raw) {
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, raw);
  // keep the previous good copy next to the live file
  if (fs.existsSync(dataFile())) { try { fs.copyFileSync(dataFile(), dataFile() + '.bak'); } catch (e) { } }
  fs.renameSync(tmp, dataFile());
  backupDaily(raw);
}

function backupDaily(raw) {
  try {
    const bdir = path.join(dataDir(), 'backups');
    fs.mkdirSync(bdir, { recursive: true });
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const target = path.join(bdir, `ledger-${stamp}.json`);
    fs.writeFileSync(target, raw); // the day's backup always holds the latest save of that day
    const files = fs.readdirSync(bdir).filter(f => /^ledger-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    while (files.length > 30) fs.unlinkSync(path.join(bdir, files.shift()));
  } catch (e) { console.error('backup failed', e); }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0E1513' : '#F5F3EE',
    title: 'Coll Ledger',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    ...(isMac
      ? { trafficLightPosition: { x: 18, y: 18 } }
      : { titleBarOverlay: { color: '#00000000', symbolColor: '#8A948F', height: 52 } }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.show(); setTimeout(checkForUpdates, 4000); });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // never navigate the app window away from the app
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
}

// ---------- Updates ----------
// Installers live on the GitHub release tagged "coll-ledger". New versions download
// quietly; the app shows "Update ready — restart" and installs on the next restart.
let updater = null;
function sendUpdate(info) { if (win && !win.isDestroyed()) win.webContents.send('update', info); }
function checkForUpdates() {
  if (!app.isPackaged) return;
  try { updater = require('electron-updater').autoUpdater; } catch (e) { return; }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.on('update-available', i => sendUpdate({ state: 'downloading', version: i.version, percent: 0 }));
  updater.on('download-progress', p => sendUpdate({ state: 'downloading', percent: Math.round(p.percent) }));
  updater.on('update-downloaded', i => sendUpdate({ state: 'ready', version: i.version }));
  updater.on('error', () => { /* offline or no release yet: try again later */ });
  updater.checkForUpdates().catch(() => { });
  setInterval(() => updater.checkForUpdates().catch(() => { }), 6 * 60 * 60 * 1000);
}
ipcMain.handle('app:installUpdate', () => { if (updater) updater.quitAndInstall(false, true); });

// ---------- Books ----------
ipcMain.handle('ledger:load', () => {
  for (const f of [dataFile(), dataFile() + '.bak']) {
    try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error('could not read', f, e); }
  }
  return null;
});
ipcMain.handle('ledger:save', (_e, raw) => { writeBooks(typeof raw === 'string' ? raw : JSON.stringify(raw)); return true; });
// used when the window closes so the last few keystrokes are never lost
ipcMain.on('ledger:saveSync', (e, raw) => { try { writeBooks(raw); e.returnValue = true; } catch (err) { e.returnValue = false; } });

// ---------- Files ----------
ipcMain.handle('file:save', async (_e, { defaultName, content, filters }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), defaultName.replace(/[\\/:*?"<>|]/g, '-')),
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content);
  return filePath;
});

ipcMain.handle('file:open', async (_e, { filters, multiple }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  if (canceled || !filePaths.length) return null;
  const read = p => { const buf = fs.readFileSync(p); return { name: path.basename(p), base64: buf.toString('base64') }; };
  return multiple ? filePaths.map(read) : read(filePaths[0]);
});

// Render an HTML document (invoice or report) to a PDF the user saves.
ipcMain.handle('pdf:save', async (_e, { html, defaultName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), defaultName.replace(/[\\/:*?"<>|]/g, '-')),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return null;
  const tmp = path.join(os.tmpdir(), `coll-ledger-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await pdfWin.loadFile(tmp);
    const buf = await pdfWin.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, margins: { marginType: 'none' }, preferCSSPageSize: true });
    fs.writeFileSync(filePath, buf);
  } finally {
    pdfWin.destroy();
    fs.unlink(tmp, () => { });
  }
  shell.openPath(filePath);
  return filePath;
});

ipcMain.handle('app:openDataFolder', () => shell.openPath(dataDir()));
ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, dataPath: dataDir() }));
ipcMain.handle('app:openExternal', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
