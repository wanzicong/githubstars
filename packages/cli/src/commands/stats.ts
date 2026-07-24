/**
 * 统计命令处理器
 */

import { api } from '../api.js';
import {
  formatTable,
  formatNumber,
  printHeader,
  printJson,
  printError,
} from '../format.js';

export async function statsOverview(format?: string): Promise<void> {
  try {
    const stats = await api.getOverviewStats();

    if (format === 'json') {
      printJson(stats);
      return;
    }

    printHeader('概览统计');
    console.log(`仓库总数: ${formatNumber(stats.totalRepos)}`);
    console.log(`Stars 总数: ${formatNumber(stats.totalStars)}`);
    console.log(`Forks 总数: ${formatNumber(stats.totalForks)}`);
    console.log(`语言数量: ${formatNumber(stats.languages)}`);
    console.log(`所有者数量: ${formatNumber(stats.owners)}`);
  } catch (error) {
    printError(`获取概览统计失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function statsLanguages(format?: string): Promise<void> {
  try {
    const languages = await api.getLanguageStats();

    if (format === 'json') {
      printJson(languages);
      return;
    }

    printHeader('语言分布');

    const headers = ['语言', '仓库数量', '占比'];
    const total = languages.reduce((sum, lang) => sum + lang.count, 0);
    const rows = languages.slice(0, 20).map(lang => [
      lang.language || '未知',
      formatNumber(lang.count),
      `${((lang.count / total) * 100).toFixed(1)}%`,
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取语言统计失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function statsOwners(limit = 20, format?: string): Promise<void> {
  try {
    const owners = await api.getOwnerStats(limit);

    if (format === 'json') {
      printJson(owners);
      return;
    }

    printHeader(`Top ${limit} 所有者`);

    const headers = ['排名', '所有者', '仓库数量'];
    const rows = owners.map((owner, index) => [
      String(index + 1),
      owner.ownerName,
      formatNumber(owner.count),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取所有者统计失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function statsTimeline(dateField = 'starred_at', format?: string): Promise<void> {
  try {
    const timeline = await api.getTimelineStats(dateField);

    if (format === 'json') {
      printJson(timeline);
      return;
    }

    printHeader(`时间线统计 (${dateField})`);

    const headers = ['日期', '数量'];
    const rows = timeline.slice(-30).map(item => [
      item.date,
      formatNumber(item.count),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取时间线统计失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
