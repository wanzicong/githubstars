import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 应用全局配置 Store —— 主题模式、布局偏好、UI 设置。
 *
 * @callers
 *   - DefaultLayout（读取布局模式/侧边栏状态，驱动 UI 渲染）
 *   - SettingDrawer（写入用户布局偏好）
 *   - App.tsx（读取主题色，生成 Antd ConfigProvider theme）
 *
 * @depends
 *   - zustand persist middleware（localStorage 持久化）
 */

export type LayoutMode = 'side' | 'top'

export interface AppState {
  /** 深色模式开关 */
  darkMode: boolean
  /** 主题色 */
  primaryColor: string
  /** 布局模式：侧边栏 | 顶部导航 */
  layoutMode: LayoutMode
  /** 侧边栏折叠状态 */
  siderCollapsed: boolean
  /** 是否显示多标签页 */
  showTabs: boolean
  /** 是否显示面包屑 */
  showBreadcrumb: boolean
  /** 内容区宽度模式：fixed（居中固定宽度）| fluid（自适应全宽） */
  contentWidth: 'fixed' | 'fluid'

  // ── Actions ──
  setDarkMode: (darkMode: boolean) => void
  setPrimaryColor: (color: string) => void
  setLayoutMode: (mode: LayoutMode) => void
  toggleSiderCollapsed: () => void
  setSiderCollapsed: (collapsed: boolean) => void
  setShowTabs: (show: boolean) => void
  setShowBreadcrumb: (show: boolean) => void
  setContentWidth: (width: 'fixed' | 'fluid') => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      darkMode: false,
      primaryColor: '#1a1a2e',
      layoutMode: 'side',
      siderCollapsed: false,
      showTabs: true,
      showBreadcrumb: true,
      contentWidth: 'fixed',

      setDarkMode: (darkMode) => set({ darkMode }),
      setPrimaryColor: (primaryColor) => set({ primaryColor }),
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      toggleSiderCollapsed: () =>
        set((state) => ({ siderCollapsed: !state.siderCollapsed })),
      setSiderCollapsed: (siderCollapsed) => set({ siderCollapsed }),
      setShowTabs: (showTabs) => set({ showTabs }),
      setShowBreadcrumb: (showBreadcrumb) => set({ showBreadcrumb }),
      setContentWidth: (contentWidth) => set({ contentWidth }),
    }),
    {
      name: 'githubstars-app-config',
      partialize: (state) => ({
        darkMode: state.darkMode,
        primaryColor: state.primaryColor,
        layoutMode: state.layoutMode,
        siderCollapsed: state.siderCollapsed,
        showTabs: state.showTabs,
        showBreadcrumb: state.showBreadcrumb,
        contentWidth: state.contentWidth,
      }),
    },
  ),
)
