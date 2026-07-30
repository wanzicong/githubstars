# GitHub Stars MCP Server

将 GitHub Stars 管理系统的后端 API 封装为 MCP 工具，供外部 AI（Claude Code 等）通过 stdio 调用。

## 架构

```
┌─────────────────┐     stdio      ┌──────────────────┐     HTTP      ┌─────────────┐
│  Claude Code /   │ ◄──────────► │  MCP Server       │ ──────────► │  NestJS     │
│  外部 AI 工具    │   MCP 协议    │  packages/mcp-server│  :10002/api/* │  Backend    │
└─────────────────┘                └──────────────────┘               └─────────────┘
```

- MCP Server 是纯 HTTP 客户端，不直连数据库
- 所有请求通过 HTTP 转发到已运行的 NestJS 后端
- 后端默认运行在 `http://localhost:10002`

## 推荐：通过 Claude Code 插件安装

仓库根目录的 `githubstars-agent` 插件已经包含编译后的 MCP Server 和业务 Skills。安装插件后，Claude Code 会自动启动 MCP Server，无需手工维护 `.mcp.json`：

```bash
npm run build:agent-plugin
claude plugin marketplace add ./
claude plugin install githubstars-agent@githubstars --scope project
```

Docker 生产环境的宿主机后端端口为 `10004`，请在启动 Claude Code 前设置：

```powershell
$env:GITHUBSTARS_API_URL = 'http://localhost:10004'
```

插件开发和 Skills 说明见 [`../../plugins/githubstars-agent/README.md`](../../plugins/githubstars-agent/README.md)。

## 快速开始

### 1. 确保后端已启动

```bash
npm run start -w @githubstars/backend
```

### 2. 编译 MCP Server

```bash
npm run build -w @githubstars/mcp-server
```

### 3. 配置 MCP 客户端

在 Claude Code 的 `.mcp.json` 中添加：

```json
{
  "githubstars": {
    "command": "node",
    "args": ["d:/WorkSpaceCoding/apps/githubstars/packages/mcp-server/dist/index.js"],
    "env": {
      "GITHUBSTARS_API_URL": "http://localhost:10002"
    }
  }
}
```

### 4. 使用

在 Claude Code 中，工具会以 `mcp__githubstars__*` 前缀出现，例如：

- `mcp__githubstars__stars-list` — 获取星标仓库列表
- `mcp__githubstars__stats-overview` — 获取整体概览统计
- `mcp__githubstars__category-tree` — 获取分类树
- `mcp__githubstars__sync-status` — 获取同步状态

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GITHUBSTARS_API_URL` | `http://localhost:10002` | 后端 API 地址 |

## 工具清单（73 个）

### Stars 星标仓库（8 个）
| 工具名 | 说明 |
|--------|------|
| `stars-list` | 分页获取 Star 仓库列表 |
| `stars-detail` | 获取仓库详情 |
| `stars-export` | 导出仓库 URL 列表 |
| `stars-ids` | 获取仓库 ID 列表 |
| `stars-by-ids` | 批量获取仓库详情 |
| `stars-star` | 按本地仓库 ID 添加 Star |
| `stars-unstar` | 按本地仓库 ID 取消 Star |
| `stars-check-starred` | 按本地仓库 ID 检查 Star 状态 |

### Stats 统计分析（6 个）
| 工具名 | 说明 |
|--------|------|
| `stats-languages` | 编程语言分布 |
| `stats-owners` | 所有者排名 |
| `stats-timeline` | Star 时间线 |
| `stats-overview` | 整体概览 |
| `stats-top-starred` | Star 排行榜 |
| `stats-recent-active` | 最近活跃仓库 |

### Localization 仓库中文化（4 个）
| 工具名 | 说明 |
|--------|------|
| `localization-run` | 中文化单个仓库的描述和/或 README |
| `localization-batch` | 创建批量中文化任务 |
| `localization-task-detail` | 查询任务进度与明细 |
| `localization-task-retry` | 重试任务失败项 |

### Categories 分类管理（10 个）
| 工具名 | 说明 |
|--------|------|
| `category-tree` | 获取分类树 |
| `category-list` | 获取分类列表 |
| `category-create` | 创建分类 |
| `category-update` | 更新分类 |
| `category-delete` | 删除分类 |
| `category-sort` | 分类排序 |
| `category-repos` | 查询分类仓库 |
| `category-bind` | 绑定仓库到分类 |
| `category-unbind` | 解绑仓库从分类 |
| `category-batch-ids` | 获取分类仓库 ID |

### Sync 数据同步（3 个）
| 工具名 | 说明 |
|--------|------|
| `sync-manual` | 手动触发同步 |
| `sync-status` | 获取同步状态 |
| `sync-logs` | 获取同步日志 |

### GitHub 操作（5 个）
| 工具名 | 说明 |
|--------|------|
| `github-search` | 搜索 GitHub 仓库 |
| `github-star` | Star 仓库 |
| `github-unstar` | 取消 Star |
| `github-check-starred` | 检查 Star 状态 |
| `similar-find` | 查找相似仓库 |

### Trending 趋势（2 个）
| 工具名 | 说明 |
|--------|------|
| `trending-list` | 获取 Trending 仓库 |
| `trending-download` | 下载趋势仓库 |

### Authors 作者（3 个）
| 工具名 | 说明 |
|--------|------|
| `authors-list` | 获取作者列表 |
| `authors-repos` | 获取作者仓库列表 |
| `authors-export` | 导出作者仓库 URL |

### Download 下载（13 个）
| 工具名 | 说明 |
|--------|------|
| `download-create` | 创建下载任务 |
| `download-tasks-list` | 获取下载任务列表 |
| `download-directories` | 获取常用目录 |
| `download-tasks-detail` | 查询任务进度 |
| `download-estimate-sizes` | 预估下载大小 |
| `download-tasks-retry` | 重试失败项 |
| `download-tasks-reset` | 重置任务 |
| `download-tasks-retry-item` | 重试单个任务项 |
| `download-tasks-delete` | 删除任务 |
| `download-tasks-extract` | 解压任务项 |
| `download-tasks-delete-item` | 删除任务项文件 |
| `download-tasks-extract-all` | 一键解压全部 |
| `download-tasks-extract-all-progress` | 查询批量解压进度 |

### Clone 克隆（8 个）
| 工具名 | 说明 |
|--------|------|
| `clone-create` | 创建克隆任务 |
| `clone-tasks-list` | 获取克隆任务列表 |
| `clone-directories` | 获取常用目录 |
| `clone-tasks-detail` | 查询任务进度 |
| `clone-tasks-retry` | 重试失败项 |
| `clone-tasks-reset` | 重置任务 |
| `clone-tasks-retry-item` | 重试单个任务项 |
| `clone-tasks-delete` | 删除任务 |

### Export 导出（1 个）
| 工具名 | 说明 |
|--------|------|
| `export-markdown` | 导出 Markdown |

### Config 配置（2 个）
| 工具名 | 说明 |
|--------|------|
| `config-list` | 获取所有配置项 |
| `config-save` | 批量保存配置项 |

### Logs 日志（3 个）
| 工具名 | 说明 |
|--------|------|
| `logs-files` | 获取日志文件列表 |
| `logs-view` | 查看日志内容 |
| `logs-clear` | 清空日志文件 |

### Agent 对话（5 个）
| 工具名 | 说明 |
|--------|------|
| `agent-query` | Agent 一次性查询 |
| `agent-sessions-list` | 获取会话列表 |
| `agent-sessions-create` | 创建会话 |
| `agent-sessions-get` | 获取会话详情 |
| `agent-sessions-delete` | 关闭会话 |

## 开发

```bash
# 编译（esbuild，10ms）
npm run build -w @githubstars/mcp-server

# 类型检查（TypeScript，需要较多内存）
cd packages/mcp-server && node --max-old-space-size=8192 ../../node_modules/typescript/bin/tsc --noEmit
```

## 注意事项

1. **后端必须先启动** — MCP Server 不直连数据库，所有数据通过后端 API 获取
2. **SSE 流式接口不支持** — `/api/agent/chat` 是 SSE 长连接，无法通过 stdio 代理
3. **文件下载接口返回 JSON** — `stars-export`、`authors-export`、`export-markdown` 返回的是后端 JSON 响应，不包含文件内容
