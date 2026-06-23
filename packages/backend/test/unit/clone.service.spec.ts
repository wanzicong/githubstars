import { Test } from '@nestjs/testing';
import { CloneService } from '../../src/clone/clone.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '../../src/config/config.service';

describe('CloneService', () => {
    let service: CloneService;
    let prisma: any;

    const createBigIntId = (n: number) => BigInt(n);

    const mockPrisma = {
        cloneTask: {
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
        cloneTaskItem: {
            createMany: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn(),
        },
        githubRepo: {
            findMany: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    const mockConfig = {
        getValue: jest.fn().mockResolvedValue('fake-token'),
    };

    const repoData = [
        { id: createBigIntId(1), fullName: 'owner1/repo-a', htmlUrl: 'https://github.com/owner1/repo-a' },
        { id: createBigIntId(2), fullName: 'owner2/repo-b', htmlUrl: 'https://github.com/owner2/repo-b' },
    ];

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                CloneService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ConfigService, useValue: mockConfig },
            ],
        }).compile();
        service = module.get(CloneService);
        prisma = mockPrisma;
    });

    describe('createTask', () => {
        it('应成功创建克隆任务', async () => {
            prisma.githubRepo.findMany.mockResolvedValue(repoData);
            prisma.cloneTask.create.mockResolvedValue({
                id: createBigIntId(1), status: 'PENDING', targetDir: '/tmp/clone',
                concurrency: 5, shallow: true, totalItems: 2, createdAt: new Date(),
            });
            prisma.cloneTaskItem.createMany.mockResolvedValue({ count: 2 });

            const result = await service.createTask({
                repoIds: [1, 2], targetDir: '/tmp/clone', concurrency: 5, shallow: true,
            });

            expect(result.success).toBe(true);
            expect(result.taskId).toBe(1);
            expect(prisma.cloneTask.create).toHaveBeenCalled();
            expect(prisma.cloneTaskItem.createMany).toHaveBeenCalled();
        });

        it('无匹配仓库时应返回失败', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([]);

            const result = await service.createTask({
                repoIds: [999], targetDir: '/tmp/clone', concurrency: 5, shallow: true,
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('未找到指定仓库');
        });
    });

    describe('isRunning', () => {
        it('初始状态应为 false', () => {
            expect(service.isRunning()).toBe(false);
        });
    });

    describe('getLockAge', () => {
        it('未持锁时返回 -1', () => {
            expect(service.getLockAge()).toBe(-1);
        });
    });

    describe('getCurrentTaskId', () => {
        it('未执行任务时返回 null', () => {
            expect(service.getCurrentTaskId()).toBeNull();
        });
    });

    describe('forceReleaseLock', () => {
        it('应强制释放锁', () => {
            service.forceReleaseLock();
            expect(service.isRunning()).toBe(false);
        });
    });

    describe('getRecentTasks', () => {
        it('应返回最近任务列表', async () => {
            prisma.cloneTask.findMany.mockResolvedValue([
                {
                    id: createBigIntId(1), status: 'COMPLETED', targetDir: '/tmp/clone1',
                    concurrency: 3, shallow: true, totalItems: 2,
                    createdAt: new Date(), startedAt: new Date(), finishedAt: new Date(),
                    items: [{ status: 'COMPLETED' }, { status: 'COMPLETED' }],
                },
                {
                    id: createBigIntId(2), status: 'PARTIAL', targetDir: '/tmp/clone2',
                    concurrency: 2, shallow: false, totalItems: 3,
                    createdAt: new Date(), startedAt: new Date(), finishedAt: new Date(),
                    items: [{ status: 'COMPLETED' }, { status: 'FAILED' }, { status: 'FAILED' }],
                },
            ]);

            const result = await service.getRecentTasks();
            expect(result.success).toBe(true);
            expect(result.tasks).toHaveLength(2);
            expect(result.tasks[0].completedItems).toBe(2);
            expect(result.tasks[1].failedItems).toBe(2);
            expect(result.tasks[1].status).toBe('PARTIAL');
        });

        it('空任务列表应返回空数组', async () => {
            prisma.cloneTask.findMany.mockResolvedValue([]);
            const result = await service.getRecentTasks();
            expect(result.success).toBe(true);
            expect(result.tasks).toEqual([]);
        });
    });

    describe('getTaskProgress', () => {
        it('应返回任务进度详情', async () => {
            prisma.cloneTask.findUnique.mockResolvedValue({
                id: createBigIntId(1), status: 'PROCESSING', targetDir: '/tmp/clone',
                concurrency: 3, shallow: true, createdAt: new Date(), startedAt: new Date(), finishedAt: null,
                items: [
                    { fullName: 'a/b', status: 'COMPLETED', localPath: '/tmp/clone/a/b', errorMessage: null },
                    { fullName: 'c/d', status: 'FAILED', localPath: '/tmp/clone/c/d', errorMessage: 'timeout' },
                ],
            });

            const result = await service.getTaskProgress(1);
            expect(result.success).toBe(true);
            expect(result.taskId).toBe(1);
            expect(result.totalItems).toBe(2);
            expect(result.completedItems).toBe(1);
            expect(result.failedItems).toBe(1);
            expect(result.skippedItems).toBe(0);
            expect(result.progress).toBe(100);
            expect(result.failedDetails).toHaveLength(1);
            expect(result.skippedDetails).toEqual([]);
        });

        it('不存在的任务应返回失败', async () => {
            prisma.cloneTask.findUnique.mockResolvedValue(null);
            const result = await service.getTaskProgress(999);
            expect(result.success).toBe(false);
            expect(result.message).toContain('不存在');
        });
    });

    describe('retryFailed', () => {
        it('应重置失败项为 PENDING', async () => {
            prisma.cloneTaskItem.findMany.mockResolvedValue([
                { id: createBigIntId(1), status: 'FAILED', localPath: '/tmp/c/d' },
            ]);
            prisma.$transaction.mockResolvedValue([]);

            const result = await service.retryFailed(1);
            expect(result.success).toBe(true);
            expect(result.message).toContain('失败');
        });

        it('无需要重试的项时应返回失败', async () => {
            prisma.cloneTaskItem.findMany.mockResolvedValue([]);
            const result = await service.retryFailed(1);
            expect(result.success).toBe(false);
            expect(result.message).toContain('没有需要重试');
        });
    });

    describe('retryItem', () => {
        it('应重试单个克隆项', async () => {
            prisma.cloneTaskItem.findFirst.mockResolvedValue({
                id: createBigIntId(1), taskId: createBigIntId(1), fullName: 'x/y',
                status: 'FAILED', localPath: '/tmp/clone/x/y',
            });
            prisma.$transaction.mockImplementation(async (fn: any) => {
                const tx = {
                    cloneTaskItem: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
                    cloneTask: { update: jest.fn() },
                };
                await fn(tx);
            });

            const result = await service.retryItem(1, 'x/y');
            expect(result.success).toBe(true);
        });

        it('正在执行的项应拒绝重试', async () => {
            prisma.cloneTaskItem.findFirst.mockResolvedValue({
                id: createBigIntId(1), taskId: createBigIntId(1), fullName: 'x/y',
                status: 'PROCESSING', localPath: null,
            });

            const result = await service.retryItem(1, 'x/y');
            expect(result.success).toBe(false);
            expect(result.message).toContain('正在执行');
        });
    });

    describe('findNextPendingTask', () => {
        it('应返回下一个 PENDING 任务', async () => {
            prisma.cloneTask.findFirst.mockResolvedValue({
                id: createBigIntId(3), concurrency: 5,
            });

            const task = await service.findNextPendingTask();
            expect(task).not.toBeNull();
            expect(task!.concurrency).toBe(5);
        });

        it('无待执行任务时返回 null', async () => {
            prisma.cloneTask.findFirst.mockResolvedValue(null);
            const task = await service.findNextPendingTask();
            expect(task).toBeNull();
        });
    });
});
