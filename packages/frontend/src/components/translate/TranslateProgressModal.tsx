import { Modal, Progress, Spin, Space, Button, Alert } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import type { TaskProgress } from '../../constants'

export interface TranslateProgressModalProps {
    open: boolean
    progress: TaskProgress | null
    onClose: () => void
    onRetryFailed?: () => void
}

/**
 * 翻译进度弹窗（StarList / StarDetail 共用）
 *
 * 展示翻译任务的进度环、完成/失败统计及详细状态列表。
 */
export default function TranslateProgressModal({ open, progress, onClose, onRetryFailed }: TranslateProgressModalProps) {
    if (!progress) return null

    const {
        status,
        totalItems,
        completedItems,
        failedItems,
        progress: percent,
        descTotal,
        descCompleted,
        descFailed,
        readmeTotal,
        readmeCompleted,
        readmeFailed,
    } = progress

    const isRunning = status === 'PENDING' || status === 'PROCESSING'
    const isDone = status === 'COMPLETED' || status === 'FAILED' || status === 'PARTIAL'

    return (
        <Modal
            title='翻译进度'
            open={open}
            onCancel={isRunning ? undefined : onClose}
            footer={
                isDone ? (
                    <Space>
                        {failedItems > 0 && onRetryFailed && (
                            <Button icon={<ReloadOutlined />} onClick={onRetryFailed}>
                                重试失败 ({failedItems}项)
                            </Button>
                        )}
                        <Button type='primary' onClick={onClose}>
                            关闭
                        </Button>
                    </Space>
                ) : null
            }
            mask={{ closable: !isRunning }}
            closable={!isRunning}
        >
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Spin spinning={isRunning} size='large'>
                    <div style={{ padding: 8 }}>
                        {isDone && (
                            <div style={{ fontSize: 48, marginBottom: 8 }}>
                                {failedItems > 0 ? (
                                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                                ) : (
                                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                )}
                            </div>
                        )}
                        <Progress
                            type='circle'
                            percent={percent}
                            status={isRunning ? 'active' : failedItems > 0 ? 'exception' : 'success'}
                            size={120}
                        />
                        <div style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
                            {isRunning ? '翻译执行中...' : status === 'COMPLETED' ? '翻译完成' : '翻译完成（部分失败）'}
                        </div>
                        <div style={{ marginTop: 12, fontSize: 13, color: '#999' }}>
                            总 {totalItems} 项 | 成功 {completedItems} | 失败 {failedItems}
                        </div>
                    </div>
                </Spin>
            </div>
            <div style={{ padding: '8px 0' }}>
                <Alert
                    type='info'
                    showIcon
                    message={
                        <div style={{ fontSize: 13 }}>
                            <div>
                                描述翻译：{descCompleted}/{descTotal} 完成{failedItems > 0 ? `，${descFailed} 失败` : ''}
                            </div>
                            <div>
                                README 翻译：{readmeCompleted}/{readmeTotal} 完成{failedItems > 0 ? `，${readmeFailed} 失败` : ''}
                            </div>
                        </div>
                    }
                />
            </div>
        </Modal>
    )
}
