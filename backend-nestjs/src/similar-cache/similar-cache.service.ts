import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 相似项目缓存服务
 *
 * 负责持久化和查询 Agent 相似项目搜索的结果。
 * 使用 similar_repo_cache 表存储，每个仓库只保留一份最新缓存。
 *
 * @callers
 *   - SimilarCacheController    — HTTP API 暴露（列表/详情/删除）
 *   - AgentSimilarController    — Agent 搜索完成后自动保存
 *
 * @depends
 *   - PrismaService             — 数据持久化（similar_repo_cache 表 + github_repo 表关联查询）
 */
@Injectable()
export class SimilarCacheService {
    private readonly logger = new Logger(SimilarCacheService.name);
    constructor(private readonly prisma: PrismaService) {}

    /**
     * 分页查询缓存列表
     */
    async list(page: number, size: number) {
        const [records, total] = await Promise.all([
            this.prisma.similarRepoCache.findMany({
                include: { repo: { select: { fullName: true, language: true, starsCount: true } } },
                orderBy: { updatedAt: 'desc' },
                skip: (page - 1) * size,
                take: size,
            }),
            this.prisma.similarRepoCache.count(),
        ]);
        return {
            records: records.map(r => ({
                id: Number(r.id),
                repoId: Number(r.repoId),
                repoFullName: r.repo.fullName,
                repoLanguage: r.repo.language,
                repoStars: r.repo.starsCount,
                similarCount: r.similarCount,
                content: r.content,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
            })),
            total,
            size,
            current: page,
            pages: Math.ceil(total / size) || 1,
        };
    }

    /**
     * 按仓库 ID 查询缓存
     */
    async getByRepoId(repoId: number) {
        const cache = await this.prisma.similarRepoCache.findUnique({ where: { repoId: BigInt(repoId) } });
        return cache
            ? {
                  id: Number(cache.id),
                  repoId: Number(cache.repoId),
                  content: cache.content,
                  similarCount: cache.similarCount,
                  createdAt: cache.createdAt,
                  updatedAt: cache.updatedAt,
              }
            : null;
    }

    /**
     * 保存/更新缓存
     *
     * @param repoId 仓库 ID
     * @param content 相似项目推荐报告内容
     */
    async save(repoId: number, content: string) {
        const similarCount = (content.match(/###\d+\./g) || []).length;
        const result = await this.prisma.similarRepoCache.upsert({
            where: { repoId: BigInt(repoId) },
            create: { repoId: BigInt(repoId), content, similarCount },
            update: { content, similarCount, updatedAt: new Date() },
        });
        this.logger.log(`相似项目缓存已保存 repoId=${repoId} similarCount=${similarCount}`);
        return result;
    }

    /**
     * 删除单条缓存
     */
    async delete(id: number) {
        await this.prisma.similarRepoCache.delete({ where: { id: BigInt(id) } });
        return { success: true };
    }

    /**
     * 删除全部缓存
     */
    async deleteAll() {
        const count = await this.prisma.similarRepoCache.count();
        await this.prisma.similarRepoCache.deleteMany();
        this.logger.log(`已删除全部相似项目缓存，共 ${count} 条`);
        return { deleted: count };
    }
}
