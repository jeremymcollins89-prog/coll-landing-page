// Coll Ledger — main process
// Keeps all books in one file in the user's app-data folder, writes it safely
// (temp file + rename), keeps 30 days of daily backups locally and — when chosen —
// in a cloud folder (OneDrive, Google Drive, Dropbox), stores receipt files,
// renders invoices and reports to PDF, and checks for app updates.
// When a password is on, everything this process writes is already encrypted
// by the window before it arrives here.

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isMac = process.platform === 'darwin';
let win;
let allowClose = false;

// One window only, so two copies never write the same books file.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.exit(0);
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function dataDir() {
  const dir = path.join(app.getPath('userData'), 'books');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const dataFile = () => path.join(dataDir(), 'ledger.json');
const attachDir = () => { const d = path.join(dataDir(), 'attachments'); fs.mkdirSync(d, { recursive: true }); return d; };
const safeId = id => String(id).replace(/[^A-Za-z0-9_-]/g, '');

// ---------- Settings (kept outside the books so they work before unlocking) ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch (e) { return {}; } }
function writeSettings(s) { fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 1)); }
const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function writeBooks(raw) {
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, raw);
  if (fs.existsSync(dataFile())) { try { fs.copyFileSync(dataFile(), dataFile() + '.bak'); } catch (e) { } }
  fs.renameSync(tmp, dataFile());
  backupTo(path.join(dataDir(), 'backups'), raw, 'ledger-');
  const s = readSettings();
  if (s.backupFolder) {
    try {
      const dir = path.join(s.backupFolder, 'Coll Ledger Backups');
      backupTo(dir, raw, 'Coll Ledger ');
      fs.writeFileSync(path.join(dir, 'Coll Ledger latest.json'), raw);
      s.lastCloudBackup = new Date().toISOString(); s.cloudError = null; writeSettings(s);
    } catch (e) { s.cloudError = String(e.message || e); writeSettings(s); }
  }
}
function backupTo(dir, raw, prefix) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${prefix}${stamp()}.json`), raw); // the day's file holds that day's latest save
    const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\d{4}-\\d{2}-\\d{2}\\.json$');
    const files = fs.readdirSync(dir).filter(f => re.test(f)).sort();
    while (files.length > 30) fs.unlinkSync(path.join(dir, files.shift()));
  } catch (e) { if (dir.includes('Coll Ledger Backups')) throw e; console.error('backup failed', e); }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1024, minHeight: 680, show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0E1513' : '#F5F3EE',
    title: 'Coll Ledger',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 18, y: 18 } } : { titleBarOverlay: { color: '#00000000', symbolColor: '#8A948F', height: 52 } }),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.show(); setTimeout(checkForUpdates, 4000); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:|^mailto:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // let the window finish saving (and encrypting) before it closes
  win.on('close', e => {
    if (allowClose) return;
    e.preventDefault();
    win.webContents.send('app:closing');
    setTimeout(() => { allowClose = true; if (win && !win.isDestroyed()) win.close(); }, 4000); // never hang
  });
}
ipcMain.on('app:readyToClose', () => { allowClose = true; if (win && !win.isDestroyed()) win.close(); });

// ---------- Updates ----------
let updater = null;
function sendUpdate(info) { if (win && !win.isDestroyed()) win.webContents.send('update', info); }
function checkForUpdates() {
  if (!app.isPackaged || updater) return;
  try { updater = require('electron-updater').autoUpdater; } catch (e) { return; }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.on('update-available', i => sendUpdate({ state: 'downloading', version: i.version, percent: 0 }));
  updater.on('download-progress', p => sendUpdate({ state: 'downloading', percent: Math.round(p.percent) }));
  updater.on('update-downloaded', i => sendUpdate({ state: 'ready', version: i.version }));
  updater.on('error', () => { });
  updater.checkForUpdates().catch(() => { });
  setInterval(() => updater.checkForUpdates().catch(() => { }), 6 * 60 * 60 * 1000);
}
ipcMain.handle('app:installUpdate', () => { if (updater) { allowClose = true; updater.quitAndInstall(false, true); } });

// ---------- Books ----------
ipcMain.handle('ledger:load', () => {
  for (const f of [dataFile(), dataFile() + '.bak']) {
    try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error('could not read', f, e); }
  }
  return null;
});
ipcMain.handle('ledger:save', (_e, raw) => { writeBooks(typeof raw === 'string' ? raw : JSON.stringify(raw)); return true; });
ipcMain.on('ledger:saveSync', (e, raw) => { try { writeBooks(raw); e.returnValue = true; } catch (err) { e.returnValue = false; } });

// ---------- Backup folder ----------
ipcMain.handle('backup:status', () => { const s = readSettings(); return { folder: s.backupFolder || null, last: s.lastCloudBackup || null, error: s.cloudError || null }; });
ipcMain.handle('backup:choose', async () => {
  const home = os.homedir();
  const guess = ['OneDrive', 'Google Drive', 'My Drive', 'Dropbox', 'iCloudDrive'].map(n => path.join(home, n)).find(p => fs.existsSync(p)) || home;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: 'Choose a folder for automatic backups', defaultPath: guess, properties: ['openDirectory', 'createDirectory'] });
  if (canceled || !filePaths[0]) return null;
  const s = readSettings(); s.backupFolder = filePaths[0]; s.cloudError = null; writeSettings(s);
  if (fs.existsSync(dataFile())) { try { writeBooks(fs.readFileSync(dataFile(), 'utf8')); } catch (e) { } }
  return readSettings().backupFolder;
});
ipcMain.handle('backup:clear', () => { const s = readSettings(); delete s.backupFolder; delete s.lastCloudBackup; delete s.cloudError; writeSettings(s); return true; });
ipcMain.handle('backup:open', () => { const s = readSettings(); if (s.backupFolder) shell.openPath(path.join(s.backupFolder, 'Coll Ledger Backups')); });

// ---------- Receipts and attachments ----------
ipcMain.handle('att:save', (_e, { id, base64 }) => { fs.writeFileSync(path.join(attachDir(), safeId(id)), Buffer.from(base64, 'base64')); const s = readSettings(); if (s.backupFolder) { try { const d = path.join(s.backupFolder, 'Coll Ledger Backups', 'attachments'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, safeId(id)), Buffer.from(base64, 'base64')); } catch (e) { } } return true; });
ipcMain.handle('att:read', (_e, id) => { const p = path.join(attachDir(), safeId(id)); return fs.existsSync(p) ? fs.readFileSync(p).toString('base64') : null; });
ipcMain.handle('att:delete', (_e, id) => { const p = path.join(attachDir(), safeId(id)); if (fs.existsSync(p)) fs.unlinkSync(p); return true; });

// ---------- Files ----------
ipcMain.handle('file:save', async (_e, { defaultName, content, filters, base64 }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), defaultName.replace(/[\\/:*?"<>|]/g, '-')),
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, base64 ? Buffer.from(base64, 'base64') : content);
  return filePath;
});
ipcMain.handle('file:open', async (_e, { filters, multiple }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  if (canceled || !filePaths.length) return null;
  const read = p => ({ name: path.basename(p), base64: fs.readFileSync(p).toString('base64') });
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
  } finally { pdfWin.destroy(); fs.unlink(tmp, () => { }); }
  shell.openPath(filePath);
  return filePath;
});

ipcMain.handle('app:openDataFolder', () => shell.openPath(dataDir()));
ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, dataPath: dataDir() }));
ipcMain.handle('app:openExternal', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

app.whenReady().then(() => {
  if (!gotLock) return;
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) { allowClose = false; createWindow(); } });
});
app.on('before-quit', () => { /* window close handler still flushes first */ });
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
