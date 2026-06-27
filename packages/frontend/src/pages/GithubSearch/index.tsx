import { useState, useCallback, useRef, useEffect } from 'react'
import { Input, Select, Card, Pagination, Spin, Empty, Typography, Tag, Button, Space, Row, Col, App } from 'antd'
import { SearchOutlined, StarFilled, StarOutlined, ForkOutlined, GithubOutlined } from '@ant-design/icons'
import { searchRepos, starRepo, checkStarred } from '../../api'
import type { GithubSearchRepo } from '../../types'
import { LANGUAGE_OPTIONS } from '../../constants'
import { formatNumberShort, getRelativeTime, parseFullName } from '../../utils/format'

const { Title, Text, Paragraph } = Typography

const SORT_OPTIONS = [
    { value: '', label: '最佳匹配' },
    { value: 'stars', label: 'Star 最多' },
    { value: 'updated', label: '最近更新' },
    { value: 'forks', label: 'Fork 最多' },
]

const PER_PAGE_OPTIONS = [
    { value: 20, label: '20条/页' },
    { value: 50, label: '50条/页' },
    { value: 100, label: '100条/页' },
]

export default function GithubSearch() {
    const { message } = App.useApp()
    const [keyword, setKeyword] = useState('')
    const [language, setLanguage] = useState('')
    const [sort, setSort] = useState('')
    const [page, setPage] = useState(1)
    const [perPage, setPerPage] = useState(20)

    // ── Refs: 供 doSearch 始终读取最新值，避免 setState 后闭包过期 ──
    const keywordRef = useRef(keyword)
    const languageRef = useRef(language)
    const sortRef = useRef(sort)
    const perPageRef = useRef(perPage)

    useEffect(() => { keywordRef.current = keyword }, [keyword])
    useEffect(() => { languageRef.current = language }, [language])
    useEffect(() => { sortRef.current = sort }, [sort])
    useEffect(() => { perPageRef.current = perPage }, [perPage])

    const [results, setResults] = useState<GithubSearchRepo[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [starredMap, setStarredMap] = useState<Record<string, boolean>>({})

    const doSearch = useCallback(async (searchPage: number, overridePerPage?: number) => {
        setLoading(true)
        setSearched(true)
        try {
            const data = await searchRepos({
                keyword: keywordRef.current || undefined,
                language: languageRef.current || undefined,
                sort: sortRef.current || undefined,
                page: searchPage,
                perPage: overridePerPage ?? perPageRef.current,
            })
            setResults(data.repos || [])
            setTotal(data.total || 0)
            setPage(data.page || searchPage)
        } catch {
            message.error('搜索失败，请稍后重试')
            setResults([])
            setTotal(0)
        } finally {
            setLoading(false)
        }
    }, [])

    const handleSearch = useCallback(() => {
        setPage(1)
        doSearch(1)
    }, [doSearch])

    const handlePageChange = useCallback(
        (newPage: number) => {
            setPage(newPage)
            doSearch(newPage)
        },
        [doSearch],
    )

    const handlePerPageChange = useCallback((value: number) => {
        setPerPage(value)
        setPage(1)
        doSearch(1, value)
    }, [doSearch])

    const handleLanguageChange = useCallback((value: string) => {
        setLanguage(value)
        setPage(1)
        doSearch(1)
    }, [doSearch])

    const handleSortChange = useCallback((value: string) => {
        setSort(value)
        setPage(1)
        doSearch(1)
    }, [doSearch])

    const handleStar = useCallback(async (repo: GithubSearchRepo) => {
        const fullName = repo.fullName
        const [owner, repoName] = parseFullName(fullName)
        try {
            const data = await starRepo(owner, repoName)
            if (data.success && data.starred) {
                setStarredMap((prev) => ({ ...prev, [fullName]: true }))
                message.success(`已 Star ${fullName}`)
            } else if (data.success) {
                message.info(data.message || '操作完成')
            } else {
                message.error(data.message || 'Star 失败')
            }
        } catch {
            message.error('Star 操作失败，请稍后重试')
        }
    }, [])

    const handleCheckStar = useCallback(async (repo: GithubSearchRepo) => {
        const fullName = repo.fullName
        const [owner, repoName] = parseFullName(fullName)
        try {
            const data = await checkStarred(owner, repoName)
            if (data.success && data.starred) {
                setStarredMap((prev) => ({ ...prev, [fullName]: true }))
            }
        } catch {
            // silently ignore check failures
        }
    }, [])

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <Title level={3} style={{ marginBottom: 16 }}>
                    <SearchOutlined style={{ marginRight: 8 }} />
                    GitHub 搜索
                </Title>

                <Row gutter={[12, 12]} align='middle'>
                    <Col xs={24} sm={24} md={12} lg={14}>
                        <Input.Search
                            placeholder='搜索 GitHub 仓库...'
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onSearch={handleSearch}
                            enterButton='搜索'
                            size='large'
                            allowClear
                        />
                    </Col>
                    <Col xs={8} sm={8} md={4} lg={3}>
                        <Select
                            value={language}
                            onChange={handleLanguageChange}
                            options={LANGUAGE_OPTIONS}
                            style={{ width: '100%' }}
                            placeholder='语言'
                        />
                    </Col>
                    <Col xs={8} sm={8} md={4} lg={3}>
                        <Select value={sort} onChange={handleSortChange} options={SORT_OPTIONS} style={{ width: '100%' }} placeholder='排序' />
                    </Col>
                    <Col xs={8} sm={8} md={4} lg={4}>
                        <Select value={perPage} onChange={handlePerPageChange} options={PER_PAGE_OPTIONS} style={{ width: '100%' }} />
                    </Col>
                </Row>
            </div>

            <Spin spinning={loading}>
                {(() => {
                    if (!searched) return <Empty description='输入关键词搜索 GitHub 仓库' style={{ marginTop: 80 }} />
                    if (results.length === 0 && !loading) return <Empty description='未找到相关仓库' style={{ marginTop: 80 }} />
                    return (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <Text type='secondary'>共找到 {total} 个仓库</Text>
                        </div>
                        <Row gutter={[16, 16]}>
                            {results.map((repo) => {
                                const fullName = repo.fullName
                                const isStarred = starredMap[fullName] || false

                                return (
                                    <Col xs={24} sm={12} lg={8} xl={6} key={repo.id}>
                                        <Card
                                            hoverable
                                            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                                            styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
                                            onMouseEnter={() => handleCheckStar(repo)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                                                <img
                                                    src={repo.ownerAvatarUrl || ''}
                                                    alt={repo.ownerName || ''}
                                                    style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <a
                                                        href={repo.htmlUrl}
                                                        target='_blank'
                                                        rel='noopener noreferrer'
                                                        style={{ fontWeight: 600, fontSize: 14, wordBreak: 'break-all' }}
                                                    >
                                                        <GithubOutlined style={{ marginRight: 4 }} />
                                                        {fullName}
                                                    </a>
                                                </div>
                                            </div>

                                            <Paragraph
                                                ellipsis={{ rows: 2 }}
                                                type='secondary'
                                                style={{ fontSize: 13, marginBottom: 12, flex: 1 }}
                                            >
                                                {repo.description || '暂无描述'}
                                            </Paragraph>

                                            <div style={{ marginBottom: 12 }}>
                                                {repo.language && (
                                                    <Tag color='blue' style={{ marginBottom: 4 }}>
                                                        {repo.language}
                                                    </Tag>
                                                )}
                                                {repo.topics &&
                                                    repo.topics.slice(0, 3).map((topic) => (
                                                        <Tag key={topic} style={{ marginBottom: 4 }}>
                                                            {topic}
                                                        </Tag>
                                                    ))}
                                            </div>

                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: 12,
                                                }}
                                            >
                                                <Space size='middle'>
                                                    <span>
                                                        <StarOutlined style={{ marginRight: 4, color: '#faad14' }} />
                                                        {formatNumberShort(repo.starsCount)}
                                                    </span>
                                                    <span>
                                                        <ForkOutlined style={{ marginRight: 4 }} />
                                                        {formatNumberShort(repo.forksCount)}
                                                    </span>
                                                </Space>
                                                <Text type='secondary' style={{ fontSize: 12 }}>
                                                    {getRelativeTime(repo.pushedAt)}
                                                </Text>
                                            </div>

                                            <Button
                                                type={isStarred ? 'default' : 'primary'}
                                                icon={isStarred ? <StarFilled /> : <StarOutlined />}
                                                onClick={() => !isStarred && handleStar(repo)}
                                                block
                                                style={
                                                    isStarred ? { color: '#52c41a', borderColor: '#52c41a', cursor: 'default' } : undefined
                                                }
                                            >
                                                {isStarred ? '已Star ✅' : 'Star ⭐'}
                                            </Button>
                                        </Card>
                                    </Col>
                                )
                            })}
                        </Row>

                        {total > perPage && (
                            <div style={{ marginTop: 24, textAlign: 'center' }}>
                                <Pagination
                                    current={page}
                                    total={total}
                                    pageSize={perPage}
                                    onChange={handlePageChange}
                                    showSizeChanger={false}
                                    showTotal={(t) => `共 ${t} 个仓库`}
                                />
                            </div>
                        )}
                    </>
                )})()}
            </Spin>
        </div>
    )
}
