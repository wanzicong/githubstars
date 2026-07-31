import { agentApi } from './request'

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
 * 获取 Agent API 的基础 URL（去掉尾部斜杠，避免 Web 端 baseURL '/' 拼出 //api 双斜杠）。
 * 用于原生 fetch 的 SSE 流式请求，axios 实例已内置 baseURL 无需调用。
 */
export function getAgentBaseURL(): string {
  const base = agentApi.defaults.baseURL ?? ''
  return base.replace(/\/$/, '')
}

/** 查询（JSON 响应，非流式） */
export async function agentQuery(data: AgentRequest): Promise<AgentQueryResponse> {
  const res = await agentApi.post('/api/agent/query', data)
  return res.data
}

/** 获取会话列表 */
export async function listAgentSessions(limit?: number, offset?: number) {
  const params = new URLSearchParams()
  if (limit !== undefined) params.set('limit', String(limit))
  if (offset !== undefined) params.set('offset', String(offset))
  const query = params.toString()
  const suffix = query ? `?${query}` : ''
  const res = await agentApi.get(`/api/agent/sessions${suffix}`)
  return res.data
}

/** 获取会话历史（signal 用于取消过期请求，避免快速切换会话时的竞态） */
export async function getAgentSession(sessionId: string, signal?: AbortSignal) {
  const res = await agentApi.get(`/api/agent/sessions/${sessionId}`, { signal })
  return res.data
}

/** 删除会话 */
export async function deleteAgentSession(sessionId: string) {
  const res = await agentApi.delete(`/api/agent/sessions/${sessionId}`)
  return res.data
}
