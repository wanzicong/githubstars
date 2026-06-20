import { createBrowserRouter } from 'react-router-dom'
import { Suspense } from 'react'
import { Spin } from 'antd'
import DefaultLayout from '@/layouts/default/Index'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { appRoutes } from './routes'

/**
 * 根路由配置。
 * DefaultLayout → Suspense → ErrorBoundary → 所有业务路由
 */
export const router = createBrowserRouter([
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
])
