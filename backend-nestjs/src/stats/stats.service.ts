import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
    private readonly logger = new Logger(StatsService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 获取编程语言统计
     *
     * 按仓库数量降序排列，计算每种语言的数量和占比
     *
     * @returns 语言列表，包含名称、数量、百分比
     */
    async getLanguageStats() {
        this.logger.log('查询编程语言统计');
        const rows = await this.prisma.githubRepo.groupBy({
            by: ['language'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        });
        const total = await this.prisma.githubRepo.count();
        return rows.map((r) => ({
            language: r.language || '未知',
            count: r._count.id,
            percentage: total > 0 ? Math.round((r._count.id * 10000) / total) / 100 : 0,
        }));
    }

    /**
     * 获取仓库所有者统计
     *
     * 按拥有 Star 仓库数量降序排列，取前 topN 名
     *
     * @param topN 返回的排名数量
     * @returns 所有者列表，包含名称、头像URL、仓库数量
     */
    async getOwnerStats(topN: number) {
        this.logger.log(`查询所有者统计: topN=${topN}`);
        const rows = await this.prisma.githubRepo.groupBy({
            by: ['ownerName'],
            _count: { id: true },
            _max: { ownerAvatarUrl: true },
            orderBy: { _count: { id: 'desc' } },
            take: topN,
        });
        return rows.map((r) => ({
            ownerName: r.ownerName,
            ownerAvatarUrl: r._max?.ownerAvatarUrl || '',
            count: r._count.id,
        }));
    }

    /**
     * 获取 Star 时间线统计
     *
     * 按月份聚合 Star 时间，展示 Star 数量的增长趋势
     *
     * @returns 时间线数据，每月一条，包含月份和新增 Star 数量
     */
    async getTimelineStats() {
        this.logger.log('查询时间线统计');
        const rows = await this.prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT DATE_FORMAT(starred_at, '%Y-%m') AS month, COUNT(*) AS count FROM github_repo WHERE starred_at IS NOT NULL GROUP BY month ORDER BY month ASC
    `;
        return rows.map((r) => ({ month: r.month, count: Number(r.count) }));
    }

    /**
     * 获取整体概览统计
     *
     * 汇总仓库总数、Star 总数、Fork 总数、语言/所有者种类数
     *
     * @returns 概览统计数据
     */
    async getOverviewStats() {
        this.logger.log('查询整体概览统计');
        const [total, stars, forks, langs, owners] = await Promise.all([
            this.prisma.githubRepo.count(),
            this.prisma.githubRepo.aggregate({ _sum: { starsCount: true } }),
            this.prisma.githubRepo.aggregate({ _sum: { forksCount: true } }),
            this.prisma.githubRepo.findMany({ where: { language: { not: null } }, select: { language: true }, distinct: ['language'] }),
            this.prisma.githubRepo.findMany({ where: { ownerName: { not: null } }, select: { ownerName: true }, distinct: ['ownerName'] }),
        ]);
        return {
            totalRepos: total,
            totalStars: Number(stars._sum.starsCount || 0),
            totalForks: Number(forks._sum.forksCount || 0),
            totalLanguages: langs.length,
            totalOwners: owners.length,
        };
    }

    /**
     * 获取 Star 数量最多的仓库
     *
     * @param topN 返回的仓库数量
     * @returns 按 starsCount 降序排列的仓库列表
     */
    async getTopStarred(topN: number) {
        this.logger.log(`查询 Star 排行榜: topN=${topN}`);
        return this.prisma.githubRepo.findMany({ orderBy: { starsCount: 'desc' }, take: topN });
    }

    /**
     * 获取最近活跃的仓库
     *
     * 按仓库最近更新时间降序排列，反映项目活跃度
     *
     * @param topN 返回的仓库数量
     * @returns 按 repoUpdatedAt 降序排列的仓库列表
     */
    async getRecentActive(topN: number) {
        this.logger.log(`查询最近活跃仓库: topN=${topN}`);
        return this.prisma.githubRepo.findMany({ where: { repoUpdatedAt: { not: null } }, orderBy: { repoUpdatedAt: 'desc' }, take: topN });
    }
}
