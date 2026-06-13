import { Controller, Get, Query, Post, Body, HttpCode } from '@nestjs/common';
import { LoggingService } from './logging.service';

@Controller('api/logs')
export class LoggingController {
    constructor(private readonly logging: LoggingService) {}

    @Get('files')
    getFiles() {
        return { success: true, files: this.logging.getLogFiles() };
    }

    @Get('view')
    viewLog(@Query('file') file: string, @Query('lines') lines?: string) {
        if (!file) return { success: false, message: '请指定日志文件名' };
        const content = this.logging.readLogFile(file, lines ? parseInt(lines, 10) : undefined);
        return { success: true, content, file };
    }

    @Post('clear')
    @HttpCode(200)
    clearLog(@Body('file') file: string) {
        if (!file) return { success: false, message: '请指定日志文件名' };
        const ok = this.logging.clearLogFile(file);
        return { success: ok, message: ok ? '已清空' : '清空失败' };
    }
}
