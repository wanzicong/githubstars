# 技能索引

> 对话开始时，根据用户请求匹配以下任务类型，加载对应技能。
> 如果涉及多个类型，加载全部匹配技能。

## 后端开发

| 任务 | 加载技能 |
|------|----------|
| 修改 NestJS Controller/Service/Module | `nestjs-patterns` |
| 新增/修改 API 端点 | `api-design`, `backend-patterns` |
| 数据库查询/Prisma 操作 | `backend-patterns`, `postgres-patterns` |
| 迁移数据库 Schema | `database-migrations` |
| 新增 npm 依赖/包管理 | `nodejs-keccak256`（仅限当前依赖） |

## 前端开发

| 任务 | 加载技能 |
|------|----------|
| 修改 React 组件/页面 | `frontend-patterns` |
| UI 组件/设计系统 | `frontend-design`, `design-system` |
| 可访问性相关 | `accessibility` |
| 前端性能优化 | `frontend-patterns` |

## 代码质量

| 任务 | 加载技能 |
|------|----------|
| 代码审查 | `coding-standards`, `code-review`（注意：不是 agent，是 skill 目录下的参考文档） |
| 安全审查 | `security-review` |
| TDD/编写测试 | `tdd-workflow` |
| 重构/清理 | `coding-standards`, `parallel-execution-optimizer` |
| 架构决策 | `architecture-decision-records` |

## 项目运维

| 任务 | 加载技能 |
|------|----------|
| Git 操作/PR | `git-workflow` |
| GitHub 操作 | `github-ops` |
| Docker/容器化 | `docker-patterns` |
| 部署 | `deployment-patterns` |
| E2E 测试 | `e2e-testing`, `browser-qa` |

## 通用

| 任务 | 加载技能 |
|------|----------|
| 复盘/从错误中学习 | `continuous-learning` |
| 技能合规性检查 | `skill-comply`, `skill-stocktake` |
| 深度研究/调研 | `deep-research`, `search-first` |
| 文档编写 | `article-writing` |

---

## P0 强制操作方式

对话开始后：

1. 看本文件 → 确认当前任务匹配哪些技能
2. **用 Skill 工具调用每个匹配的技能**：`Skill({ skill: '技能名' })`
3. 工具自动加载内容后，才能开始读项目代码

**注意：严禁手动 Read SKILL.md，必须用 Skill 工具调用。**
