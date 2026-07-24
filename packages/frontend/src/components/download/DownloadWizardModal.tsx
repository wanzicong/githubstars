import { useState, useEffect } from 'react'
import { Modal, Steps, Table, Radio, Button, Space, Tag, Typography, App, Tooltip, Checkbox } from 'antd'
import {
    FolderOutlined,
    ThunderboltOutlined,
    CloudOutlined,
    CheckCircleOutlined,
    QuestionCircleOutlined,
} from '@ant-design/icons'
import { createDownloadTask, estimateDownloadSizes, type DownloadMirrorSource, type SizeEstimateItem } from '@/api/download'
import { DOWNLOAD_CONCURRENCY_OPTIONS, DEFAULT_DOWNLOAD_CONCURRENCY } from '@/constants'
import DirectoryPicker from '@/components/common/DirectoryPicker'
import type { GithubRepo } from '@/types'

/** 下载并发数可选值 */
type DownloadConcurrency = 3 | 5 | 10 | 20 | 50

const { Text } = Typography

/** 格式化字节数为可读大小 */
function formatBytes(bytes: number): string {
    if (bytes <= 0) return '未知'
    const units = ['B', 'KB', 'MB', 'GB']
    let unitIndex = 0
    let size = bytes
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
    }
    return `${unitIndex === 0 ? size : size.toFixed(1)} ${units[unitIndex]}`
}

/** 镜像源选项 */
const MIRROR_OPTIONS = [
    { value: 'ghproxy' as DownloadMirrorSource, label: 'ghproxy.net', description: '国内最稳定的 GitHub 代理，推荐' },
    { value: 'gh-proxy' as DownloadMirrorSource, label: 'gh-proxy.com', description: '国内快速代理，支持大文件' },
    { value: 'gh-proxy-org' as DownloadMirrorSource, label: 'gh-proxy.org(CF v4)', description: '主站加速，全球高速分发' },
    { value: 'gh-proxy-v4' as DownloadMirrorSource, label: 'v4.gh-proxy.org', description: '优选加速，仅支持 IPv4' },
    { value: 'gh-proxy-v6' as DownloadMirrorSource, label: 'v6.gh-proxy.org', description: '优选加速，支持 IPv4/IPv6' },
    { value: 'gh-proxy-cdn' as DownloadMirrorSource, label: 'cdn.gh-proxy.org', description: 'Fastly CDN 节点加速' },
    { value: 'gitclone' as DownloadMirrorSource, label: 'gitclone.com', description: '知名镜像服务，长期维护' },
    { value: 'direct' as DownloadMirrorSource, label: '直连（不加速）', description: '直接连接 GitHub，需要网络通畅' },
]

interface DownloadWizardModalProps {
    open: boolean
    onClose: () => void
    selectedRepos: GithubRepo[]
    onTaskCreated: (taskId: number) => void
}

/**
 * 下载向导 Modal
 *
 * 三步向导：确认仓库 → 设置参数 → 确认创建
 * 比克隆模块多出：解压选项、下载后清理选项
 */
export default function DownloadWizardModal({ open, onClose, selectedRepos, onTaskCreated }: DownloadWizardModalProps) {
    const { message } = App.useApp()
    const [currentStep, setCurrentStep] = useState(0)
    const [targetDir, setTargetDir] = useState('')
    const [concurrency, setConcurrency] = useState<DownloadConcurrency>(DEFAULT_DOWNLOAD_CONCURRENCY as DownloadConcurrency)
    const [mirrorSources, setMirrorSources] = useState<DownloadMirrorSource[]>(['direct'])
    const [selectedIds, setSelectedIds] = useState<number[]>(selectedRepos.map((r) => r.id))
    const [loading, setLoading] = useState(false)
    const [sizeEstimates, setSizeEstimates] = useState<Map<number, SizeEstimateItem>>(new Map())
    const [sizeEstimating, setSizeEstimating] = useState(false)

    // 打开模态框时自动拉取下载大小预估
    useEffect(() => {
        if (!open || selectedRepos.length === 0) return
        const loadEstimates = async () => {
            try {
                const result = await estimateDownloadSizes(selectedRepos.map((r) => r.id))
                if (result.success && result.items.length > 0) {
                    setSizeEstimates(new Map(result.items.map((item) => [item.repoId, item])))
                }
            } catch { /* 预估失败不影响主流程 */ } finally {
                setSizeEstimating(false)
            }
        }
        Promise.resolve().then(() => {
            setSizeEstimating(true)
            setSizeEstimates(new Map())
            void loadEstimates()
        })
    }, [open, selectedRepos])

    const handleNext = () => {
        if (currentStep === 0 && selectedIds.length === 0) {
            message.warning('请至少选择一个仓库')
            return
        }
        if (currentStep === 1 && !targetDir.trim()) {
            message.warning('请输入目标目录')
            return
        }
        setCurrentStep((s) => s + 1)
    }

    const handlePrev = () => setCurrentStep((s) => s - 1)

    const handleCreate = async () => {
        setLoading(true)
        try {
            const result = await createDownloadTask({
                repoIds: selectedIds,
                targetDir: targetDir.trim(),
                concurrency,
                mirrorSources,
            })
            if (result.success && result.taskId) {
                message.success(result.message || '下载任务已创建')
                onTaskCreated(result.taskId)
                handleClose()
            } else {
                message.error(result.message || '创建任务失败')
            }
        } catch (e: unknown) {
            message.error(e instanceof Error ? e.message : '创建任务失败')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setCurrentStep(0)
        setTargetDir('')
        setConcurrency(DEFAULT_DOWNLOAD_CONCURRENCY as DownloadConcurrency)
        setMirrorSources(['direct'])
        setSelectedIds(selectedRepos.map((r) => r.id))
        onClose()
    }

    const stepItems = [
        { title: '确认仓库' },
        { title: '设置参数' },
        { title: '确认创建' },
    ]

    const columns = [
        {
            title: '仓库',
            dataIndex: 'fullName',
            key: 'fullName',
            render: (name: string) => <Text strong>{name}</Text>,
        },
        {
            title: '语言',
            dataIndex: 'language',
            key: 'language',
            width: 100,
            render: (lang: string | null) => (lang ? <Tag>{lang}</Tag> : '-'),
        },
        {
            title: 'Stars',
            dataIndex: 'starsCount',
            key: 'starsCount',
            width: 80,
            sorter: (a: GithubRepo, b: GithubRepo) => a.starsCount - b.starsCount,
        },
        {
            title: '大小',
            key: 'size',
            width: 100,
            sorter: (a: GithubRepo, b: GithubRepo) => {
                const sizeA = sizeEstimates.get(a.id)?.sizeInBytes ?? 0
                const sizeB = sizeEstimates.get(b.id)?.sizeInBytes ?? 0
                return sizeA - sizeB
            },
            render: (_: unknown, record: GithubRepo) => {
                const estimate = sizeEstimates.get(record.id)
                if (sizeEstimating) return <Text type="secondary">估算中...</Text>
                if (!estimate || estimate.sizeInBytes <= 0) return <Text type="secondary">未知</Text>
                return <Text>{formatBytes(estimate.sizeInBytes)}</Text>
            },
        },
    ]

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <Table
                        dataSource={selectedRepos}
                        columns={columns}
                        rowKey="id"
                        size="small"
                        pagination={false}
                        scroll={{ y: 300 }}
                        rowSelection={{
                            selectedRowKeys: selectedIds,
                            onChange: (keys) => setSelectedIds(keys as number[]),
                        }}
                        footer={() => {
                    const totalBytes = selectedIds.reduce((sum, id) => {
                        const est = sizeEstimates.get(id)
                        return sum + (est?.sizeInBytes ?? 0)
                    }, 0)
                    let sizeText = ''
                    if (sizeEstimating) {
                        sizeText = '估算中...'
                    } else if (totalBytes > 0) {
                        sizeText = formatBytes(totalBytes)
                    }
                    return (
                        <Text type="secondary">
                            已选 {selectedIds.length} 个仓库
                            {sizeText ? <>，预估总大小 {sizeText}</> : null}
                        </Text>
                    )
                }}
                    />
                )
            case 1:
                return (
                    <Space direction="vertical" size="large" style={{ width: '100%', maxHeight: 420, overflow: 'auto' }}>
                        {/* 目标目录 */}
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                <FolderOutlined /> 目标目录
                            </Text>
                            <DirectoryPicker
                                value={targetDir}
                                onChange={setTargetDir}
                                placeholder="请输入本地目录路径（如 D:\\repos\\downloads）"
                            />
                        </div>

                        {/* 并发数量 */}
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                <ThunderboltOutlined /> 并发数量
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                同时下载的仓库数，数字越大下载越快，但占用带宽越多
                            </Text>
                            <Radio.Group
                                value={concurrency}
                                onChange={(e) => setConcurrency(e.target.value)}
                                optionType="button"
                                buttonStyle="solid"
                            >
                                {DOWNLOAD_CONCURRENCY_OPTIONS.map((opt) => (
                                    <Radio.Button key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </Radio.Button>
                                ))}
                            </Radio.Group>
                        </div>

                        {/* 加速代理（多选，按顺序回退） */}
                        <div>
                            <Space>
                                <Text strong>
                                    <CloudOutlined /> 加速代理
                                </Text>
                                <Tooltip title="可选多个镜像源，下载时会按选择的顺序依次尝试。第一个失败自动切换到下一个，只要有一个成功就算下载成功。推荐至少选择 1-2 个。">
                                    <QuestionCircleOutlined style={{ color: '#999' }} />
                                </Tooltip>
                            </Space>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                选择多个镜像源（按优先级排序），失败自动回退到下一个
                            </Text>
                            <Checkbox.Group
                                value={mirrorSources}
                                onChange={(checkedValues) => setMirrorSources(checkedValues as DownloadMirrorSource[])}
                                style={{ marginTop: 8, width: '100%' }}
                            >
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    {MIRROR_OPTIONS.map((opt) => (
                                        <Checkbox key={opt.value} value={opt.value}>
                                            <Space>
                                                <Text>{opt.label}</Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {opt.description}
                                                </Text>
                                            </Space>
                                        </Checkbox>
                                    ))}
                                </Space>
                            </Checkbox.Group>
                            {mirrorSources.length > 0 && (
                                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                                    回退顺序：{mirrorSources.join(' → ')}
                                    {!mirrorSources.includes('direct') && <span style={{ color: '#faad14' }}>（直连作为最终兜底）</span>}
                                </div>
                            )}
                        </div>
                    </Space>
                )
            case 2:
                return (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ fontSize: 16 }}>确认创建下载任务</Text>
                            </div>
                        </div>
                        <Table
                            dataSource={[
                                { key: 'count', label: '仓库数量', value: `${selectedIds.length} 个` },
                                { key: 'dir', label: '目标目录', value: targetDir },
                                { key: 'concurrency', label: '并发数量', value: `${concurrency} 个` },
                                { key: 'mirror', label: '加速代理', value: mirrorSources.map(s => MIRROR_OPTIONS.find((o) => o.value === s)?.label || s).join(' → ') },
                                {
                                    key: 'totalSize',
                                    label: '预估总大小',
                                    value: (() => {
                                        if (sizeEstimating) return '估算中...'
                                        const totalBytes = selectedIds.reduce((sum, id) => {
                                            const est = sizeEstimates.get(id)
                                            return sum + (est?.sizeInBytes ?? 0)
                                        }, 0)
                                        if (totalBytes <= 0) return '未知'
                                        return formatBytes(totalBytes)
                                    })(),
                                },
                            ]}
                            columns={[
                                { title: '配置项', dataIndex: 'label', key: 'label', width: 140 },
                                { title: '值', dataIndex: 'value', key: 'value' },
                            ]}
                            pagination={false}
                            size="small"
                        />
                    </Space>
                )
            default:
                return null
        }
    }

    return (
        <Modal
            title="批量下载仓库压缩包"
            open={open}
            onCancel={handleClose}
            width={640}
            footer={
                <Space>
                    <Button onClick={handleClose}>取消</Button>
                    {currentStep > 0 && <Button onClick={handlePrev}>上一步</Button>}
                    {currentStep < 2 && (
                        <Button type="primary" onClick={handleNext}>
                            下一步
                        </Button>
                    )}
                    {currentStep === 2 && (
                        <Button type="primary" onClick={handleCreate} loading={loading}>
                            确认创建
                        </Button>
                    )}
                </Space>
            }
        >
            <Steps current={currentStep} items={stepItems} style={{ marginBottom: 24 }} />
            {renderStepContent()}
        </Modal>
    )
}
