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

/** 搜索标签 */
export async function searchTags(keyword: string): Promise<TagInfo[]> {
    const { data } = await api.get<TagInfo[]>('/api/tags/search', { params: { q: keyword } })
    return data
}

/** 删除单个标签 */
export async function deleteTag(tagId: number): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.delete(`/api/tags/${tagId}`)
    return data
}

/** 删除所有空标签（repoCount=0） */
export async function deleteEmptyTags(): Promise<{ success: boolean; deleted: number; names: string[]; message?: string }> {
    const { data } = await api.delete('/api/tags/empty')
    return data
}

/** 删除全部标签（重置） */
export async function deleteAllTags(): Promise<{ success: boolean; deleted: number; message?: string }> {
    const { data } = await api.delete('/api/tags/all')
    return data
}

/** 删除标签维度 */
export async function deleteTagGroup(groupId: number): Promise<{ success: boolean; deleted: number; message?: string }> {
    const { data } = await api.delete(`/api/tags/groups/${groupId}`)
    return data
}

/** 启动 Agent 流式自动打标签 */
export function startAgentAutoTag(repoIds: number[], callbacks: {
    onStatus: (msg: string) => void
    onThinking: (content: string) => void
    onToolCall: (name: string, input?: Record<string, unknown>) => void
    onToolResult: (content: string) => void
    onResult: (msg: string) => void
    onError: (msg: string) => void
    onDone: () => void
}): () => void {
    const controller = new AbortController()

    fetch('http://localhost:3000/api/agent/tags/stream', {
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
                                case 'tool_result': callbacks.onToolResult(data.message || data.content || ''); break
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
