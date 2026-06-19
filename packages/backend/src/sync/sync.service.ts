import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GithubApiService } from '../github/services/github-api.service';
import { GithubRepoService } from '../github/services/github-repo.service';

@Injectable()
export class SyncService {
    private readonly logger = new Logger(SyncService.name);
    private syncing = false;
    private syncStatus = '空闲';
    private lastSyncTime: Date | null = null;
    private lastSyncCount = 0;

    constructor(
        private readonly prisma: PrismaService,
        private readonly githubApi: GithubApiService,
        private readonly githubRepo: GithubRepoService,
    ) {}

    /**
     * 执行同步
     * @param syncType 同步类型（手动/定时）
     * @param replace REPLACE 模式开关：true=全量替换，false=仅增量更新
     */
    async executeSync(syncType: string, replace: boolean = true) {
        if (this.syncing) {
            this.logger.warn(`同步锁已被持有，拒绝 ${syncType}`);
            return;
        }
        this.syncing = true;
        this.syncStatus = '同步中...';
        this.logger.log(`开始 ${syncType}: REPLACE=${replace}`);

        let syncLog: any = null;
        try {
            syncLog = await this.prisma.syncLog.create({
                data: { syncType, status: '进行中', totalCount: 0, syncedCount: 0, startedAt: new Date(), createdAt: new Date() },
            });

            const remoteRepos = await this.githubApi.fetchAllStarredRepos();
            const remoteMap = this.buildRemoteMap(remoteRepos);
            const localMap = await this.buildLocalMap();
            const synced = await this.syncRemoteToLocal(remoteMap, localMap);

            if (replace) {
                await this.deleteUnstarredRepos(remoteMap, localMap);
            } else {
                this.logger.log(`非 REPLACE 模式，跳过删除未Star仓库，本地 ${localMap.size} 个`);
            }

            await this.prisma.syncLog.update({
                where: { id: syncLog.id },
                data: { status: '成功', totalCount: remoteMap.size, syncedCount: synced, finishedAt: new Date() },
            });
            this.lastSyncTime = new Date();
            this.lastSyncCount = remoteMap.size;
            this.syncStatus = `同步完成，共 ${remoteMap.size} 个仓库`;
            this.logger.log(`${syncType} 完成: ${synced} 个仓库`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (syncLog) {
                await this.prisma.syncLog.update({
                    where: { id: syncLog.id },
                    data: { status: '失败', errorMessage: msg, finishedAt: new Date() },
                });
            }
            this.syncStatus = '同步失败: ' + msg;
        } finally {
            this.syncing = false;
        }
    }

    /**
     * 构建远端仓库 Map（fullName -> data）
     */
    private buildRemoteMap(remoteRepos: Array<{ fullName: string; [key: string]: any }>): Map<string, any> {
        const map = new Map<string, any>();
        for (const r of remoteRepos) {
            if (r.fullName && !map.has(r.fullName)) map.set(r.fullName, r);
        }
        return map;
    }

    /**
     * 构建本地仓库 Map（fullName -> { id, createdAt }）
     */
    private async buildLocalMap(): Promise<Map<string, { id: bigint; createdAt: Date | null }>> {
        const localRepos = await this.prisma.githubRepo.findMany({ select: { id: true, fullName: true, createdAt: true } });
        const map = new Map<string, { id: bigint; createdAt: Date | null }>();
        for (const r of localRepos) {
            if (r.fullName) map.set(r.fullName, { id: r.id, createdAt: r.createdAt });
        }
        return map;
    }

    /**
     * 将远端仓库数据 upsert 到本地
     */
    private async syncRemoteToLocal(
        remoteMap: Map<string, any>,
        localMap: Map<string, { id: bigint; createdAt: Date | null }>,
    ): Promise<number> {
        let synced = 0;
        for (const [fullName, data] of remoteMap) {
            const local = localMap.get(fullName);
            await this.githubRepo.upsertRepo({ ...data, createdAt: local?.createdAt || new Date(), updatedAt: new Date() });
            synced++;
        }
        return synced;
    }

    /**
     * REPLACE 模式：删除本地存在但远端已不存在的仓库
     */
    private async deleteUnstarredRepos(
        remoteMap: Map<string, any>,
        localMap: Map<string, { id: bigint; createdAt: Date | null }>,
    ): Promise<void> {
        const missingFullNames: string[] = [];
        for (const [fullName] of localMap) {
            if (!remoteMap.has(fullName)) missingFullNames.push(fullName);
        }
        if (missingFullNames.length > 0) {
            await this.prisma.githubRepo.deleteMany({ where: { fullName: { in: missingFullNames } } });
            this.logger.log(`已删除 ${missingFullNames.length} 个已取消Star的仓库`);
        }
    }

    /**
     * 手动同步：REPLACE 模式，全量替换
     *
     * 仅在没有正在进行的同步任务时启动新同步，避免并发冲突
     */
    startManualSync() {
        if (this.syncing) {
            this.logger.warn('手动同步：已有同步任务在执行中，跳过');
            return;
        }
        this.logger.log('手动同步任务已启动');
        this.executeSync('手动同步', true).catch((e) => this.logger.error(e));
    }
    /**
     * 定时同步：REPLACE 模式，全量替换
     *
     * 由定时调度触发，executeSync 内部通过同步锁防止并发
     */
    startScheduledSync() {
        this.logger.log('定时同步任务已触发');
        this.executeSync('定时同步', true).catch((e) => this.logger.error(e));
    }
    /**
     * 获取当前同步锁状态
     *
     * @returns true 表示有同步任务正在执行
     */
    isSyncing() {
        return this.syncing;
    }

    /**
     * 获取同步状态概览
     *
     * @returns 包含同步状态、上次同步时间、仓库总数等信息
     */
    async getSyncStatus() {
        const total = await this.prisma.githubRepo.count();
        const lastOk = await this.prisma.syncLog.findFirst({ where: { status: '成功' }, orderBy: { finishedAt: 'desc' } });
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
     * 分页查询同步日志
     *
     * @param pageNum 页码（从1开始）
     * @param pageSize 每页条数
     * @returns 分页后的同步日志记录及分页元数据
     */
    async getSyncLogs(pageNum: number, pageSize: number) {
        const [total, records] = await Promise.all([
            this.prisma.syncLog.count(),
            this.prisma.syncLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * pageSize, take: pageSize }),
        ]);
        return { records: records.map((r) => ({ ...r, id: Number(r.id) })), total, pages: Math.ceil(total / pageSize), current: pageNum };
    }
}
