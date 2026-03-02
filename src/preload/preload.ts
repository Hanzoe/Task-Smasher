import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  toggleMiniMode: (isMini: boolean) => ipcRenderer.send('toggle-mini-mode', isMini),
  
  getTodos: () => ipcRenderer.invoke('get-todos'),
  saveTodos: (todos: any) => ipcRenderer.send('save-todos', todos),
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNotes: (notes: Record<string, string>) => ipcRenderer.send('save-notes', notes),
  saveImage: (filePath: string) => ipcRenderer.invoke('save-image', filePath),
  saveImageFromBuffer: (buffer: ArrayBuffer, mimeType: string) => ipcRenderer.invoke('save-image-from-buffer', buffer, mimeType),

  // Config IPCs
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg: any) => ipcRenderer.send('save-config', cfg),
  selectFolder: () => ipcRenderer.invoke('select-folder')
})
