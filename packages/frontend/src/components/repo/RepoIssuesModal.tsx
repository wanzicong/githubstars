import { useEffect, useRef, useState } from 'react'
import {
    Alert,
    Avatar,
    Button,
    Empty,
    Input,
    Modal,
    Pagination,
    Segmented,
    Select,
    Skeleton,
    Space,
    Tag,
    Tooltip,
    Typography,
    theme,
} from 'antd'
import { CheckCircleOutlined, CommentOutlined, GithubOutlined, IssuesCloseOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons'
import { fetchRepoIssues } from '../../api'
import { getRelativeTime } from '../../utils/format'
import type { GithubIssue, GithubIssueListResult, GithubIssueSort, GithubIssueState } from '../../types'
import RepoIssueDetail from './RepoIssueDetail'

const { Search } = Input
const { Text } = Typography
const PAGE_SIZE = 20
const GITHUB_SEARCH_LIMIT = 1000

const EMPTY_RESULT: GithubIssueListResult = {
    items: [],
    totalCount: 0,
    incompleteResults: false,
    page: 1,
    perPage: PAGE_SIZE,
}

interface RepoIssuesModalProps {
    fullName: string
    htmlUrl: string
    open: boolean
    onClose: () => void
}

/**
 * GitHub 风格仓库 Issues 列表弹框。
 *
 * 支持状态筛选、关键词搜索、排序、分页、刷新，以及跳转 GitHub 查看原 Issue。
 */
export default function RepoIssuesModal({ fullName, htmlUrl, open, onClose }: RepoIssuesModalProps) {
    const { token } = theme.useToken()
    const [owner, repoName] = fullName.split('/')
    const requestSequence = useRef(0)
    const [issueState, setIssueState] = useState<GithubIssueState>('open')
    const [searchInput, setSearchInput] = useState('')
    const [query, setQuery] = useState('')
    const [sort, setSort] = useState<GithubIssueSort>('updated')
    const [page, setPage] = useState(1)
    const [reloadKey, setReloadKey] = useState(0)
    const [result, setResult] = useState<GithubIssueListResult>(EMPTY_RESULT)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(null)

    useEffect(() => {
        if (!open) return
        const sequence = ++requestSequence.current
        queueMicrotask(() => {
            if (requestSequence.current !== sequence) return
            setLoading(true)
            setError(null)

            fetchRepoIssues({
                owner,
                repo: repoName,
                state: issueState,
                query,
                sort,
                order: 'desc',
                page,
                perPage: PAGE_SIZE,
            })
                .then((data) => {
                    if (requestSequence.current === sequence) {
                        setResult(data)
                    }
                })
                .catch((requestError: unknown) => {
                    if (requestSequence.current !== sequence) return
                    const readableError = requestError as { userMessage?: string; message?: string }
                    setError(readableError.userMessage || readableError.message || 'Issues 加载失败')
                    setResult({ ...EMPTY_RESULT, page })
                })
                .finally(() => {
                    if (requestSequence.current === sequence) {
                        setLoading(false)
                    }
                })
        })

        return () => {
            if (requestSequence.current === sequence) {
                requestSequence.current += 1
            }
        }
    }, [issueState, open, page, query, reloadKey, sort, owner, repoName])

    const handleStateChange = (value: string | number) => {
        setIssueState(value as GithubIssueState)
        setPage(1)
    }

    const handleSearch = (value: string) => {
        const normalized = value.trim()
        setSearchInput(value)
        setPage(1)
        if (normalized === query) {
            setReloadKey((current) => current + 1)
        } else {
            setQuery(normalized)
        }
    }

    const handleSortChange = (value: GithubIssueSort) => {
        setSort(value)
        setPage(1)
    }

    const availableTotal = Math.min(result.totalCount, GITHUB_SEARCH_LIMIT)
    const renderIssuesContent = () => {
        if (error) {
            return (
                <div className='repo-issues-feedback'>
                    <Alert
                        type='error'
                        showIcon
                        title='Issues 加载失败'
                        description={error}
                        action={
                            <Button size='small' onClick={() => setReloadKey((current) => current + 1)}>
                                重试
                            </Button>
                        }
                    />
                </div>
            )
        }
        if (loading && result.items.length === 0) {
            return (
                <div className='repo-issues-skeleton'>
                    {Array.from({ length: 6 }, (_, index) => (
                        <Skeleton key={index} active avatar paragraph={{ rows: 2 }} />
                    ))}
                </div>
            )
        }
        if (result.items.length === 0) {
            return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? '没有匹配的 Issue' : '当前筛选下没有 Issue'} />
        }
        return (
            <div className='repo-issues-list' role='list' aria-busy={loading}>
                {result.items.map((issue) => (
                    <IssueListItem key={issue.id} issue={issue} onSelect={setSelectedIssueNumber} />
                ))}
            </div>
        )
    }

    return (
        <Modal
            className='repo-issues-modal'
            title={
                <Space size={8} style={{ minWidth: 0, maxWidth: '100%' }}>
                    <IssuesCloseOutlined style={{ color: '#1a7f37' }} />
                    <span>{selectedIssueNumber ? `Issue #${selectedIssueNumber}` : 'Issues'}</span>
                    <Text type='secondary' ellipsis={{ tooltip: fullName }} style={{ maxWidth: '42vw', fontWeight: 400 }}>
                        {fullName}
                    </Text>
                </Space>
            }
            open={open}
            onCancel={() => {
                setSelectedIssueNumber(null)
                onClose()
            }}
            footer={null}
            width='calc(100vw - 24px)'
            centered
            destroyOnHidden
            styles={{
                container: {
                    height: 'calc(100dvh - 24px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    padding: 0,
                },
                header: {
                    flex: 'none',
                    margin: 0,
                    padding: '14px 52px 14px 20px',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                },
                body: {
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    padding: 0,
                },
            }}
        >
            {selectedIssueNumber ? (
                <RepoIssueDetail
                    issueNumber={selectedIssueNumber}
                    fullName={fullName}
                    onBack={() => setSelectedIssueNumber(null)}
                />
            ) : (
                <div className='repo-issues-layout'>
                    <div className='repo-issues-toolbar' style={{ borderBottomColor: token.colorBorderSecondary }}>
                        <Search
                            aria-label='搜索 Issues'
                            value={searchInput}
                            placeholder='搜索标题、正文或 GitHub 限定词'
                            allowClear
                            enterButton='搜索'
                            onChange={(event) => setSearchInput(event.target.value)}
                            onSearch={handleSearch}
                        />
                        <Segmented
                            aria-label='Issue 状态'
                            value={issueState}
                            onChange={handleStateChange}
                            options={[
                                { label: '开启', value: 'open', icon: <IssuesCloseOutlined /> },
                                { label: '已关闭', value: 'closed', icon: <CheckCircleOutlined /> },
                                { label: '全部', value: 'all' },
                            ]}
                        />
                        <Space size={8} className='repo-issues-actions'>
                            <Select<GithubIssueSort>
                                aria-label='Issue 排序'
                                value={sort}
                                onChange={handleSortChange}
                                popupMatchSelectWidth={false}
                                options={[
                                    { label: '最近更新', value: 'updated' },
                                    { label: '最新创建', value: 'created' },
                                    { label: '评论最多', value: 'comments' },
                                ]}
                            />
                            <Tooltip title='刷新 Issues'>
                                <Button
                                    aria-label='刷新 Issues'
                                    icon={<ReloadOutlined />}
                                    onClick={() => setReloadKey((current) => current + 1)}
                                />
                            </Tooltip>
                            <Button icon={<GithubOutlined />} href={`${htmlUrl}/issues`} target='_blank' rel='noopener noreferrer'>
                                GitHub
                            </Button>
                        </Space>
                    </div>

                    <div
                        className='repo-issues-summary'
                        style={{
                            color: token.colorTextSecondary,
                            background: token.colorFillQuaternary,
                            borderBottomColor: token.colorBorderSecondary,
                        }}
                    >
                        <Text strong>{result.totalCount.toLocaleString()} 个 Issue</Text>
                        {query && <Text type='secondary'>搜索：{query}</Text>}
                        {result.incompleteResults && <Text type='warning'>GitHub 搜索仍在索引中，结果可能不完整</Text>}
                    </div>

                    <div className='repo-issues-content'>{renderIssuesContent()}</div>

                    <div className='repo-issues-pagination' style={{ borderTopColor: token.colorBorderSecondary }}>
                        <Pagination
                            current={page}
                            pageSize={PAGE_SIZE}
                            total={availableTotal}
                            showSizeChanger={false}
                            hideOnSinglePage={availableTotal <= PAGE_SIZE}
                            showTotal={(total, range) => `${range[0]}-${range[1]} / ${total}`}
                            onChange={setPage}
                            responsive
                        />
                    </div>
                </div>
            )}
        </Modal>
    )
}

function IssueListItem({ issue, onSelect }: { issue: GithubIssue; onSelect: (issueNumber: number) => void }) {
    const { token } = theme.useToken()
    const isOpen = issue.state === 'open'
    const actor = issue.user?.login || 'ghost'
    const stateText = getIssueStateText(issue)
    const stateColor = isOpen ? '#1a7f37' : '#8250df'

    return (
        <div
            className='repo-issue-row'
            role='button'
            tabIndex={0}
            aria-label={`查看 Issue #${issue.number} 详情`}
            onClick={() => onSelect(issue.number)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(issue.number)
                }
            }}
        >
            <div className='repo-issue-state-icon' style={{ color: stateColor }}>
                {isOpen ? <IssuesCloseOutlined /> : <CheckCircleOutlined />}
            </div>
            <div className='repo-issue-main'>
                <div className='repo-issue-title-row'>
                    <span className='repo-issue-title' style={{ color: token.colorText }}>
                        {issue.title}
                    </span>
                    {issue.locked && (
                        <Tooltip title='讨论已锁定'>
                            <LockOutlined style={{ color: token.colorTextTertiary }} />
                        </Tooltip>
                    )}
                </div>

                {issue.labels.length > 0 && (
                    <Space size={[4, 4]} wrap className='repo-issue-labels'>
                        {issue.labels.map((label) => (
                            <Tooltip key={label.name} title={label.description}>
                                <Tag
                                    style={{
                                        margin: 0,
                                        borderColor: `#${label.color}`,
                                        background: `#${label.color}`,
                                        color: getLabelTextColor(label.color),
                                        borderRadius: 12,
                                        fontWeight: 600,
                                    }}
                                >
                                    {label.name}
                                </Tag>
                            </Tooltip>
                        ))}
                    </Space>
                )}

                <div className='repo-issue-meta'>
                    <Text type='secondary'>
                        #{issue.number} · {stateText} · {actor} 于 {getRelativeTime(issue.createdAt)}创建
                    </Text>
                    {issue.milestoneTitle && <Text type='secondary'>里程碑：{issue.milestoneTitle}</Text>}
                </div>
            </div>

            <div className='repo-issue-side'>
                {issue.assignees.length > 0 && (
                    <Avatar.Group size={24} max={{ count: 3 }}>
                        {issue.assignees.map((assignee) => (
                            <Tooltip key={assignee.login} title={`指派给 ${assignee.login}`}>
                                <Avatar src={assignee.avatarUrl} alt={assignee.login}>
                                    {assignee.login.slice(0, 1).toUpperCase()}
                                </Avatar>
                            </Tooltip>
                        ))}
                    </Avatar.Group>
                )}
                {issue.comments > 0 && (
                    <span
                        className='repo-issue-comments'
                        aria-label={`${issue.comments} 条评论`}
                        style={{ color: token.colorTextSecondary }}
                    >
                        <CommentOutlined />
                        <span>{issue.comments}</span>
                    </span>
                )}
            </div>
        </div>
    )
}

function getIssueStateText(issue: GithubIssue): string {
    if (issue.state === 'open') return '开启'
    if (issue.stateReason === 'not_planned') return '关闭为不计划'
    return '已关闭'
}

function getLabelTextColor(hexColor: string): string {
    const normalized = hexColor.replace('#', '').padEnd(6, '0').slice(0, 6)
    const red = Number.parseInt(normalized.slice(0, 2), 16)
    const green = Number.parseInt(normalized.slice(2, 4), 16)
    const blue = Number.parseInt(normalized.slice(4, 6), 16)
    if ([red, green, blue].some(Number.isNaN)) return '#1f2328'
    const luminance = (red * 299 + green * 587 + blue * 114) / 255000
    return luminance > 0.58 ? '#1f2328' : '#ffffff'
}
