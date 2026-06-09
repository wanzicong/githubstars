import { getDb } from '../db';
import { repoService, StarFilterParams, GithubRepo, PageResult } from './repo-service';
import { statsService, AuthorStats } from './stats-service';

export class AuthorService {
  async getAuthorList(page: number, size: number, keyword?: string): Promise<{ records: AuthorStats[]; total: number }> {
    return statsService.getAuthorList(page, size, keyword);
  }

  async getAuthorRepos(
    ownerName: string,
    page: number,
    size: number,
    sortBy?: string,
    sortOrder?: string
  ): Promise<PageResult<GithubRepo>> {
    const filters: StarFilterParams = {
      keyword: ownerName,
      sortBy: sortBy || 'starredAt',
      sortOrder: sortOrder || 'desc',
    };

    const db = getDb();
    const offset = (page - 1) * size;

    const sortColumn = sortBy === 'starsCount' ? 'stars_count' :
      sortBy === 'forksCount' ? 'forks_count' :
        sortBy === 'repoUpdatedAt' ? 'repo_updated_at' :
          'starred_at';
    const sortDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const [{ count }] = await db('github_repo')
      .where('owner_name', ownerName)
      .count('* as count');
    const total = Number(count);

    const records = await db('github_repo')
      .where('owner_name', ownerName)
      .orderBy(sortColumn, sortDir)
      .limit(size)
      .offset(offset);

    // 填充分类名
    if (records.length > 0) {
      const repoIds = records.map((r: GithubRepo) => r.id);
      const categoryMap = await (repoService as any).getCategoryNamesBatch
        ? (repoService as any).getCategoryNamesBatch(repoIds)
        : {};
      // Fallback: use repoService.findPage indirectly
      for (const record of records) {
        (record as GithubRepo).categoryNames =
          (categoryMap as Record<number, string[]>)[record.id] || [];
      }
    }

    return { records, total, size, current: page, pages: Math.ceil(total / size) };
  }

  async exportAuthorUrls(ownerName: string): Promise<string[]> {
    return repoService.getAuthorUrls(ownerName);
  }
}

export const authorService = new AuthorService();
