import { useState, useCallback } from 'react'
import { Modal, Steps, Table, Input, Radio, Switch, Button, Space, Tag, Typography, App } from 'antd'
import { FolderOpenOutlined, EditOutlined, SwapOutlined, FolderOutlined, ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { createCloneTask, selectDirectory } from '@/api/clone'
import { CLONE_CONCURRENCY_OPTIONS, DEFAULT_CLONE_CONCURRENCY } from '@/constants'
import type { GithubRepo } from '@/types'

const { Text } = Typography

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
    const [concurrency, setConcurrency] = useState<5 | 10 | 20>(DEFAULT_CLONE_CONCURRENCY as 5 | 10 | 20)
    const [shallow, setShallow] = useState(true)
    const [selectedIds, setSelectedIds] = useState<number[]>(selectedRepos.map((r) => r.id))
    const [loading, setLoading] = useState(false)
    const [selecting, setSelecting] = useState(false)

    const repos = selectedRepos.filter((r) => selectedIds.includes(r.id))

    /**
     * 打开系统目录选择对话框
     *
     * 调用后端 API 打开 Windows 原生文件夹选择器，获取完整路径并填充到输入框。
     */
    const handleSelectDirectory = useCallback(async () => {
        setSelecting(true)
        try {
            const result = await selectDirectory()
            if (result.success && result.path) {
                setTargetDir(result.path)
            } else if (result.message) {
                message.info(result.message)
            }
        } catch (e: any) {
            message.error(e.message || '选择目录失败')
        } finally {
            setSelecting(false)
        }
    }, [message])

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
            })
            if (result.success && result.taskId) {
                message.success(result.message || '克隆任务已创建')
                onTaskCreated(result.taskId)
                handleClose()
            } else {
                message.error(result.message || '创建任务失败')
            }
        } catch (e: any) {
            message.error(e.message || '创建任务失败')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setCurrentStep(0)
        setTargetDir('')
        setConcurrency(DEFAULT_CLONE_CONCURRENCY as 5 | 10 | 20)
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
                            
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Input
                                    placeholder="点击右侧按钮选择目录，或手动输入路径（例如：D:\repos\stars）"
                                    value={targetDir}
                                    onChange={(e) => setTargetDir(e.target.value)}
                                    size="large"
                                    suffix={
                                        <Button
                                            type="text"
                                            icon={<FolderOpenOutlined />}
                                            loading={selecting}
                                            onClick={handleSelectDirectory}
                                        />
                                    }
                                />
                                <Button
                                    icon={<FolderOpenOutlined />}
                                    loading={selecting}
                                    onClick={handleSelectDirectory}
                                    block
                                >
                                    打开文件夹选择器
                                </Button>
                            </Space>
                            
                            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                                仓库将克隆到 {'{'}目标目录{'}'}/{'{'}作者{'}'}/{'{'}仓库名{'}'} 子目录
                            </Text>
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
