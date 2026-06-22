import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createMainWindow } from './window'
import { setupIpcHandlers } from './ipc'
import { createTray } from './tray'
import { setupAutoUpdater } from './updater'
import log from 'electron-log'

// 配置日志
log.transports.file.level = 'info'
log.info('应用启动')

// 禁用硬件加速（可选，解决某些显卡问题）
// app.disableHardwareAcceleration()

// 设置应用用户模型ID（Windows）
if (process.platform === 'win32') {
  app.setAppUserModelId('com.githubstars.desktop')
}

let mainWindow: BrowserWindow | null = null

/**
 * 应用准备就绪时初始化
 */
app.whenReady().then(() => {
  // 设置应用安全模型
  electronApp.setAppUserModelId('com.githubstars.desktop')

  // 开发环境下默认打开或关闭DevTools
  if (is.dev) {
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })
  }

  // 创建主窗口
  mainWindow = createMainWindow()

  // 设置IPC处理器
  setupIpcHandlers(mainWindow)

  // 创建系统托盘
  createTray(mainWindow)

  // 设置自动更新
  setupAutoUpdater(mainWindow)

  // macOS: 点击dock图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      setupIpcHandlers(mainWindow)
      createTray(mainWindow)
      setupAutoUpdater(mainWindow)
    }
  })

  log.info('应用初始化完成')
})

/**
 * 所有窗口关闭时退出应用（macOS除外）
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * 处理未捕获的异常
 */
process.on('uncaughtException', (error) => {
  log.error('未捕获的异常:', error)
})

process.on('unhandledRejection', (reason) => {
  log.error('未处理的Promise拒绝:', reason)
})
