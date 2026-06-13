import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

/**
 * 统计模块
 *
 * 提供多维度的 Star 仓库统计分析：语言分布、所有者排名、时间线趋势、整体概览、Star 排行、活跃度。
 * 依赖数据库直连，无需外部服务模块。
 */
@Module({
    controllers: [StatsController],
    providers: [StatsService],
})
export class StatsModule {}
