import "dotenv/config";
import { AgentClient } from "./agent/agent-client.js";
import { SessionManager } from "./agent/session-manager.js";
import { HTTPServer } from "./server/http-server.js";
import { loadConfig } from "./config/index.js";

async function main(): Promise<void> {
  console.log("[GitHub Agent] 启动中...");

  // 加载配置
  const config = loadConfig();
  console.log(`[GitHub Agent] 端口: ${config.port}`);
  console.log(`[GitHub Agent] 模型: ${config.model}`);

  // 初始化依赖
  const agentClient = new AgentClient(config);
  const sessionManager = new SessionManager();

  try {
    // 连接数据库
    await sessionManager.init();
    console.log("[GitHub Agent] 数据库连接成功");
  } catch (error) {
    console.error("[GitHub Agent] 数据库连接失败:", error);
    console.error("[GitHub Agent] 请确保数据库服务已启动且 DATABASE_URL 配置正确");
    process.exit(1);
  }

  // Anthropic API Key 优先级：环境变量 > 数据库 system_config(anthropic.api_key)
  // 桌面端 Electron 子进程不继承终端环境变量，必须从 DB 读取后注入 process.env
  // Claude Agent SDK 及子进程均通过 process.env 读取凭据
  if (!process.env.ANTHROPIC_API_KEY) {
    const dbApiKey = await sessionManager.getConfigValue("anthropic.api_key");
    if (dbApiKey) {
      process.env.ANTHROPIC_API_KEY = dbApiKey;
      console.log("[GitHub Agent] 已从数据库加载 Anthropic API Key");
    } else {
      console.log("[GitHub Agent] 未配置 Anthropic API Key，Agent 对话可能失败");
    }
  } else {
    console.log("[GitHub Agent] 使用环境变量中的 Anthropic API Key");
  }

  // Anthropic Base URL 优先级：环境变量 > 数据库 system_config(anthropic.base_url)
  if (!process.env.ANTHROPIC_BASE_URL) {
    const dbBaseUrl = await sessionManager.getConfigValue("anthropic.base_url");
    if (dbBaseUrl) {
      process.env.ANTHROPIC_BASE_URL = dbBaseUrl;
      console.log("[GitHub Agent] 已从数据库加载 Anthropic Base URL:", dbBaseUrl);
    }
  }

  // GitHub Token 优先级：环境变量 > 数据库 system_config(github.token)
  // 桌面端不注入 GITHUB_TOKEN 环境变量，改由此处从共享的 system_config 表读取，
  // 与后端 github.token 配置保持一致，用户在设置页配置一次即可全局生效。
  if (!config.githubToken) {
    const dbToken = await sessionManager.getConfigValue("github.token");
    if (dbToken) {
      agentClient.setGitHubToken(dbToken);
      console.log("[GitHub Agent] 已从数据库加载 GitHub Token");
    } else {
      console.log("[GitHub Agent] 未配置 GitHub Token，GitHub MCP 调用可能失败");
    }
  }

  // 启动 HTTP 服务
  const httpServer = new HTTPServer(agentClient, sessionManager, config.port);

  // 优雅关闭
  const shutdown = async (signal: string) => {
    console.log(`\n[GitHub Agent] 收到 ${signal}，正在关闭...`);
    await httpServer.stop();
    await sessionManager.destroy();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await httpServer.start();
}

main().catch((error) => {
  console.error("[GitHub Agent] 启动失败:", error);
  process.exit(1);
});
