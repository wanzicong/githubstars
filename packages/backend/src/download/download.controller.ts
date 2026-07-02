import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { DownloadService } from './download.service';
import {
    CreateDownloadTaskSchema,
    DownloadTaskIdSchema,
    EstimateSizesSchema,
    RetryItemSchema,
    ExtractItemSchema,
    DeleteItemFileSchema,
    ExtractAllSchema,
} from './download.dto';

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
    /**
     * 预估多个仓库的下载大小（HEAD 请求获取 Content-Length）
     */
    @Post('estimate-sizes')
    async estimateSizes(@Body() body: unknown) {
        const parsed = EstimateSizesSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: '仓库 ID 列表无效' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.estimateSizes(parsed.data.repoIds);
    }

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

    /**
     * 手动解压任务项的压缩包
     */
    @Post('tasks/extract')
    async extractItem(@Body() body: unknown) {
        const parsed = ExtractItemSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: parsed.error.issues[0]?.message || '参数错误' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.extractItemFile(parsed.data.taskId, parsed.data.fullName);
    }

    /**
     * 手动删除任务项的压缩包
     */
    @Post('tasks/delete-item')
    async deleteItemFile(@Body() body: unknown) {
        const parsed = DeleteItemFileSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: parsed.error.issues[0]?.message || '参数错误' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.deleteItemZipFile(parsed.data.taskId, parsed.data.fullName);
    }

    /**
     * 一键解压任务中所有已完成项的压缩包
     *
     * 自动跳过：
     * - 状态不是 COMPLETED 的任务项（失败/跳过项不处理）
     * - 已解压过的任务项（目标目录已存在）
     */
    @Post('tasks/extract-all')
    async extractAll(@Body() body: unknown) {
        const parsed = ExtractAllSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: '任务 ID 无效' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.extractAllItems(parsed.data.taskId);
    }

    /**
     * 查询批量解压进度
     */
    @Post('tasks/extract-all/progress')
    getExtractAllProgress(@Body() body: unknown) {
        const parsed = DownloadTaskIdSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ success: false, message: '任务 ID 无效' }, HttpStatus.BAD_REQUEST);
        }
        return this.downloadService.getExtractAllProgress(parsed.data.id);
    }
}
