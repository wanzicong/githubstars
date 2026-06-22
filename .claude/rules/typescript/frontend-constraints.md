---
trigger: always_on
---

# TypeScript/JavaScript 前端约束

> 本文件基于 [common/frontend-constraints.md](../common/frontend-constraints.md) 扩展，包含 TypeScript/JavaScript 及 React 特定内容。

## React 组件类型定义

```typescript
// GOOD — 使用 interface 定义组件 Props
interface UserCardProps {
  user: User
  onSelect: (id: string) => void
  variant?: 'default' | 'compact'
}

export function UserCard({ user, onSelect, variant = 'default' }: UserCardProps) {
  // ...
}

// BAD — 使用 any 或缺少类型
function UserCard(props: any) {
  // ...
}
```

## 状态管理不可变模式

```typescript
// GOOD — 不可变更新
interface User {
  id: string
  name: string
}

function updateUser(user: Readonly<User>, name: string): User {
  return { ...user, name }  // 返回新对象
}

// BAD — 直接修改原状态
function updateUser(user: User, name: string): User {
  user.name = name  // MUTATION!
  return user
}
```

## 边界态实现模式

```typescript
// 标准边界态处理模式
function UserList() {
  const { data, isLoading, error } = useUsers()

  if (isLoading) return <Skeleton rows={5} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  if (!data?.length) return <EmptyState message="暂无用户数据" action={<CreateButton />} />

  return data.map(user => <UserCard key={user.id} user={user} />)
}
```

## 前端安全实践

```typescript
// GOOD — 使用 DOMPurify 消毒后再渲染 HTML
import DOMPurify from 'dompurify'

function SafeHtml({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html)
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}

// GOOD — Token 从环境变量读取，不暴露到客户端
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL  // 仅公开 URL
// API Key 绝不出现在前端代码中
```

## 性能优化模式

```typescript
// 路由懒加载
const SettingsPage = React.lazy(() => import('./pages/Settings'))

// 列表虚拟化（使用 react-window 或 @tanstack/virtual）
import { FixedSizeList } from 'react-window'

// 高频事件防抖
import { useDebounce } from '@/hooks/useDebounce'

function SearchInput() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery) fetchResults(debouncedQuery)
  }, [debouncedQuery])
}
```

## 参考

有关通用前端约束，请参见 [common/frontend-constraints.md](../common/frontend-constraints.md)。
有关 TypeScript 编码风格，请参见技能：`coding-standards`。
