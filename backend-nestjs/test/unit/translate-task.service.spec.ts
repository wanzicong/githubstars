/**
 * TranslateTaskService 单元测试
 *
 * 测试重点:
 *   - 信号量并发控制 (acquire/release)
 *   - isApiKeyConfigured
 *   - getTaskProgress 进度百分比计算
 *   - finishTask 状态逻辑 (COMPLETED/PARTIAL/FAILED)
 *   - cleanOld 保留最近任务
 *   - createAndStartFullTranslate 空仓库边界
 *   - retryFailed 无失败项边界
 *   - getFailures 返回失败列表
 *   - getRecentTasks 返回映射后的任务
 *
 * 所有外部依赖 (PrismaService, ConfigService, GithubRepoService, TranslateService) 被 Mock。
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TranslateTaskService } from '../../src/translate/services/translate-task.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '../../src/config/config.service';
import { GithubRepoService } from '../../src/github/services/github-repo.service';
import { TranslateService } from '../../src/translate/services/translate.service';

// ==================== Mock 工厂 ====================

function makeTask(overrides?: Record<string, any>) {
    return {
        id: BigInt(1),
        status: 'PENDING',
        totalItems: 10,
        completedItems: 0,
        failedItems: 0,
        descTotal: 5,
        descCompleted: 0,
        descFailed: 0,
        readmeTotal: 5,
        readmeCompleted: 0,
        readmeFailed: 0,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        finishedAt: null,
        ...overrides,
    };
}

function makeTaskItem(overrides?: Record<string, any>) {
    return {
        id: BigInt(1),
        taskId: BigInt(1),
        repoId: BigInt(100),
        fullName: 'owner/repo',
        translateType: 'readme',
        status: 'PENDING',
        retryCount: 0,
        errorMessage: null,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        ...overrides,
    };
}

function createMockPrisma() {
    return {
        translationTask: {
            create: jest.fn().mockResolvedValue(makeTask()),
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
            delete: jest.fn().mockResolvedValue({}),
        },
        translationTaskItem: {
            create: jest.fn().mockResolvedValue({}),
            createMany: jest.fn().mockResolvedValue({}),
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({}),
            deleteMany: jest.fn().mockResolvedValue({}),
        },
        githubRepo: {
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
        },
        $transaction: jest.fn().mockResolvedValue([]),
    };
}

function createMockConfig(overrides?: Record<string, string | undefined>) {
    const map = new Map(Object.entries(overrides || {}));
    return {
        getValue: jest.fn((key: string) => map.get(key)),
        getValueDefault: jest.fn((key: string, def: string) => map.get(key) ?? def),
    };
}

function createMockGithubRepo(findByIdReturn: any = null) {
    return {
        findById: jest.fn().mockResolvedValue(findByIdReturn),
        findPage: jest.fn().mockResolvedValue({ records: [], total: 0 }),
    } as any;
}

function createMockTranslate() {
    return {
        translateDescription: jest.fn().mockResolvedValue(null),
        translateReadme: jest.fn().mockResolvedValue(null),
    } as any;
}

// ==================== 测试套件 ====================

describe('TranslateTaskService', () => {
    let service: TranslateTaskService;
    let mockPrisma: ReturnType<typeof createMockPrisma>;
    let mockConfig: ReturnType<typeof createMockConfig>;
    let mockGithubRepo: ReturnType<typeof createMockGithubRepo>;
    let mockTranslate: ReturnType<typeof createMockTranslate>;

    beforeEach(async () => {
        mockPrisma = createMockPrisma();
        mockConfig = createMockConfig({
            'deepseek.api_key': 'sk-test-key',
            'deepseek.api_url': 'https://api.deepseek.com/v1/chat/completions',
            'deepseek.model': 'deepseek-chat',
        });
        mockGithubRepo = createMockGithubRepo();
        mockTranslate = createMockTranslate();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TranslateTaskService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ConfigService, useValue: mockConfig },
                { provide: GithubRepoService, useValue: mockGithubRepo },
                { provide: TranslateService, useValue: mockTranslate },
            ],
        }).compile();
        service = module.get<TranslateTaskService>(TranslateTaskService);
    });

    // ==================== 信号量并发控制 ====================

    describe('信号量并发控制 (acquire/release)', () => {
        it('acquire 10 次均立即 resolve，第 11 次等待，release 后第 11 次 resolve', async () => {
            const srv = service as any;

            // 并发获取 10 个槽位
            const first10: Promise<void>[] = [];
            for (let i = 0; i < 10; i++) {
                first10.push(srv.acquire());
            }
            await Promise.all(first10);

            // 第 11 次应该等待（挂入队列不 resolve）
            let resolved11 = false;
            const p11 = srv.acquire().then(() => {
                resolved11 = true;
            });

            // 让微任务队列执行
            await new Promise((r) => setTimeout(r, 0));
            expect(resolved11).toBe(false);

            // release 一次 → 第 11 个 resolve
            srv.release();
            await p11;
            expect(resolved11).toBe(true);
        });

        it('多个等待者按 FIFO 顺序被唤醒', async () => {
            const srv = service as any;

            // 先占满 10 个槽
            for (let i = 0; i < 10; i++) {
                await srv.acquire();
            }

            // 再排队 3 个
            const order: number[] = [];
            const p1 = srv.acquire().then(() => order.push(1));
            const p2 = srv.acquire().then(() => order.push(2));
            const p3 = srv.acquire().then(() => order.push(3));

            await new Promise((r) => setTimeout(r, 0));
            expect(order).toEqual([]);

            srv.release();
            await p1;
            expect(order).toEqual([1]);

            srv.release();
            await p2;
            expect(order).toEqual([1, 2]);

            srv.release();
            await p3;
            expect(order).toEqual([1, 2, 3]);
        });
    });

    // ==================== isApiKeyConfigured ====================

    describe('isApiKeyConfigured', () => {
        it('API Key 已配置时返回 true', () => {
            mockConfig.getValue.mockReturnValue('sk-test-key');
            expect(service.isApiKeyConfigured()).toBe(true);
        });

        it('API Key 为空字符串时返回 false', () => {
            mockConfig.getValue.mockReturnValue('');
            expect(service.isApiKeyConfigured()).toBe(false);
        });

        it('API Key 未配置 (undefined) 时返回 false', () => {
            mockConfig.getValue.mockReturnValue(undefined);
            expect(service.isApiKeyConfigured()).toBe(false);
        });

        it('API Key 为 null 时返回 false', () => {
            (mockConfig.getValue as jest.Mock).mockReturnValue(null);
            expect(service.isApiKeyConfigured()).toBe(false);
        });
    });

    // ==================== getTaskProgress ====================

    describe('getTaskProgress', () => {
        it('任务不存在时返回 success:false', async () => {
            mockPrisma.translationTask.findUnique.mockResolvedValue(null);
            const result = await service.getTaskProgress(999);
            expect(result).toEqual({ success: false, message: '任务不存在' });
        });

        it('总数为 0 时进度为 0%', async () => {
            mockPrisma.translationTask.findUnique.mockResolvedValue(makeTask({ totalItems: 0, completedItems: 0, failedItems: 0 }));
            const result = await service.getTaskProgress(1);
            expect(result.progress).toBe(0);
            expect(result.totalItems).toBe(0);
            expect(result.pendingItems).toBe(0);
        });

        it('完成一半时进度 50%', async () => {
            mockPrisma.translationTask.findUnique.mockResolvedValue(makeTask({ totalItems: 10, completedItems: 5, failedItems: 0 }));
            const result = await service.getTaskProgress(1);
            expect(result.progress).toBe(50);
            expect(result.pendingItems).toBe(5);
        });

        it('全部完成时进度 100%', async () => {
            mockPrisma.translationTask.findUnique.mockResolvedValue(
                makeTask({ totalItems: 10, completedItems: 10, failedItems: 0, status: 'COMPLETED' }),
            );
            const result = await service.getTaskProgress(1);
            expect(result.progress).toBe(100);
            expect(result.pendingItems).toBe(0);
        });

        it('部分失败也计入进度 (completedItems + failedItems)', async () => {
            mockPrisma.translationTask.findUnique.mockResolvedValue(makeTask({ totalItems: 10, completedItems: 4, failedItems: 3 }));
            const result = await service.getTaskProgress(1);
            // (4 + 3) * 100 / 10 = 70
            expect(result.progress).toBe(70);
            expect(result.pendingItems).toBe(3);
        });

        it('返回描述和README 分类统计', async () => {
            mockPrisma.translationTask.findUnique.mockResolvedValue(
                makeTask({
                    totalItems: 8,
                    completedItems: 3,
                    failedItems: 1,
                    descTotal: 4,
                    descCompleted: 2,
                    descFailed: 0,
                    readmeTotal: 4,
                    readmeCompleted: 1,
                    readmeFailed: 1,
                    createdAt: new Date('2025-06-01T10:00:00Z'),
                    finishedAt: new Date('2025-06-01T10:30:00Z'),
                }),
            );
            const result = await service.getTaskProgress(1);
            expect(result.success).toBe(true);
            expect(result.taskId).toBe(1);
            expect(result.status).toBe('PENDING');
            expect(result.descTotal).toBe(4);
            expect(result.descCompleted).toBe(2);
            expect(result.descFailed).toBe(0);
            expect(result.readmeTotal).toBe(4);
            expect(result.readmeCompleted).toBe(1);
            expect(result.readmeFailed).toBe(1);
            expect(result.createdAt).toBe('2025-06-01T10:00:00.000Z');
            expect(result.finishedAt).toBe('2025-06-01T10:30:00.000Z');
            expect(result.progress).toBe(50); // (3+1)*100/8 = 50
        });
    });

    // ==================== finishTask ====================

    describe('finishTask', () => {
        it('failedItems=0 → COMPLETED', async () => {
            mockPrisma.translationTask.findUnique.mockResolvedValue(makeTask({ completedItems: 10, failedItems: 0 }));
            await (service as any).finishTask(BigInt(1));
            expect(mockPrisma.translationTask.update).toHaveBeenCalledWith({
                where: { id: BigInt(1) },
                data: expect.objectContaining({ status: 'COMPLETED', finishedAt: expect.any(Date) }),
            });
        });

        it('completedItems>0 且 failedItems>0 → PARTIAL', async () => {
            mockPrisma.translationTask.findUnique.mockResolvedValue(makeTask({ completedItems: 7, failedItems: 3 }));
            await (service as any).finishTask(BigInt(2));
            expect(mockPrisma.translationTask.update).toHaveBeenCalledWith({
                where: { id: BigInt(2) },
                data: expect.objectContaining({ status: 'PARTIAL', finishedAt: expect.any(Date) }),
            });
        });

        it('completedItems=0 且 failedItems>0 → FAILED', async () => {
            mockPrisma.translationTask.findUnique.mockResolvedValue(makeTask({ completedItems: 0, failedItems: 10 }));
            await (service as any).finishTask(BigInt(3));
            expect(mockPrisma.translationTask.update).toHaveBeenCalledWith({
                where: { id: BigInt(3) },
                data: expect.objectContaining({ status: 'FAILED', finishedAt: expect.any(Date) }),
            });
        });

        it('任务不存在时不执行更新', async () => {
            mockPrisma.translationTask.findUnique.mockResolvedValue(null);
            await (service as any).finishTask(BigInt(999));
            expect(mockPrisma.translationTask.update).not.toHaveBeenCalled();
        });
    });

    // ==================== cleanOld ====================

    describe('cleanOld', () => {
        it('keep 10 most recent, delete older ones', async () => {
            // 模拟返回 3 个需要清理的旧任务（skip:10 之后的结果）
            const oldTasks = [{ id: BigInt(101) }, { id: BigInt(102) }, { id: BigInt(103) }];
            mockPrisma.translationTask.findMany.mockResolvedValue(oldTasks);

            await (service as any).cleanOld();

            // 验证查询参数
            expect(mockPrisma.translationTask.findMany).toHaveBeenCalledWith({
                where: { status: { in: ['COMPLETED', 'FAILED', 'PARTIAL'] } },
                orderBy: { createdAt: 'desc' },
                skip: 10,
                take: 1000,
                select: { id: true },
            });

            // 每个旧任务的 items 被删除
            expect(mockPrisma.translationTaskItem.deleteMany).toHaveBeenCalledTimes(3);
            expect(mockPrisma.translationTaskItem.deleteMany).toHaveBeenCalledWith({ where: { taskId: BigInt(101) } });
            expect(mockPrisma.translationTaskItem.deleteMany).toHaveBeenCalledWith({ where: { taskId: BigInt(102) } });
            expect(mockPrisma.translationTaskItem.deleteMany).toHaveBeenCalledWith({ where: { taskId: BigInt(103) } });

            // 每个旧任务被删除
            expect(mockPrisma.translationTask.delete).toHaveBeenCalledTimes(3);
            expect(mockPrisma.translationTask.delete).toHaveBeenCalledWith({ where: { id: BigInt(101) } });
            expect(mockPrisma.translationTask.delete).toHaveBeenCalledWith({ where: { id: BigInt(102) } });
            expect(mockPrisma.translationTask.delete).toHaveBeenCalledWith({ where: { id: BigInt(103) } });
        });

        it('no old tasks to clean', async () => {
            mockPrisma.translationTask.findMany.mockResolvedValue([]);

            await (service as any).cleanOld();

            expect(mockPrisma.translationTaskItem.deleteMany).not.toHaveBeenCalled();
            expect(mockPrisma.translationTask.delete).not.toHaveBeenCalled();
        });
    });

    // ==================== createAndStartFullTranslate ====================

    describe('createAndStartFullTranslate', () => {
        it('没有需要翻译的仓库时返回 null', async () => {
            // 模拟 needDesc 和 needReadme 都为空
            mockPrisma.githubRepo.findMany
                .mockResolvedValueOnce([]) // needDesc
                .mockResolvedValueOnce([]); // needReadme

            const result = await service.createAndStartFullTranslate();
            expect(result).toBeNull();
            expect(mockPrisma.translationTask.create).not.toHaveBeenCalled();
        });

        it('仅有需要翻译的描述仓库时创建任务并返回 taskId', async () => {
            mockPrisma.translationTask.create.mockResolvedValue(makeTask({ id: BigInt(42), totalItems: 2, descTotal: 2 }));
            mockPrisma.githubRepo.findMany
                .mockResolvedValueOnce([
                    { id: BigInt(1), fullName: 'a/b' },
                    { id: BigInt(2), fullName: 'c/d' },
                ]) // needDesc
                .mockResolvedValueOnce([]); // needReadme

            // 需要让 startTaskAsync 不真正执行，mock 掉它的副作用
            const startSpy = jest.spyOn(service as any, 'startTaskAsync').mockImplementation(() => {});

            const result = await service.createAndStartFullTranslate();
            expect(result).toBe(42);

            expect(mockPrisma.translationTask.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    status: 'PENDING',
                    totalItems: 2,
                    descTotal: 2,
                    readmeTotal: 0,
                }),
            });
            expect(mockPrisma.translationTaskItem.createMany).toHaveBeenCalled();
            expect(startSpy).toHaveBeenCalled();

            startSpy.mockRestore();
        });
    });

    // ==================== retryFailed ====================

    describe('retryFailed', () => {
        it('没有 FAILED 状态的任务项时返回 null', async () => {
            mockPrisma.translationTaskItem.findMany.mockResolvedValue([]);

            const result = await service.retryFailed(1);
            expect(result).toBeNull();
            expect(mockPrisma.translationTask.create).not.toHaveBeenCalled();
        });

        it('有 FAILED 项目时创建新任务并返回 taskId', async () => {
            const failedItems = [
                makeTaskItem({ id: BigInt(1), taskId: BigInt(10), status: 'FAILED', translateType: 'readme' }),
                makeTaskItem({ id: BigInt(2), taskId: BigInt(10), status: 'FAILED', translateType: 'description' }),
            ];
            mockPrisma.translationTaskItem.findMany.mockResolvedValue(failedItems);
            mockPrisma.translationTask.create.mockResolvedValue(makeTask({ id: BigInt(55) }));

            const startSpy = jest.spyOn(service as any, 'startTaskAsync').mockImplementation(() => {});

            const result = await service.retryFailed(10);
            expect(result).toBe(55);

            expect(mockPrisma.translationTask.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    status: 'PENDING',
                    totalItems: 2,
                    descTotal: 1,
                    readmeTotal: 1,
                }),
            });
            expect(mockPrisma.translationTaskItem.createMany).toHaveBeenCalled();
            expect(startSpy).toHaveBeenCalled();

            startSpy.mockRestore();
        });
    });

    // ==================== getFailures ====================

    describe('getFailures', () => {
        it('返回 FAILED 任务项列表及计数', async () => {
            const failures = [
                makeTaskItem({ id: BigInt(1), status: 'FAILED', fullName: 'a/b', errorMessage: 'timeout' }),
                makeTaskItem({ id: BigInt(2), status: 'FAILED', fullName: 'c/d', errorMessage: 'rate limit' }),
            ];
            mockPrisma.translationTaskItem.findMany.mockResolvedValue(failures);

            const result = await service.getFailures(1);
            expect(result.success).toBe(true);
            expect(result.count).toBe(2);
            expect(result.failures).toHaveLength(2);
            expect(result.failures[0].errorMessage).toBe('timeout');
            expect(result.failures[1].errorMessage).toBe('rate limit');
        });

        it('无失败项时返回空列表', async () => {
            mockPrisma.translationTaskItem.findMany.mockResolvedValue([]);

            const result = await service.getFailures(1);
            expect(result.success).toBe(true);
            expect(result.count).toBe(0);
            expect(result.failures).toEqual([]);
        });
    });

    // ==================== getRecentTasks ====================

    describe('getRecentTasks', () => {
        it('返回最近 20 个任务（已映射字段）', async () => {
            const tasks = [
                makeTask({
                    id: BigInt(1),
                    status: 'COMPLETED',
                    totalItems: 10,
                    completedItems: 10,
                    failedItems: 0,
                    createdAt: new Date('2025-06-01T10:00:00Z'),
                    finishedAt: new Date('2025-06-01T10:05:00Z'),
                }),
                makeTask({
                    id: BigInt(2),
                    status: 'PARTIAL',
                    totalItems: 5,
                    completedItems: 3,
                    failedItems: 2,
                    createdAt: new Date('2025-06-01T11:00:00Z'),
                    finishedAt: new Date('2025-06-01T11:10:00Z'),
                }),
            ];
            mockPrisma.translationTask.findMany.mockResolvedValue(tasks);

            const result = await service.getRecentTasks();
            expect(result.success).toBe(true);
            expect(result.tasks).toHaveLength(2);

            expect(result.tasks[0]).toEqual({
                taskId: 1,
                status: 'COMPLETED',
                totalItems: 10,
                completedItems: 10,
                failedItems: 0,
                createdAt: '2025-06-01T10:00:00.000Z',
                finishedAt: '2025-06-01T10:05:00.000Z',
            });
            expect(result.tasks[1]).toEqual({
                taskId: 2,
                status: 'PARTIAL',
                totalItems: 5,
                completedItems: 3,
                failedItems: 2,
                createdAt: '2025-06-01T11:00:00.000Z',
                finishedAt: '2025-06-01T11:10:00.000Z',
            });

            expect(mockPrisma.translationTask.findMany).toHaveBeenCalledWith({
                orderBy: { createdAt: 'desc' },
                take: 20,
            });
        });

        it('无任务时返回空列表', async () => {
            mockPrisma.translationTask.findMany.mockResolvedValue([]);

            const result = await service.getRecentTasks();
            expect(result.success).toBe(true);
            expect(result.tasks).toEqual([]);
        });
    });
});
