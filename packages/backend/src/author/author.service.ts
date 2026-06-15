import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthorService {
    private readonly logger = new Logger(AuthorService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 分页查询作者列表
     *
     * 按拥有 Star 仓库的总 Star 数降序排列，支持关键字模糊搜索作者名。
     * 使用 Prisma tagged template ($queryRaw) 防 SQL 注入；keyword 由 Prisma 自动参数化。
     *
     * @param page 页码（从1开始）
     * @param size 每页条数
     * @param keyword 搜索关键字，按 owner_name 模糊匹配
     * @returns 分页后的作者列表及分页元数据
     */
    async getAuthorPage(page: number, size: number, keyword: string) {
        this.logger.log(`查询作者列表: page=${page}, size=${size}, keyword="${keyword}"`);
        const offset = (page - 1) * size;

        const countResult: Array<{ cnt: bigint }> = keyword
            ? await this.prisma
                  .$queryRaw`SELECT COUNT(DISTINCT owner_name) AS cnt FROM github_repo WHERE owner_name IS NOT NULL AND owner_name != '' AND owner_name LIKE ${`%${keyword}%`}`
            : await this.prisma
                  .$queryRaw`SELECT COUNT(DISTINCT owner_name) AS cnt FROM github_repo WHERE owner_name IS NOT NULL AND owner_name != ''`;
        const total = Number(countResult[0]?.cnt || 0n);

        const rows: any[] = keyword
            ? await this.prisma
                  .$queryRaw`SELECT owner_name, MAX(owner_avatar_url) AS owner_avatar_url, COUNT(*) AS repo_count, SUM(stars_count) AS total_stars, (SELECT language FROM github_repo r2 WHERE r2.owner_name = r1.owner_name AND r2.language IS NOT NULL AND r2.language != '' GROUP BY language ORDER BY COUNT(*) DESC LIMIT 1) AS top_language, MAX(starred_at) AS last_starred_at FROM github_repo r1 WHERE owner_name IS NOT NULL AND owner_name != '' AND owner_name LIKE ${`%${keyword}%`} GROUP BY owner_name ORDER BY total_stars DESC LIMIT ${size} OFFSET ${offset}`
            : await this.prisma
                  .$queryRaw`SELECT owner_name, MAX(owner_avatar_url) AS owner_avatar_url, COUNT(*) AS repo_count, SUM(stars_count) AS total_stars, (SELECT language FROM github_repo r2 WHERE r2.owner_name = r1.owner_name AND r2.language IS NOT NULL AND r2.language != '' GROUP BY language ORDER BY COUNT(*) DESC LIMIT 1) AS top_language, MAX(starred_at) AS last_starred_at FROM github_repo r1 WHERE owner_name IS NOT NULL AND owner_name != '' GROUP BY owner_name ORDER BY total_stars DESC LIMIT ${size} OFFSET ${offset}`;

        return {
            records: rows.map((r: any) => ({
                ownerName: r.owner_name,
                ownerAvatarUrl: r.owner_avatar_url || '',
                repoCount: Number(r.repo_count),
                totalStars: Number(r.total_stars),
                topLanguage: r.top_language || '',
                lastStarredAt: r.last_starred_at ? String(r.last_starred_at) : '',
            })),
            total,
            size,
            current: page,
            pages: Math.ceil(total / size),
        };
    }

    /**
     * 分页查询指定作者的所有 Star 仓库
     *
     * 支持 6 个排序字段：starred_at / stars_count / forks_count / repo_updated_at / repo_created_at / repo_pushed_at
     *
     * @param ownerName 作者名（owner_name）
     * @param page 页码（从1开始）
     * @param size 每页条数
     * @param sortBy 排序字段
     * @param sortOrder 排序方向（asc/desc）
     * @returns 分页后的仓库列表及分页元数据
     */
    async getAuthorRepos(ownerName: string, page: number, size: number, sortBy: string, sortOrder: string) {
        this.logger.log(`查询作者仓库: ownerName=${ownerName}, page=${page}, size=${size}, sortBy=${sortBy}, sortOrder=${sortOrder}`);
        const f =
            sortBy === 'stars_count'
                ? 'starsCount'
                : sortBy === 'forks_count'
                  ? 'forksCount'
                  : sortBy === 'repo_updated_at'
                    ? 'repoUpdatedAt'
                    : sortBy === 'repo_created_at'
                      ? 'repoCreatedAt'
                      : sortBy === 'repo_pushed_at'
                        ? 'repoPushedAt'
                        : sortBy === 'starred_at'
                          ? 'starredAt'
                          : 'starredAt';
        const d = sortOrder === 'asc' ? 'asc' : 'desc';
        const where = { ownerName };
        const [total, records] = await Promise.all([
            this.prisma.githubRepo.count({ where }),
            this.prisma.githubRepo.findMany({ where, orderBy: { [f]: d }, skip: (page - 1) * size, take: size }),
        ]);
        return { records, total, size, current: page, pages: Math.ceil(total / size) };
    }

    /**
     * 获取指定作者所有 Star 仓库的 URL 列表
     *
     * 用于导出功能，按指定排序返回仓库的 GitHub 地址
     *
     * @param ownerName 作者名（owner_name）
     * @param sortBy 排序字段
     * @param sortOrder 排序方向（asc/desc）
     * @returns 仓库 URL 字符串数组
     */
    async getAuthorAllRepoUrls(ownerName: string, sortBy: string, sortOrder: string) {
        this.logger.log(`导出作者仓库URL: ownerName=${ownerName}, sortBy=${sortBy}, sortOrder=${sortOrder}`);
        const f =
            sortBy === 'stars_count'
                ? 'starsCount'
                : sortBy === 'forks_count'
                  ? 'forksCount'
                  : sortBy === 'repo_updated_at'
                    ? 'repoUpdatedAt'
                    : sortBy === 'repo_created_at'
                      ? 'repoCreatedAt'
                      : sortBy === 'repo_pushed_at'
                        ? 'repoPushedAt'
                        : 'starredAt';
        const d = sortOrder === 'asc' ? 'asc' : 'desc';
        const repos = await this.prisma.githubRepo.findMany({ where: { ownerName }, select: { htmlUrl: true }, orderBy: { [f]: d } });
        return repos.map((r) => r.htmlUrl).filter(Boolean);
    }
}
