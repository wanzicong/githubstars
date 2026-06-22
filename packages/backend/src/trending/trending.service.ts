import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TranslateService } from '../translate/translate.service';

/** GitHub Search API 返回的仓库数据结构 */
export interface TrendingRepoItem {
    fullName: string;
    description?: string | null;
    descriptionCn?: string | null;
    localRepoId?: number | null;
    language?: string | null;
    ownerName?: string;
    ownerAvatarUrl?: string;
    htmlUrl?: string;
    homepage?: string | null;
    starsCount?: number;
    forksCount?: number;
    watchersCount?: number;
    openIssuesCount?: number;
    topics?: string[] | string;
    licenseName?: string | null;
    isFork?: boolean;
    isArchived?: boolean;
    repoCreatedAt?: string | Date | null;
    repoUpdatedAt?: string | Date | null;
    pushedAt?: string | Date | null;
    [key: string]: unknown;
}

/**
 * 趋势服务 — 管理 Trending 仓库的翻译缓存
 *
 * 对从 GitHub Search API 获取的趋势仓库，查询本地 DB 是否已有翻译缓存（description_cn），
 * 未缓存的仓库 upsert 到 github_repo 后触发异步翻译，翻译结果自动缓存。
 * 同一仓库的描述只翻译一次，后续请求直接命中缓存。
 */
@Injectable()
export class TrendingService {
    private readonly logger = new Logger(TrendingService.name);

    /** 正在翻译中的 fullName 集合，防止重复触发 */
    private translatingSet = new Set<string>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly translate: TranslateService,
    ) {}

    /**
     * 为趋势仓库列表补充中文描述（从缓存读取）
     *
     * 查询本地 github_repo 表，将已有的 description_cn 回填到仓库对象中。
     *
     * @param repos GitHub Search API 返回的仓库列表
     * @returns 补充了 descriptionCn 字段的仓库列表
     */
    async enrichWithCachedTranslations(repos: TrendingRepoItem[]): Promise<TrendingRepoItem[]> {
        if (!repos.length) return repos;

        const fullNames = repos.map((r) => r.fullName).filter(Boolean);
        if (!fullNames.length) return repos;

        // 批量查询本地缓存的翻译
        const cached = await this.prisma.githubRepo.findMany({
            where: { fullName: { in: fullNames } },
            select: { fullName: true, descriptionCn: true, id: true },
        });

        const cacheMap = new Map(cached.map((c) => [c.fullName, c]));

        return repos.map((repo) => {
            const local = cacheMap.get(repo.fullName);
            return {
                ...repo,
                descriptionCn: local?.descriptionCn || null,
                localRepoId: local?.id ? Number(local.id) : null,
            };
        });
    }

    /**
     * 异步翻译趋势仓库中未缓存的描述
     *
     * 对未缓存的仓库先 upsert 到 github_repo，再逐个调用翻译。
     * 翻译结果自动写入 github_repo.description_cn。
     * 使用 translatingSet 防止同一仓库并发翻译。
     *
     * @param repos 补充了 localRepoId 的仓库列表
     * @returns 翻译统计 { translated, skipped, failed }
     */
    async translateUncached(repos: TrendingRepoItem[]): Promise<{ translated: number; skipped: number; failed: number }> {
        const uncached = repos.filter((r) => !r.descriptionCn && r.description);
        if (!uncached.length) return { translated: 0, skipped: repos.length, failed: 0 };

        this.logger.log(`趋势翻译: ${uncached.length} 个仓库待翻译（共 ${repos.length} 个）`);

        let translated = 0;
        let failed = 0;

        for (const repo of uncached) {
            const fullName = repo.fullName as string;
            if (this.translatingSet.has(fullName)) continue;
            this.translatingSet.add(fullName);

            try {
                // 确保仓库在本地 DB 中
                let repoId = repo.localRepoId as number | null;
                if (!repoId) {
                    repoId = await this.ensureRepoExists(repo);
                    if (!repoId) { failed++; continue; }
                }

                // 调用翻译（幂等：已有 description_cn 则跳过）
                const result = await this.translate.translateDescription(repoId);
                if (result) translated++;
                else failed++;
            } catch (e) {
                this.logger.error(`趋势翻译失败: ${fullName}`, e);
                failed++;
            } finally {
                this.translatingSet.delete(fullName);
            }
        }

        this.logger.log(`趋势翻译完成: translated=${translated} failed=${failed}`);
        return { translated, skipped: repos.length - uncached.length, failed };
    }

    /**
     * 确保仓库在 github_repo 表中存在（轻量 upsert）
     *
     * 只写入基础字段，不覆盖已有的翻译内容。
     *
     * @returns 仓库 ID，失败返回 null
     */
    private async ensureRepoExists(repo: TrendingRepoItem): Promise<number | null> {
        try {
            const fullName = repo.fullName as string;
            // 先查是否已存在
            const existing = await this.prisma.githubRepo.findFirst({
                where: { fullName },
                select: { id: true },
            });
            if (existing) return Number(existing.id);

            // 不存在则插入
            const created = await this.prisma.githubRepo.create({
                data: {
                    repoName: repo.fullName?.split('/')[1] || '',
                    fullName: repo.fullName || '',
                    description: repo.description || null,
                    language: repo.language || null,
                    ownerName: repo.ownerName || repo.fullName?.split('/')[0] || '',
                    ownerAvatarUrl: repo.ownerAvatarUrl || '',
                    htmlUrl: repo.htmlUrl || '',
                    homepage: repo.homepage || null,
                    starsCount: repo.starsCount || 0,
                    forksCount: repo.forksCount || 0,
                    watchersCount: repo.watchersCount || 0,
                    openIssuesCount: repo.openIssuesCount || 0,
                    topics: repo.topics ? (typeof repo.topics === 'string' ? repo.topics : JSON.stringify(repo.topics)) : '[]',
                    licenseName: repo.licenseName || null,
                    isFork: repo.isFork || false,
                    isArchived: repo.isArchived || false,
                    repoCreatedAt: repo.repoCreatedAt ? new Date(repo.repoCreatedAt) : null,
                    repoUpdatedAt: repo.repoUpdatedAt ? new Date(repo.repoUpdatedAt) : null,
                    repoPushedAt: repo.pushedAt ? new Date(repo.pushedAt) : null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                select: { id: true },
            });
            return Number(created.id);
        } catch (e) {
            this.logger.error(`upsert 趋势仓库失败: ${repo.fullName}`, e);
            return null;
        }
    }
}
