import { Injectable, Logger } from '@nestjs/common';
import { ITool, ToolRiskLevel, ToolExecutionContext } from '../tool.interface';
import { GithubSearchService } from '../../../github/github-search.service';

/**
 * GitHub 搜索工具。
 *
 * 搜索 GitHub 上的公开仓库（非本地 Star 列表）。
 */
@Injectable()
export class GithubSearchReposTool implements ITool {
    readonly name = 'github_search_repos';
    readonly displayName = 'GitHub 搜索仓库';
    readonly description = '在 GitHub 上搜索公开仓库，支持关键词和编程语言筛选。返回仓库名、描述、Star 数、语言等信息。';
    readonly source = 'builtin' as const;
    readonly riskLevel = ToolRiskLevel.LOW;
    readonly inputSchema = {
        type: 'object',
        properties: {
            keyword: { type: 'string', description: '搜索关键词' },
            language: { type: 'string', description: '编程语言，如 TypeScript、Python' },
            sort: { type: 'string', description: '排序方式: stars/forks/updated', default: 'stars' },
            page: { type: 'number', description: '页码，默认 1', default: 1 },
        },
        required: ['keyword'],
    };

    private readonly logger = new Logger(GithubSearchReposTool.name);

    constructor(private readonly githubSearch: GithubSearchService) {}

    async execute(input: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
        const keyword = (input.keyword as string) || '';
        const language = (input.language as string) || '';
        const sort = (input.sort as string) || 'stars';
        const page = (input.page as number) || 1;

        this.logger.log(`[github_search_repos] keyword="${keyword}" language="${language}"`);

        const result = await this.githubSearch.searchRepos(keyword, language, sort, page, 20);

        return {
            success: result.success,
            total: result.total,
            page: result.page,
            repos: result.repos?.slice(0, 10) || [],
        };
    }
}
