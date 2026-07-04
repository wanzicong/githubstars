import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { getGitHubMCPConfig } from "../config/index.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import type { AgentConfig, AssistantMessageBlock } from "../types/index.js";

export interface QueryOptions {
  prompt: string;
  sessionId?: string;
  maxTurns?: number;
  model?: string;
}

export interface ProcessedResult {
  messages: SDKMessage[];
  cost: number;
  duration: number;
}

/**
 * Agent 客户端 —— 封装 Claude Agent SDK 的 query() API。
 *
 * 提供流式迭代和一次性收集两种调用方式。
 */
export class AgentClient {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * 流式调用 —— 边迭代边处理 SDK 消息，适合 SSE 实时输出。
   */
  async *stream(
    options: QueryOptions,
  ): AsyncGenerator<SDKMessage> {
    const mcpConfig = getGitHubMCPConfig(this.config.githubToken);

    const mergedOptions: Record<string, unknown> = {
      maxTurns: options.maxTurns ?? this.config.maxTurns,
      model: options.model ?? this.config.model,
      allowedTools: this.config.allowedTools,
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: {
        github: mcpConfig,
      },
    };

    // 多轮对话：传入 sessionId 进行 resume
    if (options.sessionId) {
      mergedOptions.resume = options.sessionId;
    }

    try {
      for await (const message of query({
        prompt: options.prompt,
        options: mergedOptions,
      })) {
        yield message;
      }
    } catch (error) {
      console.error("[AgentClient] 流式调用失败:", error);
    }
  }

  /**
   * 扩展流式迭代器，将 SDK message 解析为更友好的块格式。
   */
  async *streamBlocks(
    options: QueryOptions,
  ): AsyncGenerator<{
    block: AssistantMessageBlock;
    raw: SDKMessage;
  }> {
    for await (const message of this.stream(options)) {
      // assistant 消息可能包含 text/tool_use 多个块
      if (message.type === "assistant" && message.message?.content) {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              yield {
                block: { type: "text", text: block.text },
                raw: message,
              };
            } else if (block.type === "tool_use") {
              yield {
                block: {
                  type: "tool_use",
                  toolName: block.name,
                  toolInput: block.input,
                  toolId: block.id,
                },
                raw: message,
              };
            }
          }
        } else if (typeof content === "string") {
          yield {
            block: { type: "text", text: content },
            raw: message,
          };
        }
      } else {
        // 透传其他类型消息（result / system / user）
        yield { block: { type: "system_event" } as unknown as AssistantMessageBlock, raw: message };
      }
    }
  }

  /**
   * 一次性调用 —— 收集所有结果后返回，适合普通 HTTP API。
   */
  async queryOnce(options: QueryOptions): Promise<ProcessedResult> {
    const messages: SDKMessage[] = [];
    let totalCost = 0;
    let duration = 0;

    for await (const message of this.stream(options)) {
      messages.push(message);
      if (message.type === "result" && message.subtype === "success") {
        totalCost = message.total_cost_usd ?? 0;
        duration = message.duration_ms ?? 0;
      }
    }

    return { messages, cost: totalCost, duration };
  }
}
