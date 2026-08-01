import { Test } from '@nestjs/testing';
import { TrendingService, TrendingRepoItem } from '../../src/trending/trending.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('TrendingService', () => {
    let service: TrendingService;
    let prisma: any;

    const mockPrisma = {
        githubRepo: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            count: jest.fn(),
        },
    };

    const sampleRepos: TrendingRepoItem[] = [
        {
            fullName: 'trending/repo1',
            description: 'A trending repo',
            descriptionCn: null,
            localRepoId: null,
            language: 'TypeScript',
            ownerName: 'trending',
            ownerAvatarUrl: 'https://avatar.url',
            htmlUrl: 'https://github.com/trending/repo1',
            starsCount: 5000,
            forksCount: 300,
        },
        {
            fullName: 'trending/repo2',
            description: 'Already cached',
            descriptionCn: null,
            localRepoId: null,
            language: 'Python',
            ownerName: 'trending',
            ownerAvatarUrl: 'https://avatar2.url',
            htmlUrl: 'https://github.com/trending/repo2',
            starsCount: 3000,
            forksCount: 100,
        },
    ];

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await Test.createTestingModule({
            providers: [TrendingService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();
        service = module.get(TrendingService);
        prisma = mockPrisma;
    });

    describe('enrichWithCachedTranslations', () => {
        it('空列表应返回空数组', async () => {
            const result = await service.enrichWithCachedTranslations([]);
            expect(result).toEqual([]);
        });

        it('应为仓库补充本地缓存的中文描述', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([{ fullName: 'trending/repo1', descriptionCn: '这是一个趋势仓库', id: 1n }]);

            const result = await service.enrichWithCachedTranslations(sampleRepos);
            expect(result).toHaveLength(2);
            expect(result[0].descriptionCn).toBe('这是一个趋势仓库');
            expect(result[0].localRepoId).toBe(1);
            expect(result[1].descriptionCn).toBeNull();
            expect(result[1].localRepoId).toBeNull();
        });

        it('无缓存的仓库应保持 descriptionCn 为 null', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([]);

            const result = await service.enrichWithCachedTranslations(sampleRepos);
            expect(result[0].descriptionCn).toBeNull();
            expect(result[1].descriptionCn).toBeNull();
        });
    });

    describe('ensureReposAndGetIdMapping', () => {
        it('空列表应返回空数组', async () => {
            const result = await service.ensureReposAndGetIdMapping([]);
            expect(result).toEqual([]);
            expect(prisma.githubRepo.findMany).not.toHaveBeenCalled();
        });

        it('已存在的仓库直接返回 id，不触发创建', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([
                { id: 11n, fullName: 'trending/repo1' },
                { id: 22n, fullName: 'trending/repo2' },
            ]);

            const result = await service.ensureReposAndGetIdMapping(sampleRepos);
            expect(result).toEqual([
                { fullName: 'trending/repo1', id: 11 },
                { fullName: 'trending/repo2', id: 22 },
            ]);
            expect(prisma.githubRepo.create).not.toHaveBeenCalled();
        });

        it('缺失的仓库应轻量创建并返回新 id', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([{ id: 11n, fullName: 'trending/repo1' }]);
            prisma.githubRepo.findFirst.mockResolvedValue(null);
            prisma.githubRepo.create.mockResolvedValue({ id: 33n });

            const result = await service.ensureReposAndGetIdMapping(sampleRepos);
            expect(result).toEqual([
                { fullName: 'trending/repo1', id: 11 },
                { fullName: 'trending/repo2', id: 33 },
            ]);
            expect(prisma.githubRepo.create).toHaveBeenCalledTimes(1);
            expect(prisma.githubRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ fullName: 'trending/repo2' }),
                }),
            );
        });

        it('个别仓库创建失败时跳过该项，其余项不错位', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([]);
            prisma.githubRepo.findFirst.mockResolvedValue(null);
            prisma.githubRepo.create
                .mockRejectedValueOnce(new Error('unique constraint'))
                .mockResolvedValueOnce({ id: 44n });

            const result = await service.ensureReposAndGetIdMapping(sampleRepos);
            // repo1 创建失败被跳过，repo2 的 id 仍是 44 而非错位到 repo1
            expect(result).toEqual([{ fullName: 'trending/repo2', id: 44 }]);
        });

        it('fullName 为空的项应被跳过', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([{ id: 11n, fullName: 'trending/repo1' }]);

            const result = await service.ensureReposAndGetIdMapping([{ fullName: '' }, sampleRepos[0]]);
            expect(result).toEqual([{ fullName: 'trending/repo1', id: 11 }]);
            expect(prisma.githubRepo.create).not.toHaveBeenCalled();
        });
    });

    describe('batchEnsureReposExist', () => {
        it('应返回 id 数组（委托 ensureReposAndGetIdMapping）', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([
                { id: 11n, fullName: 'trending/repo1' },
                { id: 22n, fullName: 'trending/repo2' },
            ]);

            const result = await service.batchEnsureReposExist(sampleRepos);
            expect(result).toEqual([11, 22]);
        });
    });
});
