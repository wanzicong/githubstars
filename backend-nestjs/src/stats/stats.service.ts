import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLanguageStats() {
    const rows = await this.prisma.githubRepo.groupBy({
      by: ['language'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })
    const total = await this.prisma.githubRepo.count()
    return rows.map(r => ({
      language: r.language || '未知',
      count: r._count.id,
      percentage: total > 0 ? Math.round(r._count.id * 10000 / total) / 100 : 0,
    }))
  }

  async getOwnerStats(topN: number) {
    const rows = await this.prisma.githubRepo.groupBy({
      by: ['ownerName'],
      _count: { id: true },
      _max: { ownerAvatarUrl: true },
      orderBy: { _count: { id: 'desc' } },
      take: topN,
    })
    return rows.map(r => ({
      ownerName: r.ownerName,
      ownerAvatarUrl: r._max?.ownerAvatarUrl || '',
      count: r._count.id,
    }))
  }

  async getTimelineStats() {
    const rows = await this.prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT DATE_FORMAT(starred_at, '%Y-%m') AS month, COUNT(*) AS count FROM github_repo WHERE starred_at IS NOT NULL GROUP BY month ORDER BY month ASC
    `
    return rows.map(r => ({ month: r.month, count: Number(r.count) }))
  }

  async getOverviewStats() {
    const [total, stars, forks, langs, owners] = await Promise.all([
      this.prisma.githubRepo.count(),
      this.prisma.githubRepo.aggregate({ _sum: { starsCount: true } }),
      this.prisma.githubRepo.aggregate({ _sum: { forksCount: true } }),
      this.prisma.githubRepo.findMany({ where: { language: { not: null } }, select: { language: true }, distinct: ['language'] }),
      this.prisma.githubRepo.findMany({ where: { ownerName: { not: null } }, select: { ownerName: true }, distinct: ['ownerName'] }),
    ])
    return { totalRepos: total, totalStars: Number(stars._sum.starsCount || 0), totalForks: Number(forks._sum.forksCount || 0), totalLanguages: langs.length, totalOwners: owners.length }
  }

  async getTopStarred(topN: number) { return this.prisma.githubRepo.findMany({ orderBy: { starsCount: 'desc' }, take: topN }) }
  async getRecentActive(topN: number) { return this.prisma.githubRepo.findMany({ where: { repoUpdatedAt: { not: null } }, orderBy: { repoUpdatedAt: 'desc' }, take: topN }) }
}
