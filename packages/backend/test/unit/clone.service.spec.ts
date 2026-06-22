import { Test, TestingModule } from '@nestjs/testing';
import { CloneService } from '../../src/clone/clone.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '../../src/config/config.service';

/**
 * CloneService 健壮性测试
 *
 * 重点验证：
 * 1. 信号量并发控制（acquire/release/drainWaitQueue）
 * 2. 超时取消后信号量不泄漏
 * 3. 锁管理（running/lockAge/forceReleaseLock）
 * 4. 路径安全校验（防路径遍历攻击）
 * 5. 并发竞态条件
 */

// Mock PrismaService
const mockPrisma = {
    cloneTask: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
    },
    cloneTaskItem: {
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
    },
    githubRepo: {
        findMany: jest.fn(),
    },
    $transaction: jest.fn((ops) => Promise.all(Array.isArray(ops) ? ops : [ops])),
};

// Mock ConfigService
const mockConfig = {
    get: jest.fn().mockReturnValue(''),
};

describe('CloneService 健壮性测试', () => {
    let service: CloneService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CloneService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ConfigService, useValue: mockConfig },
            ],
        }).compile();

        service = module.get<CloneService>(CloneService);
    });

    // ========== 信号量测试 ==========

    describe('信号量并发控制', () => {
        it('基本 acquire/release：并发数不超过 maxConcurrent', async () => {
            // 重置信号量为 max=2
            (service as any).resetSemaphore(2);

            // 获取第一个许可
            await (service as any).acquire();
            expect((service as any).semaphore).toBe(1);

            // 获取第二个许可
            await (service as any).acquire();
            expect((service as any).semaphore).toBe(2);

            // 释放一个
            (service as any).release();
            expect((service as any).semaphore).toBe(1);

            // 释放另一个
            (service as any).release();
            expect((service as any).semaphore).toBe(0);
        });

        it('超过并发限制时进入等待队列', async () => {
            (service as any).resetSemaphore(1);

            // 占满信号量
            await (service as any).acquire();
            expect((service as any).semaphore).toBe(1);

            // 第二个 acquire 会进入等待队列
            let resolved = false;
            const waitPromise = (service as any).acquire().then(() => {
                resolved = true;
            });

            // 此时还未解决
            await new Promise((r) => setTimeout(r, 10));
            expect(resolved).toBe(false);
            expect((service as any).waitQueue.length).toBe(1);

            // 释放后，队列中的 waiter 被唤醒
            (service as any).release();

            // 等待 microtask 执行
            await new Promise((r) => setTimeout(r, 50));
            expect(resolved).toBe(true);
            expect((service as any).semaphore).toBe(1);
            expect((service as any).waitQueue.length).toBe(0);

            // 清理
            (service as any).release();
        });

        it('已取消的 waiter 不浪费信号量（drainWaitQueue 跳过 cancelled）', async () => {
            (service as any).resetSemaphore(1);

            // 占满
            await (service as any).acquire();

            // 添加 3 个 waiter，中间那个已取消
            const results: string[] = [];
            const p1 = (service as any).acquire().then(() => results.push('waiter1'));
            const p2 = (service as any).acquire().then(() => results.push('waiter2'));
            const p3 = (service as any).acquire().then(() => results.push('waiter3'));

            await new Promise((r) => setTimeout(r, 10));

            // 模拟中间 waiter 超时取消
            expect((service as any).waitQueue.length).toBe(3);
            (service as any).waitQueue[1].cancelled = true;

            // 释放第一个 → 应唤醒 waiter1（第一个未取消的）
            (service as any).release();
            await new Promise((r) => setTimeout(r, 50));
            expect(results).toContain('waiter1');

            // 释放 → 跳过 cancelled waiter2，唤醒 waiter3
            (service as any).release();
            await new Promise((r) => setTimeout(r, 50));
            expect(results).toContain('waiter3');
            expect(results).not.toContain('waiter2');

            // 信号量状态正确
            (service as any).release();
            expect((service as any).semaphore).toBe(0);

            // 防止 p2 未处理异常
            p2.catch(() => {});
        });

        it('resetSemaphore 清空所有状态', async () => {
            (service as any).resetSemaphore(5);
            await (service as any).acquire();
            await (service as any).acquire();
            expect((service as any).semaphore).toBe(2);
            expect((service as any).maxConcurrent).toBe(5);

            // 重置
            (service as any).resetSemaphore(10);
            expect((service as any).semaphore).toBe(0);
            expect((service as any).maxConcurrent).toBe(10);
            expect((service as any).waitQueue).toEqual([]);
        });

        it('多次 release 不会使 semaphore 变为负数（边界条件）', () => {
            (service as any).resetSemaphore(2);
            // 没有 acquire 就 release
            (service as any).release();
            expect((service as any).semaphore).toBe(0); // 修复后：下限保护，不再变为 -1
        });

        it('队列全为 cancelled waiter 时 release 不分配信号量', async () => {
            (service as any).resetSemaphore(1);
            await (service as any).acquire();

            // 添加 3 个全部取消的 waiter
            (service as any).waitQueue.push({ fn: () => {}, cancelled: true });
            (service as any).waitQueue.push({ fn: () => {}, cancelled: true });
            (service as any).waitQueue.push({ fn: () => {}, cancelled: true });

            // release 应跳过所有 cancelled，semaphore 变为 0
            (service as any).release();
            expect((service as any).semaphore).toBe(0);
            expect((service as any).waitQueue.length).toBe(0);
        });
    });

    // ========== 锁管理测试 ==========

    describe('锁管理', () => {
        it('初始状态：running=false, lockAge=-1, taskId=null', () => {
            expect(service.isRunning()).toBe(false);
            expect(service.getLockAge()).toBe(-1);
            expect(service.getCurrentTaskId()).toBeNull();
        });

        it('forceReleaseLock 重置所有锁状态', () => {
            // 模拟锁被持有
            (service as any).running = true;
            (service as any).lockAcquiredAt = new Date(Date.now() - 10000);
            (service as any).currentTaskId = BigInt(123);

            expect(service.isRunning()).toBe(true);
            expect(service.getLockAge()).toBeGreaterThan(0);
            expect(service.getCurrentTaskId()).toBe(BigInt(123));

            service.forceReleaseLock();

            expect(service.isRunning()).toBe(false);
            expect(service.getLockAge()).toBe(-1);
            expect(service.getCurrentTaskId()).toBeNull();
        });

        it('getLockAge 返回正确的时间差', () => {
            (service as any).running = true;
            (service as any).lockAcquiredAt = new Date(Date.now() - 5000);

            const age = service.getLockAge();
            expect(age).toBeGreaterThanOrEqual(4900);
            expect(age).toBeLessThanOrEqual(5500);
        });

        it('running=false 时 getLockAge 返回 -1', () => {
            (service as any).running = false;
            (service as any).lockAcquiredAt = new Date();
            expect(service.getLockAge()).toBe(-1);
        });
    });

    // ========== 路径安全测试 ==========

    describe('路径安全校验', () => {
        it('正常路径通过校验', () => {
            (service as any).targetDir = 'D:\\repos\\stars';
            const result = (service as any).isPathWithinTargetDir('D:\\repos\\stars\\owner\\repo');
            expect(result).toBe(true);
        });

        it('路径遍历攻击被拦截（.. 跳出目标目录）', () => {
            (service as any).targetDir = 'D:\\repos\\stars';
            const result = (service as any).isPathWithinTargetDir('D:\\repos\\..\\malicious');
            expect(result).toBe(false);
        });

        it('路径遍历攻击被拦截（绝对路径不在目标目录内）', () => {
            (service as any).targetDir = 'D:\\repos\\stars';
            const result = (service as any).isPathWithinTargetDir('C:\\Windows\\System32');
            expect(result).toBe(false);
        });

        it('targetDir 为 null 时默认放行（设计上允许无目标目录时不做限制）', () => {
            (service as any).targetDir = null;
            const result = (service as any).isPathWithinTargetDir('D:\\any\\path');
            expect(result).toBe(true); // 无 targetDir 时不做限制
        });

        it('精确等于 targetDir 通过校验', () => {
            const targetDir = 'D:\\repos\\stars';
            (service as any).targetDir = targetDir;
            // resolve 后的路径相同
            const result = (service as any).isPathWithinTargetDir(targetDir);
            // 根据实现，精确等于 targetDir 也是允许的
            expect(result).toBe(true);
        });
    });

    // ========== 任务创建测试 ==========

    describe('createTask 异常场景', () => {
        it('空仓库列表返回失败', async () => {
            mockPrisma.githubRepo.findMany.mockResolvedValue([]);

            const result = await service.createTask({
                repoIds: [1, 2, 3],
                targetDir: 'D:\\test',
                concurrency: 5,
                shallow: true,
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('未找到');
        });

        it('数据库异常时抛出错误', async () => {
            mockPrisma.githubRepo.findMany.mockRejectedValue(new Error('DB connection lost'));

            await expect(
                service.createTask({
                    repoIds: [1],
                    targetDir: 'D:\\test',
                    concurrency: 5,
                    shallow: true,
                }),
            ).rejects.toThrow('DB connection lost');
        });
    });

    // ========== 并发竞态测试 ==========

    describe('并发竞态条件', () => {
        it('多个 acquire 同时执行不超过 maxConcurrent', async () => {
            (service as any).resetSemaphore(3);

            // 同时发起 5 个 acquire
            const acquired: number[] = [];
            const promises = Array.from({ length: 5 }, (_, i) =>
                (service as any).acquire().then(() => {
                    acquired.push(i);
                }),
            );

            // 前 3 个应立即获取
            await new Promise((r) => setTimeout(r, 10));
            expect(acquired.length).toBe(3);
            expect((service as any).semaphore).toBe(3);

            // 释放一个，第 4 个获取
            (service as any).release();
            await new Promise((r) => setTimeout(r, 50));
            expect(acquired.length).toBe(4);

            // 再释放一个，第 5 个获取
            (service as any).release();
            await new Promise((r) => setTimeout(r, 50));
            expect(acquired.length).toBe(5);

            // 清理
            (service as any).release();
            (service as any).release();
            (service as any).release();

            await Promise.allSettled(promises);
        });

        it('executeTask 并发调用只有第一个生效', async () => {
            // 模拟锁已被持有
            (service as any).running = true;

            // 第二次调用应直接返回
            await service.executeTask(BigInt(999));

            // running 仍为 true（说明第二个 executeTask 没执行）
            expect(service.isRunning()).toBe(true);
            // currentTaskId 没变
            expect(service.getCurrentTaskId()).toBeNull();
        });
    });
});
