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

    /**
     * 获取信号量许可
     *
     * 若当前并发数未达上限则立即放行，否则加入等待队列。
     */
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
    /**
     * 释放信号量许可
     *
     * 递减并发计数，并唤醒队列中第一个等待的任务。
     */
    private release() {
        this.semaphore--;
        this.waitQueue.shift()?.();
    }

    /**
     * 清理历史翻译任务
     *
     * 保留最近 10 条已完成/失败/部分完成的任务，删除更早的任务及其子项。
     */
    private async cleanOld() {
        const old = await this.prisma.translationTask.findMany({
            where: { status: { in: ['COMPLETED', 'FAILED', 'PARTIAL'] } },
            orderBy: { createdAt: 'desc' },
            skip: 10,
            take: 1000,
            select: { id: true },
        });
        if (old.length > 0) {
            this.logger.log(`清理 ${old.length} 条历史翻译任务`);
        }
        for (const t of old) {
            await this.prisma.translationTaskItem.deleteMany({ where: { taskId: t.id } });
            await this.prisma.translationTask.delete({ where: { id: t.id } });
        }
    }

    /**
     * 处理单个翻译子项，带指数退避重试 + 原子状态记录
     *
     * 最多重试 MAX_ATTEMPTS 次，限流时等待 60s，其余错误使用指数退避。
     * 成功或最终失败后通过 Prisma 事务更新子项状态并递增父任务计数器。
     *
     * @param item 翻译子项记录（含 id、repoId、translateType、taskId 等字段）
     */
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
                        const rStr = (r as any) as string;
                        if (rStr === '__NO_README__') {
                            success = true;
                            resultNote = '该仓库没有 README 文件';
                        } else if (rStr.startsWith('__NO_README__|')) {
                            success = true;
                            const ghBody = rStr.substring('__NO_README__|'.length);
                            resultNote = '该仓库没有 README 文件\nGitHub 响应: ' + ghBody;
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

    /**
     * 完成任务并设置最终状态
     *
     * 根据 failedItems 计数判断:
     * - 全部成功 → COMPLETED
     * - 全部失败 → FAILED
     * - 部分成功 → PARTIAL
     *
     * @param taskId 翻译任务 ID
     */
    private async finishTask(taskId: bigint) {
        const task = await this.prisma.translationTask.findUnique({ where: { id: taskId } });
        if (!task) return;
        const status = task.failedItems > 0 ? (task.completedItems > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETED';
        await this.prisma.translationTask.update({
            where: { id: taskId },
            data: { status, finishedAt: new Date() },
        });
        this.logger.log(`翻译任务完成: taskId=${taskId} status=${status} completed=${task.completedItems} failed=${task.failedItems}`);
    }

    /**
     * 检查 DeepSeek API Key 是否已配置
     *
     * @returns true 表示 API Key 已配置，可以正常调用翻译
     */
    async isApiKeyConfigured(): Promise<boolean> {
        return !!(await this.config.getValue('deepseek.api_key'));
    }

    /**
     * 异步启动翻译任务执行
     *
     * 以 fire-and-forget 方式启动: 先检查 API Key，然后并发处理所有 PENDING 子项，
     * 完成后调用 finishTask 标记终态。执行过程中捕获异常并直接标记任务失败。
     *
     * @param taskId 翻译任务 ID
     */
    private startTaskAsync(taskId: bigint) {
        (async () => {
            try {
                // P0-FIX: API Key 未配置时，直接标记任务失败，避免无意义的重试等待
                if (!(await this.isApiKeyConfigured())) {
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
                this.logger.log(`翻译任务开始执行: taskId=${taskId} pendingItems=${items.length}`);
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

    /**
     * 创建并启动单个仓库的 README 异步翻译任务
     *
     * @param repoId 仓库 ID
     * @returns 新创建的任务 ID，仓库不存在时返回 null
     */
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
        this.logger.log(`创建单仓库 README 翻译任务: taskId=${task.id} repoId=${repoId}`);
        return Number(task.id);
    }

    /**
     * 创建并启动单个仓库的 README 强制重新翻译任务
     *
     * 先重置仓库的 readmeFetched/readmeOriginal/readmeCn 字段，再创建翻译任务。
     *
     * @param repoId 仓库 ID
     * @returns 新创建的任务 ID，仓库不存在时返回 null
     */
    async createAndStartSingleReadmeForce(repoId: number) {
        await this.prisma.githubRepo.update({
            where: { id: BigInt(repoId) },
            data: { readmeFetched: false, readmeOriginal: null, readmeCn: null },
        });
        return this.createAndStartSingleReadme(repoId);
    }

    /**
     * 创建并启动全量 README 批量翻译任务
     *
     * 使用数据库 WHERE 条件过滤出所有未翻译 README 的仓库（而非 findAll + 内存过滤）。
     * 创建任务前会先清理旧任务。
     *
     * @returns 新创建的任务 ID，无待翻译项时返回 null
     */
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
        this.logger.log(`创建全量 README 批量翻译任务: taskId=${task.id} count=${need.length}`);
        return Number(task.id);
    }

    /**
     * 创建并启动全量翻译任务（描述 + README）
     *
     * 同时处理未翻译的描述和未 fetch 的 README，使用数据库 WHERE 条件过滤。
     * 创建任务前会先清理旧任务。
     *
     * @returns 新创建的任务 ID，无待翻译项时返回 null
     */
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
        this.logger.log(`创建全量翻译任务: taskId=${task.id} descCount=${needDesc.length} readmeCount=${needReadme.length}`);
        return Number(task.id);
    }

    /**
     * 创建并启动筛选条件批量翻译任务
     *
     * 根据前端传入的筛选条件（关键词、语言、分类、日期等）查询仓库并创建批量翻译子任务。
     * 仅翻译 README 类型。
     *
     * @param params 筛选条件对象
     * @returns 新创建的任务 ID，无符合条件仓库时返回 null
     */
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
        this.logger.log(`创建筛选批量翻译任务: taskId=${task.id} count=${repos.length}`);
        return Number(task.id);
    }

    /**
     * 查询翻译任务进度
     *
     * 返回任务状态、各类计数器、已完成/失败子项明细（含备注信息）。
     *
     * @param taskId 翻译任务 ID
     * @returns 任务进度详情，任务不存在时返回 { success: false, message: '任务不存在' }
     */
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

    /**
     * 重试任务中所有失败的子项
     *
     * 从旧任务中取出 status='FAILED' 的子项，为新任务重新创建一批 PENDING 子项并启动。
     *
     * @param taskId 原翻译任务 ID
     * @returns 新创建的任务 ID，无失败项时返回 null
     */
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
        this.logger.log(`创建重试翻译任务: newTaskId=${task.id} failedCount=${items.length}`);
        return Number(task.id);
    }

    /**
     * 获取任务中的所有失败子项
     *
     * @param taskId 翻译任务 ID
     * @returns { success: true, failures: 失败子项列表, count: 失败数量 }
     */
    async getFailures(taskId: number) {
        const items = await this.prisma.translationTaskItem.findMany({ where: { taskId: BigInt(taskId), status: 'FAILED' } });
        return { success: true, failures: items, count: items.length };
    }

    /**
     * 获取最近的翻译任务列表（最多 20 条）
     *
     * @returns { success: true, tasks: 任务摘要列表 }
     */
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
