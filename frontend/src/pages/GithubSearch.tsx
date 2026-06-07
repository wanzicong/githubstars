import { useState, useCallback } from 'react'
import { Input, Select, Card, Pagination, Spin, Empty, Typography, Tag, Button, Space, Row, Col, message } from 'antd'
import {
  SearchOutlined,
  StarFilled,
  StarOutlined,
  ForkOutlined,
  GithubOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { searchRepos, starRepo, checkStarred } from '../api/github'
import type { GithubSearchRepo } from '../api/github'

const { Title, Text, Paragraph } = Typography

const LANGUAGE_OPTIONS = [
  { value: '', label: '全部语言' },
  { value: 'JavaScript', label: 'JavaScript' },
  { value: 'TypeScript', label: 'TypeScript' },
  { value: 'Python', label: 'Python' },
  { value: 'Java', label: 'Java' },
  { value: 'Go', label: 'Go' },
  { value: 'Rust', label: 'Rust' },
  { value: 'C++', label: 'C++' },
  { value: 'C', label: 'C' },
  { value: 'C#', label: 'C#' },
  { value: 'Ruby', label: 'Ruby' },
  { value: 'PHP', label: 'PHP' },
  { value: 'Swift', label: 'Swift' },
  { value: 'Kotlin', label: 'Kotlin' },
  { value: 'Vue', label: 'Vue' },
  { value: 'Shell', label: 'Shell' },
  { value: 'Dockerfile', label: 'Dockerfile' },
]

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

function getRelativeTime(pushedAt: string): string {
  const days = dayjs().diff(dayjs(pushedAt), 'day')
  if (days <= 0) return '今天'
  if (days === 1) return '1天前'
  if (days < 30) return `${days}天前`
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months}个月前`
  }
  const years = Math.floor(days / 365)
  return `${years}年前`
}

function formatCount(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k'
  }
  return String(count)
}

export default function GithubSearch() {
  const [keyword, setKeyword] = useState('')
  const [language, setLanguage] = useState('')
  const [sort, setSort] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  const [results, setResults] = useState<GithubSearchRepo[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({})

  const doSearch = useCallback(
    async (searchPage: number) => {
      setLoading(true)
      setSearched(true)
      try {
        const data = await searchRepos({
          keyword: keyword || undefined,
          language: language || undefined,
          sort: sort || undefined,
          page: searchPage,
          perPage,
        })
        console.log('search result:', data)
        setResults(data.repos || [])
        setTotal(data.total || 0)
        setPage(data.page || searchPage)
      } catch (e) {
        console.error('search error:', e)
        message.error('搜索失败，请稍后重试')
        setResults([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [keyword, language, sort, perPage],
  )

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

  const handlePerPageChange = useCallback(
    (value: number) => {
      setPerPage(value)
      setPage(1)
      doSearch(1)
    },
    [doSearch],
  )

  const handleLanguageChange = useCallback(
    (value: string) => {
      setLanguage(value)
      setPage(1)
      // Trigger search after state update via useEffect would be cleaner,
      // but per the requirement we trigger on filter change directly.
      // We call doSearch with the new value directly.
      setLoading(true)
      setSearched(true)
      searchRepos({
        keyword: keyword || undefined,
        language: value || undefined,
        sort: sort || undefined,
        page: 1,
        perPage,
      })
        .then((data) => {
          setResults(data.repos || [])
          setTotal(data.total || 0)
          setPage(1)
        })
        .catch(() => {
          message.error('搜索失败，请稍后重试')
          setResults([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    },
    [keyword, sort, perPage],
  )

  const handleSortChange = useCallback(
    (value: string) => {
      setSort(value)
      setPage(1)
      setLoading(true)
      setSearched(true)
      searchRepos({
        keyword: keyword || undefined,
        language: language || undefined,
        sort: value || undefined,
        page: 1,
        perPage,
      })
        .then((data) => {
          setResults(data.repos || [])
          setTotal(data.total || 0)
          setPage(1)
        })
        .catch(() => {
          message.error('搜索失败，请稍后重试')
          setResults([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    },
    [keyword, language, perPage],
  )

  const handleStar = useCallback(
    async (repo: GithubSearchRepo) => {
      const fullName = repo.full_name
      const [owner, repoName] = fullName.split('/')
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
    },
    [],
  )

  const handleCheckStar = useCallback(async (repo: GithubSearchRepo) => {
    const fullName = repo.full_name
    const [owner, repoName] = fullName.split('/')
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

        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Input.Search
              placeholder="搜索 GitHub 仓库..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={handleSearch}
              enterButton="搜索"
              size="large"
              allowClear
            />
          </Col>
          <Col>
            <Select
              value={language}
              onChange={handleLanguageChange}
              options={LANGUAGE_OPTIONS}
              style={{ width: 140 }}
              placeholder="语言"
            />
          </Col>
          <Col>
            <Select
              value={sort}
              onChange={handleSortChange}
              options={SORT_OPTIONS}
              style={{ width: 140 }}
              placeholder="排序"
            />
          </Col>
          <Col>
            <Select
              value={perPage}
              onChange={handlePerPageChange}
              options={PER_PAGE_OPTIONS}
              style={{ width: 120 }}
            />
          </Col>
        </Row>
      </div>

      <Spin spinning={loading}>
        {!searched ? (
          <Empty
            description="输入关键词搜索 GitHub 仓库"
            style={{ marginTop: 80 }}
          />
        ) : results.length === 0 && !loading ? (
          <Empty description="未找到相关仓库" style={{ marginTop: 80 }} />
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">
                共找到 {total} 个仓库
              </Text>
            </div>
            <Row gutter={[16, 16]}>
              {results.map((repo) => {
                const fullName = repo.full_name
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
                          src={repo.owner_avatar_url || ''}
                          alt={repo.owner_login || ''}
                          style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontWeight: 600, fontSize: 14, wordBreak: 'break-all' }}
                          >
                            <GithubOutlined style={{ marginRight: 4 }} />
                            {fullName}
                          </a>
                        </div>
                      </div>

                      <Paragraph
                        ellipsis={{ rows: 2 }}
                        type="secondary"
                        style={{ fontSize: 13, marginBottom: 12, flex: 1 }}
                      >
                        {repo.description || '暂无描述'}
                      </Paragraph>

                      <div style={{ marginBottom: 12 }}>
                        {repo.language && (
                          <Tag color="blue" style={{ marginBottom: 4 }}>
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

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Space size="middle">
                          <span>
                            <StarOutlined style={{ marginRight: 4, color: '#faad14' }} />
                            {formatCount(repo.stargazers_count)}
                          </span>
                          <span>
                            <ForkOutlined style={{ marginRight: 4 }} />
                            {formatCount(repo.forks_count)}
                          </span>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {getRelativeTime(repo.pushed_at)}
                        </Text>
                      </div>

                      <Button
                        type={isStarred ? 'default' : 'primary'}
                        icon={isStarred ? <StarFilled /> : <StarOutlined />}
                        onClick={() => !isStarred && handleStar(repo)}
                        block
                        style={
                          isStarred
                            ? { color: '#52c41a', borderColor: '#52c41a', cursor: 'default' }
                            : undefined
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
        )}
      </Spin>
    </div>
  )
}
