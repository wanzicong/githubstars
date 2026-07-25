import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Card, Empty, Modal, Skeleton, Space, Spin, Tabs, Tag } from 'antd'
import { ClearOutlined, PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { LearnRecord, LearnStatus } from '../../types'
import { deleteLearnRecord, fetchLearnStats } from '../../api'
import { useLearnList } from './hooks/useLearnList'
import { useLearnParams } from './hooks/useLearnParams'
import LearnFilterBar from './components/LearnFilterBar'
import LearnRepoCard from './components/LearnRepoCard'
import LearnEditModal from './components/LearnEditModal'
import LearnTagManageModal from './components/LearnTagManageModal'

type StatusTabKey = LearnStatus | 'ALL'

/**
 * 学习清单页面
 *
 * 布局：
 * - 顶部：状态 Tab（带计数，含「全部」）
 * - 中间：筛选栏（关键词/优先级/分类/标签/排序）
 * - 底部：瀑布流卡片 + 无限滚动
 *
 * 操作：
 * - 卡片「编辑」→ LearnEditModal
 * - 卡片「删除」→ Popconfirm 后调 delete API
 * - 顶部「管理标签」→ LearnTagManageModal
 */
export default function LearnPage() {
    const { message } = App.useApp()
    const navigate = useNavigate()
    const params = useLearnParams()

    const [stats, setStats] = useState<Record<StatusTabKey, number>>({ WANT: 0, LEARNING: 0, DONE: 0, SHELVED: 0, ALL: 0 })
    const [editingRecord, setEditingRecord] = useState<LearnRecord | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [tagManageOpen, setTagManageOpen] = useState(false)
    const [statsReload, setStatsReload] = useState(0)

    const activeStatus: StatusTabKey = (params.status || 'ALL') as StatusTabKey

    const buildFilters = useCallback(
        () => ({
            status: params.status || undefined,
            priority: params.priority || undefined,
            categoryId: params.categoryId ?? undefined,
            tagIds: params.tagIds.length > 0 ? params.tagIds : undefined,
            keyword: params.keyword || undefined,
            sortBy: params.sortBy as 'createdAt' | 'updatedAt' | 'priority' | 'starsCount' | 'starredAt',
            sortOrder: params.sortOrder,
        }),
        [params.status, params.priority, params.categoryId, params.tagIds, params.keyword, params.sortBy, params.sortOrder],
    )

    const filterKey = useMemo(
        () =>
            [
                params.status,
                params.priority,
                params.categoryId,
                params.tagIds.join(','),
                params.keyword,
                params.sortBy,
                params.sortOrder,
            ]
                .map((v) => v ?? '')
                .join('|'),
        [params.status, params.priority, params.categoryId, params.tagIds, params.keyword, params.sortBy, params.sortOrder],
    )

    const list = useLearnList(filterKey, buildFilters, params.pageSize)

    // 加载统计
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const s = await fetchLearnStats()
                if (!cancelled) setStats(s)
            } catch {
                /* stats 失败不阻塞页面 */
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [statsReload])

    // 无限滚动哨兵
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const loadMoreRef = useRef(list.loadMore)
    useEffect(() => {
        loadMoreRef.current = list.loadMore
    }, [list.loadMore])
    useEffect(() => {
        const el = sentinelRef.current
        if (!el) return
        const ob = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) loadMoreRef.current()
                }
            },
            { rootMargin: '200px' },
        )
        ob.observe(el)
        return () => ob.disconnect()
    }, [])

    const refreshAll = useCallback(() => {
        list.reload()
        setStatsReload((s) => s + 1)
    }, [list])

    const handleEdit = useCallback((record: LearnRecord) => {
        setEditingRecord(record)
        setEditOpen(true)
    }, [])

    const handleDelete = useCallback(
        (record: LearnRecord) => {
            Modal.confirm({
                title: '确认移出学习清单？',
                content: `仓库「${record.repo.repoName ?? record.repo.fullName}」的学习记录与笔记将被删除`,
                okText: '删除',
                okButtonProps: { danger: true },
                cancelText: '取消',
                onOk: async () => {
                    try {
                        await deleteLearnRecord(record.id)
                        message.success('已移出学习清单')
                        refreshAll()
                    } catch (e) {
                        message.error(e instanceof Error ? e.message : '删除失败')
                    }
                },
            })
        },
        [message, refreshAll],
    )

    const hasActiveFilters =
        !!params.keyword ||
        !!params.priority ||
        params.categoryId !== null ||
        params.tagIds.length > 0 ||
        params.sortBy !== 'createdAt' ||
        params.sortOrder !== 'desc'

    const tabItems = (['ALL', 'WANT', 'LEARNING', 'DONE', 'SHELVED'] as StatusTabKey[]).map((key) => ({
        key,
        label: (
            <Space size={4}>
                {key === 'ALL' ? '全部' : { WANT: '想学', LEARNING: '在学', DONE: '已学完', SHELVED: '搁置' }[key]}
                <Tag style={{ marginInlineStart: 4 }}>{stats[key] ?? 0}</Tag>
            </Space>
        ),
    }))

    // 空态文案：避免嵌套三元
    let emptyDescription: string
    if (hasActiveFilters) {
        emptyDescription = '没有符合条件的学习记录，试试清除筛选'
    } else if (activeStatus === 'ALL') {
        emptyDescription = '学习清单还是空的，去 Star 列表加几个项目进来吧'
    } else {
        emptyDescription = '当前状态下没有记录'
    }

    // 主体渲染：loading → skeleton；空 → Empty；否则瀑布流
    let mainContent: React.ReactNode
    if (list.loading) {
        mainContent = <Skeleton active paragraph={{ rows: 6 }} />
    } else if (list.records.length === 0) {
        mainContent = (
            <Empty description={emptyDescription} style={{ padding: '48px 0' }}>
                <Button type='primary' onClick={() => navigate('/')}>
                    去 Star 列表
                </Button>
            </Empty>
        )
    } else {
        mainContent = (
            <>
                <div className='star-masonry-grid'>
                    {list.records.map((record) => (
                        <div key={record.id} className='star-masonry-item'>
                            <LearnRepoCard record={record} onEdit={handleEdit} onDelete={handleDelete} />
                        </div>
                    ))}
                </div>

                <div ref={sentinelRef} style={{ height: 1, marginTop: 16 }} />

                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    {list.loadingMore && <Spin tip='加载中...' />}
                    {!list.loadingMore && !list.hasMore && list.records.length > 0 && (
                        <span style={{ color: 'var(--ant-color-text-tertiary, #999)' }}>
                            已加载全部 {list.total} 个学习记录
                        </span>
                    )}
                    {list.error && (
                        <Space>
                            <span style={{ color: 'var(--ant-color-error, #ff4d4f)' }}>{list.error}</span>
                            <Button size='small' onClick={list.loadMore}>
                                重试
                            </Button>
                        </Space>
                    )}
                </div>
            </>
        )
    }

    return (
        <div style={{ padding: 24 }}>
            <Card
                title='学习清单'
                extra={
                    <Space>
                        <Button icon={<SettingOutlined />} onClick={() => setTagManageOpen(true)}>
                            管理标签
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={refreshAll}>
                            刷新
                        </Button>
                        <Button type='primary' icon={<PlusOutlined />} onClick={() => navigate('/')}>
                            去 Star 列表添加
                        </Button>
                    </Space>
                }
            >
                <Tabs
                    activeKey={activeStatus}
                    onChange={(key) => params.setUrlParam('status', key === 'ALL' ? null : key)}
                    items={tabItems}
                    style={{ marginBottom: 8 }}
                />

                <LearnFilterBar
                    keyword={params.keyword}
                    priority={params.priority}
                    categoryId={params.categoryId}
                    tagIds={params.tagIds}
                    sortBy={params.sortBy}
                    sortOrder={params.sortOrder}
                    onParamChange={params.setUrlParam}
                />

                {hasActiveFilters && (
                    <Button
                        type='link'
                        size='small'
                        icon={<ClearOutlined />}
                        onClick={params.clearFilters}
                        style={{ padding: 0, marginTop: 8 }}
                    >
                        清除筛选
                    </Button>
                )}
            </Card>

            <div style={{ marginTop: 16 }}>{mainContent}</div>

            <LearnEditModal
                record={editingRecord}
                open={editOpen}
                onClose={() => {
                    setEditOpen(false)
                    setEditingRecord(null)
                }}
                onSaved={refreshAll}
            />

            <LearnTagManageModal
                open={tagManageOpen}
                onClose={() => setTagManageOpen(false)}
                onChanged={refreshAll}
            />
        </div>
    )
}
