import { Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SyncService } from './sync.service';

@ApiTags('sync')
@Controller('api')
export class SyncController {
    private readonly logger = new Logger(SyncController.name);

    constructor(private readonly service: SyncService) {}

    /**
     * 手动触发同步任务
     *
     * @returns 返回启动结果，若已有同步任务在执行中则返回失败
     */
    @Post('sync/manual')
    @ApiOperation({ summary: '手动触发同步', description: '从 GitHub API 全量拉取 Star 仓库并同步到数据库' })
    async manual() {
        if (this.service.isSyncing()) {
            this.logger.warn('手动同步请求被拒绝：已有同步任务在执行中');
            return { success: false, message: '已有同步任务在执行中' };
        }
        this.logger.log('收到手动同步请求');
        this.service.startManualSync();
        return { success: true, message: '同步任务已启动' };
    }

    /**
     * 获取当前同步状态
     *
     * @returns 同步状态、仓库总数、上次成功同步时间等概览信息
     */
    @Get('sync/status')
    @ApiOperation({ summary: '获取同步状态', description: '返回当前是否在同步中、仓库总数、上次成功同步时间等' })
    async status() {
        return this.service.getSyncStatus();
    }

    /**
     * 分页获取同步日志
     *
     * @param q.pageNum 页码，默认1
     * @param q.pageSize 每页条数，默认10
     * @returns 分页后的同步日志列表
     */
    @Get('sync/logs')
    @ApiOperation({ summary: '获取同步日志', description: '分页返回历史同步记录' })
    @ApiQuery({ name: 'pageNum', required: false, description: '页码，默认 1' })
    @ApiQuery({ name: 'pageSize', required: false, description: '每页条数，默认 10' })
    async logs(@Query() q: any) {
        return this.service.getSyncLogs(parseInt(q.pageNum) || 1, parseInt(q.pageSize) || 10);
    }
}
