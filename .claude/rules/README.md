---
trigger: manual
alwaysApply: false
---
# 规则

## 结构

规则被组织为一个**通用**层加上**语言特定**的目录：

```
rules/
├── common/          # 语言无关原则（始终安装）
│   ├── agents.md
│   ├── code-review.md
│   ├── coding-style.md
│   ├── comments.md
│   ├── dead-code.md
│   ├── dependency-management.md
│   ├── development-workflow.md
│   ├── directory-structure.md
│   ├── frontend-constraints.md
│   ├── git-workflow.md
│   ├── hooks.md
│   ├── patterns.md
│   ├── performance.md
│   ├── security.md
│   └── testing.md
└── typescript/      # TypeScript/JavaScript 特定（本项目技术栈）
```

* **common/** 包含通用原则 —— 没有语言特定的代码示例。
* **语言目录** 通过框架特定的模式、工具和代码示例来扩展通用规则。每个文件都引用其对应的通用文件。

## 安装

### 选项 1：安装脚本（推荐）

```bash
# 本项目为 TypeScript (NestJS + React) 技术栈
./install.sh typescript
```

## 规则与技能

* **规则** 定义广泛适用的标准、约定和检查清单（例如，”80% 的测试覆盖率”、”没有硬编码的密钥”）。
* **技能**（`skills/` 目录）为特定任务提供深入、可操作的参考材料。

语言特定的规则文件会在适当的地方引用相关的技能。规则告诉你*要做什么*；技能告诉你*如何去做*。

## 规则优先级

当语言特定规则与通用规则冲突时，**语言特定规则优先**（具体规则覆盖通用规则）。这遵循标准的分层配置模式。

* `rules/common/` 定义了适用于所有项目的通用默认值。
* `rules/typescript/` 在 TypeScript/JavaScript 习惯不同时覆盖这些默认值。

### 带有覆盖说明的通用规则

`rules/common/` 中可能被语言特定文件覆盖的规则会标记为：

> **语言说明**：对于此模式不符合语言习惯的语言，此规则可能会被语言特定规则覆盖。
