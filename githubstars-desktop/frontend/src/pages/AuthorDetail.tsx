import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Select,
  Button,
  Row,
  Col,
  Tag,
  Avatar,
  Typography,
  Pagination,
  Empty,
  Space,
  Spin,
  Breadcrumb,
  Statistic,
  message,
} from 'antd'
import {
  StarFilled,
  ForkOutlined,
  ArrowLeftOutlined,
  DownloadOutlined,
  GithubOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as authorsApi from '../api/authors'
import type { GithubRepo, PageResult } from '../types'

const { Title, Text, Paragraph } = Typography

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

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

const SORT_BY_OPTIONS = [
  { label: 'Star 时间', value: 'starred_at' },
  { label: 'Star 数量', value: 'stars_count' },
  { label: 'Fork 数量', value: 'forks_count' },
  { label: '最近更新', value: 'repo_updated_at' },
  { label: '创建时间', value: 'repo_created_at' },
  { label: '推送时间', value: 'repo_pushed_at' },
]

const SORT_ORDER_OPTIONS = [
  { label: '降序', value: 'desc' },
  { label: '升序', value: 'asc' },
]

const PAGE_SIZE = 12

export default function AuthorDetail() {
  const { ownerName } = useParams<{ ownerName: string }>()
  const navigate = useNavigate()

  const [sortBy, setSortBy] = useState('starred_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)

  const [pageResult, setPageResult] = useState<PageResult<GithubRepo>>({
    records: [],
    total: 0,
    size: PAGE_SIZE,
    current: 1,
    pages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [authorStats, setAuthorStats] = useState<{
    repoCount: number
    totalStars: number
    topLanguage: string | null
    ownerAvatarUrl: string
  } | null>(null)

  useEffect(() => {
    if (!ownerName) return

    const loadData = async () => {
      setLoading(true)
      try {
        const result = await authorsApi.fetchAuthorRepos(ownerName, {
          page: currentPage,
          size: PAGE_SIZE,
          sortBy,
          sortOrder,
        })

        setPageResult(result)

        // 从返回的仓库数据中提取作者统计信息
        if (result.records.length > 0 || result.total > 0) {
          const repos = result.records
          const totalStars = repos.reduce((sum, r) => sum + (r.starsCount || 0), 0)
          // 找出现最多的语言
          const langCount: Record<string, number> = {}
          repos.forEach((r) => {
            if (r.language) {
              langCount[r.language] = (langCount[r.language] || 0) + 1
            }
          })
          const topLanguage =
            Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null

          setAuthorStats({
            repoCount: result.total,
            totalStars,
            topLanguage,
            ownerAvatarUrl: repos[0]?.ownerAvatarUrl || '',
          })
        } else {
          setAuthorStats(null)
        }
      } catch {
        // errors logged by interceptor
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [ownerName, currentPage, sortBy, sortOrder])

  const handleExport = useCallback(async () => {
    if (!ownerName) return
    try {
      const defaultName = `stars_${ownerName}.txt`

      // Electron 桌面端：使用原生保存对话框
      if (window.electronAPI) {
        const content = await authorsApi.exportAuthorUrlsText(ownerName, sortBy, sortOrder)
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: defaultName,
          filters: [{ name: '文本文件', extensions: ['txt'] }],
        })
        if (!result.canceled && result.filePath) {
          await window.electronAPI.writeFile(result.filePath, content)
          message.success('导出成功')
        }
      } else {
        // Web 模式：Blob 下载
        const blob = await authorsApi.exportAuthorUrls(ownerName, sortBy, sortOrder)
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        message.success('导出成功')
      }
    } catch {
      console.error('导出失败')
      message.error('导出失败')
    }
  }, [ownerName, sortBy, sortOrder])

  const { records: repos } = pageResult

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          {
            title: (
              <a onClick={() => navigate('/authors')}>
                <UserOutlined /> 作者中心
              </a>
            ),
          },
          { title: ownerName },
        ]}
      />

      {/* 作者信息头部 */}
      {authorStats && (
        <Card style={{ marginBottom: 20 }}>
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} sm={4} style={{ textAlign: 'center' }}>
              <Avatar
                src={authorStats.ownerAvatarUrl}
                alt={ownerName}
                size={80}
                style={{ border: '2px solid #f0f0f0' }}
              />
            </Col>
            <Col xs={24} sm={10}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Title level={4} style={{ margin: 0 }}>
                  {ownerName}
                </Title>
                <a
                  href={`https://github.com/${ownerName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="打开 GitHub 主页"
                  style={{ color: '#1677ff', fontSize: 20, flexShrink: 0 }}
                >
                  <GithubOutlined />
                </a>
              </div>
              {authorStats.topLanguage && (
                <Tag color="blue" style={{ marginTop: 8 }}>
                  {authorStats.topLanguage}
                </Tag>
              )}
            </Col>
            <Col xs={8} sm={3}>
              <Statistic
                title="仓库数"
                value={authorStats.repoCount}
                prefix={<GithubOutlined />}
              />
            </Col>
            <Col xs={8} sm={3}>
              <Statistic
                title="总 Star"
                value={formatNumber(authorStats.totalStars)}
                prefix={<StarFilled style={{ color: '#faad14' }} />}
              />
            </Col>
            <Col xs={8} sm={4} style={{ textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExport}
              >
                导出链接
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      {/* 排序控件 */}
      <Card style={{ marginBottom: 20 }}>
        <Space size="middle">
          <Select
            value={sortBy}
            onChange={(val) => {
              setSortBy(val)
              setCurrentPage(1)
            }}
            options={SORT_BY_OPTIONS}
            style={{ width: 140 }}
          />
          <Select
            value={sortOrder}
            onChange={(val) => {
              setSortOrder(val)
              setCurrentPage(1)
            }}
            options={SORT_ORDER_OPTIONS}
            style={{ width: 100 }}
          />
          {authorStats && (
            <Text type="secondary">
              共 {authorStats.repoCount} 个仓库
            </Text>
          )}
        </Space>
      </Card>

      {/* 仓库卡片网格 */}
      <Spin spinning={loading}>
        {repos.length > 0 ? (
          <>
            <Row gutter={[16, 16]}>
              {repos.map((repo) => (
                <Col key={repo.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    style={{ height: '100%', cursor: 'pointer' }}
                    styles={{ body: { padding: 16 } }}
                    onClick={() => {
                      window.location.href = `/stars/${repo.id}`
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <Avatar
                        src={repo.ownerAvatarUrl}
                        alt={repo.ownerName}
                        size={40}
                        style={{ flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text
                          strong
                          style={{ fontSize: 14, display: 'block', lineHeight: '20px' }}
                          ellipsis
                        >
                          {repo.repoName}
                        </Text>
                      </div>
                    </div>
                    {repo.descriptionCn ? (
                      <Paragraph
                        ellipsis={{ rows: 2 }}
                        style={{ marginBottom: 10, fontSize: 12, minHeight: 36, color: '#333' }}
                      >
                        {repo.descriptionCn}
                        <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                          🇨🇳
                        </Text>
                      </Paragraph>
                    ) : repo.description ? (
                      <Paragraph
                        type="secondary"
                        ellipsis={{ rows: 2 }}
                        style={{ marginBottom: 10, fontSize: 12, minHeight: 36 }}
                      >
                        {repo.description}
                      </Paragraph>
                    ) : null}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {repo.language && (
                        <Tag color="blue" style={{ margin: 0 }}>
                          {repo.language}
                        </Tag>
                      )}
                      {repo.categoryNames && repo.categoryNames.length > 0 && repo.categoryNames.map((cat) => (
                        <Tag key={cat} color="green" style={{ margin: 0, fontSize: 11 }}>
                          {cat}
                        </Tag>
                      ))}
                      <Space size={4}>
                        <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
                        <Text style={{ fontSize: 12 }}>{repo.starsCount}</Text>
                      </Space>
                      <Space size={4}>
                        <ForkOutlined style={{ fontSize: 12 }} />
                        <Text style={{ fontSize: 12 }}>{repo.forksCount}</Text>
                      </Space>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Star 于 {formatDate(repo.starredAt)}
                      </Text>
                      {repo.repoPushedAt && (() => {
                        const days = dayjs().diff(dayjs(repo.repoPushedAt), 'day')
                        let color = 'green'
                        if (days > 180) color = 'red'
                        else if (days > 30) color = 'orange'
                        return <Tag color={color} style={{ margin: 0, fontSize: 10 }}>未更新 {days} 天</Tag>
                      })()}
                    </div>
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
                  showTotal={(total) => `共 ${total} 条 / ${pageResult.pages} 页`}
                  onChange={(page) => setCurrentPage(page)}
                />
              </div>
            )}
          </>
        ) : (
          <Card>
            <Empty
              description={
                loading ? '加载中...' : `作者 ${ownerName} 暂无 Star 仓库`
              }
            />
          </Card>
        )}
      </Spin>

      <div style={{ marginTop: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/authors')}
        >
          返回作者中心
        </Button>
      </div>
    </div>
  )
}
