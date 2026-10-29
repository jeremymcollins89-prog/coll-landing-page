const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  load: () => ipcRenderer.invoke('ledger:load'),
  save: (raw) => ipcRenderer.invoke('ledger:save', raw),
  saveSync: (raw) => ipcRenderer.sendSync('ledger:saveSync', raw),
  saveFile: (opts) => ipcRenderer.invoke('file:save', opts),
  openFile: (opts) => ipcRenderer.invoke('file:open', opts),
  savePdf: (opts) => ipcRenderer.invoke('pdf:save', opts),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  info: () => ipcRenderer.invoke('app:info'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  onUpdate: (fn) => ipcRenderer.on('update', (_e, info) => fn(info)),
  onClosing: (fn) => ipcRenderer.on('app:closing', () => fn()),
  readyToClose: () => ipcRenderer.send('app:readyToClose'),
  backupStatus: () => ipcRenderer.invoke('backup:status'),
  chooseBackupFolder: () => ipcRenderer.invoke('backup:choose'),
  clearBackupFolder: () => ipcRenderer.invoke('backup:clear'),
  openBackupFolder: () => ipcRenderer.invoke('backup:open'),
  saveAttachment: (id, base64) => ipcRenderer.invoke('att:save', { id, base64 }),
  readAttachment: (id) => ipcRenderer.invoke('att:read', id),
  deleteAttachment: (id) => ipcRenderer.invoke('att:delete', id),
  readReceipt: (base64, name) => ipcRenderer.invoke('ocr:read', { base64, name }),
  setZoom: (f) => webFrame.setZoomFactor(f)
});
