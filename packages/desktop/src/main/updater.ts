import { BrowserWindow, dialog, ipcMain } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import log from 'electron-log'

/**
 * 设置自动更新
 */
export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  // 配置自动更新
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = log

  /**
   * 检查更新时
   */
  autoUpdater.on('checking-for-update', () => {
    log.info('正在检查更新...')
    mainWindow.webContents.send('update:checking')
  })

  /**
   * 发现新版本时
   */
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('发现新版本:', info.version)
    mainWindow.webContents.send('update:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })

    // 显示更新提示（可选）
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${info.version}`,
      detail: '新版本正在下载中，下载完成后将自动安装。',
      buttons: ['确定']
    })
  })

  /**
   * 没有可用更新时
   */
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info('当前已是最新版本:', info.version)
    mainWindow.webContents.send('update:not-available', {
      version: info.version
    })
  })

  /**
   * 下载进度
   */
  autoUpdater.on('download-progress', (progress) => {
    const message = `下载速度: ${progress.bytesPerSecond} - 已下载: ${progress.percent.toFixed(2)}%`
    log.info(message)
    mainWindow.webContents.send('update:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  /**
   * 下载完成
   */
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info('更新下载完成:', info.version)
    mainWindow.webContents.send('update:downloaded', {
      version: info.version
    })

    // 提示用户重启应用
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新已就绪',
      message: '新版本已下载完成',
      detail: '点击"立即重启"以完成更新，或稍后手动重启应用。',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })

  /**
   * 更新错误
   */
  autoUpdater.on('error', (error: Error) => {
    log.error('更新错误:', error)
    mainWindow.webContents.send('update:error', {
      message: error.message
    })
  })

  /**
   * 监听渲染进程的更新请求
   */
  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return {
        updateInfo: result?.updateInfo ?? null
      }
    } catch (error) {
      log.error('检查更新失败:', error)
      return {
        error: (error as Error).message
      }
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      log.error('下载更新失败:', error)
      return {
        error: (error as Error).message
      }
    }
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
    return { success: true }
  })

  log.info('自动更新已配置')
}

/**
 * 手动检查更新
 */
export async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    log.error('手动检查更新失败:', error)
  }
}
