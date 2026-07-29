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
});
