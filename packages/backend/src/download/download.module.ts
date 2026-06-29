import { Module } from '@nestjs/common';
import { DownloadService } from './download.service';
import { DownloadController } from './download.controller';
import { DownloadScheduler } from './download.scheduler';

@Module({
    controllers: [DownloadController],
    providers: [DownloadService, DownloadScheduler],
    exports: [DownloadService],
})
export class DownloadModule {}
