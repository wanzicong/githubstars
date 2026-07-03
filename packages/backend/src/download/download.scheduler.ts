import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DownloadService } from './download.service';
import { STUCK_TASK_THRESHOLD_MS, LOCK_TIMEOUT_MS, LONG_PENDING_THRESHOLD_MS } from './download.constants';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 下载任务定时调度器
 *
 * 职责与 CloneScheduler 一致：
 * 1. 每秒检查待执行的 PENDING 任务
 * 2. 每 10 秒检测锁超时
 * 3. 每 30 秒检测长时间 PENDING 任务
 * 4. 每分钟检测卡住的任务
 * 5. 每 5 分钟检测文件一致性
 */
@Injectable()
export class DownloadScheduler {
    private readonly logger = new Logger(DownloadScheduler.name);
    private recovering = false;

    constructor(
        private readonly downloadService: DownloadService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * 每秒检查待执行任务
     */
    @Cron('*/1 * * * * *')
    async tick() {
        if (this.downloadService.isRunning()) return;

        try {
            const task = await this.downloadService.findNextPendingTask();
            if (task) {
                this.logger.log(`调度器发现待执行任务: taskId=${Number(task.id)}`);
                await this.downloadService.executeTask(task.id);
            }
        } catch (e) {
            this.logger.error('下载调度器异常', e);
        }
    }

    /**
     * 每 10 秒检测锁超时
     */
    @Cron('*/10 * * * * *')
    async detectLockTimeout() {
        if (this.recovering) return;

        try {
            const lockAge = this.downloadService.getLockAge();
            if (lockAge < 0) return;

            if (lockAge > LOCK_TIMEOUT_MS) {
                const currentTaskId = this.downloadService.getCurrentTaskId();
                this.logger.warn(
                    `检测到锁超时: lockAge=${Math.round(lockAge / 1000)}s taskId=${currentTaskId ? Number(currentTaskId) : 'unknown'}`,
                );
                this.downloadService.forceReleaseLock();
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
     */
    @Cron('*/30 * * * * *')
    async detectLongPendingTasks() {
        if (this.downloadService.isRunning()) return;

        try {
            const threshold = new Date(Date.now() - LONG_PENDING_THRESHOLD_MS);
            const longPendingTasks = await this.prisma.downloadTask.findMany({
                where: { status: 'PENDING', createdAt: { lt: threshold } },
                select: { id: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
                take: 1,
            });

            if (longPendingTasks.length > 0) {
                const task = longPendingTasks[0];
                const waitTime = Math.round((Date.now() - (task.createdAt?.getTime() || 0)) / 1000);
                this.logger.warn(`检测到长时间 PENDING 任务: taskId=${Number(task.id)} waitTime=${waitTime}s`);
                await this.downloadService.executeTask(task.id);
            }
        } catch (e) {
            this.logger.error('长时间 PENDING 检测异常', e);
        }
    }

    /**
     * 每分钟检测卡住任务
     */
    @Cron('0 */1 * * * *')
    async detectStuckTasks() {
        if (this.recovering) return;

        try {
            const threshold = new Date(Date.now() - STUCK_TASK_THRESHOLD_MS);
            const stuckTasks = await this.prisma.downloadTask.findMany({
                where: { status: 'PROCESSING', startedAt: { lt: threshold } },
                select: { id: true, startedAt: true },
            });

            if (stuckTasks.length === 0) return;

            for (const task of stuckTasks) {
                this.logger.warn(`检测到卡住的任务: taskId=${Number(task.id)} startedAt=${task.startedAt?.toISOString()}`);
                await this.recoverStuckTask(Number(task.id), '任务超时，自动标记为失败');
            }

            if (stuckTasks.length > 0 && this.downloadService.isRunning()) {
                this.logger.warn('检测到卡住任务后强制释放锁');
                this.downloadService.forceReleaseLock();
            }
        } catch (e) {
            this.logger.error('卡住任务检测异常', e);
        }
    }

    /**
     * 每 5 分钟检测文件一致性
     */
    @Cron('0 */5 * * * *')
    async detectFileConsistency() {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const completedItems = await this.prisma.downloadTaskItem.findMany({
                where: { status: 'COMPLETED', updatedAt: { gte: oneHourAgo } },
                select: { id: true, taskId: true, fullName: true, localFilePath: true, extractDir: true },
                take: 100,
            });

            if (completedItems.length === 0) return;

            let inconsistentCount = 0;
            for (const item of completedItems) {
                try {
                    // 检查主文件是否存在（考虑 deleteAfterExtract 场景：文件被删除但解压目录存在）
                    const fileExists = item.localFilePath ? await this.fileExists(item.localFilePath) : false;
                    const extractExists = item.extractDir ? await this.fileExists(item.extractDir) : false;

                    if (fileExists || extractExists) continue; // 至少有一处存在，视为有效

                    // 两者都不存在，标记为不一致
                    this.logger.warn(`文件不一致: ${item.fullName} 文件和解压目录均不存在`);
                    await this.prisma.downloadTaskItem.update({
                        where: { id: item.id },
                        data: { status: 'FAILED', errorMessage: '文件不存在，可能是外部删除' },
                    });
                    inconsistentCount++;
                } catch {
                    // 忽略
                }
            }

            if (inconsistentCount > 0) {
                this.logger.warn(`文件一致性检测完成: 发现 ${inconsistentCount} 个不一致项`);
            }
        } catch (e) {
            this.logger.error('文件一致性检测异常', e);
        }
    }

    /**
     * 检查文件是否存在
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            const { existsSync } = await import('fs');
            return existsSync(filePath);
        } catch {
            return false;
        }
    }

    /**
     * 恢复卡住的任务
     */
    private async recoverStuckTask(taskId: number, reason: string) {
        if (this.recovering) return;
        this.recovering = true;

        try {
            await this.prisma.downloadTask.update({
                where: { id: taskId },
                data: { status: 'FAILED', finishedAt: new Date() },
            });

            const updatedItems = await this.prisma.downloadTaskItem.updateMany({
                where: { taskId, status: 'PROCESSING' },
                data: { status: 'FAILED', errorMessage: reason },
            });

            this.logger.warn(`卡住任务已恢复: taskId=${Number(taskId)} 失败子项=${updatedItems.count} reason=${reason}`);
        } catch (e) {
            this.logger.error(`恢复卡住任务失败: taskId=${Number(taskId)}`, e);
        } finally {
            this.recovering = false;
        }
    }
}
