import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, Table, Tag, Button, Space, Typography, Row, Col, Statistic, Progress, App, Popconfirm, Tooltip, Modal } from 'antd'
import {
    ReloadOutlined,
    CopyOutlined,
    FolderOutlined,
    UndoOutlined,
    DeleteOutlined,
    DownloadOutlined,
    CloudOutlined,
    CompressOutlined,
} from '@ant-design/icons'
import {
    getRecentDownloadTasks,
    getDownloadTaskProgress,
    retryDownloadFailed,
    retryDownloadItem,
    resetDownloadTask,
    deleteDownloadTask,
    extractDownloadItem,
    deleteDownloadItemFile,
    extractAllDownloadItems,
    getExtractAllProgress,
} from '@/api/download'
import type { DownloadTaskProgress, DownloadTaskListResult } from '@/api/download'
import DownloadProgressModal from '@/components/download/DownloadProgressModal'
import { usePolling } from '@/hooks/usePolling'
import dayjs from '@/config/setupDayjs'

const { Title, Text } = Typography

/**
 * 下载任务管理页面
 *
 * 展示所有下载任务列表、进度、操作（重试/查看详情）
 */
export default function Download() {
    const { message } = App.useApp()
    const [tasks, setTasks] = useState<DownloadTaskListResult['tasks']>([])
    const [loading, setLoading] = useState(true)

    /** 批量解压进度 key=taskId，支持多个任务同时解压 */
    interface ExtractProgressData {
        status: 'extracting' | 'completed'
        total: number
        current: number
        extracted: number
        skipped: number
        failed: number
        message: string
    }
    const [extractingTasks, setExtractingTasks] = useState<Record<number, ExtractProgressData>>({})
    const extractingTasksRef = useRef<Record<number, ExtractProgressData>>({})

    /** 批量解压结果详情弹窗 */
    const [extractResult, setExtractResult] = useState<{
        visible: boolean
        message: string
        extracted: number
        skipped: number
        failed: number
        details: Array<{ fullName: string; status: string; message?: string }>
    } | null>(null)

    const [progressOpen, setProgressOpen] = useState(false)
    const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
    const [progress, setProgress] = useState<DownloadTaskProgress | null>(null)

    const activeTaskIdRef = useRef<number | null>(null)

    const loadTasks = useCallback(async () => {
        try {
            const res = await getRecentDownloadTasks()
            if (res.success) setTasks(res.tasks)
        } catch {
            message.error('加载任务列表失败')
        } finally {
            setLoading(false)
        }
    }, [message])

    useEffect(() => {
        const init = async () => {
            try {
                const res = await getRecentDownloadTasks()
                if (res.success) setTasks(res.tasks)
            } catch {
                message.error('加载任务列表失败')
            } finally {
                setLoading(false)
            }
        }
        void init()
    }, [message])

    // 任务列表自动轮询
    const listPolling = usePolling(async () => {
        try {
            const res = await getRecentDownloadTasks()
            if (res.success) setTasks(res.tasks)
        } catch {
            // 轮询期间静默失败
        }
    }, 2000)

    // 跟踪是否有活跃任务，自动启停轮询
    useEffect(() => {
        const hasActive = tasks.some((t) => t.status === 'PROCESSING' || t.status === 'PENDING')
        if (hasActive) {
            listPolling.start()
        } else {
            listPolling.stop()
        }
    }, [tasks, listPolling])

    // 轮询活跃任务进度
    const polling = usePolling(async ({ stop }) => {
        const taskId = activeTaskIdRef.current
        if (!taskId) {
            stop()
            return
        }
        try {
            const res = await getDownloadTaskProgress(taskId)
            if (res.success) {
                setProgress(res)
                if (res.status === 'COMPLETED' || res.status === 'FAILED' || res.status === 'PARTIAL') {
                    stop()
                    loadTasks()
                }
            }
        } catch {
            /* ignore */
        }
    }, 2000)

    const handleViewProgress = useCallback(
        (taskId: number) => {
            setActiveTaskId(taskId)
            activeTaskIdRef.current = taskId
            setProgressOpen(true)
            polling.start()
        },
        [polling],
    )

    const handleRetryFailed = useCallback(async () => {
        if (!activeTaskId) return
        try {
            const result = await retryDownloadFailed(activeTaskId)
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
    }, [activeTaskId, polling, message])

    const handleRetryItem = useCallback(
        async (fullName: string) => {
            if (!activeTaskId) return
            try {
                const result = await retryDownloadItem(activeTaskId, fullName)
                if (result.success) {
                    message.success(result.message)
                    const progressRes = await getDownloadTaskProgress(activeTaskId)
                    if (progressRes.success) setProgress(progressRes)
                } else {
                    message.info(result.message)
                }
            } catch {
                message.error('重试失败')
            }
        },
        [activeTaskId, message],
    )

    const handleDeleteTask = useCallback(async () => {
        if (!activeTaskId) return
        try {
            const result = await deleteDownloadTask(activeTaskId)
            if (result.success) {
                message.success(result.message || '任务已删除')
                polling.stop()
                setProgressOpen(false)
                setActiveTaskId(null)
                void loadTasks()
            } else {
                message.error(result.message || '删除失败')
            }
        } catch {
            message.error('删除失败')
        }
    }, [activeTaskId, polling, loadTasks, message])

    const handleExtract = useCallback(
        async (fullName: string) => {
            if (!activeTaskId) return
            try {
                const result = await extractDownloadItem(activeTaskId, fullName)
                if (result.success) {
                    message.success(result.message)
                } else {
                    message.info(result.message || '解压失败')
                }
            } catch {
                message.error('解压失败')
            }
        },
        [activeTaskId, message],
    )

    const handleDeleteItem = useCallback(
        async (fullName: string) => {
            if (!activeTaskId) return
            try {
                const result = await deleteDownloadItemFile(activeTaskId, fullName)
                if (result.success) {
                    message.success(result.message)
                } else {
                    message.info(result.message || '删除失败')
                }
            } catch {
                message.error('删除失败')
            }
        },
        [activeTaskId, message],
    )

    // 解压进度轮询（支持同时跟踪多个任务的解压进度）
    const extractPolling = usePolling(async ({ stop }) => {
        const tasks = extractingTasksRef.current
        const taskIds = Object.keys(tasks)
        if (taskIds.length === 0) {
            stop()
            return
        }

        for (const taskIdStr of taskIds) {
            const taskId = Number(taskIdStr)
            try {
                const res = await getExtractAllProgress(taskId)
                if (!res.success || !res.status) continue

                if (res.status === 'completed') {
                    // 从进行中移除
                    delete extractingTasksRef.current[taskId]
                    void loadTasks()
                    if ((res.failed ?? 0) > 0 && res.details) {
                        setExtractResult({
                            visible: true,
                            message: res.message ?? '',
                            extracted: res.extracted ?? 0,
                            skipped: res.skipped ?? 0,
                            failed: res.failed ?? 0,
                            details: res.details,
                        })
                    } else {
                        message.success(`任务 ${taskId} 解压完成: ${res.message ?? ''}`)
                    }
                } else {
                    // 更新进度到 ref + state
                    extractingTasksRef.current[taskId] = {
                        status: res.status,
                        total: res.total ?? 0,
                        current: res.current ?? 0,
                        extracted: res.extracted ?? 0,
                        skipped: res.skipped ?? 0,
                        failed: res.failed ?? 0,
                        message: res.message ?? '',
                    }
                }
            } catch {
                // 单个任务轮询失败不影响其他任务
            }
        }

        // 同步 ref 到 state 触发 UI 更新
        setExtractingTasks({ ...extractingTasksRef.current })
    }, 2000)

    const handleExtractAll = useCallback(
        async (taskId: number) => {
            // 初始化进度
            extractingTasksRef.current[taskId] = {
                status: 'extracting',
                total: 0,
                current: 0,
                extracted: 0,
                skipped: 0,
                failed: 0,
                message: '启动中...',
            }
            setExtractingTasks({ ...extractingTasksRef.current })
            // 确保轮询在运行
            extractPolling.start()

            try {
                const res = await extractAllDownloadItems(taskId)
                if (!res.success) {
                    message.info(res.message)
                    delete extractingTasksRef.current[taskId]
                    setExtractingTasks({ ...extractingTasksRef.current })
                }
            } catch {
                message.error('一键解压失败：网络请求异常，请检查后端服务是否正常运行')
                delete extractingTasksRef.current[taskId]
                setExtractingTasks({ ...extractingTasksRef.current })
            }
        },
        [extractPolling, message],
    )

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

    /** 镜像源中文名 */
    const getMirrorName = (source: string): string => {
        const map: Record<string, string> = {
            ghproxy: 'ghproxy.net',
            'gh-proxy': 'gh-proxy.com',
            'gh-proxy-org': 'gh-proxy.org(CF v4)',
            'gh-proxy-v4': 'v4.gh-proxy.org',
            'gh-proxy-v6': 'v6.gh-proxy.org',
            'gh-proxy-cdn': 'cdn.gh-proxy.org',
            gitclone: 'gitclone.com',
            direct: '直连',
        }
        return map[source] || source
    }

    /** 镜像源列表中文标签 */
    const getMirrorListLabel = (sources: string[]): string => {
        if (!sources || sources.length === 0) return '直连'
        return sources.map((s) => getMirrorName(s)).join(' → ')
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
            width: 220,
            ellipsis: true,
            render: (dir: string) => (
                <Space>
                    <FolderOutlined />
                    <Text copyable={{ text: dir }}>{dir}</Text>
                </Space>
            ),
        },
        {
            title: '配置',
            key: 'config',
            width: 120,
            render: (_: unknown, record: DownloadTaskListResult['tasks'][0]) => {
                const mirrorLabel = getMirrorListLabel(record.mirrorSources)
                return (
                    <Space size={4}>
                        <Text type='secondary' style={{ fontSize: 12 }}>
                            {record.concurrency}并发
                        </Text>
                        <Tooltip title={mirrorLabel}>
                            <Tag
                                icon={<CloudOutlined />}
                                style={{ margin: 0, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                                {mirrorLabel}
                            </Tag>
                        </Tooltip>
                    </Space>
                )
            },
        },
        {
            title: '进度',
            key: 'progress',
            width: 200,
            render: (_: unknown, record: DownloadTaskListResult['tasks'][0]) => {
                const total = record.totalItems
                const processed = record.completedItems + record.failedItems
                const percent = total > 0 ? Math.round((processed * 100) / total) : 0
                let progressStatus: 'success' | 'exception' | 'active' | 'normal' = 'active'
                if (record.status === 'COMPLETED') progressStatus = 'success'
                else if (record.status === 'FAILED') progressStatus = 'exception'
                return (
                    <div>
                        <Progress percent={percent} size='small' status={progressStatus} />
                        <Text type='secondary' style={{ fontSize: 12 }}>
                            {record.completedItems}/{total}
                            {record.failedItems > 0 && <Text type='danger'> 失败{record.failedItems}</Text>}
                        </Text>
                    </div>
                )
            },
        },

        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 160,
            render: (time: string) => (time ? dayjs(time).format('MM-DD HH:mm:ss') : '-'),
        },
        {
            title: '操作',
            key: 'action',
            width: 260,
            render: (_: unknown, record: DownloadTaskListResult['tasks'][0]) => (
                <Space size='middle' wrap>
                    <Button size='small' icon={<CopyOutlined />} onClick={() => handleViewProgress(record.taskId)}>
                        详情
                    </Button>
                    {(record.status === 'COMPLETED' || record.status === 'PARTIAL') &&
                        (extractingTasks[record.taskId] ? (
                            <Tooltip title={extractingTasks[record.taskId].message}>
                                <Button size='small' loading icon={<CompressOutlined />}>
                                    {extractingTasks[record.taskId].current}/{extractingTasks[record.taskId].total}
                                </Button>
                            </Tooltip>
                        ) : (
                            <Popconfirm
                                title='确定要一键解压所有已完成项吗？'
                                description='将自动跳过已解压项和失败项'
                                onConfirm={() => handleExtractAll(record.taskId)}
                                okText='解压'
                                cancelText='取消'
                            >
                                <Button size='small' loading={!!extractingTasks[record.taskId]} icon={<CompressOutlined />}>
                                    一键解压
                                </Button>
                            </Popconfirm>
                        ))}
                    {(record.status === 'FAILED' || record.status === 'PARTIAL') && (
                        <Popconfirm
                            title='确定要重试失败项吗？'
                            description='将重新执行所有失败的下载项'
                            onConfirm={async () => {
                                try {
                                    const res = await retryDownloadFailed(record.taskId)
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
                            okText='重试'
                            cancelText='取消'
                        >
                            <Button size='small' type='link' icon={<ReloadOutlined />}>
                                重试
                            </Button>
                        </Popconfirm>
                    )}
                    {(record.status === 'PROCESSING' ||
                        record.status === 'COMPLETED' ||
                        record.status === 'FAILED' ||
                        record.status === 'PARTIAL') && (
                        <Popconfirm
                            title='确定要重置此任务吗？'
                            description={
                                record.status === 'PROCESSING'
                                    ? '任务正在运行中，重置后将强制停止并重新执行。'
                                    : '将删除失败项目录并重置为待执行状态，是否继续？'
                            }
                            onConfirm={async () => {
                                try {
                                    const res = await resetDownloadTask(record.taskId)
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
                            okText='重置'
                            cancelText='取消'
                        >
                            <Button size='small' type='link' icon={<UndoOutlined />}>
                                重置
                            </Button>
                        </Popconfirm>
                    )}
                    {record.status !== 'PROCESSING' && (
                        <Popconfirm
                            title='确定要删除此任务吗？'
                            description='删除后不可恢复'
                            onConfirm={async () => {
                                try {
                                    const res = await deleteDownloadTask(record.taskId)
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
                            okText='删除'
                            cancelText='取消'
                            okButtonProps={{ danger: true }}
                        >
                            <Button size='small' type='link' danger icon={<DeleteOutlined />}>
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
                <Title level={3} style={{ margin: 0 }}>
                    <DownloadOutlined style={{ marginRight: 8 }} />
                    下载任务管理
                </Title>
                <Button icon={<ReloadOutlined />} onClick={loadTasks} loading={loading}>
                    刷新
                </Button>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={12} sm={8}>
                    <Card size='small'>
                        <Statistic title='总任务数' value={totalTasks} prefix={<CopyOutlined />} />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card size='small'>
                        <Statistic title='执行中' value={runningTasks} valueStyle={{ color: '#1677ff' }} />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card size='small'>
                        <Statistic title='已完成' value={completedTasks} valueStyle={{ color: '#52c41a' }} />
                    </Card>
                </Col>
            </Row>

            <Table
                dataSource={tasks}
                columns={columns}
                rowKey='taskId'
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 1200 }}
            />

            <DownloadProgressModal
                open={progressOpen}
                progress={progress}
                onClose={handleCloseProgress}
                onRetryFailed={handleRetryFailed}
                onRetryItem={handleRetryItem}
                onDelete={handleDeleteTask}
                onExtract={handleExtract}
                onDeleteItem={handleDeleteItem}
            />

            {/* 批量解压结果详情弹窗 */}
            <Modal
                title='一键解压结果'
                open={extractResult?.visible ?? false}
                onCancel={() => setExtractResult(null)}
                footer={<Button onClick={() => setExtractResult(null)}>关闭</Button>}
                width={600}
            >
                {extractResult && (
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <Space size='large'>
                                <Statistic title='成功' value={extractResult.extracted} valueStyle={{ color: '#52c41a' }} />
                                <Statistic title='跳过' value={extractResult.skipped} />
                                <Statistic
                                    title='失败'
                                    value={extractResult.failed}
                                    valueStyle={{ color: extractResult.failed > 0 ? '#ff4d4f' : undefined }}
                                />
                            </Space>
                        </div>
                        {extractResult.failed > 0 && (
                            <Table
                                dataSource={extractResult.details.filter((d) => d.status === 'fail')}
                                columns={[
                                    { title: '仓库', dataIndex: 'fullName', key: 'fullName', width: 200 },
                                    { title: '原因', dataIndex: 'message', key: 'message' },
                                ]}
                                rowKey='fullName'
                                pagination={false}
                                size='small'
                            />
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}
