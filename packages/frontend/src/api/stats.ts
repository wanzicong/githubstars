import api from './request'
import type { LanguageStatsDTO, OverviewStatsDTO, OwnerStatsDTO, TimelineStatsDTO, GithubRepo } from '../types'

export async function fetchLanguageStats(): Promise<LanguageStatsDTO[]> {
    const { data } = await api.post<LanguageStatsDTO[]>('/api/stats/languages')
    return data
}

export async function fetchOwnerStats(topN: number = 15): Promise<OwnerStatsDTO[]> {
    const { data } = await api.post<OwnerStatsDTO[]>('/api/stats/owners', { topN })
    return data
}

export async function fetchTimelineStats(): Promise<TimelineStatsDTO[]> {
    const { data } = await api.post<TimelineStatsDTO[]>('/api/stats/timeline')
    return data
}

export async function fetchOverviewStats(): Promise<OverviewStatsDTO> {
    const { data } = await api.post<OverviewStatsDTO>('/api/stats/overview')
    return data
}

export async function fetchTopStarredRepos(topN: number = 10): Promise<GithubRepo[]> {
    const { data } = await api.post<GithubRepo[]>('/api/stats/top-starred', { topN })
    return data
}

export async function fetchRecentActiveRepos(topN: number = 10): Promise<GithubRepo[]> {
    const { data } = await api.post<GithubRepo[]>('/api/stats/recent-active', { topN })
    return data
}
