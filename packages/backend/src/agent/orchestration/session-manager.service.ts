import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 会话状态管理器。
 *
 * 管理 Agent 会话的消息持久化、上下文窗口和对话恢复。
 * 使用 Prisma 持久化消息历史，支持分页查询和 token 统计。
 *
 * @callers
 *   - AgentController.chatStream() — 保存用户消息
 *   - AgentExecutorService — 保存 Agent 回复
 *   - AgentController.getSession() — 查询会话详情
 */
@Injectable()
export class SessionManagerService {
    private readonly logger = new Logger(SessionManagerService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 追加用户消息到会话。
     */
    async appendUserMessage(sessionId: number, content: string): Promise<void> {
        await this.prisma.agentMessage.create({
            data: {
                sessionId: BigInt(sessionId),
                role: 'user',
                content,
                createdAt: new Date(),
            },
        });
        await this.prisma.agentSession.update({
            where: { id: BigInt(sessionId) },
            data: { messageCount: { increment: 1 } },
        });
    }

    /**
     * 追加助手回复到会话。
     */
    async appendAssistantMessage(sessionId: number, content: string, tokenCount?: number): Promise<void> {
        await this.prisma.agentMessage.create({
            data: {
                sessionId: BigInt(sessionId),
                role: 'assistant',
                content,
                tokenCount: tokenCount ?? null,
                createdAt: new Date(),
            },
        });
        await this.prisma.agentSession.update({
            where: { id: BigInt(sessionId) },
            data: {
                messageCount: { increment: 1 },
                tokenUsed: tokenCount ? { increment: tokenCount } : undefined,
            },
        });
    }

    /**
     * 追加工具调用消息到会话。
     */
    async appendToolMessage(
        sessionId: number,
        toolCallId: string,
        toolName: string,
        result: string,
    ): Promise<void> {
        await this.prisma.agentMessage.create({
            data: {
                sessionId: BigInt(sessionId),
                role: 'tool',
                content: result,
                toolCallId,
                metadata: { toolName },
                createdAt: new Date(),
            },
        });
    }

    /**
     * 获取会话的消息历史（分页）。
     *
     * @param sessionId — 会话 ID
     * @param limit — 最多返回条数
     * @param beforeId — 游标：获取此 ID 之前的消息（用于加载更早的历史）
     */
    async getMessages(sessionId: number, limit = 50, beforeId?: number) {
        const where: Record<string, unknown> = { sessionId: BigInt(sessionId) };
        if (beforeId) {
            where.id = { lt: BigInt(beforeId) };
        }

        const messages = await this.prisma.agentMessage.findMany({
            where: where as any,
            orderBy: { createdAt: 'asc' },
            take: limit,
            select: {
                id: true,
                role: true,
                content: true,
                toolCallId: true,
                tokenCount: true,
                createdAt: true,
            },
        });

        return messages.map(m => ({
            id: Number(m.id),
            role: m.role,
            content: m.content,
            toolCallId: m.toolCallId,
            tokenCount: m.tokenCount,
            createdAt: m.createdAt,
        }));
    }

    /**
     * 获取会话上下文（最近 N 条消息）。
     * 用于构建 Anthropic Messages API 的 messages 数组。
     */
    async getContextMessages(sessionId: number, limit = 20) {
        const messages = await this.prisma.agentMessage.findMany({
            where: { sessionId: BigInt(sessionId) },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: { role: true, content: true },
        });

        return messages.reverse().map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        }));
    }

    /**
     * 更新会话标题。
     * 使用首条用户消息的前 50 字符作为标题。
     */
    async updateTitle(sessionId: number, title: string): Promise<void> {
        await this.prisma.agentSession.update({
            where: { id: BigInt(sessionId) },
            data: { title: title.substring(0, 255) },
        });
    }

    /**
     * 获取会话的 token 用量统计。
     */
    async getTokenUsage(sessionId: number): Promise<{ totalTokens: number; messageCount: number }> {
        const session = await this.prisma.agentSession.findUnique({
            where: { id: BigInt(sessionId) },
            select: { tokenUsed: true, messageCount: true },
        });
        return {
            totalTokens: session?.tokenUsed ?? 0,
            messageCount: session?.messageCount ?? 0,
        };
    }

    /**
     * 更新会话的 token 用量。
     */
    async addTokenUsage(sessionId: number, tokens: number): Promise<void> {
        await this.prisma.agentSession.update({
            where: { id: BigInt(sessionId) },
            data: { tokenUsed: { increment: tokens } },
        });
    }
}
