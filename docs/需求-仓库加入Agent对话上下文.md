# 需求设计：仓库加入 Agent 对话上下文（详细了解仓库）

> 状态：设计评审稿 · 日期：2026-08-01 · 关联提交：`d86140f`（token 超限自动重开，已落地）

---

## 一、背景与目标

用户在浏览**仓库列表**或**仓库详情**时，经常想"就这个仓库跟 AI 深入聊一聊"（它是做什么的、架构如何、怎么用、值不值得学）。目前 Agent 对话页虽然已有上下文选择器（ContextPicker），但用户必须**先记住仓库名 → 切到对话页 → 手动搜索勾选**，链路长、打断浏览心流。

**目标**：在仓库列表 / 详情页加一个 **"加入对话上下文"** 按钮，一键把仓库注入 AI 对话上下文并跳转到对话页，让用户立即就这个仓库向 Agent 提问、获得"详细了解"。

### 探索发现的关键结论（决定本方案可行且改动小）

| 维度 | 结论 | 证据 |
|---|---|---|
| 后端 context 链路 | **已完整支持**，无需改接口 | `POST /api/agent/chat` 接受 `context:{repoIds,categoryIds}`，zod 上限 repoIds≤20（[agent-request.dto.ts:11](../../packages/backend/src/agent/dto/agent-request.dto.ts)） |
| 上下文注入位置 | 拼进 **system prompt**，仅注入元信息（fullName/描述/语言/星数），**不拉 README** | [agent-client.service.ts:329-365](../../packages/backend/src/agent/agent-client.service.ts) |
| "详细了解"能力 | **已有**：`stars_detail` 工具按 id 拉含 README 的完整详情（8000 字符截断）+ `analyze-project-structure` Skill | [system-tools.ts:169](../../packages/backend/src/agent/mcp/system-tools.ts) |
| 唯一缺口 ① | `contextItems` 是 AgentChat **组件内 useState**，刷新即丢、外部页面无法写入 | [AgentChat/index.tsx:1052](../../packages/frontend/src/pages/AgentChat/index.tsx) |
| 唯一缺口 ② | 上下文**不落库**，resume 会话后丢失（`AgentSession.metadata` 字段闲置） | [schema.prisma:212](../../packages/backend/prisma/schema.prisma) |
| 跨页跳转 | AgentChat 由 DefaultLayout **常驻挂载**（切路由不卸载），不能用 mount effect 接参，需用 store 订阅 | [layouts/default/Index.tsx:63](../../packages/frontend/src/layouts/default/Index.tsx) |

**结论：本需求 90% 是前端状态改造 + 按钮接线，后端只需小幅增强。**

---

## 二、用户故事与验收标准

| # | 用户故事 | 验收标准 |
|---|---|---|
| US-1 | 作为用户，在仓库**列表卡片/行**上点"问 AI"，把该仓库加入对话上下文 | 点击后跳到对话页，chip 区出现该仓库 chip，输入框可立即提问 |
| US-2 | 作为用户，在仓库**详情页**点"问 AI"，就当前仓库深入了解 | 同上；进入对话页后 Agent 能基于该仓库元信息回答，并能主动调 `stars_detail` 拉 README 深入分析 |
| US-3 | 作为用户，在列表**勾选多个仓库**后批量"加入上下文" | 选中 N 个 → 批量栏点"加入对话上下文"→ 跳对话页出现 N 个 chip（受 repoIds≤20 上限约束） |
| US-4 | 作为用户，加入上下文后**刷新页面**，chip 不丢 | 刷新后对话页 chip 区仍显示已选仓库 |
| US-5 | 作为用户，**恢复（resume）历史会话**时上下文仍生效 | resume 的会话仍能带上当时的仓库上下文，不丢 |
| US-6 | 作为用户，Agent 能"详细了解"仓库，而不只是泛泛而谈 | 提问后 Agent 能调用 `stars_detail` / `analyze-project-structure` 给出 README 级、结构级的深入回答 |

---

## 三、功能设计

### 3.1 交互流程

```
仓库列表(卡片/行) 或 详情页
   │  点击「问 AI」图标按钮（单仓库）
   │  或 勾选多个 → 批量栏点「加入对话上下文」（多仓库）
   ▼
① 写入 zustand store：addPendingContext({type:'repo', id, label})
② navigate('/agent')
   ▼
AgentChat（常驻组件，订阅 store）
   │  检测到 pendingContextItems 变化 → 合并进 contextItems（去重）→ 清空 pending
   ▼
对话页 chip 区出现该仓库 chip（ContextPicker 收纳）
   │  用户输入问题（如"这个仓库是做什么的？架构如何？"）→ 发送
   ▼
后端 buildContextSection 注入元信息 → Agent 回答，并主动调 stars_detail 拉 README 深入分析
```

### 3.2 界面改动点

| 位置 | 文件 | 改动 |
|---|---|---|
| 网格卡片按钮区 | [RepoCard.tsx:147-244](../../packages/frontend/src/components/stars/RepoCard.tsx) | 加 `RobotOutlined` 图标按钮，复用现有 `e.stopPropagation()` + Tooltip 模式 |
| 列表行按钮区 | [RepoRow.tsx:99-158](../../packages/frontend/src/components/stars/RepoRow.tsx) | 同上 |
| 详情页顶部操作区 | [RepoDetailView.tsx:109-146](../../packages/frontend/src/components/repo/RepoDetailView.tsx) | 加"问 AI"按钮，与 Issues/代码预览并列 |
| 批量操作栏 | [StarActionBar.tsx:75-94](../../packages/frontend/src/pages/StarList/components/StarActionBar.tsx) | 加"加入对话上下文"批量按钮（选中时出现） |
| 按钮透传 | [StarRepoView.tsx:11-36](../../packages/frontend/src/components/stars/StarRepoView.tsx) | Props 加 `onAskAi` 回调，透传到 Card/Row |

### 3.3 核心状态改造（关键）

**把 `contextItems` 从 AgentChat 组件内 useState 上移到 zustand store**，并新增"待注入"通道：

`stores/modules/agentChat.ts`（[现状:16-71](../../packages/frontend/src/stores/modules/agentChat.ts)）扩展：

```ts
// 新增字段
contextItems: ChatContextItem[]            // 持久化（解决 US-4 刷新不丢）
pendingContextItems: ChatContextItem[]     // 不持久化，跨页一次性注入
// 新增 action
addPendingContext(item: ChatContextItem)   // 列表/详情页调用（去重）
consumePendingContext(): ChatContextItem[] // AgentChat 消费后清空
setContextItems(items)                     // ContextPicker onChange 接这里
```

- `contextItems` 进 `partialize` 持久化 → 解决刷新丢失（US-4）
- AgentChat 内用一个 effect 订阅 `pendingContextItems`，非空时合并进 `contextItems` 并清空 —— 适配常驻挂载（不能用 mount effect，参考现有 `?session=` 同步模式 [index.tsx:1294](../../packages/frontend/src/pages/AgentChat/index.tsx)）

---

## 四、技术方案（前后端）

### 4.1 前端（主要工作量）

| # | 改动 | 文件 |
|---|---|---|
| F1 | store 扩展：`contextItems`/`pendingContextItems` + 3 个 action | `stores/modules/agentChat.ts` |
| F2 | AgentChat：contextItems 改从 store 读写；effect 消费 pending 合并 | `pages/AgentChat/index.tsx` |
| F3 | 加"问 AI"按钮 + 透传回调 | RepoCard / RepoRow / RepoDetailView / StarRepoView |
| F4 | 批量栏加"加入对话上下文"，复用 `resolveSelectedRepos` 补拉跨页选中数据 | `StarActionBar.tsx` + `StarList/index.tsx`（参考克隆向导 :338-360） |
| F5 | 新增 hook `useAddRepoContext()`：写 store + navigate | `pages/AgentChat/hooks/` 或 `stores/` |
| F6 | `AgentRequest` 接口补 `context` 字段（类型缺口） | `api/agent.ts:3-11` |

### 4.2 后端（小幅增强）

| # | 改动 | 说明 | 文件 |
|---|---|---|---|
| B1 | **上下文随会话持久化**：首次发送带 context 时存入 `AgentSession.metadata`，resume 时若前端未带则自动回填 | 解决 US-5；复用闲置的 `metadata` Json 列 | [agent-client.service.ts](../../packages/backend/src/agent/agent-client.service.ts) / [agent-session.service.ts:45-50](../../packages/backend/src/agent/agent-session.service.ts) |
| B2 | **截断字段名修正**：`truncateRepoReadme` 当前截 `readme/readmeCn`，但 DB 实际是 `readmeOriginal/readmeCn`，`readmeOriginal` 漏截 | 防单仓库 README 超长撑爆 token（与已落地的超限防护呼应） | [system-tools.ts:67-79](../../packages/backend/src/agent/mcp/system-tools.ts) |
| B3 | **SYSTEM_PROMPT 强化**：明确"上下文中给了仓库 → 主动用 `stars_detail` / `analyze-project-structure` 深入了解后再答" | 满足 US-6"详细了解"；现有行为准则第 2 条已部分覆盖，需点名上下文场景 | [agent.constants.ts:8-28](../../packages/backend/src/agent/agent.constants.ts) |

### 4.3 数据流

```
前端按钮 → store.pendingContextItems → AgentChat 合并 → contextItems
   │ 发送时拆 context:{repoIds:[...]} （上限 20）
   ▼
POST /api/agent/chat ──► zod 校验 ──► buildSystemPrompt(context)
                                         │ findByIds(repoIds) 查本地库
                                         ▼
                          system prompt 注入仓库元信息行
                                         │ 首次存 metadata；resume 时回填
                                         ▼
                          Agent 收到 → 需要深入时调 stars_detail(id)
                                         │ ensureReadmeFetched → 按需拉 README
                                         ▼
                          返回截断后(≤8000字符)的 README → 深入回答
```

---

## 五、边界与约束

| 边界 | 处理 |
|---|---|
| 只有**本地已 star/已同步**的仓库 id 有效（后端 `findByIds` 查本地库） | 列表/详情页入口天然满足；GitHub 搜索页未入库仓库**不支持**（超出本期范围） |
| repoIds ≤ 20 | 批量加入超 20 时前端拦截提示"最多 20 个"，chip 区去重 |
| 上下文 token 体积 | 仅注入元信息行（不拉 README）；Agent 深入时 `stars_detail` 8000 字符截断兜底 |
| 常驻挂载接参 | 用 store 订阅而非 mount effect（避免 RR7 startTransition URL 延迟竞态，参考 :1294） |
| 刷新页面 | `contextItems` 持久化；`pendingContextItems` 不持久化（一次性） |
| 上下文超限 | 已落地的 token 超限自动重开机制兜底（`d86140f`），README 截断防单点爆量 |

---

## 六、测试策略

| 层 | 用例 |
|---|---|
| 单元（store） | `addPendingContext` 去重；`consumePendingContext` 返回并清空；`contextItems` 持久化 partialize 含 contextItems 不含 pending |
| 单元（组件） | RepoCard/RepoRow/RepoDetailView 点按钮调 onAskAi 且 stopPropagation；StarActionBar 批量按钮显示/隐藏与计数 |
| 单元（后端） | 首次带 context 存 metadata；resume 无 context 时从 metadata 回填；`truncateRepoReadme` 覆盖 `readmeOriginal` |
| 集成 | 列表页点"问 AI"→ 跳对话页 chip 出现 → 发送请求体含 `context.repoIds` |
| 业务验证 | 浏览器实测：列表/详情点按钮 → 对话页 chip → 提问"这个仓库是做什么的"→ Agent 调 stars_detail 返回深入回答 |
| 回归 | ContextPicker 手动增删 chip 仍正常；现有 token 超限重开流程不受影响 |

---

## 七、改动范围评估（预估）

| 项 | 评估 |
|---|---|
| 直接改动 | 前端 6 文件 + store；后端 3 文件；新增 1 hook + 测试 |
| API 变化 | 无破坏（context 已存在，仅 metadata 回填为内部行为） |
| DB 变化 | 无（复用闲置 `metadata` 列，**不涉及 schema 变更**） |
| 跨模块 | 影响 AgentChat、StarList、详情页三处前端；Agent/会话两个后端模块 |
| **风险等级** | **中**（多文件、有调用链变化，但无破坏性变更） |

---

## 八、建议实施顺序

1. **F1 store 扩展**（地基，先做）
2. **F6 后端 B1/B2/B3**（可并行，小改）
3. **F2 AgentChat 接线**（消费 pending + 读写 store）
4. **F3/F4/F5 按钮与 hook**（列表/详情/批量入口）
5. 单元测试 + 浏览器实测（P0：写完前端必须浏览器验证）

---

## 九、待确认的开放点

1. **B1 会话上下文持久化**是否纳入本期？（resume 回填增强体验，但非按钮链路的必需项 —— 不纳入则 resume 后上下文丢失，需用户重选）
2. **B3 SYSTEM_PROMPT 强化**是否本期做？（决定"详细了解"是 Agent 自动触发还是需用户追问）
3. 按钮文案/图标：`问 AI` vs `加入上下文` vs `深入了解`；图标 `RobotOutlined` 还是其他？
4. 是否需要"加入上下文但不跳转"的轻量模式（连续加多个再一起去对话页）？
