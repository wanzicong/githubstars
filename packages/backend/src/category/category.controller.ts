import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
    CategoryListSchema,
    CategoryCreateSchema,
    CategoryUpdateSchema,
    CategoryDeleteSchema,
    CategorySortSchema,
    CategoryReposSchema,
    CategoryBindSchema,
    CategoryUnbindSchema,
    CategoryBatchIdsSchema,
} from './category.dto';
import type {
    CategoryListDto,
    CategoryCreateDto,
    CategoryUpdateDto,
    CategoryDeleteDto,
    CategorySortDto,
    CategoryReposDto,
    CategoryBindDto,
    CategoryUnbindDto,
    CategoryBatchIdsDto,
} from './category.dto';

/**
 * 分类管理控制器
 *
 * 提供分类树查询、CRUD、拖拽排序、仓库关联管理 API。
 * 所有端点使用 POST 方法，参数通过 @Body() 传递（项目规范）。
 *
 * @callers 前端分类管理页面
 *
 * @depends
 *   - CategoryService — 所有业务逻辑
 *   - ZodValidationPipe — 参数校验
 */
@ApiTags('categories')
@Controller('api/category')
export class CategoryController {
    constructor(private readonly service: CategoryService) {}

    /**
     * 获取完整分类树（两级树形结构）
     */
    @Post('tree')
    @ApiOperation({ summary: '获取分类树', description: '获取完整分类树（两级树形结构），一级分类包含子分类列表' })
    async tree() {
        return this.service.getCategoryTree();
    }

    /**
     * 获取一级分类列表（分页）
     */
    @Post('list')
    @ApiOperation({ summary: '获取分类列表', description: '获取一级分类列表（分页），支持关键字搜索' })
    async list(@Body(new ZodValidationPipe(CategoryListSchema)) body: CategoryListDto) {
        return this.service.getCategoryList(body.page, body.size, body.keyword);
    }

    /**
     * 创建分类
     */
    @Post('create')
    @ApiOperation({ summary: '创建分类', description: '创建新分类，支持设置父分类、排序、图标、描述' })
    async create(@Body(new ZodValidationPipe(CategoryCreateSchema)) body: CategoryCreateDto) {
        return this.service.createCategory(body);
    }

    /**
     * 更新分类
     */
    @Post('update')
    @ApiOperation({ summary: '更新分类', description: '更新分类信息，支持修改名称、父分类、排序、图标、描述' })
    async update(@Body(new ZodValidationPipe(CategoryUpdateSchema)) body: CategoryUpdateDto) {
        return this.service.updateCategory(body);
    }

    /**
     * 删除分类
     */
    @Post('delete')
    @ApiOperation({ summary: '删除分类', description: '删除指定分类，如果存在子分类则删除失败' })
    async delete(@Body(new ZodValidationPipe(CategoryDeleteSchema)) body: CategoryDeleteDto) {
        return this.service.deleteCategory(body.id);
    }

    /**
     * 拖拽排序（批量更新 sortOrder）
     */
    @Post('sort')
    @ApiOperation({ summary: '分类排序', description: '拖拽排序，批量更新分类的 sortOrder' })
    async sort(@Body(new ZodValidationPipe(CategorySortSchema)) body: CategorySortDto) {
        return this.service.sortCategories(body);
    }

    /**
     * 查询某分类下的仓库列表（分页 + 筛选）
     */
    @Post('repos')
    @ApiOperation({ summary: '查询分类仓库', description: '查询某分类下的仓库列表（分页 + 筛选）' })
    async repos(@Body(new ZodValidationPipe(CategoryReposSchema)) body: CategoryReposDto) {
        return this.service.getCategoryRepos(body);
    }

    /**
     * 绑定仓库到分类（批量）
     */
    @Post('bind')
    @ApiOperation({ summary: '绑定仓库到分类', description: '批量绑定仓库到指定分类' })
    async bind(@Body(new ZodValidationPipe(CategoryBindSchema)) body: CategoryBindDto) {
        return this.service.bindReposToCategory(body);
    }

    /**
     * 解绑仓库从分类
     */
    @Post('unbind')
    @ApiOperation({ summary: '解绑仓库从分类', description: '批量解绑仓库从指定分类' })
    async unbind(@Body(new ZodValidationPipe(CategoryUnbindSchema)) body: CategoryUnbindDto) {
        return this.service.unbindReposFromCategory(body);
    }

    /**
     * 获取分类下所有仓库 ID（用于批量克隆/下载）
     *
     * 返回当前分类（可选包含子分类）下的所有仓库 ID，已去重。
     * 前端用于批量克隆/下载操作时获取仓库列表。
     *
     * @callers CategoryRepoPanel 批量克隆/下载按钮
     * @depends CategoryService.getCategoryRepoIds()
     */
    @Post('batch-ids')
    @ApiOperation({ summary: '获取分类仓库 ID', description: '获取分类下所有仓库信息（用于批量克隆/下载），支持递归包含子分类' })
    async batchIds(@Body(new ZodValidationPipe(CategoryBatchIdsSchema)) body: CategoryBatchIdsDto) {
        const result = await this.service.getCategoryRepoIds(body.categoryId, body.includeChildren);
        return { success: true, data: result };
    }
}
