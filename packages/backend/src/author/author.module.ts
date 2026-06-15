import { Module } from '@nestjs/common';
import { AuthorService } from './author.service';
import { AuthorController } from './author.controller';

/**
 * 作者中心模块
 *
 * 提供作者维度的 Star 仓库浏览功能：作者列表（含搜索）、作者仓库分页查询、仓库 URL 导出。
 * 使用 $queryRaw 进行聚合查询，确保大数据量下的查询性能。
 */
@Module({
    controllers: [AuthorController],
    providers: [AuthorService],
})
export class AuthorModule {}
