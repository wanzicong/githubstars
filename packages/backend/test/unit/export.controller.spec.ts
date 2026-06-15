/**
 * ExportController 单元测试
 *
 * 测试重点:
 *   - Markdown 生成特殊字符处理
 *   - README 5000 字符截断
 *   - 空字段 / 空列表处理
 *   - findPage 参数传递完整性（防止筛选条件丢失）
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ExportController } from '../../src/export/export.controller';
import { GithubRepoService } from '../../src/github/services/github-repo.service';

describe('ExportController', () => {
    let controller: ExportController;
    let mockRepoService: any;

    function createMockResponse() {
        const res: any = {};
        res.set = jest.fn().mockReturnValue(res);
        res.send = jest.fn().mockReturnValue(res);
        res.status = jest.fn().mockReturnValue(res);
        return res;
    }

    function mockFindPageResult(records: any[], total: number) {
        return { records, total, size: records.length, current: 1, pages: 1 };
    }

    beforeEach(async () => {
        mockRepoService = {
            findPage: jest.fn(),
            fillCategoryNames: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ExportController],
            providers: [{ provide: GithubRepoService, useValue: mockRepoService }],
        }).compile();
        controller = module.get<ExportController>(ExportController);
    });

    // ==================== 参数传递完整性 ====================

    describe('参数传递', () => {
        it('应传递所有筛选参数到 findPage — keyword + language + categoryIds + sort + date + untranslatedOnly', async () => {
            mockRepoService.findPage.mockResolvedValue(mockFindPageResult([], 0));
            const res = createMockResponse();

            await controller.exportMd(
                {
                    keyword: 'mcp',
                    language: 'TypeScript',
                    categoryIds: '1,2',
                    sortBy: 'stars_count',
                    sortOrder: 'asc',
                    dateField: 'starred_at',
                    startDate: '2024-01-01',
                    endDate: '2024-06-30',
                    untranslatedOnly: 'true',
                    maxCount: '100',
                },
                res,
            );

            expect(mockRepoService.findPage).toHaveBeenCalledWith({
                page: 1,
                size: 100,
                keyword: 'mcp',
                language: 'TypeScript',
                categoryIds: '1,2',
                sortBy: 'stars_count',
                sortOrder: 'asc',
                dateField: 'starred_at',
                startDate: '2024-01-01',
                endDate: '2024-06-30',
                untranslatedOnly: true,
            });
        });

        it('不传任何筛选参数时使用默认值', async () => {
            mockRepoService.findPage.mockResolvedValue(mockFindPageResult([], 0));
            const res = createMockResponse();

            await controller.exportMd({ maxCount: '10' }, res);

            expect(mockRepoService.findPage).toHaveBeenCalledWith(
                expect.objectContaining({
                    page: 1,
                    size: 10,
                    keyword: '',
                    language: '',
                    sortBy: 'starred_at',
                    sortOrder: 'desc',
                    untranslatedOnly: false,
                }),
            );
        });
    });

    // ==================== Markdown 生成 ====================

    describe('Markdown 生成', () => {
        it('应生成包含关键词和语言的头部信息', async () => {
            mockRepoService.findPage.mockResolvedValue(mockFindPageResult([], 0));
            const res = createMockResponse();

            await controller.exportMd({ keyword: 'mcp', language: 'TypeScript', maxCount: '10' }, res);

            const md = res.send.mock.calls[0][0];
            expect(md).toContain('# GitHub Stars 导出');
            expect(md).toContain('> 关键词: mcp');
            expect(md).toContain('> 语言: TypeScript');
            expect(md).toContain('> 导出时间:');
        });

        it('应包含时间范围信息', async () => {
            mockRepoService.findPage.mockResolvedValue(mockFindPageResult([], 0));
            const res = createMockResponse();

            await controller.exportMd(
                {
                    dateField: 'starred_at',
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    maxCount: '10',
                },
                res,
            );

            const md = res.send.mock.calls[0][0];
            expect(md).toContain('> 时间范围: 2024-01-01 ~ 2024-12-31');
        });

        it('应包含仅未翻译标记', async () => {
            mockRepoService.findPage.mockResolvedValue(mockFindPageResult([], 0));
            const res = createMockResponse();

            await controller.exportMd({ untranslatedOnly: 'true', maxCount: '10' }, res);

            const md = res.send.mock.calls[0][0];
            expect(md).toContain('> 仅未翻译');
        });

        it('单个仓库导出格式正确', async () => {
            mockRepoService.findPage.mockResolvedValue(
                mockFindPageResult(
                    [
                        {
                            id: BigInt(1),
                            fullName: 'test-owner/test-repo',
                            starsCount: 100,
                            forksCount: 20,
                            language: 'TypeScript',
                            htmlUrl: 'https://github.com/test-owner/test-repo',
                            homepage: 'https://example.com',
                            descriptionCn: '测试描述',
                            readmeCn: null,
                            readmeOriginal: '# Test README',
                        },
                    ],
                    1,
                ),
            );
            const res = createMockResponse();

            await controller.exportMd({ maxCount: '10' }, res);

            const md = res.send.mock.calls[0][0];
            expect(md).toContain('## test-owner/test-repo');
            expect(md).toContain('⭐ 100');
            expect(md).toContain('🍴 20');
            expect(md).toContain('语言: TypeScript');
            expect(md).toContain('[GitHub](https://github.com/test-owner/test-repo)');
            expect(md).toContain('[主页](https://example.com)');
            expect(md).toContain('测试描述');
        });

        it('无描述时使用原始描述', async () => {
            mockRepoService.findPage.mockResolvedValue(
                mockFindPageResult(
                    [
                        {
                            id: BigInt(1),
                            fullName: 'test/repo',
                            starsCount: 1,
                            forksCount: 0,
                            language: null,
                            htmlUrl: 'url',
                            homepage: null,
                            descriptionCn: null,
                            description: 'original desc',
                            readmeCn: null,
                            readmeOriginal: null,
                        },
                    ],
                    1,
                ),
            );
            const res = createMockResponse();

            await controller.exportMd({ maxCount: '10' }, res);

            const md = res.send.mock.calls[0][0];
            expect(md).toContain('original desc');
        });

        it('README 超过 5000 字符应截断', async () => {
            const longReadme = 'A'.repeat(10000);
            mockRepoService.findPage.mockResolvedValue(
                mockFindPageResult(
                    [
                        {
                            id: BigInt(1),
                            fullName: 'test/repo',
                            starsCount: 1,
                            forksCount: 0,
                            language: null,
                            htmlUrl: 'url',
                            homepage: null,
                            description: null,
                            descriptionCn: null as string | null,
                            readmeCn: longReadme,
                            readmeOriginal: null,
                        },
                    ],
                    1,
                ),
            );
            const res = createMockResponse();

            await controller.exportMd({ maxCount: '10' }, res);

            const md = res.send.mock.calls[0][0];
            const readmeSection = md.substring(md.indexOf('### README 中文翻译'));
            // 实际内容 + 标题不超过 5100
            expect(readmeSection.length).toBeLessThan(5100);
        });

        it('优先显示中文翻译 README', async () => {
            mockRepoService.findPage.mockResolvedValue(
                mockFindPageResult(
                    [
                        {
                            id: BigInt(1),
                            fullName: 'test/repo',
                            starsCount: 1,
                            forksCount: 0,
                            language: null,
                            htmlUrl: 'url',
                            homepage: null,
                            description: null,
                            descriptionCn: null,
                            readmeCn: '中文README',
                            readmeOriginal: '# Original',
                        },
                    ],
                    1,
                ),
            );
            const res = createMockResponse();

            await controller.exportMd({ maxCount: '10' }, res);

            const md = res.send.mock.calls[0][0];
            expect(md).toContain('### README 中文翻译');
            expect(md).toContain('中文README');
            expect(md).not.toContain('# Original');
        });

        it('无中文翻译时显示原始 README', async () => {
            mockRepoService.findPage.mockResolvedValue(
                mockFindPageResult(
                    [
                        {
                            id: BigInt(1),
                            fullName: 'test/repo',
                            starsCount: 1,
                            forksCount: 0,
                            language: null,
                            htmlUrl: 'url',
                            homepage: null,
                            description: null,
                            descriptionCn: null,
                            readmeCn: null,
                            readmeOriginal: '# Original',
                        },
                    ],
                    1,
                ),
            );
            const res = createMockResponse();

            await controller.exportMd({ maxCount: '10' }, res);

            const md = res.send.mock.calls[0][0];
            expect(md).toContain('### README');
            expect(md).toContain('# Original');
        });

        it('空结果不应报错', async () => {
            mockRepoService.findPage.mockResolvedValue(mockFindPageResult([], 0));
            const res = createMockResponse();

            await controller.exportMd({ maxCount: '10' }, res);

            const md = res.send.mock.calls[0][0];
            expect(md).toContain('# GitHub Stars 导出');
            expect(md).toContain('> 导出时间:');
            expect(res.send).toHaveBeenCalled();
        });
    });
});
