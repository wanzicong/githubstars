import express from "express";
import cors from "cors";
import type http from "http";
import type { AgentClient } from "../agent/agent-client.js";
import type { SessionManager } from "../agent/session-manager.js";
import { createRouter } from "./routes.js";

/**
 * HTTP 服务器 —— 提供 Agent 的 REST API + SSE 流式接口。
 */
export class HTTPServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private port: number;

  constructor(agentClient: AgentClient, sessionManager: SessionManager, port: number) {
    this.port = port;
    this.app = express();

    // 中间件
    this.app.use(cors());
    this.app.use(express.json());

    // 健康检查
    this.app.get("/health", (_req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Agent API 路由
    this.app.use("/api/agent", createRouter(agentClient, sessionManager));
  }

  /**
   * 启动 HTTP 服务。
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`[GitHub Agent] HTTP 服务已启动: http://localhost:${this.port}`);
        console.log(`[GitHub Agent] 健康检查: http://localhost:${this.port}/health`);
        console.log(`[GitHub Agent] SSE 流式: POST http://localhost:${this.port}/api/agent/chat`);
        console.log(`[GitHub Agent] 普通查询: POST http://localhost:${this.port}/api/agent/query`);
        console.log(`[GitHub Agent] 会话管理: POST/GET/DELETE http://localhost:${this.port}/api/agent/sessions`);
        resolve();
      });
    });
  }

  /**
   * 关闭 HTTP 服务。
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          console.log("[GitHub Agent] HTTP 服务已关闭");
          resolve();
        }
      });
    });
  }
}
