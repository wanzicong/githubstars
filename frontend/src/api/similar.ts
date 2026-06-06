import api from './request'

export interface SimilarRepo {
  fullName: string
  description: string
  language: string
  stars: number
  forks: number
  htmlUrl: string
  pushedAt: string
  aiReason: string
  score: number
}

export interface SimilarResult {
  success: boolean
  repos: SimilarRepo[]
  count: number
}

export async function findSimilarRepos(repoId: number): Promise<SimilarResult> {
  const { data } = await api.get<SimilarResult>(`/api/similar/${repoId}`)
  return data
}
