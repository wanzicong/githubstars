import { Router } from "express";
import { z } from "zod";
import type { AgentClient } from "../agent/agent-client.js";
import type { SessionManager } from "../agent/session-manager.js";

// ── 请求校验 Schema ──

const sessionNoneSchema = z.object({
  type: z.literal("none"),
});

const sessionAutoSchema = z.object({
  type: z.literal("auto"),
});

const sessionResumeSchema = z.object({
  type: z.literal("resume"),
  id: z.string().min(1, "session id 不能为空"),
});

const sessionSchema = z.discriminatedUnion("type", [
  sessionNoneSchema,
  sessionAutoSchema,
  sessionResumeSchema,
]);

const agentRequestSchema = z.object({
  message: z.string().min(1, "消息不能为空"),
  session: sessionSchema,
  maxTurns: z.number().int().min(1).max(500).optional(),
  model: z.string().optional(),
});

// ── 辅助函数：从 SSE 响应中提取结果文本 ──

function extractResultText(
  messages: Array<{ type: string; message?: { content?: unknown } }>,
): string {
  const textParts: string[] = [];
  for (const msg of messages) {
    if (msg.type === "assistant" && msg.message?.content) {
      const content = msg.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text") {
            textParts.push(block.text);
          }
        }
      } else if (typeof content === "string") {
        textParts.push(content);
      }
    }
  }
  return textParts.join("\n");
}

export function createRouter(
  agentClient: AgentClient,
  sessionManager: SessionManager,
): Router {
  const router = Router();

  // ── POST /api/agent/chat — SSE 流式 ──
  router.post("/chat", async (req, res) => {
    const parseResult = agentRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: `参数校验失败: ${parseResult.error.message}`,
      });
      return;
    }

    const { message, session, maxTurns, model } = parseResult.data;

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let ourSessionId: string | undefined;
    let sdkSessionId: string | undefined;

    try {
      // 处理会话模式
      if (session.type === "none") {
        // 纯一次性，不落库
      } else if (session.type === "auto") {
        ourSessionId = await sessionManager.createSession("auto");
        // 发送 sessionId 给客户端
        res.write(
          `data: ${JSON.stringify({ type: "connected", sessionId: ourSessionId, timestamp: new Date().toISOString() })}\n\n`,
        );
      } else if (session.type === "resume") {
        // 恢复已有会话
        const existing = await sessionManager.getSession(session.id);
        if (!existing) {
          res.write(
            `data: ${JSON.stringify({ type: "error", data: "会话不存在或已关闭", timestamp: new Date().toISOString() })}\n\n`,
          );
          res.end();
          return;
        }
        ourSessionId = existing.id;
        sdkSessionId = existing.sdkSessionId ?? undefined;
        res.write(
          `data: ${JSON.stringify({ type: "connected", sessionId: ourSessionId, timestamp: new Date().toISOString() })}\n\n`,
        );
      }

      // 流式调用 Agent
      let assistantContent = "";
      for await (const { block, raw } of agentClient.streamBlocks({
        prompt: message,
        sessionId: sdkSessionId,
        maxTurns,
        model,
      })) {
        // 捕获 SDK sessionId 用于多轮对话
        if (
          raw.type === "system" &&
          raw.subtype === "init" &&
          "session_id" in raw
        ) {
          sdkSessionId = raw.session_id as string;
          // 如果我们的会话需要持久化，保存 SDK sessionId
          if (ourSessionId && sdkSessionId) {
            await sessionManager.updateSdkSessionId(ourSessionId, sdkSessionId);
          }
        }

        // 构造 SSE 事件
        const blockType = block.type;
        if (blockType === "text") {
          assistantContent += block.text ?? "";
          res.write(
            `data: ${JSON.stringify({ type: "assistant_message", data: block.text, sessionId: ourSessionId, timestamp: new Date().toISOString() })}\n\n`,
          );
        } else if (blockType === "tool_use") {
          res.write(
            `data: ${JSON.stringify({
              type: "tool_use",
              data: { toolName: block.toolName, toolInput: block.toolInput },
              sessionId: ourSessionId,
              timestamp: new Date().toISOString(),
            })}\n\n`,
          );
        }
      }

      // 最终结果事件
      res.write(
        `data: ${JSON.stringify({ type: "result", data: { sessionId: ourSessionId }, sessionId: ourSessionId, timestamp: new Date().toISOString() })}\n\n`,
      );
      res.end();

      // 持久化消息（如果是 auto/resume 模式）
      if (ourSessionId) {
        await sessionManager.saveMessage(ourSessionId, "user", message);
        if (assistantContent) {
          await sessionManager.saveMessage(ourSessionId, "assistant", assistantContent);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.write(
        `data: ${JSON.stringify({ type: "error", data: errorMsg, timestamp: new Date().toISOString() })}\n\n`,
      );
      res.end();
    }
  });

  // ── POST /api/agent/query — 普通 JSON 响应 ──
  router.post("/query", async (req, res) => {
    const parseResult = agentRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: `参数校验失败: ${parseResult.error.message}`,
      });
      return;
    }

    const { message, session, maxTurns, model } = parseResult.data;
    let ourSessionId: string | undefined;
    let sdkSessionId: string | undefined;

    try {
      // 处理会话模式
      if (session.type === "auto") {
        ourSessionId = await sessionManager.createSession("auto");
      } else if (session.type === "resume") {
        const existing = await sessionManager.getSession(session.id);
        if (!existing) {
          res.status(404).json({ success: false, error: "会话不存在或已关闭" });
          return;
        }
        ourSessionId = existing.id;
        sdkSessionId = existing.sdkSessionId ?? undefined;
      }

      // 一次性查询
      const result = await agentClient.queryOnce({
        prompt: message,
        sessionId: sdkSessionId,
        maxTurns,
        model,
      });

      // 提取结果文本
      const resultText = extractResultText(
        result.messages as Array<{
          type: string;
          message?: { content?: unknown };
        }>,
      );

      // 如果 auto 模式且有 SDK sessionId，保存
      if (session.type === "auto" && ourSessionId) {
        const initMsg = result.messages.find(
          (m) => m.type === "system" && m.subtype === "init",
        );
        if (initMsg && "session_id" in initMsg) {
          await sessionManager.updateSdkSessionId(
            ourSessionId,
            initMsg.session_id as string,
          );
        }
        // 保存消息
        await sessionManager.saveMessage(ourSessionId, "user", message);
        if (resultText) {
          await sessionManager.saveMessage(ourSessionId, "assistant", resultText);
        }
      }

      res.json({
        success: true,
        result: resultText,
        sessionId: ourSessionId,
        cost: result.cost,
        duration: result.duration,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        success: false,
        error: errorMsg,
        sessionId: ourSessionId,
      });
    }
  });

  // ── GET /api/agent/sessions — 获取会话列表 ──
  router.get("/sessions", async (req, res) => {
    try {
      const limit = Number.parseInt(req.query.limit as string, 10) || 50;
      const offset = Number.parseInt(req.query.offset as string, 10) || 0;

      const sessions = await sessionManager.listSessions(limit, offset);

      res.json({ success: true, sessions });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ── POST /api/agent/sessions — 创建新会话 ──
  router.post("/sessions", async (_req, res) => {
    try {
      const sessionId = await sessionManager.createSession("auto");
      res.json({ success: true, sessionId });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ── GET /api/agent/sessions/:id — 获取会话信息 ──
  router.get("/sessions/:id", async (req, res) => {
    try {
      const session = await sessionManager.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ success: false, error: "会话不存在或已关闭" });
        return;
      }

      const messages = await sessionManager.getMessages(req.params.id);

      res.json({
        success: true,
        session: {
          id: session.id,
          type: session.type,
          status: session.status,
        },
        messages,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ── DELETE /api/agent/sessions/:id — 删除会话 ──
  router.delete("/sessions/:id", async (req, res) => {
    try {
      await sessionManager.closeSession(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
