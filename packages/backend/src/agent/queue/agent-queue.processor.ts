import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentExecutorService } from '../execution/agent-executor.service';

/**
 * Agent 任务队列处理器。
 *
 * BullMQ Worker，消费 agent-task-queue 队列中的任务，
 * 调用 AgentExecutorService 执行 Agent 查询。
 *
 * 支持：
 * - 自动重试（最多 3 次，指数退避 5s）
 * - 超时控制（单任务最多 10 分钟）
 * - 状态持久化（PENDING → RUNNING → COMPLETED/FAILED）
 */
@Processor('agent-task-queue')
export class AgentQueueProcessor {
    private readonly logger = new Logger(AgentQueueProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly agentExecutor: AgentExecutorService,
    ) {}

    @Process('execute-agent-task')
    async handleAgentTask(job: Job<{ taskId: number }>): Promise<void> {
        const { taskId } = job.data;
        this.logger.log(`[AgentQueue] Processing taskId=${taskId} attempt=${job.attemptsMade + 1}/${job.opts.attempts}`);

        // 更新任务状态 → RUNNING
        await this.prisma.agentTask.update({
            where: { id: taskId },
            data: { status: 'RUNNING', startedAt: new Date() as Date | null },
        });

        // 从任务记录中读取输入
        const task = await this.prisma.agentTask.findUnique({
            where: { id: taskId },
            select: { input: true, sessionId: true, type: true },
        });

        if (!task) {
            this.logger.error(`[AgentQueue] Task not found: taskId=${taskId}`);
            return;
        }

        // 从 input JSON 中提取 prompt
        const input = task.input as Record<string, unknown>;
        const prompt = (input.prompt as string) || (input.messages as string) || JSON.stringify(input);

        try {
            // 执行 Agent
            const executor = this.agentExecutor.execute({
                taskId,
                sessionId: task.sessionId ? Number(task.sessionId) : undefined,
                prompt,
            });

            // 消费 AsyncGenerator（内部已通过 StreamEmitter 推送事件）
            for await (const _event of executor) {
                // AgentExecutor 内部已处理所有事件推送和状态更新
            }

            this.logger.log(`[AgentQueue] Task completed taskId=${taskId}`);

        } catch (error) {
            this.logger.error(`[AgentQueue] Task failed taskId=${taskId}: ${(error as Error).message}`);

            await this.prisma.agentTask.update({
                where: { id: taskId },
                data: {
                    status: 'FAILED',
                    errorMsg: (error as Error).message,
                    finishedAt: new Date() as Date | null,
                },
            });

            throw error; // 让 BullMQ 重试机制生效
        }
    }
}
