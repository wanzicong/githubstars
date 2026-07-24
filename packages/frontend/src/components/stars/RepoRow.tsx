import { memo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Tag, Typography, Avatar, Tooltip } from 'antd'
import { StarFilled, ForkOutlined, ReadOutlined, CodeOutlined } from '@ant-design/icons'
import { formatNumberCn, formatDate, formatSize, daysSince, getStalenessColor } from '@/utils/format'
import type { GithubRepo } from '@/types'

const { Text, Paragraph } = Typography

interface RepoRowProps {
    repo: GithubRepo
}

/** 列表行视图 — 每个仓库展示为横向行卡片（React.memo 避免列表项无效重渲染） */
const RepoRow = memo(function RepoRow({ repo }: RepoRowProps) {
    const navigate = useNavigate()

    let readmeTag: ReactNode
    if (repo.readmeFetched && repo.readmeCn) {
        readmeTag = (
            <Tag color='purple' style={{ margin: 0, fontSize: 11 }}>
                <ReadOutlined style={{ fontSize: 10 }} /> 已翻译
            </Tag>
        )
    } else if (repo.readmeFetched) {
        readmeTag = (
            <Tag color='default' style={{ margin: 0, fontSize: 11 }}>
                无README
            </Tag>
        )
    } else {
        readmeTag = null
    }

    let descriptionContent: ReactNode
    if (repo.descriptionCn) {
        descriptionContent = (
            <Paragraph
                ellipsis={{ rows: 1 }}
                style={{
                    margin: '4px 0 0', fontSize: 14, color: '#333',
                    lineHeight: '1.6', width: '100%', overflow: 'hidden', wordBreak: 'break-word'
                }}
            >
                {repo.descriptionCn}
            </Paragraph>
        )
    } else if (repo.description) {
        descriptionContent = (
            <Paragraph
                type='secondary'
                ellipsis={{ rows: 1 }}
                style={{
                    margin: '4px 0 0', fontSize: 14,
                    lineHeight: '1.6', width: '100%', overflow: 'hidden', wordBreak: 'break-word'
                }}
            >
                {repo.description}
            </Paragraph>
        )
    } else {
        descriptionContent = null
    }

    return (
        <Card
            hoverable
            style={{ cursor: 'pointer', overflow: 'hidden', width: '100%', maxWidth: '100%' }}
            styles={{ body: { padding: 12, overflow: 'hidden' } }}
            onClick={() => navigate(`/stars/${repo.id}`)}
        >
            <Row align='middle' gutter={[12, 8]}>
                <Col xs={24} sm={12} md={14}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={44} style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0, width: '100%' }}>
                            <Text strong style={{ fontSize: 16, color: '#1677ff', maxWidth: '100%' }} ellipsis>
                                {repo.repoName}
                            </Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                <Text type='secondary' style={{ fontSize: 13 }}>
                                    {repo.ownerName}
                                </Text>
                                {repo.language && (
                                    <Tag color='blue' style={{ margin: 0, fontSize: 12 }}>
                                        {repo.language}
                                    </Tag>
                                )}
                                {readmeTag}
                            </div>
                            {descriptionContent}
                            {/* 分类标签 - 已移除 */}
                        </div>
                    </div>
                </Col>
                <Col xs={24} sm={12} md={10}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                        {/* 代码浏览入口 — 阻止冒泡避免触发卡片跳转详情 */}
                        <Tooltip title='在线浏览代码'>
                            <CodeOutlined
                                onClick={(e) => {
                                    e.stopPropagation()
                                    navigate(`/code-browser?repo=${encodeURIComponent(repo.fullName)}`)
                                }}
                                style={{ fontSize: 15, color: '#1677ff', cursor: 'pointer' }}
                            />
                        </Tooltip>
                        <span>
                            <StarFilled style={{ color: '#faad14', fontSize: 14 }} />{' '}
                            <Text style={{ fontSize: 15 }}>{repo.starsCount}</Text>
                            <Text type='secondary' style={{ fontSize: 12, marginLeft: 2 }}>
                                {formatNumberCn(repo.starsCount)}
                            </Text>
                        </span>
                        <span>
                            <ForkOutlined style={{ fontSize: 14 }} /> <Text style={{ fontSize: 15 }}>{repo.forksCount}</Text>
                            <Text type='secondary' style={{ fontSize: 12, marginLeft: 2 }}>
                                {formatNumberCn(repo.forksCount)}
                            </Text>
                        </span>
                        {repo.repoSize != null && repo.repoSize > 0 && (
                            <Text type='secondary' style={{ fontSize: 13 }}>
                                {formatSize(repo.repoSize * 1024)}
                            </Text>
                        )}
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
                        <Text type='secondary' style={{ fontSize: 13 }}>
                            Star 于 {formatDate(repo.starredAt)}
                        </Text>
                    </div>
                </Col>
            </Row>
        </Card>
    )
})

export default RepoRow
