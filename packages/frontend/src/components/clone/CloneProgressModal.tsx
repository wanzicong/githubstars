import { Modal, Progress, Tag, Space, Button, Typography, Collapse, Spin } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined } from '@ant-design/icons'
import type { CloneTaskProgress } from '@/api/clone'

const { Text } = Typography

interface CloneProgressModalProps {
    open: boolean
    progress: CloneTaskProgress | null
    onClose: () => void
    onRetryFailed?: () => void
}

/**
 * 克隆进度弹窗
 *
 * 展示克隆任务的实时进度：圆环百分比 + 统计标签 + 失败详情
 */
export default function CloneProgressModal({ open, progress, onClose, onRetryFailed }: CloneProgressModalProps) {
    if (!progress) return null

    const { status, totalItems, completedItems, failedItems, skippedItems, progress: percent } = progress
    const isRunning = status === 'PROCESSING' || status === 'PENDING'
    const isCompleted = status === 'COMPLETED'
    const isFailed = status === 'FAILED'
    const isPartial = status === 'PARTIAL'

    const statusColor = isCompleted ? 'success' : isFailed ? 'error' : isPartial ? 'warning' : 'processing'
    const statusText = isCompleted ? '已完成' : isFailed ? '全部失败' : isPartial ? '部分完成' : status === 'PENDING' ? '等待中' : '执行中'

    return (
        <Modal
            title="克隆进度"
            open={open}
            onCancel={onClose}
            width={520}
            footer={
                <Space>
                    <Button onClick={onClose}>{isRunning ? '后台运行' : '关闭'}</Button>
                    {(isFailed || isPartial) && failedItems > 0 && (
                        <Button type="primary" icon={<ReloadOutlined />} onClick={onRetryFailed}>
                            重试失败项 ({failedItems})
                        </Button>
                    )}
                </Space>
            }
            maskClosable={!isRunning}
        >
            <Spin spinning={isRunning && percent < 100}>
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
                    <Space>
                        <MinusCircleOutlined style={{ color: '#faad14' }} />
                        <Text>跳过: {skippedItems}</Text>
                    </Space>
                    <Text type="secondary">共 {totalItems}</Text>
                </Space>

                {progress.failedDetails && progress.failedDetails.length > 0 && (
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

                {progress.skippedDetails && progress.skippedDetails.length > 0 && (
                    <Collapse
                        size="small"
                        style={{ marginTop: 8 }}
                        items={[{
                            key: 'skipped',
                            label: `跳过详情 (${progress.skippedDetails.length})`,
                            children: (
                                <div style={{ maxHeight: 150, overflow: 'auto' }}>
                                    {progress.skippedDetails.map((item, i) => (
                                        <div key={i} style={{ marginBottom: 4 }}>
                                            <Text type="warning">{item.fullName}</Text>
                                            <Text type="secondary"> — 目录已存在</Text>
                                        </div>
                                    ))}
                                </div>
                            ),
                        }]}
                    />
                )}
            </Spin>
        </Modal>
    )
}
