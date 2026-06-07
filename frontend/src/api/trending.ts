import api from './request'
import type { GithubSearchRepo } from './github'

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
