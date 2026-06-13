import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { GithubRepoService } from '../github/services/github-repo.service'

@Controller('api/export')
export class ExportController {
  constructor(private readonly repoService: GithubRepoService) {}

  @Get('md')
  async exportMd(@Query() q: any, @Res() res: Response) {
    const result = await this.repoService.findPage({
      page: 1, size: parseInt(q.maxCount) || 50,
      keyword: q.keyword || '', language: q.language || '',
      categoryIds: q.categoryIds || '', sortBy: q.sortBy || 'starred_at',
      sortOrder: q.sortOrder || 'desc',
    })
    const repos = result.records as any[]
    let md = '# GitHub Stars 导出\n\n'
    if (q.keyword) md += `> 关键词: ${q.keyword}\n`
    if (q.language) md += `> 语言: ${q.language}\n`
    md += `> 导出时间: ${new Date().toISOString()}\n\n---\n\n`

    for (const repo of repos) {
      md += `## ${repo.fullName}\n\n`
      md += `- ⭐ ${repo.starsCount} | 🍴 ${repo.forksCount} | 语言: ${repo.language || '未知'}\n`
      md += `- 🔗 [GitHub](${repo.htmlUrl})\n`
      if (repo.homepage) md += `- 🏠 [主页](${repo.homepage})\n`
      const desc = repo.descriptionCn || repo.description
      if (desc) md += `\n${desc}\n`
      if (repo.readmeCn) md += `\n### README 中文翻译\n\n${String(repo.readmeCn).substring(0, 5000)}\n`
      else if (repo.readmeOriginal) md += `\n### README\n\n${String(repo.readmeOriginal).substring(0, 5000)}\n`
      md += '\n---\n\n'
    }

    res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename*=UTF-8\'\'' + encodeURIComponent('github-stars.md') })
    res.send(md)
  }
}
