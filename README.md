# GitHub Stars

GitHub Stars 管理系统 — 对自己 Star 过的 GitHub 仓库进行**管理、分类、翻译、统计、AI 分析**和**批量克隆**。

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Ant_Design-6-0170FE?logo=antdesign" alt="Ant Design" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql" alt="MySQL" />
  <img src="https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo" alt="Turborepo" />
</p>

---

## 功能

| 模块 | 描述 |
|------|------|
| 🔍 **Stars 浏览** | 分页浏览所有 Star 仓库，支持多维度筛选（语言、分类、标签、所有者） |
| 📂 **分类管理** | 树形分类系统，支持拖拽排序、批量归类、AI 智能分类 |
| 🏷️ **标签系统** | 多维标签面板，支持分组嵌套、关联维度下钻、AI 自动打标 |
| 🔄 **数据同步** | 全量拉取 GitHub Stars → 本地对比 → 增量 upsert，完整同步日志 |
| 🌐 **AI 翻译** | DeepSeek AI 批量翻译仓库描述和 README（中译），并发控制 + 失败重试 |
| 📊 **统计分析** | 语言分布、所有者排行、时间线趋势、Top Starred 仓库 |
| 🤖 **AI 分析** | AI 驱动的仓库深度分析报告，持久化存储可回溯 |
| 📋 **批量克隆** | 筛选仓库后批量 git clone，并发控制 + 进度追踪 + 失败重试 |
| 👤 **作者中心** | 按仓库所有者聚合浏览，支持导出作者旗下 Star 列表 |
| 📈 **Trending** | GitHub Trending 仓库抓取与分析 |
| 📝 **Markdown 导出** | 将 Star 列表导出为 Markdown 文件 |
| ⚙️ **系统配置** | KV 配置管理，运行时动态调整系统参数 |

## 技术栈

```
前端: React 19 + Vite 8 + Ant Design 6 + Tailwind CSS 4
后端: NestJS 11 + Prisma ORM + MySQL 8
共享: TypeScript 共享类型包 (@githubstars/shared)
构建: Turborepo + npm workspaces (Monorepo)
```

## 项目结构

```
githubstars/
├── package.json                 # 根 workspaces + 统一脚本
├── turbo.json                   # Turborepo 任务编排
├── tsconfig.base.json           # 共享 TS 配置
├── packages/
│   ├── backend/                 # NestJS 后端 (@githubstars/backend)
│   │   ├── prisma/schema.prisma # 数据模型（9 张表）
│   │   └── src/
│   │       ├── sync/            # Star 数据同步
│   │       ├── category/        # 分类管理
│   │       ├── translate/       # AI 翻译
│   │       ├── ai/              # AI 分析与分类
│   │       ├── clone/           # 批量克隆
│   │       ├── stats/           # 统计分析
│   │       ├── tag/             # 标签管理
│   │       ├── author/          # 作者中心
│   │       ├── trending/        # GitHub Trending
│   │       ├── export/          # Markdown 导出
│   │       ├── config/          # 系统配置
│   │       └── github/          # GitHub API 交互
│   ├── frontend/                # React SPA (@githubstars/frontend)
│   │   └── src/
│   │       ├── pages/           # 页面组件
│   │       ├── components/      # 共享组件
│   │       ├── api/             # Axios API 层
│   │       └── types/           # 类型定义
│   └── shared/                  # 共享类型库 (@githubstars/shared)
│       └── src/types/           # API 响应、分页、实体类型
```

## 快速开始

### 环境要求

- **Node.js** ≥ 22
- **MySQL** 8.x（运行在 `127.0.0.1:3307`）
- **npm** ≥ 10

### 1. 克隆项目

```bash
git clone https://github.com/wanzicong/githubstars.git
cd githubstars
```

### 2. 配置环境变量

编辑 `packages/backend/.env`：

```env
DATABASE_URL="mysql://root:123456@127.0.0.1:3307/githubstars?charset=utf8mb4"
PORT=10002
```

### 3. 安装依赖

```bash
npm install
```

安装后会自动执行 `prisma generate` 生成 Prisma Client。

### 4. 初始化数据库

```bash
npm run prisma:generate
```

### 5. 一键启动

```bash
npm run dev
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:10001 |
| 后端 | http://localhost:10002 |
| Swagger 文档 | http://localhost:10002/api/docs |

## 常用命令

### 根目录（Monorepo）

| 命令 | 说明 |
|------|------|
| `npm run dev` | 一键并行启动前后端 |
| `npm run build` | 构建所有子包 |
| `npm run lint` | 全量 ESLint 检查 |
| `npm run typecheck` | 全量 TypeScript 类型检查 |
| `npm run test` | 运行所有测试 |

### 后端

| 命令 | 说明 |
|------|------|
| `npm run dev -w @githubstars/backend` | 启动后端开发服务器 |
| `npm run build -w @githubstars/backend` | 编译后端 |
| `npm run prisma:generate -w @githubstars/backend` | 生成 Prisma Client |
| `npm run prisma:studio -w @githubstars/backend` | 打开 Prisma 数据浏览器 |

### 前端

| 命令 | 说明 |
|------|------|
| `npm run dev -w @githubstars/frontend` | 启动前端开发服务器 |
| `npm run build -w @githubstars/frontend` | 生产构建 |
| `npm run preview -w @githubstars/frontend` | 预览生产构建 |

## 数据模型

| 表 | 说明 |
|---|------|
| `github_repo` | 星标仓库主表 |
| `category` | 分类（树形，parent_id 自引用） |
| `repo_category` | 仓库-分类关联表 |
| `sync_log` | 同步操作日志 |
| `system_config` | KV 配置表 |
| `clone_task` / `clone_task_item` | 克隆任务及子项 |
| `translation_task` / `translation_task_item` | 翻译任务及子项 |
| `ai_analyze_task` | AI 分析任务结果 |

## 架构说明

```
浏览器 (:10001)  ──Vite 代理──▶  NestJS (:10002)  ──Prisma──▶  MySQL (:3307)
```

- **PrismaModule 全局模块**：任意 Service 直接注入 `PrismaService` 访问数据库
- **BigInt 序列化**：全局 `BigIntInterceptor` 自动将 BigInt ID 转为 Number（HTTP 响应）
- **配置管理**：`ConfigService` 启动时加载 `system_config` 表到内存缓存
- **并发控制**：翻译/克隆模块使用自定义信号量限制并发，Prisma 原子计数器防竞态
- **AI 持久化**：分析结果存储于 `ai_analyze_task` 表，不依赖进程内存

## License

MIT
