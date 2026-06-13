import { Controller, Get, Post, Delete, Param, Query } from '@nestjs/common';
import { GithubSearchService } from '../services/github-search.service';

@Controller('api/github')
export class GithubSearchController {
    constructor(private readonly service: GithubSearchService) {}

    @Get('search')
    async search(@Query() q: any) {
        return this.service.searchRepos(
            q.keyword || '',
            q.language || '',
            q.sort || 'stars',
            parseInt(q.page) || 1,
            parseInt(q.perPage) || 20,
        );
    }

    @Post('star/:owner/:repo')
    async star(@Param('owner') owner: string, @Param('repo') repo: string) {
        const starred = await this.service.starRepo(owner, repo);
        return { success: true, starred, message: starred ? '已Star' : 'Star 失败' };
    }

    @Delete('star/:owner/:repo')
    async unstar(@Param('owner') owner: string, @Param('repo') repo: string) {
        const ok = await this.service.unstarRepo(owner, repo);
        return { success: true, message: ok ? '已取消Star' : '取消 Star 失败' };
    }

    @Get('starred/:owner/:repo')
    async checkStarred(@Param('owner') owner: string, @Param('repo') repo: string) {
        const starred = await this.service.checkStarred(owner, repo);
        return { success: true, starred };
    }
}
