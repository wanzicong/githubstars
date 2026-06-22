import { BrowserWindow, Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'node:path'
import log from 'electron-log'

let tray: Tray | null = null

/**
 * 创建系统托盘
 */
export function createTray(mainWindow: BrowserWindow): Tray {
  // 创建托盘图标
  const iconPath = join(__dirname, '../../build/icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('GitHub Stars')

  // 创建上下文菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => {
        // 触发更新检查
        mainWindow.webContents.send('menu:check-update')
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // 点击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  log.info('系统托盘已创建')

  return tray
}

/**
 * 更新托盘图标
 */
export function updateTrayIcon(iconPath: string): void {
  if (tray && !tray.isDestroyed()) {
    const icon = nativeImage.createFromPath(iconPath)
    tray.setImage(icon.resize({ width: 16, height: 16 }))
  }
}

/**
 * 销毁托盘
 */
export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) {
    tray.destroy()
    tray = null
    log.info('系统托盘已销毁')
  }
}
