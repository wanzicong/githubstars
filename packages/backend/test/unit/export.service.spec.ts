import { Test } from '@nestjs/testing';
import { ExportService } from '../../src/export/export.service';
import { GithubRepoService } from '../../src/github/github-repo.service';

describe('ExportService', () => {
    let service: ExportService;
    let repoService: any;

    const mockRepo = {
        id: 1, repoName: 'test-repo', fullName: 'owner/test-repo',
        description: 'A test repository', descriptionCn: '测试仓库',
        readmeOriginal: '# README', readmeCn: '# 中文README',
        readmeFetched: true, language: 'TypeScript',
        ownerName: 'owner', ownerAvatarUrl: 'url',
        htmlUrl: 'https://github.com/owner/test-repo', homepage: 'https://example.com',
        starsCount: 100, forksCount: 10, watchersCount: 5, openIssuesCount: 3,
        topics: '["test"]', licenseName: 'MIT', isFork: false, isArchived: false,
    };

    beforeEach(async () => {
        const mockGithubRepoService = {
            findPage: jest.fn(),
        };

        const module = await Test.createTestingModule({
            providers: [
                ExportService,
                { provide: GithubRepoService, useValue: mockGithubRepoService },
            ],
        }).compile();

        service = module.get(ExportService);
        repoService = mockGithubRepoService;
    });

    describe('generateMarkdown', () => {
        it('应生成包含仓库信息的Markdown文档', async () => {
            repoService.findPage.mockResolvedValue({
                records: [mockRepo],
                total: 1,
                size: 10,
                current: 1,
                pages: 1,
            });

            const md = await service.generateMarkdown({}, 10);

            // 验证 Markdown 包含关键信息
            expect(md).toContain('# GitHub Stars 导出');
            expect(md).toContain('owner/test-repo');
            expect(md).toContain('TypeScript');
            expect(md).toContain('[GitHub](https://github.com/owner/test-repo)');
            expect(md).toContain('[主页](https://example.com)');
        });

        it('应包含筛选条件信息', async () => {
            repoService.findPage.mockResolvedValue({
                records: [mockRepo], total: 1, size: 10, current: 1, pages: 1,
            });

            const md = await service.generateMarkdown({
                keyword: 'react',
                language: 'TypeScript',
            }, 10);

            expect(md).toContain('react');
            expect(md).toContain('TypeScript');
        });

        it('应优先使用中文描述', async () => {
            repoService.findPage.mockResolvedValue({
                records: [mockRepo], total: 1, size: 10, current: 1, pages: 1,
            });

            const md = await service.generateMarkdown({}, 10);
            // descriptionCn 优先于 description
            expect(md).toContain('测试仓库');
        });

        it('空仓库列表应生成基本文档', async () => {
            repoService.findPage.mockResolvedValue({
                records: [], total: 0, size: 10, current: 1, pages: 0,
            });

            const md = await service.generateMarkdown({}, 10);

            expect(md).toContain('# GitHub Stars 导出');
            expect(md).toContain('导出时间');
        });

        it('untranslatedOnly筛选应体现在文档中', async () => {
            repoService.findPage.mockResolvedValue({
                records: [mockRepo], total: 1, size: 10, current: 1, pages: 1,
            });

            const md = await service.generateMarkdown({
                untranslatedOnly: true,
            }, 10);

            expect(md).toContain('仅未翻译');
        });
    });
});
