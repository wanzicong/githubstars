import type { AgentConfig, GitHubMCPConfig } from "../types/index.js";

export function loadConfig(): AgentConfig {
  return {
    port: Number.parseInt(process.env.AGENT_PORT ?? "10003", 10),
    model: process.env.AGENT_MODEL ?? "deepseek-v4-flash",
    maxTurns: Number.parseInt(process.env.AGENT_MAX_TURNS ?? "100", 10),
    allowedTools: [
      "Bash",
      "WebSearch",
      "mcp__github__*",
    ],
    // GITHUB_TOKEN 缺失时降级为空字符串而非抛异常：
    // 桌面端由 Electron 主进程从数据库 system_config 注入 GitHub Token，
    // 即使用户未配置，Agent 的 HTTP 服务/会话管理仍应正常启动。
    githubToken: process.env.GITHUB_TOKEN ?? "",
  };
}

export function getGitHubMCPConfig(token: string): GitHubMCPConfig {
  return {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_TOKEN: token,
    },
  };
}
