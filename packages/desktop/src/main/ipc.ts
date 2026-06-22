import { BrowserWindow, ipcMain, dialog, app, shell } from 'electron'
import { join } from 'node:path'
import log from 'electron-log'

/**
 * 设置IPC处理器
 */
export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  /**
   * 获取应用版本
   */
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  /**
   * 获取应用名称
   */
  ipcMain.handle('app:getName', () => {
    return app.getName()
  })

  /** 允许渲染进程访问的系统路径名称白名单 */
  const ALLOWED_PATHS = ['userData', 'temp', 'downloads', 'desktop', 'documents', 'home', 'appData', 'logs'] as const
  type AllowedPathName = (typeof ALLOWED_PATHS)[number]

  /**
   * 获取应用路径
   */
  ipcMain.handle('app:getPath', (_, name: AllowedPathName) => {
    if (!ALLOWED_PATHS.includes(name)) {
      throw new Error(`不允许的路径名称: ${name}`)
    }
    return app.getPath(name)
  })

  /**
   * 显示打开文件夹对话框
   */
  ipcMain.handle('dialog:openDirectory', async (_, options?: { title?: string; defaultPath?: string }) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: options?.title ?? '选择文件夹',
      defaultPath: options?.defaultPath
    })

    if (result.canceled) {
      return null
    }

    return result.filePaths[0]
  })

  /**
   * 显示保存文件对话框
   */
  ipcMain.handle('dialog:saveFile', async (_, options?: { title?: string; defaultPath?: string; filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: options?.title ?? '保存文件',
      defaultPath: options?.defaultPath,
      filters: options?.filters
    })

    if (result.canceled) {
      return null
    }

    return result.filePath
  })

  /**
   * 显示消息框
   */
  ipcMain.handle('dialog:showMessageBox', async (_, options: Electron.MessageBoxOptions) => {
    return await dialog.showMessageBox(mainWindow, options)
  })

  /**
   * 打开外部链接
   * 仅允许 http/https 协议，防止 file:///smb:// 等危险协议
   */
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      throw new Error(`不允许的协议: ${parsed.protocol}`)
    }
    await shell.openExternal(url)
  })

  /**
   * 在文件管理器中显示
   */
  ipcMain.handle('shell:showItemInFolder', (_, fullPath: string) => {
    shell.showItemInFolder(fullPath)
  })

  /**
   * 窗口控制
   */
  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow.isMaximized()
  })

  /**
   * 获取系统信息
   */
  ipcMain.handle('system:getInfo', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node
    }
  })

  /**
   * 获取桌面端特有信息
   */
  ipcMain.handle('desktop:getConfig', () => {
    return {
      isDesktop: true,
      platform: process.platform,
      userDataPath: app.getPath('userData'),
      tempPath: app.getPath('temp'),
      downloadsPath: app.getPath('downloads')
    }
  })

  log.info('IPC处理器已注册')
}
