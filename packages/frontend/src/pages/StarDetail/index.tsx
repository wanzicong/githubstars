import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Card,
    Descriptions,
    Tag,
    Button,
    Space,
    Typography,
    Spin,
    Empty,
    App,
    Modal,
    Progress,
    Alert,
    Tabs,
} from 'antd'
import {
    ArrowLeftOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    CodeOutlined,
    ReadOutlined,
} from '@ant-design/icons'
import * as statsApi from '../../api'
import * as translateApi from '../../api'
import { formatDate } from '../../utils/format'
import { DaysSinceText } from './hooks/DaysSinceText'
import { parseTopics } from './hooks/helpers'
import { RepoHeader } from '../../components/repo'
import { RepoStatsGrid } from '../../components/repo'
import { RepoReadmeCard } from '../../components/repo'
import CodePreviewCard from '../../components/repo/CodePreviewCard'
import { usePolling } from '../../hooks/usePolling'
import type { GithubRepo, TranslateTaskProgress } from '../../types'

const { Text } = Typography

export default function StarDetail() {
    const { message } = App.useApp()
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

    const polling = usePolling(async ({ stop }) => {
        const taskId = translateTaskIdRef.current
        if (!taskId) {
            stop()
            return
        }
        elapsedRef.current += 2000
        try {
            const res = await translateApi.getTaskProgress(taskId)
            if (res.success) {
                setTranslateProgress(res)
                if (res.status === 'COMPLETED' || res.status === 'FAILED' || res.status === 'PARTIAL') {
                    stop()
                    const rid = repoIdRef.current
                    if (rid) {
                        const updated = await translateApi.fetchRepoDetail(rid)
                        if (updated && updated.id) setRepo(updated)
                    }
                }
            }
            if (elapsedRef.current >= 10 * 60 * 1000) {
                stop()
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
            } catch {
                message.error('获取仓库详情失败')
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
    }, [id, message])

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

    // README 全屏查看 - 已内置于 RepoReadmeCard 组件

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

    return (
        <div>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginBottom: 20 }}>
                返回
            </Button>

            <Card style={{ marginBottom: 20 }}>
                <RepoHeader
                    repo={repo}
                    translatingDesc={translatingDesc}
                    onTranslateDesc={handleTranslateDescription}
                    onRetranslateDesc={handleTranslateDescription}
                />
            </Card>

            <RepoStatsGrid
                starsCount={repo.starsCount}
                forksCount={repo.forksCount}
                watchersCount={repo.watchersCount}
                openIssuesCount={repo.openIssuesCount}
                repoSize={repo.repoSize}
            />

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
                    <Descriptions.Item label='默认分支'>
                        {repo.defaultBranch ? <Text>{repo.defaultBranch}</Text> : <Text type='secondary'>-</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label='可见性'>
                        {repo.visibility ? <Tag>{repo.visibility}</Tag> : <Text type='secondary'>-</Text>}
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

            {/* 代码预览 / README 切换区块 */}
            <Card>
                <Tabs
                    defaultActiveKey='code'
                    items={[
                        {
                            key: 'code',
                            label: (
                                <Space>
                                    <CodeOutlined />
                                    代码预览
                                </Space>
                            ),
                            children: <CodePreviewCard fullName={repo.fullName} />,
                        },
                        {
                            key: 'readme',
                            label: (
                                <Space>
                                    <ReadOutlined />
                                    README
                                </Space>
                            ),
                            children: (
                                <RepoReadmeCard
                                    repo={repo}
                                    translatingReadme={translatingReadme}
                                    onTranslateReadme={handleTranslateReadme}
                                    onRetranslateReadme={handleRetranslateReadme}
                                />
                            ),
                        },
                    ]}
                />
            </Card>

            {/* README 全屏查看弹窗 - 已内置于 RepoReadmeCard */}

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
                mask={{ closable: false }}
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
                                    status={(() => {
                                        if (translateProgress.status === 'COMPLETED') {
                                            return translateProgress.readmeFailed > 0 ? 'exception' : 'success'
                                        }
                                        if (translateProgress.status === 'FAILED' || translateProgress.status === 'PARTIAL') {
                                            return 'exception'
                                        }
                                        return 'active'
                                    })()}
                                    size={120}
                                />
                                <div style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
                                    {translateProgress.status === 'PENDING' && '等待执行...'}
                                    {translateProgress.status === 'PROCESSING' && '正在获取 GitHub README 并调用 DeepSeek 翻译...'}
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
                                                        {(() => {
                                                            if (item.note === '翻译成功') return '✅ 翻译成功，页面已更新'
                                                            if (isNoReadme) return '⚠️ 该仓库在 GitHub 上没有 README 文件'
                                                            return '📝 ' + item.note
                                                        })()}
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
