import { Module } from '@nestjs/common';
import { TrendingController } from './trending.controller';
import { GithubModule } from '../github/github.module';
import { TranslateModule } from '../translate/translate.module';

/**
 * GitHub Trending 模块
 *
 * 提供 GitHub Trending 仓库的查询与分析功能，
 * 通过 GitHub Search API 获取每日/每周热门仓库。
 * 依赖于 GithubModule（GitHub API）和 TranslateModule（翻译增强）。
 */
@Module({
    imports: [GithubModule, TranslateModule],
    controllers: [TrendingController],
})
export class TrendingModule {}
