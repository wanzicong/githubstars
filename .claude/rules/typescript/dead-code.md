---
trigger: always_on
---

# TypeScript/JavaScript 死代码管理

> 本文件基于 [common/dead-code.md](../common/dead-code.md) 扩展，包含 TypeScript/JavaScript 特定内容。

## 自动检测工具

### ESLint 规则

在 `.eslintrc` 或 `eslint.config.js` 中启用以下规则：

```json
{
  "rules": {
    "no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_",
      "caughtErrorsIgnorePattern": "^_"
    }],
    "no-unreachable": "error",
    "no-constant-condition": ["error", { "checkLoops": false }]
  }
}
```

### ts-prune

使用 `ts-prune` 检测未使用的导出：

```bash
# 安装
npm install -D ts-prune

# 运行检测
npx ts-prune

# 在 CI 中集成（添加到 package.json scripts）
{
  "scripts": {
    "dead-code:check": "ts-prune"
  }
}
```

### TypeScript 编译器选项

在 `tsconfig.json` 中启用严格模式以在编译时捕获死代码信号：

```json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "allowUnreachableCode": false
  }
}
```

## 常见死代码模式

### 未使用的导入

```typescript
// BAD — 未使用的导入
import { useState, useEffect, useCallback } from 'react' // useCallback 未使用
import { formatDate } from '@/utils/date' // formatDate 未使用

// GOOD — 仅导入需要的
import { useState, useEffect } from 'react'
```

### 被注释掉的代码

```typescript
// BAD — 被注释掉的代码块
// function OldUserList({ users }: { users: User[] }) {
//   return (
//     <div className="user-list">
//       {users.map(user => (
//         <OldUserCard key={user.id} user={user} />
//       ))}
//     </div>
//   )
// }

// GOOD — 使用 git 管理历史版本
// 删除上述代码，需要时使用 git log -p -- src/components/UserList.tsx 回溯
```

### 不可达代码

```typescript
// BAD — return 后的不可达代码
function getStatusLabel(status: string): string {
  return status.toUpperCase()
  console.log('status:', status) // 永远不会执行
}

// BAD — 条件恒为 true 导致的分支不可达
function processValue(value: number): string {
  if (true) { // 恒为 true
    return 'always this'
  }
  return 'never this' // 死代码
}
```

### 未使用的导出

```typescript
// BAD — 模块内部导出了但仅被标记为废弃的函数
/** @deprecated 使用 fetchUserV2 替代 */
export function fetchUser(id: string): Promise<User> {
  // 如果内部不再使用，应删除
}

// GOOD — 如果是公开 API 且计划移除，保留并标记
/** @public-api 保留用于向后兼容，v3.0 将移除 */
export function fetchUser(id: string): Promise<User> {
  return fetchUserV2(id)
}
```

## CI/CD 集成

在 CI 流水线中添加死代码检测步骤：

```yaml
# .github/workflows/ci.yml
- name: Check for dead code
  run: |
    npx ts-prune
    npx eslint . --ext .ts,.tsx --rule 'no-unused-vars: error'
```

## 参考

有关通用死代码管理原则，请参见 [common/dead-code.md](../common/dead-code.md)。
有关 TypeScript 编码风格，请参见技能：`coding-standards`。
