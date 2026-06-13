import { Controller, Get, Logger, Post, Delete, Param, Query } from '@nestjs/common';
import { GithubSearchService } from '../services/github-search.service';

/**
 * GitHub 搜索与 Star 操作控制器
 *
 * 提供 GitHub 仓库搜索、Star/取消 Star/检查 Star 状态的 HTTP 接口。
 */
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
    async checkStarred(@Param('owner') owner: string, @Param('repo') repo: string) {
        const starred = await this.service.checkStarred(owner, repo);
        return { success: true, starred };
    }
}
