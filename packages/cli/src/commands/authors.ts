/**
 * 作者命令处理器
 */

import { api } from '../api.js';
import {
  formatTable,
  formatNumber,
  printHeader,
  printJson,
  printError,
} from '../format.js';

export async function authorList(options: {
  page?: number;
  size?: number;
  keyword?: string;
  format?: string;
}): Promise<void> {
  try {
    const result = await api.getAuthorList({
      page: options.page || 1,
      size: options.size || 20,
      keyword: options.keyword,
    });

    if (options.format === 'json') {
      printJson(result);
      return;
    }

    printHeader(`作者列表 (第 ${result.current}/${result.pages} 页, 共 ${result.total} 个)`);

    const headers = ['排名', '所有者', '仓库数量', 'Stars 总数'];
    const rows = result.records.map((author, index) => [
      String((result.current - 1) * result.size + index + 1),
      author.ownerName,
      String(author.repoCount),
      formatNumber(author.totalStars),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取作者列表失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function authorDetail(ownerName: string, format?: string): Promise<void> {
  try {
    const detail = await api.getAuthorDetail(ownerName);

    if (format === 'json') {
      printJson(detail);
      return;
    }

    printHeader(`作者详情: ${ownerName}`);
    console.log(`仓库数量: ${detail.stats.repoCount}`);
    console.log(`Stars 总数: ${formatNumber(detail.stats.totalStars)}`);
    console.log(`使用语言: ${detail.stats.languages.join(', ') || '-'}`);
    console.log('');

    if (detail.repos.length > 0) {
      printHeader('仓库列表');

      const headers = ['仓库名', '语言', 'Stars', '描述'];
      const rows = detail.repos.map(repo => [
        repo.fullName || repo.repoName || '-',
        repo.language || '-',
        formatNumber(repo.starsCount),
        (repo.description || '-').substring(0, 40) + (repo.description && repo.description.length > 40 ? '...' : ''),
      ]);

      console.log(formatTable(headers, rows));
    }
  } catch (error) {
    printError(`获取作者详情失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function authorRepos(ownerName: string, options: {
  page?: number;
  size?: number;
  format?: string;
}): Promise<void> {
  try {
    const result = await api.getAuthorRepos(ownerName, {
      page: options.page || 1,
      size: options.size || 20,
    });

    if (options.format === 'json') {
      printJson(result);
      return;
    }

    printHeader(`${ownerName} 的仓库 (第 ${result.current}/${result.pages} 页, 共 ${result.total} 个)`);

    const headers = ['ID', '仓库名', '语言', 'Stars', '描述'];
    const rows = result.records.map(repo => [
      String(repo.id),
      repo.fullName || repo.repoName || '-',
      repo.language || '-',
      formatNumber(repo.starsCount),
      (repo.description || '-').substring(0, 40) + (repo.description && repo.description.length > 40 ? '...' : ''),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取作者仓库列表失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
