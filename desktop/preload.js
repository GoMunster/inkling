'use strict';
// The only bridge between the page and the computer: a fixed list of project actions, no general file access.
const { contextBridge, ipcRenderer } = require('electron');
const call = (name) => (...args) => ipcRenderer.invoke('ink:' + name, ...args);

contextBridge.exposeInMainWorld('inklingDesktop', {
  list: call('list'), create: call('create'), load: call('load'), last: call('last'), save: call('save'),
  duplicate: call('duplicate'), trash: call('trash'), backups: call('backups'), restoreBackup: call('restoreBackup'),
  picSave: call('picSave'), picDelete: call('picDelete'), picRead: call('picRead'),
  saveFile: call('saveFile'), openFile: call('openFile'), reveal: call('reveal'), dir: call('dir'),
  setTitle: call('setTitle'),
  closeReady: () => ipcRenderer.send('ink:closeReady'),
  onMenu: (fn) => ipcRenderer.on('ink:menu', (e, a) => fn(String(a))),
  onClosing: (fn) => ipcRenderer.on('ink:closing', () => fn())
});
