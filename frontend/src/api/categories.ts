import api from './request'
import type { Category, GithubRepo, PageResult, ApiResponse } from '../types'

export async function fetchAllCategories(): Promise<Category[]> {
    const { data } = await api.get<Category[]>('/categories/all')
    return data
}

export async function fetchUncategorizedRepos(): Promise<GithubRepo[]> {
    const { data } = await api.get<GithubRepo[]>('/categories/uncategorized')
    return data
}

export async function createCategory(name: string, description?: string, parentId?: number | null): Promise<ApiResponse> {
    const { data } = await api.post<ApiResponse>('/categories', { name, description, parentId })
    return data
}

export async function moveCategory(id: number, parentId: number | null): Promise<ApiResponse> {
    const { data } = await api.post<ApiResponse>(`/categories/${id}/move`, { parentId })
    return data
}

export async function updateCategory(id: number, name: string, description?: string): Promise<ApiResponse> {
    const { data } = await api.put<ApiResponse>(`/categories/${id}`, { name, description })
    return data
}

export async function deleteCategory(id: number): Promise<ApiResponse> {
    const { data } = await api.delete<ApiResponse>(`/categories/${id}`)
    return data
}

export async function batchDeleteCategories(ids: number[]): Promise<ApiResponse> {
    const { data } = await api.delete<ApiResponse>('/categories/batch', { data: { ids } })
    return data
}

export async function addReposToCategory(categoryId: number, repoIds: number[]): Promise<ApiResponse> {
    const { data } = await api.post<ApiResponse>(`/categories/${categoryId}/repos`, { repoIds })
    return data
}

export async function removeRepoFromCategory(categoryId: number, repoId: number): Promise<ApiResponse> {
    const { data } = await api.delete<ApiResponse>(`/categories/${categoryId}/repos/${repoId}`)
    return data
}

export async function transferRepos(fromCategoryId: number, repoIds: number[], toCategoryId: number): Promise<ApiResponse> {
    const { data } = await api.post<ApiResponse>(`/categories/${fromCategoryId}/repos/transfer`, {
        repoIds,
        toCategoryId,
    })
    return data
}

export async function fetchReposByCategoryId(categoryId: number): Promise<GithubRepo[]> {
    const { data } = await api.get<GithubRepo[]>(`/categories/${categoryId}/repos`)
    return data
}

export interface CategoryRepoParams {
    page?: number
    size?: number
    keyword?: string
    language?: string
    sortBy?: string
    sortOrder?: string
}

export async function fetchReposByCategoryIdPaged(categoryId: number, params: CategoryRepoParams): Promise<PageResult<GithubRepo>> {
    const searchParams = new URLSearchParams()
    if (params.page) searchParams.set('page', String(params.page))
    if (params.size) searchParams.set('size', String(params.size))
    if (params.keyword) searchParams.set('keyword', params.keyword)
    if (params.language) searchParams.set('language', params.language)
    if (params.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
    const { data } = await api.get<PageResult<GithubRepo>>(`/categories/${categoryId}/repos`, {
        params: searchParams,
    })
    return data
}

export async function reclassifyCategory(categoryId: number, topN: number = 8): Promise<ApiResponse> {
    const { data } = await api.post<ApiResponse>(`/categories/${categoryId}/reclassify`, { topN })
    return data
}

/** 智能分类：对未归类仓库优先匹配现有分类 */
export async function smartClassify(): Promise<ApiResponse & { totalProcessed?: number; matchedExisting?: number; createdNew?: number }> {
    const { data } = await api.post('/categories/smart-classify')
    return data
}
