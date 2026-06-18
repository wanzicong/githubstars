import { Controller, Post, Body, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { GithubRepoService } from '../github/services/github-repo.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ExportFilterSchema } from '../common/dto/filter.dto';
import type { ExportFilterDto } from '../common/dto/filter.dto';

@ApiTags('export')
@Controller('api/export')
export class ExportController {
    private readonly logger = new Logger(ExportController.name);

    constructor(private readonly repoService: GithubRepoService) {}

    /**
     * 导出仓库列表为 Markdown 文件，支持按关键词、语言、时间范围、翻译状态筛选
     *
     * @param body 查询参数：keyword、language、sortBy、sortOrder、
     *             dateField、startDate、endDate、untranslatedOnly、maxCount
     * @param res  Express Response 对象，用于设置 Content-Disposition 并返回文件
     */
    @Post('md')
    @ApiOperation({ summary: '导出 Markdown', description: '按筛选条件将仓库列表导出为 Markdown 文件下载' })
    @ApiBody({ schema: { type: 'object', properties: { keyword: { type: 'string' }, language: { type: 'string' }, sortBy: { type: 'string' }, sortOrder: { type: 'string' }, dateField: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, untranslatedOnly: { type: 'string' }, maxCount: { type: 'number' } } } })
    async exportMd(@Body(new ZodValidationPipe(ExportFilterSchema)) body: ExportFilterDto, @Res() res: Response) {
        const maxCount = body.maxCount;
        this.logger.log('开始导出Markdown: keyword=' + (body.keyword || '') + ', language=' + (body.language || '') + ', maxCount=' + maxCount);
        const result = await this.repoService.findPage({
            page: 1,
            size: maxCount,
            keyword: body.keyword,
            language: body.language,
            sortBy: body.sortBy,
            sortOrder: body.sortOrder,
            dateField: body.dateField,
            startDate: body.startDate,
            endDate: body.endDate,
            untranslatedOnly: body.untranslatedOnly,
        });
        const repos = result.records as any[];
        this.logger.log('查询到 ' + repos.length + ' 个仓库，开始生成Markdown');
        let md = '# GitHub Stars 导出\n\n';
        if (body.keyword) md += `> 关键词: ${body.keyword}\n`;
        if (body.language) md += `> 语言: ${body.language}\n`;
        if (body.dateField && (body.startDate || body.endDate)) {
            md += `> 时间范围: ${body.startDate || '不限'} ~ ${body.endDate || '不限'}\n`;
        }
        if (body.untranslatedOnly) md += `> 仅未翻译\n`;
        md += `> 导出时间: ${new Date().toISOString()}\n\n---\n\n`;

        const total = repos.length;
        for (let i = 0; i < repos.length; i++) {
            const repo = repos[i];
            md += `## ${i + 1}. ${repo.fullName}\n\n`;
            md += `> 📋 **第 ${i + 1} / ${total} 个项目**\n\n`;
            md += `- ⭐ ${repo.starsCount} | 🍴 ${repo.forksCount} | 语言: ${repo.language || '未知'}\n`;
            md += `- 🔗 [GitHub](${repo.htmlUrl})\n`;
            if (repo.homepage) md += `- 🏠 [主页](${repo.homepage})\n`;
            const desc = repo.descriptionCn || repo.description;
            if (desc) md += `\n${desc}\n`;
            if (repo.readmeCn) md += `\n### README 中文翻译\n\n${String(repo.readmeCn).substring(0, 5000)}\n`;
            else if (repo.readmeOriginal) md += `\n### README\n\n${String(repo.readmeOriginal).substring(0, 5000)}\n`;
            md += '\n---\n\n';
        }

        res.set({
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent('github-stars.md'),
        });
        res.send(md);
        this.logger.log('导出Markdown完成: ' + repos.length + ' 个仓库');
    }
}
