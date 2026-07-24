import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Tag, Typography, Avatar, Tooltip, theme } from 'antd'
import {
    StarFilled, ForkOutlined, ReadOutlined,
    ClockCircleOutlined, CodeOutlined,
} from '@ant-design/icons'
import { formatNumberCn, formatDate, formatSize, daysSince, getStalenessColor } from '@/utils/format'
import type { GithubRepo } from '@/types'

const { Text, Paragraph } = Typography
const { useToken } = theme

interface RepoCardProps {
    repo: GithubRepo
}

/** 语言对应的标签色（取 GitHub 常用语言色系） */
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

/**
 * 网格卡片视图 — 每个仓库展示为可点击卡片。
 *
 * 设计要点：
 * - 使用 Ant Design 主题 token，自动适配亮/暗模式
 * - Star 数作为视觉焦点，与仓库名同级展示
 * - 语言用带色圆点 + 文字，更简洁易扫
 * - 中文翻译状态用优雅标签展示
 * - "未更新"天数通过色阶表达保鲜度
 */
const RepoCard = memo(function RepoCard({ repo }: RepoCardProps) {
    const navigate = useNavigate()
    const { token } = useToken()

    const descriptionText = repo.descriptionCn ?? repo.description
    const hasTranslation = Boolean(repo.descriptionCn)
    const days = repo.repoPushedAt ? daysSince(repo.repoPushedAt) : null
    const langColor = repo.language ? LANG_COLORS[repo.language] : token.colorBorderSecondary

    return (
        <Card
            hoverable
            style={{
                height: '100%',
                width: '100%',
                maxWidth: '100%',
                cursor: 'pointer',
                borderRadius: token.borderRadiusLG,
                borderColor: token.colorBorderSecondary,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                overflow: 'hidden',
            }}
            styles={{
                body: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' },
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = token.colorPrimary
                e.currentTarget.style.boxShadow = `0 0 0 1px ${token.colorPrimary}10`
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = token.colorBorderSecondary
                e.currentTarget.style.boxShadow = 'none'
            }}
            onClick={() => navigate(`/stars/${repo.id}`)}
        >
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
                        {/* Star 数 — 视觉焦点 */}
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
                        {repo.ownerName}
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

            {/* 底部分隔行：标签 + 元信息 */}
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
                {/* 语言标记 — 色点 + 文字 */}
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

                {/* 代码浏览入口 — 阻止冒泡避免触发卡片跳转详情 */}
                <Tooltip title='在线浏览代码'>
                    <CodeOutlined
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/code-browser?repo=${encodeURIComponent(repo.fullName)}`)
                        }}
                        style={{ fontSize: 13, color: token.colorPrimary, cursor: 'pointer' }}
                    />
                </Tooltip>

                {/* Fork */}
                {repo.forksCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: token.colorTextTertiary }}>
                        <ForkOutlined style={{ fontSize: 12 }} />
                        {repo.forksCount}
                    </span>
                )}

                {/* 文件大小 */}
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
                    <Tooltip title={`最近推送于 ${formatDate(repo.repoPushedAt!)}`}>
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

            {/* Star 日期 — 始终展示在最底部 */}
            <div style={{ fontSize: 11, color: token.colorTextQuaternary, lineHeight: 1 }}>
                Star 于 {formatDate(repo.starredAt)}
            </div>
        </Card>
    )
})

export default RepoCard
