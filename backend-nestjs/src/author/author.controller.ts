import { Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthorService } from './author.service';

@Controller('api/authors')
export class AuthorController {
    private readonly logger = new Logger(AuthorController.name);

    constructor(private readonly service: AuthorService) {}

    /**
     * 分页获取作者列表
     *
     * 支持关键字搜索，按总 Star 数降序排列
     *
     * @param q.page 页码，默认1
     * @param q.size 每页条数，默认24
     * @param q.keyword 搜索关键字，按作者名模糊匹配
     * @returns 分页后的作者列表
     */
    @Get()
    async list(@Query() q: any) {
        return this.service.getAuthorPage(parseInt(q.page) || 1, parseInt(q.size) || 24, q.keyword || '');
    }

    /**
     * 获取指定作者的所有 Star 仓库
     *
     * 支持多种排序方式
     *
     * @param ownerName 作者名
     * @param q.page 页码，默认1
     * @param q.size 每页条数，默认12
     * @param q.sortBy 排序字段，默认 starred_at
     * @param q.sortOrder 排序方向，默认 desc
     * @returns 分页后的仓库列表
     */
    @Get(':ownerName')
    async repos(@Param('ownerName') owner: string, @Query() q: any) {
        return this.service.getAuthorRepos(
            owner,
            parseInt(q.page) || 1,
            parseInt(q.size) || 12,
            q.sortBy || 'starred_at',
            q.sortOrder || 'desc',
        );
    }

    /**
     * 导出指定作者的所有 Star 仓库 URL
     *
     * 以纯文本文件下载，每行一个 GitHub 仓库地址
     *
     * @param ownerName 作者名
     * @param q.sortBy 排序字段，默认 starred_at
     * @param q.sortOrder 排序方向，默认 desc
     * @param res Express Response 对象，用于设置下载头并返回文件内容
     */
    @Get(':ownerName/export')
    async export(@Param('ownerName') owner: string, @Query() q: any, @Res() res: Response) {
        const urls = await this.service.getAuthorAllRepoUrls(owner, q.sortBy || 'starred_at', q.sortOrder || 'desc');
        res.set({
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(owner + '-stars.txt')}`,
        });
        res.send(urls.join('\n'));
    }
}
