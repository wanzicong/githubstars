import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Button, Table, Tag, Statistic, Row, Col, Alert, Typography, Spin } from 'antd'
import { SyncOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import * as syncApi from '../api/sync'
import type { SyncStatus, SyncLog } from '../types'
import dayjs from 'dayjs'

const { Title } = Typography

const statusColorMap: Record<string, string> = {
  '成功': 'success',
  '失败': 'error',
  '进行中': 'processing',
  'running': 'processing',
  'success': 'success',
  'failed': 'error',
}

function formatDateTime(value: string | number[] | null): string {
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

export default function Sync() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isPolling, setIsPolling] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [syncError, setSyncError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pageNumRef = useRef(pageNum)
  const pageSizeRef = useRef(pageSize)

  useEffect(() => { pageNumRef.current = pageNum }, [pageNum])
  useEffect(() => { pageSizeRef.current = pageSize }, [pageSize])

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsPolling(false)
  }, [])

  const startPolling = useCallback(() => {
    if (timerRef.current) return
    setIsPolling(true)
    timerRef.current = setInterval(async () => {
      try {
        const s = await syncApi.fetchSyncStatus()
        setStatus(s)
        if (!s.syncing) {
          stopPolling()
          try {
            const res = await syncApi.fetchSyncLogs(pageNumRef.current, pageSizeRef.current)
            setLogs(res.records)
            setTotal(res.total)
          } catch { /* ignore */ }
        }
      } catch { /* keep polling */ }
    }, 2000)
  }, [stopPolling])

  const fetchLogs = useCallback(async (page: number, size: number) => {
    try {
      const res = await syncApi.fetchSyncLogs(page, size)
      setLogs(res.records)
      setTotal(res.total)
    } catch { /* ignore */ }
  }, [])

  const handleSync = async () => {
    setSyncError(null)
    setIsPolling(true)
    try {
      const res = await syncApi.triggerManualSync()
      if (!res.success) {
        setSyncError(res.message || '同步触发失败')
        setIsPolling(false)
        return
      }
      startPolling()
    } catch {
      setSyncError('同步请求失败，请稍后重试')
      setIsPolling(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const s = await syncApi.fetchSyncStatus()
        setStatus(s)
        if (s.syncing) {
          startPolling()
        }
      } catch { /* ignore */ }
      try {
        const res = await syncApi.fetchSyncLogs(1, 10)
        setLogs(res.records)
        setTotal(res.total)
      } catch { /* ignore */ }
      setLoading(false)
    }
    init()

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [startPolling])

  useEffect(() => {
    fetchLogs(pageNum, pageSize)
  }, [pageNum, pageSize, fetchLogs])

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: '同步类型',
      dataIndex: 'syncType',
      key: 'syncType',
      width: 100,
      render: (v: string) => (
        <Tag>{v === 'manual' ? '手动' : v === 'scheduled' ? '定时' : v}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={statusColorMap[v] || 'default'}>{v}</Tag>
      ),
    },
    { title: '总数', dataIndex: 'totalCount', key: 'totalCount', width: 80, align: 'right' as const },
    { title: '已同步数', dataIndex: 'syncedCount', key: 'syncedCount', width: 100, align: 'right' as const },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 170,
      render: (v: string | null) => formatDateTime(v),
    },
    {
      title: '完成时间',
      dataIndex: 'finishedAt',
      key: 'finishedAt',
      width: 170,
      render: (v: string | null) => formatDateTime(v),
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      width: 200,
      ellipsis: true,
      render: (v: string | null) => v ? <span style={{ color: '#ff4d4f' }}>{v}</span> : '-',
    },
  ]

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        同步管理
      </Title>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="仓库总数"
                value={status?.totalRepos ?? 0}
                prefix={<CheckCircleOutlined style={{ color: '#1677ff' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="上次同步数"
                value={status?.lastSyncCount ?? 0}
                prefix={<SyncOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="上次同步时间"
                value={formatDateTime(status?.lastSyncTime ?? null)}
                valueStyle={{ fontSize: 14 }}
                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="当前状态"
                value=" "
                valueStyle={{ fontSize: 0 }}
                formatter={() => (
                  <Tag
                    color={
                      status?.syncing
                        ? 'processing'
                        : statusColorMap[status?.status ?? ''] || 'default'
                    }
                    style={{ fontSize: 14, padding: '2px 12px' }}
                  >
                    {status?.syncing ? '同步中' : (status?.status || '空闲')}
                  </Tag>
                )}
              />
            </Card>
          </Col>
        </Row>

        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="primary"
              icon={<SyncOutlined spin={isPolling} />}
              onClick={handleSync}
              loading={isPolling}
            >
              立即同步
            </Button>
            {isPolling && (
              <span style={{ color: '#1677ff' }}>正在同步中，请稍候...</span>
            )}
          </div>
          {syncError && (
            <Alert
              type="error"
              message={syncError}
              closable
              onClose={() => setSyncError(null)}
              style={{ marginTop: 12 }}
            />
          )}
          {status?.syncing && (
            <Alert
              type="info"
              message="系统正在执行同步任务，数据持续更新中..."
              showIcon
              style={{ marginTop: 12 }}
            />
          )}
        </Card>

        <Card title="同步日志">
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            pagination={{
              current: pageNum,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (t: number) => `共 ${t} 条`,
            }}
            onChange={(pagination) => {
              if (pagination.current) setPageNum(pagination.current)
              if (pagination.pageSize) setPageSize(pagination.pageSize)
            }}
            scroll={{ x: 980 }}
            size="small"
          />
        </Card>
      </Spin>
    </div>
  )
}
