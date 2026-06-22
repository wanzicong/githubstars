import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Semaphore } from '../../common/utils/semaphore';

/**
 * 工具调用器。
 *
 * 统一执行工具调用请求，记录调用状态和耗时到 tool_invocation 表。
 * 使用 Semaphore 控制并发工具调用数（默认最多 5 个并行）。
 *
 * @callers
 *   - AgentExecutorService — SDK hooks 中调用
 *   - WorkflowEngineService — 子 Agent 工具调用
 */
@Injectable()
export class ToolInvokerService {
    private readonly logger = new Logger(ToolInvokerService.name);

    /** 工具调用并发信号量 */
    private readonly semaphore = new Semaphore(5);

    constructor(
        private readonly toolRegistry: ToolRegistryService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * 执行工具调用并记录到数据库。
     *
     * @param toolName — 工具名称
     * @param input — 调用参数
     * @param taskId — 任务 ID
     * @param sessionId — 会话 ID（可选）
     * @param toolType — 工具类型（local / mcp）
     * @returns 工具执行结果
     */
    async invoke(
        toolName: string,
        input: Record<string, unknown>,
        taskId: number,
        sessionId?: number,
        toolType: 'local' | 'mcp' = 'local',
    ): Promise<unknown> {
        this.logger.log(`[ToolInvoker] Invoking "${toolName}" for taskId=${taskId}`);

        // 创建工具调用记录
        const invocation = await this.prisma.toolInvocation.create({
            data: {
                taskId: BigInt(taskId),
                toolName,
                toolType,
                input: JSON.parse(JSON.stringify(input)),
                status: 'RUNNING',
                createdAt: new Date(),
            },
        });

        const startTime = Date.now();

        try {
            // 并发控制
            const result = await this.semaphore.run(() =>
                this.toolRegistry.invoke(toolName, input, {
                    taskId,
                    sessionId,
                }),
            );

            const durationMs = Date.now() - startTime;

            // 更新调用记录 → SUCCESS
            await this.prisma.toolInvocation.update({
                where: { id: invocation.id },
                data: {
                    status: 'SUCCESS',
                    output: typeof result === 'object'
                        ? (JSON.parse(JSON.stringify(result)) as any)
                        : { value: result },
                    durationMs,
                },
            });

            this.logger.log(`[ToolInvoker] "${toolName}" succeeded in ${durationMs}ms`);
            return result;

        } catch (error) {
            const durationMs = Date.now() - startTime;

            // 更新调用记录 → ERROR
            await this.prisma.toolInvocation.update({
                where: { id: invocation.id },
                data: {
                    status: 'ERROR',
                    errorMsg: (error as Error).message,
                    durationMs,
                },
            });

            this.logger.error(`[ToolInvoker] "${toolName}" failed in ${durationMs}ms: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * 获取某任务的工具调用统计。
     */
    async getStats(taskId: number) {
        const invocations = await this.prisma.toolInvocation.findMany({
            where: { taskId: BigInt(taskId) },
            select: { status: true, durationMs: true },
        });

        const total = invocations.length;
        const succeeded = invocations.filter(i => i.status === 'SUCCESS').length;
        const failed = invocations.filter(i => i.status === 'ERROR').length;
        const totalDuration = invocations.reduce((sum, i) => sum + (i.durationMs || 0), 0);

        return {
            total,
            succeeded,
            failed,
            avgDurationMs: total > 0 ? Math.round(totalDuration / total) : 0,
        };
    }
}
