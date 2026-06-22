# 后端函数模块化质量优化计划

## Task 1: 提取共享工具函数（消除重复代码）

**新建文件 `src/common/utils/query-params.util.ts`：**
- 提取 `SORT_MAP` 常量（当前在 `github-repo.service.ts` L5-L12 定义，`author.service.ts` L68-L81 和 L103-L114 各有一份嵌套三元重复）
- 提取 `resolveSortField(sortBy)` 和 `resolveSortDir(sortOrder)` 函数，替代散落的排序映射逻辑
- 提取 `parseLanguages(language)` 函数，替代 `github-repo.service.ts` 中 4 处重复的 `params.language ? params.language.split(',').filter(Boolean) : []`

**新建文件 `src/common/utils/pagination.util.ts`：**
- 提取 `buildPaginationResult(records, total, page, size)` 函数，统一 `{ records, total, size, current, pages }` 构建逻辑（当前在 `github-repo.service.ts` L144、`author.service.ts` L38-L51、L84-L88、`sync.service.ts` L166 各有重复）

**新建文件 `src/common/dto/id-param.dto.ts`（如不存在）：**
- 定义 `IdParamSchema = z.object({ id: z.coerce.number().int().positive() })`
- 替代 `translate.controller.ts` 中 7 处重复的 `if (!body.id || body.id <= 0)` 手动校验

---

## Task 2: 定义强类型接口（消除 `any` 和内联类型）

**新建文件 `src/github/interfaces/repo-data.interface.ts`：**
- 从 `github-api.service.ts` 的 `MappedRepoData` 导出共享接口
- 新增 `UpsertRepoInput` 接口，替代 `github-repo.service.ts` L226 的 `upsertRepo(data: any)`

**修改文件 `src/translate/services/translate-task.service.ts`：**
- L80 `processItem(item: any)` 改为 Prisma 生成的类型 `TranslationTaskItem`
- L300/L345/L396/L479 中 `repos.map((r: any) => ...)` 使用 Prisma select 返回的推断类型

**修改文件 `src/github/services/github-repo.service.ts`：**
- L106-L117、L170-L179、L207、L270-L277 四处内联 params 类型提取为共享接口：
  ```typescript
  // 在 src/common/interfaces/filter-params.interface.ts 中定义
  interface BaseFilterParams { keyword?: string; language?: string; sortBy?: string; sortOrder?: string }
  interface DateRangeParams { dateField?: string; startDate?: string; endDate?: string }
  interface FilterParams extends BaseFilterParams, DateRangeParams { untranslatedOnly?: boolean }
  interface PaginatedFilterParams extends FilterParams { page?: number; size?: number }
  ```

---

## Task 3: 拆分超长方法 -- `github-api.service.ts`

**修改文件 `src/github/services/github-api.service.ts`：**

(a) 拆分 `fetchAllStarredRepos`（~140 行）为：
- `fetchStarredPage(url, token, currentPage)` -- 单页请求+解析（约 40 行）
- `deduplicateRepos(repos)` -- 去重逻辑（约 10 行）
- `fetchAllStarredRepos` 主方法简化为调用循环（约 30 行）

(b) 拆分 `fetchReadmeFromGitHub`（~125 行）为：
- `handleReadme403(fullName, token, result)` -- 403 状态码处理逻辑（约 35 行）
- `buildGithubHeaders(token)` -- 提取公共 header 构建（约 10 行），同时复用给 `fetchReadmeAsJson`
- `fetchReadmeFromGitHub` 主方法简化为请求+状态码分发（约 40 行）

---

## Task 4: 拆分超长方法 -- 其他 Service

**修改文件 `src/translate/services/translate.service.ts`：**
- 拆分 `translateReadme`（~63 行）：
  - `tryTranslateFromExistingReadme(repo, repoId)` -- 已有原文时重试翻译
  - `fetchAndTranslateReadme(repo, repoId)` -- 首次获取+翻译
  - `translateReadme` 主方法变为路由分发（~20 行）

**修改文件 `src/sync/sync.service.ts`：**
- 拆分 `doSync`（~73 行）：
  - `buildRemoteMap(remoteRepos)` -- 构建远端 Map（~8 行）
  - `syncRemoteToLocal(remoteMap, localMap)` -- upsert 逻辑（~10 行）
  - `deleteUnstarredRepos(remoteMap, localMap)` -- REPLACE 模式删除（~12 行）

**修改文件 `src/translate/services/translate-task.service.ts`：**
- 拆分 `processItem`（~78 行）：
  - `executeTranslationAttempt(item)` -- 单次翻译尝试（~25 行）
  - `calculateRetryDelay(resultNote, attempts)` -- 重试延迟计算（~10 行）
  - `recordItemResult(item, success, attempts, resultNote)` -- 记录成功/失败结果（~20 行）
- 提取 `createTaskWithItems(items, descCount, readmeCount)` 模板方法，消除 5 处重复的 "创建 Task -> createMany Items -> startTaskAsync" 模式（L246-L262、L289-L312、L323-L367、L378-L408、L466-L491）

---

## Task 5: 模块职责分离 -- Controller 业务逻辑提取

**新建文件 `src/export/export.service.ts`：**
- 从 `export.controller.ts` L43-L65 提取 `generateMarkdown(repos, filters)` 方法
- Controller 仅负责调用 Service 和设置响应头

**新建文件 `src/translate/services/sse-manager.service.ts`：**
- 从 `translate.controller.ts` 顶部提取 SSE 流管理逻辑（`sseStreams` Map、`broadcastTaskProgress`）
- `taskStream` 端点中的轮询+清理逻辑封装为 `startSseStream(taskId, res)`

**修改文件 `src/translate/controllers/translate.controller.ts`：**
- 应用 `IdParamSchema` + `ZodValidationPipe` 替代 7 处手动 ID 校验
- 注入 `SseManagerService` 替代模块级变量
- 旧兼容接口（L241-L344，共 5 个端点）拆到 `src/translate/controllers/translate-legacy.controller.ts`

---

## Task 6: 函数命名统一化

| 文件 | 当前名称 | 修改为 | 原因 |
|------|---------|--------|------|
| `author.service.ts` L21 | `getAuthorPage` | `findAuthorPage` | 与 `GithubRepoService.findPage` 统一 |
| `author.service.ts` L66 | `getAuthorRepos` | `findAuthorRepos` | 同上 |
| `author.service.ts` L101 | `getAuthorAllRepoUrls` | `findAllAuthorRepoUrls` | 同上 |
| `translate-task.service.ts` L55 | `cleanOld` | `cleanOldTasks` | 缺少名词对象 |
| `github-api.service.ts` L588 | `delay` | `sleep` | 更标准的工具函数命名 |
| `sync.service.ts` L28 | `doSync` | `executeSync` | `do` 前缀模糊 |

**注意：** `author.service.ts` 方法重命名后需同步更新 `author.controller.ts` 中的调用。

---

## Task 7: 嵌套层级优化与错误处理统一

**嵌套优化（目标：不超过 4 层）：**
- `github-api.service.ts` `handleReadme403` 中的 403 分支：用 early return 替代深层嵌套
- `translate-task.service.ts` `processItem` 中的 while > try > if/else：拆为子方法后自然降低
- `sync.service.ts` `doSync` 中的 try > if(replace) > if(missingFullNames.length)：提取子方法

**错误处理统一：**
- 为 `author.service.ts` 和 `stats.service.ts` 的 `$queryRaw` 调用添加 try-catch，捕获数据库异常并记录 `this.logger.error`
- 统一 Service 层错误模式：可恢复错误返回 null/默认值+日志，不可恢复错误 throw+日志

---

## Task 8: `author.service.ts` 排序逻辑重构

**修改文件 `src/author/author.service.ts`：**
- L68-L81 和 L103-L114 的嵌套三元表达式替换为 `resolveSortField(sortBy)` 调用（来自 Task 1 的工具函数）
- L32-L36 的超长 SQL 提取为命名常量 `AUTHOR_LIST_QUERY` 和 `AUTHOR_COUNT_QUERY`，提升可读性
- `getAuthorPage` / `getAuthorRepos` / `getAuthorAllRepoUrls` 使用对象参数替代散列参数

---

## Task 9: 编译验证

- 运行 `npx prisma generate` 确保 Prisma Client 更新
- 运行 `npx tsc --noEmit --project packages/backend/tsconfig.build.json` 确保零类型错误
- 运行 `npm run build -w @githubstars/backend` 确保 nest build 通过

---

## 执行顺序

Task 1-2 创建共享基础设施（工具函数+接口类型） -> Task 3-4 拆分超长方法 -> Task 5 模块分离 -> Task 6 命名统一 -> Task 7 嵌套和错误处理 -> Task 8 author 重构 -> Task 9 编译验证
