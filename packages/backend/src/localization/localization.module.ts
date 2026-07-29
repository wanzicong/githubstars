import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { AgentTranslationClientService } from './agent-translation-client.service';
import { LocalizationController } from './localization.controller';
import { RepositoryLocalizationService } from './repository-localization.service';

@Module({
    imports: [GithubModule],
    controllers: [LocalizationController],
    providers: [AgentTranslationClientService, RepositoryLocalizationService],
    exports: [RepositoryLocalizationService],
})
export class LocalizationModule {}
