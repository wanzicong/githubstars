import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import {
    CLONE_TIMEOUT_MS,
    ITEM_TIMEOUT_MS,
    TASK_TIMEOUT_MS,
    SEMAPHORE_TIMEOUT_MS,
    STUCK_TASK_THRESHOLD_MS,
    MAX_HISTORY_TASKS,
    MAX_RETRY_ATTEMPTS,
} from './clone.constants';
import { CreateCloneTaskDto } from './clone.dto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

/**
 * 为 Promise 添加超时包装
 *
 * @param promise   原始 Promise
 * @param ms        超时时间（毫秒）
 * @param errorMsg  超时错误消息
 * @returns 原始 Promise 的结果，或超时后抛出错误
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(errorMsg)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

@Injectable()
export class CloneService {
    private readonly logger = new Logger(CloneService.name);

    /** 任务级运行锁：同时只执行一个克隆任务 */
    private running = false;

    /** 锁获取时间，用于检测锁是否卡住 */
    private lockAcquiredAt: Date | null = null;

    /** 当前正在执行的任务 ID */
    private currentTaskId: bigint | null = null;

    /** 信号量并发控制 */
    private semaphore = 0;
    private maxConcurrent = 5;
    private waitQueue: Array<() => void> = [];

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    /**
     * 获取信号量许可（带超时保护）
     *
     * 超时后抛出错误，防止永久阻塞导致任务假死。
     */
    private acquire(): Promise<void> {
        const acquirePromise = new Promise<void>((resolve, reject) => {
            if (this.semaphore < this.maxConcurrent) {
                this.semaphore++;
                resolve();
            } else {
                const waiter = () => {
                    this.semaphore++;
                    resolve();
                };
                this.waitQueue.push(waiter);
            }
        });

        return withTimeout(acquirePromise, SEMAPHORE_TIMEOUT_MS, '信号量获取超时，可能存在死锁');
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
     * 获取锁持有时间（毫秒）
     * 如果锁未被持有，返回 -1
     */
    getLockAge(): number {
        if (!this.running || !this.lockAcquiredAt) return -1;
        return Date.now() - this.lockAcquiredAt.getTime();
    }

    /**
     * 获取当前正在执行的任务 ID
     */
    getCurrentTaskId(): bigint | null {
        return this.currentTaskId;
    }

    /**
     * 强制释放锁（仅用于假死恢复）
     */
    forceReleaseLock() {
        this.running = false;
        this.lockAcquiredAt = null;
        this.currentTaskId = null;
        this.logger.warn('锁已被强制释放');
    }

    /**
     * 执行克隆任务（带任务级超时保护）
     *
     * 更新状态为 PROCESSING → 并发执行所有 PENDING 子项 → 判断终态。
     * 整体任务受 TASK_TIMEOUT_MS 约束，超时后强制标记为 FAILED，
     * 并确保 running 锁释放，防止调度器永久阻塞。
     */
    async executeTask(taskId: bigint) {
        if (this.running) return;

        this.running = true;
        this.lockAcquiredAt = new Date();
        this.currentTaskId = taskId;
        try {
            await withTimeout(
                this.executeTaskInner(taskId),
                TASK_TIMEOUT_MS,
                `任务整体超时: taskId=${Number(taskId)}`,
            );
        } catch (e: any) {
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
            this.lockAcquiredAt = null;
            this.currentTaskId = null;
            this.logger.log(`克隆任务执行结束，running 锁已释放: taskId=${Number(taskId)}`);
        }
    }

    /**
     * 任务执行内部逻辑
     */
    private async executeTaskInner(taskId: bigint) {
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
    }

    /**
     * 处理单个克隆子项（带超时保护）
     *
     * 整个子项处理流程（含数据库操作）受 ITEM_TIMEOUT_MS 约束，
     * 超时后标记为 FAILED 并释放信号量，防止任务假死。
     */
    private async processItem(item: any, shallow: boolean) {
        await this.acquire();
        try {
            await withTimeout(
                this.processItemInner(item, shallow),
                ITEM_TIMEOUT_MS,
                `子项处理超时: ${item.fullName}`,
            );
        } catch (e: any) {
            // 超时或其他未捕获异常，记录为失败
            this.logger.error(`子项处理异常: ${item.fullName}`, e);
            try {
                await this.recordItemResult(item, false, e.message || '未知错误');
            } catch (recordErr) {
                this.logger.error('记录子项失败状态时出错', recordErr);
            }
        } finally {
            this.release();
        }
    }

    /**
     * 子项处理内部逻辑
     */
    private async processItemInner(item: any, shallow: boolean) {
        await this.prisma.cloneTaskItem.update({
            where: { id: item.id },
            data: { status: 'PROCESSING' },
        });

        const result = await this.executeClone(item, shallow);
        await this.recordItemResult(item, result.success, result.error);
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
     * 记录子项结果
     *
     * 不再更新父任务计数器，getTaskProgress 会根据子项状态实时计算。
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
    }

    /**
     * 完成任务并设置终态
     *
     * 根据子项的实际状态判断任务终态，避免依赖计数器。
     */
    private async finishTask(taskId: bigint) {
        // 查询子项状态统计
        const items = await this.prisma.cloneTaskItem.findMany({
            where: { taskId },
            select: { status: true },
        });

        const completedCount = items.filter((i) => i.status === 'COMPLETED').length;
        const failedCount = items.filter((i) => i.status === 'FAILED').length;
        const skippedCount = items.filter((i) => i.status === 'SKIPPED').length;

        let status: string;
        if (failedCount === 0 && skippedCount === 0) {
            status = 'COMPLETED';
        } else if (completedCount === 0 && skippedCount === 0) {
            status = 'FAILED';
        } else if (completedCount === 0) {
            status = 'FAILED';
        } else {
            status = 'PARTIAL';
        }

        await this.prisma.cloneTask.update({
            where: { id: taskId },
            data: { status, finishedAt: new Date() },
        });

        this.logger.log(`克隆任务完成: taskId=${Number(taskId)} status=${status} completed=${completedCount} failed=${failedCount} skipped=${skippedCount}`);

        // 清理历史任务
        await this.cleanOldTasks();
    }

    /**
     * 查询任务进度
     *
     * 根据子项的实际状态实时计算各项数量，避免计数器不一致问题。
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

        // 根据子项实际状态实时计算数量
        const completedItems = task.items.filter((i) => i.status === 'COMPLETED').length;
        const failedItems = task.items.filter((i) => i.status === 'FAILED').length;
        const skippedItems = task.items.filter((i) => i.status === 'SKIPPED').length;
        const total = task.items.length;
        const processed = completedItems + failedItems + skippedItems;

        // 根据子项状态实时计算任务状态
        let status = task.status;
        if (task.status !== 'PROCESSING' && task.status !== 'PENDING') {
            if (failedItems === 0 && skippedItems === 0 && completedItems === total) {
                status = 'COMPLETED';
            } else if (completedItems === 0 && skippedItems === 0) {
                status = 'FAILED';
            } else if (completedItems > 0 && (failedItems > 0 || skippedItems > 0)) {
                status = 'PARTIAL';
            }
        }

        const failedDetails = task.items
            .filter((i) => i.status === 'FAILED')
            .map((i) => ({ fullName: i.fullName, error: i.errorMessage }));

        const skippedDetails = task.items
            .filter((i) => i.status === 'SKIPPED')
            .map((i) => ({ fullName: i.fullName }));

        return {
            success: true,
            taskId: Number(task.id),
            status,
            targetDir: task.targetDir,
            concurrency: task.concurrency,
            totalItems: total,
            completedItems,
            failedItems,
            skippedItems,
            progress: total > 0 ? Math.round((processed * 100) / total) : 0,
            createdAt: task.createdAt?.toISOString(),
            startedAt: task.startedAt?.toISOString(),
            finishedAt: task.finishedAt?.toISOString(),
            failedDetails,
            skippedDetails,
            allItems: task.items,
        };
    }

    /**
     * 重试失败项和跳过项
     *
     * 将所有 FAILED 和 SKIPPED 状态的子项重置为 PENDING，重新执行。
     * 重试前会删除原目录。
     */
    async retryFailed(taskId: number) {
        const items = await this.prisma.cloneTaskItem.findMany({
            where: {
                taskId: BigInt(taskId),
                status: { in: ['FAILED', 'SKIPPED'] },
            },
        });

        if (!items.length) return { success: false, message: '没有需要重试的项' };

        // 统计各类数量（用于日志）
        const failedCount = items.filter((i) => i.status === 'FAILED').length;
        const skippedCount = items.filter((i) => i.status === 'SKIPPED').length;

        // 删除原目录
        for (const item of items) {
            await this.removeCloneDir(item.localPath);
        }

        // 重置状态为 PENDING
        await this.prisma.cloneTaskItem.updateMany({
            where: {
                taskId: BigInt(taskId),
                status: { in: ['FAILED', 'SKIPPED'] },
            },
            data: { status: 'PENDING', errorMessage: null, retryCount: { increment: 1 } },
        });

        // 重置任务状态为 PENDING（让调度器重新 pick up）
        // 注意：不再更新计数器，getTaskProgress 会根据子项状态实时计算
        await this.prisma.cloneTask.update({
            where: { id: BigInt(taskId) },
            data: {
                status: 'PENDING',
                startedAt: null,
                finishedAt: null,
            },
        });

        this.logger.log(`克隆任务重试: taskId=${taskId} failed=${failedCount} skipped=${skippedCount}`);
        return { success: true, taskId, message: `已重置 ${items.length} 项（失败${failedCount}，跳过${skippedCount}）` };
    }

    /**
     * 重试单个克隆项
     *
     * @param taskId 任务 ID
     * @param fullName 仓库全名（如 owner/repo）
     * 重试前会删除原目录（不论是否存在）
     */
    async retryItem(taskId: number, fullName: string) {
        const item = await this.prisma.cloneTaskItem.findFirst({
            where: { taskId: BigInt(taskId), fullName },
        });

        if (!item) return { success: false, message: '未找到该任务项' };

        if (item.status === 'PROCESSING') {
            return { success: false, message: '任务正在执行中，无法重试' };
        }

        // 删除原目录
        await this.removeCloneDir(item.localPath);

        // 更新状态为 PENDING
        await this.prisma.cloneTaskItem.update({
            where: { id: item.id },
            data: { status: 'PENDING', errorMessage: null, retryCount: { increment: 1 } },
        });

        // 重置任务状态为 PENDING（让调度器重新 pick up）
        await this.prisma.cloneTask.update({
            where: { id: BigInt(taskId) },
            data: { status: 'PENDING', startedAt: null, finishedAt: null },
        });

        this.logger.log(`克隆项重试: taskId=${taskId} fullName=${fullName}`);
        return { success: true, message: `已重置 ${fullName}，等待重新执行` };
    }

    /**
     * 删除克隆目录（安全操作，忽略不存在的情况）
     */
    private async removeCloneDir(localPath: string | null) {
        if (!localPath) return;

        try {
            if (fs.existsSync(localPath)) {
                fs.rmSync(localPath, { recursive: true, force: true });
                this.logger.log(`已删除克隆目录: ${localPath}`);
            }
        } catch (e: any) {
            this.logger.warn(`删除克隆目录失败: ${localPath}`, e.message);
        }
    }

    /**
     * 获取最近任务列表
     *
     * 根据子项的实际状态实时计算各项数量。
     */
    async getRecentTasks() {
        const tasks = await this.prisma.cloneTask.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                items: {
                    select: { status: true },
                },
            },
        });

        return {
            success: true,
            tasks: tasks.map((t) => {
                const completedItems = t.items.filter((i) => i.status === 'COMPLETED').length;
                const failedItems = t.items.filter((i) => i.status === 'FAILED').length;
                const skippedItems = t.items.filter((i) => i.status === 'SKIPPED').length;
                const total = t.items.length;

                // 根据子项状态实时计算任务状态
                let status = t.status;
                if (t.status !== 'PROCESSING' && t.status !== 'PENDING') {
                    if (failedItems === 0 && skippedItems === 0 && completedItems === total) {
                        status = 'COMPLETED';
                    } else if (completedItems === 0 && skippedItems === 0) {
                        status = 'FAILED';
                    } else if (completedItems > 0 && (failedItems > 0 || skippedItems > 0)) {
                        status = 'PARTIAL';
                    }
                }

                return {
                    taskId: Number(t.id),
                    status,
                    targetDir: t.targetDir,
                    concurrency: t.concurrency,
                    totalItems: total,
                    completedItems,
                    failedItems,
                    skippedItems,
                    createdAt: t.createdAt?.toISOString(),
                    startedAt: t.startedAt?.toISOString(),
                    finishedAt: t.finishedAt?.toISOString(),
                };
            }),
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
