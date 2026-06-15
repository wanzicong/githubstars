import { Controller, Get, Query, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { LoggingService } from './logging.service';

/**
 * 日志管理控制器
 *
 * 提供日志文件的查看、列表和清空功能，用于运维调试。
 */
@ApiTags('logs')
@Controller('api/logs')
export class LoggingController {
    private readonly logger = new Logger(LoggingController.name);

    constructor(private readonly logging: LoggingService) {}

    /**
     * 获取日志文件列表
     *
     * @returns 日志文件名称、大小和修改时间列表
     */
    @Get('files')
    @ApiOperation({ summary: '获取日志文件列表', description: '返回日志目录下所有 .log 文件的名称、大小和修改时间' })
    getFiles() {
        return { success: true, files: this.logging.getLogFiles() };
    }

    /**
     * 查看指定日志文件内容
     *
     * @param file 日志文件名
     * @param lines 返回最后 N 行（可选）
     * @returns 日志文件内容
     */
    @Get('view')
    @ApiOperation({ summary: '查看日志内容', description: '读取指定日志文件的最后 N 行内容' })
    @ApiQuery({ name: 'file', required: true, description: '日志文件名（如 app.log）' })
    @ApiQuery({ name: 'lines', required: false, description: '返回最后 N 行，默认全部' })
    viewLog(@Query('file') file: string, @Query('lines') lines?: string) {
        if (!file) return { success: false, message: '请指定日志文件名' };
        const content = this.logging.readLogFile(file, lines ? parseInt(lines, 10) : undefined);
        this.logger.log('查看日志文件: ' + file + (lines ? ', 行数=' + lines : ''));
        return { success: true, content, file };
    }

    /**
     * 清空指定日志文件
     *
     * @param file 日志文件名
     * @returns 操作结果
     */
    @Post('clear')
    @HttpCode(200)
    @ApiOperation({ summary: '清空日志文件', description: '将指定日志文件内容清空（不可恢复）' })
    @ApiBody({ description: '文件名字段', schema: { type: 'object', properties: { file: { type: 'string' } } } })
    clearLog(@Body('file') file: string) {
        if (!file) return { success: false, message: '请指定日志文件名' };
        this.logger.log('请求清空日志文件: ' + file);
        const ok = this.logging.clearLogFile(file);
        this.logger.log('清空日志文件结果: file=' + file + ', success=' + ok);
        return { success: ok, message: ok ? '已清空' : '清空失败' };
    }
}
