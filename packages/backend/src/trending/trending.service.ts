import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SearchRepoItem } from '../github/github-search.service';

/** 可为空的日期类型，用于仓库日期字段 */
type NullableDateField = string | Date | null;

/**
 * 趋势仓库数据结构
 *
 * 必填字段与 github-search.service 的 SearchRepoItem 保持一致（fetch 层已做 ?? 兜底，永不为 null），
 * 因此 searchRepos 的返回值无需收窄即可直接传入 enrichWithCachedTranslations / ensureReposAndGetIdMapping。
 */
export interface TrendingRepoItem {
    fullName: string;
    description?: string | null;
    descriptionCn?: string | null;
    localRepoId?: number | null;
    language?: string | null;
    ownerName?: string | null;
    ownerAvatarUrl?: string | null;
    htmlUrl?: string | null;
    homepage?: string | null;
    starsCount?: number;
    forksCount?: number;
    watchersCount?: number;
    openIssuesCount?: number;
    topics?: string[] | string | unknown[];
    licenseName?: string | null;
    isFork?: boolean;
    isArchived?: boolean;
    repoCreatedAt?: NullableDateField;
    repoUpdatedAt?: NullableDateField;
    pushedAt?: NullableDateField;
    [key: string]: unknown;
}

/** enrichWithCachedTranslations / ensure 系列方法的入参：SearchRepoItem 或任何符合 TrendingRepoItem 结构的对象 */
export type TrendingRepoInput = SearchRepoItem | TrendingRepoItem;

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
     * @param repos 趋势仓库列表
     * @returns 本地数据库中的仓库 ID 数组（失败项会被跳过）
     */
    async batchEnsureReposExist(repos: TrendingRepoInput[]): Promise<number[]> {
        const mapping = await this.ensureReposAndGetIdMapping(repos);
        return mapping.map((m) => m.id);
    }

    /**
     * 批量确保趋势仓库存在并返回 fullName → id 映射
     *
     * 与 batchEnsureReposExist 的区别：返回明确的 { fullName, id } 对而非位置对齐数组，
     * 即使个别仓库创建失败也不会导致其余项错位。
     * 供「加入 Agent 对话上下文」等需要按仓库名取本地 id 的场景使用。
     *
     * @param repos 趋势仓库列表
     * @returns 成功入库的 { fullName, id } 数组
     */
    async ensureReposAndGetIdMapping(repos: TrendingRepoInput[]): Promise<{ fullName: string; id: number }[]> {
        const fullNames = repos.map((r) => r.fullName).filter(Boolean);
        if (!fullNames.length) return [];

        // 批量查询已存在的仓库
        const existing = await this.prisma.githubRepo.findMany({
            where: { fullName: { in: fullNames } },
            select: { id: true, fullName: true },
        });
        const existingMap = new Map(existing.map((r) => [r.fullName, Number(r.id)]));

        const mapping: { fullName: string; id: number }[] = [];
        for (const repo of repos) {
            if (!repo.fullName) continue;
            const existingId = existingMap.get(repo.fullName);
            if (existingId) {
                mapping.push({ fullName: repo.fullName, id: existingId });
                continue;
            }
            // 缺失的仓库逐个创建
            const newId = await this.ensureRepoExists(repo);
            if (newId) mapping.push({ fullName: repo.fullName, id: newId });
        }

        return mapping;
    }

    /**
     * 为趋势仓库列表补充中文描述（从缓存读取）
     *
     * 查询本地 github_repo 表，将已有的 description_cn 回填到仓库对象中。
     *
     * @param repos GitHub Search API 返回的仓库列表
     * @returns 补充了 descriptionCn 字段的仓库列表
     */
    async enrichWithCachedTranslations(repos: TrendingRepoInput[]): Promise<TrendingRepoItem[]> {
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
