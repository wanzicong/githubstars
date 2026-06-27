/**
 * Sync/Config/Author 模块集成测试
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TestTransaction, createTestingApp } from '../helpers/test-transaction';
import { insertRepo } from '../helpers/fixtures';

describe('sync+config+author (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let tx: TestTransaction;

    beforeAll(async () => {
        const ctx = await createTestingApp();
        app = ctx.app;
        prisma = ctx.prisma;
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

    describe('POST /api/sync/status', () => {
        it('应返回同步状态', async () => {
            const res = await request(app.getHttpServer()).post('/api/sync/status').send({}).expect(201);
            const body = res.body.data ?? res.body;
            expect(body).toHaveProperty('syncing');
            expect(body).toHaveProperty('status');
        });
    });

    describe('POST /api/sync/logs', () => {
        it('应返回分页的同步日志', async () => {
            await prisma.syncLog.create({
                data: {
                    syncType: '手动同步',
                    status: '成功',
                    totalCount: 10,
                    syncedCount: 10,
                    startedAt: new Date(),
                    finishedAt: new Date(),
                    createdAt: new Date(),
                },
            });
            const res = await request(app.getHttpServer()).post('/api/sync/logs').send({ pageNum: 1, pageSize: 10 }).expect(201);
            const body = res.body;
            expect(body.data).toBeInstanceOf(Array);
            expect(body.meta).toBeDefined();
        });
    });

    describe('POST /api/config/list', () => {
        it('应返回所有配置项', async () => {
            const res = await request(app.getHttpServer()).post('/api/config/list').send({}).expect(201);
            const body = res.body.data ?? res.body;
            expect(body).toBeInstanceOf(Array);
            expect(body.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('POST /api/config', () => {
        it('应更新配置项', async () => {
            const res = await request(app.getHttpServer()).post('/api/config').send({ 'github.username': 'testuser' }).expect(201);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /api/authors/list', () => {
        it('应返回分页的作者列表', async () => {
            await insertRepo(prisma, { ownerName: 'alice', fullName: 'alice/repo1', starsCount: 100 });
            await insertRepo(prisma, { ownerName: 'bob', fullName: 'bob/repo1', starsCount: 50 });

            const res = await request(app.getHttpServer()).post('/api/authors/list').send({ page: 1, size: 10, keyword: '' }).expect(201);
            const body = res.body;
            expect(body.data).toBeInstanceOf(Array);
            expect(body.meta.total).toBeGreaterThanOrEqual(1);
        });

        it('应支持关键字搜索', async () => {
            await insertRepo(prisma, { ownerName: 'alice', fullName: 'alice/repo1', starsCount: 100 });
            await insertRepo(prisma, { ownerName: 'bob', fullName: 'bob/repo1', starsCount: 50 });

            const res = await request(app.getHttpServer())
                .post('/api/authors/list')
                .send({ page: 1, size: 10, keyword: 'alice' })
                .expect(201);
            const body = res.body;
            expect(body.data.length).toBe(1);
            expect(body.data[0].ownerName).toBe('alice');
        });
    });

    describe('POST /api/authors/repos', () => {
        it('应返回指定作者的仓库列表', async () => {
            await insertRepo(prisma, { ownerName: 'alice', fullName: 'alice/repo1', starsCount: 100 });
            await insertRepo(prisma, { ownerName: 'alice', fullName: 'alice/repo2', starsCount: 200 });

            const res = await request(app.getHttpServer())
                .post('/api/authors/repos')
                .send({ ownerName: 'alice', page: 1, size: 10, sortBy: 'stars_count', sortOrder: 'desc' })
                .expect(201);
            const body = res.body;
            expect(body.data).toBeInstanceOf(Array);
            expect(body.meta.total).toBe(2);
        });
    });
});
