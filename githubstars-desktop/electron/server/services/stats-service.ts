import { getDb } from '../db';

export interface LanguageStats {
  language: string;
  count: number;
  percentage: number;
}

export interface OwnerStats {
  ownerName: string;
  ownerAvatarUrl: string | null;
  count: number;
}

export interface TimelineStats {
  month: string;
  count: number;
}

export interface OverviewStats {
  totalRepos: number;
  totalStars: number;
  totalForks: number;
  totalLanguages: number;
  totalOwners: number;
}

export interface AuthorStats {
  ownerName: string;
  ownerAvatarUrl: string | null;
  repoCount: number;
  totalStars: number;
  topLanguage: string | null;
  lastStarredAt: string | null;
}

export class StatsService {
  async getLanguageStats(): Promise<LanguageStats[]> {
    const db = getDb();
    const rows = await db('github_repo')
      .select('language')
      .count('* as count')
      .whereNotNull('language')
      .groupBy('language')
      .orderBy('count', 'desc');

    const total = rows.reduce((sum: number, r: any) => sum + Number(r.count), 0);
    return rows.map((r: any) => ({
      language: r.language,
      count: Number(r.count),
      percentage: total > 0 ? parseFloat(((Number(r.count) / total) * 100).toFixed(1)) : 0,
    }));
  }

  async getOwnerStats(topN: number = 20): Promise<OwnerStats[]> {
    const db = getDb();
    const rows = await db('github_repo')
      .select('owner_name', 'owner_avatar_url')
      .count('* as count')
      .whereNotNull('owner_name')
      .groupBy('owner_name', 'owner_avatar_url')
      .orderBy('count', 'desc')
      .limit(topN);

    return (rows as any[]).map((r: any) => ({
      ownerName: r.owner_name as string,
      ownerAvatarUrl: r.owner_avatar_url as string | null,
      count: Number(r.count),
    }));
  }

  async getTimelineStats(): Promise<TimelineStats[]> {
    const db = getDb();
    // SQLite: 使用 strftime 提取年月
    const rows = await db('github_repo')
      .select(db.raw("strftime('%Y-%m', starred_at) as month"))
      .count('* as count')
      .whereNotNull('starred_at')
      .groupBy('month')
      .orderBy('month', 'asc');

    return rows.map((r: any) => ({
      month: r.month,
      count: Number(r.count),
    }));
  }

  async getOverview(): Promise<OverviewStats> {
    const db = getDb();
    const [agg] = await db('github_repo')
      .select(
        db.raw('COUNT(*) as totalRepos'),
        db.raw('COALESCE(SUM(stars_count), 0) as totalStars'),
        db.raw('COALESCE(SUM(forks_count), 0) as totalForks'),
        db.raw('COUNT(DISTINCT language) as totalLanguages'),
        db.raw('COUNT(DISTINCT owner_name) as totalOwners')
      );

    return {
      totalRepos: Number(agg.totalRepos),
      totalStars: Number(agg.totalStars),
      totalForks: Number(agg.totalForks),
      totalLanguages: Number(agg.totalLanguages),
      totalOwners: Number(agg.totalOwners),
    };
  }

  async getTopStarred(topN: number = 20): Promise<any[]> {
    const db = getDb();
    return db('github_repo')
      .select(
        'id', 'repo_name', 'full_name', 'owner_name', 'owner_avatar_url',
        'html_url', 'stars_count', 'language', 'description'
      )
      .orderBy('stars_count', 'desc')
      .limit(topN);
  }

  async getRecentActive(topN: number = 20): Promise<any[]> {
    const db = getDb();
    return db('github_repo')
      .select(
        'id', 'repo_name', 'full_name', 'owner_name', 'owner_avatar_url',
        'html_url', 'stars_count', 'language', 'repo_pushed_at'
      )
      .orderBy('repo_pushed_at', 'desc')
      .limit(topN);
  }

  async getAuthorList(page: number, size: number, keyword?: string): Promise<{ records: AuthorStats[]; total: number }> {
    const db = getDb();
    let query = db('github_repo')
      .select(
        'owner_name as ownerName',
        db.raw('MAX(owner_avatar_url) as ownerAvatarUrl'),
        db.raw('COUNT(*) as repoCount'),
        db.raw('COALESCE(SUM(stars_count), 0) as totalStars'),
        db.raw('MAX(starred_at) as lastStarredAt')
      )
      .whereNotNull('owner_name')
      .groupBy('owner_name');

    let countQuery = db('github_repo')
      .whereNotNull('owner_name');

    if (keyword) {
      const kw = `%${keyword}%`;
      query = query.andWhere('owner_name', 'like', kw);
      countQuery = countQuery.andWhere('owner_name', 'like', kw);
    }

    query = query.orderBy('repoCount', 'desc');

    // 获取 top language
    const offset = (page - 1) * size;

    // Count distinct owners
    const subQuery = countQuery.select('owner_name').distinct();
    const [{ count }] = await db.from(subQuery.as('t')).count('* as count');
    const total = Number(count);

    const records = await query.limit(size).offset(offset);

    // 为每个作者查 top language
    for (const record of records) {
      const topLang = await db('github_repo')
        .select('language')
        .where('owner_name', record.ownerName)
        .whereNotNull('language')
        .groupBy('language')
        .count('* as cnt')
        .orderBy('cnt', 'desc')
        .first();
      record.topLanguage = topLang?.language || null;
    }

    return { records, total };
  }
}

export const statsService = new StatsService();
