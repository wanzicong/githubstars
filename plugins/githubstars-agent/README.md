# GitHub Stars Agent Plugin

面向 Claude Code 的 GitHub Stars 插件。安装后会自动启动随插件分发的 MCP Server，并提供 73 个仓库管理工具和 5 个业务 Skills，无需手工维护 `.mcp.json`。

## 能力

- 浏览、筛选、Star/Unstar 和分类仓库
- 查看统计、趋势、作者和相似项目
- 中文化仓库描述与 README
- 批量克隆、下载、解压和重试
- 同步数据、检查配置与诊断日志

## 前置条件

- Node.js 22 或更高版本
- GitHub Stars 后端正在运行
- 开发环境后端默认地址：`http://localhost:10002`
- Docker 生产环境宿主机地址：`http://localhost:10004`

如果后端不在默认地址，请在启动 Claude Code 前设置：

```powershell
$env:GITHUBSTARS_API_URL = 'http://localhost:10004'
claude
```

## 从当前仓库安装

在仓库根目录执行：

```bash
claude plugin marketplace add ./
claude plugin install githubstars-agent@githubstars --scope project
```

在已经打开的 Claude Code 会话中运行 `/reload-plugins`，然后用 `/mcp` 检查 `githubstars` 服务和工具。

项目内置 `/agent` 页面也通过 Agent SDK 加载同一个插件。初始化时会校验插件、MCP 连接、73 个工具和 5 个 Skills；任何一项缺失都会返回明确错误，不会静默回退成“插件看似安装但实际不可用”。

插件 MCP 工具在 Agent SDK 中的完整前缀是：

```text
mcp__plugin_githubstars-agent_githubstars__
```

## Skills

- `/githubstars-agent:manage-star-library`
- `/githubstars-agent:analyze-star-library`
- `/githubstars-agent:localize-star-repositories`
- `/githubstars-agent:acquire-star-source`
- `/githubstars-agent:operate-githubstars`

## 开发与验证

```bash
npm run build:agent-plugin
npm run test:agent-plugin
claude plugin validate ./plugins/githubstars-agent --strict
claude plugin validate . --strict
```

插件安装时会被复制到 Claude Code 缓存，因此 MCP Server 已编译为插件目录内的自包含单文件包。不要让插件引用仓库中的 `packages/` 或其他上级目录。
