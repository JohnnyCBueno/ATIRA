const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('atiraDesktop', {
  repository: {
    read: () => ipcRenderer.invoke('repository:read'),
    write: (state) => ipcRenderer.invoke('repository:write', state),
  },
  collector: {
    status: () => ipcRenderer.invoke('collector:status'),
    setPaused: (paused) => ipcRenderer.invoke('collector:set-paused', Boolean(paused)),
    delete: (range) => ipcRenderer.invoke('collector:delete', range),
    createBrowserPairingCode: () => ipcRenderer.invoke('collector:browser-pairing-code'),
    unpairBrowser: () => ipcRenderer.invoke('collector:browser-unpair'),
  },
});
