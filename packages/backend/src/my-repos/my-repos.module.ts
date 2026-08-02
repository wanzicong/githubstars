import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { MyRepoService } from './my-repo.service';
import { MyRepoSyncService } from './my-repo-sync.service';
import { MyReposController } from './my-repos.controller';

/**
 * 我的仓库模块
 *
 * 管理用户自己在 GitHub 上创建的仓库：
 * - MyRepoSyncService：从 /user/repos 全量同步（UPSERT 增量）
 * - MyRepoService：列表/详情/筛选/分类绑定/翻译流水线对接/统计
 * - MyReposController：/api/my-repos/* HTTP 端点
 *
 * @depends GithubModule（复用 GithubApiService 拉取 GitHub 数据）
 */
@Module({
    imports: [GithubModule],
    controllers: [MyReposController],
    providers: [MyRepoService, MyRepoSyncService],
    exports: [MyRepoService],
})
export class MyReposModule {}
