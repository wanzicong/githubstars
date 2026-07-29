import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { GithubSearchService } from '../github/github-search.service';
import { TrendingService } from './trending.service';
import { DownloadService } from '../download/download.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TrendingSchema } from '../common/dto/filter.dto';
import type { TrendingDto } from '../common/dto/filter.dto';
import { DownloadTrendingSchema } from './trending.dto';
import type { DownloadTrendingDto } from './trending.dto';

/** 将 since 字符串映射为天数 */
function sinceToDays(since: string): number {
    if (since === 'weekly') return 7;
    if (since === 'monthly') return 30;
    return 1;
}

/** 构建 GitHub Search 查询字符串和日期范围 */
function buildTrendingQuery(since: string, language?: string): { query: string; dateStr: string } {
    const days = sinceToDays(since);
    const sinceDate = new Date(Date.now() - days * 86400000);
    const dateStr = sinceDate.toISOString().split('T')[0];
    let query = `created:>=${dateStr}`;
    if (language) query += ` language:${language}`;
    return { query, dateStr };
}

@ApiTags('trending')
@Controller('api/trending')
export class TrendingController {
    private readonly logger = new Logger(TrendingController.name);

    constructor(
        private readonly search: GithubSearchService,
        private readonly trendingService: TrendingService,
        private readonly downloadService: DownloadService,
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
    @ApiBody({
        schema: { type: 'object', properties: { since: { type: 'string' }, language: { type: 'string' }, perPage: { type: 'number' } } },
    })
    async trending(@Body(new ZodValidationPipe(TrendingSchema)) body: TrendingDto) {
        const { since, language, perPage } = body;
        const { query, dateStr } = buildTrendingQuery(since, language);
        this.logger.log('查询趋势仓库: since=' + since + ', language=' + (language || 'all') + ', perPage=' + perPage);
        const result = await this.search.searchRepos(query, '', 'stars', 1, perPage);
        this.logger.log('趋势查询完成: total=' + result.total);

        // 补充已缓存的中文描述
        const enrichedRepos = await this.trendingService.enrichWithCachedTranslations(result.repos);

        return {
            success: true,
            since,
            total: result.total,
            repos: enrichedRepos,
            dateRange: `${dateStr} ~ ${new Date().toISOString().split('T')[0]}`,
        };
    }

    /**
     * POST /api/trending/download — 下载趋势仓库
     *
     * 获取当前趋势仓库列表，确保仓库在本地 DB 中存在，然后创建下载任务。
     * 可指定下载目录、并发数、镜像源等参数。
     *
     * @param body { since, language, perPage, targetDir, concurrency, mirrorSources, extractArchive, deleteAfterExtract }
     * @returns { success, taskId?, message }
     */
    @Post('download')
    @ApiOperation({ summary: '下载趋势仓库', description: '获取趋势仓库列表并创建下载任务' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                since: { type: 'string' },
                language: { type: 'string' },
                perPage: { type: 'number' },
                targetDir: { type: 'string' },
                concurrency: { type: 'number' },
                mirrorSources: { type: 'array', items: { type: 'string' } },
                extractArchive: { type: 'boolean' },
                deleteAfterExtract: { type: 'boolean' },
            },
        },
    })
    async downloadTrending(@Body(new ZodValidationPipe(DownloadTrendingSchema)) body: DownloadTrendingDto) {
        const { since, language, perPage, targetDir, concurrency, mirrorSources, extractArchive, deleteAfterExtract } = body;
        this.logger.log('下载趋势仓库: since=' + since + ', language=' + (language || 'all') + ', perPage=' + perPage);

        const { query } = buildTrendingQuery(since, language);
        const result = await this.search.searchRepos(query, '', 'stars', 1, perPage);

        if (!result.repos?.length) {
            return { success: false, message: '没有获取到趋势仓库' };
        }

        // 补充中文描述缓存并获取本地 repoId
        const enriched = await this.trendingService.enrichWithCachedTranslations(result.repos);

        // 确保趋势仓库在本地 DB 中存在
        const localRepoIds = await this.trendingService.batchEnsureReposExist(enriched);
        if (!localRepoIds.length) {
            return { success: false, message: '没有可下载的仓库' };
        }

        this.logger.log('趋势下载: 找到 ' + localRepoIds.length + ' 个仓库，创建下载任务');

        // 创建下载任务
        const downloadResult = await this.downloadService.createTask({
            repoIds: localRepoIds,
            targetDir,
            concurrency,
            mirrorSources,
            extractArchive,
            deleteAfterExtract,
        });

        return downloadResult;
    }
}
