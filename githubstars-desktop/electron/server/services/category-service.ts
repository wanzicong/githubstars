import { getDb } from '../db';
import { repoService, StarFilterParams, PageResult, GithubRepo } from './repo-service';

export interface Category {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
  repoCount?: number;
}

export class CategoryService {
  async create(data: { name: string; description?: string; sortOrder?: number }): Promise<Category> {
    const db = getDb();
    const now = new Date().toISOString();
    const [id] = await db('category').insert({
      name: data.name,
      description: data.description || null,
      sort_order: data.sortOrder || 0,
      created_at: now,
      updated_at: now,
    });
    return await db('category').where('id', id).first();
  }

  async update(id: number, data: { name?: string; description?: string; sortOrder?: number }): Promise<Category | null> {
    const db = getDb();
    const now = new Date().toISOString();
    const updateData: Record<string, any> = { updated_at: now };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;

    await db('category').where('id', id).update(updateData);
    return await db('category').where('id', id).first();
  }

  async delete(id: number): Promise<boolean> {
    const db = getDb();
    // 删除关联
    await db('repo_category').where('category_id', id).delete();
    const deleted = await db('category').where('id', id).delete();
    return deleted > 0;
  }

  async batchDelete(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const db = getDb();
    await db('repo_category').whereIn('category_id', ids).delete();
    return db('category').whereIn('id', ids).delete();
  }

  async getAll(): Promise<Category[]> {
    const db = getDb();
    const categories = await db('category').orderBy('sort_order', 'asc');
    // 计算每个分类的仓库数
    for (const cat of categories) {
      const [{ cnt }] = await db('repo_category').where('category_id', cat.id).count('* as cnt');
      cat.repoCount = Number(cnt);
    }
    return categories;
  }

  async getById(id: number): Promise<Category | null> {
    const db = getDb();
    return db('category').where('id', id).first();
  }

  async getByName(name: string): Promise<Category | null> {
    const db = getDb();
    return db('category').where('name', name).first();
  }

  // 仓库-分类关联
  async addRepoToCategory(categoryId: number, repoIds: number[]): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    for (const repoId of repoIds) {
      const exists = await db('repo_category')
        .where({ repo_id: repoId, category_id: categoryId })
        .first();
      if (!exists) {
        await db('repo_category').insert({
          repo_id: repoId,
          category_id: categoryId,
          created_at: now,
        });
      }
    }
  }

  async removeRepoFromCategory(categoryId: number, repoId: number): Promise<void> {
    const db = getDb();
    await db('repo_category').where({ repo_id: repoId, category_id: categoryId }).delete();
  }

  async transferRepo(repoId: number, fromCategoryId: number, toCategoryId: number): Promise<void> {
    const db = getDb();
    await db('repo_category').where({ repo_id: repoId, category_id: fromCategoryId }).delete();
    const exists = await db('repo_category')
      .where({ repo_id: repoId, category_id: toCategoryId })
      .first();
    if (!exists) {
      await db('repo_category').insert({
        repo_id: repoId,
        category_id: toCategoryId,
        created_at: new Date().toISOString(),
      });
    }
  }

  async getReposByCategory(categoryId: number): Promise<GithubRepo[]> {
    const db = getDb();
    const repoIds = await db('repo_category')
      .where('category_id', categoryId)
      .select('repo_id');
    if (repoIds.length === 0) return [];

    const ids = repoIds.map((r: any) => r.repo_id);
    return db('github_repo').whereIn('id', ids).orderBy('starred_at', 'desc');
  }

  async getReposByCategoryPaged(
    categoryId: number,
    page: number,
    size: number,
    filters: StarFilterParams
  ): Promise<PageResult<GithubRepo>> {
    // 强制筛选此分类
    const mergedFilters = {
      ...filters,
      categoryIds: filters.categoryIds?.length
        ? filters.categoryIds
        : [categoryId],
    };
    // 如果已有筛选了不同分类，合并之
    if (!mergedFilters.categoryIds.includes(categoryId)) {
      mergedFilters.categoryIds = [categoryId, ...mergedFilters.categoryIds];
    }
    return repoService.findPage(page, size, mergedFilters);
  }

  async getUncategorizedRepos(page: number, size: number): Promise<PageResult<GithubRepo>> {
    const db = getDb();
    const subQuery = db('repo_category').select('repo_id');
    const offset = (page - 1) * size;

    const [{ count }] = await db('github_repo')
      .whereNotIn('id', subQuery)
      .count('* as count');
    const total = Number(count);

    const records = await db('github_repo')
      .whereNotIn('id', subQuery)
      .orderBy('starred_at', 'desc')
      .limit(size)
      .offset(offset);

    return { records, total, size, current: page, pages: Math.ceil(total / size) };
  }

  // 批量添加仓库-分类（AI分类结果保存用）
  async batchAddReposToCategories(
    mappings: { repoId: number; categoryName: string }[]
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    for (const { repoId, categoryName } of mappings) {
      // 查找或创建分类
      let category = await this.getByName(categoryName);
      if (!category) {
        const [id] = await db('category').insert({
          name: categoryName,
          sort_order: 0,
          created_at: now,
          updated_at: now,
        });
        category = { id } as Category;
      }

      // 添加关联
      const exists = await db('repo_category')
        .where({ repo_id: repoId, category_id: category.id })
        .first();
      if (!exists) {
        await db('repo_category').insert({
          repo_id: repoId,
          category_id: category.id,
          created_at: now,
        });
      }
    }
  }
}

export const categoryService = new CategoryService();
