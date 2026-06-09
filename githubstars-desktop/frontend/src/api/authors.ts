import api from './request'
import type { AuthorDTO, AuthorListParams, AuthorRepoParams, GithubRepo, PageResult } from '../types'

/**
 * 获取作者列表（分页 + 搜索）
 */
export async function fetchAuthorList(params: AuthorListParams): Promise<PageResult<AuthorDTO>> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.size) searchParams.set('size', String(params.size))
  if (params.keyword) searchParams.set('keyword', params.keyword)
  const { data } = await api.get<PageResult<AuthorDTO>>('/api/authors', { params: searchParams })
  return data
}

/**
 * 获取某作者的仓库列表（分页 + 排序）
 */
export async function fetchAuthorRepos(
  ownerName: string,
  params: AuthorRepoParams
): Promise<PageResult<GithubRepo>> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.size) searchParams.set('size', String(params.size))
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  const { data } = await api.get<PageResult<GithubRepo>>(`/api/authors/${encodeURIComponent(ownerName)}`, {
    params: searchParams,
  })
  return data
}

/**
 * 导出某作者的全部仓库链接为 txt 文件
 */
/**
 * 导出某作者的全部仓库链接（文本内容，Electron 用）
 */
export async function exportAuthorUrlsText(
  ownerName: string,
  sortBy?: string,
  sortOrder?: string
): Promise<string> {
  const searchParams = new URLSearchParams()
  if (sortBy) searchParams.set('sortBy', sortBy)
  if (sortOrder) searchParams.set('sortOrder', sortOrder)
  const { data } = await api.get<string>(`/api/authors/${encodeURIComponent(ownerName)}/export`, {
    params: searchParams,
  })
  return data
}

/**
 * 导出某作者的全部仓库链接为 txt 文件（Blob，Web 模式用）
 */
export async function exportAuthorUrls(
  ownerName: string,
  sortBy?: string,
  sortOrder?: string
): Promise<Blob> {
  const searchParams = new URLSearchParams()
  if (sortBy) searchParams.set('sortBy', sortBy)
  if (sortOrder) searchParams.set('sortOrder', sortOrder)
  const { data } = await api.get(`/api/authors/${encodeURIComponent(ownerName)}/export`, {
    params: searchParams,
    responseType: 'blob',
  })
  return data
}
