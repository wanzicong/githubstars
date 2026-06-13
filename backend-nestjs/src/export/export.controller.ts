import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GithubRepoService } from '../github/services/github-repo.service';

@ApiTags('export')
@Controller('api/export')
export class ExportController {
    private readonly logger = new Logger(ExportController.name);

    constructor(private readonly repoService: GithubRepoService) {}

    /**
     * 导出仓库列表为 Markdown 文件，支持按关键词、语言、时间范围、分类、翻译状态筛选
     *
     * @param q   查询参数：keyword、language、categoryIds、sortBy、sortOrder、
     *            dateField、startDate、endDate、untranslatedOnly、maxCount
     * @param res Express Response 对象，用于设置 Content-Disposition 并返回文件
     */
    @Get('md')
    @ApiOperation({ summary: '导出 Markdown', description: '按筛选条件将仓库列表导出为 Markdown 文件下载' })
    @ApiQuery({ name: 'keyword', required: false, description: '关键词搜索' })
    @ApiQuery({ name: 'language', required: false, description: '编程语言筛选' })
    @ApiQuery({ name: 'categoryIds', required: false, description: '分类 ID（逗号分隔）' })
    @ApiQuery({ name: 'sortBy', required: false, description: '排序字段，默认 starred_at' })
    @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向（asc/desc），默认 desc' })
    @ApiQuery({ name: 'dateField', required: false, description: '日期筛选字段' })
    @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
    @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
    @ApiQuery({ name: 'untranslatedOnly', required: false, description: '仅未翻译（true/false）' })
    @ApiQuery({ name: 'maxCount', required: false, description: '最大导出数量，默认 50' })
    async exportMd(@Query() q: any, @Res() res: Response) {
        const maxCount = parseInt(q.maxCount) || 50;
        this.logger.log(
            '开始导出Markdown: keyword=' + (q.keyword || '') + ', language=' + (q.language || '') + ', maxCount=' + maxCount,
        );
        const result = await this.repoService.findPage({
            page: 1,
            size: maxCount,
            keyword: q.keyword || '',
            language: q.language || '',
            categoryIds: q.categoryIds || '',
            sortBy: q.sortBy || 'starred_at',
            sortOrder: q.sortOrder || 'desc',
            dateField: q.dateField || '',
            startDate: q.startDate || '',
            endDate: q.endDate || '',
            untranslatedOnly: q.untranslatedOnly === 'true',
        });
        const repos = result.records as any[];
        this.logger.log('查询到 ' + repos.length + ' 个仓库，开始生成Markdown');
        let md = '# GitHub Stars 导出\n\n';
        if (q.keyword) md += `> 关键词: ${q.keyword}\n`;
        if (q.language) md += `> 语言: ${q.language}\n`;
        if (q.dateField && (q.startDate || q.endDate)) {
            md += `> 时间范围: ${q.startDate || '不限'} ~ ${q.endDate || '不限'}\n`;
        }
        if (q.untranslatedOnly === 'true') md += `> 仅未翻译\n`;
        md += `> 导出时间: ${new Date().toISOString()}\n\n---\n\n`;

        for (let i = 0; i < repos.length; i++) {
            const repo = repos[i];
            md += `## ${i + 1}. ${repo.fullName}\n\n`;
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
