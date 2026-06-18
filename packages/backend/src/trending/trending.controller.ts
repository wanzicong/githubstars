import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { GithubSearchService } from '../github/services/github-search.service';

@ApiTags('trending')
@Controller('api/trending')
export class TrendingController {
    private readonly logger = new Logger(TrendingController.name);

    constructor(
        private readonly search: GithubSearchService,
    ) {}

    /**
     * 获取 GitHub Trending 仓库列表
     * 通过 GitHub Search API 查询指定时间段内创建的高星仓库
     *
     * @param body { since, language, perPage }
     * @returns    Trending 仓库列表及时间范围
     */
    @Post()
    @ApiOperation({ summary: '获取 Trending 仓库', description: '通过 GitHub Search API 查询指定时间段内创建的高星仓库' })
    @ApiBody({ schema: { type: 'object', properties: { since: { type: 'string' }, language: { type: 'string' }, perPage: { type: 'number' } } } })
    async trending(@Body() body: any) {
        const since = body.since || 'daily';
        const language = body.language || '';
        const perPage = parseInt(body.perPage) || 20;
        let days = 1;
        if (since === 'weekly') days = 7;
        else if (since === 'monthly') days = 30;
        const sinceDate = new Date(Date.now() - days * 86400000);
        const dateStr = sinceDate.toISOString().split('T')[0];
        let query = `created:>=${dateStr}`;
        if (language) query += ` language:${language}`;
        this.logger.log('查询趋势仓库: since=' + since + ', language=' + (language || 'all') + ', perPage=' + perPage);
        const result = await this.search.searchRepos(query, '', 'stars', 1, perPage);
        this.logger.log('趋势查询完成: total=' + result.total);
        return {
            success: true,
            since,
            total: result.total,
            repos: result.repos,
            dateRange: `${dateStr} ~ ${new Date().toISOString().split('T')[0]}`,
        };
    }
}
