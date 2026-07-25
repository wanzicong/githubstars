/**
 * 学习收藏 API
 *
 * 与后端 /api/learn/* 与 /api/learn-tag/* 对接。
 * 后端返回包裹结构 { success, data, meta? }，前端在此层拆解。
 */
import api from './request'
import type {
    LearnListParams,
    LearnListResult,
    LearnPriority,
    LearnRecord,
    LearnStats,
    LearnStatus,
    LearnTag,
} from '../types'

interface Wrapped<T> {
    success: boolean
    data: T
}

interface WrappedList<T> {
    success: boolean
    data: T[]
    meta: { total: number; size: number; current: number; pages: number }
}

// ── 学习记录 ──

export async function fetchLearnList(params: LearnListParams): Promise<LearnListResult> {
    const body: Record<string, unknown> = { page: params.page ?? 1, size: params.size ?? 20 }
    if (params.status) body.status = params.status
    if (params.priority) body.priority = params.priority
    if (params.categoryId) body.categoryId = params.categoryId
    if (params.tagIds?.length) body.tagIds = params.tagIds
    if (params.keyword?.trim()) body.keyword = params.keyword.trim()
    if (params.sortBy) body.sortBy = params.sortBy
    if (params.sortOrder) body.sortOrder = params.sortOrder

    const { data: wrapped } = await api.post<WrappedList<LearnRecord>>('/api/learn/list', body)
    return {
        records: wrapped.data,
        total: wrapped.meta.total,
        size: wrapped.meta.size,
        current: wrapped.meta.current,
        pages: wrapped.meta.pages,
    }
}

export async function fetchLearnDetail(id: number): Promise<LearnRecord> {
    const { data: wrapped } = await api.post<Wrapped<LearnRecord>>('/api/learn/detail', { id })
    return wrapped.data
}

export interface LearnCreatePayload {
    repoId: number
    status?: LearnStatus
    priority?: LearnPriority
    notes?: string | null
    tagIds?: number[]
}

export async function createLearnRecord(payload: LearnCreatePayload): Promise<LearnRecord> {
    const { data: wrapped } = await api.post<Wrapped<LearnRecord>>('/api/learn/create', payload)
    return wrapped.data
}

export async function quickAddLearn(repoId: number): Promise<LearnRecord> {
    const { data: wrapped } = await api.post<Wrapped<LearnRecord>>('/api/learn/quick-add', { repoId })
    return wrapped.data
}

/** 批量查询 repoIds 是否已加入学习，返回 map: repoId -> learnRecordId */
export async function checkLearnRepos(repoIds: number[]): Promise<Record<number, number>> {
    if (!repoIds.length) return {}
    const { data: wrapped } = await api.post<Wrapped<Record<number, number>>>('/api/learn/check-repos', { repoIds })
    return wrapped.data
}

export interface LearnUpdatePayload {
    id: number
    status?: LearnStatus
    priority?: LearnPriority
    notes?: string | null
    tagIds?: number[]
}

export async function updateLearnRecord(payload: LearnUpdatePayload): Promise<LearnRecord> {
    const { data: wrapped } = await api.post<Wrapped<LearnRecord>>('/api/learn/update', payload)
    return wrapped.data
}

export async function deleteLearnRecord(id: number): Promise<void> {
    await api.post<Wrapped<{ success: true }>>('/api/learn/delete', { id })
}

export async function fetchLearnStats(): Promise<LearnStats> {
    const { data: wrapped } = await api.post<Wrapped<LearnStats>>('/api/learn/stats', {})
    return wrapped.data
}

// ── 学习标签 ──

export async function fetchLearnTags(): Promise<LearnTag[]> {
    const { data: wrapped } = await api.post<WrappedList<LearnTag> | Wrapped<LearnTag[]>>('/api/learn-tag/list', {})
    // 兼容两种返回：带 meta 的包裹 vs 直接 data
    if (Array.isArray((wrapped as Wrapped<LearnTag[]>).data)) return (wrapped as Wrapped<LearnTag[]>).data
    return (wrapped as WrappedList<LearnTag>).data
}

export async function createLearnTag(payload: { name: string; color?: string | null }): Promise<LearnTag> {
    const { data: wrapped } = await api.post<Wrapped<LearnTag>>('/api/learn-tag/create', payload)
    return wrapped.data
}

export async function updateLearnTag(payload: { id: number; name?: string; color?: string | null }): Promise<LearnTag> {
    const { data: wrapped } = await api.post<Wrapped<LearnTag>>('/api/learn-tag/update', payload)
    return wrapped.data
}

export async function deleteLearnTag(id: number): Promise<void> {
    await api.post<Wrapped<{ success: true }>>('/api/learn-tag/delete', { id })
}
