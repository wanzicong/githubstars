import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 数据库服务 — 全局连接生命周期管理
 *
 * 继承 PrismaClient，实现 NestJS 生命周期钩子，管理数据库连接：
 * - onModuleInit 时自动建立连接
 * - onModuleDestroy 时释放连接资源
 *
 * BigInt 序列化已迁移至 BigIntInterceptor，不再使用全局原型猴子补丁。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    /**
     * 模块初始化时建立数据库连接
     *
     * 调用 PrismaClient.$connect() 连接 MySQL 数据库。
     */
    async onModuleInit() {
        this.logger.log('正在连接数据库...');
        await this.$connect();
        this.logger.log('数据库连接成功');
    }

    /**
     * 模块销毁时断开数据库连接
     *
     * 调用 PrismaClient.$disconnect() 优雅释放连接池资源。
     */
    async onModuleDestroy() {
        this.logger.log('正在断开数据库连接...');
        await this.$disconnect();
        this.logger.log('数据库连接已断开');
    }
}
