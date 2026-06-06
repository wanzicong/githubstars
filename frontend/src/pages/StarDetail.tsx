import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Typography,
  Avatar,
  Statistic,
  Row,
  Col,
  Spin,
  Empty,
  Divider,
  message,
} from 'antd'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeftOutlined,
  GithubOutlined,
  LinkOutlined,
  StarFilled,
  ForkOutlined,
  EyeOutlined,
  BugOutlined,
  TranslationOutlined,
  ReadOutlined,
} from '@ant-design/icons'
import * as statsApi from '../api/stats'
import * as translateApi from '../api/translate'
import type { GithubRepo } from '../types'

const { Title, Text, Paragraph } = Typography

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  if (Array.isArray(dateStr)) {
    const [y, m, d, h = 0, min = 0] = dateStr
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }
  return dateStr.substring(0, 19).replace('T', ' ')
}

function daysSince(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr.replace(' ', 'T'))
  if (isNaN(date.getTime())) return null
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return null
  return diffDays === 0 ? '今天' : `${diffDays} 天`
}

function DaysSinceText({ dateStr }: { dateStr: string }) {
  const display = daysSince(dateStr)
  if (!display) return <Text type="secondary">-</Text>
  if (display === '今天') return <Text style={{ color: '#52c41a' }}>今天</Text>
  const num = parseInt(display)
  if (num < 90) return <Text style={{ color: '#52c41a' }}>{display}</Text>
  if (num < 365) return <Text style={{ color: '#faad14' }}>{display}</Text>
  return <Text style={{ color: '#ff4d4f' }}>{display}</Text>
}

function parseTopics(topics: string | null): string[] {
  if (!topics) return []
  try {
    return JSON.parse(topics)
  } catch {
    return []
  }
}

export default function StarDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [repo, setRepo] = useState<GithubRepo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // 翻译状态
  const [translatingDesc, setTranslatingDesc] = useState(false)
  const [translatingReadme, setTranslatingReadme] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchRepo = async () => {
      const numericId = Number(id)
      if (!numericId) {
        setNotFound(true)
        setLoading(false)
        return
      }

      try {
        const detail = await translateApi.fetchRepoDetail(numericId)
        if (cancelled) return
        if (detail && detail.id) {
          setRepo(detail)
          setNotFound(false)
          return
        }

        // 详情 API 未返回数据，从 top-starred/recent-active 降级查找
        const [topRes, recentRes] = await Promise.allSettled([
          statsApi.fetchTopStarredRepos(100),
          statsApi.fetchRecentActiveRepos(100),
        ])
        if (cancelled) return

        let found: GithubRepo | undefined
        if (topRes.status === 'fulfilled') {
          found = topRes.value.find((r) => r.id === numericId)
        }
        if (!found && recentRes.status === 'fulfilled') {
          found = recentRes.value.find((r) => r.id === numericId)
        }

        if (found) {
          setRepo(found)
        } else {
          setNotFound(true)
        }
      } catch (e) {
        console.error('获取仓库详情失败', e)
        if (!cancelled) {
          setNotFound(true)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchRepo()

    return () => { cancelled = true }
  }, [id])

  const handleTranslateDescription = async () => {
    if (!repo?.id) return
    setTranslatingDesc(true)
    try {
      const result = await translateApi.translateDescription(repo.id)
      if (result.success) {
        // 刷新详情以获取翻译后的数据
        const updated = await translateApi.fetchRepoDetail(repo.id)
        if (updated && updated.id) {
          setRepo(updated)
          message.success('描述翻译完成')
        }
      }
    } catch {
      message.error('翻译描述失败')
    } finally {
      setTranslatingDesc(false)
    }
  }

  const handleTranslateReadme = async () => {
    if (!repo?.id) return
    setTranslatingReadme(true)
    try {
      const result = await translateApi.translateReadme(repo.id)
      if (result.success) {
        const updated = await translateApi.fetchRepoDetail(repo.id)
        if (updated && updated.id) {
          setRepo(updated)
          message.success('README 翻译完成')
        }
      }
    } catch {
      message.error('翻译 README 失败')
    } finally {
      setTranslatingReadme(false)
    }
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (notFound || !repo) {
    return (
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          style={{ marginBottom: 24 }}
        >
          返回
        </Button>
        <Card>
          <Empty description="未找到该仓库数据">
            <Button type="primary" onClick={() => navigate('/')}>
              返回列表
            </Button>
          </Empty>
        </Card>
      </div>
    )
  }

  const topics = parseTopics(repo.topics)

  const statColStyle = { xs: 12 as const, sm: 12 as const, md: 6 as const }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={handleBack}
        style={{ marginBottom: 20 }}
      >
        返回
      </Button>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <Avatar
            src={repo.ownerAvatarUrl}
            alt={repo.ownerName}
            size={64}
            style={{ flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
              {repo.fullName}
            </Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 14 }}>
                {repo.ownerName}
              </Text>
              {repo.isFork && (
                <Tag color="orange" style={{ margin: 0 }}>
                  已 Fork
                </Tag>
              )}
              {repo.isArchived && (
                <Tag color="default" style={{ margin: 0 }}>
                  已归档
                </Tag>
              )}
            </div>
            {/* 描述：优先显示中文翻译 */}
            {repo.descriptionCn ? (
              <div>
                <Paragraph style={{ marginBottom: 4, color: '#333' }}>
                  {repo.descriptionCn}
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>🇨🇳 中文</Text>
                </Paragraph>
                {repo.description && repo.description !== repo.descriptionCn && (
                  <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                    <Text type="secondary" italic>原文：</Text>
                    {repo.description}
                  </Paragraph>
                )}
              </div>
            ) : repo.description ? (
              <div>
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  {repo.description}
                </Paragraph>
                <Button
                  size="small"
                  icon={<TranslationOutlined />}
                  loading={translatingDesc}
                  onClick={handleTranslateDescription}
                >
                  翻译描述
                </Button>
              </div>
            ) : (
              <Text type="secondary" style={{ marginBottom: 8 }}>
                暂无描述
              </Text>
            )}
          </div>
          <Space>
            <Button
              type="primary"
              icon={<GithubOutlined />}
              onClick={() => window.open(repo.htmlUrl, '_blank', 'noopener,noreferrer')}
            >
              在 GitHub 上查看
            </Button>
            {repo.homepage && (
              <Button
                icon={<LinkOutlined />}
                onClick={() => window.open(repo.homepage!, '_blank', 'noopener,noreferrer')}
              >
                访问项目主页
              </Button>
            )}
          </Space>
        </div>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col {...statColStyle}>
          <Card size="small">
            <Statistic
              title="Stars"
              value={repo.starsCount}
              prefix={<StarFilled style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col {...statColStyle}>
          <Card size="small">
            <Statistic
              title="Forks"
              value={repo.forksCount}
              prefix={<ForkOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col {...statColStyle}>
          <Card size="small">
            <Statistic
              title="Watchers"
              value={repo.watchersCount}
              prefix={<EyeOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col {...statColStyle}>
          <Card size="small">
            <Statistic
              title="Open Issues"
              value={repo.openIssuesCount}
              prefix={<BugOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="详细信息" style={{ marginBottom: 20 }}>
        <Descriptions column={{ xs: 1, sm: 1, md: 2 }} bordered size="small">
          <Descriptions.Item label="编程语言">
            {repo.language ? (
              <Tag color="blue">{repo.language}</Tag>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="许可证">
            {repo.licenseName ? (
              <Text>{repo.licenseName}</Text>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="主题标签" span={2}>
            {topics.length > 0 ? (
              <Space size={[4, 4]} wrap>
                {topics.map((topic) => (
                  <Tag key={topic}>{topic}</Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Star 时间">
            {formatDate(repo.starredAt)}
          </Descriptions.Item>
          <Descriptions.Item label="仓库创建时间">
            {formatDate(repo.repoCreatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="最后更新时间">
            {formatDate(repo.repoUpdatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="最后推送时间">
            {formatDate(repo.repoPushedAt)}
          </Descriptions.Item>
          {repo.repoPushedAt && (
            <Descriptions.Item label="距上次推送">
              <DaysSinceText dateStr={repo.repoPushedAt} />
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* README 翻译区块 */}
      <Card
        title={
          <Space>
            <ReadOutlined />
            <span>README 中文翻译</span>
          </Space>
        }
        extra={
          !repo.readmeFetched ? (
            <Button
              type="primary"
              size="small"
              icon={<TranslationOutlined />}
              loading={translatingReadme}
              onClick={handleTranslateReadme}
            >
              翻译 README
            </Button>
          ) : null
        }
      >
        {repo.readmeFetched && repo.readmeCn ? (
          <div
            style={{
              overflow: 'auto',
              maxHeight: 600,
              padding: '8px 16px',
            }}
            className="readme-markdown"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 style={{ fontSize: 22, borderBottom: '1px solid #eee', paddingBottom: 8, marginTop: 24, marginBottom: 12 }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: 19, borderBottom: '1px solid #eee', paddingBottom: 6, marginTop: 20, marginBottom: 10 }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>{children}</h3>,
                h4: ({ children }) => <h4 style={{ fontSize: 14, marginTop: 12, marginBottom: 6 }}>{children}</h4>,
                p: ({ children }) => <p style={{ lineHeight: 1.8, marginBottom: 12, fontSize: 14 }}>{children}</p>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>{children}</a>,
                ul: ({ children }) => <ul style={{ paddingLeft: 24, marginBottom: 12, lineHeight: 1.8 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: 24, marginBottom: 12, lineHeight: 1.8 }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 4, fontSize: 14 }}>{children}</li>,
                code: ({ children }) => <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 3, fontSize: 13, fontFamily: "'SFMono-Regular', Consolas, monospace" }}>{children}</code>,
                pre: ({ children }) => <pre style={{ backgroundColor: '#f6f8fa', padding: 16, borderRadius: 6, overflow: 'auto', fontSize: 13, lineHeight: 1.5, marginBottom: 16, border: '1px solid #e8e8e8' }}>{children}</pre>,
                blockquote: ({ children }) => <blockquote style={{ borderLeft: '4px solid #1677ff', paddingLeft: 16, color: '#666', margin: '12px 0', fontStyle: 'italic' }}>{children}</blockquote>,
                table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 16 }}>{children}</table>,
                th: ({ children }) => <th style={{ border: '1px solid #ddd', padding: '8px 12px', backgroundColor: '#f5f5f5', fontWeight: 600, fontSize: 13 }}>{children}</th>,
                td: ({ children }) => <td style={{ border: '1px solid #ddd', padding: '8px 12px', fontSize: 13 }}>{children}</td>,
                img: ({ src, alt }) => <img src={src} alt={alt || ''} style={{ maxWidth: '100%', marginBottom: 12 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />,
                hr: () => <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '20px 0' }} />,
                strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
              }}
            >
              {repo.readmeCn}
            </ReactMarkdown>
          </div>
        ) : repo.readmeFetched && !repo.readmeCn ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
            <br />
            <Text type="secondary">该仓库没有 README</Text>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
            <br />
            <Text type="secondary">README 尚未翻译</Text>
            <br />
            <Button
              type="primary"
              icon={<TranslationOutlined />}
              loading={translatingReadme}
              onClick={handleTranslateReadme}
              style={{ marginTop: 8 }}
            >
              翻译 README
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
