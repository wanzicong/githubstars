import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { GithubApiService } from './services/github-api.service';
import { GithubSearchService } from './services/github-search.service';
import { GithubRepoService } from './services/github-repo.service';
import { StarsController } from './controllers/stars.controller';
import { GithubSearchController } from './controllers/github-search.controller';

/**
 * GitHub 模块
 *
 * 封装 GitHub API 交互相关功能，包括：
 * - GithubApiService：获取星标仓库列表、README 内容
 * - GithubSearchService：搜索仓库、Star/取消 Star 操作
 * - GithubRepoService：星标仓库数据的 CRUD 操作
 * - StarsController：星标仓库列表、详情、导出的 HTTP 接口
 * - GithubSearchController：GitHub 搜索、Star 操作的 HTTP 接口
 */
@Module({
    imports: [ConfigModule],
    controllers: [StarsController, GithubSearchController],
    providers: [GithubApiService, GithubSearchService, GithubRepoService],
    exports: [GithubApiService, GithubSearchService, GithubRepoService],
})
export class GithubModule {}
