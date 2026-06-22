/**
 * Agent 智能体对话页面
 *
 * 提供会话管理、流式对话、工具查看等能力。
 * 左侧会话列表 + 右侧对话区域的代码风格布局。
 *
 * 设计理念：GitHub Stars 主题，深邃代码风格
 * - 星标金 (#f0c040) 作为主色
 * - 代码黑 (#0d1117) 作为背景
 * - 等宽字体营造代码编辑器氛围
 * - 星标动画作为签名元素
 */
import { useEffect, useCallback, useRef, useState } from 'react'
import { Layout, Button, Input, List, Typography, Space, Tag, Popconfirm, Tooltip, Empty } from 'antd'
import {
    PlusOutlined,
    DeleteOutlined,
    RobotOutlined,
    SendOutlined,
    StopOutlined,
    ToolOutlined,
    UserOutlined,
    DashboardOutlined,
    StarFilled,
    CodeOutlined,
} from '@ant-design/icons'
import { useAgentChat, type ChatMessage } from './hooks/useAgentChat'

const { Sider, Content } = Layout
const { TextArea } = Input
const { Text, Paragraph } = Typography

// GitHub Stars 主题色板
const theme = {
    bg: {
        primary: '#0d1117',
        surface: '#161b22',
        elevated: '#1c2128',
        hover: '#21262d',
    },
    text: {
        primary: '#c9d1d9',
        secondary: '#8b949e',
        muted: '#484f58',
    },
    accent: {
        gold: '#f0c040',
        green: '#3fb950',
        blue: '#58a6ff',
        red: '#f85149',
    },
    border: {
        default: '#30363d',
        muted: '#21262d',
    },
}

// 星标动画样式
const starAnimation = `
@keyframes starPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
}

@keyframes typing {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}

@keyframes slideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

.star-pulse {
    animation: starPulse 2s ease-in-out infinite;
}

.typing-cursor {
    animation: typing 1s step-end infinite;
}

.message-enter {
    animation: slideIn 0.2s ease-out;
}
`

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

    // 格式化消息内容（简单 Markdown 支持）
    const formatMessage = (content: string) => {
        if (!content) return null

        // 处理代码块
        const parts = content.split(/(```[\s\S]*?```)/g)
        return parts.map((part, i) => {
            if (part.startsWith('```') && part.endsWith('```')) {
                const code = part.slice(3, -3).replace(/^\w+\n/, '') // 移除语言标识
                return (
                    <pre
                        key={i}
                        style={{
                            background: theme.bg.primary,
                            border: `1px solid ${theme.border.default}`,
                            borderRadius: 6,
                            padding: '12px',
                            margin: '8px 0',
                            overflow: 'auto',
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            fontSize: 13,
                        }}
                    >
                        <code style={{ color: theme.text.primary }}>{code}</code>
                    </pre>
                )
            }

            // 处理行内代码
            const inlineParts = part.split(/(`[^`]+`)/g)
            return (
                <span key={i}>
                    {inlineParts.map((inline, j) => {
                        if (inline.startsWith('`') && inline.endsWith('`')) {
                            return (
                                <code
                                    key={j}
                                    style={{
                                        background: theme.bg.elevated,
                                        border: `1px solid ${theme.border.default}`,
                                        borderRadius: 3,
                                        padding: '2px 6px',
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: 12,
                                        color: theme.accent.gold,
                                    }}
                                >
                                    {inline.slice(1, -1)}
                                </code>
                            )
                        }
                        // 处理粗体
                        const boldParts = inline.split(/(\*\*[^*]+\*\*)/g)
                        return boldParts.map((bold, k) => {
                            if (bold.startsWith('**') && bold.endsWith('**')) {
                                return <strong key={k} style={{ color: theme.text.primary }}>{bold.slice(2, -2)}</strong>
                            }
                            return <span key={k}>{bold}</span>
                        })
                    })}
                </span>
            )
        })
    }

    return (
        <>
            <style>{starAnimation}</style>
            <Layout
                style={{
                    height: 'calc(100vh - 64px)',
                    background: theme.bg.primary,
                }}
            >
                {/* 左侧会话列表 - 代码文件树风格 */}
                <Sider
                    width={280}
                    style={{
                        background: theme.bg.surface,
                        borderRight: `1px solid ${theme.border.default}`,
                        overflow: 'auto',
                    }}
                >
                    {/* 侧边栏头部 */}
                    <div
                        style={{
                            padding: '16px',
                            borderBottom: `1px solid ${theme.border.default}`,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <StarFilled className="star-pulse" style={{ color: theme.accent.gold, fontSize: 18 }} />
                            <Text
                                strong
                                style={{
                                    color: theme.text.primary,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 14,
                                }}
                            >
                                AGENT_SESSIONS
                            </Text>
                        </div>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            block
                            onClick={handleNewSession}
                            style={{
                                background: theme.accent.gold,
                                borderColor: theme.accent.gold,
                                color: theme.bg.primary,
                                fontFamily: "'JetBrains Mono', monospace",
                                fontWeight: 600,
                            }}
                        >
                            <CodeOutlined /> NEW_SESSION
                        </Button>
                    </div>

                    {/* 会话列表 */}
                    <List
                        dataSource={sessions}
                        renderItem={(session, index) => (
                            <List.Item
                                onClick={() => loadSession(session.id)}
                                style={{
                                    cursor: 'pointer',
                                    padding: '12px 16px',
                                    background: activeSessionId === session.id ? theme.bg.hover : 'transparent',
                                    borderBottom: `1px solid ${theme.border.muted}`,
                                    transition: 'background 0.15s ease',
                                }}
                                actions={[
                                    <Popconfirm
                                        key="delete"
                                        title={
                                            <span style={{ color: theme.text.primary }}>
                                                确定归档此会话？
                                            </span>
                                        }
                                        onConfirm={(e) => {
                                            e?.stopPropagation()
                                            deleteSession(session.id)
                                        }}
                                        onCancel={(e) => e?.stopPropagation()}
                                        overlayStyle={{ background: theme.bg.elevated }}
                                    >
                                        <DeleteOutlined
                                            style={{ color: theme.text.muted }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </Popconfirm>,
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <div
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 6,
                                                background: activeSessionId === session.id
                                                    ? theme.accent.gold
                                                    : theme.bg.elevated,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: 12,
                                                color: activeSessionId === session.id
                                                    ? theme.bg.primary
                                                    : theme.text.secondary,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {String(index + 1).padStart(2, '0')}
                                        </div>
                                    }
                                    title={
                                        <Text
                                            ellipsis
                                            style={{
                                                fontSize: 13,
                                                maxWidth: 160,
                                                color: activeSessionId === session.id
                                                    ? theme.accent.gold
                                                    : theme.text.primary,
                                                fontFamily: "'JetBrains Mono', monospace",
                                            }}
                                        >
                                            {session.title}
                                        </Text>
                                    }
                                    description={
                                        <Space size={4}>
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    color: theme.text.muted,
                                                    fontFamily: "'JetBrains Mono', monospace",
                                                }}
                                            >
                                                {session.messageCount} msgs
                                            </Text>
                                            <Tag
                                                color={session.status === 'ACTIVE' ? 'success' : 'default'}
                                                style={{
                                                    fontSize: 10,
                                                    lineHeight: '16px',
                                                    background: session.status === 'ACTIVE'
                                                        ? 'rgba(63, 185, 80, 0.15)'
                                                        : theme.bg.elevated,
                                                    border: `1px solid ${session.status === 'ACTIVE'
                                                        ? theme.accent.green
                                                        : theme.border.default}`,
                                                    color: session.status === 'ACTIVE'
                                                        ? theme.accent.green
                                                        : theme.text.muted,
                                                    fontFamily: "'JetBrains Mono', monospace",
                                                }}
                                            >
                                                {session.status === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED'}
                                            </Tag>
                                        </Space>
                                    }
                                />
                            </List.Item>
                        )}
                        locale={{
                            emptyText: (
                                <Empty
                                    description={
                                        <span style={{ color: theme.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                                            // 暂无会话
                                        </span>
                                    }
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                />
                            ),
                        }}
                    />
                </Sider>

                {/* 右侧对话区域 - 代码编辑器/终端风格 */}
                <Content
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        background: theme.bg.primary,
                    }}
                >
                    {/* 顶部工具栏 */}
                    <div
                        style={{
                            padding: '12px 20px',
                            borderBottom: `1px solid ${theme.border.default}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: theme.bg.surface,
                        }}
                    >
                        <Space>
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 6,
                                    background: `linear-gradient(135deg, ${theme.accent.gold}, ${theme.accent.green})`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <RobotOutlined style={{ color: theme.bg.primary, fontSize: 14 }} />
                            </div>
                            <Text
                                strong
                                style={{
                                    color: theme.text.primary,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 14,
                                }}
                            >
                                {activeSessionId
                                    ? sessions.find((s) => s.id === activeSessionId)?.title || 'SESSION'
                                    : 'SELECT_SESSION'}
                            </Text>
                        </Space>
                        <Space size={8}>
                            <Tooltip
                                title={
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                        已注册 {tools.length} 个工具
                                    </span>
                                }
                            >
                                <Tag
                                    icon={<ToolOutlined />}
                                    style={{
                                        background: 'rgba(88, 166, 255, 0.15)',
                                        border: `1px solid ${theme.accent.blue}`,
                                        color: theme.accent.blue,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: 11,
                                    }}
                                >
                                    {tools.length} TOOLS
                                </Tag>
                            </Tooltip>
                            {status && (
                                <Tooltip
                                    title={
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                            {status.totalSessions} 会话 | {status.totalTasks} 任务 | {status.sseConnections} SSE
                                        </span>
                                    }
                                >
                                    <Tag
                                        icon={<DashboardOutlined />}
                                        style={{
                                            background: 'rgba(63, 185, 80, 0.15)',
                                            border: `1px solid ${theme.accent.green}`,
                                            color: theme.accent.green,
                                            fontFamily: "'JetBrains Mono', monospace",
                                            fontSize: 11,
                                        }}
                                    >
                                        RUNNING
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
                            padding: '20px 24px',
                        }}
                    >
                        {!activeSessionId && messages.length === 0 ? (
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '100%',
                                    gap: 16,
                                }}
                            >
                                <StarFilled
                                    className="star-pulse"
                                    style={{
                                        fontSize: 48,
                                        color: theme.accent.gold,
                                        filter: 'drop-shadow(0 0 20px rgba(240, 192, 64, 0.3))',
                                    }}
                                />
                                <div style={{ textAlign: 'center' }}>
                                    <Text
                                        style={{
                                            color: theme.text.primary,
                                            fontFamily: "'JetBrains Mono', monospace",
                                            fontSize: 16,
                                            display: 'block',
                                            marginBottom: 8,
                                        }}
                                    >
                                        GITHUB STARS AGENT
                                    </Text>
                                    <Text
                                        style={{
                                            color: theme.text.muted,
                                            fontFamily: "'JetBrains Mono', monospace",
                                            fontSize: 13,
                                        }}
                                    >
                                        // 选择左侧会话或创建新对话开始
                                    </Text>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg: ChatMessage, index: number) => (
                                <div
                                    key={msg.id}
                                    className="message-enter"
                                    style={{
                                        marginBottom: 20,
                                        display: 'flex',
                                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        paddingLeft: msg.role === 'assistant' ? 8 : 0,
                                        paddingRight: msg.role === 'user' ? 8 : 0,
                                    }}
                                >
                                    <div
                                        style={{
                                            maxWidth: '80%',
                                            display: 'flex',
                                            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                            alignItems: 'flex-start',
                                            gap: 10,
                                        }}
                                    >
                                        {/* 头像 */}
                                        <div
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 8,
                                                background: msg.role === 'user'
                                                    ? theme.accent.blue
                                                    : `linear-gradient(135deg, ${theme.accent.gold}, ${theme.accent.green})`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {msg.role === 'user' ? (
                                                <UserOutlined style={{ color: '#fff', fontSize: 14 }} />
                                            ) : (
                                                <RobotOutlined style={{ color: theme.bg.primary, fontSize: 14 }} />
                                            )}
                                        </div>

                                        {/* 消息内容 */}
                                        <div>
                                            {/* 消息头部 */}
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    marginBottom: 6,
                                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        fontSize: 11,
                                                        color: theme.text.muted,
                                                        fontFamily: "'JetBrains Mono', monospace",
                                                    }}
                                                >
                                                    {msg.role === 'user' ? '@you' : '@agent'}
                                                </Text>
                                                <Text
                                                    style={{
                                                        fontSize: 10,
                                                        color: theme.text.muted,
                                                        fontFamily: "'JetBrains Mono', monospace",
                                                    }}
                                                >
                                                    #{String(index + 1).padStart(3, '0')}
                                                </Text>
                                            </div>

                                            {/* 消息气泡 */}
                                            <div
                                                style={{
                                                    padding: '12px 16px',
                                                    borderRadius: 8,
                                                    background: msg.role === 'user'
                                                        ? theme.accent.blue
                                                        : theme.bg.surface,
                                                    border: msg.role === 'assistant'
                                                        ? `1px solid ${theme.border.default}`
                                                        : 'none',
                                                    color: '#fff',
                                                    fontFamily: "'JetBrains Mono', monospace",
                                                    fontSize: 13,
                                                    lineHeight: 1.6,
                                                }}
                                            >
                                                <Paragraph
                                                    style={{
                                                        margin: 0,
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-word',
                                                        color: 'inherit',
                                                        fontFamily: 'inherit',
                                                    }}
                                                >
                                                    {msg.content ? (
                                                        formatMessage(msg.content)
                                                    ) : loading && msg.role === 'assistant' ? (
                                                        <span style={{ color: theme.text.secondary }}>
                                                            思考中<span className="typing-cursor">_</span>
                                                        </span>
                                                    ) : null}
                                                </Paragraph>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* 底部输入区 - 命令行风格 */}
                    <div
                        style={{
                            padding: '16px 24px',
                            borderTop: `1px solid ${theme.border.default}`,
                            background: theme.bg.surface,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-end',
                                gap: 12,
                                background: theme.bg.primary,
                                border: `1px solid ${theme.border.default}`,
                                borderRadius: 8,
                                padding: '8px 12px',
                                transition: 'border-color 0.15s ease',
                            }}
                        >
                            <span
                                style={{
                                    color: theme.accent.green,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    paddingBottom: 4,
                                }}
                            >
                                {'$>'}
                            </span>
                            <TextArea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={activeSessionId ? '输入消息，Enter 发送...' : '请先创建或选择一个会话'}
                                autoSize={{ minRows: 1, maxRows: 4 }}
                                disabled={!activeSessionId}
                                style={{
                                    flex: 1,
                                    resize: 'none',
                                    background: 'transparent',
                                    border: 'none',
                                    boxShadow: 'none',
                                    color: theme.text.primary,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 13,
                                }}
                            />
                            {loading ? (
                                <Button
                                    type="primary"
                                    danger
                                    icon={<StopOutlined />}
                                    onClick={stopGeneration}
                                    style={{
                                        background: theme.accent.red,
                                        borderColor: theme.accent.red,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontWeight: 600,
                                    }}
                                >
                                    STOP
                                </Button>
                            ) : (
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    onClick={handleSend}
                                    disabled={!inputValue.trim() || !activeSessionId}
                                    style={{
                                        background: theme.accent.gold,
                                        borderColor: theme.accent.gold,
                                        color: theme.bg.primary,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontWeight: 600,
                                    }}
                                >
                                    SEND
                                </Button>
                            )}
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginTop: 8,
                                padding: '0 4px',
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 10,
                                    color: theme.text.muted,
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >
                                SHIFT+ENTER 换行
                            </Text>
                            <Text
                                style={{
                                    fontSize: 10,
                                    color: theme.text.muted,
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >
                                {activeSessionId ? `SESSION: ${activeSessionId}` : 'NO_SESSION'}
                            </Text>
                        </div>
                    </div>
                </Content>
            </Layout>
        </>
    )
}
