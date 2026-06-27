import { Controller, Post, Body, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { TranslateService } from './translate.service';
import { TranslateTaskService } from './translate-task.service';
import { SseManagerService } from './sse-manager.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { IdParamSchema } from '../common/dto/id-param.dto';
import type { IdParamDto } from '../common/dto/id-param.dto';
import { FilterSchema } from '../common/dto/filter.dto';
import type { FilterDto } from '../common/dto/filter.dto';

type TranslateType = 'description' | 'readme' | 'both';

@ApiTags('translate')
@Controller('api/translate')
export class TranslateController {
    private readonly logger = new Logger(TranslateController.name);

    constructor(
        private readonly service: TranslateService,
        private readonly taskService: TranslateTaskService,
        private readonly sseManager: SseManagerService,
    ) {}

    // ===== 核心端点 =====

    /**
     * POST /api/translate — 创建翻译任务
     *
     * 合并了原 start/filter-batch/readme-start/batch 等多个端点。
     * 支持三种 scope: selected（指定仓库）、all（全量）、filtered（筛选条件）。
     *
     * @returns { success, taskId?, translatedCount?, message }
     */
    @Post()
    @ApiOperation({
        summary: '创建翻译任务',
        description: '支持三种 scope: selected（指定仓库）、all（全量）、filtered（筛选条件）；三种 type: description / readme / both',
    })
    @ApiBody({
        description: '翻译任务参数',
        schema: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['description', 'readme', 'both'], description: '翻译类型' },
                scope: { type: 'string', enum: ['selected', 'all', 'filtered'], description: '范围类型' },
                repoIds: { type: 'array', items: { type: 'number' }, description: '仓库 ID 列表（scope=selected 时使用）' },
                filters: { type: 'object', description: '筛选条件（scope=filtered 时使用）' },
            },
            required: ['type', 'scope'],
        },
    })
    async createTask(
        @Body()
        body: {
            type: TranslateType;
            scope: 'filtered' | 'all' | 'selected';
            repoIds?: number[];
            filters?: {
                keyword?: string;
                language?: string;
                sortBy?: string;
                sortOrder?: string;
                dateField?: string;
                startDate?: string;
                endDate?: string;
            };
        },
    ) {
        const { type = 'readme', scope = 'filtered', repoIds, filters } = body;
        this.logger.log(`创建翻译任务: type=${type} scope=${scope} repoCount=${repoIds?.length || 0}`);

        if (scope === 'selected' && repoIds?.length) {
            return this.handleSelectedScope(repoIds, type);
        }

        if (scope === 'all') {
            return this.handleAllScope(type);
        }

        return this.handleFilteredScope(filters, type);
    }

    /**
     * 处理选中的仓库翻译
     *
     * @param repoIds 仓库 ID 列表
     * @param type    翻译类型
     * @returns 翻译结果
     *
     * @callers createTask — 当 scope=selected 时调用
     */
    private async handleSelectedScope(repoIds: number[], type: TranslateType) {
        if (type === 'description') {
            const count = await this.service.translateDescriptionsBatch(repoIds);
            return { success: true, translatedCount: count };
        }
        // 修复 C2/C3: 创建单个批量任务而非 N 个独立任务；type='both' 同时翻译描述+README
        const taskId = await this.taskService.createBatchTask(repoIds, type === 'both' ? 'both' : 'readme');
        if (!taskId) return { success: false, message: '创建翻译任务失败' };
        return { success: true, taskId, message: `翻译任务已启动 (${type})` };
    }

    /**
     * 处理全量翻译
     *
     * @param type 翻译类型
     * @returns 翻译结果
     *
     * @callers createTask — 当 scope=all 时调用
     */
    private async handleAllScope(type: TranslateType) {
        if (type === 'readme') {
            const taskId = await this.taskService.createAndStartReadmeBatch();
            if (!taskId) return { success: false, message: '没有需要翻译的项目' };
            return { success: true, taskId, message: '全量README翻译已启动' };
        }
        const taskId = await this.taskService.createAndStartFullTranslate();
        if (!taskId) return { success: false, message: '没有需要翻译的项目' };
        return { success: true, taskId, message: '全量翻译已启动' };
    }

    /**
     * 处理筛选条件翻译
     *
     * @param filters 筛选条件
     * @param type    翻译类型
     * @returns 翻译结果
     *
     * @callers createTask — 当 scope=filtered 时调用
     */
    private async handleFilteredScope(filters: Record<string, string> | undefined, type: TranslateType) {
        // 修复 C4: 将 type 参数传入 createAndStartFilterBatch，不再忽略
        const taskId = await this.taskService.createAndStartFilterBatch(filters || {}, type);
        if (!taskId) return { success: false, message: '没有需要翻译的项目' };
        return { success: true, taskId, message: `筛选翻译已启动 (类型: ${type})` };
    }

    /**
     * POST /api/translate/config — 检查翻译配置
     *
     * @returns { success, apiKeyConfigured }
     */
    @Post('config')
    @ApiOperation({ summary: '检查翻译配置', description: '检查 DeepSeek API Key 是否已配置' })
    async translateConfig() {
        return { success: true, apiKeyConfigured: await this.taskService.isApiKeyConfigured() };
    }

    /**
     * POST /api/translate/status — 翻译覆盖统计
     *
     * @returns 覆盖率统计对象
     */
    @Post('status')
    @ApiOperation({ summary: '翻译覆盖统计', description: '返回符合条件的仓库总数及描述/README 的翻译覆盖情况' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                keyword: { type: 'string' },
                language: { type: 'string' },
                dateField: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                untranslatedOnly: { type: 'boolean' },
            },
        },
    })
    async translationStatus(@Body(new ZodValidationPipe(FilterSchema)) body: FilterDto) {
        return this.service.getTranslationSummary({
            keyword: body.keyword,
            language: body.language,
            dateField: body.dateField,
            startDate: body.startDate,
            endDate: body.endDate,
            untranslatedOnly: body.untranslatedOnly,
        });
    }

    // ===== 任务管理 =====

    /**
     * POST /api/translate/tasks/list — 获取最近的翻译任务列表
     *
     * @returns 最近 20 条翻译任务摘要
     */
    @Post('tasks/list')
    @ApiOperation({ summary: '获取翻译任务列表', description: '获取最近 20 条翻译任务摘要' })
    async taskList() {
        return this.taskService.getRecentTasks();
    }

    /**
     * POST /api/translate/tasks/detail — 查询任务详情与进度
     *

     * @returns 任务进度详情，无效 ID 时返回 { success: false, message }
     */
    @Post('tasks/detail')
    @ApiOperation({ summary: '查询任务进度', description: '获取指定翻译任务的详情和进度信息' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async taskProgress(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto) {
        return this.taskService.getTaskProgress(body.id);
    }

    /**
     * POST /api/translate/tasks/retry — 重试任务中的失败项
     *

     * @returns 新任务 ID，无失败项时返回 { success: false, message }
     */
    @Post('tasks/retry')
    @ApiOperation({ summary: '重试失败翻译', description: '重试指定翻译任务中的失败项，返回新任务 ID' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async taskRetry(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto) {
        this.logger.log(`重试翻译任务失败项: taskId=${body.id}`);
        const newId = await this.taskService.retryFailed(body.id);
        if (!newId) return { success: false, message: '没有失败项需要重试' };
        return { success: true, taskId: newId, message: '重试任务已启动' };
    }

    /**
     * POST /api/translate/tasks/failures — 获取任务失败项列表
     *

     * @returns { success, failures, count }
     */
    @Post('tasks/failures')
    @ApiOperation({ summary: '获取任务失败项', description: '查询指定翻译任务的失败项列表' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async taskFailures(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto) {
        return this.taskService.getFailures(body.id);
    }

    /**
     * POST /api/translate/tasks/stream — SSE 实时进度推送
     *
     * 建立 SSE 长连接，每 2 秒推送一次任务进度，
     * 任务完成（COMPLETED/FAILED/PARTIAL）或客户端断开时自动关闭。
     *

     * @param res   Express Response 对象
     */
    @Post('tasks/stream')
    @ApiOperation({ summary: 'SSE 进度推送', description: '建立 SSE 长连接，每 2 秒推送翻译任务进度，任务完成自动关闭' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async taskStream(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto, @Res() res: Response) {
        await this.sseManager.startSseStream(body.id, res);
    }
}
