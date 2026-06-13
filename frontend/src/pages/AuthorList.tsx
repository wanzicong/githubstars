import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Input, Row, Col, Tag, Avatar, Typography, Pagination, Empty, Spin, Statistic } from 'antd'
import { SearchOutlined, StarFilled, GithubOutlined } from '@ant-design/icons'
import * as authorsApi from '../api/authors'
import { formatNumberCn } from '../utils/format'
import type { AuthorDTO, PageResult } from '../types'

const { Title, Text } = Typography

const PAGE_SIZE = 24

export default function AuthorList() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const keyword = searchParams.get('keyword') || ''
    const currentPage = parseInt(searchParams.get('page') || '1', 10)

    const [pageResult, setPageResult] = useState<PageResult<AuthorDTO>>({
        records: [],
        total: 0,
        size: PAGE_SIZE,
        current: 1,
        pages: 0,
    })
    const [loading, setLoading] = useState(true)

    const setUrlParam = useCallback(
        (key: string, value: string | null) => {
            const next = new URLSearchParams(searchParams)
            if (!value) {
                next.delete(key)
            } else {
                next.set(key, value)
            }
            if (key !== 'page') next.delete('page')
            navigate({ search: next.toString() }, { replace: true })
        },
        [navigate, searchParams],
    )

    useEffect(() => {
        const loadAuthors = async () => {
            setLoading(true)
            try {
                const result = await authorsApi.fetchAuthorList({
                    page: currentPage,
                    size: PAGE_SIZE,
                    keyword: keyword || undefined,
                })
                setPageResult(result)
            } catch {
                // errors logged by interceptor
            } finally {
                setLoading(false)
            }
        }
        loadAuthors()
    }, [currentPage, keyword])

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return '-'
        if (typeof dateStr === 'string') {
            return dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr
        }
        return String(dateStr)
    }

    const { records: authors } = pageResult

    return (
        <div>
            <Title level={3} style={{ marginBottom: 24 }}>
                作者中心
            </Title>

            <Card style={{ marginBottom: 20 }}>
                <Row gutter={[16, 0]} align='middle'>
                    <Col xs={24} sm={12} md={8} lg={6}>
                        <Input.Search
                            placeholder='搜索作者名称...'
                            defaultValue={keyword}
                            onSearch={(val) => {
                                setUrlParam('keyword', val || null)
                            }}
                            onChange={(e) => {
                                if (!e.target.value) {
                                    setUrlParam('keyword', null)
                                }
                            }}
                            allowClear
                        />
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                        <Text type='secondary'>共 {pageResult.total} 位作者</Text>
                    </Col>
                </Row>
            </Card>

            <Spin spinning={loading}>
                {authors.length > 0 ? (
                    <>
                        <Row gutter={[16, 16]}>
                            {authors.map((author) => (
                                <Col key={author.ownerName} xs={24} sm={12} md={8} lg={6}>
                                    <Card
                                        hoverable
                                        style={{ height: '100%', cursor: 'pointer' }}
                                        styles={{ body: { padding: 20 } }}
                                        onClick={() => navigate(`/authors/${encodeURIComponent(author.ownerName)}`)}
                                    >
                                        <div style={{ textAlign: 'center', marginBottom: 12 }}>
                                            <Avatar
                                                src={author.ownerAvatarUrl}
                                                alt={author.ownerName}
                                                size={72}
                                                style={{ border: '2px solid #f0f0f0' }}
                                            />
                                        </div>
                                        <div style={{ textAlign: 'center', marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                <Text strong style={{ fontSize: 16 }} ellipsis>
                                                    {author.ownerName}
                                                </Text>
                                                <a
                                                    href={`https://github.com/${author.ownerName}`}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    onClick={(e) => e.stopPropagation()}
                                                    title='打开 GitHub 主页'
                                                    style={{ color: '#1677ff', fontSize: 16, flexShrink: 0 }}
                                                >
                                                    <GithubOutlined />
                                                </a>
                                            </div>
                                            {author.topLanguage && (
                                                <Tag color='blue' style={{ marginTop: 4 }}>
                                                    {author.topLanguage}
                                                </Tag>
                                            )}
                                        </div>
                                        <Row gutter={[8, 0]} justify='center'>
                                            <Col span={12}>
                                                <Statistic
                                                    title='仓库'
                                                    value={author.repoCount}
                                                    prefix={<GithubOutlined />}
                                                    valueStyle={{ fontSize: 16 }}
                                                    formatter={(value) => (
                                                        <span>
                                                            {value}{' '}
                                                            <Text type='secondary' style={{ fontSize: 11 }}>
                                                                {formatNumberCn(Number(value))}
                                                            </Text>
                                                        </span>
                                                    )}
                                                />
                                            </Col>
                                            <Col span={12}>
                                                <Statistic
                                                    title='Star'
                                                    value={author.totalStars}
                                                    prefix={<StarFilled style={{ color: '#faad14' }} />}
                                                    valueStyle={{ fontSize: 16 }}
                                                    formatter={(value) => (
                                                        <span>
                                                            {value}{' '}
                                                            <Text type='secondary' style={{ fontSize: 11 }}>
                                                                {formatNumberCn(Number(value))}
                                                            </Text>
                                                        </span>
                                                    )}
                                                />
                                            </Col>
                                        </Row>
                                        {author.lastStarredAt && (
                                            <div style={{ textAlign: 'center', marginTop: 8 }}>
                                                <Text type='secondary' style={{ fontSize: 11 }}>
                                                    最近 Star 于 {formatDate(author.lastStarredAt)}
                                                </Text>
                                            </div>
                                        )}
                                    </Card>
                                </Col>
                            ))}
                        </Row>

                        {pageResult.total > PAGE_SIZE && (
                            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                                <Pagination
                                    current={currentPage}
                                    pageSize={PAGE_SIZE}
                                    total={pageResult.total}
                                    showQuickJumper
                                    showTotal={(total) => `共 ${total} 位作者 / ${pageResult.pages} 页`}
                                    onChange={(page) => {
                                        setUrlParam('page', String(page))
                                    }}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <Card>
                        <Empty description={loading ? '加载中...' : keyword ? `未找到包含「${keyword}」的作者` : '暂无作者数据'} />
                    </Card>
                )}
            </Spin>
        </div>
    )
}
