import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CloneService } from './clone.service';

/**
 * 克隆任务定时调度器
 *
 * 每秒检查一次待执行的 PENDING 任务，任务级锁确保同时只执行一个任务。
 */
@Injectable()
export class CloneScheduler {
    private readonly logger = new Logger(CloneScheduler.name);

    constructor(private readonly cloneService: CloneService) {}

    @Cron('*/1 * * * * *')
    async tick() {
        if (this.cloneService.isRunning()) return;

        try {
            const task = await this.cloneService.findNextPendingTask();
            if (task) {
                this.logger.log(`调度器发现待执行任务: taskId=${Number(task.id)}`);
                await this.cloneService.executeTask(task.id);
            }
        } catch (e) {
            this.logger.error('克隆调度器异常', e);
        }
    }
}
