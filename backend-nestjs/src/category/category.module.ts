import { Module, forwardRef } from '@nestjs/common'
import { CategoryService } from './category.service'
import { CategoryController } from './category.controller'
import { AiModule } from '../ai/ai.module'
import { GithubModule } from '../github/github.module'

@Module({
  imports: [forwardRef(() => AiModule), GithubModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
