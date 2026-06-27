import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Typography, App, Spin, Space, InputNumber, Modal, Popconfirm } from 'antd'
import { ReloadOutlined, FileTextOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import * as logsApi from '../../api/logs'
import type { LogFile } from '../../types'

const { Title, Text } = Typography

/** 格式化文件大小为可读格式 */
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function Logs() {
    const { message } = App.useApp()
    const [files, setFiles] = useState<LogFile[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingFile, setViewingFile] = useState<string | null>(null)
    const [logContent, setLogContent] = useState('')
    const [contentLoading, setContentLoading] = useState(false)
    const [lines, setLines] = useState<number>(200)

    const loadFiles = useCallback(async () => {
        setLoading(true)
        try {
            const data = await logsApi.fetchLogFiles()
            setFiles(data)
        } catch {
            message.error('加载日志文件列表失败')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadFiles()
    }, [loadFiles])

    /** 查看日志内容 */
    const handleView = async (fileName: string) => {
        setViewingFile(fileName)
        setContentLoading(true)
        try {
            const content = await logsApi.fetchLogContent(fileName, lines)
            setLogContent(content)
        } catch {
            message.error('读取日志内容失败')
            setLogContent('')
        } finally {
            setContentLoading(false)
        }
    }

    /** 清空日志文件 */
    const handleClear = async (fileName: string) => {
        try {
            const ok = await logsApi.clearLogFile(fileName)
            if (ok) {
                message.success(`已清空 ${fileName}`)
                loadFiles()
                if (viewingFile === fileName) {
                    setViewingFile(null)
                    setLogContent('')
                }
            } else {
                message.error('清空失败')
            }
        } catch {
            message.error('清空日志文件失败')
        }
    }

    const columns = [
        {
            title: '文件名',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => (
                <Space>
                    <FileTextOutlined />
                    <Text>{name}</Text>
                </Space>
            ),
        },
        {
            title: '大小',
            dataIndex: 'size',
            key: 'size',
            width: 120,
            render: (size: number) => formatSize(size),
        },
        {
            title: '修改时间',
            dataIndex: 'mtime',
            key: 'mtime',
            width: 200,
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            render: (_: unknown, record: LogFile) => (
                <Space>
                    <Button
                        type='link'
                        icon={<EyeOutlined />}
                        onClick={() => handleView(record.name)}
                    >
                        查看
                    </Button>
                    <Popconfirm
                        title={`确定要清空 ${record.name} 吗？`}
                        description='此操作不可恢复'
                        onConfirm={() => handleClear(record.name)}
                        okText='确定'
                        cancelText='取消'
                    >
                        <Button type='link' danger icon={<DeleteOutlined />}>
                            清空
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ]

    return (
        <div>
            <Title level={3} style={{ marginBottom: 24 }}>
                <FileTextOutlined style={{ marginRight: 8 }} />
                系统日志
            </Title>

            <Card>
                <Space style={{ marginBottom: 16 }}>
                    <Button icon={<ReloadOutlined />} onClick={loadFiles}>
                        刷新列表
                    </Button>
                </Space>

                <Spin spinning={loading}>
                    <Table
                        dataSource={files}
                        columns={columns}
                        rowKey='name'
                        pagination={false}
                        locale={{ emptyText: '暂无日志文件' }}
                    />
                </Spin>
            </Card>

            {/* 日志内容查看弹窗 */}
            <Modal
                title={
                    <Space>
                        <FileTextOutlined />
                        <span>{viewingFile}</span>
                    </Space>
                }
                open={!!viewingFile}
                onCancel={() => {
                    setViewingFile(null)
                    setLogContent('')
                }}
                width={900}
                footer={null}
                destroyOnClose
            >
                <Space style={{ marginBottom: 12 }}>
                    <Text>显示行数：</Text>
                    <InputNumber
                        min={10}
                        max={2000}
                        value={lines}
                        onChange={(v) => v && setLines(v)}
                    />
                    <Button onClick={() => viewingFile && handleView(viewingFile)}>
                        刷新
                    </Button>
                </Space>
                <Spin spinning={contentLoading}>
                    <pre
                        style={{
                            background: '#1e1e1e',
                            color: '#d4d4d4',
                            padding: 16,
                            borderRadius: 8,
                            maxHeight: 500,
                            overflow: 'auto',
                            fontSize: 12,
                            lineHeight: 1.6,
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                        }}
                    >
                        {logContent || '（无内容）'}
                    </pre>
                </Spin>
            </Modal>
        </div>
    )
}
