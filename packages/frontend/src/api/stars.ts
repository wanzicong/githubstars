import api from './request'
import type { GithubRepo, StarListParams, PageResult } from '../types'

/**
 * 星标仓库 API
 *
 * 提供星标仓库列表查询和 URL 导出能力。
 */

/**
 * 分页获取星标仓库列表
 *
 * 支持多维度筛选（关键词、语言、日期范围、未翻译）、排序和分页。
 *
 * @param params 查询参数
 * @returns 分页结果，包含翻译状态标记
 */
export async function fetchStarList(params: StarListParams): Promise<PageResult<GithubRepo>> {
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
    if (params.untranslatedOnly) body.untranslatedOnly = true
    const { data: wrapped } = await api.post<{ success: boolean; data: GithubRepo[]; meta: { total: number; size: number; current: number; pages: number } }>('/api/stars/list', body)
    return {
        records: wrapped.data,
        total: wrapped.meta.total,
        size: wrapped.meta.size,
        current: wrapped.meta.current,
        pages: wrapped.meta.pages,
    }
}

/**
 * 按筛选条件导出仓库 URL（返回 Blob 用于下载）
 *
 * @param params 筛选参数（同 fetchStarList）
 * @returns 纯文本 Blob，每行一个 URL
 */
export async function exportStarsUrls(params: StarListParams): Promise<Blob> {
    const body: Record<string, unknown> = {}
    if (params.keyword) body.keyword = params.keyword
    if (params.language) body.language = params.language
    if (params.sortBy) body.sortBy = params.sortBy
    if (params.sortOrder) body.sortOrder = params.sortOrder
    if (params.dateField) body.dateField = params.dateField
    if (params.startDate) body.startDate = params.startDate
    if (params.endDate) body.endDate = params.endDate
    if (params.untranslatedOnly) body.untranslatedOnly = true
    const { data } = await api.post('/api/stars/export', body, {
        responseType: 'blob',
    })
    return data
}

/**
 * 获取所有符合条件的仓库 ID 列表
 *
 * 用于跨页全选功能，根据筛选条件返回所有仓库 ID。
 *
 * @param params 筛选参数（同 fetchStarList）
 * @returns 仓库 ID 数组
 */
export async function fetchAllStarIds(params: StarListParams): Promise<number[]> {
    const body: Record<string, unknown> = {}
    if (params.keyword) body.keyword = params.keyword
    if (params.language) body.language = params.language
    if (params.sortBy) body.sortBy = params.sortBy
    if (params.sortOrder) body.sortOrder = params.sortOrder
    if (params.dateField) body.dateField = params.dateField
    if (params.startDate) body.startDate = params.startDate
    if (params.endDate) body.endDate = params.endDate
    if (params.untranslatedOnly) body.untranslatedOnly = true
    const { data } = await api.post<{ success: boolean; ids: number[]; total: number }>('/api/stars/ids', body)
    return data.ids || []
}

/**
 * 根据 ID 列表批量获取仓库详情
 *
 * 用于跨页全选后获取仓库完整信息。
 *
 * @param ids 仓库 ID 数组
 * @returns 仓库详情数组
 */
export async function fetchReposByIds(ids: number[]): Promise<GithubRepo[]> {
    const { data } = await api.post<{ success: boolean; data: GithubRepo[] }>('/api/stars/by-ids', { ids })
    return data.data || []
}
