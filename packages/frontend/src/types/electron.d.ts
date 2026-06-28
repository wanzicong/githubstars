/**
 * Electron 桌面端 API 类型声明
 *
 * 在 Electron 环境下，preload 脚本通过 contextBridge 暴露的 API。
 * Web 环境下不存在此 API，使用前需通过 isElectron() 检测。
 */

interface ElectronDialogAPI {
  openDirectory(options?: { title?: string; defaultPath?: string }): Promise<string | null>
}

interface ElectronDesktopAPI {
  getConfig(): Promise<{
    isDesktop: boolean
    platform: string
    userDataPath: string
    tempPath: string
    downloadsPath: string
  }>
}

interface ElectronWindowAPI {
  minimize(): Promise<void>
  maximize(): Promise<void>
  isMaximized(): Promise<boolean>
  close(): Promise<void>
}

interface ElectronUpdateAPI {
  check(): Promise<void>
  download(): Promise<void>
  install(): Promise<void>
  onChecking(callback: () => void): void
  onAvailable(callback: (info: { version: string }) => void): void
  onNotAvailable(callback: () => void): void
  onProgress(callback: (progress: { percent: number }) => void): void
  onDownloaded(callback: (info: { version: string }) => void): void
  onError(callback: (error: { message: string }) => void): void
  removeAllListeners(): void
}

interface ElectronAPI {
  dialog: ElectronDialogAPI
  desktop: ElectronDesktopAPI
  window: ElectronWindowAPI
  update: ElectronUpdateAPI
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
