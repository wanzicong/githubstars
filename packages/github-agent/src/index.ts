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
    console.error("[GitHub Agent] 请确保 MySQL 服务已启动且 DATABASE_URL 配置正确");
    process.exit(1);
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
