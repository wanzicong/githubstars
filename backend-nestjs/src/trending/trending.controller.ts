import { Controller, Get, Post, Query } from '@nestjs/common';
import { GithubSearchService } from '../github/services/github-search.service';
import { AiAnalyzeService } from '../ai/services/ai-analyze.service';

@Controller('api/trending')
export class TrendingController {
    constructor(
        private readonly search: GithubSearchService,
        private readonly ai: AiAnalyzeService,
    ) {}

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
        const result = await this.search.searchRepos(query, '', 'stars', 1, perPage);
        return {
            success: true,
            since,
            total: result.total,
            repos: result.repos,
            dateRange: `${dateStr} ~ ${new Date().toISOString().split('T')[0]}`,
        };
    }

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
        const result = await this.search.searchRepos(query, '', 'stars', 1, 20);
        const taskId = this.ai.createTrendingAnalyzeTask(since, language, result.repos as any[]);
        return { success: true, taskId, message: '趋势分析已启动' };
    }
}
