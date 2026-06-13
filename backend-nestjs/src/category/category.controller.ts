import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger } from '@nestjs/common';
import { CategoryService } from './category.service';
import { AiClassifyService } from '../ai/services/ai-classify.service';

@Controller('api')
export class CategoryController {
    private readonly logger = new Logger(CategoryController.name);

    constructor(
        private readonly service: CategoryService,
        private readonly aiClassify: AiClassifyService,
    ) {}

    /**
     * 获取所有分类的树形列表（含仓库数量）
     *
     * @returns  树形分类列表
     */
    @Get('categories/all')
    async all() {
        return this.service.listAll();
    }

    /**
     * 创建新分类
     *
     * @param b  请求体：name（必填）、description、parentId
     * @returns   操作结果
     */
    @Post('categories')
    async create(@Body() b: any) {
        try {
            if (!b.name?.trim()) return { success: false, message: '分类名称不能为空' };
            const cat = await this.service.create(b.name, b.description, b.parentId);
            this.logger.log('创建分类成功: name=' + b.name + ', id=' + cat.id);
            return { success: true, category: cat };
        } catch (e) {
            this.logger.error('创建分类失败: name=' + b.name + ', 错误=' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 更新分类名称和描述
     *
     * @param id  分类 ID
     * @param b   请求体：name（必填）、description
     * @returns   操作结果
     */
    @Put('categories/:id')
    async update(@Param('id') id: string, @Body() b: any) {
        try {
            if (!b.name?.trim()) return { success: false, message: '分类名称不能为空' };
            await this.service.update(parseInt(id), b.name, b.description);
            this.logger.log('更新分类成功: id=' + id + ', name=' + b.name);
            return { success: true, message: '更新成功' };
        } catch (e) {
            this.logger.error('更新分类失败: id=' + id + ', 错误=' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 删除单个分类及其所有仓库关联
     *
     * @param id  分类 ID
     * @returns   操作结果
     */
    @Delete('categories/:id')
    async delete(@Param('id') id: string) {
        try {
            await this.service.delete(parseInt(id));
            this.logger.log('删除分类成功: id=' + id);
            return { success: true, message: '删除成功' };
        } catch (e) {
            this.logger.error('删除分类失败: id=' + id + ', 错误=' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 批量删除分类
     *
     * @param b  请求体：ids 分类 ID 数组
     * @returns   操作结果
     */
    @Delete('categories/batch')
    async batchDelete(@Body() b: any) {
        try {
            if (!b.ids?.length) return { success: false, message: '请提供分类ID列表' };
            await this.service.batchDelete(b.ids);
            return { success: true, message: '删除成功' };
        } catch (e) {
            this.logger.error('批量删除分类失败: 错误=' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 将分类移动到新的父分类下
     *
     * @param id  被移动的分类 ID
     * @param b   请求体：parentId 目标父分类 ID
     * @returns   操作结果
     */
    @Post('categories/:id/move')
    async move(@Param('id') id: string, @Body() b: any) {
        try {
            await this.service.moveToParent(parseInt(id), b.parentId);
            return { success: true, message: '移动成功' };
        } catch (e) {
            this.logger.error('移动分类失败: id=' + id + ', 错误=' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 查询分类下的仓库列表，支持分页和全量两种模式
     *
     * @param id  分类 ID
     * @param q   查询参数：page 为空则全量返回，否则分页
     * @returns   仓库列表或分页数据
     */
    @Get('categories/:id/repos')
    async repos(@Param('id') id: string, @Query() q: any) {
        const page = q.page;
        if (page) {
            return this.service.getReposByCategoryIdPaged({
                categoryId: parseInt(id),
                page: parseInt(page),
                size: parseInt(q.size) || 12,
                keyword: q.keyword || '',
                language: q.language || '',
                sortBy: q.sortBy || 'starred_at',
                sortOrder: q.sortOrder || 'desc',
            });
        }
        return this.service.getReposByCategoryId(parseInt(id));
    }

    /**
     * 批量添加仓库到分类
     *
     * @param id  分类 ID
     * @param b   请求体：repoIds 仓库 ID 数组
     * @returns   操作结果
     */
    @Post('categories/:id/repos')
    async addRepos(@Param('id') id: string, @Body() b: any) {
        try {
            await this.service.batchAddRepos(b.repoIds, parseInt(id));
            return { success: true, message: '添加成功' };
        } catch (e) {
            this.logger.error('添加仓库到分类失败: catId=' + id + ', 错误=' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 从分类中移除指定仓库
     *
     * @param catId   分类 ID
     * @param repoId  仓库 ID
     * @returns       操作结果
     */
    @Delete('categories/:categoryId/repos/:repoId')
    async removeRepo(@Param('categoryId') catId: string, @Param('repoId') repoId: string) {
        try {
            await this.service.removeRepoFromCategory(parseInt(repoId), parseInt(catId));
            return { success: true, message: '移除成功' };
        } catch (e) {
            this.logger.error(
                '从分类移除仓库失败: catId=' + catId + ', repoId=' + repoId + ', 错误=' + (e instanceof Error ? e.message : String(e)),
            );
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 批量转移仓库到另一个分类
     *
     * @param id  源分类 ID
     * @param b   请求体：repoIds 仓库 ID 数组、toCategoryId 目标分类 ID
     * @returns   操作结果
     */
    @Post('categories/:id/repos/transfer')
    async transfer(@Param('id') id: string, @Body() b: any) {
        try {
            await this.service.batchTransferRepos(b.repoIds, parseInt(id), b.toCategoryId);
            return { success: true, message: '转移成功' };
        } catch (e) {
            this.logger.error('转移仓库失败: fromId=' + id + ', 错误=' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 获取所有未分类的仓库列表
     *
     * @returns  未分类仓库列表
     */
    @Get('categories/uncategorized')
    async uncategorized() {
        return this.service.getUncategorized();
    }

    /**
     * 对指定分类下的仓库执行 AI 重新分类
     *
     * @param id  分类 ID
     * @param b   请求体：topN 返回推荐分类数（默认 8）
     * @returns   AI 分类结果
     */
    @Post('categories/:id/reclassify')
    async reclassify(@Param('id') id: string, @Body() b: any) {
        try {
            const repos = await this.service.getReposByCategoryId(parseInt(id));
            if (!repos.length) return { success: false, message: '该分类下没有仓库' };
            this.logger.log('开始重分类: catId=' + id + ', 仓库数=' + repos.length);
            const result = await this.aiClassify.classify(
                repos.map((r) => Number(r.id)),
                b?.topN || 8,
            );
            return result;
        } catch (e) {
            this.logger.error('重分类失败: catId=' + id + ', 错误=' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: '重分类失败: ' + (e instanceof Error ? e.message : String(e)) };
        }
    }

    /**
     * 对未分类的仓库执行智能分类（取最多 15 个仓库）
     *
     * @returns  AI 智能分类结果
     */
    @Post('categories/smart-classify')
    async smartClassify() {
        try {
            const uncat = await this.service.getUncategorized();
            if (!uncat.length) return { success: false, message: '没有未分类的仓库' };
            const ids = uncat.slice(0, 15).map((r) => Number(r.id));
            this.logger.log('开始智能分类: 未分类仓库数=' + uncat.length + ', 实际处理=' + ids.length);
            return this.aiClassify.smartClassify(ids);
        } catch (e) {
            this.logger.error('智能分类失败: 错误=' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: '智能分类失败: ' + (e instanceof Error ? e.message : String(e)) };
        }
    }
}
