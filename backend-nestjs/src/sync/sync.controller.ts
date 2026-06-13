import { Controller, Get, Post, Query } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('api')
export class SyncController {
    constructor(private readonly service: SyncService) {}

    @Post('sync/manual')
    async manual() {
        if (this.service.isSyncing()) return { success: false, message: '已有同步任务在执行中' };
        this.service.startManualSync();
        return { success: true, message: '同步任务已启动' };
    }

    @Get('sync/status')
    async status() {
        return this.service.getSyncStatus();
    }

    @Get('sync/logs')
    async logs(@Query() q: any) {
        return this.service.getSyncLogs(parseInt(q.pageNum) || 1, parseInt(q.pageSize) || 10);
    }
}
