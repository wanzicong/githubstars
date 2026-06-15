import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TestTransaction } from '../helpers/test-transaction';
import { insertRepo, createRepoFixture } from '../helpers/fixtures';

describe('stats (e2e)', () => {
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
    });

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

    // ==================== /api/stats/languages ====================

    describe('GET /api/stats/languages', () => {
        it('should return language stats with count and percentage', async () => {
            await insertRepo(prisma, { language: 'TypeScript' });
            await insertRepo(prisma, { language: 'TypeScript' });
            await insertRepo(prisma, { language: 'Python' });

            const res = await request(app.getHttpServer()).get('/api/stats/languages').expect(200);

            expect(res.body).toBeInstanceOf(Array);
            expect(res.body.length).toBeGreaterThanOrEqual(2);

            const ts = res.body.find((r: any) => r.language === 'TypeScript');
            const py = res.body.find((r: any) => r.language === 'Python');

            expect(ts).toBeDefined();
            expect(ts.count).toBe(2);
            expect(ts.percentage).toBeCloseTo(66.67, 1);

            expect(py).toBeDefined();
            expect(py.count).toBe(1);
            expect(py.percentage).toBeCloseTo(33.33, 1);
        });

        it('should mark null language as "未知"', async () => {
            await insertRepo(prisma, { language: null });

            const res = await request(app.getHttpServer()).get('/api/stats/languages').expect(200);

            const unknown = res.body.find((r: any) => r.language === '未知');
            expect(unknown).toBeDefined();
            expect(unknown.count).toBe(1);
            expect(unknown.percentage).toBe(100);
        });

        it('should return languages sorted by count descending', async () => {
            await insertRepo(prisma, { language: 'Rust' });
            await insertRepo(prisma, { language: 'TypeScript' });
            await insertRepo(prisma, { language: 'TypeScript' });
            await insertRepo(prisma, { language: 'TypeScript' });
            await insertRepo(prisma, { language: 'Python' });
            await insertRepo(prisma, { language: 'Python' });

            const res = await request(app.getHttpServer()).get('/api/stats/languages').expect(200);

            // 验证降序排列
            for (let i = 1; i < res.body.length; i++) {
                expect(res.body[i - 1].count).toBeGreaterThanOrEqual(res.body[i].count);
            }
        });

        it('should return empty array when no repos exist', async () => {
            const res = await request(app.getHttpServer()).get('/api/stats/languages').expect(200);

            expect(res.body).toEqual([]);
        });
    });

    // ==================== /api/stats/owners ====================

    describe('GET /api/stats/owners', () => {
        it('should return top 15 owners by default', async () => {
            for (let i = 1; i <= 5; i++) {
                await insertRepo(prisma, {
                    ownerName: 'alice',
                    fullName: `alice/repo-${i}`,
                    ownerAvatarUrl: 'https://avatar.example.com/alice.png',
                });
            }
            for (let i = 1; i <= 3; i++) {
                await insertRepo(prisma, {
                    ownerName: 'bob',
                    fullName: `bob/repo-${i}`,
                    ownerAvatarUrl: 'https://avatar.example.com/bob.png',
                });
            }

            const res = await request(app.getHttpServer()).get('/api/stats/owners').expect(200);

            expect(res.body).toBeInstanceOf(Array);
            expect(res.body.length).toBe(2);

            // 按 count 降序排列
            expect(res.body[0].ownerName).toBe('alice');
            expect(res.body[0].count).toBe(5);
            expect(res.body[0].ownerAvatarUrl).toBe('https://avatar.example.com/alice.png');

            expect(res.body[1].ownerName).toBe('bob');
            expect(res.body[1].count).toBe(3);
        });

        it('should respect custom topN parameter', async () => {
            for (let i = 1; i <= 10; i++) {
                await insertRepo(prisma, {
                    ownerName: `user-${i}`,
                    fullName: `user-${i}/repo`,
                });
            }

            const res = await request(app.getHttpServer()).get('/api/stats/owners?topN=3').expect(200);

            expect(res.body.length).toBe(3);
        });

        it('should default topN to 15 when given invalid value', async () => {
            for (let i = 1; i <= 5; i++) {
                await insertRepo(prisma, { ownerName: `user-${i}`, fullName: `user-${i}/repo` });
            }

            const res = await request(app.getHttpServer()).get('/api/stats/owners?topN=invalid').expect(200);

            // 默认 topN=15, 数据量小于 15 时返回全部
            expect(res.body.length).toBe(5);
        });

        it('should return empty array when no repos exist', async () => {
            const res = await request(app.getHttpServer()).get('/api/stats/owners').expect(200);

            expect(res.body).toEqual([]);
        });
    });

    // ==================== /api/stats/timeline ====================

    describe('GET /api/stats/timeline', () => {
        it('should return monthly starred counts', async () => {
            await insertRepo(prisma, {
                starredAt: new Date('2024-01-15'),
                fullName: 'test/repo-jan',
            });
            await insertRepo(prisma, {
                starredAt: new Date('2024-01-20'),
                fullName: 'test/repo-jan2',
            });
            await insertRepo(prisma, {
                starredAt: new Date('2024-03-10'),
                fullName: 'test/repo-mar',
            });

            const res = await request(app.getHttpServer()).get('/api/stats/timeline').expect(200);

            expect(res.body).toBeInstanceOf(Array);

            const jan = res.body.find((r: any) => r.month === '2024-01');
            const mar = res.body.find((r: any) => r.month === '2024-03');

            expect(jan).toBeDefined();
            expect(jan.count).toBe(2);

            expect(mar).toBeDefined();
            expect(mar.count).toBe(1);
        });

        it('should return timeline sorted by month ascending', async () => {
            await insertRepo(prisma, { starredAt: new Date('2024-03-01'), fullName: 'test/mar' });
            await insertRepo(prisma, { starredAt: new Date('2024-01-01'), fullName: 'test/jan' });
            await insertRepo(prisma, { starredAt: new Date('2024-05-01'), fullName: 'test/may' });

            const res = await request(app.getHttpServer()).get('/api/stats/timeline').expect(200);

            const months = res.body.map((r: any) => r.month);
            expect(months).toEqual(['2024-01', '2024-03', '2024-05']);
        });

        it('should return empty array when no repos exist', async () => {
            const res = await request(app.getHttpServer()).get('/api/stats/timeline').expect(200);

            expect(res.body).toEqual([]);
        });

        it('should exclude repos with null starredAt', async () => {
            await insertRepo(prisma, {
                starredAt: new Date('2024-06-01'),
                fullName: 'test/valid',
            });
            await insertRepo(prisma, {
                starredAt: null as any,
                fullName: 'test/null-starred',
            });

            const res = await request(app.getHttpServer()).get('/api/stats/timeline').expect(200);

            // 只应有 valid repo 的月份记录
            expect(res.body.length).toBe(1);
            expect(res.body[0].month).toBe('2024-06');
            expect(res.body[0].count).toBe(1);
        });
    });

    // ==================== /api/stats/overview ====================

    describe('GET /api/stats/overview', () => {
        it('should return aggregate overview stats', async () => {
            await insertRepo(prisma, {
                starsCount: 100,
                forksCount: 20,
                language: 'TypeScript',
                ownerName: 'alice',
                fullName: 'alice/repo1',
            });
            await insertRepo(prisma, {
                starsCount: 200,
                forksCount: 30,
                language: 'Python',
                ownerName: 'bob',
                fullName: 'bob/repo1',
            });
            await insertRepo(prisma, {
                starsCount: 50,
                forksCount: 5,
                language: 'TypeScript',
                ownerName: 'alice',
                fullName: 'alice/repo2',
            });

            const res = await request(app.getHttpServer()).get('/api/stats/overview').expect(200);

            expect(res.body).toMatchObject({
                totalRepos: 3,
                totalStars: 350,
                totalForks: 55,
                totalLanguages: 2, // TypeScript, Python
                totalOwners: 2, // alice, bob
            });
        });

        it('should return zero values when no repos exist', async () => {
            const res = await request(app.getHttpServer()).get('/api/stats/overview').expect(200);

            expect(res.body).toEqual({
                totalRepos: 0,
                totalStars: 0,
                totalForks: 0,
                totalLanguages: 0,
                totalOwners: 0,
            });
        });

        it('should handle repos with null language and ownerName', async () => {
            await insertRepo(prisma, { language: null, ownerName: null, fullName: 'anon/repo' });

            const res = await request(app.getHttpServer()).get('/api/stats/overview').expect(200);

            expect(res.body.totalRepos).toBe(1);
            // null language 和 null ownerName 不计入 distinct 统计
            expect(res.body.totalLanguages).toBe(0);
            expect(res.body.totalOwners).toBe(0);
        });
    });

    // ==================== /api/stats/top-starred ====================

    describe('GET /api/stats/top-starred', () => {
        it('should return repos sorted by starsCount descending', async () => {
            await insertRepo(prisma, { starsCount: 10, fullName: 'test/low', repoName: 'low' });
            await insertRepo(prisma, { starsCount: 999, fullName: 'test/high', repoName: 'high' });
            await insertRepo(prisma, { starsCount: 500, fullName: 'test/mid', repoName: 'mid' });

            const res = await request(app.getHttpServer()).get('/api/stats/top-starred').expect(200);

            expect(res.body).toBeInstanceOf(Array);
            expect(res.body.length).toBe(3);
            expect(res.body[0].starsCount).toBe(999);
            expect(res.body[1].starsCount).toBe(500);
            expect(res.body[2].starsCount).toBe(10);
        });

        it('should respect custom topN parameter', async () => {
            for (let i = 1; i <= 10; i++) {
                await insertRepo(prisma, {
                    starsCount: i * 10,
                    fullName: `test/repo-${i}`,
                    repoName: `repo-${i}`,
                });
            }

            const res = await request(app.getHttpServer()).get('/api/stats/top-starred?topN=3').expect(200);

            expect(res.body.length).toBe(3);
            // 最高 starsCount = 100
            expect(res.body[0].starsCount).toBe(100);
        });

        it('should default topN to 10 when given invalid value', async () => {
            for (let i = 1; i <= 5; i++) {
                await insertRepo(prisma, {
                    starsCount: i * 10,
                    fullName: `test/repo-${i}`,
                    repoName: `repo-${i}`,
                });
            }

            const res = await request(app.getHttpServer()).get('/api/stats/top-starred?topN=invalid').expect(200);

            // 默认 topN=10，数据量只有 5，返回全部
            expect(res.body.length).toBe(5);
        });

        it('should return empty array when no repos exist', async () => {
            const res = await request(app.getHttpServer()).get('/api/stats/top-starred').expect(200);

            expect(res.body).toEqual([]);
        });
    });

    // ==================== /api/stats/recent-active ====================

    describe('GET /api/stats/recent-active', () => {
        it('should return repos sorted by repoUpdatedAt descending', async () => {
            await insertRepo(prisma, {
                repoUpdatedAt: new Date('2024-01-01'),
                fullName: 'test/old',
                repoName: 'old',
            });
            await insertRepo(prisma, {
                repoUpdatedAt: new Date('2024-06-01'),
                fullName: 'test/new',
                repoName: 'new',
            });
            await insertRepo(prisma, {
                repoUpdatedAt: new Date('2024-03-15'),
                fullName: 'test/mid',
                repoName: 'mid',
            });

            const res = await request(app.getHttpServer()).get('/api/stats/recent-active').expect(200);

            expect(res.body).toBeInstanceOf(Array);
            expect(res.body.length).toBe(3);
            // 按 repoUpdatedAt 降序
            expect(new Date(res.body[0].repoUpdatedAt).getTime()).toBeGreaterThanOrEqual(new Date(res.body[1].repoUpdatedAt).getTime());
            expect(new Date(res.body[1].repoUpdatedAt).getTime()).toBeGreaterThanOrEqual(new Date(res.body[2].repoUpdatedAt).getTime());
        });

        it('should respect custom topN parameter', async () => {
            for (let i = 1; i <= 8; i++) {
                await insertRepo(prisma, {
                    repoUpdatedAt: new Date(2024, 0, i),
                    fullName: `test/repo-${i}`,
                    repoName: `repo-${i}`,
                });
            }

            const res = await request(app.getHttpServer()).get('/api/stats/recent-active?topN=3').expect(200);

            expect(res.body.length).toBe(3);
        });

        it('should exclude repos with null repoUpdatedAt', async () => {
            await insertRepo(prisma, {
                repoUpdatedAt: new Date('2024-06-01'),
                fullName: 'test/valid',
                repoName: 'valid',
            });
            await insertRepo(prisma, {
                repoUpdatedAt: null as any,
                fullName: 'test/null-updated',
                repoName: 'null-updated',
            });

            const res = await request(app.getHttpServer()).get('/api/stats/recent-active').expect(200);

            // null repoUpdatedAt 的仓库不应该出现在结果中
            expect(res.body.length).toBe(1);
            expect(res.body[0].fullName).toBe('test/valid');
        });

        it('should return empty array when no repos exist', async () => {
            const res = await request(app.getHttpServer()).get('/api/stats/recent-active').expect(200);

            expect(res.body).toEqual([]);
        });
    });
});
