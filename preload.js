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
  downloadFiles: async (data) => {
    //data = {block: 2728, fileNames:['M-34-54-C-b-1-2-3-3', 'M-34-54-C-b-1-2-3-4']}

    const res = await ipcRenderer.invoke('downloadFiles', data);
    return res;
  },
  choosePath: async () => {
    const res = await ipcRenderer.invoke('choosePath');
    return res;
  },
});
