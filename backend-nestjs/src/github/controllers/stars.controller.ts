import { Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { GithubRepoService } from '../services/github-repo.service';

@ApiTags('stars')
@Controller()
export class StarsController {
    private readonly logger = new Logger(StarsController.name);

    constructor(private readonly service: GithubRepoService) {}

    /**
     * 获取星标仓库分页列表
     *
     * 支持关键词搜索、语言筛选、分类筛选、日期范围筛选、排序和分页。
     *
     * @param q 查询参数
     * @returns 分页结果（records、total、size、current、pages）
     */
    @Get('api/stars')
    @ApiOperation({ summary: '获取星标仓库列表', description: '分页获取 Star 仓库，支持多维度筛选、排序和分页' })
    @ApiQuery({ name: 'page', required: false, description: '页码，默认 1' })
    @ApiQuery({ name: 'size', required: false, description: '每页条数，默认 12，最大 100' })
    @ApiQuery({ name: 'keyword', required: false, description: '全文搜索关键词' })
    @ApiQuery({ name: 'language', required: false, description: '编程语言筛选' })
    @ApiQuery({ name: 'categoryIds', required: false, description: '分类 ID（逗号分隔）' })
    @ApiQuery({ name: 'sortBy', required: false, description: '排序字段（starred_at/starsCount/forksCount/repoUpdatedAt），默认 starred_at' })
    @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向（asc/desc），默认 desc' })
    @ApiQuery({ name: 'dateField', required: false, description: '日期筛选字段' })
    @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
    @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
    @ApiQuery({ name: 'untranslatedOnly', required: false, description: '仅显示未翻译仓库（true/false）' })
    async list(@Query() q: any) {
        const page = Math.max(1, parseInt(q.page) || 1);
        const size = Math.min(100, Math.max(1, parseInt(q.size) || 12));
        this.logger.log('获取星标仓库列表: page=' + page + ', size=' + size);
        return this.service.findPage({
            page,
            size,
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
    }

    /**
     * 获取单个星标仓库详情
     *
     * @param id 仓库 ID
     * @returns 仓库详情对象（含分类名称），ID 无效或不存在时返回错误信息
     */
    @Get('api/stars/:id')
    @ApiOperation({ summary: '获取仓库详情', description: '根据仓库 ID 获取详细信息（含分类名称）' })
    @ApiParam({ name: 'id', description: '仓库 ID' })
    async detail(@Param('id') id: string) {
        const numId = parseInt(id);
        if (isNaN(numId)) return { success: false, message: '无效的仓库ID' };
        const repo = await this.service.findById(numId);
        if (!repo) return { success: false, message: '仓库不存在' };
        return repo;
    }

    /**
     * 导出星标仓库 URL 列表
     *
     * 根据筛选条件查询仓库 URL，以纯文本格式下载。
     *
     * @param q 查询参数（筛选条件，同列表接口）
     * @param res Express Response 对象，用于设置下载头和返回文件内容
     */
    @Get('api/stars/export')
    @ApiOperation({ summary: '导出仓库 URL', description: '按筛选条件导出仓库 GitHub URL 列表（纯文本下载）' })
    @ApiQuery({ name: 'keyword', required: false, description: '关键词筛选' })
    @ApiQuery({ name: 'language', required: false, description: '编程语言筛选' })
    @ApiQuery({ name: 'categoryIds', required: false, description: '分类 ID（逗号分隔）' })
    @ApiQuery({ name: 'sortBy', required: false, description: '排序字段，默认 starred_at' })
    @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向，默认 desc' })
    @ApiQuery({ name: 'dateField', required: false, description: '日期筛选字段' })
    @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
    @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
    async exportApi(@Query() q: any, @Res() res: Response) {
        this.logger.log('导出仓库 URL 列表');
        const urls = await this.service.findAllUrls({
            keyword: q.keyword || '',
            language: q.language || '',
            categoryIds: q.categoryIds || '',
            sortBy: q.sortBy || 'starred_at',
            sortOrder: q.sortOrder || 'desc',
            dateField: q.dateField || '',
            startDate: q.startDate || '',
            endDate: q.endDate || '',
        });
        res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="stars-export.txt"' });
        res.send(urls.join('\n'));
    }
}
