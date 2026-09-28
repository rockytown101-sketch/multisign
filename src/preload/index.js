const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tronAPI', {
  buildMultiSigTx: (data) => ipcRenderer.invoke('tron:build-multisig', data),
  buildNotifyTx: (data) => ipcRenderer.invoke('tron:build-notify', data)
});
