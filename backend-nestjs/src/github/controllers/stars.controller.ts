import { Controller, Get, Param, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { GithubRepoService } from '../services/github-repo.service'

@Controller()
export class StarsController {
  constructor(private readonly service: GithubRepoService) {}

  @Get('api/stars')
  async list(@Query() q: any) {
    return this.service.findPage({
      page: parseInt(q.page) || 1, size: parseInt(q.size) || 12,
      keyword: q.keyword || '', language: q.language || '',
      categoryIds: q.categoryIds || '', sortBy: q.sortBy || 'starred_at',
      sortOrder: q.sortOrder || 'desc', dateField: q.dateField || '',
      startDate: q.startDate || '', endDate: q.endDate || '',
      untranslatedOnly: q.untranslatedOnly === 'true',
    })
  }

  @Get('api/stars/:id')
  async detail(@Param('id') id: string) {
    return this.service.findById(parseInt(id))
  }

  @Get('stars/export')
  async export(@Query() q: any, @Res() res: Response) {
    const urls = await this.service.findAllUrls({
      keyword: q.keyword || '', language: q.language || '',
      categoryIds: q.categoryIds || '', sortBy: q.sortBy || 'starred_at',
      sortOrder: q.sortOrder || 'desc', dateField: q.dateField || '',
      startDate: q.startDate || '', endDate: q.endDate || '',
    })
    res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="stars-export.txt"' })
    res.send(urls.join('\n'))
  }

  @Get('api/stars/export')
  async exportApi(@Query() q: any, @Res() res: Response) {
    return this.export(q, res)
  }
}
