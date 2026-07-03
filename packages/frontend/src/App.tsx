import { useEffect, useState, useRef } from 'react'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, App as AntApp, Spin, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAppStore } from '@/stores'
import { generateThemeConfig } from '@/designs'
import { router } from '@/router'
import { setBaseURL } from '@/api/request'
import { isElectron } from '@/utils/electron'

const { Text } = Typography

/**
 * 桌面端初始化 —— 获取后端端口并设置 API baseURL
 */
function DesktopInit({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(
    isElectron() ? 'loading' : 'ready'
  )
  const [errorMsg, setErrorMsg] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isElectron()) return

    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null

    // 轮询等待后端就绪
    const pollBackend = () => {
      if (cancelled) return
      window.electronAPI!.backend.getStatus().then((status) => {
        if (cancelled) return
        if (status.running && status.port) {
          // 后端已就绪 → 清除超时定时器，防止误触错误页
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          setBaseURL(`http://localhost:${status.port}`)
          console.log(`[Desktop] 后端已就绪，端口 ${status.port}`)
          setState('ready')
        } else {
          pollTimer = setTimeout(pollBackend, 2000)
        }
      }).catch(() => {
        if (cancelled) return
        pollTimer = setTimeout(pollBackend, 2000)
      })
    }

    // 启动轮询
    pollBackend()

    // 超时保护：60 秒后未就绪 → 错误页
    timeoutRef.current = setTimeout(() => {
      if (cancelled) return
      setState('error')
      setErrorMsg('后端服务启动超时（已等待 60 秒），请尝试重启应用')
    }, 60000)

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
        <Spin size="large" />
        <Text type="secondary">正在启动后端服务...</Text>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, padding: 32, textAlign: 'center' }}>
        <Text type="danger" style={{ fontSize: 18 }}>❌ {errorMsg}</Text>
        <Text type="secondary" style={{ fontSize: 13, maxWidth: 480 }}>
          桌面端使用 SQLite 嵌入式数据库，无需额外配置。
          如果问题持续出现，请尝试退出应用后重新启动。
        </Text>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * 应用根组件 —— 配置 Antd 主题 + 提供路由。
 *
 * - 桌面端：先获取后端端口，再渲染（显示"正在启动后端服务..."）
 * - Web 端：直接渲染
 *
 * 主题由 appStore（Zustand）驱动，用户通过设置抽屉实时调整。
 * 路由由 router/index.ts 通过 createBrowserRouter 创建。
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
        <DesktopInit>
          <RouterProvider router={router} />
        </DesktopInit>
      </AntApp>
    </ConfigProvider>
  )
}
