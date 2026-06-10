import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Spin,
  Skeleton,
  Descriptions,
  Typography,
  Space,
  Divider,
  Segmented,
  Progress,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import * as cloneApi from '../api/clone'
import type { CloneTaskItem } from '../types'
import dayjs from '../setupDayjs'

const { Title, Text } = Typography

const STATUS_COLOR_MAP: Record<string, string> = {
  RUNNING: 'processing',
  CLONED: 'success',
  COMPLETED: 'success',
  FAILED: 'error',
  SKIPPED: 'warning',
  PENDING: 'default',
}

const STATUS_LABEL_MAP: Record<string, string> = {
  RUNNING: '运行中',
  CLONED: '已克隆',
  COMPLETED: '已完成',
  FAILED: '失败',
  SKIPPED: '跳过',
  PENDING: '等待中',
}

function formatDateTime(value: string | number[] | null | undefined): string {
  if (!value) return '-'
  if (Array.isArray(value)) {
    const [y, m, d, h = 0, min = 0, s = 0] = value
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  if (typeof value === 'string') {
    return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
  }
  return '-'
}

export default function CloneTaskDetail() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()

  const [task, setTask] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CloneTaskItem[]>([])
  const [itemsTotal, setItemsTotal] = useState(0)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState('')

  const fetchTask = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    try {
      const res = await cloneApi.fetchCloneTaskDetail(taskId)
      setTask(res.task)
      // 如果任务正在运行，同时拉取实时进度
      if (res.task?.status === 'RUNNING') {
        try {
          const live = await cloneApi.fetchCloneTask(taskId)
          setProgress(live)
        } catch {}
      } else {
        setProgress(null)
      }
    } catch {
      message.error('加载任务详情失败')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  // 运行中时每2秒轮询进度
  useEffect(() => {
    if (!taskId || task?.status !== 'RUNNING') return
    const timer = setInterval(async () => {
      try {
        const live = await cloneApi.fetchCloneTask(taskId)
        setProgress(live)
        if (live.status === 'COMPLETED' || live.status === 'FAILED') {
          // 重新加载完整数据
          fetchTask()
          fetchItems(1, pageSize, statusFilter)
        }
      } catch {}
    }, 2000)
    return () => clearInterval(timer)
  }, [taskId, task?.status])

  const fetchItems = useCallback(async (page: number, size: number, status?: string) => {
    if (!taskId) return
    setItemsLoading(true)
    try {
      const res = await cloneApi.fetchCloneTaskItems(taskId, page, size, status)
      setItems(res.records)
      setItemsTotal(res.total)
    } catch {
      message.error('加载任务详情失败')
    } finally {
      setItemsLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    fetchTask()
  }, [fetchTask])

  useEffect(() => {
    fetchItems(currentPage, pageSize, statusFilter)
  }, [currentPage, pageSize, statusFilter, fetchItems])

  const itemColumns = [
    {
      title: '仓库名',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (v: string) => (
        <a
          href={`https://github.com/${v}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {v}
        </a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={STATUS_COLOR_MAP[v] || 'default'}>{STATUS_LABEL_MAP[v] || v}</Tag>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (v: string | null | undefined) => v || '-',
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string | null | undefined) => formatDateTime(v),
    },
  ]

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Skeleton.Button active size="small" style={{ width: 60 }} />
          <Skeleton.Input active size="small" style={{ width: 160 }} />
          <Skeleton.Button active size="small" style={{ width: 70 }} />
        </div>
        {/* 基本信息骨架 */}
        <Card style={{ marginBottom: 16 }}>
          <Skeleton active title={{ width: 100 }} paragraph={{ rows: 3 }} />
        </Card>
        {/* 统计卡片骨架 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <Col xs={12} sm={6} key={i}>
              <Card size="small">
                <Skeleton active paragraph={{ rows: 1 }} title={false} />
              </Card>
            </Col>
          ))}
        </Row>
        {/* 表格骨架 */}
        <Card>
          <Skeleton active title={{ width: 120 }} paragraph={{ rows: 5 }} />
        </Card>
      </div>
    )
  }

  if (!task) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Title level={4} type="secondary">任务不存在</Title>
        <Button type="primary" onClick={() => navigate('/clone-tasks')}>返回任务列表</Button>
      </div>
    )
  }

  const stats = [
    { title: '总仓库数', value: task.totalRepos ?? 0, color: '#1677ff', icon: <DownloadOutlined /> },
    { title: '成功', value: task.completedRepos ?? 0, color: '#52c41a', icon: <CheckCircleOutlined /> },
    { title: '失败', value: task.failedRepos ?? 0, color: '#ff4d4f', icon: <CloseCircleOutlined /> },
    { title: '跳过', value: task.skippedRepos ?? 0, color: '#faad14', icon: <WarningOutlined /> },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clone-tasks')}>
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            克隆任务详情
          </Title>
          <Tag color={STATUS_COLOR_MAP[task.status] || 'default'} style={{ fontSize: 14, padding: '2px 12px' }}>
            {STATUS_LABEL_MAP[task.status] || task.status}
          </Tag>
        </Space>
      </div>

      <Spin spinning={loading}>
        {/* 基本信息卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Descriptions title="基本信息" column={{ xs: 1, sm: 2, md: 3 }} size="small">
            <Descriptions.Item label="任务 ID">
              <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{task.taskId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_COLOR_MAP[task.status] || 'default'}>
                {STATUS_LABEL_MAP[task.status] || task.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="并发数">{task.concurrency ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="目标目录">
              <Text code style={{ fontSize: 12 }}>{task.targetDir || '-'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatDateTime(task.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="完成时间">{formatDateTime(task.finishedAt)}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 筛选条件快照 */}
        {(task.keyword || task.language || task.dateField) && (
          <Card style={{ marginBottom: 16 }}>
            <Descriptions title="筛选条件" column={{ xs: 1, sm: 2, md: 3 }} size="small">
              {task.keyword && <Descriptions.Item label="关键词">{task.keyword}</Descriptions.Item>}
              {task.language && <Descriptions.Item label="语言">{task.language}</Descriptions.Item>}
              {task.dateField && <Descriptions.Item label="时间字段">{task.dateField}</Descriptions.Item>}
              {(task.startDate || task.endDate) && (
                <Descriptions.Item label="日期范围">
                  {task.startDate || '...'} ~ {task.endDate || '...'}
                </Descriptions.Item>
              )}
              {task.sortBy && <Descriptions.Item label="排序字段">{task.sortBy}</Descriptions.Item>}
              {task.sortOrder && <Descriptions.Item label="排序方向">{task.sortOrder}</Descriptions.Item>}
              {task.subDirectory && <Descriptions.Item label="子目录">{task.subDirectory}</Descriptions.Item>}
            </Descriptions>
          </Card>
        )}

        {/* 错误信息 */}
        {task.errorMessage && (
          <Card style={{ marginBottom: 16, borderLeft: '4px solid #ff4d4f' }}>
            <Space>
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              <Text type="danger">{task.errorMessage}</Text>
            </Space>
          </Card>
        )}

        {/* 统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {stats.map((s) => (
            <Col xs={12} sm={6} key={s.title}>
              <Card size="small" hoverable>
                <Statistic
                  title={s.title}
                  value={progress ? (s.title === '总仓库数' ? progress.totalRepos : s.title === '成功' ? progress.completedRepos : s.title === '失败' ? progress.failedRepos : progress.skippedRepos) : s.value}
                  valueStyle={{ color: s.color, fontWeight: 600 }}
                  prefix={s.icon}
                />
              </Card>
            </Col>
          ))}
        </Row>

        {/* 实时进度条 */}
        {progress && progress.status === 'RUNNING' && (
          <Card style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spin size="small" />
                <Text>正在重试中...</Text>
              </div>
              <Progress
                percent={progress.totalRepos > 0
                  ? Math.round(((progress.completedRepos + progress.failedRepos + progress.skippedRepos) / progress.totalRepos) * 100)
                  : 0}
                status="active"
                format={() => `${progress.completedRepos + progress.failedRepos + progress.skippedRepos}/${progress.totalRepos}`}
              />
              {progress.results && progress.results.length > 0 && (
                <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 13 }}>
                  {progress.results.slice(-10).reverse().map((r: any, i: number) => (
                    <div key={i} style={{ padding: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.status === 'CLONED' ? '✅' : r.status === 'FAILED' ? '❌' : '⏭'} {r.fullName}
                    </div>
                  ))}
                </div>
              )}
            </Space>
          </Card>
        )}

        <Divider orientation="left" orientationMargin={0}>
          <Text strong style={{ fontSize: 16 }}>仓库克隆明细</Text>
        </Divider>

        {/* 状态筛选 */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>筛选状态：</Text>
            <Segmented
              value={statusFilter || '全部'}
              onChange={(val) => {
                setStatusFilter(val === '全部' ? '' : val as string)
                setCurrentPage(1)
              }}
              options={[
                { label: '全部', value: '全部' },
                { label: `成功 (${task.completedRepos ?? 0})`, value: 'CLONED' },
                { label: `失败 (${task.failedRepos ?? 0})`, value: 'FAILED' },
                { label: `跳过 (${task.skippedRepos ?? 0})`, value: 'SKIPPED' },
              ]}
              size="small"
            />
          </div>
        </Card>

        {/* 明细表格 */}
        <Card>
          <Table
            columns={itemColumns}
            dataSource={items}
            rowKey="id"
            loading={itemsLoading}
            scroll={{ x: 600 }}
            size="small"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: itemsTotal,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (t: number) => `共 ${t} 条`,
              onChange: (page, size) => {
                setCurrentPage(page)
                if (size !== pageSize) setPageSize(size)
              },
            }}
          />
        </Card>
      </Spin>
    </div>
  )
}
