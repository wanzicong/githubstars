import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { GithubApiService } from './github-api.service';
import { resolveSortField, resolveSortDir, parseLanguages, DATE_FIELD_MAP } from '../common/utils/query-params.util';
import { buildPaginationResult } from '../common/utils/pagination.util';
import type { BaseFilterParams, FilterParams, PaginatedFilterParams } from '../common/interfaces/filter-params.interface';
import type { UpsertRepoInput } from './repo-data.interface';

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

@Injectable()
export class GithubRepoService {
    private readonly logger = new Logger(GithubRepoService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly githubApi: GithubApiService,
    ) {}

    /**
     * 根据筛选参数构建 Prisma where 条件
     *
     * 支持关键词、语言、日期范围、未翻译等多维度筛选，
     * 各条件通过 AND 组合。
     *
     * @param params 筛选参数对象
     * @param params.keyword 搜索关键词，匹配仓库名、描述、所有者、全名
     * @param params.languages 编程语言数组
     * @param params.dateField 日期字段名（starred_at / repo_created_at / repo_updated_at / repo_pushed_at）
     * @param params.startDate 日期范围起始
     * @param params.endDate 日期范围结束
     * @param params.untranslatedOnly 是否仅查询未翻译的仓库
     * @returns Prisma where 条件对象
     *
     * @callers
     *   - findPage()
     *   - findAllUrls()
     *   - countTranslationStatus()
     */
    private buildWhere(params: {
        keyword?: string;
        languages?: string[];
        dateField?: string;
        startDate?: string;
        endDate?: string;
        untranslatedOnly?: boolean;
        categoryIds?: number[];
    }): Prisma.GithubRepoWhereInput {
        const AND: Prisma.GithubRepoWhereInput[] = [];
        if (params.keyword?.trim()) {
            const kw = params.keyword.trim();
            AND.push({
                OR: [
                    { repoName: { contains: kw } },
                    { description: { contains: kw } },
                    { ownerName: { contains: kw } },
                    { fullName: { contains: kw } },
                ],
            });
        }
        if (params.languages?.length && !params.languages.includes('')) {
            AND.push({ language: { in: params.languages } });
        }
        if (params.untranslatedOnly) {
            AND.push({ OR: [{ readmeCn: null }, { readmeCn: '' }] });
        }
        if (params.dateField && DATE_FIELD_MAP[params.dateField] && (params.startDate || params.endDate)) {
            const f = DATE_FIELD_MAP[params.dateField];
            const cond: any = {};
            if (params.startDate) cond.gte = new Date(params.startDate + 'T00:00:00+08:00');
            if (params.endDate) cond.lte = new Date(params.endDate + 'T23:59:59+08:00');
            AND.push({ [f]: cond });
        }
        // 分类筛选：categoryIds 已含父分类及其所有后代，由调用方展开
        if (params.categoryIds?.length) {
            AND.push({ categories: { some: { categoryId: { in: params.categoryIds } } } });
        }
        return AND.length > 0 ? { AND } : {};
    }

    /**
     * 展开分类 ID 列表：包含传入 ID 及其所有后代分类
     * 若 id 为 undefined/null 则返回 undefined（表示不筛选）
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
     * 分页查询星标仓库列表
     *
     * 支持多维度筛选、排序和分页，返回带翻译状态的记录列表。
     *
     * @param params 查询参数
     * @param params.page 页码，从 1 开始，默认 1
     * @param params.size 每页数量，默认 12，最大 100
     * @param params.keyword 搜索关键词
     * @param params.language 语言筛选（逗号分隔多个）
     * @param params.sortBy 排序字段
     * @param params.sortOrder 排序方向（asc/desc）
     * @param params.dateField 日期筛选字段
     * @param params.startDate 日期范围起始
     * @param params.endDate 日期范围结束
     * @param params.untranslatedOnly 是否仅显示未翻译仓库
     * @returns 分页结果，包含 records、total、size、current、pages
     *
     * @callers
     *   - GithubController 各查询接口
     *
     * @depends
     *   - PrismaService.githubRepo（github_repo 表）
     */
    async findPage(params: PaginatedFilterParams) {
        const page = params.page || 1,
            size = params.size || 12;
        this.logger.log('分页查询仓库列表: page=' + page + ', size=' + size + ', keyword=' + (params.keyword || ''));
        const sortField = resolveSortField(params.sortBy);
        const sortDir = resolveSortDir(params.sortOrder);
        const categoryIds = await this.expandCategoryIds(params.categoryId);
        const where = this.buildWhere({
            keyword: params.keyword,
            languages: parseLanguages(params.language),
            dateField: params.dateField,
            startDate: params.startDate,
            endDate: params.endDate,
            untranslatedOnly: params.untranslatedOnly,
            categoryIds,
        });
        const [total, records] = await Promise.all([
            this.prisma.githubRepo.count({ where }),
            this.prisma.githubRepo.findMany({ where, orderBy: { [sortField]: sortDir }, skip: (page - 1) * size, take: size }),
        ]);
        // 附加翻译状态（前端列表可直接展示翻译徽标）
        const enriched = records.map((r) => {
            const descriptionStatus = resolveTranslationStatus(r.descriptionCn, r.description);
            const readmeStatus = resolveReadmeStatus(r.readmeCn, r.readmeFetched);
            return {
                ...r,
                translationStatus: {
                    description: descriptionStatus,
                    readme: readmeStatus,
                },
            };
        });
        return buildPaginationResult(enriched, total, page, size);
    }

    /**
     * 根据 ID 查询单个仓库详情
     *
     * @param id 仓库数字 ID
     * @returns 仓库对象，不存在返回 null
     *
     * @callers
     *   - GithubController.getById()
     */
    async findById(id: number) {
        const repo = await this.prisma.githubRepo.findUnique({ where: { id } });
        if (!repo) return null;
        return repo;
    }

    /**
     * 查询所有符合条件的仓库 URL 列表
     *
     * 用于导出功能，返回 htmlUrl 数组。
     *
     * @param params 筛选参数（同 findPage）
     * @returns 仓库 htmlUrl 字符串数组
     */
    async findAllUrls(params: FilterParams) {
        const sortField = resolveSortField(params.sortBy);
        const sortDir = resolveSortDir(params.sortOrder);
        const categoryIds = await this.expandCategoryIds(params.categoryId);
        const where = this.buildWhere({
            keyword: params.keyword,
            languages: parseLanguages(params.language),
            dateField: params.dateField,
            startDate: params.startDate,
            endDate: params.endDate,
            untranslatedOnly: params.untranslatedOnly,
            categoryIds,
        });
        const repos = await this.prisma.githubRepo.findMany({ where, select: { htmlUrl: true }, orderBy: { [sortField]: sortDir } });
        return repos.map((r) => r.htmlUrl).filter(Boolean) as string[];
    }

    /**
     * 查询所有符合条件的仓库 ID 列表
     *
     * 用于跨页全选功能，返回 id 数组。
     *
     * @param params 筛选参数（同 findPage）
     * @returns 仓库 ID 数组
     *
     * @callers
     *   - GithubController.getAllIds()
     */
    async findAllIds(params: FilterParams) {
        const categoryIds = await this.expandCategoryIds(params.categoryId);
        const where = this.buildWhere({
            keyword: params.keyword,
            languages: parseLanguages(params.language),
            dateField: params.dateField,
            startDate: params.startDate,
            endDate: params.endDate,
            untranslatedOnly: params.untranslatedOnly,
            categoryIds,
        });
        const repos = await this.prisma.githubRepo.findMany({ where, select: { id: true } });
        return repos.map((r) => Number(r.id));
    }

    /**
     * 根据 ID 列表查询仓库信息
     *
     * 用于跨页全选后获取仓库详情，返回仓库记录数组。
     *
     * @param ids 仓库 ID 数组
     * @returns 仓库记录数组
     *
     * @callers
     *   - GithubController.getByIds()
     */
    async findByIds(ids: number[]) {
        if (!ids || ids.length === 0) return [];
        const repos = await this.prisma.githubRepo.findMany({
            where: { id: { in: ids } },
        });
        return repos;
    }

    /**
     * 查询所有符合条件的仓库（不分页）
     *
     * 支持关键词和语言筛选，返回完整仓库记录。
     *
     * @param params 筛选参数
     * @param params.keyword 搜索关键词
     * @param params.language 语言筛选（逗号分隔多个）
     * @param params.sortBy 排序字段
     * @param params.sortOrder 排序方向
     * @returns 仓库记录数组
     */
    async findAll(params: BaseFilterParams) {
        const sortField = resolveSortField(params.sortBy);
        const sortDir = resolveSortDir(params.sortOrder);
        const where = this.buildWhere({ keyword: params.keyword, languages: parseLanguages(params.language) });
        return this.prisma.githubRepo.findMany({ where, orderBy: { [sortField]: sortDir } });
    }

    /**
     * 插入或更新仓库记录
     *
     * 使用 Prisma upsert（ORM）替代原始 SQL，兼容 MySQL 和 SQLite 双数据库。
     * 以 fullName 为唯一键：新记录插入，已存在则仅更新基础元数据（不覆盖翻译结果）。
     *
     * @param data 仓库数据对象，对应 github_repo 表字段
     *
     * @callers
     *   - SyncService 同步流程
     */
    async upsertRepo(data: UpsertRepoInput) {
        const fullName = data.fullName || '';
        if (!fullName) {
            this.logger.warn('upsert 跳过: fullName 为空');
            return;
        }
        this.logger.log('upsert 仓库: ' + fullName);
        const now = new Date();
        await this.prisma.githubRepo.upsert({
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
                repoSize: data.repoSize,
                defaultBranch: data.defaultBranch,
                visibility: data.visibility,
                repoCreatedAt: data.repoCreatedAt,
                repoUpdatedAt: data.repoUpdatedAt,
                repoPushedAt: data.repoPushedAt,
                starredAt: data.starredAt,
                createdAt: data.createdAt || now,
                updatedAt: data.updatedAt || now,
                descriptionCn: data.descriptionCn || null,
                readmeCn: data.readmeCn || null,
                readmeOriginal: data.readmeOriginal || null,
                readmeFetched: data.readmeFetched || false,
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
                repoSize: data.repoSize,
                defaultBranch: data.defaultBranch,
                visibility: data.visibility,
                repoCreatedAt: data.repoCreatedAt,
                repoUpdatedAt: data.repoUpdatedAt,
                repoPushedAt: data.repoPushedAt,
                starredAt: data.starredAt,
                updatedAt: data.updatedAt || now,
            },
        });
    }

    /**
     * 查询仓库总数量
     *
     * @returns 仓库总数
     */
    async count(): Promise<number> {
        return this.prisma.githubRepo.count();
    }

    /**
     * 统计筛选条件下的翻译覆盖情况
     *
     * 与 findPage 使用相同的 buildWhere 构建筛选条件，
     * 确保 total、descCompleted、readmeCompleted 都在同一筛选范围内计算。
     *
     * @param params 筛选参数（与 findPage / getTranslationSummary 一致）
     * @returns { total, descCompleted, descPending, readmeCompleted, readmePending }
     *
     * @callers
     *   - 翻译相关 API
     */
    async countTranslationStatus(params: FilterParams) {
        const where = this.buildWhere({
            keyword: params.keyword,
            languages: parseLanguages(params.language),
            dateField: params.dateField,
            startDate: params.startDate,
            endDate: params.endDate,
            untranslatedOnly: params.untranslatedOnly,
        });

        const [total, descCompleted, readmeCompleted] = await Promise.all([
            this.prisma.githubRepo.count({ where }),
            this.prisma.githubRepo.count({
                where: {
                    AND: [where, { descriptionCn: { not: null } }, { descriptionCn: { not: '' } }],
                },
            }),
            this.prisma.githubRepo.count({
                where: {
                    AND: [where, { readmeCn: { not: null } }, { readmeCn: { not: '' } }],
                },
            }),
        ]);

        return {
            success: true,
            total,
            descCompleted,
            descPending: total - descCompleted,
            readmeCompleted,
            readmePending: total - readmeCompleted,
        };
    }

    /**
     * 确保仓库 README 已被拉取（按需拉取）
     *
     * 当用户查看仓库详情时，如果 README 尚未拉取（readmeFetched=false），
     * 立即从 GitHub API 拉取并持久化，避免依赖批量同步时的 API 限额。
     *
     * 静默处理失败——拉取失败不影响详情页展示其他信息。
     *
     * @param repoId 仓库 ID
     * @returns 更新后的仓库对象（或原始对象，如果无需更新或拉取失败）
     *
     * @callers StarsController.detail()
     * @depends GithubApiService.fetchReadmeFromGitHub()
     */
    async ensureReadmeFetched(repoId: number): Promise<any> {
        try {
            const repo = await this.prisma.githubRepo.findUnique({ where: { id: repoId } });
            if (!repo || repo.readmeFetched) return repo;

            this.logger.log(`按需拉取 README: ${repo.fullName}`);
            const ghResult = await this.githubApi.fetchReadmeFromGitHub(repo.fullName!);

            if (ghResult.content === null) {
                // GitHub 上确实没有 README → 标记已获取（避免重复请求）
                await this.prisma.githubRepo.update({
                    where: { id: repoId },
                    data: { readmeFetched: true, updatedAt: new Date() },
                });
                this.logger.log(`按需拉取 README 完成（无 README 文件）: ${repo.fullName}`);
            } else {
                // 保存原文并标记已获取
                await this.prisma.githubRepo.update({
                    where: { id: repoId },
                    data: { readmeOriginal: ghResult.content, readmeFetched: true, updatedAt: new Date() },
                });
                this.logger.log(`按需拉取 README 成功: ${repo.fullName}, 大小=${ghResult.content.length}`);
            }

            // 重新查询获取完整的 Prisma 模型返回
            return this.prisma.githubRepo.findUnique({ where: { id: repoId } });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(`按需拉取 README 失败: ${msg}`);
            return null;
        }
    }
}
