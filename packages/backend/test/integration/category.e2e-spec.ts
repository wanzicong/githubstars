/**
 * Category 模块集成测试
 *
 * 测试范围: 分类树/列表/CURD/排序/仓库绑定解绑
 * 每个 afterEach 调用 cleanAll() 删除测试数据。
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TestTransaction, createTestingApp } from '../helpers/test-transaction';
import { insertRepo } from '../helpers/fixtures';

const now = () => new Date();

describe('category (e2e)', () => {
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

    // ==================== POST /api/category/tree ====================
    describe('POST /api/category/tree', () => {
        it('空分类时应返回空数组', async () => {
            const res = await request(app.getHttpServer()).post('/api/category/tree').send({}).expect(201);

            const body = res.body.data ?? res.body;
            expect(body).toEqual([]);
        });

        it('应返回两级树形结构并包含 repoCount', async () => {
            const c1 = await prisma.category.create({ data: { name: '后端', sortOrder: 0, createdAt: now() } });
            const c2 = await prisma.category.create({ data: { name: 'NestJS', parentId: c1.id, sortOrder: 0, createdAt: now() } });
            const repo1 = await insertRepo(prisma, { fullName: 'a/repo1' });
            const repo2 = await insertRepo(prisma, { fullName: 'a/repo2' });
            await prisma.categoryRepoLink.create({ data: { categoryId: c1.id, repoId: BigInt(repo1.id), createdAt: now() } });
            await prisma.categoryRepoLink.create({ data: { categoryId: c2.id, repoId: BigInt(repo2.id), createdAt: now() } });

            const res = await request(app.getHttpServer()).post('/api/category/tree').send({}).expect(201);

            const tree = res.body.data ?? res.body;
            expect(tree.length).toBeGreaterThanOrEqual(1);
            const parent = tree.find((n: any) => n.name === '后端');
            expect(parent).toBeDefined();
            expect(parent.repoCount).toBeGreaterThanOrEqual(1);
            expect(parent.children.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ==================== POST /api/category/list ====================
    describe('POST /api/category/list', () => {
        it('应返回分页的分类列表', async () => {
            await prisma.category.create({ data: { name: '前端', sortOrder: 0, createdAt: now() } });

            const res = await request(app.getHttpServer()).post('/api/category/list').send({ page: 1, size: 10 }).expect(201);

            const body = res.body;
            expect(body.data.length).toBeGreaterThanOrEqual(1);
            expect(body.meta.total).toBeGreaterThanOrEqual(1);
        });

        it('应支持关键字搜索', async () => {
            await prisma.category.create({ data: { name: '后端', sortOrder: 0, createdAt: now() } });
            await prisma.category.create({ data: { name: '前端', sortOrder: 0, createdAt: now() } });

            const res = await request(app.getHttpServer())
                .post('/api/category/list')
                .send({ page: 1, size: 10, keyword: '后端' })
                .expect(201);

            const body = res.body;
            expect(body.data.length).toBe(1);
            expect(body.data[0].name).toBe('后端');
        });
    });

    // ==================== POST /api/category/create ====================
    describe('POST /api/category/create', () => {
        it('应创建新分类', async () => {
            const res = await request(app.getHttpServer()).post('/api/category/create').send({ name: '新分类', sortOrder: 0 }).expect(201);

            const body = res.body.data ?? res.body;
            expect(body.name).toBe('新分类');
            expect(body.id).toBeDefined();
        });

        it('同名分类应返回冲突错误', async () => {
            await prisma.category.create({ data: { name: '重复', sortOrder: 0, createdAt: now() } });

            await request(app.getHttpServer()).post('/api/category/create').send({ name: '重复', sortOrder: 0 }).expect(409);
        });
    });

    // ==================== POST /api/category/update ====================
    describe('POST /api/category/update', () => {
        it('应更新分类名称', async () => {
            const cat = await prisma.category.create({ data: { name: '旧名', sortOrder: 0, createdAt: now() } });

            const res = await request(app.getHttpServer())
                .post('/api/category/update')
                .send({ id: Number(cat.id), name: '新名' })
                .expect(201);

            const body = res.body.data ?? res.body;
            expect(body.name).toBe('新名');
        });

        it('不存在的分类应返回 404', async () => {
            await request(app.getHttpServer()).post('/api/category/update').send({ id: 99999, name: 'x' }).expect(404);
        });
    });

    // ==================== POST /api/category/delete ====================
    describe('POST /api/category/delete', () => {
        it('应删除无子分类的分类', async () => {
            const cat = await prisma.category.create({ data: { name: '待删除', sortOrder: 0, createdAt: now() } });

            const res = await request(app.getHttpServer())
                .post('/api/category/delete')
                .send({ id: Number(cat.id) })
                .expect(201);

            const body = res.body.data ?? res.body;
            expect(body.success).toBe(true);
        });

        it('有子分类时应拒绝删除', async () => {
            const parent = await prisma.category.create({ data: { name: '父', sortOrder: 0, createdAt: now() } });
            await prisma.category.create({ data: { name: '子', parentId: parent.id, sortOrder: 0, createdAt: now() } });

            await request(app.getHttpServer())
                .post('/api/category/delete')
                .send({ id: Number(parent.id) })
                .expect(409);
        });
    });

    // ==================== POST /api/category/sort ====================
    describe('POST /api/category/sort', () => {
        it('应批量更新排序', async () => {
            const c1 = await prisma.category.create({ data: { name: 'A', sortOrder: 0, createdAt: now() } });
            const c2 = await prisma.category.create({ data: { name: 'B', sortOrder: 1, createdAt: now() } });

            const res = await request(app.getHttpServer())
                .post('/api/category/sort')
                .send({
                    items: [
                        { id: Number(c1.id), sortOrder: 1 },
                        { id: Number(c2.id), sortOrder: 0 },
                    ],
                })
                .expect(201);

            const body = res.body.data ?? res.body;
            expect(body.success).toBe(true);
        });
    });

    // ==================== POST /api/category/bind ====================
    describe('POST /api/category/bind', () => {
        it('应将仓库绑定到分类', async () => {
            const cat = await prisma.category.create({ data: { name: '测试分类', sortOrder: 0, createdAt: now() } });
            const repo = await insertRepo(prisma, { fullName: 'test/repo' });

            const res = await request(app.getHttpServer())
                .post('/api/category/bind')
                .send({ categoryId: Number(cat.id), repoIds: [repo.id] })
                .expect(201);

            const body = res.body.data ?? res.body;
            expect(body.success).toBe(true);
            expect(body.count).toBe(1);
        });
    });

    // ==================== POST /api/category/unbind ====================
    describe('POST /api/category/unbind', () => {
        it('应解绑仓库', async () => {
            const cat = await prisma.category.create({ data: { name: '测试分类', sortOrder: 0, createdAt: now() } });
            const repo = await insertRepo(prisma, { fullName: 'test/repo' });
            await prisma.categoryRepoLink.create({ data: { categoryId: cat.id, repoId: BigInt(repo.id), createdAt: now() } });

            const res = await request(app.getHttpServer())
                .post('/api/category/unbind')
                .send({ categoryId: Number(cat.id), repoIds: [repo.id] })
                .expect(201);

            const body = res.body.data ?? res.body;
            expect(body.success).toBe(true);
            expect(body.count).toBe(1);
        });
    });

    // ==================== POST /api/category/repos ====================
    describe('POST /api/category/repos', () => {
        it('应返回分类下的仓库列表', async () => {
            const cat = await prisma.category.create({ data: { name: '测试分类', sortOrder: 0, createdAt: now() } });
            const repo1 = await insertRepo(prisma, { fullName: 'a/repo1', starsCount: 100 });
            const repo2 = await insertRepo(prisma, { fullName: 'b/repo2', starsCount: 200 });
            await prisma.categoryRepoLink.create({ data: { categoryId: cat.id, repoId: BigInt(repo1.id), createdAt: now() } });
            await prisma.categoryRepoLink.create({ data: { categoryId: cat.id, repoId: BigInt(repo2.id), createdAt: now() } });

            const res = await request(app.getHttpServer())
                .post('/api/category/repos')
                .send({ categoryId: Number(cat.id), page: 1, size: 10 })
                .expect(201);

            const body = res.body;
            expect(body.meta.total).toBe(2);
            expect(body.data.length).toBe(2);
            expect(body.data[0].starsCount).toBe(200);
        });
    });
});
