/**
 * 多会话并行流式状态管理器 —— 切换会话不中断正在生成的 AI 回复。
 *
 * 设计要点：
 * - 流式状态按 sessionKey 隔离存储（Map），流绑定「发起会话」而非「正在查看的会话」
 * - 模块级单例，不放入 React 渲染层；组件通过 useSyncExternalStore 订阅当前会话的那一路流
 * - 切换会话时不 abort：流在后台继续累积，切回时直接读取已累积的增量实现「实时流式输出」
 * - 流自然结束后由 AgentChat 拉取该会话历史（含后端入库的完整 blocks）替换临时流式气泡
 *
 * @callers AgentChat/index.tsx
 */

/** 结构化消息块（与后端 MessageBlock / AgentChat 渲染层一致） */
export interface MessageBlock {
    type: 'text' | 'thinking' | 'tool_use' | 'tool_result'
    text?: string
    thinking?: string
    toolName?: string
    toolInput?: unknown
    toolId?: string
    toolUseId?: string
    content?: string
    isError?: boolean
}

/** 工具调用结果映射（toolUseId → result） */
export type ToolResultMap = Map<string, { content: string; isError?: boolean }>

/** 单条会话的流式累积状态 */
export interface SessionStreamState {
    /** 流式正文增量（逐字累积） */
    text: string
    /** 流式思考增量 */
    thinking: string
    /** 工具调用块（原始 tool_use，用于组装结构化 blocks） */
    toolBlocks: MessageBlock[]
    /** 工具执行结果 */
    toolResults: ToolResultMap
    /** 流状态：streaming 进行中 / done 完成 / error 出错 */
    status: 'streaming' | 'done' | 'error'
    /** 是否被用户主动停止 */
    aborted: boolean
    /** 后端返回并捕获的 ourSessionId（auto 模式首轮后回填） */
    capturedSessionId: string | null
    /** 递增序号，每次状态变化 +1，驱动 useSyncExternalStore 重渲染 */
    version: number
}

interface ActiveStream {
    state: SessionStreamState
    abort: AbortController
}

/** 新建初始流式状态 */
function createInitialState(): SessionStreamState {
    return {
        text: '',
        thinking: '',
        toolBlocks: [],
        toolResults: new Map(),
        status: 'streaming',
        aborted: false,
        capturedSessionId: null,
        version: 0,
    }
}

class AgentStreamManager {
    private streams = new Map<string, ActiveStream>()
    private listeners = new Set<() => void>()
    /** 快照缓存：每次变更整体替换引用，保证 useSyncExternalStore 检测到变化 */
    private snapshot: ReadonlyMap<string, SessionStreamState> = new Map()

    /** 订阅全局变化（任一路流更新都触发），返回取消订阅函数 */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    /** 获取整体快照（不可变引用，供 useSyncExternalStore） */
    getSnapshot = (): ReadonlyMap<string, SessionStreamState> => this.snapshot

    /** 指定会话是否正在流式 */
    isStreaming(sessionKey: string): boolean {
        return this.streams.get(sessionKey)?.state.status === 'streaming'
    }

    /** 开始一路流：注册会话并返回其 AbortController（重复开始同一会话会先中止旧流） */
    begin(sessionKey: string): AbortController {
        this.end(sessionKey) // 同一会话重新发送时，先清理旧流
        const abort = new AbortController()
        this.streams.set(sessionKey, { state: createInitialState(), abort })
        this.emit()
        return abort
    }

    /** 更新一路流的部分状态（增量累积）；会话不存在时忽略 */
    update(sessionKey: string, patch: Partial<Omit<SessionStreamState, 'version'>>): void {
        const active = this.streams.get(sessionKey)
        if (!active) return
        active.state = { ...active.state, ...patch, version: active.state.version + 1 }
        this.emit()
    }

    /** 读取一路流的当前状态（供组件渲染与结束时取最终累积值） */
    get(sessionKey: string): SessionStreamState | undefined {
        return this.streams.get(sessionKey)?.state
    }

    /** 结束一路流并移除（流自然完成/出错/被取代后调用） */
    end(sessionKey: string): void {
        const active = this.streams.get(sessionKey)
        if (!active) return
        if (!active.abort.signal.aborted) active.abort.abort()
        this.streams.delete(sessionKey)
        this.emit()
    }

    /** 中止一路流但保留已累积内容（用户点「停止」）：标记 aborted 后移除 */
    abort(sessionKey: string): void {
        const active = this.streams.get(sessionKey)
        if (!active) return
        active.abort.abort()
        active.state = { ...active.state, status: 'done', aborted: true, version: active.state.version + 1 }
        this.emit()
    }

    /** 触发所有订阅者并刷新快照引用 */
    private emit(): void {
        const next = new Map<string, SessionStreamState>()
        for (const [key, active] of this.streams) next.set(key, active.state)
        this.snapshot = next
        for (const listener of this.listeners) listener()
    }
}

/** 全局单例 */
export const agentStreamManager = new AgentStreamManager()
