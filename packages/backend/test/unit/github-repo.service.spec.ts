/**
 * GithubRepoService 单元测试
 *
 * 测试重点:
 *   - buildWhere() 6 种条件组合
 *   - SORT_MAP 映射正确性
 *   - findPage 参数传递完整性（防止导出 bug 复现）
 *
 * 所有 Prisma 调用被 Mock，测试纯逻辑。
 */
import { Test, TestingModule } from '@nestjs/testing';
import { GithubRepoService } from '../../src/github/services/github-repo.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// 辅助: 创建 Mock PrismaService
function createMockPrisma() {
    return {
        githubRepo: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn().mockResolvedValue(null),
        },
        repoCategory: {
            findMany: jest.fn().mockResolvedValue([]),
        },
        category: {
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
        },
        $executeRaw: jest.fn().mockResolvedValue(0),
        $queryRaw: jest.fn().mockResolvedValue([]),
    };
}

describe('GithubRepoService', () => {
    let service: GithubRepoService;
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(async () => {
        mockPrisma = createMockPrisma();
        const module: TestingModule = await Test.createTestingModule({
            providers: [GithubRepoService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();
        service = module.get<GithubRepoService>(GithubRepoService);
    });

    // ==================== SORT_MAP 映射 ====================

    describe('排序字段映射', () => {
        it('stars_count 映射到 starsCount', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 1, size: 10, sortBy: 'stars_count', sortOrder: 'desc' });
            const call = mockPrisma.githubRepo.findMany.mock.calls[0][0];
            expect(call.orderBy).toEqual({ starsCount: 'desc' });
        });

        it('forks_count 映射到 forksCount', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 1, size: 10, sortBy: 'forks_count', sortOrder: 'asc' });
            expect(mockPrisma.githubRepo.findMany.mock.calls[0][0].orderBy).toEqual({ forksCount: 'asc' });
        });

        it('repo_updated_at 映射到 repoUpdatedAt', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 1, size: 10, sortBy: 'repo_updated_at' });
            expect(mockPrisma.githubRepo.findMany.mock.calls[0][0].orderBy).toEqual({ repoUpdatedAt: 'desc' });
        });

        it('starred_at 映射到 starredAt (默认)', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 1, size: 10 });
            expect(mockPrisma.githubRepo.findMany.mock.calls[0][0].orderBy).toEqual({ starredAt: 'desc' });
        });

        it('未知排序字段回退到 starredAt', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 1, size: 10, sortBy: 'nonexistent_field' });
            expect(mockPrisma.githubRepo.findMany.mock.calls[0][0].orderBy).toEqual({ starredAt: 'desc' });
        });
    });

    // ==================== findPage 参数传递完整性 ====================

    describe('findPage 参数传递', () => {
        it('应传递所有筛选参数到 buildWhere — 防止导出 bug 复现', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            mockPrisma.category.findUnique.mockResolvedValue({ id: BigInt(1), level: 2 } as any);

            await service.findPage({
                page: 1,
                size: 50,
                keyword: 'mcp',
                language: 'TypeScript,Python',
                categoryIds: '1',
                sortBy: 'stars_count',
                sortOrder: 'asc',
                dateField: 'starred_at',
                startDate: '2024-01-01',
                endDate: '2024-12-31',
                untranslatedOnly: true,
            });

            const callArgs = mockPrisma.githubRepo.count.mock.calls[0][0];
            expect(callArgs).toBeDefined();
            // 验证 where 包含 AND 条件数组（至少包含 keyword、language、category、dateRange、untranslatedOnly）
            expect(callArgs.where.AND).toBeDefined();
            expect(callArgs.where.AND.length).toBeGreaterThanOrEqual(4);
        });

        it('不传筛选参数时仍然正常工作', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            const result = await service.findPage({ page: 1, size: 10 });
            expect(result.records).toEqual([]);
            expect(result.total).toBe(0);
        });

        it('keyword 空的时不应传空字符串到 Prisma', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 1, size: 10, keyword: '' });
            const countCall = mockPrisma.githubRepo.count.mock.calls[0][0];
            // keyword 为空时不应添加 OR 条件
            const orConditions = countCall.where?.AND?.filter((c: any) => c.OR);
            expect(orConditions?.length || 0).toBe(0);
        });
    });

    // ==================== 分页边界 ====================

    describe('分页', () => {
        it('默认 page=1 size=12', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({});
            const call = mockPrisma.githubRepo.findMany.mock.calls[0][0];
            expect(call.skip).toBe(0);
            expect(call.take).toBe(12);
        });

        it('page=3 size=36 → skip=72 take=36', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 3, size: 36 });
            const call = mockPrisma.githubRepo.findMany.mock.calls[0][0];
            expect(call.skip).toBe(72);
            expect(call.take).toBe(36);
        });
    });

    // ==================== buildWhere 条件组合 ====================

    describe('buildWhere (通过 findPage 间接测试)', () => {
        it('多语言筛选', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 1, size: 10, language: 'TypeScript,Go' });
            const countCall = mockPrisma.githubRepo.count.mock.calls[0][0];
            expect(countCall.where.AND).toBeDefined();
        });

        it('untranslatedOnly=true', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 1, size: 10, untranslatedOnly: true });
            // untranslatedOnly 应生成 (readmeCn IS NULL OR readmeCn = '') 条件
            const countCall = mockPrisma.githubRepo.count.mock.calls[0][0];
            expect(countCall.where).toBeDefined();
        });

        it('日期范围筛选 — starred_at', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 1, size: 10, dateField: 'starred_at', startDate: '2024-01-01', endDate: '2024-06-30' });
            const countCall = mockPrisma.githubRepo.count.mock.calls[0][0];
            const dateCond = countCall.where.AND.find((c: any) => c.starredAt);
            expect(dateCond).toBeDefined();
            expect(dateCond.starredAt.gte).toBeInstanceOf(Date);
            expect(dateCond.starredAt.lte).toBeInstanceOf(Date);
        });

        it('仅有 startDate 无 endDate', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPage({ page: 1, size: 10, dateField: 'starred_at', startDate: '2024-01-01' });
            const countCall = mockPrisma.githubRepo.count.mock.calls[0][0];
            const dateCond = countCall.where.AND.find((c: any) => c.starredAt);
            expect(dateCond.starredAt.gte).toBeDefined();
            expect(dateCond.starredAt.lte).toBeUndefined();
        });
    });

    // ==================== upsertRepo ====================

    describe('upsertRepo', () => {
        it('应调用 $executeRaw 执行 INSERT ... ON DUPLICATE KEY UPDATE', async () => {
            await service.upsertRepo({
                repoName: 'test',
                fullName: 'owner/test',
                description: 'desc',
                language: 'TS',
                ownerName: 'owner',
                ownerAvatarUrl: 'url',
                htmlUrl: 'html',
                homepage: null,
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
            });
            expect(mockPrisma.$executeRaw).toHaveBeenCalled();
        });
    });
});
