/**
 * 翻译命令处理器
 */

import { api } from '../api.js';
import {
  formatTable,
  formatStatus,
  formatProgress,
  formatDate,
  formatNumber,
  printSuccess,
  printError,
  printInfo,
  printHeader,
  printJson,
} from '../format.js';

export interface TranslateOptions {
  type?: 'description' | 'readme' | 'both';
  scope?: 'selected' | 'all' | 'filtered';
  repoIds?: number[];
  keyword?: string;
  language?: string;
  format?: string;
}

export async function translateCreate(options: TranslateOptions): Promise<void> {
  try {
    const type = options.type || 'readme';
    const scope = options.scope || 'all';

    printInfo(`正在创建翻译任务: 类型=${type}, 范围=${scope}...`);

    const result = await api.createTranslateTask({
      type,
      scope,
      repoIds: options.repoIds,
      filters: {
        keyword: options.keyword,
        language: options.language,
      },
    });

    if (options.format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '翻译任务已创建');
      if (result.taskId) {
        printInfo(`任务 ID: ${result.taskId}`);
        printInfo(`使用 'githubstars translate:status ${result.taskId}' 查看进度`);
      }
    } else {
      printError(result.message || '创建翻译任务失败');
    }
  } catch (error) {
    printError(`创建翻译任务失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function translateStatus(taskId: number, format?: string): Promise<void> {
  try {
    const task = await api.getTranslateTaskProgress(taskId);

    if (format === 'json') {
      printJson(task);
      return;
    }

    printHeader(`翻译任务状态 (ID: ${taskId})`);
    console.log(`状态: ${formatStatus(task.status)}`);
    console.log(`进度: ${formatProgress(task.completedItems + task.failedItems, task.totalItems)}`);
    console.log('');
    console.log('整体统计:');
    console.log(`  总数: ${formatNumber(task.totalItems)}`);
    console.log(`  已完成: ${formatNumber(task.completedItems)}`);
    console.log(`  失败: ${formatNumber(task.failedItems)}`);
    console.log('');
    console.log('描述翻译:');
    console.log(`  总数: ${formatNumber(task.descTotal)}`);
    console.log(`  已完成: ${formatNumber(task.descCompleted)}`);
    console.log(`  失败: ${formatNumber(task.descFailed)}`);
    console.log('');
    console.log('README 翻译:');
    console.log(`  总数: ${formatNumber(task.readmeTotal)}`);
    console.log(`  已完成: ${formatNumber(task.readmeCompleted)}`);
    console.log(`  失败: ${formatNumber(task.readmeFailed)}`);
    console.log('');
    console.log(`创建时间: ${formatDate(task.createdAt)}`);
    console.log(`完成时间: ${formatDate(task.finishedAt)}`);
  } catch (error) {
    printError(`获取翻译任务状态失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function translateList(page = 1, size = 10, format?: string): Promise<void> {
  try {
    const result = await api.getTranslateTaskList(page, size);

    if (format === 'json') {
      printJson(result);
      return;
    }

    printHeader(`翻译任务列表 (第 ${result.current}/${result.pages} 页, 共 ${result.total} 条)`);

    const headers = ['ID', '状态', '总数', '已完成', '失败', '进度', '创建时间'];
    const rows = result.records.map(task => [
      String(task.taskId),
      formatStatus(task.status),
      String(task.totalItems),
      String(task.completedItems),
      String(task.failedItems),
      `${task.progress}%`,
      formatDate(task.createdAt),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取翻译任务列表失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function translateRetry(taskId: number, format?: string): Promise<void> {
  try {
    printInfo(`正在重试翻译任务 ${taskId} 的失败项...`);
    const result = await api.retryTranslateFailed(taskId);

    if (format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '重试任务已创建');
      if (result.taskId) {
        printInfo(`新任务 ID: ${result.taskId}`);
      }
    } else {
      printError(result.message || '重试失败');
    }
  } catch (error) {
    printError(`重试翻译任务失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function translateStats(format?: string): Promise<void> {
  try {
    const stats = await api.getTranslationStatus();

    if (format === 'json') {
      printJson(stats);
      return;
    }

    printHeader('翻译统计');
    console.log(`仓库总数: ${formatNumber(stats.total)}`);
    console.log('');
    console.log('描述翻译:');
    console.log(`  已完成: ${formatNumber(stats.descCompleted)}`);
    console.log(`  待处理: ${formatNumber(stats.descPending)}`);
    console.log(`  覆盖率: ${stats.total > 0 ? Math.round((stats.descCompleted / stats.total) * 100) : 0}%`);
    console.log('');
    console.log('README 翻译:');
    console.log(`  已完成: ${formatNumber(stats.readmeCompleted)}`);
    console.log(`  待处理: ${formatNumber(stats.readmePending)}`);
    console.log(`  覆盖率: ${stats.total > 0 ? Math.round((stats.readmeCompleted / stats.total) * 100) : 0}%`);
  } catch (error) {
    printError(`获取翻译统计失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
