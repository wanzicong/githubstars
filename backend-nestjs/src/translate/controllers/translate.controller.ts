import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common'
import { TranslateService } from '../services/translate.service'
import { TranslateTaskService } from '../services/translate-task.service'
import { GithubRepoService } from '../../github/services/github-repo.service'

@Controller('api/translate')
export class TranslateController {
  constructor(
    private readonly service: TranslateService,
    private readonly taskService: TranslateTaskService,
    private readonly repoService: GithubRepoService,
  ) {}

  @Post(':id/description')
  async translateDesc(@Param('id') id: string) {
    const result = await this.service.translateDescription(parseInt(id))
    return { success: true, descriptionCn: result }
  }

  @Post(':id/readme')
  async translateReadme(@Param('id') id: string) {
    const result = await this.service.translateReadme(parseInt(id))
    return { success: true, readmeCn: result }
  }

  @Post(':id/readme/async')
  async translateReadmeAsync(@Param('id') id: string) {
    const taskId = await this.taskService.createAndStartSingleReadme(parseInt(id))
    if (!taskId) return { success: false, message: '仓库不存在' }
    return { success: true, taskId, message: '翻译任务已启动' }
  }

  @Post(':id/readme/retranslate')
  async translateReadmeRetranslate(@Param('id') id: string) {
    const taskId = await this.taskService.createAndStartSingleReadmeForce(parseInt(id))
    if (!taskId) return { success: false, message: '仓库不存在' }
    return { success: true, taskId, message: '重新翻译任务已启动' }
  }

  @Post(':id')
  async translateFull(@Param('id') id: string) {
    const repo = await this.repoService.findById(parseInt(id))
    if (!repo) return { success: false, message: '仓库不存在' }
    const desc = await this.service.translateDescription(parseInt(id))
    const readme = await this.service.translateReadme(parseInt(id))
    return { success: true, descriptionCn: desc, readmeCn: readme, readmeFetched: !!readme }
  }

  @Get(':id/status')
  async status(@Param('id') id: string) {
    const repo = await this.repoService.findById(parseInt(id))
    if (!repo) return { success: false, message: '仓库不存在' }
    return { success: true, descriptionTranslated: !!repo.descriptionCn, readmeFetched: repo.readmeFetched, descriptionCn: repo.descriptionCn, readmeCn: repo.readmeCn }
  }

  @Post('batch')
  async translateBatch(@Body() b: any) {
    const count = await this.service.translateDescriptionsBatch(b?.repoIds)
    return { success: true, translatedCount: count, total: b?.repoIds?.length }
  }

  @Post('readme-start')
  async readmeBatchStart() {
    const taskId = await this.taskService.createAndStartReadmeBatch()
    if (!taskId) return { success: false, message: '没有需要翻译 README 的项目' }
    return { success: true, taskId, message: 'README批量翻译已启动' }
  }

  @Post('start')
  async fullTranslateStart() {
    const taskId = await this.taskService.createAndStartFullTranslate()
    if (!taskId) return { success: false, message: '没有需要翻译的项目' }
    return { success: true, taskId, message: '全量翻译已启动' }
  }

  /** P0-3 FIX: filter-batch translateType 已是 'readme' */
  @Post('filter-batch')
  async filterBatch(@Query() q: any) {
    const taskId = await this.taskService.createAndStartFilterBatch({
      keyword: q.keyword || '', language: q.language || '', categoryIds: q.categoryIds || '',
      sortBy: q.sortBy || 'starred_at', sortOrder: q.sortOrder || 'desc',
      dateField: q.dateField || '', startDate: q.startDate || '', endDate: q.endDate || '',
    })
    if (!taskId) return { success: false, message: '没有需要翻译的项目' }
    return { success: true, taskId, message: '筛选翻译已启动' }
  }

  @Get('task/:taskId')
  async taskProgress(@Param('taskId') taskId: string) { return this.taskService.getTaskProgress(parseInt(taskId)) }

  @Post('task/:taskId/retry')
  async taskRetry(@Param('taskId') taskId: string) {
    const newId = await this.taskService.retryFailed(parseInt(taskId))
    if (!newId) return { success: false, message: '没有失败项需要重试' }
    return { success: true, taskId: newId, message: '重试任务已启动' }
  }

  @Get('task/:taskId/failures')
  async taskFailures(@Param('taskId') taskId: string) { return this.taskService.getFailures(parseInt(taskId)) }

  @Get('tasks')
  async taskList() { return this.taskService.getRecentTasks() }
}
