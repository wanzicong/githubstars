import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GithubApiService } from '../../src/github/github-api.service';
import { GithubSearchService } from '../../src/github/github-search.service';
import { GithubRepoService } from '../../src/github/github-repo.service';
import { ConfigService } from '../../src/config/config.service';

/** 构造一个完整的 GitHub GET /repos/{owner}/{repo} 响应体 */
function buildGithubRepoPayload() {
    return {
        id: 123456,
        name: 'codex',
        full_name: 'openai/codex',
        description: 'Lightweight coding agent',
        language: 'Rust',
        owner: { login: 'openai', avatar_url: 'https://example.com/openai.png' },
        html_url: 'https://github.com/openai/codex',
        homepage: 'https://openai.com',
        stargazers_count: 50000,
        forks_count: 6000,
        watchers_count: 50000,
        open_issues_count: 300,
        topics: ['ai', 'agent'],
        license: { name: 'Apache-2.0' },
        fork: false,
        archived: false,
        size: 20480,
        default_branch: 'main',
        visibility: 'public',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
        pushed_at: '2026-07-29T00:00:00Z',
    };
}

describe('GithubApiService.fetchRepoByFullName', () => {
    let service: GithubApiService;
    const originalFetch = global.fetch;
    const mockConfig = { getValueDefault: jest.fn() };

    beforeEach(async () => {
        jest.clearAllMocks();
        mockConfig.getValueDefault.mockResolvedValue('test-token');
        const module = await Test.createTestingModule({
            providers: [GithubApiService, { provide: ConfigService, useValue: mockConfig }],
        }).compile();
        service = module.get(GithubApiService);
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it('应将裸仓库响应映射为 DB 同构字段', async () => {
        global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(buildGithubRepoPayload()), { status: 200 })) as typeof fetch;

        const result = await service.fetchRepoByFullName('openai/codex');

        expect(result).toMatchObject({
            repoName: 'codex',
            fullName: 'openai/codex',
            description: 'Lightweight coding agent',
            language: 'Rust',
            ownerName: 'openai',
            starsCount: 50000,
            forksCount: 6000,
            openIssuesCount: 300,
            topics: '["ai","agent"]',
            licenseName: 'Apache-2.0',
            isFork: false,
            isArchived: false,
            repoSize: 20480,
            defaultBranch: 'main',
            visibility: 'public',
            starredAt: null,
        });
        expect(result.repoPushedAt).toBeInstanceOf(Date);
    });

    it('fullName 格式非法时应抛出 BadRequest', async () => {
        await expect(service.fetchRepoByFullName('invalid-name')).rejects.toMatchObject({
            message: '仓库名称格式无效',
        });
    });

    it('404 时应抛出 NotFoundException', async () => {
        global.fetch = jest.fn().mockResolvedValue(new Response('{"message":"Not Found"}', { status: 404 })) as typeof fetch;

        await expect(service.fetchRepoByFullName('openai/not-exist')).rejects.toBeInstanceOf(NotFoundException);
    });
});

describe('GithubSearchService.getRepoDetail', () => {
    let service: GithubSearchService;
    const mockConfig = { getValueDefault: jest.fn() };
    const mockGithubApi = {
        fetchRepoByFullName: jest.fn(),
        fetchReadmeFromGitHub: jest.fn(),
    };
    const mockRepoService = {
        findByFullName: jest.fn(),
        ensureReadmeFetched: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                GithubSearchService,
                { provide: ConfigService, useValue: mockConfig },
                { provide: GithubApiService, useValue: mockGithubApi },
                { provide: GithubRepoService, useValue: mockRepoService },
            ],
        }).compile();
        service = module.get(GithubSearchService);
    });

    it('本地库命中时应返回 DB 数据且 inLibrary=true，不调用 GitHub API', async () => {
        const dbRepo = { id: 7n, fullName: 'openai/codex', readmeFetched: true, descriptionCn: '轻量编码代理' };
        mockRepoService.findByFullName.mockResolvedValue(dbRepo);

        const result = await service.getRepoDetail('openai', 'codex');

        expect(result).toMatchObject({ fullName: 'openai/codex', inLibrary: true, descriptionCn: '轻量编码代理' });
        expect(mockGithubApi.fetchRepoByFullName).not.toHaveBeenCalled();
        expect(mockRepoService.ensureReadmeFetched).not.toHaveBeenCalled();
    });

    it('本地库命中但 README 未获取时应触发按需拉取', async () => {
        const dbRepo = { id: 7n, fullName: 'openai/codex', readmeFetched: false };
        const updated = { ...dbRepo, readmeFetched: true, readmeOriginal: '# Codex' };
        mockRepoService.findByFullName.mockResolvedValue(dbRepo);
        mockRepoService.ensureReadmeFetched.mockResolvedValue(updated);

        const result = await service.getRepoDetail('openai', 'codex');

        expect(mockRepoService.ensureReadmeFetched).toHaveBeenCalledWith(7);
        expect(result).toMatchObject({ readmeOriginal: '# Codex', inLibrary: true });
    });

    it('未入库时应从 GitHub API 组装同构详情且 inLibrary=false', async () => {
        mockRepoService.findByFullName.mockResolvedValue(null);
        mockGithubApi.fetchRepoByFullName.mockResolvedValue({
            repoName: 'codex',
            fullName: 'openai/codex',
            starsCount: 50000,
            topics: '["ai","agent"]',
            starredAt: null,
        });
        mockGithubApi.fetchReadmeFromGitHub.mockResolvedValue({ content: '# Codex README', githubStatus: 200, githubBody: null });

        const result = await service.getRepoDetail('openai', 'codex');

        expect(result).toMatchObject({
            id: null,
            fullName: 'openai/codex',
            descriptionCn: null,
            readmeCn: null,
            readmeOriginal: '# Codex README',
            readmeFetched: true,
            inLibrary: false,
        });
    });

    it('README 拉取失败时不应阻塞详情返回', async () => {
        mockRepoService.findByFullName.mockResolvedValue(null);
        mockGithubApi.fetchRepoByFullName.mockResolvedValue({ repoName: 'codex', fullName: 'openai/codex' });
        mockGithubApi.fetchReadmeFromGitHub.mockRejectedValue(new Error('GitHub API rate limited'));

        const result = await service.getRepoDetail('openai', 'codex');

        expect(result).toMatchObject({ fullName: 'openai/codex', readmeOriginal: null, readmeFetched: true, inLibrary: false });
    });

    it('未入库详情应命中内存缓存，重复请求不再调用 GitHub API', async () => {
        mockRepoService.findByFullName.mockResolvedValue(null);
        mockGithubApi.fetchRepoByFullName.mockResolvedValue({ repoName: 'codex', fullName: 'openai/codex' });
        mockGithubApi.fetchReadmeFromGitHub.mockResolvedValue({ content: 'readme', githubStatus: 200, githubBody: null });

        await service.getRepoDetail('openai', 'codex');
        const second = await service.getRepoDetail('openai', 'codex');

        expect(mockGithubApi.fetchRepoByFullName).toHaveBeenCalledTimes(1);
        expect(second).toMatchObject({ fullName: 'openai/codex', inLibrary: false });
    });
});
