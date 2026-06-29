---
name: mcp-tools-usage
description: MCP 工具强制调用规则，场景→工具硬绑定
metadata:
  type: project
---

## 核心规则

`.claude/rules/common/mcp-tools.md` 定义了场景→工具的硬绑定表。

搜索代码必须用 Serena（禁止 Grep）
编辑代码必须用 Serena（禁止 Edit）
查文档必须用 Context7
复杂推理必须用 Sequential Thinking

## 违反记录

本对话中多处用 Grep 替代 Serena find_symbol，用 Edit 替代 Serena replace_content。

**Why:** 习惯了内置工具，没有"先想MCP"的肌肉记忆。
**How to apply:** 每次操作前问自己"有MCP工具可以用吗？"
