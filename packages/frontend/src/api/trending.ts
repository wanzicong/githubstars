import api from './request'
import type { TrendingResult } from '../types'

export async function fetchTrending(since: string, language?: string, perPage?: number): Promise<TrendingResult> {
    const body: Record<string, unknown> = { since }
    if (language) body.language = language
    if (perPage) body.perPage = perPage
    const { data } = await api.post<TrendingResult>('/api/trending', body)
    return data
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
