import { Controller, Post, Logger, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { GithubRepoService } from './github-repo.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FilterSchema } from '../common/dto/filter.dto';
import type { FilterDto } from '../common/dto/filter.dto';

@ApiTags('stars')
@Controller('api/stars')
export class StarsController {
    private readonly logger = new Logger(StarsController.name);

    constructor(private readonly service: GithubRepoService) {}

    /**
     * 获取星标仓库分页列表
     *
     * 支持关键词搜索、语言筛选、分类筛选、日期范围筛选、排序和分页。
     *
     * @param body { page, size, keyword, language, sortBy, sortOrder, dateField, startDate, endDate, untranslatedOnly }
     * @returns 分页结果（records、total、size、current、pages）
     */
    @Post('list')
    @ApiOperation({ summary: '获取星标仓库列表', description: '分页获取 Star 仓库，支持多维度筛选、排序和分页' })
    @ApiBody({ schema: { type: 'object', properties: { page: { type: 'number' }, size: { type: 'number' }, keyword: { type: 'string' }, language: { type: 'string' }, sortBy: { type: 'string' }, sortOrder: { type: 'string' }, dateField: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, untranslatedOnly: { type: 'boolean' } } } })
    async list(@Body(new ZodValidationPipe(FilterSchema)) body: FilterDto) {
        this.logger.log('获取星标仓库列表: page=' + body.page + ', size=' + body.size);
        return this.service.findPage({
            page: body.page,
            size: body.size,
            keyword: body.keyword,
            language: body.language,
            sortBy: body.sortBy,
            sortOrder: body.sortOrder,
            dateField: body.dateField,
            startDate: body.startDate,
            endDate: body.endDate,
            untranslatedOnly: body.untranslatedOnly,
        });
    }

    /**
     * 获取单个星标仓库详情
     *
     * @param body { id }
     * @returns 仓库详情对象（含分类名称），ID 无效或不存在时返回错误信息
     */
    @Post('detail')
    @ApiOperation({ summary: '获取仓库详情', description: '根据仓库 ID 获取详细信息（含分类名称）' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async detail(@Body() body: { id: number }) {
        const numId = body.id;
        if (isNaN(numId) || numId <= 0) return { success: false, message: '无效的仓库ID' };
        const repo = await this.service.findById(numId);
        if (!repo) return { success: false, message: '仓库不存在' };
        return repo;
    }

    /**
     * 导出星标仓库 URL 列表
     *
     * 根据筛选条件查询仓库 URL，以纯文本格式下载。
     *
     * @param body { keyword, language, sortBy, sortOrder, dateField, startDate, endDate, untranslatedOnly }
     * @param res  Express Response 对象，用于设置下载头和返回文件内容
     */
    @Post('export')
    @ApiOperation({ summary: '导出仓库 URL', description: '按筛选条件导出仓库 GitHub URL 列表（纯文本下载）' })
    @ApiBody({ schema: { type: 'object', properties: { keyword: { type: 'string' }, language: { type: 'string' }, sortBy: { type: 'string' }, sortOrder: { type: 'string' }, dateField: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, untranslatedOnly: { type: 'boolean' } } } })
    async exportApi(@Body(new ZodValidationPipe(FilterSchema)) body: FilterDto, @Res() res: Response) {
        this.logger.log('导出仓库 URL 列表');
        const urls = await this.service.findAllUrls({
            keyword: body.keyword,
            language: body.language,
            sortBy: body.sortBy,
            sortOrder: body.sortOrder,
            dateField: body.dateField,
            startDate: body.startDate,
            endDate: body.endDate,
            untranslatedOnly: body.untranslatedOnly,
        });
        res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="stars-export.txt"' });
        res.send(urls.join('\n'));
    }

    /**
     * 获取所有符合条件的仓库 ID 列表
     *
     * 用于跨页全选功能，根据筛选条件返回所有仓库 ID。
     *
     * @param body { keyword, language, sortBy, sortOrder, dateField, startDate, endDate, untranslatedOnly }
     * @returns { success: true, ids: number[] }
     */
    @Post('ids')
    @ApiOperation({ summary: '获取仓库 ID 列表', description: '按筛选条件获取所有仓库 ID，用于跨页全选' })
    @ApiBody({ schema: { type: 'object', properties: { keyword: { type: 'string' }, language: { type: 'string' }, sortBy: { type: 'string' }, sortOrder: { type: 'string' }, dateField: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, untranslatedOnly: { type: 'boolean' } } } })
    async getIds(@Body(new ZodValidationPipe(FilterSchema)) body: FilterDto) {
        this.logger.log('获取仓库 ID 列表');
        const ids = await this.service.findAllIds({
            keyword: body.keyword,
            language: body.language,
            sortBy: body.sortBy,
            sortOrder: body.sortOrder,
            dateField: body.dateField,
            startDate: body.startDate,
            endDate: body.endDate,
            untranslatedOnly: body.untranslatedOnly,
        });
        return { success: true, ids, total: ids.length };
    }
}
