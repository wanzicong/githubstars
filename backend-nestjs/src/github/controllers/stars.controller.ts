import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GithubRepoService } from '../services/github-repo.service';

@Controller()
export class StarsController {
    constructor(private readonly service: GithubRepoService) {}

    @Get('api/stars')
    async list(@Query() q: any) {
        const page = Math.max(1, parseInt(q.page) || 1);
        const size = Math.min(100, Math.max(1, parseInt(q.size) || 12));
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

    @Get('api/stars/:id')
    async detail(@Param('id') id: string) {
        const numId = parseInt(id);
        if (isNaN(numId)) return { success: false, message: '无效的仓库ID' };
        const repo = await this.service.findById(numId);
        if (!repo) return { success: false, message: '仓库不存在' };
        return repo;
    }

    // 移除重复的 stars/export 路由，只保留 api/stars/export
    @Get('api/stars/export')
    async exportApi(@Query() q: any, @Res() res: Response) {
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
