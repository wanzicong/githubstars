import { getDb } from '../db';
import { deepseekApiService } from './deepseek-api';
import { categoryService } from './category-service';
import { GithubRepo } from './repo-service';

interface ClassifyResult {
  repoId: number;
  fullName: string;
  categories: string[];
}

export class ClassifyService {
  /**
   * 加载待分类的仓库列表
   */
  async loadRepos(filters: {
    keyword?: string;
    languages?: string[];
    excludedCategoryIds?: number[];
  }): Promise<GithubRepo[]> {
    const db = getDb();
    let query = db('github_repo');

    if (filters.keyword) {
      const kw = `%${filters.keyword}%`;
      query = query.where(function () {
        this.where('repo_name', 'like', kw)
          .orWhere('description', 'like', kw)
          .orWhere('full_name', 'like', kw);
      });
    }

    if (filters.languages?.length) {
      query = query.whereIn('language', filters.languages);
    }

    if (filters.excludedCategoryIds?.length) {
      const subQuery = db('repo_category')
        .select('repo_id')
        .whereIn('category_id', filters.excludedCategoryIds);
      query = query.whereNotIn('id', subQuery);
    }

    return query.orderBy('starred_at', 'desc').limit(500);
  }

  /**
   * 执行 AI 分类
   */
  async executeClassify(repoIds: number[], topN?: number): Promise<ClassifyResult[]> {
    const db = getDb();

    // 获取仓库信息
    const repos = await db('github_repo')
      .whereIn('id', repoIds)
      .limit(topN || 100);

    if (repos.length === 0) {
      throw new Error('没有找到匹配的仓库');
    }

    // 构建 prompt
    const repoDescriptions = repos.map((r: any, i: number) => {
      const desc = r.description || '无描述';
      const lang = r.language || '未知语言';
      const topics = r.topics ? JSON.parse(r.topics) : [];
      return `${i + 1}. ${r.full_name}\n   描述: ${desc}\n   语言: ${lang}\n   主题: ${topics.join(', ') || '无'}`;
    }).join('\n\n');

    const systemPrompt = `你是一个 GitHub 仓库分类专家。请根据仓库的描述、语言和主题标签，为每个仓库分配合适的分类标签。

要求：
1. 分类名称要简洁明了，使用中文
2. 一个仓库可以有多个分类标签（1-3个）
3. 尽量使用已有的常见分类（如：前端框架、后端框架、工具库、AI/ML、DevOps、文档项目等）
4. 输出严格的 JSON 格式

输出格式示例：
[
  {"repoFullName": "owner/repo1", "categories": ["前端框架", "React生态"]},
  {"repoFullName": "owner/repo2", "categories": ["AI/ML"]}
]`;

    const userContent = `请为以下 ${repos.length} 个 GitHub 仓库进行分类：\n\n${repoDescriptions}`;

    // 调用 DeepSeek
    console.log(`🤖 正在对 ${repos.length} 个仓库进行 AI 分类...`);
    const result = await deepseekApiService.chatCompletion(userContent, {
      systemPrompt,
      temperature: 0.3,
      maxTokens: 4096,
      timeout: 120000,
    });

    // 解析 JSON 结果
    let parsed: any[];
    try {
      // 尝试提取 JSON 部分
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : result;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('JSON 解析失败:', result);
      throw new Error(`AI 返回结果 JSON 解析失败: ${(e as Error).message}`);
    }

    // 保存分类结果
    const results: ClassifyResult[] = [];
    const mappings: { repoId: number; categoryName: string }[] = [];

    for (const item of parsed) {
      const repo = repos.find((r: any) => r.full_name === item.repoFullName);
      if (!repo) continue;

      const categories = item.categories || [];
      results.push({
        repoId: repo.id,
        fullName: repo.full_name,
        categories,
      });

      for (const catName of categories) {
        mappings.push({ repoId: repo.id, categoryName: catName });
      }
    }

    if (mappings.length > 0) {
      await categoryService.batchAddReposToCategories(mappings);
      console.log(`✅ AI 分类完成: ${results.length} 个仓库, ${mappings.length} 个分类标签`);
    }

    return results;
  }
}

export const classifyService = new ClassifyService();
