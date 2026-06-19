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
     * @param body 请求体 { type, scope, repoIds?, filters? }
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
            type: 'description' | 'readme' | 'both';
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
            if (type === 'description') {
                const count = await this.service.translateDescriptionsBatch(repoIds);
                return { success: true, translatedCount: count };
            }
            let taskId: number | null = null;
            for (const rid of repoIds) {
                taskId = await this.taskService.createAndStartSingleReadme(rid);
            }
            return { success: true, taskId, message: '翻译任务已启动' };
        }

        if (scope === 'all') {
            if (type === 'readme') {
                const taskId = await this.taskService.createAndStartReadmeBatch();
                if (!taskId) return { success: false, message: '没有需要翻译的项目' };
                return { success: true, taskId, message: '全量README翻译已启动' };
            }
            const taskId = await this.taskService.createAndStartFullTranslate();
            if (!taskId) return { success: false, message: '没有需要翻译的项目' };
            return { success: true, taskId, message: '全量翻译已启动' };
        }

        const taskId = await this.taskService.createAndStartFilterBatch(filters || {});
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
     * @param body { keyword, language, dateField, startDate, endDate, untranslatedOnly }
     * @returns 覆盖率统计对象
     */
    @Post('status')
    @ApiOperation({ summary: '翻译覆盖统计', description: '返回符合条件的仓库总数及描述/README 的翻译覆盖情况' })
    @ApiBody({ schema: { type: 'object', properties: { keyword: { type: 'string' }, language: { type: 'string' }, dateField: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, untranslatedOnly: { type: 'boolean' } } } })
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
     * @param body { id }
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
     * @param body { id }
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
     * @param body { id }
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
     * @param body { id }
     * @param res   Express Response 对象
     */
    @Post('tasks/stream')
    @ApiOperation({ summary: 'SSE 进度推送', description: '建立 SSE 长连接，每 2 秒推送翻译任务进度，任务完成自动关闭' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async taskStream(@Body(new ZodValidationPipe(IdParamSchema)) body: IdParamDto, @Res() res: Response) {
        await this.sseManager.startSseStream(body.id, res);
    }
}
