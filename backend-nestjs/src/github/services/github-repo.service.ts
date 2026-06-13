import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const SORT_MAP: Record<string, string> = {
    stars_count: 'starsCount',
    forks_count: 'forksCount',
    repo_updated_at: 'repoUpdatedAt',
    repo_created_at: 'repoCreatedAt',
    repo_pushed_at: 'repoPushedAt',
    starred_at: 'starredAt',
};
const DATE_MAP: Record<string, string> = {
    starred_at: 'starredAt',
    repo_created_at: 'repoCreatedAt',
    repo_updated_at: 'repoUpdatedAt',
    repo_pushed_at: 'repoPushedAt',
};

@Injectable()
export class GithubRepoService {
    private readonly logger = new Logger(GithubRepoService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 展开分类 ID 字符串为实际分类 ID 列表
     *
     * 如果分类为一级分类（level=1），则查询其所有子分类的 ID；
     * 否则直接返回该分类 ID。用于将前端传入的分类筛选参数转换为实际查询用的 ID 列表。
     *
     * @param str 逗号分隔的分类 ID 字符串，如 "1,2,3"
     * @returns 展开后的分类 ID 数组
     */
    private async expandCategoryIds(str: string): Promise<number[]> {
        if (!str) return [];
        const ids = str
            .split(',')
            .map(Number)
            .filter((n) => !isNaN(n));
        if (ids.length === 0) return [];
        const result: number[] = [];
        for (const id of ids) {
            const cat = await this.prisma.category.findUnique({ where: { id: BigInt(id) } });
            if (cat?.level === 1) {
                const children = await this.prisma.category.findMany({ where: { parentId: BigInt(id) }, select: { id: true } });
                result.push(...(children.length > 0 ? children.map((c) => Number(c.id)) : [id]));
            } else result.push(id);
        }
        return result;
    }

    /**
     * 根据筛选参数构建 Prisma where 条件
     *
     * 支持关键词、语言、分类、日期范围、未翻译等多维度筛选，
     * 各条件通过 AND 组合。
     *
     * @param params 筛选参数对象
     * @param params.keyword 搜索关键词，匹配仓库名、描述、所有者、全名
     * @param params.languages 编程语言数组
     * @param params.categoryIds 分类 ID 数组
     * @param params.dateField 日期字段名（starred_at / repo_created_at / repo_updated_at / repo_pushed_at）
     * @param params.startDate 日期范围起始
     * @param params.endDate 日期范围结束
     * @param params.untranslatedOnly 是否仅查询未翻译的仓库
     * @returns Prisma where 条件对象
     */
    private buildWhere(params: {
        keyword?: string;
        languages?: string[];
        categoryIds?: number[];
        tagIds?: number[];
        dateField?: string;
        startDate?: string;
        endDate?: string;
        untranslatedOnly?: boolean;
    }): Prisma.GithubRepoWhereInput {
        const AND: Prisma.GithubRepoWhereInput[] = [];
        if (params.categoryIds?.length) {
            AND.push({ repoCategories: { some: { categoryId: { in: params.categoryIds.map(BigInt) } } } });
        }
        if (params.tagIds?.length) {
            AND.push({ repoTags: { some: { tagId: { in: params.tagIds.map(BigInt) } } } });
        }
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
        if (params.dateField && DATE_MAP[params.dateField] && (params.startDate || params.endDate)) {
            const f = DATE_MAP[params.dateField];
            const cond: any = {};
            if (params.startDate) cond.gte = new Date(params.startDate + 'T00:00:00+08:00');
            if (params.endDate) cond.lte = new Date(params.endDate + 'T23:59:59+08:00');
            AND.push({ [f]: cond });
        }
        return AND.length > 0 ? { AND } : {};
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
     * @param params.categoryIds 分类 ID（逗号分隔）
     * @param params.sortBy 排序字段
     * @param params.sortOrder 排序方向（asc/desc）
     * @param params.dateField 日期筛选字段
     * @param params.startDate 日期范围起始
     * @param params.endDate 日期范围结束
     * @param params.untranslatedOnly 是否仅显示未翻译仓库
     * @returns 分页结果，包含 records、total、size、current、pages
     */
    async findPage(params: {
        page?: number;
        size?: number;
        keyword?: string;
        language?: string;
        categoryIds?: string;
        tagIds?: string;
        sortBy?: string;
        sortOrder?: string;
        dateField?: string;
        startDate?: string;
        endDate?: string;
        untranslatedOnly?: boolean;
    }) {
        const page = params.page || 1,
            size = params.size || 12;
        this.logger.log('分页查询仓库列表: page=' + page + ', size=' + size + ', keyword=' + (params.keyword || ''));
        const languages = params.language ? params.language.split(',').filter(Boolean) : [];
        const catIds = await this.expandCategoryIds(params.categoryIds || '');
        const tagIds = params.tagIds ? params.tagIds.split(',').map(Number).filter((n) => !isNaN(n)) : [];
        const sortField = SORT_MAP[params.sortBy || 'starred_at'] || 'starredAt';
        const sortDir = params.sortOrder === 'asc' ? 'asc' : 'desc';
        const where = this.buildWhere({
            keyword: params.keyword,
            languages: languages.length > 0 ? languages : undefined,
            categoryIds: catIds.length > 0 ? catIds : undefined,
            tagIds: tagIds.length > 0 ? tagIds : undefined,
            dateField: params.dateField,
            startDate: params.startDate,
            endDate: params.endDate,
            untranslatedOnly: params.untranslatedOnly,
        });
        const [total, records] = await Promise.all([
            this.prisma.githubRepo.count({ where }),
            this.prisma.githubRepo.findMany({ where, orderBy: { [sortField]: sortDir }, skip: (page - 1) * size, take: size }),
        ]);
        await this.fillCategoryNames(records);
        await this.fillTagNames(records);
        // 附加翻译状态（前端列表可直接展示翻译徽标）
        const enriched = records.map((r) => ({
            ...r,
            translationStatus: {
                description: r.descriptionCn ? 'completed' : r.description ? 'pending' : 'none',
                readme: r.readmeCn ? 'completed' : r.readmeFetched ? 'none' : 'pending',
            },
        }));
        return { records: enriched, total, size, current: page, pages: Math.ceil(total / size) };
    }

    /**
     * 根据 ID 查询单个仓库详情
     *
     * 返回仓库基本信息及其关联的分类名称列表。
     *
     * @param id 仓库数字 ID
     * @returns 仓库对象（含 categoryNames 数组），不存在返回 null
     */
    async findById(id: number) {
        const repo = await this.prisma.githubRepo.findUnique({ where: { id: BigInt(id) } });
        if (!repo) return null;
        const result = { ...repo, categoryNames: [] as string[] };
        await this.fillCategoryNames([result]);
        await this.fillTagNames([result]);
        return result;
    }

    /**
     * 查询所有符合条件的仓库 URL 列表
     *
     * 用于导出功能，返回 htmlUrl 数组。
     *
     * @param params 筛选参数（同 findPage）
     * @returns 仓库 htmlUrl 字符串数组
     */
    async findAllUrls(params: {
        keyword?: string;
        language?: string;
        categoryIds?: string;
        sortBy?: string;
        sortOrder?: string;
        dateField?: string;
        startDate?: string;
        endDate?: string;
        untranslatedOnly?: boolean;
    }) {
        const languages = params.language ? params.language.split(',').filter(Boolean) : [];
        const catIds = await this.expandCategoryIds(params.categoryIds || '');
        const sortField = SORT_MAP[params.sortBy || 'starred_at'] || 'starredAt';
        const sortDir = params.sortOrder === 'asc' ? 'asc' : 'desc';
        const where = this.buildWhere({
            keyword: params.keyword,
            languages: languages.length > 0 ? languages : undefined,
            categoryIds: catIds.length > 0 ? catIds : undefined,
            dateField: params.dateField,
            startDate: params.startDate,
            endDate: params.endDate,
            untranslatedOnly: params.untranslatedOnly,
        });
        const repos = await this.prisma.githubRepo.findMany({ where, select: { htmlUrl: true }, orderBy: { [sortField]: sortDir } });
        return repos.map((r) => r.htmlUrl).filter(Boolean) as string[];
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
    async findAll(params: { keyword?: string; language?: string; sortBy?: string; sortOrder?: string }) {
        const languages = params.language ? params.language.split(',').filter(Boolean) : [];
        const sortField = SORT_MAP[params.sortBy || 'starred_at'] || 'starredAt';
        const sortDir = params.sortOrder === 'asc' ? 'asc' : 'desc';
        const where = this.buildWhere({ keyword: params.keyword, languages: languages.length > 0 ? languages : undefined });
        return this.prisma.githubRepo.findMany({ where, orderBy: { [sortField]: sortDir } });
    }

    /**
     * 插入或更新仓库记录
     *
     * 使用 INSERT ON DUPLICATE KEY UPDATE 实现单次数据库往返的 upsert 操作。
     * 以 full_name 为唯一键判断是否存在，存在则更新字段，不存在则插入新记录。
     *
     * @param data 仓库数据对象，对应 github_repo 表字段
     */
    async upsertRepo(data: any) {
        this.logger.log('upsert 仓库: ' + (data.fullName || data.repoName || 'unknown'));
        await this.prisma.$executeRaw`
      INSERT INTO github_repo (repo_name, full_name, description, language, owner_name, owner_avatar_url, html_url, homepage,
        stars_count, forks_count, watchers_count, open_issues_count, topics, license_name, is_fork, is_archived,
        repo_created_at, repo_updated_at, repo_pushed_at, starred_at, created_at, updated_at, description_cn, readme_cn, readme_original, readme_fetched)
      VALUES (${data.repoName || ''}, ${data.fullName || ''}, ${data.description}, ${data.language}, ${data.ownerName},
        ${data.ownerAvatarUrl}, ${data.htmlUrl}, ${data.homepage}, ${data.starsCount || 0}, ${data.forksCount || 0},
        ${data.watchersCount || 0}, ${data.openIssuesCount || 0}, ${data.topics || '[]'}, ${data.licenseName},
        ${data.isFork ? 1 : 0}, ${data.isArchived ? 1 : 0}, ${data.repoCreatedAt}, ${data.repoUpdatedAt},
        ${data.repoPushedAt}, ${data.starredAt}, ${data.createdAt || new Date()}, ${data.updatedAt || new Date()},
        ${data.descriptionCn || null}, ${data.readmeCn || null}, ${data.readmeOriginal || null}, ${data.readmeFetched ? 1 : 0})
      ON DUPLICATE KEY UPDATE
        repo_name=VALUES(repo_name), description=VALUES(description), language=VALUES(language),
        owner_name=VALUES(owner_name), owner_avatar_url=VALUES(owner_avatar_url), html_url=VALUES(html_url),
        homepage=VALUES(homepage), stars_count=VALUES(stars_count), forks_count=VALUES(forks_count),
        watchers_count=VALUES(watchers_count), open_issues_count=VALUES(open_issues_count), topics=VALUES(topics),
        license_name=VALUES(license_name), is_fork=VALUES(is_fork), is_archived=VALUES(is_archived),
        repo_created_at=VALUES(repo_created_at), repo_updated_at=VALUES(repo_updated_at),
        repo_pushed_at=VALUES(repo_pushed_at), starred_at=VALUES(starred_at), updated_at=VALUES(updated_at)
    `;
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
     * 为仓库列表批量填充分类名称
     *
     * 通过 repo_category 关联表查询每个仓库的分类名称，
     * 并将结果写入每个仓库对象的 categoryNames 属性。
     *
     * @param repos 仓库对象数组（需含 id 字段，会被原地修改写入 categoryNames）
     */
    async fillCategoryNames(repos: Array<{ id: bigint; categoryNames?: string[] }>) {
        if (!repos.length) return;
        const ids = repos.map((r) => r.id);
        const mappings = await this.prisma.repoCategory.findMany({
            where: { repoId: { in: ids } },
            include: { category: { select: { name: true } } },
        });
        const map = new Map<bigint, string[]>();
        for (const m of mappings) {
            const list = map.get(m.repoId) || [];
            list.push(m.category.name);
            map.set(m.repoId, list);
        }
        for (const r of repos) r.categoryNames = map.get(r.id) || [];
    }

    /**
     * 为仓库列表批量填充标签名称（按维度分组）
     *
     * 通过 repo_tag 关联表查询每个仓库的标签信息（含维度名），
     * 并将结果写入每个仓库对象的 tagNames 属性。
     *
     * @param repos 仓库对象数组（会被原地修改写入 tagNames）
     */
    async fillTagNames(repos: Array<{ id: bigint; tagNames?: string[] }>) {
        if (!repos.length) return;
        const ids = repos.map((r) => r.id);
        const mappings = await this.prisma.repoTag.findMany({
            where: { repoId: { in: ids } },
            include: { tag: { include: { group: true } } },
        });
        const map = new Map<bigint, string[]>();
        for (const m of mappings) {
            const list = map.get(m.repoId) || [];
            list.push(m.tag.name);
            map.set(m.repoId, list);
        }
        for (const r of repos) r.tagNames = map.get(r.id) || [];
    }

    /**
     * 统计筛选条件下的翻译覆盖情况
     *
     * 与 findPage 使用相同的 buildWhere 构建筛选条件，
     * 确保 total、descCompleted、readmeCompleted 都在同一筛选范围内计算。
     * 修复之前 getTranslationSummary 中已翻译数不遵守筛选条件全库查询的 Bug。
     *
     * @param params 筛选参数（与 findPage / getTranslationSummary 一致）
     * @returns { total, descCompleted, descPending, readmeCompleted, readmePending }
     */
    async countTranslationStatus(params: {
        keyword?: string;
        language?: string;
        categoryIds?: string;
        dateField?: string;
        startDate?: string;
        endDate?: string;
        untranslatedOnly?: boolean;
    }) {
        const languages = params.language ? params.language.split(',').filter(Boolean) : [];
        const catIds = await this.expandCategoryIds(params.categoryIds || '');
        const where = this.buildWhere({
            keyword: params.keyword,
            languages: languages.length > 0 ? languages : undefined,
            categoryIds: catIds.length > 0 ? catIds : undefined,
            dateField: params.dateField,
            startDate: params.startDate,
            endDate: params.endDate,
            untranslatedOnly: params.untranslatedOnly,
        });

        const [total, descCompleted, readmeCompleted] = await Promise.all([
            this.prisma.githubRepo.count({ where }),
            this.prisma.githubRepo.count({
                where: {
                    AND: [
                        where,
                        { descriptionCn: { not: null } },
                        { descriptionCn: { not: '' } },
                    ],
                },
            }),
            this.prisma.githubRepo.count({
                where: {
                    AND: [
                        where,
                        { readmeCn: { not: null } },
                        { readmeCn: { not: '' } },
                    ],
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
}
