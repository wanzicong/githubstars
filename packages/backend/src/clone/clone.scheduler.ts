import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CloneService } from './clone.service';
import { STUCK_TASK_THRESHOLD_MS, LOCK_TIMEOUT_MS, LONG_PENDING_THRESHOLD_MS } from './clone.constants';
import { PrismaService } from '../prisma/prisma.service';
import { existsSync } from 'fs';

/**
 * 克隆任务定时调度器
 *
 * 职责：
 * 1. 每秒检查一次待执行的 PENDING 任务
 * 2. 每 10 秒检测锁超时，防止 running 锁卡住
 * 3. 每 30 秒检测长时间 PENDING 任务
 * 4. 每分钟检测卡住的 PROCESSING 任务
 * 5. 每 5 分钟检测目录状态一致性
 */
@Injectable()
export class CloneScheduler {
    private readonly logger = new Logger(CloneScheduler.name);

    /** 恢复操作互斥锁，防止 detectLockTimeout 和 detectStuckTasks 同时恢复同一任务 */
    private recovering = false;

    constructor(
        private readonly cloneService: CloneService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * 每秒检查待执行任务
     */
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

    /**
     * 每 10 秒检测锁超时
     *
     * 如果锁持有超过 LOCK_TIMEOUT_MS，说明任务可能卡住，强制释放锁。
     * 这是最关键的假死检测，能快速恢复因异常导致的锁卡住。
     */
    @Cron('*/10 * * * * *')
    async detectLockTimeout() {
        if (this.recovering) return;

        try {
            const lockAge = this.cloneService.getLockAge();
            if (lockAge === null || lockAge < 0) return; // 锁未被持有

            if (lockAge > LOCK_TIMEOUT_MS) {
                const currentTaskId = this.cloneService.getCurrentTaskId();
                this.logger.warn(
                    `检测到锁超时: lockAge=${Math.round(lockAge / 1000)}s taskId=${currentTaskId ? Number(currentTaskId) : 'unknown'}`,
                );

                // 强制释放锁
                this.cloneService.forceReleaseLock();

                // 如果有正在执行的任务，将其标记为 FAILED
                if (currentTaskId) {
                    await this.recoverStuckTask(currentTaskId, '锁超时，任务被强制终止');
                }
            }
        } catch (e) {
            this.logger.error('锁超时检测异常', e);
        }
    }

    /**
     * 每 30 秒检测长时间 PENDING 任务
     *
     * 如果任务创建超过 LONG_PENDING_THRESHOLD_MS 仍为 PENDING，且当前没有任务在运行，
     * 说明调度器可能漏掉了这个任务，需要重新触发。
     */
    @Cron('*/30 * * * * *')
    async detectLongPendingTasks() {
        if (this.cloneService.isRunning()) return;

        try {
            const threshold = new Date(Date.now() - LONG_PENDING_THRESHOLD_MS);

            const longPendingTasks = await this.prisma.cloneTask.findMany({
                where: {
                    status: 'PENDING',
                    createdAt: { lt: threshold },
                },
                select: { id: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
                take: 1,
            });

            if (longPendingTasks.length > 0) {
                const task = longPendingTasks[0];
                const waitTime = Math.round((Date.now() - (task.createdAt?.getTime() || 0)) / 1000);
                this.logger.warn(`检测到长时间 PENDING 任务: taskId=${Number(task.id)} waitTime=${waitTime}s`);

                // 尝试执行该任务
                await this.cloneService.executeTask(task.id);
            }
        } catch (e) {
            this.logger.error('长时间 PENDING 检测异常', e);
        }
    }

    /**
     * 每分钟检测卡住的任务并自动恢复
     *
     * 检测条件：任务状态为 PROCESSING 且 startedAt 超过阈值（35 分钟）。
     * 恢复策略：将卡住的任务标记为 FAILED，重置 running 锁。
     */
    @Cron('0 */1 * * * *')
    async detectStuckTasks() {
        if (this.recovering) return;

        try {
            const threshold = new Date(Date.now() - STUCK_TASK_THRESHOLD_MS);

            const stuckTasks = await this.prisma.cloneTask.findMany({
                where: {
                    status: 'PROCESSING',
                    startedAt: { lt: threshold },
                },
                select: { id: true, startedAt: true },
            });

            if (stuckTasks.length === 0) return;

            for (const task of stuckTasks) {
                this.logger.warn(`检测到卡住的任务: taskId=${Number(task.id)} startedAt=${task.startedAt?.toISOString()}`);

                await this.recoverStuckTask(Number(task.id), '任务超时，自动标记为失败');
            }

            // 如果有卡住的任务且锁仍被持有，强制释放锁
            if (stuckTasks.length > 0 && this.cloneService.isRunning()) {
                this.logger.warn('检测到卡住任务后强制释放锁');
                this.cloneService.forceReleaseLock();
            }
        } catch (e) {
            this.logger.error('卡住任务检测异常', e);
        }
    }

    /**
     * 每 5 分钟检测目录状态一致性
     *
     * 检查数据库中状态为 COMPLETED 的子项，验证其目录是否存在且不为空。
     * 如果目录不存在或为空，将状态重置为 FAILED。
     */
    @Cron('0 */5 * * * *')
    async detectDirectoryInconsistency() {
        try {
            // 只检查最近 1 小时内完成的任务，避免扫描过多历史数据
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            const completedItems = await this.prisma.cloneTaskItem.findMany({
                where: {
                    status: 'COMPLETED',
                    updatedAt: { gte: oneHourAgo },
                },
                select: {
                    id: true,
                    taskId: true,
                    fullName: true,
                    localPath: true,
                },
                take: 100, // 限制每次检查的数量
            });

            if (completedItems.length === 0) return;

            let inconsistentCount = 0;

            for (const item of completedItems) {
                if (!item.localPath) continue;

                try {
                    const exists = existsSync(item.localPath);
                    if (!exists) {
                        // 目录不存在，标记为不一致
                        this.logger.warn(`目录不一致: ${item.fullName} 目录不存在: ${item.localPath}`);

                        await this.prisma.cloneTaskItem.update({
                            where: { id: item.id },
                            data: {
                                status: 'FAILED',
                                errorMessage: '目录不存在，可能是外部删除',
                            },
                        });

                        inconsistentCount++;
                    }
                } catch {
                    // 忽略检查失败
                }
            }

            if (inconsistentCount > 0) {
                this.logger.warn(`目录一致性检测完成: 发现 ${inconsistentCount} 个不一致项`);
            }
        } catch (e) {
            this.logger.error('目录一致性检测异常', e);
        }
    }

    /**
     * 恢复卡住的任务
     *
     * @param taskId 任务 ID
     * @param reason 失败原因
     */
    private async recoverStuckTask(taskId: number, reason: string) {
        if (this.recovering) return;
        this.recovering = true;

        try {
            // 将卡住的任务标记为 FAILED
            await this.prisma.cloneTask.update({
                where: { id: taskId },
                data: { status: 'FAILED', finishedAt: new Date() },
            });

            // 将卡住的子项也标记为 FAILED
            const updatedItems = await this.prisma.cloneTaskItem.updateMany({
                where: { taskId, status: 'PROCESSING' },
                data: {
                    status: 'FAILED',
                    errorMessage: reason,
                },
            });

            this.logger.warn(`卡住任务已恢复: taskId=${Number(taskId)} 失败子项=${updatedItems.count} reason=${reason}`);
        } catch (e) {
            this.logger.error(`恢复卡住任务失败: taskId=${Number(taskId)}`, e);
        } finally {
            this.recovering = false;
        }
    }
}
