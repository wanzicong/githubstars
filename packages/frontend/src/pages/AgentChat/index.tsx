import { useState, useRef, useCallback, useEffect } from 'react'
import { Input, Button, Typography, Space, Tag, theme, App, Segmented, Badge, Tooltip, Spin } from 'antd'
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ClearOutlined,
  CopyOutlined,
  CheckOutlined,
  GithubOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

const { Text, Paragraph } = Typography

// ── 类型 ──

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool_call' | 'system'
  content: string
  timestamp: Date
  toolCalls?: ToolCallInfo[]
  sessionId?: string
}

interface ToolCallInfo {
  name: string
  input: string
}

type SessionMode = 'none' | 'auto'

// ── 欢迎消息 ──

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `👋 你好！我是 **GitHub AI Agent**，可以帮你：

- 🔍 搜索和查看 GitHub 仓库信息
- ⭐ 查询 Star 数、Fork 数、最近更新
- 📋 查看 Issues 和 Pull Requests
- 🔎 搜索相似项目和技术趋势
- 🖥️ 执行命令和网络搜索

在下方输入你想查询的内容开始吧！`,
  timestamp: new Date(),
}

// ── 常量 ──

const SESSION_OPTIONS = [
  { value: 'none' as SessionMode, label: '一次性对话' },
  { value: 'auto' as SessionMode, label: '持续对话' },
]

// ── 辅助函数 ──

let msgIdCounter = 0
function nextMsgId(): string {
  msgIdCounter += 1
  return `msg_${Date.now()}_${msgIdCounter}`
}

// ── 主组件 ──

export default function AgentChat() {
  const { token } = theme.useToken()
  const { message: antMsg } = App.useApp()

  // 状态
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionMode, setSessionMode] = useState<SessionMode>('none')
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  // 复制消息
  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      antMsg.error('复制失败')
    }
  }, [antMsg])

  // 清除对话
  const handleClear = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setMessages([WELCOME_MESSAGE])
    setCurrentSessionId(null)
    setStreamingText('')
    setLoading(false)
  }, [])

  // 发送消息（SSE 流式）
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: nextMsgId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])

    // 创建 AbortController
    const abortController = new AbortController()
    abortRef.current = abortController

    // 流式消息占位
    const assistantId = nextMsgId()
    setStreamingText('')
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        toolCalls: [],
      },
    ])

    try {
      const body = JSON.stringify({
        message: text,
        session: currentSessionId
          ? { type: 'resume' as const, id: currentSessionId }
          : { type: sessionMode as SessionMode },
      })

      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      const toolCalls: ToolCallInfo[] = []
      let capturedSessionId: string | null = null

      // 读取 SSE 流
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6).trim()
          if (!dataStr) continue

          try {
            const event = JSON.parse(dataStr) as {
              type: string
              data: unknown
              sessionId?: string
            }

            // 捕获 sessionId
            if (event.sessionId) {
              capturedSessionId = event.sessionId
            }

            if (event.type === 'assistant_message') {
              const chunk = event.data as string
              fullText += chunk
              setStreamingText(fullText)
            } else if (event.type === 'tool_use') {
              const toolData = event.data as { toolName: string; toolInput: unknown }
              toolCalls.push({
                name: toolData.toolName,
                input: JSON.stringify(toolData.toolInput, null, 2),
              })
              // 更新消息中的 toolCalls
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, toolCalls: [...toolCalls] } : m,
                ),
              )
            } else if (event.type === 'connected' && event.sessionId) {
              capturedSessionId = event.sessionId
            }
          } catch {
            // SSE 解析错误，忽略
          }
        }
      }

      // 更新完整消息
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: fullText,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                sessionId: capturedSessionId ?? undefined,
              }
            : m,
        ),
      )
      setStreamingText('')

      // 如果 auto 模式且有 sessionId，保存
      if (capturedSessionId && !currentSessionId) {
        setCurrentSessionId(capturedSessionId)
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `❌ 出错了: ${errorMsg}` }
            : m,
        ),
      )
    } finally {
      setLoading(false)
      setStreamingText('')
      abortRef.current = null
      inputRef.current?.focus()
    }
  }, [input, loading, sessionMode, currentSessionId])

  // 切换会话模式时重置
  const handleModeChange = useCallback((value: SessionMode) => {
    setSessionMode(value)
    if (value === 'none') {
      setCurrentSessionId(null)
    }
  }, [])

  // 快捷键发送
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // ── 渲染消息 ──

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === 'user'

    return (
      <div
        key={msg.id}
        className='flex gap-3 mb-5'
        style={{
          flexDirection: isUser ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
        }}
      >
        {/* 头像 */}
        <div
          className='flex-shrink-0 flex items-center justify-center rounded-full'
          style={{
            width: 36,
            height: 36,
            background: isUser
              ? token.colorPrimary
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            fontSize: 16,
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
        >
          {isUser ? <UserOutlined /> : <RobotOutlined />}
        </div>

        {/* 内容 */}
        <div
          className='flex flex-col'
          style={{
            maxWidth: '75%',
            alignItems: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          {/* 名称 */}
          <Text
            type='secondary'
            style={{ fontSize: 12, marginBottom: 4, marginLeft: isUser ? 0 : 4, marginRight: isUser ? 4 : 0 }}
          >
            {isUser ? '你' : 'AI Agent'}
            {msg.sessionId && (
              <Tag
                style={{ marginLeft: 6, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
              >
                {msg.sessionId.slice(0, 8)}...
              </Tag>
            )}
          </Text>

          {/* 气泡 */}
          <div
            className='rounded-2xl px-4 py-3'
            style={{
              background: isUser ? token.colorPrimary : token.colorBgElevated,
              color: isUser ? '#fff' : token.colorText,
              borderRadius: isUser
                ? '16px 16px 4px 16px'
                : '16px 16px 16px 4px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              width: '100%',
            }}
          >
            {/* Tool calls */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className='mb-2 space-y-1'>
                {msg.toolCalls.map((tc, i) => (
                  <div
                    key={i}
                    className='text-xs rounded-lg px-2 py-1'
                    style={{
                      background: isUser ? 'rgba(255,255,255,0.15)' : token.colorFillTertiary,
                      color: isUser ? 'rgba(255,255,255,0.85)' : token.colorTextSecondary,
                      fontFamily: 'monospace',
                    }}
                  >
                    <Text style={{ color: isUser ? 'rgba(255,255,255,0.9)' : token.colorPrimary, fontSize: 11 }}>
                      🛠 {tc.name.replace('mcp__github__', '')}
                    </Text>
                  </div>
                ))}
              </div>
            )}

            {/* 消息内容 */}
            <div className='markdown-content' style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <Paragraph
                style={{
                  margin: 0,
                  color: isUser ? '#fff' : token.colorText,
                  fontSize: 14,
                }}
              >
                {msg.content}
              </Paragraph>
            </div>
          </div>

          {/* 操作按钮 */}
          {!isUser && msg.content && !msg.content.startsWith('❌') && (
            <div className='flex gap-1 mt-1' style={{ marginLeft: 4 }}>
              <Tooltip title='复制'>
                <Button
                  type='text'
                  size='small'
                  icon={copiedId === msg.id ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
                  onClick={() => handleCopy(msg.content, msg.id)}
                  style={{ color: token.colorTextTertiary, fontSize: 11 }}
                />
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 渲染 ──

  const isStreaming = loading && streamingText

  return (
    <div className='flex flex-col h-full' style={{ background: token.colorBgContainer }}>
      {/* 头部 */}
      <div
        className='flex-shrink-0 flex items-center justify-between px-6 py-3'
        style={{
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 100%)`,
        }}
      >
        <div className='flex items-center gap-3'>
          <div
            className='w-9 h-9 rounded-xl flex items-center justify-center'
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              fontSize: 18,
            }}
          >
            <GithubOutlined />
          </div>
          <div>
            <Text strong style={{ fontSize: 16 }}>GitHub AI Agent</Text>
            <div className='flex items-center gap-2'>
              <Badge status={loading ? 'processing' : 'success'} />
              <Text type='secondary' style={{ fontSize: 12 }}>
                {loading ? '思考中...' : '在线'}
              </Text>
            </div>
          </div>
        </div>

        <Space size='middle'>
          <Segmented
            options={SESSION_OPTIONS}
            value={sessionMode}
            onChange={(val) => handleModeChange(val as SessionMode)}
            size='small'
          />
          {currentSessionId && (
            <Tag
              color='blue'
              style={{ fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              <ThunderboltOutlined /> {currentSessionId.slice(0, 10)}...
            </Tag>
          )}
          <Tooltip title='清除对话'>
            <Button
              icon={<ClearOutlined />}
              size='small'
              onClick={handleClear}
              style={{ color: token.colorTextTertiary }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* 消息列表 */}
      <div
        className='flex-1 overflow-y-auto px-6 py-4'
        style={{
          background: token.colorBgLayout,
          scrollBehavior: 'smooth',
        }}
      >
        {messages.map(renderMessage)}

        {/* 流式加载指示 */}
        {isStreaming && (
          <div className='flex gap-3 mb-5' style={{ alignItems: 'flex-start' }}>
            <div
              className='flex-shrink-0 flex items-center justify-center rounded-full'
              style={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                fontSize: 16,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              }}
            >
              <RobotOutlined />
            </div>
            <div
              className='rounded-2xl px-4 py-3'
              style={{
                background: token.colorBgElevated,
                borderRadius: '16px 16px 16px 4px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                maxWidth: '75%',
              }}
            >
              <Paragraph
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {streamingText}
                <span className='inline-block w-1 h-4 ml-0.5 animate-pulse' style={{ background: token.colorPrimary }}>
                  &nbsp;
                </span>
              </Paragraph>
            </div>
          </div>
        )}

        {/* 加载中但无流式文本 */}
        {loading && !streamingText && (
          <div className='flex items-center gap-2 mb-5' style={{ marginLeft: 48 }}>
            <Spin size='small' />
            <Text type='secondary' style={{ fontSize: 13 }}>AI 正在思考...</Text>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div
        className='flex-shrink-0 px-6 py-4'
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        <div className='flex gap-3' style={{ maxWidth: 900, margin: '0 auto' }}>
          <Input.TextArea
            ref={inputRef as unknown as React.Ref<any>}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={loading ? '等待 AI 回复中...' : '输入你想查询的 GitHub 仓库或问题...'}
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
            variant='filled'
            style={{
              borderRadius: 12,
              fontSize: 14,
            }}
          />
          <Button
            type='primary'
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!input.trim()}
            style={{
              height: 'auto',
              borderRadius: 12,
              paddingInline: 20,
            }}
          >
            发送
          </Button>
        </div>
        <div className='text-center mt-2'>
          <Text type='secondary' style={{ fontSize: 11 }}>
            Enter 发送 · Shift+Enter 换行 · 支持 GitHub 仓库搜索、信息查询、趋势分析
          </Text>
        </div>
      </div>
    </div>
  )
}
