/**
 * 配置命令处理器
 */

import { api } from '../api.js';
import { getConfig, saveConfig, resetConfig, type CliConfig } from '../config.js';
import {
  formatTable,
  printSuccess,
  printError,
  printInfo,
  printHeader,
  printJson,
} from '../format.js';

export async function configShow(format?: string): Promise<void> {
  try {
    const config = getConfig();

    if (format === 'json') {
      printJson(config);
      return;
    }

    printHeader('CLI 配置');
    console.log(`API 地址: ${config.baseUrl}`);
    console.log(`输出格式: ${config.outputFormat}`);
    console.log(`每页数量: ${config.pageSize}`);
    console.log(`默认并发数: ${config.defaultConcurrency}`);
    console.log(`默认目标目录: ${config.defaultTargetDir}`);
  } catch (error) {
    printError(`获取配置失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function configSet(key: string, value: string, format?: string): Promise<void> {
  try {
    const config: Partial<CliConfig> = {};

    switch (key) {
      case 'baseUrl':
        config.baseUrl = value;
        break;
      case 'outputFormat':
        if (!['table', 'json', 'csv'].includes(value)) {
          printError('输出格式必须是 table、json 或 csv');
          process.exit(1);
        }
        config.outputFormat = value as 'table' | 'json' | 'csv';
        break;
      case 'pageSize':
        const size = parseInt(value, 10);
        if (isNaN(size) || size < 1) {
          printError('每页数量必须是正整数');
          process.exit(1);
        }
        config.pageSize = size;
        break;
      case 'defaultConcurrency':
        const concurrency = parseInt(value, 10);
        if (isNaN(concurrency) || concurrency < 1) {
          printError('默认并发数必须是正整数');
          process.exit(1);
        }
        config.defaultConcurrency = concurrency;
        break;
      case 'defaultTargetDir':
        config.defaultTargetDir = value;
        break;
      default:
        printError(`未知配置项: ${key}`);
        process.exit(1);
    }

    saveConfig(config);

    if (format === 'json') {
      printJson({ success: true, key, value });
      return;
    }

    printSuccess(`配置已更新: ${key} = ${value}`);
  } catch (error) {
    printError(`设置配置失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function configReset(format?: string): Promise<void> {
  try {
    resetConfig();

    if (format === 'json') {
      printJson({ success: true, message: '配置已重置' });
      return;
    }

    printSuccess('配置已重置为默认值');
  } catch (error) {
    printError(`重置配置失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function configServer(format?: string): Promise<void> {
  try {
    const configs = await api.getAllConfigs();

    if (format === 'json') {
      printJson(configs);
      return;
    }

    printHeader('服务器配置');

    const headers = ['配置项', '值', '说明'];
    const rows = configs.map(config => [
      config.key,
      config.value || '-',
      config.description || '-',
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取服务器配置失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function configServerSet(key: string, value: string, format?: string): Promise<void> {
  try {
    const result = await api.setConfig(key, value);

    if (format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(`服务器配置已更新: ${key} = ${value}`);
    } else {
      printError(result.message || '更新失败');
    }
  } catch (error) {
    printError(`设置服务器配置失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
