import { Test } from '@nestjs/testing';
import { GithubApiService } from '../../src/github/github-api.service';
import { ConfigService } from '../../src/config/config.service';

describe('GithubApiService Issues', () => {
    let service: GithubApiService;
    const originalFetch = global.fetch;
    const mockConfig = {
        getValueDefault: jest.fn(),
    };

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

    it('应限定当前仓库、排除 PR 并映射 Issue 列表', async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    total_count: 1,
                    incomplete_results: false,
                    items: [
                        {
                            id: 101,
                            number: 42,
                            state: 'open',
                            state_reason: null,
                            title: 'Fix startup crash',
                            html_url: 'https://github.com/openai/codex/issues/42',
                            user: {
                                login: 'octocat',
                                avatar_url: 'https://example.com/avatar.png',
                                html_url: 'https://github.com/octocat',
                            },
                            labels: [{ name: 'bug', color: 'd73a4a', description: 'Something is broken' }, 'help wanted'],
                            assignees: [],
                            comments: 3,
                            locked: false,
                            milestone: { title: 'v1.0' },
                            created_at: '2026-07-01T00:00:00Z',
                            updated_at: '2026-07-02T00:00:00Z',
                            closed_at: null,
                        },
                    ],
                }),
                { status: 200 },
            ),
        );
        global.fetch = fetchMock as typeof fetch;

        const result = await service.fetchRepoIssues('openai/codex', {
            state: 'open',
            query: 'crash repo:other/project OR state:closed is:pr label:bug',
            sort: 'comments',
            order: 'desc',
            page: 2,
            perPage: 20,
        });

        expect(result).toMatchObject({
            totalCount: 1,
            incompleteResults: false,
            page: 2,
            perPage: 20,
        });
        expect(result.items[0]).toMatchObject({
            id: 101,
            number: 42,
            state: 'open',
            title: 'Fix startup crash',
            comments: 3,
            milestoneTitle: 'v1.0',
            user: { login: 'octocat' },
            labels: [
                { name: 'bug', color: 'd73a4a' },
                { name: 'help wanted', color: 'd0d7de' },
            ],
        });

        const [requestUrl, requestOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
        const url = new URL(requestUrl);
        expect(url.pathname).toBe('/search/issues');
        expect(url.searchParams.get('q')).toBe('repo:openai/codex is:issue state:open crash label:bug');
        expect(url.searchParams.get('sort')).toBe('comments');
        expect(url.searchParams.get('page')).toBe('2');
        expect(requestOptions.headers).toMatchObject({
            Authorization: 'Bearer test-token',
            'X-GitHub-Api-Version': '2022-11-28',
        });
    });

    it('GitHub 限流时应转换为 429 错误', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValue(new Response(JSON.stringify({ message: 'API rate limit exceeded' }), { status: 403 })) as typeof fetch;

        await expect(service.fetchRepoIssues('openai/codex')).rejects.toMatchObject({
            status: 429,
            message: 'GitHub API 请求过于频繁，请稍后重试',
        });
    });

    it('仓库名称格式异常时不应发起 GitHub 请求', async () => {
        const fetchMock = jest.fn();
        global.fetch = fetchMock as typeof fetch;

        await expect(service.fetchRepoIssues('invalid-name')).rejects.toMatchObject({
            status: 400,
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
