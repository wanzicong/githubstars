import { BrowserWindow, shell, screen, app } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import log from 'electron-log'

/**
 * 窗口状态存储
 */
interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

const store = new Store<WindowState>({
  name: 'window-state',
  defaults: {
    width: 1400,
    height: 900,
    isMaximized: false
  }
})

/**
 * 获取窗口状态
 */
function getWindowState(): WindowState {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const savedState = store.store

  return {
    x: savedState.x ?? Math.max(0, (width - savedState.width) / 2),
    y: savedState.y ?? Math.max(0, (height - savedState.height) / 2),
    width: Math.min(savedState.width, width),
    height: Math.min(savedState.height, height),
    isMaximized: savedState.isMaximized
  }
}

/**
 * 保存窗口状态
 */
function saveWindowState(window: BrowserWindow): void {
  if (!window.isDestroyed()) {
    const bounds = window.getBounds()
    const isMaximized = window.isMaximized()

    store.store = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized
    }
  }
}

/**
 * 创建主窗口
 */
export function createMainWindow(): BrowserWindow {
  const windowState = getWindowState()

  const mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    title: 'GitHub Stars',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 窗口准备好后显示
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()

    if (windowState.isMaximized) {
      mainWindow.maximize()
    }

    log.info('主窗口已显示')
  })

  // 保存窗口状态
  mainWindow.on('close', () => {
    saveWindowState(mainWindow)
  })

  // 打开外部链接时使用默认浏览器
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 加载内容
  loadContent(mainWindow)

  return mainWindow
}

/**
 * 加载窗口内容
 */
function loadContent(window: BrowserWindow): void {
  if (is.dev) {
    // 开发环境：加载前端开发服务器
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:10001'
    window.loadURL(frontendUrl)
    window.webContents.openDevTools()
    log.info(`开发环境：加载前端服务器 ${frontendUrl}`)
  } else {
    // 生产环境：从 extraResources 加载前端构建产物
    const frontendPath = join(process.resourcesPath, 'frontend-dist', 'index.html')
    window.loadFile(frontendPath)
    log.info('生产环境：加载打包文件')
  }
}
