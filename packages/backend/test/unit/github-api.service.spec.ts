import { Test } from '@nestjs/testing';
import { GithubApiService } from '../../src/github/github-api.service';
import { ConfigService } from '../../src/config/config.service';

describe('GithubApiService', () => {
    let service: GithubApiService;
    let config: any;

    const mockConfig = {
        getValue: jest.fn(),
        getValueDefault: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await Test.createTestingModule({
            providers: [GithubApiService, { provide: ConfigService, useValue: mockConfig }],
        }).compile();
        service = module.get(GithubApiService);
        config = mockConfig;
    });

    describe('fetchAllStarredRepos', () => {
        it('未配置用户名时应返回空数组', async () => {
            config.getValue.mockResolvedValue(undefined);
            const repos = await service.fetchAllStarredRepos();
            expect(repos).toEqual([]);
        });
    });

    describe('fetchReadmeFromGitHub', () => {
        it.skip('需要网络，跳过单元测试', () => {
            // fetchReadmeFromGitHub 需要真实网络请求，在单元测试中跳过
            expect(service.fetchReadmeFromGitHub).toBeDefined();
        });
    });

    describe('searchRepos', () => {
        it('应返回 GitHub 搜索结果', async () => {
            config.getValue.mockResolvedValue('fake-token');
            const result = await service.searchRepos('react', 'stars', 'desc', 10);
            expect(Array.isArray(result)).toBe(true);
        });
    });
});
