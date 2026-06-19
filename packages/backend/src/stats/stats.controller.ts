import { Controller, Post, Logger, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('api/stats')
/**
 * 统计 Controller — 提供仓库数据的多维统计分析
 *
 * 架构层级：Controller 层，负责接收 HTTP 请求并委托 StatsService 处理。
 *
 * @callers
 *   - 前端 StarList 页面（概览统计、语言分布）
 *   - 前端 Stats 页面（全量统计图表）
 *
 * @depends
 *   - StatsService.getLanguageStats()  — 编程语言分布
 *   - StatsService.getOwnerStats()      — 仓库所有者排名
 *   - StatsService.getTimelineStats()   — Star 时间线
 *   - StatsService.getOverviewStats()   — 整体概览
 *   - StatsService.getTopStarred()      — Star 排行榜
 *   - StatsService.getRecentActive()    — 最近活跃仓库
 */
export class StatsController {
    private readonly logger = new Logger(StatsController.name);

    constructor(private readonly service: StatsService) {}

    /**
     * 获取编程语言统计
     *
     * @returns 各语言仓库数量及占比
     */
    @Post('languages')
    @ApiOperation({ summary: '编程语言分布', description: '返回各编程语言的仓库数量及百分比占比' })
    async languages() {
        return this.service.getLanguageStats();
    }

    /**
     * 获取仓库所有者排名统计
     *
     * @param body { topN }
     * @returns 所有者排名列表
     */
    @Post('owners')
    @ApiOperation({ summary: '仓库所有者排名', description: '按 Star 总数降序返回所有者排名' })
    @ApiBody({ schema: { type: 'object', properties: { topN: { type: 'number' } } } })
    async owners(@Body() body: { topN?: number }) {
        return this.service.getOwnerStats(body.topN || 15);
    }

    /**
     * 获取 Star 时间线统计
     *
     * @returns 按月份聚合的 Star 数量增长趋势
     */
    @Post('timeline')
    @ApiOperation({ summary: 'Star 时间线', description: '按月份聚合的 Star 数量增长趋势' })
    async timeline() {
        return this.service.getTimelineStats();
    }

    /**
     * 获取整体概览统计
     *
     * @returns 仓库总数、Star/Fork 总数、语言/所有者种类数
     */
    @Post('overview')
    @ApiOperation({ summary: '整体概览', description: '返回仓库总数、Star/Fork 总数、语言/所有者种类数等概览数据' })
    async overview() {
        return this.service.getOverviewStats();
    }

    /**
     * 获取 Star 数量排行榜
     *
     * @param body { topN }
     * @returns 按 starsCount 降序排列的仓库列表
     */
    @Post('top-starred')
    @ApiOperation({ summary: 'Star 排行榜', description: '按 starsCount 降序返回 Top N 仓库' })
    @ApiBody({ schema: { type: 'object', properties: { topN: { type: 'number' } } } })
    async topStarred(@Body() body: { topN?: number }) {
        return this.service.getTopStarred(body.topN || 10);
    }

    /**
     * 获取最近活跃仓库列表
     *
     * @param body { topN }
     * @returns 按 repoUpdatedAt 降序排列的仓库列表
     */
    @Post('recent-active')
    @ApiOperation({ summary: '最近活跃仓库', description: '按 repoUpdatedAt 降序返回最近更新的仓库' })
    @ApiBody({ schema: { type: 'object', properties: { topN: { type: 'number' } } } })
    async recentActive(@Body() body: { topN?: number }) {
        return this.service.getRecentActive(body.topN || 10);
    }
}
