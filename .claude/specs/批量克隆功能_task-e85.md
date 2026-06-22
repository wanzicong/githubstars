# 批量克隆功能实施方案

## Context

用户需要从 StarList 页面筛选仓库后批量克隆到本地。当前系统已有翻译任务的主从表模式（TranslationTask + TranslationTaskItem）可复用。核心需求：前端通过步骤向导创建克隆任务，后台定时任务负责执行。新增独立的克隆管理页面。

---

## 1. 数据库设计

### clone_task（主任务表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BigInt PK | 自增主键 |
| status | VARCHAR(50) | PENDING / PROCESSING / COMPLETED / FAILED / PARTIAL |
| target_dir | VARCHAR(1000) | 克隆目标根目录 |
| concurrency | INT | 并发数（5/10/20） |
| total_items | INT | 总仓库数 |
| completed_items | INT | 成功数 |
| failed_items | INT | 失败数 |
| skipped_items | INT | 目录已存在跳过数 |
| created_at | DATETIME | 创建时间 |
| started_at | DATETIME | 开始执行时间 |
| finished_at | DATETIME | 完成时间 |

### clone_task_item（任务明细表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BigInt PK | 自增主键 |
| task_id | BigInt FK | 关联 clone_task.id |
| repo_id | BigInt FK | 关联 github_repo.id |
| full_name | VARCHAR(500) | 仓库全名（冗余） |
| clone_url | VARCHAR(1000) | 克隆地址 |
| local_path | VARCHAR(1000) | 本地克隆路径 |
| status | VARCHAR(50) | PENDING / PROCESSING / COMPLETED / FAILED / SKIPPED |
| retry_count | INT | 重试次数 |
| error_message | TEXT | 错误信息 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**路径规则**：`{targetDir}/{ownerName}/{repoName}`，避免同名冲突。

---

## 2. 后端设计

### 2.1 文件结构

```
packages/backend/src/clone/
├── clone.module.ts         # 模块定义
├── clone.service.ts        # 核心服务
├── clone.controller.ts     # API 接口
├── clone.scheduler.ts      # @Cron 定时任务调度
├── clone.constants.ts      # 常量
└── clone.dto.ts            # Zod 验证
```

### 2.2 克隆技术选型

**选择：`child_process.execFile` 调用系统 git**

| 方案 | 结论 | 理由 |
|------|------|------|
| child_process + git CLI | **推荐** | 零依赖；支持 SSH/credential helper；shallow clone 性能最优 |
| simple-git | 可选 | 封装层，本质仍是 git CLI |
| isomorphic-git | 不推荐 | 纯 JS 性能差；不支持 SSH |

克隆命令：`git clone --depth 1 {cloneUrl} {localPath}`，单个超时 5 分钟。
认证：有 token 时使用 `https://x-access-token:{token}@github.com/{owner}/{repo}.git`。

### 2.3 任务执行机制

**定时任务调度（@Cron），每秒检查**：

```
clone.scheduler.ts:
  @Cron('*/1 * * * * *')  // 每 1 秒检查
  async tick() {
    if (this.running) return  // 任务级锁，同时只执行一个任务
    const task = await this.findNextPendingTask()
    if (task) await this.executeTask(task.id)
  }
```

**信号量并发控制**（参照 translate-task.service.ts）：
- 用户选定并发数（5/10/20），任务级别动态设置
- acquire/release 模式控制同时克隆数

### 2.4 CloneService 核心方法

| 方法 | 职责 |
|------|------|
| `createTask(repoIds, targetDir, concurrency)` | 创建主任务+明细，状态=PENDING |
| `findNextPendingTask()` | 查询最早的 PENDING 任务 |
| `executeTask(taskId)` | 更新状态→PROCESSING，并发执行所有 item |
| `cloneSingleRepo(item)` | acquire → git clone → release → 更新状态 |
| `recordItemResult(item, success, ...)` | 原子更新 item + 父任务计数器 |
| `finishTask(taskId)` | 判断终态（COMPLETED/FAILED/PARTIAL） |
| `getTaskProgress(taskId)` | 查询任务进度 |
| `retryFailed(taskId)` | 重试失败项（重置状态为 PENDING） |
| `getRecentTasks()` | 最近任务列表 |

### 2.5 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/clone` | 创建克隆任务 |
| POST | `/api/clone/tasks/list` | 最近任务列表 |
| POST | `/api/clone/tasks/detail` | 任务进度查询 |
| POST | `/api/clone/tasks/retry` | 重试失败项 |

---

## 3. 前端设计

### 3.1 文件结构

```
packages/frontend/src/
├── api/clone.ts                    # API 函数
├── components/clone/
│   ├── CloneWizardModal.tsx       # 步骤向导 Modal
│   └── CloneProgressModal.tsx     # 进度弹窗
└── pages/Clone/
    └── index.tsx                   # 克隆管理页面
```

### 3.2 克隆向导（Steps 向导 Modal）

**Step 1 — 确认仓库**
- Table 展示选中仓库（名称、语言、Star 数）
- 支持取消选择

**Step 2 — 设置参数**
- 目标目录：Input 文本框（用户输入本地绝对路径）
- 并发数量：Radio.Group（5 / 10 / 20）
- 浅克隆：Switch 默认开启

**Step 3 — 确认创建**
- 汇总信息展示
- 确认按钮 → 调用 API → 关闭向导 → 跳转到克隆管理页面

### 3.3 克隆进度 Modal

- Progress 圆环 + 百分比
- 统计 Tag：总数 / 成功 / 失败 / 跳过
- 失败项可展开查看错误
- 重试失败按钮
- 轮询：复用 `usePolling` Hook（2 秒间隔）

### 3.4 StarList 集成

- `StarRepoView` 追加 checkbox 多选支持
- 操作区追加「批量克隆」按钮（显示选中数量）
- 状态：`cloneWizardOpen`
- 创建成功后跳转到克隆管理页面

### 3.5 克隆管理页面（新增）

**路由**：`/clone`

**页面结构**：
```
pages/Clone/
└── index.tsx    # 克隆任务管理页面
```

**功能**：
- 任务列表 Table（状态、仓库数、进度、目标目录、创建时间）
- 点击任务行展开明细（item 列表 + 状态 + 错误信息）
- 进度条实时更新（usePolling 轮询）
- 操作按钮：重试失败项、删除任务
- 顶部统计：总任务数、进行中、已完成

**菜单注册**：在 `router/menu.tsx` 中追加克隆管理菜单项

---

## 4. 实施顺序

### Task 1：数据库迁移
- 修改 `schema.prisma`，新增 CloneTask + CloneTaskItem
- GithubRepo 追加 `cloneItems` 关联
- `prisma migrate dev`

### Task 2：后端 CloneModule
- 创建 `clone/` 目录全部文件
- CloneService 核心逻辑（信号量、git clone、状态管理）
- CloneScheduler 定时任务
- CloneController API
- app.module.ts 注册

### Task 3：前端 API + 组件
- `api/clone.ts` + barrel export
- `CloneWizardModal`（Steps 向导）
- `CloneProgressModal`（进度展示）
- types / constants 追加

### Task 4：StarList 集成 + 克隆管理页面
- StarRepoView 追加多选
- StarList 页面集成向导
- 新增 `pages/Clone/index.tsx` 克隆管理页面
- 路由 + 菜单注册
- 轮询逻辑

### Task 5：验证
- 启动前后端，创建克隆任务
- 验证定时任务调度执行
- 验证进度轮询和状态更新
- 验证失败重试

---

## 5. 关键文件清单

**修改：**
- `packages/backend/prisma/schema.prisma` — 新增模型
- `packages/backend/src/app.module.ts` — 注册 CloneModule
- `packages/frontend/src/api/index.ts` — barrel export
- `packages/frontend/src/types/index.ts` — 新增类型
- `packages/frontend/src/constants/index.ts` — 新增常量
- `packages/frontend/src/pages/StarList/index.tsx` — 集成入口
- `packages/frontend/src/components/stars/StarRepoView.tsx` — 多选支持
- `packages/frontend/src/router/routes.tsx` — 新增路由
- `packages/frontend/src/router/menu.tsx` — 新增菜单项

**新增：**
- `packages/backend/src/clone/*` — 后端克隆模块（6 个文件）
- `packages/frontend/src/api/clone.ts` — API 函数
- `packages/frontend/src/components/clone/CloneWizardModal.tsx` — 步骤向导
- `packages/frontend/src/components/clone/CloneProgressModal.tsx` — 进度弹窗
- `packages/frontend/src/pages/Clone/index.tsx` — 克隆管理页面