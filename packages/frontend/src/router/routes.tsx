import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

/**
 * 所有路由定义 —— 集中管理，一目了然。
 * 页面使用 React.lazy 懒加载，构建时自动代码分割。
 */

// ── 懒加载页面 ──
const StarList = lazy(() => import('@/pages/StarList'))
const StarDetail = lazy(() => import('@/pages/StarDetail'))
const Sync = lazy(() => import('@/pages/Sync'))
const Stats = lazy(() => import('@/pages/Stats'))
const AuthorList = lazy(() => import('@/pages/AuthorList'))
const AuthorDetail = lazy(() => import('@/pages/AuthorDetail'))
const Settings = lazy(() => import('@/pages/Settings'))
const GithubSearch = lazy(() => import('@/pages/GithubSearch'))
const Trending = lazy(() => import('@/pages/Trending'))
const Logs = lazy(() => import('@/pages/Logs'))
const Clone = lazy(() => import('@/pages/Clone'))

/** 所有路由（Layout 子路由） */
export const appRoutes: RouteObject[] = [
  // ── 首页 ──
  { index: true, element: <StarList />, handle: { title: 'Star列表' } },

  // ── Star ──
  { path: 'stars/:id', element: <StarDetail />, handle: { title: 'Star详情' } },

  // ── 同步 / 统计 ──
  { path: 'sync', element: <Sync />, handle: { title: '同步管理' } },
  { path: 'stats', element: <Stats />, handle: { title: '数据统计' } },

  // ── 作者 ──
  { path: 'authors', element: <AuthorList />, handle: { title: '作者中心' } },
  { path: 'authors/:ownerName', element: <AuthorDetail />, handle: { title: '作者详情' } },

  // ── 搜索 / 趋势 ──
  { path: 'search', element: <GithubSearch />, handle: { title: 'GitHub搜索' } },
  { path: 'trending', element: <Trending />, handle: { title: '趋势排行' } },

  // ── 克隆 ──
  { path: 'clone', element: <Clone />, handle: { title: '克隆管理' } },

  // ── 系统 ──
  { path: 'settings', element: <Settings />, handle: { title: '系统配置' } },
  { path: 'logs', element: <Logs />, handle: { title: '系统日志' } },
]
