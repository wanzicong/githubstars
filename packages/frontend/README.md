# GitHubStars Frontend

GitHub Stars 管理平台的前端应用，基于 React + Vite + TypeScript + Ant Design 构建。

## 技术栈

- **框架**: React 19 + TypeScript
- **构建**: Vite
- **UI**: Ant Design 6
- **状态管理**: Zustand
- **路由**: React Router v7
- **HTTP**: Axios
- **Markdown**: react-markdown + remark-gfm
- **测试**: Vitest（单元/组件测试）+ Playwright（E2E）

## 快速开始

```bash
# 安装依赖（在仓库根目录）
npm install

# 启动开发服务器
npm run dev --workspace=@githubstars/frontend

# 类型检查
npm run typecheck --workspace=@githubstars/frontend

# 代码检查
npm run lint --workspace=@githubstars/frontend

# 单元测试
npm run test --workspace=@githubstars/frontend

# 测试覆盖率
npm run test:coverage --workspace=@githubstars/frontend

# E2E 测试（需先安装浏览器：npx playwright install --with-deps chromium）
npm run test:e2e --workspace=@githubstars/frontend

# 生产构建
npm run build --workspace=@githubstars/frontend

# 预览构建产物
npm run preview --workspace=@githubstars/frontend
```

## 目录结构

```
packages/frontend/
├── src/
│   ├── api/           # API 请求层（基于 axios 封装）
│   ├── components/    # 通用组件（ErrorBoundary、MarkdownRenderer、TranslatePanel 等）
│   ├── hooks/         # 自定义 Hooks（usePolling 等）
│   ├── layouts/       # 布局组件（顶栏、侧边栏、设置抽屉）
│   ├── pages/         # 页面组件
│   │   ├── StarList.tsx       # Star 列表（筛选、搜索、导出、翻译）
│   │   ├── StarDetail.tsx     # Star 详情（README 翻译、元信息）
│   │   ├── Sync.tsx           # GitHub 同步管理
│   │   ├── Stats.tsx          # 数据统计
│   │   ├── AuthorList.tsx     # 作者列表
│   │   ├── AuthorDetail.tsx   # 作者详情
│   │   ├── GithubSearch.tsx   # GitHub 仓库搜索
│   │   ├── Trending.tsx       # 趋势排行
│   │   ├── Settings.tsx       # 系统设置
│   │   └── Logs.tsx           # 日志查看
│   ├── router/        # 路由与菜单配置
│   ├── stores/        # Zustand 状态管理
│   ├── types/         # TypeScript 类型定义
│   └── utils/         # 工具函数
├── test/              # 测试文件
│   ├── components/    # 组件测试
│   ├── e2e/           # Playwright E2E 测试
│   ├── mocks/         # MSW mock 数据
│   ├── regression/    # 回归测试
│   ├── setup.ts       # 测试环境初始化
│   └── utils/         # 工具函数测试
├── eslint.config.js   # ESLint 配置
├── vitest.config.ts   # Vitest 配置
├── playwright.config.ts # Playwright 配置
├── vite.config.ts     # Vite 配置
└── tsconfig.json      # TypeScript 配置
```

## 核心功能

- **Star 管理**: 列表浏览、筛选（关键词/语言/日期/未翻译）、排序、分页
- **Star 详情**: 查看 README、一键翻译 README、查看仓库元信息
- **翻译管理**: 描述批量翻译、README 翻译、任务进度监控、失败重试
- **GitHub 同步**: 触发同步、查看同步状态与日志
- **数据统计**: 仓库语言分布、活跃度等统计图表
- **作者中心**: 按作者浏览仓库、导出仓库链接
- **GitHub 搜索**: 搜索并收藏仓库
- **趋势排行**: 查看 GitHub 趋势仓库
- **系统设置**: GitHub Token、翻译 API Key 等配置
- **日志查看**: 查看系统运行日志

## CI/CD

GitHub Actions 工作流定义在 `.github/workflows/ci.yml`，包含：

1. **质量门禁**: typecheck → lint → unit test → build → audit
2. **E2E 测试**: 安装 Playwright 浏览器并运行端到端测试
