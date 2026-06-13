import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from './config/config.module';
import { LoggingModule } from './logging/logging.module';
import { GithubModule } from './github/github.module';
import { SyncModule } from './sync/sync.module';
import { CategoryModule } from './category/category.module';
import { StatsModule } from './stats/stats.module';
import { AuthorModule } from './author/author.module';
import { TranslateModule } from './translate/translate.module';
import { AiModule } from './ai/ai.module';
import { CloneModule } from './clone/clone.module';
import { TrendingModule } from './trending/trending.module';
import { ExportModule } from './export/export.module';
import { AgentModule } from './agent/agent.module';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

/**
 * 应用根模块
 *
 * 注册所有业务子模块（GitHub、同步、分类、翻译、AI、克隆、统计、导出等），
 * 导入定时任务调度器、Prisma ORM、配置管理、日志服务等基础设施，
 * 并在全局范围注册 BigInt 拦截器，将 BigInt 类型的 ID 序列化为 Number。
 */
@Module({
    imports: [
        ScheduleModule.forRoot(),
        PrismaModule,
        ConfigModule,
        LoggingModule,
        GithubModule,
        SyncModule,
        CategoryModule,
        StatsModule,
        AuthorModule,
        TranslateModule,
        AiModule,
        CloneModule,
        TrendingModule,
        ExportModule,
        AgentModule,
    ],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: BigIntInterceptor,
        },
    ],
})
export class AppModule {}
