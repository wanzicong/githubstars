import { Module } from '@nestjs/common'
import { ConfigModule } from '../config/config.module'
import { GithubApiService } from './services/github-api.service'
import { GithubSearchService } from './services/github-search.service'
import { GithubRepoService } from './services/github-repo.service'
import { StarsController } from './controllers/stars.controller'
import { GithubSearchController } from './controllers/github-search.controller'

@Module({
  imports: [ConfigModule],
  controllers: [StarsController, GithubSearchController],
  providers: [GithubApiService, GithubSearchService, GithubRepoService],
  exports: [GithubApiService, GithubSearchService, GithubRepoService],
})
export class GithubModule {}
