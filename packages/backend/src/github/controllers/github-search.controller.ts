import { Controller, Get, Logger, Post, Delete, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { GithubSearchService } from '../services/github-search.service';

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
     * @param q 查询参数，包含 keyword、language、sort、page、perPage
     * @returns 搜索结果对象
     */
    @Get('search')
    @ApiOperation({ summary: '搜索 GitHub 仓库', description: '通过 GitHub Search API 搜索仓库' })
    @ApiQuery({ name: 'keyword', required: false, description: '搜索关键词' })
    @ApiQuery({ name: 'language', required: false, description: '编程语言筛选' })
    @ApiQuery({ name: 'sort', required: false, description: '排序方式，默认 stars' })
    @ApiQuery({ name: 'page', required: false, description: '页码，默认 1' })
    @ApiQuery({ name: 'perPage', required: false, description: '每页条数，默认 20' })
    async search(@Query() q: any) {
        this.logger.log('GitHub 搜索: keyword=' + (q.keyword || '') + ', language=' + (q.language || ''));
        return this.service.searchRepos(
            q.keyword || '',
            q.language || '',
            q.sort || 'stars',
            parseInt(q.page) || 1,
            parseInt(q.perPage) || 20,
        );
    }

    /**
     * 给仓库添加 Star
     *
     * @param owner 仓库所有者
     * @param repo 仓库名
     * @returns 操作结果
     */
    @Post('star/:owner/:repo')
    @ApiOperation({ summary: 'Star 仓库', description: '通过 GitHub API 给指定仓库添加 Star' })
    @ApiParam({ name: 'owner', description: '仓库所有者用户名' })
    @ApiParam({ name: 'repo', description: '仓库名' })
    async star(@Param('owner') owner: string, @Param('repo') repo: string) {
        this.logger.log('Star 操作: ' + owner + '/' + repo);
        const starred = await this.service.starRepo(owner, repo);
        return { success: true, starred, message: starred ? '已Star' : 'Star 失败' };
    }

    /**
     * 取消仓库的 Star
     *
     * @param owner 仓库所有者
     * @param repo 仓库名
     * @returns 操作结果
     */
    @Delete('star/:owner/:repo')
    @ApiOperation({ summary: '取消 Star', description: '通过 GitHub API 取消对指定仓库的 Star' })
    @ApiParam({ name: 'owner', description: '仓库所有者用户名' })
    @ApiParam({ name: 'repo', description: '仓库名' })
    async unstar(@Param('owner') owner: string, @Param('repo') repo: string) {
        this.logger.log('取消 Star 操作: ' + owner + '/' + repo);
        const ok = await this.service.unstarRepo(owner, repo);
        return { success: true, message: ok ? '已取消Star' : '取消 Star 失败' };
    }

    /**
     * 检查仓库是否已被当前用户 Star
     *
     * @param owner 仓库所有者
     * @param repo 仓库名
     * @returns 星标状态
     */
    @Get('starred/:owner/:repo')
    @ApiOperation({ summary: '检查 Star 状态', description: '检查当前用户是否已 Star 指定仓库' })
    @ApiParam({ name: 'owner', description: '仓库所有者用户名' })
    @ApiParam({ name: 'repo', description: '仓库名' })
    async checkStarred(@Param('owner') owner: string, @Param('repo') repo: string) {
        const starred = await this.service.checkStarred(owner, repo);
        return { success: true, starred };
    }
}
