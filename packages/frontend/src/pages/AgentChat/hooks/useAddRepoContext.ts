import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from 'antd'
import { useAgentChatStore } from '@/stores'
import type { ChatContextItem } from '@/stores'

/**
 * 「加入 Agent 对话上下文」共享 Hook —— 供各仓库列表/详情页复用。
 *
 * 行为：把选中的仓库/分类写入 agentChat store 的待注入队列（pendingContexts），
 * 并跳转到 /agent。AgentChat（常驻组件）订阅 pending 合并进 chip 区，用户即可提问。
 *
 * 累积模式：可连续在不同列表加入多个，chip 常驻（去重 + 上限保护，见 store.mergeContexts）。
 */
export function useAddRepoContext() {
  const navigate = useNavigate()
  const { message: antMsg } = App.useApp()
  const addPendingContexts = useAgentChatStore((s) => s.addPendingContexts)

  /**
   * 加入上下文并跳转到对话页。
   * @param items 待加入的仓库/分类（id 为本地库主键，label 用于 chip 展示）
   */
  const addToContext = useCallback(
    (items: ChatContextItem[]) => {
      if (items.length === 0) return
      const added = addPendingContexts(items)
      if (added === 0) {
        antMsg.info('所选仓库/分类已在对话上下文中或已达上限')
      } else if (added < items.length) {
        antMsg.success(`已加入 ${added} 项到对话上下文（${items.length - added} 项重复或超上限已跳过）`)
      } else {
        antMsg.success(`已加入 ${added} 项到对话上下文`)
      }
      navigate('/agent')
    },
    [addPendingContexts, navigate, antMsg],
  )

  /** 加入单个仓库（便捷封装） */
  const addRepoToContext = useCallback(
    (repo: { id: number; fullName: string | null }) => {
      if (!repo.fullName) return
      addToContext([{ type: 'repo', id: repo.id, label: repo.fullName }])
    },
    [addToContext],
  )

  return { addToContext, addRepoToContext }
}
