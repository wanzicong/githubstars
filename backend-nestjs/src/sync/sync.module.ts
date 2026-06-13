import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { GithubModule } from '../github/github.module';

/**
 * 同步模块
 *
 * 负责从 GitHub API 拉取 Star 仓库列表并与本地数据库同步。
 * 依赖 GithubModule 提供的 GithubApiService 和 GithubRepoService。
 */
@Module({
    imports: [GithubModule],
    controllers: [SyncController],
    providers: [SyncService],
    exports: [SyncService],
})
export class SyncModule {}
