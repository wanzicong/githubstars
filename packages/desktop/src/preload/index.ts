import { contextBridge, ipcRenderer } from 'electron'

/** IPC 通道列表，用于统一清理监听器 */
const UPDATE_CHANNELS = [
  'update:checking', 'update:available', 'update:not-available',
  'update:progress', 'update:downloaded', 'update:error'
]

/**
 * Electron API 类型定义
 */
export interface ElectronAPI {
  // 应用信息
  app: {
    getVersion: () => Promise<string>
    getName: () => Promise<string>
    getPath: (name: string) => Promise<string>
  }

  // 对话框
  dialog: {
    openDirectory: (options?: { title?: string; defaultPath?: string }) => Promise<string | null>
    saveFile: (options?: { title?: string; defaultPath?: string; filters?: Electron.FileFilter[] }) => Promise<string | null>
    showMessageBox: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>
  }

  // Shell操作
  shell: {
    openExternal: (url: string) => Promise<void>
    showItemInFolder: (fullPath: string) => Promise<void>
  }

  // 窗口控制
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
  }

  // 系统信息
  system: {
    getInfo: () => Promise<{
      platform: string
      arch: string
      version: string
      electronVersion: string
      chromeVersion: string
      nodeVersion: string
    }>
  }

  // 桌面端配置
  desktop: {
    getConfig: () => Promise<{
      isDesktop: boolean
      platform: string
      userDataPath: string
      tempPath: string
      downloadsPath: string
      backendPort: number
      agentPort: number
    }>
  }

  // 后端服务
  backend: {
    getStatus: () => Promise<{ running: boolean; port: number }>
  }

  // Agent 服务
  agent: {
    getStatus: () => Promise<{ running: boolean; port: number }>
  }

  // 更新相关
  update: {
    check: () => Promise<{ updateInfo?: any; error?: string }>
    download: () => Promise<{ success?: boolean; error?: string }>
    install: () => Promise<{ success?: boolean }>
    onChecking: (callback: () => void) => void
    onAvailable: (callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => void
    onNotAvailable: (callback: (info: { version: string }) => void) => void
    onProgress: (callback: (progress: { percent: number; bytesPerSecond?: number; transferred?: number; total?: number }) => void) => void
    onDownloaded: (callback: (info: { version: string }) => void) => void
    onError: (callback: (error: { message: string }) => void) => void
    removeAllListeners: () => void
  }
}

/**
 * 暴露给渲染进程的API
 */
const electronAPI: ElectronAPI = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getName: () => ipcRenderer.invoke('app:getName'),
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name)
  },

  dialog: {
    openDirectory: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
    showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options)
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    showItemInFolder: (fullPath) => ipcRenderer.invoke('shell:showItemInFolder', fullPath)
  },

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },

  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo')
  },

  desktop: {
    getConfig: () => ipcRenderer.invoke('desktop:getConfig')
  },

  backend: {
    getStatus: () => ipcRenderer.invoke('backend:getStatus')
  },

  agent: {
    getStatus: () => ipcRenderer.invoke('agent:getStatus')
  },

  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onChecking: (callback) => {
      ipcRenderer.removeAllListeners('update:checking')
      ipcRenderer.on('update:checking', callback)
    },
    onAvailable: (callback) => {
      ipcRenderer.removeAllListeners('update:available')
      ipcRenderer.on('update:available', (_, info) => callback(info))
    },
    onNotAvailable: (callback) => {
      ipcRenderer.removeAllListeners('update:not-available')
      ipcRenderer.on('update:not-available', (_, info) => callback(info))
    },
    onProgress: (callback) => {
      ipcRenderer.removeAllListeners('update:progress')
      ipcRenderer.on('update:progress', (_, progress) => callback(progress))
    },
    onDownloaded: (callback) => {
      ipcRenderer.removeAllListeners('update:downloaded')
      ipcRenderer.on('update:downloaded', (_, info) => callback(info))
    },
    onError: (callback) => {
      ipcRenderer.removeAllListeners('update:error')
      ipcRenderer.on('update:error', (_, error) => callback(error))
    },
    removeAllListeners: () => {
      UPDATE_CHANNELS.forEach(ch => ipcRenderer.removeAllListeners(ch))
    }
  }
}

// 通过contextBridge安全地暴露API
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
