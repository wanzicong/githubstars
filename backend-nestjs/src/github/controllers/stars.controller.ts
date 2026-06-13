import { Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GithubRepoService } from '../services/github-repo.service';

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
