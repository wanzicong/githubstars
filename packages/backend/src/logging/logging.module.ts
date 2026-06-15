import { Global, Module } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { LoggingController } from './logging.controller';

/**
 * 日志模块 — 全局模块
 *
 * 提供基于 Winston 的自定义日志服务（LoggingService），
 * 替代 NestJS 默认 ConsoleLogger，支持文件滚动存储和日志查询。
 * 通过 @Global() 装饰器全局可用，无需各模块显式导入。
 */
@Global()
@Module({
    providers: [LoggingService],
    exports: [LoggingService],
    controllers: [LoggingController],
})
export class LoggingModule {}
