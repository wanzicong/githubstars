import { Test } from '@nestjs/testing';
import { StatsService } from '../../src/stats/stats.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('StatsService', () => {
    let service: StatsService;
    let prisma: any;

    const mockRepo = {
        id: 1n,
        repoName: 'test-repo',
        fullName: 'owner/test-repo',
        description: 'desc',
        descriptionCn: null,
        readmeOriginal: null,
        readmeCn: null,
        readmeFetched: false,
        language: 'TypeScript',
        ownerName: 'owner',
        ownerAvatarUrl: 'https://avatar.url',
        htmlUrl: 'url',
        homepage: null,
        starsCount: 100,
        forksCount: 10,
        watchersCount: 5,
        openIssuesCount: 3,
        topics: '[]',
        licenseName: 'MIT',
        isFork: false,
        isArchived: false,
        repoCreatedAt: new Date('2023-01-01'),
        repoUpdatedAt: new Date('2024-06-01'),
        repoPushedAt: new Date('2024-06-01'),
        starredAt: new Date(),
    };

    const mockPrisma = {
        githubRepo: {
            findMany: jest.fn(),
            count: jest.fn(),
            groupBy: jest.fn(),
            aggregate: jest.fn(),
        },
        $queryRaw: jest.fn(),
        // 生产代码 getTimelineStats 会调 isSqlite() 判断方言，mock 需补齐
        isSqlite: jest.fn().mockReturnValue(false),
    };

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [StatsService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get(StatsService);
        prisma = mockPrisma;
        jest.clearAllMocks();
    });

    describe('getOverviewStats', () => {
        it('应返回整体概览统计数据', async () => {
            prisma.githubRepo.count.mockResolvedValue(100);
            prisma.githubRepo.aggregate
                .mockResolvedValueOnce({ _sum: { starsCount: 5000 } })
                .mockResolvedValueOnce({ _sum: { forksCount: 1200 } });
            prisma.$queryRaw
                .mockResolvedValueOnce([{ cnt: BigInt(15) }]) // languages
                .mockResolvedValueOnce([{ cnt: BigInt(30) }]); // owners

            const stats = await service.getOverviewStats();
            expect(stats.totalRepos).toBe(100);
            expect(stats.totalStars).toBe(5000);
            expect(stats.totalForks).toBe(1200);
            expect(stats.totalLanguages).toBe(15);
            expect(stats.totalOwners).toBe(30);
        });

        it('查询失败时应返回全零默认值', async () => {
            prisma.githubRepo.count.mockRejectedValue(new Error('DB error'));

            const stats = await service.getOverviewStats();
            expect(stats.totalRepos).toBe(0);
            expect(stats.totalStars).toBe(0);
        });
    });

    describe('getLanguageStats', () => {
        it('应返回语言分布统计', async () => {
            prisma.githubRepo.groupBy.mockResolvedValue([
                { language: 'TypeScript', _count: { id: 60 } },
                { language: 'JavaScript', _count: { id: 40 } },
            ]);
            prisma.githubRepo.count.mockResolvedValue(100);

            const stats = await service.getLanguageStats();
            expect(stats).toHaveLength(2);
            expect(stats[0].language).toBe('TypeScript');
            expect(stats[0].count).toBe(60);
            expect(stats[0].percentage).toBe(60);
        });

        it('空数据应返回空数组', async () => {
            prisma.githubRepo.groupBy.mockResolvedValue([]);
            prisma.githubRepo.count.mockResolvedValue(0);
            const stats = await service.getLanguageStats();
            expect(stats).toEqual([]);
        });
    });

    describe('getOwnerStats', () => {
        it('应返回作者排行', async () => {
            prisma.githubRepo.groupBy.mockResolvedValue([
                { ownerName: 'alice', _count: { id: 10 }, _max: { ownerAvatarUrl: 'url1' } },
                { ownerName: 'bob', _count: { id: 5 }, _max: { ownerAvatarUrl: 'url2' } },
            ]);

            const stats = await service.getOwnerStats(10);
            expect(stats).toHaveLength(2);
            expect(stats[0].ownerName).toBe('alice');
            expect(stats[0].count).toBe(10);
        });
    });

    describe('getTopStarred', () => {
        it('应返回Star排行榜', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([mockRepo]);
            const repos = await service.getTopStarred(10);
            expect(repos).toHaveLength(1);
            expect(repos[0].starsCount).toBe(100);
        });
    });

    describe('getRecentActive', () => {
        it('应返回最近活跃仓库', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([mockRepo]);
            const repos = await service.getRecentActive(10);
            expect(repos).toHaveLength(1);
        });
    });

    describe('getTimelineStats', () => {
        it('应返回时间线数据', async () => {
            prisma.$queryRaw.mockResolvedValue([
                { month: '2024-01', count: BigInt(5) },
                { month: '2024-02', count: BigInt(8) },
            ]);

            const stats = await service.getTimelineStats();
            expect(stats).toHaveLength(2);
            expect(stats[0].count).toBe(5);
            expect(stats[1].count).toBe(8);
        });

        it('查询失败时应返回空数组', async () => {
            prisma.$queryRaw.mockRejectedValue(new Error('SQL error'));
            const stats = await service.getTimelineStats();
            expect(stats).toEqual([]);
        });
    });
});
