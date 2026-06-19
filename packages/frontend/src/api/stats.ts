import api from './request'
import type { LanguageStatsDTO, OverviewStatsDTO, OwnerStatsDTO, TimelineStatsDTO, GithubRepo } from '../types'

export async function fetchLanguageStats(): Promise<LanguageStatsDTO[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: LanguageStatsDTO[] }>('/api/stats/languages')
    return wrapped.data
}

export async function fetchOwnerStats(topN: number = 15): Promise<OwnerStatsDTO[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: OwnerStatsDTO[] }>('/api/stats/owners', { topN })
    return wrapped.data
}

export async function fetchTimelineStats(): Promise<TimelineStatsDTO[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: TimelineStatsDTO[] }>('/api/stats/timeline')
    return wrapped.data
}

export async function fetchOverviewStats(): Promise<OverviewStatsDTO> {
    const { data: wrapped } = await api.post<{ success: boolean; data: OverviewStatsDTO }>('/api/stats/overview')
    return wrapped.data
}

export async function fetchTopStarredRepos(topN: number = 10): Promise<GithubRepo[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: GithubRepo[] }>('/api/stats/top-starred', { topN })
    return wrapped.data
}

export async function fetchRecentActiveRepos(topN: number = 10): Promise<GithubRepo[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: GithubRepo[] }>('/api/stats/recent-active', { topN })
    return wrapped.data
}
