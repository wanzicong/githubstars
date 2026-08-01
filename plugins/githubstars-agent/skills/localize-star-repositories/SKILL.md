---
name: localize-star-repositories
description: Translate GitHub Star repository descriptions and README Markdown into Chinese via an agent-driven workflow. Use when the user asks to translate, localize, or fill missing Chinese fields for Star repositories. The agent fetches untranslated originals, produces the Chinese text itself, and writes results back — no backend translation task is created.
---

# Localize Star Repositories

中文化已改为**智能体工作流**：后端只提供数据接口，翻译由你（智能体模型）完成。不要寻找或等待任何后端翻译任务。

两个数据接口（插件工具 `mcp__plugin_githubstars-agent_githubstars__*`，兼容别名 `mcp__system__localization_*`）：

- `localization-pending` → 返回待翻译仓库及其**原文**。字段为 `null` 表示该字段无需翻译。
- `localization-update` → 批量写入你产出的译文（只更新，不翻译）。每项需 `repoId` + `descriptionCn`/`readmeCn` 至少其一，单次最多 500 条。

## 工作流

### 1. 取原文
调用 `localization-pending`，按需设 `limit`（一次建议 20~50）、`includeDescription` / `includeReadme`。
- 返回为空 → 告知用户"没有待翻译内容"，结束。
- 每个 `repoId` 可能只有 `description`、只有 `readme`、或两者都有。

### 2. 并发翻译（你产出译文）
对每条原文产出中文译文，遵守翻译规范（见下）。

**并发要求：目标 10~20 个并发，最多不超过 20。** 你通过"分片 + 并行子任务"实现：
- 将待翻译记录按字段拆成翻译单元（一个 description 或一段 README 为一个单元）。
- 把单元分成若干批，每批最多 20 个。
- 使用 Skill / 并行任务（如 Task 工具）让多个翻译子任务**同时**进行，单批并发不超过 20。
- 不要串行逐条翻译；也不要一次性发起超过 20 个并行翻译。

**翻译规范：**
- 只翻译自然语言；保留 Markdown 结构、代码块、命令、URL、HTML、徽章、技术标识原样。
- README 很长时按逻辑分段翻译后再拼接，保持结构完整。
- 描述译为简洁准确的中文，保留必要技术术语。

### 3. 写回译文
把本批译文通过 `localization-update` 写入：
- `descriptionCn` 对应描述译文，`readmeCn` 对应 README 译文，缺哪个就不传哪个。
- 单批超过 500 条时分多次调用。
- 接口返回 `updated` / `skippedRepoIds`，据此核对是否全部写入。

### 4. 循环与汇总
- 若仍有未翻译内容，再次调用 `localization-pending` 取下一批，重复 2~3 步，直到无待翻译内容或达到用户指定范围。
- 最后向用户汇报：处理仓库数、描述/README 各自翻译条数、跳过/失败条数及原因。
- 只有 `localization-update` 返回成功才可声称译文已保存。

## 注意
- 不要创建或轮询任何"翻译任务"——该模式已废弃。
- 用户未明确要求时，不要覆盖已有中文内容（`localization-pending` 默认只返回未翻译的）。
