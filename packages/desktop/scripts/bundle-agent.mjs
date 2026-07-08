/**
 * Agent 服务打包脚本 —— 在打包桌面应用前执行
 *
 * 流程：
 * 1. 校验 Agent TypeScript 编译产物存在
 * 2. 创建 bundle 目录，复制编译产物
 * 3. 创建独立 package.json 并安装生产依赖
 * 4. 复用 backend 的 SQLite schema 生成 Prisma Client（Agent 与 Backend 共享同一个 SQLite 库）
 * 5. 写入环境配置
 *
 * 注意：该脚本在 electron-builder 的 prepackage 钩子中，紧随 bundle-backend 之后运行。
 * Agent 的 agent_sessions / agent_messages 两张表已包含在 backend 的 schema.sqlite.prisma 中，
 * 因此 Agent 直接连接 Electron 动态设置的同一个 githubstars.db 即可，无需独立迁移。
 */

import { execSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const MONOREPO_ROOT = resolve(ROOT, "../..")
const AGENT_SRC = resolve(MONOREPO_ROOT, "packages/github-agent")
const BACKEND_SRC = resolve(MONOREPO_ROOT, "packages/backend")

const BUNDLE_DIR = resolve(ROOT, "build/agent-bundle")
const SRC_DIST = resolve(AGENT_SRC, "dist")
const SRC_PACKAGE_JSON = resolve(AGENT_SRC, "package.json")
const BACKEND_SQLITE_SCHEMA = resolve(BACKEND_SRC, "prisma", "schema.sqlite.prisma")

// ———— Step 1: 校验编译产物 ———————————————————————————————————————
console.log("[bundle-agent] Step 1: 校验 Agent 编译产物...")
if (!existsSync(SRC_DIST)) {
  console.error(`错误: Agent 编译产物不存在 ${SRC_DIST}，请先运行 npm run build -w @githubstars/github-agent`)
  process.exit(1)
}

// ———— Step 2: 创建 bundle 目录 ———————————————————————————————————————
console.log("[bundle-agent] Step 2: 创建 bundle 目录...")
if (!existsSync(BUNDLE_DIR)) {
  mkdirSync(BUNDLE_DIR, { recursive: true })
}

// ———— Step 3: 复制编译产物 ———————————————————————————————————————
console.log("[bundle-agent] Step 3: 复制编译产物...")
cpSync(SRC_DIST, resolve(BUNDLE_DIR, "dist"), { recursive: true, force: true })

// ———— Step 4: 创建独立 package.json ———————————————————————————————————————
console.log("[bundle-agent] Step 4: 创建 package.json...")
const agentPkg = JSON.parse(readFileSync(SRC_PACKAGE_JSON, "utf-8"))
const prodDeps = agentPkg.dependencies || {}
const standalonePkg = {
  name: "@githubstars/github-agent-standalone",
  version: agentPkg.version,
  private: true,
  type: "module",
  main: "dist/index.js",
  scripts: {
    start: "node dist/index.js",
  },
  dependencies: {},
}
for (const [name, version] of Object.entries(prodDeps)) {
  if (name === "@githubstars/shared") continue
  standalonePkg.dependencies[name] = version
}
// prisma CLI 是 devDependency，但 bundle 阶段需要它来生成 SQLite Client
standalonePkg.dependencies.prisma = agentPkg.devDependencies?.prisma ?? "^6.19.3"
writeFileSync(resolve(BUNDLE_DIR, "package.json"), JSON.stringify(standalonePkg, null, 2))

// ———— Step 5: 安装生产依赖 ———————————————————————————————————————
console.log("[bundle-agent] Step 5: 安装生产依赖...")
writeFileSync(resolve(BUNDLE_DIR, ".npmrc"), "workspaces=false\n")

const nodeModulesExists = existsSync(resolve(BUNDLE_DIR, "node_modules"))
if (nodeModulesExists) {
  console.log("[bundle-agent] node_modules already exists, skipping npm install...")
} else {
  execSync("npm install --production --no-audit --no-fund --legacy-peer-deps 2>&1", {
    cwd: BUNDLE_DIR,
    stdio: "inherit",
    env: { ...process.env, npm_config_workspaces: "false" },
  })
}

// ———— Step 6: 复用 backend 的 SQLite schema 生成 Prisma Client ————————————
console.log("[bundle-agent] Step 6: 生成 SQLite Prisma Client...")
if (!existsSync(BACKEND_SQLITE_SCHEMA)) {
  console.error(`错误: backend SQLite schema 不存在 ${BACKEND_SQLITE_SCHEMA}`)
  process.exit(1)
}

const prismaDir = resolve(BUNDLE_DIR, "prisma")
if (!existsSync(prismaDir)) {
  mkdirSync(prismaDir, { recursive: true })
}
// 复用 backend 的 SQLite schema（含 agent_sessions / agent_messages 表定义）
const sqliteContent = readFileSync(BACKEND_SQLITE_SCHEMA, "utf-8")
writeFileSync(resolve(prismaDir, "schema.prisma"), sqliteContent)
console.log("[bundle-agent] backend SQLite schema 已写入 prisma/schema.prisma")

// 始终重新生成：npm install 只提供 @prisma/client 的 stub，
// 必须运行 prisma generate 才能得到真正可用的 SQLite Client（含 agentSession 等模型）。
execSync("npx prisma generate", { cwd: BUNDLE_DIR, stdio: "inherit" })

// ———— Step 7: 写入环境配置 ———————————————————————————————————————
console.log("[bundle-agent] Step 7: 写入 Agent 环境配置...")
writeFileSync(
  resolve(BUNDLE_DIR, "agent.env"),
  [
    "# 桌面端 Agent 服务配置",
    "# AGENT_PORT / DATABASE_URL / GITHUB_TOKEN 由 Electron 主进程动态注入",
    "# ANTHROPIC_* 凭据由 Electron 主进程从系统环境变量透传",
    "",
  ].join("\n"),
)

// ———— 完成 ———————————————————————————————————————————————————————————
console.log(`[bundle-agent] ✓ Agent 打包完成 (SQLite): ${BUNDLE_DIR}`)
