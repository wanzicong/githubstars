import { Controller, Get, Post, Delete, Param, Query, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CloneService } from '../services/clone.service';
import { CloneTaskService } from '../services/clone-task.service';

@Controller()
export class CloneController {
    constructor(
        private readonly cloneService: CloneService,
        private readonly taskService: CloneTaskService,
    ) {}

    @Get('api/clone/config')
    async config() {
        return this.cloneService.getCloneConfig();
    }

    @Get('api/clone/disk-space')
    async diskSpace(@Query() q: any) {
        return this.cloneService.checkDiskSpace(q.subDirectory || '', parseInt(q.repoCount) || 50);
    }

    @Post('api/clone/start')
    async start(@Query() q: any) {
        return this.cloneService.startBatchClone({
            keyword: q.keyword || '',
            language: q.language || '',
            categoryIds: q.categoryIds || '',
            maxCount: parseInt(q.maxCount) || 50,
            subDirectory: q.subDirectory || '',
            dateField: q.dateField || '',
            startDate: q.startDate || '',
            endDate: q.endDate || '',
            sortBy: q.sortBy || 'starred_at',
            sortOrder: q.sortOrder || 'desc',
            concurrency: parseInt(q.concurrency) || 5,
            cloneDepth: parseInt(q.cloneDepth) || 1,
            maxRepoSizeMb: parseInt(q.maxRepoSizeMb) || 500,
        });
    }

    @Get('api/clone/task/:taskId')
    async task(@Param('taskId') taskId: string) {
        const t = await this.cloneService.getTask(taskId);
        if (!t) return { success: false, message: '任务不存在' };
        return {
            success: true,
            taskId: t.taskId,
            status: t.status,
            totalRepos: t.totalRepos,
            completedRepos: t.completedRepos,
            failedRepos: t.failedRepos,
            skippedRepos: t.skippedRepos,
            cancelled: t.cancelled,
            results: (t as any).items?.map((i: any) => ({ fullName: i.fullName, status: i.status, message: i.message })),
        };
    }

    @Post('api/clone/task/:taskId/cancel')
    async cancel(@Param('taskId') taskId: string) {
        const ok = await this.cloneService.cancelTask(taskId);
        return { success: ok, message: ok ? '任务已取消' : '无法取消' };
    }

    @Get('api/clone/tasks')
    async tasks(@Query() q: any) {
        const result = await this.taskService.getTaskPage(parseInt(q.page) || 1, parseInt(q.size) || 20);
        return { success: true, ...result };
    }

    @Get('api/clone/tasks/:taskId')
    async taskDetail(@Param('taskId') taskId: string, @Query() q: any) {
        const detail = await this.taskService.getTaskDetail(taskId, parseInt(q.page) || 1, parseInt(q.size) || 100, q.status || '');
        if (!detail) return { success: false, message: '任务不存在' };
        return { success: true, ...detail };
    }

    @Delete('api/clone/tasks/:taskId')
    async deleteTask(@Param('taskId') taskId: string) {
        await this.taskService.deleteTaskByTaskId(taskId);
        return { success: true, message: '任务已删除' };
    }

    @Get('api/clone/tasks/:taskId/items')
    async taskItems(@Param('taskId') taskId: string, @Query() q: any) {
        const result = await this.taskService.getItemsByTaskId(taskId, parseInt(q.page) || 1, parseInt(q.size) || 100, q.status || '');
        return { success: true, ...result };
    }

    @Post('api/clone/tasks/retry-all')
    async retryAll() {
        try {
            const ids = await this.taskService.getTaskIdsWithFailedItems();
            if (!ids.length) return { success: false, message: '没有需要重试的任务' };
            let totalRetried = 0;
            for (const id of ids) {
                const r = await this.cloneService.retryFailedClones(id);
                if (r.success) totalRetried += (r as any).retryCount || 0;
            }
            return { success: true, message: `处理了 ${ids.length} 个任务，共重试 ${totalRetried} 个失败项` };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    @Post('api/clone/tasks/:taskId/retry')
    async retryTask(@Param('taskId') taskId: string) {
        return this.cloneService.retryFailedClones(taskId);
    }

    @Post('api/clone/tasks/:taskId/pin')
    async pinTask(@Param('taskId') taskId: string) {
        try {
            const pinned = await this.taskService.togglePin(taskId);
            return { success: true, pinned, message: pinned ? '已置顶' : '已取消置顶' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    @Get('api/clone/script')
    async script(@Query() q: any, @Res() res: Response) {
        const script = await this.cloneService.generateCloneScript({
            osType: q.osType || 'windows',
            keyword: q.keyword || '',
            language: q.language || '',
            categoryIds: q.categoryIds || '',
            maxCount: parseInt(q.maxCount) || 50,
            subDirectory: q.subDirectory || '',
            cloneDepth: parseInt(q.cloneDepth) || 1,
        });
        const ext = q.osType === 'linux' ? 'sh' : 'ps1';
        res.set({
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('clone-script.' + ext)}`,
        });
        res.send(script);
    }
}
