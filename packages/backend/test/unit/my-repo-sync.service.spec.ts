import { Test } from '@nestjs/testing';
import { MyRepoSyncService } from '../../src/my-repos/my-repo-sync.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GithubApiService } from '../../src/github/github-api.service';
import { MyRepoService } from '../../src/my-repos/my-repo.service';

describe('MyRepoSyncService', () => {
    let service: MyRepoSyncService;

    const mockPrisma = {
        syncLog: {
            create: jest.fn(),
            update: jest.fn(),
            findFirst: jest.fn(),
        },
        myRepo: {
            count: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
    };

    const mockGithubApi = {
        fetchAllOwnedRepos: jest.fn(),
        fetchReadmeFromGitHub: jest.fn(),
    };

    const mockMyRepoService = {
        upsertRepo: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                MyRepoSyncService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: GithubApiService, useValue: mockGithubApi },
                { provide: MyRepoService, useValue: mockMyRepoService },
            ],
        }).compile();
        service = module.get(MyRepoSyncService);
    });

    describe('isSyncing', () => {
        it('初始状态应为 false', () => {
            expect(service.isSyncing()).toBe(false);
        });
    });

    describe('startManualSync', () => {
        it('无进行中同步时应受理并占用锁', () => {
            mockPrisma.myRepo.count.mockResolvedValue(0);
            const accepted = service.startManualSync();
            expect(accepted).toBe(true);
            expect(service.isSyncing()).toBe(true);
        });

        it('已有同步进行中时应拒绝', () => {
            mockPrisma.myRepo.count.mockResolvedValue(0);
            service.startManualSync();
            const second = service.startManualSync();
            expect(second).toBe(false);
        });
    });

    describe('getSyncStatus', () => {
        it('应返回同步状态概览', async () => {
            mockPrisma.myRepo.count.mockResolvedValue(7);
            mockPrisma.syncLog.findFirst.mockResolvedValue({
                finishedAt: new Date('2026-08-01'),
                syncedCount: 7,
            });

            const status = await service.getSyncStatus();
            expect(status.totalRepos).toBe(7);
            expect(status.lastSuccessCount).toBe(7);
            expect(status.lastSuccessTime).toBeTruthy();
        });

        it('无成功日志时应返回 null 时间', async () => {
            mockPrisma.myRepo.count.mockResolvedValue(0);
            mockPrisma.syncLog.findFirst.mockResolvedValue(null);

            const status = await service.getSyncStatus();
            expect(status.lastSuccessTime).toBeNull();
            expect(status.lastSuccessCount).toBe(0);
        });
    });
});
