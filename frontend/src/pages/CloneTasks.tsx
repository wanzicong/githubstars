import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Tag, Button, Space, Popconfirm, message, Spin, Typography } from 'antd'
import {
    DeleteOutlined,
    ArrowLeftOutlined,
    ReloadOutlined,
    RedoOutlined,
    ThunderboltOutlined,
    PushpinOutlined,
    PushpinFilled,
} from '@ant-design/icons'
import * as cloneApi from '../api/clone'
import type { CloneTaskRecord } from '../types'
import dayjs from '../setupDayjs'

const { Title } = Typography

const STATUS_COLOR_MAP: Record<string, string> = {
    RUNNING: 'processing',
    COMPLETED: 'success',
    FAILED: 'error',
    PENDING: 'default',
}

const STATUS_LABEL_MAP: Record<string, string> = {
    RUNNING: '运行中',
    COMPLETED: '已完成',
    FAILED: '失败',
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

function buildFilterSummary(record: CloneTaskRecord): string {
    const parts: string[] = []
    if (record.keyword) parts.push(`关键词:${record.keyword}`)
    if (record.language) parts.push(`语言:${record.language}`)
    if (record.dateField) {
        let range = record.dateField
        if (record.startDate || record.endDate) {
            range += ` ${record.startDate || '...'}~${record.endDate || '...'}`
        }
        parts.push(range)
    }
    return parts.join(' | ') || '-'
}

export default function CloneTasks() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [listLoading, setListLoading] = useState(false)
    const [data, setData] = useState<CloneTaskRecord[]>([])
    const [total, setTotal] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [deleting, setDeleting] = useState<string | null>(null)

    const fetchData = useCallback(async (page: number, size: number) => {
        setListLoading(true)
        try {
            const res = await cloneApi.fetchCloneTasks(page, size)
            setData(res.records)
            setTotal(res.total)
        } catch {
            message.error('加载克隆任务列表失败')
        } finally {
            setListLoading(false)
        }
    }, [])

    useEffect(() => {
        setLoading(true)
        fetchData(currentPage, pageSize).finally(() => setLoading(false))
    }, [currentPage, pageSize, fetchData])

    // 有运行中任务时每3秒自动刷新
    const hasRunning = data.some((r) => r.status === 'RUNNING')
    useEffect(() => {
        if (!hasRunning) return
        const timer = setInterval(() => fetchData(currentPage, pageSize), 3000)
        return () => clearInterval(timer)
    }, [hasRunning, currentPage, pageSize, fetchData])

    const handlePin = useCallback(
        async (taskId: string, currentPinned: boolean) => {
            try {
                const res = await cloneApi.togglePinCloneTask(taskId)
                if (res.success) {
                    message.success(res.message)
                    fetchData(currentPage, pageSize)
                }
            } catch {
                message.error('操作失败')
            }
        },
        [fetchData, currentPage, pageSize],
    )

    const handleDelete = useCallback(
        async (taskId: string) => {
            setDeleting(taskId)
            try {
                const res = await cloneApi.deleteCloneTask(taskId)
                if (res.success) {
                    message.success('删除成功')
                    fetchData(currentPage, pageSize)
                } else {
                    message.error(res.message || '删除失败')
                }
            } catch {
                message.error('删除失败')
            } finally {
                setDeleting(null)
            }
        },
        [fetchData, currentPage, pageSize],
    )

    const handleRetry = useCallback(
        async (taskId: string) => {
            try {
                const res = await cloneApi.retryCloneTask(taskId)
                if (res.success) {
                    message.success(res.message || '重试已启动')
                    fetchData(currentPage, pageSize)
                } else {
                    message.warning(res.message || '重试失败')
                }
            } catch {
                message.error('重试请求失败')
            }
        },
        [fetchData, currentPage, pageSize],
    )

    const [retryingAll, setRetryingAll] = useState(false)
    const hasIncompleteItems = data.some((r) => r.totalRepos > r.completedRepos && (r.status === 'COMPLETED' || r.status === 'FAILED'))

    const handleRefresh = useCallback(() => {
        fetchData(currentPage, pageSize)
    }, [fetchData, currentPage, pageSize])

    const handleRetryAll = useCallback(async () => {
        setRetryingAll(true)
        try {
            const res = await cloneApi.retryAllCloneTasks()
            if (res.success) {
                message.success(res.message || '已开始重试全部失败项')
                fetchData(currentPage, pageSize)
            } else {
                message.warning(res.message || '一键重试失败')
            }
        } catch {
            message.error('一键重试请求失败')
        } finally {
            setRetryingAll(false)
        }
    }, [fetchData, currentPage, pageSize])

    const columns = [
        {
            title: '任务 ID',
            dataIndex: 'taskId',
            key: 'taskId',
            width: 100,
            ellipsis: true,
            render: (v: string) => (
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.length > 12 ? v.substring(0, 12) + '...' : v}</span>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (v: string) => <Tag color={STATUS_COLOR_MAP[v] || 'default'}>{STATUS_LABEL_MAP[v] || v}</Tag>,
        },
        {
            title: '总仓库数',
            dataIndex: 'totalRepos',
            key: 'totalRepos',
            width: 90,
            align: 'right' as const,
        },
        {
            title: '成功',
            dataIndex: 'completedRepos',
            key: 'completedRepos',
            width: 80,
            align: 'right' as const,
            render: (v: number) => <span style={{ color: '#52c41a' }}>{v}</span>,
        },
        {
            title: '失败',
            dataIndex: 'failedRepos',
            key: 'failedRepos',
            width: 80,
            align: 'right' as const,
            render: (v: number) => (v > 0 ? <span style={{ color: '#ff4d4f' }}>{v}</span> : v),
        },
        {
            title: '跳过',
            dataIndex: 'skippedRepos',
            key: 'skippedRepos',
            width: 80,
            align: 'right' as const,
            render: (v: number) => (v > 0 ? <span style={{ color: '#faad14' }}>{v}</span> : v),
        },
        {
            title: '并发数',
            dataIndex: 'concurrency',
            key: 'concurrency',
            width: 70,
            align: 'center' as const,
        },
        {
            title: '筛选条件',
            key: 'filterSummary',
            width: 200,
            ellipsis: true,
            render: (_: unknown, record: CloneTaskRecord) => <span style={{ fontSize: 12 }}>{buildFilterSummary(record)}</span>,
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 160,
            render: (v: string | null | undefined) => formatDateTime(v),
        },
        {
            title: '操作',
            key: 'action',
            width: 160,
            render: (_: unknown, record: CloneTaskRecord) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Space size='small'>
                        <Button
                            type='link'
                            size='small'
                            icon={record.pinned === 1 ? <PushpinFilled style={{ color: '#faad14' }} /> : <PushpinOutlined />}
                            onClick={() => handlePin(record.taskId, record.pinned === 1)}
                            title={record.pinned === 1 ? '取消置顶' : '置顶'}
                        />
                        {(record.status === 'COMPLETED' || record.status === 'FAILED') && record.totalRepos > record.completedRepos && (
                            <Button type='link' size='small' icon={<RedoOutlined />} onClick={() => handleRetry(record.taskId)}>
                                重试
                            </Button>
                        )}
                        <Popconfirm
                            title='确认删除'
                            description='删除后将无法恢复，确定要删除此任务记录吗？'
                            onConfirm={() => handleDelete(record.taskId)}
                            okText='删除'
                            cancelText='取消'
                        >
                            <Button type='link' danger size='small' icon={<DeleteOutlined />} loading={deleting === record.taskId}>
                                删除
                            </Button>
                        </Popconfirm>
                    </Space>
                </div>
            ),
        },
    ]

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>
                    克隆任务管理
                </Title>
                <Space>
                    {hasIncompleteItems && (
                        <Button type='primary' icon={<ThunderboltOutlined />} onClick={handleRetryAll} loading={retryingAll}>
                            一键重试全部
                        </Button>
                    )}
                    <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={listLoading}>
                        刷新
                    </Button>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
                        返回列表
                    </Button>
                </Space>
            </div>

            <Spin spinning={loading}>
                <Card>
                    <Table
                        columns={columns}
                        dataSource={data}
                        rowKey='taskId'
                        loading={listLoading}
                        scroll={{ x: 1100 }}
                        size='small'
                        onRow={(record) => ({
                            onClick: () => navigate(`/clone-tasks/${record.taskId}`),
                            style: { cursor: 'pointer' },
                        })}
                        pagination={{
                            current: currentPage,
                            pageSize: pageSize,
                            total: total,
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
