---
trigger: always_on
---
# 目录结构规范

> 本规则定义了何时创建目录、何时保持文件在根级、目录命名规范以及面向长远扩展的目录组织原则。

## 何时创建目录

当满足以下任一条件时，必须创建独立目录来组织文件：

### 相关文件数量 ≥ 3 个

当一个概念/功能包含 3 个及以上的相关文件时，应将这些文件归入同一目录。

```
// BAD — 3 个相关文件平铺在根级
src/pages/
├── UserList.tsx
├── UserList.test.tsx
├── UserList.styles.ts
├── UserDetail.tsx
├── UserDetail.test.tsx
├── UserDetail.styles.ts

// GOOD — 按功能归入目录
src/pages/
├── UserList/
│   ├── index.tsx
│   ├── UserList.test.tsx
│   └── UserList.styles.ts
├── UserDetail/
│   ├── index.tsx
│   ├── UserDetail.test.tsx
│   └── UserDetail.styles.ts
```

### 需要自己的注册/索引文件时

当模块需要一个统一的入口文件（`index.ts`/`index.tsx`）来对外暴露 API 时，必须创建目录。

```
// GOOD — 通过 index.ts 统一导出
components/Button/
├── index.ts          // export { Button } from './Button'
├── Button.tsx
├── Button.test.tsx
└── Button.styles.ts
```

### 存在子功能的层级划分时

当模块内部存在明确的子功能划分时，应通过子目录表达层级关系。

```
// GOOD — 子功能通过子目录体现
features/payment/
├── checkout/
│   ├── CartSummary.tsx
│   └── PaymentForm.tsx
├── history/
│   ├── TransactionList.tsx
│   └── TransactionDetail.tsx
└── index.ts
```

## 何时放在根级

当满足以下所有条件时，文件可直接放在模块根级：

| 条件 | 说明 |
|------|------|
| **功能完整** | 单个文件能完整表达模块的全部功能，无需辅助文件（测试文件/样式文件除外） |
| **边界清晰** | 功能边界明确，与同目录其他文件无直接耦合，不需要进一步拆分 |
| **高频引用** | 被多个其他模块直接引用，放在根级可减少导入路径深度 |

```
// GOOD — 单个文件完整表达功能，直接放在根级
utils/
├── formatDate.ts        // 单一职责的工具函数
├── validateEmail.ts     // 单一职责的验证函数
├── constants.ts         // 全局常量定义
├── api/
│   └── client.ts        // 即使 api 下只有一个文件，概念性强也应建目录（见"长远扩展考虑"）
└── hooks/
    └── useAuth.ts       // hooks 是概念边界，即使只有一个文件也应建目录
```

## 目录命名规范

### 核心原则：一个目录只代表一个**概念边界**

- 目录命名应清晰反映其所包含的功能或组件类型
- 同一层级目录之间不应存在功能重叠
- 禁止创建含义模糊的目录（如 `misc/`、`utils/` 下堆砌所有杂项）

### 命名风格

| 场景 | 风格 | 示例 |
|------|------|------|
| 功能/页面目录 | PascalCase | `UserProfile/`、`OrderDetail/` |
| 工具/服务/配置目录 | kebab-case 或 camelCase | `date-utils/`、`apiClient/` |
| 组件目录 | PascalCase | `StarCard/`、`SearchInput/` |
| Hooks 目录 | camelCase 前缀 use（仅目录内容命名遵循） | `hooks/useAuth.ts` |

### 禁止事项

- ❌ 一个目录下同时混放完全不相关的多个概念
- ❌ 目录名与其中文件的实际内容不符
- ❌ 嵌套过深（>4 层目录）——超过 4 层说明概念拆分需要重新审视

## 长远扩展考虑

### 概念性强的模块必须预建目录

对于概念性强的模块（如页面、功能模块、API 层等），即使当前只有一个文件，也要创建文件夹进行管理，以便未来扩展：

```
// GOOD — 即使当前只有一个文件，也为未来扩展预留目录结构
pages/
├── Settings/
│   └── index.tsx          // 未来可能加入 Settings.security.tsx、Settings.privacy.tsx
├── Dashboard/
│   ├── index.tsx
│   └── widgets/           // 预建子目录，即使当前为空
│       └── .gitkeep
api/
├── user/
│   └── index.ts           // 未来可能加入 user.profile.ts、user.settings.ts
└── order/
    └── index.ts

// BAD — 单文件平铺，扩展时需大规模重构迁移
pages/
├── Settings.tsx
├── Dashboard.tsx
api/
├── user.ts
├── order.ts
```

### 各层级的目录组织策略

| 层级 | 策略 | 说明 |
|------|------|------|
| **页面级功能** | 按页面名称创建独立目录 | 每个页面一个文件夹，页面内部子模块按需建子目录 |
| **功能模块** | 按功能类型创建独立目录 | 如 `auth/`、`payment/`、`search/`，每个功能模块内部自包含 |
| **公共组件** | 放在专门的 `components/` 目录 | 跨页面/跨模块复用的组件，按组件名建子目录 |
| **工具函数** | 按功能类型组织在 `utils/` 目录 | 如 `utils/date/`、`utils/format/`、`utils/validation/` |
| **Hooks** | 放在 `hooks/` 目录 | 按功能分组或直接放根级（单文件时），如 `hooks/useAuth.ts` |
| **类型定义** | 放在 `types/` 目录 | 按领域分子目录，如 `types/user.ts`、`types/api.ts` |
| **API/服务层** | 放在 `api/` 或 `services/` 目录 | 按资源/领域分子目录 |

## 代码审查检查清单

在审查代码变更时，检查以下目录结构相关问题：

1. 新增的多个相关文件是否已归入适当的目录？
2. 是否存在单文件平铺在根级但概念上属于某个已有目录的情况？
3. 新创建的目录命名是否清晰反映其概念边界？
4. 是否存在目录嵌套超过 4 层的情况？
5. 是否为未来可预见的扩展预留了目录结构？
6. 重构后是否清理了旧的空目录或不再使用的目录？

## 与其他规则的集成

此规则与以下规则配合：

- [coding-style.md](coding-style.md) - 文件组织原则（高内聚低耦合、按功能组织）
- [code-review.md](code-review.md) - 代码审查标准
- [frontend-constraints.md](frontend-constraints.md) - 前端组件文件命名与目录放置
