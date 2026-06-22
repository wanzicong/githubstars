---
trigger: always_on
---

# TypeScript/JavaScript 目录结构

> 本文件基于 [common/directory-structure.md](../common/directory-structure.md) 扩展，包含 TypeScript/JavaScript 前端项目特定的目录组织模式。

## 典型前端项目目录结构

```
src/
├── pages/              # 页面级组件（每个页面一个独立目录）
│   ├── StarList/
│   │   ├── index.tsx
│   │   └── components/   # 页面私有子组件
│   └── Dashboard/
│       ├── index.tsx
│       └── widgets/      # 页面级独立功能块
├── components/         # 公共组件（跨页面复用）
│   ├── SearchInput/
│   │   ├── index.tsx
│   │   └── SearchInput.test.tsx
│   └── StarCard/
│       ├── index.tsx
│       ├── StarCard.tsx
│       └── StarCard.styles.ts
├── hooks/              # 自定义 Hooks
│   ├── useAuth.ts
│   ├── useDebounce.ts
│   └── useStarData.ts
├── utils/              # 工具函数
│   ├── date/
│   │   └── formatDate.ts
│   └── validation/
│       └── validateEmail.ts
├── types/              # 全局类型定义
│   ├── star.ts
│   └── api.ts
├── api/                # API 请求层
│   ├── client.ts       # HTTP 客户端（axios/fetch 封装）
│   └── star/
│       └── index.ts    # Star 相关 API 接口
├── store/              # 状态管理
│   └── index.ts
├── styles/             # 全局样式
│   └── global.css
└── App.tsx
```

## 页面目录结构（PascalCase）

每个页面作为独立的概念单元，必须拥有自己的目录：

```
pages/StarList/
├── index.tsx              # 页面入口，组装子组件
├── components/            # 页面私有子组件
│   ├── StarTable.tsx
│   ├── StarFilter.tsx
│   └── StarPagination.tsx
├── hooks/                 # 页面私有 Hooks
│   └── useStarSearch.ts
├── types.ts               # 页面私有类型
└── StarList.test.tsx
```

**规则：**
- 页面入口文件统一命名为 `index.tsx`
- 页面私有子组件放在 `components/` 子目录中
- 页面私有 Hooks 放在 `hooks/` 子目录中
- 页面私有类型放在 `types.ts` 中

## 公共组件目录结构（PascalCase）

每个公共组件必须拥有自己的目录，使用 `index.ts` 统一导出：

```
components/StarCard/
├── index.ts               // export { StarCard } from './StarCard'
├── StarCard.tsx
├── StarCard.test.tsx
├── StarCard.styles.ts
├── StarCard.types.ts      // 组件私有类型
└── components/            // 组件私有子组件（可选）
    └── StarTag.tsx
```

**规则：**
- 组件目录名与组件名一致（PascalCase）
- 使用 `index.ts` 做桶文件（barrel export），简化导入路径
- 组件主文件与目录同名
- 组件超过 3 个辅助文件时必须建目录（即使在迁移过程中）

## barrel export（桶文件导出）

`index.ts` 用于统一导出，避免深层引用：

```typescript
// GOOD — components/Button/index.ts
export { Button } from './Button'
export type { ButtonProps } from './Button.types'

// 使用者只需：
import { Button } from '@/components/Button'

// BAD — 没有 index.ts，使用者需要：
import { Button } from '@/components/Button/Button'
```

## 嵌套深度规则

- 目录嵌套**最多 4 层**，超过 4 层应重新审视概念拆分
- 合理嵌套示例：`src/pages/StarList/components/filters/DatePicker.tsx`（4 层：pages > StarList > components > filters > 文件）

```typescript
// GOOD — 嵌套 3 层，结构清晰
features/payment/checkout/Steps/
├── index.ts
├── StepOne.tsx
└── StepTwo.tsx

// BAD — 嵌套 6 层，过度拆分
components/forms/payment/card/inputs/securityCode/index.tsx
```

## import 路径规范

目录结构应使 import 路径简洁明了：

```typescript
// GOOD — 使用 barrel export 减少路径深度
import { StarCard } from '@/components/StarCard'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/hooks/useAuth'

// GOOD — 页面私有子组件的相对导入
import { StarFilter } from './components/StarFilter'

// BAD — 深层路径引用
import { StarCard } from '@/components/StarCard/StarCard/StarCard'
```

## 代码审查检查清单（前端专项）

1. 新增的页面是否创建了独立目录而非单文件？
2. 公共组件是否放在 `components/` 下并有自己的子目录？
3. 组件的 `index.ts` barrel export 是否已正确配置？
4. 页面私有组件是否放在了页面目录的 `components/` 子目录中？
5. import 路径是否使用了 barrel export 而非深层路径？

## 参考

有关通用目录结构原则，请参见 [common/directory-structure.md](../common/directory-structure.md)。
有关前端组件规范，请参见 [frontend-constraints.md](frontend-constraints.md)。
