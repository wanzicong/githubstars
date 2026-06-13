import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';

/**
 * 系统配置模块
 *
 * 提供系统配置的管理功能，包括配置查询和保存。
 * 导出 ConfigService 供其他模块注入使用。
 */
@Module({
    controllers: [ConfigController],
    providers: [ConfigService],
    exports: [ConfigService],
})
export class ConfigModule {}
