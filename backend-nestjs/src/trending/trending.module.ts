import { Module } from '@nestjs/common';
import { TrendingController } from './trending.controller';
import { GithubModule } from '../github/github.module';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [GithubModule, AiModule],
    controllers: [TrendingController],
})
export class TrendingModule {}
