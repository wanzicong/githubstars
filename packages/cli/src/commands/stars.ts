/**
 * Star 列表命令处理器
 */

import { api, type GithubRepo } from '../api.js';
import {
  formatTable,
  formatStatus,
  formatNumber,
  formatProgress,
  printHeader,
  printJson,
  printError,
} from '../format.js';

export interface StarListOptions {
  page?: number;
  size?: number;
  keyword?: string;
  language?: string;
  sortBy?: string;
  sortOrder?: string;
  untranslatedOnly?: boolean;
  format?: string;
}

export async function starList(options: StarListOptions): Promise<void> {
  try {
    const result = await api.getStarList({
      page: options.page || 1,
      size: options.size || 20,
      keyword: options.keyword,
      language: options.language,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      untranslatedOnly: options.untranslatedOnly,
    });

    if (options.format === 'json') {
      printJson(result);
      return;
    }

    printHeader(`Star 仓库列表 (第 ${result.current}/${result.pages} 页, 共 ${result.total} 个)`);

    const headers = ['ID', '仓库名', '语言', 'Stars', '翻译状态', '所有者'];
    const rows = result.records.map(repo => [
      String(repo.id),
      repo.fullName || repo.repoName || '-',
      repo.language || '-',
      formatNumber(repo.starsCount),
      repo.translationStatus
        ? `描述:${repo.translationStatus.description} README:${repo.translationStatus.readme}`
        : '-',
      repo.ownerName || '-',
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取 Star 列表失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function starDetail(id: number, format?: string): Promise<void> {
  try {
    const repo = await api.getStarDetail(id);

    if (format === 'json') {
      printJson(repo);
      return;
    }

    printHeader(`仓库详情: ${repo.fullName || repo.repoName}`);
    console.log(`ID: ${repo.id}`);
    console.log(`仓库名: ${repo.fullName || repo.repoName}`);
    console.log(`所有者: ${repo.ownerName || '-'}`);
    console.log(`语言: ${repo.language || '-'}`);
    console.log(`Stars: ${formatNumber(repo.starsCount)}`);
    console.log(`Forks: ${formatNumber(repo.forksCount)}`);
    console.log(`描述: ${repo.description || '-'}`);
    console.log(`中文描述: ${repo.descriptionCn || '-'}`);
    console.log(`URL: ${repo.htmlUrl || '-'}`);
  } catch (error) {
    printError(`获取仓库详情失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function starSearch(keyword: string, options: StarListOptions): Promise<void> {
  await starList({ ...options, keyword });
}

export async function starExport(options: { keyword?: string; language?: string; format?: string }): Promise<void> {
  try {
    const content = await api.exportStarUrls({
      keyword: options.keyword,
      language: options.language,
    });

    if (options.format === 'json') {
      printJson({ urls: content.split('\n').filter(Boolean) });
      return;
    }

    console.log(content);
  } catch (error) {
    printError(`导出失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
