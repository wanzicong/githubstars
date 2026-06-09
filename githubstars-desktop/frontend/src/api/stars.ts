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
  if (params.startMonth) searchParams.set('startMonth', params.startMonth)
  if (params.endMonth) searchParams.set('endMonth', params.endMonth)
  const { data } = await api.get<PageResult<GithubRepo>>('/api/stars', { params: searchParams })
  return data
}

export async function fetchStarDetail(id: number): Promise<GithubRepo> {
  const { data } = await api.get<GithubRepo>(`/api/stars/${id}`)
  return data
}

/**
 * 导出筛选后的仓库链接（文本内容）
 */
export async function exportStarsUrlsText(params: StarListParams): Promise<string> {
  const searchParams = new URLSearchParams()
  if (params.keyword) searchParams.set('keyword', params.keyword)
  if (params.language) searchParams.set('language', params.language)
  if (params.categoryIds) searchParams.set('categoryIds', params.categoryIds)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  if (params.dateField) searchParams.set('dateField', params.dateField)
  if (params.startMonth) searchParams.set('startMonth', params.startMonth)
  if (params.endMonth) searchParams.set('endMonth', params.endMonth)
  const { data } = await api.get<string>('/stars/export', { params: searchParams })
  return data
}

/**
 * 导出筛选后的仓库链接（Blob，Web 模式用）
 */
export async function exportStarsUrls(params: StarListParams): Promise<Blob> {
  const searchParams = new URLSearchParams()
  if (params.keyword) searchParams.set('keyword', params.keyword)
  if (params.language) searchParams.set('language', params.language)
  if (params.categoryIds) searchParams.set('categoryIds', params.categoryIds)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  if (params.dateField) searchParams.set('dateField', params.dateField)
  if (params.startMonth) searchParams.set('startMonth', params.startMonth)
  if (params.endMonth) searchParams.set('endMonth', params.endMonth)
  const { data } = await api.get('/stars/export', {
    params: searchParams,
    responseType: 'blob',
  })
  return data
}
