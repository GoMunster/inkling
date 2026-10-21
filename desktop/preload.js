'use strict';
// The only bridge between the page and the computer: a fixed list of project actions, no general file access.
const { contextBridge, ipcRenderer } = require('electron');
const call =
  name =>
  (...args) =>
    ipcRenderer.invoke('ink:' + name, ...args);

contextBridge.exposeInMainWorld('inklingDesktop', {
  list: call('list'),
  create: call('create'),
  load: call('load'),
  last: call('last'),
  save: call('save'),
  changed: call('changed'),
  read: call('read'),
  adopt: call('adopt'),
  clearStrays: call('clearStrays'),
  here: call('here'),
  openShared: call('openShared'),
  shareMove: call('shareMove'),
  unlink: call('unlink'),
  where: call('where'),
  duplicate: call('duplicate'),
  trash: call('trash'),
  backups: call('backups'),
  restoreBackup: call('restoreBackup'),
  picSave: call('picSave'),
  picDelete: call('picDelete'),
  picRead: call('picRead'),
  saveFile: call('saveFile'),
  openFile: call('openFile'),
  pdf: call('pdf'),
  reveal: call('reveal'),
  dir: call('dir'),
  setTitle: call('setTitle'),
  prefs: call('prefs'),
  setPrefs: call('setPrefs'),
  chooseDir: call('chooseDir'),
  useDir: call('useDir'),
  checkUpdates: call('checkUpdates'),
  installUpdate: call('installUpdate'),
  openReleases: call('openReleases'),
  closeReady: () => ipcRenderer.send('ink:closeReady'),
  onMenu: fn => ipcRenderer.on('ink:menu', (e, a) => fn(String(a))),
  onClosing: fn => ipcRenderer.on('ink:closing', () => fn()),
  onUpdate: fn => ipcRenderer.on('ink:update', (e, s) => fn(s)),
  onFocus: fn => ipcRenderer.on('ink:focus', () => fn())
});
