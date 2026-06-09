import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let serverPort: number = 0;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'GitHub Stars 管理系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'resources', 'icon.ico'),
  });

  // 判断是否开发模式
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

  if (isDev) {
    // 开发模式：加载 Vite dev server
    const vitePort = process.env.VITE_PORT || '5173';
    mainWindow.loadURL(`http://localhost:${vitePort}`);
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：由 Express 托管静态文件 + 路由
    mainWindow.loadURL(`http://localhost:${serverPort}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-server-port', () => serverPort);

ipcMain.handle('show-save-dialog', async (_event, options) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options.defaultPath || 'github-stars-links.txt',
    filters: options.filters || [
      { name: '文本文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  return result;
});

ipcMain.handle('write-file', async (_event, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  const { startServer } = await import('./server/index');

  // 判断模式
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

  // 开发模式用固定端口 6002（避开 Spring Boot 的 6001），生产模式随机端口 + 托管静态文件
  const result = await startServer({
    preferredPort: isDev ? 6002 : 0,
    isProduction: !isDev,
  });
  serverPort = result.port;

  console.log(`🚀 Express 服务器已启动，端口: ${serverPort}`);
  console.log(`📂 数据库路径: ${result.dbPath}`);
  console.log(`📋 运行模式: ${isDev ? '开发' : '生产'}`);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('应用退出');
});

export { serverPort };
