import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, Select, Button, Typography, Space, message, Popconfirm, Spin, Switch } from 'antd'
import { ReloadOutlined, DeleteOutlined, FileTextOutlined, SyncOutlined } from '@ant-design/icons'
import * as logsApi from '../api/logs'
import type { LogFile } from '../api/logs'

const { Title, Text } = Typography

export default function Logs() {
    const [files, setFiles] = useState<LogFile[]>([])
    const [selectedFile, setSelectedFile] = useState<string>('app.log')
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(false)
    const [autoRefresh, setAutoRefresh] = useState(false)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const loadFiles = useCallback(async () => {
        try {
            const list = await logsApi.fetchLogFiles()
            setFiles(list)
            if (list.length > 0 && !list.find((f) => f.name === selectedFile)) {
                setSelectedFile(list[0].name)
            }
        } catch {
            message.error('加载日志文件列表失败')
        }
    }, [selectedFile])

    const loadContent = useCallback(async () => {
        if (!selectedFile) return
        setLoading(true)
        try {
            const text = await logsApi.fetchLogContent(selectedFile, 500)
            setContent(text)
        } catch {
            setContent('加载失败')
        } finally {
            setLoading(false)
        }
    }, [selectedFile])

    useEffect(() => {
        loadFiles()
    }, [])

    useEffect(() => {
        loadContent()
    }, [selectedFile, loadContent])

    useEffect(() => {
        if (autoRefresh) {
            timerRef.current = setInterval(() => {
                loadContent()
                loadFiles()
            }, 3000)
        } else {
            if (timerRef.current) clearInterval(timerRef.current)
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [autoRefresh, loadContent, loadFiles])

    const handleClear = useCallback(async () => {
        try {
            await logsApi.clearLogFile(selectedFile)
            setContent('')
            message.success('日志已清空')
            loadFiles()
        } catch {
            message.error('清空失败')
        }
    }, [selectedFile, loadFiles])

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    }

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 24,
                    flexWrap: 'wrap',
                    gap: 8,
                }}
            >
                <Title level={3} style={{ margin: 0 }}>
                    系统日志
                </Title>
            </div>

            <Card style={{ marginBottom: 16 }}>
                <Space wrap>
                    <Select
                        style={{ minWidth: 200 }}
                        value={selectedFile}
                        onChange={(val) => setSelectedFile(val)}
                        options={files.map((f) => ({
                            label: `${f.name} (${formatSize(f.size)})`,
                            value: f.name,
                        }))}
                        placeholder='选择日志文件'
                    />
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => {
                            loadFiles()
                            loadContent()
                        }}
                        loading={loading}
                    >
                        刷新
                    </Button>
                    <Switch
                        checked={autoRefresh}
                        onChange={setAutoRefresh}
                        checkedChildren={<SyncOutlined spin />}
                        unCheckedChildren='自动刷新'
                    />
                    <Popconfirm
                        title='确定清空此日志文件？'
                        onConfirm={handleClear}
                        okText='确定'
                        cancelText='取消'
                    >
                        <Button icon={<DeleteOutlined />} danger>
                            清空
                        </Button>
                    </Popconfirm>
                </Space>
                {files.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <Space>
                            <Text type='secondary'>
                                <FileTextOutlined /> {files.length} 个日志文件
                            </Text>
                            {selectedFile && (
                                <Text type='secondary'>
                                    | 共{' '}
                                    {(content.match(/\n/g) || []).length + 1} 行
                                </Text>
                            )}
                        </Space>
                    </div>
                )}
            </Card>

            <Card
                styles={{ body: { padding: 0 } }}
                title={
                    <Space>
                        <Text code>{selectedFile || '未选择'}</Text>
                        <Text type='secondary'>最近 500 行</Text>
                    </Space>
                }
            >
                <Spin spinning={loading}>
                    {content ? (
                        <pre
                            style={{
                                margin: 0,
                                padding: '12px 16px',
                                fontSize: 12,
                                fontFamily:
                                    'Consolas, Monaco, "Courier New", monospace',
                                lineHeight: 1.8,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                maxHeight: '70vh',
                                overflow: 'auto',
                                background: '#1e1e1e',
                                color: '#d4d4d4',
                                borderRadius: '0 0 8px 8px',
                            }}
                        >
                            {content}
                        </pre>
                    ) : (
                        <div
                            style={{
                                padding: 40,
                                textAlign: 'center',
                                color: '#999',
                            }}
                        >
                            {loading ? '加载中...' : '暂无日志内容'}
                        </div>
                    )}
                </Spin>
            </Card>
        </div>
    )
}
