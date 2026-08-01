import api from './request'
import type { TrendingResult, GithubSearchRepo } from '../types'

export async function fetchTrending(since: string, language?: string, perPage?: number): Promise<TrendingResult> {
    const body: Record<string, unknown> = { since }
    if (language) body.language = language
    if (perPage) body.perPage = perPage
    const { data } = await api.post<TrendingResult>('/api/trending', body)
    return data
}

/** ensure 接口返回的单个映射项 */
export interface EnsureRepoMapping {
    fullName: string
    id: number
}

/**
 * 确保趋势仓库入库并返回 fullName → 本地仓库 id 映射
 *
 * 供「加入 Agent 对话上下文」使用：趋势列表中只有已 star 仓库才带 localRepoId，
 * 未入库仓库需先轻量 upsert 拿到 id 才能作为对话上下文（后端按本地 id 查库注入 prompt）。
 */
export async function ensureTrendingRepos(repos: GithubSearchRepo[]): Promise<EnsureRepoMapping[]> {
    const body = {
        repos: repos.map((r) => ({
            fullName: r.fullName,
            description: r.description ?? null,
            descriptionCn: r.descriptionCn ?? null,
            language: r.language ?? null,
            ownerName: r.ownerName ?? null,
            ownerAvatarUrl: r.ownerAvatarUrl ?? null,
            htmlUrl: r.htmlUrl ?? null,
            starsCount: r.starsCount ?? 0,
            forksCount: r.forksCount ?? 0,
            topics: r.topics ?? [],
            pushedAt: r.pushedAt ?? null,
        })),
    }
    const { data } = await api.post<{ success: boolean; repos: EnsureRepoMapping[] }>('/api/trending/ensure', body, { timeout: 60000 })
    return data.repos ?? []
}

/**
 * 下载趋势仓库
 *
 * 获取指定时间段的趋势仓库列表，确保本地 DB 中存在，再创建下载任务。
 *
 * @param params.since - 时间范围：daily / weekly / monthly
 * @param params.language - 编程语言（可选）
 * @param params.perPage - 每页数量（可选，默认 20）
 * @param params.targetDir - 目标下载目录（绝对路径）
 * @param params.concurrency - 并发数（可选，默认 3）
 * @param params.mirrorSources - 镜像源列表（可选）
 * @param params.extractArchive - 是否解压（可选，默认 true）
 * @param params.deleteAfterExtract - 是否解压后删除压缩包（可选，默认 true）
 * @returns 下载任务创建结果
 */
export async function downloadTrending(params: {
    since: string
    language?: string
    perPage?: number
    targetDir: string
    concurrency?: number
    mirrorSources?: string[]
    extractArchive?: boolean
    deleteAfterExtract?: boolean
}): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/trending/download', params, { timeout: 30000 })
    return data
}
