import api from './request'
import type { TrendingResult } from '../types'

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
