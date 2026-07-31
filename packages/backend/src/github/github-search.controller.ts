import { Controller, Post, Logger, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { GithubSearchService } from './github-search.service';
import { GithubApiService } from './github-api.service';
import { ConfigService } from '../config/config.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GithubRepoIssueDetailSchema, GithubRepoIssuesSchema, GithubSearchSchema, GithubStarSchema } from '../common/dto/filter.dto';
import type { GithubRepoIssueDetailDto, GithubRepoIssuesDto, GithubSearchDto, GithubStarDto } from '../common/dto/filter.dto';

/**
 * GitHub 搜索与 Star 操作控制器
 *
 * 提供 GitHub 仓库搜索、Star/取消 Star/检查 Star 状态的 HTTP 接口。
 */
@ApiTags('github')
@Controller('api/github')
export class GithubSearchController {
    private readonly logger = new Logger(GithubSearchController.name);

    constructor(
        private readonly service: GithubSearchService,
        private readonly githubApi: GithubApiService,
        private readonly config: ConfigService,
    ) {}

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
    async star(@Body(new ZodValidationPipe(GithubStarSchema)) body: GithubStarDto) {
        this.logger.log('Star 操作: ' + body.owner + '/' + body.repo);
        const token = await this.config.getValueDefault('github.token', '');
        if (!token) {
            return { success: false, starred: false, message: '请先在系统设置中配置 GitHub Token' };
        }
        const starred = await this.service.starRepo(body.owner, body.repo);
        return { success: starred, starred, message: starred ? '已 Star' : 'Star 失败（请检查 Token 权限或网络）' };
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
    async unstar(@Body(new ZodValidationPipe(GithubStarSchema)) body: GithubStarDto) {
        this.logger.log('取消 Star 操作: ' + body.owner + '/' + body.repo);
        const token = await this.config.getValueDefault('github.token', '');
        if (!token) {
            return { success: false, unstarred: false, message: '请先在系统设置中配置 GitHub Token' };
        }
        const unstarred = await this.service.unstarRepo(body.owner, body.repo);
        return { success: unstarred, unstarred, message: unstarred ? '已取消 Star' : '取消 Star 失败' };
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
    async checkStarred(@Body(new ZodValidationPipe(GithubStarSchema)) body: GithubStarDto) {
        const starred = await this.service.checkStarred(body.owner, body.repo);
        return { success: true, starred };
    }

    /**
     * 获取任意 GitHub 仓库详情（统一仓库详情页数据源）
     *
     * 本地库已收录返回 DB 数据（含翻译），否则实时从 GitHub API 获取元数据 + README，
     * 返回与 DB 模型同构的对象，前端详情页两种来源渲染完全一致。
     *
     * @param body { owner, repo }
     * @returns 仓库详情对象（含 inLibrary 标记）
     */
    @Post('repo-detail')
    @ApiOperation({ summary: '获取任意仓库详情', description: '本地库命中返回 DB 数据，否则实时从 GitHub API 获取，用于统一仓库详情页' })
    @ApiBody({
        schema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'] },
    })
    async repoDetail(@Body(new ZodValidationPipe(GithubStarSchema)) body: GithubStarDto) {
        this.logger.log('仓库详情: ' + body.owner + '/' + body.repo);
        return this.service.getRepoDetail(body.owner, body.repo);
    }

    /**
     * 查询任意 GitHub 仓库的 Issues 列表（无需本地入库）
     *
     * @param body { owner, repo, state, query, sort, order, page, perPage }
     * @returns Issues 分页结果
     */
    @Post('issues')
    @ApiOperation({ summary: '获取任意仓库 Issues', description: '按 owner/repo 分页查询 GitHub Issue 列表，自动排除 Pull Request' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['owner', 'repo'],
            properties: {
                owner: { type: 'string' },
                repo: { type: 'string' },
                state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
                query: { type: 'string', maxLength: 200 },
                sort: { type: 'string', enum: ['created', 'updated', 'comments'], default: 'updated' },
                order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
                page: { type: 'number', default: 1 },
                perPage: { type: 'number', default: 20, maximum: 50 },
            },
        },
    })
    async repoIssues(@Body(new ZodValidationPipe(GithubRepoIssuesSchema)) body: GithubRepoIssuesDto) {
        return this.githubApi.fetchRepoIssues(`${body.owner}/${body.repo}`, {
            state: body.state,
            query: body.query,
            sort: body.sort,
            order: body.order,
            page: body.page,
            perPage: body.perPage,
        });
    }

    /**
     * 查询任意 GitHub 仓库的单个 Issue 详情（无需本地入库）
     *
     * @param body { owner, repo, issueNumber }
     * @returns Issue 正文、评论及侧栏信息
     */
    @Post('issue-detail')
    @ApiOperation({ summary: '获取任意仓库 Issue 详情', description: '按 owner/repo 查询 GitHub Issue 正文和首批评论，拒绝 Pull Request' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['owner', 'repo', 'issueNumber'],
            properties: {
                owner: { type: 'string' },
                repo: { type: 'string' },
                issueNumber: { type: 'number', minimum: 1 },
            },
        },
    })
    async repoIssueDetail(@Body(new ZodValidationPipe(GithubRepoIssueDetailSchema)) body: GithubRepoIssueDetailDto) {
        return this.githubApi.fetchRepoIssueDetail(`${body.owner}/${body.repo}`, body.issueNumber);
    }
}
