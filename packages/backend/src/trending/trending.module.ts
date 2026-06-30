import { Module } from '@nestjs/common';
import { TrendingController } from './trending.controller';
import { TrendingService } from './trending.service';
import { GithubModule } from '../github/github.module';
import { TranslateModule } from '../translate/translate.module';
import { DownloadModule } from '../download/download.module';

/**
 * GitHub Trending 模块
 *
 * 提供 GitHub Trending 仓库的查询、翻译缓存与分析功能，
 * 通过 GitHub Search API 获取每日/每周热门仓库。
 * TrendingService 负责翻译结果的缓存管理，同一仓库描述只翻译一次。
 */
@Module({
    imports: [GithubModule, TranslateModule, DownloadModule],
    controllers: [TrendingController],
    providers: [TrendingService],
})
export class TrendingModule {}
