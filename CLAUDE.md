# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.



## 项目概述


GitHub Stars 管理系统 — 用户对自己 Star 过的 GitHub 仓库进行管理、分类、翻译、统计、AI 分析和批量克隆。

**技术栈：**
- 后端：[NestJS 11](packages/backend/) + Prisma ORM + MySQL
- 前端：[React 19](packages/frontend/) + Vite 8 + Ant Design 6 + Tailwind CSS 4
- 共享库：[packages/shared/](packages/shared/) — 前后端共享 TypeScript 类型

## 工具使用指引
如果项目中serena 这个mcp可以用的话，尽量使用 这个mcp 工具对代码进行操作
🔍 代码搜索与分析
工具	说明
find_symbol 🔥	根据名称路径模式查找符号（类、方法等），支持深度展开子级
find_declaration	查找符号的声明位置（通过正则匹配调用点）
find_implementations	查找接口/方法的所有实现
find_referencing_symbols	查找引用某个符号的所有地方
get_symbols_overview	获取文件内符号的高层级概览（按种类分组）
get_diagnostics_for_file	获取文件的 LSP 诊断信息（Error/Warning 等）
✏️ 代码编辑
工具	说明
insert_before_symbol	在指定符号定义前插入代码（如添加 import、类/函数）
insert_after_symbol	在指定符号定义后插入代码
replace_symbol_body	替换符号的整个主体（包括签名行）
replace_content 🔥	用正则/字面量匹配替换文件内容（编辑的主力工具）
rename_symbol	全局重命名符号
safe_delete_symbol	安全删除符号（无引用时）
🧠 记忆系统
工具	说明
write_memory	写入项目记忆信息（Markdown 格式）
read_memory	读取指定记忆
edit_memory	编辑记忆内容（正则/字面量替换）
delete_memory	删除记忆
rename_memory	重命名/移动记忆（支持 / 组织主题）
list_memories	列出所有记忆，可按主题过滤

可以对这些代码进行搜索
以及接口调用全链路的追踪
以及代码修改范围的评估


## 复盘记录（2026-06-27）

### 本次修复的典型问题

| 问题类型                    | 数量  | 根因                          | 修复方式               |
| --------------------------- | ----- | ----------------------------- | ---------------------- |
| 未使用的 Logger/导入/变量   | 12 处 | 编码后未清理，Lint 未强制执行 | 删除无用声明           |
| 嵌套三元表达式（S3358）     | 28 处 | 贪图一行写完，可读性差        | 拆分为 if-else 或 IIFE |
| 死代码（死存储）            | 5 处  | 变量赋值后未使用              | 删除赋值/变量          |
| 嵌套模板字面量              | 3 处  | 模板中嵌模板，难维护          | 提取中间变量           |
| Ant Design 废弃 API         | 13 处 | 从 v5 升级到 v6 未同步更新    | 改用新版 API           |
| `.match()` 应使用 `.exec()` | 3 处  | 对正则方法选择缺乏认知        | 改为 `.exec()`         |
| `length >= 0` 恒真          | 3 处  | 数组长度永远 ≥ 0              | 改为 `> 0`             |

### 根因总结

1. **SonarJS 集成缺失**：`eslint-plugin-sonarjs` 未安装，大量规则无法检测
2. **Lint 未强制执行**：CLAUDE.md 虽有 lint 要求，但编码后没有"必须运行 `npm run lint` 且零 error"的硬约束
3. **Ant Design 版本敏感度不足**：从 v5 升级到 v6 后，对废弃 API 没有系统清理
4. **测试代码被忽略**：测试文件中的无用导入、死代码、无意义断言长期积累

### 新增约束

## 第二次复盘（2026-06-27）

### 本次修复的典型问题

| 问题类型                     | 数量 | 根因                                                   | 修复方式                                       |
| ---------------------------- | ---- | ------------------------------------------------------ | ---------------------------------------------- |
| 参数被接收但忽略（参数黑洞） | 3 处 | Controller 写了参数签名但未传入底层方法                | 将 type 透传到 Service 层                      |
| Controller 循环创建 N 个任务 | 1 处 | 缺乏批量操作抽象，被迫在 Controller 中手写循环         | 抽取 `createBatchTask()` 方法                  |
| 调用错误的全量方法           | 1 处 | 相似逻辑复制粘贴忘了替换调用目标                       | 改为先查趋势仓库再创建任务                     |
| 缺失输入校验                 | 3 处 | `star/unstar/starred` 没有用 ZodValidationPipe         | 增加空值校验                                   |
| 查询条件覆盖不全             | 1 处 | `WHERE readmeFetched=false` 漏掉了翻译失败需重试的仓库 | 增加 `OR readmeFetched=true AND readmeCn=null` |
| 导出无上限保护               | 1 处 | 未考虑 maxCount 未被限制时的 OOM 风险                  | 增加 1000 条硬上限                             |

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

| 问题类型                   | 数量     | 根因                                             | 修复方式                                 |
| -------------------------- | -------- | ------------------------------------------------ | ---------------------------------------- |
| Cognitive Complexity 超标  | 5 个函数 | 组件/函数长期扩展未拆分，缺乏抽象提取意识        | 提取子组件/辅助方法，每函数降至 ≤15      |
| Nested Ternary（第二轮）   | 25+ 处   | 首次修复只修了部分文件，前端大量残留             | 全部拆分为 if-else/IIFE/提取变量         |
| Controller 单函数过重      | 1 处     | createTask 内联 3 种 scope 逻辑，未做早期抽象    | 提取 3 个私有方法                        |
| 测试占位无意义断言         | 11 处    | `expect(true).toBe(true)` 留作占位，后续忘了替换 | 替换为有意义的 `toBeDefined` 等断言      |
| `any` 逃逸                 | 3 处     | catch 参数/回调参数使用 any 绕过类型检查         | 改为 `unknown` + `instanceof Error` 收窄 |
| 联合类型未提取别名         | 2 处     | 重复出现的内联联合类型                           | 提取 `TranslateType` 类型别名            |
| 嵌套函数过深               | 1 处     | setInterval 内嵌 IIFE 再嵌套 setState 回调       | 提取独立 `tick` 函数                     |
| ZodObject passthrough 废弃 | 2 处     | `.passthrough()` 与空对象组合被 Zod 标记为废弃   | 移除 `.passthrough()`                    |
| 测试中公开可写目录         | 10 处    | 测试硬编码 `/tmp/clone` 路径                     | 添加 eslint-disable 注释                 |

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

| 问题类型                                      | 数量 | 根因                                                                | 修复方式                                                  |
| --------------------------------------------- | ---- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| `as any` 逃逸（Progress status）              | 1 处 | 已有 P0 禁止 any 约束，但仍习惯性用 `as any` 跳过类型检查           | 改为联合类型 `'success'\|'exception'\|'active'\|'normal'` |
| 同名文件冲突（`helpers.ts` vs `helpers.tsx`） | 1 处 | 拆分文件时没考虑 `.ts` 和 `.tsx` 同名会导致 TS 解析异常             | 重命名 `helpers.tsx` → `DaysSinceText.tsx`                |
| 变量冗余赋值（progressStatus else 分支）      | 1 处 | 初始化后又在 else 中重复赋值相同值                                  | 移除冗余 else 分支                                        |
| 验证命令跑错目录                              | 2 次 | 在根目录执行 `npx eslint .` 和 `npx tsc --noEmit`，实际未对子包生效 | 增加 `cd <子包目录>` 前置确认                             |

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

| 规则类别         | 要求                                                             | 强制级别 |
| ---------------- | ---------------------------------------------------------------- | -------- |
| 禁止同名异缀文件 | 同一目录不得有仅后缀不同的同名文件（`helpers.ts`+`helpers.tsx`） | P0       |
| 验证路径确认     | 运行 lint/typecheck 前确认 `pwd` 在正确子包目录                  | P1       |
| 改后自检         | 每次修改后立即验证，确认零新 error                               | P1       | ## 第五次复盘（2026-06-28） |

### 本次修复的典型问题（克隆模块）

| 问题类型                                               | 数量 | 根因                                                                             | 修复方式                                                                    |
| ------------------------------------------------------ | ---- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 信号量泄漏（resetSemaphore 与运行中 processItem 冲突） | 1 处 | 共享可变状态（semaphore/waitQueue）无代际隔离，forceReleaseLock 破坏串行假设     | 引入 generation 代际计数器，旧代际 processItem 自动跳过信号量释放和 DB 写入 |
| 超时后台操作未取消（Promise.race 不取消内部 Promise）  | 1 处 | 低估 Promise.race 副作用——超时 reject 后内部 async 操作仍在运行，完成后继续写 DB | 代际变更后禁止 recordItemResult，超时与正常完成在 finally 统一处理          |
| Git Token 命令行参数泄露                               | 1 处 | 直接在 clone URL 中注入 Token，作为 spawn 参数传递（Windows 上其他进程可读）     | 改用 GIT_ASKPASS 环境变量 + 临时脚本，Token 不在命令行参数中出现            |
| 终态计算逻辑重复                                       | 3 处 | finishTask/getTaskProgress/getRecentTasks 各自实现一套终态判断                   | 提取 `computeFinalTaskStatus()` 静态方法统一调用                            |
| TOCTOU（existsSync + rm 非原子）                       | 1 处 | 习惯性先检查再删除，未意识到 `rm({ force: true })` 已容错                        | 去掉多余 existsSync 检查                                                    |

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

## 第六次复盘（2026-06-28）

### 本次暴露的典型问题

| 问题类型                                        | 数量 | 根因                                                                          | 修复方式                                  |
| ----------------------------------------------- | ---- | ----------------------------------------------------------------------------- | ----------------------------------------- |
| `string \| null` 未做兜底直接传给 `string` 类型 | 3 处 | 从对象取值时没审视类型是否匹配，缺少 `??` 肌肉记忆                            | 加 `?? ''` 空值合并                       |
| 同分支 `extraContent` 产生重复 JSX（S1871）     | 1 处 | 写完没做目视审查，没发现两个 else 分支渲染相同按钮                            | 合并分支为单一 else                       |
| Alert `message` 废弃属性再次使用（S1874）       | 1 处 | 已是第三次犯 Ant Design 废弃 API 错误                                         | 改为 `description`                        |
| 验证命令不完整                                  | 1 次 | 只跑了 `eslint .` + `tsc --noEmit`，没跑 `npm run build`（`tsc -b` 检查更严） | 补跑 `npm run build` 后暴露 3 个 TS error |

### 根因总结

1. **非空校验肌肉记忆缺失** — `GithubRepo.readmeCn` 的类型定义明明白白写着 `string \| null`，但赋值给 `MarkdownRenderer` 的 `content: string` 时，大脑自动忽略了 `null` 的可能性。这不是不知道要处理 null，而是编码时**没有"每写一行赋值都审视类型兼容性"的习惯**。

2. **验证命令的"最小努力偏差"** — 跑 `npx eslint .` 看到 0 error 就安心了，跑 `npm run typecheck` 看到 0 error 也觉得够了。但前端的 `tsc -b`（project references 模式）比 `tsc --noEmit` 严格——`tsc -b` 会检查引用项目的 .d.ts 声明文件的正确性，而 `--noEmit` 不会。**验证不是为了"看到绿字"，而是为了覆盖所有可能出错的路径。**

3. **Ant Design 废弃 API 反复踩坑** — 第一次复盘（v5→v6 升级遗留 13 处）、第三次复盘（ZodObject.passthrough 废弃 2 处）、这次（Alert.message 废弃 1 处）。这是一个**重复犯错模式**——每次遇到 Ant Design 组件的新写法，就默认按老方式写，没有先查文档的意识。

4. **写完不自审的惯性** — 写完 `RepoReadmeCard.tsx` 的 `extraContent` 分支后，如果停下一秒看一下代码，就会注意到两个 else 分支生成的都是 `<Button>翻译 README</Button>`。但在"写完 → 跑验证 → 过"的流程中，**目视审查被跳过了**。

### 对 AI 助手的新约束

#### P0: 属性赋值前必须审视 null 安全（新增）

**每次从对象取值赋给非空类型变量时，必须检查 null/undefined 的可能性：**

- [ ] 源值的类型签名中是否有 `\| null` 或 `\| undefined`？
- [ ] 目标变量/参数的类型是否允许 null？
- [ ] 如果不允许，是否用 `?? ''` 做了兜底？

**反面案例：**
```typescript
// BAD — readmeCn: string | null → content: string，null 没处理
<MarkdownRenderer content={repo.readmeCn} />

// GOOD — 用 ?? 做兜底
<MarkdownRenderer content={repo.readmeCn ?? ''} />
```

**检查清单（写入代码后逐条过）：**
```typescript
// 每写一行类似代码，问自己：
// 1. 这个值的类型签名是什么？      → `string | null`
// 2. 目标位置接受 null 吗？        → `content: string` → 不接受
// 3. 我加 `?? ''` 了吗？           → 加了 ✅
```

#### P0: 构建验证必须用生产命令（新增）

修改前端代码后，验证命令**必须**用 `npm run build`（即 `tsc -b && vite build`），**不能**只用 `tsc --noEmit`：

- [ ] `tsc -b`（project references）比 `tsc --noEmit` 检查更严格
- [ ] 如果 `npm run build` 因预存 error 失败，至少要确保**新修改的文件**在 `npm run build 2>&1 | grep <文件名>` 中零命中
- [ ] 不得以"tsc --noEmit 过了"作为"编译通过"的依据

**反面案例：**
```bash
# BAD — 只跑了 lint 和 typecheck，没跑 build
npx eslint .                              # 0 errors，以为没问题
npx tsc --noEmit                           # 0 errors，以为没问题
# → 实际 npm run build 报 3 个 TS error（因为 tsc -b 更严格）

# GOOD — 必须跑完整的生产构建命令
cd packages/frontend
npm run build 2>&1 | grep -E "RepoReadmeCard|src/components"  # 确认新增/修改的文件零 error
```

#### P1: 改后立即跑 sonarjs 全量扫描（新增）

每次写完代码后，必须在目标包目录执行：

```bash
npm run lint 2>&1 | grep "sonarjs/"
```

确认零输出。如果现有代码有预存 sonarjs 警告，用 `grep -v <预存规则>` 排除后确认**新增的修改**没有引入新警告。

#### P2: Ant Design 组件 API 使用前检查（重申）

使用 Ant Design 组件时，**先确认当前版本的 API 签名**再写代码（Ant Design v6 API 与 v5 不完全兼容）：

- [ ] 组件 props 是否在当前版本已废弃？
- [ ] 是否有替代 props 名称？（如 `message` → `description`）
- [ ] 是否有返回类型变更？（如 `ItemType` 联合类型）

### 编码约束（第四次更新）

新增/更新约束表：

| 规则类别            | 要求                                              | 强制级别 |
| ------------------- | ------------------------------------------------- | -------- |
| null 安全检查       | 对象属性赋值给非空类型前，用 `?? ''` 做兜底       | P0       |
| 构建验证命令        | 必须用 `npm run build` 而非 `tsc --noEmit`        | P0       |
| 改后 sonarjs 扫描   | `npm run lint 2>&1 \| grep "sonarjs/"` 必须零输出 | P1       |
| Ant Design API 预检 | 使用 Ant Design 组件前查当前版本 API 签名         | P2       |

### 强制流程（第六次更新）

写完代码后的完整验证链（**不可跳过任何一步**）：

```bash
# 1. 目标包目录确认
cd packages/frontend  # 或其他目标包

# 2. Lint（检查 sonarjs 规则）
npm run lint 2>&1 | grep -E "sonarjs" || echo "sonarjs 零警告"

# 3. 生产构建（必须用 build 而非 typecheck）
npm run build 2>&1 | grep -E "$(basename $(pwd))" || echo "构建零 error"

# 4. 目视审查 — 打开修改的文件，逐行看一遍
#    特别关注：重复代码、null 安全、废弃 API、console.log
```

执行代码变更后，必须运行 `npm run lint` 确保以下 sonarjs 规则零 error：

| 规则 ID                       | 要求                 | 禁止写法                                                        | 正确写法                                       |
| ----------------------------- | -------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| `no-nested-conditional`       | 禁止嵌套三元         | `a ? (b ? 1 : 2) : 3`                                           | 拆分为 if-else 链或 IIFE                       |
| `no-nested-template-literals` | 禁止模板嵌套         | `` `${a ? `${b}` : ''}` ``                                      | 提取内层模板为变量                             |
| `prefer-regexp-exec`          | 正则用 exec          | `str.match(/pattern/)`                                          | `/pattern/.exec(str)`                          |
| `unused-import`               | 删除未使用导入       | `import { unused } from 'x'`                                    | 删除                                           |
| `no-unused-vars`              | 删除未使用变量       | `const x = ...` （x 未读）                                      | 删除                                           |
| `no-collection-size-mischeck` | 数组判空用 > 0       | `arr.length >= 0`                                               | `arr.length > 0`                               |
| `no-ignored-exceptions`       | catch 参数必须使用   | `catch (e) {}`                                                  | `catch { }` 或使用 e                           |
| `cognitive-complexity`        | 复杂度 ≤ 15          | 210+ 行组件 + 4 个 Card                                         | 提取子组件 ≤ 200 行                            |
| `use-type-alias`              | 重复联合类型提别名   | `'a'\|'b'` 在多个方法签名出现                                   | `type MyType = 'a'\|'b'`                       |
| `no-selector-parameter`       | 禁止布尔参数选择行为 | `recordResult(success, ...)`                                    | `recordSuccess()` / `recordFailure()` 两个方法 |
| `no-nested-functions`         | 禁止嵌套函数 > 4 层  | `setInterval(() => { (async () => { setState(() => {}) })() })` | 提取为独立函数                                 |
| `no-trivial-assertions`       | 禁止无意义断言       | `expect(true).toBe(true)`                                       | `expect(func).toBeDefined()`                   |
| `prefer-specific-assertions`  | 使用具体断言         | `expect(arr.length).toBe(1)`                                    | `expect(arr).toHaveLength(1)`                  |
| `assertions-in-tests`         | 测试必须有断言       | `it('test', async () => { await call() })`                      | `expect(result).toBe(xxx)`                     |
| `no-explicit-any`             | 禁止显式 any         | `catch (e: any)` / `\_: any`                                    | `catch (e: unknown)` + instanceof 收窄         |

**强制流程：**
1. 写完代码后必须运行 `npm run lint && npm run typecheck`
2. 必须零 error 才能说"完成"
3. 如果现有代码报 error，必须修复不能绕过
4. 多代理并行修复后，必须统一运行全量 lint 验证

**项目管理：** Turborepo monorepo（npm workspaces），参考 [OpenCode](https://github.com/anomalyco/opencode) 多项目管理方式。

## 第七次复盘（2026-06-30）

### 本次暴露的典型问题

| 问题类型 | 数量 | 根因 | 修复方式 |
|---------|------|------|---------|
| Table 列内容溢出（镜像源标签超 120px） | 1 处 | 写了列宽但没追查最长渲染内容，缺 UI 渲染审查步骤 | 加 ellipsis + Tooltip |
| 目标目录列无宽度，吃所有剩余空间 | 1 处 | 没审视弹性列在总宽中的占比 | 加固定宽度 220px |
| 并发数独立一列，信息密度低 | 1 处 | 没思考合并方案直接堆列 | 合并到配置列 |
| 表格无水平滚动兜底 | 1 处 | 只考虑了理想宽度没考虑窄屏 | 加 scroll={{ x: 1200 }} |

### 根因总结

1. **渲染审查缺失** — 代码审查流程只检查了：编译通过 ✅、类型安全 ✅、复杂度 ✅，但**没有检查渲染输出**。写 columns 定义时只关注了"用什么组件渲染"，没追查"实际渲染出来最长什么样、120px 装不装得下"。

2. **"宽度写了就够"的错觉** — 给了 `width: 120` 就默认内容放得下，没意识到 `getMirrorListLabel()` 可能输出 `ghproxy.net → gh-proxy.com → 直连` 这样 30+ 字符的文本。

3. **缺乏 UI 审查的检查清单** — 项目已有 6 次复盘积累了大量后端/编码约束（参数透传、代际隔离、any 逃逸、null 安全、batch 抽象），但**没有任何一条约束涉及"UI 渲染内容是否溢出"**。

4. **前端审查视角偏科** — 四次角色审视要求（产品架构师/UI 交互师/前端架构师/后端架构师）在实践中只用了后端和代码质量视角，UI 交互师视角（"用户看到的表长什么样？会不会断？"）被跳过。

### 对 AI 助手的新约束

#### P0: 前端代码四维审查（新增）— 写前端代码必须从四个维度审视

**核心思维：** 代码编译通过只是起点，不等于代码可用。写前端代码时，必须站在用户视角从四个维度审视自己的代码。

```
┌─────────────────────────────────────────┐
│           前端代码四维审查                │
├──────────┬──────────┬──────────┬─────────┤
│  交互友好  │  用户体验  │  前端性能  │ 视觉安全 │
│  点击有反馈 │  三态覆盖  │  避免多余  │ 内容不溢出│
│  操作有确认 │  流程直觉  │  重渲染   │ 窄屏不裂 │
│  禁用防重复 │  页面不白屏 │  懒加载   │ 空值不崩 │
└──────────┴──────────┴──────────┴─────────┘
```

**每个维度写完必须逐一追问：**

**1️⃣ 交互友好（Interaction）**
- [ ] 按钮点击后有无 loading 态？防重复点击？
- [ ] 删除/重置等不可逆操作有无二次确认？
- [ ] 操作成功/失败有无 Toast/提示反馈？
- [ ] 异步操作期间 UI 是否冻结（按钮 disable）？

**2️⃣ 用户体验（UX）**
- [ ] Loading 态：页面/组件有无骨架屏或 Spin，不是白屏等待？
- [ ] Empty 态：无数据时是空白一片还是友好提示？
- [ ] Error 态：接口失败后给用户什么反馈？有重试入口吗？
- [ ] 用户操作流程是否自然？需要点击的次数是否合理？

**3️⃣ 前端性能（Performance）**
- [ ] 列表/表格的 key 是否稳定且唯一（不用 index）？
- [ ] 是否存在不必要的状态更新导致重复渲染？
- [ ] 大列表是否有虚拟滚动或分页？
- [ ] 是否有未清理的定时器/事件监听（内存泄漏）？

**4️⃣ 视觉安全（Visual）**
- [ ] 动态内容最长值多少？当前容器装得下吗？
- [ ] 超长内容有无 ellipsis + Tooltip 兜底？
- [ ] 窄屏下（<1024px）布局是否断裂？
- [ ] 空值/null 是否会显示 "undefined" 或崩溃？

**检查时机：** 每次写完前端代码，按四维依次过一遍，发现缺漏立即补充，这是 P0 纪律。

### 编码约束（第七次更新）

| 规则类别 | 要求 | 强制级别 |
|---------|------|---------|
| 前端代码四维审查 | 写完前端代码从"交互友好/用户体验/前端性能/视觉安全"四个维度审查 | P0 |
| 交互反馈 | 异步操作有 loading 态 + disable 防重复，不可逆操作有二次确认 | P0 |
| UX 三态覆盖 | Loading / Empty / Error 三种状态必须全部处理，缺一不可 | P0 |
| 性能意识 | 列表 key 稳定唯一，清理定时器/事件监听，大列表加分页 | P1 |
| 视觉安全 | 动态内容加 ellipsis/Tooltip 兜底，窄屏加 scroll.x 滚动 | P0 |

## 第八次复盘（2026-06-30）

### 本次暴露的典型问题

| 问题类型 | 数量 | 根因 | 修复方式 |
|---------|------|------|---------|
| 新增 API 路由后未重启后端 | 1 次 | 代码修改后只验证了编译/lint/build，完全忘记重启后端服务 | 重新启动后端进程使新路由生效 |

### 根因总结

1. **"代码写完 = 工作完成"的认知偏差** — 编译通过、lint 零错误、build 成功，就以为"做完了"。但后端修改的最后一公里是**重启服务**，这一步没做就等于代码没上线。这是一个非常严重的认知漏洞——**代码正确 ≠ 服务可用**。

2. **既有规则被跳过** — CLAUDE.md 明确写着"必须要询问用户的！！！是否要重新编译，是否要重新启动项目"，但编码过程中完全忽视了这条规则。规则存在但不执行 = 规则不存在。

3. **验证闭环缺少"部署验证"环节** — 现有的强制流程（lint → build → 目视审查）全部聚焦在"代码本身是否正确"，没有覆盖"修改后的代码是否已部署到运行中的服务"。对于后端开发者来说，写完代码后的最后一步必须是确认服务已重启、新端点可访问。

4. **问题发现依赖于用户** — 用户点击按钮报错后才暴露问题，而不是在开发阶段自己发现。这说明缺少"改完后 curl 测试新端点"的自查步骤。

### 对 AI 助手的新约束

#### P0: 后端修改必须重启服务（新增）

**任何后端代码修改完成后，必须执行以下步骤，不可跳过：**

- [ ] 关闭旧后端进程（`kill`/`taskkill`）
- [ ] 重新启动后端服务
- [ ] **curl 验证新端点/修改的功能可正常访问**
- [ ] 如果用户之前未授权自动重启，必须先询问用户

**反面案例：**
```bash
# BAD — 只验证了编译就以为完成了
npm run build -w @githubstars/backend  # 编译通过 ✅
# → 忘了重启，新路由没注册，用户点击报 404 ❌

# GOOD — 完整闭环：编译 → 重启 → curl 验证
npm run build -w @githubstars/backend  # 编译 ✅
npm run start -w @githubstars/backend  # 重启 ✅
curl -s http://localhost:10002/api/download/tasks/extract-all  # 验证 ✅
```

#### P0: 后端修改交付检查清单（新增）

每次修改后端代码后，逐条确认以下清单：

| # | 检查项 | 确认方式 |
|---|--------|---------|
| 1 | 编译通过 | `tsc --noEmit` 或 `npm run build`，零 error |
| 2 | Lint 零新 error | `npm run lint`，无新增 error |
| 3 | 旧进程已关闭 | `netstat -ano \| grep <端口>` 确认不在运行 |
| 4 | 新进程已启动 | `netstat -ano \| grep <端口>` 确认新 PID 在监听 |
| 5 | 新端点可访问 | `curl -X POST ...` 返回预期响应而非 404 |
| 6 | 确认用户已知晓 | 如果进程重启可能影响用户操作，提前询问 |

**编码完成 ≠ 交付完成。最后一公里：重启 + 验证。**

### 编码约束（第八次更新）

| 规则类别 | 要求 | 强制级别 |
|---------|------|---------|
| 后端修改必须重启服务 | 编译通过后必须重启后端进程，curl 验证新端点 | P0 |
| 后端修改交付检查清单 | 编译 → lint → 关旧进程 → 启新进程 → curl 验证，六步缺一不可 | P0 |

### 强制流程（第八次更新）

后端修改的完整验证链：

```bash
# Step 1: 编译
cd packages/backend && npm run build  # 或 tsc --noEmit

# Step 2: Lint
npm run lint

# Step 3: 关旧进程
netstat -ano | grep <端口>  # 获取 PID
taskkill /PID <PID> /F       # 关闭旧进程
# 或 wmic process where "processid=<PID>" delete

# Step 4: 启新进程
npm run start &

# Step 5: 等待启动
sleep 5 && netstat -ano | grep <端口>

# Step 6: curl 验证
curl -X POST http://localhost:<端口>/api/xxx/yyy -H "Content-Type: application/json" -d '{...}'
# 确认返回预期响应，不是 404
```

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

| 表                                           | 用途                             | 关键关系                            |
| -------------------------------------------- | -------------------------------- | ----------------------------------- |
| `github_repo`                                | 星标仓库主表                     | `full_name` 唯一索引                |
| `category`                                   | 分类（树形，`parent_id` 自引用） | 通过 `repo_category` 多对多关联仓库 |
| `repo_category`                              | 仓库-分类关联表                  | 级联删除                            |
| `sync_log`                                   | 同步操作日志                     |                                     |
| `system_config`                              | KV 配置表                        | `config_key` 唯一                   |
| `clone_task` / `clone_task_item`             | 克隆任务/子项                    | `task_id`（UUID 格式）关联          |
| `ai_analyze_task`                            | AI 分析任务结果                  |                                     |

---

## 对话启动三步流程（P0 — 不可跳过）

每次编码前，依次执行以下三步：

### 第一步：加载技能
用 **Skill 工具**调用匹配当前任务的技能（见 `.claude/rules/common/skills.md` 匹配表）。

### 第二步：加载 MCP 工具
根据当前任务类型，确认需要哪些 MCP 工具（见 `.claude/rules/common/mcp-tools.md` 场景表）。
- 搜索代码 → 用 Serena 工具，不用 Grep
- 编辑代码 → 用 Serena 工具，不用 Edit
- 查文档 → 用 Context7
- 复杂推理 → 用 Sequential Thinking

### 第三步：规划智能体
对照 `.claude/rules/common/agents.md` 的 P0 强制表，判断当前场景需要调用哪个智能体。

**三步都执行完，才能开始读代码和编码。**

---

## 第九次复盘（2026-07-03）

### 本次暴露的典型问题

| 问题类型 | 数量 | 根因 | 修复方式 |
|---------|------|------|---------|
| 数据模型新增字段后漏改关联代码（`estimateSizes`、前端展示、排序） | 3 处 | 只改了入库路径，未系统搜索所有 `repo_size` / `default_branch` 的引用点 | 全局搜索 → 逐处替换 |
| 前端卡片长文本溢出，修复 5 轮才彻底解决 | 5 轮 | 逐层加 `overflow: hidden` 打补丁，未一次性追到 flex 布局根因（`minWidth: 0`） | Card 双层 overflow + flex 容器 minWidth:0 + Text maxWidth:100% |
| Tab 标签因 URL 参数变化产生重复标签 | 1 处 | Tab key 用了 `pathname + search`，筛选变化 = 新 key = 新 tab | key 改为仅 `pathname` |
| 下载文件大小显示"未知" | 1 次 | `estimateSizes` 改完后旧编译缓存没清，实际跑的还是老代码 | 强行 `taskkill` 全部 node 进程 → 重新编译 → 启动 |
| 写完不自测，依赖用户反馈 | 全程 | 每次改动后只跑 `npm run build`，从未打开浏览器验证 | 写完必须浏览器实测 |

### 根因总结

1. **"改了 A 漏了 B"惯性（最严重）** — 新增 `repo_size`/`default_branch`/`visibility` 三个字段后，只改了：
   - ✅ Schema、MappedRepoData、mapStarredItem、upsertRepo（入库链路）
   - ❌ `estimateSizes` — 仍然 HEAD + GitHub API 双重网络请求获取大小
   - ❌ `executeTaskInner` 里的 `fileSize` — 仍然 HEAD archive URL 获取 Content-Length
   - ❌ 前端列表页 — 没展示文件大小
   - ❌ 前端排序 — 没加 `repo_size` 排序选项
   - ❌ 前端详情页 — 没展示 `default_branch`/`visibility`

   **核心原因**：修改数据模型后，没有执行"全局搜索引用点 → 逐个确认是否需要同步修改"的流程。AI 的大脑里只有"当前这个方法的上下文"，没有"所有受影响的文件列表"这个概念。

2. **前端溢出修复—打补丁模式** — 用户反馈"溢出了" → 加一行 `overflow: hidden` → 用户"还是溢出" → 再加一行 → 反复 5 次。如果第一次就追到根因（flex 子项 `min-width: auto` 阻止收缩 + Ant Design Text ellipsis 需要 `max-width: 100%`），一轮就能修好。

3. **Tab 重复—设计时视角单一** — 写 `addTab({ key: location.pathname + location.search })` 时只考虑了"如何区分不同搜索条件的标签"，没考虑"用户真的需要搜索条件作为独立标签吗？"。

4. **编译缓存导致的"假修复"** — `estimateSizes` 改完后 `npm run build` 通过，但后端实际运行的还是旧代码（`Prisma generate` 文件锁 + 旧进程未重启）。验证闭环里缺了"确认运行的进程确实是新代码"这一步。

5. **写完不自测的习惯根深蒂固** — 7 次复盘积累了大量约束，但"写完打开浏览器看看"这个最基本的动作仍然没做。用户每反馈一个问题我才修一个，相当于用户在帮我做 QA。

### 对 AI 助手的新约束

#### P0: 数据模型变更必须全域引用点搜索（新增）

当修改 Prisma Schema（新增/修改/删除字段）或接口类型（MappedRepoData / GithubRepo 等）时：

- [ ] 立即用 `grep` 或 Serena 全局搜索**新字段名**（如 `repo_size`、`default_branch`）和**对应的 camelCase 名**（如 `repoSize`、`defaultBranch`）
- [ ] 列出所有引用该字段的文件，逐文件确认是否需要同步修改
- [ ] 特别关注以下"容易漏"的模式：
  - API 请求里硬编码了旧字段名
  - Service 方法里通过网络获取了同样的数据（应该改为从 DB 读）
  - 前端组件里展示/排序逻辑没包含新字段
  - 下载/克隆/导出等模块里有独立的获取逻辑

**反面案例：**
```typescript
// BAD — 新增了 repo_size 字段入库，但 estimateSizes 仍然走网络获取文件大小
async estimateSizes(repoIds: number[]) {
    // ... fetch HEAD archive URL to get Content-Length ← 完全没利用刚入库的 repoSize!
}

// GOOD — 全局搜索 repo_size / repoSize → 发现 estimateSizes → 改为从 DB 读
// 全局搜索 default_branch / defaultBranch → 发现 executeTaskInner/retryFailed/retryItem → 改为从 DB 读
```

**检查清单（改完 Schema 后必须执行）：**
```bash
# 搜索后端所有引用
grep -rn "repo_size\|repoSize" packages/backend/src/
grep -rn "default_branch\|defaultBranch" packages/backend/src/
grep -rn "visibility" packages/backend/src/

# 搜索前端所有引用
grep -rn "repo_size\|repoSize" packages/frontend/src/
grep -rn "default_branch\|defaultBranch" packages/frontend/src/
```

#### P0: 前端溢出修复必须追到 flex 根因（新增）

当前端出现文本溢出/内容撑破容器时，**禁止**逐层试加 `overflow: hidden`。

**必须一次性检查的清单：**
- [ ] **flex 父容器**是否有 `minWidth: 0`？（flex 子项默认 `min-width: auto`，不会收缩到内容宽度以下）
- [ ] **Ant Design Text/Paragraph ellipsis** 的元素是否加了 `maxWidth: '100%'`？（Ant Design 不一定默认带这个）
- [ ] **Card** 组件本身的 `style` 是否加了 `overflow: 'hidden'`？（不只 body）
- [ ] **Card body** 的 `styles.body` 是否加了 `overflow: 'hidden'`？
- [ ] **外层 Col/Row wrapper** 是否加了 `overflow: 'hidden'`？（Row 的负 margin 会导致溢出）
- [ ] Text ellipsis 内部是否有多余的 `<span>` 嵌套？（会破坏 ellipsis 效果）

#### P0: 写完前端代码必须浏览器实测（新增）

任何前端代码变更（组件/页面/样式），在 `npm run build` 通过后：

- [ ] 打开浏览器（`http://localhost:10001`）实际查看修改效果
- [ ] 特别检查：长文本是否溢出、loading/empty/error 三态是否正常
- [ ] 如果有 Playwright MCP 可用，必须用它执行验证
- [ ] 禁止只用"编译通过"作为"完成了"的依据

#### P1: 后端代码变更必须确认运行的是新代码（新增）

修改后端代码后，除 `npm run build` 外：

- [ ] 强制关闭旧进程（`taskkill /F /IM node.exe`）
- [ ] 如果 `prisma generate` 报文件锁错误，必须先杀进程再生成
- [ ] 重新启动后端
- [ ] curl 验证新端点/新逻辑返回正确数据
- [ ] 确认接口返回中包含了新增字段

### 编码约束（第九次更新）

| 规则类别 | 要求 | 强制级别 |
|---------|------|---------|
| Schema 变更全域搜索 | 修改 Prisma 模型后，全局搜索新字段名，列出所有引用点并逐个确认 | P0 |
| 前端溢出修复规范 | 禁止逐层打补丁，一次性检查 flex/minWidth/ellipsis/Card/Row 五层 | P0 |
| 写完浏览器实测 | 前端改动完成后必须打开浏览器验证，禁止只用编译结果判断 | P0 |
| 后端新代码确认 | 杀旧进程 → 重新编译 → 重启 → curl 验证 | P1 |

---

## 第十次复盘（2026-07-03）

### 本次暴露的典型问题

| 问题类型 | 数量 | 根因 | 修复方式 |
|---------|------|------|---------|
| DesktopInit 60s 超时未清除，后端就绪后仍弹出错误页 | 1 处 | `useEffect` 中创建了 `timeout` 但就绪时没 `clearTimeout`，cleanup 只在 unmount 执行 | 后端就绪时立即 `clearTimeout(timeoutRef.current)` |
| SQLite schema 缺少 `repo_size`/`default_branch`/`visibility` | 3 个字段 | 改了 MySQL `schema.prisma` 但忘了同步更新 `schema.sqlite.prisma` | 补充字段到 SQLite schema |
| 错误提示说 "MySQL :3307" 但桌面端用的是 SQLite | 1 处 | 错误文案从 Web 端直接复制，未按桌面端实际数据库类型修改 | 改为 SQLite 相关提示 |

### 根因总结

1. **useEffect 副作用清理不完整** — `DesktopInit` 的 `useEffect` 中创建了两个定时器：`pollTimer`（轮询）和 `timeout`（60s 超时）。代码在 `setState('ready')` 时停止了轮询，但**完全忘了清除超时定时器**。React effect 的 cleanup 只在组件卸载时执行（`[]` deps），所以这个 timeout 就像一个"定时炸弹"——即使应用已正常加载，60s 后仍会触发 `setState('error')` 覆盖整个页面。

   **核心错误**：创建 side-effect 资源（timer/subscription/interval）时，必须在**不再需要它的时机**主动释放，而不仅是等组件卸载。就绪后 timeout 已经没有意义了，就应该立刻清除。

2. **双 Schema 文件又双叒叕漏改** — 第九次复盘刚总结完"改了 A 漏了 B"的问题，第十次就又一次上演：改了 MySQL schema 忘了改 SQLite schema。两个文件名字不同但内容高度相似，天然容易产生不一致。

3. **硬编码文案脱离上下文** — "MySQL :3307" 这个文案在 Web 端是正确的，但在桌面端打包代码中原样保留就是错误的。复制粘贴时没有考虑运行环境的差异。

### 对 AI 助手的新约束

#### P0: useEffect 中创建的定时器必须在业务条件满足时主动清除（新增）

当在 `useEffect` 中创建 `setTimeout`/`setInterval` 做超时保护或轮询时：

- [ ] 超时/轮询的**终止条件**到达后，是否立即 `clearTimeout`/`clearInterval`？
- [ ] 不仅仅依赖 cleanup 函数（cleanup 只在 unmount 或 deps 变化时执行）
- [ ] 检查清单：
  - 轮询成功 → clearInterval
  - 超时保护的终态到达（成功/失败）→ clearTimeout
  - 用户手动取消 → clearBoth

**反面案例：**
```typescript
// BAD — timeout 在后端就绪后没被清除，60s 后强制 setState('error')
useEffect(() => {
  const pollBackend = () => {
    getStatus().then(status => {
      if (status.running) setState('ready')
      // ❌ 忘了 clearTimeout(timeout)！
      else setTimeout(pollBackend, 2000)
    })
  }
  pollBackend()
  const timeout = setTimeout(() => setState('error'), 60000) // ← 定时炸弹
  return () => clearTimeout(timeout) // cleanup 只在 unmount 执行，太晚了
}, [])

// GOOD — 就绪时主动清除
useEffect(() => {
  const timeoutRef = { current: null }
  const pollBackend = () => {
    getStatus().then(status => {
      if (status.running) {
        clearTimeout(timeoutRef.current) // ✅ 就绪 → 拆弹
        setState('ready')
      } else {
        setTimeout(pollBackend, 2000)
      }
    })
  }
  pollBackend()
  timeoutRef.current = setTimeout(() => setState('error'), 60000)
  return () => clearTimeout(timeoutRef.current)
}, [])
```

#### P0: Prisma Schema 变更必须同步两个文件（新增）

本项目有**两个 Prisma schema 文件**，修改任意一个时必须同步修改另一个：

| 文件 | 用途 | 数据库 |
|------|------|--------|
| `packages/backend/prisma/schema.prisma` | Web 端开发/生产 | MySQL |
| `packages/backend/prisma/schema.sqlite.prisma` | 桌面端 Electron 打包 | SQLite |

- [ ] 新增/修改/删除字段 → 两个文件都要改
- [ ] 新增/修改/删除表 → 两个文件都要改
- [ ] SQLite 版**不得**包含 `@db.VarChar`、`@db.TinyInt`、`@db.Text`、`@db.DateTime` 等 MySQL 专属类型注解
- [ ] SQLite 版的 ID 字段类型为 `Int`（不是 `BigInt`）
- [ ] 改完后 `git diff --stat` 必须同时包含两个 schema 文件

#### P1: 文案必须区分运行环境（新增）

所有面向用户的提示文案（error message、toast、warning）必须考虑运行环境差异：

- [ ] Web 端（MySQL）→ 提示 MySQL 相关信息
- [ ] 桌面端（SQLite、Electron）→ 提示 SQLite 相关信息，不提及 MySQL
- [ ] 如果文案在两个环境通用，确保不包含环境特定的技术细节

### 编码约束（第十次更新）

| 规则类别 | 要求 | 强制级别 |
|---------|------|---------|
| 定时器生命周期管理 | useEffect 中的 timer 必须在业务终态到达时主动 clear，不依赖 cleanup | P0 |
| Schema 双文件同步 | 改 `schema.prisma` 必须同步改 `schema.sqlite.prisma`，git diff 必须同时包含两者 | P0 |
| 文案环境区分 | 用户提示文案必须区分 Web/Desktop 环境，不硬编码 MySQL 等环境特定信息 | P1 |

---

## 踩坑记录索引

本项目历次部署/运维过程中踩过的坑及解决方案，**执行相关操作前必须先读对应文档**：

| 场景 | 文档 | 触发时机 |
|------|------|---------|
| Docker Compose 环境变量加载失败 | [docs/踩坑记录-DockerCompose环境变量加载失败.md](docs/踩坑记录-DockerCompose环境变量加载失败.md) | 执行 `docker compose up -d` / 重启生产容器 / 部署后端镜像前 |
| Agent 对话 EPIPE 管道崩溃 | [docs/踩坑记录-Agent对话EPIPE管道崩溃.md](docs/踩坑记录-Agent对话EPIPE管道崩溃.md) | Agent 长任务流式中断、出现 `write EPIPE` / `exited with code 1`、assistant 回复丢失时 |

**新增踩坑记录规范**：
1. 文档放在 `docs/` 目录，文件名格式 `踩坑记录-<主题>.md`
2. 文档内容必须中文，包含：问题现象 / 根本原因 / 正确做法 / 验证检查清单 / 教训
3. 在上方的索引表中追加一行，说明触发时机
4. 提交时同时提交文档与索引更新
