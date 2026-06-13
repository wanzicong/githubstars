import { Module, forwardRef } from '@nestjs/common';
import { AiAnalyzeService } from './services/ai-analyze.service';
import { AiClassifyService } from './services/ai-classify.service';
import { SimilarRepoService } from './services/similar-repo.service';
import { AiAnalyzeController } from './controllers/ai-analyze.controller';
import { AiClassifyController } from './controllers/ai-classify.controller';
import { SimilarRepoController } from './controllers/similar-repo.controller';
import { CategoryModule } from '../category/category.module';
import { GithubModule } from '../github/github.module';
import { ConfigModule } from '../config/config.module';

/**
 * AI 功能模块
 *
 * 提供 AI 分析（仓库集合分析、Trending 趋势分析）、
 * AI 分类（普通分类、智能分类）和相似仓库推荐功能。
 * 依赖 GithubModule、ConfigModule（配置读取）和 CategoryModule（分类数据）。
 */
@Module({
    imports: [GithubModule, forwardRef(() => CategoryModule), ConfigModule],
    controllers: [AiAnalyzeController, AiClassifyController, SimilarRepoController],
    providers: [AiAnalyzeService, AiClassifyService, SimilarRepoService],
    exports: [AiAnalyzeService, AiClassifyService, SimilarRepoService],
})
export class AiModule {}
