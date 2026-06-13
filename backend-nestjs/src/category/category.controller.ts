import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { CategoryService } from './category.service';
import { AiClassifyService } from '../ai/services/ai-classify.service';

@Controller('api')
export class CategoryController {
    constructor(
        private readonly service: CategoryService,
        private readonly aiClassify: AiClassifyService,
    ) {}

    @Get('categories/all')
    async all() {
        return this.service.listAll();
    }

    @Post('categories')
    async create(@Body() b: any) {
        try {
            if (!b.name?.trim()) return { success: false, message: '分类名称不能为空' };
            const cat = await this.service.create(b.name, b.description, b.parentId);
            return { success: true, category: cat };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    @Put('categories/:id')
    async update(@Param('id') id: string, @Body() b: any) {
        try {
            if (!b.name?.trim()) return { success: false, message: '分类名称不能为空' };
            await this.service.update(parseInt(id), b.name, b.description);
            return { success: true, message: '更新成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    @Delete('categories/:id')
    async delete(@Param('id') id: string) {
        try {
            await this.service.delete(parseInt(id));
            return { success: true, message: '删除成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    @Delete('categories/batch')
    async batchDelete(@Body() b: any) {
        try {
            if (!b.ids?.length) return { success: false, message: '请提供分类ID列表' };
            await this.service.batchDelete(b.ids);
            return { success: true, message: '删除成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    @Post('categories/:id/move')
    async move(@Param('id') id: string, @Body() b: any) {
        try {
            await this.service.moveToParent(parseInt(id), b.parentId);
            return { success: true, message: '移动成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

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

    @Post('categories/:id/repos')
    async addRepos(@Param('id') id: string, @Body() b: any) {
        try {
            await this.service.batchAddRepos(b.repoIds, parseInt(id));
            return { success: true, message: '添加成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    @Delete('categories/:categoryId/repos/:repoId')
    async removeRepo(@Param('categoryId') catId: string, @Param('repoId') repoId: string) {
        try {
            await this.service.removeRepoFromCategory(parseInt(repoId), parseInt(catId));
            return { success: true, message: '移除成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    @Post('categories/:id/repos/transfer')
    async transfer(@Param('id') id: string, @Body() b: any) {
        try {
            await this.service.batchTransferRepos(b.repoIds, parseInt(id), b.toCategoryId);
            return { success: true, message: '转移成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    @Get('categories/uncategorized')
    async uncategorized() {
        return this.service.getUncategorized();
    }

    @Post('categories/:id/reclassify')
    async reclassify(@Param('id') id: string, @Body() b: any) {
        try {
            const repos = await this.service.getReposByCategoryId(parseInt(id));
            if (!repos.length) return { success: false, message: '该分类下没有仓库' };
            const result = await this.aiClassify.classify(
                repos.map((r) => Number(r.id)),
                b?.topN || 8,
            );
            return result;
        } catch (e) {
            return { success: false, message: '重分类失败: ' + (e instanceof Error ? e.message : String(e)) };
        }
    }

    @Post('categories/smart-classify')
    async smartClassify() {
        try {
            const uncat = await this.service.getUncategorized();
            if (!uncat.length) return { success: false, message: '没有未分类的仓库' };
            const ids = (uncat as any[]).slice(0, 15).map((r) => Number(r.id));
            return this.aiClassify.smartClassify(ids);
        } catch (e) {
            return { success: false, message: '智能分类失败: ' + (e instanceof Error ? e.message : String(e)) };
        }
    }
}
