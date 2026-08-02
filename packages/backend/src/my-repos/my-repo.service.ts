import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveSortField, resolveSortDir, parseLanguages, DATE_FIELD_MAP } from '../common/utils/query-params.util';
import { buildPaginationResult } from '../common/utils/pagination.util';
import type { MappedRepoData } from '../github/repo-data.interface';

/** 我的仓库列表查询参数 */
export interface MyRepoFilterParams {
    keyword?: string;
    language?: string;
    sortBy?: string;
    sortOrder?: string;
    dateField?: string;
    startDate?: string;
    endDate?: string;
    untranslatedOnly?: boolean;
    categoryId?: number;
    isPrivate?: boolean;
}

/** 我的仓库分页查询参数 */
export interface MyRepoPaginatedParams extends MyRepoFilterParams {
    page?: number;
    size?: number;
}

/** 待翻译记录（与 localization 模块 PendingLocalizationRecord 同构） */
export interface MyRepoPendingRecord {
    repoId: number;
    fullName: string | null;
    description: string | null;
    readme: string | null;
}

/** 解析描述翻译状态：已翻译 > 待翻译 > 无描述 */
function resolveTranslationStatus(descriptionCn: string | null | undefined, description: string | null | undefined): string {
    if (descriptionCn) return 'completed';
    if (description) return 'pending';
    return 'none';
}

/** 解析 README 翻译状态：已翻译 > 无 README > 待翻译 */
function resolveReadmeStatus(readmeCn: string | null | undefined, readmeFetched: boolean | null | undefined): string {
    if (readmeCn) return 'completed';
    if (readmeFetched) return 'none';
    return 'pending';
}

/**
 * 我的仓库数据服务（数据访问层）
 *
 * 负责 my_repo 表的 CRUD、多维度筛选分页、翻译状态增强、
 * 分类绑定/解绑与待翻译记录查询。
 * 与 GithubRepoService 同构，但作用于 my_repo 表。
 *
 * @depends PrismaService
 * @callers MyReposController / MyRepoSyncService
 */
@Injectable()
export class MyRepoService {
    private readonly logger = new Logger(MyRepoService.name);

    constructor(private readonly prisma: PrismaService) {}

    // ============================================================
    // 查询
    // ============================================================

    /**
     * 根据筛选参数构建 Prisma where 条件
     *
     * @callers findPage / findAllIds / count
     */
    private async buildWhere(params: MyRepoFilterParams): Promise<Prisma.MyRepoWhereInput> {
        const AND: Prisma.MyRepoWhereInput[] = [];
        if (params.keyword?.trim()) {
            const kw = params.keyword.trim();
            AND.push({
                OR: [{ repoName: { contains: kw } }, { description: { contains: kw } }, { fullName: { contains: kw } }],
            });
        }
        const languages = parseLanguages(params.language) ?? [];
        if (languages.length > 0 && !languages.includes('')) {
            AND.push({ language: { in: languages } });
        }
        if (params.untranslatedOnly) {
            AND.push({ OR: [{ readmeCn: null }, { readmeCn: '' }] });
        }
        if (params.isPrivate !== undefined) {
            AND.push({ isPrivate: params.isPrivate });
        }
        if (params.dateField && DATE_FIELD_MAP[params.dateField] && (params.startDate || params.endDate)) {
            const f = DATE_FIELD_MAP[params.dateField];
            // my_repo 无 starredAt，starred_at 排序/筛选不适用，映射到 repoUpdatedAt 兜底
            const field = f === 'starredAt' ? 'repoUpdatedAt' : f;
            const cond: { gte?: Date; lte?: Date } = {};
            if (params.startDate) cond.gte = new Date(params.startDate + 'T00:00:00+08:00');
            if (params.endDate) cond.lte = new Date(params.endDate + 'T23:59:59+08:00');
            AND.push({ [field]: cond });
        }
        const categoryIds = await this.expandCategoryIds(params.categoryId);
        if (categoryIds?.length) {
            AND.push({ categories: { some: { categoryId: { in: categoryIds } } } });
        }
        return AND.length > 0 ? { AND } : {};
    }

    /**
     * 展开分类 ID：含父分类及其所有后代分类（递归）
     *
     * @callers buildWhere
     * @depends PrismaService.category
     */
    private async expandCategoryIds(id?: number): Promise<number[] | undefined> {
        if (!id) return undefined;
        const collect = async (parentId: number): Promise<number[]> => {
            const children = await this.prisma.category.findMany({ where: { parentId }, select: { id: true } });
            const childIds = children.map((c) => Number(c.id));
            if (childIds.length === 0) return [];
            const grandChildIds = await Promise.all(childIds.map(collect));
            return [...childIds, ...grandChildIds.flat()];
        };
        const descendants = await collect(id);
        return [id, ...descendants];
    }

    /**
     * 分页查询我的仓库列表
     *
     * 排序字段 starred_at 不适用（映射 repoUpdatedAt 兜底）。
     * 返回记录附加翻译状态徽标。
     */
    async findPage(params: MyRepoPaginatedParams) {
        const page = params.page || 1;
        const size = params.size || 12;
        this.logger.log(`分页查询我的仓库: page=${page}, size=${size}, keyword=${params.keyword || ''}, isPrivate=${params.isPrivate}`);
        // starred_at 在我的仓库语义下不存在，统一按 repoUpdatedAt 兜底
        const sortBy = params.sortBy === 'starred_at' ? 'repo_updated_at' : params.sortBy;
        const sortField = resolveSortField(sortBy);
        const sortDir = resolveSortDir(params.sortOrder);
        const where = await this.buildWhere(params);
        const [total, records] = await Promise.all([
            this.prisma.myRepo.count({ where }),
            this.prisma.myRepo.findMany({ where, orderBy: { [sortField]: sortDir }, skip: (page - 1) * size, take: size }),
        ]);
        const enriched = records.map((r) => ({
            ...r,
            translationStatus: {
                description: resolveTranslationStatus(r.descriptionCn, r.description),
                readme: resolveReadmeStatus(r.readmeCn, r.readmeFetched),
            },
        }));
        return buildPaginationResult(enriched, total, page, size);
    }

    /**
     * 按筛选条件获取全部仓库 ID（跨页全选用）
     */
    async findAllIds(params: MyRepoFilterParams): Promise<number[]> {
        const where = await this.buildWhere(params);
        const rows = await this.prisma.myRepo.findMany({ where, select: { id: true } });
        return rows.map((r) => Number(r.id));
    }

    /**
     * 按 ID 查询仓库详情（含分类与翻译状态）
     *
     * @throws NotFoundException 仓库不存在
     */
    async findById(id: number) {
        const repo = await this.prisma.myRepo.findUnique({
            where: { id },
            include: { categories: { include: { category: { select: { id: true, name: true, parentId: true } } } } },
        });
        if (!repo) {
            throw new NotFoundException('我的仓库不存在');
        }
        return {
            ...repo,
            categories: repo.categories.map((link) => ({
                id: Number(link.category.id),
                name: link.category.name,
                parentId: link.category.parentId === null ? null : Number(link.category.parentId),
            })),
            translationStatus: {
                description: resolveTranslationStatus(repo.descriptionCn, repo.description),
                readme: resolveReadmeStatus(repo.readmeCn, repo.readmeFetched),
            },
        };
    }

    /**
     * 按 ID 列表批量获取仓库
     */
    async findByIds(ids: number[]) {
        return this.prisma.myRepo.findMany({ where: { id: { in: ids } } });
    }

    /**
     * 查询仓库所属分类 ID 列表
     */
    async getCategoryIds(repoId: number): Promise<number[]> {
        const links = await this.prisma.myRepoCategoryLink.findMany({ where: { myRepoId: repoId }, select: { categoryId: true } });
        return links.map((l) => Number(l.categoryId));
    }

    // ============================================================
    // 写入
    // ============================================================

    /**
     * 按 fullName upsert 我的仓库（同步用）
     *
     * 保留本地已有的翻译成果与 README 抓取状态：
     * update 分支只覆盖 GitHub 侧元数据字段。
     *
     * @callers MyRepoSyncService.syncRemoteToLocal
     */
    async upsertRepo(data: MappedRepoData, isPrivate: boolean) {
        const fullName = data.fullName || '';
        if (!fullName) {
            this.logger.error('upsert 我的仓库跳过: fullName 为空');
            return;
        }
        const now = new Date();
        await this.prisma.myRepo.upsert({
            where: { fullName },
            create: {
                repoName: data.repoName || '',
                fullName,
                description: data.description,
                language: data.language,
                ownerName: data.ownerName,
                ownerAvatarUrl: data.ownerAvatarUrl,
                htmlUrl: data.htmlUrl,
                homepage: data.homepage,
                starsCount: data.starsCount || 0,
                forksCount: data.forksCount || 0,
                watchersCount: data.watchersCount || 0,
                openIssuesCount: data.openIssuesCount || 0,
                topics: data.topics || '[]',
                licenseName: data.licenseName,
                isFork: data.isFork || false,
                isArchived: data.isArchived || false,
                isPrivate,
                repoSize: data.repoSize,
                defaultBranch: data.defaultBranch,
                visibility: data.visibility,
                repoCreatedAt: data.repoCreatedAt,
                repoUpdatedAt: data.repoUpdatedAt,
                repoPushedAt: data.repoPushedAt,
                createdAt: now,
                updatedAt: now,
            },
            update: {
                repoName: data.repoName || '',
                description: data.description,
                language: data.language,
                ownerName: data.ownerName,
                ownerAvatarUrl: data.ownerAvatarUrl,
                htmlUrl: data.htmlUrl,
                homepage: data.homepage,
                starsCount: data.starsCount || 0,
                forksCount: data.forksCount || 0,
                watchersCount: data.watchersCount || 0,
                openIssuesCount: data.openIssuesCount || 0,
                topics: data.topics || '[]',
                licenseName: data.licenseName,
                isFork: data.isFork || false,
                isArchived: data.isArchived || false,
                isPrivate,
                repoSize: data.repoSize,
                defaultBranch: data.defaultBranch,
                visibility: data.visibility,
                repoCreatedAt: data.repoCreatedAt,
                repoUpdatedAt: data.repoUpdatedAt,
                repoPushedAt: data.repoPushedAt,
                updatedAt: now,
            },
        });
    }

    /**
     * 批量绑定我的仓库到分类
     *
     * 校验分类与仓库存在性，已存在的关联通过 createMany skipDuplicates 幂等跳过。
     *
     * @returns 绑定结果（新增/已存在/无效数量）
     */
    async bindCategories(categoryId: number, repoIds: number[]) {
        const category = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
        if (!category) {
            throw new NotFoundException('分类不存在');
        }
        const repos = await this.prisma.myRepo.findMany({ where: { id: { in: repoIds } }, select: { id: true } });
        const existingIds = new Set(repos.map((r) => Number(r.id)));
        const validIds = repoIds.filter((id) => existingIds.has(id));
        if (validIds.length === 0) {
            return { bound: 0, invalid: repoIds.length };
        }
        const result = await this.prisma.myRepoCategoryLink.createMany({
            data: validIds.map((myRepoId) => ({ categoryId, myRepoId, createdAt: new Date() })),
            skipDuplicates: true,
        });
        this.logger.log(`绑定我的仓库到分类: categoryId=${categoryId}, 新增=${result.count}, 无效=${repoIds.length - validIds.length}`);
        return { bound: result.count, invalid: repoIds.length - validIds.length };
    }

    /**
     * 批量解绑我的仓库分类
     */
    async unbindCategories(categoryId: number, repoIds: number[]) {
        const result = await this.prisma.myRepoCategoryLink.deleteMany({
            where: { categoryId, myRepoId: { in: repoIds } },
        });
        this.logger.log(`解绑我的仓库分类: categoryId=${categoryId}, 删除=${result.count}`);
        return { unbound: result.count };
    }

    // ============================================================
    // 翻译流水线对接
    // ============================================================

    /**
     * 查询待翻译的我的仓库记录
     *
     * 与 RepositoryLocalizationService.findPending 同构：
     * description 分支=有原文未翻译；readme 分支=已抓到原文未翻译。
     *
     * @callers MyReposController.findPendingLocalization → agent 翻译流水线
     */
    async findPendingLocalization(limit = 50, includeDescription = true, includeReadme = true) {
        if (!includeDescription && !includeReadme) {
            return { success: true, total: 0, records: [] };
        }
        let where: Prisma.MyRepoWhereInput;
        if (includeDescription && includeReadme) {
            where = {
                OR: [
                    { description: { not: null, notIn: [''] }, descriptionCn: null },
                    { readmeCn: null, readmeOriginal: { not: null, notIn: [''] } },
                ],
            };
        } else if (includeDescription) {
            where = { description: { not: null, notIn: [''] }, descriptionCn: null };
        } else {
            where = { readmeCn: null, readmeOriginal: { not: null, notIn: [''] } };
        }

        const repos = await this.prisma.myRepo.findMany({
            where,
            orderBy: { starsCount: 'desc' },
            take: limit,
            select: { id: true, fullName: true, description: true, descriptionCn: true, readmeOriginal: true, readmeCn: true },
        });

        const records: MyRepoPendingRecord[] = repos.map((repo) => ({
            repoId: Number(repo.id),
            fullName: repo.fullName,
            description: includeDescription && repo.description && !repo.descriptionCn ? repo.description : null,
            readme: includeReadme && repo.readmeOriginal && !repo.readmeCn ? repo.readmeOriginal : null,
        }));

        this.logger.log(`查询待翻译我的仓库: 命中 ${records.length} 条 (limit=${limit}, desc=${includeDescription}, readme=${includeReadme})`);
        return { success: true, total: records.length, records };
    }

    /**
     * 批量回写译文
     *
     * 与 RepositoryLocalizationService.updateTranslations 同构：
     * 空译文跳过，单条失败不阻塞整批。
     *
     * @callers MyReposController.updateLocalization ← agent 翻译流水线
     */
    async updateTranslations(items: Array<{ repoId: number; descriptionCn?: string; readmeCn?: string }>) {
        const updatedRepoIds: number[] = [];
        const skippedRepoIds: number[] = [];

        for (const item of items) {
            const data: { descriptionCn?: string; readmeCn?: string; readmeFetched?: boolean; updatedAt: Date } = {
                updatedAt: new Date(),
            };
            if (item.descriptionCn !== undefined && item.descriptionCn !== '') data.descriptionCn = item.descriptionCn;
            if (item.readmeCn !== undefined && item.readmeCn !== '') {
                data.readmeCn = item.readmeCn;
                data.readmeFetched = true;
            }

            if (data.descriptionCn === undefined && data.readmeCn === undefined) {
                skippedRepoIds.push(item.repoId);
                continue;
            }

            try {
                await this.prisma.myRepo.update({ where: { id: item.repoId }, data });
                updatedRepoIds.push(item.repoId);
            } catch (error) {
                skippedRepoIds.push(item.repoId);
                this.logger.error(`我的仓库译文更新失败 repoId=${item.repoId}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        this.logger.log(`批量写入我的仓库译文: 成功 ${updatedRepoIds.length} 条, 跳过 ${skippedRepoIds.length} 条`);
        return { success: true, updated: updatedRepoIds.length, updatedRepoIds, skippedRepoIds };
    }

    // ============================================================
    // 统计
    // ============================================================

    /**
     * 我的仓库概览统计：总数、私有数、总 Star/Fork、语言分布 Top10
     */
    async getStats() {
        const [total, privateCount, agg, languages] = await Promise.all([
            this.prisma.myRepo.count(),
            this.prisma.myRepo.count({ where: { isPrivate: true } }),
            this.prisma.myRepo.aggregate({ _sum: { starsCount: true, forksCount: true } }),
            this.prisma.myRepo.groupBy({ by: ['language'], _count: { language: true }, orderBy: { _count: { language: 'desc' } }, take: 10 }),
        ]);
        return {
            total,
            privateCount,
            totalStars: agg._sum.starsCount || 0,
            totalForks: agg._sum.forksCount || 0,
            languages: languages
                .filter((l) => l.language)
                .map((l) => ({ language: l.language, count: l._count.language })),
        };
    }
}
