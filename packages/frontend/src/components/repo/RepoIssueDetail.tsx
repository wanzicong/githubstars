import { useEffect, useRef, useState } from 'react'
import { Alert, Avatar, Button, Divider, Skeleton, Space, Tag, Tooltip, Typography, theme } from 'antd'
import {
    ArrowLeftOutlined,
    CheckCircleOutlined,
    CommentOutlined,
    GithubOutlined,
    IssuesCloseOutlined,
    LockOutlined,
    ReloadOutlined,
    TagsOutlined,
    TeamOutlined,
} from '@ant-design/icons'
import { fetchRepoIssueDetail } from '../../api'
import type { GithubIssueDetail, GithubIssueReactions, GithubIssueUser } from '../../types'
import { getRelativeTime } from '../../utils/format'
import MarkdownRenderer from '../common/MarkdownRenderer'

const { Text, Title } = Typography

interface RepoIssueDetailProps {
    repoId: number
    issueNumber: number
    fullName: string
    onBack: () => void
}

export default function RepoIssueDetail({ repoId, issueNumber, fullName, onBack }: RepoIssueDetailProps) {
    const { token } = theme.useToken()
    const requestSequence = useRef(0)
    const [detail, setDetail] = useState<GithubIssueDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        const sequence = ++requestSequence.current
        queueMicrotask(() => {
            if (requestSequence.current !== sequence) return
            setLoading(true)
            setError(null)
            fetchRepoIssueDetail({ repoId, issueNumber })
                .then((data) => {
                    if (requestSequence.current === sequence) setDetail(data)
                })
                .catch((requestError: unknown) => {
                    if (requestSequence.current !== sequence) return
                    const readableError = requestError as { userMessage?: string; message?: string }
                    setError(readableError.userMessage || readableError.message || 'Issue 详情加载失败')
                    setDetail(null)
                })
                .finally(() => {
                    if (requestSequence.current === sequence) setLoading(false)
                })
        })
        return () => {
            if (requestSequence.current === sequence) requestSequence.current += 1
        }
    }, [issueNumber, reloadKey, repoId])

    return (
        <div className='repo-issue-detail-layout'>
            <div className='repo-issue-detail-toolbar' style={{ borderBottomColor: token.colorBorderSecondary }}>
                <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                    返回列表
                </Button>
                <Text type='secondary' ellipsis={{ tooltip: fullName }} className='repo-issue-detail-repo'>
                    {fullName} / #{issueNumber}
                </Text>
                {detail && (
                    <Button icon={<GithubOutlined />} href={detail.htmlUrl} target='_blank' rel='noopener noreferrer'>
                        在 GitHub 查看
                    </Button>
                )}
            </div>

            <div className='repo-issue-detail-scroll'>
                {loading && !detail && (
                    <div className='repo-issue-detail-loading'>
                        <Skeleton active avatar paragraph={{ rows: 4 }} />
                        <Skeleton active avatar paragraph={{ rows: 5 }} />
                    </div>
                )}

                {error && (
                    <Alert
                        type='error'
                        showIcon
                        title='Issue 详情加载失败'
                        description={error}
                        action={
                            <Button size='small' icon={<ReloadOutlined />} onClick={() => setReloadKey((value) => value + 1)}>
                                重试
                            </Button>
                        }
                    />
                )}

                {detail && (
                    <>
                        <header className='repo-issue-detail-header'>
                            <Title level={2} className='repo-issue-detail-title'>
                                {detail.title}{' '}
                                <Text type='secondary' style={{ fontWeight: 400 }}>
                                    #{detail.number}
                                </Text>
                            </Title>
                            <Space size={10} wrap>
                                <IssueStateTag detail={detail} />
                                <Text type='secondary'>
                                    <strong>{detail.user?.login || 'ghost'}</strong> 于 {getRelativeTime(detail.createdAt)}创建
                                </Text>
                                <Text type='secondary'>
                                    <CommentOutlined /> {detail.comments} 条评论
                                </Text>
                                {detail.locked && (
                                    <Text type='secondary'>
                                        <LockOutlined /> 讨论已锁定
                                    </Text>
                                )}
                            </Space>
                        </header>

                        <Divider />

                        <div className='repo-issue-detail-grid'>
                            <main className='repo-issue-conversation'>
                                <ConversationCard
                                    user={detail.user}
                                    body={detail.body}
                                    createdAt={detail.createdAt}
                                    updatedAt={detail.updatedAt}
                                    authorAssociation={detail.authorAssociation}
                                    reactions={detail.reactions}
                                    originalUrl={detail.htmlUrl}
                                    isOriginal
                                />
                                {detail.commentItems.map((comment) => (
                                    <ConversationCard
                                        key={comment.id}
                                        user={comment.user}
                                        body={comment.body}
                                        createdAt={comment.createdAt}
                                        updatedAt={comment.updatedAt}
                                        authorAssociation={comment.authorAssociation}
                                        reactions={comment.reactions}
                                        originalUrl={comment.htmlUrl}
                                    />
                                ))}
                                {detail.commentsTruncated && (
                                    <Alert
                                        type='info'
                                        showIcon
                                        title={`站内展示前 ${detail.commentItems.length} 条评论`}
                                        description='该 Issue 评论较多，可前往 GitHub 查看剩余评论。'
                                        action={
                                            <Button href={detail.htmlUrl} target='_blank' rel='noopener noreferrer'>
                                                查看全部
                                            </Button>
                                        }
                                    />
                                )}
                            </main>

                            <aside className='repo-issue-detail-sidebar'>
                                <SidebarSection icon={<TagsOutlined />} title='标签'>
                                    {detail.labels.length > 0 ? (
                                        <Space size={[4, 6]} wrap>
                                            {detail.labels.map((label) => (
                                                <Tooltip key={label.name} title={label.description}>
                                                    <Tag color={`#${label.color}`} style={{ margin: 0 }}>
                                                        {label.name}
                                                    </Tag>
                                                </Tooltip>
                                            ))}
                                        </Space>
                                    ) : (
                                        <Text type='secondary'>无标签</Text>
                                    )}
                                </SidebarSection>
                                <SidebarSection icon={<TeamOutlined />} title='负责人'>
                                    {detail.assignees.length > 0 ? (
                                        <Space direction='vertical' size={8}>
                                            {detail.assignees.map((assignee) => (
                                                <UserLink key={assignee.login} user={assignee} />
                                            ))}
                                        </Space>
                                    ) : (
                                        <Text type='secondary'>未指派</Text>
                                    )}
                                </SidebarSection>
                                <SidebarSection title='里程碑'>
                                    <Text type={detail.milestoneTitle ? undefined : 'secondary'}>
                                        {detail.milestoneTitle || '无里程碑'}
                                    </Text>
                                </SidebarSection>
                                {detail.activeLockReason && (
                                    <SidebarSection icon={<LockOutlined />} title='锁定原因'>
                                        <Text>{detail.activeLockReason}</Text>
                                    </SidebarSection>
                                )}
                            </aside>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

function IssueStateTag({ detail }: { detail: GithubIssueDetail }) {
    if (detail.state === 'open') {
        return (
            <Tag color='success' icon={<IssuesCloseOutlined />} className='repo-issue-detail-state'>
                开启
            </Tag>
        )
    }
    return (
        <Tag color='purple' icon={<CheckCircleOutlined />} className='repo-issue-detail-state'>
            {detail.stateReason === 'not_planned' ? '关闭为不计划' : '已完成'}
        </Tag>
    )
}

interface ConversationCardProps {
    user: GithubIssueUser | null
    body: string
    createdAt: string
    updatedAt: string
    authorAssociation: string
    reactions: GithubIssueReactions
    originalUrl: string
    isOriginal?: boolean
}

function ConversationCard({
    user,
    body,
    createdAt,
    updatedAt,
    authorAssociation,
    reactions,
    originalUrl,
    isOriginal = false,
}: ConversationCardProps) {
    const { token } = theme.useToken()
    const wasEdited = updatedAt && updatedAt !== createdAt

    return (
        <article className='repo-issue-comment'>
            <Avatar className='repo-issue-comment-avatar' src={user?.avatarUrl} alt={user?.login || 'ghost'}>
                {(user?.login || 'G').slice(0, 1).toUpperCase()}
            </Avatar>
            <div className='repo-issue-comment-card' style={{ borderColor: token.colorBorderSecondary }}>
                <header
                    className='repo-issue-comment-header'
                    style={{
                        background: token.colorFillQuaternary,
                        borderBottomColor: token.colorBorderSecondary,
                        boxShadow: isOriginal ? `inset 3px 0 0 ${token.colorSuccess}` : undefined,
                    }}
                >
                    <span>
                        <UserLink user={user} />{' '}
                        <Text type='secondary'>
                            于 {getRelativeTime(createdAt)}
                            {isOriginal ? '发布' : '评论'}
                            {wasEdited ? ' · 已编辑' : ''}
                        </Text>
                    </span>
                    <Space size={6}>
                        {authorAssociation && authorAssociation !== 'NONE' && <Tag>{formatAssociation(authorAssociation)}</Tag>}
                        <a href={originalUrl} target='_blank' rel='noopener noreferrer' aria-label='在 GitHub 查看此内容'>
                            <GithubOutlined />
                        </a>
                    </Space>
                </header>
                <div className='repo-issue-comment-body'>
                    {body ? (
                        <MarkdownRenderer content={body} className='repo-issue-markdown' />
                    ) : (
                        <Text type='secondary'>未提供描述。</Text>
                    )}
                    <ReactionSummary reactions={reactions} />
                </div>
            </div>
        </article>
    )
}

function UserLink({ user }: { user: GithubIssueUser | null }) {
    if (!user) return <Text strong>ghost</Text>
    return (
        <a href={user.htmlUrl} target='_blank' rel='noopener noreferrer' className='repo-issue-user-link'>
            <Avatar size={20} src={user.avatarUrl} alt={user.login}>
                {user.login.slice(0, 1).toUpperCase()}
            </Avatar>
            <strong>{user.login}</strong>
        </a>
    )
}

function SidebarSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className='repo-issue-sidebar-section'>
            <Text strong>
                {icon} {title}
            </Text>
            <div>{children}</div>
        </section>
    )
}

function ReactionSummary({ reactions }: { reactions: GithubIssueReactions }) {
    const entries = [
        ['👍', reactions.plusOne],
        ['👎', reactions.minusOne],
        ['😄', reactions.laugh],
        ['🎉', reactions.hooray],
        ['😕', reactions.confused],
        ['❤️', reactions.heart],
        ['🚀', reactions.rocket],
        ['👀', reactions.eyes],
    ] as const
    const visible = entries.filter(([, count]) => count > 0)
    if (visible.length === 0) return null
    return (
        <Space size={[6, 6]} wrap className='repo-issue-reactions'>
            {visible.map(([emoji, count]) => (
                <Tag key={emoji}>
                    {emoji} {count}
                </Tag>
            ))}
        </Space>
    )
}

function formatAssociation(value: string): string {
    const labels: Record<string, string> = {
        OWNER: '所有者',
        MEMBER: '成员',
        COLLABORATOR: '协作者',
        CONTRIBUTOR: '贡献者',
        FIRST_TIME_CONTRIBUTOR: '首次贡献',
    }
    return labels[value] || value
}
