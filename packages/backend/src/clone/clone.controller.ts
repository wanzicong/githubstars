import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { CloneService } from './clone.service';
import { CreateCloneTaskSchema, CloneTaskIdSchema, RetryItemSchema } from './clone.dto';

@Controller('api/clone')
export class CloneController {
    constructor(private readonly cloneService: CloneService) {}

    /**
     * 创建克隆任务
     */
    @Post()
    async createTask(@Body() body: unknown) {
        const parsed = CreateCloneTaskSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                { success: false, message: parsed.error.issues[0]?.message || '参数错误' },
                HttpStatus.BAD_REQUEST,
            );
        }
        return this.cloneService.createTask(parsed.data);
    }

    /**
     * 获取最近任务列表
     */
    @Post('tasks/list')
    async getRecentTasks() {
        return this.cloneService.getRecentTasks();
    }

    /**
     * 获取常用目录列表
     */
    @Post('directories')
    async getRecentDirectories() {
        return this.cloneService.getRecentDirectories();
    }

    /**
     * 查询任务进度详情
     */
    @Post('tasks/detail')
    async getTaskProgress(@Body() body: unknown) {
        const parsed = CloneTaskIdSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                { success: false, message: '任务 ID 无效' },
                HttpStatus.BAD_REQUEST,
            );
        }
        return this.cloneService.getTaskProgress(parsed.data.id);
    }

    /**
     * 重试失败项
     */
    @Post('tasks/retry')
    async retryFailed(@Body() body: unknown) {
        const parsed = CloneTaskIdSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                { success: false, message: '任务 ID 无效' },
                HttpStatus.BAD_REQUEST,
            );
        }
        return this.cloneService.retryFailed(parsed.data.id);
    }

    /**
     * 重置整个任务
     */
    @Post('tasks/reset')
    async resetTask(@Body() body: unknown) {
        const parsed = CloneTaskIdSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                { success: false, message: '任务 ID 无效' },
                HttpStatus.BAD_REQUEST,
            );
        }
        return this.cloneService.resetTask(parsed.data.id);
    }

    /**
     * 重试单个任务项
     */
    @Post('tasks/retry-item')
    async retryItem(@Body() body: unknown) {
        const parsed = RetryItemSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                { success: false, message: parsed.error.issues[0]?.message || '参数错误' },
                HttpStatus.BAD_REQUEST,
            );
        }
        return this.cloneService.retryItem(parsed.data.id, parsed.data.fullName);
    }
}
