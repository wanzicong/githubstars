/**
 * 克隆命令处理器
 */

import { api } from '../api.js';
import { getConfig } from '../config.js';
import {
  formatTable,
  formatStatus,
  formatProgress,
  formatDate,
  formatNumber,
  printSuccess,
  printError,
  printInfo,
  printWarning,
  printHeader,
  printJson,
} from '../format.js';

export interface CloneOptions {
  repoIds: number[];
  targetDir?: string;
  concurrency?: number;
  shallow?: boolean;
  mirrorSource?: string;
  format?: string;
}

export async function cloneCreate(options: CloneOptions): Promise<void> {
  try {
    const config = getConfig();
    const targetDir = options.targetDir || config.defaultTargetDir;
    const concurrency = options.concurrency || config.defaultConcurrency;

    printInfo(`正在创建克隆任务...`);
    printInfo(`目标目录: ${targetDir}`);
    printInfo(`并发数: ${concurrency}`);

    const result = await api.createCloneTask({
      repoIds: options.repoIds,
      targetDir,
      concurrency,
      shallow: options.shallow ?? true,
      mirrorSource: options.mirrorSource || 'direct',
    });

    if (options.format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '克隆任务已创建');
      if (result.taskId) {
        printInfo(`任务 ID: ${result.taskId}`);
        printInfo(`使用 'githubstars clone:status ${result.taskId}' 查看进度`);
      }
    } else {
      printError(result.message || '创建克隆任务失败');
    }
  } catch (error) {
    printError(`创建克隆任务失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function cloneStatus(taskId: number, format?: string): Promise<void> {
  try {
    const task = await api.getCloneTaskProgress(taskId);

    if (format === 'json') {
      printJson(task);
      return;
    }

    printHeader(`克隆任务状态 (ID: ${taskId})`);
    console.log(`状态: ${formatStatus(task.status)}`);
    console.log(`目标目录: ${task.targetDir}`);
    console.log(`并发数: ${task.concurrency}`);
    console.log(`镜像源: ${task.mirrorSource}`);
    console.log(`进度: ${formatProgress(task.completedItems + task.failedItems, task.totalItems)}`);
    console.log('');
    console.log('统计:');
    console.log(`  总数: ${formatNumber(task.totalItems)}`);
    console.log(`  已完成: ${formatNumber(task.completedItems)}`);
    console.log(`  失败: ${formatNumber(task.failedItems)}`);
    console.log('');
    console.log(`创建时间: ${formatDate(task.createdAt)}`);
    console.log(`开始时间: ${formatDate(task.startedAt)}`);
    console.log(`完成时间: ${formatDate(task.finishedAt)}`);

    if (task.failedDetails && task.failedDetails.length > 0) {
      console.log('');
      printWarning('失败详情:');
      for (const item of task.failedDetails.slice(0, 10)) {
        console.log(`  - ${item.fullName}: ${item.error}`);
      }
      if (task.failedDetails.length > 10) {
        console.log(`  ... 还有 ${task.failedDetails.length - 10} 个失败项`);
      }
    }
  } catch (error) {
    printError(`获取克隆任务状态失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function cloneList(format?: string): Promise<void> {
  try {
    const result = await api.getCloneTaskList();

    if (format === 'json') {
      printJson(result);
      return;
    }

    printHeader('克隆任务列表');

    const headers = ['ID', '状态', '目标目录', '总数', '已完成', '失败', '创建时间'];
    const rows = result.tasks.map(task => [
      String(task.taskId),
      formatStatus(task.status),
      task.targetDir.length > 30 ? task.targetDir.substring(0, 30) + '...' : task.targetDir,
      String(task.totalItems),
      String(task.completedItems),
      String(task.failedItems),
      formatDate(task.createdAt),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取克隆任务列表失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function cloneRetry(taskId: number, format?: string): Promise<void> {
  try {
    printInfo(`正在重试克隆任务 ${taskId} 的失败项...`);
    const result = await api.retryCloneFailed(taskId);

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
    printError(`重试克隆任务失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function cloneRetryItem(taskId: number, fullName: string, format?: string): Promise<void> {
  try {
    printInfo(`正在重试克隆项: ${fullName}...`);
    const result = await api.retryCloneItem(taskId, fullName);

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
    printError(`重试克隆项失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function cloneReset(taskId: number, format?: string): Promise<void> {
  try {
    printInfo(`正在重置克隆任务 ${taskId}...`);
    const result = await api.resetCloneTask(taskId);

    if (format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '任务已重置');
    } else {
      printError(result.message || '重置失败');
    }
  } catch (error) {
    printError(`重置克隆任务失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function cloneDelete(taskId: number, format?: string): Promise<void> {
  try {
    printInfo(`正在删除克隆任务 ${taskId}...`);
    const result = await api.deleteCloneTask(taskId);

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
    printError(`删除克隆任务失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function cloneDirectories(format?: string): Promise<void> {
  try {
    const result = await api.getRecentCloneDirectories();

    if (format === 'json') {
      printJson(result);
      return;
    }

    printHeader('常用克隆目录');
    if (result.directories.length === 0) {
      console.log('暂无常用目录');
    } else {
      for (const dir of result.directories) {
        console.log(`  ${dir}`);
      }
    }
  } catch (error) {
    printError(`获取常用目录失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
