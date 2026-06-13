import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AuthorService {
  constructor(private readonly prisma: PrismaService) {}

  /** 使用 Prisma tagged template ($queryRaw) 防 SQL 注入；keyword 由 Prisma 自动参数化 */
  async getAuthorPage(page: number, size: number, keyword: string) {
    const offset = (page - 1) * size

    const countResult: Array<{ cnt: bigint }> = keyword
      ? await this.prisma.$queryRaw`SELECT COUNT(DISTINCT owner_name) AS cnt FROM github_repo WHERE owner_name IS NOT NULL AND owner_name != '' AND owner_name LIKE ${`%${keyword}%`}`
      : await this.prisma.$queryRaw`SELECT COUNT(DISTINCT owner_name) AS cnt FROM github_repo WHERE owner_name IS NOT NULL AND owner_name != ''`
    const total = Number(countResult[0]?.cnt || 0n)

    const rows: any[] = keyword
      ? await this.prisma.$queryRaw`SELECT owner_name, MAX(owner_avatar_url) AS owner_avatar_url, COUNT(*) AS repo_count, SUM(stars_count) AS total_stars, (SELECT language FROM github_repo r2 WHERE r2.owner_name = r1.owner_name AND r2.language IS NOT NULL AND r2.language != '' GROUP BY language ORDER BY COUNT(*) DESC LIMIT 1) AS top_language, MAX(starred_at) AS last_starred_at FROM github_repo r1 WHERE owner_name IS NOT NULL AND owner_name != '' AND owner_name LIKE ${`%${keyword}%`} GROUP BY owner_name ORDER BY total_stars DESC LIMIT ${size} OFFSET ${offset}`
      : await this.prisma.$queryRaw`SELECT owner_name, MAX(owner_avatar_url) AS owner_avatar_url, COUNT(*) AS repo_count, SUM(stars_count) AS total_stars, (SELECT language FROM github_repo r2 WHERE r2.owner_name = r1.owner_name AND r2.language IS NOT NULL AND r2.language != '' GROUP BY language ORDER BY COUNT(*) DESC LIMIT 1) AS top_language, MAX(starred_at) AS last_starred_at FROM github_repo r1 WHERE owner_name IS NOT NULL AND owner_name != '' GROUP BY owner_name ORDER BY total_stars DESC LIMIT ${size} OFFSET ${offset}`

    return { records: rows.map((r: any) => ({ ownerName: r.owner_name, ownerAvatarUrl: r.owner_avatar_url || '', repoCount: Number(r.repo_count), totalStars: Number(r.total_stars), topLanguage: r.top_language || '', lastStarredAt: r.last_starred_at ? String(r.last_starred_at) : '' })), total, size, current: page, pages: Math.ceil(total / size) }
  }

  /** 6 个排序字段：starred_at / stars_count / forks_count / repo_updated_at / repo_created_at / repo_pushed_at */
  async getAuthorRepos(ownerName: string, page: number, size: number, sortBy: string, sortOrder: string) {
    const f = sortBy === 'stars_count' ? 'starsCount' : sortBy === 'forks_count' ? 'forksCount' : sortBy === 'repo_updated_at' ? 'repoUpdatedAt' : sortBy === 'repo_created_at' ? 'repoCreatedAt' : sortBy === 'repo_pushed_at' ? 'repoPushedAt' : sortBy === 'starred_at' ? 'starredAt' : 'starredAt'
    const d = (sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
    const where = { ownerName }
    const [total, records] = await Promise.all([
      this.prisma.githubRepo.count({ where }),
      this.prisma.githubRepo.findMany({ where, orderBy: { [f]: d }, skip: (page - 1) * size, take: size }),
    ])
    return { records, total, size, current: page, pages: Math.ceil(total / size) }
  }

  async getAuthorAllRepoUrls(ownerName: string, sortBy: string, sortOrder: string) {
    const f = sortBy === 'stars_count' ? 'starsCount' : sortBy === 'forks_count' ? 'forksCount' : sortBy === 'repo_updated_at' ? 'repoUpdatedAt' : sortBy === 'repo_created_at' ? 'repoCreatedAt' : sortBy === 'repo_pushed_at' ? 'repoPushedAt' : 'starredAt'
    const d = (sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
    const repos = await this.prisma.githubRepo.findMany({ where: { ownerName }, select: { htmlUrl: true }, orderBy: { [f]: d } })
    return repos.map(r => r.htmlUrl).filter(Boolean)
  }
}
