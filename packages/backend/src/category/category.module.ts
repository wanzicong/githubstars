import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';

/**
 * 分类模块
 *
 * 提供分类管理功能，包括分类树查询、分类 CRUD、拖拽排序、仓库关联管理。
 * 使用 PrismaService 进行数据库操作（通过全局 PrismaModule 获取）。
 */
@Module({
    controllers: [CategoryController],
    providers: [CategoryService],
})
export class CategoryModule {}
