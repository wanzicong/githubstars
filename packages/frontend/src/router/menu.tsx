import { lazy } from 'react'
import {
  StarOutlined,
  SyncOutlined,
  BarChartOutlined,
  UserOutlined,
  SettingOutlined,
  SearchOutlined,
  FireOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
/**
 * 导航菜单项定义 —— 集中管理所有菜单的 key、图标、标题、排序。
 * 结构与路由模块解耦，方便菜单与路由独立演进。
 *
 * @see router/routes/modules/*.tsx —— 各模块的路由定义
 */

export interface MenuItem {
  key: string
  icon: React.ReactNode
  label: string
  orderNo: number
}

export const menuItems: MenuItem[] = [
  { key: '/', icon: <StarOutlined />, label: 'Star列表', orderNo: 0 },
  { key: '/sync', icon: <SyncOutlined />, label: '同步管理', orderNo: 10 },
  { key: '/stats', icon: <BarChartOutlined />, label: '数据统计', orderNo: 20 },
  { key: '/authors', icon: <UserOutlined />, label: '作者中心', orderNo: 30 },
  { key: '/search', icon: <SearchOutlined />, label: 'GitHub搜索', orderNo: 40 },
  { key: '/trending', icon: <FireOutlined />, label: '趋势排行', orderNo: 50 },
  { key: '/settings', icon: <SettingOutlined />, label: '系统配置', orderNo: 60 },
  { key: '/logs', icon: <FileTextOutlined />, label: '系统日志', orderNo: 70 },
]

// ── 懒加载页面 ──（只在此处定义一次，路由模块直接引用）
export const StarList = lazy(() => import('@/pages/StarList'))
export const StarDetail = lazy(() => import('@/pages/StarDetail'))
export const Sync = lazy(() => import('@/pages/Sync'))
export const Stats = lazy(() => import('@/pages/Stats'))
export const AuthorList = lazy(() => import('@/pages/AuthorList'))
export const AuthorDetail = lazy(() => import('@/pages/AuthorDetail'))
export const Settings = lazy(() => import('@/pages/Settings'))
export const GithubSearch = lazy(() => import('@/pages/GithubSearch'))
export const Trending = lazy(() => import('@/pages/Trending'))
export const Logs = lazy(() => import('@/pages/Logs'))

/**
 * 根据当前路径获取匹配的菜单标题（用于面包屑、标签页标题）。
 */
export function getMenuTitle(pathname: string): string {
  // 精确匹配
  const exact = menuItems.find((m) => m.key === pathname)
  if (exact) return exact.label

  // 详情页特殊路径（必须在前缀匹配之前检查，否则 /authors/xxx 会被 /authors 前缀拦截返回“作者中心”）
  if (pathname.startsWith('/stars/')) return 'Star详情'
  if (pathname.startsWith('/authors/')) return '作者详情'

  // 前缀匹配（如 /sync/xxx → 同步管理）
  for (const item of menuItems) {
    if (item.key !== '/' && pathname.startsWith(item.key + '/')) {
      return item.label
    }
  }

  return pathname
}
