const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  title: 'The Laz searcher',
  auth: async (data) => {
    const res = await ipcRenderer.invoke('auth');
    return res;
  },
  findNewFiles: async () => {
    const res = await ipcRenderer.invoke('findNewFiles');
    return res;
  },
  checkFolders: async (data) => {
    //data = {block: 2728, fileNames:['M-34-54-C-b-1-2-3-3', 'M-34-54-C-b-1-2-3-4']}

    const res = await ipcRenderer.invoke('checkFolders', data);
    return res;
  },
  downloadFile: async (data) => {
    const res = await ipcRenderer.invoke('downloadFile', data);
    return res;
  },
  unArchive: (path) => {
    ipcRenderer.invoke('unArchive', path);
  },
  choosePath: async () => {
    const path = await ipcRenderer.invoke('choosePath');
    return path;
  },
  saveSetups: async (data) => {
    const feedback = await ipcRenderer.invoke('saveSetups', data);
    return feedback;
  },
  getSetups: async () => {
    const res = await ipcRenderer.invoke('getSetups');
    return res;
  },
  getSheetTitles: async (data = { spreadsheetId: '' }) => {
    const sheetNames = await ipcRenderer.invoke('getSheetTitles', data);
    return sheetNames;
  },
});
