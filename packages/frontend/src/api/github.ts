import api from './request'

export interface GithubSearchRepo {
    id: number
    fullName: string
    description: string
    language: string
    starsCount: number
    forksCount: number
    htmlUrl: string
    ownerName: string
    ownerAvatarUrl: string
    topics: string[]
    pushedAt: string
}

export interface SearchReposParams {
    keyword?: string
    language?: string
    sort?: string
    page?: number
    perPage?: number
}

export interface SearchReposResult {
    success: boolean
    total: number
    repos: GithubSearchRepo[]
    page: number
    perPage: number
}

export async function searchRepos(params: SearchReposParams): Promise<SearchReposResult> {
    const body: Record<string, any> = {}
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
