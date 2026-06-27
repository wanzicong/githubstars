import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { ExportService } from './export.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ExportFilterSchema } from '../common/dto/filter.dto';
import type { ExportFilterDto } from '../common/dto/filter.dto';

@ApiTags('export')
@Controller('api/export')
export class ExportController {
    constructor(private readonly exportService: ExportService) {}

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
        const md = await this.exportService.generateMarkdown(body, body.maxCount);
        res.set({
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent('github-stars.md'),
        });
        res.send(md);
    }
}
