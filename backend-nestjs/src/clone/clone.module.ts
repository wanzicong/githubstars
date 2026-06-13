import { Module } from '@nestjs/common'
import { ConfigModule } from '../config/config.module'
import { CloneService } from './services/clone.service'
import { CloneTaskService } from './services/clone-task.service'
import { CloneController } from './controllers/clone.controller'

@Module({
  imports: [ConfigModule],
  controllers: [CloneController],
  providers: [CloneService, CloneTaskService],
  exports: [CloneService, CloneTaskService],
})
export class CloneModule {}
