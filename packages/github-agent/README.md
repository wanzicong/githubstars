# [已废弃] @githubstars/github-agent

本包已于 2026-07 合并到 `packages/backend/src/agent/`，不再独立维护和部署。

- Agent API 现在由 backend（:10002）直接提供：`/api/agent/*`
- 凭据统一通过 backend ConfigService 从 system_config 表读取
- 本目录仅作为历史参考保留，代码已从 npm workspaces 排除
