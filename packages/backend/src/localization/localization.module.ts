import { Module } from '@nestjs/common';
import { LocalizationController } from './localization.controller';
import { RepositoryLocalizationService } from './repository-localization.service';

@Module({
    controllers: [LocalizationController],
    providers: [RepositoryLocalizationService],
    exports: [RepositoryLocalizationService],
})
export class LocalizationModule {}
