import { createBrowserRouter } from 'react-router-dom'
import DefaultLayout from '@/layouts/default/Index'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { appRoutes } from './routes'

/**
 * 根路由配置。
 * DefaultLayout → ErrorBoundary → 所有业务路由
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <DefaultLayout />,
    children: appRoutes.map((r) => ({
      ...r,
      element: r.element ? <ErrorBoundary>{r.element}</ErrorBoundary> : undefined,
    })),
  },
])
