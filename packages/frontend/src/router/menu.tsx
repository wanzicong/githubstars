import { lazy } from 'react'
import {
  StarOutlined,
  UserOutlined,
  SettingOutlined,
  FireOutlined,
  CopyOutlined,
  RobotOutlined,
  ReadOutlined,
} from '@ant-design/icons'
/**
 * 导航菜单项定义 -- 集中管理所有菜单的 key、图标、标题、排序。
 * 结构与路由模块解耦，方便菜单与路由独立演进。
 *
 * @see router/routes/modules/*.tsx -- 各模块的路由定义
 */

export interface MenuItem {
  key: string
  label: string
}

/** 菜单分组 -- 用于侧边栏二级可伸缩菜单 */
export interface MenuGroup {
  /** 分组唯一标识（非路由路径，仅用于 SubMenu key） */
  key: string
  icon: React.ReactNode
  label: string
  /** 排序权重，升序排列 */
  orderNo: number
  children: MenuItem[]
}

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
export const Clone = lazy(() => import('@/pages/Clone'))

/**
 * 分组菜单 -- 侧边栏模式使用，支持二级折叠展开。
 * 按功能域划分，orderNo 升序排列。
 */
export const menuGroups: MenuGroup[] = [
  {
    key: 'group-stars', icon: <StarOutlined />, label: '星标仓库', orderNo: 0,
    children: [
      { key: '/', label: 'Star列表' },
      { key: '/code-browser', label: '代码浏览' },
      { key: '/categories', label: '分类管理' },
    ],
  },
  {
    key: 'group-learn', icon: <ReadOutlined />, label: '学习', orderNo: 5,
    children: [
      { key: '/learn', label: '学习清单' },
    ],
  },
  {
    key: 'group-discover', icon: <FireOutlined />, label: '发现', orderNo: 10,
    children: [
      { key: '/trending', label: '趋势排行' },
      { key: '/search', label: 'GitHub搜索' },
    ],
  },
  {
    key: 'group-authors', icon: <UserOutlined />, label: '作者', orderNo: 20,
    children: [
      { key: '/authors', label: '作者中心' },
    ],
  },
  {
    key: 'group-tools', icon: <CopyOutlined />, label: '工具', orderNo: 30,
    children: [
      { key: '/clone', label: '克隆管理' },
      { key: '/download', label: '下载管理' },
    ],
  },
  {
    key: 'group-ai', icon: <RobotOutlined />, label: 'AI', orderNo: -1,
    children: [
      { key: '/agent', label: 'AI Agent' },
    ],
  },
  {
    key: 'group-system', icon: <SettingOutlined />, label: '系统', orderNo: 50,
    children: [
      { key: '/sync', label: '同步管理' },
      { key: '/stats', label: '数据统计' },
      { key: '/settings', label: '系统配置' },
      { key: '/logs', label: '系统日志' },
    ],
  },
]

/** 分组排序后的快照，避免每次渲染都 sort */
const sortedMenuGroups = [...menuGroups].sort((a, b) => a.orderNo - b.orderNo)

/**
 * 扁平化菜单项 -- 顶部导航模式使用（水平菜单不适合嵌套子菜单）。
 * 从 menuGroups 展平而来，保持与分组一致的排序。
 */
export const menuItems: (MenuItem & { icon: React.ReactNode; orderNo: number })[] =
  sortedMenuGroups.flatMap((group) =>
    group.children.map((item) => ({
      ...item,
      icon: group.icon,
      orderNo: group.orderNo,
    })),
  )

/**
 * 详情页 -> 父级菜单项 key 映射。
 * 详情页不在菜单中展示，但需要高亮其所属的父级列表项。
 */
const DETAIL_PARENT_MAP: Record<string, string> = {
  '/stars': '/',
  '/repos': '/',
}

/**
 * 根据当前路径计算应高亮的菜单项 key。
 *
 * - 精确匹配菜单项 -> 返回该 key
 * - 详情页（如 /stars/123）-> 映射到父级列表项 key
 * - 首段路径匹配 -> 返回首段路径（如 /sync/xxx -> /sync）
 * - 兜底 -> 返回 '/'
 */
export function getSelectedMenuKey(pathname: string): string {
  const firstSeg = '/' + (pathname.split('/').filter(Boolean)[0] ?? '')

  // 详情页映射到父级
  if (DETAIL_PARENT_MAP[firstSeg]) {
    return DETAIL_PARENT_MAP[firstSeg]
  }

  // 精确匹配或首段匹配
  for (const group of sortedMenuGroups) {
    for (const item of group.children) {
      if (item.key === pathname || item.key === firstSeg) {
        return item.key
      }
    }
  }

  return '/'
}

/**
 * 根据当前路径计算应展开的分组 key 列表。
 * 路由切换时自动展开包含当前页面的分组。
 */
export function getOpenGroupKeys(pathname: string): string[] {
  const selectedKey = getSelectedMenuKey(pathname)
  for (const group of sortedMenuGroups) {
    if (group.children.some((item) => item.key === selectedKey)) {
      return [group.key]
    }
  }
  return []
}

/**
 * 根据当前路径获取匹配的菜单标题（用于面包屑、标签页标题）。
 */
export function getMenuTitle(pathname: string): string {
  // 详情页特殊路径（必须在前缀匹配之前检查，否则 /authors/xxx 会被 /authors 前缀拦截返回作者中心）
  if (pathname.startsWith('/stars/')) return 'Star详情'
  if (pathname.startsWith('/repos/')) return '仓库详情'
  if (pathname.startsWith('/authors/')) return '作者详情'

  // 精确匹配
  for (const group of sortedMenuGroups) {
    const exact = group.children.find((m) => m.key === pathname)
    if (exact) return exact.label
  }

  // 前缀匹配（如 /sync/xxx -> 同步管理）
  for (const group of sortedMenuGroups) {
    for (const item of group.children) {
      if (item.key !== '/' && pathname.startsWith(item.key + '/')) {
        return item.label
      }
    }
  }

  return pathname
}
