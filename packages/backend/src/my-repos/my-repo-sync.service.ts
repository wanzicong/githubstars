import { Injectable, Logger } from '@nestjs/common';
import { SyncLog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GithubApiService } from '../github/github-api.service';
import { MyRepoService } from './my-repo.service';
import type { MappedRepoData } from '../github/repo-data.interface';

/** README 后台拉取并发上限（与 Star 同步保持一致） */
const README_SYNC_CONCURRENCY = 5;

/**
 * 我的仓库同步服务（业务逻辑层）
 *
 * 负责从 GitHub /user/repos 全量拉取用户自己创建的仓库并 upsert 到 my_repo 表。
 * 与 SyncService 的差异：
 * - 数据源为 owned repos（含私有），需 Token
 * - 只做 UPSERT 增量，不删除本地已有记录（保留翻译成果与分类绑定）
 * - 同步完成后后台并发拉取缺失 README
 *
 * 同步锁：进程内单实例布尔锁，防止并发同步写冲突。
 *
 * @depends GithubApiService / MyRepoService / PrismaService
 * @callers MyReposController.sync / MyReposController.syncStatus
 */
@Injectable()
export class MyRepoSyncService {
    private readonly logger = new Logger(MyRepoSyncService.name);
    private syncing = false;
    private syncStatus = '空闲';
    private lastSyncTime: Date | null = null;
    private lastSyncCount = 0;

    constructor(
        private readonly prisma: PrismaService,
        private readonly githubApi: GithubApiService,
        private readonly myRepoService: MyRepoService,
    ) {}

    /**
     * 获取当前同步锁状态
     */
    isSyncing() {
        return this.syncing;
    }

    /**
     * 手动触发同步（异步执行，不阻塞 HTTP 响应）
     *
     * @returns true=已受理，false=已有同步在进行
     */
    startManualSync(): boolean {
        if (this.syncing) {
            this.logger.error('我的仓库手动同步：已有同步任务在执行中，跳过');
            return false;
        }
        this.logger.log('我的仓库手动同步任务已启动');
        this.executeSync('我的仓库同步').catch((e: unknown) => this.logger.error('我的仓库同步异常', e));
        return true;
    }

    /**
     * 获取同步状态概览
     */
    async getSyncStatus() {
        const total = await this.prisma.myRepo.count();
        const lastOk = await this.prisma.syncLog.findFirst({
            where: { status: '成功', syncType: '我的仓库同步' },
            orderBy: { finishedAt: 'desc' },
        });
        return {
            syncing: this.syncing,
            status: this.syncStatus,
            lastSyncTime: this.lastSyncTime?.toISOString() || null,
            lastSyncCount: this.lastSyncCount,
            totalRepos: total,
            lastSuccessTime: lastOk?.finishedAt?.toISOString() || null,
            lastSuccessCount: lastOk?.syncedCount || 0,
        };
    }

    /**
     * 执行同步主流程
     *
     * 拉取远端 → upsert 本地 → 记录 SyncLog → 后台拉 README。
     * 不做删除同步：仓库在 GitHub 侧删除/改名后，本地保留快照。
     *
     * @param syncType 同步类型（写入 sync_log.sync_type）
     */
    private async executeSync(syncType: string) {
        if (this.syncing) {
            this.logger.error(`我的仓库同步锁已被持有，拒绝 ${syncType}`);
            return;
        }
        this.syncing = true;
        this.syncStatus = '同步中...';
        this.logger.log(`开始 ${syncType}（UPSERT 增量模式）`);

        let syncLog: SyncLog | null = null;
        try {
            syncLog = await this.prisma.syncLog.create({
                data: { syncType, status: '进行中', totalCount: 0, syncedCount: 0, startedAt: new Date(), createdAt: new Date() },
            });

            const remoteRepos = await this.githubApi.fetchAllOwnedRepos();
            const synced = await this.syncRemoteToLocal(remoteRepos);

            await this.prisma.syncLog.update({
                where: { id: syncLog.id },
                data: { status: '成功', totalCount: remoteRepos.length, syncedCount: synced, finishedAt: new Date() },
            });
            this.lastSyncTime = new Date();
            this.lastSyncCount = remoteRepos.length;
            this.syncStatus = `同步完成，共 ${remoteRepos.length} 个仓库`;
            this.logger.log(`${syncType} 完成: ${synced} 个仓库`);

            // 同步完成后，后台并发拉取缺失的 README
            this.fetchMissingReadmes().catch((e: unknown) => this.logger.error('我的仓库后台拉取 README 异常', e));
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (syncLog) {
                await this.prisma.syncLog.update({
                    where: { id: syncLog.id },
                    data: { status: '失败', errorMessage: msg, finishedAt: new Date() },
                });
            }
            this.syncStatus = '同步失败: ' + msg;
            this.logger.error(`${syncType} 失败: ${msg}`);
        } finally {
            this.syncing = false;
        }
    }

    /**
     * 将远端仓库数据 upsert 到本地
     *
     * @returns 成功 upsert 的数量
     */
    private async syncRemoteToLocal(remoteRepos: MappedRepoData[]): Promise<number> {
        let synced = 0;
        for (const data of remoteRepos) {
            if (!data.fullName) continue;
            try {
                // /user/repos 的 visibility=private 即私有仓库
                await this.myRepoService.upsertRepo(data, data.visibility === 'private');
                synced++;
            } catch (e) {
                this.logger.error(`upsert 我的仓库失败 ${data.fullName}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        return synced;
    }

    /**
     * 后台批量拉取缺失的 README 原文
     *
     * 并发上限 5，单条失败不影响其他仓库；
     * 仓库无 README 时标记 readmeFetched=true 避免重复请求。
     */
    private async fetchMissingReadmes(): Promise<void> {
        try {
            const missingRepos = await this.prisma.myRepo.findMany({
                where: { readmeFetched: false },
                select: { id: true, fullName: true },
            });

            if (missingRepos.length === 0) {
                this.logger.log('我的仓库 README 同步：均已获取过，跳过');
                return;
            }

            this.logger.log(`我的仓库 README 同步：开始拉取 ${missingRepos.length} 个仓库（并发 ${README_SYNC_CONCURRENCY}）`);
            const startTime = Date.now();
            let successCount = 0;
            let skipCount = 0;
            let errorCount = 0;

            const pool = new Set<Promise<void>>();
            for (const repo of missingRepos) {
                const task = this.fetchSingleReadme(repo)
                    .then((result) => {
                        if (result === 'success') successCount++;
                        else if (result === 'skip') skipCount++;
                        else errorCount++;
                    })
                    .catch(() => {
                        errorCount++;
                    });
                pool.add(task);
                task.finally(() => pool.delete(task));
                if (pool.size >= README_SYNC_CONCURRENCY) {
                    await Promise.race(pool);
                }
            }
            await Promise.all(pool);

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            this.logger.log(`我的仓库 README 同步完成：总计=${missingRepos.length}，成功=${successCount}，跳过=${skipCount}，失败=${errorCount}，耗时=${duration}s`);
        } catch (e) {
            this.logger.error('我的仓库 README 批量拉取出错', e);
        }
    }

    /**
     * 获取单个仓库的 README 并保存
     *
     * @returns 'success' 成功 | 'skip' 无 README | 'error' 失败
     */
    private async fetchSingleReadme(repo: { id: bigint; fullName: string | null }): Promise<'success' | 'skip' | 'error'> {
        if (!repo.fullName) return 'skip';
        try {
            const ghResult = await this.githubApi.fetchReadmeFromGitHub(repo.fullName);
            if (ghResult.content === null) {
                await this.prisma.myRepo.update({
                    where: { id: repo.id },
                    data: { readmeFetched: true, updatedAt: new Date() },
                });
                return 'skip';
            }
            await this.prisma.myRepo.update({
                where: { id: repo.id },
                data: { readmeOriginal: ghResult.content, readmeFetched: true, updatedAt: new Date() },
            });
            return 'success';
        } catch (e) {
            this.logger.error(`我的仓库 README 拉取失败：${repo.fullName} — ${e instanceof Error ? e.message : String(e)}`);
            return 'error';
        }
    }
}
