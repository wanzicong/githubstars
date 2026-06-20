import { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import dayjs from '../../../config/setupDayjs'

export const TIME_PRESETS: { label: string; value: string; days: number }[] = [
    { label: '不限', value: '', days: 0 },
    { label: '今天', value: 'today', days: 0 },
    { label: '7天内', value: '7d', days: 7 },
    { label: '30天内', value: '30d', days: 30 },
    { label: '90天内', value: '90d', days: 90 },
    { label: '半年内', value: '180d', days: 180 },
    { label: '一年内', value: '365d', days: 365 },
]

export function useStarListParams() {
    const [searchParams, setSearchParams] = useSearchParams()

    const keyword = searchParams.get('keyword') || ''
    const languageStr = searchParams.get('languages') || ''
    const selectedLanguages = languageStr ? languageStr.split(',') : []
    const sortBy = searchParams.get('sortBy') || 'stars_count'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const dateField = searchParams.get('dateField') || undefined
    const currentPage = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('size') || '36', 10)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const untranslatedOnly = searchParams.get('untranslatedOnly') === 'true'
    const viewMode = (searchParams.get('view') || 'list') as 'grid' | 'list'
    const timePreset = searchParams.get('timePreset') || ''

    const startDate = useMemo(() => {
        if (!startDateStr) return null
        const parsed = dayjs(startDateStr, 'YYYY-MM-DD', true)
        return parsed.isValid() ? parsed : null
    }, [startDateStr])

    const endDate = useMemo(() => {
        if (!endDateStr) return null
        const parsed = dayjs(endDateStr, 'YYYY-MM-DD', true)
        return parsed.isValid() ? parsed : null
    }, [endDateStr])

    const setUrlParam = useCallback(
        (key: string, value: string | null | undefined, resetPage = true) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (value === undefined || value === null || value === '') next.delete(key)
                else next.set(key, value)
                if (resetPage && key !== 'page') next.delete('page')
                return next
            })
        },
        [setSearchParams],
    )

    const setUrlParams = useCallback(
        (updates: Record<string, string | null | undefined>) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                let shouldReset = false
                for (const [key, value] of Object.entries(updates)) {
                    if (value === undefined || value === null || value === '') next.delete(key)
                    else next.set(key, value)
                    if (key !== 'page') shouldReset = true
                }
                if (shouldReset) next.delete('page')
                return next
            })
        },
        [setSearchParams],
    )

    const clearFilters = useCallback(() => {
        setUrlParams({
            keyword: null, languages: null, timePreset: null,
            sortBy: 'stars_count', sortOrder: 'desc',
            dateField: null, startDate: null, endDate: null, untranslatedOnly: null,
        })
    }, [setUrlParams])

    return {
        keyword, languageStr, selectedLanguages,
        sortBy, sortOrder, dateField, currentPage, pageSize,
        startDateStr, endDateStr, startDate, endDate,
        untranslatedOnly, viewMode, timePreset,
        setUrlParam, setUrlParams, clearFilters,
    }
}
