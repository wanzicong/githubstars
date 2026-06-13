import api from './request'
import type { GithubRepo } from '../types'

export async function fetchClassifyRepos(keyword?: string, language?: string): Promise<GithubRepo[]> {
    const { data } = await api.get<GithubRepo[]>('/ai/classify/repos', {
        params: { keyword, language },
    })
    return data
}

export async function executeClassify(
    repoIds: number[],
    topN: number = 8,
): Promise<{
    success: boolean
    categories?: Record<string, GithubRepo[]>
    rawResponse?: string
}> {
    const { data } = await api.post('/ai/classify/execute', { repoIds, topN })
    return data
}
