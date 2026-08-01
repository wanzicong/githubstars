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
     * 保存一条消息，同时 touch 会话 updatedAt 保证列表排序正确。
     *
     * 使用事务保证消息写入和会话更新原子性，避免并发下
     * "消息已写入但 updatedAt 未更新"或反过来的不一致状态。
     */
    async saveMessage(sessionId: string, role: string, content: string | MessageBlock[]): Promise<void> {
        const data = typeof content === 'string' ? content : JSON.stringify(content);
        await this.prisma.$transaction([
            this.prisma.agentMessage.create({ data: { sessionId, role, content: data } }),
            this.prisma.agentSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } }),
        ]);
    }

    /** 获取会话消息历史（取最新 N 条，按时间正序返回）；content 尝试解析为结构化 blocks，失败保持原文 */
    async getMessages(sessionId: string, limit = 50) {
        // 按 id 降序（自增 id 越大越新，走主键索引）而非 createdAt 降序：
        // 避免 MySQL 对含巨型 JSON content 的行做 filesort 触发 1038 Out of sort memory。
        const messages = await this.prisma.agentMessage.findMany({
            where: { sessionId },
            orderBy: { id: 'desc' },
            take: limit,
            select: { role: true, content: true, createdAt: true },
        });
        // desc 取最新 N 条后反转为正序，保证长会话展示最新消息而非最旧消息
        const reversed = [...messages].reverse();
        return reversed.map((m) => ({ ...m, content: this.tryParseJson(m.content) }));
    }

    /** 历史摘要源最大字符数（防止超长历史本身又把摘要模型喂爆） */
    private static readonly HISTORY_SOURCE_MAX = 8000;

    /**
     * 加载会话历史为「生成摘要用」的纯文本：只保留 user/assistant 的文本，
     * 忽略 thinking/tool 块，整体截断到安全上限。供 token 超限重开会话时生成摘要。
     */
    async loadHistorySource(sessionId: string, limit = 40): Promise<string | undefined> {
        const messages = await this.prisma.agentMessage.findMany({
            where: { sessionId },
            orderBy: { id: 'desc' },
            take: limit,
            select: { role: true, content: true },
        });
        if (messages.length === 0) return undefined;

        const lines: string[] = [];
        for (const m of [...messages].reverse()) {
            const text = this.extractPreviewText(m.content);
            if (!text) continue;
            const roleLabel = m.role === 'user' ? '用户' : '助手';
            lines.push(`${roleLabel}: ${text}`);
        }
        if (lines.length === 0) return undefined;

        const joined = lines.join('\n');
        if (joined.length <= AgentSessionService.HISTORY_SOURCE_MAX) return joined;
        return `${joined.slice(0, AgentSessionService.HISTORY_SOURCE_MAX)}…`;
    }

    /** 关闭会话；不存在时静默返回（幂等删除语义） */
    async closeSession(sessionId: string): Promise<void> {
        await this.prisma.agentSession.updateMany({ where: { id: sessionId }, data: { status: 'closed' } });
    }

    /** 判断会话是否存在（含已关闭） */
    async sessionExists(sessionId: string): Promise<boolean> {
        const count = await this.prisma.agentSession.count({ where: { id: sessionId } });
        return count > 0;
    }

    /** 活跃会话列表（按更新时间倒序，含首条/末条用户消息预览，一次查询解决 N+1） */
    async listSessions(limit = 50, offset = 0): Promise<AgentSessionSummary[]> {
        const sessions = await this.prisma.agentSession.findMany({
            where: { status: 'active' },
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                _count: { select: { messages: true } },
                messages: {
                    orderBy: { id: 'asc' },
                    take: 1,
                    where: { role: 'user' },
                    select: { content: true },
                },
            },
        });

        const sessionIds = sessions.map((s) => s.id);
        const lastMessageMap = await this.fetchLastMessagePreviews(sessionIds);

        return sessions.map((s) => ({
            id: s.id,
            type: s.type,
            status: s.status,
            messageCount: s._count.messages,
            firstMessage: this.extractText(s.messages[0]?.content),
            lastMessage: lastMessageMap.get(s.id) ?? null,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
        }));
    }

    /**
     * 批量取每个会话最新一条消息的预览文本（sessionId → 预览）。
     * 取任意角色的最后一条（含 assistant），assistant 回复标注 "AI: " 前缀以便区分。
     *
     * 两阶段查询，避免对巨型 JSON content 做 filesort（MySQL 1038 Out of sort memory）：
     * 阶段一只查小列按 id 降序取各会话最新消息 id（id 走主键索引，无大字段参与排序）；
     * 阶段二按消息 id 精确查回 content（条数 = 会话数，无大排序）。
     */
    private async fetchLastMessagePreviews(sessionIds: string[]): Promise<Map<string, string>> {
        const lastMessageMap = new Map<string, string>();
        if (sessionIds.length === 0) return lastMessageMap;

        const cursor = await this.prisma.agentMessage.findMany({
            where: { sessionId: { in: sessionIds } },
            orderBy: { id: 'desc' },
            select: { id: true, sessionId: true },
        });
        const latestIdBySession = new Map<string, number>();
        for (const row of cursor) {
            if (!latestIdBySession.has(row.sessionId)) {
                latestIdBySession.set(row.sessionId, row.id);
            }
        }

        const latestIds = [...latestIdBySession.values()];
        if (latestIds.length === 0) return lastMessageMap;
        const lastMessages = await this.prisma.agentMessage.findMany({
            where: { id: { in: latestIds } },
            select: { sessionId: true, role: true, content: true },
        });
        for (const msg of lastMessages) {
            const text = this.extractPreviewText(msg.content);
            if (text) {
                lastMessageMap.set(msg.sessionId, msg.role === 'assistant' ? `AI: ${text}` : text);
            }
        }
        return lastMessageMap;
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
            if (expired.length > 0) {
                this.logger.log(`开始清理 ${expired.length} 个过期会话: ids=${expired.map((s) => s.id).join(',')}`);
                for (const session of expired) {
                    await this.prisma.agentMessage.deleteMany({ where: { sessionId: session.id } });
                    await this.prisma.agentSession.delete({ where: { id: session.id } });
                }
                this.logger.log(`已清理 ${expired.length} 个过期会话`);
            }
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

    /**
     * 提取会话列表预览文本：assistant 的 content 是结构化 blocks 数组（含 thinking/tool_use），
     * 只取其中 text 块的文本拼接；用户消息为纯文本/JSON 字符串，直接提取。
     */
    private extractPreviewText(raw: unknown): string | null {
        if (raw === null || raw === undefined) return null;
        const parsed = typeof raw === 'string' ? this.tryParseJson(raw) : raw;
        if (typeof parsed === 'string') return parsed;
        if (Array.isArray(parsed)) {
            const text = parsed
                .filter((b): b is MessageBlock => typeof b === 'object' && b !== null && (b as MessageBlock).type === 'text')
                .map((b) => b.text ?? '')
                .filter((t) => t !== '')
                .join(' ');
            return text || null;
        }
        return this.extractText(parsed);
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
