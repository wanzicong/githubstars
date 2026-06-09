import { Knex } from 'knex';
import { getDb } from '../db';

export interface GithubRepo {
  id: number;
  repo_name: string;
  full_name: string;
  description: string | null;
  description_cn: string | null;
  readme_cn: string | null;
  readme_fetched: number;
  language: string | null;
  owner_name: string | null;
  owner_avatar_url: string | null;
  html_url: string | null;
  homepage: string | null;
  stars_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  topics: string | null;
  license_name: string | null;
  is_fork: number;
  is_archived: number;
  repo_created_at: string | null;
  repo_updated_at: string | null;
  repo_pushed_at: string | null;
  starred_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  categoryNames?: string[];
  days_since_update?: number;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export interface StarFilterParams {
  keyword?: string;
  languages?: string[];
  categoryIds?: number[];
  sortBy?: string;
  sortOrder?: string;
  dateField?: string;
  startMonth?: string;
  endMonth?: string;
}

// 排序字段映射（与前端一致）
const SORT_COLUMN_MAP: Record<string, string> = {
  starredAt: 'starred_at',
  starsCount: 'stars_count',
  forksCount: 'forks_count',
  repoUpdatedAt: 'repo_updated_at',
  repoCreatedAt: 'repo_created_at',
  repoPushedAt: 'repo_pushed_at',
  language: 'language',
  ownerName: 'owner_name',
};

export class RepoService {
  getDb(): Knex {
    return getDb();
  }

  /**
   * 分页查询仓库列表（支持多条件筛选和排序）
   */
  async findPage(page: number, size: number, filters: StarFilterParams): Promise<PageResult<GithubRepo>> {
    const db = this.getDb();
    const offset = (page - 1) * size;

    let query = db('github_repo');
    let countQuery = db('github_repo');

    // 分类筛选（子查询）
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const subQuery = db('repo_category')
        .select('repo_id')
        .whereIn('category_id', filters.categoryIds);
      query = query.whereIn('github_repo.id', subQuery);
      countQuery = countQuery.whereIn('github_repo.id', subQuery);
    }

    // 关键词搜索（跨字段 OR）
    if (filters.keyword) {
      const kw = `%${filters.keyword}%`;
      query = query.where(function () {
        this.where('repo_name', 'like', kw)
          .orWhere('description', 'like', kw)
          .orWhere('owner_name', 'like', kw)
          .orWhere('full_name', 'like', kw)
          .orWhere('language', 'like', kw);
      });
      countQuery = countQuery.where(function () {
        this.where('repo_name', 'like', kw)
          .orWhere('description', 'like', kw)
          .orWhere('owner_name', 'like', kw)
          .orWhere('full_name', 'like', kw)
          .orWhere('language', 'like', kw);
      });
    }

    // 多语言筛选（OR 逻辑）
    if (filters.languages && filters.languages.length > 0) {
      query = query.whereIn('language', filters.languages);
      countQuery = countQuery.whereIn('language', filters.languages);
    }

    // 时间范围筛选
    if (filters.startMonth) {
      const dateField = filters.dateField || 'starred_at';
      const column = SORT_COLUMN_MAP[dateField] || 'starred_at';
      query = query.where(column, '>=', `${filters.startMonth}-01`);
      countQuery = countQuery.where(column, '>=', `${filters.startMonth}-01`);
    }
    if (filters.endMonth) {
      const dateField = filters.dateField || 'starred_at';
      const column = SORT_COLUMN_MAP[dateField] || 'starred_at';
      // endMonth 是 YYYY-MM 格式，需要取该月最后一天
      const [year, month] = filters.endMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate(); // month is 0-indexed
      const endDate = `${filters.endMonth}-${String(lastDay).padStart(2, '0')}`;
      query = query.where(column, '<=', endDate);
      countQuery = countQuery.where(column, '<=', endDate);
    }

    // 排序
    const sortColumn = SORT_COLUMN_MAP[filters.sortBy || 'starredAt'] || 'starred_at';
    const sortDir = filters.sortOrder === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(sortColumn, sortDir);

    // 如果按 starred_at 降序排在前面，id 作为第二排序
    if (sortColumn === 'starred_at' && sortDir === 'desc') {
      query = query.orderBy('id', 'desc');
    }

    // 查询总数
    const [{ count }] = await countQuery.count('* as count');
    const total = Number(count);

    // 分页查询
    const records = await query
      .select('*')
      .limit(size)
      .offset(offset);

    // 批量填充分类名
    if (records.length > 0) {
      const repoIds = records.map((r: GithubRepo) => r.id);
      const categoryMap = await this.getCategoryNamesBatch(repoIds);
      for (const record of records) {
        (record as GithubRepo).categoryNames = categoryMap[record.id] || [];
        // 计算距离上次更新的天数
        if (record.repo_pushed_at) {
          const pushedDate = new Date(record.repo_pushed_at);
          (record as GithubRepo).days_since_update = Math.floor(
            (Date.now() - pushedDate.getTime()) / (1000 * 60 * 60 * 24)
          );
        }
      }
    }

    return {
      records,
      total,
      size,
      current: page,
      pages: Math.ceil(total / size),
    };
  }

  /**
   * 获取单个仓库详情
   */
  async findById(id: number): Promise<GithubRepo | null> {
    const db = this.getDb();
    const record = await db('github_repo').where('id', id).first();
    if (!record) return null;

    const repoIds = [id];
    const categoryMap = await this.getCategoryNamesBatch(repoIds);
    (record as GithubRepo).categoryNames = categoryMap[id] || [];

    if (record.repo_pushed_at) {
      const pushedDate = new Date(record.repo_pushed_at);
      (record as GithubRepo).days_since_update = Math.floor(
        (Date.now() - pushedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return record as GithubRepo;
  }

  /**
   * Upsert 仓库（存在则更新，不存在则插入）
   */
  async upsert(repo: Partial<GithubRepo>): Promise<void> {
    const db = this.getDb();
    const existing = await db('github_repo').where('full_name', repo.full_name).first();

    const now = new Date().toISOString();
    const data = { ...repo, updated_at: now };

    if (existing) {
      await db('github_repo').where('id', existing.id).update(data);
    } else {
      // INSERT OR REPLACE for SQLite
      data.created_at = now;
      await db('github_repo').insert(data);
    }
  }

  /**
   * 批量 upsert 仓库（从 GitHub 同步时使用）
   */
  async batchUpsert(repos: Partial<GithubRepo>[]): Promise<number> {
    const db = this.getDb();
    let count = 0;

    // 使用事务提升批量插入性能
    await db.transaction(async (trx) => {
      for (const repo of repos) {
        const existing = await trx('github_repo').where('full_name', repo.full_name).first();
        const now = new Date().toISOString();

        if (existing) {
          await trx('github_repo').where('id', existing.id).update({
            ...repo,
            updated_at: now,
            // 不覆盖已有的翻译内容
            description_cn: existing.description_cn,
            readme_cn: existing.readme_cn,
            readme_fetched: existing.readme_fetched,
          });
        } else {
          await trx('github_repo').insert({
            ...repo,
            created_at: now,
            updated_at: now,
          });
          count++;
        }
      }
    });

    return count;
  }

  /**
   * 获取所有已同步仓库的 full_name（用于同步后删除已取消Star的仓库）
   */
  async getAllFullNames(): Promise<string[]> {
    const db = this.getDb();
    const rows = await db('github_repo').select('full_name');
    return rows.map((r: any) => r.full_name);
  }

  /**
   * 删除指定 full_name 的仓库
   */
  async deleteByFullNames(fullNames: string[]): Promise<number> {
    if (fullNames.length === 0) return 0;
    const db = this.getDb();
    return db('github_repo').whereIn('full_name', fullNames).delete();
  }

  /**
   * 获取所有不重复的语言列表
   */
  async getLanguages(): Promise<string[]> {
    const db = this.getDb();
    const rows = await db('github_repo').select('language').whereNotNull('language').distinct();
    return rows.map((r: any) => r.language).filter(Boolean);
  }

  /**
   * 获取仓库总数
   */
  async count(): Promise<number> {
    const db = this.getDb();
    const [{ count }] = await db('github_repo').count('* as count');
    return Number(count);
  }

  /**
   * 更新仓库的翻译字段
   */
  async updateTranslation(id: number, field: 'description_cn' | 'readme_cn', content: string): Promise<void> {
    const db = this.getDb();
    const updateData: Record<string, any> = { [field]: content, updated_at: new Date().toISOString() };
    if (field === 'readme_cn') {
      updateData.readme_fetched = 1;
    }
    await db('github_repo').where('id', id).update(updateData);
  }

  /**
   * 导出筛选后的仓库链接
   */
  async exportUrls(filters: StarFilterParams): Promise<string[]> {
    const result = await this.findPage(1, 10000, filters); // 最大10000条
    return result.records
      .map((r) => r.html_url)
      .filter((url): url is string => !!url);
  }

  /**
   * 获取指定作者的所有仓库链接
   */
  async getAuthorUrls(ownerName: string): Promise<string[]> {
    const db = this.getDb();
    const rows = await db('github_repo').select('html_url').where('owner_name', ownerName);
    return rows.map((r: any) => r.html_url).filter(Boolean);
  }

  // ==================== 私有方法 ====================

  /**
   * 批量查询仓库分类名
   */
  private async getCategoryNamesBatch(repoIds: number[]): Promise<Record<number, string[]>> {
    const db = this.getDb();
    const rows = await db('repo_category')
      .join('category', 'repo_category.category_id', 'category.id')
      .whereIn('repo_category.repo_id', repoIds)
      .select('repo_category.repo_id', 'category.name');

    const map: Record<number, string[]> = {};
    for (const row of rows) {
      if (!map[row.repo_id]) map[row.repo_id] = [];
      map[row.repo_id].push(row.name);
    }
    return map;
  }
}

export const repoService = new RepoService();
