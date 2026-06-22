/**
 * Agent 模块集成测试
 *
 * 测试范围: 会话 CRUD、工具列表、底座状态
 * 注意: Agent Controller 使用 GET/POST 混合，ResponseInterceptor 统一包装响应
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TestTransaction, createTestingApp } from '../helpers/test-transaction';

describe('agent (e2e)', () => {
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

    // ==================== POST /api/agent/sessions ====================
    describe('POST /api/agent/sessions', () => {
        it('应创建新会话', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/agent/sessions')
                .send({ title: '测试会话' })
                .expect(201);

            const sid = res.body.data?.sessionId ?? res.body.sessionId;
            expect(sid).toBeDefined();
            expect(res.body.data?.createdAt ?? res.body.createdAt).toBeDefined();
        });

        it('不传标题时应使用默认值', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/agent/sessions')
                .send({})
                .expect(201);

            expect(res.body.data?.sessionId ?? res.body.sessionId).toBeDefined();
        });
    });

    // ==================== GET /api/agent/sessions ====================
    describe('GET /api/agent/sessions', () => {
        it('应返回会话列表', async () => {
            await request(app.getHttpServer()).post('/api/agent/sessions').send({ title: 'S1' });
            await request(app.getHttpServer()).post('/api/agent/sessions').send({ title: 'S2' });

            const res = await request(app.getHttpServer())
                .get('/api/agent/sessions')
                .expect(200);

            expect(res.body.data.sessions).toBeInstanceOf(Array);
            expect(res.body.data.sessions.length).toBeGreaterThanOrEqual(2);
        });

        it('空列表时应返回空数组', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/agent/sessions')
                .expect(200);

            expect(res.body.data.sessions).toBeInstanceOf(Array);
        });
    });

    // ==================== GET /api/agent/sessions/:id ====================
    describe('GET /api/agent/sessions/:id', () => {
        it('应返回会话详情', async () => {
            const createRes = await request(app.getHttpServer())
                .post('/api/agent/sessions')
                .send({ title: '详情测试' });

            const sid = createRes.body.data?.sessionId ?? createRes.body.sessionId;
            const res = await request(app.getHttpServer())
                .get(`/api/agent/sessions/${sid}`)
                .expect(200);

            expect(res.body.data.session.title).toBe('详情测试');
            expect(res.body.data.messages).toBeInstanceOf(Array);
        });

        it('不存在的会话应返回 404', async () => {
            await request(app.getHttpServer())
                .get('/api/agent/sessions/99999')
                .expect(404);
        });
    });

    // ==================== DELETE /api/agent/sessions/:id ====================
    describe('DELETE /api/agent/sessions/:id', () => {
        it('应归档会话', async () => {
            const createRes = await request(app.getHttpServer())
                .post('/api/agent/sessions')
                .send({ title: '待归档' });

            const archiveSid = createRes.body.data?.sessionId ?? createRes.body.sessionId;
            const res = await request(app.getHttpServer())
                .delete(`/api/agent/sessions/${archiveSid}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });
    });

    // ==================== GET /api/agent/tools ====================
    describe('GET /api/agent/tools', () => {
        it('应返回工具列表', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/agent/tools')
                .expect(200);

            expect(res.body.data).toHaveProperty('tools');
            expect(res.body.data).toHaveProperty('total');
            expect(Array.isArray(res.body.data.tools)).toBe(true);
        });
    });

    // ==================== GET /api/agent/status ====================
    describe('GET /api/agent/status', () => {
        it('应返回底座运行状态', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/agent/status')
                .expect(200);

            expect(res.body.data).toHaveProperty('service');
            expect(res.body.data).toHaveProperty('status');
            expect(res.body.data).toHaveProperty('sseConnections');
        });
    });

    // ==================== GET /api/agent/tasks ====================
    describe('GET /api/agent/tasks', () => {
        it('应返回任务列表', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/agent/tasks')
                .expect(200);

            expect(res.body.data).toHaveProperty('tasks');
            expect(Array.isArray(res.body.data.tasks)).toBe(true);
        });
    });

    // ==================== GET /api/agent/breakers ====================
    describe('GET /api/agent/breakers', () => {
        it('应返回熔断器状态', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/agent/breakers')
                .expect(200);

            expect(res.body.data).toHaveProperty('breakers');
        });
    });
});
