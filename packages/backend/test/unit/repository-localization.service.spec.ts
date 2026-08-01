import type { PrismaService } from '../../src/prisma/prisma.service';
import { RepositoryLocalizationService } from '../../src/localization/repository-localization.service';

/** 取 jest mock 的第 N 次调用入参（带类型断言，避免 unsafe member access） */
function callArg(mock: jest.Mock, key: string): Record<string, unknown> {
    const firstCall = mock.mock.calls[0] as Array<Record<string, unknown>>;
    return firstCall[0][key] as Record<string, unknown>;
}

describe('RepositoryLocalizationService（纯数据接口：取原文 / 写译文）', () => {
    const prisma = {
        githubRepo: {
            findMany: jest.fn(),
            update: jest.fn(),
        },
    };

    let service: RepositoryLocalizationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new RepositoryLocalizationService(prisma as unknown as PrismaService);
    });

    describe('findPending', () => {
        it('默认同时查询描述与 README 均未翻译的仓库', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([]);
            const result = await service.findPending(50, true, true);
            expect(result.success).toBe(true);
            expect(prisma.githubRepo.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        OR: [
                            { description: { not: null, notIn: [''] }, descriptionCn: null },
                            { readmeCn: null, readmeOriginal: { not: null, notIn: [''] } },
                        ],
                    },
                    take: 50,
                }),
            );
        });

        it('仅查描述时 WHERE 只含 description 条件', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPending(10, true, false);
            const where = callArg(prisma.githubRepo.findMany, 'where');
            expect(where).toEqual({ description: { not: null, notIn: [''] }, descriptionCn: null });
        });

        it('仅查 README 时 WHERE 只含 readme 条件', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPending(10, false, true);
            const where = callArg(prisma.githubRepo.findMany, 'where');
            expect(where).toEqual({ readmeCn: null, readmeOriginal: { not: null, notIn: [''] } });
        });

        it('WHERE 排除空串原文，避免产生全 null 的无效记录', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([]);
            await service.findPending(10, true, true);
            const where = callArg(prisma.githubRepo.findMany, 'where');
            const branches = (where as unknown as { OR: Array<Record<string, unknown>> }).OR;
            for (const branch of branches) {
                const fieldFilter = (branch.description ?? branch.readmeOriginal) as { notIn: string[] };
                expect(fieldFilter.notIn).toEqual(['']);
            }
        });
        it('两个字段都不查时直接返回空，不访问数据库', async () => {
            const result = await service.findPending(10, false, false);
            expect(result).toEqual({ success: true, total: 0, records: [] });
            expect(prisma.githubRepo.findMany).not.toHaveBeenCalled();
        });

        it('已翻译字段返回 null，仅保留待翻译原文', async () => {
            prisma.githubRepo.findMany.mockResolvedValue([
                {
                    id: 1n,
                    fullName: 'owner/a',
                    description: 'English desc',
                    descriptionCn: null,
                    readmeOriginal: '# readme',
                    readmeCn: '已有中文',
                },
            ]);
            const result = await service.findPending(50, true, true);
            expect(result.records).toHaveLength(1);
            expect(result.records[0].repoId).toBe(1);
            expect(result.records[0].description).toBe('English desc');
            // readmeCn 已有中文 → readme 返回 null
            expect(result.records[0].readme).toBeNull();
        });
    });

    describe('updateTranslations', () => {
        it('写入描述与 README 译文，传 readmeCn 时置 readmeFetched=true', async () => {
            prisma.githubRepo.update.mockResolvedValue({});
            const result = await service.updateTranslations([{ repoId: 1, descriptionCn: '中文描述', readmeCn: '中文 README' }]);
            expect(result.updated).toBe(1);
            expect(result.updatedRepoIds).toEqual([1]);
            const data = callArg(prisma.githubRepo.update, 'data');
            expect(data.descriptionCn).toBe('中文描述');
            expect(data.readmeCn).toBe('中文 README');
            expect(data.readmeFetched).toBe(true);
        });

        it('无有效中文字段的项计入 skipped，不更新数据库', async () => {
            const result = await service.updateTranslations([{ repoId: 5 }]);
            expect(result.updated).toBe(0);
            expect(result.skippedRepoIds).toEqual([5]);
            expect(prisma.githubRepo.update).not.toHaveBeenCalled();
        });

        it('单条更新失败不阻塞整批，计入 skipped', async () => {
            prisma.githubRepo.update.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('记录不存在'));
            const result = await service.updateTranslations([
                { repoId: 1, descriptionCn: 'a' },
                { repoId: 2, descriptionCn: 'b' },
            ]);
            expect(result.updated).toBe(1);
            expect(result.updatedRepoIds).toEqual([1]);
            expect(result.skippedRepoIds).toEqual([2]);
        });
    });
});
