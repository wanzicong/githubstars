import api from './request'
import type { GithubRepo, StarListParams, PageResult } from '../types'

export async function fetchStarList(params: StarListParams): Promise<PageResult<GithubRepo>> {
    const searchParams = new URLSearchParams()
    if (params.page) searchParams.set('page', String(params.page))
    if (params.size) searchParams.set('size', String(params.size))
    if (params.keyword) searchParams.set('keyword', params.keyword)
    if (params.language) searchParams.set('language', params.language)
    if (params.categoryIds) searchParams.set('categoryIds', params.categoryIds)
    if (params.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
    if (params.dateField) searchParams.set('dateField', params.dateField)
    if (params.startDate) searchParams.set('startDate', params.startDate)
    if (params.endDate) searchParams.set('endDate', params.endDate)
    if (params.untranslatedOnly) searchParams.set('untranslatedOnly', 'true')
    const { data } = await api.get<PageResult<GithubRepo>>('/api/stars', { params: searchParams })
    return data
}

export async function fetchStarDetail(id: number, backQuery?: string): Promise<string> {
    const params = backQuery ? { backQuery } : {}
    const { data } = await api.get<string>(`/api/stars/${id}`, { params })
    return data
}

export async function exportStarsUrls(params: StarListParams): Promise<Blob> {
    const searchParams = new URLSearchParams()
    if (params.keyword) searchParams.set('keyword', params.keyword)
    if (params.language) searchParams.set('language', params.language)
    if (params.categoryIds) searchParams.set('categoryIds', params.categoryIds)
    if (params.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
    if (params.dateField) searchParams.set('dateField', params.dateField)
    if (params.startDate) searchParams.set('startDate', params.startDate)
    if (params.endDate) searchParams.set('endDate', params.endDate)
    if (params.untranslatedOnly) searchParams.set('untranslatedOnly', 'true')
    const { data } = await api.get('/stars/export', {
        params: searchParams,
        responseType: 'blob',
    })
    return data
}
