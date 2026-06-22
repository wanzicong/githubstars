# 后端架构全面优化计划

## Task 1: 全局响应拦截器 + 异常过滤器

创建统一的响应包装和异常处理基础设施，消除响应格式不一致问题。

**新建文件：**
- `src/common/interceptors/response.interceptor.ts` — 全局响应拦截器，统一包装为 `{ success: true, data: ..., meta: {...} }` 格式。对已有 `success` 字段的响应透传不包装，对 SSE/文件下载等特殊响应跳过
- `src/common/filters/http-exception.filter.ts` — 全局异常过滤器，统一错误响应为 `{ success: false, message: string, statusCode: number }`

**修改文件：**
- `src/app.module.ts` — 注册 `APP_INTERCEPTOR` (ResponseInterceptor) 和 `APP_FILTER` (HttpExceptionFilter)

## Task 2: 输入验证基础设施

利用已安装的 `zod` 依赖，创建轻量级验证管道。

**安装依赖：**
- `npm install zod-validation-pipe -w @githubstars/backend`（或使用自定义 pipe）

**新建文件：**
- `src/common/pipes/zod-validation.pipe.ts` — 基于 Zod schema 的验证管道，替代手写 `parseInt` 和手动验证
- `src/common/dto/pagination.dto.ts` — 通用分页参数 Zod schema（page, size）
- `src/common/dto/id-param.dto.ts` — 通用 ID 参数 Zod schema（id）
- `src/common/dto/filter.dto.ts` — 通用筛选参数 Zod schema（keyword, language, sortBy, sortOrder, dateField, startDate, endDate, untranslatedOnly）

## Task 3: 翻译计数器竞态修复（关键 Bug）

**修改文件 `src/translate/services/translate-task.service.ts`：**
- `processItem()` 方法中，将 read-then-write 计数器更新改为 Prisma 原子 `increment`：
  ```typescript
  // 替换 lines 143-148 的 read + manual increment
  await this.prisma.translationTask.update({
      where: { id: item.taskId },
      data: { completedItems: { increment: 1 }, descCompleted: { increment: delta } }
  });
  ```
- 同理修复 failedItems 的更新（lines 157-162）
- 信号量 `release()` 中使用 `queueMicrotask` 包裹 waitQueue 回调

## Task 4: ConfigModule 全局化 + 内存缓存

**修改文件 `src/config/config.module.ts`：**
- 添加 `@Global()` 装饰器

**修改文件 `src/config/config.service.ts`：**
- 添加内存 `Map<string, string>` 缓存
- `onModuleInit` 中加载所有配置到缓存
- `getValue` / `getValueDefault` 优先读缓存
- `update` / `batchUpdate` 同步更新缓存和数据库

**修改文件 `src/github/github.module.ts`：**
- 移除 `imports: [ConfigModule]`（已全局化）

**修改文件 `src/translate/translate.module.ts`：**
- 移除 `imports: [... ConfigModule]`

## Task 5: 清理生产代码中的 console.log

**修改文件 `src/github/services/github-api.service.ts`：**
- 将所有 `console.log` / `console.error` 替换为 `this.logger.log` / `this.logger.error`
- 该文件约 603 行，存在大量混用

## Task 6: CORS 配置外部化

**修改文件 `src/main.ts`：**
- CORS origin 从硬编码改为环境变量 `CORS_ORIGINS`（逗号分隔），保留默认值 `http://localhost:5173,http://localhost:5174`

## Task 7: StatsService 性能优化

**修改文件 `src/stats/stats.service.ts`：**
- `getOverviewStats()` 中 `findMany + distinct` 改为 `$queryRaw` 的 `SELECT COUNT(DISTINCT ...)` 或 Prisma `groupBy`，避免全表扫描加载到内存

## Task 8: 哨兵值常量化

**新建文件 `src/common/constants/translate.constants.ts`：**
- 定义 `RATE_LIMITED = '__RATE_LIMITED__'`、`NO_README = '__NO_README__'` 等常量
- 替代 `translate.service.ts` 和 `translate-task.service.ts` 中的字符串魔法值

## Task 9: 消除 Controller 中的 `any` 类型

为所有 Controller 的 `@Body()`