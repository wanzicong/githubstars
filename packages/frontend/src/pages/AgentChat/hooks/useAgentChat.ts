import { useState, useCallback, useRef } from 'react'
import { message } from 'antd'
import {
    createAgentSession,
    fetchAgentSessions,
    fetchAgentSession,
    archiveAgentSession,
    chatStream,
    fetchAgentTools,
    fetchAgentStatus,
} from '@/api/agent'
import type { AgentSession, AgentMessage, AgentTool, AgentStatus } from '@/types'

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    toolCall?: string
    timestamp: number
}

export function useAgentChat() {
    const [sessions, setSessions] = useState<AgentSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [tools, setTools] = useState<AgentTool[]>([])
    const [status, setStatus] = useState<AgentStatus | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    // 加载会话列表
    const loadSessions = useCallback(async () => {
        try {
            const data = await fetchAgentSessions({ limit: 50 })
            setSessions(data.sessions)
        } catch {
            message.error('加载会话列表失败')
        }
    }, [])

    // 创建新会话
    const createSession = useCallback(async (title?: string) => {
        try {
            const result = await createAgentSession({ title: title || '新对话' })
            await loadSessions()
            return result.sessionId
        } catch {
            message.error('创建会话失败')
            return null
        }
    }, [loadSessions])

    // 加载会话消息
    const loadSession = useCallback(async (id: number) => {
        try {
            const data = await fetchAgentSession(id)
            setActiveSessionId(id)
            setMessages(
                data.messages.map((m: AgentMessage) => ({
                    id: String(m.id),
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: m.content,
                    timestamp: new Date(m.createdAt).getTime(),
                })),
            )
        } catch {
            message.error('加载会话消息失败')
        }
    }, [])

    // 发送消息（SSE 流式）
    const sendMessage = useCallback(async (content: string) => {
        if (!activeSessionId) return

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content,
            timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, userMsg])
        setLoading(true)

        // 构建消息历史
        const history = [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
        }))

        const assistantMsgId = `assistant-${Date.now()}`
        const assistantMsg: ChatMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMsg])

        try {
            abortRef.current = new AbortController()
            const response = await chatStream(activeSessionId, history, { timeoutMs: 300000 })
            const reader = response.body?.getReader()
            if (!reader) throw new Error('No reader')

            const decoder = new TextDecoder()
            let buffer = ''
            let fullContent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                // 解析 SSE 事件
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6))
                            if (event.type === 'text_delta' || event.type === 'thinking') {
                                fullContent += event.content || ''
                            } else if (event.type === 'tool_use') {
                                fullContent += `\n\n🔧 **调用工具**: \`${event.toolName}\`\n`
                            } else if (event.type === 'tool_result') {
                                fullContent += `> 工具返回: ${(event.result || '').substring(0, 200)}\n\n`
                            } else if (event.type === 'error') {
                                fullContent += `\n\n❌ 错误: ${event.error}\n`
                            } else if (event.type === 'approval_required') {
                                fullContent += `\n\n⏳ 需要审批: ${event.stepId}\n`
                            }
                            // 实时更新消息
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantMsgId ? { ...m, content: fullContent } : m,
                                ),
                            )
                        } catch {
                            // 非 JSON 行忽略
                        }
                    }
                }
            }
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: fullContent } : m,
                ),
            )
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '请求失败'
            if (msg !== 'The user aborted a request.') {
                message.error(`对话失败: ${msg}`)
            }
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantMsgId
                        ? { ...m, content: m.content || '请求失败，请重试' }
                        : m,
                ),
            )
        } finally {
            setLoading(false)
            abortRef.current = null
            loadSessions() // 刷新会话列表以更新 messageCount
        }
    }, [activeSessionId, messages, loadSessions])

    // 停止生成
    const stopGeneration = useCallback(() => {
        abortRef.current?.abort()
    }, [])

    // 删除会话
    const deleteSession = useCallback(async (id: number) => {
        try {
            await archiveAgentSession(id)
            if (activeSessionId === id) {
                setActiveSessionId(null)
                setMessages([])
            }
            await loadSessions()
            message.success('会话已归档')
        } catch {
            message.error('归档会话失败')
        }
    }, [activeSessionId, loadSessions])

    // 加载工具和状态
    const loadTools = useCallback(async () => {
        try {
            const data = await fetchAgentTools()
            setTools(data.tools)
        } catch {
            // 静默失败
        }
    }, [])

    const loadStatus = useCallback(async () => {
        try {
            const data = await fetchAgentStatus()
            setStatus(data)
        } catch {
            // 静默失败
        }
    }, [])

    return {
        sessions,
        activeSessionId,
        messages,
        loading,
        tools,
        status,
        loadSessions,
        createSession,
        loadSession,
        sendMessage,
        stopGeneration,
        deleteSession,
        loadTools,
        loadStatus,
    }
}
