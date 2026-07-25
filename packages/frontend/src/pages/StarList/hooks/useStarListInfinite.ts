import { useState, useEffect, useCallback, useRef } from 'react'
import { App } from 'antd'
import type { GithubRepo, StarListParams } from '../../../types'
import { fetchStarList } from '../../../api'

/** 合并去重：把 newRecords 中 id 不在 prev 的项追加到 prev 末尾 */
function mergeUnique(prev: GithubRepo[], newRecords: GithubRepo[]): GithubRepo[] {
    const existing = new Set(prev.map((r) => r.id))
    const fresh = newRecords.filter((r) => !existing.has(r.id))
    return [...prev, ...fresh]
}

/**
 * StarList 瀑布流无限滚动 hook
 *
 * 职责：
 * - 管理累积的 repos 数组（多页拼接）
 * - 内部维护当前 page，不暴露给 URL
 * - 筛选参数变化（filterKey 变化）时自动清空重新加载第 1 页
 * - 提供 loadMore 加载下一页 / reload 重新加载
 *
 * @param filterKey 筛选参数序列化字符串，变化时触发重置
 * @param buildParams 构造第 N 页请求参数（除 page 外）
 * @param pageSize 每页大小
 */
export interface UseStarListInfiniteReturn {
    repos: GithubRepo[]
    total: number
    loading: boolean          // 首屏加载中
    loadingMore: boolean      // 加载下一页中
    error: string | null      // 最近一次加载错误（首屏或翻页）
    hasMore: boolean          // 是否还有更多
    loadMore: () => void      // 加载下一页（自动 guard）
    reload: () => void        // 清空重新加载第 1 页
}

export function useStarListInfinite(
    filterKey: string,
    buildParams: () => Omit<StarListParams, 'page' | 'size'>,
    pageSize: number,
): UseStarListInfiniteReturn {
    const { message } = App.useApp()
    const [repos, setRepos] = useState<GithubRepo[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // 内部 page：下次要加载的页码（从 1 开始）
    const pageRef = useRef(1)
    // 是否还有下一页（首次默认 true 等首次响应后校正）
    const [hasMore, setHasMore] = useState(true)
    // 防止并发 loadMore
    const inFlightRef = useRef(false)
    // reload 信号：变化时强制重新加载（filterKey 之外的主动刷新通道）
    const [reloadSignal, setReloadSignal] = useState(0)

    // 首屏加载 + filterKey/reloadSignal 变化时重置
    useEffect(() => {
        let cancelled = false
        const loadFirstPage = async () => {
            setLoading(true)
            setError(null)
            pageRef.current = 1
            setHasMore(true)
            try {
                const result = await fetchStarList({ page: 1, size: pageSize, ...buildParams() })
                if (cancelled) return
                setRepos(result.records)
                setTotal(result.total)
                pageRef.current = 2
                setHasMore(result.records.length < result.total && result.records.length === pageSize)
            } catch (e) {
                if (cancelled) return
                const msg = e instanceof Error ? e.message : '加载失败'
                setError(msg)
                message.error('加载列表失败')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        loadFirstPage()
        return () => { cancelled = true }
        // buildParams 用 ref 形式传入避免依赖告警（filterKey 已涵盖所有筛选条件）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey, reloadSignal, pageSize, message])

    const loadMore = useCallback(() => {
        if (inFlightRef.current || loading || loadingMore || !hasMore) return
        inFlightRef.current = true
        setLoadingMore(true)
        setError(null)
        const doLoad = async () => {
            try {
                const result = await fetchStarList({ page: pageRef.current, size: pageSize, ...buildParams() })
                // 去重合并：极端场景（翻页期间数据变化）可能出现重复 id
                setRepos((prev) => mergeUnique(prev, result.records))
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

    return { repos, total, loading, loadingMore, error, hasMore, loadMore, reload }
}
