import { getDb } from '../db';
import { deepseekApiService } from './deepseek-api';
import { repoService } from './repo-service';

export class TranslateService {
  /**
   * 翻译仓库描述
   */
  async translateDescription(repoId: number): Promise<string> {
    const db = getDb();
    const repo = await db('github_repo').where('id', repoId).first();
    if (!repo) throw new Error('仓库不存在');

    const description = repo.description;
    if (!description) throw new Error('仓库没有描述');

    const systemPrompt = '你是一个专业的技术翻译。请将以下 GitHub 仓库的英文描述翻译成简洁准确的中文。保持技术术语的准确性。只返回翻译结果，不要加任何解释。';

    const translated = await deepseekApiService.chatCompletion(description, {
      systemPrompt,
      temperature: 0.2,
      maxTokens: 1000,
      timeout: 60000,
    });

    // 保存翻译结果
    await repoService.updateTranslation(repoId, 'description_cn', translated.trim());

    return translated.trim();
  }

  /**
   * 获取并翻译仓库 README
   */
  async translateReadme(repoId: number): Promise<string> {
    const db = getDb();
    const repo = await db('github_repo').where('id', repoId).first();
    if (!repo) throw new Error('仓库不存在');

    // 如果没有 readme_cn，从 GitHub 获取 README
    let readmeContent: string | null = null;

    if (!repo.readme_fetched || !repo.readme_cn) {
      try {
        const readmeResp = await fetch(
          `https://api.github.com/repos/${repo.full_name}/readme`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3.raw',
              'User-Agent': 'GithubStars-Desktop',
            },
          }
        );

        if (readmeResp.ok) {
          readmeContent = await readmeResp.text();
          // 限制 README 长度，避免超出 token 限制
          const MAX_README_LENGTH = 8000;
          if (readmeContent.length > MAX_README_LENGTH) {
            readmeContent = readmeContent.substring(0, MAX_README_LENGTH);
          }
        }
      } catch (e) {
        console.warn(`无法获取 README: ${repo.full_name}`, e);
      }
    }

    if (!readmeContent) {
      throw new Error('无法获取 README 内容');
    }

    const systemPrompt = `你是一个专业的技术文档翻译。请将以下 GitHub 项目的 README 翻译成中文。
要求：
1. 保持 Markdown 格式（标题、列表、代码块等）
2. 技术术语保持准确
3. 代码块和 URL 不要翻译
4. 只返回翻译后的 Markdown 内容，不要加任何解释`;

    const translated = await deepseekApiService.chatCompletion(readmeContent, {
      systemPrompt,
      temperature: 0.2,
      maxTokens: 4096,
      timeout: 180000, // 3分钟超时
    });

    // 保存翻译结果
    await repoService.updateTranslation(repoId, 'readme_cn', translated.trim());

    return translated.trim();
  }

  /**
   * 全量翻译（描述 + README）
   */
  async translateAll(repoId: number): Promise<{ descriptionCn?: string; readmeCn?: string }> {
    const db = getDb();
    const repo = await db('github_repo').where('id', repoId).first();
    if (!repo) throw new Error('仓库不存在');

    const result: { descriptionCn?: string; readmeCn?: string } = {};

    try {
      if (repo.description) {
        result.descriptionCn = await this.translateDescription(repoId);
      }
    } catch (e) {
      console.warn(`描述翻译失败: ${repo.full_name}`, e);
    }

    try {
      result.readmeCn = await this.translateReadme(repoId);
    } catch (e) {
      console.warn(`README翻译失败: ${repo.full_name}`, e);
    }

    return result;
  }

  /**
   * 批量翻译描述
   */
  async batchTranslateDescriptions(repoIds: number[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const repoId of repoIds) {
      try {
        await this.translateDescription(repoId);
        success++;
      } catch (e) {
        failed++;
        console.error(`翻译失败 repoId=${repoId}:`, e);
      }
    }

    return { success, failed };
  }

  /**
   * 获取翻译状态
   */
  async getTranslationStatus(repoId: number) {
    const db = getDb();
    const repo = await db('github_repo').where('id', repoId).first();
    if (!repo) throw new Error('仓库不存在');

    return {
      descriptionTranslated: !!repo.description_cn,
      readmeTranslated: !!repo.readme_cn && repo.readme_fetched,
    };
  }
}

export const translateService = new TranslateService();
