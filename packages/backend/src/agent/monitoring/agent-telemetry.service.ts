import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Agent 遥测指标服务。
 *
 * 收集 Agent 底座的核心运行指标，供监控和告警使用。
 * 指标类型：
 * - 计数器：任务总数、工具调用次数、错误数
 * - 直方图：任务耗时分布
 * - 仪表：队列深度、活跃连接数
 *
 * Phase 4 为内存版本，后续可接入 Prometheus / OpenTelemetry。
 *
 * @callers
 *   - AgentExecutorService — 任务完成/失败时记录
 *   - AgentQueueProcessor — 队列事件记录
 *   - AgentController — API 调用统计
 */
@Injectable()
export class AgentTelemetryService {
    private readonly logger = new Logger(AgentTelemetryService.name);

    // 计数器
    private taskCreatedCount = 0;
    private taskCompletedCount = 0;
    private taskFailedCount = 0;
    private taskCancelledCount = 0;
    private toolCallCount = 0;
    private toolCallErrorCount = 0;
    private chatSessionCount = 0;

    // 耗时累计（用于计算平均值）
    private taskDurationTotalMs = 0;
    private lastTaskDurationMs = 0;

    // 启动时间
    private readonly startTime = Date.now();

    constructor(private readonly prisma: PrismaService) {}

    /** 任务创建 */
    recordTaskCreated(): void {
        this.taskCreatedCount++;
    }

    /** 任务完成 */
    recordTaskCompleted(durationMs: number): void {
        this.taskCompletedCount++;
        this.taskDurationTotalMs += durationMs;
        this.lastTaskDurationMs = durationMs;
    }

    /** 任务失败 */
    recordTaskFailed(): void {
        this.taskFailedCount++;
    }

    /** 任务取消 */
    recordTaskCancelled(): void {
        this.taskCancelledCount++;
    }

    /** 工具调用 */
    recordToolCall(success: boolean): void {
        this.toolCallCount++;
        if (!success) this.toolCallErrorCount++;
    }

    /** 新对话 */
    recordChatSession(): void {
        this.chatSessionCount++;
    }

    /** 获取完整遥测快照 */
    getSnapshot() {
        const totalTasks = this.taskCreatedCount;
        const completedTasks = this.taskCompletedCount;
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

        return {
            uptime: {
                seconds: uptimeSeconds,
                formatted: this.formatUptime(uptimeSeconds),
            },
            tasks: {
                created: totalTasks,
                completed: completedTasks,
                failed: this.taskFailedCount,
                cancelled: this.taskCancelledCount,
                pending: totalTasks - completedTasks - this.taskFailedCount - this.taskCancelledCount,
                successRate: completedTasks > 0
                    ? `${((completedTasks / Math.max(completedTasks + this.taskFailedCount, 1)) * 100).toFixed(1)}%`
                    : 'N/A',
            },
            performance: {
                avgDurationMs: completedTasks > 0
                    ? Math.round(this.taskDurationTotalMs / completedTasks)
                    : 0,
                lastDurationMs: this.lastTaskDurationMs,
                throughputPerMin: uptimeSeconds > 0
                    ? ((completedTasks / uptimeSeconds) * 60).toFixed(2)
                    : '0',
            },
            tools: {
                totalCalls: this.toolCallCount,
                errors: this.toolCallErrorCount,
                errorRate: this.toolCallCount > 0
                    ? `${((this.toolCallErrorCount / this.toolCallCount) * 100).toFixed(1)}%`
                    : '0%',
            },
            sessions: {
                total: this.chatSessionCount,
            },
        };
    }

    /** 从数据库查询补充信息 */
    async getDbStats() {
        try {
            const [totalAuditLogs, totalInvocations, pendingTasks] = await Promise.all([
                this.prisma.agentAuditLog.count(),
                this.prisma.toolInvocation.count(),
                this.prisma.agentTask.count({ where: { status: 'PENDING' } }),
            ]);

            return {
                auditLogs: totalAuditLogs,
                toolInvocations: totalInvocations,
                pendingTasks,
            };
        } catch {
            return { auditLogs: 0, toolInvocations: 0, pendingTasks: 0 };
        }
    }

    private formatUptime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    }
}
