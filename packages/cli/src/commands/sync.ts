/**
 * 同步命令处理器
 */

import { api } from '../api.js';
import { getConfig } from '../config.js';
import {
  formatTable,
  formatStatus,
  formatDate,
  formatNumber,
  printSuccess,
  printError,
  printInfo,
  printHeader,
  printJson,
} from '../format.js';

export async function syncStatus(format?: string): Promise<void> {
  try {
    const status = await api.getSyncStatus();

    if (format === 'json') {
      printJson(status);
      return;
    }

    printHeader('同步状态');
    console.log(`状态: ${formatStatus(status.status)}`);
    console.log(`仓库总数: ${formatNumber(status.totalRepos)}`);
    console.log(`上次同步: ${formatDate(status.lastSyncTime)}`);
    console.log(`上次同步数量: ${formatNumber(status.lastSyncCount)}`);
    console.log(`上次成功: ${formatDate(status.lastSuccessTime)}`);
    console.log(`上次成功数量: ${formatNumber(status.lastSuccessCount)}`);
  } catch (error) {
    printError(`获取同步状态失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function syncStart(format?: string): Promise<void> {
  try {
    printInfo('正在启动同步任务...');
    const result = await api.startSync();

    if (format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '同步任务已启动');
    } else {
      printError(result.message || '启动同步失败');
    }
  } catch (error) {
    printError(`启动同步失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function syncLogs(page = 1, size = 10, format?: string): Promise<void> {
  try {
    const result = await api.getSyncLogs(page, size);

    if (format === 'json') {
      printJson(result);
      return;
    }

    printHeader(`同步日志 (第 ${result.current}/${result.pages} 页, 共 ${result.total} 条)`);

    const headers = ['ID', '类型', '状态', '总数', '已同步', '开始时间', '完成时间'];
    const rows = result.records.map(log => [
      String(log.id),
      log.syncType || '-',
      log.status || '-',
      String(log.totalCount ?? '-'),
      String(log.syncedCount ?? '-'),
      formatDate(log.startedAt),
      formatDate(log.finishedAt),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取同步日志失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
