import api from './request'
import type { SimilarResult } from '../types'

export async function findSimilarRepos(repoId: number): Promise<SimilarResult> {
    const { data } = await api.post<SimilarResult>('/api/similar', { repoId })
    return data
}
