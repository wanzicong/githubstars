import type { AgentConfig, GitHubMCPConfig } from "../types/index.js";

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`环境变量 ${key} 未设置`);
  }
  return value;
}

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
    githubToken: getEnv("GITHUB_TOKEN"),
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
