import { createBrowserRouter, createHashRouter } from 'react-router-dom'
import { Suspense } from 'react'
import { Spin } from 'antd'
import DefaultLayout from '@/layouts/default/Index'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { isElectron } from '@/utils/electron'
import { appRoutes } from './routes'

/**
 * 构建路由配置数组
 */
function buildRouteConfig() {
  return [
    {
      path: '/',
      element: <DefaultLayout />,
      children: appRoutes.map((r) => ({
        ...r,
        element: r.element ? (
          <ErrorBoundary>
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>}>
              {r.element}
            </Suspense>
          </ErrorBoundary>
        ) : undefined,
      })),
    },
  ]
}

/**
 * 根路由配置。
 *
 * - Web 端（HTTP）：用 createBrowserRouter（HTML5 History API，URL 更干净）
 * - 桌面端（file://）：用 createHashRouter（hash 路由兼容 file: 协议，避免空白页）
 *
 * DefaultLayout → Suspense → ErrorBoundary → 所有业务路由
 */
export const router = isElectron()
  ? createHashRouter(buildRouteConfig())
  : createBrowserRouter(buildRouteConfig())
