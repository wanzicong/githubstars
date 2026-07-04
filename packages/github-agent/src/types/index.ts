// ── 会话模式 ──

/** 会话类型 */
export type SessionType = "none" | "auto" | "resume";

/** 会话模式请求参数 */
export interface SessionModeNone {
  type: "none";
}

export interface SessionModeAuto {
  type: "auto";
}

export interface SessionModeResume {
  type: "resume";
  id: string;
}

export type SessionMode = SessionModeNone | SessionModeAuto | SessionModeResume;

// ── API 请求/响应 ──

/** Agent 请求体 */
export interface AgentRequest {
  message: string;
  session: SessionMode;
  maxTurns?: number;
  model?: string;
}

/** SSE 事件类型 */
export type SSEEventType =
  | "connected"
  | "assistant_message"
  | "tool_use"
  | "tool_result"
  | "result"
  | "error";

/** SSE 事件数据 */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  sessionId?: string;
  timestamp: string;
}

/** 查询响应（非流式） */
export interface AgentQueryResponse {
  success: boolean;
  result?: string;
  sessionId?: string;
  cost?: number;
  duration?: number;
  error?: string;
}

// ── 会话持久化 ──

/** 数据库会话记录 */
export interface SessionRecord {
  id: string;
  type: SessionType;
  sdkSessionId: string | null;
  status: "active" | "closed";
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 数据库消息记录 */
export interface MessageRecord {
  id: number;
  sessionId: string;
  role: string;
  content: unknown;
  createdAt: Date;
}

// ── Agent 配置 ──

export interface AgentConfig {
  port: number;
  model: string;
  maxTurns: number;
  allowedTools: string[];
  githubToken: string;
}

// ── SDK 消息处理 ──

/** 处理后的消息块 */
export interface AssistantMessageBlock {
  type: "text" | "tool_use";
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolId?: string;
}

// ── 工具助手 ──

export interface GitHubMCPConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}
