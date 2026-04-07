import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../renderer/src/types'

const api: ElectronAPI = {
  getProjects: () => ipcRenderer.invoke('session:getProjects'),
  getSessions: (projectId) => ipcRenderer.invoke('session:getSessions', projectId),
  getMessages: (projectId, sessionId) => ipcRenderer.invoke('session:getMessages', projectId, sessionId),
  globalSearch: (query) => ipcRenderer.invoke('session:globalSearch', query),
  onSessionUpdated: (callback) => {
    ipcRenderer.on('session:updated', callback)
    return () => ipcRenderer.removeListener('session:updated', callback)
  },
}

contextBridge.exposeInMainWorld('api', api)
