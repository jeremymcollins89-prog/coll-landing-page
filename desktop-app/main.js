// Cleanroom Control for Windows.
// A window around the live dashboard hosted by the cloud server, so every
// dashboard update you push to Railway shows up here without reinstalling.
//
// The same code builds two apps (see package.json scripts):
//   Cleanroom Control           customers            (npm run dist)
//   Cleanroom Control Support   vendor support staff (npm run dist:support) -> <server>/vendor
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, shell } = require('electron');

const SUPPORT = process.argv.includes('--support') || (process.env.CLEANROOM_APP || require('./package.json').cleanroomApp) === 'support';
const APP_NAME = SUPPORT ? 'Cleanroom Control Support' : 'Cleanroom Control';
const BASE = (process.env.CLEANROOM_URL || require('./config.json').serverUrl).replace(/\/$/, '');
const SERVER = SUPPORT ? `${BASE}/vendor` : BASE;
const ORIGIN = new URL(SERVER).origin;

// Windows only shows notifications (e.g. "Help requested") for apps with an ID,
// matching the installer's shortcut.
if (process.platform === 'win32') {
  app.setAppUserModelId(SUPPORT ? 'com.modularcleanrooms.cleanroomcontrol.support' : 'com.modularcleanrooms.cleanroomcontrol');
}

// Only one copy of the app at a time; opening it again brings the window forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win;

  const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
  const loadState = () => {
    try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return { width: 1280, height: 860 }; }
  };
  const saveState = () => {
    if (!win || win.isDestroyed()) return;
    try {
      fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
    } catch { /* not important */ }
  };

  const isOurs = (url) => {
    try { return new URL(url).origin === ORIGIN; } catch { return false; }
  };

  function showOffline() {
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { server: SERVER } });
  }

  function createWindow() {
    const s = loadState();
    win = new BrowserWindow({
      x: s.x, y: s.y, width: s.width || 1280, height: s.height || 860,
      minWidth: 380, minHeight: 520,
      title: APP_NAME,
      icon: path.join(__dirname, SUPPORT ? 'icon-support.png' : 'icon.png'),
      backgroundColor: '#f3f5f8',
      autoHideMenuBar: true,
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    if (s.maximized) win.maximize();
    win.once('ready-to-show', () => win.show());

    // Links to anything other than your server open in the normal browser.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => {
      if (isOurs(url) || url.startsWith('file:')) return;
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    });

    // No internet or server down: show a friendly screen that keeps retrying.
    win.webContents.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) showOffline(); // -3 = navigation replaced, not an error
    });

    win.on('close', saveState);
    win.loadURL(SERVER);
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win && win.loadURL(SERVER) },
        { type: 'separator' },
        { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Open in browser', click: () => shell.openExternal(SERVER) },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ]);

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(menu);
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
