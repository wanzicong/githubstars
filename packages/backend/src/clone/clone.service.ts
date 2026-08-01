import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { CreateCloneTaskDto } from './clone.dto';
import { SYSTEM_FORBIDDEN_PREFIXES } from '../common/constants/system.constants';
import { TASK_TIMEOUT_MS, ITEM_TIMEOUT_MS, SEMAPHORE_TIMEOUT_MS, MAX_HISTORY_TASKS, type MirrorSourceName } from './clone.constants';
import { CloneExecutorService } from './clone-executor.service';
import { CloneCleanupService } from './clone-cleanup.service';
import { withTimeout, getMirrorUrl } from './clone.utils';
import * as path from 'path';

/**
 * 克隆模块核心服务
 *
 * 负责克隆任务的创建、调度、进度追踪和信号量管理。
 * 实际的 Git 克隆操作委托给 CloneExecutorService，
 * 目录清理委托给 CloneCleanupService。
 *
 * @callers
 *   - CloneController — HTTP API 入口
 *   - CloneScheduler — 调度器
 *
 * @depends
 *   - PrismaService — 数据库操作
 *   - ConfigService — 配置读取
 *   - CloneExecutorService — Git 克隆执行
 *   - CloneCleanupService — 目录清理
 */
@Injectable()
export class CloneService {
    private readonly logger = new Logger(CloneService.name);

    /** 任务级运行锁：同时只执行一个克隆任务 */
    private running = false;
    /** 锁获取时间，用于检测锁是否卡住 */
    private lockAcquiredAt: Date | null = null;
    /** 当前正在执行的任务 ID（统一存 number，兼容 SQLite number / MySQL bigint） */
    private currentTaskId: number | null = null;
    /** 信号量并发控制 */
    private semaphore = 0;
    private maxConcurrent = 5;
    private waitQueue: Array<{ fn: () => void; cancelled: boolean }> = [];
    /** 当前任务的目标目录 */
    private targetDir: string | null = null;
    /** 任务代际计数器，用于隔离不同轮次的任务 */
    private generation = 0;
    /** 已由 processItem 超时处理过的子项 ID 集合 */
    private timeoutHandledItems = new Set<string>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly executor: CloneExecutorService,
        private readonly cleanup: CloneCleanupService,
    ) {}

    // ==================== 信号量管理 ====================

    private acquire(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.semaphore < this.maxConcurrent) {
                this.semaphore++;
                resolve();
            } else {
                const waiter = { fn: () => resolve(), cancelled: false };
                this.waitQueue.push(waiter);
                setTimeout(() => {
                    if (!waiter.cancelled) {
                        waiter.cancelled = true;
                        reject(new Error('信号量获取超时'));
                    }
                }, SEMAPHORE_TIMEOUT_MS);
            }
        });
    }

    private release() {
        this.semaphore = Math.max(0, this.semaphore - 1);
        this.drainWaitQueue();
    }

    private drainWaitQueue() {
        while (this.waitQueue.length > 0) {
            const waiter = this.waitQueue.shift()!;
            if (!waiter.cancelled) {
                this.semaphore++;
                queueMicrotask(waiter.fn);
                return;
            }
        }
    }

    private resetSemaphore(concurrency: number) {
        for (const waiter of this.waitQueue) waiter.cancelled = true;
        if (this.waitQueue.length > 0) {
            this.logger.warn(`重置信号量: 丢弃 ${this.waitQueue.length} 个等待中的请求`);
        }
        this.waitQueue = [];
        this.semaphore = 0;
        this.maxConcurrent = concurrency;
        this.timeoutHandledItems.clear();
    }

    // ==================== 任务创建 ====================

    /**
     * 创建克隆任务
     */
    async createTask(dto: CreateCloneTaskDto): Promise<{ success: boolean; taskId?: number; message?: string }> {
        const { repoIds, targetDir, concurrency, shallow, mirrorSource } = dto;

        const normalizedTargetDir = this.normalizeAndValidatePath(targetDir);
        if (!normalizedTargetDir) return { success: false, message: '目标目录必须是绝对路径' };
        const securityErr = this.checkSystemDirectory(targetDir);
        if (securityErr) return { success: false, message: securityErr };

        const repos = await this.queryReposByIds(repoIds);
        if (repos.length === 0) return { success: false, message: '未找到指定仓库' };

        const task = await this.prisma.cloneTask.create({
            data: {
                status: 'PENDING',
                targetDir: normalizedTargetDir,
                concurrency,
                shallow,
                mirrorSource: mirrorSource || 'direct',
                totalItems: repos.length,
                createdAt: new Date(),
            },
        });

        const validItems = this.buildCloneTaskItems(repos, task.id, normalizedTargetDir, mirrorSource);
        if (validItems.length === 0) {
            await this.prisma.cloneTask.delete({ where: { id: task.id } });
            return { success: false, message: '所有仓库的路径校验均失败' };
        }
        if (validItems.length < repos.length) {
            await this.prisma.cloneTask.update({ where: { id: task.id }, data: { totalItems: validItems.length } });
        }
        await this.prisma.cloneTaskItem.createMany({ data: validItems });

        this.logger.log(`克隆任务已创建: taskId=${Number(task.id)} repos=${validItems.length} target=${normalizedTargetDir}`);
        return { success: true, taskId: Number(task.id), message: `已创建克隆任务，共 ${validItems.length} 个仓库` };
    }

    private normalizeAndValidatePath(targetDir: string): string | null {
        if (!path.isAbsolute(targetDir)) return null;
        return path.normalize(targetDir).replace(/[\\/]$/, '');
    }

    private checkSystemDirectory(targetDir: string): string | null {
        const normalized = path.normalize(targetDir).replace(/[\\/]$/, '');
        const compareDir = normalized.toLowerCase().replace(/\\/g, '/');
        for (const prefix of SYSTEM_FORBIDDEN_PREFIXES) {
            if (compareDir === prefix || compareDir.startsWith(prefix + '/')) return `目标目录不能为系统关键目录: ${normalized}`;
        }
        return null;
    }

    private async queryReposByIds(repoIds: number[]) {
        return this.prisma.githubRepo.findMany({
            where: { id: { in: repoIds } },
            select: { id: true, fullName: true, htmlUrl: true },
        });
    }

    private buildCloneTaskItems(
        repos: Array<{ id: bigint; fullName: string | null }>,
        taskId: bigint,
        normalizedTargetDir: string,
        mirrorSource: string | undefined,
    ) {
        const items = repos.map((repo) => {
            const fullName = repo.fullName || '';
            const slashIdx = fullName.indexOf('/');
            const owner = slashIdx > 0 ? fullName.substring(0, slashIdx) : '';
            const repoName = slashIdx > 0 && slashIdx < fullName.length - 1 ? fullName.substring(slashIdx + 1) : '';
            const safeOwner = owner || 'unknown';
            const safeRepoName = repoName || 'unknown';
            const localPath = path.join(normalizedTargetDir, safeOwner, safeRepoName);
            if (!localPath.startsWith(normalizedTargetDir + path.sep) && localPath !== normalizedTargetDir) {
                this.logger.warn(`路径安全校验失败，跳过仓库: ${fullName} -> ${localPath}`);
                return null;
            }
            return {
                taskId,
                repoId: repo.id,
                fullName,
                cloneUrl:
                    mirrorSource && mirrorSource !== 'direct'
                        ? getMirrorUrl(`https://github.com/${safeOwner}/${safeRepoName}.git`, mirrorSource as MirrorSourceName)
                        : `https://github.com/${safeOwner}/${safeRepoName}.git`,
                localPath,
                status: 'PENDING' as const,
                retryCount: 0,
                createdAt: new Date(),
            };
        });
        return items.filter((i): i is NonNullable<typeof i> => i !== null);
    }

    // ==================== 任务调度 ====================

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
     * 任务执行入口（带超时保护和代际管理）
     */
    async executeTask(taskId: bigint) {
        if (this.running) {
            this.logger.warn(`executeTask 被跳过，running 锁已被持有: taskId=${Number(taskId)}`);
            return;
        }
        this.running = true;
        this.lockAcquiredAt = new Date();
        this.currentTaskId = Number(taskId);
        try {
            await withTimeout(
                this.executeTaskInner(taskId),
                TASK_TIMEOUT_MS,
                `克隆任务超时 (${TASK_TIMEOUT_MS / 60000}分钟): taskId=${Number(taskId)}`,
            );
        } catch (e: unknown) {
            this.logger.error(`克隆任务执行异常: taskId=${Number(taskId)}`, e);
            try {
                await this.prisma.cloneTask.update({ where: { id: taskId }, data: { status: 'FAILED', finishedAt: new Date() } });
            } catch {
                /* 忽略 */
            }
        } finally {
            if (this.currentTaskId === Number(taskId)) {
                this.running = false;
                this.lockAcquiredAt = null;
                this.currentTaskId = null;
            } else {
                this.logger.warn(`跳过旧任务锁释放: taskId=${Number(taskId)}, currentTaskId=${this.currentTaskId}`);
            }
        }
    }

    /**
     * 任务执行内部逻辑
     */
    private async executeTaskInner(taskId: bigint) {
        const task = await this.prisma.cloneTask.findUnique({ where: { id: taskId } });
        if (!task) return;
        this.targetDir = task.targetDir;
        await this.prisma.cloneTask.update({ where: { id: taskId }, data: { status: 'PROCESSING', startedAt: new Date() } });
        this.resetSemaphore(task.concurrency);

        const items = await this.prisma.cloneTaskItem.findMany({ where: { taskId, status: 'PENDING' } });
        const mirrorSource = (task.mirrorSource as MirrorSourceName) || 'direct';
        this.logger.log(
            `克隆任务开始执行: taskId=${Number(taskId)} pendingItems=${items.length} concurrency=${task.concurrency} mirrorSource=${mirrorSource}`,
        );

        const results = await Promise.allSettled(items.map((item) => this.processItem(item, task.shallow ?? true, mirrorSource)));
        const rejectedCount = results.filter((r) => r.status === 'rejected').length;
        if (rejectedCount > 0) {
            this.logger.warn(`executeTaskInner: ${rejectedCount} 个子项未处理`);
        }
        await this.finishTask(taskId);
    }

    // ==================== 子项处理 ====================

    /**
     * 处理单个克隆子项（带超时保护 + 代际隔离）
     */
    private async processItem(
        item: { id: bigint; fullName: string | null; localPath: string | null; cloneUrl: string | null },
        shallow: boolean,
        mirrorSource: MirrorSourceName = 'direct',
    ) {
        const capturedGen = this.generation;
        await this.acquire();
        let error: string | null = null;
        try {
            await withTimeout(
                this.processItemInner(item, shallow, mirrorSource, capturedGen),
                ITEM_TIMEOUT_MS,
                `子项处理超时 (${ITEM_TIMEOUT_MS / 60000}分钟): ${item.fullName}`,
            );
        } catch (e: unknown) {
            error = e instanceof Error ? e.message : String(e);
            this.logger.error(`子项处理异常: ${item.fullName}`, e);
        } finally {
            if (this.generation === capturedGen) {
                if (error !== null) {
                    this.timeoutHandledItems.add(String(item.id));
                    try {
                        await this.recordItemResult(item, false, error || '未知错误');
                    } catch (recordErr) {
                        this.logger.error('记录子项失败状态时出错', recordErr);
                    }
                }
                this.release();
            } else {
                this.logger.warn('跳过旧代际信号量释放');
            }
        }
    }

    /**
     * 子项处理内部逻辑
     */
    private async processItemInner(
        item: { id: bigint; fullName: string | null; localPath: string | null; cloneUrl: string | null },
        shallow: boolean,
        mirrorSource: MirrorSourceName = 'direct',
        capturedGen: number,
    ) {
        await this.prisma.cloneTaskItem.update({ where: { id: item.id }, data: { status: 'PROCESSING' } });
        const result = await this.executor.executeClone(item, shallow, mirrorSource, this.targetDir ?? undefined);

        if (this.generation !== capturedGen) {
            this.logger.warn('代际已变更，跳过状态写入: ' + item.fullName);
            return;
        }
        if (this.timeoutHandledItems.has(String(item.id))) {
            this.logger.warn(`子项 ${item.fullName} 已被 processItem 处理（超时），跳过写入`);
            return;
        }

        await this.recordItemResult(item, result.success, result.error);
    }

    /**
     * 记录子项结果
     */
    private async recordItemResult(item: { id: bigint; fullName: string | null }, success: boolean, error?: string) {
        await this.prisma.cloneTaskItem.update({
            where: { id: item.id },
            data: { status: success ? 'COMPLETED' : 'FAILED', errorMessage: success ? null : error, updatedAt: new Date() },
        });
    }

    // ==================== 任务完成 ====================

    /**
     * 完成任务并设置终态
     */
    private async finishTask(taskId: bigint) {
        const items = await this.prisma.cloneTaskItem.findMany({ where: { taskId }, select: { status: true } });
        const completedCount = items.filter((i) => i.status === 'COMPLETED').length;
        const failedCount = items.filter((i) => i.status === 'FAILED').length;
        const totalCount = items.length;
        const status = CloneService.computeFinalTaskStatus(completedCount, failedCount, totalCount);
        const skippedCount = totalCount - completedCount - failedCount;

        await this.prisma.cloneTask.update({
            where: { id: taskId },
            data: { status, finishedAt: new Date(), completedItems: completedCount, failedItems: failedCount, skippedItems: skippedCount },
        });
        this.logger.log(`克隆任务完成: taskId=${Number(taskId)} status=${status} completed=${completedCount} failed=${failedCount}`);

        try {
            await this.cleanOldTasks();
        } catch (e) {
            this.logger.error('清理历史任务失败', e);
        }
    }

    private static computeFinalTaskStatus(completedCount: number, failedCount: number, totalCount: number): string {
        const processedCount = completedCount + failedCount;
        if (processedCount === 0) return 'FAILED';
        if (failedCount === 0 && processedCount === totalCount) return 'COMPLETED';
        return 'PARTIAL';
    }

    // ==================== 进度查询 ====================

    /**
     * 查询任务进度
     */
    async getTaskProgress(taskId: number) {
        const task = await this.prisma.cloneTask.findUnique({
            where: { id: taskId },
            include: { items: { select: { fullName: true, status: true, localPath: true, errorMessage: true } } },
        });
        if (!task) return { success: false, message: '任务不存在' };

        const completedItems = task.items.filter((i) => i.status === 'COMPLETED').length;
        const failedItems = task.items.filter((i) => i.status === 'FAILED').length;
        const processingItems = task.items.filter((i) => i.status === 'PROCESSING').length;
        const total = task.items.length;
        const processed = completedItems + failedItems;
        let status = task.status;
        if (task.status !== 'PROCESSING' && task.status !== 'PENDING') {
            status = CloneService.computeFinalTaskStatus(completedItems, failedItems, total);
        }
        const progress = total > 0 ? Math.round((processed * 100) / total) : 0;

        return {
            success: true,
            taskId: Number(task.id),
            status,
            targetDir: task.targetDir,
            concurrency: task.concurrency,
            mirrorSource: task.mirrorSource,
            totalItems: total,
            completedItems,
            failedItems,
            processingItems,
            skippedItems: 0,
            progress,
            createdAt: task.createdAt?.toISOString(),
            startedAt: task.startedAt?.toISOString(),
            finishedAt: task.finishedAt?.toISOString(),
            failedDetails: task.items.filter((i) => i.status === 'FAILED').map((i) => ({ fullName: i.fullName, error: i.errorMessage })),
            skippedDetails: [],
            allItems: task.items,
        };
    }

    /**
     * 获取最近克隆任务列表
     */
    async getRecentTasks() {
        // ... keep existing getRecentTasks implementation
        const tasks = await this.prisma.cloneTask.findMany({
            orderBy: { createdAt: 'desc' },
            take: MAX_HISTORY_TASKS,
            select: {
                id: true,
                status: true,
                targetDir: true,
                concurrency: true,
                mirrorSource: true,
                totalItems: true,
                completedItems: true,
                failedItems: true,
                skippedItems: true,
                createdAt: true,
                startedAt: true,
                finishedAt: true,
            },
        });

        return {
            success: true,
            tasks: tasks.map((t) => ({
                taskId: Number(t.id),
                status: t.status,
                targetDir: t.targetDir,
                concurrency: t.concurrency,
                mirrorSource: t.mirrorSource,
                totalItems: t.totalItems,
                completedItems: t.completedItems,
                failedItems: t.failedItems,
                skippedItems: t.skippedItems ?? 0,
                createdAt: t.createdAt?.toISOString(),
                startedAt: t.startedAt?.toISOString(),
                finishedAt: t.finishedAt?.toISOString(),
            })),
        };
    }

    /**
     * 获取常用克隆目录列表
     */
    async getRecentDirectories() {
        const tasks = await this.prisma.cloneTask.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { targetDir: true },
        });
        const uniqueDirs = [...new Set(tasks.map((t) => t.targetDir).filter(Boolean))];
        return { success: true, directories: uniqueDirs };
    }

    // ==================== 重试与重置 ====================

    async retryFailed(taskId: number) {
        if (this.running) return { success: false, message: '当前有任务正在执行，请稍后再试' };

        const task = await this.prisma.cloneTask.findUnique({ where: { id: taskId }, select: { id: true, targetDir: true } });
        if (!task) return { success: false, message: '任务不存在' };

        const taskTargetDir = task.targetDir;
        const items = await this.prisma.cloneTaskItem.findMany({ where: { taskId: taskId, status: 'FAILED' } });
        if (!items.length) return { success: false, message: '没有需要重试的项' };

        for (const item of items) {
            await this.removeCloneDirFiles(item.localPath, taskTargetDir);
        }

        await this.prisma.$transaction([
            this.prisma.cloneTaskItem.updateMany({
                where: { taskId: taskId, status: 'FAILED' },
                data: { status: 'PENDING', errorMessage: null, retryCount: { increment: 1 } },
            }),
            this.prisma.cloneTask.update({
                where: { id: taskId },
                data: { status: 'PENDING', startedAt: null, finishedAt: null, completedItems: 0, failedItems: 0, skippedItems: 0 },
            }),
        ]);

        this.logger.log(`克隆任务重试: taskId=${taskId} failed=${items.length}`);
        return { success: true, taskId, message: `已重置 ${items.length} 项失败项` };
    }

    async retryItem(taskId: number, fullName: string) {
        if (this.running) return { success: false, message: '当前有任务正在执行，请稍后再试' };

        const [task, item] = await Promise.all([
            this.prisma.cloneTask.findUnique({ where: { id: taskId }, select: { id: true, targetDir: true } }),
            this.prisma.cloneTaskItem.findFirst({ where: { taskId: taskId, fullName } }),
        ]);
        if (!task) return { success: false, message: '任务不存在' };
        if (!item) return { success: false, message: '未找到该任务项' };
        if (item.status === 'PROCESSING') return { success: false, message: '任务正在执行中，无法重试' };

        await this.removeCloneDirFiles(item.localPath, task.targetDir);

        try {
            await this.prisma.$transaction(async (tx) => {
                const updated = await tx.cloneTaskItem.updateMany({
                    where: { id: item.id, status: { notIn: ['PROCESSING', 'PENDING'] } },
                    data: { status: 'PENDING', errorMessage: null, retryCount: { increment: 1 } },
                });
                if (updated.count === 0) throw new Error('任务项正在执行中或已是待执行状态，无法重试');
                await tx.cloneTask.update({
                    where: { id: taskId },
                    data: { status: 'PENDING', startedAt: null, finishedAt: null },
                });
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, message: msg };
        }
        this.logger.log(`克隆项重试: taskId=${taskId} fullName=${fullName}`);
        return { success: true, message: `已重置 ${fullName}，等待重新执行` };
    }

    async resetTask(taskId: number) {
        const task = await this.prisma.cloneTask.findUnique({
            where: { id: taskId },
            select: { id: true, status: true, targetDir: true },
        });
        if (!task) return { success: false, message: '任务不存在' };

        if (this.running && this.currentTaskId !== null && this.currentTaskId === taskId) {
            this.forceReleaseLock();
        } else if (this.running) {
            this.logger.warn(`重置操作跳过锁释放`);
        }

        const failedItems = await this.prisma.cloneTaskItem.findMany({
            where: { taskId: taskId, status: { not: 'COMPLETED' } },
            select: { id: true, localPath: true },
        });
        const taskTargetDir = task.targetDir;
        for (const item of failedItems) {
            if (item.localPath) await this.cleanup.removeCloneDir(item.localPath);
        }

        await this.prisma.$transaction([
            this.prisma.cloneTaskItem.updateMany({
                where: { taskId: taskId },
                data: { status: 'PENDING', errorMessage: null, retryCount: 0 },
            }),
            this.prisma.cloneTask.update({
                where: { id: taskId },
                data: { status: 'PENDING', startedAt: null, finishedAt: null, completedItems: 0, failedItems: 0, skippedItems: 0 },
            }),
        ]);

        this.logger.log(`克隆任务已重置: taskId=${taskId}`);
        return { success: true, taskId, message: '任务已重置' };
    }

    async deleteTask(taskId: number) {
        const task = await this.prisma.cloneTask.findUnique({
            where: { id: taskId },
            select: { id: true, status: true },
        });
        if (!task) return { success: false, message: '任务不存在' };

        if (this.running && this.currentTaskId === taskId) {
            this.forceReleaseLock();
        }

        try {
            await this.prisma.cloneTaskItem.deleteMany({ where: { taskId: taskId } });
            await this.prisma.cloneTask.delete({ where: { id: taskId } });
            this.logger.log(`克隆任务已删除: taskId=${taskId}`);
            return { success: true, message: '任务已删除' };
        } catch (e: unknown) {
            return { success: false, message: e instanceof Error ? e.message : '删除失败' };
        }
    }

    // ==================== 文件清理 ====================

    /**
     * 移除克隆目录文件（带目标目录安全校验）
     */
    private async removeCloneDirFiles(localPath: string | null, taskTargetDir?: string): Promise<void> {
        if (!localPath) return;
        const resolved = path.resolve(localPath);
        const target = taskTargetDir ? path.resolve(taskTargetDir) : this.targetDir;
        if (target && !resolved.startsWith(target + path.sep) && resolved !== target) return; // 安全校验
        await this.cleanup.cleanFailedCloneDir(localPath);
    }

    // ==================== 锁管理 ====================

    isRunning(): boolean {
        return this.running;
    }

    getLockAge(): number | null {
        if (!this.lockAcquiredAt) return null;
        return Date.now() - this.lockAcquiredAt.getTime();
    }

    getCurrentTaskId(): number | null {
        return this.currentTaskId;
    }

    forceReleaseLock() {
        this.generation++;
        this.running = false;
        this.lockAcquiredAt = null;
        this.currentTaskId = null;
        this.resetSemaphore(this.maxConcurrent);
        this.logger.warn('running 锁已被强制释放');
    }

    // ==================== 历史清理 ====================

    private async cleanOldTasks() {
        const old = await this.prisma.cloneTask.findMany({
            where: { status: { in: ['COMPLETED', 'FAILED', 'PARTIAL'] } },
            orderBy: { createdAt: 'desc' },
            skip: MAX_HISTORY_TASKS,
            take: 1000,
            select: { id: true },
        });
        for (const t of old) {
            await this.prisma.cloneTaskItem.deleteMany({ where: { taskId: t.id } });
            await this.prisma.cloneTask.delete({ where: { id: t.id } });
        }
    }
}
