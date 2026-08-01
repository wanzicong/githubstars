/**
 * 集成测试数据隔离与 NestJS 应用工厂
 *
 * TestTransaction: 每个 afterEach 调用 cleanAll() 删除测试数据
 * createTestingApp: 创建 NestJS 测试应用
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * 集成测试数据清理工具
 *
 * 替代 MySQL 原生事务（Prisma 不支持 START TRANSACTION prepared statement），
 * 在 afterEach 中调用 cleanAll() 删除测试期间产生的所有数据。
 */
export class TestTransaction {
    constructor(private readonly prisma: PrismaService) {}

    async begin(): Promise<void> {
        // no-op for cleanup-based approach
    }

    async rollback(): Promise<void> {
        await this.cleanAll();
    }

    /** 清理所有测试数据 */
    async cleanAll(): Promise<void> {
        await this.prisma.categoryRepoLink.deleteMany();
        await this.prisma.category.deleteMany();
        await this.prisma.githubRepo.deleteMany();
        await this.prisma.syncLog.deleteMany();
        await this.prisma.cloneTask.deleteMany();
        await this.prisma.cloneTaskItem.deleteMany();
    }

    async commit(): Promise<void> {
        // no-op for cleanup-based approach
    }
}

export async function createTestingApp(): Promise<{
    app: INestApplication;
    prisma: PrismaService;
    module: TestingModule;
}> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    const prisma = moduleFixture.get<PrismaService>(PrismaService);
    return { app, prisma, module: moduleFixture };
}
