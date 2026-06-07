import api from './request'

export interface GithubSearchRepo {
  id: number
  full_name: string
  description: string
  language: string
  stargazers_count: number
  forks_count: number
  html_url: string
  owner: {
    login: string
    avatar_url: string
  }
  topics: string[]
  pushed_at: string
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
  const searchParams = new URLSearchParams()
  if (params.keyword) searchParams.set('keyword', params.keyword)
  if (params.language) searchParams.set('language', params.language)
  if (params.sort) searchParams.set('sort', params.sort)
  if (params.page !== undefined) searchParams.set('page', String(params.page))
  if (params.perPage !== undefined) searchParams.set('perPage', String(params.perPage))
  const { data } = await api.get<SearchReposResult>('/api/github/search', { params: searchParams })
  return data
}

export async function starRepo(owner: string, repo: string): Promise<{ success: boolean; starred: boolean; message?: string }> {
  const { data } = await api.post<{ success: boolean; starred: boolean; message?: string }>('/api/github/star', { owner, repo })
  return data
}

export async function unstarRepo(owner: string, repo: string): Promise<{ success: boolean; message?: string }> {
  const { data } = await api.post<{ success: boolean; message?: string }>('/api/github/unstar', { owner, repo })
  return data
}

export async function checkStarred(owner: string, repo: string): Promise<{ success: boolean; starred: boolean }> {
  const { data } = await api.get<{ success: boolean; starred: boolean }>('/api/github/check-starred', {
    params: { owner, repo },
  })
  return data
}
