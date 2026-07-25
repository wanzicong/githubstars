import { Module } from '@nestjs/common';
import { LearnController, LearnTagController } from './learn.controller';
import { LearnService } from './learn.service';
import { LearnTagService } from './learn-tag.service';

/**
 * 学习收藏模块
 *
 * 提供从已 star 的 github_repo 中挑选「想学习」项目的管理能力。
 * 复用现有 category 表作为分类，新增独立 learn_tag 作为平铺标签。
 * PrismaService 由全局 PrismaModule 提供。
 */
@Module({
    controllers: [LearnController, LearnTagController],
    providers: [LearnService, LearnTagService],
    exports: [LearnService, LearnTagService],
})
export class LearnModule {}
