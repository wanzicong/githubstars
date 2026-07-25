import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { LearnPriority, LearnStatus } from '../../../types'

/**
 * Learn 页面 URL 参数同步
 *
 * 维度：status / priority / categoryId / tagIds / keyword / sortBy / sortOrder
 */
export function useLearnParams() {
    const [searchParams, setSearchParams] = useSearchParams()

    const status = (searchParams.get('status') || '') as LearnStatus | ''
    const priority = (searchParams.get('priority') || '') as LearnPriority | ''
    const categoryIdStr = searchParams.get('categoryId')
    const categoryId = categoryIdStr ? Number.parseInt(categoryIdStr, 10) : null
    const tagIdsStr = searchParams.get('tagIds') || ''
    const tagIds = tagIdsStr ? tagIdsStr.split(',').map((s) => Number.parseInt(s, 10)).filter((n) => !Number.isNaN(n)) : []
    const keyword = searchParams.get('keyword') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
    const pageSize = Number.parseInt(searchParams.get('size') || '20', 10)

    const setUrlParam = useCallback(
        (key: string, value: string | null | undefined) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (value === undefined || value === null || value === '') next.delete(key)
                else next.set(key, value)
                return next
            })
        },
        [setSearchParams],
    )

    const setUrlParams = useCallback(
        (updates: Record<string, string | null | undefined>) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                for (const [key, value] of Object.entries(updates)) {
                    if (value === undefined || value === null || value === '') next.delete(key)
                    else next.set(key, value)
                }
                return next
            })
        },
        [setSearchParams],
    )

    const clearFilters = useCallback(() => {
        setUrlParams({
            status: null,
            priority: null,
            categoryId: null,
            tagIds: null,
            keyword: null,
            sortBy: 'createdAt',
            sortOrder: 'desc',
        })
    }, [setUrlParams])

    return {
        status,
        priority,
        categoryId,
        tagIds,
        keyword,
        sortBy,
        sortOrder,
        pageSize,
        setUrlParam,
        setUrlParams,
        clearFilters,
    }
}
