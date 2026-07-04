import api from './request'

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

/** 查询（JSON 响应，非流式） */
export async function agentQuery(data: AgentRequest): Promise<AgentQueryResponse> {
  const res = await api.post('/api/agent/query', data)
  return res.data
}

/** 获取会话历史 */
export async function getAgentSession(sessionId: string) {
  const res = await api.get(`/api/agent/sessions/${sessionId}`)
  return res.data
}

/** 删除会话 */
export async function deleteAgentSession(sessionId: string) {
  const res = await api.delete(`/api/agent/sessions/${sessionId}`)
  return res.data
}
