import { BadGatewayException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GithubRepoService } from '../github/github-repo.service';
import { AgentTranslationClientService } from './agent-translation-client.service';

export type LocalizationFields = 'description' | 'readme' | 'both';
export type FieldStatus = 'translated' | 'skipped' | 'missing';

export interface FieldResult {
    status: FieldStatus;
    characters: number;
}

interface TaskItem {
    id: bigint;
    taskId: bigint;
    repoId: bigint;
    translateType: string;
    fullName: string | null;
}

type LocalizableRepo = NonNullable<Awaited<ReturnType<GithubRepoService['findById']>>>;

@Injectable()
export class RepositoryLocalizationService implements OnModuleInit {
    private readonly logger = new Logger(RepositoryLocalizationService.name);
    private readonly runningTasks = new Set<string>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly githubRepo: GithubRepoService,
        private readonly translator: AgentTranslationClientService,
    ) {}

    async onModuleInit(): Promise<void> {
        try {
            const unfinished = await this.prisma.translationTask.findMany({
                where: { status: { in: ['PENDING', 'PROCESSING'] } },
                select: { id: true },
            });
            for (const task of unfinished) {
                await this.prisma.translationTaskItem.updateMany({
                    where: { taskId: task.id, status: 'PROCESSING' },
                    data: { status: 'PENDING', errorMessage: '服务重启后自动恢复' },
                });
                await this.recalculateTaskCounters(task.id);
                this.startTaskAsync(task.id, 2, false);
            }
            if (unfinished.length) this.logger.log(`已恢复 ${unfinished.length} 个未完成的仓库中文化任务`);
        } catch (error) {
            this.logger.warn(`恢复仓库中文化任务失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async localizeRepository(repoId: number, fields: LocalizationFields = 'both', force = false) {
        const repo = await this.githubRepo.findById(repoId);
        if (!repo) throw new NotFoundException(`仓库不存在: ${repoId}`);

        const result: {
            success: true;
            repoId: number;
            fullName: string | null;
            description?: FieldResult;
            readme?: FieldResult;
        } = { success: true, repoId, fullName: repo.fullName };

        if (fields === 'description' || fields === 'both') {
            result.description = await this.localizeDescription(repoId, repo, force);
        }

        if (fields === 'readme' || fields === 'both') {
            result.readme = await this.localizeReadme(repoId, repo, force);
        }

        return result;
    }

    private async localizeDescription(repoId: number, repo: LocalizableRepo, force: boolean): Promise<FieldResult> {
        if (!repo.description) return { status: 'missing', characters: 0 };
        if (repo.descriptionCn && !force) return { status: 'skipped', characters: repo.descriptionCn.length };

        const descriptionCn = await this.translator.translateDescription(repo.description);
        await this.prisma.githubRepo.update({
            where: { id: repoId },
            data: { descriptionCn, updatedAt: new Date() },
        });
        return { status: 'translated', characters: descriptionCn.length };
    }

    private async localizeReadme(repoId: number, initialRepo: LocalizableRepo, force: boolean): Promise<FieldResult> {
        if (initialRepo.readmeCn && !force) return { status: 'skipped', characters: initialRepo.readmeCn.length };

        let repo = initialRepo;
        if (!repo.readmeOriginal) {
            await this.githubRepo.ensureReadmeFetched(repoId);
            const refreshedRepo = await this.githubRepo.findById(repoId);
            if (!refreshedRepo) throw new NotFoundException(`仓库不存在: ${repoId}`);
            repo = refreshedRepo;
        }

        if (!repo.readmeOriginal) {
            if (!repo.readmeFetched) throw new BadGatewayException(`README 获取失败: ${repo.fullName ?? repoId}`);
            return { status: 'missing', characters: 0 };
        }

        const readmeCn = await this.translator.translateReadme(repo.readmeOriginal);
        await this.prisma.githubRepo.update({
            where: { id: repoId },
            data: { readmeCn, readmeFetched: true, updatedAt: new Date() },
        });
        return { status: 'translated', characters: readmeCn.length };
    }

    async createBatch(repoIds: number[], fields: LocalizationFields = 'both', force = false, concurrency = 2) {
        const uniqueIds = [...new Set(repoIds)];
        const repos = await this.githubRepo.findByIds(uniqueIds);
        const foundIds = new Set(repos.map((repo) => Number(repo.id)));
        const missingRepoIds = uniqueIds.filter((id) => !foundIds.has(id));
        const items: Array<{ repoId: number; fullName: string | null; translateType: string }> = [];

        for (const repo of repos) {
            const repoId = Number(repo.id);
            if ((fields === 'description' || fields === 'both') && repo.description && (force || !repo.descriptionCn)) {
                items.push({ repoId, fullName: repo.fullName, translateType: 'description' });
            }
            if ((fields === 'readme' || fields === 'both') && (force || !repo.readmeCn)) {
                items.push({ repoId, fullName: repo.fullName, translateType: 'readme' });
            }
        }

        if (!items.length) {
            return {
                success: true,
                taskId: null,
                totalItems: 0,
                missingRepoIds,
                message: '没有需要中文化的仓库字段',
            };
        }

        const descTotal = items.filter((item) => item.translateType === 'description').length;
        const readmeTotal = items.length - descTotal;
        const task = await this.prisma.translationTask.create({
            data: {
                status: 'PENDING',
                totalItems: items.length,
                descTotal,
                readmeTotal,
                createdAt: new Date(),
            },
        });
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

        this.startTaskAsync(task.id, concurrency, force);
        return {
            success: true,
            taskId: Number(task.id),
            totalItems: items.length,
            repositoryCount: repos.length,
            missingRepoIds,
        };
    }

    async getTask(taskId: number) {
        const task = await this.prisma.translationTask.findUnique({
            where: { id: taskId },
            include: { items: { orderBy: { id: 'asc' } } },
        });
        if (!task) throw new NotFoundException(`中文化任务不存在: ${taskId}`);
        const processedItems = task.completedItems + task.failedItems;
        return {
            ...task,
            progress: task.totalItems ? Math.round((processedItems / task.totalItems) * 100) : 100,
        };
    }

    async retryTask(taskId: number) {
        const task = await this.prisma.translationTask.findUnique({ where: { id: taskId } });
        if (!task) throw new NotFoundException(`中文化任务不存在: ${taskId}`);
        const failedItems = await this.prisma.translationTaskItem.count({ where: { taskId, status: 'FAILED' } });
        if (!failedItems) return { success: true, taskId, retriedItems: 0, message: '没有失败项需要重试' };

        await this.prisma.translationTaskItem.updateMany({
            where: { taskId, status: 'FAILED' },
            data: { status: 'PENDING', errorMessage: null },
        });
        await this.recalculateTaskCounters(BigInt(taskId));
        this.startTaskAsync(BigInt(taskId), 2, false);
        return { success: true, taskId, retriedItems: failedItems };
    }

    private startTaskAsync(taskId: bigint, concurrency: number, force: boolean): void {
        void this.runTask(taskId, concurrency, force).catch((error) => {
            this.logger.error(`中文化任务执行异常 taskId=${taskId}: ${error instanceof Error ? error.message : String(error)}`);
        });
    }

    private async runTask(taskId: bigint, concurrency: number, force: boolean): Promise<void> {
        const taskKey = taskId.toString();
        if (this.runningTasks.has(taskKey)) return;
        this.runningTasks.add(taskKey);

        try {
            await this.prisma.translationTask.update({ where: { id: taskId }, data: { status: 'PROCESSING', finishedAt: null } });
            const items = (await this.prisma.translationTaskItem.findMany({
                where: { taskId, status: 'PENDING' },
                orderBy: { id: 'asc' },
            })) as TaskItem[];

            let cursor = 0;
            const worker = async () => {
                while (cursor < items.length) {
                    const item = items[cursor++];
                    if (item) await this.processItem(item, force);
                }
            };
            await Promise.all(Array.from({ length: Math.min(Math.max(concurrency, 1), items.length || 1) }, worker));
            await this.finishTask(taskId);
        } catch (error) {
            await this.prisma.translationTask.update({
                where: { id: taskId },
                data: { status: 'FAILED', finishedAt: new Date() },
            });
            throw error;
        } finally {
            this.runningTasks.delete(taskKey);
        }
    }

    private async processItem(item: TaskItem, force: boolean): Promise<void> {
        await this.prisma.translationTaskItem.update({
            where: { id: item.id },
            data: { status: 'PROCESSING', updatedAt: new Date() },
        });

        try {
            const result = await this.localizeRepository(
                Number(item.repoId),
                item.translateType === 'description' ? 'description' : 'readme',
                force,
            );
            const fieldResult = item.translateType === 'description' ? result.description : result.readme;
            await this.prisma.translationTaskItem.update({
                where: { id: item.id },
                data: {
                    status: 'SUCCESS',
                    errorMessage: fieldResult?.status === 'missing' ? '原文不存在，已跳过' : '中文化成功',
                    updatedAt: new Date(),
                },
            });
            await this.prisma.translationTask.update({
                where: { id: item.taskId },
                data:
                    item.translateType === 'description'
                        ? { completedItems: { increment: 1 }, descCompleted: { increment: 1 } }
                        : { completedItems: { increment: 1 }, readmeCompleted: { increment: 1 } },
            });
        } catch (error) {
            const message = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
            await this.prisma.translationTaskItem.update({
                where: { id: item.id },
                data: {
                    status: 'FAILED',
                    errorMessage: message,
                    retryCount: { increment: 1 },
                    updatedAt: new Date(),
                },
            });
            await this.prisma.translationTask.update({
                where: { id: item.taskId },
                data:
                    item.translateType === 'description'
                        ? { failedItems: { increment: 1 }, descFailed: { increment: 1 } }
                        : { failedItems: { increment: 1 }, readmeFailed: { increment: 1 } },
            });
            this.logger.warn(`仓库中文化失败 ${item.fullName ?? item.repoId.toString()}: ${message}`);
        }
    }

    private async recalculateTaskCounters(taskId: bigint): Promise<void> {
        const [completedItems, failedItems, descCompleted, descFailed, readmeCompleted, readmeFailed] = await Promise.all([
            this.prisma.translationTaskItem.count({ where: { taskId, status: 'SUCCESS' } }),
            this.prisma.translationTaskItem.count({ where: { taskId, status: 'FAILED' } }),
            this.prisma.translationTaskItem.count({ where: { taskId, status: 'SUCCESS', translateType: 'description' } }),
            this.prisma.translationTaskItem.count({ where: { taskId, status: 'FAILED', translateType: 'description' } }),
            this.prisma.translationTaskItem.count({ where: { taskId, status: 'SUCCESS', translateType: 'readme' } }),
            this.prisma.translationTaskItem.count({ where: { taskId, status: 'FAILED', translateType: 'readme' } }),
        ]);
        await this.prisma.translationTask.update({
            where: { id: taskId },
            data: {
                completedItems,
                failedItems,
                descCompleted,
                descFailed,
                readmeCompleted,
                readmeFailed,
                status: 'PENDING',
                finishedAt: null,
            },
        });
    }

    private async finishTask(taskId: bigint): Promise<void> {
        const task = await this.prisma.translationTask.findUnique({ where: { id: taskId } });
        if (!task) return;
        let status = 'COMPLETED';
        if (task.failedItems > 0) status = task.completedItems === 0 ? 'FAILED' : 'PARTIAL';
        await this.prisma.translationTask.update({
            where: { id: taskId },
            data: { status, finishedAt: new Date() },
        });
        this.logger.log(`仓库中文化任务完成 taskId=${taskId} status=${status}`);
    }
}
