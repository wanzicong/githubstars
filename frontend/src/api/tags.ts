import api from './request'

export interface TagInfo {
    id: number
    name: string
    color: string | null
    icon: string | null
    groupName: string
    groupColor: string
    source: string
}

export interface TagGroup {
    id: number
    name: string
    color: string
    icon: string | null
    sortOrder: number
    isSystem: boolean
    tags: { id: number; name: string; repoCount: number; color: string | null }[]
}

/** 获取所有标签维度和标签 */
export async function fetchAllTags(): Promise<TagGroup[]> {
    const { data } = await api.get<TagGroup[]>('/api/tags')
    return data
}

/** 获取仓库的标签列表 */
export async function fetchRepoTags(repoId: number): Promise<TagInfo[]> {
    const { data } = await api.get<TagInfo[]>(`/api/tags/repo/${repoId}`)
    return data
}

/** 为仓库添加标签 */
export async function addRepoTag(repoId: number, tagId: number): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post(`/api/tags/repo/${repoId}`, { tagId })
    return data
}

/** 移除仓库的标签 */
export async function removeRepoTag(repoId: number, tagId: number): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.delete(`/api/tags/repo/${repoId}/${tagId}`)
    return data
}

/** 启动 Agent 流式自动打标签 */
export function startAgentAutoTag(repoIds: number[], callbacks: {
    onStatus: (msg: string) => void
    onThinking: (content: string) => void
    onToolCall: (name: string, input?: Record<string, unknown>) => void
    onResult: (msg: string) => void
    onError: (msg: string) => void
    onDone: () => void
}): () => void {
    const controller = new AbortController()

    fetch('/api/agent/tags/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoIds }),
        signal: controller.signal,
    })
        .then(async (resp) => {
            const reader = resp.body?.getReader()
            if (!reader) { callbacks.onError('不支持流式响应'); return }
            const decoder = new TextDecoder()
            let buffer = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) { callbacks.onDone(); break }
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        continue
                    }
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (data.type) {
                                case 'status': callbacks.onStatus(data.message || ''); break
                                case 'thinking': callbacks.onThinking(data.content || ''); break
                                case 'tool_call': callbacks.onToolCall(data.toolName || '', data.toolInput); break
                                case 'result': callbacks.onResult(data.content || data.message || ''); break
                                case 'error': callbacks.onError(data.message || ''); break
                            }
                        } catch {}
                    }
                }
            }
        })
        .catch((e) => {
            if (e.name !== 'AbortError') callbacks.onError(e.message || '请求失败')
        })

    return () => controller.abort()
}
