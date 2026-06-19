import api from './request'
import type { GithubRepo, StarListParams, PageResult } from '../types'

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
