import api from './request'
import type { TrendingResult, GithubSearchRepo } from '../types'

export async function fetchTrending(since: string, language?: string, perPage?: number): Promise<TrendingResult> {
    const body: Record<string, unknown> = { since }
    if (language) body.language = language
    if (perPage) body.perPage = perPage
    const { data } = await api.post<TrendingResult>('/api/trending', body)
    return data
}

export async function analyzeTrending(since: string, language?: string): Promise<{ success: boolean; taskId?: string; message?: string }> {
    const body: Record<string, unknown> = { since }
    if (language) body.language = language
    const { data } = await api.post('/api/trending/analyze', body)
    return data
}

/**
 * 触发趋势仓库描述翻译
 *
 * 异步翻译未缓存的描述，结果写入 github_repo.description_cn。
 * 翻译完成后重新调用 fetchTrending 即可获取中文描述。
 */
export async function translateTrending(since: string, language?: string, perPage?: number): Promise<{
    success: boolean
    translated: number
    skipped: number
    failed: number
    repos: GithubSearchRepo[]
    total: number
    dateRange: string
    message: string
}> {
    const body: Record<string, unknown> = { since }
    if (language) body.language = language
    if (perPage) body.perPage = perPage
    const { data } = await api.post('/api/trending/translate', body)
    return data
}
