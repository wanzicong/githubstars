import { Controller, Post, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AiAnalyzeService } from '../services/ai-analyze.service';

@ApiTags('analyze')
@Controller('api/analyze')
export class AiAnalyzeController {
    constructor(private readonly service: AiAnalyzeService) {}

    /**
     * 启动 AI 分析任务
     *
     * @param q.keyword 关键词筛选（可选）
     * @param q.language 语言筛选（可选）
     * @param q.categoryIds 分类 ID 筛选（可选）
     * @param q.sortBy 排序字段（默认 starred_at）
     * @param q.sortOrder 排序方向（默认 desc）
     * @returns 任务 ID 和状态信息
     */
    @Post('start')
    @ApiOperation({ summary: '启动 AI 分析', description: '根据筛选条件创建 AI 分析任务（后台异步），返回 taskId' })
    @ApiQuery({ name: 'keyword', required: false, description: '关键词筛选' })
    @ApiQuery({ name: 'language', required: false, description: '编程语言筛选' })
    @ApiQuery({ name: 'categoryIds', required: false, description: '分类 ID（逗号分隔）' })
    @ApiQuery({ name: 'sortBy', required: false, description: '排序字段，默认 starred_at' })
    @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向，默认 desc' })
    async start(@Query() q: any) {
        const taskId = this.service.createAnalyzeTask(
            q.keyword || '',
            q.language || '',
            q.categoryIds || '',
            q.sortBy || 'starred_at',
            q.sortOrder || 'desc',
        );
        return { success: true, taskId, message: 'AI分析任务已启动' };
    }

    /**
     * 查询分析任务状态
     *
     * @param taskId 任务 ID
     * @returns 任务状态信息（status、content 等）
     */
    @Get('task/:taskId')
    @ApiOperation({ summary: '查询任务状态', description: '根据 taskId 查询 AI 分析任务的执行状态与结果' })
    @ApiParam({ name: 'taskId', description: '任务 ID（UUID 格式）' })
    async task(@Param('taskId') taskId: string) {
        return this.service.getTaskStatus(taskId);
    }
}
