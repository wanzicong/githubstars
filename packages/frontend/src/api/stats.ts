import api from './request'
import type { LanguageStatsDTO, OverviewStatsDTO, OwnerStatsDTO, TimelineStatsDTO, GithubRepo } from '../types'

/**
 * 统计分析 API
 *
 * 提供编程语言、仓库所有者、时间线、概览、排行榜等多维度统计数据查询。
 */

/**
 * 获取编程语言统计
 *
 * @returns 按仓库数量降序排列的语言列表
 */
export async function fetchLanguageStats(): Promise<LanguageStatsDTO[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: LanguageStatsDTO[] }>('/api/stats/languages')
    return wrapped.data
}

/**
 * 获取仓库所有者统计排名
 *
 * @param topN 返回前 N 名，默认 15
 * @returns 按仓库数量降序排列的前 topN 名所有者
 */
export async function fetchOwnerStats(topN: number = 15): Promise<OwnerStatsDTO[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: OwnerStatsDTO[] }>('/api/stats/owners', { topN })
    return wrapped.data
}

/**
 * 获取 Star 时间线统计
 *
 * @returns 按月聚合的 Star 数量趋势数据
 */
export async function fetchTimelineStats(): Promise<TimelineStatsDTO[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: TimelineStatsDTO[] }>('/api/stats/timeline')
    return wrapped.data
}

/**
 * 获取整体概览统计
 *
 * @returns 仓库总数、Star/Fork 总数、语言/所有者种类数
 */
export async function fetchOverviewStats(): Promise<OverviewStatsDTO> {
    const { data: wrapped } = await api.post<{ success: boolean; data: OverviewStatsDTO }>('/api/stats/overview')
    return wrapped.data
}

/**
 * 获取 Star 数量最多的仓库
 *
 * @param topN 返回前 N 名，默认 10
 * @returns 按 starsCount 降序排列的仓库列表
 */
export async function fetchTopStarredRepos(topN: number = 10): Promise<GithubRepo[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: GithubRepo[] }>('/api/stats/top-starred', { topN })
    return wrapped.data
}

/**
 * 获取最近活跃的仓库
 *
 * @param topN 返回前 N 名，默认 10
 * @returns 按 repoUpdatedAt 降序排列的仓库列表
 */
export async function fetchRecentActiveRepos(topN: number = 10): Promise<GithubRepo[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: GithubRepo[] }>('/api/stats/recent-active', { topN })
    return wrapped.data
}
