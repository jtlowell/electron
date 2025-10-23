const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronReddit', {
  searchProducts: async (category, options) => {
    return await ipcRenderer.invoke('reddit:search-products', category, options);
  },

  formatReportAsHTML: async (report) => {
    return await ipcRenderer.invoke('reddit:format-report-html', report);
  },

  saveFile: async (filename, content) => {
    return await ipcRenderer.invoke('reddit:save-file', filename, content);
  },

  openExternal: async (url) => {
    return await shell.openExternal(url);
  }
});
