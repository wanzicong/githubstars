import { create } from 'zustand'

/**
 * 多标签页状态管理 —— 维护已打开的页面标签列表。
 *
 * 标签页 key 即为路由 path（如 /sync、/stats）。
 * 每个标签包含标题和是否可关闭标记（首页不可关闭）。
 *
 * @callers
 *   - MultipleTabs（渲染标签页列表）
 *   - DefaultLayout（路由变化时自动添加标签）
 *   - SettingDrawer（关闭多标签页功能时清空标签）
 *
 * @depends
 *   - zustand（纯内存存储，不持久化——标签页状态会话级别即可）
 */

export interface TabItem {
  /** 标签唯一 key，对应路由 path */
  key: string
  /** 标签显示标题 */
  title: string
  /** 是否可关闭（首页不可关闭，其余可关闭） */
  closable: boolean
}

export interface MultipleTabState {
  tabs: TabItem[]
  activeKey: string

  // ── 刷新计数器 ──
  /** 递增以强制 Outlet 内容重新挂载，实现标签页刷新 */
  refreshKey: number

  // ── Actions ──
  /** 添加或激活标签页（已存在则激活，不存在则追加） */
  addTab: (tab: TabItem) => void
  /** 关闭指定标签页 */
  removeTab: (key: string) => void
  /** 关闭其他标签页（保留当前 key） */
  removeOtherTabs: (key: string) => void
  /** 关闭所有标签页（保留首页） */
  removeAllTabs: () => void
  /** 关闭左侧标签页 */
  removeLeftTabs: (key: string) => void
  /** 关闭右侧标签页 */
  removeRightTabs: (key: string) => void
  /** 设置当前激活标签 */
  setActiveKey: (key: string) => void
  /** 更新标签标题 */
  updateTabTitle: (key: string, title: string) => void
  /** 递增 refreshKey 以触发内容重新挂载（标签页刷新） */
  refreshTab: () => void
}

const HOME_TAB: TabItem = {
  key: '/',
  title: 'Star列表',
  closable: false,
}

export const useMultipleTabStore = create<MultipleTabState>()((set, get) => ({
  tabs: [HOME_TAB],
  activeKey: '/',
  refreshKey: 0,

  addTab: (tab) => {
    const { tabs } = get()
    const exists = tabs.find((t) => t.key === tab.key)
    if (exists) {
      // 已存在：仅激活，标题以新传入的为准（可能已更新）
      set({
        activeKey: tab.key,
        tabs: tabs.map((t) => (t.key === tab.key ? { ...t, title: tab.title } : t)),
      })
    } else {
      // 新增标签，放在当前激活标签右侧
      const { activeKey } = get()
      const idx = tabs.findIndex((t) => t.key === activeKey)
      const before = tabs.slice(0, idx + 1)
      const after = tabs.slice(idx + 1)
      set({
        tabs: [...before, tab, ...after],
        activeKey: tab.key,
      })
    }
  },

  removeTab: (key) => {
    const { tabs, activeKey } = get()
    if (!tabs.find((t) => t.key === key)?.closable) return
    const newTabs = tabs.filter((t) => t.key !== key)
    // 如果关闭的是当前激活标签，自动激活相邻标签
    if (activeKey === key) {
      const idx = tabs.findIndex((t) => t.key === key)
      const targetIdx = Math.min(idx, newTabs.length - 1)
      set({ tabs: newTabs, activeKey: newTabs[targetIdx]?.key || '/' })
    } else {
      set({ tabs: newTabs })
    }
  },

  removeOtherTabs: (key) => {
    const { tabs } = get()
    set({
      tabs: tabs.filter((t) => !t.closable || t.key === key),
      activeKey: key,
    })
  },

  removeAllTabs: () => {
    set({ tabs: [HOME_TAB], activeKey: '/' })
  },

  removeLeftTabs: (key) => {
    const { tabs, activeKey } = get()
    const idx = tabs.findIndex((t) => t.key === key)
    if (idx === -1) return
    // 保留不可关闭的 + 当前位置及右侧的
    const newTabs = tabs.filter((t, i) => !t.closable || i >= idx)
    // 如果当前激活的标签被移除了（在左侧），切换到第一个剩余标签
    if (!newTabs.find((t) => t.key === activeKey)) {
      set({ tabs: newTabs, activeKey: newTabs[0]?.key || '/' })
    } else {
      set({ tabs: newTabs })
    }
  },

  removeRightTabs: (key) => {
    const { tabs, activeKey } = get()
    const idx = tabs.findIndex((t) => t.key === key)
    if (idx === -1) return
    const newTabs = tabs.filter((t, i) => !t.closable || i <= idx)
    // 如果当前激活的标签被移除了（在右侧），切换到目标标签（key）所在位置
    if (!newTabs.find((t) => t.key === activeKey)) {
      const targetIdx = newTabs.findIndex((t) => t.key === key)
      set({ tabs: newTabs, activeKey: newTabs[targetIdx]?.key || '/' })
    } else {
      set({ tabs: newTabs })
    }
  },

  setActiveKey: (activeKey) => set({ activeKey }),

  updateTabTitle: (key, title) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.key === key ? { ...t, title } : t)),
    }))
  },

  refreshTab: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
}))
