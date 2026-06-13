import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Tag, Typography, Avatar } from 'antd'
import { StarFilled, ForkOutlined, ReadOutlined } from '@ant-design/icons'
import { formatNumberCn } from '@/utils/format'
import type { GithubRepo } from '@/types'

const { Text, Paragraph } = Typography

function formatDate(dateStr: string | number[] | null): string {
    if (!dateStr) return '-'
    if (Array.isArray(dateStr)) {
        const [y, m, d] = dateStr
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
    if (typeof dateStr === 'string') {
        return dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr
    }
    return String(dateStr)
}

interface RepoRowProps {
    repo: GithubRepo
}

/** 列表行视图 — 每个仓库展示为横向行卡片（React.memo 避免列表项无效重渲染） */
const RepoRow = memo(function RepoRow({ repo }: RepoRowProps) {
    const navigate = useNavigate()

    return (
        <Card
            hoverable
            style={{ cursor: 'pointer' }}
            styles={{ body: { padding: 12 } }}
            onClick={() => navigate(`/stars/${repo.id}`)}
        >
            <Row align='middle' gutter={[12, 8]}>
                <Col xs={24} sm={12} md={14}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={44} style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                            <Text strong style={{ fontSize: 16 }} ellipsis>
                                <span style={{ color: '#1677ff' }}>{repo.repoName}</span>
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
                                {repo.tagNames &&
                                    repo.tagNames.length > 0 &&
                                    repo.tagNames.slice(0, 2).map((t) => (
                                        <Tag key={t} color='cyan' style={{ margin: 0, fontSize: 12, borderRadius: 10 }}>
                                            {t}
                                        </Tag>
                                    ))}
                                {repo.readmeFetched && repo.readmeCn ? (
                                    <Tag color='purple' style={{ margin: 0, fontSize: 11 }}>
                                        <ReadOutlined style={{ fontSize: 10 }} /> 已翻译
                                    </Tag>
                                ) : repo.readmeFetched ? (
                                    <Tag color='default' style={{ margin: 0, fontSize: 11 }}>
                                        无README
                                    </Tag>
                                ) : null}
                            </div>
                            {repo.descriptionCn ? (
                                <Paragraph
                                    ellipsis={{ rows: 1 }}
                                    style={{ margin: '4px 0 0', fontSize: 14, color: '#333', lineHeight: '1.6' }}
                                >
                                    {repo.descriptionCn}
                                </Paragraph>
                            ) : repo.description ? (
                                <Paragraph
                                    type='secondary'
                                    ellipsis={{ rows: 1 }}
                                    style={{ margin: '4px 0 0', fontSize: 14, lineHeight: '1.6' }}
                                >
                                    {repo.description}
                                </Paragraph>
                            ) : null}
                        </div>
                    </div>
                </Col>
                <Col xs={24} sm={12} md={10}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
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
                        {repo.repoPushedAt &&
                            (() => {
                                const days = Math.floor(
                                    (Date.now() - new Date(repo.repoPushedAt).getTime()) / (1000 * 60 * 60 * 24),
                                )
                                let color: string = 'green'
                                if (days > 180) color = 'red'
                                else if (days > 30) color = 'orange'
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
