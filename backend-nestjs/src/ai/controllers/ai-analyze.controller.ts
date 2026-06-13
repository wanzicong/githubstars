import { Controller, Post, Get, Param, Query } from '@nestjs/common'
import { AiAnalyzeService } from '../services/ai-analyze.service'

@Controller('api/analyze')
export class AiAnalyzeController {
  constructor(private readonly service: AiAnalyzeService) {}

  @Post('start')
  async start(@Query() q: any) {
    const taskId = this.service.createAnalyzeTask(
      q.keyword || '', q.language || '', q.categoryIds || '',
      q.sortBy || 'starred_at', q.sortOrder || 'desc',
    )
    return { success: true, taskId, message: 'AI分析任务已启动' }
  }

  @Get('task/:taskId')
  async task(@Param('taskId') taskId: string) {
    return this.service.getTaskStatus(taskId)
  }
}
