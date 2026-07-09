import { useState, useRef, useCallback, useEffect } from 'react'
import { Input, Button, Typography, Tag, theme, App, Segmented, Badge, Tooltip, Spin, Avatar, Flex, Card, Drawer, Empty, Skeleton } from 'antd'
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
  HistoryOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import MarkdownRenderer from '@/components/common/MarkdownRenderer'
import { useAppStore } from '@/stores'
import { SIDER_WIDTH, SIDER_COLLAPSED_WIDTH } from '@/layouts/default/constants'
import { listAgentSessions, getAgentSession, deleteAgentSession } from '@/api/agent'
import { resolveAgentBaseURL } from '@/api/agentBase'

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

interface SessionSummary {
  id: string
  type: string
  status: string
  messageCount: number
  firstMessage: string | null
  lastMessage: string | null
  createdAt: string
  updatedAt: string
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

/** 相对时间格式化 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

/** 按日期对会话分组 */
function groupSessionsByDate(sessions: SessionSummary[]): Array<{ label: string; items: SessionSummary[] }> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const thisWeek = today - 6 * 86400000

  const groups: Record<string, SessionSummary[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }

  for (const s of sessions) {
    const t = new Date(s.updatedAt).getTime()
    if (t >= today) groups.today.push(s)
    else if (t >= yesterday) groups.yesterday.push(s)
    else if (t >= thisWeek) groups.thisWeek.push(s)
    else groups.earlier.push(s)
  }

  const result: Array<{ label: string; items: SessionSummary[] }> = []
  if (groups.today.length > 0) result.push({ label: '今天', items: groups.today })
  if (groups.yesterday.length > 0) result.push({ label: '昨天', items: groups.yesterday })
  if (groups.thisWeek.length > 0) result.push({ label: '最近 7 天', items: groups.thisWeek })
  if (groups.earlier.length > 0) result.push({ label: '更早', items: groups.earlier })
  return result
}

// ── SSE 流式解析 ──

/** SSE 事件数据结构 */
interface SSEEvent {
  type: string
  data: unknown
  sessionId?: string
}

/**
 * 读取 SSE 流的逐行事件，逐个 yield 解析后的 JSON 对象。
 * 将原始字节流 → 文本行 → JSON 解析的逻辑独立出来，
 * 降低 handleSend 的 Cognitive Complexity。
 */
async function* readSSEStream(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder()
  let buffer = ''

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
        yield JSON.parse(raw) as SSEEvent
      } catch { /* skip malformed JSON lines */ }
    }
  }
}

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
  const siderCollapsed = useAppStore((s) => s.siderCollapsed)

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionMode, setSessionMode] = useState<SessionMode>('auto')
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 对话列表状态
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null)

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<React.ComponentRef<typeof Input.TextArea>>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto scroll
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

  // ── 对话列表管理 ──

  /** 获取会话列表 */
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true)
    setSessionsError(null)
    try {
      const data = await listAgentSessions()
      if (data.success) {
        setSessions(data.sessions)
      } else {
        setSessionsError(data.error ?? '获取会话列表失败')
      }
    } catch (error: unknown) {
      setSessionsError(error instanceof Error ? error.message : '获取会话列表失败')
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  /** 加载指定会话的消息 */
  const loadSession = useCallback(async (sessionId: string) => {
    if (loadingSessionId) return
    setLoadingSessionId(sessionId)
    try {
      const data = await getAgentSession(sessionId)
      if (data.success) {
        const chatMessages: ChatMessage[] = (data.messages ?? []).map(
          (m: { role: string; content: unknown; createdAt: string }, i: number) => ({
            id: `hist_${sessionId}_${i}`,
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
            timestamp: new Date(m.createdAt),
            sessionId,
          }),
        )
        setMessages(chatMessages)
        setCurrentSessionId(sessionId)
        setDrawerOpen(false)
      } else {
        antMsg.error(data.error ?? '加载会话失败')
      }
    } catch (error: unknown) {
      antMsg.error(error instanceof Error ? error.message : '加载会话失败')
    } finally {
      setLoadingSessionId(null)
    }
  }, [loadingSessionId, antMsg])

  /** 新建对话 */
  const handleNewConversation = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setCurrentSessionId(null)
    setStreamingText('')
    setLoading(false)
    setSessionMode('auto')
    setDrawerOpen(false)
    inputRef.current?.focus()
  }, [])

  /** 删除会话 */
  const handleDeleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const data = await deleteAgentSession(sessionId)
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          setMessages([])
          setCurrentSessionId(null)
        }
        antMsg.success('会话已删除')
      } else {
        antMsg.error(data.error ?? '删除会话失败')
      }
    } catch (error: unknown) {
      antMsg.error(error instanceof Error ? error.message : '删除会话失败')
    }
  }, [currentSessionId, antMsg])

  // 首次加载获取会话列表
  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // 当 currentSessionId 变化时（新建/切换会话），刷新会话列表
  const prevSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (currentSessionId && currentSessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = currentSessionId
      fetchSessions()
    }
    if (!currentSessionId) {
      prevSessionIdRef.current = null
    }
  }, [currentSessionId, fetchSessions])

  /**
   * 发送聊天请求并处理 SSE 流式响应。
   * 独立函数降低 handleSend 的认知复杂度。
   */
  const fetchAndProcessStream = useCallback(async (
    body: string,
    assistantId: string,
    abortController: AbortController,
    onStreamText: (text: string) => void,
  ): Promise<{
    fullText: string
    toolCalls: ToolCallInfo[]
    capturedSessionId: string | null
  }> => {
    const response = await fetch(`${await resolveAgentBaseURL()}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: abortController.signal,
    })

    if (!response.ok) throw new Error(`请求失败: ${response.status}`)

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    let fullText = ''
    const toolCallsList: ToolCallInfo[] = []
    let capturedSessionId: string | null = null

    for await (const event of readSSEStream(reader)) {
      if (event.sessionId) capturedSessionId = event.sessionId

      if (event.type === 'assistant_message') {
        fullText += event.data as string
        onStreamText(fullText)
      } else if (event.type === 'tool_use') {
        const td = event.data as { toolName: string; toolInput: unknown }
        toolCallsList.push({
          name: td.toolName.replace('mcp__github__', ''),
          input: JSON.stringify(td.toolInput, null, 2),
        })
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, toolCalls: [...toolCallsList] } : m)),
        )
      }
    }

    return { fullText, toolCalls: toolCallsList, capturedSessionId }
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

      const { fullText, toolCalls: tCalls, capturedSessionId } = await fetchAndProcessStream(
        body,
        assistantId,
        abortController,
        setStreamingText,
      )

      const finalToolCalls = tCalls.length > 0 ? tCalls : undefined
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: fullText, toolCalls: finalToolCalls, sessionId: capturedSessionId ?? undefined }
            : m,
        ),
      )
      setStreamingText('')

      if (capturedSessionId && !currentSessionId) {
        setCurrentSessionId(capturedSessionId)
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return
      const errorText = error instanceof Error ? error.message : '未知错误'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `> ❌ **请求出错**：${errorText}` }
            : m,
        ),
      )
    } finally {
      setLoading(false)
      setStreamingText('')
      abortRef.current = null
      inputRef.current?.focus()
    }
  }, [input, loading, sessionMode, currentSessionId, fetchAndProcessStream])

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

        <Flex vertical gap={4} align={isUser ? 'end' : 'start'} style={{ maxWidth: '85%', minWidth: 0 }}>
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
  const hasMessages = messages.length > 0

  // 页面布局：DefaultLayout 的 Content 有 padding: 16px 24px
  // 用负 margin 抵消 padding，让布局撑满视口宽度
  // 输入框用 position: fixed 悬浮在视口底部（避开侧边栏和页脚）
  const siderWidth = siderCollapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px - 40px - 40px - 32px)', // header(56) + tabs(40) + footer(40) + content padding(16*2)
        margin: '-16px -24px', // 抵消父 Content 的 padding
        overflow: 'hidden',
        position: 'relative',
        background: token.colorBgContainer,
      }}
    >
      {/* ── HEADER (固定顶部) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
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
                {(() => {
                  if (loading) return '思考中…'
                  if (hasMessages) return `${messages.filter(m => m.role === 'user').length} 条对话`
                  return '在线'
                })()}
              </Text>
            </Flex>
          </div>
        </Flex>

        <Flex gap={8} align="center" wrap="wrap">
          <Tooltip title="对话历史">
            <Button
              icon={<HistoryOutlined />}
              size="small"
              onClick={() => { fetchSessions(); setDrawerOpen(true) }}
              type={drawerOpen ? 'primary' : 'default'}
            />
          </Tooltip>
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

      {/* ── 消息列表（可滚动，底部留空给固定输入框） ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          background: token.colorBgLayout,
          paddingBottom: 80, // 给底部固定输入框留空间
        }}
      >
        {/* Empty state */}
        {!hasMessages && !isStreaming && !loading && (
          <Flex vertical align="center" justify="center" style={{ minHeight: 'calc(100vh - 56px - 40px - 40px - 56px - 80px)', textAlign: 'center', padding: '0 20px' }}>
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

            <Flex wrap="wrap" justify="center" gap={8} style={{ marginTop: 24 }}>
              {SUGGESTIONS.map((s, i) => (
                <Card
                  key={i}
                  hoverable
                  size="small"
                  onClick={() => handleSuggestion(s.text)}
                  style={{ width: 260, borderRadius: 10, cursor: 'pointer' }}
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

        {/* Messages */}
        {hasMessages && (
          <div style={{ maxWidth: '80%', margin: '0 auto', width: '100%', padding: '20px 24px 0' }}>
            {messages.map(renderMessage)}

            {isStreaming && (
              <Flex gap={12} align="start" style={{ marginBottom: 24 }}>
                <AIAvatar />
                <Flex vertical gap={4} style={{ maxWidth: '85%', minWidth: 0 }}>
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
      </div>

      {/* ── INPUT 固定悬浮在视口底部 ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 40, // 页脚高度
          left: siderWidth + 24, // 侧边栏 + Content paddingLeft
          right: 24,  // Content paddingRight
          zIndex: 1000,
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          padding: '12px 16px 16px',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <Flex vertical gap={6} style={{ maxWidth: '80%', margin: '0 auto' }}>
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

      {/* ── 对话历史 Drawer ── */}
      <Drawer
        title={
          <Flex align="center" justify="space-between" style={{ width: '100%', paddingRight: 8 }}>
            <span>对话历史</span>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleNewConversation}
            >
              新对话
            </Button>
          </Flex>
        }
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={340}
        styles={{
          header: { padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` },
          body: { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        }}
      >
        {/* 加载态 */}
        {sessionsLoading && (
          <div style={{ padding: 16 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <Skeleton active title={{ width: '80%' }} paragraph={{ rows: 1, width: '40%' }} />
              </div>
            ))}
          </div>
        )}

        {/* 错误态 */}
        {!sessionsLoading && sessionsError && (
          <Flex vertical align="center" justify="center" style={{ padding: 40, textAlign: 'center' }} gap={12}>
            <Text type="danger" style={{ fontSize: 13 }}>❌ {sessionsError}</Text>
            <Button size="small" onClick={fetchSessions}>重试</Button>
          </Flex>
        )}

        {/* 空态 */}
        {!sessionsLoading && !sessionsError && sessions.length === 0 && (
          <Flex vertical align="center" justify="center" style={{ padding: 60, textAlign: 'center' }}>
            <Empty description="暂无对话历史" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              选择"持久会话"模式开始对话
            </Text>
          </Flex>
        )}

        {/* 会话列表 */}
        {!sessionsLoading && !sessionsError && sessions.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {groupSessionsByDate(sessions).map((group) => (
              <div key={group.label}>
                <div style={{
                  padding: '8px 16px 4px',
                  fontSize: 11,
                  color: token.colorTextTertiary,
                  fontWeight: 500,
                }}>
                  {group.label}
                </div>
                {group.items.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      padding: '10px 16px',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      background: session.id === currentSessionId
                        ? token.colorPrimaryBg
                        : 'transparent',
                      borderLeft: session.id === currentSessionId
                        ? `3px solid ${token.colorPrimary}`
                        : '3px solid transparent',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (session.id !== currentSessionId) {
                        e.currentTarget.style.background = token.colorBgTextHover
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (session.id !== currentSessionId) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        color: token.colorText,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: '20px',
                      }}>
                        {session.firstMessage || '新对话'}
                      </div>
                      <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {formatRelativeTime(session.updatedAt)}
                        </Text>
                        {session.messageCount > 0 && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {session.messageCount} 条消息
                          </Text>
                        )}
                        {loadingSessionId === session.id && (
                          <Spin size="small" />
                        )}
                      </Flex>
                    </div>

                    {/* 删除按钮 */}
                    <Tooltip title="删除会话">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSession(session.id, e)
                        }}
                        style={{
                          flexShrink: 0,
                          opacity: 0,
                          transition: 'opacity 0.15s',
                          marginLeft: 4,
                        }}
                        className="session-delete-btn"
                      />
                    </Tooltip>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* ── 删除按钮悬浮显示样式 ── */}
      <style>{`
        .session-delete-btn {
          opacity: 0 !important;
        }
        [class*="ant-drawer"] [class*="ant-drawer-body"] div:hover > .session-delete-btn {
          opacity: 1 !important;
        }
        @keyframes agent-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
