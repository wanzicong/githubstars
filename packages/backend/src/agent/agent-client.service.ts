import { Injectable, Logger } from '@nestjs/common';
import type { SDKMessage, SDKPartialAssistantMessage } from '@anthropic-ai/claude-agent-sdk';
import type { BetaRawContentBlockDeltaEvent, BetaRawContentBlockStartEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import { AgentCredentialService } from './agent-credential.service';
import {
    AGENT_ALLOWED_TOOLS,
    AGENT_DEFAULT_MAX_TURNS,
    AGENT_DEFAULT_MODEL,
    AGENT_MAX_THINKING_TOKENS,
    SYSTEM_PROMPT,
} from './agent.constants';

/** 解析后的消息块（替代原 AssistantMessageBlock，消除 as unknown as 强转） */
export type AgentBlock =
    | { type: 'text'; text: string }
    | { type: 'text_delta'; text: string }
    | { type: 'thinking_delta'; thinking: string }
    | { type: 'thinking_start' }
    | { type: 'text_start' }
    | { type: 'tool_use'; toolName: string; toolInput: unknown; toolId?: string }
    | { type: 'system' };

export interface AgentQueryOptions {
    prompt: string;
    sessionId?: string;
    maxTurns?: number;
    model?: string;
}

export interface AgentQueryResult {
    messages: SDKMessage[];
    cost: number;
    duration: number;
}

/** Claude Agent SDK 模块类型（动态 import 的返回类型） */
type AgentSdk = typeof import('@anthropic-ai/claude-agent-sdk');

/**
 * Agent 客户端服务 —— 封装 Claude Agent SDK 的 query() API。
 *
 * SDK 为纯 ESM 包（"type": "module"），本包为 CJS 构建，
 * 通过 NodeNext 保留的原生动态 import() 懒加载，避免 ERR_REQUIRE_ESM。
 * 懒加载同时保证 Jest（ts-jest CommonJS）在不调用 Agent 时可正常加载本模块。
 */
@Injectable()
export class AgentClientService {
    private readonly logger = new Logger(AgentClientService.name);
    private sdkPromise: Promise<AgentSdk> | null = null;

    constructor(private readonly credentials: AgentCredentialService) {}

    /** 懒加载 SDK 模块并缓存 Promise（并发调用共享同一次加载） */
    private loadSdk(): Promise<AgentSdk> {
        this.sdkPromise ??= import('@anthropic-ai/claude-agent-sdk');
        return this.sdkPromise;
    }

    /** 流式调用 —— 边迭代边产出 SDK 消息，错误向上抛由调用方处理 */
    async *stream(options: AgentQueryOptions): AsyncGenerator<SDKMessage> {
        // 每次请求前刷新凭据：设置页修改 anthropic.api_key 后无需重启即可生效
        await this.credentials.refreshCredentials();

        const { query } = await this.loadSdk();
        const mergedOptions: Record<string, unknown> = {
            maxTurns: options.maxTurns ?? AGENT_DEFAULT_MAX_TURNS,
            model: options.model ?? AGENT_DEFAULT_MODEL,
            allowedTools: AGENT_ALLOWED_TOOLS,
            systemPrompt: SYSTEM_PROMPT,
            includePartialMessages: true,
            maxThinkingTokens: AGENT_MAX_THINKING_TOKENS,
            // 强制禁用 ToolSearch 延迟加载：其 tool_reference 内容块会导致第三方网关（DeepSeek）
            // 400 "tokenization failed"，且污染会话记录使后续 resume 全部失败。
            // MCP 工具改为全量内联加载（standard 模式）。注意不能用 ??=——宿主进程可能
            // 从启动 shell 继承 ENABLE_TOOL_SEARCH=true，必须显式覆盖。
            env: { ...process.env, ENABLE_TOOL_SEARCH: 'false' },
            mcpServers: {
                github: {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-github'],
                    env: { GITHUB_TOKEN: this.credentials.getGitHubToken() },
                },
            },
        };
        if (options.sessionId) mergedOptions.resume = options.sessionId;

        for await (const message of query({ prompt: options.prompt, options: mergedOptions })) {
            yield message;
        }
    }

    /** 扩展流式迭代器，将 SDK message 解析为块格式 */
    async *streamBlocks(options: AgentQueryOptions): AsyncGenerator<{ block: AgentBlock; raw: SDKMessage }> {
        for await (const message of this.stream(options)) {
            // stream_event：SDK 的 partial 流式事件，包含逐字增量
            if (message.type === 'stream_event') {
                yield { block: this.parseStreamEvent(message), raw: message };
                continue;
            }
            if (message.type !== 'assistant' || !message.message?.content) {
                yield { block: { type: 'system' }, raw: message };
                continue;
            }
            const content: unknown = message.message.content;
            if (typeof content === 'string') {
                yield { block: { type: 'text', text: content }, raw: message };
                continue;
            }
            if (Array.isArray(content)) {
                for (const block of this.parseContentBlocks(content)) {
                    yield { block, raw: message };
                }
            }
        }
    }

    /** 解析 SDK assistant 消息的内容块数组（非流式完整块） */
    private *parseContentBlocks(content: unknown[]): Generator<AgentBlock> {
        for (const item of content) {
            if (typeof item !== 'object' || item === null) continue;
            const block = item as Record<string, unknown>;
            if (block.type === 'text' && typeof block.text === 'string') {
                yield { type: 'text', text: block.text };
            } else if (block.type === 'tool_use' && typeof block.name === 'string') {
                yield {
                    type: 'tool_use',
                    toolName: block.name,
                    toolInput: block.input,
                    toolId: typeof block.id === 'string' ? block.id : undefined,
                };
            }
        }
    }

    /** 解析 stream_event 为 AgentBlock（逐字增量事件） */
    private parseStreamEvent(message: SDKPartialAssistantMessage): AgentBlock {
        const event = message.event;
        if (event.type === 'content_block_start') {
            return this.parseContentBlockStart(event);
        }
        if (event.type === 'content_block_delta') {
            return this.parseContentBlockDelta(event);
        }
        return { type: 'system' };
    }

    /** content_block_start：text/thinking 块开始标记 */
    private parseContentBlockStart(event: BetaRawContentBlockStartEvent): AgentBlock {
        const block = event.content_block;
        if (block.type === 'thinking') return { type: 'thinking_start' };
        if (block.type === 'text') return { type: 'text_start' };
        if (block.type === 'tool_use') {
            return {
                type: 'tool_use',
                toolName: block.name,
                toolInput: block.input,
                toolId: block.id,
            };
        }
        return { type: 'system' };
    }

    /** content_block_delta：逐字增量（text_delta / thinking_delta） */
    private parseContentBlockDelta(event: BetaRawContentBlockDeltaEvent): AgentBlock {
        const delta = event.delta;
        if (delta.type === 'text_delta') {
            return { type: 'text_delta', text: delta.text };
        }
        if (delta.type === 'thinking_delta') {
            return { type: 'thinking_delta', thinking: delta.thinking };
        }
        return { type: 'system' };
    }

    /** 一次性调用 —— 收集所有消息后返回 */
    async queryOnce(options: AgentQueryOptions): Promise<AgentQueryResult> {
        const messages: SDKMessage[] = [];
        let cost = 0;
        let duration = 0;
        for await (const message of this.stream(options)) {
            messages.push(message);
            if (message.type === 'result' && message.subtype === 'success') {
                cost = message.total_cost_usd ?? 0;
                duration = message.duration_ms ?? 0;
            }
        }
        return { messages, cost, duration };
    }
}
