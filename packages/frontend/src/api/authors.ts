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
    const { data } = await api.post<PageResult<AuthorDTO>>('/api/authors/list', body)
    return data
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
    const { data } = await api.post<PageResult<GithubRepo>>('/api/authors/repos', body)
    return data
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
