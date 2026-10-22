const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: (which) => ipcRenderer.invoke('open-file', which),
  loadPath: (p) => ipcRenderer.invoke('load-path', p),
  loadSample: () => ipcRenderer.invoke('load-sample'),
  pathForFile: (f) => { try { return webUtils.getPathForFile(f); } catch (e) { return null; } },
  saveProject: (json, current, suggested) => ipcRenderer.invoke('save-project', json, current, suggested),
  exportFile: (data, name, ext) => ipcRenderer.invoke('export-file', { data, name, ext }),
  exportPDF: (html, name, w, h) => ipcRenderer.invoke('export-pdf', { html, name, w, h }),
  getAssets: () => ipcRenderer.invoke('get-assets'),
  exportCad: (o) => ipcRenderer.invoke('export-cad', o),
  hasDwgConverter: () => ipcRenderer.invoke('has-dwg-converter'),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  showInFolder: (p) => ipcRenderer.invoke('show-in-folder', p),
  openUrl: (u) => ipcRenderer.invoke('open-url', u),
  confirmClose: () => ipcRenderer.invoke('confirm-close'),
  closeDialog: (open) => ipcRenderer.send('close-dialog', open),
  closeCancelled: () => ipcRenderer.send('close-cancelled'),
  rendererReady: () => ipcRenderer.send('renderer-ready'),
  onMenu: (cb) => ipcRenderer.on('menu', (e, a) => cb(a)),
  onOpenPath: (cb) => ipcRenderer.on('open-path', (e, p) => cb(p))
});
