/**
 * 翻译管理面板 — 统一的翻译入口
 * 替代原先的3个分散按钮，提供翻译覆盖统计、任务创建、进度监控、历史管理
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Modal,
    Button,
    Progress,
    Space,
    Statistic,
    Row,
    Col,
    Card,
    Tag,
    Table,
    Typography,
    Divider,
    Alert,
    Empty,
    Tooltip,
    message,
} from 'antd'
import {
    TranslationOutlined,
    ReloadOutlined,
    BarChartOutlined,
    ClockCircleOutlined,
    ReadOutlined,
    FileTextOutlined,
    FilterOutlined,
    SyncOutlined,
} from '@ant-design/icons'
import * as translateApi from '../api/translate'

const { Text } = Typography

interface Props {
    open: boolean
    onClose: () => void
    filters: {
        keyword?: string
        language?: string
        tagIds?: string
        categoryIds?: string
        sortBy?: string
        sortOrder?: string
        dateField?: string
        startDate?: string
        endDate?: string
        untranslatedOnly?: boolean | string
    }
    hasActiveFilters: boolean
    onRefreshList: () => void
}

interface TaskSummary {
    taskId: number
    status: string
    totalItems: number
    completedItems: number
    failedItems: number
    createdAt?: string
    finishedAt?: string
}

/** 规范化 filters 为 API 期望的 Record<string, string | undefined> 格式 */
function normalizeFilters(filters: Props['filters']): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {}
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === false) continue
        result[key] = typeof value === 'boolean' ? 'true' : String(value)
    }
    return result
}

export default function TranslatePanel({ open, onClose, filters, hasActiveFilters, onRefreshList }: Props) {
    // 翻译覆盖统计
    const [coverage, setCoverage] = useState<{
        descCompleted: number
        descPending: number
        readmeCompleted: number
        readmePending: number
        total: number
    } | null>(null)

    // 活跃任务
    const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
    const [taskProgress, setTaskProgress] = useState<{
        status: string
        totalItems: number
        completedItems: number
        failedItems: number
        pendingItems: number
        descTotal: number
        descCompleted: number
        descFailed: number
        readmeTotal: number
        readmeCompleted: number
        readmeFailed: number
        progress: number
    } | null>(null)

    // 历史任务
    const [recentTasks, setRecentTasks] = useState<TaskSummary[]>([])

    const [loading, setLoading] = useState<'description' | 'readme' | 'both' | null>(null)
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // 加载覆盖统计
    const loadCoverage = useCallback(async () => {
        try {
            const res = await translateApi.getTranslationStatus(normalizeFilters(filters))
            if (res.success) setCoverage(res as any)
        } catch {
            /* ignore */
        }
    }, [filters])

    // 加载历史任务
    const loadRecentTasks = useCallback(async () => {
        try {
            const res = await translateApi.getRecentTasks()
            if (res.success) setRecentTasks((res.tasks || []) as unknown as TaskSummary[])
        } catch {
            /* ignore */
        }
    }, [])

    // 轮询任务进度
    const startPolling = useCallback(
        (taskId: number) => {
            if (pollingRef.current) clearInterval(pollingRef.current)
            pollingRef.current = setInterval(async () => {
                try {
                    const res = await translateApi.getTaskProgress(taskId)
                    if (res.success) {
                        setTaskProgress(res as any)
                        if (res.status === 'COMPLETED' || res.status === 'FAILED' || res.status === 'PARTIAL') {
                            clearInterval(pollingRef.current!)
                            pollingRef.current = null
                            loadCoverage()
                            loadRecentTasks()
                            onRefreshList()
                        }
                    }
                } catch {
                    /* ignore */
                }
            }, 2000)
        },
        [loadCoverage, loadRecentTasks, onRefreshList],
    )

    useEffect(() => {
        if (open) {
            loadCoverage()
            loadRecentTasks()
        }
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current)
        }
    }, [open, loadCoverage, loadRecentTasks])

    // 启动翻译
    const handleStartTranslate = async (type: 'description' | 'readme' | 'both') => {
        setLoading(type)
        try {
            const res = await translateApi.createTranslateTask({
                type,
                scope: hasActiveFilters ? 'filtered' : 'all',
                filters: hasActiveFilters ? normalizeFilters(filters) : undefined,
            })
            if (res.success && res.taskId) {
                setActiveTaskId(res.taskId)
                setTaskProgress({
                    status: 'PENDING',
                    totalItems: 0,
                    completedItems: 0,
                    failedItems: 0,
                    pendingItems: 0,
                    descTotal: 0,
                    descCompleted: 0,
                    descFailed: 0,
                    readmeTotal: 0,
                    readmeCompleted: 0,
                    readmeFailed: 0,
                    progress: 0,
                })
                startPolling(res.taskId)
                message.success('翻译任务已启动')
            } else {
                message.info(res.message || '没有需要翻译的项目')
            }
        } catch {
            message.error('启动翻译失败')
        } finally {
            setLoading(null)
        }
    }

    const handleRetryFailed = async () => {
        if (!activeTaskId) return
        try {
            const res = await translateApi.retryFailed(activeTaskId)
            if (res.success && res.taskId) {
                setActiveTaskId(res.taskId)
                setTaskProgress({
                    status: 'PENDING',
                    totalItems: 0,
                    completedItems: 0,
                    failedItems: 0,
                    pendingItems: 0,
                    descTotal: 0,
                    descCompleted: 0,
                    descFailed: 0,
                    readmeTotal: 0,
                    readmeCompleted: 0,
                    readmeFailed: 0,
                    progress: 0,
                })
                startPolling(res.taskId)
                message.success('重试任务已启动')
            } else {
                message.info(res.message || '没有失败项')
            }
        } catch {
            message.error('重试失败')
        }
    }

    const descPercent = coverage ? (coverage.total > 0 ? Math.round((coverage.descCompleted * 100) / coverage.total) : 100) : 0
    const readmePercent = coverage ? (coverage.total > 0 ? Math.round((coverage.readmeCompleted * 100) / coverage.total) : 100) : 0
    const isRunning = !!taskProgress && (taskProgress.status === 'PENDING' || taskProgress.status === 'PROCESSING')

    return (
        <Modal
            title={
                <Space>
                    <TranslationOutlined /> 翻译管理
                </Space>
            }
            open={open}
            onCancel={onClose}
            width={760}
            footer={<Button onClick={onClose}>关闭</Button>}
            styles={{ body: { maxHeight: '70vh', overflow: 'auto', padding: '20px 24px' } }}
            maskClosable={!isRunning}
        >
            {/* ===== 翻译覆盖统计 ===== */}
            <Card size='small' style={{ marginBottom: 16 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text strong>
                        <BarChartOutlined /> 翻译覆盖
                    </Text>
                    <Text type='secondary'>
                        {hasActiveFilters ? `当前筛选: ${coverage?.total || 0} 个项目` : `全部 ${coverage?.total || 0} 个项目`}
                    </Text>
                </Space>
                <Divider style={{ margin: '12px 0' }} />
                <Row gutter={24}>
                    <Col span={12}>
                        <Space direction='vertical' style={{ width: '100%' }}>
                            <Space>
                                <FileTextOutlined /> <Text>描述翻译</Text>
                            </Space>
                            <Progress
                                percent={descPercent}
                                size='small'
                                success={{ percent: descPercent }}
                                format={() => `${coverage?.descCompleted || 0}/${coverage?.total || 0}`}
                            />
                        </Space>
                    </Col>
                    <Col span={12}>
                        <Space direction='vertical' style={{ width: '100%' }}>
                            <Space>
                                <ReadOutlined /> <Text>README 翻译</Text>
                            </Space>
                            <Progress
                                percent={readmePercent}
                                size='small'
                                success={{ percent: readmePercent }}
                                format={() => `${coverage?.readmeCompleted || 0}/${coverage?.total || 0}`}
                            />
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* ===== 操作区域 ===== */}
            <Card size='small' style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                    <TranslationOutlined /> 发起翻译
                    {hasActiveFilters && (
                        <Tag color='blue' style={{ marginLeft: 8 }}>
                            <FilterOutlined /> 仅筛选范围
                        </Tag>
                    )}
                </Text>
                <Space wrap>
                    <Tooltip title={`翻译${hasActiveFilters ? '当前筛选下' : '全部'}仓库的**描述**(列表中的简短介绍文字)，通常几秒内完成`}>
                        <Button
                            icon={<FileTextOutlined />}
                            loading={loading === 'description'}
                            onClick={() => handleStartTranslate('description')}
                        >
                            翻译描述 {hasActiveFilters ? '' : '(全部)'}
                        </Button>
                    </Tooltip>
                    <Tooltip
                        title={`翻译${hasActiveFilters ? '当前筛选下' : '全部'}仓库的**README文档**，耗时较长（需要先从GitHub获取原始文档）`}
                    >
                        <Button
                            icon={<ReadOutlined />}
                            loading={loading === 'readme'}
                            onClick={() => handleStartTranslate('readme')}
                            type={descPercent > 80 ? 'primary' : 'default'}
                        >
                            翻译 README {hasActiveFilters ? '' : '(全部)'}
                        </Button>
                    </Tooltip>
                    <Tooltip title='翻译描述 + README（全量翻译）'>
                        <Button icon={<TranslationOutlined />} loading={loading === 'both'} onClick={() => handleStartTranslate('both')}>
                            翻译全部 (描述+README)
                        </Button>
                    </Tooltip>
                </Space>
                {!hasActiveFilters && (
                    <Alert
                        type='warning'
                        showIcon
                        style={{ marginTop: 12 }}
                        message='当前无筛选条件，将对全部仓库执行翻译，耗时可能较长。建议先筛选目标语言/分类后再翻译。'
                    />
                )}
            </Card>

            {/* ===== 活跃任务进度 ===== */}
            {taskProgress && (
                <Card size='small' style={{ marginBottom: 16, borderColor: isRunning ? '#1677ff' : undefined }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text strong>
                            <SyncOutlined spin={isRunning} /> 任务 #{String(activeTaskId).slice(-6)}
                            {isRunning ? (
                                <Tag color='processing' style={{ marginLeft: 8 }}>
                                    进行中
                                </Tag>
                            ) : taskProgress.status === 'COMPLETED' ? (
                                <Tag color='success'>完成</Tag>
                            ) : taskProgress.status === 'PARTIAL' ? (
                                <Tag color='warning'>部分失败</Tag>
                            ) : (
                                <Tag color='error'>失败</Tag>
                            )}
                        </Text>
                    </Space>
                    <Progress
                        percent={taskProgress.progress}
                        status={taskProgress.status === 'COMPLETED' ? 'success' : taskProgress.status === 'FAILED' ? 'exception' : 'active'}
                        style={{ margin: '12px 0' }}
                    />
                    <Row gutter={16}>
                        <Col span={8}>
                            <Statistic title='总计' value={taskProgress.totalItems} />
                        </Col>
                        <Col span={8}>
                            <Statistic title='已完成' value={taskProgress.completedItems} valueStyle={{ color: '#3f8600' }} />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title='失败'
                                value={taskProgress.failedItems}
                                valueStyle={{ color: taskProgress.failedItems > 0 ? '#cf1322' : undefined }}
                            />
                        </Col>
                    </Row>
                    {taskProgress.failedItems > 0 && !isRunning && (
                        <Button type='link' danger icon={<ReloadOutlined />} onClick={handleRetryFailed} style={{ marginTop: 8 }}>
                            重试 {taskProgress.failedItems} 个失败项
                        </Button>
                    )}
                </Card>
            )}

            {/* ===== 最近任务 ===== */}
            {recentTasks.length > 0 && (
                <Card
                    size='small'
                    title={
                        <Space>
                            <ClockCircleOutlined /> 最近任务
                        </Space>
                    }
                >
                    <Table
                        dataSource={recentTasks}
                        rowKey='taskId'
                        size='small'
                        pagination={false}
                        columns={[
                            { title: '任务', dataIndex: 'taskId', render: (v: number) => `#${String(v).slice(-6)}`, width: 80 },
                            {
                                title: '状态',
                                dataIndex: 'status',
                                width: 80,
                                render: (s: string) => {
                                    if (s === 'COMPLETED') return <Tag color='success'>完成</Tag>
                                    if (s === 'PARTIAL') return <Tag color='warning'>部分失败</Tag>
                                    if (s === 'FAILED') return <Tag color='error'>失败</Tag>
                                    return <Tag color='processing'>{s}</Tag>
                                },
                            },
                            { title: '总数', dataIndex: 'totalItems', width: 60 },
                            { title: '完成', dataIndex: 'completedItems', width: 60 },
                            {
                                title: '失败',
                                dataIndex: 'failedItems',
                                width: 60,
                                render: (v: number) => (v > 0 ? <Text type='danger'>{v}</Text> : <Text type='secondary'>0</Text>),
                            },
                            {
                                title: '时间',
                                dataIndex: 'createdAt',
                                render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
                            },
                        ]}
                    />
                </Card>
            )}

            {!taskProgress && recentTasks.length === 0 && (
                <Empty description='暂无翻译记录' image={Empty.PRESENTED_IMAGE_SIMPLE}>
                    <Text type='secondary'>点击上方按钮开始翻译</Text>
                </Empty>
            )}
        </Modal>
    )
}
