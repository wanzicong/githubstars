/**
 * 下载命令处理器
 */

import { api } from '../api.js';
import { getConfig } from '../config.js';
import {
  formatTable,
  formatStatus,
  formatProgress,
  formatDate,
  formatNumber,
  formatBytes,
  printSuccess,
  printError,
  printInfo,
  printHeader,
  printJson,
} from '../format.js';

export interface DownloadOptions {
  repoIds: number[];
  targetDir?: string;
  concurrency?: number;
  mirrorSource?: string;
  extractArchive?: boolean;
  deleteArchiveAfterExtract?: boolean;
  format?: string;
}

export async function downloadCreate(options: DownloadOptions): Promise<void> {
  try {
    const config = getConfig();
    const targetDir = options.targetDir || config.defaultTargetDir;
    const concurrency = options.concurrency || config.defaultConcurrency;

    printInfo(`正在创建下载任务...`);
    printInfo(`目标目录: ${targetDir}`);
    printInfo(`并发数: ${concurrency}`);

    const result = await api.createDownloadTask({
      repoIds: options.repoIds,
      targetDir,
      concurrency,
      mirrorSource: options.mirrorSource || 'direct',
      extractArchive: options.extractArchive ?? false,
      deleteArchiveAfterExtract: options.deleteArchiveAfterExtract ?? false,
    });

    if (options.format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '下载任务已创建');
      if (result.taskId) {
        printInfo(`任务 ID: ${result.taskId}`);
        printInfo(`使用 'githubstars download:status ${result.taskId}' 查看进度`);
      }
    } else {
      printError(result.message || '创建下载任务失败');
    }
  } catch (error) {
    printError(`创建下载任务失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function downloadStatus(taskId: number, format?: string): Promise<void> {
  try {
    const task = await api.getDownloadTaskProgress(taskId);

    if (format === 'json') {
      printJson(task);
      return;
    }

    printHeader(`下载任务状态 (ID: ${taskId})`);
    console.log(`状态: ${formatStatus(task.status)}`);
    console.log(`目标目录: ${task.targetDir}`);
    console.log(`并发数: ${task.concurrency}`);
    console.log(`进度: ${formatProgress(task.completedItems + task.failedItems, task.totalItems)}`);
    console.log('');
    console.log('统计:');
    console.log(`  总数: ${formatNumber(task.totalItems)}`);
    console.log(`  已完成: ${formatNumber(task.completedItems)}`);
    console.log(`  失败: ${formatNumber(task.failedItems)}`);
    console.log(`  总大小: ${formatBytes(task.totalBytes)}`);
    console.log(`  已下载: ${formatBytes(task.downloadedBytes)}`);
    console.log('');
    console.log(`创建时间: ${formatDate(task.createdAt)}`);
    console.log(`开始时间: ${formatDate(task.startedAt)}`);
    console.log(`完成时间: ${formatDate(task.finishedAt)}`);
  } catch (error) {
    printError(`获取下载任务状态失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function downloadList(format?: string): Promise<void> {
  try {
    const result = await api.getDownloadTaskList();

    if (format === 'json') {
      printJson(result);
      return;
    }

    printHeader('下载任务列表');

    const headers = ['ID', '状态', '目标目录', '总数', '已完成', '失败', '大小', '创建时间'];
    const rows = result.tasks.map(task => [
      String(task.taskId),
      formatStatus(task.status),
      task.targetDir.length > 25 ? task.targetDir.substring(0, 25) + '...' : task.targetDir,
      String(task.totalItems),
      String(task.completedItems),
      String(task.failedItems),
      formatBytes(task.downloadedBytes),
      formatDate(task.createdAt),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取下载任务列表失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function downloadRetry(taskId: number, format?: string): Promise<void> {
  try {
    printInfo(`正在重试下载任务 ${taskId} 的失败项...`);
    const result = await api.retryDownloadFailed(taskId);

    if (format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '重试任务已创建');
    } else {
      printError(result.message || '重试失败');
    }
  } catch (error) {
    printError(`重试下载任务失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function downloadRetryItem(taskId: number, fullName: string, format?: string): Promise<void> {
  try {
    printInfo(`正在重试下载项: ${fullName}...`);
    const result = await api.retryDownloadItem(taskId, fullName);

    if (format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '重试成功');
    } else {
      printError(result.message || '重试失败');
    }
  } catch (error) {
    printError(`重试下载项失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function downloadDelete(taskId: number, format?: string): Promise<void> {
  try {
    printInfo(`正在删除下载任务 ${taskId}...`);
    const result = await api.deleteDownloadTask(taskId);

    if (format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '任务已删除');
    } else {
      printError(result.message || '删除失败');
    }
  } catch (error) {
    printError(`删除下载任务失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
