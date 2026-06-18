import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';

/**
 * 系统配置模块 — 全局模块
 *
 * 提供系统配置的管理功能，包括配置查询和保存。
 * 通过 @Global() 装饰器全局可用，各业务模块无需显式导入即可使用 ConfigService。
 */
@Global()
@Module({
    controllers: [ConfigController],
    providers: [ConfigService],
    exports: [ConfigService],
})
export class ConfigModule {}
