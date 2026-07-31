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

/** 时间字段选项（主行预设与高级筛选共用） */
export const DATE_FIELD_OPTIONS = [
    { label: 'Star 时间', value: 'starred_at' },
    { label: '创建时间', value: 'repo_created_at' },
    { label: '更新时间', value: 'repo_updated_at' },
    { label: '推送时间', value: 'repo_pushed_at' },
]

/** 排序合并选项：value 编码为 `sortBy:sortOrder`，选中后拆回两个 URL 参数 */
export const SORT_COMBO_OPTIONS = [
    { label: 'Star 最多', value: 'stars_count:desc' },
    { label: 'Star 最少', value: 'stars_count:asc' },
    { label: '最近 Star', value: 'starred_at:desc' },
    { label: '最早 Star', value: 'starred_at:asc' },
    { label: '最近更新', value: 'repo_updated_at:desc' },
    { label: '最早更新', value: 'repo_updated_at:asc' },
    { label: '最近推送', value: 'repo_pushed_at:desc' },
    { label: 'Fork 最多', value: 'forks_count:desc' },
    { label: '仓库最大', value: 'repo_size:desc' },
    { label: '创建最新', value: 'repo_created_at:desc' },
    { label: '创建最早', value: 'repo_created_at:asc' },
]

/** 从 sortBy/sortOrder 合成排序选中值；无匹配组合时回退默认（Star 最多） */
export function sortComboFromParams(sortBy: string, sortOrder: string): string {
    const combo = `${sortBy}:${sortOrder}`
    return SORT_COMBO_OPTIONS.some((o) => o.value === combo) ? combo : SORT_COMBO_OPTIONS[0].value
}

/** 拆解排序合并值；异常输入回退默认组合 */
export function parseSortCombo(combo: string): { sortBy: string; sortOrder: string } {
    const matched = SORT_COMBO_OPTIONS.find((o) => o.value === combo)
    const value = matched?.value ?? SORT_COMBO_OPTIONS[0].value
    const sepIndex = value.lastIndexOf(':')
    return { sortBy: value.slice(0, sepIndex), sortOrder: value.slice(sepIndex + 1) }
}

export function useStarListParams() {
    const [searchParams, setSearchParams] = useSearchParams()

    const keyword = searchParams.get('keyword') || ''
    const languageStr = searchParams.get('languages') || ''
    const selectedLanguages = languageStr ? languageStr.split(',') : []
    const sortBy = searchParams.get('sortBy') || 'stars_count'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const dateField = searchParams.get('dateField') || undefined
    // 瀑布流模式：page 不再写入 URL，由组件内部 state 维护
    const pageSize = Number.parseInt(searchParams.get('size') || '20', 10)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    // 分类筛选（字符串 → number | null）
    const categoryIdStr = searchParams.get('categoryId')
    const categoryId = categoryIdStr ? Number.parseInt(categoryIdStr, 10) : null
    // 默认 grid 瀑布流（项目主视图）
    const viewMode = (searchParams.get('view') || 'grid') as 'grid' | 'list'
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
            keyword: null, languages: null, timePreset: null,
            sortBy: 'stars_count', sortOrder: 'desc',
            dateField: null, startDate: null, endDate: null, categoryId: null,
        })
    }, [setUrlParams])

    return {
        keyword, languageStr, selectedLanguages,
        sortBy, sortOrder, dateField, pageSize,
        startDateStr, endDateStr, startDate, endDate,
        categoryId,
        viewMode, timePreset,
        setUrlParam, setUrlParams, clearFilters,
    }
}
