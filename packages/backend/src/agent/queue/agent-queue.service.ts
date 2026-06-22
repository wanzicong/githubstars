import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';

/**
 * Agent 任务队列服务。
 *
 * 使用 BullMQ 管理异步 Agent 任务的入队和取消。
 */
@Injectable()
export class AgentQueueService {
    private readonly logger = new Logger(AgentQueueService.name);

    constructor(
        @InjectQueue('agent-task-queue') private readonly queue: Queue,
    ) {}

    /**
     * 添加 Agent 任务到队列。
     */
    async enqueue(taskId: number, priority: number = 0): Promise<void> {
        await this.queue.add(
            'execute-agent-task',
            { taskId },
            {
                jobId: `agent-task-${taskId}`,
                priority,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { count: 100 },
                removeOnFail: { count: 500 },
            },
        );
        this.logger.log(`[AgentQueue] Enqueued taskId=${taskId} priority=${priority}`);
    }

    /**
     * 取消队列中的任务。
     */
    async cancel(taskId: number): Promise<boolean> {
        const job = await this.queue.getJob(`agent-task-${taskId}`);
        if (job) {
            await job.remove();
            this.logger.log(`[AgentQueue] Cancelled taskId=${taskId}`);
            return true;
        }
        return false;
    }

    async getWaitingCount(): Promise<number> {
        return this.queue.getWaitingCount();
    }

    async getActiveCount(): Promise<number> {
        return this.queue.getActiveCount();
    }
}
