#!/usr/bin/env node

/**
 * GitHub Stars CLI — 完整的命令行管理工具
 *
 * 用法：
 *   githubstars                          启动全部服务
 *   githubstars --help                   查看帮助
 *   githubstars --version                查看版本
 *
 *   # 服务管理
 *   githubstars start [service]          启动服务
 *   githubstars stop                     停止服务
 *   githubstars status                   查看状态
 *
 *   # 数据同步
 *   githubstars sync                     同步 Star 数据
 *   githubstars sync:status              查看同步状态
 *   githubstars sync:logs                查看同步日志
 *
 *   # Star 列表
 *   githubstars stars                    列出 Star 仓库
 *   githubstars stars <id>               查看仓库详情
 *   githubstars stars search <keyword>   搜索仓库
 *   githubstars stars export             导出仓库 URL
 *
 *   # 克隆管理
 *   githubstars clone <repoIds...>       创建克隆任务
 *   githubstars clone:status <id>        查看克隆进度
 *   githubstars clone:list               列出克隆任务
 *   githubstars clone:retry <id>         重试克隆任务
 *   githubstars clone:delete <id>        删除克隆任务
 *
 *   # 下载管理
 *   githubstars download <repoIds...>    创建下载任务
 *   githubstars download:status <id>     查看下载进度
 *   githubstars download:list            列出下载任务
 *   githubstars download:retry <id>      重试下载任务
 *   githubstars download:delete <id>     删除下载任务
 *
 *   # 统计信息
 *   githubstars stats                    查看概览统计
 *   githubstars stats:languages          查看语言分布
 *   githubstars stats:owners             查看所有者排行
 *   githubstars stats:timeline           查看时间线
 *
 *   # 分类管理
 *   githubstars category list            列出分类
 *   githubstars category create          创建分类
 *   githubstars category update <id>     更新分类
 *   githubstars category delete <id>     删除分类
 *
 *   # 配置管理
 *   githubstars config                   查看 CLI 配置
 *   githubstars config set <key> <value> 设置 CLI 配置
 *   githubstars config reset             重置 CLI 配置
 *   githubstars config:server            查看服务器配置
 *   githubstars config:server set <k> <v> 设置服务器配置
 */

import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { printError, printInfo, printJson, printHeader, printSuccess, formatNumber, formatTable } from './format.js';

// Command imports
import { syncStatus, syncStart, syncLogs } from './commands/sync.js';
import { starList, starDetail, starSearch, starExport } from './commands/stars.js';
import {
  cloneCreate,
  cloneStatus,
  cloneList,
  cloneRetry,
  cloneRetryItem,
  cloneReset,
  cloneDelete,
  cloneDirectories,
} from './commands/clone.js';
import {
  downloadCreate,
  downloadStatus,
  downloadList,
  downloadRetry,
  downloadRetryItem,
  downloadDelete,
} from './commands/download.js';
import {
  statsOverview,
  statsLanguages,
  statsOwners,
  statsTimeline,
} from './commands/stats.js';
import {
  configShow,
  configSet,
  configReset,
  configServer,
  configServerSet,
} from './commands/config.js';
import {
  categoryList,
  categoryCreate,
  categoryUpdate,
  categoryDelete,
  categoryAddRepos,
  categoryRemoveRepos,
} from './commands/category.js';
import { trendingList, trendingFetch } from './commands/trending.js';
import { authorList, authorDetail, authorRepos } from './commands/authors.js';
import {
  dbStarList,
  dbStarDetail,
  dbSyncStatus,
  dbStatsOverview,
  dbStatsLanguages,
  dbStatsOwners,
  dbCategoryList,
  dbCloneTaskList,
  dbConfigList,
  dbConfigGet,
} from './commands/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 定位项目根目录
function findProjectRoot() {
  if (process.env.GITHUBSTARS_HOME) {
    return process.env.GITHUBSTARS_HOME;
  }

  let dir = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(dir, 'packages', 'backend', 'package.json'))) {
    return dir;
  }

  dir = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(path.join(dir, 'packages', 'backend', 'package.json'))) {
    return dir;
  }

  if (fs.existsSync(path.join(process.cwd(), 'packages', 'backend', 'package.json'))) {
    return process.cwd();
  }

  return null;
}

const ROOT = findProjectRoot();

const PORTS = [
  { name: '前端 (Vite)', port: 10001 },
  { name: '后端 (NestJS)', port: 10002 },
];

function showHelp() {
  console.log(`
GitHub Stars CLI — GitHub 星标仓库管理系统

用法:
  githubstars                          启动全部服务
  githubstars --help                   显示帮助
  githubstars --version                显示版本

模式:
  默认模式    通过 HTTP API 调用后端服务（需要先启动服务）
  --db 模式   直连数据库查询（无需启动服务，仅支持只读操作）

服务管理:
  githubstars start [service]          启动服务 (backend|frontend|all)
  githubstars stop                     停止所有服务
  githubstars status                   查看服务运行状态

数据同步:
  githubstars sync                     同步 Star 数据
  githubstars sync:status              查看同步状态
  githubstars sync:logs [--page N]     查看同步日志

Star 列表:
  githubstars stars [options]          列出 Star 仓库
    --page N                             页码
    --size N                             每页数量
    --keyword <text>                     搜索关键词
    --language <lang>                    筛选语言
    --sort-by <field>                    排序字段
    --sort-order <asc|desc>              排序方向
    --untranslated                       仅未翻译
    --format <table|json>                输出格式
  githubstars stars <id>               查看仓库详情
  githubstars stars search <keyword>   搜索仓库
  githubstars stars export             导出仓库 URL

克隆管理:
  githubstars clone <repoIds...>       创建克隆任务
    --target-dir <path>                  目标目录
    --concurrency <N>                    并发数
    --no-shallow                         完整克隆
    --mirror <source>                    镜像源
  githubstars clone:status <id>        查看克隆进度
  githubstars clone:list               列出克隆任务
  githubstars clone:retry <id>         重试克隆任务
  githubstars clone:retry-item <id> <name> 重试单个克隆项
  githubstars clone:reset <id>         重置克隆任务
  githubstars clone:delete <id>        删除克隆任务
  githubstars clone:dirs               查看常用目录

下载管理:
  githubstars download <repoIds...>    创建下载任务
    --target-dir <path>                  目标目录
    --concurrency <N>                    并发数
    --mirror <source>                    镜像源
    --extract                            解压文件
    --delete-archive                     删除压缩包
  githubstars download:status <id>     查看下载进度
  githubstars download:list            列出下载任务
  githubstars download:retry <id>      重试下载任务
  githubstars download:retry-item <id> <name> 重试单个下载项
  githubstars download:delete <id>     删除下载任务

统计信息:
  githubstars stats                    查看概览统计
  githubstars stats:languages          查看语言分布
  githubstars stats:owners [--limit N] 查看所有者排行
  githubstars stats:timeline [--field <field>] 查看时间线

分类管理:
  githubstars category list            列出分类
  githubstars category create          创建分类
    --name <name>                        分类名称
    --parent-id <id>                     父分类 ID
    --icon <icon>                        图标
    --description <text>                 描述
  githubstars category update <id>     更新分类
  githubstars category delete <id>     删除分类
  githubstars category:add <categoryId> <repoIds...> 添加仓库到分类
  githubstars category:remove <categoryId> <repoIds...> 从分类移除仓库

配置管理:
  githubstars config                   查看 CLI 配置
  githubstars config set <key> <value> 设置 CLI 配置
    key: baseUrl|outputFormat|pageSize|defaultConcurrency|defaultTargetDir
  githubstars config reset             重置 CLI 配置
  githubstars config:server            查看服务器配置
  githubstars config:server set <k> <v> 设置服务器配置

批量操作:
  githubstars stars:by-ids <ids...>    批量获取仓库详情
  githubstars stars:ids [--keyword] [--language] 获取仓库 ID 列表

Trending:
  githubstars trending [--language] [--since]    查看 Trending 仓库
  githubstars trending:fetch [--language]        抓取 Trending 数据

作者管理:
  githubstars authors [--page N] [--size N]      作者列表
  githubstars author <name>                      作者详情
  githubstars author:repos <name> [--page N]     作者仓库列表

导出:
  githubstars export md [--keyword] [--language] 导出 Markdown 文件

快速链接:
  前端:    http://localhost:10001
  后端:    http://localhost:10002
  Swagger: http://localhost:10002/api/docs

数据库直连模式 (--db):
  无需启动后端服务，直接连接数据库进行查询（仅支持只读操作）

  支持的命令:
    githubstars --db stars                    列出 Star 仓库
    githubstars --db stars <id>               查看仓库详情
    githubstars --db sync:status              查看同步状态
    githubstars --db stats                    查看概览统计
    githubstars --db stats:languages          查看语言分布
    githubstars --db stats:owners             查看所有者排行
    githubstars --db category list            列出分类
    githubstars --db clone:list               列出克隆任务
    githubstars --db config:server            查看服务器配置
    githubstars --db config:server <key>      查看指定配置项

  示例:
    githubstars --db stars --page 1 --size 20 --language TypeScript
    githubstars --db stars 123 --format json
    githubstars --db stats:languages
`);
}

function showVersion() {
  if (ROOT) {
    const pkgPath = path.join(ROOT, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      console.log(`githubstars v${pkg.version || '0.0.1'}`);
      return;
    }
  }
  console.log('githubstars v0.0.1');
}

function findPid(port: number): number | null {
  try {
    if (os.platform() === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      const re = new RegExp(`:${port}\\s+.*LISTENING\\s+(\\d+)`);
      const match = out.match(re);
      return match ? parseInt(match[1]) : null;
    } else {
      const out = execSync(`lsof -ti:${port} 2>/dev/null || fuser ${port}/tcp 2>/dev/null`, { encoding: 'utf-8' });
      return out.trim() ? parseInt(out.trim().split('\n')[0]) : null;
    }
  } catch {
    return null;
  }
}

function killPid(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (os.platform() === 'win32') {
      const child = spawn('taskkill', ['/PID', String(pid), '/F'], { stdio: 'pipe' });
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    } else {
      try {
        process.kill(pid, 'SIGTERM');
        setTimeout(() => {
          try {
            process.kill(pid, 0);
            resolve(false);
          } catch {
            resolve(true);
          }
        }, 500);
      } catch {
        resolve(false);
      }
    }
  });
}

async function stopServices() {
  console.log('🛑 正在停止 GitHub Stars...\n');
  let stopped = 0;

  for (const { name, port } of PORTS) {
    const pid = findPid(port);
    if (pid) {
      const ok = await killPid(pid);
      if (ok) {
        console.log(`  ✅ ${name} — 已停止 (port ${port}, PID ${pid})`);
        stopped++;
      } else {
        console.log(`  ❌ ${name} — 停止失败 (port ${port}, PID ${pid})`);
      }
    } else {
      console.log(`  ⚪ ${name} — 未运行 (port ${port})`);
    }
  }

  console.log(stopped > 0 ? `\n✅ 已停止 ${stopped} 个服务` : '\n💤 没有运行中的服务');
}

function showStatus() {
  console.log('📊 GitHub Stars 运行状态:\n');

  for (const { name, port } of PORTS) {
    const pid = findPid(port);
    if (pid) {
      console.log(`  🟢 ${name} — 运行中 (port ${port}, PID ${pid})`);
    } else {
      console.log(`  🔴 ${name} — 未运行 (port ${port})`);
    }
  }

  console.log('\n快速链接:');
  console.log('  前端:    http://localhost:10001');
  console.log('  后端:    http://localhost:10002');
  console.log('  Swagger: http://localhost:10002/api/docs');
}

function run(command: string): Promise<void> {
  if (!ROOT) {
    console.error('❌ 找不到项目目录。请设置 GITHUBSTARS_HOME 环境变量或在项目根目录执行。');
    process.exit(1);
  }

  const [cmd, ...args] = command.split(' ');
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function parseArgs(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      flags[key] = true;
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    if (!ROOT) {
      console.error('❌ 找不到项目目录。请设置 GITHUBSTARS_HOME 环境变量或在项目根目录执行。');
      process.exit(1);
    }
    console.log(`🚀 GitHub Stars 启动中... (项目目录: ${ROOT})\n`);
    await run('npm run dev:all');
    return;
  }

  // 检查是否使用数据库直连模式
  const useDb = args.includes('--db');
  const filteredArgs = args.filter(a => a !== '--db');

  const command = filteredArgs[0];
  const { positional, flags } = parseArgs(filteredArgs.slice(1));
  const format = flags.format as string | undefined;

  // 数据库直连模式命令
  if (useDb) {
    switch (command) {
      case 'stars':
        if (positional[0] && !isNaN(parseInt(positional[0]))) {
          await dbStarDetail(parseInt(positional[0]), format);
        } else {
          await dbStarList({
            page: flags.page ? parseInt(flags.page as string) : undefined,
            size: flags.size ? parseInt(flags.size as string) : undefined,
            keyword: flags.keyword as string,
            language: flags.language as string,
            sortBy: flags['sort-by'] as string,
            sortOrder: flags['sort-order'] as string,
            untranslatedOnly: !!flags.untranslated,
            activeDays: flags['active-days'] ? parseInt(flags['active-days'] as string) : undefined,
            format,
          });
        }
        return;

      case 'sync:status':
        await dbSyncStatus(format);
        return;

      case 'stats':
        await dbStatsOverview(format);
        return;

      case 'stats:languages':
        await dbStatsLanguages(format);
        return;

      case 'stats:owners':
        await dbStatsOwners(
          flags.limit ? parseInt(flags.limit as string) : 20,
          format
        );
        return;

      case 'category':
        if (positional[0] === 'list') {
          await dbCategoryList(format);
        } else {
          printError('数据库模式仅支持 category list 命令');
          process.exit(1);
        }
        return;

      case 'clone:list':
        await dbCloneTaskList(format);
        return;

      case 'config:server':
        if (positional[0]) {
          await dbConfigGet(positional[0], format);
        } else {
          await dbConfigList(format);
        }
        return;

      default:
        printError(`数据库模式不支持此命令: ${command}`);
        printInfo('数据库模式支持的命令: stars, sync:status, stats, stats:languages, stats:owners, category list, clone:list, config:server');
        process.exit(1);
    }
  }

  // HTTP API 模式命令
  switch (command) {
    case '--help':
    case '-h':
    case 'help':
      showHelp();
      break;

    case '--version':
    case '-v':
    case 'version':
      showVersion();
      break;

    // 服务管理
    case 'start':
      if (!ROOT) {
        console.error('❌ 找不到项目目录');
        process.exit(1);
      }
      console.log(`🚀 GitHub Stars 启动中... (项目目录: ${ROOT})\n`);
      if (positional[0] === 'backend') {
        await run('npm run dev -w @githubstars/backend');
      } else if (positional[0] === 'frontend') {
        await run('npm run dev -w @githubstars/frontend');
      } else {
        await run('npm run dev');
      }
      break;

    case 'stop':
      await stopServices();
      break;

    case 'status':
      showStatus();
      break;

    // 数据同步
    case 'sync':
      await syncStart(format);
      break;

    case 'sync:status':
      await syncStatus(format);
      break;

    case 'sync:logs':
      await syncLogs(
        flags.page ? parseInt(flags.page as string) : 1,
        flags.size ? parseInt(flags.size as string) : 10,
        format
      );
      break;

    // Star 列表
    case 'stars':
      if (positional[0] === 'search') {
        await starSearch(positional[1] || '', {
          page: flags.page ? parseInt(flags.page as string) : undefined,
          size: flags.size ? parseInt(flags.size as string) : undefined,
          language: flags.language as string,
          sortBy: flags['sort-by'] as string,
          sortOrder: flags['sort-order'] as string,
          untranslatedOnly: !!flags.untranslated,
          format,
        });
      } else if (positional[0] === 'export') {
        await starExport({
          keyword: flags.keyword as string,
          language: flags.language as string,
          format,
        });
      } else if (positional[0] && !isNaN(parseInt(positional[0]))) {
        await starDetail(parseInt(positional[0]), format);
      } else {
        await starList({
          page: flags.page ? parseInt(flags.page as string) : undefined,
          size: flags.size ? parseInt(flags.size as string) : undefined,
          keyword: flags.keyword as string,
          language: flags.language as string,
          sortBy: flags['sort-by'] as string,
          sortOrder: flags['sort-order'] as string,
          untranslatedOnly: !!flags.untranslated,
          format,
        });
      }
      break;

    // 克隆管理
    case 'clone':
      if (positional.length === 0) {
        console.error('❌ 请指定仓库 ID');
        process.exit(1);
      }
      await cloneCreate({
        repoIds: positional.map(Number),
        targetDir: flags['target-dir'] as string,
        concurrency: flags.concurrency ? parseInt(flags.concurrency as string) : undefined,
        shallow: !flags['no-shallow'],
        mirrorSource: flags.mirror as string,
        format,
      });
      break;

    case 'clone:status':
      if (!positional[0]) {
        console.error('❌ 请指定任务 ID');
        process.exit(1);
      }
      await cloneStatus(parseInt(positional[0]), format);
      break;

    case 'clone:list':
      await cloneList(format);
      break;

    case 'clone:retry':
      if (!positional[0]) {
        console.error('❌ 请指定任务 ID');
        process.exit(1);
      }
      await cloneRetry(parseInt(positional[0]), format);
      break;

    case 'clone:retry-item':
      if (!positional[0] || !positional[1]) {
        console.error('❌ 请指定任务 ID 和仓库全名');
        process.exit(1);
      }
      await cloneRetryItem(parseInt(positional[0]), positional[1], format);
      break;

    case 'clone:reset':
      if (!positional[0]) {
        console.error('❌ 请指定任务 ID');
        process.exit(1);
      }
      await cloneReset(parseInt(positional[0]), format);
      break;

    case 'clone:delete':
      if (!positional[0]) {
        console.error('❌ 请指定任务 ID');
        process.exit(1);
      }
      await cloneDelete(parseInt(positional[0]), format);
      break;

    case 'clone:dirs':
      await cloneDirectories(format);
      break;

    // 下载管理
    case 'download':
      if (positional.length === 0) {
        console.error('❌ 请指定仓库 ID');
        process.exit(1);
      }
      await downloadCreate({
        repoIds: positional.map(Number),
        targetDir: flags['target-dir'] as string,
        concurrency: flags.concurrency ? parseInt(flags.concurrency as string) : undefined,
        mirrorSource: flags.mirror as string,
        extractArchive: !!flags.extract,
        deleteArchiveAfterExtract: !!flags['delete-archive'],
        format,
      });
      break;

    case 'download:status':
      if (!positional[0]) {
        console.error('❌ 请指定任务 ID');
        process.exit(1);
      }
      await downloadStatus(parseInt(positional[0]), format);
      break;

    case 'download:list':
      await downloadList(format);
      break;

    case 'download:retry':
      if (!positional[0]) {
        console.error('❌ 请指定任务 ID');
        process.exit(1);
      }
      await downloadRetry(parseInt(positional[0]), format);
      break;

    case 'download:retry-item':
      if (!positional[0] || !positional[1]) {
        console.error('❌ 请指定任务 ID 和仓库全名');
        process.exit(1);
      }
      await downloadRetryItem(parseInt(positional[0]), positional[1], format);
      break;

    case 'download:delete':
      if (!positional[0]) {
        console.error('❌ 请指定任务 ID');
        process.exit(1);
      }
      await downloadDelete(parseInt(positional[0]), format);
      break;

    // 统计信息
    case 'stats':
      await statsOverview(format);
      break;

    case 'stats:languages':
      await statsLanguages(format);
      break;

    case 'stats:owners':
      await statsOwners(
        flags.limit ? parseInt(flags.limit as string) : 20,
        format
      );
      break;

    case 'stats:timeline':
      await statsTimeline(
        (flags.field as string) || 'starred_at',
        format
      );
      break;

    // 分类管理
    case 'category':
      if (positional[0] === 'list') {
        await categoryList(format);
      } else if (positional[0] === 'create') {
        if (!flags.name) {
          console.error('❌ 请指定分类名称');
          process.exit(1);
        }
        await categoryCreate({
          name: flags.name as string,
          parentId: flags['parent-id'] ? parseInt(flags['parent-id'] as string) : undefined,
          icon: flags.icon as string,
          description: flags.description as string,
          format,
        });
      } else if (positional[0] === 'update') {
        if (!positional[1]) {
          console.error('❌ 请指定分类 ID');
          process.exit(1);
        }
        await categoryUpdate(parseInt(positional[1]), {
          name: flags.name as string,
          parentId: flags['parent-id'] ? parseInt(flags['parent-id'] as string) : undefined,
          icon: flags.icon as string,
          description: flags.description as string,
          sortOrder: flags['sort-order'] ? parseInt(flags['sort-order'] as string) : undefined,
          format,
        });
      } else if (positional[0] === 'delete') {
        if (!positional[1]) {
          console.error('❌ 请指定分类 ID');
          process.exit(1);
        }
        await categoryDelete(parseInt(positional[1]), format);
      } else {
        console.error(`❌ 未知分类命令: ${positional[0]}`);
        process.exit(1);
      }
      break;

    case 'category:add':
      if (!positional[0] || positional.length < 2) {
        console.error('❌ 请指定分类 ID 和仓库 ID');
        process.exit(1);
      }
      await categoryAddRepos(
        parseInt(positional[0]),
        positional.slice(1).map(Number),
        format
      );
      break;

    case 'category:remove':
      if (!positional[0] || positional.length < 2) {
        console.error('❌ 请指定分类 ID 和仓库 ID');
        process.exit(1);
      }
      await categoryRemoveRepos(
        parseInt(positional[0]),
        positional.slice(1).map(Number),
        format
      );
      break;

    // 配置管理
    case 'config':
      if (positional[0] === 'set') {
        if (!positional[1] || !positional[2]) {
          console.error('❌ 请指定配置项和值');
          process.exit(1);
        }
        await configSet(positional[1], positional[2], format);
      } else if (positional[0] === 'reset') {
        await configReset(format);
      } else {
        await configShow(format);
      }
      break;

    case 'config:server':
      if (positional[0] === 'set') {
        if (!positional[1] || !positional[2]) {
          console.error('❌ 请指定配置项和值');
          process.exit(1);
        }
        await configServerSet(positional[1], positional[2], format);
      } else {
        await configServer(format);
      }
      break;

    // Stars 批量操作
    case 'stars:by-ids':
      if (positional.length === 0) {
        console.error('❌ 请指定仓库 ID');
        process.exit(1);
      }
      {
        const { starList } = await import('./commands/stars.js');
        const repos = await (await import('./api.js')).api.getStarByIds(positional.map(Number));
        if (format === 'json') {
          printJson(repos);
        } else {
          printHeader('仓库列表');
          const headers = ['ID', '仓库名', '语言', 'Stars', '所有者'];
          const rows = repos.map(repo => [
            String(repo.id),
            repo.fullName || repo.repoName || '-',
            repo.language || '-',
            formatNumber(repo.starsCount),
            repo.ownerName || '-',
          ]);
          console.log(formatTable(headers, rows));
        }
      }
      break;

    case 'stars:ids':
      {
        const ids = await (await import('./api.js')).api.getStarIds({
          keyword: flags.keyword as string,
          language: flags.language as string,
          sortBy: flags['sort-by'] as string,
          sortOrder: flags['sort-order'] as string,
        });
        if (format === 'json') {
          printJson(ids);
        } else {
          printHeader(`仓库 ID 列表 (共 ${ids.length} 个)`);
          console.log(ids.join(', '));
        }
      }
      break;

    // Trending
    case 'trending':
      await trendingList({
        language: flags.language as string,
        since: flags.since as string,
        format,
      });
      break;

    case 'trending:fetch':
      await trendingFetch({
        language: flags.language as string,
        since: flags.since as string,
        format,
      });
      break;

    // 作者管理
    case 'authors':
      await authorList({
        page: flags.page ? parseInt(flags.page as string) : undefined,
        size: flags.size ? parseInt(flags.size as string) : undefined,
        keyword: flags.keyword as string,
        format,
      });
      break;

    case 'author':
      if (!positional[0]) {
        console.error('❌ 请指定作者名称');
        process.exit(1);
      }
      await authorDetail(positional[0], format);
      break;

    case 'author:repos':
      if (!positional[0]) {
        console.error('❌ 请指定作者名称');
        process.exit(1);
      }
      await authorRepos(positional[0], {
        page: flags.page ? parseInt(flags.page as string) : undefined,
        size: flags.size ? parseInt(flags.size as string) : undefined,
        format,
      });
      break;

    // 导出
    case 'export':
      if (positional[0] === 'md') {
        printInfo('正在导出 Markdown...');
        const blob = await (await import('./api.js')).api.exportMarkdown({
          keyword: flags.keyword as string,
          language: flags.language as string,
          sortBy: flags['sort-by'] as string,
          sortOrder: flags['sort-order'] as string,
          maxCount: flags['max-count'] ? parseInt(flags['max-count'] as string) : undefined,
        });
        const filename = `stars_export_${new Date().toISOString().slice(0, 10)}.md`;
        const buffer = Buffer.from(await blob.arrayBuffer());
        const fs = await import('node:fs');
        fs.writeFileSync(filename, buffer);
        printSuccess(`已导出到 ${filename}`);
      } else {
        console.error(`❌ 未知导出命令: ${positional[0]}`);
        console.log('支持: export md');
        process.exit(1);
      }
      break;

    default:
      console.error(`❌ 未知命令: ${command}`);
      console.log('使用 --help 查看可用命令');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ 执行失败:', err.message);
  process.exit(1);
});
