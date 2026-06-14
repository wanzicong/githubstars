import { Controller, Get, Delete, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SimilarCacheService } from './similar-cache.service';

/**
 * 相似项目缓存控制器
 *
 * 提供相似项目搜索结果的 HTTP 查询与管理接口。
 * 路由前缀使用 `/api/similar-cache` 避免与已有的 `/api/similar/:repoId` 冲突。
 *
 * 端点:
 * - GET  /api/similar-cache        — 分页查询缓存列表
 * - GET  /api/similar-cache/:repoId — 按仓库 ID 查询缓存
 * - DELETE /api/similar-cache/:id   — 删除单条缓存
 * - DELETE /api/similar-cache       — 清空全部缓存
 */
@ApiTags('similar-cache')
@Controller('api/similar-cache')
export class SimilarCacheController {
    constructor(private readonly service: SimilarCacheService) {}

    /**
     * 分页查询缓存列表
     */
    @Get()
    @ApiOperation({ summary: '分页查询相似项目缓存列表' })
    @ApiQuery({ name: 'page', required: false, description: '页码，默认 1' })
    @ApiQuery({ name: 'size', required: false, description: '每页条数，默认 20' })
    async list(@Query('page') page?: string, @Query('size') size?: string) {
        return this.service.list(parseInt(page || '1'), parseInt(size || '20'));
    }

    /**
     * 按仓库 ID 查询缓存
     */
    @Get(':repoId')
    @ApiOperation({ summary: '按仓库 ID 查询相似项目缓存' })
    @ApiParam({ name: 'repoId', description: '仓库 ID' })
    async getByRepoId(@Param('repoId', ParseIntPipe) repoId: number) {
        return this.service.getByRepoId(repoId);
    }

    /**
     * 删除单条缓存
     */
    @Delete(':id')
    @ApiOperation({ summary: '删除单条相似项目缓存' })
    @ApiParam({ name: 'id', description: '缓存记录 ID' })
    async delete(@Param('id', ParseIntPipe) id: number) {
        return this.service.delete(id);
    }

    /**
     * 删除全部缓存
     */
    @Delete()
    @ApiOperation({ summary: '清空全部相似项目缓存' })
    async deleteAll() {
        return this.service.deleteAll();
    }
}
