#!/usr/bin/env node

/**
 * GitHub Stars CLI — 一键启动/停止前后端服务。
 *
 * 用法：
 *   githubstars             启动前端 + 后端（默认）
 *   githubstars stop         停止所有服务
 *   githubstars status       查看服务运行状态
 *   githubstars backend      仅启动后端
 *   githubstars frontend     仅启动前端
 *   githubstars build        构建所有子包
 *   githubstars --help       查看帮助
 *
 * @callers 终端用户全局命令
 *
 * @depends
 *   - concurrently — 并行进程管理
 *   - packages/backend — NestJS 后端
 *   - packages/frontend — Vite 前端
 */

import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 定位项目根目录（npm install -g 时在全局 node_modules 中）
function findProjectRoot() {
  // 优先从环境变量读取
  if (process.env.GITHUBSTARS_HOME) {
    return process.env.GITHUBSTARS_HOME;
  }

  // npm link / 本地安装: cli 包在 packages/cli 下
  let dir = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(dir, 'packages', 'backend', 'package.json'))) {
    return dir;
  }

  // 全局安装: 从全局 node_modules 中查找
  dir = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(path.join(dir, 'packages', 'backend', 'package.json'))) {
    return dir;
  }

  // 当前工作目录
  if (fs.existsSync(path.join(process.cwd(), 'packages', 'backend', 'package.json'))) {
    return process.cwd();
  }

  console.error('❌ 找不到项目目录。请设置 GITHUBSTARS_HOME 环境变量或在项目根目录执行。');
  process.exit(1);
}

const ROOT = findProjectRoot();

function showHelp() {
  console.log(`
GitHub Stars — GitHub 星标仓库管理系统

用法:
  githubstars              一键启动前端 (:5173) + 后端 (:3000)
  githubstars stop          停止所有服务
  githubstars status        查看服务运行状态
  githubstars backend       仅启动后端
  githubstars frontend      仅启动前端
  githubstars build         构建所有子包
  githubstars --help        显示帮助
  githubstars --version     显示版本

快速链接:
  前端:  http://localhost:5173
  后端:  http://localhost:3000
  Swagger: http://localhost:3000/api/docs
`);
}

function showVersion() {
  const pkgPath = path.join(ROOT, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    console.log(`githubstars v${pkg.version || '0.0.1'}`);
  } else {
    console.log('githubstars v0.0.1');
  }
}

const PORTS = [
  { name: '前端 (Vite)', port: 5173 },
  { name: '后端 (NestJS)', port: 3000 },
];

/** 查找占用指定端口的 PID */
function findPid(port) {
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

/** 杀死指定 PID 的进程 */
function killPid(pid) {
  return new Promise((resolve) => {
    if (os.platform() === 'win32') {
      const child = spawn('taskkill', ['/PID', String(pid), '/F'], {
        stdio: 'pipe',
      });
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    } else {
      try {
        process.kill(pid, 'SIGTERM');
        // 给进程一点时间退出，然后检查
        setTimeout(() => {
          try {
            process.kill(pid, 0); // 检查进程是否存在
            resolve(false);       // 还在 → 失败
          } catch {
            resolve(true);        // 已退出 → 成功
          }
        }, 500);
      } catch {
        resolve(false);
      }
    }
  });
}

/** 停止服务 */
async function stop() {
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

/** 查看状态 */
function status() {
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
  console.log('  前端:  http://localhost:5173');
  console.log('  后端:  http://localhost:3000');
  console.log('  Swagger: http://localhost:3000/api/docs');
}

function run(command) {
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

async function main() {
  const arg = process.argv[2];

  if (arg === '--help' || arg === '-h') {
    showHelp();
    return;
  }

  if (arg === '--version' || arg === '-v') {
    showVersion();
    return;
  }

  if (arg === 'stop') {
    stop();
    return;
  }

  if (arg === 'status') {
    status();
    return;
  }

  console.log(`🚀 GitHub Stars 启动中... (项目目录: ${ROOT})\n`);

  if (arg === 'backend') {
    await run('npm run dev -w @githubstars/backend');
  } else if (arg === 'frontend') {
    await run('npm run dev -w @githubstars/frontend');
  } else if (arg === 'build') {
    await run('npm run build');
    console.log('✅ 构建完成');
  } else {
    // 默认: 一键启动前后端
    await run('npm run dev');
  }
}

main().catch((err) => {
  console.error('❌ 启动失败:', err.message);
  process.exit(1);
});
