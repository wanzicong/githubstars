import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GithubRepoService } from '../github/services/github-repo.service';

@Injectable()
export class CategoryService {
    private readonly logger = new Logger(CategoryService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 查询所有分类，构建树形结构并按仓库数量降序排列
     *
     * @returns  树形分类列表，每个节点包含 repoCount 和 children 子节点
     */
    async listAll() {
        const all = await this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
        const counts = await this.prisma.repoCategory.groupBy({ by: ['categoryId'], _count: { categoryId: true } });
        const countMap = new Map<string, number>();
        for (const r of counts) countMap.set(String(r.categoryId), r._count.categoryId);

        const enriched = all.map((c) => ({ ...c, repoCount: countMap.get(String(c.id)) || 0, children: [] as any[] }));
        const parentMap = new Map<bigint, any>();
        for (const c of enriched) parentMap.set(c.id, c);

        const roots: any[] = [];
        for (const c of enriched) {
            if (c.level === 2 && c.parentId) {
                const parent = parentMap.get(c.parentId);
                if (parent) parent.children.push(c);
                else roots.push(c);
            } else roots.push(c);
        }
        for (const root of roots) {
            for (const child of root.children) root.repoCount += child.repoCount;
        }
        roots.sort((a: any, b: any) => b.repoCount - a.repoCount);
        return roots;
    }

    /**
     * 根据 ID 查询单个分类
     *
     * @param id  分类 ID
     * @returns   分类记录或 null
     */
    async getById(id: number) {
        return this.prisma.category.findUnique({ where: { id: BigInt(id) } });
    }

    /**
     * 创建新分类，重名校验通过 name 唯一索引保证
     *
     * @param name        分类名称
     * @param description 分类描述
     * @param parentId    父分类 ID，有则视为二级分类
     * @returns           新创建的分类记录
     */
    async create(name: string, description?: string, parentId?: number) {
        const trimmed = name.trim();
        const exist = await this.prisma.category.findUnique({ where: { name: trimmed } });
        if (exist) throw new Error('分类名已存在: ' + trimmed);
        return this.prisma.category.create({
            data: {
                name: trimmed,
                description: description || null,
                parentId: parentId ? BigInt(parentId) : null,
                level: parentId ? 2 : 1,
                sortOrder: 0,
                createdAt: new Date(),
            },
        });
    }

    /**
     * 更新分类名称和描述
     *
     * @param id          分类 ID
     * @param name        新名称
     * @param description 新描述
     * @returns           更新后的分类记录
     */
    async update(id: number, name: string, description?: string) {
        const cat = await this.prisma.category.findUnique({ where: { id: BigInt(id) } });
        if (!cat) throw new Error('分类不存在');
        return this.prisma.category.update({
            where: { id: BigInt(id) },
            data: { name: name.trim(), description: description || null, updatedAt: new Date() },
        });
    }

    /**
     * 删除分类及其所有仓库关联关系
     *
     * @param id  分类 ID
     */
    async delete(id: number) {
        this.logger.log('删除分类: id=' + id);
        await this.prisma.repoCategory.deleteMany({ where: { categoryId: BigInt(id) } });
        await this.prisma.category.delete({ where: { id: BigInt(id) } });
        this.logger.log('分类删除成功: id=' + id);
    }

    /**
     * 批量删除分类，逐个调用 delete 方法
     *
     * @param ids  待删除的分类 ID 列表
     */
    async batchDelete(ids: number[]) {
        this.logger.log('批量删除分类: count=' + ids.length + ', ids=' + ids.join(','));
        for (const id of ids) await this.delete(id);
    }

    /**
     * 将分类移动到新的父分类下
     *
     * @param id       被移动的分类 ID
     * @param parentId 目标父分类 ID
     */
    async moveToParent(id: number, parentId: number) {
        this.logger.log('移动分类: id=' + id + ' -> parentId=' + parentId);
        await this.prisma.category.update({ where: { id: BigInt(id) }, data: { parentId: BigInt(parentId), updatedAt: new Date() } });
        this.logger.log('分类移动成功: id=' + id);
    }

    /**
     * 根据分类 ID 查询该分类下的所有仓库，按 Star 数降序
     *
     * @param catId  分类 ID
     * @returns      该分类下的仓库列表
     */
    async getReposByCategoryId(catId: number) {
        const mappings = await this.prisma.repoCategory.findMany({ where: { categoryId: BigInt(catId) }, select: { repoId: true } });
        if (!mappings.length) return [];
        const repos = await this.prisma.githubRepo.findMany({ where: { id: { in: mappings.map((m) => m.repoId) } } });
        repos.sort((a, b) => Number(b.starsCount) - Number(a.starsCount));
        return repos;
    }

    /**
     * 分页查询分类下的仓库，支持关键字搜索、语言筛选和排序
     *
     * @param params  分页查询参数（categoryId、page、size、keyword、language、sortBy、sortOrder）
     * @returns       分页结果（records、total、size、current、pages）
     */
    async getReposByCategoryIdPaged(params: {
        categoryId: number;
        page?: number;
        size?: number;
        keyword?: string;
        language?: string;
        sortBy?: string;
        sortOrder?: string;
    }) {
        const page = params.page || 1;
        const size = params.size || 12;
        const mappings = await this.prisma.repoCategory.findMany({
            where: { categoryId: BigInt(params.categoryId) },
            select: { repoId: true },
        });
        const repoIds = mappings.map((m) => m.repoId);
        if (!repoIds.length) return { records: [], total: 0, size, current: page, pages: 0 };

        const sortField = (
            params.sortBy === 'stars_count'
                ? 'starsCount'
                : params.sortBy === 'forks_count'
                  ? 'forksCount'
                  : params.sortBy === 'repo_updated_at'
                    ? 'repoUpdatedAt'
                    : 'starredAt'
        ) as string;
        const sortDir = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
        const where: any = { id: { in: repoIds } };
        if (params.keyword)
            where.OR = [
                { repoName: { contains: params.keyword } },
                { description: { contains: params.keyword } },
                { fullName: { contains: params.keyword } },
                { ownerName: { contains: params.keyword } },
            ];
        if (params.language) where.language = { in: params.language.split(',').filter(Boolean) };

        const [total, records] = await Promise.all([
            this.prisma.githubRepo.count({ where }),
            this.prisma.githubRepo.findMany({ where, orderBy: { [sortField]: sortDir }, skip: (page - 1) * size, take: size }),
        ]);
        return { records, total, size, current: page, pages: Math.ceil(total / size) };
    }

    /**
     * 将单个仓库添加到指定分类
     *
     * @param repoId  仓库 ID
     * @param catId   分类 ID
     */
    async addRepoToCategory(repoId: number, catId: number) {
        await this.prisma.repoCategory.create({ data: { repoId: BigInt(repoId), categoryId: BigInt(catId), createdAt: new Date() } });
    }

    /**
     * 批量将仓库添加到分类中（禁止直接添加到一级分类）
     *
     * @param repoIds  仓库 ID 列表
     * @param catId    分类 ID
     */
    async batchAddRepos(repoIds: number[], catId: number) {
        this.logger.log('批量添加仓库到分类: catId=' + catId + ', count=' + repoIds.length);
        const cat = await this.prisma.category.findUnique({ where: { id: BigInt(catId) } });
        if (cat?.level === 1) throw new Error('一级分类不能直接包含仓库');
        await this.prisma.repoCategory.createMany({
            data: repoIds.map((r) => ({ repoId: BigInt(r), categoryId: BigInt(catId), createdAt: new Date() })),
            skipDuplicates: true,
        });
        this.logger.log('批量添加完成: catId=' + catId + ', count=' + repoIds.length);
    }

    /**
     * 从分类中移除单个仓库
     *
     * @param repoId  仓库 ID
     * @param catId   分类 ID
     */
    async removeRepoFromCategory(repoId: number, catId: number) {
        await this.prisma.repoCategory.deleteMany({ where: { repoId: BigInt(repoId), categoryId: BigInt(catId) } });
    }

    /**
     * 批量将仓库从源分类转移到目标分类
     *
     * @param repoIds  仓库 ID 列表
     * @param fromId   源分类 ID
     * @param toId     目标分类 ID
     */
    async batchTransferRepos(repoIds: number[], fromId: number, toId: number) {
        this.logger.log('批量转移仓库: fromId=' + fromId + ' -> toId=' + toId + ', count=' + repoIds.length);
        for (const r of repoIds) {
            await this.prisma.repoCategory.deleteMany({ where: { repoId: BigInt(r), categoryId: BigInt(fromId) } });
            await this.prisma.repoCategory.create({ data: { repoId: BigInt(r), categoryId: BigInt(toId), createdAt: new Date() } });
        }
        this.logger.log('批量转移完成: count=' + repoIds.length);
    }

    /**
     * 清除一个仓库的所有分类关联
     *
     * @param repoId  仓库 ID
     */
    async clearRepoCategories(repoId: number) {
        await this.prisma.repoCategory.deleteMany({ where: { repoId: BigInt(repoId) } });
    }

    /**
     * 保存 AI 分类结果：按分类名 → 仓库 ID 列表的映射写入数据库
     *
     * @param cats  分类名 → 仓库 ID 数组的映射
     */
    async saveAiClassifyResult(cats: Record<string, number[]>) {
        this.logger.log('开始保存AI分类结果: 分类数=' + Object.keys(cats).length);
        for (const [name, ids] of Object.entries(cats)) {
            if (!ids.length) continue;
            let cat = await this.prisma.category.findUnique({ where: { name } });
            if (!cat) cat = await this.create(name);
            for (const r of ids) {
                await this.clearRepoCategories(r);
                await this.addRepoToCategory(r, Number(cat.id));
            }
        }
        this.logger.log('AI分类结果保存完成');
    }

    /**
     * 应用智能分类结果：与 saveAiClassifyResult 类似，但新建的分类强制设为二级分类（level=2）
     *
     * @param assignments  分类名 → 仓库 ID 数组的映射
     */
    async applySmartClassifyResult(assignments: Record<string, number[]>) {
        this.logger.log('开始应用智能分类结果: 分类数=' + Object.keys(assignments).length);
        for (const [name, ids] of Object.entries(assignments)) {
            if (!ids.length) continue;
            let cat = await this.prisma.category.findUnique({ where: { name } });
            if (!cat) {
                cat = await this.create(name);
                await this.prisma.category.update({ where: { id: cat.id }, data: { level: 2 } });
            }
            for (const r of ids) {
                await this.clearRepoCategories(r);
                await this.addRepoToCategory(r, Number(cat.id));
            }
        }
        this.logger.log('智能分类结果应用完成');
    }

    /**
     * 查询所有未分类的仓库（使用原始 SQL LEFT JOIN 查无关联记录的仓库）
     *
     * @returns  未分类仓库列表
     */
    async getUncategorized() {
        return this.prisma.$queryRawUnsafe<any[]>(
            `SELECT r.* FROM github_repo r LEFT JOIN repo_category rc ON r.id = rc.repo_id WHERE rc.repo_id IS NULL`,
        );
    }

    /**
     * 将分类 ID 列表展开为叶子分类 ID：一级分类自动展开为其所有子分类
     *
     * @param ids  分类 ID 列表（可能包含一级和二级分类）
     * @returns    仅包含二级分类（叶子节点）的 ID 列表
     */
    async expandCategoryIds(ids: number[]): Promise<number[]> {
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
}
