/**
 * agentChat store 上下文扩展单元测试
 * 覆盖：mergeContexts 去重/上限、addPendingContexts 返回新增数、consumePendingContexts 一次性消费
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useAgentChatStore, MAX_CONTEXT_REPOS, MAX_CONTEXT_CATEGORIES } from '@/stores/modules/agentChat'
import type { ChatContextItem } from '@/stores/modules/agentChat'

const repo = (id: number): ChatContextItem => ({ type: 'repo', id, label: `owner/repo${id}` })
const category = (id: number): ChatContextItem => ({ type: 'category', id, label: `分类${id}` })

function resetStore() {
  useAgentChatStore.setState({ contextItems: [], pendingContexts: [] })
}

describe('agentChat store 上下文', () => {
  beforeEach(resetStore)

  describe('addPendingContexts', () => {
    it('新仓库应追加到 pendingContexts 并返回新增数量', () => {
      const added = useAgentChatStore.getState().addPendingContexts([repo(1), repo(2)])
      expect(added).toBe(2)
      expect(useAgentChatStore.getState().pendingContexts).toHaveLength(2)
    })

    it('重复 type+id 应去重，返回 0', () => {
      const state = useAgentChatStore.getState()
      state.addPendingContexts([repo(1)])
      const added = useAgentChatStore.getState().addPendingContexts([repo(1)])
      expect(added).toBe(0)
      expect(useAgentChatStore.getState().pendingContexts).toHaveLength(1)
    })

    it('type 不同 id 相同不视为重复', () => {
      const added = useAgentChatStore.getState().addPendingContexts([repo(1), category(1)])
      expect(added).toBe(2)
      expect(useAgentChatStore.getState().pendingContexts).toHaveLength(2)
    })

    it('仓库数量超过上限时应截断，返回实际新增数', () => {
      const items = Array.from({ length: MAX_CONTEXT_REPOS + 5 }, (_, i) => repo(i + 1))
      const added = useAgentChatStore.getState().addPendingContexts(items)
      expect(added).toBe(MAX_CONTEXT_REPOS)
      expect(useAgentChatStore.getState().pendingContexts).toHaveLength(MAX_CONTEXT_REPOS)
    })

    it('分类数量超过上限时应截断', () => {
      const items = Array.from({ length: MAX_CONTEXT_CATEGORIES + 3 }, (_, i) => category(i + 1))
      const added = useAgentChatStore.getState().addPendingContexts(items)
      expect(added).toBe(MAX_CONTEXT_CATEGORIES)
    })

    it('仓库和分类上限独立计算', () => {
      const items = [
        ...Array.from({ length: MAX_CONTEXT_REPOS + 5 }, (_, i) => repo(i + 1)),
        ...Array.from({ length: MAX_CONTEXT_CATEGORIES + 3 }, (_, i) => category(i + 1)),
      ]
      const added = useAgentChatStore.getState().addPendingContexts(items)
      expect(added).toBe(MAX_CONTEXT_REPOS + MAX_CONTEXT_CATEGORIES)
    })

    it('已有 pending 达上限后再追加返回 0', () => {
      const items = Array.from({ length: MAX_CONTEXT_REPOS }, (_, i) => repo(i + 1))
      useAgentChatStore.getState().addPendingContexts(items)
      const added = useAgentChatStore.getState().addPendingContexts([repo(999)])
      expect(added).toBe(0)
    })
  })

  describe('consumePendingContexts', () => {
    it('应返回 pending 内容并清空（一次性）', () => {
      useAgentChatStore.getState().addPendingContexts([repo(1), repo(2)])
      const consumed = useAgentChatStore.getState().consumePendingContexts()
      expect(consumed).toHaveLength(2)
      expect(useAgentChatStore.getState().pendingContexts).toHaveLength(0)
      // 再次消费应为空
      expect(useAgentChatStore.getState().consumePendingContexts()).toHaveLength(0)
    })

    it('无 pending 时返回空数组', () => {
      expect(useAgentChatStore.getState().consumePendingContexts()).toEqual([])
    })
  })

  describe('setContextItems 合并场景（模拟 AgentChat 消费 pending 后合并）', () => {
    it('消费 pending 后合并进 contextItems，重复项不重复出现', () => {
      const store = useAgentChatStore.getState()
      store.setContextItems([repo(1)])
      store.addPendingContexts([repo(1), repo(2)])
      const pending = useAgentChatStore.getState().consumePendingContexts()
      // AgentChat 侧 mergeContextItems 去重后：repo(1) 已存在，只新增 repo(2)
      const seen = new Set([...useAgentChatStore.getState().contextItems, ...pending].map((c) => `${c.type}:${c.id}`))
      expect(seen.size).toBe(2)
    })
  })
})
