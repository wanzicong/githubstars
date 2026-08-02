import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MyRepoService } from '../../src/my-repos/my-repo.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('MyRepoService', () => {
    let service: MyRepoService;

    const mockPrisma = {
        myRepo: {
            count: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
            groupBy: jest.fn(),
            aggregate: jest.fn(),
        },
        myRepoCategoryLink: {
            findMany: jest.fn(),
            createMany: jest.fn(),
            deleteMany: jest.fn(),
        },
        category: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
        },
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await Test.createTestingModule({
            providers: [MyRepoService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();
        service = module.get(MyRepoService);
    });

    describe('findPage', () => {
        it('应返回分页结果并附加翻译状态', async () => {
            mockPrisma.myRepo.count.mockResolvedValue(1);
            mockPrisma.myRepo.findMany.mockResolvedValue([
                {
                    id: 1n,
                    fullName: 'me/demo',
                    description: 'a demo',
                    descriptionCn: '一个示例',
                    readmeCn: null,
                    readmeFetched: false,
                },
            ]);

            const result = await service.findPage({ page: 1, size: 12 });
            expect(result.total).toBe(1);
            expect(result.records).toHaveLength(1);
            expect(result.records[0].translationStatus.description).toBe('completed');
            expect(result.records[0].translationStatus.readme).toBe('pending');
        });

        it('isPrivate=true 时应追加私有筛选条件', async () => {
            mockPrisma.myRepo.count.mockResolvedValue(0);
            mockPrisma.myRepo.findMany.mockResolvedValue([]);

            await service.findPage({ page: 1, size: 12, isPrivate: true });
            const where = mockPrisma.myRepo.findMany.mock.calls[0][0].where;
            expect(where.AND).toContainEqual({ isPrivate: true });
        });

        it('keyword 空白时不应追加关键词条件', async () => {
            mockPrisma.myRepo.count.mockResolvedValue(0);
            mockPrisma.myRepo.findMany.mockResolvedValue([]);

            await service.findPage({ page: 1, size: 12, keyword: '   ' });
            const where = mockPrisma.myRepo.findMany.mock.calls[0][0].where;
            expect(where).toEqual({});
        });

        it('categoryId 应递归展开后代分类', async () => {
            mockPrisma.category.findMany.mockResolvedValueOnce([{ id: 2n }]).mockResolvedValueOnce([]);
            mockPrisma.myRepo.count.mockResolvedValue(0);
            mockPrisma.myRepo.findMany.mockResolvedValue([]);

            await service.findPage({ page: 1, size: 12, categoryId: 1 });
            const where = mockPrisma.myRepo.findMany.mock.calls[0][0].where;
            expect(where.AND).toContainEqual({ categories: { some: { categoryId: { in: [1, 2] } } } });
        });

        it('starred_at 排序字段应兜底为 repoUpdatedAt', async () => {
            mockPrisma.myRepo.count.mockResolvedValue(0);
            mockPrisma.myRepo.findMany.mockResolvedValue([]);

            await service.findPage({ page: 1, size: 12, sortBy: 'starred_at' });
            const orderBy = mockPrisma.myRepo.findMany.mock.calls[0][0].orderBy;
            expect(orderBy).toEqual({ repoUpdatedAt: 'desc' });
        });
    });

    describe('findById', () => {
        it('存在时应返回详情与分类', async () => {
            mockPrisma.myRepo.findUnique.mockResolvedValue({
                id: 1n,
                fullName: 'me/demo',
                descriptionCn: null,
                description: null,
                readmeCn: '译文',
                readmeFetched: true,
                categories: [{ category: { id: 3n, name: '工具', parentId: null } }],
            });

            const result = await service.findById(1);
            expect(result.fullName).toBe('me/demo');
            expect(result.categories[0].id).toBe(3);
            expect(result.translationStatus.readme).toBe('completed');
        });

        it('不存在时应抛出 NotFoundException', async () => {
            mockPrisma.myRepo.findUnique.mockResolvedValue(null);
            await expect(service.findById(999)).rejects.toThrow(NotFoundException);
        });
    });

    describe('findAllIds', () => {
        it('应返回 Number 类型的 ID 数组', async () => {
            mockPrisma.myRepo.findMany.mockResolvedValue([{ id: 1n }, { id: 2n }]);
            const ids = await service.findAllIds({});
            expect(ids).toEqual([1, 2]);
        });
    });

    describe('bindCategories', () => {
        it('分类不存在时应抛出 NotFoundException', async () => {
            mockPrisma.category.findUnique.mockResolvedValue(null);
            await expect(service.bindCategories(9, [1])).rejects.toThrow(NotFoundException);
        });

        it('应过滤无效 repoId 后幂等绑定', async () => {
            mockPrisma.category.findUnique.mockResolvedValue({ id: 1n });
            mockPrisma.myRepo.findMany.mockResolvedValue([{ id: 1n }]);
            mockPrisma.myRepoCategoryLink.createMany.mockResolvedValue({ count: 1 });

            const result = await service.bindCategories(1, [1, 999]);
            expect(result.bound).toBe(1);
            expect(result.invalid).toBe(1);
            expect(mockPrisma.myRepoCategoryLink.createMany).toHaveBeenCalledWith({
                data: [{ categoryId: 1, myRepoId: 1, createdAt: expect.any(Date) }],
                skipDuplicates: true,
            });
        });

        it('全部 repoId 无效时不应写库', async () => {
            mockPrisma.category.findUnique.mockResolvedValue({ id: 1n });
            mockPrisma.myRepo.findMany.mockResolvedValue([]);

            const result = await service.bindCategories(1, [999]);
            expect(result.bound).toBe(0);
            expect(mockPrisma.myRepoCategoryLink.createMany).not.toHaveBeenCalled();
        });
    });

    describe('unbindCategories', () => {
        it('应删除指定关联并返回数量', async () => {
            mockPrisma.myRepoCategoryLink.deleteMany.mockResolvedValue({ count: 2 });
            const result = await service.unbindCategories(1, [1, 2]);
            expect(result.unbound).toBe(2);
        });
    });

    describe('findPendingLocalization', () => {
        it('两个分支都关闭时应直接返回空', async () => {
            const result = await service.findPendingLocalization(50, false, false);
            expect(result.total).toBe(0);
            expect(mockPrisma.myRepo.findMany).not.toHaveBeenCalled();
        });

        it('应返回待翻译的描述与 README 原文', async () => {
            mockPrisma.myRepo.findMany.mockResolvedValue([
                {
                    id: 1n,
                    fullName: 'me/demo',
                    description: 'english desc',
                    descriptionCn: null,
                    readmeOriginal: '# hello',
                    readmeCn: null,
                },
            ]);

            const result = await service.findPendingLocalization(50, true, true);
            expect(result.total).toBe(1);
            expect(result.records[0]).toEqual({ repoId: 1, fullName: 'me/demo', description: 'english desc', readme: '# hello' });
        });

        it('已翻译的字段不应出现在记录中', async () => {
            mockPrisma.myRepo.findMany.mockResolvedValue([
                {
                    id: 1n,
                    fullName: 'me/demo',
                    description: 'english desc',
                    descriptionCn: '中文描述',
                    readmeOriginal: '# hello',
                    readmeCn: null,
                },
            ]);

            const result = await service.findPendingLocalization(50, true, true);
            expect(result.records[0].description).toBeNull();
            expect(result.records[0].readme).toBe('# hello');
        });
    });

    describe('updateTranslations', () => {
        it('空译文应跳过不写库', async () => {
            const result = await service.updateTranslations([{ repoId: 1, descriptionCn: '' }]);
            expect(result.updated).toBe(0);
            expect(result.skippedRepoIds).toEqual([1]);
            expect(mockPrisma.myRepo.update).not.toHaveBeenCalled();
        });

        it('readmeCn 回写时应同时标记 readmeFetched', async () => {
            mockPrisma.myRepo.update.mockResolvedValue({});
            const result = await service.updateTranslations([{ repoId: 1, readmeCn: '# 你好' }]);
            expect(result.updated).toBe(1);
            expect(mockPrisma.myRepo.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { readmeCn: '# 你好', readmeFetched: true, updatedAt: expect.any(Date) },
            });
        });

        it('单条失败不应阻塞整批', async () => {
            mockPrisma.myRepo.update.mockRejectedValueOnce(new Error('P2025')).mockResolvedValueOnce({});
            const result = await service.updateTranslations([
                { repoId: 1, descriptionCn: '一' },
                { repoId: 2, descriptionCn: '二' },
            ]);
            expect(result.updated).toBe(1);
            expect(result.updatedRepoIds).toEqual([2]);
            expect(result.skippedRepoIds).toEqual([1]);
        });
    });

    describe('getStats', () => {
        it('应返回概览统计与语言分布', async () => {
            mockPrisma.myRepo.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
            mockPrisma.myRepo.aggregate.mockResolvedValue({ _sum: { starsCount: 100, forksCount: 20 } });
            mockPrisma.myRepo.groupBy.mockResolvedValue([
                { language: 'TypeScript', _count: { language: 6 } },
                { language: null, _count: { language: 4 } },
            ]);

            const stats = await service.getStats();
            expect(stats.total).toBe(10);
            expect(stats.privateCount).toBe(3);
            expect(stats.totalStars).toBe(100);
            expect(stats.languages).toEqual([{ language: 'TypeScript', count: 6 }]);
        });
    });
});
