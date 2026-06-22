/**
 * Agent 智能体 API
 *
 * 提供会话管理、流式对话、异步任务、工具清单等能力。
 *
 * @depends
 *   - ./request — Axios 客户端
 *   - @/types — AgentSession, AgentMessage, AgentTask 等类型
 */
import api from './request'
import type { AgentSession, AgentMessage, AgentTask, AgentTool, AgentStatus } from '../types'

// ── 会话管理 ──

/** 创建新会话 */
export async function createAgentSession(params: {
    title?: string
    systemPrompt?: string
    model?: string
}): Promise<{ sessionId: number; createdAt: string }> {
    const { data: wrapped } = await api.post<{ success: boolean; data: { sessionId: number; createdAt: string } }>('/api/agent/sessions', params)
    return wrapped.data
}

/** 查询会话列表 */
export async function fetchAgentSessions(params?: {
    status?: string
    limit?: number
    offset?: number
}): Promise<{ sessions: AgentSession[]; total: number }> {
    const { data: wrapped } = await api.get<{ success: boolean; data: { sessions: AgentSession[]; total: number } }>('/api/agent/sessions', { params })
    return wrapped.data
}

/** 获取会话详情（含消息） */
export async function fetchAgentSession(id: number): Promise<{
    session: AgentSession
    messages: AgentMessage[]
}> {
    const { data: wrapped } = await api.get<{ success: boolean; data: { session: AgentSession; messages: AgentMessage[] } }>(`/api/agent/sessions/${id}`)
    return wrapped.data
}

/** 归档/删除会话 */
export async function archiveAgentSession(id: number): Promise<void> {
    await api.delete(`/api/agent/sessions/${id}`)
}

// ── 流式对话 ──

/** SSE 流式对话（返回 fetch Response，调用方处理 ReadableStream） */
export function chatStream(
    sessionId: number,
    messages: Array<{ role: string; content: string }>,
    options?: { timeoutMs?: number; maxToolRounds?: number },
): Promise<Response> {
    return fetch(`${api.defaults.baseURL}api/agent/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages,
            timeoutMs: options?.timeoutMs,
            maxToolRounds: options?.maxToolRounds,
        }),
    })
}

// ── 异步任务 ──

/** 查询任务列表 */
export async function fetchAgentTasks(params?: {
    status?: string
    type?: string
    limit?: number
    offset?: number
}): Promise<{ tasks: AgentTask[]; total: number }> {
    const { data: wrapped } = await api.get<{ success: boolean; data: { tasks: AgentTask[]; total: number } }>('/api/agent/tasks', { params })
    return wrapped.data
}

/** 获取任务详情 */
export async function fetchAgentTask(id: number): Promise<{
    task: AgentTask & { input: unknown; output: unknown; errorMsg: string | null; startedAt: string | null }
    invocations: Array<{ id: number; toolName: string; toolType: string; status: string; durationMs: number | null; createdAt: string }>
}> {
    const { data: wrapped } = await api.get<{ success: boolean; data: { task: AgentTask & { input: unknown; output: unknown; errorMsg: string | null; startedAt: string | null }; invocations: Array<{ id: number; toolName: string; toolType: string; status: string; durationMs: number | null; createdAt: string }> } }>(`/api/agent/tasks/${id}`)
    return wrapped.data
}

/** 取消任务 */
export async function cancelAgentTask(id: number): Promise<void> {
    await api.post(`/api/agent/tasks/${id}/cancel`)
}

// ── 工具管理 ──

/** 获取已注册工具清单 */
export async function fetchAgentTools(): Promise<{ tools: AgentTool[]; total: number }> {
    const { data: wrapped } = await api.get<{ success: boolean; data: { tools: AgentTool[]; total: number } }>('/api/agent/tools')
    return wrapped.data
}

// ── 监控状态 ──

/** 获取智能体底座运行状态 */
export async function fetchAgentStatus(): Promise<AgentStatus> {
    const { data: wrapped } = await api.get<{ success: boolean; data: AgentStatus }>('/api/agent/status')
    return wrapped.data
}
