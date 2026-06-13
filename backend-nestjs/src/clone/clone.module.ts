import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { GithubModule } from '../github/github.module';
import { CloneService } from './services/clone.service';
import { CloneTaskService } from './services/clone-task.service';
import { CloneController } from './controllers/clone.controller';

@Module({
    imports: [ConfigModule, GithubModule],
    controllers: [CloneController],
    providers: [CloneService, CloneTaskService],
    exports: [CloneService, CloneTaskService],
})
export class CloneModule {}
