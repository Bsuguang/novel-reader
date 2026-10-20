const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform, // 'darwin' | 'win32' | 'linux'，渲染层据此做平台微调
  openFile: () => ipcRenderer.invoke('open-file'),
  openFileAt: (p) => ipcRenderer.invoke('open-file-path', p),
  getStartupFile: () => ipcRenderer.invoke('get-startup-file'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  saveTextFile: (opts) => ipcRenderer.invoke('save-text-file', opts),
  // macOS：主进程 open-file 事件（双击 txt / 拖到 Dock 图标）转发的待打开路径
  onOpenPath: (cb) => ipcRenderer.on('open-path', (e, p) => cb(p)),
  // 桌面宠物
  petRestore: () => ipcRenderer.invoke('pet-restore'),
  petDragStart: (pt) => ipcRenderer.send('pet-drag-start', pt),
  petDragMove: (pt) => ipcRenderer.send('pet-drag-move', pt),
  petDragEnd: () => ipcRenderer.send('pet-drag-end'),
});
