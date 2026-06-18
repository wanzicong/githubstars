import api from './request'
import type { GithubSearchRepo, SearchReposParams, SearchReposResult } from '../types'

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

export async function starRepo(owner: string, repo: string): Promise<{ success: boolean; starred: boolean; message?: string }> {
    const { data } = await api.post<{ success: boolean; starred: boolean; message?: string }>('/api/github/star', { owner, repo })
    return data
}

export async function checkStarred(owner: string, repo: string): Promise<{ success: boolean; starred: boolean }> {
    const { data } = await api.post<{ success: boolean; starred: boolean }>('/api/github/starred', { owner, repo })
    return data
}
