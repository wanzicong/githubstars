import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createMainWindow } from './window'
import { setupIpcHandlers } from './ipc'
import { createTray } from './tray'
import { setupAutoUpdater } from './updater'
import { backendManager } from './backend'
import { AgentManager } from './agent'
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

/** Agent 服务管理器（在后端就绪后初始化，与后端共享同一个 SQLite 库） */
let agentManager: AgentManager | null = null

/**
 * 应用准备就绪时初始化
 */
app.whenReady().then(async () => {
  // 设置应用安全模型
  electronApp.setAppUserModelId('com.githubstars.desktop')

  // 开发环境下默认打开或关闭DevTools
  if (is.dev) {
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })
  }

  // 启动后端服务（先于窗口创建）
  const backendStarted = await backendManager.start()
  if (!backendStarted) {
    log.error('[App] 后端服务启动失败，应用将以有限模式运行')
  } else {
    log.info(`[App] 后端服务已启动，端口: ${backendManager.getPort()}`)

    // 后端就绪后启动 Agent 服务（复用后端的 SQLite 库）
    agentManager = new AgentManager(backendManager.getDatabaseFilePath())
    const agentStarted = await agentManager.start()
    if (agentStarted) {
      log.info(`[App] Agent 服务已启动，端口: ${agentManager.getPort()}`)
    } else {
      log.error('[App] Agent 服务启动失败，AI Agent 功能将不可用')
    }
  }

  // 创建主窗口
  mainWindow = createMainWindow()

  // 设置IPC处理器
  setupIpcHandlers(mainWindow, agentManager)

  // 创建系统托盘
  createTray(mainWindow)

  // 设置自动更新
  setupAutoUpdater(mainWindow)

  // macOS: 点击dock图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      setupIpcHandlers(mainWindow, agentManager)
      createTray(mainWindow)
      setupAutoUpdater(mainWindow)
    }
  })

  log.info('应用初始化完成')
})

/**
 * 应用退出时停止后端
 */
app.on('before-quit', async () => {
  log.info('[App] 应用退出，停止后端与 Agent 服务')
  await Promise.allSettled([
    backendManager.stop(),
    agentManager?.stop() ?? Promise.resolve(),
  ])
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
