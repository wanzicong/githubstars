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

@Module({
    imports: [GithubModule, forwardRef(() => CategoryModule), ConfigModule],
    controllers: [AiAnalyzeController, AiClassifyController, SimilarRepoController],
    providers: [AiAnalyzeService, AiClassifyService, SimilarRepoService],
    exports: [AiAnalyzeService, AiClassifyService, SimilarRepoService],
})
export class AiModule {}
