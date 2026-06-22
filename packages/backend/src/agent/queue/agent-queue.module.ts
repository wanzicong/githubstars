import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AgentQueueService } from './agent-queue.service';

/**
 * Agent 任务队列模块。
 *
 * 注册 BullMQ 队列。AgentQueueProcessor 在父级 AgentModule 中注册，
 * 以便访问 AgentExecutorService 等依赖。
 */
@Module({
    imports: [
        BullModule.registerQueue({
            name: 'agent-task-queue',
        }),
    ],
    providers: [AgentQueueService],
    exports: [AgentQueueService],
})
export class AgentQueueModule {}
