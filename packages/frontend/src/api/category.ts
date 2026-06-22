/**
 * 分类管理 API
 *
 * 提供分类 CRUD、树查询、仓库绑定/解绑、拖拽排序等能力。
 *
 * @depends
 *   - ./request — Axios 客户端
 *   - @/types — CategoryNode, CategoryRepo 等类型
 */
import api from './request'
import type { CategoryNode, CategoryRepo, CategorySortItem, PaginatedResponse } from '../types'

// ── 分类树 ──

/** 获取完整分类树 */
export async function fetchCategoryTree(): Promise<CategoryNode[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: CategoryNode[] }>(
        '/api/category/tree',
        {},
    )
    return wrapped.data
}

// ── 分类列表（分页）──

export interface CategoryListParams {
    page?: number
    size?: number
    keyword?: string
}

export interface CategoryListResult {
    records: CategoryNode[]
    total: number
    size: number
    current: number
    pages: number
}

/** 分页获取分类列表 */
export async function fetchCategoryList(params: CategoryListParams): Promise<CategoryListResult> {
    const body: Record<string, unknown> = {}
    if (params.page) body.page = params.page
    if (params.size) body.size = params.size
    if (params.keyword) body.keyword = params.keyword

    const { data: wrapped } = await api.post<{
        success: boolean
        data: CategoryNode[]
        meta: { total: number; size: number; current: number; pages: number }
    }>('/api/category/list', body)

    return {
        records: wrapped.data,
        total: wrapped.meta.total,
        size: wrapped.meta.size,
        current: wrapped.meta.current,
        pages: wrapped.meta.pages,
    }
}

// ── 分类 CRUD ──

export interface CategorySaveParams {
    id?: number
    name: string
    parentId?: number | null
    sortOrder?: number
    icon?: string
    description?: string
}

/** 创建分类 */
export async function createCategory(params: CategorySaveParams): Promise<CategoryNode> {
    const body: Record<string, unknown> = { name: params.name }
    if (params.parentId !== undefined) body.parentId = params.parentId
    if (params.sortOrder !== undefined) body.sortOrder = params.sortOrder
    if (params.icon) body.icon = params.icon
    if (params.description) body.description = params.description

    const { data: wrapped } = await api.post<{ success: boolean; data: CategoryNode }>(
        '/api/category/create',
        body,
    )
    return wrapped.data
}

/** 更新分类 */
export async function updateCategory(params: CategorySaveParams): Promise<CategoryNode> {
    const body: Record<string, unknown> = { id: params.id }
    if (params.name !== undefined) body.name = params.name
    if (params.parentId !== undefined) body.parentId = params.parentId
    if (params.sortOrder !== undefined) body.sortOrder = params.sortOrder
    if (params.icon !== undefined) body.icon = params.icon
    if (params.description !== undefined) body.description = params.description

    const { data: wrapped } = await api.post<{ success: boolean; data: CategoryNode }>(
        '/api/category/update',
        body,
    )
    return wrapped.data
}

/** 删除分类 */
export async function deleteCategory(id: number): Promise<void> {
    await api.post('/api/category/delete', { id })
}

// ── 分类排序 ──

/** 批量更新分类排序（拖拽后调用） */
export async function sortCategories(items: CategorySortItem[]): Promise<void> {
    await api.post('/api/category/sort', { items })
}

// ── 分类仓库 ──

export interface CategoryReposParams {
    categoryId: number
    page?: number
    size?: number
    keyword?: string
    language?: string
    sortBy?: string
    sortOrder?: string
}

/** 分页获取分类下的仓库列表 */
export async function fetchCategoryRepos(
    params: CategoryReposParams,
): Promise<PaginatedResponse<CategoryRepo>> {
    const body: Record<string, unknown> = { categoryId: params.categoryId }
    if (params.page) body.page = params.page
    if (params.size) body.size = params.size
    if (params.keyword) body.keyword = params.keyword
    if (params.language) body.language = params.language
    if (params.sortBy) body.sortBy = params.sortBy
    if (params.sortOrder) body.sortOrder = params.sortOrder

    const { data: wrapped } = await api.post<{
        success: boolean
        data: CategoryRepo[]
        meta: { total: number; size: number; current: number; pages: number }
    }>('/api/category/repos', body)

    return {
        records: wrapped.data,
        total: wrapped.meta.total,
        size: wrapped.meta.size,
        current: wrapped.meta.current,
        pages: wrapped.meta.pages,
    }
}

/** 绑定仓库到分类 */
export async function bindCategoryRepos(categoryId: number, repoIds: number[]): Promise<void> {
    await api.post('/api/category/bind', { categoryId, repoIds })
}

/** 从分类中解绑仓库 */
export async function unbindCategoryRepos(categoryId: number, repoIds: number[]): Promise<void> {
    await api.post('/api/category/unbind', { categoryId, repoIds })
}
