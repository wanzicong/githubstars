import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { SDKMessage, SDKPartialAssistantMessage } from '@anthropic-ai/claude-agent-sdk';
import type { BetaRawContentBlockDeltaEvent, BetaRawContentBlockStartEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import { AgentCredentialService } from './agent-credential.service';
import { createSystemMcpServer } from './mcp/system-tools';
import { GithubRepoService } from '../github/github-repo.service';
import { CategoryService } from '../category/category.service';
import { StatsService } from '../stats/stats.service';
import { CloneService } from '../clone/clone.service';
import { DownloadService } from '../download/download.service';
import { SyncService } from '../sync/sync.service';
import { TrendingService } from '../trending/trending.service';
import { AuthorService } from '../author/author.service';
import { ConfigService } from '../config/config.service';
import { ExportService } from '../export/export.service';
import { LoggingService } from '../logging/logging.service';
import { GithubSearchService } from '../github/github-search.service';
import { RepositoryLocalizationService } from '../localization/repository-localization.service';
import { PrismaService } from '../prisma/prisma.service';
import { isMissingConversationError, isTokenOverflowError, isTransientPipeError } from './agent-error.utils';
import { AGENT_PLUGIN_REQUIRED_PATHS, resolveAgentPluginPath } from './agent-plugin.utils';
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
    | { type: 'thinking'; thinking: string }
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
    /** 对话上下文：选中的仓库/分类 ID，解析为元信息注入 system prompt */
    context?: { repoIds?: number[]; categoryIds?: number[] };
    /**
     * 会话历史摘要（token 超限重开新会话时由内部生成注入）。
     * 作为新会话的开场背景，让 Agent 在不 resume 旧会话的情况下延续对话。
     */
    historyDigest?: string;
    /** 内部：为 true 时本次为 token 超限后的重开重试，禁止再次递归重开 */
    isCompactionRetry?: boolean;
    /** 内部：用于生成历史摘要的历史文本来源（由 session 层提供/测试注入） */
    historySource?: string;
    /** 内部：应用侧会话 ID（AgentSession.id），用于 token 超限摘要等场景定位会话历史 */
    appSessionId?: string;
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
export class AgentClientService implements OnModuleInit {
    private readonly logger = new Logger(AgentClientService.name);
    private sdkPromise: Promise<AgentSdk> | null = null;
    private pluginPath: string | undefined;

    constructor(
        private readonly credentials: AgentCredentialService,
        private readonly githubRepo: GithubRepoService,
        private readonly category: CategoryService,
        private readonly stats: StatsService,
        private readonly clone: CloneService,
        private readonly download: DownloadService,
        private readonly sync: SyncService,
        private readonly trending: TrendingService,
        private readonly author: AuthorService,
        private readonly config: ConfigService,
        private readonly exportService: ExportService,
        private readonly logging: LoggingService,
        private readonly githubSearch: GithubSearchService,
        private readonly localization: RepositoryLocalizationService,
        private readonly prisma: PrismaService,
    ) {}

    onModuleInit(): void {
        this.pluginPath = this.requireAgentPluginPath();
        this.logger.log(`GitHub Stars Agent 插件已就绪: ${this.pluginPath}`);
    }

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
        const mergedOptions = await this.buildQueryOptions(options);

        try {
            yield* this.iterateQuery(query, options.prompt, mergedOptions);
        } catch (error) {
            const stderr = this.sanitizeStderr(this.stderrTail);
            // token 超限：重开新会话 + 摘要续聊（首包超长时 CLI 的 auto-compact 来不及触发，只能宿主兜底）
            if (options.sessionId && !options.isCompactionRetry && isTokenOverflowError(error)) {
                yield* this.recoverFromTokenOverflow(query, options, mergedOptions);
                return;
            }
            // 会话文件丢失：去掉 resume 用新会话重试
            if (options.sessionId && isMissingConversationError(stderr)) {
                this.logger.warn(`Claude SDK 会话 ${options.sessionId} 已丢失，自动创建新会话继续处理`);
                const retryOptions = { ...mergedOptions };
                delete retryOptions.resume;
                yield* this.iterateQuery(query, options.prompt, retryOptions);
                return;
            }
            // EPIPE/子进程异常退出等瞬态管道错误：按配置次数自动重试
            if (isTransientPipeError(error)) {
                yield* this.retryTransientPipeError(query, options.prompt, mergedOptions, error, stderr);
                return;
            }
            throw this.createExecutionError(error, stderr);
        }
    }

    /**
     * token 超限恢复：生成历史摘要后重开新会话（不带 resume）。
     * 摘要生成失败时降级为纯重开，保证对话不中断。
     */
    private async *recoverFromTokenOverflow(
        query: AgentSdk['query'],
        options: AgentQueryOptions,
        mergedOptions: Record<string, unknown>,
    ): AsyncGenerator<SDKMessage> {
        this.logger.warn(`检测到 token 超限，会话 ${options.sessionId} 将重开新会话并注入历史摘要继续`);
        const digest = options.historyDigest ?? (await this.buildHistoryDigest(options));
        const retryOptions = { ...mergedOptions };
        delete retryOptions.resume;
        const prompt = this.buildCompactionPrompt(options.prompt, digest);
        yield* this.iterateQuery(query, prompt, retryOptions);
    }

    /** 拼接重开会话的开场 prompt：历史摘要 + 用户当前消息 */
    private buildCompactionPrompt(userPrompt: string, digest: string | undefined): string {
        if (!digest) return userPrompt;
        return [
            '【会话历史摘要】由于对话上下文超出模型窗口，已自动开启新会话。以下是之前对话的摘要，请基于此继续回答：',
            digest,
            '',
            '【用户当前消息】',
            userPrompt,
        ].join('\n');
    }

    /**
     * 生成历史摘要：取选中仓库关联的最近会话消息，用同一 SDK/渠道压缩成简短摘要。
     * 任何步骤失败都返回 undefined（降级为纯重开），绝不阻断主流程。
     */
    private async buildHistoryDigest(options: AgentQueryOptions): Promise<string | undefined> {
        try {
            const source = await this.loadHistorySource(options);
            if (!source) return undefined;
            const result = await this.queryOnce({
                prompt: `请将以下对话历史压缩成一段简洁的中文摘要（200字以内），保留用户的需求、关键结论和未完成的任务：\n\n${source}`,
                context: options.context,
                maxTurns: 1,
                isCompactionRetry: true,
            });
            const text = this.extractTextFromMessages(result.messages);
            return text || undefined;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`生成历史摘要失败，降级为新会话重开: ${msg}`);
            return undefined;
        }
    }

    /** 读取用于生成摘要的历史文本（子类/测试可覆盖）。默认取上下文仓库的最近消息。 */
    // eslint-disable-next-line @typescript-eslint/require-await -- 同步返回，但签名需与子类（查 DB）保持一致
    protected async loadHistorySource(options: AgentQueryOptions): Promise<string | undefined> {
        return options.historySource;
    }

    /** 从 SDK 消息数组中提取最后一条文本内容 */
    private extractTextFromMessages(messages: SDKMessage[]): string {
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m.type === 'result' && m.subtype === 'success' && typeof m.result === 'string') {
                return m.result.trim();
            }
        }
        return '';
    }

    /** 瞬态管道错误的按次重试（同会话/同 prompt）；全部失败抛带诊断信息的错误 */
    private async *retryTransientPipeError(
        query: AgentSdk['query'],
        prompt: string,
        mergedOptions: Record<string, unknown>,
        originalError: unknown,
        stderr: string,
    ): AsyncGenerator<SDKMessage> {
        const maxRetry = await this.getPipeRetryCount();
        for (let attempt = 1; attempt <= maxRetry; attempt++) {
            this.logger.warn(`Claude SDK 子进程管道瞬态错误，第 ${attempt}/${maxRetry} 次重试: ${stderr.slice(-150)}`);
            this.stderrTail = '';
            try {
                yield* this.iterateQuery(query, prompt, { ...mergedOptions });
                return;
            } catch (retryError) {
                if (attempt === maxRetry || !isTransientPipeError(retryError)) {
                    throw this.createExecutionError(retryError, this.sanitizeStderr(this.stderrTail));
                }
            }
        }
        throw this.createExecutionError(originalError, stderr);
    }

    /** 读取 EPIPE 瞬态错误的重试次数（system_config 的 agent.pipe_retry_count，默认 3，0 表示禁用重试） */
    private async getPipeRetryCount(): Promise<number> {
        const raw = await this.config.getValueDefault('agent.pipe_retry_count', '3');
        const parsed = Number.parseInt(raw, 10);
        return Number.isNaN(parsed) || parsed < 0 ? 1 : parsed;
    }

    /** stderr 缓冲（按次重置），供瞬态重试时保留诊断信息 */
    private stderrTail = '';

    /** 迭代一次 SDK query，逐条产出消息并校验插件初始化 */
    private async *iterateQuery(
        query: AgentSdk['query'],
        prompt: string,
        mergedOptions: Record<string, unknown>,
    ): AsyncGenerator<SDKMessage> {
        for await (const message of query({ prompt, options: mergedOptions })) {
            this.assertAgentPluginInitialized(message);
            this.logCompactionBoundary(message);
            yield message;
        }
    }

    /**
     * 观测 CLI 内置 auto-compact：当上下文接近满时 CLI 会自动压缩并发出
     * compact_boundary 系统消息。记录 trigger/pre_tokens 用于验证压缩是否生效。
     */
    private logCompactionBoundary(message: SDKMessage): void {
        if (message.type !== 'system' || message.subtype !== 'compact_boundary') return;
        const meta = (message as { compact_metadata?: { trigger?: string; pre_tokens?: number } }).compact_metadata;
        this.logger.log(`CLI 触发上下文压缩: trigger=${meta?.trigger ?? 'unknown'}, pre_tokens=${meta?.pre_tokens ?? 'unknown'}`);
    }

    /** 构建 SDK query 的完整选项（含凭据、插件、MCP 服务器、stderr 采集、上下文注入） */
    private async buildQueryOptions(options: AgentQueryOptions): Promise<Record<string, unknown>> {
        const pluginPath = this.pluginPath ?? this.requireAgentPluginPath();
        this.stderrTail = '';
        const systemPrompt = await this.buildSystemPrompt(options.context);
        const mergedOptions: Record<string, unknown> = {
            maxTurns: options.maxTurns ?? AGENT_DEFAULT_MAX_TURNS,
            model: options.model ?? AGENT_DEFAULT_MODEL,
            allowedTools: AGENT_ALLOWED_TOOLS,
            systemPrompt,
            includePartialMessages: true,
            maxThinkingTokens: AGENT_MAX_THINKING_TOKENS,
            stderr: (data: string) => {
                this.stderrTail = `${this.stderrTail}${data}`.slice(-8_000);
            },
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
                    clone: this.clone,
                    download: this.download,
                    sync: this.sync,
                    trending: this.trending,
                    author: this.author,
                    config: this.config,
                    exportService: this.exportService,
                    logging: this.logging,
                    githubSearch: this.githubSearch,
                    localization: this.localization,
                }),
            },
        };
        mergedOptions.plugins = [{ type: 'local', path: pluginPath }];
        if (options.sessionId) mergedOptions.resume = options.sessionId;
        return mergedOptions;
    }

    /** 构建 system prompt：基础提示词 + 选中的仓库/分类上下文段（无上下文时原样返回） */
    private async buildSystemPrompt(context?: AgentQueryOptions['context']): Promise<string> {
        const section = await this.buildContextSection(context);
        return section ? `${SYSTEM_PROMPT}\n\n${section}` : SYSTEM_PROMPT;
    }

    /**
     * 把选中的仓库/分类解析为元信息上下文段，注入 system prompt 帮助 Agent 聚焦回答。
     * 仅注入元信息（名称/描述/语言/star/分类），不拉 README，控制 token 消耗。
     */
    private async buildContextSection(context?: AgentQueryOptions['context']): Promise<string> {
        if (!context) return '';
        const lines: string[] = [];
        if (context.repoIds && context.repoIds.length > 0) {
            const repos = await this.githubRepo.findByIds(context.repoIds);
            if (repos.length > 0) {
                lines.push('## 用户选中的仓库上下文', '以下仓库是用户当前关注的对象，回答时请优先结合它们：');
                for (const repo of repos) {
                    lines.push(this.formatRepoLine(repo));
                }
            }
        }
        if (context.categoryIds && context.categoryIds.length > 0) {
            const names = await this.fetchCategoryNames(context.categoryIds);
            if (names.length > 0) {
                lines.push(
                    '',
                    '## 用户选中的分类上下文',
                    `用户当前关注以下分类下的仓库：${names.join('、')}。回答涉及分类时可优先参考这些分类。`,
                );
            }
        }
        return lines.join('\n');
    }

    /** 格式化单个仓库为一行元信息 */
    private formatRepoLine(repo: {
        fullName: string | null;
        description: string | null;
        descriptionCn: string | null;
        language: string | null;
        starsCount: number;
    }): string {
        const desc = repo.descriptionCn ?? repo.description ?? '无描述';
        const lang = repo.language ?? '未知语言';
        return `- ${repo.fullName ?? '未知仓库'}（${lang}，★${repo.starsCount}）：${desc}`;
    }

    /** 批量取分类名称（仅元信息，不展开分类下仓库，控制 token） */
    private async fetchCategoryNames(categoryIds: number[]): Promise<string[]> {
        const categories = await this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { name: true },
        });
        return categories.map((c) => c.name);
    }

    /** 在保留原始异常 cause 的同时，将已脱敏的 CLI stderr 附加到可观测错误。 */
    private createExecutionError(error: unknown, rawStderr: string): Error {
        const message = error instanceof Error ? error.message : String(error);
        const stderr = this.sanitizeStderr(rawStderr);
        if (!stderr) return error instanceof Error ? error : new Error(message);
        this.logger.error(`Claude CLI 执行失败: ${stderr}`);
        return new Error(`${message}：${stderr}`, { cause: error });
    }

    /** 清理 CLI stderr 中的 ANSI 控制符和可能出现的凭据，仅保留末尾诊断信息。 */
    private sanitizeStderr(stderr: string): string {
        const ansiEscapePattern = new RegExp(String.raw`\u001b\[[0-?]*[ -/]*[@-~]`, 'g');
        return stderr
            .replace(ansiEscapePattern, '')
            .replace(/(ANTHROPIC_(?:API_KEY|AUTH_TOKEN)\s*[=:]\s*)\S+/gi, '$1[已隐藏]')
            .replace(/sk-ant-[A-Za-z0-9_-]+/g, '[已隐藏]')
            .trim()
            .slice(-2_000);
    }

    /** 插件是内置 Agent 的必需运行依赖，缺失时明确失败，禁止静默降级。 */
    private requireAgentPluginPath(): string {
        const pluginPath = resolveAgentPluginPath();
        if (pluginPath) return pluginPath;
        throw new Error(`未找到完整的 GitHub Stars Agent 插件；必须包含: ${AGENT_PLUGIN_REQUIRED_PATHS.join(', ')}`);
    }

    /** SDK 初始化时验证插件、MCP 连接、71 个工具和 6 个 Skills 均已真正加载。 */
    private assertAgentPluginInitialized(message: SDKMessage): void {
        if (message.type !== 'system' || message.subtype !== 'init') return;

        const pluginLoaded = message.plugins.some((plugin) => plugin.name === 'githubstars-agent');
        const mcpConnected = message.mcp_servers.some(
            (server) => server.name === 'plugin:githubstars-agent:githubstars' && server.status === 'connected',
        );
        const pluginTools = message.tools.filter((name) => name.startsWith('mcp__plugin_githubstars-agent_githubstars__'));
        const pluginSkills = message.skills.filter((name) => name.startsWith('githubstars-agent:'));

        if (!pluginLoaded || !mcpConnected || pluginTools.length !== 71 || pluginSkills.length !== 6) {
            throw new Error(
                `GitHub Stars Agent 插件初始化不完整: plugin=${pluginLoaded}, mcp=${mcpConnected}, tools=${pluginTools.length}/71, skills=${pluginSkills.length}/6`,
            );
        }

        this.logger.log(`Agent 会话已加载 GitHub Stars 插件: ${pluginTools.length} 个工具, ${pluginSkills.length} 个 Skills`);
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
        if (block.type === 'thinking' && typeof block.thinking === 'string') {
            return { type: 'thinking', thinking: block.thinking };
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
