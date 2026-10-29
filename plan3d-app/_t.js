const { app, ipcMain } = require('electron'); const fs = require('fs');
const OUT = process.env.OUT; const log = (...a) => fs.appendFileSync(OUT + '/tlog.txt', a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n');
fs.writeFileSync(OUT + '/tlog.txt', '');
app.on('browser-window-created', (e, win) => {
  win.webContents.on('console-message', (ev, lvl, msg) => { if (lvl >= 2 && !/WebGL|GroupMarker/.test(msg)) log('C:', msg); });
  win.webContents.once('did-finish-load', () => setTimeout(async () => {
    try {
      ipcMain.removeHandler('open-file');
      const lp = ipcMain._invokeHandlers.get('load-path');
      ipcMain.handle('open-file', () => lp({}, process.env.DECK));
      const code = fs.readFileSync(process.env.STEP, 'utf8').replace('__DATA__', JSON.stringify({ fp: process.env.FP }));
      log('T: result', await win.webContents.executeJavaScript(code));
      const n = await win.webContents.executeJavaScript('(window.__stages||[]).length');
      for (let i = 0; i < n; i++) {
        const o = await win.webContents.executeJavaScript(`Promise.resolve(window.__stages[${i}]())`); if (o) log('S' + i, o);
        await new Promise(r => setTimeout(r, 2500));
        const img = await win.webContents.capturePage(); fs.writeFileSync(OUT + '/shot_' + i + '.png', img.toPNG());
      }
    } catch (err) { log('T: ERR', String(err && err.stack || err)); }
    app.exit(0);
  }, 3000));
});
require('./main.js');
