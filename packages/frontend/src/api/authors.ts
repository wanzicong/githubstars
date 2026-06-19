import api from './request'
import type { AuthorDTO, AuthorListParams, AuthorRepoParams, GithubRepo, PageResult } from '../types'

/**
 * 获取作者列表（分页 + 搜索）
 */
export async function fetchAuthorList(params: AuthorListParams): Promise<PageResult<AuthorDTO>> {
    const body: Record<string, unknown> = {}
    if (params.page) body.page = params.page
    if (params.size) body.size = params.size
    if (params.keyword) body.keyword = params.keyword
    const { data: wrapped } = await api.post<{ success: boolean; data: AuthorDTO[]; meta: { total: number; size: number; current: number; pages: number } }>('/api/authors/list', body)
    return {
        records: wrapped.data,
        total: wrapped.meta.total,
        size: wrapped.meta.size,
        current: wrapped.meta.current,
        pages: wrapped.meta.pages,
    }
}

/**
 * 获取某作者的仓库列表（分页 + 排序）
 */
export async function fetchAuthorRepos(ownerName: string, params: AuthorRepoParams): Promise<PageResult<GithubRepo>> {
    const body: Record<string, unknown> = { ownerName }
    if (params.page) body.page = params.page
    if (params.size) body.size = params.size
    if (params.sortBy) body.sortBy = params.sortBy
    if (params.sortOrder) body.sortOrder = params.sortOrder
    const { data: wrapped } = await api.post<{ success: boolean; data: GithubRepo[]; meta: { total: number; size: number; current: number; pages: number } }>('/api/authors/repos', body)
    return {
        records: wrapped.data,
        total: wrapped.meta.total,
        size: wrapped.meta.size,
        current: wrapped.meta.current,
        pages: wrapped.meta.pages,
    }
}

/**
 * 导出某作者的全部仓库链接为 txt 文件
 */
export async function exportAuthorUrls(ownerName: string, sortBy?: string, sortOrder?: string): Promise<Blob> {
    const body: Record<string, unknown> = { ownerName }
    if (sortBy) body.sortBy = sortBy
    if (sortOrder) body.sortOrder = sortOrder
    const { data } = await api.post('/api/authors/export', body, {
        responseType: 'blob',
    })
    return data
}
