import { Controller, Post, Logger, Body, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { GithubRepoService } from './github-repo.service';
import { GithubSearchService } from './github-search.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FilterSchema, GithubIssueListSchema, StarByIdSchema } from '../common/dto/filter.dto';
import type { FilterDto, GithubIssueListDto, StarByIdDto } from '../common/dto/filter.dto';
import { GithubApiService } from './github-api.service';

@ApiTags('stars')
@Controller('api/stars')
export class StarsController {
    private readonly logger = new Logger(StarsController.name);

    constructor(
        private readonly service: GithubRepoService,
        private readonly githubSearch: GithubSearchService,
        private readonly githubApi: GithubApiService,
    ) {}

    /**
     * 获取星标仓库分页列表
     *
     * 支持关键词搜索、语言筛选、分类筛选、日期范围筛选、排序和分页。
     *
     * @param body { page, size, keyword, language, sortBy, sortOrder, dateField, startDate, endDate, untranslatedOnly }
     * @returns 分页结果（records、total、size、current、pages）
     */
    @Post('list')
    @ApiOperation({ summary: '获取星标仓库列表', description: '分页获取 Star 仓库，支持多维度筛选、排序和分页' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                page: { type: 'number' },
                size: { type: 'number' },
                keyword: { type: 'string' },
                language: { type: 'string' },
                sortBy: { type: 'string' },
                sortOrder: { type: 'string' },
                dateField: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                untranslatedOnly: { type: 'boolean' },
            },
        },
    })
    async list(@Body(new ZodValidationPipe(FilterSchema)) body: FilterDto) {
        this.logger.log('获取星标仓库列表: page=' + body.page + ', size=' + body.size);
        return this.service.findPage({
            page: body.page,
            size: body.size,
            keyword: body.keyword,
            language: body.language,
            sortBy: body.sortBy,
            sortOrder: body.sortOrder,
            dateField: body.dateField,
            startDate: body.startDate,
            endDate: body.endDate,
            untranslatedOnly: body.untranslatedOnly,
            categoryId: body.categoryId,
        });
    }

    /**
     * 获取单个星标仓库详情
     *
     * @param body { id }
     * @returns 仓库详情对象（含分类名称），ID 无效或不存在时返回错误信息
     */
    @Post('detail')
    @ApiOperation({ summary: '获取仓库详情', description: '根据仓库 ID 获取详细信息（含分类名称）' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async detail(@Body() body: { id: number }) {
        const numId = body.id;
        if (isNaN(numId) || numId <= 0) return { success: false, message: '无效的仓库ID' };
        let repo = await this.service.findById(numId).catch((e: unknown) => {
            this.logger.error(`findById 异常: id=${numId}`, e);
            return null;
        });
        if (!repo) return { success: false, message: '仓库不存在' };

        // README 按需拉取：如果 README 尚未获取，立即从 GitHub API 拉取
        if (!repo.readmeFetched) {
            this.logger.log(`详情页触发 README 按需拉取: id=${numId}`);
            const updated = await this.service.ensureReadmeFetched(numId);
            if (updated) {
                repo = updated;
            }
            // 拉取失败不阻塞，继续返回已有信息
        }

        return repo;
    }

    /**
     * 查询仓库 Issue 列表
     *
     * 通过本地仓库 ID 锁定 fullName，再由后端代理 GitHub Search Issues API。
     */
    @Post('issues')
    @ApiOperation({ summary: '获取仓库 Issues', description: '分页查询指定 Star 仓库的 GitHub Issue 列表，自动排除 Pull Request' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['id'],
            properties: {
                id: { type: 'number' },
                state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
                query: { type: 'string', maxLength: 200 },
                sort: { type: 'string', enum: ['created', 'updated', 'comments'], default: 'updated' },
                order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
                page: { type: 'number', default: 1 },
                perPage: { type: 'number', default: 20, maximum: 50 },
            },
        },
    })
    async issues(@Body(new ZodValidationPipe(GithubIssueListSchema)) body: GithubIssueListDto) {
        const repo = await this.service.findById(body.id);
        if (!repo?.fullName) {
            throw new NotFoundException('仓库不存在');
        }
        return this.githubApi.fetchRepoIssues(repo.fullName, {
            state: body.state,
            query: body.query,
            sort: body.sort,
            order: body.order,
            page: body.page,
            perPage: body.perPage,
        });
    }

    /**
     * 导出星标仓库 URL 列表
     *
     * 根据筛选条件查询仓库 URL，以纯文本格式下载。
     *
     * @param body { keyword, language, sortBy, sortOrder, dateField, startDate, endDate, untranslatedOnly }
     * @param res  Express Response 对象，用于设置下载头和返回文件内容
     */
    @Post('export')
    @ApiOperation({ summary: '导出仓库 URL', description: '按筛选条件导出仓库 GitHub URL 列表（纯文本下载）' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                keyword: { type: 'string' },
                language: { type: 'string' },
                sortBy: { type: 'string' },
                sortOrder: { type: 'string' },
                dateField: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                untranslatedOnly: { type: 'boolean' },
            },
        },
    })
    async exportApi(@Body(new ZodValidationPipe(FilterSchema)) body: FilterDto, @Res() res: Response) {
        this.logger.log('导出仓库 URL 列表');
        const urls = await this.service.findAllUrls({
            keyword: body.keyword,
            language: body.language,
            sortBy: body.sortBy,
            sortOrder: body.sortOrder,
            dateField: body.dateField,
            startDate: body.startDate,
            endDate: body.endDate,
            untranslatedOnly: body.untranslatedOnly,
            categoryId: body.categoryId,
        });
        res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="stars-export.txt"' });
        res.send(urls.join('\n'));
    }

    /**
     * 获取所有符合条件的仓库 ID 列表
     *
     * 用于跨页全选功能，根据筛选条件返回所有仓库 ID。
     *
     * @returns { success: true, ids: number[] }
     */
    @Post('ids')
    @ApiOperation({ summary: '获取仓库 ID 列表', description: '按筛选条件获取所有仓库 ID，用于跨页全选' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                keyword: { type: 'string' },
                language: { type: 'string' },
                sortBy: { type: 'string' },
                sortOrder: { type: 'string' },
                dateField: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                untranslatedOnly: { type: 'boolean' },
            },
        },
    })
    async getIds(@Body(new ZodValidationPipe(FilterSchema)) body: FilterDto) {
        this.logger.log('获取仓库 ID 列表');
        const ids = await this.service.findAllIds({
            keyword: body.keyword,
            language: body.language,
            sortBy: body.sortBy,
            sortOrder: body.sortOrder,
            dateField: body.dateField,
            startDate: body.startDate,
            endDate: body.endDate,
            untranslatedOnly: body.untranslatedOnly,
            categoryId: body.categoryId,
        });
        return { success: true, ids, total: ids.length };
    }

    /**
     * 根据 ID 列表获取仓库详情
     *
     * 用于跨页全选后获取仓库完整信息。
     *
     * @param body { ids: number[] }
     * @returns 仓库详情数组
     */
    @Post('by-ids')
    @ApiOperation({ summary: '批量获取仓库详情', description: '根据 ID 列表批量获取仓库信息' })
    @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'number' } } }, required: ['ids'] } })
    async getByIds(@Body() body: { ids: number[] }) {
        if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
            return { success: false, message: '请提供仓库 ID 列表' };
        }
        this.logger.log(`批量获取仓库详情: ${body.ids.length} 个`);
        const repos = await this.service.findByIds(body.ids);
        return { success: true, data: repos };
    }

    /**
     * 按仓库 ID Star 仓库
     *
     * 通过数据库中的仓库 ID 查找 full_name，然后调用 GitHub API 添加 Star。
     *
     * @param body { id } 仓库 ID
     * @returns 操作结果
     */
    @Post('star')
    @ApiOperation({ summary: '按 ID Star 仓库', description: '通过数据库仓库 ID 查找 full_name 后调用 GitHub API 添加 Star' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async starById(@Body(new ZodValidationPipe(StarByIdSchema)) body: StarByIdDto) {
        this.logger.log(`按 ID Star 仓库: id=${body.id}`);
        const repo = await this.service.findById(body.id);
        if (!repo?.fullName) return { success: false, message: '仓库不存在或全名为空' };
        const [owner, repoName] = repo.fullName.split('/');
        if (!owner || !repoName) return { success: false, message: '仓库全名格式异常' };
        const starred = await this.githubSearch.starRepo(owner, repoName);
        return { success: starred, starred, message: starred ? `已 Star ${repo.fullName}` : 'Star 失败' };
    }

    /**
     * 按仓库 ID 取消 Star 仓库
     *
     * 通过数据库中的仓库 ID 查找 full_name，然后调用 GitHub API 取消 Star。
     *
     * @param body { id } 仓库 ID
     * @returns 操作结果
     */
    @Post('unstar')
    @ApiOperation({ summary: '按 ID 取消 Star 仓库', description: '通过数据库仓库 ID 查找 full_name 后调用 GitHub API 取消 Star' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async unstarById(@Body(new ZodValidationPipe(StarByIdSchema)) body: StarByIdDto) {
        this.logger.log(`按 ID 取消 Star 仓库: id=${body.id}`);
        const repo = await this.service.findById(body.id);
        if (!repo?.fullName) return { success: false, message: '仓库不存在或全名为空' };
        const [owner, repoName] = repo.fullName.split('/');
        if (!owner || !repoName) return { success: false, message: '仓库全名格式异常' };
        const unstarred = await this.githubSearch.unstarRepo(owner, repoName);
        return { success: unstarred, unstarred, message: unstarred ? `已取消 Star ${repo.fullName}` : '取消 Star 失败' };
    }

    /**
     * 按仓库 ID 检查 Star 状态
     *
     * 通过数据库中的仓库 ID 查找 full_name，然后调用 GitHub API 检查是否已 Star。
     *
     * @param body { id } 仓库 ID
     * @returns 星标状态
     */
    @Post('starred')
    @ApiOperation({ summary: '按 ID 检查 Star 状态', description: '通过数据库仓库 ID 查找 full_name 后调用 GitHub API 检查 Star 状态' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async checkStarredById(@Body(new ZodValidationPipe(StarByIdSchema)) body: StarByIdDto) {
        const repo = await this.service.findById(body.id);
        if (!repo?.fullName) return { success: false, message: '仓库不存在或全名为空' };
        const [owner, repoName] = repo.fullName.split('/');
        if (!owner || !repoName) return { success: false, message: '仓库全名格式异常' };
        const starred = await this.githubSearch.checkStarred(owner, repoName);
        return { success: true, starred, fullName: repo.fullName };
    }
}
