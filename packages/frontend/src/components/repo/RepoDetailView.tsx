import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Badge,
    Button,
    Card,
    Descriptions,
    Drawer,
    FloatButton,
    Space,
    Tag,
    Typography,
    App,
} from 'antd'
import {
    ArrowLeftOutlined,
    BookOutlined,
    CodeOutlined,
    GithubOutlined,
    InfoCircleOutlined,
    IssuesCloseOutlined,
    RobotOutlined,
    VerticalAlignTopOutlined,
    VerticalAlignBottomOutlined,
} from '@ant-design/icons'
import { formatDate } from '../../utils/format'
import { DaysSinceText } from '../../pages/StarDetail/hooks/DaysSinceText'
import { parseTopics } from '../../pages/StarDetail/hooks/helpers'
import { useAddRepoContext } from '../../pages/AgentChat/hooks/useAddRepoContext'
import { RepoHeader } from '.'
import { RepoStatsGrid } from '.'
import { RepoReadmeCard } from '.'
import { CodePreviewModal } from '.'
import { RepoIssuesModal } from '.'
import { checkLearnRepos, quickAddLearn } from '../../api/learn'
import type { RepoDetailData } from '../../types'

const { Text } = Typography

function getLearnLabel(inLearn: boolean | null): string {
    if (inLearn === null) return '…'
    if (inLearn) return '已在学习清单'
    return '加入学习清单'
}

export interface RepoDetailViewProps {
    repo: RepoDetailData
}

/**
 * 统一仓库详情视图组件
 *
 * 提供可复用的仓库详情 UI，包含顶部操作行、README 卡片、代码预览、Issues 弹窗、
 * 仓库详情抽屉和悬浮导航按钮。StarDetail（本地 id 入口）和 RepoDetail（owner/repo
 * 入口）共享此组件，样式 100% 一致。
 */
export default function RepoDetailView({ repo }: RepoDetailViewProps) {
    const navigate = useNavigate()
    const { message } = App.useApp()
    const [infoDrawerOpen, setInfoDrawerOpen] = useState(false)
    const [codePreviewOpen, setCodePreviewOpen] = useState(false)
    const [issuesOpen, setIssuesOpen] = useState(false)
    const [inLearn, setInLearn] = useState<boolean | null>(null)
    const [addingLearn, setAddingLearn] = useState(false)
    const { addRepoToContext } = useAddRepoContext()

    // 检查仓库是否已加入学习清单
    useEffect(() => {
        if (!repo.id) return
        let cancelled = false
        const run = async () => {
            const map = await checkLearnRepos([repo.id!])
            if (!cancelled) setInLearn(repo.id != null && repo.id in map)
        }
        run()
        return () => { cancelled = true }
    }, [repo.id])

    /** 加入/已加入学习清单 */
    const handleToggleLearn = async () => {
        if (!repo.id || inLearn) return
        setAddingLearn(true)
        try {
            await quickAddLearn(repo.id)
            setInLearn(true)
            message.success('已加入学习清单')
        } catch {
            message.error('加入学习清单失败')
        } finally {
            setAddingLearn(false)
        }
    }

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1)
        } else {
            navigate('/')
        }
    }

    const handleOpenIssues = () => {
        setInfoDrawerOpen(false)
        setIssuesOpen(true)
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
                    <Badge count={repo.openIssuesCount} overflowCount={999} offset={[-2, 2]}>
                        <Button icon={<IssuesCloseOutlined />} onClick={handleOpenIssues}>
                            Issues
                        </Button>
                    </Badge>
                    <Button icon={<CodeOutlined />} onClick={() => setCodePreviewOpen(true)}>
                        代码预览
                    </Button>
                    {repo.id != null && (
                        <Button icon={<RobotOutlined />} onClick={() => addRepoToContext({ id: repo.id!, fullName: repo.fullName })}>
                            问 AI
                        </Button>
                    )}
                    {repo.id != null && (
                        <Button
                            icon={<BookOutlined />}
                            loading={addingLearn}
                            onClick={handleToggleLearn}
                            disabled={inLearn === true}
                        >
                            {getLearnLabel(inLearn)}
                        </Button>
                    )}
                    <Button
                        icon={<GithubOutlined />}
                        onClick={() => window.open(`https://github.dev/${repo.fullName}`, '_blank', 'noopener,noreferrer')}
                    >
                        官方预览
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

            <RepoIssuesModal
                fullName={repo.fullName}
                htmlUrl={repo.htmlUrl}
                open={issuesOpen}
                onClose={() => setIssuesOpen(false)}
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
                    <RepoHeader repo={repo} onOpenIssues={handleOpenIssues} />

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

/** 滚动到顶部或底部。本项目全局样式把滚动放在了 <body> 上。 */
function scrollMainTo(position: 'top' | 'bottom') {
    const body = document.body
    const top = position === 'top' ? 0 : body.scrollHeight
    body.scrollTo({ top, behavior: 'smooth' })
}
