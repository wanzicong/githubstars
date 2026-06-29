---
name: agents-usage-workflow
description: 智能体强制使用流程，对话开始后先加载技能，再根据场景调用对应智能体
metadata:
  type: project
---

## 对话启动三步流程（P0，不可跳过）

1. **Skill 工具**加载匹配的技能
2. 对照 `agents.md` 的 P0 强制表，判断当前场景需要哪个智能体
3. 用 Agent 工具调用对应智能体

## 关键规则文件

- `.claude/rules/common/agents.md` — 智能体触发场景表
- `.claude/rules/common/skills.md` — 技能加载 + 智能体配合流程
- `.claude/rules/common/development-workflow.md` — 七阶段工作流

## 本轮对话违反的记录

| 场景 | 应该调用的智能体 | 实际行为 |
|------|-----------------|---------|
| 修改 download.service.ts 170+ 行 | code-reviewer | 没调用，用户要求才做 |
| 分支检测架构变更 | architect | 没调用 |
| 404 bug 修复 | tdd-guide | 没调用 |
| 开发工作流 | 7个阶段 | 全部跳过 |

**Why:** agents.md 虽然有 `always_on` 一直在上下文中，但语言太软被忽略了。
**How to apply:** 每次开始新任务前，对照 agents.md 的 P0 强制表逐一确认。
