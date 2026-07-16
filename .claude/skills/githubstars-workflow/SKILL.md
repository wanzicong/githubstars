---
name: githubstars-workflow
description: GitHub Stars 项目的标准工作流程，整合历次复盘经验
---
# GitHub Stars 项目工作流程

## 代码修改前检查清单

在修改任何代码前，请确认：

- [ ] 是否修改了 Prisma Schema？如果是，必须同步修改 `schema.sqlite.prisma`
- [ ] 是否新增了字段？如果是，必须全局搜索引用点（前端展示、排序、后端逻辑等）
- [ ] 是否有 Controller 参数？如果是，必须确认参数透传到 Service 层

## 代码质量约束

### P0 必须遵守

1. **禁止全局 `parseInt()`** → 使用 `Number.parseInt()`
2. **禁止 `.catch()` 链** → 使用 `try { await ... } catch { ... }`
3. **禁止连续多次 `Array.push()`** → 优先数组字面量一次性声明
4. **禁止 `&&` 前置判断调用** → 使用可选链 `?.()`

### P1 强烈建议

1. **Cognitive Complexity ≤ 15** → 超过必须拆分
2. **组件文件 ≤ 200 行** → 超过必须拆分子组件
3. **Service 文件 ≤ 400 行** → 超过必须拆分

## 前端四维审查（P0）

每次修改前端代码后，必须检查：

### 1️⃣ 交互友好
- [ ] 按钮点击后有 loading 状态吗？
- [ ] 有防重复点击措施吗？
- [ ] 删除/重置操作有二次确认吗？

### 2️⃣ 用户体验（三态覆盖）
- [ ] Loading 态有骨架屏或 Spin 吗？
- [ ] Empty 态有友好提示吗？
- [ ] Error 态有重试入口吗？

### 3️⃣ 视觉安全
- [ ] 动态内容超长有 `ellipsis` + `Tooltip` 吗？
- [ ] 窄屏有水平滚动兜底吗（`scroll={{ x: 1200 }}`）？
- [ ] 空值有 `?? ''` 兜底吗？

### 4️⃣ 前端性能
- [ ] 列表 key 稳定唯一（不用 index）吗？
- [ ] 大列表有虚拟滚动或分页吗？
- [ ] 定时器/事件监听在组件销毁时清理吗？

## 后端修改完成检查

每次修改后端代码后：

- [ ] 关闭旧进程（`netstat` + `taskkill`）
- [ ] 重新启动服务
- [ ] curl 测试新端点返回正确数据
- [ ] 确认新字段在响应中存在

## 代码完成后强制验证

必须依次执行，零错误才能说"完成"：

```bash
# 1. Lint 检查
npm run lint

# 2. 类型检查
npm run typecheck

# 3. 构建验证
npm run build

# 4. 运行测试
npm run test
```

## SonarJS 规则零容忍

如果发现以下规则问题，必须修复：

| 规则 | 要求 |
|------|------|
| `no-nested-conditional` | 禁止嵌套三元表达式 |
| `no-nested-template-literals` | 禁止嵌套模板字面量 |
| `prefer-regexp-exec` | 正则用 `exec` 不用 `match` |
| `no-collection-size-mischeck` | 数组判空用 `> 0` 不用 `>= 0` |
| `cognitive-complexity` | 复杂度 ≤ 15 |
| `no-explicit-any` | 禁止显式 `any` |
| `no-unused-import` | 移除未使用的导入 |
| `no-unused-vars` | 移除未使用的变量 |

## 安全边界

- **P0**: 修改 `.env` 或 `schema.prisma` 必须二次确认
- **P1**: 敏感操作（删除、权限变更）必须二次确认
- **P1**: Git Token 不能出现在命令行参数中

## 复盘历史

本 skill 整合了以下复盘经验：
- 2026-06-27（第一次）：SonarJS 集成
- 2026-06-27（第二次）：参数黑洞、批量操作
- 2026-06-30（第七次）：前端四维审查
- 2026-07-03（第九次）：Schema 双文件同步
- 2026-07-03（第十次）：定时器生命周期
