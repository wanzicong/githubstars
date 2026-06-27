# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

GitHub Stars 管理系统 — 用户对自己 Star 过的 GitHub 仓库进行管理、分类、翻译、统计、AI 分析和批量克隆。

**技术栈：**
- 后端：[NestJS 11](packages/backend/) + Prisma ORM + MySQL
- 前端：[React 19](packages/frontend/) + Vite 8 + Ant Design 6 + Tailwind CSS 4
- 共享库：[packages/shared/](packages/shared/) — 前后端共享 TypeScript 类型

## 复盘记录（2026-06-27）

### 本次修复的典型问题

| 问题类型 | 数量 | 根因 | 修复方式 |
|---------|------|------|---------|
| 未使用的 Logger/导入/变量 | 12 处 | 编码后未清理，Lint 未强制执行 | 删除无用声明 |
| 嵌套三元表达式（S3358） | 28 处 | 贪图一行写完，可读性差 | 拆分为 if-else 或 IIFE |
| 死代码（死存储） | 5 处 | 变量赋值后未使用 | 删除赋值/变量 |
| 嵌套模板字面量 | 3 处 | 模板中嵌模板，难维护 | 提取中间变量 |
| Ant Design 废弃 API | 13 处 | 从 v5 升级到 v6 未同步更新 | 改用新版 API |
| `.match()` 应使用 `.exec()` | 3 处 | 对正则方法选择缺乏认知 | 改为 `.exec()` |
| `length >= 0` 恒真 | 3 处 | 数组长度永远 ≥ 0 | 改为 `> 0` |

### 根因总结

1. **SonarJS 集成缺失**：`eslint-plugin-sonarjs` 未安装，大量规则无法检测
2. **Lint 未强制执行**：CLAUDE.md 虽有 lint 要求，但编码后没有"必须运行 `npm run lint` 且零 error"的硬约束
3. **Ant Design 版本敏感度不足**：从 v5 升级到 v6 后，对废弃 API 没有系统清理
4. **测试代码被忽略**：测试文件中的无用导入、死代码、无意义断言长期积累

### 新增约束

### 编码约束（SonarJS 规则强制）

执行代码变更后，必须运行 `npm run lint` 确保以下 sonarjs 规则零 error：

| 规则 ID | 要求 | 禁止写法 | 正确写法 |
|---------|------|---------|---------|
| `no-nested-conditional` | 禁止嵌套三元 | `a ? (b ? 1 : 2) : 3` | 拆分为 if-else 链或 IIFE |
| `no-nested-template-literals` | 禁止模板嵌套 | `` `${a ? `${b}` : ''}` `` | 提取内层模板为变量 |
| `prefer-regexp-exec` | 正则用 exec | `str.match(/pattern/)` | `/pattern/.exec(str)` |
| `unused-import` | 删除未使用导入 | `import { unused } from 'x'` | 删除 |
| `no-unused-vars` | 删除未使用变量 | `const x = ...` （x 未读） | 删除 |
| `no-collection-size-mischeck` | 数组判空用 > 0 | `arr.length >= 0` | `arr.length > 0` |
| `no-ignored-exceptions` | catch 参数必须使用 | `catch (e) {}` | `catch { }` 或使用 e |

**强制流程：**
1. 写完代码后必须运行 `npm run lint && npm run typecheck`
2. 必须零 error 才能说"完成"
3. 如果现有代码报 error，必须修复不能绕过

**项目管理：** Turborepo monorepo（npm workspaces），参考 [OpenCode](https://github.com/anomalyco/opencode) 多项目管理方式。

## 常用命令

### 根目录（monorepo 入口）

```bash
npm install             # 安装所有子包依赖
npm run dev             # 并行启动前后端开发服务器
npm run build           # 构建所有子包
npm run lint            # 对所有子包运行 ESLint
npm run typecheck       # 类型检查所有子包
npm run test            # 运行所有子包测试
npm run prisma:generate # 重新生成 Prisma Client
```

### 后端（`packages/backend/`）

```bash
npm run dev -w @githubstars/backend     # 开发模式（watch 热重载）
npm run start -w @githubstars/backend    # 启动（默认端口 10002，由 .env PORT 控制）
npm run build -w @githubstars/backend    # 编译 TypeScript
npm run lint -w @githubstars/backend     # ESLint 检查并修复
npm run test -w @githubstars/backend     # 运行 Jest 单元测试
npm run prisma:generate -w @githubstars/backend  # 重新生成 Prisma Client
npm run prisma:studio -w @githubstars/backend     # 打开 Prisma 数据浏览器
```

### 前端（`packages/frontend/`）

```bash
npm run dev -w @githubstars/frontend     # 启动 Vite 开发服务器（端口 10001）
npm run build -w @githubstars/frontend   # 生产构建（tsc + vite build）
npm run lint -w @githubstars/frontend    # ESLint 检查
npm run preview -w @githubstars/frontend # 预览生产构建
```

### 数据库

MySQL 运行在 `127.0.0.1:3307`，数据库名 `githubstars`，配置在后端 `.env` 的 `DATABASE_URL` 中。

## 架构

### 项目结构（Monorepo）

```
githubstars/
├── package.json             # 根：workspaces + turbo 统一脚本
├── turbo.json               # Turborepo 任务编排
├── tsconfig.base.json       # 共享 TypeScript 基础配置
├── packages/
│   ├── backend/             # NestJS 后端
│   │   ├── prisma/schema.prisma  # 数据模型定义（9 个表）
│   │   ├── src/
│   │   │   ├── main.ts      # 入口，监听 3000 端口
│   │   │   ├── app.module.ts # 根模块，注册全局 BigIntInterceptor
│   │   │   ├── common/interceptors/bigint.interceptor.ts  # BigInt→Number 序列化
│   │   │   ├── config/      # 系统配置（system_config 表缓存）
│   │   │   ├── github/      # GitHub API 交互 + Stars 列表
│   │   │   ├── sync/        # Star 数据同步（全量拉取→对比→upsert）
│   │   │   ├── category/    # 仓库分类管理（树形结构，多对多关联）
│   │   │   ├── translate/   # DeepSeek AI 翻译（描述/README 中译）
│   │   │   ├── ai/          # AI 分类 + 分析报告
│   │   │   ├── clone/       # 批量 git clone 仓库
│   │   │   ├── stats/       # 统计（语言/所有者/时间线/概览）
│   │   │   ├── author/      # 作者中心
│   │   │   ├── trending/    # GitHub Trending 爬取
│   │   │   └── export/      # Markdown 导出
│   │   └── .env             # 环境变量（DB/GitHub/DeepSeek）
│   ├── frontend/            # React SPA
│   │   ├── vite.config.ts   # Vite 配置 + API 代理到 localhost:10002
│   │   └── src/
│   │       ├── App.tsx      # 路由定义
│   │       ├── api/         # Axios API 调用层
│   │       ├── pages/       # 页面组件
│   │       ├── components/  # 共享组件
│   │       ├── types/       # TypeScript 接口定义
│   │       └── utils/       # 工具函数
│   └── shared/              # 前后端共享类型与工具
│       └── src/types/       # API 响应类型、分页、通用实体
```

### 请求流

```
浏览器 (:10001)
    │  Vite 代理转发 /api/* → :10002
    ▼
NestJS (:10002)
    │  Prisma Client
    ▼
MySQL (:3307)  githubstars 库
```

### 核心设计

**PrismaModule 是全局模块**（`@Global()`），任何 Service 直接注入 `PrismaService` 即可访问数据库，无需在自己 Module 的 imports 中显式引入。

**BigInt 序列化**：Prisma 的 BigInt ID 通过全局 `BigIntInterceptor` 在 HTTP 响应时递归转为 Number，不得使用 `BigInt.prototype.toJSON` 猴子补丁。

**配置管理**：`ConfigService` 在 `onModuleInit` 时将 `system_config` 表全量加载到内存 `Map` 缓存，提供 `getValue()`/`getValueDefault()` 方法。写入时同步更新数据库和缓存。

**翻译/克隆并发控制**：`TranslateTaskService` 和 `CloneService` 使用自定义信号量（`acquire`/`release`）限制并发数。`TranslateTaskService.processItem` 使用 Prisma `increment` 做原子计数器更新，避免竞态。

**AI 分析持久化**：`AiAnalyzeService` 的任务状态和结果存储在 `ai_analyze_task` 表中，不依赖进程内存。应用重启后通过查询 `taskId` 仍可获取历史分析结果。

**前端 API 调用**：所有 API 请求通过 [request.ts](packages/frontend/src/api/request.ts) 的 Axios 实例（baseURL `/`，5 分钟超时），Vite 代理统一转发到后端。前端路由不使用 `/api` 前缀，代理层自动拼接。

### 数据模型（Prisma Schema）

核心表：[schema.prisma](packages/backend/prisma/schema.prisma)

| 表 | 用途 | 关键关系 |
|---|------|---------|
| `github_repo` | 星标仓库主表 | `full_name` 唯一索引 |
| `category` | 分类（树形，`parent_id` 自引用） | 通过 `repo_category` 多对多关联仓库 |
| `repo_category` | 仓库-分类关联表 | 级联删除 |
| `sync_log` | 同步操作日志 | |
| `system_config` | KV 配置表 | `config_key` 唯一 |
| `clone_task` / `clone_task_item` | 克隆任务/子项 | `task_id`（UUID 格式）关联 |
| `translation_task` / `translation_task_item` | 翻译任务/子项 | 关联 `github_repo` |
| `ai_analyze_task` | AI 分析任务结果 | |
