import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { GithubRepoService } from '../services/github-repo.service';

@ApiTags('similar')
@Controller('api/similar')
export class SimilarController {
    private readonly logger = new Logger(SimilarController.name);

    constructor(private readonly repoService: GithubRepoService) {}

    /**
     * POST /api/similar — 查找相似仓库
     *
     * 根据指定仓库的语言，查找使用相同语言的其他高 Star 仓库作为推荐。
     *
     * @param body { repoId }
     * @returns { success, repos, count }
     */
    @Post()
    @ApiOperation({ summary: '查找相似仓库', description: '根据指定仓库的语言查找相似的高 Star 仓库推荐' })
    @ApiBody({ schema: { type: 'object', properties: { repoId: { type: 'number' } }, required: ['repoId'] } })
    async findSimilar(@Body() body: { repoId: number }) {
        if (!body.repoId || body.repoId <= 0) return { success: false, repos: [], count: 0, message: '无效的仓库ID' };

        const repo = await this.repoService.findById(body.repoId);
        if (!repo) return { success: false, repos: [], count: 0, message: '仓库不存在' };

        // 基于语言匹配查找相似仓库（排除自身）
        const language = repo.language || '';
        const keyword = '';
        const results = await this.repoService.findPage({
            page: 1,
            size: 10,
            keyword,
            language,
            sortBy: 'stars_count',
            sortOrder: 'desc',
        });

        const similarRepos = (results.records as any[])
            .filter((r) => r.id !== repo.id)
            .slice(0, 8)
            .map((r) => ({
                fullName: r.fullName,
                description: r.description || '',
                language: r.language || '',
                stars: r.starsCount || 0,
                forks: r.forksCount || 0,
                htmlUrl: r.htmlUrl || '',
                pushedAt: r.repoPushedAt || '',
                aiReason: `同语言 (${r.language}) 推荐`,
                score: r.starsCount || 0,
            }));

        return { success: true, repos: similarRepos, count: similarRepos.length };
    }
}
