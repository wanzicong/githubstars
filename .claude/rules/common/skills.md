# 技能加载规则（硬约束 — P0）

> ⚠️ 用 Skill 工具调用，禁止手动 Read SKILL.md 文件。

## 正确方式

项目技能在 `.claude/skills/` 目录下，**直接用 Skill 工具调用**：

```
用户说"我要改下载模块"
→ 匹配技能：nestjs-patterns, backend-patterns
→ Skill({ skill: 'nestjs-patterns' })  ← 工具自动加载内容
→ Skill({ skill: 'backend-patterns' })  ← 工具自动加载内容
→ 开始编码
```

## 错误方式（上一轮的问题）

```
Read .claude/skills/INDEX.md ✅
→ Read backend-patterns/SKILL.md   ❌ 不应该手动 Read
→ 实际上我连 Read 都没做，直接写代码了
```

## 匹配规则

| 任务 | 调用 Skill |
|------|-----------|
| 后端 NestJS 修改 | `nestjs-patterns`, `backend-patterns` |
| API 设计 | `api-design` |
| 前端 React | `frontend-patterns` |
| 代码审查 | `coding-standards` |
| 安全审查 | `security-review` |
| 数据库 | `database-migrations` |
| TDD | `tdd-workflow` |
| 复盘 | `continuous-learning` |
| 不确定匹配哪些 | 先调 `skill-stocktake` |

## 技能 + 智能体 配合流程

完整的开发流程应该是：

```
第一步（Skill 工具）：加载匹配的技能文件
    Skill({ skill: 'nestjs-patterns' })
    Skill({ skill: 'backend-patterns' })

第二步（Agent 工具）：执行任务
    见 .claude/rules/common/agents.md 的 P0 强制智能体使用表

第三步（开发工作流）：
    见 .claude/rules/common/development-workflow.md 的七阶段流程
```

**三个必须都执行，不能跳过任何一个。**
