import { Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { GithubSearchService } from '../github/services/github-search.service';
import { AiAnalyzeService } from '../ai/services/ai-analyze.service';

@Controller('api/trending')
export class TrendingController {
    private readonly logger = new Logger(TrendingController.name);

    constructor(
        private readonly search: GithubSearchService,
        private readonly ai: AiAnalyzeService,
    ) {}

    /**
     * 获取 GitHub Trending 仓库列表
     * 通过 GitHub Search API 查询指定时间段内创建的高星仓库
     *
     * @param q  查询参数：since（daily/weekly/monthly）、language、perPage
     * @returns   Trending 仓库列表及时间范围
     */
    @Get()
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

    /**
     * 启动趋势分析任务：查询 Trending 仓库并创建 AI 分析任务（后台异步执行）
     *
     * @param q  查询参数：since（daily/weekly/monthly）、language
     * @returns   包含 taskId 的响应，可通过 taskId 查询分析结果
     */
    @Post('analyze')
    async analyze(@Query() q: any) {
        const since = q.since || 'daily';
        const language = q.language || '';
        let days = 1;
        if (since === 'weekly') days = 7;
        else if (since === 'monthly') days = 30;
        const sinceDate = new Date(Date.now() - days * 86400000);
        const dateStr = sinceDate.toISOString().split('T')[0];
        let query = `created:>=${dateStr}`;
        if (language) query += ` language:${language}`;
        this.logger.log('开始趋势分析: since=' + since + ', language=' + (language || 'all'));
        const result = await this.search.searchRepos(query, '', 'stars', 1, 20);
        const taskId = this.ai.createTrendingAnalyzeTask(since, language, result.repos as any[]);
        this.logger.log('趋势分析任务已创建: taskId=' + taskId);
        return { success: true, taskId, message: '趋势分析已启动' };
    }
}
