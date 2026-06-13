/**
 * TranslateService 单元测试
 *
 * 测试重点:
 *   - translateReadme() 的 5 种状态分支
 *   - callDeepSeek 的 429 限流识别 / 超时 / 正常响应
 *   - translateDescription 幂等性
 *
 * 所有外部依赖 (Prisma, ConfigService, GithubApiService, Fetch) 被 Mock。
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TranslateService } from '../../src/translate/services/translate.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '../../src/config/config.service';
import { GithubApiService } from '../../src/github/services/github-api.service';
import { GithubRepoService } from '../../src/github/services/github-repo.service';

function createMockPrisma() {
    return {
        githubRepo: {
            update: jest.fn().mockResolvedValue({}),
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            findUnique: jest.fn().mockResolvedValue(null),
        },
        repoCategory: { findMany: jest.fn().mockResolvedValue([]) },
        category: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
}

function createMockConfig(overrides?: Record<string, string>) {
    const map = new Map(Object.entries(overrides || {}));
    return {
        getValue: jest.fn((key: string) => map.get(key)),
        getValueDefault: jest.fn((key: string, def: string) => map.get(key) || def),
    };
}

function createMockGithubApi() {
    return {
        fetchReadmeFromGitHub: jest.fn(),
    };
}

function createMockGithubRepo(findByIdReturn: any = null) {
    return {
        findById: jest.fn().mockResolvedValue(findByIdReturn),
        findPage: jest.fn().mockResolvedValue({ records: [], total: 0 }),
        fillCategoryNames: jest.fn(),
        expandCategoryIds: jest.fn().mockResolvedValue([]),
    } as any;
}

// Mock global fetch
const mockFetch = jest.fn();

describe('TranslateService', () => {
    let service: TranslateService;
    let mockPrisma: ReturnType<typeof createMockPrisma>;
    let mockConfig: ReturnType<typeof createMockConfig>;
    let mockGithubApi: ReturnType<typeof createMockGithubApi>;
    let mockGithubRepo: ReturnType<typeof createMockGithubRepo>;

    beforeEach(async () => {
        mockPrisma = createMockPrisma();
        mockConfig = createMockConfig({
            'deepseek.api_key': 'sk-test-key',
            'deepseek.api_url': 'https://api.deepseek.com/v1/chat/completions',
            'deepseek.model': 'deepseek-chat',
        });
        mockGithubApi = createMockGithubApi();
        mockGithubRepo = createMockGithubRepo();
        global.fetch = mockFetch;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TranslateService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ConfigService, useValue: mockConfig },
                { provide: GithubApiService, useValue: mockGithubApi },
                { provide: GithubRepoService, useValue: mockGithubRepo },
            ],
        }).compile();
        service = module.get<TranslateService>(TranslateService);
    });

    afterEach(() => {
        mockFetch.mockReset();
    });

    // ==================== callDeepSeek ====================

    describe('callDeepSeek', () => {
        it('API Key 未配置时应返回 null', async () => {
            mockConfig.getValue.mockReturnValue(undefined);
            mockGithubRepo.findById.mockResolvedValue({ id: BigInt(1), description: 'test desc', descriptionCn: null });
            const result = await service.translateDescription(1);
            expect(result).toBeNull();
        });

        it('429 限流时应识别并返回特殊标记 (translateDescription 将转换为 null)', async () => {
            mockFetch.mockResolvedValue({ status: 429, ok: false });
            mockGithubRepo.findById.mockResolvedValue({ id: BigInt(1), description: 'test desc', descriptionCn: null });
            const result = await service.translateDescription(1);
            expect(result).toBeNull(); // translateDescription 将 __RATE_LIMITED__ 转为 null
        });

        it('DeepSeek 返回非 200 且非 429 时应返回 null', async () => {
            mockFetch.mockResolvedValue({ status: 500, ok: false });
            mockGithubRepo.findById.mockResolvedValue({ id: BigInt(1), description: 'test desc', descriptionCn: null });
            const result = await service.translateDescription(1);
            expect(result).toBeNull();
        });

        it('正常响应应返回翻译内容', async () => {
            mockFetch.mockResolvedValue({
                status: 200,
                ok: true,
                json: () => Promise.resolve({ choices: [{ message: { content: '测试翻译' } }] }),
            });
            mockGithubRepo.findById.mockResolvedValue({ id: BigInt(1), description: 'test desc', descriptionCn: null });
            const result = await service.translateDescription(1);
            expect(result).toBe('测试翻译');
            expect(mockPrisma.githubRepo.update).toHaveBeenCalled();
        });
    });

    // ==================== translateDescription 幂等性 ====================

    describe('translateDescription 幂等性', () => {
        it('已有翻译结果时直接返回缓存，不调用 API', async () => {
            mockGithubRepo.findById.mockResolvedValue({
                id: BigInt(1),
                fullName: 'owner/repo',
                description: 'test desc',
                descriptionCn: '已有翻译',
            });
            const result = await service.translateDescription(1);
            expect(result).toBe('已有翻译');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('仓库不存在时返回 null', async () => {
            mockGithubRepo.findById.mockResolvedValue(null);
            const result = await service.translateDescription(999);
            expect(result).toBeNull();
        });

        it('描述为空时返回 null', async () => {
            mockGithubRepo.findById.mockResolvedValue({ id: BigInt(1), description: null, descriptionCn: null });
            const result = await service.translateDescription(1);
            expect(result).toBeNull();
        });
    });

    // ==================== translateReadme 状态机 ====================

    describe('translateReadme 状态机', () => {
        const mockDeepSeekSuccess = () =>
            mockFetch.mockResolvedValue({
                status: 200,
                ok: true,
                json: () => Promise.resolve({ choices: [{ message: { content: '翻译后的README' } }] }),
            });

        it('状态1: 已翻译过 → 直接返回缓存', async () => {
            mockGithubRepo.findById.mockResolvedValue({
                id: BigInt(1),
                fullName: 'owner/repo',
                readmeFetched: true,
                readmeOriginal: '# Hello',
                readmeCn: '已翻译',
            });
            const result = await service.translateReadme(1);
            expect(result).toBe('已翻译');
            expect(mockFetch).not.toHaveBeenCalled();
            expect(mockGithubApi.fetchReadmeFromGitHub).not.toHaveBeenCalled();
        });

        it('状态2: 已获取原始但翻译失败 → 重试翻译（复用原始内容，不走 GitHub API）', async () => {
            mockDeepSeekSuccess();
            mockGithubRepo.findById.mockResolvedValue({
                id: BigInt(1),
                fullName: 'owner/repo',
                readmeFetched: false,
                readmeOriginal: '# Retry',
                readmeCn: null,
            });
            const result = await service.translateReadme(1);
            expect(result).toBe('翻译后的README');
            expect(mockGithubApi.fetchReadmeFromGitHub).not.toHaveBeenCalled();
            expect(mockPrisma.githubRepo.update).toHaveBeenCalled();
        });

        it('状态3: 已标记 fetched 但无 original → 404 过，返回空字符串', async () => {
            mockGithubRepo.findById.mockResolvedValue({
                id: BigInt(1),
                fullName: 'owner/repo',
                readmeFetched: true,
                readmeOriginal: null,
                readmeCn: null,
            });
            const result = await service.translateReadme(1);
            expect(result).toBe('');
            expect(mockGithubApi.fetchReadmeFromGitHub).not.toHaveBeenCalled();
        });

        it('状态4: 首次获取，GitHub 返回 null (无README) → 标记 fetched，返回空', async () => {
            mockFetch.mockResolvedValue({
                status: 200,
                ok: true,
                json: () => Promise.resolve({ choices: [{ message: { content: '翻译' } }] }),
            });
            mockGithubRepo.findById.mockResolvedValue({
                id: BigInt(1),
                fullName: 'owner/repo',
                readmeFetched: false,
                readmeOriginal: null,
                readmeCn: null,
            });
            mockGithubApi.fetchReadmeFromGitHub.mockResolvedValue(null); // 404 → null

            const result = await service.translateReadme(1);
            expect(result).toBe('');
            expect(mockPrisma.githubRepo.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ readmeFetched: true }) }),
            );
        });

        it('状态5: 首次获取成功 → 翻译成功 → 保存翻译 + 标记 fetched', async () => {
            mockDeepSeekSuccess();
            mockGithubRepo.findById.mockResolvedValue({
                id: BigInt(1),
                fullName: 'owner/repo',
                readmeFetched: false,
                readmeOriginal: null,
                readmeCn: null,
            });
            mockGithubApi.fetchReadmeFromGitHub.mockResolvedValue('# Hello World');

            const result = await service.translateReadme(1);
            expect(result).toBe('翻译后的README');
            expect(mockPrisma.githubRepo.update).toHaveBeenCalledTimes(2); // 1次保存original + 1次保存翻译
        });

        it('状态5变体: 首次获取成功但翻译失败 → 保存 original 但不标记 fetched', async () => {
            mockFetch.mockResolvedValue({ status: 500, ok: false }); // 翻译API失败
            mockGithubRepo.findById.mockResolvedValue({
                id: BigInt(1),
                fullName: 'owner/repo',
                readmeFetched: false,
                readmeOriginal: null,
                readmeCn: null,
            });
            mockGithubApi.fetchReadmeFromGitHub.mockResolvedValue('# Hello World');

            const result = await service.translateReadme(1);
            expect(result).toBeNull();
            // 第一次 update: 保存 original（不标记 fetched）
            expect(mockPrisma.githubRepo.update).toHaveBeenCalledTimes(1);
            expect(mockPrisma.githubRepo.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ readmeOriginal: '# Hello World' }) }),
            );
        });
    });
});
