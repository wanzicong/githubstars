import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * AI Agent 聊天页持久化 Store —— 刷新/重开页面后恢复会话上下文与输入草稿。
 *
 * @callers
 *   - AgentChat/index.tsx（读取/写入当前会话 ID、会话模式、输入草稿）
 *
 * @depends
 *   - zustand persist middleware（localStorage 持久化）
 */

export type AgentSessionMode = 'auto' | 'none'

export interface AgentChatState {
  /** 当前会话 ID（刷新后恢复） */
  currentSessionId: string | null
  /** 会话模式：临时会话（none）| 持久会话（auto） */
  sessionMode: AgentSessionMode
  /** 输入草稿 */
  draftInput: string
  /** 主动清空标记：新建/清除/删除会话后置 true，恢复 effect 跳过直到用户重新选中会话（不持久化） */
  manualCleared: boolean

  // ── Actions ──
  setCurrentSessionId: (id: string | null) => void
  setSessionMode: (mode: AgentSessionMode) => void
  setDraftInput: (text: string) => void
  /** 设置主动清空标记 */
  setManualCleared: (cleared: boolean) => void
  /** 清空当前会话与草稿（保留会话模式偏好） */
  clear: () => void
}

export const useAgentChatStore = create<AgentChatState>()(
  persist(
    (set) => ({
      currentSessionId: null,
      sessionMode: 'auto',
      draftInput: '',
      manualCleared: false,

      setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
      setSessionMode: (sessionMode) => set({ sessionMode }),
      setDraftInput: (draftInput) => set({ draftInput }),
      setManualCleared: (manualCleared) => set({ manualCleared }),
      clear: () => set({ currentSessionId: null, draftInput: '', manualCleared: true }),
    }),
    {
      name: 'agent-chat-storage',
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        sessionMode: state.sessionMode,
        draftInput: state.draftInput,
        // manualCleared 不持久化：刷新后默认 false，不影响「刷新恢复上次会话」
      }),
    },
  ),
)
