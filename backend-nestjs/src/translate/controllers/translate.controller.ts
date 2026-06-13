import { Controller, Get, Post, Param, Body, Query, Res, Sse, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Observable, Subject } from 'rxjs';
import { TranslateService } from '../services/translate.service';
import { TranslateTaskService } from '../services/translate-task.service';
import { GithubRepoService } from '../../github/services/github-repo.service';

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

    /**
     * 解析并校验路径参数 id
     *
     * @param id 路径参数字符串
     * @returns 解析后的数字，非法时返回 NaN
     */
    private parseId(id: string): number {
        const n = parseInt(id);
        return isNaN(n) ? NaN : n;
    }
    /**
     * 校验 id 是否有效（正数整数）
     *
     * @param id 待校验的数值
     * @returns true 表示 id 为正整数
     */
    private isValidId(id: number): boolean {
        return !isNaN(id) && id > 0;
    }

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
    @ApiOperation({ summary: '创建翻译任务', description: '支持三种 scope: selected（指定仓库）、all（全量）、filtered（筛选条件）；三种 type: description / readme / both' })
    @ApiBody({ description: '翻译任务参数', schema: { type: 'object', properties: { type: { type: 'string', enum: ['description', 'readme', 'both'], description: '翻译类型' }, scope: { type: 'string', enum: ['selected', 'all', 'filtered'], description: '范围类型' }, repoIds: { type: 'array', items: { type: 'number' }, description: '仓库 ID 列表（scope=selected 时使用）' }, filters: { type: 'object', description: '筛选条件（scope=filtered 时使用）' } }, required: ['type', 'scope'] } })
    async createTask(
        @Body()
        body: {
            type: 'description' | 'readme' | 'both';
            scope: 'filtered' | 'all' | 'selected';
            repoIds?: number[];
            filters?: {
                keyword?: string;
                language?: string;
                categoryIds?: string;
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
            // 选中模式：指定仓库
            if (type === 'description') {
                const count = await this.service.translateDescriptionsBatch(repoIds);
                return { success: true, translatedCount: count };
            }
            // README / both → 为每个仓库创建任务
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

        // scope === 'filtered'
        const taskId = await this.taskService.createAndStartFilterBatch(filters || {});
        if (!taskId) return { success: false, message: '没有需要翻译的项目' };
        return { success: true, taskId, message: `筛选翻译已启动 (类型: ${type})` };
    }

    /**
     * GET /api/translate/config — 检查翻译配置
     *
     * 返回 DeepSeek API Key 是否已配置。
     *
     * @returns { success, apiKeyConfigured }
     */
    @Get('config')
    @ApiOperation({ summary: '检查翻译配置', description: '检查 DeepSeek API Key 是否已配置' })
    async translateConfig() {
        return { success: true, apiKeyConfigured: await this.taskService.isApiKeyConfigured() };
    }

    /**
     * GET /api/translate/status — 翻译覆盖统计
     *
     * 返回符合条件的仓库总数及描述/README 的翻译覆盖情况。
     *
     * @param q 查询参数（keyword、language、categoryIds、日期范围等）
     * @returns 覆盖率统计对象
     */
    @Get('status')
    @ApiOperation({ summary: '翻译覆盖统计', description: '返回符合条件的仓库总数及描述/README 的翻译覆盖情况' })
    @ApiQuery({ name: 'keyword', required: false, description: '关键词筛选' })
    @ApiQuery({ name: 'language', required: false, description: '编程语言筛选' })
    @ApiQuery({ name: 'categoryIds', required: false, description: '分类 ID（逗号分隔）' })
    @ApiQuery({ name: 'dateField', required: false, description: '日期筛选字段' })
    @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
    @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
    @ApiQuery({ name: 'untranslatedOnly', required: false, description: '仅未翻译' })
    async translationStatus(@Query() q: any) {
        return this.service.getTranslationSummary({
            keyword: q.keyword || '',
            language: q.language || '',
            categoryIds: q.categoryIds || '',
            dateField: q.dateField || '',
            startDate: q.startDate || '',
            endDate: q.endDate || '',
            untranslatedOnly: q.untranslatedOnly === 'true' || q.untranslatedOnly === true,
        });
    }

    // ===== 任务管理 =====

    /**
     * GET /api/translate/tasks — 获取最近的翻译任务列表
     *
     * @returns 最近 20 条翻译任务摘要
     */
    @Get('tasks')
    @ApiOperation({ summary: '获取翻译任务列表', description: '获取最近 20 条翻译任务摘要' })
    async taskList() {
        return this.taskService.getRecentTasks();
    }

    /**
     * GET /api/translate/tasks/:id — 查询任务详情与进度
     *
     * @param id 翻译任务 ID
     * @returns 任务进度详情，无效 ID 时返回 { success: false, message }
     */
    @Get('tasks/:id')
    @ApiOperation({ summary: '查询任务进度', description: '获取指定翻译任务的详情和进度信息' })
    @ApiParam({ name: 'id', description: '翻译任务 ID' })
    async taskProgress(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的任务ID' };
        return this.taskService.getTaskProgress(nid);
    }

    /**
     * POST /api/translate/tasks/:id/retry — 重试任务中的失败项
     *
     * @param id 原翻译任务 ID
     * @returns 新任务 ID，无失败项时返回 { success: false, message }
     */
    @Post('tasks/:id/retry')
    @ApiOperation({ summary: '重试失败翻译', description: '重试指定翻译任务中的失败项，返回新任务 ID' })
    @ApiParam({ name: 'id', description: '原翻译任务 ID' })
    async taskRetry(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的任务ID' };
        this.logger.log(`重试翻译任务失败项: taskId=${nid}`);
        const newId = await this.taskService.retryFailed(nid);
        if (!newId) return { success: false, message: '没有失败项需要重试' };
        return { success: true, taskId: newId, message: '重试任务已启动' };
    }

    /**
     * GET /api/translate/tasks/:id/failures — 获取任务失败项列表
     *
     * @param id 翻译任务 ID
     * @returns { success, failures, count }
     */
    @Get('tasks/:id/failures')
    @ApiOperation({ summary: '获取任务失败项', description: '查询指定翻译任务的失败项列表' })
    @ApiParam({ name: 'id', description: '翻译任务 ID' })
    async taskFailures(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的任务ID' };
        return this.taskService.getFailures(nid);
    }

    /**
     * GET /api/translate/tasks/:id/stream — SSE 实时进度推送
     *
     * 建立 SSE 长连接，每 2 秒推送一次任务进度，
     * 任务完成（COMPLETED/FAILED/PARTIAL）或客户端断开时自动关闭。
     *
     * @param id 翻译任务 ID
     * @param res Express Response 对象
     */
    @Get('tasks/:id/stream')
    @ApiOperation({ summary: 'SSE 进度推送', description: '建立 SSE 长连接，每 2 秒推送翻译任务进度，任务完成自动关闭' })
    @ApiParam({ name: 'id', description: '翻译任务 ID' })
    async taskStream(@Param('id') id: string, @Res() res: Response) {
        const taskId = this.parseId(id);
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });

        // 创建 SSE 主题
        const subject = new Subject<MessageEvent>();
        sseStreams.set(taskId, subject);

        // 定时推送进度
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
     * POST /api/translate/:id/description — 同步翻译描述（旧接口）
     *
     * @param id 仓库 ID
     * @returns { success, descriptionCn }
     */
    @Post(':id/description')
    @ApiOperation({ summary: '[旧接口] 同步翻译描述', description: '对指定仓库的描述文本进行实时翻译' })
    @ApiParam({ name: 'id', description: '仓库 ID' })
    async translateDesc(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const result = await this.service.translateDescription(nid);
        return { success: true, descriptionCn: result };
    }

    /**
     * POST /api/translate/:id/readme — 同步翻译 README（旧接口）
     *
     * @param id 仓库 ID
     * @returns { success, readmeCn }
     */
    @Post(':id/readme')
    @ApiOperation({ summary: '[旧接口] 同步翻译 README', description: '对指定仓库的 README 进行实时翻译' })
    @ApiParam({ name: 'id', description: '仓库 ID' })
    async translateReadme(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const result = await this.service.translateReadme(nid);
        return { success: true, readmeCn: result };
    }

    /**
     * POST /api/translate/:id/readme/async — 异步翻译 README（旧接口）
     *
     * @param id 仓库 ID
     * @returns { success, taskId, message }
     */
    @Post(':id/readme/async')
    @ApiOperation({ summary: '[旧接口] 异步翻译 README', description: '创建异步 README 翻译任务，返回 taskId' })
    @ApiParam({ name: 'id', description: '仓库 ID' })
    async translateReadmeAsync(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const taskId = await this.taskService.createAndStartSingleReadme(nid);
        if (!taskId) return { success: false, message: '仓库不存在' };
        return { success: true, taskId, message: '翻译任务已启动' };
    }

    /**
     * POST /api/translate/:id/readme/retranslate — 强制重新翻译 README（旧接口）
     *
     * @param id 仓库 ID
     * @returns { success, taskId, message }
     */
    @Post(':id/readme/retranslate')
    @ApiOperation({ summary: '[旧接口] 强制重新翻译 README', description: '无视已有翻译结果，强制重新翻译指定仓库的 README' })
    @ApiParam({ name: 'id', description: '仓库 ID' })
    async translateReadmeRetranslate(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const taskId = await this.taskService.createAndStartSingleReadmeForce(nid);
        if (!taskId) return { success: false, message: '仓库不存在' };
        return { success: true, taskId, message: '重新翻译任务已启动' };
    }

    /**
     * POST /api/translate/:id — 同步翻译完整仓库（描述 + README）（旧接口）
     *
     * @param id 仓库 ID
     * @returns { success, descriptionCn, readmeCn, readmeFetched }
     */
    @Post(':id')
    @ApiOperation({ summary: '[旧接口] 同步翻译完整仓库', description: '同步翻译指定仓库的描述 + README（阻塞等待）' })
    @ApiParam({ name: 'id', description: '仓库 ID' })
    async translateFull(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const repo = await this.repoService.findById(nid);
        if (!repo) return { success: false, message: '仓库不存在' };
        const desc = await this.service.translateDescription(nid);
        const readme = await this.service.translateReadme(nid);
        return { success: true, descriptionCn: desc, readmeCn: readme, readmeFetched: !!readme };
    }

    /**
     * GET /api/translate/:id/status — 查询单仓库翻译状态（旧接口）
     *
     * @param id 仓库 ID
     * @returns { success, descriptionTranslated, readmeFetched, readmeTranslated, ... }
     */
    @Get(':id/status')
    @ApiOperation({ summary: '[旧接口] 查询单仓库翻译状态', description: '查询指定仓库的描述和 README 翻译状态' })
    @ApiParam({ name: 'id', description: '仓库 ID' })
    async status(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const repo = await this.repoService.findById(nid);
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
