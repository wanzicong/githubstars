import { Modal, Progress, Tag, Space, Button, Typography, Collapse, Spin, Table, Tooltip, Popconfirm } from 'antd'
import { ReloadOutlined, CloseCircleOutlined, UndoOutlined, DeleteOutlined, DownloadOutlined, FolderOutlined, FileZipOutlined } from '@ant-design/icons'
import { type DownloadTaskProgress, type DownloadTaskItem } from '@/api/download'

const { Text } = Typography

/** 格式化字节数为人类可读的字符串 */
function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1))
    const val = bytes / Math.pow(1024, i)
    return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`
}

interface DownloadProgressModalProps {
    open: boolean
    progress: DownloadTaskProgress | null
    onClose: () => void
    onRetryFailed?: () => void
    onRetryItem?: (fullName: string) => void
    onDelete?: () => void
    onExtract?: (fullName: string) => void
    onDeleteItem?: (fullName: string) => void
}

/**
 * 下载进度弹窗
 *
 * 展示下载任务的实时进度：圆环百分比 + 统计标签 + 任务详情列表
 * 比克隆进度多显示：代理源、解压状态、文件路径信息
 */
export default function DownloadProgressModal({ open, progress, onClose, onRetryFailed, onRetryItem, onDelete, onExtract, onDeleteItem }: DownloadProgressModalProps) {
    const { status, totalItems = 0, completedItems = 0, failedItems = 0, progress: percent = 0, mirrorSources } = progress || {}
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
        return sources.map(s => getMirrorName(s)).join(' → ')
    }

    return (
        <Modal
            title="下载进度"
            open={open}
            onCancel={onClose}
            width={560}
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

                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <Tag color={statusColor}>{statusText}</Tag>
                </div>

                {/* 配置信息 */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        代理: {getMirrorListLabel(mirrorSources || ['direct'])}
                    </Text>
                </div>

                <Space size="large" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
                    <Space>
                        <DownloadOutlined style={{ color: '#1677ff' }} />
                        <Text>下载: {completedItems}</Text>
                    </Space>
                    <Space>
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        <Text>失败: {failedItems}</Text>
                    </Space>
                    <Text type="secondary">共 {totalItems}</Text>
                </Space>

                {/* 失败详情 */}
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

                {/* 所有任务项详情 */}
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
                                                    PROCESSING: { color: 'processing', text: '下载中' },
                                                }
                                                const info = map[status] || { color: 'default', text: status }
                                                return <Tag color={info.color}>{info.text}</Tag>
                                            },
                                        },
                                        {
                                            title: '大小',
                                            key: 'size',
                                            width: 150,
                                            render: (_: unknown, record: DownloadTaskItem) => {
                                                const total = Number(record.fileSize || 0)
                                                const downloaded = record.downloadedBytes ?? (record.status === 'COMPLETED' ? total : 0)
                                                // 未开始下载 → 等待中
                                                if (total <= 0 && downloaded <= 0) return <Text type="secondary">等待中</Text>
                                                // 总大小已知且下载中 → 进度条
                                                if (total > 0 && record.status === 'PROCESSING') {
                                                    const percent = Math.round((downloaded * 100) / total)
                                                    return (
                                                        <Tooltip title={`${formatBytes(downloaded)} / ${formatBytes(total)}`}>
                                                            <Progress percent={percent} size="small" style={{ margin: 0 }} />
                                                        </Tooltip>
                                                    )
                                                }
                                                // 总大小已知但未完成 → 显示 "已下载 / 总大小"
                                                if (total > 0 && downloaded > 0 && downloaded < total) {
                                                    return <Text type="secondary">{formatBytes(downloaded)} / {formatBytes(total)}</Text>
                                                }
                                                // 总大小未知 → 只显示已下载，标注清楚
                                                if (total <= 0 && downloaded > 0) {
                                                    return <Text type="secondary">已下载 {formatBytes(downloaded)}</Text>
                                                }
                                                // 已完成或只有总大小 → 显示总大小
                                                return <Text type="secondary">{formatBytes(total || downloaded)}</Text>
                                            },
                                        },
                                        {
                                            title: '路径',
                                            dataIndex: 'localFilePath',
                                            key: 'localFilePath',
                                            width: 120,
                                            ellipsis: true,
                                            render: (path: string) =>
                                                path ? (
                                                    <Tooltip title={path}>
                                                        <FolderOutlined style={{ color: '#999' }} />
                                                    </Tooltip>
                                                ) : '-',
                                        },
                                        {
                                            title: '操作',
                                            key: 'action',
                                            width: 160,
                                            render: (_: unknown, record: DownloadTaskItem) => {
                                                if (record.status === 'COMPLETED') {
                                                    return (
                                                        <Space size={0}>
                                                            <Popconfirm
                                                                title="确定解压此压缩包？"
                                                                description="将解压到目标目录下的对应仓库文件夹"
                                                                onConfirm={() => onExtract?.(record.fullName)}
                                                                okText="解压"
                                                                cancelText="取消"
                                                            >
                                                                <Button type="link" size="small" icon={<FileZipOutlined />}>
                                                                    解压
                                                                </Button>
                                                            </Popconfirm>
                                                            <Popconfirm
                                                                title="确定删除此压缩包？"
                                                                description="将删除已下载的 .zip 文件，不影响已解压的内容。"
                                                                onConfirm={() => onDeleteItem?.(record.fullName)}
                                                                okText="删除"
                                                                cancelText="取消"
                                                                okButtonProps={{ danger: true }}
                                                            >
                                                                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                                                    删包
                                                                </Button>
                                                            </Popconfirm>
                                                        </Space>
                                                    )
                                                }
                                                if (record.status !== 'PROCESSING') {
                                                    return (
                                                        <Popconfirm
                                                            title="确定重试此项？"
                                                            description="将删除原文件并重新下载，是否继续？"
                                                            onConfirm={() => onRetryItem?.(record.fullName)}
                                                            okText="重试"
                                                            cancelText="取消"
                                                        >
                                                            <Tooltip title="重试此项（会删除原文件）">
                                                                <Button type="link" size="small" icon={<UndoOutlined />}>
                                                                    重试
                                                                </Button>
                                                            </Tooltip>
                                                        </Popconfirm>
                                                    )
                                                }
                                                return null
                                            },
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
