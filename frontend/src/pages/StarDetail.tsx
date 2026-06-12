import { useState, useEffect, useCallback, useRef } from 'react'
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
  Modal,
  Progress,
  Alert,
} from 'antd'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
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
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  BulbOutlined,
  ExpandOutlined,
} from '@ant-design/icons'
import * as statsApi from '../api/stats'
import * as translateApi from '../api/translate'
import * as similarApi from '../api/similar'
import { formatNumberCn } from '../utils/format'
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

// README 渲染组件配置（卡片和全屏弹窗共用）
const README_COMPONENTS = {
  h1: ({ children }: { children: React.ReactNode }) => <h1 style={{ fontSize: 22, borderBottom: '1px solid #eee', paddingBottom: 8, marginTop: 24, marginBottom: 12 }}>{children}</h1>,
  h2: ({ children }: { children: React.ReactNode }) => <h2 style={{ fontSize: 19, borderBottom: '1px solid #eee', paddingBottom: 6, marginTop: 20, marginBottom: 10 }}>{children}</h2>,
  h3: ({ children }: { children: React.ReactNode }) => <h3 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>{children}</h3>,
  h4: ({ children }: { children: React.ReactNode }) => <h4 style={{ fontSize: 14, marginTop: 12, marginBottom: 6 }}>{children}</h4>,
  p: ({ children }: { children: React.ReactNode }) => <p style={{ lineHeight: 1.8, marginBottom: 12, fontSize: 14 }}>{children}</p>,
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>{children}</a>,
  ul: ({ children }: { children: React.ReactNode }) => <ul style={{ paddingLeft: 24, marginBottom: 12, lineHeight: 1.8 }}>{children}</ul>,
  ol: ({ children }: { children: React.ReactNode }) => <ol style={{ paddingLeft: 24, marginBottom: 12, lineHeight: 1.8 }}>{children}</ol>,
  li: ({ children }: { children: React.ReactNode }) => <li style={{ marginBottom: 4, fontSize: 14 }}>{children}</li>,
  code: ({ children }: { children: React.ReactNode }) => <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 3, fontSize: 13, fontFamily: "'SFMono-Regular', Consolas, monospace" }}>{children}</code>,
  pre: ({ children }: { children: React.ReactNode }) => <pre style={{ backgroundColor: '#f6f8fa', padding: 16, borderRadius: 6, overflow: 'auto', fontSize: 13, lineHeight: 1.5, marginBottom: 16, border: '1px solid #e8e8e8' }}>{children}</pre>,
  blockquote: ({ children }: { children: React.ReactNode }) => <blockquote style={{ borderLeft: '4px solid #1677ff', paddingLeft: 16, color: '#666', margin: '12px 0', fontStyle: 'italic' }}>{children}</blockquote>,
  table: ({ children }: { children: React.ReactNode }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 16 }}>{children}</table>,
  th: ({ children }: { children: React.ReactNode }) => <th style={{ border: '1px solid #ddd', padding: '8px 12px', backgroundColor: '#f5f5f5', fontWeight: 600, fontSize: 13 }}>{children}</th>,
  td: ({ children }: { children: React.ReactNode }) => <td style={{ border: '1px solid #ddd', padding: '8px 12px', fontSize: 13 }}>{children}</td>,
  img: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt || ''} style={{ maxWidth: '100%', marginBottom: 12 }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = 'none' }} />,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '20px 0' }} />,
  strong: ({ children }: { children: React.ReactNode }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
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

  // 异步翻译进度
  const [translateTaskId, setTranslateTaskId] = useState<number | null>(null)
  const [translateModalVisible, setTranslateModalVisible] = useState(false)
  const [translateProgress, setTranslateProgress] = useState<{ status: string; progress: number; readmeCompleted: number; readmeFailed: number; readmeTotal: number } | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const repoIdRef = useRef<number | null>(null)

  // 同步 repo.id 到 ref
  useEffect(() => { repoIdRef.current = repo?.id ?? null }, [repo?.id])

  const stopPolling = useCallback(() => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null } }, [])
  const startPolling = useCallback((taskId: number) => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await translateApi.getTaskProgress(taskId)
        if (res.success) {
          setTranslateProgress({ status: res.status, progress: res.progress, readmeCompleted: res.readmeCompleted, readmeFailed: res.readmeFailed, readmeTotal: res.readmeTotal })
          if (res.status === 'COMPLETED' || res.status === 'FAILED') {
            stopPolling()
            const rid = repoIdRef.current
            if (rid) {
              const updated = await translateApi.fetchRepoDetail(rid)
              if (updated && updated.id) setRepo(updated)
            }
          }
        }
      } catch { }
    }, 2000)
  }, [stopPolling])

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
      const result = await translateApi.startSingleReadme(repo.id)
      if (result.success && result.taskId) {
        setTranslateTaskId(result.taskId)
        setTranslateProgress({ status: 'PENDING', progress: 0, readmeCompleted: 0, readmeFailed: 0, readmeTotal: 1 })
        setTranslateModalVisible(true)
        startPolling(result.taskId)
        message.success('翻译任务已提交，正在后台执行...')
      } else {
        message.info(result.message || '提交失败')
      }
    } catch {
      message.error('提交翻译任务失败')
    } finally {
      setTranslatingReadme(false)
    }
  }

  const handleRetranslateReadme = async () => {
    if (!repo?.id) return
    setTranslatingReadme(true)
    try {
      const result = await translateApi.retranslateReadme(repo.id)
      if (result.success && result.taskId) {
        setTranslateTaskId(result.taskId)
        setTranslateProgress({ status: 'PENDING', progress: 0, readmeCompleted: 0, readmeFailed: 0, readmeTotal: 1 })
        setTranslateModalVisible(true)
        startPolling(result.taskId)
        message.success('重新翻译任务已提交，正在后台执行...')
      } else {
        message.info(result.message || '提交失败')
      }
    } catch {
      message.error('提交重新翻译任务失败')
    } finally {
      setTranslatingReadme(false)
    }
  }

  // 相似项目
  const [similarLoading, setSimilarLoading] = useState(false)
  const [similarModalVisible, setSimilarModalVisible] = useState(false)
  const [readmeFullscreenVisible, setReadmeFullscreenVisible] = useState(false)
  const [similarRepos, setSimilarRepos] = useState<similarApi.SimilarRepo[]>([])

  const handleFindSimilar = async () => {
    if (!repo?.id) return
    setSimilarLoading(true)
    setSimilarModalVisible(true)
    setSimilarRepos([])
    try {
      const result = await similarApi.findSimilarRepos(repo.id)
      if (result.success) setSimilarRepos(result.repos)
      else message.info('未找到相似项目')
    } catch { message.error('搜索相似项目失败') }
    finally { setSimilarLoading(false) }
  }

  const handleCloseTranslateModal = () => { stopPolling(); setTranslateModalVisible(false); setTranslateTaskId(null); setTranslateProgress(null) }

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
              icon={<SearchOutlined />}
              loading={similarLoading}
              onClick={handleFindSimilar}
            >
              发现相似项目
            </Button>
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
              formatter={(value) => <span>{value} <Text type="secondary" style={{ fontSize: 12 }}>{formatNumberCn(Number(value))}</Text></span>}
            />
          </Card>
        </Col>
        <Col {...statColStyle}>
          <Card size="small">
            <Statistic
              title="Forks"
              value={repo.forksCount}
              prefix={<ForkOutlined style={{ color: '#52c41a' }} />}
              formatter={(value) => <span>{value} <Text type="secondary" style={{ fontSize: 12 }}>{formatNumberCn(Number(value))}</Text></span>}
            />
          </Card>
        </Col>
        <Col {...statColStyle}>
          <Card size="small">
            <Statistic
              title="Watchers"
              value={repo.watchersCount}
              prefix={<EyeOutlined style={{ color: '#1677ff' }} />}
              formatter={(value) => <span>{value} <Text type="secondary" style={{ fontSize: 12 }}>{formatNumberCn(Number(value))}</Text></span>}
            />
          </Card>
        </Col>
        <Col {...statColStyle}>
          <Card size="small">
            <Statistic
              title="Open Issues"
              value={repo.openIssuesCount}
              prefix={<BugOutlined style={{ color: '#ff4d4f' }} />}
              formatter={(value) => <span>{value} <Text type="secondary" style={{ fontSize: 12 }}>{formatNumberCn(Number(value))}</Text></span>}
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
          <Descriptions.Item label="所属分类">
            {repo.categoryNames && repo.categoryNames.length > 0 ? (
              <Space size={4} wrap>
                {repo.categoryNames.map((cat) => (
                  <Tag key={cat} color="green">{cat}</Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">未分类</Text>
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
          ) : (
            <Space>
              {repo.readmeCn && (
                <Button
                  size="small"
                  icon={<ExpandOutlined />}
                  onClick={() => setReadmeFullscreenVisible(true)}
                >
                  放大查看
                </Button>
              )}
              {repo.readmeCn ? (
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={translatingReadme}
                  onClick={handleRetranslateReadme}
                >
                  重新翻译
                </Button>
              ) : (
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={translatingReadme}
                  onClick={handleRetranslateReadme}
                >
                  重新获取
                </Button>
              )}
            </Space>
          )
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
              rehypePlugins={[rehypeRaw]}
              remarkPlugins={[remarkGfm]}
              components={README_COMPONENTS}
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

      {/* 相似项目弹窗 */}
      <Modal
        title={<Space><SearchOutlined /> 发现相似项目</Space>}
        open={similarModalVisible}
        onCancel={() => setSimilarModalVisible(false)}
        footer={<Button type="primary" onClick={() => setSimilarModalVisible(false)}>关闭</Button>}
        width={800}
        style={{ top: 20 }}
      >
        <Spin spinning={similarLoading} tip="正在搜索 GitHub 相似项目...">
          {similarRepos.length > 0 ? (
            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={`找到 ${similarRepos.length} 个相似项目（过滤条件: Star≥100, 3个月内活跃, AI排序）`}
              />
              {similarRepos.map((r, i) => (
                <Card
                  key={r.fullName}
                  size="small"
                  style={{ marginBottom: 12 }}
                  extra={
                    <Button size="small" type="link" onClick={() => window.open(r.htmlUrl, '_blank')}>
                      <GithubOutlined /> GitHub
                    </Button>
                  }
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 14 }}>
                        <a href={r.htmlUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>
                          {r.fullName}
                        </a>
                      </Text>
                      {r.description && (
                        <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 4, fontSize: 12 }}>
                          {r.description}
                        </Paragraph>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {r.language && <Tag color="blue" style={{ fontSize: 11 }}>{r.language}</Tag>}
                        <span><StarFilled style={{ color: '#faad14', fontSize: 11 }} /> <Text style={{ fontSize: 12 }}>{r.stars}</Text></span>
                        <span><ForkOutlined style={{ fontSize: 11 }} /> <Text style={{ fontSize: 12 }}>{r.forks}</Text></span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 80 }}>
                      <Text style={{ fontSize: 11, color: '#999' }}>
                        评分<br /><span style={{ fontSize: 18, color: '#faad14', fontWeight: 600 }}>{r.score.toFixed(1)}</span>
                      </Text>
                    </div>
                  </div>
                  {r.aiReason && (
                    <div style={{ marginTop: 8, padding: '6px 10px', backgroundColor: '#fffbe6', borderRadius: 6, border: '1px solid #ffe58f' }}>
                      <Text style={{ fontSize: 12 }}>
                        <BulbOutlined style={{ color: '#faad14', marginRight: 4 }} />
                        <Text type="secondary">AI 推荐: </Text>
                        {r.aiReason}
                      </Text>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : !similarLoading ? (
            <Empty description="未找到符合条件的相似项目">
              <Text type="secondary" style={{ fontSize: 12 }}>
                筛选条件: Star ≥ 100 | 3个月内活跃 | 按 topic 和语言匹配
              </Text>
            </Empty>
          ) : null}
        </Spin>
      </Modal>

      {/* README 全屏查看弹窗 */}
      <Modal
        title={
          <Space>
            <ExpandOutlined />
            <span>README 中文翻译 - 全屏查看</span>
          </Space>
        }
        open={readmeFullscreenVisible}
        onCancel={() => setReadmeFullscreenVisible(false)}
        footer={
          <Button type="primary" onClick={() => setReadmeFullscreenVisible(false)}>
            关闭
          </Button>
        }
        width="95%"
        style={{ top: 20, paddingBottom: 0 }}
        styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflow: 'auto', padding: '16px 24px' } }}
      >
        <div className="readme-markdown" style={{ padding: '8px 16px' }}>
          {repo?.readmeCn && (
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              remarkPlugins={[remarkGfm]}
              components={README_COMPONENTS}
            >
              {repo.readmeCn}
            </ReactMarkdown>
          )}
        </div>
      </Modal>

      {/* 异步翻译进度弹窗 */}
      <Modal
        title="README 翻译进度"
        open={translateModalVisible}
        onCancel={handleCloseTranslateModal}
        footer={translateProgress && translateProgress.status !== 'PENDING' && translateProgress.status !== 'PROCESSING' ? (
          <Button type="primary" onClick={handleCloseTranslateModal}>关闭</Button>
        ) : null}
        maskClosable={false}
        closable={translateProgress?.status !== 'PENDING' && translateProgress?.status !== 'PROCESSING'}
      >
        {translateProgress && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Spin spinning={translateProgress.status === 'PENDING' || translateProgress.status === 'PROCESSING'}>
              <div style={{ padding: 8 }}>
                {translateProgress.status === 'COMPLETED' && translateProgress.readmeFailed === 0 && (
                  <div style={{ fontSize: 48, marginBottom: 8 }}><CheckCircleOutlined style={{ color: '#52c41a' }} /></div>
                )}
                {translateProgress.status === 'COMPLETED' && translateProgress.readmeFailed > 0 && (
                  <div style={{ fontSize: 48, marginBottom: 8 }}><CloseCircleOutlined style={{ color: '#ff4d4f' }} /></div>
                )}
                <Progress
                  type="circle"
                  percent={translateProgress.progress}
                  status={translateProgress.status === 'COMPLETED' ? (translateProgress.readmeFailed > 0 ? 'exception' : 'success') : translateProgress.status === 'FAILED' ? 'exception' : 'active'}
                  size={120}
                />
                <div style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
                  {translateProgress.status === 'PENDING' && '等待执行...'}
                  {translateProgress.status === 'PROCESSING' && '正在翻译 README...'}
                  {translateProgress.status === 'COMPLETED' && translateProgress.readmeFailed === 0 && '翻译完成！'}
                  {translateProgress.status === 'COMPLETED' && translateProgress.readmeFailed > 0 && '翻译完成（失败）'}
                  {translateProgress.status === 'FAILED' && '翻译失败'}
                </div>
              </div>
            </Spin>
            <Alert
              style={{ marginTop: 12, textAlign: 'left' }}
              type="info"
              showIcon
              message={
                <div style={{ fontSize: 13 }}>
                  <div>正在获取 GitHub README 并调用 DeepSeek 翻译，请耐心等待...</div>
                  <div style={{ marginTop: 4 }}>超时时间：5 分钟 | 失败自动重试 3 次</div>
                </div>
              }
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
