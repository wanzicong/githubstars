import { Body, Controller, Delete, Get, Logger, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AgentClientService } from './agent-client.service';
import type { AgentBlock } from './agent-client.service';
import { AgentSessionService } from './agent-session.service';
import type { MessageBlock } from './agent-session.service';
import { selectResumableSessionId } from './agent-error.utils';
import { AgentRequestSchema } from './dto/agent-request.dto';
import type { AgentRequestDto, SessionModeDto } from './dto/agent-request.dto';

/** chat 端点的会话上下文 */
interface ChatSessionContext {
    ourSessionId?: string;
    sdkSessionId?: string;
}

/** 流式增量合并为完整块前的暂存草稿（任一时刻最多一项非空） */
interface BlockDraft {
    text: string;
    thinking: string;
}

@ApiTags('agent')
@Controller('api/agent')
export class AgentController {
    private readonly logger = new Logger(AgentController.name);
    /** H3: 会话级并发锁——正在处理流式请求的会话 ID 集合 */
    private readonly activeSessions = new Set<string>();

    constructor(
        private readonly agentClient: AgentClientService,
        private readonly sessionService: AgentSessionService,
    ) {}

    /** POST /api/agent/chat — SSE 流式对话 */
    @Post('chat')
    @ApiOperation({ summary: 'Agent 流式对话', description: 'SSE 推送 assistant_message/tool_use/result/error 事件' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string' },
                session: { type: 'object' },
                maxTurns: { type: 'number' },
                model: { type: 'string' },
            },
            required: ['message', 'session'],
        },
    })
    async chat(@Body(new ZodValidationPipe(AgentRequestSchema)) body: AgentRequestDto, @Res() res: Response) {
        this.writeSseHeaders(res);
        const ctx = await this.resolveSessionContext(body.session, res);
        if (!ctx) return; // resolveSessionContext 已写 error 事件并 end

        // H3: 会话并发锁——同一会话同时只允许一个流
        if (ctx.ourSessionId && this.activeSessions.has(ctx.ourSessionId)) {
            this.writeSse(res, 'error', '该会话正在处理另一个请求，请稍候');
            res.end();
            return;
        }
        if (ctx.ourSessionId) this.activeSessions.add(ctx.ourSessionId);

        let closed = false;
        res.on('close', () => {
            closed = true;
        });
        // 防止客户端断开后 write 触发 ERR_STREAM_DESTROYED 导致进程崩溃
        res.on('error', () => {
            closed = true;
        });

        // F3: SSE 心跳——每 30s 发送注释帧，防止网关/代理空闲断开
        const heartbeat = setInterval(() => {
            if (!closed && !res.destroyed) res.write(': heartbeat\n\n');
        }, 30_000);

        // blocks/draft 提升到 chat 作用域：无论流正常结束、被客户端中断、还是中途异常，
        // 都能把已收集的 assistant 内容持久化，避免最后一条回复整段丢失。
        const assistantBlocks: MessageBlock[] = [];
        const draft: BlockDraft = { text: '', thinking: '' };
        try {
            await this.streamAgentToClient(body, ctx, res, () => closed, assistantBlocks, draft);
            if (!closed && !res.destroyed) {
                this.writeSse(res, 'result', { sessionId: ctx.ourSessionId }, ctx.ourSessionId);
                res.end();
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(`Agent chat 失败: ${msg}`);
            if (!closed && !res.destroyed) {
                this.writeSse(res, 'error', msg);
                res.end();
            }
        } finally {
            clearInterval(heartbeat);
            if (ctx.ourSessionId) this.activeSessions.delete(ctx.ourSessionId);
        }
        // H2: 持久化放在 try/catch 之外 —— 正常结束、客户端中断、中途异常三条路径
        // 都把已收集的 blocks 落库（含中断时的部分回复），保证用户消息不丢、assistant 尽量保留。
        await this.persistMessages(ctx.ourSessionId, body.message, assistantBlocks);
    }

    /** POST /api/agent/query — 一次性查询（JSON 响应） */
    @Post('query')
    @ApiOperation({ summary: 'Agent 一次性查询', description: '收集全部响应后返回 JSON' })
    async query(@Body(new ZodValidationPipe(AgentRequestSchema)) body: AgentRequestDto) {
        const ctx = await this.resolveSessionForQuery(body.session);
        if ('error' in ctx) return { success: false, error: ctx.error };

        const result = await this.agentClient.queryOnce({
            prompt: body.message,
            sessionId: ctx.sdkSessionId,
            maxTurns: body.maxTurns,
            model: body.model,
            context: body.context,
        });
        const resultText = this.extractResultText(result.messages);

        if (ctx.ourSessionId) {
            await this.captureSdkSessionIdFromMessages(result.messages, ctx.ourSessionId);
            await this.persistMessages(ctx.ourSessionId, body.message, this.extractBlocks(result.messages));
        }
        return { success: true, result: resultText, sessionId: ctx.ourSessionId, cost: result.cost, duration: result.duration };
    }

    /** GET /api/agent/sessions — 会话列表 */
    @Get('sessions')
    @ApiOperation({ summary: '获取 Agent 会话列表' })
    async listSessions(@Query('limit') limit?: string, @Query('offset') offset?: string) {
        const parsedLimit = Number.parseInt(limit ?? '', 10) || 50;
        const parsedOffset = Number.parseInt(offset ?? '', 10) || 0;
        const sessions = await this.sessionService.listSessions(Math.min(Math.max(parsedLimit, 1), 200), Math.max(parsedOffset, 0));
        return { success: true, sessions };
    }

    /** POST /api/agent/sessions — 创建新会话 */
    @Post('sessions')
    @ApiOperation({ summary: '创建 Agent 会话' })
    async createSession() {
        const sessionId = await this.sessionService.createSession('auto');
        return { success: true, sessionId };
    }

    /** GET /api/agent/sessions/:id — 会话详情与消息历史 */
    @Get('sessions/:id')
    @ApiOperation({ summary: '获取会话详情与消息历史' })
    async getSession(@Param('id') id: string) {
        const session = await this.sessionService.getSession(id);
        if (!session) return { success: false, error: '会话不存在或已关闭' };
        const messages = await this.sessionService.getMessages(id);
        return { success: true, session: { id: session.id, type: session.type, status: session.status }, messages };
    }

    /** DELETE /api/agent/sessions/:id — 关闭会话 */
    @Delete('sessions/:id')
    @ApiOperation({ summary: '关闭（删除）会话' })
    async deleteSession(@Param('id') id: string) {
        // H5: 检查是否有进行中的流，避免关闭后流仍写消息
        if (this.activeSessions.has(id)) {
            return { success: false, error: '该会话正在处理请求，请等待完成后再关闭' };
        }
        await this.sessionService.closeSession(id);
        return { success: true };
    }

    // ── 私有辅助方法 ──

    /** 写 SSE 响应头（ResponseInterceptor 检测到 text/event-stream 自动跳过包装） */
    private writeSseHeaders(res: Response): void {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
    }

    /** 写一条 SSE 事件 */
    private writeSse(res: Response, type: string, data: unknown, sessionId?: string): void {
        res.write(`data: ${JSON.stringify({ type, data, sessionId, timestamp: new Date().toISOString() })}\n\n`);
    }

    /**
     * 处理 chat 的会话模式，返回会话上下文。
     * resume 会话不存在时写 error 事件并 end，返回 null。
     */
    private async resolveSessionContext(session: SessionModeDto, res: Response): Promise<ChatSessionContext | null> {
        if (session.type === 'none') return {};
        if (session.type === 'auto') {
            const ourSessionId = await this.sessionService.createSession('auto');
            this.writeSse(res, 'connected', undefined, ourSessionId);
            return { ourSessionId };
        }
        const existing = await this.sessionService.getSession(session.id);
        if (!existing) {
            this.writeSse(res, 'error', '会话不存在或已关闭');
            res.end();
            return null;
        }
        this.writeSse(res, 'connected', undefined, existing.id);
        return { ourSessionId: existing.id, sdkSessionId: existing.sdkSessionId ?? undefined };
    }

    /** 处理 query 的会话模式（非 SSE，错误以对象返回） */
    private async resolveSessionForQuery(session: SessionModeDto): Promise<ChatSessionContext | { error: string }> {
        if (session.type === 'none') return {};
        if (session.type === 'auto') return { ourSessionId: await this.sessionService.createSession('auto') };
        const existing = await this.sessionService.getSession(session.id);
        if (!existing) return { error: '会话不存在或已关闭' };
        return { ourSessionId: existing.id, sdkSessionId: existing.sdkSessionId ?? undefined };
    }

    /**
     * 解析本次生效的对话上下文：
     * - 本次请求显式带了上下文 → 使用并持久化到会话 metadata（供后续 resume 沿用）；
     * - 没带（如 resume 会话）→ 尝试从会话 metadata 回填，保证上下文不丢。
     */
    private async resolveEffectiveContext(
        ourSessionId: string | undefined,
        requestContext: AgentRequestDto['context'],
    ): Promise<AgentRequestDto['context']> {
        if (!ourSessionId) return requestContext;
        const hasRequestContext = Boolean(requestContext && (requestContext.repoIds?.length || requestContext.categoryIds?.length));
        if (hasRequestContext && requestContext) {
            await this.sessionService.saveSessionContext(ourSessionId, requestContext);
            return requestContext;
        }
        return (await this.sessionService.getSessionContext(ourSessionId)) ?? requestContext;
    }

    /**
     * 流式转发 Agent 消息到 SSE 客户端，把结构化 blocks 收集进传入的 blocks 数组（供持久化）。
     *
     * blocks/draft 由调用方持有：客户端中断或 SDK 流中途抛错时，本方法可能不完整返回，
     * 调用方仍能在 finally/异常路径把已收集的部分回复持久化，避免最后一条 assistant 消息丢失。
     *
     * 事件协议（前端按 type 消费）：
     * - thinking_start / thinking_delta：思考块开始 / 思考内容增量
     * - text_start / text_delta：正文块开始 / 正文逐字增量（打字机效果）
     * - tool_use：工具调用（完整块）
     * - tool_result：工具执行结果（user 消息回传）
     * 完整 text 块仅用于持久化累加，不再单独推送（增量已覆盖实时展示）。
     */
    private async streamAgentToClient(
        body: AgentRequestDto,
        ctx: ChatSessionContext,
        res: Response,
        isClosed: () => boolean,
        blocks: MessageBlock[],
        draft: BlockDraft,
    ): Promise<void> {
        // 已推送的 tool_use toolId：SDK 对同一 tool_use 会发「流式 start + 完整块」两次，按 toolId 去重只推一次
        const pushedToolIds = new Set<string>();
        // token 超限兜底：预载会话历史文本，供 service 在超限时生成摘要续聊（仅 resume 会话有历史）
        const historySource = ctx.ourSessionId ? await this.sessionService.loadHistorySource(ctx.ourSessionId) : undefined;
        // 上下文随会话持久化：本次显式带了就用并保存；没带（如 resume）则从会话 metadata 回填
        const context = await this.resolveEffectiveContext(ctx.ourSessionId, body.context);
        try {
            for await (const { block, raw } of this.agentClient.streamBlocks({
                prompt: body.message,
                sessionId: ctx.sdkSessionId,
                maxTurns: body.maxTurns,
                model: body.model,
                context,
                historySource,
                appSessionId: ctx.ourSessionId,
            })) {
                if (isClosed()) break; // 客户端断开：for-await break 会逐层调用 async generator 的 return()，确定性取消 SDK 子进程
                await this.captureSdkSessionId(raw, ctx);
                this.forwardBlockToSse(block, res, ctx.ourSessionId, pushedToolIds);
                this.collectBlock(blocks, draft, block);
            }
        } finally {
            // 收尾：flush 剩余草稿（正常结束/中断/异常都要把残缺的 text/thinking 落为完整块）
            this.finalizeDraft(blocks, draft);
        }
    }

    /** 把 draft 中残缺的 text/thinking 增量落为完整块（中断时也能保留已收到的部分内容） */
    private finalizeDraft(blocks: MessageBlock[], draft: BlockDraft): void {
        this.flushDraftThinking(blocks, draft);
        this.flushDraftText(blocks, draft);
    }

    /**
     * 将流式消息块收集为结构化 blocks，增量内容先暂存草稿再合并为完整块。
     *
     * 去重关键：SDK 在 includePartialMessages 下对同一内容会发「增量 + 完整块」两套——
     * text_delta→完整 text、thinking_delta→完整 thinking、content_block_start(tool_use)→完整 assistant 里的 tool_use。
     * 收到完整块时丢弃该块对应的流式重复，保证同一份 text/thinking/tool_use 只保留一份。
     */
    private collectBlock(blocks: MessageBlock[], draft: BlockDraft, block: AgentBlock): void {
        switch (block.type) {
            case 'text':
                // 完整 text 块到达：丢弃已累积的 text 增量草稿（同一份内容，避免重复）
                draft.text = '';
                this.flushDraftThinking(blocks, draft);
                blocks.push({ type: 'text', text: block.text });
                break;
            case 'thinking':
                // 完整 thinking 块到达：丢弃已累积的 thinking 增量草稿
                draft.thinking = '';
                this.flushDraftText(blocks, draft);
                blocks.push({ type: 'thinking', thinking: block.thinking });
                break;
            case 'text_delta':
                this.flushDraftThinking(blocks, draft);
                draft.text += block.text;
                break;
            case 'thinking_delta':
                this.flushDraftText(blocks, draft);
                draft.thinking += block.thinking;
                break;
            case 'thinking_start':
                this.flushDraftText(blocks, draft);
                break;
            case 'text_start':
                this.flushDraftThinking(blocks, draft);
                break;
            case 'tool_use':
                this.flushDraftText(blocks, draft);
                this.flushDraftThinking(blocks, draft);
                // 完整 tool_use 与流式 content_block_start(tool_use) 同 toolId 去重，只保留一份
                if (!block.toolId || !blocks.some((b) => b.type === 'tool_use' && b.toolId === block.toolId)) {
                    blocks.push({ type: 'tool_use', toolName: block.toolName, toolInput: block.toolInput, toolId: block.toolId });
                }
                break;
            case 'tool_result':
                blocks.push({ type: 'tool_result', toolUseId: block.toolUseId, content: block.content, isError: block.isError });
                break;
            default:
                break; // system：无需收集
        }
    }

    /** 草稿中的正文增量落为完整 text 块 */
    private flushDraftText(blocks: MessageBlock[], draft: BlockDraft): void {
        if (draft.text) {
            blocks.push({ type: 'text', text: draft.text });
            draft.text = '';
        }
    }

    /** 草稿中的思考增量落为完整 thinking 块 */
    private flushDraftThinking(blocks: MessageBlock[], draft: BlockDraft): void {
        if (draft.thinking) {
            blocks.push({ type: 'thinking', thinking: draft.thinking });
            draft.thinking = '';
        }
    }

    /** 将解析后的消息块按类型转发为 SSE 事件；tool_use 按 toolId 去重（流式 start 与完整块只推一次） */
    private forwardBlockToSse(block: AgentBlock, res: Response, sessionId?: string, pushedToolIds?: Set<string>): void {
        switch (block.type) {
            case 'thinking_start':
                this.writeSse(res, 'thinking_start', undefined, sessionId);
                break;
            case 'thinking_delta':
                this.writeSse(res, 'thinking_delta', block.thinking, sessionId);
                break;
            case 'text_start':
                this.writeSse(res, 'text_start', undefined, sessionId);
                break;
            case 'text_delta':
                this.writeSse(res, 'text_delta', block.text, sessionId);
                break;
            case 'tool_use':
                // 同一 toolId 只推一次：流式 content_block_start 与完整 assistant 块会重复
                if (block.toolId && pushedToolIds?.has(block.toolId)) break;
                if (block.toolId) pushedToolIds?.add(block.toolId);
                this.writeSse(res, 'tool_use', { toolName: block.toolName, toolInput: block.toolInput, toolId: block.toolId }, sessionId);
                break;
            case 'tool_result':
                this.writeSse(
                    res,
                    'tool_result',
                    { toolUseId: block.toolUseId, content: block.content, isError: block.isError },
                    sessionId,
                );
                break;
            default:
                break; // text / system：无需推送
        }
    }

    /** 从 init/result 消息捕获 SDK sessionId；result ID 是最终可恢复的主会话 ID。 */
    private async captureSdkSessionId(raw: SDKMessage, ctx: ChatSessionContext): Promise<void> {
        const isInit = raw.type === 'system' && raw.subtype === 'init';
        if ((isInit || raw.type === 'result') && raw.session_id !== ctx.sdkSessionId) {
            ctx.sdkSessionId = raw.session_id;
            if (ctx.ourSessionId) await this.sessionService.updateSdkSessionId(ctx.ourSessionId, ctx.sdkSessionId);
        }
    }

    /** query 模式：优先保存最终 result 的主会话 ID，兼容只有 init 的异常响应。 */
    private async captureSdkSessionIdFromMessages(messages: SDKMessage[], ourSessionId: string): Promise<void> {
        const sdkSessionId = selectResumableSessionId(messages);
        if (sdkSessionId) await this.sessionService.updateSdkSessionId(ourSessionId, sdkSessionId);
    }

    /** 从消息列表提取 assistant 文本（原 extractResultText 逻辑） */
    private extractResultText(messages: SDKMessage[]): string {
        const parts: string[] = [];
        for (const msg of messages) {
            if (msg.type !== 'assistant' || !msg.message?.content) continue;
            const content: unknown = msg.message.content;
            if (typeof content === 'string') {
                parts.push(content);
                continue;
            }
            if (Array.isArray(content)) {
                for (const block of this.extractTextBlocks(content)) {
                    parts.push(block);
                }
            }
        }
        return parts.join('\n');
    }

    /** 从内容块数组中提取 text 块的文本 */
    private *extractTextBlocks(content: unknown[]): Generator<string> {
        for (const item of content) {
            if (typeof item !== 'object' || item === null) continue;
            const block = item as Record<string, unknown>;
            if (block.type === 'text' && typeof block.text === 'string') {
                yield block.text;
            }
        }
    }

    /** query 模式：从收集的 SDK 消息中提取结构化 blocks（用于持久化） */
    private extractBlocks(messages: SDKMessage[]): MessageBlock[] {
        const blocks: MessageBlock[] = [];
        for (const msg of messages) {
            if (msg.type !== 'assistant' || !msg.message?.content) continue;
            const content: unknown = msg.message.content;
            if (typeof content === 'string') {
                blocks.push({ type: 'text', text: content });
            } else if (Array.isArray(content)) {
                blocks.push(...this.toMessageBlocks(content));
            }
        }
        return blocks;
    }

    /** 将 SDK 内容块数组转换为 MessageBlock 数组（跳过无法识别的块） */
    private toMessageBlocks(content: unknown[]): MessageBlock[] {
        const blocks: MessageBlock[] = [];
        for (const item of content) {
            const block = this.toMessageBlock(item);
            if (block) blocks.push(block);
        }
        return blocks;
    }

    /** 将单个 SDK 内容块转换为 MessageBlock；无法识别返回 null */
    private toMessageBlock(item: unknown): MessageBlock | null {
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
        return null;
    }

    /** auto/resume 模式持久化用户消息与 assistant 结构化回复 */
    private async persistMessages(ourSessionId: string | undefined, userMessage: string, assistantBlocks: MessageBlock[]): Promise<void> {
        if (!ourSessionId) return;
        await this.sessionService.saveMessage(ourSessionId, 'user', userMessage);
        if (assistantBlocks.length > 0) {
            await this.sessionService.saveMessage(ourSessionId, 'assistant', assistantBlocks);
        }
    }
}
