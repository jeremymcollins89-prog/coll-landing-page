const { contextBridge, ipcRenderer } = require('electron');

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
  onUpdate: (fn) => ipcRenderer.on('update', (_e, info) => fn(info))
});
