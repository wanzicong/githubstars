import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Tag, Typography, Avatar, Tooltip, theme, Checkbox } from 'antd'
import {
    StarFilled, ForkOutlined, ReadOutlined,
    ClockCircleOutlined, CodeOutlined, LockOutlined, FolderOutlined,
} from '@ant-design/icons'
import { formatNumberCn, formatDate, formatSize, daysSince, getStalenessColor } from '@/utils/format'
import type { MyRepo } from '@/types'
import MyRepoCategoryPopover from './MyRepoCategoryPopover'

const { Text, Paragraph } = Typography
const { useToken } = theme

/** 语言对应的标签色（与星标仓库卡片保持一致的 GitHub 常用语言色系） */
const LANG_COLORS: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f7df1e',
    Python: '#3572a5',
    Java: '#b07219',
    Go: '#00add8',
    Rust: '#dea584',
    'C++': '#f34b7d',
    C: '#555555',
    Ruby: '#701516',
    PHP: '#4f5d95',
    Swift: '#f05138',
    Kotlin: '#a97bff',
    Dart: '#00b4ab',
    Shell: '#89e051',
    HTML: '#e34c26',
    CSS: '#563d7c',
}

interface MyRepoCardProps {
    repo: MyRepo
    /** 是否已选中（批量操作用） */
    selected: boolean
    /** 选中状态切换回调 */
    onSelect: (repoId: number, checked: boolean) => void
    /** 分类绑定变化回调（刷新列表） */
    onCategoryChange: () => void
}

/**
 * 我的仓库网格卡片 — 与星标仓库卡片视觉一致，差异点：
 * - 跳转 /my-repos/:id 详情
 * - 展示私有/公开标记（LockOutlined）
 * - 左上角选择框支持批量操作
 * - 底部日期展示仓库创建时间（我的仓库无 starredAt）
 * - 内嵌分类绑定 Popover（替代学习清单入口）
 */
const MyRepoCard = memo(function MyRepoCard({ repo, selected, onSelect, onCategoryChange }: MyRepoCardProps) {
    const navigate = useNavigate()
    const { token } = useToken()

    const descriptionText = repo.descriptionCn ?? repo.description
    const hasTranslation = Boolean(repo.descriptionCn)
    const days = repo.repoPushedAt ? daysSince(repo.repoPushedAt) : null
    const langColor = repo.language ? LANG_COLORS[repo.language] : token.colorBorderSecondary

    const topics = useMemo(() => {
        if (!repo.topics) return []
        try {
            const parsed: unknown = JSON.parse(repo.topics)
            return Array.isArray(parsed) ? parsed.slice(0, 3).map(String) : []
        } catch {
            return []
        }
    }, [repo.topics])

    const boundCategoryIds = useMemo(() => (repo.categories ?? []).map((c) => c.id), [repo.categories])

    return (
        <Card
            hoverable
            className='hoverable-card'
            style={{
                height: '100%',
                width: '100%',
                maxWidth: '100%',
                cursor: 'pointer',
                borderRadius: token.borderRadiusLG,
                borderColor: selected ? token.colorPrimary : token.colorBorderSecondary,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                overflow: 'hidden',
                position: 'relative',
            }}
            styles={{
                body: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' },
            }}
            onClick={() => navigate(`/my-repos/${repo.id}`)}
        >
            {/* 批量选择框 — 阻止冒泡避免触发卡片跳转 */}
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1 }} onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={selected} onChange={(e) => onSelect(repo.id, e.target.checked)} />
            </div>

            {/* 头部：头像 + 仓库名 + Star 数徽章 */}
            <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Avatar
                    src={repo.ownerAvatarUrl}
                    alt={repo.ownerName}
                    size={44}
                    style={{ flexShrink: 0, border: `1px solid ${token.colorBorderSecondary}` }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 1, overflow: 'hidden' }}>
                        <Text strong style={{ fontSize: 15, lineHeight: '22px', color: token.colorText, maxWidth: '100%' }} ellipsis>
                            {repo.repoName}
                        </Text>
                        {repo.isPrivate && (
                            <Tooltip title='私有仓库'>
                                <LockOutlined style={{ fontSize: 12, color: token.colorWarning, flexShrink: 0 }} />
                            </Tooltip>
                        )}
                        <Tooltip title={`${repo.starsCount.toLocaleString()} stars`}>
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    flexShrink: 0,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: token.colorTextSecondary,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <StarFilled style={{ color: '#faad14', fontSize: 13 }} />
                                {formatNumberCn(repo.starsCount)}
                            </span>
                        </Tooltip>
                    </div>
                    <Text type='secondary' style={{ fontSize: 13 }} ellipsis>
                        {repo.fullName}
                    </Text>
                </div>
            </header>

            {/* 描述文本 */}
            {descriptionText && (
                <Paragraph
                    ellipsis={{ rows: 2 }}
                    type='secondary'
                    style={{
                        marginBottom: 0,
                        fontSize: 13,
                        lineHeight: '1.6',
                        width: '100%',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                        color: hasTranslation ? token.colorText : token.colorTextTertiary,
                    }}
                >
                    {descriptionText}
                </Paragraph>
            )}

            {/* topics（最多 3 个，超长省略） */}
            {topics.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', overflow: 'hidden' }}>
                    {topics.map((t) => (
                        <Tag key={t} bordered={false} style={{ margin: 0, fontSize: 11, lineHeight: '18px', paddingInline: 6 }}>
                            {t}
                        </Tag>
                    ))}
                </div>
            )}

            {/* 底部行：语言 + 分类 + 元信息 */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 'auto',
                    paddingTop: 4,
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                }}
            >
                {repo.language && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: token.colorTextSecondary }}>
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: langColor,
                                display: 'inline-block',
                                flexShrink: 0,
                            }}
                        />
                        {repo.language}
                    </span>
                )}

                {/* 分类绑定 — 阻止冒泡避免触发卡片跳转 */}
                <span onClick={(e) => e.stopPropagation()}>
                    <MyRepoCategoryPopover repoId={repo.id} categoryIds={boundCategoryIds} onChange={onCategoryChange}>
                        <Tooltip title={boundCategoryIds.length > 0 ? `已绑定 ${boundCategoryIds.length} 个分类` : '绑定分类'}>
                            <FolderOutlined
                                style={{
                                    fontSize: 13,
                                    color: boundCategoryIds.length > 0 ? token.colorPrimary : token.colorTextTertiary,
                                    cursor: 'pointer',
                                }}
                            />
                        </Tooltip>
                    </MyRepoCategoryPopover>
                </span>

                {/* 代码浏览入口 */}
                <Tooltip title='在线浏览代码'>
                    <CodeOutlined
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/code-browser?repo=${encodeURIComponent(repo.fullName)}`)
                        }}
                        style={{ fontSize: 13, color: token.colorPrimary, cursor: 'pointer' }}
                    />
                </Tooltip>

                {repo.forksCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: token.colorTextTertiary }}>
                        <ForkOutlined style={{ fontSize: 12 }} />
                        {repo.forksCount}
                    </span>
                )}

                {repo.repoSize != null && repo.repoSize > 0 && (
                    <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                        {formatSize(repo.repoSize * 1024)}
                    </span>
                )}

                {/* 中文翻译标签 */}
                {repo.readmeFetched && repo.readmeCn && (
                    <Tag bordered={false} style={{ margin: 0, fontSize: 11, lineHeight: '18px', paddingInline: 6, color: token.colorPrimary }}>
                        <ReadOutlined style={{ fontSize: 10, marginRight: 2 }} />
                        已翻译
                    </Tag>
                )}

                {/* 保鲜度指示器 */}
                {days !== null && (
                    <Tooltip title={`最近推送于 ${formatDate(repo.repoPushedAt ?? '')}`}>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 12,
                                color: getStalenessColor(days),
                                marginLeft: 'auto',
                            }}
                        >
                            <ClockCircleOutlined style={{ fontSize: 11 }} />
                            {days}d
                        </span>
                    </Tooltip>
                )}
            </div>

            {/* 创建日期 — 我的仓库无 starredAt，展示仓库创建时间 */}
            <div style={{ fontSize: 11, color: token.colorTextQuaternary, lineHeight: 1 }}>
                创建于 {formatDate(repo.repoCreatedAt)}
            </div>
        </Card>
    )
})

export default MyRepoCard
