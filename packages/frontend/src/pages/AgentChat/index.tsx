/**
 * Agent 智能体对话页面
 *
 * 提供会话管理、流式对话、工具查看等能力。
 * 左侧会话列表 + 右侧对话区域的标准布局。
 */
import { useEffect, useCallback, useRef, useState } from 'react'
import { Layout, Button, Input, List, Typography, Space, Tag, Popconfirm, Spin, Tooltip, Empty } from 'antd'
import {
    PlusOutlined,
    DeleteOutlined,
    RobotOutlined,
    SendOutlined,
    StopOutlined,
    ToolOutlined,
    UserOutlined,
    DashboardOutlined,
} from '@ant-design/icons'
import { useAgentChat, type ChatMessage } from './hooks/useAgentChat'

const { Sider, Content } = Layout
const { TextArea } = Input
const { Text, Paragraph } = Typography

export default function AgentChat() {
    const {
        sessions,
        activeSessionId,
        messages,
        loading,
        tools,
        status,
        loadSessions,
        createSession,
        loadSession,
        sendMessage,
        stopGeneration,
        deleteSession,
        loadTools,
        loadStatus,
    } = useAgentChat()

    const [inputValue, setInputValue] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        loadSessions()
        loadTools()
        loadStatus()
    }, [loadSessions, loadTools, loadStatus])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = useCallback(() => {
        const text = inputValue.trim()
        if (!text || loading) return
        setInputValue('')
        if (!activeSessionId) {
            createSession().then((id) => {
                if (id) {
                    loadSession(id).then(() => sendMessage(text))
                }
            })
        } else {
            sendMessage(text)
        }
    }, [inputValue, loading, activeSessionId, createSession, loadSession, sendMessage])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
            }
        },
        [handleSend],
    )

    const handleNewSession = useCallback(async () => {
        const id = await createSession()
        if (id) loadSession(id)
    }, [createSession, loadSession])

    return (
        <Layout style={{ height: 'calc(100vh - 64px)', background: '#fff' }}>
            {/* 左侧会话列表 */}
            <Sider
                width={260}
                style={{ background: '#fafafa', borderRight: '1px solid #f0f0f0', overflow: 'auto' }}
            >
                <div style={{ padding: '12px' }}>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        block
                        onClick={handleNewSession}
                    >
                        新对话
                    </Button>
                </div>
                <List
                    dataSource={sessions}
                    renderItem={(session) => (
                        <List.Item
                            onClick={() => loadSession(session.id)}
                            style={{
                                cursor: 'pointer',
                                padding: '10px 16px',
                                background: activeSessionId === session.id ? '#e6f4ff' : 'transparent',
                                borderBottom: '1px solid #f0f0f0',
                            }}
                            actions={[
                                <Popconfirm
                                    key="delete"
                                    title="确定归档此会话？"
                                    onConfirm={(e) => {
                                        e?.stopPropagation()
                                        deleteSession(session.id)
                                    }}
                                    onCancel={(e) => e?.stopPropagation()}
                                >
                                    <DeleteOutlined
                                        style={{ color: '#999' }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </Popconfirm>,
                            ]}
                        >
                            <List.Item.Meta
                                avatar={<RobotOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
                                title={
                                    <Text
                                        ellipsis
                                        style={{ fontSize: 13, maxWidth: 160 }}
                                    >
                                        {session.title}
                                    </Text>
                                }
                                description={
                                    <Space size={4}>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            {session.messageCount} 条
                                        </Text>
                                        <Tag
                                            color={session.status === 'ACTIVE' ? 'green' : 'default'}
                                            style={{ fontSize: 10, lineHeight: '16px' }}
                                        >
                                            {session.status === 'ACTIVE' ? '活跃' : '已归档'}
                                        </Tag>
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                    locale={{ emptyText: <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                />
            </Sider>

            {/* 右侧对话区域 */}
            <Content style={{ display: 'flex', flexDirection: 'column', background: '#fff' }}>
                {/* 顶部工具栏 */}
                <div
                    style={{
                        padding: '8px 16px',
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <Space>
                        <RobotOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                        <Text strong>
                            {activeSessionId
                                ? sessions.find((s) => s.id === activeSessionId)?.title || '对话'
                                : '选择一个会话开始对话'}
                        </Text>
                    </Space>
                    <Space>
                        <Tooltip title={`已注册 ${tools.length} 个工具`}>
                            <Tag icon={<ToolOutlined />} color="blue">
                                {tools.length} 工具
                            </Tag>
                        </Tooltip>
                        {status && (
                            <Tooltip title={`${status.totalSessions} 会话 | ${status.totalTasks} 任务 | ${status.sseConnections} SSE`}>
                                <Tag icon={<DashboardOutlined />} color="green">
                                    运行中
                                </Tag>
                            </Tooltip>
                        )}
                    </Space>
                </div>

                {/* 消息列表 */}
                <div
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '16px 24px',
                    }}
                >
                    {!activeSessionId && messages.length === 0 ? (
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: '100%',
                            }}
                        >
                            <Empty description="选择左侧会话或创建新对话" />
                        </div>
                    ) : (
                        messages.map((msg: ChatMessage) => (
                            <div
                                key={msg.id}
                                style={{
                                    marginBottom: 16,
                                    display: 'flex',
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                }}
                            >
                                <div
                                    style={{
                                        maxWidth: '75%',
                                        padding: '10px 16px',
                                        borderRadius: 12,
                                        background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                                        color: msg.role === 'user' ? '#fff' : '#333',
                                    }}
                                >
                                    {msg.role === 'assistant' && (
                                        <div style={{ marginBottom: 4 }}>
                                            <RobotOutlined style={{ marginRight: 6, fontSize: 14 }} />
                                            <Text strong style={{ fontSize: 12, color: '#1677ff' }}>
                                                Agent
                                            </Text>
                                        </div>
                                    )}
                                    {msg.role === 'user' && (
                                        <div style={{ marginBottom: 4, textAlign: 'right' }}>
                                            <Text strong style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                                                我
                                            </Text>
                                            <UserOutlined style={{ marginLeft: 6, fontSize: 14 }} />
                                        </div>
                                    )}
                                    <Paragraph
                                        style={{
                                            margin: 0,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            color: 'inherit',
                                        }}
                                    >
                                        {msg.content || (loading && msg.role === 'assistant' ? '思考中...' : '')}
                                    </Paragraph>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* 底部输入区 */}
                <div
                    style={{
                        padding: '12px 24px',
                        borderTop: '1px solid #f0f0f0',
                    }}
                >
                    <Space.Compact style={{ width: '100%' }}>
                        <TextArea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={activeSessionId ? '输入消息，Enter 发送，Shift+Enter 换行' : '请先创建或选择一个会话'}
                            autoSize={{ minRows: 1, maxRows: 4 }}
                            disabled={!activeSessionId}
                            style={{ resize: 'none' }}
                        />
                        {loading ? (
                            <Button
                                type="primary"
                                danger
                                icon={<StopOutlined />}
                                onClick={stopGeneration}
                            >
                                停止
                            </Button>
                        ) : (
                            <Button
                                type="primary"
                                icon={<SendOutlined />}
                                onClick={handleSend}
                                disabled={!inputValue.trim() || !activeSessionId}
                            >
                                发送
                            </Button>
                        )}
                    </Space.Compact>
                </div>
            </Content>
        </Layout>
    )
}

