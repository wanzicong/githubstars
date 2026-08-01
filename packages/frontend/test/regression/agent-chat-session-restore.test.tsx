/**
 * AgentChat 回归测试 —— 新建/清除/删除会话后不得跳回旧会话
 *
 * 背景（根因）：
 * React Router 7 的 navigate()/setSearchParams 会把路由状态更新包进 React.startTransition（延迟渲染），
 * 因此「清空会话后同步删除 URL ?session=」的渲染会被推迟；而恢复 effect 若随 currentSessionId/messages
 * 等页面内状态变化重新执行，会在该延迟窗口内读到过期的 urlSessionId（旧会话），把旧会话又拉回来。
 *
 * 修复：恢复 effect 只监听 urlSessionId（挂载 + 外部 URL 变化），页面内状态变化由各自的显式处理器负责；
 * 且一旦用户主动清空（manualCleared）一律不自动恢复。
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App as AntApp, ConfigProvider } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AgentChat from '../../src/pages/AgentChat'
import { useAgentChatStore } from '../../src/stores'

// ── Mock agent API ──

const { listAgentSessions, getAgentSession, deleteAgentSession } = vi.hoisted(() => ({
    listAgentSessions: vi.fn(),
    getAgentSession: vi.fn(),
    deleteAgentSession: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/api/agent', () => ({
    listAgentSessions,
    getAgentSession,
    deleteAgentSession,
    getAgentBaseURL: () => 'http://localhost:10003',
}))

const SESSION_LIST = {
    success: true,
    sessions: [
        {
            id: 's1',
            type: 'auto',
            status: 'done',
            messageCount: 2,
            firstMessage: '会话一标题',
            lastMessage: '回复一',
            createdAt: '2026-08-01T10:00:00.000Z',
            updatedAt: '2026-08-01T10:10:00.000Z',
        },
        {
            id: 's2',
            type: 'auto',
            status: 'done',
            messageCount: 1,
            firstMessage: '会话二标题',
            lastMessage: '回复二',
            createdAt: '2026-08-01T09:00:00.000Z',
            updatedAt: '2026-08-01T09:10:00.000Z',
        },
    ],
}

function sessionDetail(id: string) {
    return {
        success: true,
        messages: [
            { role: 'user', content: `问题-${id}`, createdAt: '2026-08-01T10:00:00.000Z' },
            { role: 'assistant', content: `回答-${id}`, createdAt: '2026-08-01T10:01:00.000Z' },
        ],
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    // zustand store 是模块级单例：清空跨测试残留的会话/清空标记，保证每个用例从空白状态开始
    useAgentChatStore.setState({ currentSessionId: null, sessionMode: 'auto', draftInput: '', manualCleared: false, sidebarCollapsed: false })
    localStorage.clear()
    listAgentSessions.mockResolvedValue(SESSION_LIST)
    getAgentSession.mockImplementation(async (id: string) => sessionDetail(id))
    // 强制桌面端（screens.md=true），否则走移动端 Drawer 分支
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: query.includes('min-width: 768px'),
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }),
    })
})

function renderAgentChat(initialPath = '/agent?session=s1') {
    return render(
        <ConfigProvider>
            <AntApp>
                <MemoryRouter initialEntries={[initialPath]}>
                    <AgentChat />
                </MemoryRouter>
            </AntApp>
        </ConfigProvider>,
    )
}

describe('AgentChat 新建/清除会话回归', () => {
    it('打开分享链接 ?session=s1 时只加载一次 s1', async () => {
        renderAgentChat()
        await waitFor(() => expect(getAgentSession.mock.calls[0]?.[0]).toBe('s1'))
        // 等待潜在的多余触发窗口（恢复 effect 旧实现会在新建后 0ms 定时器再次拉取）
        await new Promise((r) => setTimeout(r, 500))
        expect(getAgentSession).toHaveBeenCalledTimes(1) // 仍只有首次恢复那一次（loadSession 传 id + signal 两个参数）
        expect(getAgentSession.mock.calls[0]?.[0]).toBe('s1')
        expect(screen.getByText('回答-s1')).toBeInTheDocument()
    })

    it('点击「新对话」后不再拉取旧会话（URL 同步删除前不跳回）', async () => {
        renderAgentChat()
        await waitFor(() => expect(getAgentSession.mock.calls[0]?.[0]).toBe('s1'))
        await screen.findByText('回答-s1')

        await userEvent.click(screen.getByRole('button', { name: /新对话/ }))

        // 等待超过旧实现 setTimeout(0) 的触发窗口 + URL 延迟更新
        await new Promise((r) => setTimeout(r, 800))
        expect(getAgentSession).toHaveBeenCalledTimes(1) // 仍只有首次恢复那一次
        expect(screen.queryByText('回答-s1')).not.toBeInTheDocument()
    })

    it('清除对话后不再拉取旧会话', async () => {
        renderAgentChat()
        await waitFor(() => expect(getAgentSession.mock.calls[0]?.[0]).toBe('s1'))
        await screen.findByText('回答-s1')

        // 清除按钮是纯图标按钮（Tooltip 提供可访问名，jsdom 计算不一致），直接点图标
        const clearBtn = document.querySelector('.anticon-clear')?.closest('button')
        expect(clearBtn).not.toBeNull()
        await userEvent.click(clearBtn as HTMLElement)

        await new Promise((r) => setTimeout(r, 800))
        expect(getAgentSession).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('回答-s1')).not.toBeInTheDocument()
    })

    it('新对话后切换到 s2 正常加载，且 s1 不被重复拉取', async () => {
        renderAgentChat()
        await waitFor(() => expect(getAgentSession.mock.calls[0]?.[0]).toBe('s1'))
        await screen.findByText('回答-s1')

        await userEvent.click(screen.getByRole('button', { name: /新对话/ }))
        await new Promise((r) => setTimeout(r, 200))

        await userEvent.click(screen.getByText('会话二标题'))
        await screen.findByText('回答-s2')
        await new Promise((r) => setTimeout(r, 400))

        expect(getAgentSession.mock.calls.map((c) => c[0])).toEqual(['s1', 's2'])
        expect(screen.queryByText('回答-s1')).not.toBeInTheDocument()
    })

    it('会话列表可折叠/展开，折叠状态持久化且重挂载后保持', async () => {
        const { unmount } = renderAgentChat()
        await waitFor(() => expect(getAgentSession.mock.calls[0]?.[0]).toBe('s1'))
        await screen.findByText('会话一标题')

        const sidebar = document.querySelector('.agent-session-sidebar') as HTMLElement
        expect(sidebar).not.toBeNull()
        expect(sidebar.style.width).toBe('280px')

        // 折叠（顶部按钮 + 底部按钮两个入口，任一点击均可）
        await userEvent.click(screen.getAllByRole('button', { name: '折叠会话列表' })[0])
        await waitFor(() => expect(useAgentChatStore.getState().sidebarCollapsed).toBe(true))
        expect(sidebar.style.width).toBe('48px')
        // 会话列表内容隐藏
        expect(screen.queryByText('会话一标题')).not.toBeInTheDocument()
        // 已持久化到 localStorage
        const persisted = JSON.parse(localStorage.getItem('agent-chat-storage') as string)
        expect(persisted.state.sidebarCollapsed).toBe(true)

        // 展开
        await userEvent.click(screen.getByRole('button', { name: '展开会话列表' }))
        await waitFor(() => expect(useAgentChatStore.getState().sidebarCollapsed).toBe(false))
        expect(sidebar.style.width).toBe('280px')
        expect(screen.getByText('会话一标题')).toBeInTheDocument()

        // 再次折叠后卸载重挂载（模拟刷新/重进页面）：状态保持折叠
        await userEvent.click(screen.getAllByRole('button', { name: '折叠会话列表' })[0])
        await waitFor(() => expect(useAgentChatStore.getState().sidebarCollapsed).toBe(true))
        unmount()
        renderAgentChat()
        await waitFor(() => expect(getAgentSession.mock.calls[0]?.[0]).toBe('s1'))
        const sidebar2 = document.querySelector('.agent-session-sidebar') as HTMLElement
        expect(sidebar2.style.width).toBe('48px')
        expect(screen.queryByText('会话一标题')).not.toBeInTheDocument()
    })
})