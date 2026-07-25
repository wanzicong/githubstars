import { useState, useEffect, useCallback, useRef } from 'react'
import { App } from 'antd'
import type { LearnListParams, LearnRecord } from '../../../types'
import { fetchLearnList } from '../../../api'

/** 合并去重（参考 useStarListInfinite 模式） */
function mergeUnique(prev: LearnRecord[], newRecords: LearnRecord[]): LearnRecord[] {
    const existing = new Set(prev.map((r) => r.id))
    const fresh = newRecords.filter((r) => !existing.has(r.id))
    return [...prev, ...fresh]
}

export interface UseLearnListReturn {
    records: LearnRecord[]
    total: number
    loading: boolean
    loadingMore: boolean
    error: string | null
    hasMore: boolean
    loadMore: () => void
    reload: () => void
}

/**
 * 学习清单无限滚动 hook
 *
 * 与 useStarListInfinite 完全同构：
 * - filterKey 变化 → 重置加载第一页
 * - loadMore 累加下一页
 * - reload 信号触发强制刷新
 */
export function useLearnList(
    filterKey: string,
    buildParams: () => Omit<LearnListParams, 'page' | 'size'>,
    pageSize: number,
): UseLearnListReturn {
    const { message } = App.useApp()
    const [records, setRecords] = useState<LearnRecord[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const pageRef = useRef(1)
    const [hasMore, setHasMore] = useState(true)
    const inFlightRef = useRef(false)
    const [reloadSignal, setReloadSignal] = useState(0)

    useEffect(() => {
        let cancelled = false
        const loadFirstPage = async () => {
            setLoading(true)
            setError(null)
            pageRef.current = 1
            setHasMore(true)
            try {
                const result = await fetchLearnList({ page: 1, size: pageSize, ...buildParams() })
                if (cancelled) return
                setRecords(result.records)
                setTotal(result.total)
                pageRef.current = 2
                setHasMore(result.records.length < result.total && result.records.length === pageSize)
            } catch (e) {
                if (cancelled) return
                const msg = e instanceof Error ? e.message : '加载失败'
                setError(msg)
                message.error('加载学习清单失败')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        loadFirstPage()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey, reloadSignal, pageSize, message])

    const loadMore = useCallback(() => {
        if (inFlightRef.current || loading || loadingMore || !hasMore) return
        inFlightRef.current = true
        setLoadingMore(true)
        setError(null)
        const doLoad = async () => {
            try {
                const result = await fetchLearnList({ page: pageRef.current, size: pageSize, ...buildParams() })
                setRecords((prev) => mergeUnique(prev, result.records))
                setTotal(result.total)
                pageRef.current += 1
                const loaded = (pageRef.current - 1) * pageSize
                setHasMore(loaded < result.total && result.records.length > 0)
            } catch (e) {
                const msg = e instanceof Error ? e.message : '加载失败'
                setError(msg)
            } finally {
                setLoadingMore(false)
                inFlightRef.current = false
            }
        }
        doLoad().catch(() => {})
    }, [loading, loadingMore, hasMore, pageSize]) // eslint-disable-line react-hooks/exhaustive-deps

    const reload = useCallback(() => {
        setReloadSignal((s) => s + 1)
    }, [])

    return { records, total, loading, loadingMore, error, hasMore, loadMore, reload }
}
