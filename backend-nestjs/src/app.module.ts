import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from './config/config.module';
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
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        PrismaModule,
        ConfigModule,
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
    ],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: BigIntInterceptor,
        },
    ],
})
export class AppModule {}
