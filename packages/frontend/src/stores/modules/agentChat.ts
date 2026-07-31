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

  // ── Actions ──
  setCurrentSessionId: (id: string | null) => void
  setSessionMode: (mode: AgentSessionMode) => void
  setDraftInput: (text: string) => void
  /** 清空当前会话与草稿（保留会话模式偏好） */
  clear: () => void
}

export const useAgentChatStore = create<AgentChatState>()(
  persist(
    (set) => ({
      currentSessionId: null,
      sessionMode: 'auto',
      draftInput: '',

      setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
      setSessionMode: (sessionMode) => set({ sessionMode }),
      setDraftInput: (draftInput) => set({ draftInput }),
      clear: () => set({ currentSessionId: null, draftInput: '' }),
    }),
    {
      name: 'agent-chat-storage',
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        sessionMode: state.sessionMode,
        draftInput: state.draftInput,
      }),
    },
  ),
)
