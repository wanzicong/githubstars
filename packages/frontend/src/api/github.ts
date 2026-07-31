import api from './request'
import type { GithubSearchRepo, RepoDetailData, SearchReposParams, SearchReposResult } from '../types'

export type { GithubSearchRepo, SearchReposParams, SearchReposResult }

export async function searchRepos(params: SearchReposParams): Promise<SearchReposResult> {
    const body: Record<string, unknown> = {}
    if (params.keyword) body.keyword = params.keyword
    if (params.language) body.language = params.language
    if (params.sort) body.sort = params.sort
    if (params.page !== undefined) body.page = params.page
    if (params.perPage !== undefined) body.perPage = params.perPage
    const { data } = await api.post<SearchReposResult>('/api/github/search', body)
    return data
}

/**
 * 获取任意 GitHub 仓库详情（统一仓库详情页数据源）
 *
 * 本地库已收录返回 DB 数据（含翻译），否则实时从 GitHub API 获取。
 * 未入库的仓库只读展示，不写入数据库。
 */
export async function fetchGithubRepoDetail(owner: string, repo: string): Promise<RepoDetailData> {
    const { data: envelope } = await api.post<{ success: boolean; data: RepoDetailData }>('/api/github/repo-detail', { owner, repo })
    return envelope.data
}

export async function starRepo(owner: string, repo: string): Promise<{ success: boolean; starred: boolean; message?: string }> {
    const { data } = await api.post<{ success: boolean; starred: boolean; message?: string }>('/api/github/star', { owner, repo })
    return data
}

export async function checkStarred(owner: string, repo: string): Promise<{ success: boolean; starred: boolean }> {
    const { data } = await api.post<{ success: boolean; starred: boolean }>('/api/github/starred', { owner, repo })
    return data
}
