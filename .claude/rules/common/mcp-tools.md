# MCP 工具调用规则（硬约束 — P0）

> 特定场景必须使用对应 MCP 工具，违反即错误。

## 场景 → 工具硬绑定

| # | 场景 | 必须使用 | 禁止使用 | 原因 |
|---|------|---------|---------|------|
| 1 | **搜索代码、函数定义、引用关系** | Serena `find_symbol` / `find_referencing_symbols` | Grep / Bash grep | Serena 理解符号结构，Grep 只匹配文本 |
| 2 | **编辑代码（替换/插入/删除）** | Serena `replace_content` / `insert_after_symbol` | Edit / Write（手动修改） | Serena 精确到符号级，不会错位 |
| 3 | **查库框架/API 文档** | Context7 `query-docs` | WebFetch（搜网页） | Context7 精确到版本，WebFetch 内容不可控 |
| 4 | **浏览器 E2E 测试** | Playwright `browser_navigate` + `browser_snapshot` | 仅命令行模拟 | 真实浏览器才能验证 UI 交互 |
| 5 | **复杂多步推理** | Sequential Thinking `sequentialthinking` | 直接在脑中推理然后输出 | Sequential Thinking 可回溯修正 |
| 6 | **写入记忆 / 读取记忆** | Memory `write_memory` / `read_memory` / `search_nodes` | 写到本地文件 | Memory 工具自动索引，对话可检索 |
| 7 | **搜索最新信息** | WebSearch | 凭空猜测 | 节省 token，答案准确 |

## 触发时机

| 场景 | 发生时 |
|------|--------|
| 需要理解一段代码的调用链 | → **立即**用 Serena find_referencing_symbols |
| 需要改代码 | → **立即**用 Serena replace_content |
| 用户问某个库的 API | → **立即**用 Context7 query-docs |
| 用户要求测功能 | → **立即**用 Playwright |
| 问题需要分步推理 | → **立即**用 Sequential Thinking |
| 架构方案对比（多种方案选哪种） | → **立即**用 Sequential Thinking |
| Bug 追踪（现象→根因→修复方案） | → **立即**用 Sequential Thinking |
| 代码审查需要系统性分析 | → **立即**用 Sequential Thinking |
| 设计实现方案 | → **立即**用 Sequential Thinking |
| 学到了新知识/教训 | → **立即**用 Memory write_memory |

## 为什么默认工具不够

| 内置工具 | 问题 | MCP 替代优势 |
|---------|------|-------------|
| `Grep` | 只匹配文本，不理解函数/类边界 | Serena 知道 `class Foo { method() {} }` 的完整结构 |
| `Edit` | 必须精确匹配字符串，缩进不对就失败 | Serena 直接替换符号体，不关心缩进 |
| `Read` | 读整文件，浪费 token | Serena 只读符号体，精准定位 |
| `WebFetch` | 随机抓网页，内容不稳定 | Context7 返回精确的版本化文档 |
| `Bash` | 需要自己写脚本 | Playwright 直接操作浏览器 |

## 违反示例（本对话）

```
搜索 download.service.ts 的函数 → 用 Grep ❌ 应该用 Serena find_symbol
编辑 createTask 方法 → 用 Edit ❌ 应该用 Serena replace_content
查 NestJS Prisma 用法 → 没查 ❌ 应该用 Context7
```

## 验证

编码过程中，每做一个操作前问自己：
"现在有 MCP 工具可以做这个吗？如果有，是哪个？"

如果有匹配的 MCP 工具但没有调用 = 违反 P0。
