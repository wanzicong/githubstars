import { Modal, Progress, Tag, Space, Button, Typography, Collapse, Spin, Table, Tooltip, Popconfirm } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, UndoOutlined, DeleteOutlined } from '@ant-design/icons'
import type { CloneTaskProgress, CloneTaskItem } from '@/api/clone'

const { Text } = Typography

interface CloneProgressModalProps {
    open: boolean
    progress: CloneTaskProgress | null
    onClose: () => void
    onRetryFailed?: () => void
    onRetryItem?: (fullName: string) => void
    onDelete?: () => void
}

/**
 * 克隆进度弹窗
 *
 * 展示克隆任务的实时进度：圆环百分比 + 统计标签 + 任务详情列表
 */
export default function CloneProgressModal({ open, progress, onClose, onRetryFailed, onRetryItem, onDelete }: CloneProgressModalProps) {
    const { status, totalItems = 0, completedItems = 0, failedItems = 0, progress: percent = 0 } = progress || {}
    const isRunning = status === 'PROCESSING' || status === 'PENDING'
    const isCompleted = status === 'COMPLETED'
    const isFailed = status === 'FAILED'
    const isPartial = status === 'PARTIAL'
    const canReset = !isRunning && completedItems !== totalItems

    let statusColor: string
    if (isCompleted) statusColor = 'success'
    else if (isFailed) statusColor = 'error'
    else if (isPartial) statusColor = 'warning'
    else statusColor = 'processing'

    let statusText: string
    if (isCompleted) statusText = '已完成'
    else if (isFailed) statusText = '全部失败'
    else if (isPartial) statusText = '部分完成'
    else if (status === 'PENDING') statusText = '等待中'
    else statusText = '执行中'

    let progressStatus: 'success' | 'exception' | undefined
    if (isCompleted) progressStatus = 'success'
    else if (isFailed) progressStatus = 'exception'
    else progressStatus = undefined

    return (
        <Modal
            title="克隆进度"
            open={open}
            onCancel={onClose}
            width={520}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Popconfirm
                        title="确定删除此任务？"
                        description={isRunning ? '任务正在运行中，删除后将强制停止。' : '删除后无法恢复，是否继续？'}
                        onConfirm={onDelete}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger icon={<DeleteOutlined />}>
                            删除任务
                        </Button>
                    </Popconfirm>
                    <Space>
                        <Button onClick={onClose}>{isRunning ? '后台运行' : '关闭'}</Button>
                        {canReset && (
                            <Popconfirm
                                title="确定重置任务？"
                                description="将删除所有失败项的目录并重新执行，是否继续？"
                                onConfirm={onRetryFailed}
                                okText="重置"
                                cancelText="取消"
                            >
                                <Button type="primary" icon={<ReloadOutlined />}>
                                    重置任务
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                </div>
            }
            maskClosable={!isRunning}
        >
            <Spin spinning={!progress}>
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <Progress
                        type="circle"
                        percent={percent}
                        status={progressStatus}
                        size={120}
                    />
                </div>

                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Tag color={statusColor}>{statusText}</Tag>
                </div>

                <Space size="large" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
                    <Space>
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        <Text>成功: {completedItems}</Text>
                    </Space>
                    <Space>
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        <Text>失败: {failedItems}</Text>
                    </Space>
                    <Text type="secondary">共 {totalItems}</Text>
                </Space>

                {progress?.failedDetails && progress.failedDetails.length > 0 && (
                    <Collapse
                        size="small"
                        items={[{
                            key: 'failed',
                            label: `失败详情 (${progress.failedDetails.length})`,
                            children: (
                                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                                    {progress.failedDetails.map((item, i) => (
                                        <div key={i} style={{ marginBottom: 8 }}>
                                            <Text strong>{item.fullName}</Text>
                                            <br />
                                            <Text type="danger" style={{ fontSize: 12 }}>{item.error}</Text>
                                        </div>
                                    ))}
                                </div>
                            ),
                        }]}
                    />
                )}

                {progress?.allItems && progress.allItems.length > 0 && (
                    <Collapse
                        size="small"
                        style={{ marginTop: 8 }}
                        items={[{
                            key: 'all',
                            label: `任务详情 (${progress.allItems.length})`,
                            children: (
                                <Table
                                    size="small"
                                    dataSource={progress.allItems}
                                    rowKey="fullName"
                                    pagination={false}
                                    scroll={{ y: 300 }}
                                    columns={[
                                        {
                                            title: '仓库',
                                            dataIndex: 'fullName',
                                            key: 'fullName',
                                            ellipsis: true,
                                        },
                                        {
                                            title: '状态',
                                            dataIndex: 'status',
                                            key: 'status',
                                            width: 80,
                                            render: (status: string) => {
                                                const map: Record<string, { color: string; text: string }> = {
                                                    COMPLETED: { color: 'success', text: '成功' },
                                                    FAILED: { color: 'error', text: '失败' },
                                                    PENDING: { color: 'default', text: '等待' },
                                                    PROCESSING: { color: 'processing', text: '执行中' },
                                                }
                                                const info = map[status] || { color: 'default', text: status }
                                                return <Tag color={info.color}>{info.text}</Tag>
                                            },
                                        },
                                        {
                                            title: '操作',
                                            key: 'action',
                                            width: 80,
                                            render: (_: unknown, record: CloneTaskItem) => (
                                                record.status !== 'COMPLETED' && record.status !== 'PROCESSING' && (
                                                    <Popconfirm
                                                        title="确定重试此项？"
                                                        description="将删除原目录并重新克隆，是否继续？"
                                                        onConfirm={() => onRetryItem?.(record.fullName)}
                                                        okText="重试"
                                                        cancelText="取消"
                                                    >
                                                        <Tooltip title="重试此项（会删除原目录）">
                                                            <Button
                                                                type="link"
                                                                size="small"
                                                                icon={<UndoOutlined />}
                                                            >
                                                                重试
                                                            </Button>
                                                        </Tooltip>
                                                    </Popconfirm>
                                                )
                                            ),
                                        },
                                    ]}
                                />
                            ),
                        }]}
                    />
                )}
            </Spin>
        </Modal>
    )
}
