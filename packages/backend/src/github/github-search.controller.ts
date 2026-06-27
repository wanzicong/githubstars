import { Controller, Post, Logger, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { GithubSearchService } from './github-search.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GithubSearchSchema } from '../common/dto/filter.dto';
import type { GithubSearchDto } from '../common/dto/filter.dto';

/**
 * GitHub 搜索与 Star 操作控制器
 *
 * 提供 GitHub 仓库搜索、Star/取消 Star/检查 Star 状态的 HTTP 接口。
 */
@ApiTags('github')
@Controller('api/github')
export class GithubSearchController {
    private readonly logger = new Logger(GithubSearchController.name);

    constructor(private readonly service: GithubSearchService) {}

    /**
     * 搜索 GitHub 仓库
     *
     * @param body { keyword, language, sort, page, perPage }
     * @returns 搜索结果对象
     */
    @Post('search')
    @ApiOperation({ summary: '搜索 GitHub 仓库', description: '通过 GitHub Search API 搜索仓库' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                keyword: { type: 'string' },
                language: { type: 'string' },
                sort: { type: 'string' },
                page: { type: 'number' },
                perPage: { type: 'number' },
            },
        },
    })
    async search(@Body(new ZodValidationPipe(GithubSearchSchema)) body: GithubSearchDto) {
        this.logger.log('GitHub 搜索: keyword=' + body.keyword + ', language=' + body.language);
        return this.service.searchRepos(body.keyword, body.language, body.sort, body.page, body.perPage);
    }

    /**
     * 给仓库添加 Star
     *
     * @param body { owner, repo }
     * @returns 操作结果
     */
    @Post('star')
    @ApiOperation({ summary: 'Star 仓库', description: '通过 GitHub API 给指定仓库添加 Star' })
    @ApiBody({
        schema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'] },
    })
    async star(@Body() body: { owner: string; repo: string }) {
        this.logger.log('Star 操作: ' + body.owner + '/' + body.repo);
        const starred = await this.service.starRepo(body.owner, body.repo);
        return { success: true, starred, message: starred ? '已Star' : 'Star 失败' };
    }

    /**
     * 取消仓库的 Star
     *
     * @param body { owner, repo }
     * @returns 操作结果
     */
    @Post('unstar')
    @ApiOperation({ summary: '取消 Star', description: '通过 GitHub API 取消对指定仓库的 Star' })
    @ApiBody({
        schema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'] },
    })
    async unstar(@Body() body: { owner: string; repo: string }) {
        this.logger.log('取消 Star 操作: ' + body.owner + '/' + body.repo);
        const ok = await this.service.unstarRepo(body.owner, body.repo);
        return { success: true, message: ok ? '已取消Star' : '取消 Star 失败' };
    }

    /**
     * 检查仓库是否已被当前用户 Star
     *
     * @param body { owner, repo }
     * @returns 星标状态
     */
    @Post('starred')
    @ApiOperation({ summary: '检查 Star 状态', description: '检查当前用户是否已 Star 指定仓库' })
    @ApiBody({
        schema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'] },
    })
    async checkStarred(@Body() body: { owner: string; repo: string }) {
        const starred = await this.service.checkStarred(body.owner, body.repo);
        return { success: true, starred };
    }
}
