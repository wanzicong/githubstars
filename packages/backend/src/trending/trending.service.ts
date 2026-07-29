import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 可为空的日期类型，用于仓库日期字段 */
type NullableDateField = string | Date | null;

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
    repoCreatedAt?: NullableDateField;
    repoUpdatedAt?: NullableDateField;
    pushedAt?: NullableDateField;
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

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 批量确保趋势仓库在本地 DB 中存在并返回 ID
     *
     * 先批量查询已存在的仓库，再逐个创建缺失的仓库。
     * 比逐个调用 ensureRepoExists 更高效。
     *
     * @param repos 趋势仓库列表
     * @returns 本地数据库中的仓库 ID 数组
     */
    async batchEnsureReposExist(repos: TrendingRepoItem[]): Promise<number[]> {
        if (!repos.length) return [];

        const fullNames = repos.map((r) => r.fullName).filter(Boolean);
        if (!fullNames.length) return [];

        // 批量查询已存在的仓库
        const existing = await this.prisma.githubRepo.findMany({
            where: { fullName: { in: fullNames } },
            select: { id: true, fullName: true },
        });
        const existingMap = new Map(existing.map((r) => [r.fullName, Number(r.id)]));

        const repoIds: number[] = [];

        for (const repo of repos) {
            const id = existingMap.get(repo.fullName);
            if (id) {
                repoIds.push(id);
            } else {
                // 缺失的仓库逐个创建
                const newId = await this.ensureRepoExists(repo);
                if (newId) repoIds.push(newId);
            }
        }

        return repoIds;
    }

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
     * 确保仓库在 github_repo 表中存在（轻量 upsert）
     *
     * 只写入基础字段，不覆盖已有的翻译内容。
     *
     * @returns 仓库 ID，失败返回 null
     */
    private async ensureRepoExists(repo: TrendingRepoItem): Promise<number | null> {
        try {
            const fullName = repo.fullName;
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
                    topics: (() => {
                        if (!repo.topics) return '[]';
                        if (typeof repo.topics === 'string') return repo.topics;
                        return JSON.stringify(repo.topics);
                    })(),
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
