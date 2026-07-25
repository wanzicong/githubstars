import { Injectable, Logger } from '@nestjs/common';
import type { SDKMessage, SDKPartialAssistantMessage } from '@anthropic-ai/claude-agent-sdk';
import type { BetaRawContentBlockDeltaEvent, BetaRawContentBlockStartEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import { AgentCredentialService } from './agent-credential.service';
import { createSystemMcpServer } from './mcp/system-tools';
import { GithubRepoService } from '../github/github-repo.service';
import { CategoryService } from '../category/category.service';
import { StatsService } from '../stats/stats.service';
import { TranslateService } from '../translate/translate.service';
import { TranslateTaskService } from '../translate/translate-task.service';
import { CloneService } from '../clone/clone.service';
import { DownloadService } from '../download/download.service';
import { SyncService } from '../sync/sync.service';
import { TrendingService } from '../trending/trending.service';
import { AuthorService } from '../author/author.service';
import { ConfigService } from '../config/config.service';
import { ExportService } from '../export/export.service';
import { LoggingService } from '../logging/logging.service';
import { GithubSearchService } from '../github/github-search.service';
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
    | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean }
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

    constructor(
        private readonly credentials: AgentCredentialService,
        private readonly githubRepo: GithubRepoService,
        private readonly category: CategoryService,
        private readonly stats: StatsService,
        private readonly translate: TranslateService,
        private readonly translateTask: TranslateTaskService,
        private readonly clone: CloneService,
        private readonly download: DownloadService,
        private readonly sync: SyncService,
        private readonly trending: TrendingService,
        private readonly author: AuthorService,
        private readonly config: ConfigService,
        private readonly exportService: ExportService,
        private readonly logging: LoggingService,
        private readonly githubSearch: GithubSearchService,
    ) {}

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
                system: createSystemMcpServer({
                    githubRepo: this.githubRepo,
                    category: this.category,
                    stats: this.stats,
                    translate: this.translate,
                    translateTask: this.translateTask,
                    clone: this.clone,
                    download: this.download,
                    sync: this.sync,
                    trending: this.trending,
                    author: this.author,
                    config: this.config,
                    exportService: this.exportService,
                    logging: this.logging,
                    githubSearch: this.githubSearch,
                }),
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
            for (const block of this.messageToBlocks(message)) {
                yield { block, raw: message };
            }
        }
    }

    /** 将单条 SDK 消息解析为块序列 */
    private *messageToBlocks(message: SDKMessage): Generator<AgentBlock> {
        // stream_event：SDK 的 partial 流式事件，包含逐字增量
        if (message.type === 'stream_event') {
            yield this.parseStreamEvent(message);
            return;
        }
        if (message.type !== 'assistant' || !message.message?.content) {
            // user 消息的 content 数组中可能携带 tool_result（工具执行结果回传），需转发并持久化
            yield* this.extractToolResults(message);
            yield { type: 'system' };
            return;
        }
        const content: unknown = message.message.content;
        if (typeof content === 'string') {
            yield { type: 'text', text: content };
            return;
        }
        if (Array.isArray(content)) {
            yield* this.parseContentBlocks(content);
        }
    }

    /** 从 user 消息的 content 数组中提取 tool_result 块 */
    private *extractToolResults(message: SDKMessage): Generator<AgentBlock> {
        const userContent: unknown = message.type === 'user' ? message.message?.content : undefined;
        if (!Array.isArray(userContent)) return;
        for (const block of this.parseContentBlocks(userContent)) {
            if (block.type === 'tool_result') yield block;
        }
    }

    /** 解析 SDK 消息的内容块数组（assistant 完整块 / user 携带的 tool_result） */
    private *parseContentBlocks(content: unknown[]): Generator<AgentBlock> {
        for (const item of content) {
            const block = this.toAgentBlock(item);
            if (block) yield block;
        }
    }

    /** 将单个 SDK 内容块转换为 AgentBlock；无法识别返回 null */
    private toAgentBlock(item: unknown): AgentBlock | null {
        if (typeof item !== 'object' || item === null) return null;
        const block = item as Record<string, unknown>;
        if (block.type === 'text' && typeof block.text === 'string') {
            return { type: 'text', text: block.text };
        }
        if (block.type === 'tool_use' && typeof block.name === 'string') {
            return {
                type: 'tool_use',
                toolName: block.name,
                toolInput: block.input,
                toolId: typeof block.id === 'string' ? block.id : undefined,
            };
        }
        if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
            return {
                type: 'tool_result',
                toolUseId: block.tool_use_id,
                content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
                isError: block.is_error === true,
            };
        }
        return null;
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
