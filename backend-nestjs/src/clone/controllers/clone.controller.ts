import { Controller, Get, Post, Delete, Param, Query, Body, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { CloneService } from '../services/clone.service';
import { CloneTaskService } from '../services/clone-task.service';

@Controller()
export class CloneController {
    private readonly logger = new Logger(CloneController.name);

    constructor(
        private readonly cloneService: CloneService,
        private readonly taskService: CloneTaskService,
    ) {}

    /**
     * 获取克隆配置信息
     *
     * @returns 克隆配置，包含基础目录、子目录历史等
     */
    @Get('api/clone/config')
    async config() {
        return this.cloneService.getCloneConfig();
    }

    /**
     * 检查磁盘空间是否足够进行克隆
     *
     * @param q.subDirectory 子目录路径
     * @param q.repoCount 预计克隆的仓库数量
     * @returns 磁盘空间检查结果
     */
    @Get('api/clone/disk-space')
    async diskSpace(@Query() q: any) {
        return this.cloneService.checkDiskSpace(q.subDirectory || '', parseInt(q.repoCount) || 50);
    }

    /**
     * 启动批量克隆任务
     *
     * @param q 查询参数，包含筛选条件、并发数、克隆深度等
     * @returns 任务创建结果，包含 taskId
     */
    @Post('api/clone/start')
    async start(@Query() q: any) {
        this.logger.log('接收到批量克隆启动请求');
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

    /**
     * 查询单个克隆任务状态，包含克隆结果列表
     *
     * @param taskId 任务 ID
     * @returns 任务状态及克隆结果
     */
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

    /**
     * 取消正在运行或等待中的克隆任务
     *
     * @param taskId 任务 ID
     * @returns 取消结果
     */
    @Post('api/clone/task/:taskId/cancel')
    async cancel(@Param('taskId') taskId: string) {
        this.logger.log('接收到取消克隆任务请求: taskId=' + taskId);
        const ok = await this.cloneService.cancelTask(taskId);
        return { success: ok, message: ok ? '任务已取消' : '无法取消' };
    }

    /**
     * 分页查询克隆任务列表
     *
     * @param q.page 页码
     * @param q.size 每页数量
     * @returns 任务分页数据
     */
    @Get('api/clone/tasks')
    async tasks(@Query() q: any) {
        const result = await this.taskService.getTaskPage(parseInt(q.page) || 1, parseInt(q.size) || 20);
        return { success: true, ...result };
    }

    /**
     * 查询克隆任务详情（含分页任务项）
     *
     * @param taskId 任务 ID
     * @param q.page 页码
     * @param q.size 每页数量
     * @param q.status 可选的状态筛选
     * @returns 任务详情及分页任务项
     */
    @Get('api/clone/tasks/:taskId')
    async taskDetail(@Param('taskId') taskId: string, @Query() q: any) {
        const detail = await this.taskService.getTaskDetail(taskId, parseInt(q.page) || 1, parseInt(q.size) || 100, q.status || '');
        if (!detail) return { success: false, message: '任务不存在' };
        return { success: true, ...detail };
    }

    /**
     * 删除克隆任务及其所有任务项
     *
     * @param taskId 任务 ID
     * @returns 删除结果
     */
    @Delete('api/clone/tasks/:taskId')
    async deleteTask(@Param('taskId') taskId: string) {
        this.logger.log('删除克隆任务: taskId=' + taskId);
        await this.taskService.deleteTaskByTaskId(taskId);
        return { success: true, message: '任务已删除' };
    }

    /**
     * 分页查询指定任务的任务项列表
     *
     * @param taskId 任务 ID
     * @param q.page 页码
     * @param q.size 每页数量
     * @param q.status 可选的状态筛选
     * @returns 任务项分页数据
     */
    @Get('api/clone/tasks/:taskId/items')
    async taskItems(@Param('taskId') taskId: string, @Query() q: any) {
        const result = await this.taskService.getItemsByTaskId(taskId, parseInt(q.page) || 1, parseInt(q.size) || 100, q.status || '');
        return { success: true, ...result };
    }

    /**
     * 重试所有存在失败项的任务
     *
     * @returns 重试结果汇总
     */
    @Post('api/clone/tasks/retry-all')
    async retryAll() {
        try {
            const ids = await this.taskService.getTaskIdsWithFailedItems();
            if (!ids.length) return { success: false, message: '没有需要重试的任务' };
            this.logger.log('批量重试克隆失败项: 任务数=' + ids.length);
            let totalRetried = 0;
            for (const id of ids) {
                const r = await this.cloneService.retryFailedClones(id);
                if (r.success) totalRetried += (r as any).retryCount || 0;
            }
            return { success: true, message: `处理了 ${ids.length} 个任务，共重试 ${totalRetried} 个失败项` };
        } catch (e) {
            this.logger.error('批量重试克隆失败项异常: ' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 重试指定任务的失败项
     *
     * @param taskId 任务 ID
     * @returns 重试结果
     */
    @Post('api/clone/tasks/:taskId/retry')
    async retryTask(@Param('taskId') taskId: string) {
        this.logger.log('重试任务失败项: taskId=' + taskId);
        return this.cloneService.retryFailedClones(taskId);
    }

    /**
     * 切换任务的置顶状态
     *
     * @param taskId 任务 ID
     * @returns 置顶切换结果
     */
    @Post('api/clone/tasks/:taskId/pin')
    async pinTask(@Param('taskId') taskId: string) {
        try {
            const pinned = await this.taskService.togglePin(taskId);
            return { success: true, pinned, message: pinned ? '已置顶' : '已取消置顶' };
        } catch (e) {
            this.logger.error('任务置顶切换失败: taskId=' + taskId + ', 错误=' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 生成可下载的克隆脚本文件（PowerShell 或 Bash）
     *
     * @param q.osType 操作系统类型（windows/linux）
     * @param q 其他筛选参数
     * @param res Express 响应对象，用于直接输出文件下载
     */
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
