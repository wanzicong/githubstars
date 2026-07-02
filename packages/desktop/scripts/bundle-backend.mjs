/**
 * 后端打包脚本 —— 在打包桌面应用前执行
 *
 * 流程：
 * 1. 编译后端 TypeScript
 * 2. 创建 bundle 目录，复制编译产物 + Prisma schema
 * 3. 安装生产依赖
 * 4. 替换为 SQLite schema 并重新生成 Prisma Client
 * 5. 写入环境配置
 *
 * 注意：该脚本在 electron-builder 的 prepackage 钩子中自动运行。
 */

import { execSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MONOREPO_ROOT = resolve(ROOT, '../..')
const BACKEND_SRC = resolve(MONOREPO_ROOT, 'packages/backend')

const BUNDLE_DIR = resolve(ROOT, 'build/backend-bundle')
const SRC_DIST = resolve(BACKEND_SRC, 'dist')
const SRC_PRISMA = resolve(BACKEND_SRC, 'prisma')
const SRC_PACKAGE_JSON = resolve(BACKEND_SRC, 'package.json')

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
cpSync(SRC_DIST, resolve(BUNDLE_DIR, 'dist'), { recursive: true })

// ─── Step 4: 复制 Prisma schema ─────────────────────────────
console.log('[bundle-backend] Step 4: 复制 Prisma schema...')
cpSync(SRC_PRISMA, resolve(BUNDLE_DIR, 'prisma'), { recursive: true })

// ─── Step 5: 创建独立的 package.json ────────────────────────
console.log('[bundle-backend] Step 5: 创建 package.json...')
const backendPkg = JSON.parse(readFileSync(SRC_PACKAGE_JSON, 'utf-8'))
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
for (const [name, version] of Object.entries(prodDeps)) {
  if (name === '@githubstars/shared') continue
  standalonePkg.dependencies[name] = version
}
writeFileSync(resolve(BUNDLE_DIR, 'package.json'), JSON.stringify(standalonePkg, null, 2))

// ─── Step 6: 安装生产依赖 ───────────────────────────────────
console.log('[bundle-backend] Step 6: 安装生产依赖...')
writeFileSync(resolve(BUNDLE_DIR, '.npmrc'), 'workspaces=false\n')
execSync('npm install --production --no-audit --no-fund --legacy-peer-deps 2>&1', {
  cwd: BUNDLE_DIR,
  stdio: 'inherit',
  env: { ...process.env, npm_config_workspaces: 'false' },
})

// ─── Step 7: 替换为 SQLite schema + 生成 Prisma Client ──────
console.log('[bundle-backend] Step 7: 生成 SQLite Prisma Client...')
const sqliteSchema = resolve(SRC_PRISMA, 'schema.sqlite.prisma')
const targetSchema = resolve(BUNDLE_DIR, 'prisma', 'schema.prisma')

if (!existsSync(sqliteSchema)) {
  console.error(`错误: SQLite schema 不存在: ${sqliteSchema}`)
  process.exit(1)
}

// 用 SQLite schema 替换 MySQL schema
const sqliteContent = readFileSync(sqliteSchema, 'utf-8')
writeFileSync(targetSchema, sqliteContent)
console.log('[bundle-backend] SQLite schema 已写入 prisma/schema.prisma')

// 重新生成 Prisma Client（SQLite 引擎）
execSync('npx prisma generate', { cwd: BUNDLE_DIR, stdio: 'inherit' })

// ─── Step 8: 写入后端启动配置 ──────────────────────────────
console.log('[bundle-backend] Step 8: 写入后端环境配置...')
writeFileSync(
  resolve(BUNDLE_DIR, 'backend.env'),
  [
    '# 桌面端后端服务配置',
    '# DATABASE_URL 由 Electron 动态设置（指向用户数据目录下的 githubstars.db）',
    '',
  ].join('\n'),
)

// ─── 完成 ────────────────────────────────────────────────────
console.log(`[bundle-backend] ✅ 后端打包完成 (SQLite): ${BUNDLE_DIR}`)
