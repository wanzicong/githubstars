import { Test } from '@nestjs/testing';
import { GithubRepoService } from '../../src/github/github-repo.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('GithubRepoService', () => {
    let service: GithubRepoService;
    let prisma: any;

    const mockRepo = {
        id: 1n, repoName: 'test-repo', fullName: 'owner/test-repo',
        description: 'A test repo', descriptionCn: null,
        readmeOriginal: null, readmeCn: null, readmeFetched: false,
        language: 'TypeScript', ownerName: 'owner', ownerAvatarUrl: '',
        htmlUrl: 'https://github.com/owner/test-repo', homepage: null,
        starsCount: 100, forksCount: 10, watchersCount: 5, openIssuesCount: 3,
        topics: '["test"]', licenseName: 'MIT', isFork: false, isArchived: false,
        repoCreatedAt: new Date('2023-01-01'), repoUpdatedAt: new Date('2024-06-01'),
        repoPushedAt: new Date('2024-06-01'), starredAt: new Date(),
    };

    const mockPrisma = {
        githubRepo: {
            findMany: jest.fn().mockResolvedValue([mockRepo]),
            findUnique: jest.fn().mockResolvedValue(mockRepo),
            count: jest.fn().mockResolvedValue(1),
            aggregate: jest.fn(),
        },
        $executeRaw: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                GithubRepoService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get(GithubRepoService);
        prisma = mockPrisma;
        jest.clearAllMocks();
    });

    describe('findPage', () => {
        it('应返回分页结果', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([mockRepo]);
            prisma.githubRepo.count.mockResolvedValue(1);

            const result = await service.findPage({ page: 1, size: 12 });
            expect(result.records).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.size).toBe(12);
            expect(result.current).toBe(1);
            expect(result.pages).toBe(1);
        });

        it('应附加翻译状态', async () => {
            const repoWithTranslation = {
                ...mockRepo,
                descriptionCn: '测试描述',
                readmeCn: '测试README',
            };
            prisma.githubRepo.findMany.mockResolvedValue([repoWithTranslation]);
            prisma.githubRepo.count.mockResolvedValue(1);

            const result = await service.findPage({ page: 1, size: 12 });
            const status = (result.records[0] as any).translationStatus;
            expect(status.description).toBe('completed');
            expect(status.readme).toBe('completed');
        });

        it('应支持关键词搜索', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([mockRepo]);
            prisma.githubRepo.count.mockResolvedValue(1);

            const result = await service.findPage({ page: 1, size: 12, keyword: 'test' });
            expect(result.records).toHaveLength(1);
            expect(result.total).toBe(1);
        });

        it('应支持语言筛选', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([mockRepo]);
            prisma.githubRepo.count.mockResolvedValue(1);

            const result = await service.findPage({ page: 1, size: 12, language: 'TypeScript' });
            expect(result.records).toHaveLength(1);
        });

        it('空结果应返回空数组', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([]);
            prisma.githubRepo.count.mockResolvedValue(0);

            const result = await service.findPage({ page: 1, size: 12 });
            expect(result.records).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.pages).toBe(0);
        });
    });

    describe('findById', () => {
        it('应返回仓库详情', async () => {
            prisma.githubRepo.findUnique.mockResolvedValue(mockRepo);
            const repo = await service.findById(1);
            expect(repo).toBeDefined();
            expect(repo!.fullName).toBe('owner/test-repo');
        });

        it('不存在的仓库应返回 null', async () => {
            prisma.githubRepo.findUnique.mockResolvedValue(null);
            const repo = await service.findById(999);
            expect(repo).toBeNull();
        });
    });

    describe('findAllUrls', () => {
        it('应返回所有仓库URL列表', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([
                { htmlUrl: 'https://github.com/a/b' },
                { htmlUrl: 'https://github.com/c/d' },
            ]);

            const urls = await service.findAllUrls({});
            expect(urls).toEqual(['https://github.com/a/b', 'https://github.com/c/d']);
        });
    });

    describe('countTranslationStatus', () => {
        it('应返回翻译状态统计', async () => {
            prisma.githubRepo.count
                .mockResolvedValueOnce(100) // total
                .mockResolvedValueOnce(60)  // descCompleted
                .mockResolvedValueOnce(30); // readmeCompleted

            const result = await service.countTranslationStatus({});
            expect(result.total).toBe(100);
            expect(result.descCompleted).toBe(60);
            expect(result.descPending).toBe(40);
            expect(result.readmeCompleted).toBe(30);
            expect(result.readmePending).toBe(70);
        });
    });

    describe('count', () => {
        it('应返回仓库总数', async () => {
            prisma.githubRepo.count.mockResolvedValue(42);
            const count = await service.count();
            expect(count).toBe(42);
        });
    });
});
