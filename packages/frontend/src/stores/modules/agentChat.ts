import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * AI Agent 聊天页持久化 Store —— 刷新/重开页面后恢复会话上下文与输入草稿。
 *
 * @callers
 *   - AgentChat/index.tsx（读取/写入当前会话 ID、会话模式、输入草稿、对话上下文）
 *   - 各仓库列表/详情页（通过 addPendingContexts 把选中仓库/分类注入对话上下文）
 *
 * @depends
 *   - zustand persist middleware（localStorage 持久化）
 */

export type AgentSessionMode = 'auto' | 'none'

/** 选中的对话上下文项（仓库或分类）。供 ContextPicker 与各列表页构造复用。 */
export interface ChatContextItem {
  type: 'repo' | 'category'
  id: number
  /** 展示名（仓库 fullName / 分类 name） */
  label: string
}

/** 后端上下文数量上限（与 agent-request.dto.ts 保持一致）：仓库 20 / 分类 10 */
export const MAX_CONTEXT_REPOS = 20
export const MAX_CONTEXT_CATEGORIES = 10

export interface AgentChatState {
  /** 当前会话 ID（刷新后恢复） */
  currentSessionId: string | null
  /** 会话模式：临时会话（none）| 持久会话（auto） */
  sessionMode: AgentSessionMode
  /** 输入草稿 */
  draftInput: string
  /** 主动清空标记：新建/清除/删除会话后置 true，恢复 effect 跳过直到用户重新选中会话（不持久化） */
  manualCleared: boolean
  /** 会话列表侧栏是否折叠（桌面端，持久化：刷新/重进后保持用户选择） */
  sidebarCollapsed: boolean
  /** 对话上下文（选中的仓库/分类，持久化：刷新后不丢） */
  contextItems: ChatContextItem[]
  /** 待注入上下文（各列表页"加入对话上下文"写入，AgentChat 消费后清空；不持久化，一次性） */
  pendingContexts: ChatContextItem[]

  // ── Actions ──
  setCurrentSessionId: (id: string | null) => void
  setSessionMode: (mode: AgentSessionMode) => void
  setDraftInput: (text: string) => void
  /** 设置主动清空标记 */
  setManualCleared: (cleared: boolean) => void
  /** 设置会话列表侧栏折叠状态（支持函数式更新，避免闭包过期值） */
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void
  /** 设置对话上下文（ContextPicker onChange 接这里） */
  setContextItems: (items: ChatContextItem[]) => void
  /** 追加待注入上下文（按 type+id 去重，分类/仓库分别不超上限），返回实际新增的数量 */
  addPendingContexts: (items: ChatContextItem[]) => number
  /** 取出并清空待注入上下文（AgentChat 消费） */
  consumePendingContexts: () => ChatContextItem[]
  /** 清空当前会话与草稿（保留会话模式偏好与已选上下文） */
  clear: () => void
}

/** 按 type+id 合并去重，并套用分类/仓库数量上限 */
function mergeContexts(existing: ChatContextItem[], incoming: ChatContextItem[]): ChatContextItem[] {
  const merged = [...existing]
  const seen = new Set(existing.map((c) => `${c.type}:${c.id}`))
  for (const item of incoming) {
    const key = `${item.type}:${item.id}`
    if (seen.has(key)) continue
    const limit = item.type === 'repo' ? MAX_CONTEXT_REPOS : MAX_CONTEXT_CATEGORIES
    const countOfType = merged.filter((c) => c.type === item.type).length
    if (countOfType >= limit) continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}

export const useAgentChatStore = create<AgentChatState>()(
  persist(
    (set, get) => ({
      currentSessionId: null,
      sessionMode: 'auto',
      draftInput: '',
      manualCleared: false,
      sidebarCollapsed: false,
      contextItems: [],
      pendingContexts: [],

      setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
      setSessionMode: (sessionMode) => set({ sessionMode }),
      setDraftInput: (draftInput) => set({ draftInput }),
      setManualCleared: (manualCleared) => set({ manualCleared }),
      setSidebarCollapsed: (collapsed) =>
        set((state) => ({
          sidebarCollapsed:
            typeof collapsed === 'function' ? collapsed(state.sidebarCollapsed) : collapsed,
        })),
      setContextItems: (contextItems) => set({ contextItems }),
      addPendingContexts: (items) => {
        const before = get().pendingContexts
        const merged = mergeContexts(before, items)
        set({ pendingContexts: merged })
        return merged.length - before.length
      },
      consumePendingContexts: () => {
        const pending = get().pendingContexts
        if (pending.length > 0) set({ pendingContexts: [] })
        return pending
      },
      clear: () => set({ currentSessionId: null, draftInput: '', manualCleared: true }),
    }),
    {
      name: 'agent-chat-storage',
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        sessionMode: state.sessionMode,
        draftInput: state.draftInput,
        sidebarCollapsed: state.sidebarCollapsed,
        contextItems: state.contextItems,
        // manualCleared / pendingContexts 不持久化：前者刷新后默认 false 不影响恢复；后者为一次性注入
      }),
    },
  ),
)
