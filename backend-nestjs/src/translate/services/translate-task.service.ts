import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubRepoService } from '../../github/services/github-repo.service';
import { TranslateService } from './translate.service';
import { ConfigService } from '../../config/config.service';

/** P2-FIX: 重命名为 MAX_ATTEMPTS (实际尝试次数，含首次) */
const MAX_ATTEMPTS = 4;
const MAX_CONCURRENT = 10;
const RATE_LIMIT_BACKOFF_MS = 60_000; // 限流时等待 60s

@Injectable()
export class TranslateTaskService {
    private readonly logger = new Logger(TranslateTaskService.name);
    private semaphore = 0;
    private waitQueue: Array<() => void> = [];

    constructor(
        private readonly prisma: PrismaService,
        private readonly githubRepo: GithubRepoService,
        private readonly translate: TranslateService,
        private readonly config: ConfigService,
    ) {}

    private acquire(): Promise<void> {
        return new Promise((resolve) => {
            if (this.semaphore < MAX_CONCURRENT) {
                this.semaphore++;
                resolve();
            } else
                this.waitQueue.push(() => {
                    this.semaphore++;
                    resolve();
                });
        });
    }
    private release() {
        this.semaphore--;
        this.waitQueue.shift()?.();
    }

    private async cleanOld() {
        const old = await this.prisma.translationTask.findMany({
            where: { status: { in: ['COMPLETED', 'FAILED', 'PARTIAL'] } },
            orderBy: { createdAt: 'desc' },
            skip: 10,
            take: 1000,
            select: { id: true },
        });
        for (const t of old) {
            await this.prisma.translationTaskItem.deleteMany({ where: { taskId: t.id } });
            await this.prisma.translationTask.delete({ where: { id: t.id } });
        }
    }

    /** 处理单个翻译项，带重试 + 状态记录 */
    private async processItem(item: any) {
        await this.acquire();
        try {
            let success = false,
                attempts = 0,
                resultNote = '';

            while (attempts < MAX_ATTEMPTS && !success) {
                if (attempts > 0) {
                    const isRateLimited = resultNote.toLowerCase().includes('rate limit');
                    const delay = isRateLimited ? RATE_LIMIT_BACKOFF_MS : Math.pow(2, attempts) * 1000;
                    this.logger.warn(`翻译重试 item=${item.id} attempt=${attempts}/${MAX_ATTEMPTS} delay=${delay}ms`);
                    await new Promise((r) => setTimeout(r, delay));
                }

                await this.prisma.translationTaskItem.update({ where: { id: item.id }, data: { status: 'PROCESSING' } });

                try {
                    const repoId = Number(item.repoId);
                    if (item.translateType === 'description') {
                        const r = await this.translate.translateDescription(repoId);
                        if (r !== null && (r as any) !== '__RATE_LIMITED__') {
                            success = true;
                            resultNote = '翻译成功';
                        } else resultNote = r === ('__RATE_LIMITED__' as any) ? 'DeepSeek API 限流' : '翻译返回空结果';
                    } else {
                        const r = await this.translate.translateReadme(repoId);
                        if ((r as any) === '__NO_README__') {
                            success = true;
                            resultNote = '该仓库没有 README 文件';
                        } else if (r !== null && (r as any) !== '__RATE_LIMITED__') {
                            success = true;
                            resultNote = '翻译成功';
                        } else {
                            resultNote = r === ('__RATE_LIMITED__' as any) ? 'DeepSeek API 限流' : '翻译返回空结果';
                        }
                    }
                } catch (e) {
                    resultNote = e instanceof Error ? e.message : String(e);
                    this.logger.error(`翻译失败 r${attempts}: ${resultNote}`);
                }
                if (!success) attempts++;
            }

            if (success) {
                // 成功时也保存 resultNote，让前端能感知"翻译成功"还是"没有 README"
                await this.prisma.$transaction([
                    this.prisma.translationTaskItem.update({
                        where: { id: item.id },
                        data: { status: 'SUCCESS', errorMessage: resultNote, updatedAt: new Date() },
                    }),
                ]);
                const task = await this.prisma.translationTask.findUnique({ where: { id: item.taskId } });
                if (task) {
                    const upd: any = { completedItems: (task.completedItems || 0) + 1 };
                    if (item.translateType === 'description') upd.descCompleted = (task.descCompleted || 0) + 1;
                    else upd.readmeCompleted = (task.readmeCompleted || 0) + 1;
                    await this.prisma.translationTask.update({ where: { id: item.taskId }, data: upd });
                }
            } else {
                await this.prisma.$transaction([
                    this.prisma.translationTaskItem.update({
                        where: { id: item.id },
                        data: { status: 'FAILED', errorMessage: resultNote, retryCount: attempts, updatedAt: new Date() },
                    }),
                ]);
                const task = await this.prisma.translationTask.findUnique({ where: { id: item.taskId } });
                if (task) {
                    const upd: any = { failedItems: (task.failedItems || 0) + 1 };
                    if (item.translateType === 'description') upd.descFailed = (task.descFailed || 0) + 1;
                    else upd.readmeFailed = (task.readmeFailed || 0) + 1;
                    await this.prisma.translationTask.update({ where: { id: item.taskId }, data: upd });
                }
            }
        } finally {
            this.release();
        }
    }

    /** P0-FIX: 根据 failedItems 设置真实的最终状态 */
    private async finishTask(taskId: bigint) {
        const task = await this.prisma.translationTask.findUnique({ where: { id: taskId } });
        if (!task) return;
        const status = task.failedItems > 0 ? (task.completedItems > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETED';
        await this.prisma.translationTask.update({
            where: { id: taskId },
            data: { status, finishedAt: new Date() },
        });
    }

    /** 检查 DeepSeek API Key 是否已配置 */
    isApiKeyConfigured(): boolean {
        return !!this.config.getValue('deepseek.api_key');
    }

    private startTaskAsync(taskId: bigint) {
        (async () => {
            try {
                // P0-FIX: API Key 未配置时，直接标记任务失败，避免无意义的重试等待
                if (!this.isApiKeyConfigured()) {
                    this.logger.error('DeepSeek API Key 未配置，任务直接失败');
                    await this.prisma.translationTaskItem.updateMany({
                        where: { taskId },
                        data: { status: 'FAILED', errorMessage: 'DeepSeek API Key 未配置' },
                    });
                    await this.prisma.translationTask.update({ where: { id: taskId }, data: { status: 'FAILED', finishedAt: new Date() } });
                    return;
                }
                const task = await this.prisma.translationTask.findUnique({ where: { id: taskId } });
                if (!task) return;
                await this.prisma.translationTask.update({ where: { id: taskId }, data: { status: 'PROCESSING' } });
                const items = await this.prisma.translationTaskItem.findMany({ where: { taskId, status: 'PENDING' } });
                await Promise.all(items.map((i) => this.processItem(i)));
                await this.finishTask(taskId);
            } catch (e) {
                this.logger.error('任务执行异常', e);
                try {
                    await this.prisma.translationTask.update({ where: { id: taskId }, data: { status: 'FAILED', finishedAt: new Date() } });
                } catch {}
            }
        })().catch((e) => this.logger.error(e));
    }

    async createAndStartSingleReadme(repoId: number) {
        const repo = await this.githubRepo.findById(repoId);
        if (!repo) return null;
        const task = await this.prisma.translationTask.create({
            data: { status: 'PENDING', totalItems: 1, readmeTotal: 1, createdAt: new Date() },
        });
        await this.prisma.translationTaskItem.create({
            data: {
                taskId: task.id,
                repoId: BigInt(repoId),
                fullName: repo.fullName,
                translateType: 'readme',
                status: 'PENDING',
                retryCount: 0,
                createdAt: new Date(),
            },
        });
        this.startTaskAsync(task.id);
        return Number(task.id);
    }

    async createAndStartSingleReadmeForce(repoId: number) {
        await this.prisma.githubRepo.update({
            where: { id: BigInt(repoId) },
            data: { readmeFetched: false, readmeOriginal: null, readmeCn: null },
        });
        return this.createAndStartSingleReadme(repoId);
    }

    /** P2-FIX: 使用数据库 WHERE 条件过滤，而不是 findAll + 内存 filter */
    async createAndStartReadmeBatch() {
        await this.cleanOld();
        const need = await this.prisma.githubRepo.findMany({
            where: { OR: [{ readmeCn: null }, { readmeCn: '' }] },
            select: { id: true, fullName: true },
        });
        if (!need.length) return null;
        const task = await this.prisma.translationTask.create({
            data: { status: 'PENDING', totalItems: need.length, readmeTotal: need.length, createdAt: new Date() },
        });
        await this.prisma.translationTaskItem.createMany({
            data: need.map((r: any) => ({
                taskId: task.id,
                repoId: r.id,
                fullName: r.fullName,
                translateType: 'readme',
                status: 'PENDING',
                retryCount: 0,
                createdAt: new Date(),
            })),
        });
        this.startTaskAsync(task.id);
        return Number(task.id);
    }

    /** P2-FIX: 使用数据库 WHERE 条件过滤 */
    async createAndStartFullTranslate() {
        await this.cleanOld();
        const [needDesc, needReadme] = await Promise.all([
            this.prisma.githubRepo.findMany({
                where: {
                    description: { not: null },
                    AND: [{ description: { not: '' } }, { OR: [{ descriptionCn: null }, { descriptionCn: '' }] }],
                },
                select: { id: true, fullName: true },
            }),
            this.prisma.githubRepo.findMany({ where: { readmeFetched: false }, select: { id: true, fullName: true } }),
        ]);
        if (!needDesc.length && !needReadme.length) return null;
        const task = await this.prisma.translationTask.create({
            data: {
                status: 'PENDING',
                totalItems: needDesc.length + needReadme.length,
                descTotal: needDesc.length,
                readmeTotal: needReadme.length,
                createdAt: new Date(),
            },
        });
        const descItems = needDesc.map((r: any) => ({
            taskId: task.id,
            repoId: r.id,
            fullName: r.fullName,
            translateType: 'description',
            status: 'PENDING',
            retryCount: 0,
            createdAt: new Date(),
        }));
        const readmeItems = needReadme.map((r: any) => ({
            taskId: task.id,
            repoId: r.id,
            fullName: r.fullName,
            translateType: 'readme',
            status: 'PENDING',
            retryCount: 0,
            createdAt: new Date(),
        }));
        await this.prisma.translationTaskItem.createMany({ data: [...descItems, ...readmeItems] });
        this.startTaskAsync(task.id);
        return Number(task.id);
    }

    async createAndStartFilterBatch(params: {
        keyword?: string;
        language?: string;
        categoryIds?: string;
        sortBy?: string;
        sortOrder?: string;
        dateField?: string;
        startDate?: string;
        endDate?: string;
    }) {
        await this.cleanOld();
        const result = await this.githubRepo.findPage({ ...params, page: 1, size: 10000, untranslatedOnly: true });
        const repos = result.records as any[];
        if (!repos.length) return null;

        const task = await this.prisma.translationTask.create({
            data: { status: 'PENDING', totalItems: repos.length, readmeTotal: repos.length, descTotal: 0, createdAt: new Date() },
        });
        await this.prisma.translationTaskItem.createMany({
            data: repos.map((r: any) => ({
                taskId: task.id,
                repoId: r.id,
                fullName: r.fullName,
                translateType: 'readme',
                status: 'PENDING',
                retryCount: 0,
                createdAt: new Date(),
            })),
        });
        this.startTaskAsync(task.id);
        return Number(task.id);
    }

    async getTaskProgress(taskId: number) {
        const task = await this.prisma.translationTask.findUnique({ where: { id: BigInt(taskId) } });
        if (!task) return { success: false, message: '任务不存在' };
        const total = task.totalItems;
        const pending = total - task.completedItems - task.failedItems;

        // 获取已完成子项的备注，让前端看到每个仓库的实际状态
        const successItems = await this.prisma.translationTaskItem.findMany({
            where: { taskId: BigInt(taskId), status: 'SUCCESS' },
            select: { fullName: true, translateType: true, errorMessage: true },
        });
        const failedItems = await this.prisma.translationTaskItem.findMany({
            where: { taskId: BigInt(taskId), status: 'FAILED' },
            select: { fullName: true, translateType: true, errorMessage: true },
        });

        return {
            success: true,
            taskId: Number(task.id),
            status: task.status,
            totalItems: total,
            completedItems: task.completedItems,
            failedItems: task.failedItems,
            pendingItems: pending,
            descTotal: task.descTotal,
            descCompleted: task.descCompleted,
            descFailed: task.descFailed,
            readmeTotal: task.readmeTotal,
            readmeCompleted: task.readmeCompleted,
            readmeFailed: task.readmeFailed,
            createdAt: task.createdAt?.toISOString(),
            finishedAt: task.finishedAt?.toISOString(),
            progress: total > 0 ? Math.round(((task.completedItems + task.failedItems) * 100) / total) : 0,
            // 前端可直接展示的状态明细
            completedDetails: successItems.map((i) => ({ fullName: i.fullName, type: i.translateType, note: i.errorMessage })),
            failedDetails: failedItems.map((i) => ({ fullName: i.fullName, type: i.translateType, error: i.errorMessage })),
        };
    }

    async retryFailed(taskId: number) {
        const items = await this.prisma.translationTaskItem.findMany({ where: { taskId: BigInt(taskId), status: 'FAILED' } });
        if (!items.length) return null;
        const task = await this.prisma.translationTask.create({
            data: {
                status: 'PENDING',
                totalItems: items.length,
                descTotal: items.filter((i) => i.translateType === 'description').length,
                readmeTotal: items.filter((i) => i.translateType === 'readme').length,
                createdAt: new Date(),
            },
        });
        await this.prisma.translationTaskItem.createMany({
            data: items.map((i) => ({
                taskId: task.id,
                repoId: i.repoId,
                fullName: i.fullName,
                translateType: i.translateType,
                status: 'PENDING',
                retryCount: 0,
                createdAt: new Date(),
            })),
        });
        this.startTaskAsync(task.id);
        return Number(task.id);
    }

    async getFailures(taskId: number) {
        const items = await this.prisma.translationTaskItem.findMany({ where: { taskId: BigInt(taskId), status: 'FAILED' } });
        return { success: true, failures: items, count: items.length };
    }

    async getRecentTasks() {
        const tasks = await this.prisma.translationTask.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
        return {
            success: true,
            tasks: tasks.map((t) => ({
                taskId: Number(t.id),
                status: t.status,
                totalItems: t.totalItems,
                completedItems: t.completedItems,
                failedItems: t.failedItems,
                createdAt: t.createdAt?.toISOString(),
                finishedAt: t.finishedAt?.toISOString(),
            })),
        };
    }
}
