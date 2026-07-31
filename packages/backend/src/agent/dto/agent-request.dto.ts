import { z } from 'zod';

/** 会话模式：none 一次性 / auto 新建并持久化 / resume 恢复已有会话 */
const sessionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('none') }),
    z.object({ type: z.literal('auto') }),
    z.object({ type: z.literal('resume'), id: z.string().min(1, 'session id 不能为空') }),
]);

/** 对话上下文：选中的仓库/分类，作为元信息注入 system prompt 帮助 Agent 聚焦回答 */
const contextSchema = z.object({
    /** 选中的仓库 ID 列表（github_repo.id） */
    repoIds: z.array(z.number().int().positive()).max(20, '仓库上下文最多 20 个').optional(),
    /** 选中的分类 ID 列表（category.id） */
    categoryIds: z.array(z.number().int().positive()).max(10, '分类上下文最多 10 个').optional(),
});

/** POST /api/agent/chat 与 /api/agent/query 的请求体验证 schema */
export const AgentRequestSchema = z.object({
    message: z.string().min(1, '消息不能为空'),
    session: sessionSchema,
    maxTurns: z.number().int().min(1).max(500).optional(),
    model: z.string().optional(),
    context: contextSchema.optional(),
});

export type AgentRequestDto = z.infer<typeof AgentRequestSchema>;
export type SessionModeDto = AgentRequestDto['session'];
export type AgentContextDto = NonNullable<AgentRequestDto['context']>;
