import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { CLONE_TIMEOUT_MS, MAX_HISTORY_TASKS, MAX_RETRY_ATTEMPTS } from './clone.constants';
import { CreateCloneTaskDto } from './clone.dto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

@Injectable()
export class CloneService {
    private readonly logger = new Logger(CloneService.name);

    /** 任务级运行锁：同时只执行一个克隆任务 */
    private running = false;

    /** 信号量并发控制 */
    private semaphore = 0;
    private maxConcurrent = 5;
    private waitQueue: Array<() => void> = [];

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    /**
     * 获取信号量许可
     */
    private acquire(): Promise<void> {
        return new Promise((resolve) => {
            if (this.semaphore < this.maxConcurrent) {
                this.semaphore++;
                resolve();
            } else {
                this.waitQueue.push(() => {
                    this.semaphore++;
                    resolve();
                });
            }
        });
    }

    /**
     * 释放信号量许可
     */
    private release() {
        this.semaphore--;
        const next = this.waitQueue.shift();
        if (next) queueMicrotask(next);
    }

    /**
     * 重置信号量状态（任务开始时调用）
     */
    private resetSemaphore(concurrency: number) {
        this.semaphore = 0;
        this.maxConcurrent = concurrency;
        this.waitQueue = [];
    }

    /**
     * 创建克隆任务
     *
     * 校验仓库 ID 列表，批量创建任务明细，返回任务 ID。
     * 任务状态为 PENDING，由定时调度器 pick up 执行。
     */
    async createTask(dto: CreateCloneTaskDto): Promise<{ success: boolean; taskId?: number; message?: string }> {
        const { repoIds, targetDir, concurrency, shallow } = dto;

        // 查询仓库信息
        const repos = await this.prisma.githubRepo.findMany({
            where: { id: { in: repoIds.map((id) => BigInt(id)) } },
            select: { id: true, fullName: true, htmlUrl: true },
        });

        if (repos.length === 0) {
            return { success: false, message: '未找到指定仓库' };
        }

        const githubToken = await this.config.getValue('github.token');

        // 创建主任务
        const task = await this.prisma.cloneTask.create({
            data: {
                status: 'PENDING',
                targetDir,
                concurrency,
                shallow,
                totalItems: repos.length,
                createdAt: new Date(),
            },
        });

        // 创建任务明细
        const items = repos.map((repo) => {
            const fullName = repo.fullName || '';
            const [owner, repoName] = fullName.split('/');
            const cloneUrl = githubToken
                ? `https://x-access-token:${githubToken}@github.com/${owner}/${repoName}.git`
                : `https://github.com/${owner}/${repoName}.git`;
            const localPath = path.join(targetDir, owner || 'unknown', repoName || 'unknown');

            return {
                taskId: task.id,
                repoId: repo.id,
                fullName,
                cloneUrl,
                localPath,
                status: 'PENDING' as const,
                retryCount: 0,
                createdAt: new Date(),
            };
        });

        await this.prisma.cloneTaskItem.createMany({ data: items });

        this.logger.log(`克隆任务已创建: taskId=${Number(task.id)} repos=${repos.length} target=${targetDir}`);
        return { success: true, taskId: Number(task.id), message: `已创建克隆任务，共 ${repos.length} 个仓库` };
    }

    /**
     * 查找下一个待执行的 PENDING 任务
     */
    async findNextPendingTask() {
        return this.prisma.cloneTask.findFirst({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, concurrency: true },
        });
    }

    /**
     * 检查是否有任务正在执行
     */
    isRunning(): boolean {
        return this.running;
    }

    /**
     * 执行克隆任务
     *
     * 更新状态为 PROCESSING → 并发执行所有 PENDING 子项 → 判断终态
     */
    async executeTask(taskId: bigint) {
        if (this.running) return;

        this.running = true;
        try {
            const task = await this.prisma.cloneTask.findUnique({ where: { id: taskId } });
            if (!task) return;

            await this.prisma.cloneTask.update({
                where: { id: taskId },
                data: { status: 'PROCESSING', startedAt: new Date() },
            });

            this.resetSemaphore(task.concurrency);

            const items = await this.prisma.cloneTaskItem.findMany({
                where: { taskId, status: 'PENDING' },
            });

            this.logger.log(`克隆任务开始执行: taskId=${Number(taskId)} pendingItems=${items.length} concurrency=${task.concurrency}`);

            // 并发执行所有 item
            await Promise.all(items.map((item) => this.processItem(item, task.shallow ?? true)));

            await this.finishTask(taskId);
        } catch (e) {
            this.logger.error(`克隆任务执行异常: taskId=${Number(taskId)}`, e);
            try {
                await this.prisma.cloneTask.update({
                    where: { id: taskId },
                    data: { status: 'FAILED', finishedAt: new Date() },
                });
            } catch (updateErr) {
                this.logger.error('更新任务失败状态时出错', updateErr);
            }
        } finally {
            this.running = false;
        }
    }

    /**
     * 处理单个克隆子项
     */
    private async processItem(item: any, shallow: boolean) {
        await this.acquire();
        try {
            await this.prisma.cloneTaskItem.update({
                where: { id: item.id },
                data: { status: 'PROCESSING' },
            });

            const result = await this.executeClone(item, shallow);
            await this.recordItemResult(item, result.success, result.error);
        } finally {
            this.release();
        }
    }

    /**
     * 执行实际的 git clone 操作
     */
    private async executeClone(item: any, shallow: boolean): Promise<{ success: boolean; error?: string }> {
        const localPath = item.localPath as string;

        try {
            // 检查目录是否已存在
            if (fs.existsSync(localPath)) {
                return { success: false, error: 'SKIPPED' };
            }

            // 确保父目录存在
            const parentDir = path.dirname(localPath);
            fs.mkdirSync(parentDir, { recursive: true });

            // 构建 git clone 命令
            const args = ['clone'];
            if (shallow) args.push('--depth', '1');
            args.push(item.cloneUrl, localPath);

            await execFileAsync('git', args, {
                timeout: CLONE_TIMEOUT_MS,
                windowsHide: true,
            });

            return { success: true };
        } catch (e: any) {
            const errorMsg = e.stderr || e.message || String(e);

            // 清理失败的克隆目录
            try {
                if (fs.existsSync(localPath)) {
                    fs.rmSync(localPath, { recursive: true, force: true });
                }
            } catch {
                // 忽略清理失败
            }

            // 特殊处理：目录已存在视为跳过
            if (errorMsg.includes('already exists') || errorMsg.includes('SKIPPED')) {
                return { success: false, error: 'SKIPPED' };
            }

            return { success: false, error: errorMsg.substring(0, 2000) };
        }
    }

    /**
     * 记录子项结果并原子更新父任务计数器
     */
    private async recordItemResult(item: any, success: boolean, error?: string) {
        const isSkipped = error === 'SKIPPED';
        const status = isSkipped ? 'SKIPPED' : success ? 'COMPLETED' : 'FAILED';

        await this.prisma.cloneTaskItem.update({
            where: { id: item.id },
            data: {
                status,
                errorMessage: isSkipped ? '目录已存在，已跳过' : success ? null : error,
                updatedAt: new Date(),
            },
        });

        // 原子更新父任务计数器
        if (isSkipped) {
            await this.prisma.cloneTask.update({
                where: { id: item.taskId },
                data: { skippedItems: { increment: 1 } },
            });
        } else if (success) {
            await this.prisma.cloneTask.update({
                where: { id: item.taskId },
                data: { completedItems: { increment: 1 } },
            });
        } else {
            await this.prisma.cloneTask.update({
                where: { id: item.taskId },
                data: { failedItems: { increment: 1 } },
            });
        }
    }

    /**
     * 完成任务并设置终态
     */
    private async finishTask(taskId: bigint) {
        const task = await this.prisma.cloneTask.findUnique({ where: { id: taskId } });
        if (!task) return;

        let status: string;
        if (task.failedItems === 0 && task.skippedItems === 0) {
            status = 'COMPLETED';
        } else if (task.completedItems === 0 && task.skippedItems === 0) {
            status = 'FAILED';
        } else if (task.completedItems === 0) {
            status = 'FAILED';
        } else {
            status = 'PARTIAL';
        }

        await this.prisma.cloneTask.update({
            where: { id: taskId },
            data: { status, finishedAt: new Date() },
        });

        this.logger.log(`克隆任务完成: taskId=${Number(taskId)} status=${status} completed=${task.completedItems} failed=${task.failedItems} skipped=${task.skippedItems}`);

        // 清理历史任务
        await this.cleanOldTasks();
    }

    /**
     * 查询任务进度
     */
    async getTaskProgress(taskId: number) {
        const task = await this.prisma.cloneTask.findUnique({
            where: { id: BigInt(taskId) },
            include: {
                items: {
                    select: {
                        fullName: true,
                        status: true,
                        localPath: true,
                        errorMessage: true,
                    },
                },
            },
        });

        if (!task) return { success: false, message: '任务不存在' };

        const total = task.totalItems;
        const processed = task.completedItems + task.failedItems + task.skippedItems;

        const failedDetails = task.items
            .filter((i) => i.status === 'FAILED')
            .map((i) => ({ fullName: i.fullName, error: i.errorMessage }));

        const skippedDetails = task.items
            .filter((i) => i.status === 'SKIPPED')
            .map((i) => ({ fullName: i.fullName }));

        return {
            success: true,
            taskId: Number(task.id),
            status: task.status,
            targetDir: task.targetDir,
            concurrency: task.concurrency,
            totalItems: total,
            completedItems: task.completedItems,
            failedItems: task.failedItems,
            skippedItems: task.skippedItems,
            progress: total > 0 ? Math.round((processed * 100) / total) : 0,
            createdAt: task.createdAt?.toISOString(),
            startedAt: task.startedAt?.toISOString(),
            finishedAt: task.finishedAt?.toISOString(),
            failedDetails,
            skippedDetails,
        };
    }

    /**
     * 重试失败项
     */
    async retryFailed(taskId: number) {
        const items = await this.prisma.cloneTaskItem.findMany({
            where: { taskId: BigInt(taskId), status: 'FAILED' },
        });

        if (!items.length) return { success: false, message: '没有失败项需要重试' };

        // 重置失败项状态为 PENDING
        await this.prisma.cloneTaskItem.updateMany({
            where: { taskId: BigInt(taskId), status: 'FAILED' },
            data: { status: 'PENDING', errorMessage: null, retryCount: { increment: 1 } },
        });

        // 重置任务状态为 PENDING（让调度器重新 pick up）
        await this.prisma.cloneTask.update({
            where: { id: BigInt(taskId) },
            data: { status: 'PENDING', failedItems: 0, startedAt: null, finishedAt: null },
        });

        this.logger.log(`克隆任务重试: taskId=${taskId} failedCount=${items.length}`);
        return { success: true, taskId, message: `已重置 ${items.length} 个失败项` };
    }

    /**
     * 获取最近任务列表
     */
    async getRecentTasks() {
        const tasks = await this.prisma.cloneTask.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        return {
            success: true,
            tasks: tasks.map((t) => ({
                taskId: Number(t.id),
                status: t.status,
                targetDir: t.targetDir,
                concurrency: t.concurrency,
                totalItems: t.totalItems,
                completedItems: t.completedItems,
                failedItems: t.failedItems,
                skippedItems: t.skippedItems,
                createdAt: t.createdAt?.toISOString(),
                startedAt: t.startedAt?.toISOString(),
                finishedAt: t.finishedAt?.toISOString(),
            })),
        };
    }

    /**
     * 清理历史任务（保留最近 N 条）
     */
    private async cleanOldTasks() {
        const old = await this.prisma.cloneTask.findMany({
            where: { status: { in: ['COMPLETED', 'FAILED', 'PARTIAL'] } },
            orderBy: { createdAt: 'desc' },
            skip: MAX_HISTORY_TASKS,
            take: 1000,
            select: { id: true },
        });

        if (old.length > 0) {
            this.logger.log(`清理 ${old.length} 条历史克隆任务`);
        }

        for (const t of old) {
            await this.prisma.cloneTaskItem.deleteMany({ where: { taskId: t.id } });
            await this.prisma.cloneTask.delete({ where: { id: t.id } });
        }
    }
}
