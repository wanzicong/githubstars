import axios from 'axios'
import { resolveAgentBaseURL } from './agentBase'

export interface AgentRequest {
  message: string
  session:
    | { type: 'none' }
    | { type: 'auto' }
    | { type: 'resume'; id: string }
  maxTurns?: number
  model?: string
}

export interface AgentQueryResponse {
  success: boolean
  result?: string
  sessionId?: string
  cost?: number
  duration?: number
  error?: string
}

/**
 * Agent 专用 axios 实例。
 *
 * baseURL 与后端不同：Web 端走相对路径由 Vite proxy 转发到 :10003，
 * 桌面端指向 Agent 动态端口。每次请求前通过 resolveAgentBaseURL() 解析。
 */
const agentApi = axios.create({ timeout: 300000 })

/** 解析并应用 Agent baseURL */
async function withAgentBase(): Promise<void> {
  agentApi.defaults.baseURL = await resolveAgentBaseURL()
}

/** 查询（JSON 响应，非流式） */
export async function agentQuery(data: AgentRequest): Promise<AgentQueryResponse> {
  await withAgentBase()
  const res = await agentApi.post('/api/agent/query', data)
  return res.data
}

/** 获取会话列表 */
export async function listAgentSessions(limit?: number, offset?: number) {
  await withAgentBase()
  const params = new URLSearchParams()
  if (limit !== undefined) params.set('limit', String(limit))
  if (offset !== undefined) params.set('offset', String(offset))
  const query = params.toString()
  const res = await agentApi.get(`/api/agent/sessions${query ? `?${query}` : ''}`)
  return res.data
}

/** 获取会话历史 */
export async function getAgentSession(sessionId: string) {
  await withAgentBase()
  const res = await agentApi.get(`/api/agent/sessions/${sessionId}`)
  return res.data
}

/** 删除会话 */
export async function deleteAgentSession(sessionId: string) {
  await withAgentBase()
  const res = await agentApi.delete(`/api/agent/sessions/${sessionId}`)
  return res.data
}
