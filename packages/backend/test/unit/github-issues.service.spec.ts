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

    it('应查询 Issue 正文和评论并标记评论是否截断', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        id: 101,
                        number: 42,
                        state: 'open',
                        state_reason: null,
                        title: 'Fix startup crash',
                        body: 'Issue body',
                        html_url: 'https://github.com/openai/codex/issues/42',
                        user: {
                            login: 'octocat',
                            avatar_url: 'https://example.com/avatar.png',
                            html_url: 'https://github.com/octocat',
                        },
                        labels: [{ name: 'bug', color: 'd73a4a', description: 'Something is broken' }],
                        assignees: [],
                        comments: 2,
                        locked: false,
                        active_lock_reason: null,
                        milestone: null,
                        author_association: 'MEMBER',
                        reactions: { total_count: 3, '+1': 2, heart: 1 },
                        created_at: '2026-07-01T00:00:00Z',
                        updated_at: '2026-07-02T00:00:00Z',
                        closed_at: null,
                    }),
                    { status: 200 },
                ),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify([
                        {
                            id: 201,
                            body: 'First comment',
                            html_url: 'https://github.com/openai/codex/issues/42#issuecomment-201',
                            user: {
                                login: 'contributor',
                                avatar_url: 'https://example.com/contributor.png',
                                html_url: 'https://github.com/contributor',
                            },
                            author_association: 'CONTRIBUTOR',
                            reactions: { total_count: 1, eyes: 1 },
                            created_at: '2026-07-03T00:00:00Z',
                            updated_at: '2026-07-03T00:00:00Z',
                        },
                    ]),
                    { status: 200 },
                ),
            );
        global.fetch = fetchMock as typeof fetch;

        const result = await service.fetchRepoIssueDetail('openai/codex', 42);

        expect(result.number).toBe(42);
        expect(result.body).toBe('Issue body');
        expect(result.authorAssociation).toBe('MEMBER');
        expect(result.reactions).toMatchObject({ totalCount: 3, plusOne: 2, heart: 1 });
        expect(result.comments).toBe(2);
        expect(result.commentsTruncated).toBe(true);
        expect(result.commentItems).toHaveLength(1);
        expect(result.commentItems[0]).toMatchObject({
            id: 201,
            body: 'First comment',
            authorAssociation: 'CONTRIBUTOR',
        });
        expect(result.commentItems[0]?.reactions.eyes).toBe(1);

        const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
        expect(calls[0]?.[0]).toBe('https://api.github.com/repos/openai/codex/issues/42');
        expect(calls[0]?.[1].headers).toBeDefined();
        expect(calls[1]?.[0]).toBe('https://api.github.com/repos/openai/codex/issues/42/comments?per_page=100&page=1');
        expect(calls[1]?.[1].headers).toBeDefined();
    });

    it('详情编号对应 Pull Request 时应拒绝返回', async () => {
        global.fetch = jest.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    id: 101,
                    number: 42,
                    title: 'A pull request',
                    html_url: 'https://github.com/openai/codex/pull/42',
                    pull_request: {},
                }),
                { status: 200 },
            ),
        ) as typeof fetch;

        await expect(service.fetchRepoIssueDetail('openai/codex', 42)).rejects.toMatchObject({
            status: 400,
            message: '该编号对应 Pull Request，不是 Issue',
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
