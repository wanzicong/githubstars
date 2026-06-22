/**
 * Electron 桌面端环境检测工具
 *
 * 统一导出 isElectron 检测函数，供前端各模块复用。
 */

/** 检测是否在 Electron 桌面端环境中运行 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined
}
