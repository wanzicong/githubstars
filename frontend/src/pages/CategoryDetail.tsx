import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Button,
  Breadcrumb,
  Descriptions,
  Empty,
  Spin,
  Typography,
  App,
  Row,
  Col,
  Tag,
  Avatar,
  Space,
} from 'antd'
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  FolderOutlined,
  StarFilled,
  ForkOutlined,
  GithubOutlined,
} from '@ant-design/icons'
import * as categoriesApi from '../api/categories'
import type { Category, GithubRepo } from '../types'
import dayjs from 'dayjs'

const { Title, Paragraph, Text } = Typography

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr
}

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>()
  const { message, modal } = App.useApp()
  const navigate = useNavigate()

  const [category, setCategory] = useState<Category | null>(null)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [reclassifying, setReclassifying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reposLoading, setReposLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await categoriesApi.fetchAllCategories()
      setAllCategories(data)
      const current = data.find((c) => c.id === Number(id))
      if (current) {
        setCategory(current)
      }
    } catch {
      message.error('获取分类信息失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchRepos = async () => {
    if (!id) return
    setReposLoading(true)
    try {
      const data = await categoriesApi.fetchReposByCategoryId(Number(id))
      setRepos(data)
    } catch {
      message.error('获取仓库列表失败')
    } finally {
      setReposLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchData()
      fetchRepos()
    }
  }, [id])

  const handleReclassify = () => {
    if (!category) return
    modal.confirm({
      title: 'AI 重分类',
      content: `将对分类「${category.name}」下的仓库使用 AI 重新进行分类，可能需要一些时间。是否继续？`,
      okText: '开始重分类',
      cancelText: '取消',
      onOk: async () => {
        setReclassifying(true)
        try {
          const res = await categoriesApi.reclassifyCategory(category.id, 8)
          if (res.success) {
            message.success('AI 重分类任务已触发，请稍后刷新查看结果')
            fetchData()
            fetchRepos()
          } else {
            message.error(res.message || 'AI 重分类失败')
          }
        } catch {
          message.error('AI 重分类请求失败，请稍后重试')
        } finally {
          setReclassifying(false)
        }
      },
    })
  }

  if (loading && !category) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!loading && !category) {
    return (
      <div>
        <Breadcrumb
          items={[
            { title: <a onClick={() => navigate('/categories')}>分类管理</a> },
            { title: '未找到' },
          ]}
          style={{ marginBottom: 24 }}
        />
        <Empty description="分类不存在或已被删除" />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/categories')}>
            返回分类列表
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { title: <a onClick={() => navigate('/categories')}>分类管理</a> },
          { title: category?.name },
        ]}
        style={{ marginBottom: 24 }}
      />

      <Spin spinning={loading}>
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>
                <FolderOutlined style={{ marginRight: 8 }} />
                {category?.name}
              </Title>
              {category?.description && (
                <Paragraph type="secondary" style={{ marginBottom: 12, maxWidth: 600 }}>
                  {category.description}
                </Paragraph>
              )}
              <Descriptions size="small" column={3}>
                <Descriptions.Item label="仓库数量">{repos.length || (category?.repoCount ?? 0)}</Descriptions.Item>
                <Descriptions.Item label="排序">{category?.sortOrder ?? 0}</Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {formatDateTime(category?.createdAt ?? null)}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {formatDateTime(category?.updatedAt ?? null)}
                </Descriptions.Item>
              </Descriptions>
            </div>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleReclassify}
              loading={reclassifying}
            >
              AI 重分类
            </Button>
          </div>
        </Card>

        <Card title={`仓库列表 (${repos.length})`}>
          <Spin spinning={reposLoading}>
            {repos.length > 0 ? (
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
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
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
                            <a
                              style={{ color: '#1677ff' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                window.location.href = `/stars/${repo.id}`
                              }}
                            >
                              {repo.repoName}
                            </a>
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                            {repo.ownerName}
                          </Text>
                        </div>
                      </div>
                      {repo.descriptionCn ? (
                        <Paragraph
                          ellipsis={{ rows: 2 }}
                          style={{ marginBottom: 10, fontSize: 12, minHeight: 36, color: '#333' }}
                        >
                          {repo.descriptionCn}
                          <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>🇨🇳</Text>
                        </Paragraph>
                      ) : repo.description ? (
                        <Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          style={{ marginBottom: 10, fontSize: 12, minHeight: 36 }}
                        >
                          {repo.description}
                        </Paragraph>
                      ) : (
                        <div style={{ marginBottom: 10, minHeight: 36 }} />
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {repo.language && (
                          <Tag color="blue" style={{ margin: 0 }}>
                            {repo.language}
                          </Tag>
                        )}
                        <Space size={4}>
                          <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
                          <Text style={{ fontSize: 12 }}>{repo.starsCount}</Text>
                        </Space>
                        <Space size={4}>
                          <ForkOutlined style={{ fontSize: 12 }} />
                          <Text style={{ fontSize: 12 }}>{repo.forksCount}</Text>
                        </Space>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Star 于 {formatDate(repo.starredAt)}
                        </Text>
                        <Button
                          type="link"
                          size="small"
                          icon={<GithubOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(repo.htmlUrl, '_blank')
                          }}
                          style={{ padding: 0 }}
                        />
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              !reposLoading && (
                <Empty description="该分类下暂无仓库" />
              )
            )}
          </Spin>
        </Card>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/categories')}>
            返回分类列表
          </Button>
        </div>
      </Spin>
    </div>
  )
}
