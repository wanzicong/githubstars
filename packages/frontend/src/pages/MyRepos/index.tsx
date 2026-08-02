import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Button, Card, Col, Empty, Row, Skeleton, Space, Statistic, Typography, App, Alert } from 'antd'
import { SyncOutlined, ReloadOutlined } from '@ant-design/icons'
import type { MyRepoStats, MyRepoSyncStatus, LanguageStatsDTO } from '../../types'
import { fetchMyRepoStats, fetchMyRepoSyncStatus, syncMyRepos, fetchAllMyRepoIds } from '../../api/my-repos'
import { usePolling } from '../../hooks/usePolling'
import { useMyRepoList } from './hooks/useMyRepoList'
import MyRepoFilterBar, { type PrivacyFilter } from './components/MyRepoFilterBar'
import MyRepoCard from './components/MyRepoCard'

const { Title, Text } = Typography

/** 我的仓库列表页每页大小 */
const PAGE_SIZE = 24

/**
 * 我的仓库列表页
 *
 * 管理用户在 GitHub 上自己创建的仓库：
 * - 顶部：统计概览 + 同步按钮（同步中轮询状态）
 * - 筛选：关键词 / 语言 / 排序 / 私有公开
 * - 卡片网格：选择框批量选择 + 分类绑定 + 翻译状态
 */
export default function MyRepos() {
    const { message } = App.useApp()
    const location = useLocation()

    // ── 筛选状态 ──
    const [keyword, setKeyword] = useState('')
    const [language, setLanguage] = useState('')
    const [sortBy, setSortBy] = useState('repo_updated_at')
    const [sortOrder, setSortOrder] = useState('desc')
    const [privacy, setPrivacy] = useState<PrivacyFilter>('all')

    const buildFilters = useCallback((): Omit<Parameters<typeof fetchAllMyRepoIds>[0], 'page' | 'size'> => {
        const filters: Record<string, unknown> = {}
        if (keyword.trim()) filters.keyword = keyword.trim()
        if (language) filters.language = language
        if (sortBy) filters.sortBy = sortBy
        if (sortOrder) filters.sortOrder = sortOrder
        if (privacy === 'private') filters.isPrivate = true
        if (privacy === 'public') filters.isPrivate = false
        return filters
    }, [keyword, language, sortBy, sortOrder, privacy])

    const filterKey = [keyword, language, sortBy, sortOrder, privacy].join('|')
    const list = useMyRepoList(filterKey, buildFilters, PAGE_SIZE)
    const { repos, total, loading, loadingMore, error, hasMore, loadMore, reload } = list

    // ── 统计与同步状态 ──
    const [stats, setStats] = useState<MyRepoStats | null>(null)
    const [syncStatus, setSyncStatus] = useState<MyRepoSyncStatus | null>(null)
    const [syncing, setSyncing] = useState(false)

    const loadStats = useCallback(async () => {
        try {
            const data = await fetchMyRepoStats()
            setStats(data)
        } catch { /* 统计加载失败不阻塞列表 */ }
    }, [])

    const loadSyncStatus = useCallback(async () => {
        try {
            const data = await fetchMyRepoSyncStatus()
            setSyncStatus(data)
            setSyncing(data.syncing)
            return data
        } catch {
            return null
        }
    }, [])

    // 首次加载统计 + 同步状态（微任务包裹，避免 effect 内同步 setState 触发级联渲染）
    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (cancelled) return
            await Promise.all([loadStats(), loadSyncStatus()])
        }
        Promise.resolve().then(() => { if (!cancelled) run() })
        return () => { cancelled = true }
    }, [loadStats, loadSyncStatus])

    // 同步中轮询状态，结束后刷新列表与统计
    const syncPolling = usePolling(async ({ stop }) => {
        const data = await loadSyncStatus()
        if (data && !data.syncing) {
            stop()
            reload()
            loadStats()
        }
    }, 2000)

    const handleSync = useCallback(async () => {
        setSyncing(true)
        try {
            const result = await syncMyRepos()
            if (result.success) {
                message.success(result.message || '同步任务已启动')
                syncPolling.start()
            } else {
                message.info(result.message || '已有同步任务在执行中')
                syncPolling.start()
            }
        } catch (e) {
            setSyncing(false)
            const msg = e instanceof Error ? e.message : '同步失败'
            message.error(msg)
        }
    }, [message, syncPolling])

    // 路由返回时刷新（从详情页返回列表）
    const prevPathnameRef = useRef(location.pathname)
    useEffect(() => {
        if (prevPathnameRef.current !== location.pathname) {
            prevPathnameRef.current = location.pathname
            reload()
        }
    }, [location.pathname, reload])

    // ── 语言选项（从统计派生，与后端 getStats 的 languages Top10 对齐）──
    const languageOptions: LanguageStatsDTO[] = useMemo(
        () => (stats?.languages ?? []).map((l) => ({ language: l.language, count: l.count, percentage: 0 })),
        [stats],
    )

    // ── 批量选择 ──
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [loadingAllIds, setLoadingAllIds] = useState(false)

    const handleSelect = useCallback((repoId: number, checked: boolean) => {
        setSelectedIds((prev) => (checked ? [...prev, repoId] : prev.filter((id) => id !== repoId)))
    }, [])

    const handleSelectAllPages = useCallback(async () => {
        setLoadingAllIds(true)
        try {
            const ids = await fetchAllMyRepoIds(buildFilters())
            setSelectedIds(ids)
            message.success(`已选择 ${ids.length} 个仓库`)
        } catch {
            message.error('获取仓库列表失败')
        } finally {
            setLoadingAllIds(false)
        }
    }, [buildFilters, message])

    const handleDeselectAll = useCallback(() => setSelectedIds([]), [])

    // 分类绑定变化后刷新（让卡片上的分类数更新）
    const handleCategoryChange = useCallback(() => reload(), [reload])

    const hasActiveFilters = keyword.trim() !== '' || language !== '' || privacy !== 'all'

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
                <Title level={3} style={{ margin: 0 }}>
                    我的仓库
                </Title>
                <Space>
                    {syncStatus?.lastSuccessTime && (
                        <Text type='secondary' style={{ fontSize: 12 }}>
                            上次同步 {syncStatus.lastSuccessCount} 个
                        </Text>
                    )}
                    <Button
                        type='primary'
                        icon={syncing ? <SyncOutlined spin /> : <ReloadOutlined />}
                        loading={syncing}
                        onClick={handleSync}
                    >
                        {syncing ? '同步中…' : '同步我的仓库'}
                    </Button>
                </Space>
            </div>

            {/* 统计概览 */}
            <Card style={{ marginBottom: 20 }}>
                <Skeleton loading={!stats} active paragraph={{ rows: 1 }}>
                    <Space size={48} wrap>
                        <Statistic title='仓库总数' value={stats?.total ?? 0} />
                        <Statistic title='私有仓库' value={stats?.privateCount ?? 0} />
                        <Statistic title='总 Star' value={stats?.totalStars ?? 0} />
                        <Statistic title='总 Fork' value={stats?.totalForks ?? 0} />
                    </Space>
                </Skeleton>
            </Card>

            {/* 筛选栏 */}
            <Card style={{ marginBottom: 20 }}>
                <MyRepoFilterBar
                    keyword={keyword}
                    language={language}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    privacy={privacy}
                    languageOptions={languageOptions}
                    onKeywordChange={setKeyword}
                    onLanguageChange={setLanguage}
                    onSortByChange={setSortBy}
                    onSortOrderChange={setSortOrder}
                    onPrivacyChange={setPrivacy}
                />
            </Card>

            {/* 批量操作条（选中时显示） */}
            {selectedIds.length > 0 && (
                <Alert
                    type='info'
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={`已选择 ${selectedIds.length} 个仓库`}
                    description={
                        <Space>
                            <Button size='small' onClick={handleDeselectAll}>取消选择</Button>
                            <Button size='small' loading={loadingAllIds} onClick={handleSelectAllPages}>
                                选择全部 {total} 个
                            </Button>
                        </Space>
                    }
                />
            )}

            {/* 错误态 */}
            {error && !loading && (
                <Alert
                    type='error'
                    showIcon
                    style={{ marginBottom: 16 }}
                    message='加载失败'
                    description={error}
                    action={<Button size='small' onClick={reload}>重试</Button>}
                />
            )}

            {/* 卡片网格 */}
            <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                {repos.length === 0 && !error ? (
                    <Empty
                        description={hasActiveFilters ? '没有匹配的仓库，试试调整筛选条件' : '还没有同步我的仓库，点击右上角「同步我的仓库」开始'}
                        style={{ padding: '60px 0' }}
                    />
                ) : (
                    <>
                        <Row gutter={[16, 16]}>
                            {repos.map((repo) => (
                                <Col key={repo.id} xs={24} sm={12} lg={8} xl={6} style={{ overflow: 'hidden' }}>
                                    <MyRepoCard
                                        repo={repo}
                                        selected={selectedIds.includes(repo.id)}
                                        onSelect={handleSelect}
                                        onCategoryChange={handleCategoryChange}
                                    />
                                </Col>
                            ))}
                        </Row>
                        {hasMore && (
                            <div style={{ textAlign: 'center', marginTop: 24 }}>
                                <Button loading={loadingMore} onClick={loadMore}>
                                    加载更多（{repos.length}/{total}）
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Skeleton>
        </div>
    )
}
