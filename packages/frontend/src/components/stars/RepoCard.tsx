import { memo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Tag, Typography, Avatar, Space } from 'antd'
import { StarFilled, ForkOutlined, ReadOutlined } from '@ant-design/icons'
import { formatNumberCn, formatDate, daysSince, getStalenessColor } from '@/utils/format'
import type { GithubRepo } from '@/types'

const { Text, Paragraph } = Typography

interface RepoCardProps {
    repo: GithubRepo
}

/** 网格卡片视图 — 每个仓库展示为可点击卡片（React.memo 避免列表项无效重渲染） */
const RepoCard = memo(function RepoCard({ repo }: RepoCardProps) {
    const navigate = useNavigate()

    let descriptionContent: ReactNode
    if (repo.descriptionCn) {
        descriptionContent = (
            <Paragraph
                ellipsis={{ rows: 2 }}
                style={{ marginBottom: 10, fontSize: 14, minHeight: 40, color: '#333', lineHeight: '1.6' }}
            >
                {repo.descriptionCn}
                <Text type='secondary' style={{ fontSize: 12, marginLeft: 4 }}>
                    🇨🇳
                </Text>
            </Paragraph>
        )
    } else if (repo.description) {
        descriptionContent = (
            <Paragraph
                type='secondary'
                ellipsis={{ rows: 2 }}
                style={{ marginBottom: 10, fontSize: 14, minHeight: 40, lineHeight: '1.6' }}
            >
                {repo.description}
            </Paragraph>
        )
    } else {
        descriptionContent = null
    }

    let readmeTag: ReactNode
    if (repo.readmeFetched && repo.readmeCn) {
        readmeTag = (
            <Tag color='purple' style={{ margin: 0, fontSize: 12 }}>
                <ReadOutlined style={{ fontSize: 11 }} /> 已翻译
            </Tag>
        )
    } else if (repo.readmeFetched) {
        readmeTag = (
            <Tag color='default' style={{ margin: 0, fontSize: 12 }}>
                无README
            </Tag>
        )
    } else {
        readmeTag = null
    }

    return (
        <Card
            hoverable
            style={{ height: '100%', cursor: 'pointer' }}
            styles={{ body: { padding: 16 } }}
            onClick={() => navigate(`/stars/${repo.id}`)}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={48} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                    <Text strong style={{ fontSize: 16, display: 'block', lineHeight: '24px' }} ellipsis>
                        <span style={{ color: '#1677ff' }}>{repo.repoName}</span>
                    </Text>
                    <Text type='secondary' style={{ fontSize: 14 }} ellipsis>
                        {repo.ownerName}
                    </Text>
                </div>
            </div>
            {descriptionContent}
            {/* 标签行 — 语言 + 翻译状态 */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {repo.language && (
                    <Tag color='processing' style={{ margin: 0, fontSize: 12, borderRadius: 10 }}>
                        {repo.language}
                    </Tag>
                )}
                {readmeTag}
                <Space size={4}>
                    <StarFilled style={{ color: '#faad14', fontSize: 14 }} />
                    <Text style={{ fontSize: 14 }}>{repo.starsCount}</Text>
                    <Text type='secondary' style={{ fontSize: 12 }}>
                        {formatNumberCn(repo.starsCount)}
                    </Text>
                </Space>
                <Space size={4}>
                    <ForkOutlined style={{ fontSize: 14 }} />
                    <Text style={{ fontSize: 14 }}>{repo.forksCount}</Text>
                    <Text type='secondary' style={{ fontSize: 12 }}>
                        {formatNumberCn(repo.forksCount)}
                    </Text>
                </Space>
            </div>
            {/* 分类标签 - 已移除 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <Text type='secondary' style={{ fontSize: 13 }}>
                    Star 于 {formatDate(repo.starredAt)}
                </Text>
                {repo.repoPushedAt &&
                    (() => {
                        const days = daysSince(repo.repoPushedAt)
                        const color = getStalenessColor(days)
                        return (
                            <Tag color={color} style={{ margin: 0, fontSize: 12 }}>
                                未更新 {days} 天
                            </Tag>
                        )
                    })()}
            </div>
        </Card>
    )
})

export default RepoCard
