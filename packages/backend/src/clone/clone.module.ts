import { Module } from '@nestjs/common';
import { CloneService } from './clone.service';
import { CloneController } from './clone.controller';
import { CloneScheduler } from './clone.scheduler';

@Module({
    controllers: [CloneController],
    providers: [CloneService, CloneScheduler],
    exports: [CloneService],
})
export class CloneModule {}
