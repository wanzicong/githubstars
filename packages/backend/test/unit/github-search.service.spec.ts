import { Test } from '@nestjs/testing';
import { GithubSearchService } from '../../src/github/github-search.service';
import { GithubApiService } from '../../src/github/github-api.service';
import { GithubRepoService } from '../../src/github/github-repo.service';
import { ConfigService } from '../../src/config/config.service';

describe('GithubSearchService', () => {
    let service: GithubSearchService;

    const mockConfig = {
        getValue: jest.fn(),
        getValueDefault: jest.fn().mockResolvedValue(''),
    };

    const mockGithubApi = {
        fetchReadmeFromGitHub: jest.fn().mockResolvedValue({ content: null }),
        fetchRepoByFullName: jest.fn().mockResolvedValue(null),
    };

    const mockRepoService = {
        findByFullName: jest.fn().mockResolvedValue(null),
        ensureReadmeFetched: jest.fn().mockResolvedValue(undefined),
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

    describe('searchRepos', () => {
        it('应能调用搜索（无 Token 时也会尝试）', async () => {
            const result = await service.searchRepos('react', '');
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('repos');
            expect(result).toHaveProperty('total');
            expect(Array.isArray(result.repos)).toBe(true);
        });
    });

    describe('starRepo', () => {
        it('应尝试 Star 仓库', async () => {
            const result = await service.starRepo('test-owner', 'test-repo');
            expect(typeof result).toBe('boolean');
        });
    });

    describe('unstarRepo', () => {
        it('应尝试取消 Star 仓库', async () => {
            const result = await service.unstarRepo('test-owner', 'test-repo');
            expect(typeof result).toBe('boolean');
        });
    });

    describe('checkStarred', () => {
        it('应检查星标状态', async () => {
            const result = await service.checkStarred('test-owner', 'test-repo');
            expect(typeof result).toBe('boolean');
        });
    });
});
