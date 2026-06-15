/**
 * CategoryService 单元测试
 *
 * 测试重点:
 *   - listAll() 扁平分类 → 树形结构 + repoCount 汇总
 *   - create() 名称唯一性校验
 *   - delete() 级联删除 repo_category 再删分类
 *   - batchAddRepos() skipDuplicates 与 level=1 阻断
 *   - batchTransferRepos() 删除旧关联后创建新关联
 *   - saveAiClassifyResult() 逐分类清理再添加
 *   - getUncategorized() 原始 SQL 查询
 *   - expandCategoryIds() 展开 level=1 分类到子级
 *
 * 所有 Prisma 调用被 Mock，测试纯逻辑。
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from '../../src/category/category.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// ==================== Mock PrismaService ====================

function createMockPrisma() {
    return {
        category: {
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
            delete: jest.fn().mockResolvedValue({}),
            groupBy: jest.fn().mockResolvedValue([]),
        },
        repoCategory: {
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({}),
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            groupBy: jest.fn().mockResolvedValue([]),
        },
        githubRepo: {
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
        },
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
}

// ==================== Test Suite ====================

describe('CategoryService', () => {
    let service: CategoryService;
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(async () => {
        mockPrisma = createMockPrisma();
        const module: TestingModule = await Test.createTestingModule({
            providers: [CategoryService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();
        service = module.get<CategoryService>(CategoryService);
    });

    // ==================== listAll() ====================

    describe('listAll — 树形结构', () => {
        it('扁平分类应构建正确的树形嵌套', async () => {
            const categories = [
                {
                    id: BigInt(1),
                    name: 'AI',
                    level: 1,
                    parentId: null,
                    sortOrder: 0,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: null,
                },
                {
                    id: BigInt(2),
                    name: 'LLM',
                    level: 2,
                    parentId: BigInt(1),
                    sortOrder: 0,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: null,
                },
                {
                    id: BigInt(3),
                    name: 'Agent',
                    level: 2,
                    parentId: BigInt(1),
                    sortOrder: 1,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: null,
                },
                {
                    id: BigInt(4),
                    name: 'Frontend',
                    level: 1,
                    parentId: null,
                    sortOrder: 1,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: null,
                },
            ];

            const groupByResults = [
                { categoryId: BigInt(2), _count: { categoryId: 5 } },
                { categoryId: BigInt(3), _count: { categoryId: 3 } },
                { categoryId: BigInt(4), _count: { categoryId: 2 } },
            ];

            mockPrisma.category.findMany.mockResolvedValue(categories);
            mockPrisma.repoCategory.groupBy.mockResolvedValue(groupByResults);

            const result = await service.listAll();

            // 根节点数: AI (level=1) + Frontend (level=1) = 2
            expect(result).toHaveLength(2);

            // AI 的 repoCount 应为自身(0) + LLM(5) + Agent(3) = 8
            const aiNode = result.find((n: any) => n.name === 'AI');
            expect(aiNode).toBeDefined();
            expect(aiNode!.repoCount).toBe(8);
            expect(aiNode!.children).toHaveLength(2);
            expect(aiNode!.children.map((c: any) => c.name).sort()).toEqual(['Agent', 'LLM']);

            // Frontend 无子分类，repoCount 保持 groupBy 结果
            const feNode = result.find((n: any) => n.name === 'Frontend');
            expect(feNode).toBeDefined();
            expect(feNode!.repoCount).toBe(2);
            expect(feNode!.children).toHaveLength(0);
        });

        it('level=2 分类无有效 parentId 时应作为根节点', async () => {
            // 孤儿 level=2 分类 — parentId 指向不存在的父级
            const categories = [
                {
                    id: BigInt(1),
                    name: 'Orphan',
                    level: 2,
                    parentId: BigInt(99),
                    sortOrder: 0,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: null,
                },
                {
                    id: BigInt(2),
                    name: 'Root',
                    level: 1,
                    parentId: null,
                    sortOrder: 0,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: null,
                },
            ];

            mockPrisma.category.findMany.mockResolvedValue(categories);
            mockPrisma.repoCategory.groupBy.mockResolvedValue([]);

            const result = await service.listAll();

            expect(result).toHaveLength(2);
            const names = result.map((n: any) => n.name).sort();
            expect(names).toEqual(['Orphan', 'Root']);
        });

        it('空分类列表应返回空数组', async () => {
            mockPrisma.category.findMany.mockResolvedValue([]);
            mockPrisma.repoCategory.groupBy.mockResolvedValue([]);

            const result = await service.listAll();

            expect(result).toEqual([]);
        });

        it('根节点应按 repoCount 降序排列', async () => {
            const categories = [
                {
                    id: BigInt(1),
                    name: 'Small',
                    level: 1,
                    parentId: null,
                    sortOrder: 0,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: null,
                },
                {
                    id: BigInt(2),
                    name: 'Large',
                    level: 1,
                    parentId: null,
                    sortOrder: 1,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: null,
                },
            ];

            const groupByResults = [
                { categoryId: BigInt(1), _count: { categoryId: 3 } },
                { categoryId: BigInt(2), _count: { categoryId: 10 } },
            ];

            mockPrisma.category.findMany.mockResolvedValue(categories);
            mockPrisma.repoCategory.groupBy.mockResolvedValue(groupByResults);

            const result = await service.listAll();

            expect(result[0].name).toBe('Large');
            expect(result[1].name).toBe('Small');
        });

        it('子分类 repoCount 为 0 时不影响父级汇总', async () => {
            const categories = [
                {
                    id: BigInt(1),
                    name: 'Empty',
                    level: 1,
                    parentId: null,
                    sortOrder: 0,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: null,
                },
                {
                    id: BigInt(2),
                    name: 'Sub',
                    level: 2,
                    parentId: BigInt(1),
                    sortOrder: 0,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: null,
                },
            ];

            mockPrisma.category.findMany.mockResolvedValue(categories);
            mockPrisma.repoCategory.groupBy.mockResolvedValue([]);

            const result = await service.listAll();

            expect(result[0].repoCount).toBe(0); // 0+0=0
            expect(result[0].children[0].repoCount).toBe(0);
        });
    });

    // ==================== create() ====================

    describe('create — 唯一性校验', () => {
        it('名称重复时应抛出异常', async () => {
            mockPrisma.category.findUnique.mockResolvedValue({
                id: BigInt(1),
                name: 'Duplicated',
                level: 1,
                parentId: null,
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });

            await expect(service.create('  Duplicated  ')).rejects.toThrow('分类名已存在: Duplicated');
            // trim 后查重
            expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({ where: { name: 'Duplicated' } });
        });

        it('名称不重复时应成功创建', async () => {
            mockPrisma.category.findUnique.mockResolvedValue(null);
            const created = {
                id: BigInt(99),
                name: 'NewCat',
                level: 1,
                parentId: null,
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            };
            mockPrisma.category.create.mockResolvedValue(created);

            const result = await service.create('NewCat');

            expect(result).toEqual(created);
            expect(mockPrisma.category.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ name: 'NewCat', level: 1, parentId: null }),
                }),
            );
        });

        it('带 parentId 创建时 level 应为 2', async () => {
            mockPrisma.category.findUnique.mockResolvedValue(null);
            mockPrisma.category.create.mockResolvedValue({} as any);

            await service.create('SubCat', 'desc', 1);

            expect(mockPrisma.category.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ parentId: BigInt(1), level: 2 }),
                }),
            );
        });

        it('名称需要 trim 后才查重和存储', async () => {
            mockPrisma.category.findUnique.mockResolvedValue(null);
            mockPrisma.category.create.mockResolvedValue({} as any);

            await service.create('  Trimmed  ');

            expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({ where: { name: 'Trimmed' } });
            expect(mockPrisma.category.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ name: 'Trimmed' }) }),
            );
        });
    });

    // ==================== delete() ====================

    describe('delete — 级联删除', () => {
        it('应先删除 repo_category 关联再删除分类', async () => {
            await service.delete(42);

            // 验证调用顺序：先 deleteMany 再 delete
            expect(mockPrisma.repoCategory.deleteMany).toHaveBeenCalledWith({
                where: { categoryId: BigInt(42) },
            });
            expect(mockPrisma.category.delete).toHaveBeenCalledWith({
                where: { id: BigInt(42) },
            });

            // 验证调用顺序
            const calls = [mockPrisma.repoCategory.deleteMany, mockPrisma.category.delete];
            const ordered = calls.every((fn, i) => {
                if (i === 0) return true;
                return fn.mock.invocationCallOrder[0] > calls[i - 1].mock.invocationCallOrder[0];
            });
            expect(ordered).toBe(true);
        });

        it('无关联时直接删除分类', async () => {
            mockPrisma.repoCategory.deleteMany.mockResolvedValue({ count: 0 });

            await service.delete(1);

            expect(mockPrisma.repoCategory.deleteMany).toHaveBeenCalled();
            expect(mockPrisma.category.delete).toHaveBeenCalledWith({
                where: { id: BigInt(1) },
            });
        });
    });

    // ==================== batchAddRepos() ====================

    describe('batchAddRepos', () => {
        it('skipDuplicates=true: createMany 使用 skipDuplicates 选项', async () => {
            mockPrisma.category.findUnique.mockResolvedValue({
                id: BigInt(2),
                name: 'Sub',
                level: 2,
                parentId: BigInt(1),
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });

            await service.batchAddRepos([10, 20], 2);

            expect(mockPrisma.repoCategory.createMany).toHaveBeenCalledWith({
                data: [
                    { repoId: BigInt(10), categoryId: BigInt(2), createdAt: expect.any(Date) },
                    { repoId: BigInt(20), categoryId: BigInt(2), createdAt: expect.any(Date) },
                ],
                skipDuplicates: true,
            });
        });

        it('level=1 分类不能直接包含仓库，应抛出异常', async () => {
            mockPrisma.category.findUnique.mockResolvedValue({
                id: BigInt(1),
                name: 'Root',
                level: 1,
                parentId: null,
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });

            await expect(service.batchAddRepos([10], 1)).rejects.toThrow('一级分类不能直接包含仓库');
            // 不应调用 createMany
            expect(mockPrisma.repoCategory.createMany).not.toHaveBeenCalled();
        });

        it('分类不存在时也应检查 level（null 不阻断，走不到 level 判断）', async () => {
            // findUnique 返回 null → cat?.level 为 undefined → !== 1 → 不会抛异常
            // 但 createMany 会被调用（实际数据库会因外键约束失败，单元测试只测逻辑）
            mockPrisma.category.findUnique.mockResolvedValue(null);

            await service.batchAddRepos([10], 999);

            expect(mockPrisma.repoCategory.createMany).toHaveBeenCalled();
        });
    });

    // ==================== batchTransferRepos() ====================

    describe('batchTransferRepos', () => {
        it('应逐个仓库先删除旧关联再创建新关联', async () => {
            await service.batchTransferRepos([10, 20], 1, 2);

            // repo 10
            expect(mockPrisma.repoCategory.deleteMany).toHaveBeenCalledWith({
                where: { repoId: BigInt(10), categoryId: BigInt(1) },
            });
            expect(mockPrisma.repoCategory.create).toHaveBeenCalledWith({
                data: { repoId: BigInt(10), categoryId: BigInt(2), createdAt: expect.any(Date) },
            });

            // repo 20
            expect(mockPrisma.repoCategory.deleteMany).toHaveBeenCalledWith({
                where: { repoId: BigInt(20), categoryId: BigInt(1) },
            });
            expect(mockPrisma.repoCategory.create).toHaveBeenCalledWith({
                data: { repoId: BigInt(20), categoryId: BigInt(2), createdAt: expect.any(Date) },
            });

            // 总共 2 次 deleteMany + 2 次 create
            expect(mockPrisma.repoCategory.deleteMany).toHaveBeenCalledTimes(2);
            expect(mockPrisma.repoCategory.create).toHaveBeenCalledTimes(2);

            // 验证交错执行顺序（非事务性：逐条交替）
            const deleteCalls = mockPrisma.repoCategory.deleteMany.mock.invocationCallOrder;
            const createCalls = mockPrisma.repoCategory.create.mock.invocationCallOrder;
            // repo 10: delete 先于 create
            expect(deleteCalls[0]).toBeLessThan(createCalls[0]);
            // repo 20: delete 先于 create
            expect(deleteCalls[1]).toBeLessThan(createCalls[1]);
        });

        it('空 repoIds 时不执行任何操作', async () => {
            await service.batchTransferRepos([], 1, 2);

            expect(mockPrisma.repoCategory.deleteMany).not.toHaveBeenCalled();
            expect(mockPrisma.repoCategory.create).not.toHaveBeenCalled();
        });
    });

    // ==================== saveAiClassifyResult() ====================

    describe('saveAiClassifyResult', () => {
        it('应为每个分类清除现有关联后添加新关联', async () => {
            // 默认 findUnique 返回 null（大多数场景分类不存在）
            mockPrisma.category.findUnique.mockResolvedValue(null);

            const assignments: Record<string, number[]> = {
                AI: [10, 20],
                Frontend: [30],
            };

            // AI 分类已存在 → findUnique 返回 AI（限一次调用）
            mockPrisma.category.findUnique.mockResolvedValueOnce({
                id: BigInt(1),
                name: 'AI',
                level: 1,
                parentId: null,
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });
            // Frontend 不存在 → findUnique 返回 null（默认值，无需额外设置）
            // create('Frontend') 内部的 findUnique 也返回 null（默认值）

            mockPrisma.category.create.mockResolvedValue({
                id: BigInt(2),
                name: 'Frontend',
                level: 1,
                parentId: null,
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });

            await service.saveAiClassifyResult(assignments);

            // repo 10: clearRepoCategories(10) → deleteMany
            expect(mockPrisma.repoCategory.deleteMany).toHaveBeenCalledWith({
                where: { repoId: BigInt(10) },
            });
            // repo 10: addRepoToCategory(10, 1) → create
            expect(mockPrisma.repoCategory.create).toHaveBeenCalledWith({
                data: { repoId: BigInt(10), categoryId: BigInt(1), createdAt: expect.any(Date) },
            });

            // repo 20: 同样流程
            expect(mockPrisma.repoCategory.deleteMany).toHaveBeenCalledWith({
                where: { repoId: BigInt(20) },
            });
            expect(mockPrisma.repoCategory.create).toHaveBeenCalledWith({
                data: { repoId: BigInt(20), categoryId: BigInt(1), createdAt: expect.any(Date) },
            });

            // repo 30: clear → add to newly created Frontend (id=2)
            expect(mockPrisma.repoCategory.deleteMany).toHaveBeenCalledWith({
                where: { repoId: BigInt(30) },
            });
            expect(mockPrisma.repoCategory.create).toHaveBeenCalledWith({
                data: { repoId: BigInt(30), categoryId: BigInt(2), createdAt: expect.any(Date) },
            });

            // 总共 3 次 clear + 3 次 add
            expect(mockPrisma.repoCategory.deleteMany).toHaveBeenCalledTimes(3);
            expect(mockPrisma.repoCategory.create).toHaveBeenCalledTimes(3);
        });

        it('空 ids 数组的分类应跳过', async () => {
            const assignments: Record<string, number[]> = {
                EmptyCat: [],
                RealCat: [10],
            };

            // 默认 findUnique 返回 null（EmptyCat 查不到，跳过）
            mockPrisma.category.findUnique.mockResolvedValue(null);
            // RealCat 也不存在 → create 时内部 findUnique 也返回 null
            mockPrisma.category.create.mockResolvedValue({
                id: BigInt(2),
                name: 'RealCat',
                level: 1,
                parentId: null,
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });

            await service.saveAiClassifyResult(assignments);

            // 只处理 RealCat 的 1 个 repo（EmptyCat 的 ids 为空，直接跳过）
            expect(mockPrisma.repoCategory.deleteMany).toHaveBeenCalledTimes(1);
            expect(mockPrisma.repoCategory.create).toHaveBeenCalledTimes(1);
        });
    });

    // ==================== getUncategorized() ====================

    describe('getUncategorized', () => {
        it('应使用原始 SQL 查询无分类的仓库', async () => {
            const repos = [
                { id: BigInt(1), fullName: 'owner/nocat', starsCount: BigInt(0) },
                { id: BigInt(2), fullName: 'owner/nocat2', starsCount: BigInt(0) },
            ];
            mockPrisma.$queryRawUnsafe.mockResolvedValue(repos);

            const result = await service.getUncategorized();

            expect(result).toEqual(repos);
            expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
            expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN repo_category'));
        });

        it('无未分类仓库时返回空数组', async () => {
            mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

            const result = await service.getUncategorized();

            expect(result).toEqual([]);
        });
    });

    // ==================== expandCategoryIds() ====================

    describe('expandCategoryIds', () => {
        it('level=1 分类应展开为其子分类 ID', async () => {
            mockPrisma.category.findUnique.mockResolvedValueOnce({
                id: BigInt(1),
                name: 'AI',
                level: 1,
                parentId: null,
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });
            mockPrisma.category.findMany.mockResolvedValueOnce([{ id: BigInt(2) }, { id: BigInt(3) }]);

            const result = await service.expandCategoryIds([1]);

            expect(result).toEqual([2, 3]);
        });

        it('level=2 分类应原样保留 ID', async () => {
            mockPrisma.category.findUnique.mockResolvedValueOnce({
                id: BigInt(2),
                name: 'LLM',
                level: 2,
                parentId: BigInt(1),
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });

            const result = await service.expandCategoryIds([2]);

            expect(result).toEqual([2]);
            // 不应再查子分类
            expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
        });

        it('level=1 分类无子分类时应返回自身 ID', async () => {
            mockPrisma.category.findUnique.mockResolvedValueOnce({
                id: BigInt(1),
                name: 'EmptyParent',
                level: 1,
                parentId: null,
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });
            mockPrisma.category.findMany.mockResolvedValueOnce([]);

            const result = await service.expandCategoryIds([1]);

            expect(result).toEqual([1]);
        });

        it('多个混合 ID 应同时处理', async () => {
            // id=1: level=1 → 展开
            mockPrisma.category.findUnique.mockResolvedValueOnce({
                id: BigInt(1),
                name: 'AI',
                level: 1,
                parentId: null,
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });
            mockPrisma.category.findMany.mockResolvedValueOnce([{ id: BigInt(2) }, { id: BigInt(3) }]);

            // id=4: level=2 → 保留
            mockPrisma.category.findUnique.mockResolvedValueOnce({
                id: BigInt(4),
                name: 'React',
                level: 2,
                parentId: BigInt(5),
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            });

            const result = await service.expandCategoryIds([1, 4]);

            expect(result).toEqual([2, 3, 4]);
        });
    });

    // ==================== getById() ====================

    describe('getById', () => {
        it('应查询指定 ID 的分类', async () => {
            const cat = {
                id: BigInt(1),
                name: 'Test',
                level: 1,
                parentId: null,
                sortOrder: 0,
                description: null,
                createdAt: new Date(),
                updatedAt: null,
            };
            mockPrisma.category.findUnique.mockResolvedValue(cat);

            const result = await service.getById(1);

            expect(result).toEqual(cat);
            expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
                where: { id: BigInt(1) },
            });
        });
    });
});
