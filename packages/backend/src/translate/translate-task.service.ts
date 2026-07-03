import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GithubRepoService } from '../github/github-repo.service';
import { TranslateService } from './translate.service';
import { ConfigService } from '../config/config.service';
import { RATE_LIMITED, NO_README, MAX_ATTEMPTS, MAX_CONCURRENT, RATE_LIMIT_BACKOFF_MS } from '../common/constants/translate.constants';

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
     * 递减并发计数，并通过 queueMicrotask 安全唤醒队列中第一个等待的任务，
     * 避免回调异常影响 release 后续流程。
     */
    private release() {
        this.semaphore--;
        const next = this.waitQueue.shift();
        if (next) queueMicrotask(next);
    }

    /**
     * 清理历史翻译任务
     *
     * 保留最近 10 条已完成/失败/部分完成的任务，删除更早的任务及其子项。
     */
    private async cleanOldTasks() {
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
     */
    private async processItem(item: { id: bigint; repoId: bigint; taskId: bigint; fullName: string | null; translateType: string | null }) {
        await this.acquire();
        try {
            let success = false,
                attempts = 0,
                resultNote = '';

            while (attempts < MAX_ATTEMPTS && !success) {
                if (attempts > 0) {
                    const delay = this.calculateRetryDelay(resultNote, attempts);
                    this.logger.error(
                        `翻译重试 item=${item.id} attempt=${attempts}/${MAX_ATTEMPTS} delay=${delay}ms note=${resultNote.substring(0, 100)}`,
                    );
                    await new Promise((r) => setTimeout(r, delay));
                }
                await this.prisma.translationTaskItem.update({ where: { id: item.id }, data: { status: 'PROCESSING' } });
                const attempt = await this.executeTranslationAttempt(item);
                success = attempt.success;
                resultNote = attempt.resultNote;
                if (!success) attempts++;
            }

            if (success) {
                await this.recordItemSuccess(item, resultNote);
            } else {
                await this.recordItemFailure(item, attempts, resultNote);
            }
        } finally {
            this.release();
        }
    }

    /**
     * 执行单次翻译尝试
     */
    private async executeTranslationAttempt(item: {
        id: bigint;
        repoId: bigint;
        taskId: bigint;
        fullName: string | null;
        translateType: string | null;
    }): Promise<{ success: boolean; resultNote: string }> {
        try {
            const repoId = Number(item.repoId);
            if (item.translateType === 'description') {
                const r = await this.translate.translateDescription(repoId);
                if (r !== null && r !== RATE_LIMITED) return { success: true, resultNote: '翻译成功' };
                return { success: false, resultNote: r === RATE_LIMITED ? 'DeepSeek API 限流' : '翻译返回空结果' };
            }
            // README 翻译
            const r = await this.translate.translateReadme(repoId);
            const rStr = r as string;
            if (rStr === NO_README) return { success: true, resultNote: '该仓库没有 README 文件' };
            if (typeof rStr === 'string' && rStr.startsWith(NO_README + '|')) {
                return { success: true, resultNote: '该仓库没有 README 文件\nGitHub 响应: ' + rStr.substring((NO_README + '|').length) };
            }
            if (r !== null && r !== RATE_LIMITED) return { success: true, resultNote: '翻译成功' };
            return { success: false, resultNote: r === RATE_LIMITED ? 'DeepSeek API 限流' : '翻译返回空结果' };
        } catch (e) {
            const resultNote = e instanceof Error ? e.message : String(e);
            this.logger.error(`翻译失败: ${resultNote}`);
            return { success: false, resultNote };
        }
    }

    /**
     * 计算重试延迟时间
     */
    private calculateRetryDelay(resultNote: string, attempts: number): number {
        const noteLower = resultNote.toLowerCase();
        const isRateLimited = noteLower.includes('rate limit') || noteLower.includes('限流') || noteLower.includes('rate limited');
        return isRateLimited ? RATE_LIMIT_BACKOFF_MS : Math.pow(2, attempts) * 1000;
    }

    /**
     * 记录翻译子项成功结果，并原子更新父任务计数器
     */
    private async recordItemSuccess(
        item: { id: bigint; taskId: bigint; fullName: string | null; translateType: string | null },
        resultNote: string,
    ): Promise<void> {
        await this.prisma.translationTaskItem.update({
            where: { id: item.id },
            data: { status: 'SUCCESS', errorMessage: resultNote, updatedAt: new Date() },
        });
        const incrementData: Record<string, { increment: number }> = { completedItems: { increment: 1 } };
        if (item.translateType === 'description') incrementData.descCompleted = { increment: 1 };
        else incrementData.readmeCompleted = { increment: 1 };
        await this.prisma.translationTask.update({ where: { id: item.taskId }, data: incrementData });
    }

    /**
     * 记录翻译子项失败结果，并原子更新父任务计数器
     */
    private async recordItemFailure(
        item: { id: bigint; taskId: bigint; fullName: string | null; translateType: string | null },
        attempts: number,
        resultNote: string,
    ): Promise<void> {
        await this.prisma.translationTaskItem.update({
            where: { id: item.id },
            data: { status: 'FAILED', errorMessage: resultNote, retryCount: attempts, updatedAt: new Date() },
        });
        const incrementData: Record<string, { increment: number }> = { failedItems: { increment: 1 } };
        if (item.translateType === 'description') incrementData.descFailed = { increment: 1 };
        else incrementData.readmeFailed = { increment: 1 };
        await this.prisma.translationTask.update({ where: { id: item.taskId }, data: incrementData });
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
        let status: string;
        if (task.failedItems > 0) {
            status = task.completedItems > 0 ? 'PARTIAL' : 'FAILED';
        } else {
            status = 'COMPLETED';
        }
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

                // 分批处理，每批 500 个
                const BATCH_SIZE = 500;
                const totalBatches = Math.ceil(items.length / BATCH_SIZE);
                for (let bi = 0; bi < totalBatches; bi++) {
                    const batch = items.slice(bi * BATCH_SIZE, (bi + 1) * BATCH_SIZE);
                    this.logger.log(`翻译批次 ${bi + 1}/${totalBatches}: ${batch.length} 项`);
                    await Promise.all(batch.map((i) => this.processItem(i)));
                    this.logger.log(`翻译批次 ${bi + 1}/${totalBatches} 完成`);
                }

                await this.finishTask(taskId);
            } catch (e) {
                this.logger.error('任务执行异常', e);
                try {
                    await this.prisma.translationTask.update({ where: { id: taskId }, data: { status: 'FAILED', finishedAt: new Date() } });
                } catch (updateErr) {
                    this.logger.error('更新任务失败状态时出错', updateErr);
                }
            }
        })();
    }

    /**
     * 创建任务及子项并启动异步执行（模板方法）
     *
     * 统一封装 "创建 Task → 批量创建 Items → 启动异步执行 → 日志" 流程，
     * 消除 5 处重复的任务创建模式。
     *
     * @param taskData 任务创建数据（totalItems、descTotal、readmeTotal 等）
     * @param items 子项创建数据数组
     * @param logMessage 日志描述信息
     * @returns 新创建的任务 ID
     */
    private async createTaskWithItems(
        taskData: { totalItems: number; descTotal?: number; readmeTotal?: number },
        items: Array<{ repoId: number; fullName: string | null; translateType: string }>,
        logMessage: string,
    ): Promise<number> {
        const task = await this.prisma.translationTask.create({
            data: { status: 'PENDING', createdAt: new Date(), ...taskData },
        });
        if (items.length > 0) {
            await this.prisma.translationTaskItem.createMany({
                data: items.map((item) => ({
                    taskId: task.id,
                    repoId: item.repoId,
                    fullName: item.fullName,
                    translateType: item.translateType,
                    status: 'PENDING',
                    retryCount: 0,
                    createdAt: new Date(),
                })),
            });
        }
        this.startTaskAsync(task.id);
        this.logger.log(`${logMessage}: taskId=${task.id}`);
        return Number(task.id);
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
        return this.createTaskWithItems(
            { totalItems: 1, readmeTotal: 1 },
            [{ repoId: repoId, fullName: repo.fullName, translateType: 'readme' }],
            `创建单仓库 README 翻译任务 repoId=${repoId}`,
        );
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
            where: { id: repoId },
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
        await this.cleanOldTasks();
        const need = await this.prisma.githubRepo.findMany({
            where: { OR: [{ readmeCn: null }, { readmeCn: '' }] },
            select: { id: true, fullName: true },
        });
        if (!need.length) return null;
        return this.createTaskWithItems(
            { totalItems: need.length, readmeTotal: need.length },
            need.map((r) => ({ repoId: Number(r.id), fullName: r.fullName, translateType: 'readme' })),
            `创建全量 README 批量翻译任务 count=${need.length}`,
        );
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
        await this.cleanOldTasks();
        const [needDesc, needReadme] = await Promise.all([
            this.prisma.githubRepo.findMany({
                where: {
                    description: { not: null },
                    AND: [{ description: { not: '' } }, { OR: [{ descriptionCn: null }, { descriptionCn: '' }] }],
                },
                select: { id: true, fullName: true },
            }),
            // 修复 H3：同时包含 readmeFetched=false（未获取过）和 readmeFetched=true 但 readmeCn=null（翻译失败需重试）的仓库
            this.prisma.githubRepo.findMany({
                where: {
                    OR: [{ readmeFetched: false }, { AND: [{ readmeFetched: true }, { readmeCn: null }] }],
                },
                select: { id: true, fullName: true },
            }),
        ]);
        if (!needDesc.length && !needReadme.length) return null;
        const descItems = needDesc.map((r) => ({ repoId: Number(r.id), fullName: r.fullName, translateType: 'description' }));
        const readmeItems = needReadme.map((r) => ({ repoId: Number(r.id), fullName: r.fullName, translateType: 'readme' }));
        return this.createTaskWithItems(
            { totalItems: descItems.length + readmeItems.length, descTotal: descItems.length, readmeTotal: readmeItems.length },
            [...descItems, ...readmeItems],
            `创建全量翻译任务 descCount=${needDesc.length} readmeCount=${needReadme.length}`,
        );
    }

    /**
     * 创建并启动批量翻译任务（单次创建，非循环逐个任务）
     *
     * 用于 selected 模式下批量翻译指定仓库，避免为每个仓库创建独立任务。
     *
     * @param repoIds 仓库 ID 列表
     * @param type 翻译类型：readme / both
     * @returns 新创建的任务 ID，参数为空时返回 null
     */
    async createBatchTask(repoIds: number[], type: 'readme' | 'both'): Promise<number | null> {
        if (!repoIds.length) return null;
        const items: Array<{ repoId: number; fullName: string | null; translateType: string }> = [];
        let descTotal = 0;
        let readmeTotal = 0;

        if (type === 'readme') {
            for (const rid of repoIds) {
                items.push({ repoId: rid, fullName: null, translateType: 'readme' });
            }
            readmeTotal = repoIds.length;
        } else {
            for (const rid of repoIds) {
                items.push({ repoId: rid, fullName: null, translateType: 'description' });
                items.push({ repoId: rid, fullName: null, translateType: 'readme' });
            }
            descTotal = repoIds.length;
            readmeTotal = repoIds.length;
        }

        return this.createTaskWithItems(
            { totalItems: items.length, descTotal, readmeTotal },
            items,
            `创建批量翻译任务 repos=${repoIds.length} type=${type}`,
        );
    }

    /**
     * 创建并启动筛选条件批量翻译任务
     *
     * 根据前端传入的筛选条件（关键词、语言、分类、日期等）查询仓库并创建批量翻译子项。
     * 支持 description / readme / both 三种翻译类型。
     *
     * @param params 筛选条件对象
     * @param type 翻译类型，默认 readme
     * @returns 新创建的任务 ID，无符合条件仓库时返回 null
     */
    async createAndStartFilterBatch(
        params: {
            keyword?: string;
            language?: string;
            sortBy?: string;
            sortOrder?: string;
            dateField?: string;
            startDate?: string;
            endDate?: string;
        },
        type: 'description' | 'readme' | 'both' = 'readme',
    ) {
        await this.cleanOldTasks();
        const result = await this.githubRepo.findPage({ ...params, page: 1, size: 10000 });
        const repos = result.records as Array<{ id: bigint; fullName: string; description?: string; descriptionCn?: string }>;
        if (!repos.length) return null;

        let items: Array<{ repoId: number; fullName: string | null; translateType: string }> = [];
        let descTotal = 0;
        let readmeTotal = 0;

        if (type === 'description') {
            items = repos.map((r) => ({ repoId: Number(r.id), fullName: r.fullName, translateType: 'description' }));
            descTotal = repos.length;
        } else if (type === 'readme') {
            items = repos.map((r) => ({ repoId: Number(r.id), fullName: r.fullName, translateType: 'readme' }));
            readmeTotal = repos.length;
        } else {
            items = repos.flatMap((r) => [
                { repoId: Number(r.id), fullName: r.fullName, translateType: 'description' },
                { repoId: Number(r.id), fullName: r.fullName, translateType: 'readme' },
            ]);
            descTotal = repos.length;
            readmeTotal = repos.length;
        }

        return this.createTaskWithItems(
            { totalItems: items.length, readmeTotal, descTotal },
            items,
            `创建筛选批量翻译任务 type=${type} count=${repos.length}`,
        );
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
        const task = await this.prisma.translationTask.findUnique({ where: { id: taskId } });
        if (!task) return { success: false, message: '任务不存在' };
        const total = task.totalItems;
        const pending = total - task.completedItems - task.failedItems;

        // 获取已完成子项的备注，让前端看到每个仓库的实际状态
        const successItems = await this.prisma.translationTaskItem.findMany({
            where: { taskId: taskId, status: 'SUCCESS' },
            select: { fullName: true, translateType: true, errorMessage: true },
        });
        const failedItems = await this.prisma.translationTaskItem.findMany({
            where: { taskId: taskId, status: 'FAILED' },
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
        const items = await this.prisma.translationTaskItem.findMany({ where: { taskId: taskId, status: 'FAILED' } });
        if (!items.length) return null;
        const descCount = items.filter((i) => i.translateType === 'description').length;
        const readmeCount = items.filter((i) => i.translateType === 'readme').length;
        return this.createTaskWithItems(
            { totalItems: items.length, descTotal: descCount, readmeTotal: readmeCount },
            items.map((i) => ({ repoId: Number(i.repoId), fullName: i.fullName, translateType: i.translateType })),
            `创建重试翻译任务 failedCount=${items.length}`,
        );
    }

    /**
     * 获取任务中的所有失败子项
     *
     * @param taskId 翻译任务 ID
     * @returns { success: true, failures: 失败子项列表, count: 失败数量 }
     */
    async getFailures(taskId: number) {
        const items = await this.prisma.translationTaskItem.findMany({ where: { taskId: taskId, status: 'FAILED' } });
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
