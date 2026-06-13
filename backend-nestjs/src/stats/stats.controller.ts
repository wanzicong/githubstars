import { Controller, Get, Logger, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('api/stats')
export class StatsController {
    private readonly logger = new Logger(StatsController.name);

    constructor(private readonly service: StatsService) {}

    /**
     * 获取编程语言统计
     *
     * @returns 各语言仓库数量及占比
     */
    @Get('languages')
    async languages() {
        return this.service.getLanguageStats();
    }

    /**
     * 获取仓库所有者排名统计
     *
     * @param topN 返回的排名数量，默认15
     * @returns 所有者排名列表
     */
    @Get('owners')
    async owners(@Query('topN') topN: string) {
        return this.service.getOwnerStats(parseInt(topN) || 15);
    }

    /**
     * 获取 Star 时间线统计
     *
     * @returns 按月份聚合的 Star 数量增长趋势
     */
    @Get('timeline')
    async timeline() {
        return this.service.getTimelineStats();
    }

    /**
     * 获取整体概览统计
     *
     * @returns 仓库总数、Star/Fork 总数、语言/所有者种类数
     */
    @Get('overview')
    async overview() {
        return this.service.getOverviewStats();
    }

    /**
     * 获取 Star 数量排行榜
     *
     * @param topN 返回的仓库数量，默认10
     * @returns 按 starsCount 降序排列的仓库列表
     */
    @Get('top-starred')
    async topStarred(@Query('topN') topN: string) {
        return this.service.getTopStarred(parseInt(topN) || 10);
    }

    /**
     * 获取最近活跃仓库列表
     *
     * @param topN 返回的仓库数量，默认10
     * @returns 按 repoUpdatedAt 降序排列的仓库列表
     */
    @Get('recent-active')
    async recentActive(@Query('topN') topN: string) {
        return this.service.getRecentActive(parseInt(topN) || 10);
    }
}
