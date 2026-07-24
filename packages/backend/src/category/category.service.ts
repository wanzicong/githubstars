import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginationResult } from '../common/utils/pagination.util';
import type {
    CategoryCreateDto,
    CategoryUpdateDto,
    CategorySortDto,
    CategoryReposDto,
    CategoryBindDto,
    CategoryUnbindDto,
} from './category.dto';

/**
 * 分类服务 —— 分类 CRUD、树查询、仓库关联管理。
 *
 * 架构层级：Service 层（业务逻辑层），介于 Controller 与 PrismaService 之间。
 *
 * @callers
 *   - CategoryController — 所有分类 API 端点
 *
 * @depends
 *   - PrismaService — category / category_repo_link / github_repo 表操作
 */
@Injectable()
export class CategoryService {
    private readonly logger = new Logger(CategoryService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 获取完整分类树（两级树形结构）
     *
     * 查询所有一级分类及其子分类，构建树形结构，包含仓库数量统计。
     *
     * @returns 分类树数组（CategoryNode[] 格式）
     */
    async getCategoryTree() {
        this.logger.log('获取分类树');

        const categories = await this.prisma.category.findMany({
            where: { parentId: null },
            include: {
                children: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        _count: { select: { categoryRepoLinks: true } },
                    },
                },
                _count: { select: { categoryRepoLinks: true } },
            },
            orderBy: { sortOrder: 'asc' },
        });

        return categories.map((parent) => ({
            id: Number(parent.id),
            name: parent.name,
            parentId: null,
            sortOrder: parent.sortOrder,
            icon: parent.icon,
            description: parent.description,
            repoCount: parent._count.categoryRepoLinks,
            createdAt: parent.createdAt,
            updatedAt: parent.updatedAt,
            children: parent.children.map((child) => ({
                id: Number(child.id),
                name: child.name,
                parentId: Number(child.parentId),
                sortOrder: child.sortOrder,
                icon: child.icon,
                description: child.description,
                repoCount: child._count.categoryRepoLinks,
                createdAt: child.createdAt,
                updatedAt: child.updatedAt,
                children: [],
            })),
        }));
    }

    /**
     * 获取一级分类列表（分页）
     *
     * @param page  页码（从 1 开始）
     * @param size  每页条数
     * @param keyword 按分类名称模糊搜索
     * @returns 分页结果
     */
    async getCategoryList(page: number, size: number, keyword: string) {
        this.logger.log(`查询分类列表: page=${page}, size=${size}, keyword="${keyword}"`);

        const where = {
            parentId: null,
            ...(keyword ? { name: { contains: keyword } } : {}),
        };

        const [total, categories] = await Promise.all([
            this.prisma.category.count({ where }),
            this.prisma.category.findMany({
                where,
                include: {
                    children: {
                        orderBy: { sortOrder: 'asc' },
                        include: {
                            _count: { select: { categoryRepoLinks: true } },
                        },
                    },
                    _count: { select: { categoryRepoLinks: true } },
                },
                orderBy: { sortOrder: 'asc' },
                skip: (page - 1) * size,
                take: size,
            }),
        ]);

        const records = categories.map((parent) => ({
            id: Number(parent.id),
            name: parent.name,
            parentId: null,
            sortOrder: parent.sortOrder,
            icon: parent.icon,
            description: parent.description,
            repoCount: parent._count.categoryRepoLinks,
            createdAt: parent.createdAt,
            updatedAt: parent.updatedAt,
            children: parent.children.map((child) => ({
                id: Number(child.id),
                name: child.name,
                parentId: Number(child.parentId),
                sortOrder: child.sortOrder,
                icon: child.icon,
                description: child.description,
                repoCount: child._count.categoryRepoLinks,
                createdAt: child.createdAt,
                updatedAt: child.updatedAt,
            })),
        }));

        return buildPaginationResult(records, total, page, size);
    }

    /**
     * 创建分类
     *
     * 检查同级别下名称唯一性，然后创建新分类记录。
     *
     * @param data 创建分类参数
     * @returns 创建的分类对象
     */
    async createCategory(data: CategoryCreateDto) {
        this.logger.log(`创建分类: name=${data.name}, parentId=${data.parentId}`);

        // 检查同级别下名称唯一性
        const existing = await this.prisma.category.findFirst({
            where: {
                name: data.name,
                parentId: data.parentId ? data.parentId : null,
            },
        });

        if (existing) {
            throw new ConflictException(`分类名称 "${data.name}" 在当前级别下已存在`);
        }

        const category = await this.prisma.category.create({
            data: {
                name: data.name,
                parentId: data.parentId ? data.parentId : null,
                sortOrder: data.sortOrder ?? 0,
                icon: data.icon ?? null,
                description: data.description ?? null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });

        return {
            id: Number(category.id),
            name: category.name,
            parentId: category.parentId ? Number(category.parentId) : null,
            sortOrder: category.sortOrder,
            icon: category.icon,
            description: category.description,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
        };
    }

    /**
     * 更新分类
     *
     * 支持部分字段更新，校验分类存在性和父分类合法性。
     *
     * @param data 更新分类参数
     * @returns 更新后的分类对象
     */
    async updateCategory(data: CategoryUpdateDto) {
        this.logger.log(`更新分类: id=${data.id}`);

        const existing = await this.prisma.category.findUnique({
            where: { id: data.id },
        });

        if (!existing) {
            throw new NotFoundException(`分类 ID ${data.id} 不存在`);
        }

        // 检查循环引用
        await this.validateCircularReference(data.id, data.parentId);

        // 名称变更时检查同级别唯一性
        if (data.name !== undefined) {
            await this.validateCategoryNameUniqueness(
                data.id,
                data.name,
                existing.parentId ? Number(existing.parentId) : null,
                data.parentId,
            );
        }

        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.parentId !== undefined) updateData.parentId = data.parentId ?? null;
        if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
        if (data.icon !== undefined) updateData.icon = data.icon ?? null;
        if (data.description !== undefined) updateData.description = data.description ?? null;

        const category = await this.prisma.category.update({
            where: { id: data.id },
            data: updateData,
        });

        return {
            id: Number(category.id),
            name: category.name,
            parentId: category.parentId ? Number(category.parentId) : null,
            sortOrder: category.sortOrder,
            icon: category.icon,
            description: category.description,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
        };
    }

    /**
     * 验证分类循环引用 — 检查 parentId 是否会形成循环
     *
     * @param id       当前分类 ID
     * @param parentId 新的父分类 ID（可能为 undefined / null / number）
     * @throws ConflictException 形成循环引用时抛出
     * @throws NotFoundException 父分类不存在时抛出
     */
    private async validateCircularReference(id: number, parentId: number | undefined | null): Promise<void> {
        if (parentId === undefined) return;

        if (parentId === id) {
            throw new ConflictException('不能将分类设置为自身的父分类');
        }

        if (parentId !== null) {
            const parent = await this.prisma.category.findUnique({
                where: { id: parentId },
            });
            if (!parent) {
                throw new NotFoundException(`父分类 ID ${parentId} 不存在`);
            }

            // 检查间接循环：如果新父分类是当前分类的子分类，则形成循环
            if (parent.parentId !== null && Number(parent.parentId) === id) {
                throw new ConflictException('不能将分类设置为其子分类的子分类，这会形成循环引用');
            }
        }
    }

    /**
     * 验证分类名称在同级别下的唯一性
     *
     * @param id                当前分类 ID
     * @param name              新的分类名称
     * @param existingParentId  当前已有的父分类 ID
     * @param newParentId       新的父分类 ID（可选）
     * @throws ConflictException 名称重复时抛出
     */
    private async validateCategoryNameUniqueness(
        id: number,
        name: string,
        existingParentId: number | null,
        newParentId?: number | null,
    ): Promise<void> {
        const targetParentId = newParentId !== undefined ? (newParentId ?? null) : existingParentId;

        const duplicate = await this.prisma.category.findFirst({
            where: {
                name,
                parentId: targetParentId,
                id: { not: id },
            },
        });
        if (duplicate) {
            throw new ConflictException(`分类名称 "${name}" 在当前级别下已存在`);
        }
    }

    /**
     * 删除分类
     *
     * 删除前检查是否有子分类，有子分类时拒绝删除。
     * 关联的 CategoryRepoLink 通过 onDelete: Cascade 自动清理。
     *
     * @param id 分类ID
     * @returns 删除结果
     */
    async deleteCategory(id: number) {
        this.logger.log(`删除分类: id=${id}`);

        const existing = await this.prisma.category.findUnique({
            where: { id },
            include: { children: true },
        });

        if (!existing) {
            throw new NotFoundException(`分类 ID ${id} 不存在`);
        }

        if (existing.children.length > 0) {
            throw new ConflictException('该分类下存在子分类，请先删除子分类');
        }

        await this.prisma.category.delete({ where: { id } });

        return { success: true };
    }

    /**
     * 拖拽排序 — 批量更新分类的 sortOrder
     *
     * 在事务中批量执行 UPDATE，确保数据一致性。
     *
     * @param data 排序数据 { items: [{ id, sortOrder }] }
     * @returns 更新结果
     */
    async sortCategories(data: CategorySortDto) {
        this.logger.log(`分类排序: ${data.items.length} 个分类`);

        try {
            await this.prisma.$transaction(
                data.items.map((item) =>
                    this.prisma.category.update({
                        where: { id: item.id },
                        data: { sortOrder: item.sortOrder },
                    }),
                ),
            );
        } catch (error) {
            if (error instanceof Error && error.message.includes('Record to update not found')) {
                throw new NotFoundException('排序数据中包含不存在的分类ID');
            }
            throw error;
        }

        return { success: true };
    }

    /**
     * 查询某分类下的仓库列表（分页 + 筛选）
     *
     * 如果是一级分类，会递归包含所有子分类下的仓库。
     *
     * @param params 查询参数
     * @returns 分页后的仓库列表
     *
     * @callers CategoryController.repos()
     * @depends PrismaService.category / categoryRepoLink / github_repo 表操作
     */
    async getCategoryRepos(params: CategoryReposDto) {
        const { categoryId, page, size, keyword, language, sortBy, sortOrder } = params;
        this.logger.log(`查询分类仓库: categoryId=${categoryId}`);

        const category = await this.prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundException(`分类 ID ${categoryId} 不存在`);
        }

        // 收集当前分类和所有子分类 ID
        const categoryIds: number[] = [categoryId];
        const childIds = await this.getChildCategoryIds(categoryId);
        categoryIds.push(...childIds);

        // 筛选条件 — 包含所有子分类下的仓库
        const where: Record<string, unknown> = {
            categories: {
                some: { categoryId: { in: categoryIds } },
            },
        };

        if (keyword) {
            where.OR = [{ repoName: { contains: keyword } }, { fullName: { contains: keyword } }, { description: { contains: keyword } }];
        }

        if (language) {
            where.language = language;
        }

        const sortField = this.resolveSortField(sortBy);
        const sortDir = sortOrder === 'asc' ? 'asc' : 'desc';

        const [total, repos] = await Promise.all([
            this.prisma.githubRepo.count({ where }),
            this.prisma.githubRepo.findMany({
                where,
                orderBy: { [sortField]: sortDir },
                skip: (page - 1) * size,
                take: size,
            }),
        ]);

        const records = repos.map((repo) => ({
            id: Number(repo.id),
            repoName: repo.repoName,
            fullName: repo.fullName,
            description: repo.description,
            descriptionCn: repo.descriptionCn,
            language: repo.language,
            ownerName: repo.ownerName,
            ownerAvatarUrl: repo.ownerAvatarUrl,
            htmlUrl: repo.htmlUrl,
            starsCount: repo.starsCount,
            forksCount: repo.forksCount,
            watchersCount: repo.watchersCount,
            openIssuesCount: repo.openIssuesCount,
            topics: repo.topics,
            licenseName: repo.licenseName,
            isFork: repo.isFork,
            isArchived: repo.isArchived,
            repoCreatedAt: repo.repoCreatedAt,
            repoUpdatedAt: repo.repoUpdatedAt,
            repoPushedAt: repo.repoPushedAt,
            starredAt: repo.starredAt,
        }));

        return buildPaginationResult(records, total, page, size);
    }

    /**
     * 批量绑定仓库到分类
     *
     * 使用 upsert 避免重复关联报错。
     *
     * @param data { categoryId, repoIds }
     * @returns 绑定结果
     */
    async bindReposToCategory(data: CategoryBindDto) {
        this.logger.log(`绑定仓库到分类: categoryId=${data.categoryId}, repoIds=${data.repoIds.join(',')}`);

        const category = await this.prisma.category.findUnique({
            where: { id: data.categoryId },
        });

        if (!category) {
            throw new NotFoundException(`分类 ID ${data.categoryId} 不存在`);
        }

        // 校验仓库ID存在性
        const repoIds = data.repoIds;
        const repos = await this.prisma.githubRepo.findMany({
            where: { id: { in: repoIds } },
            select: { id: true },
        });

        const existingRepoIds = new Set(repos.map((r) => Number(r.id)));
        const missingIds = data.repoIds.filter((id) => !existingRepoIds.has(id));
        if (missingIds.length > 0) {
            throw new NotFoundException(`仓库ID不存在: ${missingIds.join(', ')}`);
        }

        const results = await this.prisma.$transaction(
            repoIds.map((repoId) =>
                this.prisma.categoryRepoLink.upsert({
                    where: {
                        categoryId_repoId: {
                            categoryId: data.categoryId,
                            repoId,
                        },
                    },
                    update: {},
                    create: {
                        categoryId: data.categoryId,
                        repoId,
                        createdAt: new Date(),
                    },
                }),
            ),
        );

        return { success: true, count: results.length };
    }

    /**
     * 批量解绑仓库从分类
     *
     * @param data { categoryId, repoIds }
     * @returns 解绑结果
     */
    async unbindReposFromCategory(data: CategoryUnbindDto) {
        this.logger.log(`解绑仓库从分类: categoryId=${data.categoryId}, repoIds=${data.repoIds.join(',')}`);

        const category = await this.prisma.category.findUnique({
            where: { id: data.categoryId },
        });

        if (!category) {
            throw new NotFoundException(`分类 ID ${data.categoryId} 不存在`);
        }

        const result = await this.prisma.categoryRepoLink.deleteMany({
            where: {
                categoryId: data.categoryId,
                repoId: { in: data.repoIds },
            },
        });

        return { success: true, count: result.count };
    }

    /**
     * 排序字段映射 — 将 API 参数转换为 Prisma 字段名
     */
    private resolveSortField(sortBy: string): string {
        const sortMap: Record<string, string> = {
            stars_count: 'starsCount',
            forks_count: 'forksCount',
            repo_size: 'repoSize',
            repo_updated_at: 'repoUpdatedAt',
            repo_created_at: 'repoCreatedAt',
            repo_pushed_at: 'repoPushedAt',
            starred_at: 'starredAt',
            watchers_count: 'watchersCount',
            open_issues_count: 'openIssuesCount',
        };

        return sortMap[sortBy] || 'starsCount';
    }

    /**
     * 获取分类下所有仓库信息（递归包含子分类）
     *
     * 用于批量克隆/下载操作，返回去重后的仓库完整信息。
     *
     * @param categoryId       分类 ID
     * @param includeChildren  是否包含子分类（默认 true）
     * @returns 仓库信息数组（已去重）
     *
     * @callers CategoryController.getCategoryRepoIds()
     * @depends PrismaService.category / categoryRepoLink / github_repo 表操作
     */
    async getCategoryRepoIds(categoryId: number, includeChildren: boolean) {
        this.logger.log(`获取分类仓库 ID: categoryId=${categoryId}, includeChildren=${includeChildren}`);

        // 1. 校验分类存在性
        const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
        if (!category) {
            throw new NotFoundException(`分类 ID ${categoryId} 不存在`);
        }

        // 2. 收集所有要查询的分类 ID
        const categoryIds: number[] = [categoryId];
        if (includeChildren) {
            const childIds = await this.getChildCategoryIds(categoryId);
            categoryIds.push(...childIds);
        }

        // 3. 查询所有关联的仓库 ID（去重）
        const links = await this.prisma.categoryRepoLink.findMany({
            where: { categoryId: { in: categoryIds } },
            select: { repoId: true },
        });
        const uniqueRepoIds = [...new Set(links.map((l) => Number(l.repoId)))];

        if (uniqueRepoIds.length === 0) {
            return { repos: [], totalCount: 0 };
        }

        // 4. 查询完整的仓库信息
        const repos = await this.prisma.githubRepo.findMany({
            where: { id: { in: uniqueRepoIds } },
            select: {
                id: true,
                repoName: true,
                fullName: true,
                description: true,
                language: true,
                ownerName: true,
                ownerAvatarUrl: true,
                htmlUrl: true,
                starsCount: true,
                forksCount: true,
                watchersCount: true,
                openIssuesCount: true,
                topics: true,
                licenseName: true,
                isFork: true,
                isArchived: true,
                repoSize: true,
                defaultBranch: true,
                visibility: true,
                repoCreatedAt: true,
                repoUpdatedAt: true,
                repoPushedAt: true,
                starredAt: true,
            },
            orderBy: { starsCount: 'desc' },
        });

        // 5. 转换为前端格式
        const formattedRepos = repos.map((repo) => ({
            id: Number(repo.id),
            repoName: repo.repoName,
            fullName: repo.fullName,
            description: repo.description,
            language: repo.language,
            ownerName: repo.ownerName,
            ownerAvatarUrl: repo.ownerAvatarUrl,
            htmlUrl: repo.htmlUrl,
            starsCount: repo.starsCount,
            forksCount: repo.forksCount,
            watchersCount: repo.watchersCount,
            openIssuesCount: repo.openIssuesCount,
            topics: repo.topics,
            licenseName: repo.licenseName,
            isFork: repo.isFork,
            isArchived: repo.isArchived,
            repoSize: repo.repoSize,
            defaultBranch: repo.defaultBranch,
            visibility: repo.visibility,
            repoCreatedAt: repo.repoCreatedAt,
            repoUpdatedAt: repo.repoUpdatedAt,
            repoPushedAt: repo.repoPushedAt,
            starredAt: repo.starredAt,
        }));

        this.logger.log(`分类 ${categoryId} 下共 ${formattedRepos.length} 个仓库`);
        return { repos: formattedRepos, totalCount: formattedRepos.length };
    }

    /**
     * 查询某仓库所属的分类 ID 列表
     *
     * @callers 前端"管理分类"弹窗初始化勾选状态
     */
    async getRepoCategoryIds(repoId: number): Promise<number[]> {
        this.logger.log(`查询仓库所属分类: repoId=${repoId}`);
        const links = await this.prisma.categoryRepoLink.findMany({
            where: { repoId },
            select: { categoryId: true },
        });
        return links.map((l) => Number(l.categoryId));
    }

    /**
     * 递归获取所有子分类 ID
     *
     * @param parentId 父分类 ID
     * @returns 所有后代分类 ID 数组
     */
    private async getChildCategoryIds(parentId: number): Promise<number[]> {
        const children = await this.prisma.category.findMany({
            where: { parentId },
            select: { id: true },
        });

        const childIds = children.map((c) => Number(c.id));
        if (childIds.length === 0) return [];

        // 递归查询子分类的子分类
        const grandChildIds = await Promise.all(childIds.map((id) => this.getChildCategoryIds(id)));

        return [...childIds, ...grandChildIds.flat()];
    }
}
