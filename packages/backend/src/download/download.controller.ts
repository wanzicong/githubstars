import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { DownloadService } from './download.service';
import { CreateDownloadTaskSchema, DownloadTaskIdSchema, RetryItemSchema } from './download.dto';

@Controller('api/download')
export class DownloadController {
    constructor(private readonly downloadService: DownloadService) {}

    /**
     * 创建下载任务
     */
    @Post()
    async createTask(@Body() body: unknown) {
        const parsed = CreateDownloadTaskSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: parsed.error.issues[0]?.message || '参数错误' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.createTask(parsed.data);
    }

    /**
     * 获取最近任务列表
     */
    @Post('tasks/list')
    async getRecentTasks() {
        return this.downloadService.getRecentTasks();
    }

    /**
     * 获取常用目录列表
     */
    @Post('directories')
    async getRecentDirectories() {
        return this.downloadService.getRecentDirectories();
    }

    /**
     * 查询任务进度详情
     */
    @Post('tasks/detail')
    async getTaskProgress(@Body() body: unknown) {
        const parsed = DownloadTaskIdSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: '任务 ID 无效' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.getTaskProgress(parsed.data.id);
    }

    /**
     * 重试失败项
     */
    @Post('tasks/retry')
    async retryFailed(@Body() body: unknown) {
        const parsed = DownloadTaskIdSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: '任务 ID 无效' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.retryFailed(parsed.data.id);
    }

    /**
     * 重置整个任务
     */
    @Post('tasks/reset')
    async resetTask(@Body() body: unknown) {
        const parsed = DownloadTaskIdSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: '任务 ID 无效' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.resetTask(parsed.data.id);
    }

    /**
     * 重试单个任务项
     */
    @Post('tasks/retry-item')
    async retryItem(@Body() body: unknown) {
        const parsed = RetryItemSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: parsed.error.issues[0]?.message || '参数错误' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.retryItem(parsed.data.id, parsed.data.fullName);
    }

    /**
     * 删除任务
     */
    @Post('tasks/delete')
    async deleteTask(@Body() body: unknown) {
        const parsed = DownloadTaskIdSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: '任务 ID 无效' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.deleteTask(parsed.data.id);
    }
}
