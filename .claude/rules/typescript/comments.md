---
trigger: always_on
---

# TypeScript/JavaScript 代码注释

> 本文件基于 [common/comments.md](../common/comments.md) 扩展，包含 TypeScript/JavaScript 特定内容。

## JSDoc 标准

所有导出的函数、类、接口和类型别名必须使用 JSDoc 注释：

```typescript
/**
 * 根据用户 ID 获取用户信息。
 *
 * @param userId - 用户的唯一标识符
 * @returns 包含用户信息的 Promise，若未找到则返回 null
 * @throws {UserServiceError} 当数据库连接失败时抛出
 */
export async function getUserById(userId: string): Promise<User | null> {
  // ...
}
```

## React 组件注释

每个 React 组件必须有描述其用途和属性的 JSDoc 注释：

```typescript
/**
 * 用户卡片组件，展示用户的基本信息并提供选择交互。
 *
 * @param props - 组件属性
 * @param props.user - 要展示的用户对象
 * @param props.onSelect - 用户被选中时的回调函数
 * @param props.variant - 卡片的视觉样式变体，默认为 'default'
 */
export function UserCard({ user, onSelect, variant = 'default' }: UserCardProps) {
  // ...
}
```

## 自定义 Hook 注释

自定义 Hook 必须注释说明其用途、参数和返回值：

```typescript
/**
 * 防抖 Hook，在指定延迟后返回值。
 * 适用于搜索输入、窗口调整等需要减少操作频率的场景。
 *
 * @param value - 需要防抖的值
 * @param delay - 防抖延迟时间（毫秒），默认为 300ms
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay = 300): T {
  // ...
}
```

## 复杂类型注释

复杂的泛型、条件类型或工具类型必须附带注释说明：

```typescript
/**
 * 将类型 T 中所有值为函数类型的属性提取为新的对象类型。
 * 用于从组件 props 中分离出回调函数集合。
 */
export type CallbackProps<T> = {
  [K in keyof T as T[K] extends (...args: unknown[]) => unknown ? K : never]: T[K]
}
```

## 内联注释

复杂逻辑、算法或非显而易见的技术决策必须使用内联注释：

```typescript
function processOrders(orders: Order[]): ProcessedOrder[] {
  // 使用 Map 而非对象字面量：订单 ID 是动态的且需要频繁增删
  const orderMap = new Map<string, Order>()

  for (const order of orders) {
    // 跳过已取消的订单——这些订单不需要处理，但仍需保留在原始列表中
    if (order.status === 'CANCELLED') continue

    // 使用 Set 去重：同一商品可能在多个批次中出现
    const uniqueItems = new Set(order.items.map(item => item.sku))
    // ...
  }
}
```

## 文件级注释

每个模块文件应在顶部包含简要说明：

```typescript
/**
 * 用户管理模块
 *
 * 提供用户 CRUD 操作、权限验证和用户搜索功能。
 * 所有操作均通过 UserService 统一入口。
 */
```

## 自动化工具

* **ESLint**：使用 `eslint-plugin-jsdoc` 插件强制执行 JSDoc 规则
* **TypeScript**：启用 `noImplicitAny` 和 `strict` 模式，减少类型注释的歧义

## 参考

有关通用注释原则，请参见 [common/comments.md](../common/comments.md)。
有关 TypeScript 编码风格，请参见技能：`coding-standards`。
