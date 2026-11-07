const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jepiAPI', {
  look: (opts) => ipcRenderer.invoke('look', opts),
  clickThrough: (on) => ipcRenderer.send('clickthrough', on),
  quit: () => ipcRenderer.send('quit'),
  copy: (text) => ipcRenderer.send('copy', text),
  unpin: () => ipcRenderer.send('unpin'),
  applyFix: (edit) => ipcRenderer.invoke('apply-fix', edit),
  undoFix: () => ipcRenderer.invoke('undo-fix'),
  onHotkey: (cb) => ipcRenderer.on('hotkey', (_e, key) => cb(key)),
  onCursor: (cb) => ipcRenderer.on('cursor', (_e, p) => cb(p)),
  onTrack: (cb) => ipcRenderer.on('track', (_e, p) => cb(p)),
  platform: process.platform,
});
