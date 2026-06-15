import api from './request'
import type { LanguageStatsDTO, OverviewStatsDTO, OwnerStatsDTO, TimelineStatsDTO, GithubRepo } from '../types'

export async function fetchLanguageStats(): Promise<LanguageStatsDTO[]> {
    const { data } = await api.get<LanguageStatsDTO[]>('/api/stats/languages')
    return data
}

export async function fetchOwnerStats(topN: number = 15): Promise<OwnerStatsDTO[]> {
    const { data } = await api.get<OwnerStatsDTO[]>('/api/stats/owners', { params: { topN } })
    return data
}

export async function fetchTimelineStats(): Promise<TimelineStatsDTO[]> {
    const { data } = await api.get<TimelineStatsDTO[]>('/api/stats/timeline')
    return data
}

export async function fetchOverviewStats(): Promise<OverviewStatsDTO> {
    const { data } = await api.get<OverviewStatsDTO>('/api/stats/overview')
    return data
}

export async function fetchTopStarredRepos(topN: number = 10): Promise<GithubRepo[]> {
    const { data } = await api.get<GithubRepo[]>('/api/stats/top-starred', { params: { topN } })
    return data
}

export async function fetchRecentActiveRepos(topN: number = 10): Promise<GithubRepo[]> {
    const { data } = await api.get<GithubRepo[]>('/api/stats/recent-active', { params: { topN } })
    return data
}
