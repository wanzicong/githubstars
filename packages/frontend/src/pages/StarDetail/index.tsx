import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Button,
    Card,
    Descriptions,
    Drawer,
    FloatButton,
    Space,
    Spin,
    Tag,
    Typography,
    App,
    Empty,
} from 'antd'
import {
    ArrowLeftOutlined,
    CodeOutlined,
    InfoCircleOutlined,
    VerticalAlignTopOutlined,
    VerticalAlignBottomOutlined,
} from '@ant-design/icons'
import * as api from '../../api'
import { formatDate } from '../../utils/format'
import { DaysSinceText } from './hooks/DaysSinceText'
import { parseTopics } from './hooks/helpers'
import { RepoHeader } from '../../components/repo'
import { RepoStatsGrid } from '../../components/repo'
import { RepoReadmeCard } from '../../components/repo'
import { CodePreviewModal } from '../../components/repo'
import type { GithubRepo } from '../../types'

const { Text } = Typography

export default function StarDetail() {
    const { message } = App.useApp()
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [repo, setRepo] = useState<GithubRepo | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    // 详情抽屉
    const [infoDrawerOpen, setInfoDrawerOpen] = useState(false)
    const [codePreviewOpen, setCodePreviewOpen] = useState(false)

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
                const detail = await api.fetchRepoDetail(numericId)
                if (cancelled) return
                if (detail && detail.id) {
                    setRepo(detail)
                    setNotFound(false)
                    return
                }

                // 详情 API 未返回数据，从 top-starred/recent-active 降级查找
                const [topRes, recentRes] = await Promise.allSettled([
                    api.fetchTopStarredRepos(100),
                    api.fetchRecentActiveRepos(100),
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 顶部操作行：返回 + 代码预览/仓库详情按钮 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
                    返回
                </Button>
                <Space wrap>
                    <Button icon={<CodeOutlined />} onClick={() => setCodePreviewOpen(true)}>
                        代码预览
                    </Button>
                    <Button
                        type='primary'
                        icon={<InfoCircleOutlined />}
                        onClick={() => setInfoDrawerOpen(true)}
                    >
                        仓库详情
                    </Button>
                </Space>
            </div>

            <RepoReadmeCard repo={repo} />

            <CodePreviewModal
                fullName={repo.fullName}
                open={codePreviewOpen}
                onClose={() => setCodePreviewOpen(false)}
            />

            {/* 仓库详情抽屉 */}
            <Drawer
                title='仓库详情'
                placement='right'
                width={720}
                open={infoDrawerOpen}
                onClose={() => setInfoDrawerOpen(false)}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <RepoHeader repo={repo} />

                    <RepoStatsGrid
                        starsCount={repo.starsCount}
                        forksCount={repo.forksCount}
                        watchersCount={repo.watchersCount}
                        openIssuesCount={repo.openIssuesCount}
                        repoSize={repo.repoSize}
                    />

                    <Card title='详细信息' size='small'>
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
                </div>
            </Drawer>

            {/* 回到顶部 / 回到底部 悬浮按钮 */}
            <FloatButton.Group
                shape='circle'
                style={{ insetInlineEnd: 24, insetBlockEnd: 24 }}
            >
                <FloatButton
                    icon={<VerticalAlignTopOutlined />}
                    tooltip='回到顶部'
                    onClick={() => scrollMainTo('top')}
                />
                <FloatButton
                    icon={<VerticalAlignBottomOutlined />}
                    tooltip='回到底部'
                    onClick={() => scrollMainTo('bottom')}
                />
            </FloatButton.Group>
        </div>
    )
}

/** 滚动到顶部或底部。
 *  本项目全局样式把滚动放在了 <body> 上（overflow-y: auto），
 *  documentElement 和 window 都不可滚动。直接滚 body。
 */
function scrollMainTo(position: 'top' | 'bottom') {
    const body = document.body
    const top = position === 'top' ? 0 : body.scrollHeight
    body.scrollTo({ top, behavior: 'smooth' })
}
