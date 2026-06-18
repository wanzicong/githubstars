import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Card,
    Descriptions,
    Tag,
    Button,
    Space,
    Typography,
    Avatar,
    Statistic,
    Row,
    Col,
    Spin,
    Empty,
    message,
    Modal,
    Progress,
    Alert,
} from 'antd'
import {
    ArrowLeftOutlined,
    GithubOutlined,
    LinkOutlined,
    StarFilled,
    ForkOutlined,
    EyeOutlined,
    BugOutlined,
    TranslationOutlined,
    ReadOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExpandOutlined,
} from '@ant-design/icons'
import * as statsApi from '../api/stats'
import * as translateApi from '../api/translate'
import { formatNumberCn, formatDate } from '../utils/format'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { usePolling } from '../hooks/usePolling'
import type { GithubRepo, TranslateTaskProgress } from '../types'

const { Title, Text, Paragraph } = Typography

function daysSince(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null
    const date = new Date(dateStr.replace(' ', 'T'))
    if (isNaN(date.getTime())) return null
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return null
    return diffDays === 0 ? '今天' : `${diffDays} 天`
}

function DaysSinceText({ dateStr }: { dateStr: string }) {
    const display = daysSince(dateStr)
    if (!display) return <Text type='secondary'>-</Text>
    if (display === '今天') return <Text style={{ color: '#52c41a' }}>今天</Text>
    const num = parseInt(display)
    if (num < 90) return <Text style={{ color: '#52c41a' }}>{display}</Text>
    if (num < 365) return <Text style={{ color: '#faad14' }}>{display}</Text>
    return <Text style={{ color: '#ff4d4f' }}>{display}</Text>
}

function parseTopics(topics: string | null): string[] {
    if (!topics) return []
    try {
        return JSON.parse(topics)
    } catch {
        return []
    }
}

export default function StarDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [repo, setRepo] = useState<GithubRepo | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    // 翻译状态
    const [translatingDesc, setTranslatingDesc] = useState(false)
    const [translatingReadme, setTranslatingReadme] = useState(false)

    // 异步翻译进度
    const [, setTranslateTaskId] = useState<number | null>(null)
    const [translateModalVisible, setTranslateModalVisible] = useState(false)
    const [translateProgress, setTranslateProgress] = useState<TranslateTaskProgress | null>(null)
    const translateTaskIdRef = useRef<number | null>(null)
    const repoIdRef = useRef<number | null>(null)
    const elapsedRef = useRef(0)

    // 同步 repo.id 到 ref
    useEffect(() => {
        repoIdRef.current = repo?.id ?? null
    }, [repo?.id])

    const polling = usePolling(async () => {
        const taskId = translateTaskIdRef.current
        if (!taskId) {
            polling.stop()
            return
        }
        elapsedRef.current += 2000
        try {
            const res = await translateApi.getTaskProgress(taskId)
            if (res.success) {
                setTranslateProgress(res)
                if (res.status === 'COMPLETED' || res.status === 'FAILED' || res.status === 'PARTIAL') {
                    polling.stop()
                    const rid = repoIdRef.current
                    if (rid) {
                        const updated = await translateApi.fetchRepoDetail(rid)
                        if (updated && updated.id) setRepo(updated)
                    }
                }
            }
            if (elapsedRef.current >= 10 * 60 * 1000) {
                polling.stop()
                setTranslateProgress((prev) => (prev ? { ...prev, status: 'FAILED' } : null))
                message.warning('翻译超时，请稍后重试')
            }
        } catch {
            /* ignore polling errors */
        }
    }, 2000)

    useEffect(() => {
        let cancelled = false
        const fetchRepo = async () => {
            const numericId = Number(id)
            if (!numericId) {
                setNotFound(true)
                setLoading(false)
                return
            }

            try {
                const detail = await translateApi.fetchRepoDetail(numericId)
                if (cancelled) return
                if (detail && detail.id) {
                    setRepo(detail)
                    setNotFound(false)
                    return
                }

                // 详情 API 未返回数据，从 top-starred/recent-active 降级查找
                const [topRes, recentRes] = await Promise.allSettled([
                    statsApi.fetchTopStarredRepos(100),
                    statsApi.fetchRecentActiveRepos(100),
                ])
                if (cancelled) return

                let found: GithubRepo | undefined
                if (topRes.status === 'fulfilled') {
                    found = topRes.value.find((r) => r.id === numericId)
                }
                if (!found && recentRes.status === 'fulfilled') {
                    found = recentRes.value.find((r) => r.id === numericId)
                }

                if (found) {
                    setRepo(found)
                } else {
                    setNotFound(true)
                }
            } catch (e) {
                console.error('获取仓库详情失败', e)
                if (!cancelled) {
                    setNotFound(true)
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        fetchRepo()

        return () => {
            cancelled = true
        }
    }, [id])

    /** 翻译前校验 API Key 是否已配置 */
    const ensureApiKey = async (): Promise<boolean> => {
        try {
            const config = await translateApi.getTranslateConfig()
            if (!config.apiKeyConfigured) {
                message.warning('DeepSeek API Key 未配置，请在系统配置页面设置后重试', 5)
                return false
            }
            return true
        } catch {
            // 接口不通时放行，让后续逻辑自己报错
            return true
        }
    }

    const handleTranslateDescription = async () => {
        if (!repo?.id) return
        if (!(await ensureApiKey())) return
        setTranslatingDesc(true)
        try {
            const result = await translateApi.translateDescription(repo.id)
            if (result.success) {
                // 刷新详情以获取翻译后的数据
                const updated = await translateApi.fetchRepoDetail(repo.id)
                if (updated && updated.id) {
                    setRepo(updated)
                    message.success('描述翻译完成')
                }
            }
        } catch {
            message.error('翻译描述失败')
        } finally {
            setTranslatingDesc(false)
        }
    }

    const handleTranslateReadme = async () => {
        if (!repo?.id) return
        if (!(await ensureApiKey())) return
        setTranslatingReadme(true)
        try {
            const result = await translateApi.startSingleReadme(repo.id)
            if (result.success && result.taskId) {
                setTranslateTaskId(result.taskId)
                setTranslateProgress({
                    status: 'PENDING',
                    progress: 0,
                    readmeCompleted: 0,
                    readmeFailed: 0,
                    readmeTotal: 1,
                } as TranslateTaskProgress)
                setTranslateModalVisible(true)
                translateTaskIdRef.current = result.taskId
                elapsedRef.current = 0
                polling.start()
                message.success('翻译任务已提交，正在后台执行...')
            } else {
                message.info(result.message || '提交失败')
            }
        } catch {
            message.error('提交翻译任务失败')
        } finally {
            setTranslatingReadme(false)
        }
    }

    const handleRetranslateReadme = async () => {
        if (!repo?.id) return
        if (!(await ensureApiKey())) return
        setTranslatingReadme(true)
        try {
            const result = await translateApi.retranslateReadme(repo.id)
            if (result.success && result.taskId) {
                setTranslateTaskId(result.taskId)
                setTranslateProgress({
                    status: 'PENDING',
                    progress: 0,
                    readmeCompleted: 0,
                    readmeFailed: 0,
                    readmeTotal: 1,
                } as TranslateTaskProgress)
                setTranslateModalVisible(true)
                translateTaskIdRef.current = result.taskId
                elapsedRef.current = 0
                polling.start()
                message.success('重新翻译任务已提交，正在后台执行...')
            } else {
                message.info(result.message || '提交失败')
            }
        } catch {
            message.error('提交重新翻译任务失败')
        } finally {
            setTranslatingReadme(false)
        }
    }

    // README 全屏查看
    const [readmeFullscreenVisible, setReadmeFullscreenVisible] = useState(false)


    const handleCloseTranslateModal = () => {
        polling.stop()
        setTranslateModalVisible(false)
        setTranslateTaskId(null)
        setTranslateProgress(null)
    }

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1)
        } else {
            navigate('/')
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Spin size='large' tip='加载中...' />
            </div>
        )
    }

    if (notFound || !repo) {
        return (
            <div>
                <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginBottom: 24 }}>
                    返回
                </Button>
                <Card>
                    <Empty description='未找到该仓库数据'>
                        <Button type='primary' onClick={() => navigate('/')}>
                            返回列表
                        </Button>
                    </Empty>
                </Card>
            </div>
        )
    }

    const topics = parseTopics(repo.topics)

    const statColStyle = { xs: 12 as const, sm: 12 as const, md: 6 as const }

    return (
        <div>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginBottom: 20 }}>
                返回
            </Button>

            <Card style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={64} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
                            {repo.fullName}
                        </Title>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Text type='secondary' style={{ fontSize: 14 }}>
                                {repo.ownerName}
                            </Text>
                            {repo.isFork && (
                                <Tag color='orange' style={{ margin: 0 }}>
                                    已 Fork
                                </Tag>
                            )}
                            {repo.isArchived && (
                                <Tag color='default' style={{ margin: 0 }}>
                                    已归档
                                </Tag>
                            )}
                        </div>
                        {/* 描述：优先显示中文翻译 */}
                        {repo.descriptionCn ? (
                            <div>
                                <Paragraph style={{ marginBottom: 4, color: '#333' }}>
                                    {repo.descriptionCn}
                                    <Text type='secondary' style={{ fontSize: 11, marginLeft: 6 }}>
                                        🇨🇳 中文
                                    </Text>
                                </Paragraph>
                                {repo.description && repo.description !== repo.descriptionCn && (
                                    <Paragraph type='secondary' style={{ marginBottom: 0, fontSize: 12 }}>
                                        <Text type='secondary' italic>
                                            原文：
                                        </Text>
                                        {repo.description}
                                    </Paragraph>
                                )}
                                <Button
                                    size='small'
                                    type='link'
                                    icon={<ReloadOutlined />}
                                    loading={translatingDesc}
                                    onClick={handleTranslateDescription}
                                    style={{ padding: 0, marginTop: 4 }}
                                >
                                    重新翻译
                                </Button>
                            </div>
                        ) : repo.description ? (
                            <div>
                                <Paragraph type='secondary' style={{ marginBottom: 8 }}>
                                    {repo.description}
                                </Paragraph>
                                <Button
                                    size='small'
                                    icon={<TranslationOutlined />}
                                    loading={translatingDesc}
                                    onClick={handleTranslateDescription}
                                >
                                    翻译描述
                                </Button>
                            </div>
                        ) : (
                            <Text type='secondary' style={{ marginBottom: 8 }}>
                                暂无描述
                            </Text>
                        )}
                    </div>
                    <Space wrap>
                        <Button
                            type='primary'
                            icon={<GithubOutlined />}
                            onClick={() => window.open(repo.htmlUrl, '_blank', 'noopener,noreferrer')}
                        >
                            在 GitHub 上查看
                        </Button>
                        {repo.homepage && (
                            <Button icon={<LinkOutlined />} onClick={() => window.open(repo.homepage!, '_blank', 'noopener,noreferrer')}>
                                访问项目主页
                            </Button>
                        )}
                    </Space>
                </div>
            </Card>

            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col {...statColStyle}>
                    <Card size='small'>
                        <Statistic
                            title='Stars'
                            value={repo.starsCount}
                            prefix={<StarFilled style={{ color: '#faad14' }} />}
                            formatter={(value) => (
                                <span>
                                    {value}{' '}
                                    <Text type='secondary' style={{ fontSize: 12 }}>
                                        {formatNumberCn(Number(value))}
                                    </Text>
                                </span>
                            )}
                        />
                    </Card>
                </Col>
                <Col {...statColStyle}>
                    <Card size='small'>
                        <Statistic
                            title='Forks'
                            value={repo.forksCount}
                            prefix={<ForkOutlined style={{ color: '#52c41a' }} />}
                            formatter={(value) => (
                                <span>
                                    {value}{' '}
                                    <Text type='secondary' style={{ fontSize: 12 }}>
                                        {formatNumberCn(Number(value))}
                                    </Text>
                                </span>
                            )}
                        />
                    </Card>
                </Col>
                <Col {...statColStyle}>
                    <Card size='small'>
                        <Statistic
                            title='Watchers'
                            value={repo.watchersCount}
                            prefix={<EyeOutlined style={{ color: '#1677ff' }} />}
                            formatter={(value) => (
                                <span>
                                    {value}{' '}
                                    <Text type='secondary' style={{ fontSize: 12 }}>
                                        {formatNumberCn(Number(value))}
                                    </Text>
                                </span>
                            )}
                        />
                    </Card>
                </Col>
                <Col {...statColStyle}>
                    <Card size='small'>
                        <Statistic
                            title='Open Issues'
                            value={repo.openIssuesCount}
                            prefix={<BugOutlined style={{ color: '#ff4d4f' }} />}
                            formatter={(value) => (
                                <span>
                                    {value}{' '}
                                    <Text type='secondary' style={{ fontSize: 12 }}>
                                        {formatNumberCn(Number(value))}
                                    </Text>
                                </span>
                            )}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title='详细信息' style={{ marginBottom: 20 }}>
                <Descriptions column={{ xs: 1, sm: 1, md: 2 }} bordered size='small'>
                    <Descriptions.Item label='编程语言'>
                        {repo.language ? <Tag color='blue'>{repo.language}</Tag> : <Text type='secondary'>-</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label='许可证'>
                        {repo.licenseName ? <Text>{repo.licenseName}</Text> : <Text type='secondary'>-</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label='主题标签' span={2}>
                        {topics.length > 0 ? (
                            <Space size={[4, 4]} wrap>
                                {topics.map((topic) => (
                                    <Tag key={topic}>{topic}</Tag>
                                ))}
                            </Space>
                        ) : (
                            <Text type='secondary'>-</Text>
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label='Star 时间'>{formatDate(repo.starredAt)}</Descriptions.Item>
                    <Descriptions.Item label='仓库创建时间'>{formatDate(repo.repoCreatedAt)}</Descriptions.Item>
                    <Descriptions.Item label='最后更新时间'>{formatDate(repo.repoUpdatedAt)}</Descriptions.Item>
                    <Descriptions.Item label='最后推送时间'>{formatDate(repo.repoPushedAt)}</Descriptions.Item>
                    {repo.repoPushedAt && (
                        <Descriptions.Item label='距上次推送'>
                            <DaysSinceText dateStr={repo.repoPushedAt} />
                        </Descriptions.Item>
                    )}
                </Descriptions>
            </Card>

            {/* README 翻译区块 */}
            <Card
                title={
                    <Space>
                        <ReadOutlined />
                        <span>README 中文翻译</span>
                    </Space>
                }
                extra={
                    !repo.readmeFetched ? (
                        <Button
                            type='primary'
                            size='small'
                            icon={<TranslationOutlined />}
                            loading={translatingReadme}
                            onClick={handleTranslateReadme}
                        >
                            翻译 README
                        </Button>
                    ) : (
                        <Space>
                            {repo.readmeCn && (
                                <Button size='small' icon={<ExpandOutlined />} onClick={() => setReadmeFullscreenVisible(true)}>
                                    放大查看
                                </Button>
                            )}
                            {repo.readmeCn ? (
                                <Button
                                    size='small'
                                    icon={<ReloadOutlined />}
                                    loading={translatingReadme}
                                    onClick={handleRetranslateReadme}
                                >
                                    重新翻译
                                </Button>
                            ) : (
                                <Button
                                    size='small'
                                    icon={<ReloadOutlined />}
                                    loading={translatingReadme}
                                    onClick={handleRetranslateReadme}
                                >
                                    重新获取
                                </Button>
                            )}
                        </Space>
                    )
                }
            >
                {repo.readmeFetched && repo.readmeCn ? (
                    <MarkdownRenderer
                        content={repo.readmeCn}
                        style={{ overflow: 'auto', maxHeight: 600, padding: '8px 16px' }}
                    />
                ) : repo.readmeFetched && !repo.readmeCn ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                        <br />
                        <Text type='secondary'>该仓库没有 README</Text>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                        <br />
                        <Text type='secondary'>README 尚未翻译</Text>
                        <br />
                        <Button
                            type='primary'
                            icon={<TranslationOutlined />}
                            loading={translatingReadme}
                            onClick={handleTranslateReadme}
                            style={{ marginTop: 8 }}
                        >
                            翻译 README
                        </Button>
                    </div>
                )}
            </Card>

            {/* README 全屏查看弹窗 */}
            <Modal
                title={
                    <Space>
                        <ExpandOutlined />
                        <span>README 中文翻译 - 全屏查看</span>
                    </Space>
                }
                open={readmeFullscreenVisible}
                onCancel={() => setReadmeFullscreenVisible(false)}
                footer={
                    <Button type='primary' onClick={() => setReadmeFullscreenVisible(false)}>
                        关闭
                    </Button>
                }
                width='95%'
                style={{ top: 20, paddingBottom: 0 }}
                styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflow: 'auto', padding: '16px 24px' } }}
            >
                <MarkdownRenderer content={repo?.readmeCn || ''} style={{ padding: '8px 16px' }} />
            </Modal>

            {/* 异步翻译进度弹窗 */}
            <Modal
                title='README 翻译进度'
                open={translateModalVisible}
                onCancel={handleCloseTranslateModal}
                footer={
                    translateProgress && translateProgress.status !== 'PENDING' && translateProgress.status !== 'PROCESSING' ? (
                        <Button type='primary' onClick={handleCloseTranslateModal}>
                            关闭
                        </Button>
                    ) : null
                }
                maskClosable={false}
                closable={translateProgress?.status !== 'PENDING' && translateProgress?.status !== 'PROCESSING'}
            >
                {translateProgress && (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <Spin spinning={translateProgress.status === 'PENDING' || translateProgress.status === 'PROCESSING'}>
                            <div style={{ padding: 8 }}>
                                {translateProgress.status === 'COMPLETED' && translateProgress.readmeFailed === 0 && (
                                    <div style={{ fontSize: 48, marginBottom: 8 }}>
                                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                    </div>
                                )}
                                {(translateProgress.status === 'COMPLETED' && translateProgress.readmeFailed > 0) ||
                                    (translateProgress.status === 'PARTIAL' && (
                                        <div style={{ fontSize: 48, marginBottom: 8 }}>
                                            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                                        </div>
                                    ))}
                                {translateProgress.status === 'FAILED' && (
                                    <div style={{ fontSize: 48, marginBottom: 8 }}>
                                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                                    </div>
                                )}
                                <Progress
                                    type='circle'
                                    percent={translateProgress.progress}
                                    status={
                                        translateProgress.status === 'COMPLETED'
                                            ? translateProgress.readmeFailed > 0
                                                ? 'exception'
                                                : 'success'
                                            : translateProgress.status === 'FAILED' || translateProgress.status === 'PARTIAL'
                                              ? 'exception'
                                              : 'active'
                                    }
                                    size={120}
                                />
                                <div style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
                                    {translateProgress.status === 'PENDING' && '等待执行...'}
                                    {translateProgress.status === 'PROCESSING' && '正在获取 GitHub README → 调用 DeepSeek 翻译...'}
                                    {translateProgress.status === 'COMPLETED' && translateProgress.readmeFailed === 0 && '翻译完成！'}
                                    {translateProgress.status === 'COMPLETED' &&
                                        translateProgress.readmeFailed > 0 &&
                                        '翻译完成（部分失败）'}
                                    {translateProgress.status === 'PARTIAL' && '部分翻译完成'}
                                    {translateProgress.status === 'FAILED' && '翻译失败，请检查 DeepSeek API Key 是否配置正确'}
                                </div>
                            </div>
                        </Spin>

                        {/* 每项执行的详细状态 */}
                        {translateProgress.completedDetails?.length || translateProgress.failedDetails?.length ? (
                            <div style={{ marginTop: 16, textAlign: 'left' }}>
                                {translateProgress.completedDetails?.map((item, i) => {
                                    const isNoReadme = item.note.startsWith('该仓库没有 README 文件')
                                    const ghBodyMatch = item.note.match(/^该仓库没有 README 文件\nGitHub 响应: (.+)$/s)
                                    const ghResponse = ghBodyMatch ? (() => { try { return JSON.parse(ghBodyMatch[1]) } catch { return ghBodyMatch[1] } })() : null
                                    return (
                                        <Alert
                                            key={'ok-' + i}
                                            style={{ marginBottom: 8 }}
                                            type={isNoReadme ? 'warning' : 'success'}
                                            showIcon
                                            message={
                                                <div style={{ fontSize: 13 }}>
                                                    <Text strong>{item.fullName}</Text>
                                                    <Text type='secondary' style={{ marginLeft: 8 }}>
                                                        {item.note === '翻译成功'
                                                            ? '✅ 翻译成功，页面已更新'
                                                            : isNoReadme
                                                              ? '⚠️ 该仓库在 GitHub 上没有 README 文件'
                                                              : '📝 ' + item.note}
                                                    </Text>
                                                    {ghResponse && (
                                                        <div style={{ marginTop: 6, padding: '6px 10px', background: '#fff7e6', borderRadius: 4, border: '1px solid #ffd591', maxHeight: 120, overflow: 'auto' }}>
                                                            <Text type='secondary' style={{ fontSize: 11 }}>GitHub API 响应：</Text>
                                                            <pre style={{ margin: '4px 0 0', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(ghResponse, null, 2)}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            }
                                        />
                                    )
                                })}
                                {translateProgress.failedDetails?.map((item, i) => (
                                    <Alert
                                        key={'fail-' + i}
                                        style={{ marginBottom: 8 }}
                                        type='error'
                                        showIcon
                                        message={
                                            <div style={{ fontSize: 13 }}>
                                                <Text strong>{item.fullName}</Text>
                                                <div>
                                                    <Text type='danger'>❌ {item.error}</Text>
                                                </div>
                                            </div>
                                        }
                                    />
                                ))}
                            </div>
                        ) : (
                            <Alert
                                style={{ marginTop: 12, textAlign: 'left' }}
                                type='info'
                                showIcon
                                message={
                                    <div style={{ fontSize: 13 }}>
                                        <div>正在获取 GitHub README 并调用 DeepSeek 翻译，请耐心等待...</div>
                                        <div style={{ marginTop: 4 }}>超时时间：约 8 分钟 | 失败自动重试 3 次</div>
                                    </div>
                                }
                            />
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}
