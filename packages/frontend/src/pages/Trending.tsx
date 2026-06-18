import { useState, useEffect, useCallback } from 'react'
import { Segmented, Select, Card, Spin, Empty, Typography, Tag, Space, Row, Col, App } from 'antd'
import { StarFilled, ForkOutlined, FireOutlined } from '@ant-design/icons'
import { fetchTrending } from '../api/trending'
import type { GithubSearchRepo } from '../types'
import { LANGUAGE_OPTIONS, RANK_BADGE_COLORS } from '../constants'
import { formatNumberShort, getRelativeTime } from '../utils/format'

const { Title, Text, Paragraph } = Typography

export default function Trending() {
    const { message } = App.useApp()
    const [since, setSince] = useState<string>('daily')
    const [language, setLanguage] = useState<string>('')
    const [repos, setRepos] = useState<GithubSearchRepo[]>([])
    const [total, setTotal] = useState(0)
    const [dateRange, setDateRange] = useState('')
    const [loading, setLoading] = useState(false)

    const load = useCallback(async (s: string, lang: string) => {
        setLoading(true)
        try {
            const data = await fetchTrending(s, lang || undefined, 20)
            setRepos(data.repos || [])
            setTotal(data.total || 0)
            setDateRange(data.dateRange || '')
        } catch {
            message.error('加载趋势数据失败')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load(since, language)
    }, [since, language, load])

    return (
        <div>
            <div
                style={{
                    marginBottom: 24,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <Title level={3} style={{ margin: 0 }}>
                    <FireOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                    趋势排行榜
                </Title>
                <Space wrap size={[8, 8]}>
                    <Select
                        value={language || ''}
                        onChange={(v) => setLanguage(v)}
                        options={LANGUAGE_OPTIONS}
                        style={{ width: 140 }}
                        placeholder='语言'
                    />
                    <Segmented
                        value={since}
                        onChange={(v) => {
                            setSince(v as string)
                        }}
                        options={[
                            { value: 'daily', label: '今日' },
                            { value: 'weekly', label: '本周' },
                            { value: 'monthly', label: '本月' },
                        ]}
                    />
                </Space>
            </div>

            <Spin spinning={loading}>
                {dateRange && (
                    <Text type='secondary' style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
                        统计时段: {dateRange} | 共 {total} 个新仓库
                    </Text>
                )}

                {repos.length === 0 && !loading ? (
                    <Empty description='暂无趋势数据' style={{ marginTop: 60 }} />
                ) : (
                    <Row gutter={[16, 16]}>
                        {repos.map((repo, idx) => (
                            <Col xs={24} sm={12} lg={8} key={repo.id}>
                                <Card hoverable size='small' styles={{ body: { padding: 16 } }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        {/* 排名徽章 */}
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 8,
                                                flexShrink: 0,
                                                background: idx < 3 ? RANK_BADGE_COLORS[idx] : '#f0f0f0',
                                                color: idx < 3 ? '#fff' : '#666',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                                fontSize: idx < 3 ? 16 : 13,
                                            }}
                                        >
                                            {idx + 1}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <img
                                                    src={repo.ownerAvatarUrl}
                                                    alt=''
                                                    style={{ width: 18, height: 18, borderRadius: '50%' }}
                                                />
                                                <a
                                                    href={repo.htmlUrl}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    style={{ fontWeight: 600, fontSize: 14, color: '#1677ff' }}
                                                >
                                                    {repo.fullName}
                                                </a>
                                            </div>

                                            {repo.description && (
                                                <Paragraph
                                                    ellipsis={{ rows: 2 }}
                                                    type='secondary'
                                                    style={{ fontSize: 12, marginBottom: 8 }}
                                                >
                                                    {repo.description}
                                                </Paragraph>
                                            )}

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                                {repo.language && (
                                                    <Tag color='blue' style={{ fontSize: 11, margin: 0 }}>
                                                        {repo.language}
                                                    </Tag>
                                                )}
                                                <span>
                                                    <StarFilled style={{ color: '#faad14', fontSize: 12 }} />{' '}
                                                    <Text style={{ fontSize: 13, fontWeight: 600 }}>
                                                        {formatNumberShort(repo.starsCount)}
                                                    </Text>
                                                </span>
                                                <span>
                                                    <ForkOutlined style={{ fontSize: 12 }} />{' '}
                                                    <Text style={{ fontSize: 12 }}>{formatNumberShort(repo.forksCount)}</Text>
                                                </span>
                                                <Text type='secondary' style={{ fontSize: 11, marginLeft: 'auto' }}>
                                                    {getRelativeTime(repo.pushedAt)}
                                                </Text>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                )}
            </Spin>
        </div>
    )
}
