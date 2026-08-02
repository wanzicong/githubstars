import { useState, useEffect, useCallback, useRef } from 'react'
import { App } from 'antd'
import type { MyRepo, MyRepoListParams } from '../../../types'
import { fetchMyRepoList } from '../../../api/my-repos'

/** 合并去重：把 newRecords 中 id 不在 prev 的项追加到 prev 末尾 */
function mergeUnique(prev: MyRepo[], newRecords: MyRepo[]): MyRepo[] {
    const existing = new Set(prev.map((r) => r.id))
    const fresh = newRecords.filter((r) => !existing.has(r.id))
    return [...prev, ...fresh]
}

export interface UseMyRepoListReturn {
    repos: MyRepo[]
    total: number
    loading: boolean          // 首屏加载中
    loadingMore: boolean      // 加载下一页中
    error: string | null      // 最近一次加载错误
    hasMore: boolean          // 是否还有更多
    loadMore: () => void      // 加载下一页（自动 guard）
    reload: () => void        // 清空重新加载第 1 页
}

/**
 * 我的仓库列表加载 hook（与 StarList 瀑布流同构）
 *
 * - 内部维护 page，筛选参数变化（filterKey 变化）时自动清空重新加载第 1 页
 * - 提供 loadMore 加载下一页 / reload 重新加载
 *
 * @param filterKey 筛选参数序列化字符串，变化时触发重置
 * @param buildParams 构造请求参数（除 page/size 外）
 * @param pageSize 每页大小
 */
export function useMyRepoList(
    filterKey: string,
    buildParams: () => Omit<MyRepoListParams, 'page' | 'size'>,
    pageSize: number,
): UseMyRepoListReturn {
    const { message } = App.useApp()
    const [repos, setRepos] = useState<MyRepo[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const pageRef = useRef(1)
    const [hasMore, setHasMore] = useState(true)
    const inFlightRef = useRef(false)
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
                const result = await fetchMyRepoList({ page: 1, size: pageSize, ...buildParams() })
                if (cancelled) return
                setRepos(result.records)
                setTotal(result.total)
                pageRef.current = 2
                setHasMore(result.records.length < result.total && result.records.length === pageSize)
            } catch (e) {
                if (cancelled) return
                const msg = e instanceof Error ? e.message : '加载失败'
                setError(msg)
                message.error('加载我的仓库列表失败')
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
                const result = await fetchMyRepoList({ page: pageRef.current, size: pageSize, ...buildParams() })
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
