/**
 * 直连数据库模式的命令处理器
 */

import { getDbClient, closeDbClient } from '../db.js';
import {
  formatTable,
  formatNumber,
  formatDate,
  formatStatus,
  printHeader,
  printJson,
  printError,
  printSuccess,
  printInfo,
} from '../format.js';

// ==================== Star 列表 ====================

export async function dbStarList(options: {
  page?: number;
  size?: number;
  keyword?: string;
  language?: string;
  sortBy?: string;
  sortOrder?: string;
  untranslatedOnly?: boolean;
  activeDays?: number;
  format?: string;
}): Promise<void> {
  try {
    const prisma = await getDbClient();
    const page = options.page || 1;
    const size = options.size || 20;

    const where: any = {};

    if (options.keyword?.trim()) {
      const kw = options.keyword.trim();
      where.OR = [
        { repoName: { contains: kw } },
        { description: { contains: kw } },
        { ownerName: { contains: kw } },
        { fullName: { contains: kw } },
      ];
    }

    if (options.language) {
      where.language = options.language;
    }

    if (options.untranslatedOnly) {
      where.OR = [
        { readmeCn: null },
        { readmeCn: '' },
      ];
    }

    if (options.activeDays) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - options.activeDays);
      where.repoUpdatedAt = { gte: daysAgo };
    }

    const sortField = options.sortBy || 'repoUpdatedAt';
    const sortDir = options.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, records] = await Promise.all([
      prisma.githubRepo.count({ where }),
      prisma.githubRepo.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);

    const pages = Math.ceil(total / size);

    if (options.format === 'json') {
      printJson({ records, total, size, current: page, pages });
      return;
    }

    printHeader(`Star 仓库列表 (第 ${page}/${pages} 页, 共 ${total} 个)`);

    const headers = ['ID', '仓库名', '语言', 'Stars', '所有者'];
    const rows = records.map(repo => [
      String(repo.id),
      repo.fullName || repo.repoName || '-',
      repo.language || '-',
      formatNumber(repo.starsCount),
      repo.ownerName || '-',
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}

export async function dbStarDetail(id: number, format?: string): Promise<void> {
  try {
    const prisma = await getDbClient();

    const repo = await prisma.githubRepo.findUnique({
      where: { id: BigInt(id) },
    });

    if (!repo) {
      printError(`仓库不存在: ${id}`);
      process.exit(1);
    }

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
    console.log(`Star 时间: ${formatDate(repo.starredAt?.toISOString())}`);
  } catch (error) {
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}

// ==================== 同步状态 ====================

export async function dbSyncStatus(format?: string): Promise<void> {
  try {
    const prisma = await getDbClient();

    const [totalRepos, lastSync] = await Promise.all([
      prisma.githubRepo.count(),
      prisma.syncLog.findFirst({
        where: { status: '成功' },
        orderBy: { finishedAt: 'desc' },
      }),
    ]);

    const status = {
      totalRepos,
      lastSyncTime: lastSync?.finishedAt?.toISOString() || null,
      lastSyncCount: lastSync?.syncedCount || 0,
    };

    if (format === 'json') {
      printJson(status);
      return;
    }

    printHeader('同步状态');
    console.log(`仓库总数: ${formatNumber(status.totalRepos)}`);
    console.log(`上次同步: ${formatDate(status.lastSyncTime)}`);
    console.log(`上次同步数量: ${formatNumber(status.lastSyncCount)}`);
  } catch (error) {
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}

// ==================== 翻译统计 ====================

export async function dbTranslateStats(format?: string): Promise<void> {
  try {
    const prisma = await getDbClient();

    const [total, descTranslated, readmeTranslated] = await Promise.all([
      prisma.githubRepo.count(),
      prisma.githubRepo.count({
        where: {
          descriptionCn: { not: null },
          description: { not: null },
        },
      }),
      prisma.githubRepo.count({
        where: {
          readmeCn: { not: null },
          readmeFetched: true,
        },
      }),
    ]);

    const stats = {
      total,
      descCompleted: descTranslated,
      descPending: total - descTranslated,
      readmeCompleted: readmeTranslated,
      readmePending: total - readmeTranslated,
    };

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
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}

// ==================== 统计信息 ====================

export async function dbStatsOverview(format?: string): Promise<void> {
  try {
    const prisma = await getDbClient();

    const [totalRepos, languages, owners] = await Promise.all([
      prisma.githubRepo.count(),
      prisma.githubRepo.findMany({
        select: { language: true },
        where: { language: { not: null } },
        distinct: ['language'],
      }),
      prisma.githubRepo.findMany({
        select: { ownerName: true },
        where: { ownerName: { not: null } },
        distinct: ['ownerName'],
      }),
    ]);

    const stats = {
      totalRepos,
      languages: languages.length,
      owners: owners.length,
    };

    if (format === 'json') {
      printJson(stats);
      return;
    }

    printHeader('概览统计');
    console.log(`仓库总数: ${formatNumber(stats.totalRepos)}`);
    console.log(`语言数量: ${formatNumber(stats.languages)}`);
    console.log(`所有者数量: ${formatNumber(stats.owners)}`);
  } catch (error) {
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}

export async function dbStatsLanguages(format?: string): Promise<void> {
  try {
    const prisma = await getDbClient();

    const languages = await prisma.githubRepo.groupBy({
      by: ['language'],
      _count: { language: true },
      where: { language: { not: null } },
      orderBy: { _count: { language: 'desc' } },
      take: 20,
    });

    if (format === 'json') {
      printJson(languages);
      return;
    }

    printHeader('语言分布 Top 20');

    const headers = ['排名', '语言', '仓库数量'];
    const rows = languages.map((lang, index) => [
      String(index + 1),
      lang.language || '未知',
      String(lang._count.language),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}

export async function dbStatsOwners(limit = 20, format?: string): Promise<void> {
  try {
    const prisma = await getDbClient();

    const owners = await prisma.githubRepo.groupBy({
      by: ['ownerName'],
      _count: { ownerName: true },
      where: { ownerName: { not: null } },
      orderBy: { _count: { ownerName: 'desc' } },
      take: limit,
    });

    if (format === 'json') {
      printJson(owners);
      return;
    }

    printHeader(`Top ${limit} 所有者`);

    const headers = ['排名', '所有者', '仓库数量'];
    const rows = owners.map((owner, index) => [
      String(index + 1),
      owner.ownerName || '未知',
      String(owner._count.ownerName),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}

// ==================== 分类管理 ====================

export async function dbCategoryList(format?: string): Promise<void> {
  try {
    const prisma = await getDbClient();

    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { categoryRepoLinks: true } },
      },
    });

    if (format === 'json') {
      printJson(categories);
      return;
    }

    printHeader('分类列表');

    const headers = ['ID', '名称', '图标', '仓库数量', '描述'];
    const rows = categories.map(cat => [
      String(cat.id),
      cat.name,
      cat.icon || '-',
      String(cat._count.categoryRepoLinks),
      cat.description || '-',
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}

// ==================== 克隆任务 ====================

export async function dbCloneTaskList(format?: string): Promise<void> {
  try {
    const prisma = await getDbClient();

    const tasks = await prisma.cloneTask.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (format === 'json') {
      printJson(tasks);
      return;
    }

    printHeader('最近克隆任务');

    const headers = ['ID', '状态', '目标目录', '总数', '已完成', '失败', '创建时间'];
    const rows = tasks.map(task => [
      String(task.id),
      task.status || '-',
      task.targetDir.length > 25 ? task.targetDir.substring(0, 25) + '...' : task.targetDir,
      String(task.totalItems),
      String(task.completedItems),
      String(task.failedItems),
      formatDate(task.createdAt?.toISOString()),
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}

// ==================== 配置管理 ====================

export async function dbConfigList(format?: string): Promise<void> {
  try {
    const prisma = await getDbClient();

    const configs = await prisma.systemConfig.findMany({
      orderBy: { configKey: 'asc' },
    });

    if (format === 'json') {
      printJson(configs);
      return;
    }

    printHeader('服务器配置');

    const headers = ['配置项', '值', '说明'];
    const rows = configs.map(config => [
      config.configKey,
      config.configValue || '-',
      config.description || '-',
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}

export async function dbConfigGet(key: string, format?: string): Promise<void> {
  try {
    const prisma = await getDbClient();

    const config = await prisma.systemConfig.findUnique({
      where: { configKey: key },
    });

    if (!config) {
      printError(`配置项不存在: ${key}`);
      process.exit(1);
    }

    if (format === 'json') {
      printJson(config);
      return;
    }

    printHeader(`配置项: ${key}`);
    console.log(`值: ${config.configValue || '-'}`);
    console.log(`说明: ${config.description || '-'}`);
  } catch (error) {
    printError(`查询失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    await closeDbClient();
  }
}
