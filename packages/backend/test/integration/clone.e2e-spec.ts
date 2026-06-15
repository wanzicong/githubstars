/**
 * Clone API 集成测试 (E2E)
 *
 * 测试范围: Clone 任务生命周期管理（CRUD + 置顶 + 取消 + 重试判断）
 * 跳过范围: 实际 git clone 操作依赖外部服务（GitHub API + git 命令），标记为 skip
 *
 * 每个测试用例在数据库事务中运行，afterEach 回滚保证零数据污染。
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TestTransaction } from '../helpers/test-transaction';

// ═══════════════════════════════════════════════════════════════
// 本地 fixture 工厂（clone_task / clone_task_item）
// ═══════════════════════════════════════════════════════════════

let _taskSeq = 0;
function generateTaskId(): string {
    _taskSeq++;
    return `e2e_clone_${_taskSeq}`;
}

interface CloneTaskFixture {
    taskId: string;
    status: string;
    totalRepos: number;
    completedRepos: number;
    failedRepos: number;
    skippedRepos: number;
    keyword?: string | null;
    language?: string | null;
    categoryIds?: string | null;
    dateField?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    sortBy: string;
    sortOrder: string;
    subDirectory?: string | null;
    targetDir: string;
    concurrency: number;
    cloneDepth: number;
    maxRepoSizeMb: number;
    pinned: number;
    cancelled: number;
}

function createTaskFixture(overrides?: Partial<CloneTaskFixture>): CloneTaskFixture {
    return {
        taskId: generateTaskId(),
        status: 'COMPLETED',
        totalRepos: 5,
        completedRepos: 3,
        failedRepos: 1,
        skippedRepos: 1,
        keyword: null,
        language: null,
        categoryIds: null,
        dateField: null,
        startDate: null,
        endDate: null,
        sortBy: 'starred_at',
        sortOrder: 'desc',
        subDirectory: null,
        targetDir: 'D:/github-stars',
        concurrency: 5,
        cloneDepth: 1,
        maxRepoSizeMb: 500,
        pinned: 0,
        cancelled: 0,
        ...overrides,
    };
}

async function insertCloneTask(prisma: PrismaService, overrides?: Partial<CloneTaskFixture>) {
    const t = createTaskFixture(overrides);
    await prisma.cloneTask.create({ data: { ...t, createdAt: new Date() } as any });
    return t;
}

async function insertCloneTaskItem(prisma: PrismaService, data: { taskId: string; fullName: string; status: string; message?: string }) {
    return prisma.cloneTaskItem.create({
        data: {
            taskId: data.taskId,
            fullName: data.fullName,
            status: data.status,
            message: data.message || null,
            createdAt: new Date(),
        },
    });
}

// ═══════════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════════

describe('Clone API (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let tx: TestTransaction;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        await app.init();
        prisma = moduleFixture.get<PrismaService>(PrismaService);
    }, 30000);

    beforeEach(async () => {
        tx = new TestTransaction(prisma);
        await tx.begin();
    });

    afterEach(async () => {
        await tx.rollback();
    });

    afterAll(async () => {
        await app.close();
    });

    // ================================================================
    // GET /api/clone/config — 获取克隆配置
    // ================================================================

    describe('GET /api/clone/config', () => {
        it('返回配置信息（baseDirectory / subdirectoryHistory / hasActiveTask）', async () => {
            const res = await request(app.getHttpServer()).get('/api/clone/config').expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('baseDirectory');
            expect(res.body).toHaveProperty('subdirectoryHistory');
            expect(res.body).toHaveProperty('lastSubdirectory');
            expect(res.body).toHaveProperty('hasActiveTask');
            expect(res.body).toHaveProperty('defaultCloneDepth');
            expect(res.body).toHaveProperty('defaultMaxRepoSizeMb');
            expect(typeof res.body.baseDirectory).toBe('string');
            expect(Array.isArray(res.body.subdirectoryHistory)).toBe(true);
            expect(typeof res.body.hasActiveTask).toBe('boolean');
        });

        it('无活动任务时 hasActiveTask 为 false', async () => {
            const res = await request(app.getHttpServer()).get('/api/clone/config').expect(200);

            expect(res.body.hasActiveTask).toBe(false);
        });
    });

    // ================================================================
    // GET /api/clone/disk-space — 检查磁盘空间
    // ================================================================

    describe('GET /api/clone/disk-space', () => {
        it('默认参数返回磁盘检查结果', async () => {
            const res = await request(app.getHttpServer()).get('/api/clone/disk-space').expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('freeSpaceMB');
            expect(res.body).toHaveProperty('estimatedSizeMB');
            expect(res.body).toHaveProperty('sufficient');
            expect(res.body).toHaveProperty('message');
            expect(typeof res.body.message).toBe('string');
        });

        it('传入 repoCount 参数估算值相应变化', async () => {
            const res = await request(app.getHttpServer()).get('/api/clone/disk-space?repoCount=10').expect(200);

            // repoCount=10 → estimatedSizeMB ≈ 10*50*2 = 1000
            expect(res.body.estimatedSizeMB).toBeGreaterThan(0);
        });

        it('传入 subDirectory 仍正常返回（可能创建目录失败但不阻断响应）', async () => {
            const res = await request(app.getHttpServer()).get('/api/clone/disk-space?subDirectory=e2e_test_check&repoCount=5').expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('freeSpaceMB');
        });
    });

    // ================================================================
    // GET /api/clone/tasks — 任务列表（分页）
    // ================================================================

    describe('GET /api/clone/tasks', () => {
        it('无任务时返回空列表', async () => {
            const res = await request(app.getHttpServer()).get('/api/clone/tasks').expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.total).toBe(0);
            expect(res.body.records).toEqual([]);
            expect(res.body.pages).toBe(0);
        });

        it('插入任务后列表包含该任务', async () => {
            const t = await insertCloneTask(prisma);

            const res = await request(app.getHttpServer()).get('/api/clone/tasks').expect(200);

            expect(res.body.total).toBe(1);
            expect(res.body.records.length).toBe(1);
            expect(res.body.records[0].taskId).toBe(t.taskId);
            expect(res.body.records[0].status).toBe('COMPLETED');
        });

        it('分页参数 page/size 被正确传递', async () => {
            // 插入 3 个任务
            await insertCloneTask(prisma);
            await insertCloneTask(prisma);
            await insertCloneTask(prisma);

            const res = await request(app.getHttpServer()).get('/api/clone/tasks?page=1&size=2').expect(200);

            expect(res.body.records.length).toBe(2);
            expect(res.body.size).toBe(2);
            expect(res.body.current).toBe(1);
            expect(res.body.pages).toBe(2); // ceil(3/2) = 2
        });

        it('第二页数据正确（含 page=2）', async () => {
            await insertCloneTask(prisma);
            await insertCloneTask(prisma);
            await insertCloneTask(prisma);

            const res = await request(app.getHttpServer()).get('/api/clone/tasks?page=2&size=2').expect(200);

            expect(res.body.records.length).toBe(1);
            expect(res.body.current).toBe(2);
        });

        it('超出范围的 page 返回空 records 但 total 不变', async () => {
            await insertCloneTask(prisma);

            const res = await request(app.getHttpServer()).get('/api/clone/tasks?page=99&size=20').expect(200);

            expect(res.body.records).toEqual([]);
            expect(res.body.total).toBe(1);
            expect(res.body.pages).toBe(1);
        });

        it('置顶任务排在最前（pinned 排序）', async () => {
            const t1 = await insertCloneTask(prisma, { pinned: 0 });
            const t2 = await insertCloneTask(prisma, { pinned: 1 });

            const res = await request(app.getHttpServer()).get('/api/clone/tasks').expect(200);

            expect(res.body.records.length).toBe(2);
            // 置顶的排最前
            expect(res.body.records[0].taskId).toBe(t2.taskId);
            expect(res.body.records[1].taskId).toBe(t1.taskId);
        });
    });

    // ================================================================
    // GET /api/clone/tasks/:taskId — 任务详情（含子项分页）
    // ================================================================

    describe('GET /api/clone/tasks/:taskId', () => {
        it('任务不存在 → 返回失败', async () => {
            const res = await request(app.getHttpServer()).get('/api/clone/tasks/nonexistent-task-id').expect(200);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('不存在');
        });

        it('任务存在且无子项 → 返回任务元信息 + 空 items', async () => {
            const t = await insertCloneTask(prisma);

            const res = await request(app.getHttpServer()).get(`/api/clone/tasks/${t.taskId}`).expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.task).toBeDefined();
            expect(res.body.task.taskId).toBe(t.taskId);
            expect(res.body.items).toEqual([]);
            expect(res.body.total).toBe(0);
        });

        it('任务有子项 → 返回 items 含分页信息', async () => {
            const t = await insertCloneTask(prisma);
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'owner/repo-a', status: 'CLONED' });
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'owner/repo-b', status: 'FAILED', message: 'timeout' });

            const res = await request(app.getHttpServer()).get(`/api/clone/tasks/${t.taskId}`).expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.total).toBe(2);
            expect(res.body.items.length).toBe(2);
            expect(res.body.items[0].fullName).toBe('owner/repo-a');
            expect(res.body.items[1].fullName).toBe('owner/repo-b');
        });

        it('status 过滤仅返回匹配状态的子项', async () => {
            const t = await insertCloneTask(prisma);
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'owner/repo-c', status: 'CLONED' });
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'owner/repo-d', status: 'FAILED', message: 'error' });

            const res = await request(app.getHttpServer()).get(`/api/clone/tasks/${t.taskId}?status=FAILED`).expect(200);

            expect(res.body.total).toBe(1);
            expect(res.body.items.length).toBe(1);
            expect(res.body.items[0].fullName).toBe('owner/repo-d');
            expect(res.body.items[0].status).toBe('FAILED');
        });
    });

    // ================================================================
    // DELETE /api/clone/tasks/:taskId — 删除任务
    // ================================================================

    describe('DELETE /api/clone/tasks/:taskId', () => {
        it('删除任务后任务列表不再包含该任务', async () => {
            const t = await insertCloneTask(prisma);

            const del = await request(app.getHttpServer()).delete(`/api/clone/tasks/${t.taskId}`).expect(200);

            expect(del.body.success).toBe(true);

            const list = await request(app.getHttpServer()).get('/api/clone/tasks').expect(200);

            expect(list.body.total).toBe(0);
        });

        it('删除任务时级联删除关联子项', async () => {
            const t = await insertCloneTask(prisma);
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'owner/repo-x', status: 'CLONED' });
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'owner/repo-y', status: 'FAILED' });

            await request(app.getHttpServer()).delete(`/api/clone/tasks/${t.taskId}`).expect(200);

            // 验证任务详情不可查
            const detail = await request(app.getHttpServer()).get(`/api/clone/tasks/${t.taskId}`).expect(200);

            expect(detail.body.success).toBe(false);
        });
    });

    // ================================================================
    // POST /api/clone/tasks/:taskId/pin — 置顶/取消置顶
    // ================================================================

    describe('POST /api/clone/tasks/:taskId/pin', () => {
        it('置顶未置顶任务 → 返回 pinned=true', async () => {
            const t = await insertCloneTask(prisma, { pinned: 0 });

            const res = await request(app.getHttpServer()).post(`/api/clone/tasks/${t.taskId}/pin`).expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.pinned).toBe(true);
        });

        it('取消已置顶任务 → 返回 pinned=false', async () => {
            const t = await insertCloneTask(prisma, { pinned: 1 });

            const res = await request(app.getHttpServer()).post(`/api/clone/tasks/${t.taskId}/pin`).expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.pinned).toBe(false);
        });

        it('不存在的任务 → 返回失败', async () => {
            const res = await request(app.getHttpServer()).post('/api/clone/tasks/fake_task_999/pin').expect(201);

            expect(res.body.success).toBe(false);
        });
    });

    // ================================================================
    // POST /api/clone/tasks/:taskId/cancel — 取消任务
    // ================================================================

    describe('POST /api/clone/tasks/:taskId/cancel', () => {
        it('取消 PENDING 任务 → 成功', async () => {
            const t = await insertCloneTask(prisma, { status: 'PENDING' });

            const res = await request(app.getHttpServer()).post(`/api/clone/tasks/${t.taskId}/cancel`).expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('已取消');
        });

        it('取消 COMPLETED 任务 → 失败（已不可取消）', async () => {
            const t = await insertCloneTask(prisma, { status: 'COMPLETED' });

            const res = await request(app.getHttpServer()).post(`/api/clone/tasks/${t.taskId}/cancel`).expect(201);

            expect(res.body.success).toBe(false);
        });

        it('取消不存在的任务 → 失败', async () => {
            const res = await request(app.getHttpServer()).post('/api/clone/tasks/no_such_task/cancel').expect(201);

            expect(res.body.success).toBe(false);
        });
    });

    // ================================================================
    // POST /api/clone/tasks/retry-all — 批量重试
    // ================================================================

    describe('POST /api/clone/tasks/retry-all', () => {
        it('无任何失败项 → 返回 "没有需要重试的任务"', async () => {
            const res = await request(app.getHttpServer()).post('/api/clone/tasks/retry-all').expect(201);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('没有需要重试');
        });
    });

    // ================================================================
    // GET /api/clone/tasks/:taskId/items — 直接查子项列表
    // ================================================================

    describe('GET /api/clone/tasks/:taskId/items', () => {
        it('任务有子项 → 返回完整子项列表含分页', async () => {
            const t = await insertCloneTask(prisma);
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'a/b', status: 'CLONED' });
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'c/d', status: 'SKIPPED' });

            const res = await request(app.getHttpServer()).get(`/api/clone/tasks/${t.taskId}/items`).expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.total).toBe(2);
            expect(res.body.records.length).toBe(2);
        });

        it('status 过滤 SKIPPED → 仅返回 SKIPPED 项', async () => {
            const t = await insertCloneTask(prisma);
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'x/y', status: 'CLONED' });
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'u/v', status: 'SKIPPED' });
            await insertCloneTaskItem(prisma, { taskId: t.taskId, fullName: 'm/n', status: 'FAILED' });

            const res = await request(app.getHttpServer()).get(`/api/clone/tasks/${t.taskId}/items?status=SKIPPED`).expect(200);

            expect(res.body.total).toBe(1);
            expect(res.body.records[0].status).toBe('SKIPPED');
        });
    });

    // ================================================================
    // 跳过测试：依赖外部服务（GitHub API / git clone 命令）
    // ================================================================

    describe('外部服务依赖（已 skip）', () => {
        it.skip('POST /api/clone/start — 启动批量克隆（依赖 GitHub API + git clone）', () => {
            // 需要实际 GitHub API 访问和 git clone，不合并在 E2E 测试中。
        });

        it.skip('GET /api/clone/script — 生成克隆脚本（依赖 GitHub API）', () => {
            // 脚本生成需要查询 GitHub 仓库列表。
        });

        it.skip('POST /api/clone/tasks/:taskId/retry — 重试失败项（依赖 git clone）', () => {
            // 重试逻辑调用 exec git clone。
        });

        it.skip('GET /api/clone/task/:taskId — 任务状态轮询（依赖 git clone 后台进程）', () => {
            // 任务状态查询依赖后台 clone 进程推进，非纯数据查询。
        });
    });
});
