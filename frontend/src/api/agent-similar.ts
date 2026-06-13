/**
 * Agent 相似项目搜索 — SSE 流式客户端
 *
 * 使用 EventSource API 连接后端 Agent 流式端点，
 * 实时接收 Agent 的思考过程、工具调用和最终结果。
 *
 * 事件类型与后端 AgentStreamEvent.type 一一对应：
 * - status:   状态更新（启动中、搜索中、完成等）
 * - thinking: Agent 的推理文本（增量推送）
 * - tool_call: Agent 调用工具（WebSearch/WebFetch/search_user_repos）
 * - tool_result: 工具执行结果
 * - result:   最终的完整推荐报告
 * - error:    错误信息
 * - done:     流结束
 */

export interface AgentStreamEvent {
    type: 'status' | 'thinking' | 'tool_call' | 'tool_result' | 'result' | 'error'
    message?: string
    content?: string
    toolName?: string
    toolInput?: Record<string, unknown>
}

export type AgentEventCallback = (event: AgentStreamEvent) => void

export interface AgentSearchOptions {
    repoId: number
    /** 状态事件回调 */
    onStatus?: (message: string) => void
    /** 推理文本回调（增量推送） */
    onThinking?: (content: string) => void
    /** 工具调用回调 */
    onToolCall?: (toolName: string, toolInput?: Record<string, unknown>) => void
    /** 工具结果回调 */
    onToolResult?: () => void
    /** 最终结果回调 */
    onResult?: (content: string) => void
    /** 错误回调 */
    onError?: (message: string) => void
    /** 完成回调 */
    onDone?: () => void
}

/**
 * 启动 Agent 相似项目搜索（SSE 流式连接）
 *
 * 使用 EventSource 连接后端 SSE 端点，实时接收 Agent 执行事件。
 * 返回 abort 函数用于手动中止连接。
 *
 * @param options 搜索选项和回调
 * @returns 中止函数，调用后断开 SSE 连接
 *
 * @example
 * const abort = startAgentSearch({
 *   repoId: 123,
 *   onStatus: (msg) => console.log('状态:', msg),
 *   onThinking: (text) => console.log('思考:', text),
 *   onResult: (report) => setReport(report),
 *   onError: (err) => console.error(err),
 * });
 * // 手动中止: abort();
 */
export function startAgentSearch(options: AgentSearchOptions): () => void {
    const { repoId, onStatus, onThinking, onToolCall, onToolResult, onResult, onError, onDone } = options

    // SSE 直连后端（绕过 Vite 代理缓冲）
    const url = `http://localhost:3000/api/agent/similar/${repoId}/stream`
    const eventSource = new EventSource(url)

    let aborted = false

    const abort = () => {
        aborted = true
        eventSource.close()
    }

    // 注册各类事件监听
    eventSource.addEventListener('status', (e: MessageEvent) => {
        if (aborted) return
        try {
            const data: AgentStreamEvent = JSON.parse(e.data)
            onStatus?.(data.message || '')
        } catch {
            // 忽略解析错误
        }
    })

    eventSource.addEventListener('thinking', (e: MessageEvent) => {
        if (aborted) return
        try {
            const data: AgentStreamEvent = JSON.parse(e.data)
            if (data.content) onThinking?.(data.content)
        } catch {
            // 忽略
        }
    })

    eventSource.addEventListener('tool_call', (e: MessageEvent) => {
        if (aborted) return
        try {
            const data: AgentStreamEvent = JSON.parse(e.data)
            onToolCall?.(data.toolName || '未知工具', data.toolInput)
        } catch {
            // 忽略
        }
    })

    eventSource.addEventListener('tool_result', () => {
        if (aborted) return
        onToolResult?.()
    })

    eventSource.addEventListener('result', (e: MessageEvent) => {
        if (aborted) return
        try {
            const data: AgentStreamEvent = JSON.parse(e.data)
            if (data.content) onResult?.(data.content)
        } catch {
            // 忽略
        }
    })

    eventSource.addEventListener('error', (e: MessageEvent) => {
        if (aborted) return
        // EventSource 的 error 事件可能有两种情况：
        // 1. 后端发送了 error 事件（e.data 有内容）
        // 2. 网络连接失败（e.data 为空）
        try {
            if (e.data) {
                const data: AgentStreamEvent = JSON.parse(e.data)
                onError?.(data.message || '未知错误')
            }
        } catch {
            // 网络层面的错误，可能连接已断开
        }
    })

    eventSource.addEventListener('done', () => {
        if (aborted) return
        abort()
        onDone?.()
    })

    // EventSource 自身的错误处理（连接失败等）
    eventSource.onerror = () => {
        if (!aborted) {
            onError?.('SSE 连接异常，请检查后端服务是否运行')
            abort()
        }
    }

    return abort
}
