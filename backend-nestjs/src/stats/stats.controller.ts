import { Controller, Get, Query } from '@nestjs/common'
import { StatsService } from './stats.service'

@Controller('api/stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @Get('languages') async languages() { return this.service.getLanguageStats() }
  @Get('owners') async owners(@Query('topN') topN: string) { return this.service.getOwnerStats(parseInt(topN) || 15) }
  @Get('timeline') async timeline() { return this.service.getTimelineStats() }
  @Get('overview') async overview() { return this.service.getOverviewStats() }
  @Get('top-starred') async topStarred(@Query('topN') topN: string) { return this.service.getTopStarred(parseInt(topN) || 10) }
  @Get('recent-active') async recentActive(@Query('topN') topN: string) { return this.service.getRecentActive(parseInt(topN) || 10) }
}
