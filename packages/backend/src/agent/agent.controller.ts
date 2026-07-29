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

        let closed = false;
        res.on('close', () => {
            closed = true;
        });
        // 防止客户端断开后 write 触发 ERR_STREAM_DESTROYED 导致进程崩溃
        res.on('error', () => {
            closed = true;
        });

        try {
            const assistantBlocks = await this.streamAgentToClient(body, ctx, res, () => closed);
            if (!closed && !res.destroyed) {
                this.writeSse(res, 'result', { sessionId: ctx.ourSessionId }, ctx.ourSessionId);
                res.end();
            }
            await this.persistMessages(ctx.ourSessionId, body.message, assistantBlocks);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(`Agent chat 失败: ${msg}`);
            if (!closed && !res.destroyed) {
                this.writeSse(res, 'error', msg);
                res.end();
            }
        }
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
     * 流式转发 Agent 消息到 SSE 客户端，返回收集的结构化 blocks（用于持久化）。
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
    ): Promise<MessageBlock[]> {
        const blocks: MessageBlock[] = [];
        const draft: BlockDraft = { text: '', thinking: '' };
        for await (const { block, raw } of this.agentClient.streamBlocks({
            prompt: body.message,
            sessionId: ctx.sdkSessionId,
            maxTurns: body.maxTurns,
            model: body.model,
        })) {
            if (isClosed()) break; // 客户端断开：for-await break 会逐层调用 async generator 的 return()，确定性取消 SDK 子进程
            await this.captureSdkSessionId(raw, ctx);
            this.forwardBlockToSse(block, res, ctx.ourSessionId);
            this.collectBlock(blocks, draft, block);
        }
        // 收尾：flush 剩余草稿（任一时刻最多一项非空，顺序不影响结果）
        this.flushDraftThinking(blocks, draft);
        this.flushDraftText(blocks, draft);
        return blocks;
    }

    /** 将流式消息块收集为结构化 blocks，增量内容先暂存草稿再合并为完整块 */
    private collectBlock(blocks: MessageBlock[], draft: BlockDraft, block: AgentBlock): void {
        switch (block.type) {
            case 'text':
                this.flushDraftThinking(blocks, draft);
                this.flushDraftText(blocks, draft);
                blocks.push({ type: 'text', text: block.text });
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
                blocks.push({ type: 'tool_use', toolName: block.toolName, toolInput: block.toolInput, toolId: block.toolId });
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

    /** 将解析后的消息块按类型转发为 SSE 事件 */
    private forwardBlockToSse(block: AgentBlock, res: Response, sessionId?: string): void {
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
