import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/** 会话列表项（content 兼容 MySQL Json / SQLite String 两种列类型） */
export interface AgentSessionSummary {
    id: string;
    type: string;
    status: string;
    messageCount: number;
    firstMessage: string | null;
    lastMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
}

/** 结构化消息块 —— assistant 回复持久化为 blocks 数组，完整保留 thinking/tool_use/tool_result */
export interface MessageBlock {
    type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
    text?: string;
    thinking?: string;
    toolName?: string;
    toolInput?: unknown;
    toolId?: string;
    toolUseId?: string;
    content?: string;
    isError?: boolean;
}

/**
 * Agent 会话服务 —— 使用全局 PrismaService 持久化 Agent 会话。
 *
 * 替代原 github-agent SessionManager：
 * - 不再独立 new PrismaClient()，复用全局连接（PrismaModule 已 @Global）
 * - 过期会话清理由 @Interval 托管（NestJS 生命周期自动清理定时器）
 * - 凭据读取迁移至 AgentCredentialService（原 getConfigValue 删除）
 */
@Injectable()
export class AgentSessionService {
    private readonly logger = new Logger(AgentSessionService.name);

    constructor(private readonly prisma: PrismaService) {}

    /** 创建新会话，返回会话 ID */
    async createSession(type: string, sdkSessionId?: string): Promise<string> {
        const session = await this.prisma.agentSession.create({
            data: { type, sdkSessionId: sdkSessionId ?? null, status: 'active' },
        });
        return session.id;
    }

    /** 更新 SDK 会话 ID（收到 init 消息后调用，用于 resume） */
    async updateSdkSessionId(sessionId: string, sdkSessionId: string): Promise<void> {
        await this.prisma.agentSession.update({ where: { id: sessionId }, data: { sdkSessionId } });
    }

    /** 获取有效（active）会话；不存在或已关闭返回 null */
    async getSession(sessionId: string) {
        const session = await this.prisma.agentSession.findUnique({ where: { id: sessionId } });
        if (!session || session.status !== 'active') return null;
        return session;
    }

    /**
     * 保存一条消息。
     * content 为字符串时原样存储（向后兼容）；为 MessageBlock[] 时 JSON 序列化后存储。
     * MySQL Json 列与 SQLite String 列均可直接写入字符串，
     * 无需 isSqlite() 分支（Prisma.InputJsonValue 接受 string）。
     */
    async saveMessage(sessionId: string, role: string, content: string | MessageBlock[]): Promise<void> {
        const data = typeof content === 'string' ? content : JSON.stringify(content);
        await this.prisma.agentMessage.create({ data: { sessionId, role, content: data } });
    }

    /** 获取会话消息历史（取最新 N 条，按时间正序返回）；content 尝试解析为结构化 blocks，失败保持原文 */
    async getMessages(sessionId: string, limit = 50) {
        const messages = await this.prisma.agentMessage.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: { role: true, content: true, createdAt: true },
        });
        // desc 取最新 N 条后反转为正序，保证长会话展示最新消息而非最旧消息
        return messages.reverse().map((m) => ({ ...m, content: this.tryParseJson(m.content) }));
    }

    /** 关闭会话 */
    async closeSession(sessionId: string): Promise<void> {
        await this.prisma.agentSession.update({ where: { id: sessionId }, data: { status: 'closed' } });
    }

    /** 活跃会话列表（按更新时间倒序，含首条/末条用户消息预览） */
    async listSessions(limit = 50, offset = 0): Promise<AgentSessionSummary[]> {
        const sessions = await this.prisma.agentSession.findMany({
            where: { status: 'active' },
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                _count: { select: { messages: true } },
                messages: { orderBy: { createdAt: 'asc' }, take: 1, where: { role: 'user' }, select: { content: true } },
            },
        });
        const lastMessages = await Promise.all(
            sessions.map((s) =>
                this.prisma.agentMessage.findFirst({
                    where: { sessionId: s.id, role: 'user' },
                    orderBy: { createdAt: 'desc' },
                    select: { content: true },
                }),
            ),
        );
        return sessions.map((s, index) => ({
            id: s.id,
            type: s.type,
            status: s.status,
            messageCount: s._count.messages,
            firstMessage: this.extractText(s.messages[0]?.content),
            lastMessage: this.extractText(lastMessages[index]?.content),
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
        }));
    }

    /** 每小时清理超过 24 小时的已关闭会话及其消息（@Interval 由 NestJS 托管生命周期） */
    @Interval(60 * 60 * 1000)
    async cleanupExpiredSessions(): Promise<void> {
        try {
            const expiryDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const expired = await this.prisma.agentSession.findMany({
                where: { status: 'closed', updatedAt: { lt: expiryDate } },
                select: { id: true },
            });
            for (const session of expired) {
                await this.prisma.agentMessage.deleteMany({ where: { sessionId: session.id } });
                await this.prisma.agentSession.delete({ where: { id: session.id } });
            }
            if (expired.length > 0) this.logger.log(`已清理 ${expired.length} 个过期会话`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(`清理过期会话失败: ${msg}`);
        }
    }

    /** 提取消息文本：MySQL Json 列读出对象/字符串，SQLite String 列读出字符串 */
    private extractText(raw: unknown): string | null {
        if (raw === null || raw === undefined) return null;
        return typeof raw === 'string' ? raw : JSON.stringify(raw);
    }

    /** 尝试将字符串解析为 JSON（结构化 blocks）；非字符串或解析失败时返回原值 */
    private tryParseJson(raw: unknown): unknown {
        if (typeof raw !== 'string') return raw;
        try {
            return JSON.parse(raw) as unknown;
        } catch {
            return raw;
        }
    }
}
