import type { ThemeConfig } from 'antd'
import { theme as antdTheme } from 'antd'

/** 主题色预设 */
export const PRIMARY_COLORS = [
  '#1a1a2e', '#1677ff', '#722ed1', '#13c2c2',
  '#52c41a', '#fa8c16', '#eb2f96', '#f5222d',
]

/** 根据设置生成 Antd ThemeConfig */
export function generateThemeConfig(settings: {
  darkMode: boolean; primaryColor: string; borderRadius: number
}): ThemeConfig {
  return {
    algorithm: settings.darkMode ? antdTheme.darkAlgorithm : undefined,
    token: {
      colorPrimary: settings.primaryColor,
      borderRadius: settings.borderRadius,
    },
  }
}
