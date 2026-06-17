import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAppStore } from '@/stores'
import { generateThemeConfig } from '@/designs'
import { router } from '@/router'

/**
 * 应用根组件 —— 配置 Antd 主题 + 提供路由。
 *
 * 主题由 appStore（Zustand）驱动，用户通过设置抽屉实时调整。
 * 路由由 router/index.ts 通过 createBrowserRouter 创建。
 *
 * 架构层级：根组件，无上层调用方。
 *
 * @depends
 *   - useAppStore（主题色、暗色模式）
 *   - generateThemeConfig（生成 Antd ThemeConfig）
 *   - router（createBrowserRouter 创建的路由器）
 */
export default function App() {
  const primaryColor = useAppStore((s) => s.primaryColor)
  const darkMode = useAppStore((s) => s.darkMode)

  const themeConfig = generateThemeConfig({
    darkMode,
    primaryColor,
    borderRadius: 8,
  })

  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  )
}
