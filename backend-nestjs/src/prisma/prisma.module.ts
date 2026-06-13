import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Prisma 数据库模块 — 全局模块
 *
 * 提供 PrismaService 作为全局数据库访问层，
 * 通过 @Global() 装饰器注入，各业务模块无需显式导入即可使用 PrismaService。
 */
@Global()
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule {}
