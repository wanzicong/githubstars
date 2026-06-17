import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
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
     * @param q  查询参数：since（daily/weekly/monthly）、language、perPage
     * @returns   Trending 仓库列表及时间范围
     */
    @Get()
    @ApiOperation({ summary: '获取 Trending 仓库', description: '通过 GitHub Search API 查询指定时间段内创建的高星仓库' })
    @ApiQuery({ name: 'since', required: false, description: '时间范围（daily/weekly/monthly），默认 daily' })
    @ApiQuery({ name: 'language', required: false, description: '编程语言筛选' })
    @ApiQuery({ name: 'perPage', required: false, description: '每页数量，默认 20' })
    async trending(@Query() q: any) {
        const since = q.since || 'daily';
        const language = q.language || '';
        const perPage = parseInt(q.perPage) || 20;
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
