import { Module } from '@nestjs/common';
import { CloneService } from './clone.service';
import { CloneExecutorService } from './clone-executor.service';
import { CloneCleanupService } from './clone-cleanup.service';
import { CloneController } from './clone.controller';
import { CloneScheduler } from './clone.scheduler';

@Module({
    controllers: [CloneController],
    providers: [CloneService, CloneExecutorService, CloneCleanupService, CloneScheduler],
    exports: [CloneService],
})
export class CloneModule {}
