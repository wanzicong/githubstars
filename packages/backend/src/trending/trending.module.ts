import { Module } from '@nestjs/common';
import { TrendingController } from './trending.controller';
import { GithubModule } from '../github/github.module';
import { TranslateModule } from '../translate/translate.module';

@Module({
    imports: [GithubModule, TranslateModule],
    controllers: [TrendingController],
})
export class TrendingModule {}
