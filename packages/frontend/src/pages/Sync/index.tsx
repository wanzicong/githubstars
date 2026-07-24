import { useState, useEffect, useRef } from 'react'
import { Card, Button, Table, Tag, Statistic, Row, Col, Alert, Typography, Spin } from 'antd'
import { SyncOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import * as syncApi from '../../api'
import type { SyncStatus, SyncLog } from '../../types'
import { formatDate } from '../../utils/format'
import { usePolling } from '../../hooks/usePolling'

const { Title } = Typography

const statusColorMap: Record<string, string> = {
    成功: 'success',
    失败: 'error',
    进行中: 'processing',
    running: 'processing',
    success: 'success',
    failed: 'error',
}

export default function Sync() {
    const [status, setStatus] = useState<SyncStatus | null>(null)
    const [logs, setLogs] = useState<SyncLog[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [syncError, setSyncError] = useState<string | null>(null)

    // 分页状态 + ref（ref 供轮询回调读取最新值，在 onChange 中同步）
    const [pageNum, setPageNum] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const pageNumRef = useRef(pageNum)
    const pageSizeRef = useRef(pageSize)

    const polling = usePolling(async ({ stop }) => {
        try {
            const s = await syncApi.fetchSyncStatus()
            setStatus(s)
            if (!s.syncing) {
                stop()
                try {
                    const res = await syncApi.fetchSyncLogs(pageNumRef.current, pageSizeRef.current)
                    setLogs(res.records)
                    setTotal(res.total)
                } catch { /* ignore */ }
            }
        } catch { /* keep polling */ }
    }, 2000)

    const handleSync = async () => {
        setSyncError(null)
        polling.start()
        try {
            const res = await syncApi.triggerManualSync()
            if (!res.success) {
                setSyncError(res.message || '同步触发失败')
                polling.stop()
                return
            }
        } catch {
            setSyncError('同步请求失败，请稍后重试')
            polling.stop()
        }
    }

    useEffect(() => {
        const init = async () => {
            setLoading(true)
            try {
                const s = await syncApi.fetchSyncStatus()
                setStatus(s)
                if (s.syncing) polling.start()
            } catch { /* ignore */ }
            setLoading(false)
        }
        void init()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const load = async () => {
            try {
                const res = await syncApi.fetchSyncLogs(pageNum, pageSize)
                setLogs(res.records)
                setTotal(res.total)
            } catch { /* ignore */ }
        }
        void load()
    }, [pageNum, pageSize])

    const columns = [
        { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
        {
            title: '同步类型',
            dataIndex: 'syncType',
            key: 'syncType',
            width: 100,
            render: (v: string) => {
                let label: string
                if (v === 'manual') label = '手动'
                else if (v === 'scheduled') label = '定时'
                else label = v
                return <Tag>{label}</Tag>
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{v}</Tag>,
        },
        { title: '总数', dataIndex: 'totalCount', key: 'totalCount', width: 80, align: 'right' as const },
        { title: '已同步数', dataIndex: 'syncedCount', key: 'syncedCount', width: 100, align: 'right' as const },
        {
            title: '开始时间',
            dataIndex: 'startedAt',
            key: 'startedAt',
            width: 170,
            render: (v: string | null) => formatDate(v, 'datetime'),
        },
        {
            title: '完成时间',
            dataIndex: 'finishedAt',
            key: 'finishedAt',
            width: 170,
            render: (v: string | null) => formatDate(v, 'datetime'),
        },
        {
            title: '错误信息',
            dataIndex: 'errorMessage',
            key: 'errorMessage',
            width: 200,
            ellipsis: true,
            render: (v: string | null) => (v ? <span style={{ color: '#ff4d4f' }}>{v}</span> : '-'),
        },
    ]

    return (
        <div>
            <Title level={3} style={{ marginBottom: 24 }}>
                同步管理
            </Title>

            <Spin spinning={loading}>
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} sm={12} md={6}>
                        <Card>
                            <Statistic
                                title='仓库总数'
                                value={status?.totalRepos ?? 0}
                                prefix={<CheckCircleOutlined style={{ color: '#1677ff' }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                        <Card>
                            <Statistic
                                title='上次同步数'
                                value={status?.lastSyncCount ?? 0}
                                prefix={<SyncOutlined style={{ color: '#52c41a' }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                        <Card>
                            <Statistic
                                title='上次同步时间'
                                value={formatDate(status?.lastSyncTime ?? null, 'datetime')}
                                valueStyle={{ fontSize: 14 }}
                                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                        <Card>
                            <Statistic
                                title='当前状态'
                                value=' '
                                valueStyle={{ fontSize: 0 }}
                                formatter={() => (
                                    <Tag
                                        color={status?.syncing ? 'processing' : statusColorMap[status?.status ?? ''] || 'default'}
                                        style={{ fontSize: 14, padding: '2px 12px' }}
                                    >
                                        {status?.syncing ? '同步中' : status?.status || '空闲'}
                                    </Tag>
                                )}
                            />
                        </Card>
                    </Col>
                </Row>

                <Card style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <Button type='primary' icon={<SyncOutlined spin={polling.isPolling} />} onClick={handleSync} loading={polling.isPolling}>
                            立即同步
                        </Button>
                        {polling.isPolling && <span style={{ color: '#1677ff' }}>正在同步中，请稍候...</span>}
                    </div>
                    {syncError && (
                        <Alert type='error' message={syncError} closable onClose={() => setSyncError(null)} style={{ marginTop: 12 }} />
                    )}
                    {status?.syncing && (
                        <Alert type='info' message='系统正在执行同步任务，数据持续更新中...' showIcon style={{ marginTop: 12 }} />
                    )}
                </Card>

                <Card title='同步日志'>
                    <Table
                        columns={columns}
                        dataSource={logs}
                        rowKey='id'
                        pagination={{
                            current: pageNum,
                            pageSize: pageSize,
                            total: total,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50'],
                            showTotal: (t: number) => `共 ${t} 条`,
                        }}
                        onChange={(pagination) => {
                            if (pagination.current) { setPageNum(pagination.current); pageNumRef.current = pagination.current }
                            if (pagination.pageSize) { setPageSize(pagination.pageSize); pageSizeRef.current = pagination.pageSize }
                        }}
                        scroll={{ x: 980 }}
                        size='small'
                    />
                </Card>
            </Spin>
        </div>
    )
}
