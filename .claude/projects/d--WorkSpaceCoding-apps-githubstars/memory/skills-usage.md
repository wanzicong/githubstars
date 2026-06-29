---
name: skills-usage-workflow
description: 技能索引和加载流程，确保每次对话开始时按任务类型加载对应技能
metadata:
  type: project
---

对话开始时必须先查看 `.claude/skills/INDEX.md`，匹配当前任务类型后加载对应的 `.claude/skills/*/SKILL.md` 文件再编码。

不要混淆 Skills（参考文档）和 Agents（可执行工具）。

关键文件：
- `.claude/skills/INDEX.md` — 任务 → 技能映射表
- `.claude/rules/common/skills.md` — 强制启动流程
- `CLAUDE.md` 尾部 — 技能使用指南

**Why:** 本次对话中有 102 个技能未使用，导致编码标准不统一、遗漏 test、缺少复盘等。
**How to apply:** 任何新对话开始后的第一步就是看 INDEX.md，第二步 Read 匹配的技能文件。
