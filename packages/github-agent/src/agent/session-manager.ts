import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { SessionType } from "../types/index.js";

/**
 * 会话管理器 —— 使用 Prisma 将 Agent 会话持久化到 MySQL。
 *
 * 职责：
 * - 创建/恢复/关闭会话
 * - 保存消息历史
 * - 定时清理过期会话
 */
export class SessionManager {
  private prisma: PrismaClient;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 初始化数据库连接并启动清理定时器。
   */
  async init(): Promise<void> {
    await this.prisma.$connect();
    // 每小时清理一次超过 24 小时的已关闭会话
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions().catch((error) => {
        console.error("[SessionManager] 清理过期会话失败:", error);
      });
    }, 60 * 60 * 1000);
  }

  /**
   * 读取 system_config 表中的单个配置值。
   *
   * 与后端共享同一张 system_config 表（Web 端 MySQL / 桌面端 SQLite），
   * 用于在启动时读取 github.token 等凭据，避免在主进程侧重复读库。
   *
   * @param key 配置键，如 "github.token"
   * @returns 配置值；不存在或查询失败时返回 null
   */
  async getConfigValue(key: string): Promise<string | null> {
    try {
      const row = await this.prisma.systemConfig.findUnique({
        where: { configKey: key },
        select: { configValue: true },
      });
      return row?.configValue ?? null;
    } catch (error) {
      console.error(`[SessionManager] 读取配置 ${key} 失败:`, error);
      return null;
    }
  }

  /**
   * 创建新会话。
   */
  async createSession(type: SessionType, sdkSessionId?: string): Promise<string> {
    const session = await this.prisma.agentSession.create({
      data: {
        type,
        sdkSessionId: sdkSessionId ?? null,
        status: "active",
      },
    });
    return session.id;
  }

  /**
   * 更新 SDK 会话 ID（在收到 init 消息后调用）。
   */
  async updateSdkSessionId(sessionId: string, sdkSessionId: string): Promise<void> {
    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: { sdkSessionId },
    });
  }

  /**
   * 检查会话是否存在且有效。
   */
  async getSession(sessionId: string): Promise<{
    id: string;
    type: string;
    sdkSessionId: string | null;
    status: string;
  } | null> {
    const session = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.status !== "active") {
      return null;
    }
    return session;
  }

  /**
   * 保存一条消息到数据库。
   */
  async saveMessage(sessionId: string, role: string, content: unknown): Promise<void> {
    await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role,
        content: content as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 获取会话的消息历史。
   */
  async getMessages(
    sessionId: string,
    limit = 50,
  ): Promise<Array<{ role: string; content: unknown; createdAt: Date }>> {
    const messages = await this.prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { role: true, content: true, createdAt: true },
    });
    return messages;
  }

  /**
   * 关闭会话。
   */
  async closeSession(sessionId: string): Promise<void> {
    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "closed" },
    });
  }

  /**
   * 清理超过 24 小时的已关闭会话及其消息。
   */
  async cleanupExpiredSessions(): Promise<void> {
    const expiryDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredSessions = await this.prisma.agentSession.findMany({
      where: {
        status: "closed",
        updatedAt: { lt: expiryDate },
      },
      select: { id: true },
    });

    for (const session of expiredSessions) {
      await this.prisma.agentMessage.deleteMany({
        where: { sessionId: session.id },
      });
      await this.prisma.agentSession.delete({
        where: { id: session.id },
      });
    }

    if (expiredSessions.length > 0) {
      console.log(
        `[SessionManager] 已清理 ${expiredSessions.length} 个过期会话`,
      );
    }
  }

  /**
   * 获取活跃会话列表（按更新时间倒序）。
   */
  async listSessions(
    limit = 50,
    offset = 0,
  ): Promise<
    Array<{
      id: string;
      type: string;
      status: string;
      messageCount: number;
      firstMessage: string | null;
      lastMessage: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const sessions = await this.prisma.agentSession.findMany({
      where: { status: "active" },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
          where: { role: "user" },
          select: { content: true },
        },
      },
    });

    // 另外获取每条会话的最后一条消息用于预览
    const lastMessagePromises = sessions.map((s) =>
      this.prisma.agentMessage.findFirst({
        where: { sessionId: s.id, role: "user" },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      }),
    );
    const lastMessages = await Promise.all(lastMessagePromises);

    return sessions.map((s, index) => {
      // content 在 MySQL 中是 Json 类型，需要提取字符串
      const rawFirst = s.messages[0]?.content;
      const rawLast = lastMessages[index]?.content;
      return {
        id: s.id,
        type: s.type,
        status: s.status,
        messageCount: s._count.messages,
        firstMessage: typeof rawFirst === "string" ? rawFirst : rawFirst !== null && rawFirst !== undefined ? JSON.stringify(rawFirst) : null,
        lastMessage: typeof rawLast === "string" ? rawLast : rawLast !== null && rawLast !== undefined ? JSON.stringify(rawLast) : null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });
  }

  /**
   * 销毁管理器，断开数据库连接。
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    await this.prisma.$disconnect();
  }
}
