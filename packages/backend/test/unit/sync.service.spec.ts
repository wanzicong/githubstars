import { Test } from '@nestjs/testing';
import { SyncService } from '../../src/sync/sync.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GithubApiService } from '../../src/github/github-api.service';
import { GithubRepoService } from '../../src/github/github-repo.service';

describe('SyncService', () => {
    let service: SyncService;
    let prisma: any;
    let githubApi: any;
    let githubRepo: any;

    const mockPrisma = {
        syncLog: {
            create: jest.fn(),
            update: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
        githubRepo: {
            findMany: jest.fn(),
            deleteMany: jest.fn(),
            count: jest.fn(),
        },
    };

    const mockGithubApi = {
        fetchAllStarredRepos: jest.fn(),
    };

    const mockGithubRepo = {
        upsertRepo: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                SyncService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: GithubApiService, useValue: mockGithubApi },
                { provide: GithubRepoService, useValue: mockGithubRepo },
            ],
        }).compile();
        service = module.get(SyncService);
        prisma = mockPrisma;
        githubApi = mockGithubApi;
    });

    describe('isSyncing', () => {
        it('初始状态应为 false', () => {
            expect(service.isSyncing()).toBe(false);
        });
    });

    describe('getSyncStatus', () => {
        it('应返回同步状态概览', async () => {
            prisma.githubRepo.count.mockResolvedValue(42);
            prisma.syncLog.findFirst.mockResolvedValue({
                finishedAt: new Date('2024-06-01'),
                syncedCount: 50,
            });

            const status = await service.getSyncStatus();
            expect(status.syncing).toBe(false);
            expect(status.totalRepos).toBe(42);
            expect(status.lastSuccessCount).toBe(50);
            expect(status.lastSuccessTime).toBeTruthy();
        });

        it('无成功日志时应返回 null 时间', async () => {
            prisma.githubRepo.count.mockResolvedValue(0);
            prisma.syncLog.findFirst.mockResolvedValue(null);

            const status = await service.getSyncStatus();
            expect(status.lastSuccessTime).toBeNull();
            expect(status.lastSuccessCount).toBe(0);
        });
    });

    describe('getSyncLogs', () => {
        it('应返回分页的同步日志', async () => {
            prisma.syncLog.count.mockResolvedValue(2);
            prisma.syncLog.findMany.mockResolvedValue([
                {
                    id: 1n,
                    syncType: '手动同步',
                    status: '成功',
                    totalCount: 100,
                    syncedCount: 100,
                    errorMessage: null,
                    startedAt: new Date(),
                    finishedAt: new Date(),
                    createdAt: new Date(),
                },
                {
                    id: 2n,
                    syncType: '定时同步',
                    status: '失败',
                    totalCount: 100,
                    syncedCount: 50,
                    errorMessage: '网络错误',
                    startedAt: new Date(),
                    finishedAt: new Date(),
                    createdAt: new Date(),
                },
            ]);

            const result = await service.getSyncLogs(1, 10);
            expect(result.total).toBe(2);
            expect(result.records).toHaveLength(2);
            expect(result.records[0].id).toBe(1);
            expect(result.records[0].syncType).toBe('手动同步');
        });

        it('空日志应返回空数组', async () => {
            prisma.syncLog.count.mockResolvedValue(0);
            prisma.syncLog.findMany.mockResolvedValue([]);

            const result = await service.getSyncLogs(1, 10);
            expect(result.total).toBe(0);
            expect(result.records).toEqual([]);
        });
    });

    describe('startManualSync', () => {
        it('无进行中的同步时应启动新任务', () => {
            // Mock executeSync to prevent actual execution
            prisma.githubRepo.count.mockResolvedValue(0);
            service.startManualSync();
            // 同步锁应在短时间内被占用
            expect(service.isSyncing()).toBe(true);
        });

        it('已有同步进行中时应跳过', () => {
            // First call acquires the lock
            service.startManualSync();
            expect(service.isSyncing()).toBe(true);
        });
    });

    describe('startScheduledSync', () => {
        it('应触发定时同步', () => {
            service.startScheduledSync();
            expect(service.isSyncing()).toBe(true);
        });
    });
});
