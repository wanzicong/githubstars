import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { GithubModule } from '../github/github.module';

@Module({
    imports: [GithubModule],
    controllers: [ExportController],
    providers: [ExportService],
})
export class ExportModule {}
