import { Modal, Progress, Tag, Space, Button, Typography, Collapse, Spin, Table, Tooltip } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, UndoOutlined } from '@ant-design/icons'
import type { CloneTaskProgress, CloneTaskItem } from '@/api/clone'

const { Text } = Typography

interface CloneProgressModalProps {
    open: boolean
    progress: CloneTaskProgress | null
    onClose: () => void
    onRetryFailed?: () => void
    onRetryItem?: (fullName: string) => void
}

/**
 * 克隆进度弹窗
 *
 * 展示克隆任务的实时进度：圆环百分比 + 统计标签 + 任务详情列表
 */
export default function CloneProgressModal({ open, progress, onClose, onRetryFailed, onRetryItem }: CloneProgressModalProps) {
    const { status, totalItems = 0, completedItems = 0, failedItems = 0, progress: percent = 0 } = progress || {}
    const isRunning = status === 'PROCESSING' || status === 'PENDING'
    const isCompleted = status === 'COMPLETED'
    const isFailed = status === 'FAILED'
    const isPartial = status === 'PARTIAL'
    const canReset = !isRunning && completedItems !== totalItems

    const statusColor = isCompleted ? 'success' : isFailed ? 'error' : isPartial ? 'warning' : 'processing'
    const statusText = isCompleted ? '已完成' : isFailed ? '全部失败' : isPartial ? '部分完成' : status === 'PENDING' ? '等待中' : '执行中'

    return (
        <Modal
            title="克隆进度"
            open={open}
            onCancel={onClose}
            width={520}
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <Button onClick={onClose}>{isRunning ? '后台运行' : '关闭'}</Button>
                    {canReset && (
                        <Button type="primary" icon={<ReloadOutlined />} onClick={onRetryFailed}>
                            重置任务
                        </Button>
                    )}
                </div>
            }
            maskClosable={!isRunning}
        >
            <Spin spinning={!progress}>
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <Progress
                        type="circle"
                        percent={percent}
                        status={isCompleted ? 'success' : isFailed ? 'exception' : undefined}
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
                                            render: (_: any, record: CloneTaskItem) => (
                                                record.status !== 'COMPLETED' && record.status !== 'PROCESSING' && (
                                                    <Tooltip title="重试此项（会删除原目录）">
                                                        <Button
                                                            type="link"
                                                            size="small"
                                                            icon={<UndoOutlined />}
                                                            onClick={() => onRetryItem?.(record.fullName)}
                                                        >
                                                            重试
                                                        </Button>
                                                    </Tooltip>
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
