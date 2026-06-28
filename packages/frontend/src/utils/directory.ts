/**
 * 桌面端目录选择工具
 *
 * 在 Electron 环境下使用原生对话框选择文件夹
 * 在 Web 环境下回退到用户手动输入
 */

import { isElectron } from './electron'

/**
 * 选择目录
 *
 * @param options 选择选项
 * @returns 选择的目录路径，取消时返回 null
 */
export async function selectDirectory(options?: {
  title?: string
  defaultPath?: string
}): Promise<string | null> {
  if (isElectron()) {
    // 桌面端：使用原生对话框
    return await window.electronAPI!.dialog.openDirectory({
      title: options?.title ?? '选择目标目录',
      defaultPath: options?.defaultPath
    })
  }

  // Web 端：无法直接访问文件系统，返回 null
  // 实际使用时应提示用户手动输入路径
  return null
}

/**
 * 验证目录路径格式
 *
 * @param path 目录路径
 * @returns 是否为有效路径格式
 */
export function isValidDirectoryPath(path: string): boolean {
  if (!path || path.trim().length === 0) {
    return false
  }

  // Windows 路径：C:\xxx 或 D:\xxx
  const windowsPathRegex = /^[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/
  // Unix 路径：/xxx/xxx
  const unixPathRegex = /^\/(?:[^/\0]+\/)*[^/\0]*$/

  return windowsPathRegex.test(path) || unixPathRegex.test(path)
}

/**
 * 格式化目录路径
 *
 * @param path 原始路径
 * @returns 格式化后的路径
 */
export function formatDirectoryPath(path: string): string {
  // 去除首尾空格
  let formatted = path.trim()

  // 根据平台统一路径分隔符
  const isWindows = typeof navigator !== 'undefined' && /Win/.test(navigator.platform)
  const sep = isWindows ? '\\' : '/'

  if (isWindows) {
    formatted = formatted.replace(/\//g, '\\')
  }

  // 确保路径以分隔符结尾
  if (!formatted.endsWith('\\') && !formatted.endsWith('/')) {
    formatted += sep
  }

  return formatted
}
