/**
 * 后端打包脚本 —— 在打包桌面应用前执行
 *
 * 1. 编译后端 TypeScript
 * 2. 将编译后的后端代码 + 生产依赖复制到 build/backend-bundle/
 * 3. 复制 node.exe
 *
 * 注意：该脚本在桌面端打包（electron-builder）前运行，不可跳过。
 */

import { execSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MONOREPO_ROOT = resolve(ROOT, '../..')
const BACKEND_SRC = resolve(MONOREPO_ROOT, 'packages/backend')

// 后端 bundle 目录（位于 desktop/build 下，electron-builder 会从这里读取 extraResources）
const BUNDLE_DIR = resolve(ROOT, 'build/backend-bundle')
const SRC_DIST = resolve(BACKEND_SRC, 'dist')
const SRC_PRISMA = resolve(BACKEND_SRC, 'prisma')
const SRC_PACKAGE_JSON = resolve(BACKEND_SRC, 'package.json')

// 目标目录
const BUNDLE_DIST = resolve(BUNDLE_DIR, 'dist')
const BUNDLE_PRISMA = resolve(BUNDLE_DIR, 'prisma')

// ─── Step 1: 编译后端 ───────────────────────────────────────
console.log('[bundle-backend] Step 1: 编译后端...')
execSync('npm run build -w @githubstars/backend', {
  cwd: MONOREPO_ROOT,
  stdio: 'inherit',
})

// ─── Step 2: 创建 bundle 目录 ───────────────────────────────
console.log('[bundle-backend] Step 2: 创建 bundle 目录...')
if (existsSync(BUNDLE_DIR)) {
  rmSync(BUNDLE_DIR, { recursive: true, force: true })
}
mkdirSync(BUNDLE_DIR, { recursive: true })

// ─── Step 3: 复制编译产物 ───────────────────────────────────
console.log('[bundle-backend] Step 3: 复制编译产物...')
if (!existsSync(SRC_DIST)) {
  console.error(`错误: 后端编译产物不存在: ${SRC_DIST}`)
  process.exit(1)
}
cpSync(SRC_DIST, BUNDLE_DIST, { recursive: true })

// ─── Step 4: 复制 Prisma schema ─────────────────────────────
console.log('[bundle-backend] Step 4: 复制 Prisma schema...')
if (existsSync(SRC_PRISMA)) {
  cpSync(SRC_PRISMA, BUNDLE_PRISMA, { recursive: true })
}

// ─── Step 5: 创建独立的 package.json ────────────────────────
console.log('[bundle-backend] Step 5: 创建 package.json...')
const backendPkg = JSON.parse(readFileSync(SRC_PACKAGE_JSON, 'utf-8'))

// 保留生产依赖，移除 devDependencies
const prodDeps = backendPkg.dependencies || {}
const standalonePkg = {
  name: '@githubstars/backend-standalone',
  version: backendPkg.version,
  private: true,
  main: 'dist/main.js',
  scripts: {
    start: 'node dist/main.js',
    'prisma:generate': 'prisma generate',
  },
  dependencies: {},
}
// 过滤 workspace 依赖（@githubstars/shared 已编译到 dist 中）
for (const [name, version] of Object.entries(prodDeps)) {
  if (name === '@githubstars/shared') continue
  standalonePkg.dependencies[name] = version
}

writeFileSync(resolve(BUNDLE_DIR, 'package.json'), JSON.stringify(standalonePkg, null, 2))

// ─── Step 6: 安装生产依赖 ───────────────────────────────────
console.log('[bundle-backend] Step 6: 安装生产依赖...')

// 创建 .npmrc 禁用 workspace 模式（因为 bundle 目录在 monorepo 内）
writeFileSync(resolve(BUNDLE_DIR, '.npmrc'), 'workspaces=false\n')

execSync('npm install --production --no-audit --no-fund --legacy-peer-deps 2>&1', {
  cwd: BUNDLE_DIR,
  stdio: 'inherit',
  env: { ...process.env, npm_config_workspaces: 'false' },
})

// ─── Step 7: 复制 Prisma 引擎 ───────────────────────────────
console.log('[bundle-backend] Step 7: 复制 Prisma 引擎...')
const prismaEngines = resolve(BUNDLE_DIR, 'node_modules/@prisma/client')
if (!existsSync(prismaEngines)) {
  console.warn('警告: @prisma/client 未安装，尝试重新生成...')
  execSync('npx prisma generate', { cwd: BUNDLE_DIR, stdio: 'inherit' })
}

// ─── Step 8: 复制 node.exe ──────────────────────────────────
console.log('[bundle-backend] Step 8: 复制 Node.js 可执行文件...')
const NODE_TARGET = resolve(BUNDLE_DIR, 'node.exe')

// 尝试从系统 PATH 复制 node.exe
try {
  const whichNode = execSync('where node', { encoding: 'utf-8' }).trim().split('\n')[0]
  if (whichNode && existsSync(whichNode)) {
    copyFileSync(whichNode, NODE_TARGET)
    console.log(`[bundle-backend] node.exe 已复制: ${whichNode}`)
  } else {
    throw new Error('找不到 node.exe')
  }
} catch {
  console.warn('警告: 无法找到 node.exe，尝试使用 process.execPath...')
  // 兜底：从 Electron 的 Node.js 复制（仅开发环境）
  copyFileSync(process.execPath, NODE_TARGET)
}

// ─── Step 9: 写入后端入口配置 ──────────────────────────────
console.log('[bundle-backend] Step 9: 写入后端环境配置...')
writeFileSync(
  resolve(BUNDLE_DIR, 'backend.env'),
  [
    'PORT=10004',
    'NODE_ENV=production',
    'CORS_ORIGINS=*',
    'LOG_LEVEL=info',
    '# DATABASE_URL 需要在 Electron 启动时动态传入（通过 spawn env）',
    '# 默认使用 MySQL 127.0.0.1:3307/githubstars',
    '# 用户可在应用设置中修改',
  ].join('\n'),
)

// ─── 完成 ────────────────────────────────────────────────────
console.log(`[bundle-backend] ✅ 后端打包完成: ${BUNDLE_DIR}`)
