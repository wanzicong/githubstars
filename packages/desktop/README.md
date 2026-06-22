# GitHub Stars Desktop

GitHub Stars 桌面应用 - 基于 Electron 构建

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 构建工具 | electron-vite |
| 打包工具 | electron-builder |
| 状态存储 | electron-store |
| 日志 | electron-log |
| 自动更新 | electron-updater |

## 开发

### 前置条件

1. 已安装 Node.js >= 22
2. 已安装 npm >= 10
3. 已启动后端服务 (`npm run dev:backend`)

### 启动开发

```bash
# 在项目根目录
npm run dev:desktop

# 或者直接在 desktop 目录
cd packages/desktop
npm run dev
```

开发模式下会自动打开 DevTools，方便调试。

### 构建

```bash
# 构建 JS 资源
npm run build

# 打包为桌面应用
npm run package          # 根据当前平台打包
npm run package:win      # 打包 Windows 版本
npm run package:mac      # 打包 macOS 版本
npm run package:linux    # 打包 Linux 版本
```

打包后的文件在 `dist/` 目录。

## 目录结构

```
packages/desktop/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── index.ts       # 主进程入口
│   │   ├── window.ts      # 窗口管理（状态保存/恢复）
│   │   ├── ipc.ts         # IPC 通信处理器
│   │   ├── tray.ts        # 系统托盘
│   │   └── updater.ts     # 自动更新
│   ├── preload/           # 预加载脚本
│   │   ├── index.ts       # 暴露给渲染进程的 API
│   │   └── index.d.ts     # TypeScript 类型声明
│   └── renderer/          # 渲染进程入口
│       ├── index.html     # HTML 入口
│       └── main.tsx       # React 入口
├── build/                 # 构建资源（图标等）
├── electron-vite.config.ts
├── electron-builder.config.ts
├── package.json
└── tsconfig.json
```

## 功能特性

### 窗口管理
- 窗口状态自动保存/恢复（位置、大小、最大化状态）
- 支持最小尺寸限制（1024x768）
- 外部链接自动使用默认浏览器打开

### 系统托盘
- 托盘图标常驻
- 点击托盘图标显示/隐藏窗口
- 右键菜单：显示窗口、检查更新、退出

### 自动更新
- 自动检查更新（基于 GitHub Releases）
- 下载进度通知
- 静默下载，用户确认后安装

### 原生集成
- 原生文件夹选择对话框
- 原生消息框
- 系统信息获取

## IPC API

桌面端暴露给渲染进程的 API：

```typescript
// 应用信息
window.electronAPI.app.getVersion()
window.electronAPI.app.getName()

// 对话框
window.electronAPI.dialog.openDirectory(options)
window.electronAPI.dialog.saveFile(options)
window.electronAPI.dialog.showMessageBox(options)

// Shell 操作
window.electronAPI.shell.openExternal(url)
window.electronAPI.shell.showItemInFolder(path)

// 窗口控制
window.electronAPI.window.minimize()
window.electronAPI.window.maximize()
window.electronAPI.window.close()

// 更新相关
window.electronAPI.update.check()
window.electronAPI.update.download()
window.electronAPI.update.install()
```

## 前端集成

在前端代码中使用桌面端功能：

```typescript
import { isElectron, useDirectoryPicker, useWindowControls } from '@/hooks/useElectron'

// 检测是否在桌面端
if (isElectron()) {
  // 桌面端特有逻辑
}

// 使用目录选择
const { pickDirectory, isSupported } = useDirectoryPicker()
if (isSupported) {
  const dir = await pickDirectory({ title: '选择克隆目录' })
}

// 使用窗口控制
const { minimize, maximize, close } = useWindowControls()
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `ELECTRON_RENDERER_URL` | 开发环境渲染进程 URL（自动设置） |

## 注意事项

1. **后端依赖**：桌面端仍需启动 NestJS 后端服务
2. **端口配置**：默认连接 `http://localhost:10002`
3. **安全策略**：已启用 `contextIsolation`，禁用 `nodeIntegration`
4. **图标配置**：正式发布前需在 `build/` 目录添加应用图标

## 故障排除

### 开发模式无法启动

1. 确保后端服务已启动
2. 检查端口 10002 是否被占用
3. 运行 `npm install` 安装依赖

### 打包失败

1. 确保已构建前端资源
2. 检查 `build/` 目录是否有图标文件
3. 查看错误日志定位问题

### 自动更新不工作

1. 确保已配置 `publish` 选项
2. 检查 GitHub Releases 是否有新版本
3. 确认网络连接正常
