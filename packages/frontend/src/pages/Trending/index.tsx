import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Segmented, Select, Spin, Empty, Typography, Tag, Space, Button, App, Modal, Input, theme } from 'antd'
import { StarFilled, StarOutlined, ForkOutlined, FireOutlined, DownloadOutlined, CodeOutlined, GithubOutlined } from '@ant-design/icons'
import { fetchTrending, downloadTrending, starRepo, checkStarred } from '../../api'
import {
    getDownloadTaskProgress,
    getRecentDownloadDirectories,
    retryDownloadFailed,
    retryDownloadItem,
    deleteDownloadTask,
    extractDownloadItem,
    deleteDownloadItemFile,
    type DownloadTaskProgress,
} from '../../api/download'
import type { GithubSearchRepo } from '../../types'
import { LANGUAGE_OPTIONS, RANK_BADGE_COLORS } from '../../constants'
import { formatNumberShort, getRelativeTime, parseFullName } from '../../utils/format'
import DownloadProgressModal from '../../components/download/DownloadProgressModal'
import CodePreviewDrawer from '../../components/repo/CodePreviewDrawer'

const { Title, Text } = Typography

const SINCE_VALUES = ['daily', 'weekly', 'monthly'] as const

export default function Trending() {
    const { message } = App.useApp()
    const { token } = theme.useToken()
    const navigate = useNavigate()
    // 筛选条件存 URL 参数 — 进入详情再返回时保持所选时间段/语言不丢失
    const [searchParams, setSearchParams] = useSearchParams()
    const sinceParam = searchParams.get('since') ?? ''
    const since = (SINCE_VALUES as readonly string[]).includes(sinceParam) ? sinceParam : 'daily'
    const language = searchParams.get('language') ?? ''

    const setSince = useCallback((value: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            if (value === 'daily') next.delete('since')
            else next.set('since', value)
            return next
        })
    }, [setSearchParams])

    const setLanguage = useCallback((value: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            if (value) next.set('language', value)
            else next.delete('language')
            return next
        })
    }, [setSearchParams])

    const [repos, setRepos] = useState<GithubSearchRepo[]>([])
    const [total, setTotal] = useState(0)
    const [dateRange, setDateRange] = useState('')
    const [loading, setLoading] = useState(false)
    const [previewRepo, setPreviewRepo] = useState<string | null>(null)
    // 已 Star 的仓库 fullName 集合（悬停卡片时探测，Star 成功后写入）
    const [starredMap, setStarredMap] = useState<Record<string, boolean>>({})

    // ── 下载相关状态 ──
    const [downloadConfigOpen, setDownloadConfigOpen] = useState(false)
    const [downloadProgressOpen, setDownloadProgressOpen] = useState(false)
    const [downloadTaskId, setDownloadTaskId] = useState<number | null>(null)
    const [downloadProgress, setDownloadProgress] = useState<DownloadTaskProgress | null>(null)
    const [downloading, setDownloading] = useState(false)
    const downloadTaskIdRef = useRef<number | null>(null)
    const [configTargetDir, setConfigTargetDir] = useState('')
    const [configConcurrency, setConfigConcurrency] = useState<number>(3)
    const [configMirrorSources, setConfigMirrorSources] = useState<string[]>(['direct'])
    const [configDirs, setConfigDirs] = useState<string[]>([])

    // ── 下载轮询 ──
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const startPolling = useCallback(() => {
        if (pollingRef.current) clearInterval(pollingRef.current)
        pollingRef.current = setInterval(async () => {
            const taskId = downloadTaskIdRef.current
            if (!taskId) {
                if (pollingRef.current) clearInterval(pollingRef.current)
                return
            }
            try {
                const res = await getDownloadTaskProgress(taskId)
                if (res.success) {
                    setDownloadProgress(res)
                    if (res.status === 'COMPLETED' || res.status === 'FAILED' || res.status === 'PARTIAL') {
                        if (pollingRef.current) clearInterval(pollingRef.current)
                    }
                }
            } catch {
                // 轮询失败不中断
            }
        }, 2000)
    }, [])

    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current)
        }
    }, [])

    useEffect(() => {
        const doLoad = async () => {
            setLoading(true)
            try {
                const data = await fetchTrending(since, language || undefined, 20)
                setRepos(data.repos || [])
                setTotal(data.total || 0)
                setDateRange(data.dateRange || '')
            } catch {
                message.error('加载趋势数据失败')
            } finally {
                setLoading(false)
            }
        }
        void doLoad()
    }, [since, language, message])

    /** 悬停仓库卡片时探测是否已 Star（失败静默忽略） */
    const handleCheckStar = useCallback(async (repo: GithubSearchRepo) => {
        const fullName = repo.fullName
        const [owner, repoName] = parseFullName(fullName)
        try {
            const data = await checkStarred(owner, repoName)
            if (data.success && data.starred) {
                setStarredMap((prev) => ({ ...prev, [fullName]: true }))
            }
        } catch {
            // 探测失败不阻断交互
        }
    }, [])

    /** 点击 Star 按钮 — 后端 star 接口是幂等的，成功后标记已 Star */
    const handleStar = useCallback(async (repo: GithubSearchRepo) => {
        const fullName = repo.fullName
        const [owner, repoName] = parseFullName(fullName)
        try {
            const data = await starRepo(owner, repoName)
            if (data.success && data.starred) {
                setStarredMap((prev) => ({ ...prev, [fullName]: true }))
                message.success(`已 Star ${fullName}`)
            } else if (data.success) {
                message.info(data.message || '操作完成')
            } else {
                message.error(data.message || 'Star 失败')
            }
        } catch {
            message.error('Star 操作失败，请检查网络或 GitHub Token 配置')
        }
    }, [message])

    /** 打开下载配置弹窗 */
    const handleOpenDownloadConfig = useCallback(async () => {
        try {
            const dirs = await getRecentDownloadDirectories()
            setConfigDirs(dirs.directories || [])
            if (dirs.directories?.length > 0) {
                setConfigTargetDir(dirs.directories[0])
            }
        } catch {
            // 获取目录失败不影响使用
        }
        setDownloadConfigOpen(true)
    }, [])

    /** 确认下载趋势仓库 */
    const handleConfirmDownload = useCallback(async () => {
        if (!configTargetDir.trim()) {
            message.error('请输入目标下载目录')
            return
        }
        setDownloading(true)
        try {
            const result = await downloadTrending({
                since,
                language: language || undefined,
                perPage: 20,
                targetDir: configTargetDir.trim(),
                concurrency: configConcurrency,
                mirrorSources: configMirrorSources,
                extractArchive: true,
                deleteAfterExtract: true,
            })
            if (result.success && result.taskId) {
                setDownloadConfigOpen(false)
                downloadTaskIdRef.current = result.taskId
                setDownloadTaskId(result.taskId)
                setDownloadProgressOpen(true)
                setDownloadProgress(null)
                message.success(result.message || '下载任务已创建')
                startPolling()
            } else {
                message.error(result.message || '创建下载任务失败')
            }
        } catch {
            message.error('创建下载任务失败')
        } finally {
            setDownloading(false)
        }
    }, [since, language, configTargetDir, configConcurrency, configMirrorSources, startPolling, message])

    /** 下载重试/操作回调 */
    const handleRetryDownloadFailed = useCallback(async () => {
        if (!downloadTaskId) return
        try {
            const result = await retryDownloadFailed(downloadTaskId)
            if (result.success) {
                downloadTaskIdRef.current = downloadTaskId
                startPolling()
            }
        } catch {
            message.error('重置任务失败')
        }
    }, [downloadTaskId, startPolling, message])

    const handleRetryDownloadItem = useCallback(async (fullName: string) => {
        if (!downloadTaskId) return
        try {
            await retryDownloadItem(downloadTaskId, fullName)
            const progress = await getDownloadTaskProgress(downloadTaskId)
            if (progress.success) setDownloadProgress(progress)
        } catch {
            message.error('重试失败')
        }
    }, [downloadTaskId, message])

    const handleDeleteDownloadTask = useCallback(async () => {
        if (!downloadTaskId) return
        try {
            await deleteDownloadTask(downloadTaskId)
            if (pollingRef.current) clearInterval(pollingRef.current)
            setDownloadProgressOpen(false)
        } catch {
            message.error('删除任务失败')
        }
    }, [downloadTaskId, message])

    const handleExtractDownloadItem = useCallback(async (fullName: string) => {
        if (!downloadTaskId) return
        try {
            const result = await extractDownloadItem(downloadTaskId, fullName)
            if (result.success) {
                message.success('解压成功')
                const progress = await getDownloadTaskProgress(downloadTaskId)
                if (progress.success) setDownloadProgress(progress)
            } else {
                message.error(result.message || '解压失败')
            }
        } catch {
            message.error('解压失败')
        }
    }, [downloadTaskId, message])

    const handleDeleteDownloadItem = useCallback(async (fullName: string) => {
        if (!downloadTaskId) return
        try {
            await deleteDownloadItemFile(downloadTaskId, fullName)
            const progress = await getDownloadTaskProgress(downloadTaskId)
            if (progress.success) setDownloadProgress(progress)
        } catch {
            message.error('删除失败')
        }
    }, [downloadTaskId, message])

    // 最大 Star 数（用于横条宽度计算）
    const maxStars = repos.length > 0 ? Math.max(...repos.map((r) => r.starsCount || 1)) : 1

    return (
        <div>
            <div
                style={{
                    marginBottom: 24,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <Title level={3} style={{ margin: 0 }}>
                    <FireOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                    趋势排行榜
                </Title>
                <Space wrap size={[8, 8]}>
                    {repos.length > 0 && (
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={handleOpenDownloadConfig}
                            size='small'
                        >
                            下载趋势
                        </Button>
                    )}
                    <Select
                        value={language || ''}
                        onChange={(v) => setLanguage(v)}
                        options={LANGUAGE_OPTIONS}
                        style={{ width: 140 }}
                        placeholder='语言'
                    />
                    <Segmented
                        value={since}
                        onChange={(v) => setSince(v as string)}
                        options={[
                            { value: 'daily', label: '今日' },
                            { value: 'weekly', label: '本周' },
                            { value: 'monthly', label: '本月' },
                        ]}
                    />
                </Space>
            </div>

            <Spin spinning={loading}>
                {dateRange && (
                    <Text type='secondary' style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
                        统计时段: {dateRange} | 共 {total} 个新仓库
                    </Text>
                )}

                {repos.length === 0 && !loading ? (
                    <Empty description='暂无趋势数据' style={{ marginTop: 60 }} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {repos.map((repo, idx) => {
                            const barPercent = maxStars > 0 ? (repo.starsCount / maxStars) * 100 : 0
                            const isStarred = starredMap[repo.fullName] ?? false
                            return (
                                <div
                                    key={repo.id}
                                    onMouseEnter={() => { if (!isStarred) void handleCheckStar(repo) }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        background: token.colorBgContainer,
                                        borderRadius: 8,
                                        border: `1px solid ${token.colorBorderSecondary}`,
                                        overflow: 'hidden',
                                        minHeight: 72,
                                    }}
                                >
                                    {/* 排名徽章 */}
                                    <div
                                        style={{
                                            width: 44,
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: idx < 3 ? RANK_BADGE_COLORS[idx] : token.colorFillTertiary,
                                            color: idx < 3 ? '#fff' : token.colorTextTertiary,
                                            fontWeight: 700,
                                            fontSize: idx < 3 ? 18 : 14,
                                        }}
                                    >
                                        {idx + 1}
                                    </div>

                                    {/* 仓库信息 */}
                                    <div style={{ flex: 1, padding: '10px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <img
                                                src={repo.ownerAvatarUrl}
                                                alt=''
                                                style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }}
                                            />
                                            <Typography.Link
                                                onClick={() => navigate(`/repos/${repo.fullName}`)}
                                                style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '100%' }}
                                            >
                                                {repo.fullName}
                                            </Typography.Link>
                                            <Button
                                                type='text'
                                                size='small'
                                                icon={<GithubOutlined />}
                                                href={repo.htmlUrl}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ flexShrink: 0 }}
                                            />
                                            <Button
                                                type='text'
                                                size='small'
                                                icon={isStarred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                                                title={isStarred ? '已 Star' : 'Star 此仓库'}
                                                disabled={isStarred}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    void handleStar(repo)
                                                }}
                                                style={isStarred ? { flexShrink: 0, color: '#faad14' } : { flexShrink: 0 }}
                                            />
                                            {repo.language && (
                                                <Tag color='blue' style={{ fontSize: 11, margin: 0, flexShrink: 0 }}>
                                                    {repo.language}
                                                </Tag>
                                            )}
                                        </div>
                                        {(repo.descriptionCn || repo.description) && (
                                            <Text
                                                type='secondary'
                                                style={{
                                                    fontSize: 12,
                                                    lineHeight: '18px',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {repo.descriptionCn || repo.description}
                                            </Text>
                                        )}
                                    </div>

                                    {/* Star 横条 */}
                                    <div
                                        style={{
                                            width: 200,
                                            flexShrink: 0,
                                            padding: '10px 16px 10px 0',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'flex-end',
                                            gap: 4,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
                                            <Text style={{ fontSize: 14, fontWeight: 700 }}>{formatNumberShort(repo.starsCount)}</Text>
                                            <ForkOutlined style={{ fontSize: 11, color: token.colorTextTertiary, marginLeft: 4 }} />
                                            <Text type='secondary' style={{ fontSize: 11 }}>{formatNumberShort(repo.forksCount)}</Text>
                                        </div>
                                        <div style={{ width: '100%', height: 8, background: token.colorFillTertiary, borderRadius: 4, overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    width: `${barPercent}%`,
                                                    height: '100%',
                                                    borderRadius: 4,
                                                    background: idx < 3
                                                        ? `linear-gradient(90deg, ${RANK_BADGE_COLORS[idx]}, ${RANK_BADGE_COLORS[idx]}cc)`
                                                        : 'linear-gradient(90deg, #91caff, #b7eb8f)',
                                                    transition: 'width 0.6s ease',
                                                }}
                                            />
                                        </div>
                                        <Text type='secondary' style={{ fontSize: 10 }}>
                                            {getRelativeTime(repo.pushedAt)}
                                        </Text>
                                        <Button
                                            size='small'
                                            icon={<CodeOutlined />}
                                            onClick={() => setPreviewRepo(repo.fullName)}
                                            style={{ marginTop: 4 }}
                                        >
                                            代码预览
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Spin>

            <CodePreviewDrawer fullName={previewRepo} onClose={() => setPreviewRepo(null)} />

            {/* 下载配置弹窗 */}
            <Modal
                title="下载趋势仓库"
                open={downloadConfigOpen}
                onCancel={() => setDownloadConfigOpen(false)}
                onOk={handleConfirmDownload}
                confirmLoading={downloading}
                okText="开始下载"
                destroyOnClose
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <div>
                        <Text style={{ display: 'block', marginBottom: 4 }}>目标下载目录</Text>
                        <Input
                            value={configTargetDir}
                            onChange={(e) => setConfigTargetDir(e.target.value)}
                            placeholder='请输入绝对路径，如 D:/downloads'
                        />
                        {configDirs.length > 0 && (
                            <Space wrap size={4} style={{ marginTop: 8 }}>
                                <Text type='secondary' style={{ fontSize: 12 }}>常用目录:</Text>
                                {configDirs.map((dir) => (
                                    <Tag
                                        key={dir}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setConfigTargetDir(dir)}
                                    >
                                        {dir}
                                    </Tag>
                                ))}
                            </Space>
                        )}
                    </div>
                    <div>
                        <Text style={{ display: 'block', marginBottom: 4 }}>并发数</Text>
                        <Select
                            value={configConcurrency}
                            onChange={(v) => setConfigConcurrency(v)}
                            options={[
                                { value: 1, label: '1（单线程）' },
                                { value: 3, label: '3（推荐）' },
                                { value: 5, label: '5' },
                                { value: 10, label: '10' },
                            ]}
                            style={{ width: 200 }}
                        />
                    </div>
                    <div>
                        <Text style={{ display: 'block', marginBottom: 4 }}>镜像源</Text>
                        <Select
                            mode='multiple'
                            value={configMirrorSources}
                            onChange={(v) => setConfigMirrorSources(v)}
                            options={[
                                { value: 'direct', label: '直连' },
                                { value: 'ghproxy', label: 'ghproxy.net' },
                                { value: 'gh-proxy', label: 'gh-proxy.com' },
                                { value: 'gh-proxy-org', label: 'gh-proxy.org' },
                                { value: 'gh-proxy-v4', label: 'gh-proxy (v4)' },
                                { value: 'gh-proxy-v6', label: 'gh-proxy (v6)' },
                                { value: 'gh-proxy-cdn', label: 'gh-proxy (CDN)' },
                                { value: 'gitclone', label: 'gitclone.com' },
                            ]}
                            style={{ width: '100%' }}
                            placeholder='选择镜像源（按优先级排序）'
                        />
                    </div>
                </div>
            </Modal>

            {/* 下载进度弹窗 */}
            <DownloadProgressModal
                open={downloadProgressOpen}
                progress={downloadProgress}
                onClose={() => {
                    if (pollingRef.current) clearInterval(pollingRef.current)
                    setDownloadProgressOpen(false)
                }}
                onRetryFailed={handleRetryDownloadFailed}
                onRetryItem={handleRetryDownloadItem}
                onDelete={handleDeleteDownloadTask}
                onExtract={handleExtractDownloadItem}
                onDeleteItem={handleDeleteDownloadItem}
            />
        </div>
    )
}

