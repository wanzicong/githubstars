import { Module } from '@nestjs/common';
import { SimilarCacheController } from './similar-cache.controller';
import { SimilarCacheService } from './similar-cache.service';

/**
 * 相似项目缓存模块
 *
 * 将 Agent 相似项目搜索的结果持久化到数据库，
 * 支持按仓库 ID 查询、列表分页、单条/全部删除。
 *
 * @see SimilarCacheService
 * @see SimilarCacheController
 */
@Module({
    controllers: [SimilarCacheController],
    providers: [SimilarCacheService],
    exports: [SimilarCacheService],
})
export class SimilarCacheModule {}
