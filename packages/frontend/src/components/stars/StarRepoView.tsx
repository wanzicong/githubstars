import { useEffect, useRef } from 'react'
import { Card, Empty, Button, Checkbox, Spin, Typography } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import type { GithubRepo } from '../../types'
import RepoCard from './RepoCard'
import RepoRow from './RepoRow'
import { SkeletonCard } from '../common/Skeletons'

const { Text } = Typography

export interface StarRepoViewProps {
    repos: GithubRepo[]
    total: number
    viewMode: 'grid' | 'list'
    loading: boolean             // 首屏加载
    loadingMore: boolean         // 加载下一页
    error: string | null
    hasMore: boolean
    onLoadMore: () => void
    hasActiveFilters: boolean
    onClearFilters: () => void
    /** 多选模式：选中的仓库 ID 列表 */
    selectedIds?: number[]
    /** 多选模式：选中变更回调 */
    onSelectionChange?: (ids: number[]) => void
    /** 跨页全选：全选所有符合条件的仓库 */
    onSelectAllPages?: () => void
    /** 跨页全选：取消所有选择 */
    onDeselectAll?: () => void
    /** 跨页全选：是否正在加载所有 ID */
    loadingAllIds?: boolean
    /** 学习清单状态映射：repoId → learnRecordId（null=加载中） */
    learnMap?: Record<number, number> | null
    /** 加入学习清单回调 */
    onAddLearn?: (repoId: number) => void
}

/**
 * Star 仓库瀑布流视图
 *
 * - viewMode=grid：CSS columns 真瀑布流（列优先填充），列宽自适应
 * - viewMode=list：单列纵向流，与 grid 共享无限滚动
 * - 底部哨兵元素：进入视口 → 触发 onLoadMore
 * - 「全选已加载」勾选当前已加载的所有仓库；「全选所有」走 onSelectAllPages 拉所有 ID
 */
export default function StarRepoView({
    repos,
    total,
    viewMode,
    loading,
    loadingMore,
    error,
    hasMore,
    onLoadMore,
    hasActiveFilters,
    onClearFilters,
    selectedIds,
    onSelectionChange,
    onSelectAllPages,
    onDeselectAll,
    loadingAllIds,
    learnMap,
    onAddLearn,
}: StarRepoViewProps) {
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const selectionEnabled = !!onSelectionChange

    // 无限滚动：监听底部哨兵元素
    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel) return
        const io = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) onLoadMore()
            }
        }, { rootMargin: '200px' })  // 提前 200px 触发，避免到底才开始加载的顿挫
        io.observe(sentinel)
        return () => io.disconnect()
    }, [onLoadMore])

    const toggleSelect = (id: number) => {
        if (!onSelectionChange || !selectedIds) return
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter((i) => i !== id))
        } else {
            onSelectionChange([...selectedIds, id])
        }
    }

    const allLoadedIds = repos.map((r) => r.id)
    const allLoadedSelected = selectionEnabled && allLoadedIds.length > 0 && allLoadedIds.every((id) => selectedIds?.includes(id))
    const allPagesSelected = selectionEnabled && selectedIds && selectedIds.length > 0 && selectedIds.length === total

    const toggleSelectAllLoaded = () => {
        if (!onSelectionChange || !selectedIds) return
        if (allLoadedSelected) {
            onSelectionChange(selectedIds.filter((id) => !allLoadedIds.includes(id)))
        } else {
            onSelectionChange([...new Set([...selectedIds, ...allLoadedIds])])
        }
    }

    // 首屏骨架屏
    if (loading && repos.length === 0) {
        return <SkeletonCard count={viewMode === 'grid' ? 12 : 3} />
    }

    // 空状态
    if (!loading && repos.length === 0) {
        const emptyDescription = total === 0 && !hasActiveFilters ? '暂无仓库数据，请先同步' : '筛选无结果，请尝试调整筛选条件'
        return (
            <Card>
                <Empty description={emptyDescription}>
                    {hasActiveFilters && (
                        <Button type='primary' onClick={onClearFilters}>
                            清除所有筛选
                        </Button>
                    )}
                </Empty>
            </Card>
        )
    }

    return (
        <>
            {selectionEnabled && repos.length > 0 && (
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Checkbox checked={allLoadedSelected} onChange={toggleSelectAllLoaded}>
                        全选已加载 ({repos.length})
                    </Checkbox>
                    {onSelectAllPages && (
                        <Button
                            size="small"
                            type="link"
                            loading={loadingAllIds}
                            onClick={allPagesSelected ? onDeselectAll : onSelectAllPages}
                        >
                            {allPagesSelected ? '取消全选' : `全选所有 (${total})`}
                        </Button>
                    )}
                    {selectedIds && selectedIds.length > 0 && (
                        <span style={{ color: '#1677ff', fontSize: 13 }}>已选 {selectedIds.length} 个</span>
                    )}
                </div>
            )}

            {viewMode === 'list' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {repos.map((repo) => (
                        <div key={repo.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            {selectionEnabled && (
                                <Checkbox
                                    checked={selectedIds?.includes(repo.id)}
                                    onChange={() => toggleSelect(repo.id)}
                                    style={{ marginTop: 12 }}
                                />
                            )}
                            <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                                <RepoRow repo={repo} inLearn={learnMap ? repo.id in learnMap : null} onAddLearn={onAddLearn} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* 真瀑布流：CSS columns 多列布局，列宽自适应、高度自然错落。
                   响应式列数：xs 1列 → sm 2列 → md 3列 → lg 4列 → xl 5列 */
                <div className='star-masonry-grid'>
                    {repos.map((repo) => (
                        <div key={repo.id} className='star-masonry-item'>
                            {selectionEnabled && (
                                <Checkbox
                                    checked={selectedIds?.includes(repo.id)}
                                    onChange={() => toggleSelect(repo.id)}
                                    style={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
                                />
                            )}
                            <RepoCard repo={repo} inLearn={learnMap ? repo.id in learnMap : null} onAddLearn={onAddLearn} />
                        </div>
                    ))}
                </div>
            )}

            {/* 底部哨兵 + 加载状态 */}
            <div ref={sentinelRef} style={{ height: 1, marginTop: 16 }} />
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0', minHeight: 60 }}>
                {loadingMore && (
                    <Spin indicator={<LoadingOutlined spin />} tip='加载中…'>
                        <div style={{ width: 200, height: 20 }} />
                    </Spin>
                )}
                {!loadingMore && error && (
                    <div style={{ textAlign: 'center' }}>
                        <Text type='danger' style={{ display: 'block', marginBottom: 8 }}>{error}</Text>
                        <Button size='small' onClick={onLoadMore}>点击重试</Button>
                    </div>
                )}
                {!loadingMore && !error && !hasMore && repos.length > 0 && (
                    <Text type='secondary'>已加载全部 {total} 个仓库</Text>
                )}
            </div>
        </>
    )
}
