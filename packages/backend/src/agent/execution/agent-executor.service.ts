import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '../../config/config.service';
import { StreamEmitterService } from '../orchestration/stream-emitter.service';

/**
 * Agent 执行上下文。
 *
 * 封装一次 Agent 查询所需的所有参数。
 */
export interface AgentExecuteContext {
    /** 数据库任务 ID */
    taskId: number;
    /** 关联会话 ID（可选） */
    sessionId?: number;
    /** 用户提示词 */
    prompt: string;
    /** 系统提示词（可选，覆盖会话级别） */
    systemPrompt?: string;
    /** 超时时间（毫秒），默认 300000（5分钟） */
    timeoutMs?: number;
    /** 最大工具调用轮次，默认 50 */
    maxToolRounds?: number;
    /** 是否需要审批模式（高风险工具需人工确认） */
    approvalMode?: boolean;
}

/**
 * Agent 执行事件。
 *
 * 通过 AsyncGenerator 逐条产出，供调用方（Controller SSE 端点）消费。
 */
export interface AgentExecuteEvent {
    type: 'thinking' | 'text_delta' | 'tool_use' | 'tool_result' | 'complete' | 'error';
    taskId: number;
    data: Record<string, unknown>;
}

/**
 * Agent 执行器 —— Claude Agent SDK 封装层。
 *
 * 职责：
 * 1. 管理 SDK 子进程生命周期
 * 2. 注册 hooks 将 SDK 事件桥接到 StreamEmitter（SSE 推送）
 * 3. 实现 canUseTool 权限模型（allow / deny / ask）
 * 4. 超时与中断控制
 * 5. 审计日志写入
 *
 * @callers
 *   - AgentController.chatStream() — 实时对话 SSE
 *   - AgentQueueProcessor — BullMQ Worker 异步执行
 *
 * @depends
 *   - @anthropic-ai/claude-agent-sdk — query() AsyncGenerator
 *   - StreamEmitterService — SSE 事件推送
 *   - PrismaService — 持久化会话/消息/审计日志
 *   - ConfigService — 读取 agent.* 配置项
 */
@Injectable()
export class AgentExecutorService {
    private readonly logger = new Logger(AgentExecutorService.name);

    /** 高风险工具列表（被拒绝，后续通过 PreToolUse hook 实现审批） */
    private readonly HIGH_RISK_TOOLS = ['clone_repo', 'export_markdown'];

    constructor(
        private readonly streamEmitter: StreamEmitterService,
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    /**
     * 执行 Agent 查询（异步生成器模式）。
     *
     * 通过 Claude Agent SDK 的 query() 函数执行一次 Agent 交互，
     * 使用 AsyncGenerator 模式逐条产出事件，供 SSE 端点消费。
     *
     * @param ctx — 执行上下文
     * @yields AgentExecuteEvent — 执行过程中的各类事件
     */
    async *execute(ctx: AgentExecuteContext): AsyncGenerator<AgentExecuteEvent> {
        const {
            taskId,
            sessionId,
            prompt,
            systemPrompt,
            timeoutMs = 300000,
            maxToolRounds = 50,
            approvalMode = true,
        } = ctx;

        this.logger.log(`[AgentExecutor] Starting taskId=${taskId} sessionId=${sessionId}`);

        // 更新任务状态 → RUNNING
        await this.prisma.agentTask.update({
            where: { id: taskId },
            data: { status: 'RUNNING', startedAt: new Date() as Date | null },
        });

        // AbortController 用于超时/取消控制
        const abortController = new AbortController();
        const timeoutHandle = setTimeout(() => {
            this.logger.warn(`[AgentExecutor] Task timeout taskId=${taskId}`);
            abortController.abort();
        }, timeoutMs);

        try {
            // 使用 ESM dynamic import 加载 Claude Agent SDK
            const { query } = await import('@anthropic-ai/claude-agent-sdk');

            const defaultModel = await this.config.getValueDefault('agent.default_model', 'claude-sonnet-4-20250514');

            // 构建 SDK 查询参数
            const queryParams = {
                prompt: prompt,
                options: {
                    abortController,
                    model: defaultModel,
                    maxTurns: maxToolRounds,
                    includePartialMessages: true,
                    permissionMode: 'default' as const,
                    // canUseTool 权限回调 —— 核心安全入口
                    canUseTool: await this.createCanUseToolCallback(taskId, approvalMode),
                    // 环境变量 — 仅传递必要的非敏感变量，避免泄露 DATABASE_URL 等密钥
                    env: {
                        PATH: process.env.PATH,
                        HOME: process.env.HOME,
                        USER: process.env.USER,
                        CLAUDE_AGENT_SDK_CLIENT_APP: 'githubstars/1.0.0',
                    },
                },
            };

            // 如果有系统提示词，通过环境变量传递给SDK
            // 注：SDK 的 query() 第一个参数可以是包含 system 消息的格式
            // 这里我们使用简单的 prompt 字符串模式

            const result = query(queryParams);

            // 消费 AsyncGenerator
            for await (const message of result) {
                // 根据消息类型分发事件
                const msg = message as Record<string, unknown>;

                if (msg.type === 'assistant') {
                    // 处理 assistant 消息中的 content blocks
                    const content = msg.message as Record<string, unknown>;
                    if (content?.content && Array.isArray(content.content)) {
                        for (const block of content.content as Array<Record<string, unknown>>) {
                            if (block.type === 'text') {
                                const text = (block as { text: string }).text || '';
                                this.streamEmitter.emitTextDelta(taskId, text);
                                yield { type: 'text_delta', taskId, data: { text } };
                            } else if (block.type === 'tool_use') {
                                const toolBlock = block as { id: string; name: string; input: unknown };
                                this.streamEmitter.emitToolUse(taskId, {
                                    id: toolBlock.id,
                                    name: toolBlock.name,
                                    input: toolBlock.input,
                                });
                                yield {
                                    type: 'tool_use',
                                    taskId,
                                    data: { id: toolBlock.id, name: toolBlock.name, input: toolBlock.input },
                                };
                            } else if (block.type === 'thinking') {
                                const thinkingText = (block as { thinking: string }).thinking || '';
                                this.streamEmitter.emitThinking(taskId, thinkingText);
                                yield { type: 'thinking', taskId, data: { text: thinkingText } };
                            }
                        }
                    }
                } else if (msg.type === 'user') {
                    // 处理 tool_result
                    const userMsg = msg.message as Record<string, unknown>;
                    if (userMsg?.content && Array.isArray(userMsg.content)) {
                        for (const block of userMsg.content as Array<Record<string, unknown>>) {
                            if (block.type === 'tool_result') {
                                const toolBlock = block as { tool_use_id: string; content: unknown };
                                this.streamEmitter.emitToolResult(taskId, {
                                    id: toolBlock.tool_use_id,
                                    output: toolBlock.content,
                                });
                                yield {
                                    type: 'tool_result',
                                    taskId,
                                    data: { id: toolBlock.tool_use_id, output: toolBlock.content },
                                };
                            }
                        }
                    }
                } else if (msg.type === 'error') {
                    const errMsg = (msg as { message?: string }).message || 'Unknown error';
                    throw new Error(errMsg);
                }
            }

            // 成功完成
            this.logger.log(`[AgentExecutor] Task completed taskId=${taskId}`);
            await this.prisma.agentTask.update({
                where: { id: taskId },
                data: { status: 'COMPLETED', progressPct: 100, finishedAt: new Date() as Date | null },
            });
            this.streamEmitter.emitComplete(taskId, '任务执行完成');
            yield { type: 'complete', taskId, data: { summary: '任务执行完成' } };

        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            const isCancelled = err.name === 'AbortError';
            const status = isCancelled ? 'CANCELLED' : 'FAILED';
            const errorMsg = isCancelled ? 'Task timeout or cancelled' : err.message;

            this.logger.error(`[AgentExecutor] Task failed taskId=${taskId} status=${status} err=${errorMsg}`);

            await this.prisma.agentTask.update({
                where: { id: taskId },
                data: { status, errorMsg, finishedAt: new Date() as Date | null },
            });
            await this.writeAuditLog(taskId, sessionId, `TASK_${status}`, errorMsg);
            this.streamEmitter.emitError(taskId, isCancelled ? 'TIMEOUT' : 'EXECUTION_ERROR', errorMsg);
            yield { type: 'error', taskId, data: { code: isCancelled ? 'TIMEOUT' : 'EXECUTION_ERROR', message: errorMsg } };

        } finally {
            clearTimeout(timeoutHandle);
        }
    }

    /**
     * 创建 canUseTool 权限回调。
     *
     * 实现权限模型：
     * - 黑名单工具 → deny
     * - 高风险工具 + 审批模式 → deny（Phase 3 将通过 PreToolUse hook 实现审批流程）
     * - 其他工具 → allow
     */
    private async createCanUseToolCallback(
        taskId: number,
        approvalMode: boolean,
    ): Promise<(toolName: string, input: Record<string, unknown>, options: { signal: AbortSignal }) => Promise<{ behavior: 'allow'; updatedInput?: Record<string, unknown> } | { behavior: 'deny'; message: string }>> {
        const blockedToolsStr = await this.config.getValueDefault('agent.blocked_tools', '');
        const blockedTools = blockedToolsStr ? blockedToolsStr.split(',').map((s: string) => s.trim()) : [];

        return async (toolName: string, input: Record<string, unknown>, _options: { signal: AbortSignal }) => {
            // 1. 检查黑名单
            if (blockedTools.includes(toolName)) {
                this.logger.warn(`[AgentExecutor] Blocked tool: ${toolName} taskId=${taskId}`);
                await this.writeAuditLog(taskId, undefined, 'TOOL_BLOCKED', `Blocked tool: ${toolName}`);
                return { behavior: 'deny' as const, message: `Tool "${toolName}" is blocked` };
            }

            // 2. 高风险工具 + 审批模式 → 拒绝并记录审批请求
            if (approvalMode && this.HIGH_RISK_TOOLS.includes(toolName)) {
                this.logger.log(`[AgentExecutor] High-risk tool denied (approval not yet supported): ${toolName} taskId=${taskId}`);

                // 创建审批记录供 Phase 3 使用
                await this.prisma.agentApproval.create({
                    data: {
                        taskId,
                        stepId: `approve_${toolName}_${Date.now()}`,
                        toolName,
                        description: `Agent wants to use "${toolName}"`,
                        input: input as unknown as Parameters<typeof this.prisma.agentApproval.create>[0]['data']['input'],
                        status: 'PENDING',
                        createdAt: new Date(),
                    },
                });

                // 推送审批事件到 SSE
                this.streamEmitter.emitApprovalRequired(taskId, {
                    stepId: `approve_${toolName}_${Date.now()}`,
                    toolName,
                    description: `Agent wants to use "${toolName}"`,
                    input,
                });

                return {
                    behavior: 'deny' as const,
                    message: `Tool "${toolName}" requires approval. This feature will be available in Phase 3.`,
                };
            }

            // 3. 记录工具调用审计
            await this.writeAuditLog(taskId, undefined, 'TOOL_CALLED', `Tool called: ${toolName}`);
            return { behavior: 'allow' as const };
        };
    }

    /**
     * 写入审计日志。
     */
    private async writeAuditLog(
        taskId: number,
        sessionId: number | undefined,
        action: string,
        detail: string,
    ): Promise<void> {
        try {
            await this.prisma.agentAuditLog.create({
                data: {
                    taskId,
                    sessionId: sessionId ?? null,
                    action,
                    detail,
                    createdAt: new Date(),
                },
            });
        } catch (err) {
            this.logger.error(`[AgentExecutor] Failed to write audit log: ${(err as Error).message}`);
        }
    }
}
