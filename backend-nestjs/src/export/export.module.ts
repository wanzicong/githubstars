import { Module } from '@nestjs/common'
import { ExportController } from './export.controller'
import { GithubModule } from '../github/github.module'

@Module({
  imports: [GithubModule],
  controllers: [ExportController],
})
export class ExportModule {}
