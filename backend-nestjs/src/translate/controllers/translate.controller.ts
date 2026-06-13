import { Controller, Get, Post, Param, Body, Query, Res, Sse } from '@nestjs/common';
import type { Response } from 'express';
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

@Controller('api/translate')
export class TranslateController {
    constructor(
        private readonly service: TranslateService,
        private readonly taskService: TranslateTaskService,
        private readonly repoService: GithubRepoService,
    ) {}

    /** 解析并校验路径参数 id，非法时返回 NaN */
    private parseId(id: string): number {
        const n = parseInt(id);
        return isNaN(n) ? NaN : n;
    }
    /** 校验 id 是否有效 */
    private isValidId(id: number): boolean {
        return !isNaN(id) && id > 0;
    }

    // ===== 合并后的核心端点 =====

    /** POST /api/translate — 创建翻译任务 (合并了 start/filter-batch/readme-start/batch) */
    @Post()
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

    /** GET /api/translate/config — 检查翻译配置（API Key 等） */
    @Get('config')
    async translateConfig() {
        return { success: true, apiKeyConfigured: await this.taskService.isApiKeyConfigured() };
    }

    /** GET /api/translate/status — 翻译覆盖统计 */
    @Get('status')
    async translationStatus(@Query() q: any) {
        return this.service.getTranslationSummary({
            keyword: q.keyword || '',
            language: q.language || '',
            categoryIds: q.categoryIds || '',
            dateField: q.dateField || '',
            startDate: q.startDate || '',
            endDate: q.endDate || '',
        });
    }

    // ===== 任务管理 =====

    /** GET /api/translate/tasks — 任务列表 */
    @Get('tasks')
    async taskList() {
        return this.taskService.getRecentTasks();
    }

    /** GET /api/translate/tasks/:id — 任务详情 + 进度 */
    @Get('tasks/:id')
    async taskProgress(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的任务ID' };
        return this.taskService.getTaskProgress(nid);
    }

    /** POST /api/translate/tasks/:id/retry — 重试失败项 */
    @Post('tasks/:id/retry')
    async taskRetry(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的任务ID' };
        const newId = await this.taskService.retryFailed(nid);
        if (!newId) return { success: false, message: '没有失败项需要重试' };
        return { success: true, taskId: newId, message: '重试任务已启动' };
    }

    /** GET /api/translate/tasks/:id/failures — 失败项 */
    @Get('tasks/:id/failures')
    async taskFailures(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的任务ID' };
        return this.taskService.getFailures(nid);
    }

    /** GET /api/translate/tasks/:id/stream — SSE 实时进度流 */
    @Get('tasks/:id/stream')
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

    @Post(':id/description')
    async translateDesc(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const result = await this.service.translateDescription(nid);
        return { success: true, descriptionCn: result };
    }

    @Post(':id/readme')
    async translateReadme(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const result = await this.service.translateReadme(nid);
        return { success: true, readmeCn: result };
    }

    @Post(':id/readme/async')
    async translateReadmeAsync(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const taskId = await this.taskService.createAndStartSingleReadme(nid);
        if (!taskId) return { success: false, message: '仓库不存在' };
        return { success: true, taskId, message: '翻译任务已启动' };
    }

    @Post(':id/readme/retranslate')
    async translateReadmeRetranslate(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const taskId = await this.taskService.createAndStartSingleReadmeForce(nid);
        if (!taskId) return { success: false, message: '仓库不存在' };
        return { success: true, taskId, message: '重新翻译任务已启动' };
    }

    @Post(':id')
    async translateFull(@Param('id') id: string) {
        const nid = this.parseId(id);
        if (!this.isValidId(nid)) return { success: false, message: '无效的仓库ID' };
        const repo = await this.repoService.findById(nid);
        if (!repo) return { success: false, message: '仓库不存在' };
        const desc = await this.service.translateDescription(nid);
        const readme = await this.service.translateReadme(nid);
        return { success: true, descriptionCn: desc, readmeCn: readme, readmeFetched: !!readme };
    }

    @Get(':id/status')
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
