import api from './request'
import type { GithubSearchRepo } from './github'
import { getAnalyzeStatus } from '../api/analyze'

export interface TrendingResult {
  success: boolean
  since: string
  total: number
  repos: GithubSearchRepo[]
  dateRange: string
}

export async function fetchTrending(
  since: string,
  language?: string,
  perPage?: number
): Promise<TrendingResult> {
  const params = new URLSearchParams()
  params.set('since', since)
  if (language) params.set('language', language)
  if (perPage) params.set('perPage', String(perPage))
  const { data } = await api.get<TrendingResult>('/api/trending', { params })
  return data
}

export async function analyzeTrending(since: string, language?: string): Promise<{ success: boolean; taskId?: string; message?: string }> {
  const params = new URLSearchParams()
  params.set('since', since)
  if (language) params.set('language', language)
  const { data } = await api.post('/api/trending/analyze', null, { params })
  return data
}
