import { isElectron } from '../utils/electron'

/**
 * 解析 Agent 服务的基础 URL。
 *
 * - Web 端：返回空字符串，使用相对路径 `/api/agent/*`，由 Vite proxy 转发到 :10003
 * - 桌面端：返回 `http://localhost:{agentPort}`，agentPort 由 Electron 主进程动态分配，
 *   通过 desktop.getConfig() 的 IPC 获取
 *
 * 结果会缓存，避免每次请求都走 IPC。
 *
 * @callers api/agent.ts、pages/AgentChat/index.tsx（SSE 流式请求）
 * @depends window.electronAPI.desktop.getConfig() —— 获取 agentPort
 */
let cachedAgentBase: string | null = null

export async function resolveAgentBaseURL(): Promise<string> {
  if (cachedAgentBase !== null) return cachedAgentBase

  if (!isElectron()) {
    cachedAgentBase = ''
    return cachedAgentBase
  }

  try {
    const config = await window.electronAPI!.desktop.getConfig()
    // agentPort 为 0 表示 Agent 未启动，退回相对路径（虽然桌面端无代理，但至少不崩）
    cachedAgentBase = config.agentPort > 0 ? `http://localhost:${config.agentPort}` : ''
  } catch {
    cachedAgentBase = ''
  }
  return cachedAgentBase
}

/** 重置缓存（用于 Agent 端口变化，如重启后重新获取） */
export function resetAgentBaseURL(): void {
  cachedAgentBase = null
}
