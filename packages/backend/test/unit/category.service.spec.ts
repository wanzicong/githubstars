import { Test } from '@nestjs/testing';
import { CategoryService } from '../../src/category/category.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('CategoryService', () => {
    let service: CategoryService;
    let prisma: any;

    const mockPrisma = {
        category: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
        categoryRepoLink: {
            deleteMany: jest.fn(),
            upsert: jest.fn(),
        },
        githubRepo: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [CategoryService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get(CategoryService);
        prisma = mockPrisma;
        jest.clearAllMocks();
    });

    describe('getCategoryTree', () => {
        it('应返回两级树形结构', async () => {
            prisma.category.findMany.mockResolvedValue([
                {
                    id: 1n,
                    name: '后端',
                    parentId: null,
                    sortOrder: 0,
                    icon: null,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    _count: { categoryRepoLinks: 3 },
                    children: [
                        {
                            id: 2n,
                            name: 'NestJS',
                            parentId: 1n,
                            sortOrder: 0,
                            icon: null,
                            description: null,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            _count: { categoryRepoLinks: 1 },
                        },
                    ],
                },
            ]);

            const tree = await service.getCategoryTree();
            expect(tree).toHaveLength(1);
            expect(tree[0].name).toBe('后端');
            expect(tree[0].repoCount).toBe(3);
            expect(tree[0].children).toHaveLength(1);
            expect(tree[0].children[0].name).toBe('NestJS');
            expect(tree[0].children[0].repoCount).toBe(1);
        });

        it('空分类时应返回空数组', async () => {
            prisma.category.findMany.mockResolvedValue([]);
            const tree = await service.getCategoryTree();
            expect(tree).toEqual([]);
        });
    });

    describe('getCategoryList', () => {
        it('应返回分页的分类列表', async () => {
            prisma.category.count.mockResolvedValue(1);
            prisma.category.findMany.mockResolvedValue([
                {
                    id: 1n,
                    name: '后端',
                    parentId: null,
                    sortOrder: 0,
                    icon: null,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    _count: { categoryRepoLinks: 5 },
                    children: [],
                },
            ]);

            const result = await service.getCategoryList(1, 10, '');
            expect(result.total).toBe(1);
            expect(result.records).toHaveLength(1);
            expect(result.records[0].name).toBe('后端');
            expect(result.size).toBe(10);
        });

        it('应支持关键字搜索', async () => {
            prisma.category.count.mockResolvedValue(1);
            prisma.category.findMany.mockResolvedValue([
                {
                    id: 1n,
                    name: '前端',
                    parentId: null,
                    sortOrder: 0,
                    icon: null,
                    description: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    _count: { categoryRepoLinks: 2 },
                    children: [],
                },
            ]);

            const result = await service.getCategoryList(1, 10, '前端');
            expect(result.total).toBe(1);
            expect(result.records[0].name).toBe('前端');
        });
    });

    describe('createCategory', () => {
        it('应创建新分类', async () => {
            prisma.category.findFirst.mockResolvedValue(null);
            prisma.category.create.mockResolvedValue({
                id: 1n,
                name: '新分类',
                parentId: null,
                sortOrder: 0,
                icon: null,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await service.createCategory({
                name: '新分类',
                parentId: undefined,
                sortOrder: 0,
                icon: undefined,
                description: undefined,
            });
            expect(result.name).toBe('新分类');
            expect(result.id).toBe(1);
        });

        it('同名分类应抛出 ConflictException', async () => {
            prisma.category.findFirst.mockResolvedValue({ id: 1n });

            await expect(
                service.createCategory({ name: '重复', parentId: undefined, sortOrder: 0, icon: undefined, description: undefined }),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('updateCategory', () => {
        it('应更新分类名称', async () => {
            prisma.category.findUnique.mockResolvedValue({ id: 1n, name: '旧名', parentId: null });
            prisma.category.findFirst.mockResolvedValue(null);
            prisma.category.update.mockResolvedValue({
                id: 1n,
                name: '新名',
                parentId: null,
                sortOrder: 0,
                icon: null,
                description: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await service.updateCategory({ id: 1, name: '新名' });
            expect(result.name).toBe('新名');
        });

        it('更新不存在的分类应抛出 NotFoundException', async () => {
            prisma.category.findUnique.mockResolvedValue(null);
            await expect(service.updateCategory({ id: 999, name: 'x' })).rejects.toThrow(NotFoundException);
        });

        it('不能将分类设为自身的父分类', async () => {
            prisma.category.findUnique.mockResolvedValue({ id: 1n, name: '测试', parentId: null });
            await expect(service.updateCategory({ id: 1, parentId: 1 })).rejects.toThrow(ConflictException);
        });
    });

    describe('deleteCategory', () => {
        it('应删除无子分类的分类', async () => {
            prisma.category.findUnique.mockResolvedValue({ id: 1n, children: [] });
            prisma.category.delete.mockResolvedValue({ id: 1n });

            const result = await service.deleteCategory(1);
            expect(result.success).toBe(true);
        });

        it('有子分类时应抛出 ConflictException', async () => {
            prisma.category.findUnique.mockResolvedValue({ id: 1n, children: [{ id: 2n }] });
            await expect(service.deleteCategory(1)).rejects.toThrow(ConflictException);
        });

        it('不存在的分类应抛出 NotFoundException', async () => {
            prisma.category.findUnique.mockResolvedValue(null);
            await expect(service.deleteCategory(999)).rejects.toThrow(NotFoundException);
        });
    });

    describe('sortCategories', () => {
        it('应批量更新排序', async () => {
            prisma.$transaction.mockResolvedValue([]);
            const result = await service.sortCategories({
                items: [
                    { id: 1, sortOrder: 0 },
                    { id: 2, sortOrder: 1 },
                ],
            });
            expect(result.success).toBe(true);
            expect(prisma.$transaction).toHaveBeenCalled();
        });
    });

    describe('bindReposToCategory', () => {
        it('应将仓库绑定到分类', async () => {
            prisma.category.findUnique.mockResolvedValue({ id: 1n });
            prisma.githubRepo.findMany.mockResolvedValue([{ id: BigInt(1) }, { id: BigInt(2) }]);
            prisma.$transaction.mockResolvedValue([{}, {}]);

            const result = await service.bindReposToCategory({
                categoryId: 1,
                repoIds: [1, 2],
            });
            expect(result.success).toBe(true);
            expect(result.count).toBe(2);
        });

        it('不存在的仓库应抛出 NotFoundException', async () => {
            prisma.category.findUnique.mockResolvedValue({ id: 1n });
            prisma.githubRepo.findMany.mockResolvedValue([{ id: BigInt(1) }]);

            await expect(service.bindReposToCategory({ categoryId: 1, repoIds: [1, 999] })).rejects.toThrow(NotFoundException);
        });
    });

    describe('unbindReposFromCategory', () => {
        it('应解绑仓库', async () => {
            prisma.category.findUnique.mockResolvedValue({ id: 1n });
            prisma.categoryRepoLink.deleteMany.mockResolvedValue({ count: 2 });

            const result = await service.unbindReposFromCategory({
                categoryId: 1,
                repoIds: [1, 2],
            });
            expect(result.success).toBe(true);
            expect(result.count).toBe(2);
        });
    });

    describe('getCategoryRepos', () => {
        it('应返回分类下的仓库列表', async () => {
            prisma.category.findUnique.mockResolvedValue({ id: 1n });
            prisma.githubRepo.count.mockResolvedValue(2);
            prisma.githubRepo.findMany.mockResolvedValue([
                {
                    id: 1n,
                    repoName: 'repo1',
                    fullName: 'user/repo1',
                    description: 'desc',
                    descriptionCn: null,
                    language: 'TS',
                    ownerName: 'user',
                    ownerAvatarUrl: '',
                    htmlUrl: 'url',
                    starsCount: 10,
                    forksCount: 5,
                    watchersCount: 3,
                    openIssuesCount: 1,
                    topics: '[]',
                    licenseName: 'MIT',
                    isFork: false,
                    isArchived: false,
                    repoCreatedAt: new Date(),
                    repoUpdatedAt: new Date(),
                    repoPushedAt: new Date(),
                    starredAt: new Date(),
                },
                {
                    id: 2n,
                    repoName: 'repo2',
                    fullName: 'user/repo2',
                    description: 'desc2',
                    descriptionCn: null,
                    language: 'JS',
                    ownerName: 'user',
                    ownerAvatarUrl: '',
                    htmlUrl: 'url2',
                    starsCount: 20,
                    forksCount: 3,
                    watchersCount: 2,
                    openIssuesCount: 0,
                    topics: '[]',
                    licenseName: null,
                    isFork: false,
                    isArchived: false,
                    repoCreatedAt: new Date(),
                    repoUpdatedAt: new Date(),
                    repoPushedAt: new Date(),
                    starredAt: new Date(),
                },
            ]);

            const result = await service.getCategoryRepos({
                categoryId: 1,
                page: 1,
                size: 10,
                keyword: '',
                language: '',
                sortBy: 'stars_count',
                sortOrder: 'desc',
            });
            expect(result.total).toBe(2);
            expect(result.records).toHaveLength(2);
        });
    });
});
