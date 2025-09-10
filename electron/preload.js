const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  db: {
    get: () => ipcRenderer.invoke('db:get'),
    set: (data) => ipcRenderer.invoke('db:set', data),
    backup: () => ipcRenderer.invoke('db:backup'),
    restore: () => ipcRenderer.invoke('db:restore'),
  },
  image: {
    upload: () => ipcRenderer.invoke('image:upload'),
    get: (fileName) => ipcRenderer.invoke('image:get', fileName)
  },
  theme: {
    set: (mode) => ipcRenderer.invoke('theme:set', mode)
  }
})