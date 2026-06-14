import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TagService } from './tag.service';

@ApiTags('tags')
@Controller('api/tags')
export class TagController {
    private readonly logger = new Logger(TagController.name);

    constructor(private readonly service: TagService) {}

    /** 获取所有标签维度和标签 */
    @Get()
    @ApiOperation({ summary: '获取全部标签', description: '返回按维度分组的标签树结构' })
    async all() {
        return this.service.listAll();
    }

    /** 搜索标签（必须在 :id 参数路由之前注册） */
    @Get('search')
    @ApiOperation({ summary: '搜索标签', description: '按关键词模糊匹配标签名' })
    async search(@Query('q') q: string) {
        return this.service.search(q || '');
    }

    /** 获取标签树（维度 → 父标签 → 子标签） */
    @Get('tree')
    @ApiOperation({ summary: '获取标签树', description: '返回按维度分组的完整标签层级树' })
    async tree() {
        return this.service.getTree();
    }

    /** 获取维度树（TagGroup 间的父子层级） */
    @Get('groups/tree')
    @ApiOperation({ summary: '获取维度树', description: '返回按 TagGroup.parentId 组装的维度树形结构（含每个维度内的标签）' })
    async groupTree() {
        return this.service.getGroupTree();
    }

    /** 标签下钻分布统计 */
    @Get(':id/distribution')
    @ApiOperation({ summary: '标签下钻分布', description: '返回该标签下的项目在其他维度（或指定维度）的标签分布统计' })
    async getDistribution(
        @Param('id', ParseIntPipe) id: number,
        @Query('targetGroupId') targetGroupId?: string,
    ) {
        const tgid = targetGroupId ? parseInt(targetGroupId) : undefined;
        return this.service.getTagDistribution(id, tgid);
    }

    /** 获取仓库的标签列表（必须在 :id 参数路由之前注册） */
    @Get('repo/:repoId')
    @ApiOperation({ summary: '获取仓库标签' })
    async repoTagList(@Param('repoId') repoId: string) {
        return this.service.getRepoTags(parseInt(repoId));
    }

    /** 创建标签 */
    @Post()
    @ApiOperation({ summary: '创建标签' })
    async create(@Body() b: any) {
        try {
            if (!b.name?.trim()) return { success: false, message: '标签名不能为空' };
            if (!b.groupId) return { success: false, message: '请选择标签维度' };
            const tag = await this.service.create(b.name, b.groupId, b.description, b.color, b.icon);
            return { success: true, tag };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /** 为仓库添加标签 */
    @Post('repo/:repoId')
    @ApiOperation({ summary: '添加仓库标签' })
    async addRepoTag(@Param('repoId') repoId: string, @Body() b: any) {
        try {
            await this.service.addRepoTag(parseInt(repoId), b.tagId, b.source || 'manual');
            return { success: true, message: '添加成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /** 对筛选的仓库执行 AI 自动打标签 */
    @Post('ai/auto-tag')
    @ApiOperation({ summary: 'AI自动打标签（后台异步）', description: '对指定仓库列表使用 AI 自动分析并添加标签' })
    async aiAutoTag(@Body() b: any) {
        try {
            if (!b.repoIds?.length) return { success: false, message: '请提供仓库ID列表' };
            this.logger.log(`AI自动标签请求: ${b.repoIds.length} 个仓库`);
            this.service.saveAiTagResult(b.repoIds, {}).catch((e) => this.logger.error('AI自动标签失败', e));
            return { success: true, message: 'AI 标签任务已提交' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 以下 DELETE 路由：静态路径必须在 :id 参数路由之前注册
    // ═══════════════════════════════════════════════════════════

    /** 删除所有空标签 */
    @Delete('empty')
    @ApiOperation({ summary: '清除空标签', description: '删除所有 repoCount=0 的标签' })
    async deleteEmpty() {
        const res = await this.service.deleteEmpty();
        return { success: true, ...res, message: `已删除 ${res.deleted} 个空标签` };
    }

    /** 删除全部标签 */
    @Delete('all')
    @ApiOperation({ summary: '重置标签', description: '删除所有标签和仓库标签关联' })
    async deleteAll() {
        const res = await this.service.deleteAll();
        return { success: true, ...res, message: `已清空全部 ${res.deleted} 个标签` };
    }

    /** 删除标签维度 */
    @Delete('groups/:id')
    @ApiOperation({ summary: '删除标签维度', description: '删除维度及其下所有标签' })
    async deleteGroup(@Param('id') id: string) {
        const res = await this.service.deleteGroup(parseInt(id));
        return { success: true, ...res, message: `已删除维度及其 ${res.deleted} 个标签` };
    }

    /** 移除仓库的标签 */
    @Delete('repo/:repoId/:tagId')
    @ApiOperation({ summary: '移除仓库标签' })
    async removeRepoTag(@Param('repoId') repoId: string, @Param('tagId') tagId: string) {
        try {
            await this.service.removeRepoTag(parseInt(repoId), parseInt(tagId));
            return { success: true, message: '移除成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /** 删除单个标签（:id 参数路由，必须在所有静态 DELETE 路由之后注册） */
    @Delete(':id')
    @ApiOperation({ summary: '删除标签' })
    async delete(@Param('id') id: string) {
        try {
            await this.service.delete(parseInt(id));
            return { success: true, message: '删除成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /** 设置标签的父标签 */
    @Put(':id/parent')
    @ApiOperation({ summary: '设置标签父级', description: '设置标签的父标签以建立层级关系，parentId=null 取消层级' })
    async setParent(@Param('id', ParseIntPipe) id: number, @Body('parentId') parentId: number | null) {
        await this.service.setParent(id, parentId);
        return { success: true };
    }

    /** 设置维度的父维度 */
    @Put('groups/:id/parent')
    @ApiOperation({ summary: '设置维度父级', description: '建立 TagGroup 间的父子关系（钻取用），parentId=null 解除父级' })
    async setGroupParent(@Param('id', ParseIntPipe) id: number, @Body('parentId') parentId: number | null) {
        try {
            await this.service.setGroupParent(id, parentId);
            return { success: true };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /** 更新标签 */
    @Put(':id')
    @ApiOperation({ summary: '更新标签' })
    async update(@Param('id') id: string, @Body() b: any) {
        try {
            await this.service.update(parseInt(id), b);
            return { success: true, message: '更新成功' };
        } catch (e) {
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }
}
