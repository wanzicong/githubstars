import { useState, useCallback, useEffect, useRef } from 'react'
import { App } from 'antd'
import type { CategoryRepo, PaginatedResponse } from '../../../types'
import { fetchCategoryRepos, unbindCategoryRepos } from '../../../api'
import { CATEGORY_REPO_PAGE_SIZE } from '../../../constants'

export interface RepoFilters {
    keyword: string
    language: string
    sortBy: string
    sortOrder: string
}

export interface UseCategoryReposReturn {
    repos: CategoryRepo[]
    total: number
    loading: boolean
    currentPage: number
    pageSize: number
    filters: RepoFilters
    setCurrentPage: (page: number) => void
    setPageSize: (size: number) => void
    setFilters: (filters: Partial<RepoFilters>) => void
    resetFilters: () => void
    refresh: () => Promise<void>
    handleUnbind: (repoIds: number[]) => Promise<void>
}

const INITIAL_FILTERS: RepoFilters = {
    keyword: '',
    language: '',
    sortBy: 'starsCount',
    sortOrder: 'desc',
}

export function useCategoryRepos(categoryId: number | null): UseCategoryReposReturn {
    const { message, modal } = App.useApp()
    const [repos, setRepos] = useState<CategoryRepo[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [pageSize, setPageSize] = useState(CATEGORY_REPO_PAGE_SIZE)
    const abortRef = useRef<AbortController | null>(null)

    // 渲染期派生：categoryId 变化时重置分页和筛选
    const [prevCategoryId, setPrevCategoryId] = useState(categoryId)
    const [currentPage, setCurrentPage] = useState(1)
    const [filters, setFiltersState] = useState<RepoFilters>(INITIAL_FILTERS)
    if (prevCategoryId !== categoryId) {
        setPrevCategoryId(categoryId)
        setCurrentPage(1)
        setFiltersState(INITIAL_FILTERS)
    }

    const refresh = useCallback(async () => {
        if (!categoryId) {
            setRepos([])
            setTotal(0)
            return
        }
        abortRef.current?.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        try {
            const result: PaginatedResponse<CategoryRepo> = await fetchCategoryRepos({
                categoryId,
                page: currentPage,
                size: pageSize,
                keyword: filters.keyword || undefined,
                language: filters.language || undefined,
                sortBy: filters.sortBy || undefined,
                sortOrder: filters.sortOrder || undefined,
            })
            setRepos(result.records)
            setTotal(result.total)
        } catch (err: unknown) {
            if ((err as Error)?.name !== 'AbortError') {
                message.error('加载仓库列表失败')
            }
        } finally {
            setLoading(false)
        }
    }, [categoryId, currentPage, pageSize, filters, message])

    useEffect(() => {
        Promise.resolve().then(() => refresh().catch(() => { /* 错误已在内部 message.error */ }))
        return () => abortRef.current?.abort()
    }, [refresh])

    const setFilters = useCallback((partial: Partial<RepoFilters>) => {
        setFiltersState((prev) => ({ ...prev, ...partial }))
        setCurrentPage(1)
    }, [])

    const resetFilters = useCallback(() => {
        setFiltersState(INITIAL_FILTERS)
        setCurrentPage(1)
    }, [])

    const handleUnbind = useCallback(async (repoIds: number[]) => {
        if (!categoryId) return
        modal.confirm({
            title: '确认移除',
            content: `确定要从当前分类中移除 ${repoIds.length} 个仓库吗？`,
            okText: '移除',
            okType: 'danger',
            onOk: async () => {
                try {
                    await unbindCategoryRepos(categoryId, repoIds)
                    message.success('已移除')
                    await refresh()
                } catch {
                    message.error('移除失败')
                }
            },
        })
    }, [categoryId, message, modal, refresh])

    return {
        repos, total, loading, currentPage, pageSize, filters,
        setCurrentPage, setPageSize, setFilters, resetFilters, refresh, handleUnbind,
    }
}
