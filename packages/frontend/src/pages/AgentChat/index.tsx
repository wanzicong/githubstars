import { useState, useRef, useCallback, useEffect, memo } from 'react'
import axios from 'axios'
import { Input, Button, Typography, Tag, theme, App, Segmented, Badge, Tooltip, Spin, Avatar, Flex, Card, Empty, Skeleton, Grid, Drawer } from 'antd'
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
  PlusOutlined,
  DeleteOutlined,
  StopOutlined,
  DownOutlined,
  RightOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import MarkdownRenderer from '@/components/common/MarkdownRenderer'
import ThinkingBlock from './ThinkingBlock'
import { listAgentSessions, getAgentSession, deleteAgentSession, getAgentBaseURL } from '@/api/agent'
import { getAgentFriendlyErrorMessage } from '@/utils/agent-error'
import { useAgentChatStore } from '@/stores'

const { Text, Paragraph } = Typography

// ── Types ──

interface ToolCallInfo {
  name: string
  input: string
}

/** 结构化消息块（对应 Claude Agent SDK 的 content blocks） */
interface MessageBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result'
  text?: string
  thinking?: string
  toolName?: string
  toolInput?: unknown
  toolId?: string
  toolUseId?: string
  content?: string
  isError?: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  /** AI 思考过程（thinking 块内容） */
  thinking?: string
  toolCalls?: ToolCallInfo[]
  sessionId?: string
  /** 结构化消息块（新格式，从后端加载历史或流式结束后组装时有值） */
  blocks?: MessageBlock[]
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

/** 工具调用结果映射（toolUseId → result） */
type ToolResultMap = Map<string, { content: string; isError?: boolean }>

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

// ── 模块级样式常量（避免每次渲染创建新对象，保证 memo 生效） ──

const MARKDOWN_STYLE: React.CSSProperties = { fontSize: 14, lineHeight: 1.7, wordBreak: 'break-word' }

const AI_AVATAR_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
  color: '#fff',
  flexShrink: 0,
  boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
}

const USER_AVATAR_STYLE: React.CSSProperties = {
  background: '#1677ff',
  color: '#fff',
  flexShrink: 0,
  boxShadow: '0 2px 8px rgba(22,119,255,0.3)',
}

const USER_PARAGRAPH_STYLE: React.CSSProperties = {
  margin: 0,
  color: '#fff',
  fontSize: 14,
  lineHeight: 1.7,
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
}

const MESSAGE_ROW_STYLE: React.CSSProperties = { marginBottom: 24, display: 'flex', width: '100%' }

const MESSAGE_COL_STYLE: React.CSSProperties = { maxWidth: '85%', minWidth: 0, flex: 1 }

const USER_BUBBLE_BASE: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '18px 18px 4px 18px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  maxWidth: '100%',
  overflow: 'hidden',
}

const AI_BUBBLE_BASE: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: '18px 18px 18px 4px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  width: '100%',
  maxWidth: '100%',
  overflow: 'hidden',
}

const SESSION_ID_TAG_STYLE: React.CSSProperties = { fontSize: 10, lineHeight: '16px', padding: '0 6px', margin: 0 }

const TOOL_TAG_STYLE: React.CSSProperties = { fontSize: 11, fontFamily: 'monospace', margin: 0 }

const COPY_BTN_ROW_STYLE: React.CSSProperties = { paddingLeft: 4, marginTop: 2 }

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

// ── 工具调用语义化 ──

/** 去除 MCP 工具名前缀（mcp__github__xxx / mcp__system__xxx → xxx） */
function normalizeToolName(toolName: string): string {
  return toolName.replace(/^mcp__(github|system)__/, '')
}

type ToolInput = Record<string, unknown>
type ToolPhraseFn = (input: ToolInput) => string

/** GitHub MCP 工具 → 一行语义化描述 */
const GITHUB_TOOL_PHRASES: Record<string, ToolPhraseFn> = {
  search_repositories: (i) => `搜索仓库: ${String(i.query ?? '')}`,
  get_file_contents: (i) => {
    const repoPath = `${String(i.owner ?? '')}/${String(i.repo ?? '')}`
    return `查看文件: ${String(i.path ?? repoPath)}`
  },
  list_issues: (i) => `查看 Issues: ${String(i.owner ?? '')}/${String(i.repo ?? '')}`,
  get_issue: (i) => `查看 Issue #${String(i.issue_number ?? '')}`,
  list_pull_requests: (i) => `查看 PRs: ${String(i.owner ?? '')}/${String(i.repo ?? '')}`,
  create_or_update_file: (i) => `创建/更新文件: ${String(i.path ?? '')}`,
}

/** System MCP 工具 → 一行语义化描述 */
const SYSTEM_TOOL_PHRASES: Record<string, ToolPhraseFn> = {
  stars_list: () => '查询星标仓库列表',
  stars_detail: (i) => `查看仓库详情: ${String(i.repoName ?? i.fullName ?? '')}`,
  category_tree: () => '获取分类树',
  category_repos: (i) => `查看分类仓库: ${String(i.categoryName ?? i.categoryId ?? '')}`,
  stats_languages: () => '查询语言统计',
  stats_overview: () => '查询整体概览',
  trending: () => '查询趋势仓库',
  author_list: () => '查询作者列表',
  sync_manual: () => '手动同步',
  clone: (i) => `克隆仓库: ${String(i.repoName ?? '')}`,
  download: (i) => `下载仓库: ${String(i.repoName ?? '')}`,
  export_markdown: () => '导出 Markdown',
}

/** 工具调用 → 语义化描述（展示在工具卡片标题） */
function getToolPhrase(toolName: string, toolInput: unknown): string {
  const name = normalizeToolName(toolName)
  const input = (toolInput ?? {}) as ToolInput
  const phraseFn = GITHUB_TOOL_PHRASES[name] ?? SYSTEM_TOOL_PHRASES[name]
  if (phraseFn) return phraseFn(input)
  if (name === 'Bash') {
    const cmd = String(input.command ?? '')
    return cmd.length > 60 ? `执行: ${cmd.slice(0, 60)}…` : `执行: ${cmd}`
  }
  if (name === 'WebSearch') return `搜索: ${String(input.query ?? '')}`
  return name
}

/** 工具名 → 展示图标 */
function getToolIcon(toolName: string): React.ReactNode {
  const name = normalizeToolName(toolName)
  if (name.startsWith('stars_') || name === 'search_repositories') return <StarOutlined />
  if (name.startsWith('category_')) return <BranchesOutlined />
  if (name.startsWith('stats_')) return <ApiOutlined />
  if (name === 'Bash') return <CodeOutlined />
  if (name === 'WebSearch') return <BugOutlined />
  if (name === 'clone' || name === 'download') return <CopyOutlined />
  return <ApiOutlined />
}

/** 工具结果文本截断（超过 2000 字符折叠尾部） */
function truncateResult(content: string): string {
  return content.length > 2000 ? `${content.slice(0, 2000)}\n…(截断)` : content
}

// ── blocks 组装与解析 ──

/** 将流式累积结果组装为结构化 blocks；tool_result 紧跟其配对的 tool_use（无过程内容时返回 undefined，走旧模式渲染） */
function buildBlocks(
  text: string,
  thinking: string,
  toolBlocks: MessageBlock[],
  toolResults: ToolResultMap,
): MessageBlock[] | undefined {
  if (!thinking && toolBlocks.length === 0) return undefined
  const resultBlocks: MessageBlock[] = []
  if (thinking) resultBlocks.push({ type: 'thinking' as const, thinking })
  for (const tb of toolBlocks) {
    resultBlocks.push(tb)
    if (tb.toolId) {
      const result = toolResults.get(tb.toolId)
      if (result) {
        resultBlocks.push({
          type: 'tool_result' as const,
          toolUseId: tb.toolId,
          content: result.content,
          isError: result.isError,
        })
      }
    }
  }
  if (text) resultBlocks.push({ type: 'text' as const, text })
  return resultBlocks
}

/** 将后端消息 content（Json 列对象 / String 列 JSON 字符串 / 纯文本）解析为 blocks；非结构化返回 null */
function parseContentBlocks(content: unknown): MessageBlock[] | null {
  if (Array.isArray(content)) return content as MessageBlock[]
  if (typeof content !== 'string') return null
  const trimmed = content.trim()
  if (!trimmed.startsWith('[')) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return Array.isArray(parsed) ? (parsed as MessageBlock[]) : null
  } catch {
    return null
  }
}

/** 后端历史消息记录 → 前端 ChatMessage；纯 tool_result 的用户消息返回 null（工具结果回传不作为气泡展示） */
function toChatMessage(
  m: { role: string; content: unknown; createdAt: string },
  id: string,
  sessionId: string,
): ChatMessage | null {
  const role: ChatMessage['role'] = m.role === 'assistant' ? 'assistant' : 'user'
  const blocks = parseContentBlocks(m.content)
  if (!blocks) {
    return {
      id,
      role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
      timestamp: new Date(m.createdAt),
      sessionId,
    }
  }
  const textParts = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '')
  if (role === 'user' && textParts.length === 0) return null
  const thinkingParts = blocks.filter((b) => b.type === 'thinking').map((b) => b.thinking ?? '')
  const toolCalls = blocks
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({ name: normalizeToolName(b.toolName ?? ''), input: JSON.stringify(b.toolInput, null, 2) }))
  return {
    id,
    role,
    content: textParts.join('\n'),
    timestamp: new Date(m.createdAt),
    thinking: thinkingParts.length > 0 ? thinkingParts.join('\n') : undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    sessionId,
    blocks,
  }
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

/** 流式累积状态（跨事件共享） */
interface StreamAccum {
  fullText: string
  fullThinking: string
  toolCallsList: ToolCallInfo[]
  /** 原始 input 的 tool_use 块（用于组装结构化 blocks） */
  toolBlocks: MessageBlock[]
  /** toolUseId → 工具执行结果（SSE tool_result 事件累积） */
  toolResults: ToolResultMap
  capturedSessionId: string | null
}

/** 处理单条 SSE 事件并更新累积状态（模块级函数，避免 fetchAndProcessStream 认知复杂度超标） */
function processStreamEvent(
  event: SSEEvent,
  accum: StreamAccum,
  onStreamText: (text: string) => void,
  onStreamThinking: (thinking: string) => void,
  updateToolCalls: (list: ToolCallInfo[]) => void,
  onToolResult: (toolUseId: string, content: string, isError?: boolean) => void,
): void {
  if (event.sessionId) accum.capturedSessionId = event.sessionId

  if (event.type === 'text_delta') {
    accum.fullText += event.data as string
    onStreamText(accum.fullText)
    return
  }
  if (event.type === 'thinking_delta') {
    accum.fullThinking += event.data as string
    onStreamThinking(accum.fullThinking)
    return
  }
  if (event.type === 'tool_use') {
    const td = event.data as { toolName: string; toolInput: unknown; toolId?: string }
    const name = normalizeToolName(td.toolName)
    accum.toolCallsList.push({ name, input: JSON.stringify(td.toolInput, null, 2) })
    accum.toolBlocks.push({ type: 'tool_use', toolName: name, toolInput: td.toolInput, toolId: td.toolId })
    updateToolCalls([...accum.toolCallsList])
    return
  }
  if (event.type === 'tool_result') {
    const td = event.data as { toolUseId: string; content: string; isError?: boolean }
    accum.toolResults.set(td.toolUseId, { content: td.content, isError: td.isError })
    // 通知流式更新（用于实时更新工具卡片的结果）
    onToolResult(td.toolUseId, td.content, td.isError)
    return
  }
  if (event.type === 'error') {
    throw new Error(typeof event.data === 'string' ? event.data : 'Agent 处理失败')
  }
}

/** 返回更新了指定消息 toolCalls 的新消息列表（供 setMessages 函数式更新使用） */
function withToolCalls(messages: ChatMessage[], messageId: string, list: ToolCallInfo[]): ChatMessage[] {
  return messages.map((m) => (m.id === messageId ? { ...m, toolCalls: list } : m))
}

/** 中止生成后的最终内容：保留已累积内容，仅在末尾追加停止标记；完全没收到内容时显示占位符 */
function buildAbortedContent(fullText: string, fullThinking: string, toolBlocks: MessageBlock[]): string {
  const stopMarker = '> ⏹ *已停止生成*'
  if (fullText) return `${fullText}\n\n${stopMarker}`
  if (fullThinking || toolBlocks.length > 0) return stopMarker
  return '*已停止生成（未收到任何内容）*'
}

// ── Hooks ──

/**
 * 流式文本节流 state —— SSE delta 事件频率极高（每 token 一次），
 * 用 requestAnimationFrame 合并为一帧一次 setState，避免全页面高频重渲染 + Markdown 重复解析。
 * 返回 [展示值, 设置函数, 获取最新值函数]；getLatest 读取 ref，不受帧节流滞后影响。
 */
function useThrottledStreamState(): [string, (val: string) => void, () => string] {
  const [display, setDisplay] = useState('')
  const pendingRef = useRef('')
  const rafRef = useRef<number | null>(null)

  const set = useCallback((val: string) => {
    pendingRef.current = val
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      setDisplay(pendingRef.current)
      rafRef.current = null
    })
  }, [])

  const getLatest = useCallback(() => pendingRef.current, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return [display, set, getLatest]
}

// ── Sub-components ──

function AIAvatar({ size = 36 }: { size?: number }) {  return <Avatar size={size} icon={<RobotOutlined />} style={AI_AVATAR_STYLE} />
}

function UserAvatar({ size = 36 }: { size?: number }) {
  return <Avatar size={size} icon={<UserOutlined />} style={USER_AVATAR_STYLE} />
}

/** 工具调用卡片 —— 语义化标题 + 可展开查看配对结果 */
function ToolUseCard({ toolName, toolInput, toolResult, streaming }: {
  toolName: string
  toolInput: unknown
  toolResult?: { content: string; isError?: boolean }
  streaming?: boolean
}) {
  const { token } = theme.useToken()
  const [expanded, setExpanded] = useState(false)
  const phrase = getToolPhrase(toolName, toolInput)
  const icon = getToolIcon(toolName)
  const hasError = toolResult?.isError === true
  const borderColor = hasError ? token.colorError : token.colorPrimaryBorder
  const iconColor = hasError ? token.colorError : token.colorPrimary

  return (
    <div
      style={{
        borderLeft: `3px solid ${borderColor}`,
        background: token.colorFillQuaternary,
        borderRadius: 6,
        marginBottom: 6,
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        {streaming ? (
          <Spin size="small" style={{ fontSize: 12 }} />
        ) : (
          <span style={{ color: iconColor, fontSize: 12 }}>{icon}</span>
        )}
        <Text style={{ fontSize: 12, flex: 1 }} type={hasError ? 'danger' : undefined}>
          {phrase}
        </Text>
        {toolResult && (
          expanded
            ? <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
            : <RightOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
        )}
      </div>
      {expanded && toolResult && (
        <div
          style={{
            padding: '4px 10px 8px',
            fontSize: 11,
            color: token.colorTextSecondary,
            maxHeight: 300,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
          }}
        >
          {truncateResult(toolResult.content)}
        </div>
      )}
    </div>
  )
}

/** 单个过程块渲染（thinking / tool_use），tool_use 按 toolId 配对结果 */
function ProcessBlockItem({ block, toolResults, streaming }: {
  block: MessageBlock
  toolResults?: ToolResultMap
  streaming?: boolean
}) {
  if (block.type === 'thinking') {
    return <ThinkingBlock content={block.thinking ?? ''} streaming={streaming} />
  }
  if (block.type === 'tool_use') {
    const result = block.toolId ? toolResults?.get(block.toolId) : undefined
    return (
      <ToolUseCard
        toolName={block.toolName ?? ''}
        toolInput={block.toolInput}
        toolResult={result}
        streaming={streaming}
      />
    )
  }
  return null
}

/** 过程组（thinking + tool_use）—— 可折叠；流式中默认展开，结束后自动收起 */
function ProcessGroup({ blocks, streaming, toolResults }: {
  blocks: MessageBlock[]
  streaming?: boolean
  toolResults?: ToolResultMap
}) {
  const { token } = theme.useToken()
  const [expanded, setExpanded] = useState(streaming ?? false)
  const userToggled = useRef(false)

  // 流式结束后 3 秒自动收起（用户手动切换过则不再干预）
  useEffect(() => {
    if (streaming || userToggled.current) return
    const timer = setTimeout(() => setExpanded(false), 3000)
    return () => clearTimeout(timer)
  }, [streaming])

  const thinkingCount = blocks.filter((b) => b.type === 'thinking').length
  const toolCount = blocks.filter((b) => b.type === 'tool_use').length
  if (thinkingCount === 0 && toolCount === 0) return null

  const toolPart = toolCount > 0 ? `${toolCount} 次工具调用` : ''
  const thinkPart = thinkingCount > 0 ? `${thinkingCount} 段思考` : ''
  const summary = [toolPart, thinkPart].filter((p) => p !== '').join(' · ')

  const handleToggle = () => {
    userToggled.current = true
    setExpanded((v) => !v)
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 0', cursor: 'pointer', userSelect: 'none',
        }}
      >
        {expanded
          ? <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
          : <RightOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />}
        <Text type="secondary" style={{ fontSize: 12 }}>
          执行过程：{summary}
        </Text>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 16 }}>
          {blocks.map((block, i) => (
            <ProcessBlockItem key={i} block={block} toolResults={toolResults} streaming={streaming} />
          ))}
        </div>
      )}
    </div>
  )
}

/** blocks 模式气泡内容 —— 过程（thinking/tool_use 折叠组）与交付（text Markdown）分离 */
const BlocksBubbleContent = memo(function BlocksBubbleContent({ blocks }: { blocks: MessageBlock[] }) {
  const toolResults: ToolResultMap = new Map()
  for (const b of blocks) {
    if (b.type === 'tool_result' && b.toolUseId) {
      toolResults.set(b.toolUseId, { content: b.content ?? '', isError: b.isError })
    }
  }
  const processBlocks = blocks.filter((b) => b.type === 'thinking' || b.type === 'tool_use')
  const deliveryBlocks = blocks.filter((b) => b.type === 'text')

  return (
    <>
      <ProcessGroup blocks={processBlocks} toolResults={toolResults} />
      {deliveryBlocks.map((b, i) => (
        <MarkdownRenderer
          key={i}
          content={b.text ?? ''}
          style={MARKDOWN_STYLE}
        />
      ))}
    </>
  )
})

/** 旧模式气泡内容 —— thinking + toolCalls 标签 + content（向后兼容纯文本消息） */
const LegacyBubbleContent = memo(function LegacyBubbleContent({ msg, isUser }: { msg: ChatMessage; isUser: boolean }) {
  return (
    <>
      {!isUser && msg.thinking && <ThinkingBlock content={msg.thinking} />}
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <Flex wrap="wrap" gap={4} style={{ marginBottom: 8 }}>
          {msg.toolCalls.map((tc, i) => (
            <Tag key={i} color="purple" style={TOOL_TAG_STYLE}>
              <ApiOutlined /> {tc.name}
            </Tag>
          ))}
        </Flex>
      )}
      {isUser ? (
        <Paragraph style={USER_PARAGRAPH_STYLE}>
          {msg.content}
        </Paragraph>
      ) : (
        <MarkdownRenderer
          content={msg.content}
          style={MARKDOWN_STYLE}
        />
      )}
    </>
  )
})

/** 流式过程组 —— 将流式 thinking / tool_use 实时组装为 ProcessGroup */
function StreamingProcessGroup({ thinking, toolBlocks, toolResults }: {
  thinking: string
  toolBlocks: MessageBlock[]
  toolResults?: ToolResultMap
}) {
  const blocks: MessageBlock[] = [
    ...(thinking ? [{ type: 'thinking' as const, thinking }] : []),
    ...toolBlocks,
  ]
  if (blocks.length === 0) return null
  return <ProcessGroup blocks={blocks} streaming toolResults={toolResults} />
}

/** 单条消息气泡 —— memo 隔离：流式状态变化时历史消息不重渲染 */
const MessageBubble = memo(function MessageBubble({ msg, copiedId, onCopy }: {
  msg: ChatMessage
  copiedId: string | null
  onCopy: (text: string, id: string) => void
}) {
  const { token } = theme.useToken()
  const isUser = msg.role === 'user'
  const hasBlocks = !isUser && msg.blocks !== undefined && msg.blocks.length > 0
  const bubbleStyle: React.CSSProperties = {
    ...(isUser ? USER_BUBBLE_BASE : AI_BUBBLE_BASE),
    background: isUser ? token.colorPrimary : token.colorBgElevated,
  }

  return (
    <Flex gap={12} justify={isUser ? 'end' : 'start'} align="start" style={MESSAGE_ROW_STYLE}>
      {!isUser && <AIAvatar />}

      <Flex vertical gap={4} align={isUser ? 'end' : 'start'} style={MESSAGE_COL_STYLE}>
        <Flex gap={6} align="center" style={{ paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{isUser ? '你' : 'AI Agent'}</Text>
          {msg.sessionId && (
            <Tag style={SESSION_ID_TAG_STYLE}>
              <ThunderboltOutlined /> {msg.sessionId.slice(0, 8)}…
            </Tag>
          )}
        </Flex>

        <div style={bubbleStyle}>
          {hasBlocks
            ? <BlocksBubbleContent blocks={msg.blocks ?? []} />
            : <LegacyBubbleContent msg={msg} isUser={isUser} />}
        </div>

        {!isUser && msg.content && !/^> ❌/.test(msg.content) && (
          <Flex gap={4} style={COPY_BTN_ROW_STYLE}>
            <Tooltip title="复制">
              <Button
                type="text"
                size="small"
                icon={copiedId === msg.id ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
                onClick={() => onCopy(msg.content, msg.id)}
                style={{ color: token.colorTextTertiary, fontSize: 12 }}
              />
            </Tooltip>
          </Flex>
        )}
      </Flex>

      {isUser && <UserAvatar />}
    </Flex>
  )
})

/** 会话列表主体内容（新对话按钮 + 列表 + 状态），供嵌入式边栏与移动端 Drawer 复用 */
function SessionListContent({
  sessions,
  sessionsLoading,
  sessionsError,
  currentSessionId,
  loadingSessionId,
  onNewConversation,
  onLoadSession,
  onDeleteSession,
  onRetry,
}: {
  sessions: SessionSummary[]
  sessionsLoading: boolean
  sessionsError: string | null
  currentSessionId: string | null
  loadingSessionId: string | null
  onNewConversation: () => void
  onLoadSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void
  onRetry: () => void
}) {
  const { token } = theme.useToken()

  return (
    <>
      {/* 顶部：新对话 */}
      <div style={{ padding: 12, flexShrink: 0 }}>
        <Button type="primary" icon={<PlusOutlined />} block onClick={onNewConversation}>
          新对话
        </Button>
      </div>

      {/* 中部：会话列表（可滚动） */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
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
            <Button size="small" onClick={onRetry}>重试</Button>
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
          groupSessionsByDate(sessions).map((group) => (
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
                  className="session-item"
                  onClick={() => onLoadSession(session.id)}
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

                  {/* 删除按钮（hover 显示） */}
                  <Tooltip title="删除会话">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteSession(session.id, e)
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
          ))
        )}
      </div>
    </>
  )
}

/** 左侧会话边栏（桌面端嵌入式，可折叠为 48px 窄条） */
const SessionSidebar = memo(function SessionSidebar({
  collapsed,
  onToggleCollapsed,
  sessions,
  sessionsLoading,
  sessionsError,
  currentSessionId,
  loadingSessionId,
  onNewConversation,
  onLoadSession,
  onDeleteSession,
  onRetry,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  sessions: SessionSummary[]
  sessionsLoading: boolean
  sessionsError: string | null
  currentSessionId: string | null
  loadingSessionId: string | null
  onNewConversation: () => void
  onLoadSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void
  onRetry: () => void
}) {
  const { token } = theme.useToken()

  return (
    <div
      style={{
        width: collapsed ? 48 : 280,
        flexShrink: 0,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        background: token.colorBgContainer,
        overflow: 'hidden',
        transition: 'width 0.2s ease',
      }}
    >
      {collapsed ? (
        <Flex vertical align="center" justify="center" style={{ flex: 1 }}>
          <Tooltip title="展开会话列表" placement="right">
            <Button type="text" icon={<MenuUnfoldOutlined />} onClick={onToggleCollapsed} />
          </Tooltip>
        </Flex>
      ) : (
        <>
          <SessionListContent
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            sessionsError={sessionsError}
            currentSessionId={currentSessionId}
            loadingSessionId={loadingSessionId}
            onNewConversation={onNewConversation}
            onLoadSession={onLoadSession}
            onDeleteSession={onDeleteSession}
            onRetry={onRetry}
          />

          {/* 底部：折叠按钮 */}
          <div
            style={{
              padding: 8,
              flexShrink: 0,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Tooltip title="折叠会话列表" placement="right">
              <Button type="text" size="small" icon={<MenuFoldOutlined />} onClick={onToggleCollapsed} />
            </Tooltip>
          </div>
        </>
      )}
    </div>
  )
})

/** 移动端会话列表抽屉 —— 从左侧滑出覆盖，选中会话后自动关闭 */
function MobileSessionDrawer({
  open,
  onClose,
  sessions,
  sessionsLoading,
  sessionsError,
  currentSessionId,
  loadingSessionId,
  onNewConversation,
  onLoadSession,
  onDeleteSession,
  onRetry,
}: {
  open: boolean
  onClose: () => void
  sessions: SessionSummary[]
  sessionsLoading: boolean
  sessionsError: string | null
  currentSessionId: string | null
  loadingSessionId: string | null
  onNewConversation: () => void
  onLoadSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void
  onRetry: () => void
}) {
  const { token } = theme.useToken()

  return (
    <Drawer
      placement="left"
      open={open}
      onClose={onClose}
      size={280}
      closable={false}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column' },
        header: { padding: '0 16px', height: 56, borderBottom: `1px solid ${token.colorBorderSecondary}` },
      }}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: token.colorPrimary }}>
          <HistoryOutlined /> 会话历史
        </span>
      }
    >
      <SessionListContent
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        sessionsError={sessionsError}
        currentSessionId={currentSessionId}
        loadingSessionId={loadingSessionId}
        onNewConversation={onNewConversation}
        onLoadSession={onLoadSession}
        onDeleteSession={onDeleteSession}
        onRetry={onRetry}
      />
    </Drawer>
  )
}

// ── Main Component ──

export default function AgentChat() {
  const { token } = theme.useToken()
  const { message: antMsg } = App.useApp()

  // 持久化状态（zustand persist，刷新后恢复会话与草稿）
  const currentSessionId = useAgentChatStore((s) => s.currentSessionId)
  const sessionMode = useAgentChatStore((s) => s.sessionMode)
  const draftInput = useAgentChatStore((s) => s.draftInput)
  const setCurrentSessionId = useAgentChatStore((s) => s.setCurrentSessionId)
  const setSessionMode = useAgentChatStore((s) => s.setSessionMode)
  const setDraftInput = useAgentChatStore((s) => s.setDraftInput)
  const clearAgentChat = useAgentChatStore((s) => s.clear)

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  // 流式文本使用 RAF 节流 state（每帧最多一次 setState），避免高频重渲染
  const [streamingText, setStreamingText, getLatestText] = useThrottledStreamState()
  const [streamingThinking, setStreamingThinking] = useThrottledStreamState()
  const [streamingToolBlocks, setStreamingToolBlocks] = useState<MessageBlock[]>([])
  const [streamingToolResults, setStreamingToolResults] = useState<ToolResultMap>(new Map())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 会话边栏状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null)
  // 移动端会话抽屉开关
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Ant Design 断点：md = ≥768px。screens.md 为 false 即手机端
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<React.ComponentRef<typeof Input.TextArea>>(null)
  const abortRef = useRef<AbortController | null>(null)
  // 会话加载竞态控制：每次加载递增序号 + 独立 AbortController，仅最新请求允许落地
  const loadSeqRef = useRef(0)
  const loadAbortRef = useRef<AbortController | null>(null)
  // 流式过程累积（供中止时保留已收内容；与 SSE 回调共用同一引用，不经过 React state）
  const streamAccumRef = useRef<StreamAccum | null>(null)

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
  }, [messages, streamingText, streamingThinking, streamingToolBlocks, scrollToBottom])

  // 组件卸载时取消进行中的 SSE 流与会话加载请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      loadAbortRef.current?.abort()
    }
  }, [])

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
    setStreamingThinking('')
    setStreamingToolBlocks([])
    setStreamingToolResults(new Map())
    setLoading(false)
  }, [setCurrentSessionId, setStreamingText, setStreamingThinking])

  /** 停止生成（中止当前 SSE 流） */
  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((v) => !v)
  }, [])

  // ── 会话列表管理 ──

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

  /**
   * 加载指定会话的消息（切换前中止进行中的流并清理流式状态，避免旧流污染新会话）。
   * 竞态控制（最新请求胜出）：每次加载递增序号并取消上一次请求，响应落地前比对序号，过期响应/取消静默丢弃。
   */
  const loadSession = useCallback(async (sessionId: string) => {
    abortRef.current?.abort()
    abortRef.current = null
    streamAccumRef.current = null
    setStreamingText('')
    setStreamingThinking('')
    setStreamingToolBlocks([])
    setStreamingToolResults(new Map())
    setLoading(false)

    const seq = ++loadSeqRef.current
    loadAbortRef.current?.abort()
    const controller = new AbortController()
    loadAbortRef.current = controller
    setLoadingSessionId(sessionId)

    try {
      const data = await getAgentSession(sessionId, controller.signal)
      if (seq !== loadSeqRef.current) return // 已有更新的请求，丢弃过期响应
      if (data.success) {
        const rawMessages = (data.messages ?? []) as Array<{ role: string; content: unknown; createdAt: string }>
        const chatMessages = rawMessages
          .map((m, i) => toChatMessage(m, `hist_${sessionId}_${i}`, sessionId))
          .filter((m): m is ChatMessage => m !== null)
        setMessages(chatMessages)
        setCurrentSessionId(sessionId)
      } else {
        antMsg.error(data.error ?? '加载会话失败')
      }
    } catch (error: unknown) {
      const isCanceled = axios.isCancel(error) || (error instanceof Error && error.name === 'AbortError')
      if (isCanceled || seq !== loadSeqRef.current) return // 主动取消或已过期，静默处理
      antMsg.error(error instanceof Error ? error.message : '加载会话失败')
    } finally {
      if (seq === loadSeqRef.current) setLoadingSessionId(null)
    }
  }, [antMsg, setCurrentSessionId, setStreamingText, setStreamingThinking])

  /** 新建对话（保留会话模式偏好与草稿，仅清空当前会话） */
  const handleNewConversation = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    streamAccumRef.current = null
    loadAbortRef.current?.abort()
    loadSeqRef.current += 1
    setMessages([])
    clearAgentChat()
    setStreamingText('')
    setStreamingThinking('')
    setStreamingToolBlocks([])
    setStreamingToolResults(new Map())
    setLoading(false)
    inputRef.current?.focus()
  }, [clearAgentChat, setStreamingText, setStreamingThinking])

  /** 移动端：加载会话后自动关闭抽屉 */
  const handleLoadSessionMobile = useCallback((sessionId: string) => {
    loadSession(sessionId)
    setMobileDrawerOpen(false)
  }, [loadSession])

  /** 移动端：新建对话后自动关闭抽屉 */
  const handleNewConversationMobile = useCallback(() => {
    handleNewConversation()
    setMobileDrawerOpen(false)
  }, [handleNewConversation])

  /** 移动端：打开会话抽屉 */
  const handleOpenMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(true)
  }, [])

  /** 删除会话 */
  const handleDeleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const data = await deleteAgentSession(sessionId)
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          loadSeqRef.current += 1
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
  }, [currentSessionId, antMsg, setCurrentSessionId])

  // 首次加载获取会话列表（延迟到宏任务，避免 effect 体内同步 setState 触发级联渲染）
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSessions()
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }, [fetchSessions])

  // 刷新/重进页面时恢复上次的会话（延迟到宏任务，避免 effect 体内同步 setState 触发级联渲染）
  useEffect(() => {
    if (!currentSessionId || messages.length > 0 || loadingSessionId) return
    const timer = setTimeout(() => {
      void loadSession(currentSessionId)
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }, [currentSessionId, messages.length, loadingSessionId, loadSession])

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
   * 事件协议：thinking_delta（思考增量）/ text_delta（正文逐字增量）/ tool_use / tool_result / error。
   * 用户中止时在内部捕获 AbortError，返回已累积的部分内容。
   */
  const fetchAndProcessStream = useCallback(async (
    body: string,
    assistantId: string,
    abortController: AbortController,
    onStreamText: (text: string) => void,
    onStreamThinking: (thinking: string) => void,
    onToolCall: (block: MessageBlock) => void,
    onToolResult: (toolUseId: string, content: string, isError?: boolean) => void,
  ): Promise<StreamAccum & { aborted: boolean }> => {
    const response = await fetch(`${getAgentBaseURL()}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: abortController.signal,
    })

    if (!response.ok) throw new Error(`请求失败: ${response.status}`)

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const accum: StreamAccum = {
      fullText: '',
      fullThinking: '',
      toolCallsList: [],
      toolBlocks: [],
      toolResults: new Map(),
      capturedSessionId: null,
    }
    streamAccumRef.current = accum
    let aborted = false

    try {
      for await (const event of readSSEStream(reader)) {
        processStreamEvent(event, accum, onStreamText, onStreamThinking, (list) =>
          setMessages((prev) => withToolCalls(prev, assistantId, list)),
          onToolResult,
        )
        // tool_use 事件同步通知流式回调（用于流式过程组实时展示）
        if (event.type === 'tool_use') {
          const latest = accum.toolBlocks[accum.toolBlocks.length - 1]
          if (latest) onToolCall(latest)
        }
      }
    } catch (e: unknown) {
      if (!(e instanceof Error && e.name === 'AbortError')) throw e
      aborted = true
    } finally {
      try {
        await reader.cancel()
      } catch {
        /* 流已关闭时忽略 */
      }
    }

    return { ...accum, aborted }
  }, [])

  const handleSend = useCallback(async () => {
    const text = draftInput.trim()
    if (!text || loading) return

    setDraftInput('')
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
    setStreamingThinking('')
    setStreamingToolBlocks([])
    setStreamingToolResults(new Map())
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

      const {
        fullText,
        fullThinking,
        toolCallsList: tCalls,
        toolBlocks: tBlocks,
        toolResults: tResults,
        capturedSessionId,
        aborted,
      } = await fetchAndProcessStream(
        body,
        assistantId,
        abortController,
        setStreamingText,
        setStreamingThinking,
        (block) => setStreamingToolBlocks((prev) => [...prev, block]),
        (toolUseId, content, isError) => setStreamingToolResults((prev) => {
          const next: ToolResultMap = new Map(prev)
          next.set(toolUseId, { content, isError })
          return next
        }),
      )

      const finalToolCalls = tCalls.length > 0 ? tCalls : undefined
      // 中止时保留已累积内容，仅在末尾追加停止标记；完全没收到内容时显示占位符
      const finalContent = aborted ? buildAbortedContent(fullText, fullThinking, tBlocks) : fullText
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: finalContent,
                thinking: fullThinking || undefined,
                toolCalls: finalToolCalls,
                sessionId: capturedSessionId ?? undefined,
                blocks: buildBlocks(finalContent, fullThinking, tBlocks, tResults),
              }
            : m,
        ),
      )
      setStreamingText('')
      setStreamingThinking('')
      setStreamingToolBlocks([])
      setStreamingToolResults(new Map())

      if (capturedSessionId && !currentSessionId) {
        setCurrentSessionId(capturedSessionId)
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return
      const errorText = getAgentFriendlyErrorMessage(error)
      // 保留已流式累积的部分内容，错误信息追加其后（getLatest 读 ref，不受节流滞后影响）
      const partialContent = getLatestText()
      const errorBlock = `> ❌ **请求失败**\n>\n> ${errorText}`
      const finalContent = partialContent ? `${partialContent}\n\n${errorBlock}` : errorBlock
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: finalContent }
            : m,
        ),
      )
    } finally {
      setLoading(false)
      setStreamingText('')
      setStreamingThinking('')
      setStreamingToolBlocks([])
      setStreamingToolResults(new Map())
      streamAccumRef.current = null
      abortRef.current = null
      inputRef.current?.focus()
    }
  }, [draftInput, loading, sessionMode, currentSessionId, fetchAndProcessStream, setDraftInput, setCurrentSessionId, setStreamingText, setStreamingThinking, getLatestText])

  const handleModeChange = useCallback((value: SessionMode) => {
    setSessionMode(value)
    if (value === 'none') setCurrentSessionId(null)
  }, [setSessionMode, setCurrentSessionId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 中文输入法选词期间的 Enter 不触发发送
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleSuggestion = useCallback((text: string) => {
    setDraftInput(text)
    inputRef.current?.focus()
  }, [setDraftInput])

  // ── Render ──

  const isStreaming = loading && (streamingText.length > 0 || streamingThinking.length > 0 || streamingToolBlocks.length > 0)
  const hasMessages = messages.length > 0

  // 响应式容器尺寸：与 Layout Content padding 对齐（移动端 12px，桌面端 16px/24px）
  const containerMargin = isMobile ? '-12px -12px' : '-16px -24px'
  const contentPaddingY = isMobile ? 24 : 32
  const containerHeight = `calc(100vh - 56px - 40px - 40px - ${contentPaddingY}px)` // header(56) + tabs(40) + footer(40) + content padding

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: containerHeight,
        margin: containerMargin, // 抵消父 Content 的 padding
        overflow: 'hidden',
        position: 'relative',
        background: token.colorBgContainer,
      }}
    >
      {/* ── 左侧会话边栏（桌面端嵌入式，移动端隐藏改用抽屉） ── */}
      {!isMobile && (
        <SessionSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={handleToggleSidebar}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          sessionsError={sessionsError}
          currentSessionId={currentSessionId}
          loadingSessionId={loadingSessionId}
          onNewConversation={handleNewConversation}
          onLoadSession={loadSession}
          onDeleteSession={handleDeleteSession}
          onRetry={fetchSessions}
        />
      )}

      {/* ── 移动端会话抽屉 ── */}
      {isMobile && (
        <MobileSessionDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          sessionsError={sessionsError}
          currentSessionId={currentSessionId}
          loadingSessionId={loadingSessionId}
          onNewConversation={handleNewConversationMobile}
          onLoadSession={handleLoadSessionMobile}
          onDeleteSession={handleDeleteSession}
          onRetry={fetchSessions}
        />
      )}

      {/* ── 右侧聊天区 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
            {isMobile && (
              <Tooltip title="会话历史">
                <Button type="text" icon={<HistoryOutlined />} onClick={handleOpenMobileDrawer} />
              </Tooltip>
            )}
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

        {/* ── 消息列表（可滚动） ── */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            background: token.colorBgLayout,
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

              <Flex wrap="wrap" justify="center" gap={8} style={{ marginTop: 24, width: '100%', maxWidth: 560 }}>
                {SUGGESTIONS.map((s, i) => (
                  <Card
                    key={i}
                    hoverable
                    size="small"
                    onClick={() => handleSuggestion(s.text)}
                    style={{ width: isMobile ? '100%' : 260, borderRadius: 10, cursor: 'pointer' }}
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

          {/* Messages（过滤掉流式期间的空占位气泡，流式气泡单独渲染） */}
          {hasMessages && (
            <div style={{ maxWidth: isMobile ? '100%' : '80%', margin: '0 auto', width: '100%', padding: isMobile ? '16px 12px 0' : '20px 24px 0' }}>
              {messages
                .filter((m) => !(m.role === 'assistant' && m.content === '' && !m.blocks))
                .map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} copiedId={copiedId} onCopy={handleCopy} />
                ))}

              {isStreaming && (
                <Flex gap={12} align="start" style={{ marginBottom: 24, display: 'flex', width: '100%' }}>
                  <AIAvatar />
                  <Flex vertical gap={4} style={{ maxWidth: '85%', minWidth: 0, flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12, paddingLeft: 4 }}>AI Agent</Text>
                    <div style={{ padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: token.colorBgElevated, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: '100%' }}>
                      <StreamingProcessGroup thinking={streamingThinking} toolBlocks={streamingToolBlocks} toolResults={streamingToolResults} />
                      {streamingText && (
                        <MarkdownRenderer content={streamingText} style={MARKDOWN_STYLE} />
                      )}
                      <span style={{ display: 'inline-block', width: 2, height: 16, background: token.colorPrimary, marginLeft: 2, verticalAlign: 'middle', animation: 'agent-blink 1s step-end infinite' }} />
                    </div>
                  </Flex>
                </Flex>
              )}

              {loading && !isStreaming && (
                <Flex gap={12} align="center" style={{ marginBottom: 24, marginLeft: 48 }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ fontSize: 13 }}>AI 正在分析…</Text>
                </Flex>
              )}
            </div>
          )}
        </div>

        {/* ── INPUT（文档流内 flex 布局，不再 fixed 悬浮） ── */}
        <div
          style={{
            flexShrink: 0,
            background: token.colorBgContainer,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            padding: isMobile ? '10px 12px 12px' : '12px 16px 16px',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <Flex vertical gap={6} style={{ maxWidth: isMobile ? '100%' : '80%', margin: '0 auto', width: '100%' }}>
            <Flex gap={8}>
              <Input.TextArea
                ref={inputRef as React.Ref<React.ComponentRef<typeof Input.TextArea>>}
                value={draftInput}
                onChange={(e) => setDraftInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你想查询的 GitHub 仓库或问题…"
                autoSize={{ minRows: 1, maxRows: 4 }}
                variant="filled"
                style={{ borderRadius: 10, fontSize: 14 }}
              />
              {loading ? (
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={handleStop}
                  style={{ height: 'auto', borderRadius: 10, paddingInline: 20, minWidth: 76 }}
                >
                  停止
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  disabled={!draftInput.trim()}
                  style={{ height: 'auto', borderRadius: 10, paddingInline: 20, minWidth: 76 }}
                >
                  发送
                </Button>
              )}
            </Flex>
            <Text type="secondary" style={{ fontSize: 11, textAlign: 'center' }}>
              Enter 发送 · Shift+Enter 换行 · 基于 Claude Agent SDK + GitHub MCP
            </Text>
          </Flex>
        </div>
      </div>

      {/* ── 会话删除按钮悬浮显示样式 + 流式光标闪烁动画 ── */}
      <style>{`
        .session-delete-btn {
          opacity: 0 !important;
        }
        .session-item:hover .session-delete-btn {
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
