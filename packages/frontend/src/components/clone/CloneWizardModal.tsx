import { useState } from 'react'
import { Modal, Steps, Table, Radio, Switch, Button, Space, Tag, Typography, App, Tooltip } from 'antd'
import { FolderOutlined, ThunderboltOutlined, CheckCircleOutlined, CloudOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { createCloneTask, type MirrorSource } from '@/api/clone'
import { CLONE_CONCURRENCY_OPTIONS, DEFAULT_CLONE_CONCURRENCY } from '@/constants'
import DirectoryPicker from '@/components/common/DirectoryPicker'
import type { GithubRepo } from '@/types'

/** 克隆并发数可选值 */
type CloneConcurrency = 5 | 10 | 20 | 50 | 80

const { Text } = Typography

/** 镜像源选项 */
const MIRROR_OPTIONS = [
    { value: 'ghproxy' as MirrorSource, label: 'ghproxy.net', description: '国内最稳定代理，推荐' },
    { value: 'gh-proxy' as MirrorSource, label: 'gh-proxy.com', description: '国内快速代理' },
    { value: 'gitclone' as MirrorSource, label: 'gitclone.com', description: '知名镜像服务' },
    { value: 'direct' as MirrorSource, label: '不加速', description: '直连 GitHub，需要网络通畅' },
]

interface CloneWizardModalProps {
    open: boolean
    onClose: () => void
    selectedRepos: GithubRepo[]
    onTaskCreated: (taskId: number) => void
}

/**
 * 克隆向导 Modal
 *
 * 三步向导：确认仓库 → 设置参数 → 确认创建
 */
export default function CloneWizardModal({ open, onClose, selectedRepos, onTaskCreated }: CloneWizardModalProps) {
    const { message } = App.useApp()
    const [currentStep, setCurrentStep] = useState(0)
    const [targetDir, setTargetDir] = useState('')
    const [concurrency, setConcurrency] = useState<CloneConcurrency>(DEFAULT_CLONE_CONCURRENCY as CloneConcurrency)
    const [shallow, setShallow] = useState(true)
    const [mirrorSource, setMirrorSource] = useState<MirrorSource>('gh-proxy')
    const [selectedIds, setSelectedIds] = useState<number[]>(selectedRepos.map((r) => r.id))
    const [loading, setLoading] = useState(false)

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
            const result = await createCloneTask({
                repoIds: selectedIds,
                targetDir: targetDir.trim(),
                concurrency,
                shallow,
                mirrorSource,
            })
            if (result.success && result.taskId) {
                message.success(result.message || '克隆任务已创建')
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
        setConcurrency(DEFAULT_CLONE_CONCURRENCY as CloneConcurrency)
        setShallow(true)
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
            render: (lang: string | null) => lang ? <Tag>{lang}</Tag> : '-',
        },
        {
            title: 'Stars',
            dataIndex: 'starsCount',
            key: 'starsCount',
            width: 80,
            sorter: (a: GithubRepo, b: GithubRepo) => a.starsCount - b.starsCount,
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
                        footer={() => <Text type="secondary">已选 {selectedIds.length} 个仓库</Text>}
                    />
                )
            case 1:
                return (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                <FolderOutlined /> 目标目录
                            </Text>

                            <DirectoryPicker
                                value={targetDir}
                                onChange={setTargetDir}
                                placeholder="请输入本地目录路径（如 D:\\repos\\stars）"
                            />
                        </div>
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                <ThunderboltOutlined /> 并发数量
                            </Text>
                            <Radio.Group
                                value={concurrency}
                                onChange={(e) => setConcurrency(e.target.value)}
                                optionType="button"
                                buttonStyle="solid"
                            >
                                {CLONE_CONCURRENCY_OPTIONS.map((opt) => (
                                    <Radio.Button key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </Radio.Button>
                                ))}
                            </Radio.Group>
                        </div>
                        <div>
                            <Space>
                                <Text strong>浅克隆</Text>
                                <Switch checked={shallow} onChange={setShallow} />
                            </Space>
                            <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                                {shallow ? '仅下载最新提交，速度快' : '下载完整历史，体积大'}
                            </Text>
                        </div>
                        <div>
                            <Space>
                                <Text strong>
                                    <CloudOutlined /> 加速代理
                                </Text>
                                <Tooltip title="国内访问 GitHub 较慢，使用镜像代理可加速克隆。私有仓库需配置 Token，不走代理。">
                                    <QuestionCircleOutlined style={{ color: '#999' }} />
                                </Tooltip>
                            </Space>
                            <Radio.Group
                                value={mirrorSource}
                                onChange={(e) => setMirrorSource(e.target.value)}
                                style={{ marginTop: 8 }}
                            >
                                <Space direction="vertical">
                                    {MIRROR_OPTIONS.map((opt) => (
                                        <Radio key={opt.value} value={opt.value}>
                                            <Space>
                                                <Text>{opt.label}</Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {opt.description}
                                                </Text>
                                            </Space>
                                        </Radio>
                                    ))}
                                </Space>
                            </Radio.Group>
                        </div>
                    </Space>
                )
            case 2:
                return (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ fontSize: 16 }}>确认创建克隆任务</Text>
                            </div>
                        </div>
                        <Table
                            dataSource={[
                                { key: 'count', label: '仓库数量', value: `${selectedIds.length} 个` },
                                { key: 'dir', label: '目标目录', value: targetDir },
                                { key: 'concurrency', label: '并发数量', value: `${concurrency} 个` },
                                { key: 'shallow', label: '浅克隆', value: shallow ? '是' : '否' },
                                { key: 'mirror', label: '加速代理', value: MIRROR_OPTIONS.find((o) => o.value === mirrorSource)?.label || '不加速' },
                            ]}
                            columns={[
                                { title: '配置项', dataIndex: 'label', key: 'label', width: 120 },
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
            title="批量克隆仓库"
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
