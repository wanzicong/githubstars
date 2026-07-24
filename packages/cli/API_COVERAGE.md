# CLI API 覆盖情况对比

## 后端 API 端点 vs CLI 命令

### Stars 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| POST /api/stars/list | `stars` | ✅ 已实现 |
| GET /api/stars/:id | `stars <id>` | ✅ 已实现 |
| POST /api/stars/by-ids | `stars:by-ids <ids...>` | ✅ 已实现 |
| POST /api/stars/export | `stars export` | ✅ 已实现 |
| POST /api/stars/ids | `stars:ids` | ✅ 已实现 |
| POST /api/stars/search | `stars search <keyword>` | ✅ 已实现 |

### Sync 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| POST /api/sync/manual | `sync` | ✅ 已实现 |
| GET /api/sync/status | `sync:status` | ✅ 已实现 |
| GET /api/sync/logs | `sync:logs` | ✅ 已实现 |

### Translate 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| POST /api/translate | `translate <type> <scope>` | ✅ 已实现 |
| GET /api/translate/:id/progress | `translate:status <id>` | ✅ 已实现 |
| GET /api/translate | `translate:list` | ✅ 已实现 |
| POST /api/translate/:id/retry | `translate:retry <id>` | ✅ 已实现 |
| GET /api/translate/status | `translate:stats` | ✅ 已实现 |
| GET /api/translate/:id/failures | `translate:failures <id>` | ✅ 已实现 |

### Clone 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| POST /api/clone | `clone <repoIds...>` | ✅ 已实现 |
| GET /api/clone/:id/progress | `clone:status <id>` | ✅ 已实现 |
| GET /api/clone | `clone:list` | ✅ 已实现 |
| POST /api/clone/:id/retry | `clone:retry <id>` | ✅ 已实现 |
| POST /api/clone/:id/retry-item | `clone:retry-item <id> <name>` | ✅ 已实现 |
| POST /api/clone/:id/reset | `clone:reset <id>` | ✅ 已实现 |
| DELETE /api/clone/:id | `clone:delete <id>` | ✅ 已实现 |
| GET /api/clone/directories | `clone:dirs` | ✅ 已实现 |

### Download 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| POST /api/download | `download <repoIds...>` | ✅ 已实现 |
| GET /api/download/:id/progress | `download:status <id>` | ✅ 已实现 |
| GET /api/download | `download:list` | ✅ 已实现 |
| POST /api/download/:id/retry | `download:retry <id>` | ✅ 已实现 |
| POST /api/download/:id/retry-item | `download:retry-item <id> <name>` | ✅ 已实现 |
| DELETE /api/download/:id | `download:delete <id>` | ✅ 已实现 |

### Stats 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| GET /api/stats/overview | `stats` | ✅ 已实现 |
| GET /api/stats/languages | `stats:languages` | ✅ 已实现 |
| GET /api/stats/owners | `stats:owners` | ✅ 已实现 |
| GET /api/stats/timeline | `stats:timeline` | ✅ 已实现 |

### Category 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| GET /api/categories/tree | `category list` | ✅ 已实现 |
| POST /api/categories | `category create` | ✅ 已实现 |
| PUT /api/categories/:id | `category update <id>` | ✅ 已实现 |
| DELETE /api/categories/:id | `category delete <id>` | ✅ 已实现 |
| POST /api/categories/:id/repos | `category:add <id> <repoIds...>` | ✅ 已实现 |
| DELETE /api/categories/:id/repos | `category:remove <id> <repoIds...>` | ✅ 已实现 |

### Config 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| GET /api/config | `config:server` | ✅ 已实现 |
| GET /api/config/:key | `config:server <key>` | ✅ 已实现 |
| PUT /api/config/:key | `config:server set <key> <value>` | ✅ 已实现 |

### Trending 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| GET /api/trending | `trending` | ✅ 已实现 |
| POST /api/trending/fetch | `trending:fetch` | ✅ 已实现 |

### Author 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| GET /api/authors | `authors` | ✅ 已实现 |
| GET /api/authors/:name | `author <name>` | ✅ 已实现 |
| GET /api/authors/:name/repos | `author:repos <name>` | ✅ 已实现 |

### Export 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| POST /api/export/md | `export md` | ✅ 已实现 |

### AI Agent 模块
| 后端 API | CLI 命令 | 状态 |
|----------|----------|------|
| POST /api/agent/query | `agent query <prompt>` | ❌ 未实现 |
| GET /api/agent/sessions | `agent sessions` | ❌ 未实现 |
| GET /api/agent/sessions/:id | `agent session <id>` | ❌ 未实现 |

## 统计

- **已实现**: 43 个命令
- **未实现**: 3 个命令 (AI Agent 相关)
- **覆盖率**: 93.5%

## 数据库直连模式 (--db)

无需启动后端服务，直接连接数据库查询：

| 命令 | 功能 |
|------|------|
| `--db stars` | 列出 Star 仓库 |
| `--db stars <id>` | 查看仓库详情 |
| `--db sync:status` | 查看同步状态 |
| `--db translate:stats` | 查看翻译统计 |
| `--db stats` | 概览统计 |
| `--db stats:languages` | 语言分布 |
| `--db stats:owners` | 所有者排行 |
| `--db category list` | 分类列表 |
| `--db clone:list` | 克隆任务列表 |
| `--db config:server` | 服务器配置 |
| `--db config:server <key>` | 指定配置项 |

## 使用示例

```bash
# 数据库直连模式（无需启动服务）
githubstars --db stars --language TypeScript --size 10
githubstars --db stats:languages
githubstars --db category list

# HTTP API 模式（需要先启动服务）
githubstars start
githubstars sync
githubstars translate readme all
githubstars clone 1 2 3 --target-dir D:/repos
githubstars trending
githubstars authors
```
