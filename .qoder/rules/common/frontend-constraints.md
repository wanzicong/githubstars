---
trigger: always_on
---
# 前端开发约束

> 本文档整合了 CLAUDE.md 第九章"前端开发约束"的全部内容，涵盖组件、状态、样式、边界态、可访问性、性能和安全。

## 组件规范

### 单一职责
- 每个组件只负责一件事。若组件同时处理数据获取 + UI 渲染 + 业务逻辑，必须拆分
- 容器组件（数据/逻辑）与展示组件（纯 UI）分离

### Props 与类型
- 所有 Props 必须有类型定义（TypeScript interface 或 PropTypes）
- 复杂对象 Props 提取为独立类型，禁止 `props: any`
- 必传 Props 不得设默认值来规避空值检查

### 命名与文件
- 组件文件名与组件名一致（PascalCase）
- 一个文件只导出一个组件（除紧密关联的子组件外）
- 公共组件放在 `components/`，页面级组件放在对应页面目录

## 状态管理

### 数据流清晰
- 状态提升到最近的公共祖先，避免跨层级传递
- 禁止深层 prop drilling（超过 2 层），改用 Context / Store / 组合模式
- 全局状态与局部状态明确分界，禁止将页面局部状态放入全局 Store

### 不可变性
- 状态更新必须返回新对象/数组，**禁止直接修改原状态**
- 引用类型状态更新使用深拷贝或不可变工具（immer 等）

## 样式约束

### 设计一致性
- 使用项目既有的设计 Token（颜色/间距/字号/圆角），禁止硬编码随意数值
- 无设计稿时，默认遵循主流 UI 规范（8px 网格、行高 1.5、最大内容宽度 1200px）

### 响应式
- 默认**移动优先**（Mobile First），先写小屏样式，再用断点覆盖
- 禁止固定像素宽度在弹性容器中使用，优先 `max-width` / `min-width` / `%` / `vw` / `rem`

### 交互反馈
- 所有可点击元素必须有 hover/focus/active 三态样式
- 按钮在异步操作期间必须显示 loading 态并禁用重复点击

## 边界态处理（必须覆盖）

每个组件/页面必须处理以下四种状态，**缺一不可**：

| 状态 | 要求 |
|------|------|
| **Loading** | 骨架屏或加载指示器，禁止白屏等待 |
| **Empty** | 无数据时的友好提示 + 引导操作（如"创建第一条"） |
| **Error** | 错误信息 + 重试入口，禁止静默失败 |
| **Edge Cases** | 超长文本截断、空值兜底、数组越界、数字溢出 |

## 可访问性（A11y）

- 语义化 HTML：按钮用 `<button>`，导航用 `<nav>`，列表用 `<ul>/<ol>`，禁止全 `<div>` 布局
- 交互元素必须有焦点管理和键盘导航（Tab / Enter / Escape）
- 图标按钮必须有 `aria-label` 或 screen-reader 文本
- 图片必须有 `alt` 属性（装饰性图片设为空字符串）
- 表单输入必须有 `<label>` 关联

## 前端性能

- 路由级组件默认懒加载（`React.lazy` / `defineAsyncComponent`）
- 列表渲染必须使用唯一且稳定的 `key`，禁止使用数组索引作为 key
- 高频事件（scroll/resize/input）必须节流或防抖
- 大列表（> 100 项）必须使用虚拟滚动
- 图片默认懒加载（`loading="lazy"`），大图提供缩略图 + WebP 格式

## 前端安全

- **禁止直接使用 `dangerouslySetInnerHTML` / `v-html`**，除非输入经过 DOMPurify 等可信消毒
- 用户输入在提交前必须做 trim + 长度校验 + 格式校验
- 敏感操作（删除、支付、权限变更）必须有二次确认
- Token / API Key **不得**硬编码在前端代码或 `.env` 文件中暴露到客户端
- 所有外部链接加 `rel="noopener noreferrer"`

## 与其他规则的集成

此规则与以下规则配合：

- [coding-style.md](coding-style.md) - 多角色全局思考中的"UI 交互师"和"前端架构师"维度
- [code-review.md](code-review.md) - 前端专项审查清单
- [performance.md](performance.md) - 前端性能约束与五维审视中的渲染层/内存层
- [comments.md](comments.md) - 组件注释规范
