import { z } from 'zod';

/** 会话模式：none 一次性 / auto 新建并持久化 / resume 恢复已有会话 */
const sessionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('none') }),
    z.object({ type: z.literal('auto') }),
    z.object({ type: z.literal('resume'), id: z.string().min(1, 'session id 不能为空') }),
]);

/** POST /api/agent/chat 与 /api/agent/query 的请求体验证 schema */
export const AgentRequestSchema = z.object({
    message: z.string().min(1, '消息不能为空'),
    session: sessionSchema,
    maxTurns: z.number().int().min(1).max(500).optional(),
    model: z.string().optional(),
});

export type AgentRequestDto = z.infer<typeof AgentRequestSchema>;
export type SessionModeDto = AgentRequestDto['session'];
