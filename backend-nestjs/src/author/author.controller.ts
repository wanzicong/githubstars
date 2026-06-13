import { Controller, Get, Param, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { AuthorService } from './author.service'

@Controller('api/authors')
export class AuthorController {
  constructor(private readonly service: AuthorService) {}

  @Get()
  async list(@Query() q: any) {
    return this.service.getAuthorPage(parseInt(q.page) || 1, parseInt(q.size) || 24, q.keyword || '')
  }

  @Get(':ownerName')
  async repos(@Param('ownerName') owner: string, @Query() q: any) {
    return this.service.getAuthorRepos(owner, parseInt(q.page) || 1, parseInt(q.size) || 12, q.sortBy || 'starred_at', q.sortOrder || 'desc')
  }

  @Get(':ownerName/export')
  async export(@Param('ownerName') owner: string, @Query() q: any, @Res() res: Response) {
    const urls = await this.service.getAuthorAllRepoUrls(owner, q.sortBy || 'starred_at', q.sortOrder || 'desc')
    res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(owner + '-stars.txt')}` })
    res.send(urls.join('\n'))
  }
}
