import api from './request'
import type { MyRepo, MyRepoListParams, MyRepoStats, MyRepoSyncStatus, PageResult } from '../types'

/**
 * 我的仓库 API
 *
 * 管理用户在 GitHub 上自己创建的仓库：
 * 同步、分页查询、详情、分类绑定、统计。
 */

/** 构造筛选请求体（省略空值参数） */
function buildBody(params: MyRepoListParams): Record<string, unknown> {
    const body: Record<string, unknown> = {}
    if (params.page) body.page = params.page
    if (params.size) body.size = params.size
    if (params.keyword) body.keyword = params.keyword
    if (params.language) body.language = params.language
    if (params.sortBy) body.sortBy = params.sortBy
    if (params.sortOrder) body.sortOrder = params.sortOrder
    if (params.dateField) body.dateField = params.dateField
    if (params.startDate) body.startDate = params.startDate
    if (params.endDate) body.endDate = params.endDate
    if (params.categoryId) body.categoryId = params.categoryId
    if (params.isPrivate !== undefined) body.isPrivate = params.isPrivate
    if (params.untranslatedOnly) body.untranslatedOnly = params.untranslatedOnly
    return body
}

/**
 * 触发我的仓库同步（异步执行）
 *
 * @returns message 提示文案；已有同步进行中时 success=false
 */
export async function syncMyRepos(): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post<{ success: boolean; message: string }>('/api/my-repos/sync', {})
    return data
}

/** 查询我的仓库同步状态 */
export async function fetchMyRepoSyncStatus(): Promise<MyRepoSyncStatus> {
    const { data } = await api.get<{ success: boolean; data: MyRepoSyncStatus }>('/api/my-repos/sync-status')
    return data.data
}

/**
 * 分页获取我的仓库列表
 *
 * 支持多维度筛选（关键词、语言、私有/公开、日期范围、分类）、排序和分页。
 */
export async function fetchMyRepoList(params: MyRepoListParams): Promise<PageResult<MyRepo>> {
    const { data: wrapped } = await api.post<{ success: boolean; data: MyRepo[]; meta: { total: number; size: number; current: number; pages: number } }>(
        '/api/my-repos/list',
        buildBody(params),
    )
    return {
        records: wrapped.data,
        total: wrapped.meta.total,
        size: wrapped.meta.size,
        current: wrapped.meta.current,
        pages: wrapped.meta.pages,
    }
}

/** 根据本地 ID 获取我的仓库详情（含分类与翻译状态） */
export async function fetchMyRepoDetail(repoId: number): Promise<MyRepo> {
    const { data: envelope } = await api.post<{ success: boolean; data: MyRepo }>('/api/my-repos/detail', { id: repoId })
    return envelope.data
}

/** 按筛选条件获取全部仓库 ID（跨页全选用） */
export async function fetchAllMyRepoIds(params: MyRepoListParams): Promise<number[]> {
    const { data } = await api.post<{ success: boolean; ids: number[]; total: number }>('/api/my-repos/ids', buildBody(params))
    return data.ids || []
}

/** 按 ID 列表批量获取我的仓库 */
export async function fetchMyReposByIds(ids: number[]): Promise<MyRepo[]> {
    const { data } = await api.post<{ success: boolean; data: MyRepo[] }>('/api/my-repos/by-ids', { ids })
    return data.data || []
}

/** 批量绑定我的仓库到分类 */
export async function bindMyRepoCategories(categoryId: number, repoIds: number[]): Promise<{ bound: number; invalid: number }> {
    const { data } = await api.post<{ success: boolean; bound: number; invalid: number }>('/api/my-repos/categories/bind', { categoryId, repoIds })
    return { bound: data.bound, invalid: data.invalid }
}

/** 批量解绑我的仓库分类 */
export async function unbindMyRepoCategories(categoryId: number, repoIds: number[]): Promise<{ unbound: number }> {
    const { data } = await api.post<{ success: boolean; unbound: number }>('/api/my-repos/categories/unbind', { categoryId, repoIds })
    return { unbound: data.unbound }
}

/** 我的仓库概览统计 */
export async function fetchMyRepoStats(): Promise<MyRepoStats> {
    const { data } = await api.get<{ success: boolean; data: MyRepoStats }>('/api/my-repos/stats')
    return data.data
}
