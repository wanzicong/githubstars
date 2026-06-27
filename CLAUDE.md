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

## 第二次复盘（2026-06-27）

### 本次修复的典型问题

| 问题类型 | 数量 | 根因 | 修复方式 |
|---------|------|------|---------|
| 参数被接收但忽略（参数黑洞） | 3 处 | Controller 写了参数签名但未传入底层方法 | 将 type 透传到 Service 层 |
| Controller 循环创建 N 个任务 | 1 处 | 缺乏批量操作抽象，被迫在 Controller 中手写循环 | 抽取 `createBatchTask()` 方法 |
| 调用错误的全量方法 | 1 处 | 相似逻辑复制粘贴忘了替换调用目标 | 改为先查趋势仓库再创建任务 |
| 缺失输入校验 | 3 处 | `star/unstar/starred` 没有用 ZodValidationPipe | 增加空值校验 |
| 查询条件覆盖不全 | 1 处 | `WHERE readmeFetched=false` 漏掉了翻译失败需重试的仓库 | 增加 `OR readmeFetched=true AND readmeCn=null` |
| 导出无上限保护 | 1 处 | 未考虑 maxCount 未被限制时的 OOM 风险 | 增加 1000 条硬上限 |

### 根因总结

1. **Controller 层的参数透传意识不足** — 写了参数签名（`type`），但忘了传到 Service 层方法，导致参数"消失"
2. **缺乏"批量操作"的基建思维** — 遇到批量场景就在 Controller 中 for 循环调单条方法，应优先抽象批量 API
3. **复制粘贴后未审查调用目标** — `analyze` 复制了 `translateTrending` 的模式但没改调用目标
4. **输入校验不统一** — 部分端点用 ZodValidationPipe，部分裸接 Body，缺少统一的校验策略
5. **边界条件认知不完整** — 只考虑了"未获取 README"的场景，没考虑"已获取但翻译失败"的场景
6. **缺少安全兜底** — 导出、分页等场景应始终有上限保护

### 对 AI 助手的新约束

#### P0: 参数透传检查清单（新增）

修改 Controller 时，必须对照以下清单逐条确认：

- [ ] 方法参数列表中的每个字段是否都在方法体中被**实际使用**？
- [ ] 调用 Service/其他方法时，是否传入了 Controller 收到的所有相关参数？
- [ ] 是否存在从 `body` 中解构了但未使用的变量？
- [ ] 分支逻辑（if-else）中每条路径是否都正确处理了参数的不同取值？

**反面案例：**
```typescript
// BAD — type='both' 只翻译了 README，description 被忽略
if (scope === 'selected' && repoIds?.length) {
    if (type === 'description') { /* 翻译描述 */ }
    // 漏掉了 type === 'both' 的分支，走到下面的 readme-only 代码
    for (...) { await createAndStartSingleReadme(rid); }
}

// BAD — type 参数被接收但穿不透到 Service
const taskId = await this.taskService.createAndStartFilterBatch(filters);
// createAndStartFilterBatch 内部硬编码为 'readme'
```

#### P1: 批量操作抽象原则

遇到"对多个元素执行相同操作"时，必须先检查：

- [ ] 是否存在现成的批量方法？优先复用
- [ ] 如果没有批量方法，是否应该在 Service 层抽取一个而非在 Controller 中 for 循环？
- [ ] 批量方法应该**在一个事务/任务中**完成，而不是创建 N 个独立任务

**反面案例：**
```typescript
// BAD — Controller 中循环调用，创建 N 个独立任务
let taskId = null;
for (const rid of repoIds) {
    taskId = await createAndStartSingleReadme(rid);
}
return { taskId }; // 只能返回最后一个

// GOOD — Service 层提供批量抽象
const taskId = await createBatchTask(repoIds, 'readme');
return { taskId }; // 一个任务包含所有子项
```

#### P1: 输入校验全覆盖原则

所有对外暴露的 HTTP 端点必须满足：

- [ ] 有参数校验（ZodValidationPipe 或手动校验）
- [ ] 字符串参数检查空值/空白
- [ ] 数字参数检查范围（>0 等）
- [ ] 数组参数检查长度

#### P2: 查询条件完整性原则

编写 Prisma WHERE/原始 SQL 时：

- [ ] 反向思考："除了我查的这些记录，还有什么类型的数据应该被包含？"
- [ ] 特别是 `NOT` / `false` 条件，思考对应的否定场景是否也需要覆盖

#### P2: 安全兜底原则

- [ ] 导出/下载类 API 必须有 `maxCount` 上限（建议不超过 1000）
- [ ] 分页查询的 `size` 参数必须有上限（建议不超过 10000）
- [ ] 所有接受用户输入的端点必须做 trim + 基本空值检查

## 第三次复盘（2026-06-27）

### 本次修复的典型问题

| 问题类型 | 数量 | 根因 | 修复方式 |
|---------|------|------|---------|
| Cognitive Complexity 超标 | 5 个函数 | 组件/函数长期扩展未拆分，缺乏抽象提取意识 | 提取子组件/辅助方法，每函数降至 ≤15 |
| Nested Ternary（第二轮） | 25+ 处 | 首次修复只修了部分文件，前端大量残留 | 全部拆分为 if-else/IIFE/提取变量 |
| Controller 单函数过重 | 1 处 | createTask 内联 3 种 scope 逻辑，未做早期抽象 | 提取 3 个私有方法 |
| 测试占位无意义断言 | 11 处 | `expect(true).toBe(true)` 留作占位，后续忘了替换 | 替换为有意义的 `toBeDefined` 等断言 |
| `any` 逃逸 | 3 处 | catch 参数/回调参数使用 any 绕过类型检查 | 改为 `unknown` + `instanceof Error` 收窄 |
| 联合类型未提取别名 | 2 处 | 重复出现的内联联合类型 | 提取 `TranslateType` 类型别名 |
| 嵌套函数过深 | 1 处 | setInterval 内嵌 IIFE 再嵌套 setState 回调 | 提取独立 `tick` 函数 |
| ZodObject passthrough 废弃 | 2 处 | `.passthrough()` 与空对象组合被 Zod 标记为废弃 | 移除 `.passthrough()` |
| 测试中公开可写目录 | 10 处 | 测试硬编码 `/tmp/clone` 路径 | 添加 eslint-disable 注释 |

### 根因总结

1. **组件/函数体积失控** — `TranslatePanel.tsx` 447 行，内含 4 个 Card + Table + 多种状态逻辑，无清晰分层抽象。核心原因是 AI 生成时没有"组件最大行数"的硬约束，一次生成过大。
2. **Cognitive Complexity 无感知机制** — 每次修改只关注功能正确，未检查函数的认知复杂度是否飙升。SonarJS 虽已集成但开发过程中无实时反馈。
3. **Nested Ternary 修复不彻底** — 第一轮只修了部分文件，大量前端嵌套三元残留。缺"修复后全量扫描同一规则"的闭环。
4. **测试代码质量欠佳** — 跳过测试留下 `expect(true).toBe(true)` 占位，降低测试信心。根因是"先让测试通过，后面再补"的心态。
5. **类型安全意识不足** — `catch (e: any)` 和 `_: any` 的出现说明类型安全未成为编码默认习惯。
6. **多代理协作缺汇总验证** — 5 个代理各自修复后，首次 lint 仍有遗漏（TranslatePanel cognitive complexity 在首次扫描中被忽略），需要强制多轮验证。

### 新增约束

#### P0: Cognitive Complexity 红线

函数/组件的 Cognitive Complexity **不得超过 15**。违反即阻止：

- [ ] 新增函数的复杂度是否 ≤ 15？
- [ ] 修改已有函数时，复杂度是否增加了？
- [ ] 如果接近 15，是否应该拆分了再改？

**具体拆分模式：**
- React 组件 → 提取子组件（每个组件 ≤ 200 行）
- Service 方法 → 提取私有辅助方法（每个方法 ≤ 30 行）
- Controller 端点 → 按分支提取私有方法（每个分支一个方法）

**反面案例：**
```typescript
// BAD — createTask 函数 17 复杂度，3 个 if 分支内联
async createTask(@Body() body: ...) {
    if (scope === 'selected') {
        // 30 行 selected 逻辑...
        if (type === 'description') { ... }
        const taskId = ...
        if (!taskId) return ...
    }
    if (scope === 'all') {
        // 20 行 all 逻辑...
    }
    // 15 行 filtered 逻辑...
}

// GOOD — 按 scope 提取 3 个方法，每个 ≤ 5 复杂度
async createTask(@Body() body: ...) {
    if (scope === 'selected') return this.handleSelectedScope(repoIds, type);
    if (scope === 'all') return this.handleAllScope(type);
    return this.handleFilteredScope(filters, type);
}
```

#### P0: 禁用 any 逃逸

所有代码**禁止使用 `any`**（测试文件除外）：

- [ ] catch 参数必须使用 `unknown`（`catch (e: any)` → `catch` + 类型收窄）
- [ ] 回调参数必须具体类型（`_: any` → `_: unknown` 或具体类型）
- [ ] 泛型必须约束（禁止 `<T = any>`）

```typescript
// BAD
catch (e: any) { console.error(e.message) }

// GOOD
catch { /* 空 catch 不关心错误 */ }

// BETTER — 需要访问错误信息时
catch (e: unknown) {
    if (e instanceof Error) log.error(e.message);
}
```

#### P1: 单组件/单文件体积红线

- [ ] 组件文件 ≤ 300 行（超过必须拆分子组件）
- [ ] Service 文件 ≤ 400 行（超过必须拆分子服务或提取工具类）
- [ ] Controller 文件 ≤ 250 行（超过必须提取辅助方法到单独文件）

**检查时机：** 写完代码后，运行 `wc -l packages/frontend/src/**/*.tsx` 检查新增/修改的文件行数。

#### P1: 测试代码质量原则

- [ ] 禁止 `expect(true).toBe(true)` 等无意义断言
- [ ] 跳过（skip）的测试必须有 TODO 链接说明何时修复
- [ ] 测试必须至少验证一个具体的行为结果

```typescript
// BAD
it.skip('需要网络，跳过', () => { expect(true).toBe(true) })

// GOOD
it.skip('需要网络，跳过', () => {
    // TODO(#xxx): 集成测试环境就绪后启用
    expect(service.fetchReadmeFromGitHub).toBeDefined()
})
```

#### P2: 全量扫描闭环

每次 SonarJS 修复后，必须运行全量扫描并确保：

- [ ] `npm run lint 2>&1 | grep "sonarjs/"` — 零输出
- [ ] 输出的 error 列表必须逐条确认已修复
- [ ] 如果有 agent 并行修复，必须汇总后统一验证

## 第四次复盘（2026-06-27）

### 本次修复的典型问题（SonarJS 尾扫 + 前端小修）

| 问题类型 | 数量 | 根因 | 修复方式 |
|---------|------|------|---------|
| `as any` 逃逸（Progress status） | 1 处 | 已有 P0 禁止 any 约束，但仍习惯性用 `as any` 跳过类型检查 | 改为联合类型 `'success'\|'exception'\|'active'\|'normal'` |
| 同名文件冲突（`helpers.ts` vs `helpers.tsx`） | 1 处 | 拆分文件时没考虑 `.ts` 和 `.tsx` 同名会导致 TS 解析异常 | 重命名 `helpers.tsx` → `DaysSinceText.tsx` |
| 变量冗余赋值（progressStatus else 分支） | 1 处 | 初始化后又在 else 中重复赋值相同值 | 移除冗余 else 分支 |
| 验证命令跑错目录 | 2 次 | 在根目录执行 `npx eslint .` 和 `npx tsc --noEmit`，实际未对子包生效 | 增加 `cd <子包目录>` 前置确认 |

### 根因总结

1. **"先跑通再说"心态** — `status as any` 明知违反 P0 约束，还是因为"这地方类型反正不会错"的侥幸心理写出来。约束写了不等于约束遵守了，需要在编码阶段就自我拦截。

2. **文件命名基本功不扎实** — 创建 `helpers.ts` 时没检查目录下是否已有 `helpers.tsx`。TypeScript 的 module resolution 遇到同名 `.ts`/`.tsx` 时行为不确定，这本应是一个常识性禁忌。

3. **验证闭环的形式主义** — 跑 `npx eslint .` 输出 "0 errors" 就以为通过了，没检查当前工作目录是否正确。验证不是为了"看到绿色"而是为了"确认正确"——必须证明你在测的东西确实是你想测的东西。

4. **修复后未立即自我验证** — 改完 `as any` 引入了冗余赋值的新 lint error，但在用户指出之前没有跑 lint 二次确认。缺少"修改 → 验证 → 确认零新问题"的肌肉记忆。

### 新增约束

#### P0: 禁止同名异缀文件（新增）

同一目录下**禁止**存在同名仅后缀不同的文件（如 `helpers.ts` + `helpers.tsx`）：

- [ ] 拆分文件时，先检查目标目录是否有同名文件（不同后缀）
- [ ] 新文件名必须与现有文件名字面量不同，不能仅靠后缀区分
- [ ] 纯工具函数用 `.ts`，组件用 `.tsx`，名称不能相同

```typescript
// BAD — 同目录同名不同缀，TS 解析异常
// hooks/helpers.ts     (纯函数)
// hooks/helpers.tsx    (组件)

// GOOD — 名称不同，清晰区分
// hooks/helpers.ts          (纯函数)
// hooks/DaysSinceText.tsx   (组件)
```

#### P1: 验证执行路径确认（新增）

所有验证命令（lint/typecheck/test）执行前，必须确认：

- [ ] 当前工作目录是否正确？`pwd` 是否在目标子包目录？
- [ ] 是否用了正确的配置文件（`tsconfig.app.json` vs `tsconfig.json`）？
- [ ] 输出中的 error 计数是否确实来自目标包？
- [ ] 零 output ≠ 零 error——必须确认 exit code 为 0

**反面案例：**
```bash
# BAD — 在根目录跑子包命令，实际不生效
npx eslint .                       # 用的根 ESLint config，没检查子包
npx tsc --noEmit                   # 用的根 tsconfig，不是子包的

# GOOD — 先进入子包目录再验证
cd packages/frontend
npx eslint . --format stylish      # 正确使用前端 config
npx tsc -p tsconfig.app.json --noEmit  # 正确使用前端 tsconfig
```

#### P1: 改后立即自我验证（新增）

每次代码修改后必须：

- [ ] 立即运行该包的最小验证命令（lint），确认零新 error
- [ ] 特别关注：修了一个 error 后是否引入了新的 error
- [ ] 如果有 agent 代修，回收结果后必须统一验证

### 编码约束（第四次更新）

新增约束表：

| 规则类别 | 要求 | 强制级别 |
|---------|------|---------|
| 禁止同名异缀文件 | 同一目录不得有仅后缀不同的同名文件（`helpers.ts`+`helpers.tsx`） | P0 |
| 验证路径确认 | 运行 lint/typecheck 前确认 `pwd` 在正确子包目录 | P1 |
| 改后自检 | 每次修改后立即验证，确认零新 error | P1 |## 第五次复盘（2026-06-28）

### 本次修复的典型问题（克隆模块）

| 问题类型 | 数量 | 根因 | 修复方式 |
|---------|------|------|---------|
| 信号量泄漏（resetSemaphore 与运行中 processItem 冲突） | 1 处 | 共享可变状态（semaphore/waitQueue）无代际隔离，forceReleaseLock 破坏串行假设 | 引入 generation 代际计数器，旧代际 processItem 自动跳过信号量释放和 DB 写入 |
| 超时后台操作未取消（Promise.race 不取消内部 Promise） | 1 处 | 低估 Promise.race 副作用——超时 reject 后内部 async 操作仍在运行，完成后继续写 DB | 代际变更后禁止 recordItemResult，超时与正常完成在 finally 统一处理 |
| Git Token 命令行参数泄露 | 1 处 | 直接在 clone URL 中注入 Token，作为 spawn 参数传递（Windows 上其他进程可读） | 改用 GIT_ASKPASS 环境变量 + 临时脚本，Token 不在命令行参数中出现 |
| 终态计算逻辑重复 | 3 处 | finishTask/getTaskProgress/getRecentTasks 各自实现一套终态判断 | 提取 `computeFinalTaskStatus()` 静态方法统一调用 |
| TOCTOU（existsSync + rm 非原子） | 1 处 | 习惯性先检查再删除，未意识到 `rm({ force: true })` 已容错 | 去掉多余 existsSync 检查 |

### 根因总结

1. **共享可变状态缺乏版本隔离** — `semaphore`、`waitQueue`、`running`、`targetDir`、`currentTaskId` 全部是实例属性，多任务生命周期交叠时（forceReleaseLock + scheduler 重新 pick up）没有版本/代际机制隔离不同轮次的任务。这是最根本的架构缺陷。

2. **Promise 不可取消的认知不足** — `Promise.race` 超时后误以为"结束了"，没意识到内部 async 操作仍在事件循环中运行，完成后会继续操作 DB。JavaScript 的 Promise 没有内置取消机制，必须在架构层面补偿（代际检查 / AbortController）。

3. **进程创建的安全审计缺失** — `spawn('git', args)` 传递了含 Token 的 URL，没有从"命令行参数可视性"角度审查。Windows 上其他进程可通过 WMI 读取命令行参数。

4. **提取公共方法意识不足** — 三处相同的终态判断逻辑各自独立实现，没有第一时间提取为静态方法。和"重复代码"问题同源。

5. **Node.js fs API 容错特性了解不足** — `rm({ force: true })` 在文件不存在时静默忽略错误，无需前置 `existsSync` 检查。

### 对 AI 助手的新约束

#### P0: 异步生命周期隔离原则（新增）

设计异步系统时，所有共享可变状态必须有生命周期隔离机制：

- [ ] 是否存在跨 async 操作共享的可变状态（计数器、队列、锁）？
- [ ] 多轮操作的生命周期是否会交叠（如：强制重置 + 后台未完成操作）？
- [ ] 如果会交叠，是否引入了代际/版本号来隔离？

```typescript
// BAD — 共享 semaphore 无隔离，reset 后旧操作污染新任务
private semaphore = 0;
async processItem(item) {
    await this.acquire();
    try { await doWork(item); } finally { this.release(); }
}
reset() { this.semaphore = 0; this.waitQueue = []; }

// GOOD — 代际隔离，旧代际的操作不再影响新任务
private generation = 0;
async processItem(item) {
    const capturedGen = this.generation;
    await this.acquire();
    try {
        await doWork(item);
        if (this.generation !== capturedGen) return; // 代际变了，跳过
    } finally {
        if (this.generation === capturedGen) this.release();
    }
}
forceReleaseLock() { this.generation++; ... }
```

#### P1: Promise 超时必须取消内部操作

使用 `Promise.race` 做超时时，必须检查：

- [ ] 超时 reject 后，内部 Promise 是否仍在运行？
- [ ] 内部操作完成后是否会操作共享状态（DB 写入、文件系统等）？
- [ ] 如果有副作用，是否通过代际检查 / AbortController 真正取消了操作？

**反面案例：**
```typescript
// BAD — 超时后内部操作仍在运行，完成后继续写 DB
await Promise.race([
    this.processItemInner(item),   // 10分钟后才完成
    new Promise((_, reject) => setTimeout(() => reject(new Error('超时')), 5000)),
]); // 超时 reject 了，但 processItemInner 还在运行，5分钟后写 DB

// GOOD — 代际检查阻止旧操作写 DB
const capturedGen = this.generation;
try {
    await withTimeout(this.processItemInner(item, capturedGen), TIMEOUT, msg);
} finally {
    if (this.generation === capturedGen) this.release();
}
// processItemInner 中：
if (this.generation !== capturedGen) return; // 跳过 DB 写入
```

#### P1: 进程创建安全审查（新增）

所有 `spawn`/`exec`/`execFile` 调用必须检查：

- [ ] 命令行参数中是否包含敏感信息（Token、密码、API Key）？
- [ ] 是否可通过环境变量、临时文件、stdin 等方式替代命令行参数传递凭据？
- [ ] Windows 平台上是否考虑了命令行参数可视性问题？

**反面案例：**
```typescript
// BAD — Token 在命令行参数中，Windows 上可被其他进程读取
const url = `https://x-access-token:${token}@github.com/owner/repo.git`;
spawn('git', ['clone', url, localPath]);

// GOOD — 通过 GIT_ASKPASS 环境变量传递，Token 不在命令行出现
const env = { ...process.env, GIT_ASKPASS: askpassScript, GIT_TERMINAL_PROMPT: '0' };
spawn('git', ['clone', cloneUrl, localPath], { env });
```

#### P2: 三处重复必须提取

同一逻辑出现 3 次及以上，**必须**提取为公共方法：

- [ ] 当前修改中是否有相同逻辑出现在 3 个以上位置？
- [ ] 提取的方法是否有清晰命名和参数？
- [ ] 提取后所有调用点是否已替换？

**反面案例：**
```typescript
// BAD — 三处各自实现终态判断
// finishTask: if (failed === 0) COMPLETED else if (completed === 0) FAILED else PARTIAL
// getTaskProgress: 同上
// getRecentTasks: 同上

// GOOD
static computeFinalTaskStatus(completed: number, failed: number): string {
    if (failed === 0) return 'COMPLETED';
    if (completed === 0) return 'FAILED';
    return 'PARTIAL';
}
```

#### P2: fs API 容错意识

使用 Node.js `fs` 模块时，优先利用 API 自身的容错能力：

- [ ] `rm({ force: true })` — 文件/目录不存在时静默忽略，无需前置 existsSync
- [ ] `mkdir({ recursive: true })` — 目录已存在时不报错，无需前置 existsSync
- [ ] 禁止"检查 → 操作"的 TOCTOU 模式，除非业务需要区分"不存在"和"其他错误"

### 编码约束（第三次更新）

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
| `cognitive-complexity` | 复杂度 ≤ 15 | 210+ 行组件 + 4 个 Card | 提取子组件 ≤ 200 行 |
| `use-type-alias` | 重复联合类型提别名 | `'a'\|'b'` 在多个方法签名出现 | `type MyType = 'a'\|'b'` |
| `no-selector-parameter` | 禁止布尔参数选择行为 | `recordResult(success, ...)` | `recordSuccess()` / `recordFailure()` 两个方法 |
| `no-nested-functions` | 禁止嵌套函数 > 4 层 | `setInterval(() => { (async () => { setState(() => {}) })() })` | 提取为独立函数 |
| `no-trivial-assertions` | 禁止无意义断言 | `expect(true).toBe(true)` | `expect(func).toBeDefined()` |
| `prefer-specific-assertions` | 使用具体断言 | `expect(arr.length).toBe(1)` | `expect(arr).toHaveLength(1)` |
| `assertions-in-tests` | 测试必须有断言 | `it('test', async () => { await call() })` | `expect(result).toBe(xxx)` |
| `no-explicit-any` | 禁止显式 any | `catch (e: any)` / `\_: any` | `catch (e: unknown)` + instanceof 收窄 |

**强制流程：**
1. 写完代码后必须运行 `npm run lint && npm run typecheck`
2. 必须零 error 才能说"完成"
3. 如果现有代码报 error，必须修复不能绕过
4. 多代理并行修复后，必须统一运行全量 lint 验证

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
