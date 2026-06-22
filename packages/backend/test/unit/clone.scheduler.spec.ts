import { Test, TestingModule } from '@nestjs/testing';
import { CloneScheduler } from '../../src/clone/clone.scheduler';
import { CloneService } from '../../src/clone/clone.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * CloneScheduler 健壮性测试
 *
 * 重点验证：
 * 1. recovering 互斥锁防止并发恢复
 * 2. 锁超时检测与恢复
 * 3. 卡住任务检测与恢复
 * 4. tick 异常处理
 * 5. 目录一致性检测
 */

const mockCloneService = {
    isRunning: jest.fn(),
    findNextPendingTask: jest.fn(),
    executeTask: jest.fn(),
    getLockAge: jest.fn(),
    getCurrentTaskId: jest.fn(),
    forceReleaseLock: jest.fn(),
};

const mockPrisma = {
    cloneTask: {
        findMany: jest.fn(),
        update: jest.fn(),
    },
    cloneTaskItem: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
};

describe('CloneScheduler 健壮性测试', () => {
    let scheduler: CloneScheduler;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CloneScheduler,
                { provide: CloneService, useValue: mockCloneService },
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        scheduler = module.get<CloneScheduler>(CloneScheduler);
    });

    // ========== recovering 互斥锁测试 ==========

    describe('recovering 互斥锁', () => {
        it('detectLockTimeout 在 recovering=true 时直接返回', async () => {
            (scheduler as any).recovering = true;

            await scheduler.detectLockTimeout();

            // getLockAge 不应被调用
            expect(mockCloneService.getLockAge).not.toHaveBeenCalled();
        });

        it('detectStuckTasks 在 recovering=true 时直接返回', async () => {
            (scheduler as any).recovering = true;

            await scheduler.detectStuckTasks();

            // 不应查询数据库
            expect(mockPrisma.cloneTask.findMany).not.toHaveBeenCalled();
        });

        it('recoverStuckTask 完成后释放 recovering 锁', async () => {
            mockPrisma.cloneTask.update.mockResolvedValue({});
            mockPrisma.cloneTaskItem.updateMany.mockResolvedValue({ count: 0 });

            await (scheduler as any).recoverStuckTask(BigInt(1), '测试');

            expect((scheduler as any).recovering).toBe(false);
        });

        it('recoverStuckTask 异常后仍释放 recovering 锁', async () => {
            mockPrisma.cloneTask.update.mockRejectedValue(new Error('DB error'));

            await (scheduler as any).recoverStuckTask(BigInt(1), '测试');

            // finally 块确保 recovering 被重置
            expect((scheduler as any).recovering).toBe(false);
        });

        it('并发调用 recoverStuckTask 只有第一个执行', async () => {
            mockPrisma.cloneTask.update.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
            );
            mockPrisma.cloneTaskItem.updateMany.mockResolvedValue({ count: 0 });

            // 第一个调用
            const p1 = (scheduler as any).recoverStuckTask(BigInt(1), '第一次');

            // 等第一个进入 recovering=true
            await new Promise((r) => setTimeout(r, 10));
            expect((scheduler as any).recovering).toBe(true);

            // 第二个调用应直接返回
            await (scheduler as any).recoverStuckTask(BigInt(2), '第二次');

            // 等待第一个完成
            await p1;

            // 只有第一个任务的 update 被调用
            expect(mockPrisma.cloneTask.update).toHaveBeenCalledTimes(1);
            expect(mockPrisma.cloneTask.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: BigInt(1) } }),
            );
        });
    });

    // ========== tick 调度测试 ==========

    describe('tick 调度', () => {
        it('有任务运行时跳过 tick', async () => {
            mockCloneService.isRunning.mockReturnValue(true);

            await scheduler.tick();

            expect(mockCloneService.findNextPendingTask).not.toHaveBeenCalled();
        });

        it('发现待执行任务时触发 executeTask', async () => {
            mockCloneService.isRunning.mockReturnValue(false);
            mockCloneService.findNextPendingTask.mockResolvedValue({ id: BigInt(42) });
            mockCloneService.executeTask.mockResolvedValue(undefined);

            await scheduler.tick();

            expect(mockCloneService.executeTask).toHaveBeenCalledWith(BigInt(42));
        });

        it('没有待执行任务时不触发 executeTask', async () => {
            mockCloneService.isRunning.mockReturnValue(false);
            mockCloneService.findNextPendingTask.mockResolvedValue(null);

            await scheduler.tick();

            expect(mockCloneService.executeTask).not.toHaveBeenCalled();
        });

        it('findNextPendingTask 异常不崩溃', async () => {
            mockCloneService.isRunning.mockReturnValue(false);
            mockCloneService.findNextPendingTask.mockRejectedValue(new Error('DB error'));

            // 不应抛出异常
            await expect(scheduler.tick()).resolves.not.toThrow();
        });
    });

    // ========== 锁超时检测 ==========

    describe('detectLockTimeout', () => {
        it('锁未持有时跳过', async () => {
            mockCloneService.getLockAge.mockReturnValue(-1);

            await scheduler.detectLockTimeout();

            expect(mockCloneService.forceReleaseLock).not.toHaveBeenCalled();
        });

        it('锁未超时时跳过', async () => {
            mockCloneService.getLockAge.mockReturnValue(60 * 1000); // 1分钟

            await scheduler.detectLockTimeout();

            expect(mockCloneService.forceReleaseLock).not.toHaveBeenCalled();
        });

        it('锁超时时强制释放并恢复任务', async () => {
            // 41分钟 > LOCK_TIMEOUT_MS (40分钟)
            mockCloneService.getLockAge.mockReturnValue(41 * 60 * 1000);
            mockCloneService.getCurrentTaskId.mockReturnValue(BigInt(100));
            mockPrisma.cloneTask.update.mockResolvedValue({});
            mockPrisma.cloneTaskItem.updateMany.mockResolvedValue({ count: 2 });

            await scheduler.detectLockTimeout();

            expect(mockCloneService.forceReleaseLock).toHaveBeenCalled();
            expect(mockPrisma.cloneTask.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: BigInt(100) },
                    data: expect.objectContaining({ status: 'FAILED' }),
                }),
            );
        });

        it('锁超时但没有当前任务 ID 时只释放锁', async () => {
            mockCloneService.getLockAge.mockReturnValue(41 * 60 * 1000);
            mockCloneService.getCurrentTaskId.mockReturnValue(null);

            await scheduler.detectLockTimeout();

            expect(mockCloneService.forceReleaseLock).toHaveBeenCalled();
            expect(mockPrisma.cloneTask.update).not.toHaveBeenCalled();
        });
    });

    // ========== 卡住任务检测 ==========

    describe('detectStuckTasks', () => {
        it('没有卡住任务时不操作', async () => {
            mockPrisma.cloneTask.findMany.mockResolvedValue([]);

            await scheduler.detectStuckTasks();

            expect(mockCloneService.forceReleaseLock).not.toHaveBeenCalled();
        });

        it('发现卡住任务时恢复并释放锁', async () => {
            const stuckTask = {
                id: BigInt(55),
                startedAt: new Date(Date.now() - 36 * 60 * 1000), // 36分钟前
            };
            mockPrisma.cloneTask.findMany.mockResolvedValue([stuckTask]);
            mockCloneService.isRunning.mockReturnValue(true);
            mockPrisma.cloneTask.update.mockResolvedValue({});
            mockPrisma.cloneTaskItem.updateMany.mockResolvedValue({ count: 3 });

            await scheduler.detectStuckTasks();

            expect(mockPrisma.cloneTask.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: BigInt(55) },
                    data: expect.objectContaining({ status: 'FAILED' }),
                }),
            );
            expect(mockCloneService.forceReleaseLock).toHaveBeenCalled();
        });
    });

    // ========== 目录一致性检测 ==========

    describe('detectDirectoryInconsistency', () => {
        it('没有完成项时跳过', async () => {
            mockPrisma.cloneTaskItem.findMany.mockResolvedValue([]);

            await scheduler.detectDirectoryInconsistency();

            expect(mockPrisma.cloneTaskItem.update).not.toHaveBeenCalled();
        });

        it('数据库异常不崩溃', async () => {
            mockPrisma.cloneTaskItem.findMany.mockRejectedValue(new Error('DB error'));

            await expect(scheduler.detectDirectoryInconsistency()).resolves.not.toThrow();
        });
    });
});
