import { Module } from '@nestjs/common';
import { TrendingController } from './trending.controller';
import { GithubModule } from '../github/github.module';

@Module({
    imports: [GithubModule],
    controllers: [TrendingController],
})
export class TrendingModule {}
