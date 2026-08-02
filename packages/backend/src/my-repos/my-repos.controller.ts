import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MyRepoService } from './my-repo.service';
import { MyRepoSyncService } from './my-repo-sync.service';
import {
    MyRepoCategoryBindSchema,
    MyRepoIdSchema,
    MyRepoIdsSchema,
    MyRepoListSchema,
    MyRepoLocalizationSchema,
    MyRepoPendingLocalizationSchema,
} from './my-repos.dto';
import type {
    MyRepoCategoryBindDto,
    MyRepoIdDto,
    MyRepoIdsDto,
    MyRepoListDto,
    MyRepoLocalizationDto,
    MyRepoPendingLocalizationDto,
} from './my-repos.dto';

/**
 * 我的仓库控制器（表现层）
 *
 * 提供用户自己创建的 GitHub 仓库的同步、列表、详情、
 * 分类绑定、翻译流水线对接与概览统计端点。
 *
 * @depends MyRepoService / MyRepoSyncService
 * @callers 前端 api/my-repos.ts、githubstars-agent 翻译流水线
 */
@ApiTags('my-repos')
@Controller('api/my-repos')
export class MyReposController {
    private readonly logger = new Logger(MyReposController.name);

    constructor(
        private readonly service: MyRepoService,
        private readonly syncService: MyRepoSyncService,
    ) {}

    /**
     * 触发我的仓库同步（异步执行）
     *
     * @returns success=true 已受理；false 表示已有同步在进行
     */
    @Post('sync')
    @ApiOperation({ summary: '同步我的仓库', description: '从 GitHub /user/repos 全量拉取用户自己创建的仓库并 upsert 到本地' })
    sync() {
        const accepted = this.syncService.startManualSync();
        if (!accepted) {
            this.logger.error('我的仓库同步请求被拒绝：已有同步任务在执行中');
            return { success: false, message: '已有同步任务在执行中' };
        }
        this.logger.log('收到我的仓库同步请求');
        return { success: true, message: '同步任务已启动' };
    }

    /** 我的仓库同步状态 */
    @Get('sync-status')
    @ApiOperation({ summary: '我的仓库同步状态' })
    syncStatus() {
        return this.syncService.getSyncStatus();
    }

    /**
     * 分页获取我的仓库列表
     *
     * 支持关键词、语言、分类、私有/公开、日期范围筛选与排序。
     */
    @Post('list')
    @ApiOperation({ summary: '我的仓库列表', description: '分页获取我的仓库，支持多维度筛选、排序和分页' })
    list(@Body(new ZodValidationPipe(MyRepoListSchema)) body: MyRepoListDto) {
        this.logger.log(`获取我的仓库列表: page=${body.page}, size=${body.size}, isPrivate=${body.isPrivate}`);
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
            isPrivate: body.isPrivate,
        });
    }

    /** 按 ID 获取我的仓库详情（含分类与翻译状态） */
    @Post('detail')
    @ApiOperation({ summary: '我的仓库详情' })
    detail(@Body(new ZodValidationPipe(MyRepoIdSchema)) body: MyRepoIdDto) {
        this.logger.log(`获取我的仓库详情: id=${body.id}`);
        return this.service.findById(body.id);
    }

    /** 按筛选条件获取全部仓库 ID（跨页全选用） */
    @Post('ids')
    @ApiOperation({ summary: '我的仓库 ID 列表' })
    async ids(@Body(new ZodValidationPipe(MyRepoListSchema)) body: MyRepoListDto) {
        const ids = await this.service.findAllIds({
            keyword: body.keyword,
            language: body.language,
            dateField: body.dateField,
            startDate: body.startDate,
            endDate: body.endDate,
            untranslatedOnly: body.untranslatedOnly,
            categoryId: body.categoryId,
            isPrivate: body.isPrivate,
        });
        return { success: true, ids, total: ids.length };
    }

    /** 按 ID 列表批量获取仓库 */
    @Post('by-ids')
    @ApiOperation({ summary: '批量获取我的仓库' })
    async byIds(@Body(new ZodValidationPipe(MyRepoIdsSchema)) body: MyRepoIdsDto) {
        const data = await this.service.findByIds(body.ids);
        return { success: true, data };
    }

    /** 批量绑定我的仓库到分类 */
    @Post('categories/bind')
    @ApiOperation({ summary: '绑定我的仓库分类' })
    bindCategory(@Body(new ZodValidationPipe(MyRepoCategoryBindSchema)) body: MyRepoCategoryBindDto) {
        this.logger.log(`绑定我的仓库分类: categoryId=${body.categoryId}, repoIds=${body.repoIds.length} 个`);
        return this.service.bindCategories(body.categoryId, body.repoIds);
    }

    /** 批量解绑我的仓库分类 */
    @Post('categories/unbind')
    @ApiOperation({ summary: '解绑我的仓库分类' })
    unbindCategory(@Body(new ZodValidationPipe(MyRepoCategoryBindSchema)) body: MyRepoCategoryBindDto) {
        this.logger.log(`解绑我的仓库分类: categoryId=${body.categoryId}, repoIds=${body.repoIds.length} 个`);
        return this.service.unbindCategories(body.categoryId, body.repoIds);
    }

    /**
     * 查询待翻译的我的仓库记录
     *
     * 供 githubstars-agent 翻译流水线拉取，与 /api/localization/pending 同构。
     */
    @Get('pending-localization')
    @ApiOperation({ summary: '待翻译我的仓库', description: '供翻译流水线拉取待翻译的描述与 README 原文' })
    pendingLocalization(@Query(new ZodValidationPipe(MyRepoPendingLocalizationSchema)) query: MyRepoPendingLocalizationDto) {
        return this.service.findPendingLocalization(query.limit, query.includeDescription, query.includeReadme);
    }

    /**
     * 批量回写我的仓库译文
     *
     * 供 githubstars-agent 翻译流水线回写，与 /api/localization/update 同构。
     */
    @Post('localization')
    @ApiOperation({ summary: '回写我的仓库译文' })
    updateLocalization(@Body(new ZodValidationPipe(MyRepoLocalizationSchema)) body: MyRepoLocalizationDto) {
        this.logger.log(`回写我的仓库译文: ${body.items.length} 条`);
        return this.service.updateTranslations(body.items);
    }

    /** 我的仓库概览统计 */
    @Get('stats')
    @ApiOperation({ summary: '我的仓库统计', description: '总数、私有数、总 Star/Fork、语言分布 Top10' })
    stats() {
        return this.service.getStats();
    }
}
