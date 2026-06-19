import { Controller, Post, Logger, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthorService } from './author.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthorListSchema, AuthorReposSchema, AuthorExportSchema } from '../common/dto/filter.dto';
import type { AuthorListDto, AuthorReposDto, AuthorExportDto } from '../common/dto/filter.dto';

@ApiTags('authors')
@Controller('api/authors')
export class AuthorController {
    private readonly logger = new Logger(AuthorController.name);

    constructor(private readonly service: AuthorService) {}

    /**
     * 分页获取作者列表
     *
     * 支持关键字搜索，按总 Star 数降序排列
     *
     * @param body { page, size, keyword }
     * @returns 分页后的作者列表
     */
    @Post('list')
    @ApiOperation({ summary: '获取作者列表', description: '分页获取作者列表，支持关键字搜索，按总 Star 数降序排列' })
    @ApiBody({ schema: { type: 'object', properties: { page: { type: 'number' }, size: { type: 'number' }, keyword: { type: 'string' } } } })
    async list(@Body(new ZodValidationPipe(AuthorListSchema)) body: AuthorListDto) {
        return this.service.findAuthorPage(
            body.page,
            body.size,
            body.keyword,
        );
    }

    /**
     * 获取指定作者的所有 Star 仓库
     *
     * 支持多种排序方式
     *
     * @param body { ownerName, page, size, sortBy, sortOrder }
     * @returns 分页后的仓库列表
     */
    @Post('repos')
    @ApiOperation({ summary: '获取作者仓库列表', description: '分页获取指定作者的所有 Star 仓库，支持多字段排序' })
    @ApiBody({ schema: { type: 'object', properties: { ownerName: { type: 'string' }, page: { type: 'number' }, size: { type: 'number' }, sortBy: { type: 'string' }, sortOrder: { type: 'string' } }, required: ['ownerName'] } })
    async repos(@Body(new ZodValidationPipe(AuthorReposSchema)) body: AuthorReposDto) {
        return this.service.findAuthorRepos({
            ownerName: body.ownerName,
            page: body.page,
            size: body.size,
            sortBy: body.sortBy,
            sortOrder: body.sortOrder,
        });
    }

    /**
     * 导出指定作者的所有 Star 仓库 URL
     *
     * 以纯文本文件下载，每行一个 GitHub 仓库地址
     *
     * @param body { ownerName, sortBy, sortOrder }
     * @param res Express Response 对象，用于设置下载头并返回文件内容
     */
    @Post('export')
    @ApiOperation({ summary: '导出作者仓库 URL', description: '以纯文本文件下载指定作者的所有 Star 仓库地址（每行一个）' })
    @ApiBody({ schema: { type: 'object', properties: { ownerName: { type: 'string' }, sortBy: { type: 'string' }, sortOrder: { type: 'string' } }, required: ['ownerName'] } })
    async export(@Body(new ZodValidationPipe(AuthorExportSchema)) body: AuthorExportDto, @Res() res: Response) {
        const urls = await this.service.findAllAuthorRepoUrls({ ownerName: body.ownerName, sortBy: body.sortBy, sortOrder: body.sortOrder });
        res.set({
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(body.ownerName + '-stars.txt')}`,
        });
        res.send(urls.join('\n'));
    }
}
