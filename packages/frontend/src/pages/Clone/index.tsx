import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, Table, Tag, Button, Space, Typography, Row, Col, Statistic, Progress, App, Popconfirm } from 'antd'
import { ReloadOutlined, CopyOutlined, FolderOutlined, UndoOutlined, DeleteOutlined } from '@ant-design/icons'
import { getRecentCloneTasks, getCloneTaskProgress, retryCloneFailed, retryCloneItem, resetCloneTask, deleteCloneTask } from '@/api/clone'
import type { CloneTaskProgress, CloneTaskListResult } from '@/api/clone'
import CloneProgressModal from '@/components/clone/CloneProgressModal'
import { usePolling } from '@/hooks/usePolling'
import dayjs from '@/config/setupDayjs'

const { Title, Text } = Typography

/**
 * 克隆任务管理页面
 *
 * 展示所有克隆任务列表、进度、操作（重试/查看详情）
 */
export default function Clone() {
    const { message } = App.useApp()
    const [tasks, setTasks] = useState<CloneTaskListResult['tasks']>([])
    const [loading, setLoading] = useState(true)
    const [progressOpen, setProgressOpen] = useState(false)
    const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
    const [progress, setProgress] = useState<CloneTaskProgress | null>(null)

    const activeTaskIdRef = useRef<number | null>(null)

    const loadTasks = useCallback(async () => {
        try {
            const res = await getRecentCloneTasks()
            if (res.success) setTasks(res.tasks)
        } catch {
            message.error('加载任务列表失败')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadTasks() }, [loadTasks])

    // 轮询活跃任务进度
    const polling = usePolling(async () => {
        const taskId = activeTaskIdRef.current
        if (!taskId) { polling.stop(); return }
        try {
            const res = await getCloneTaskProgress(taskId)
            if (res.success) {
                setProgress(res)
                if (res.status === 'COMPLETED' || res.status === 'FAILED' || res.status === 'PARTIAL') {
                    polling.stop()
                    loadTasks()
                }
            }
        } catch { /* ignore */ }
    }, 2000)

    const handleViewProgress = useCallback((taskId: number) => {
        setActiveTaskId(taskId)
        activeTaskIdRef.current = taskId
        setProgressOpen(true)
        polling.start()
    }, [polling])

    const handleRetryFailed = useCallback(async () => {
        if (!activeTaskId) return
        try {
            const result = await retryCloneFailed(activeTaskId)
            if (result.success) {
                setProgress(null)
                activeTaskIdRef.current = activeTaskId
                polling.start()
            } else {
                message.info(result.message || '没有失败项')
            }
        } catch {
            message.error('重试失败')
        }
    }, [activeTaskId, polling])

    const handleRetryItem = useCallback(async (fullName: string) => {
        if (!activeTaskId) return
        try {
            const result = await retryCloneItem(activeTaskId, fullName)
            if (result.success) {
                message.success(result.message)
                // 重新获取进度
                const progressRes = await getCloneTaskProgress(activeTaskId)
                if (progressRes.success) setProgress(progressRes)
            } else {
                message.info(result.message)
            }
        } catch {
            message.error('重试失败')
        }
    }, [activeTaskId])

    const handleDeleteTask = useCallback(async () => {
        if (!activeTaskId) return
        try {
            const result = await deleteCloneTask(activeTaskId)
            if (result.success) {
                message.success(result.message || '任务已删除')
                polling.stop()
                setProgressOpen(false)
                setActiveTaskId(null)
                loadTasks()
            } else {
                message.error(result.message || '删除失败')
            }
        } catch {
            message.error('删除失败')
        }
    }, [activeTaskId, polling, loadTasks])

    const handleCloseProgress = () => {
        polling.stop()
        setProgressOpen(false)
        loadTasks()
    }

    const getStatusTag = (status: string) => {
        const map: Record<string, { color: string; text: string }> = {
            PENDING: { color: 'default', text: '等待中' },
            PROCESSING: { color: 'processing', text: '执行中' },
            COMPLETED: { color: 'success', text: '已完成' },
            FAILED: { color: 'error', text: '失败' },
            PARTIAL: { color: 'warning', text: '部分完成' },
        }
        const info = map[status] || { color: 'default', text: status }
        return <Tag color={info.color}>{info.text}</Tag>
    }

    const columns = [
        {
            title: '任务 ID',
            dataIndex: 'taskId',
            key: 'taskId',
            width: 80,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: string) => getStatusTag(status),
        },
        {
            title: '目标目录',
            dataIndex: 'targetDir',
            key: 'targetDir',
            ellipsis: true,
            render: (dir: string) => (
                <Space>
                    <FolderOutlined />
                    <Text copyable={{ text: dir }}>{dir}</Text>
                </Space>
            ),
        },
        {
            title: '进度',
            key: 'progress',
            width: 200,
            render: (_: unknown, record: CloneTaskListResult['tasks'][0]) => {
                const total = record.totalItems
                const processed = record.completedItems + record.failedItems
                const percent = total > 0 ? Math.round((processed * 100) / total) : 0
                let status: string
                if (record.status === 'COMPLETED') status = 'success'
                else if (record.status === 'FAILED') status = 'exception'
                else status = 'active'
                return (
                    <div>
                        <Progress percent={percent} size="small" status={status as any} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.completedItems}/{total}
                            {record.failedItems > 0 && <Text type="danger"> 失败{record.failedItems}</Text>}
                        </Text>
                    </div>
                )
            },
        },
        {
            title: '并发数',
            dataIndex: 'concurrency',
            key: 'concurrency',
            width: 80,
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 160,
            render: (time: string) => time ? dayjs(time).format('MM-DD HH:mm:ss') : '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 260,
            render: (_: unknown, record: CloneTaskListResult['tasks'][0]) => (
                <Space size="middle" wrap>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => handleViewProgress(record.taskId)}>
                        详情
                    </Button>
                    {(record.status === 'FAILED' || record.status === 'PARTIAL') && (
                        <Popconfirm
                            title="确定要重试失败项吗？"
                            description="将重新执行所有失败的克隆项"
                            onConfirm={async () => {
                                try {
                                    const res = await retryCloneFailed(record.taskId)
                                    if (res.success) {
                                        message.success(res.message)
                                        loadTasks()
                                    } else {
                                        message.info(res.message)
                                    }
                                } catch {
                                    message.error('重试失败')
                                }
                            }}
                            okText="重试"
                            cancelText="取消"
                        >
                            <Button size="small" type="link" icon={<ReloadOutlined />}>
                                重试
                            </Button>
                        </Popconfirm>
                    )}
                    {(record.status === 'PROCESSING' || record.status === 'COMPLETED' || record.status === 'FAILED' || record.status === 'PARTIAL') && (
                        <Popconfirm
                            title="确定要重置此任务吗？"
                            description={record.status === 'PROCESSING' ? '任务正在运行中，重置后将强制停止并重新执行。' : '将删除失败项目录并重置为待执行状态，是否继续？'}
                            onConfirm={async () => {
                                try {
                                    const res = await resetCloneTask(record.taskId)
                                    if (res.success) {
                                        message.success(res.message)
                                        loadTasks()
                                    } else {
                                        message.info(res.message)
                                    }
                                } catch {
                                    message.error('重置失败')
                                }
                            }}
                            okText="重置"
                            cancelText="取消"
                        >
                            <Button size="small" type="link" icon={<UndoOutlined />}>
                                重置
                            </Button>
                        </Popconfirm>
                    )}
                    {record.status !== 'PROCESSING' && (
                        <Popconfirm
                            title="确定要删除此任务吗？"
                            description="删除后不可恢复"
                            onConfirm={async () => {
                                try {
                                    const res = await deleteCloneTask(record.taskId)
                                    if (res.success) {
                                        message.success(res.message)
                                        loadTasks()
                                    } else {
                                        message.info(res.message)
                                    }
                                } catch {
                                    message.error('删除失败')
                                }
                            }}
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                        >
                            <Button size="small" type="link" danger icon={<DeleteOutlined />}>
                                删除
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ]

    // 统计
    const totalTasks = tasks.length
    const runningTasks = tasks.filter((t) => t.status === 'PROCESSING' || t.status === 'PENDING').length
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>克隆任务管理</Title>
                <Button icon={<ReloadOutlined />} onClick={loadTasks} loading={loading}>刷新</Button>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={12} sm={8}>
                    <Card size="small">
                        <Statistic title="总任务数" value={totalTasks} prefix={<CopyOutlined />} />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card size="small">
                        <Statistic title="执行中" value={runningTasks} valueStyle={{ color: '#1677ff' }} />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card size="small">
                        <Statistic title="已完成" value={completedTasks} valueStyle={{ color: '#52c41a' }} />
                    </Card>
                </Col>
            </Row>

            <Table
                dataSource={tasks}
                columns={columns}
                rowKey="taskId"
                loading={loading}
                pagination={{ pageSize: 10 }}
            />

            <CloneProgressModal
                open={progressOpen}
                progress={progress}
                onClose={handleCloseProgress}
                onRetryFailed={handleRetryFailed}
                onRetryItem={handleRetryItem}
                onDelete={handleDeleteTask}
            />
        </div>
    )
}
