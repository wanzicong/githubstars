/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are intentionally untyped in mock assertions. */
import { splitMarkdownIntoChunks } from '../../src/localization/agent-translation-client.service';
import { RepositoryLocalizationService } from '../../src/localization/repository-localization.service';

describe('RepositoryLocalizationService', () => {
    const baseRepo = {
        id: 1n,
        fullName: 'owner/project',
        description: 'A useful project',
        descriptionCn: null,
        readmeOriginal: '# Project\n\nUseful documentation.',
        readmeCn: null,
        readmeFetched: true,
    };

    const prisma = {
        githubRepo: { update: jest.fn() },
        translationTask: {
            create: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        translationTaskItem: {
            createMany: jest.fn(),
            updateMany: jest.fn(),
            count: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
    };
    const githubRepo = {
        findById: jest.fn(),
        findByIds: jest.fn(),
        ensureReadmeFetched: jest.fn(),
    };
    const translator = {
        translateDescription: jest.fn(),
        translateReadme: jest.fn(),
    };

    let service: RepositoryLocalizationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new RepositoryLocalizationService(prisma as never, githubRepo as never, translator as never);
    });

    it('应翻译描述和 README 并写入中文字段', async () => {
        githubRepo.findById.mockResolvedValue(baseRepo);
        translator.translateDescription.mockResolvedValue('一个实用的项目');
        translator.translateReadme.mockResolvedValue('# 项目\n\n实用文档。');
        prisma.githubRepo.update.mockResolvedValue({});

        const result = await service.localizeRepository(1, 'both');

        expect(result.description).toEqual({ status: 'translated', characters: 7 });
        expect(result.readme).toEqual({ status: 'translated', characters: 11 });
        expect(translator.translateDescription).toHaveBeenCalledWith(baseRepo.description);
        expect(translator.translateReadme).toHaveBeenCalledWith(baseRepo.readmeOriginal);
        expect(prisma.githubRepo.update).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ descriptionCn: '一个实用的项目' }) }),
        );
        expect(prisma.githubRepo.update).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ readmeCn: '# 项目\n\n实用文档。' }) }),
        );
    });

    it('默认不覆盖已有中文内容', async () => {
        githubRepo.findById.mockResolvedValue({
            ...baseRepo,
            descriptionCn: '已有描述',
            readmeCn: '# 已有文档',
        });

        const result = await service.localizeRepository(1, 'both');

        expect(result.description?.status).toBe('skipped');
        expect(result.readme?.status).toBe('skipped');
        expect(translator.translateDescription).not.toHaveBeenCalled();
        expect(translator.translateReadme).not.toHaveBeenCalled();
        expect(prisma.githubRepo.update).not.toHaveBeenCalled();
    });

    it('README 原文缺失时应先从 GitHub 拉取再翻译', async () => {
        const unfetchedRepo = { ...baseRepo, readmeOriginal: null, readmeFetched: false };
        const fetchedRepo = { ...baseRepo, readmeOriginal: '# Fresh README', readmeFetched: true };
        githubRepo.findById.mockResolvedValueOnce(unfetchedRepo).mockResolvedValueOnce(fetchedRepo);
        githubRepo.ensureReadmeFetched.mockResolvedValue(fetchedRepo);
        translator.translateReadme.mockResolvedValue('# 最新说明');
        prisma.githubRepo.update.mockResolvedValue({});

        const result = await service.localizeRepository(1, 'readme');

        expect(githubRepo.ensureReadmeFetched).toHaveBeenCalledWith(1);
        expect(translator.translateReadme).toHaveBeenCalledWith('# Fresh README');
        expect(result.readme?.status).toBe('translated');
    });

    it('批量任务只创建需要处理的字段并返回缺失仓库 ID', async () => {
        githubRepo.findByIds.mockResolvedValue([
            baseRepo,
            { ...baseRepo, id: 2n, fullName: 'owner/done', descriptionCn: '已有描述', readmeCn: '# 已有 README' },
        ]);
        prisma.translationTask.create.mockResolvedValue({ id: 9n });
        prisma.translationTaskItem.createMany.mockResolvedValue({ count: 2 });
        const serviceWithTaskLauncher = service as unknown as {
            startTaskAsync(taskId: bigint, concurrency: number, force: boolean): void;
        };
        jest.spyOn(serviceWithTaskLauncher, 'startTaskAsync').mockImplementation(() => undefined);

        const result = await service.createBatch([1, 2, 404], 'both', false, 2);

        expect(result).toEqual(
            expect.objectContaining({
                taskId: 9,
                totalItems: 2,
                repositoryCount: 2,
                missingRepoIds: [404],
            }),
        );
        expect(prisma.translationTaskItem.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({ repoId: 1, translateType: 'description' }),
                expect.objectContaining({ repoId: 1, translateType: 'readme' }),
            ]),
        });
    });

    it('任务详情只返回有限的失败或处理中明细，避免大任务结果撑爆 Agent 上下文', async () => {
        prisma.translationTask.findUnique.mockResolvedValue({
            id: 2n,
            status: 'PROCESSING',
            totalItems: 1581,
            completedItems: 10,
            failedItems: 30,
        });
        prisma.translationTaskItem.findMany.mockResolvedValue(
            Array.from({ length: 20 }, (_, index) => ({ id: BigInt(index + 1), status: 'FAILED' })),
        );
        prisma.translationTaskItem.count.mockResolvedValue(2);

        const result = await service.getTask(2);

        expect(prisma.translationTask.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
        expect(prisma.translationTaskItem.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { taskId: 2, status: { in: ['FAILED', 'PROCESSING'] } },
                take: 20,
            }),
        );
        expect(result).toEqual(
            expect.objectContaining({
                progress: 3,
                pendingItems: 1539,
                processingItems: 2,
                returnedItems: 20,
                attentionItemCount: 32,
                hasMoreItems: true,
            }),
        );
    });
});

describe('splitMarkdownIntoChunks', () => {
    it('切分长 README 时不应在代码围栏内断开', () => {
        const markdown = ['开头说明\n', '```ts\n', 'const value = 1;\n', 'const other = 2;\n', '```\n', '结尾说明\n'].join('');
        const chunks = splitMarkdownIntoChunks(markdown, 20);

        expect(chunks.join('')).toBe(markdown);
        expect(chunks.some((chunk) => chunk.includes('```ts\nconst value = 1;\nconst other = 2;\n```\n'))).toBe(true);
    });
});
