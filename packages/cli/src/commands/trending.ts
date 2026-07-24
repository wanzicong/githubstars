/**
 * Trending 命令处理器
 */

import { api } from '../api.js';
import {
  formatTable,
  formatNumber,
  printHeader,
  printJson,
  printError,
  printSuccess,
  printInfo,
} from '../format.js';

export async function trendingList(options: {
  language?: string;
  since?: string;
  format?: string;
}): Promise<void> {
  try {
    const trending = await api.getTrendingList({
      language: options.language,
      since: options.since,
    });

    if (options.format === 'json') {
      printJson(trending);
      return;
    }

    printHeader('GitHub Trending 仓库');

    const headers = ['仓库名', '语言', 'Stars', 'Forks', '描述'];
    const rows = trending.map(repo => [
      `${repo.ownerName}/${repo.repoName}`,
      repo.language || '-',
      formatNumber(repo.stars),
      formatNumber(repo.forks),
      (repo.description || '-').substring(0, 50) + (repo.description && repo.description.length > 50 ? '...' : ''),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取 Trending 列表失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function trendingFetch(options: {
  language?: string;
  since?: string;
  format?: string;
}): Promise<void> {
  try {
    printInfo('正在抓取 GitHub Trending...');
    const result = await api.fetchTrending({
      language: options.language,
      since: options.since,
    });

    if (options.format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || 'Trending 数据已更新');
    } else {
      printError(result.message || '抓取失败');
    }
  } catch (error) {
    printError(`抓取 Trending 失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
