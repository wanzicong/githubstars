import { useState, useRef, useCallback, useEffect } from 'react'
import { Input, Button, Typography, Tag, theme, App, Segmented, Badge, Tooltip, Spin, Avatar, Flex, Card, Layout } from 'antd'
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ClearOutlined,
  CopyOutlined,
  CheckOutlined,
  GithubOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  BranchesOutlined,
  ApiOutlined,
  StarOutlined,
} from '@ant-design/icons'

const { Text, Paragraph, Title } = Typography
const { Header, Content } = Layout

// ── Types ──

interface ToolCallInfo {
  name: string
  input: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolCalls?: ToolCallInfo[]
  sessionId?: string
}

type SessionMode = 'none' | 'auto'

// ── Constants ──

const SUGGESTIONS = [
  { icon: <StarOutlined />, text: '查看 facebook/react 仓库信息' },
  { icon: <BranchesOutlined />, text: '搜索最受欢迎的 React 组件库' },
  { icon: <CodeOutlined />, text: '查看 TypeScript 项目最新动态' },
  { icon: <ApiOutlined />, text: '搜索类似 axios 的 HTTP 库' },
]

const SESSION_OPTIONS: { value: SessionMode; label: string }[] = [
  { value: 'none', label: '一次性对话' },
  { value: 'auto', label: '持续对话' },
]

// ── Helpers ──

let msgIdCounter = 0
function nextMsgId(): string {
  msgIdCounter += 1
  return `msg_${Date.now()}_${msgIdCounter}`
}

// ── Components ──

/** AI 头像 */
function AIAvatar({ size = 36 }: { size?: number }) {
  return (
    <Avatar
      size={size}
      icon={<RobotOutlined />}
      style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        color: '#fff',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
      }}
    />
  )
}

/** 用户头像 */
function UserAvatar({ size = 36 }: { size?: number }) {
  return (
    <Avatar
      size={size}
      icon={<UserOutlined />}
      style={{
        background: '#1677ff',
        color: '#fff',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(22,119,255,0.3)',
      }}
    />
  )
}

// ── Main Component ──

export default function AgentChat() {
  const { token } = theme.useToken()
  const { message: antMsg } = App.useApp()

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionMode, setSessionMode] = useState<SessionMode>('none')
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Refs
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<React.ComponentRef<typeof Input.TextArea>>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto scroll
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  // Copy
  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      antMsg.error('复制失败')
    }
  }, [antMsg])

  // Clear
  const handleClear = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setCurrentSessionId(null)
    setStreamingText('')
    setLoading(false)
  }, [])

  // Send (SSE streaming)
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)

    const userMsg: ChatMessage = {
      id: nextMsgId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])

    const abortController = new AbortController()
    abortRef.current = abortController

    const assistantId = nextMsgId()
    setStreamingText('')
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), toolCalls: [] },
    ])

    try {
      const body = JSON.stringify({
        message: text,
        session: currentSessionId
          ? { type: 'resume' as const, id: currentSessionId }
          : { type: sessionMode },
      })

      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: abortController.signal,
      })

      if (!response.ok) throw new Error(`请求失败: ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      const toolCalls: ToolCallInfo[] = []
      let capturedSessionId: string | null = null

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
            const event = JSON.parse(dataStr) as { type: string; data: unknown; sessionId?: string }

            if (event.sessionId) capturedSessionId = event.sessionId

            if (event.type === 'assistant_message') {
              fullText += event.data as string
              setStreamingText(fullText)
            } else if (event.type === 'tool_use') {
              const td = event.data as { toolName: string; toolInput: unknown }
              toolCalls.push({
                name: td.toolName.replace('mcp__github__', ''),
                input: JSON.stringify(td.toolInput, null, 2),
              })
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, toolCalls: [...toolCalls] } : m)),
              )
            } else if (event.type === 'connected' && event.sessionId) {
              capturedSessionId = event.sessionId
            }
          } catch { /* skip parse errors */ }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: fullText, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, sessionId: capturedSessionId ?? undefined }
            : m,
        ),
      )
      setStreamingText('')

      if (capturedSessionId && !currentSessionId) {
        setCurrentSessionId(capturedSessionId)
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `❌ 请求出错：${error instanceof Error ? error.message : '未知错误'}` } : m,
        ),
      )
    } finally {
      setLoading(false)
      setStreamingText('')
      abortRef.current = null
      inputRef.current?.focus()
    }
  }, [input, loading, sessionMode, currentSessionId])

  const handleModeChange = useCallback((value: SessionMode) => {
    setSessionMode(value)
    if (value === 'none') setCurrentSessionId(null)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleSuggestion = useCallback((text: string) => {
    setInput(text)
  }, [])

  // ── Render message bubble ──

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === 'user'

    return (
      <Flex key={msg.id} gap={12} justify={isUser ? 'end' : 'start'} align="start" style={{ marginBottom: 24 }}>
        {!isUser && <AIAvatar />}

        <Flex vertical gap={4} align={isUser ? 'end' : 'start'} style={{ maxWidth: '72%' }}>
          {/* Label */}
          <Flex gap={6} align="center" style={{ paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{isUser ? '你' : 'AI Agent'}</Text>
            {msg.sessionId && (
              <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', margin: 0 }}>
                <ThunderboltOutlined /> {msg.sessionId.slice(0, 8)}…
              </Tag>
            )}
          </Flex>

          {/* Bubble */}
          <div
            style={{
              padding: '10px 16px',
              borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: isUser ? token.colorPrimary : token.colorBgElevated,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              width: '100%',
            }}
          >
            {/* Tool calls */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {msg.toolCalls.map((tc, i) => (
                  <Tag key={i} color="purple" style={{ marginBottom: 2, fontSize: 11, fontFamily: 'monospace' }}>
                    <ApiOutlined /> {tc.name}
                  </Tag>
                ))}
              </div>
            )}

            {/* Content */}
            <Paragraph
              style={{
                margin: 0,
                color: isUser ? '#fff' : token.colorText,
                fontSize: 14,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content}
            </Paragraph>
          </div>

          {/* Actions */}
          {!isUser && msg.content && !/^[❌]/.test(msg.content) && (
            <Flex gap={4} style={{ paddingLeft: 4, marginTop: 2 }}>
              <Tooltip title="复制">
                <Button
                  type="text"
                  size="small"
                  icon={copiedId === msg.id ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
                  onClick={() => handleCopy(msg.content, msg.id)}
                  style={{ color: token.colorTextTertiary }}
                />
              </Tooltip>
            </Flex>
          )}
        </Flex>

        {isUser && <UserAvatar />}
      </Flex>
    )
  }

  // ── Streaming indicator ──

  const isStreaming = loading && streamingText.length > 0

  // ── Render ──

  return (
    <Layout style={{ height: '100%', background: token.colorBgContainer, overflow: 'hidden' }}>
      {/* Header */}
      <Header
        style={{
          height: 56,
          lineHeight: '56px',
          padding: '0 24px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Flex align="center" gap={12}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 18,
            }}
          >
            <GithubOutlined />
          </div>
          <div>
            <Text strong>GitHub AI Agent</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -2 }}>
              <Badge status={loading ? 'processing' : 'success'} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {loading ? '思考中…' : '在线'}
              </Text>
            </div>
          </div>
        </Flex>

        <Flex gap={12} align="center">
          <Segmented
            options={SESSION_OPTIONS}
            value={sessionMode}
            onChange={(val) => handleModeChange(val as SessionMode)}
            size="small"
          />
          {currentSessionId && (
            <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
              <ThunderboltOutlined /> 会话 #{currentSessionId.slice(0, 8)}
            </Tag>
          )}
          <Tooltip title="清除对话">
            <Button icon={<ClearOutlined />} size="small" onClick={handleClear} />
          </Tooltip>
        </Flex>
      </Header>

      {/* Message list */}
      <Content
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 16px',
          background: token.colorBgLayout,
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && !isStreaming && !loading && (
          <Flex vertical align="center" justify="center" style={{ height: '100%', textAlign: 'center', padding: '40px 0' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 32,
                marginBottom: 20,
                boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
              }}
            >
              <RobotOutlined />
            </div>
            <Title level={4} style={{ margin: 0 }}>有什么需要帮忙的吗？</Title>
            <Text type="secondary" style={{ marginTop: 8, maxWidth: 400 }}>
              我可以帮你搜索 GitHub 仓库、查看项目信息、分析技术趋势
            </Text>

            <Flex wrap="wrap" justify="center" gap={8} style={{ marginTop: 24, maxWidth: 520 }}>
              {SUGGESTIONS.map((s, i) => (
                <Card
                  key={i}
                  hoverable
                  size="small"
                  onClick={() => handleSuggestion(s.text)}
                  style={{
                    width: 240,
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                  styles={{ body: { padding: '10px 14px' } }}
                >
                  <Flex gap={8} align="center">
                    <span style={{ color: token.colorPrimary, fontSize: 16 }}>{s.icon}</span>
                    <Text style={{ fontSize: 13 }}>{s.text}</Text>
                  </Flex>
                </Card>
              ))}
            </Flex>
          </Flex>
        )}

        {/* Messages */}
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {messages.map(renderMessage)}

          {/* Streaming bubble */}
          {isStreaming && (
            <Flex gap={12} align="start" style={{ marginBottom: 24 }}>
              <AIAvatar />
              <Flex vertical gap={4} style={{ maxWidth: '72%' }}>
                <Text type="secondary" style={{ fontSize: 12, paddingLeft: 4 }}>AI Agent</Text>
                <div
                  style={{
                    padding: '10px 16px',
                    borderRadius: '18px 18px 18px 4px',
                    background: token.colorBgElevated,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  <Paragraph style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {streamingText}
                    <span
                      style={{
                        display: 'inline-block',
                        width: 2,
                        height: 16,
                        background: token.colorPrimary,
                        marginLeft: 2,
                        verticalAlign: 'middle',
                        animation: 'blink 1s step-end infinite',
                      }}
                    />
                  </Paragraph>
                </div>
              </Flex>
            </Flex>
          )}

          {/* Loading skeleton */}
          {loading && !streamingText && (
            <Flex gap={12} align="center" style={{ marginBottom: 24, marginLeft: 48 }}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 13 }}>AI 正在分析 …</Text>
            </Flex>
          )}
        </div>
      </Content>

      {/* Input area */}
      <div
        style={{
          padding: '12px 16px 16px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          flexShrink: 0,
        }}
      >
        <Flex vertical gap={8} style={{ maxWidth: 860, margin: '0 auto' }}>
          <Flex gap={8}>
            <Input.TextArea
              ref={inputRef as React.Ref<React.ComponentRef<typeof Input.TextArea>>}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={loading ? '等待 AI 回复…' : '输入你想查询的 GitHub 仓库或问题…'}
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={loading}
              variant="filled"
              style={{ borderRadius: 12, fontSize: 14 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
              disabled={!input.trim()}
              style={{ height: 'auto', borderRadius: 12, paddingInline: 20, minWidth: 80 }}
            >
              发送
            </Button>
          </Flex>
          <Text type="secondary" style={{ fontSize: 11, textAlign: 'center' }}>
            Enter 发送 · Shift+Enter 换行 · 支持 GitHub 仓库搜索、信息查询、趋势分析
          </Text>
        </Flex>
      </div>

      {/* Global keyframe for cursor blink */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </Layout>
  )
}
