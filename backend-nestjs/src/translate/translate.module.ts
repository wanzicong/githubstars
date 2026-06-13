import { Module } from '@nestjs/common';
import { TranslateService } from './services/translate.service';
import { TranslateTaskService } from './services/translate-task.service';
import { TranslateController } from './controllers/translate.controller';
import { GithubModule } from '../github/github.module';
import { ConfigModule } from '../config/config.module';

@Module({
    imports: [GithubModule, ConfigModule],
    controllers: [TranslateController],
    providers: [TranslateService, TranslateTaskService],
    exports: [TranslateService, TranslateTaskService],
})
export class TranslateModule {}
