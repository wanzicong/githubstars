import { Test } from '@nestjs/testing';
import { AuthorService } from '../../src/author/author.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AuthorService', () => {
    let service: AuthorService;
    let prisma: any;

    const mockPrisma = {
        githubRepo: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        $queryRaw: jest.fn(),
    };

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                AuthorService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get(AuthorService);
        prisma = mockPrisma;
        jest.clearAllMocks();
    });

    describe('findAuthorPage', () => {
        it('应返回分页作者列表', async () => {
            prisma.$queryRaw
                .mockResolvedValueOnce([{ cnt: BigInt(2) }])  // count
                .mockResolvedValueOnce([                       // rows
                    {
                        owner_name: 'alice',
                        owner_avatar_url: 'https://avatar.alice',
                        repo_count: BigInt(10),
                        total_stars: BigInt(500),
                        top_language: 'TypeScript',
                        last_starred_at: new Date('2024-06-01'),
                    },
                    {
                        owner_name: 'bob',
                        owner_avatar_url: 'https://avatar.bob',
                        repo_count: BigInt(5),
                        total_stars: BigInt(200),
                        top_language: 'Python',
                        last_starred_at: new Date('2024-05-01'),
                    },
                ]);

            const result = await service.findAuthorPage(1, 10, '');
            expect(result.records).toHaveLength(2);
            expect(result.records[0].ownerName).toBe('alice');
            expect(result.records[0].repoCount).toBe(10);
            expect(result.records[0].totalStars).toBe(500);
            expect(result.records[0].topLanguage).toBe('TypeScript');
            expect(result.total).toBe(2);
            expect(result.current).toBe(1);
        });

        it('应支持关键字搜索', async () => {
            prisma.$queryRaw
                .mockResolvedValueOnce([{ cnt: BigInt(1) }])
                .mockResolvedValueOnce([{
                    owner_name: 'alice',
                    owner_avatar_url: 'url',
                    repo_count: BigInt(3),
                    total_stars: BigInt(100),
                    top_language: 'JavaScript',
                    last_starred_at: new Date(),
                }]);

            const result = await service.findAuthorPage(1, 10, 'alice');
            expect(result.records).toHaveLength(1);
            expect(result.records[0].ownerName).toBe('alice');
        });

        it('空结果应返回空数组', async () => {
            prisma.$queryRaw
                .mockResolvedValueOnce([{ cnt: BigInt(0) }])
                .mockResolvedValueOnce([]);

            const result = await service.findAuthorPage(1, 10, '');
            expect(result.records).toEqual([]);
            expect(result.total).toBe(0);
        });

        it('查询失败应返回空数据', async () => {
            prisma.$queryRaw.mockRejectedValue(new Error('DB error'));
            const result = await service.findAuthorPage(1, 10, '');
            expect(result.records).toEqual([]);
            expect(result.total).toBe(0);
        });
    });

    describe('findAuthorRepos', () => {
        it('应返回作者仓库分页列表', async () => {
            prisma.githubRepo.count.mockResolvedValue(2);
            prisma.githubRepo.findMany.mockResolvedValue([
                {
                    id: 1n, repoName: 'repo1', fullName: 'alice/repo1',
                    description: 'desc', descriptionCn: null, readmeOriginal: null,
                    readmeCn: null, readmeFetched: false, language: 'TS',
                    ownerName: 'alice', ownerAvatarUrl: 'url', htmlUrl: 'url1',
                    homepage: null, starsCount: 100, forksCount: 10,
                    watchersCount: 5, openIssuesCount: 3, topics: '[]',
                    licenseName: 'MIT', isFork: false, isArchived: false,
                    repoCreatedAt: new Date(), repoUpdatedAt: new Date(),
                    repoPushedAt: new Date(), starredAt: new Date(),
                },
                {
                    id: 2n, repoName: 'repo2', fullName: 'alice/repo2',
                    description: 'desc2', descriptionCn: null, readmeOriginal: null,
                    readmeCn: null, readmeFetched: false, language: 'JS',
                    ownerName: 'alice', ownerAvatarUrl: 'url', htmlUrl: 'url2',
                    homepage: null, starsCount: 50, forksCount: 3,
                    watchersCount: 2, openIssuesCount: 0, topics: '[]',
                    licenseName: null, isFork: false, isArchived: false,
                    repoCreatedAt: new Date(), repoUpdatedAt: new Date(),
                    repoPushedAt: new Date(), starredAt: new Date(),
                },
            ]);

            const result = await service.findAuthorRepos({
                ownerName: 'alice', page: 1, size: 10,
            });
            expect(result.records).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('不存在作者应返回空列表', async () => {
            prisma.githubRepo.count.mockResolvedValue(0);
            prisma.githubRepo.findMany.mockResolvedValue([]);

            const result = await service.findAuthorRepos({
                ownerName: 'nonexistent', page: 1, size: 10,
            });
            expect(result.records).toEqual([]);
            expect(result.total).toBe(0);
        });
    });

    describe('findAllAuthorRepoUrls', () => {
        it('应返回作者所有仓库URL', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([
                { htmlUrl: 'https://github.com/alice/repo1' },
                { htmlUrl: 'https://github.com/alice/repo2' },
            ]);

            const urls = await service.findAllAuthorRepoUrls({
                ownerName: 'alice',
            });
            expect(urls).toEqual([
                'https://github.com/alice/repo1',
                'https://github.com/alice/repo2',
            ]);
        });
    });
});
