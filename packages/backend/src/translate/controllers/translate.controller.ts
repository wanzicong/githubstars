import { Controller, Post, Body, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Subject } from 'rxjs';
import { TranslateService } from '../services/translate.service';
import { TranslateTaskService } from '../services/translate-task.service';
import { GithubRepoService } from '../../github/services/github-repo.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FilterSchema } from '../../common/dto/filter.dto';
import type { FilterDto } from '../../common/dto/filter.dto';

// SSE 进度事件流管理
const sseStreams = new Map<number, Subject<MessageEvent>>();

export function broadcastTaskProgress(taskId: number, data: any) {
    const subject = sseStreams.get(taskId);
    if (subject) subject.next({ data } as MessageEvent);
}

@ApiTags('translate')
@Controller('api/translate')
export class TranslateController {
    private readonly logger = new Logger(TranslateController.name);

    constructor(
        private readonly service: TranslateService,
        private readonly taskService: TranslateTaskService,
        private readonly repoService: GithubRepoService,
    ) {}

    // ===== 合并后的核心端点 =====

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
    async taskProgress(@Body() body: { id: number }) {
        if (!body.id || body.id <= 0) return { success: false, message: '无效的任务ID' };
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
    async taskRetry(@Body() body: { id: number }) {
        if (!body.id || body.id <= 0) return { success: false, message: '无效的任务ID' };
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
    async taskFailures(@Body() body: { id: number }) {
        if (!body.id || body.id <= 0) return { success: false, message: '无效的任务ID' };
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
    async taskStream(@Body() body: { id: number }, @Res() res: Response) {
        const taskId = body.id;
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });

        const subject = new Subject<MessageEvent>();
        sseStreams.set(taskId, subject);

        const interval = setInterval(async () => {
            try {
                const progress = await this.taskService.getTaskProgress(taskId);
                res.write(`data: ${JSON.stringify(progress)}\n\n`);
                if (progress.status === 'COMPLETED' || progress.status === 'FAILED' || progress.status === 'PARTIAL') {
                    clearInterval(interval);
                    sseStreams.delete(taskId);
                    res.end();
                }
            } catch {
                clearInterval(interval);
                res.end();
            }
        }, 2000);

        res.on('close', () => {
            clearInterval(interval);
            sseStreams.delete(taskId);
        });
    }

    // ===== 兼容旧端点 (向后兼容) =====

    /**
     * POST /api/translate/description — 同步翻译描述（旧接口）
     *
     * @param body { id }
     * @returns { success, descriptionCn }
     */
    @Post('description')
    @ApiOperation({ summary: '[旧接口] 同步翻译描述', description: '对指定仓库的描述文本进行实时翻译' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async translateDesc(@Body() body: { id: number }) {
        if (!body.id || body.id <= 0) return { success: false, message: '无效的仓库ID' };
        const result = await this.service.translateDescription(body.id);
        return { success: true, descriptionCn: result };
    }

    /**
     * POST /api/translate/readme — 同步翻译 README（旧接口）
     *
     * @param body { id }
     * @returns { success, readmeCn }
     */
    @Post('readme')
    @ApiOperation({ summary: '[旧接口] 同步翻译 README', description: '对指定仓库的 README 进行实时翻译' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async translateReadme(@Body() body: { id: number }) {
        if (!body.id || body.id <= 0) return { success: false, message: '无效的仓库ID' };
        const result = await this.service.translateReadme(body.id);
        return { success: true, readmeCn: result };
    }

    /**
     * POST /api/translate/readme-async — 异步翻译 README（旧接口）
     *
     * @param body { id }
     * @returns { success, taskId, message }
     */
    @Post('readme-async')
    @ApiOperation({ summary: '[旧接口] 异步翻译 README', description: '创建异步 README 翻译任务，返回 taskId' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async translateReadmeAsync(@Body() body: { id: number }) {
        if (!body.id || body.id <= 0) return { success: false, message: '无效的仓库ID' };
        const taskId = await this.taskService.createAndStartSingleReadme(body.id);
        if (!taskId) return { success: false, message: '仓库不存在' };
        return { success: true, taskId, message: '翻译任务已启动' };
    }

    /**
     * POST /api/translate/retranslate — 强制重新翻译 README（旧接口）
     *
     * @param body { id }
     * @returns { success, taskId, message }
     */
    @Post('retranslate')
    @ApiOperation({ summary: '[旧接口] 强制重新翻译 README', description: '无视已有翻译结果，强制重新翻译指定仓库的 README' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async translateReadmeRetranslate(@Body() body: { id: number }) {
        if (!body.id || body.id <= 0) return { success: false, message: '无效的仓库ID' };
        const taskId = await this.taskService.createAndStartSingleReadmeForce(body.id);
        if (!taskId) return { success: false, message: '仓库不存在' };
        return { success: true, taskId, message: '重新翻译任务已启动' };
    }

    /**
     * POST /api/translate/full — 同步翻译完整仓库（描述 + README）（旧接口）
     *
     * @param body { id }
     * @returns { success, descriptionCn, readmeCn, readmeFetched }
     */
    @Post('full')
    @ApiOperation({ summary: '[旧接口] 同步翻译完整仓库', description: '同步翻译指定仓库的描述 + README（阻塞等待）' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async translateFull(@Body() body: { id: number }) {
        if (!body.id || body.id <= 0) return { success: false, message: '无效的仓库ID' };
        const repo = await this.repoService.findById(body.id);
        if (!repo) return { success: false, message: '仓库不存在' };
        const desc = await this.service.translateDescription(body.id);
        const readme = await this.service.translateReadme(body.id);
        return { success: true, descriptionCn: desc, readmeCn: readme, readmeFetched: !!readme };
    }

    /**
     * POST /api/translate/repo-status — 查询单仓库翻译状态（旧接口）
     *
     * @param body { id }
     * @returns { success, descriptionTranslated, readmeFetched, readmeTranslated, ... }
     */
    @Post('repo-status')
    @ApiOperation({ summary: '[旧接口] 查询单仓库翻译状态', description: '查询指定仓库的描述和 README 翻译状态' })
    @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } })
    async status(@Body() body: { id: number }) {
        if (!body.id || body.id <= 0) return { success: false, message: '无效的仓库ID' };
        const repo = await this.repoService.findById(body.id);
        if (!repo) return { success: false, message: '仓库不存在' };
        return {
            success: true,
            descriptionTranslated: !!repo.descriptionCn,
            readmeFetched: repo.readmeFetched,
            readmeTranslated: !!repo.readmeCn,
            descriptionCn: repo.descriptionCn,
            readmeCn: repo.readmeCn,
        };
    }
}
