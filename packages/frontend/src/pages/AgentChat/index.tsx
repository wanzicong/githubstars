import { useState, useRef, useCallback, useEffect } from 'react'
import { Input, Button, Typography, Tag, theme, App, Segmented, Badge, Tooltip, Spin, Avatar, Flex, Card } from 'antd'
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
  BugOutlined,
} from '@ant-design/icons'
import MarkdownRenderer from '@/components/common/MarkdownRenderer'

const { Text, Paragraph } = Typography

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
  { icon: <BranchesOutlined />, text: '搜索最流行的 React 组件库' },
  { icon: <BugOutlined />, text: '查看 TypeScript 项目更新动态' },
  { icon: <CodeOutlined />, text: '搜索类似 axios 的 HTTP 库' },
]

const SESSION_OPTIONS: { value: SessionMode; label: string }[] = [
  { value: 'none', label: '临时会话' },
  { value: 'auto', label: '持久会话' },
]

// ── Helpers ──

let msgIdCounter = 0
const nextMsgId = () => `msg_${Date.now()}_${msgIdCounter++}`

// ── Sub-components ──

function AIAvatar({ size = 36 }: { size?: number }) {
  return (
    <Avatar
      size={size}
      icon={<RobotOutlined />}
      style={{
        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
        color: '#fff',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
      }}
    />
  )
}

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<React.ComponentRef<typeof Input.TextArea>>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  // ── Event Handlers ──

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      antMsg.error('复制失败')
    }
  }, [antMsg])

  const handleClear = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setCurrentSessionId(null)
    setStreamingText('')
    setLoading(false)
  }, [])

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
          const raw = line.slice(6).trim()
          if (!raw) continue

          try {
            const event = JSON.parse(raw) as { type: string; data: unknown; sessionId?: string }
            if (event.sessionId) capturedSessionId = event.sessionId

            switch (event.type) {
              case 'assistant_message':
                fullText += event.data as string
                setStreamingText(fullText)
                break
              case 'tool_use': {
                const td = event.data as { toolName: string; toolInput: unknown }
                toolCalls.push({
                  name: td.toolName.replace('mcp__github__', ''),
                  input: JSON.stringify(td.toolInput, null, 2),
                })
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, toolCalls: [...toolCalls] } : m)),
                )
                break
              }
              case 'connected':
                if (event.sessionId) capturedSessionId = event.sessionId
                break
            }
          } catch { /* skip malformed events */ }
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
          m.id === assistantId
            ? { ...m, content: `> ❌ **请求出错**：${error instanceof Error ? error.message : '未知错误'}` }
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

  const handleModeChange = useCallback((value: SessionMode) => {
    setSessionMode(value)
    if (value === 'none') setCurrentSessionId(null)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleSuggestion = useCallback((text: string) => {
    setInput(text)
    inputRef.current?.focus()
  }, [])

  // ── Message Bubble ──

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === 'user'

    return (
      <Flex key={msg.id} gap={12} justify={isUser ? 'end' : 'start'} align="start" style={{ marginBottom: 24 }}>
        {!isUser && <AIAvatar />}

        <Flex vertical gap={4} align={isUser ? 'end' : 'start'} style={{ maxWidth: '76%', minWidth: 0 }}>
          <Flex gap={6} align="center" style={{ paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{isUser ? '你' : 'AI Agent'}</Text>
            {msg.sessionId && (
              <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', margin: 0 }}>
                <ThunderboltOutlined /> {msg.sessionId.slice(0, 8)}…
              </Tag>
            )}
          </Flex>

          <div
            style={{
              padding: isUser ? '8px 16px' : '12px 16px',
              borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: isUser ? token.colorPrimary : token.colorBgElevated,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <Flex wrap="wrap" gap={4} style={{ marginBottom: 8 }}>
                {msg.toolCalls.map((tc, i) => (
                  <Tag key={i} color="purple" style={{ fontSize: 11, fontFamily: 'monospace', margin: 0 }}>
                    <ApiOutlined /> {tc.name}
                  </Tag>
                ))}
              </Flex>
            )}

            {isUser ? (
              <Paragraph style={{ margin: 0, color: '#fff', fontSize: 14, lineHeight: 1.7, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </Paragraph>
            ) : (
              <MarkdownRenderer
                content={msg.content}
                style={{ fontSize: 14, lineHeight: 1.7, color: token.colorText, wordBreak: 'break-word' }}
              />
            )}
          </div>

          {!isUser && msg.content && !/^> ❌/.test(msg.content) && (
            <Flex gap={4} style={{ paddingLeft: 4, marginTop: 2 }}>
              <Tooltip title="复制">
                <Button
                  type="text"
                  size="small"
                  icon={copiedId === msg.id ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
                  onClick={() => handleCopy(msg.content, msg.id)}
                  style={{ color: token.colorTextTertiary, fontSize: 12 }}
                />
              </Tooltip>
            </Flex>
          )}
        </Flex>

        {isUser && <UserAvatar />}
      </Flex>
    )
  }

  const isStreaming = loading && streamingText.length > 0

  // ── Render ──

  const hasMessages = messages.length > 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: token.colorBgContainer,
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 100%)`,
          flexShrink: 0,
        }}
      >
        <Flex align="center" gap={10}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16,
            }}
          >
            <GithubOutlined />
          </div>
          <div>
            <Text strong style={{ fontSize: 15 }}>AI Agent</Text>
            <Flex align="center" gap={4} style={{ marginTop: -1 }}>
              <Badge status={loading ? 'processing' : 'success'} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {loading ? '思考中…' : hasMessages ? `${messages.filter(m => m.role === 'user').length} 条对话` : '在线'}
              </Text>
            </Flex>
          </div>
        </Flex>

        <Flex gap={8} align="center" wrap="wrap">
          <Segmented options={SESSION_OPTIONS} value={sessionMode} onChange={(val) => handleModeChange(val as SessionMode)} size="small" />
          {currentSessionId && (
            <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
              <ThunderboltOutlined /> #{currentSessionId.slice(0, 8)}
            </Tag>
          )}
          {hasMessages && (
            <Tooltip title="清除对话">
              <Button icon={<ClearOutlined />} size="small" onClick={handleClear} />
            </Tooltip>
          )}
        </Flex>
      </div>

      {/* ── SCROLLABLE CONTENT + STICKY INPUT ── */}
      {/*
        * 关键布局：消息列表和输入框在同一个滚动容器中。
        * 消息列表在上，输入框用 position: sticky; bottom: 0 固定在底部。
        * 这样输入框始终悬浮在视口底部，消息尽可能占用屏幕面积。
        */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: token.colorBgLayout,
        }}
      >
        {/* ── Empty State ── */}
        {!hasMessages && !isStreaming && !loading && (
          <Flex vertical align="center" justify="center" style={{ flex: 1, textAlign: 'center', padding: '0 20px' }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: 16,
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 28, marginBottom: 16,
                boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
              }}
            >
              <RobotOutlined />
            </div>
            <Text strong style={{ fontSize: 18 }}>有什么需要帮忙的吗？</Text>
            <Text type="secondary" style={{ marginTop: 6, fontSize: 14 }}>
              搜索 GitHub 仓库、查看项目信息、分析技术趋势
            </Text>

            <Flex wrap="wrap" justify="center" gap={8} style={{ marginTop: 24, maxWidth: 500 }}>
              {SUGGESTIONS.map((s, i) => (
                <Card
                  key={i}
                  hoverable
                  size="small"
                  onClick={() => handleSuggestion(s.text)}
                  style={{ width: 230, borderRadius: 10, cursor: 'pointer' }}
                  styles={{ body: { padding: '8px 12px' } }}
                >
                  <Flex gap={8} align="center">
                    <span style={{ color: token.colorPrimary, fontSize: 15 }}>{s.icon}</span>
                    <Text style={{ fontSize: 13 }}>{s.text}</Text>
                  </Flex>
                </Card>
              ))}
            </Flex>
          </Flex>
        )}

        {/* ── Message List ── */}
        {hasMessages && (
          <div style={{ maxWidth: 800, margin: '0 auto', width: '100%', padding: '20px 16px 0' }}>
            {messages.map(renderMessage)}

            {isStreaming && (
              <Flex gap={12} align="start" style={{ marginBottom: 24 }}>
                <AIAvatar />
                <Flex vertical gap={4} style={{ maxWidth: '76%', minWidth: 0 }}>
                  <Text type="secondary" style={{ fontSize: 12, paddingLeft: 4 }}>AI Agent</Text>
                  <div style={{ padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: token.colorBgElevated, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <MarkdownRenderer content={streamingText} style={{ fontSize: 14, lineHeight: 1.7, color: token.colorText }} />
                    <span style={{ display: 'inline-block', width: 2, height: 16, background: token.colorPrimary, marginLeft: 2, verticalAlign: 'middle', animation: 'agent-blink 1s step-end infinite' }} />
                  </div>
                </Flex>
              </Flex>
            )}

            {loading && !streamingText && (
              <Flex gap={12} align="center" style={{ marginBottom: 24, marginLeft: 48 }}>
                <Spin size="small" />
                <Text type="secondary" style={{ fontSize: 13 }}>AI 正在分析…</Text>
              </Flex>
            )}
          </div>
        )}

        {/* Spacer so input doesn't overlap last message */}
        <div style={{ height: 16, flexShrink: 0 }} />

        {/* ── STICKY INPUT (悬浮底部) ── */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            background: token.colorBgContainer,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            padding: '12px 16px 16px',
            flexShrink: 0,
          }}
        >
          <Flex vertical gap={6} style={{ maxWidth: 800, margin: '0 auto' }}>
            <Flex gap={8}>
              <Input.TextArea
                ref={inputRef as React.Ref<React.ComponentRef<typeof Input.TextArea>>}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你想查询的 GitHub 仓库或问题…"
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={loading}
                variant="filled"
                style={{ borderRadius: 10, fontSize: 14 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={loading}
                disabled={!input.trim()}
                style={{ height: 'auto', borderRadius: 10, paddingInline: 20, minWidth: 76 }}
              >
                发送
              </Button>
            </Flex>
            <Text type="secondary" style={{ fontSize: 11, textAlign: 'center' }}>
              Enter 发送 · Shift+Enter 换行 · 基于 Claude Agent SDK + GitHub MCP
            </Text>
          </Flex>
        </div>
      </div>

      <style>{`
        @keyframes agent-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
