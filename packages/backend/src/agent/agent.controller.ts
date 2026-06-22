import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    Query,
    Res,
    HttpCode,
    HttpStatus,
    Logger,
    NotFoundException,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { StreamEmitterService } from './orchestration/stream-emitter.service';
import { SessionManagerService } from './orchestration/session-manager.service';
import { WorkflowEngineService } from './orchestration/workflow-engine.service';
import { AgentExecutorService } from './execution/agent-executor.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { AgentTelemetryService } from './monitoring/agent-telemetry.service';
import { CircuitBreakerService } from './monitoring/circuit-breaker.service';
import { CreateSessionDto, QuerySessionDto } from './dto/create-session.dto';
import { ChatDto } from './dto/chat-message.dto';
import { CreateTaskDto, QueryTaskDto } from './dto/create-task.dto';
import { ExecuteWorkflowDto } from './dto/execute-workflow.dto';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { PromptSanitizerPipe } from './guards/prompt-sanitizer.pipe';

/**
 * Agent 控制器。
 *
 * 提供智能体底座的全部 REST API 和 SSE 流式端点。
 * 所有路由前缀 /api/agent/
 *
 * @callers
 *   - 前端 Agent 对话页面
 *   - 外部 API 调用方
 *
 * @depends
 *   - PrismaService — 会话/任务持久化
 *   - ConfigService — agent.* 配置读取
 *   - StreamEmitterService — SSE 流式推送
 *   - AgentExecutorService — Claude SDK 执行
 */
@UseGuards(RateLimiterGuard)
@Controller('api/agent')
export class AgentController {
    private readonly logger = new Logger(AgentController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly streamEmitter: StreamEmitterService,
        private readonly agentExecutor: AgentExecutorService,
        private readonly toolRegistry: ToolRegistryService,
        private readonly sessionManager: SessionManagerService,
        private readonly workflowEngine: WorkflowEngineService,
        private readonly telemetry: AgentTelemetryService,
        private readonly circuitBreaker: CircuitBreakerService,
    ) {}

    // ─── 会话管理 ───

    /**
     * 创建新会话。
     *
     * POST /api/agent/sessions
     */
    @Post('sessions')
    async createSession(@Body() dto: CreateSessionDto) {
        const defaultModel = await this.config.getValueDefault('agent.default_model', 'claude-sonnet-4-20250514');
        const session = await this.prisma.agentSession.create({
            data: {
                title: dto.title || '新对话',
                systemPrompt: dto.systemPrompt || null,
                model: dto.model || defaultModel,
                status: 'ACTIVE',
                createdAt: new Date(),
            },
        });
        this.logger.log(`[Agent] Session created id=${session.id}`);
        return { sessionId: Number(session.id), createdAt: session.createdAt };
    }

    /**
     * 查询会话列表。
     *
     * GET /api/agent/sessions
     */
    @Get('sessions')
    async listSessions(@Query() dto: QuerySessionDto) {
        const limit = dto.limit ?? 20;
        const offset = dto.offset ?? 0;

        const where: Record<string, unknown> = {};
        if (dto.status) where.status = dto.status;

        const [sessions, total] = await Promise.all([
            this.prisma.agentSession.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.agentSession.count({ where }),
        ]);

        return {
            sessions: sessions.map(s => ({
                id: Number(s.id),
                title: s.title,
                status: s.status,
                model: s.model,
                messageCount: s.messageCount,
                createdAt: s.createdAt,
            })),
            total,
            limit,
            offset,
        };
    }

    /**
     * 获取会话详情。
     *
     * GET /api/agent/sessions/:id
     */
    @Get('sessions/:id')
    async getSession(@Param('id') id: string) {
        const sessionId = BigInt(id);
        const session = await this.prisma.agentSession.findUnique({
            where: { id: sessionId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                    take: 100,
                },
            },
        });
        if (!session) {
            throw new NotFoundException('Session not found');
        }
        return {
            session: {
                id: Number(session.id),
                title: session.title,
                status: session.status,
                model: session.model,
                messageCount: session.messageCount,
                createdAt: session.createdAt,
            },
            messages: session.messages.map(m => ({
                id: Number(m.id),
                role: m.role,
                content: m.content,
                createdAt: m.createdAt,
            })),
        };
    }

    /**
     * 归档会话。
     *
     * DELETE /api/agent/sessions/:id
     */
    @Delete('sessions/:id')
    @HttpCode(HttpStatus.OK)
    async archiveSession(@Param('id') id: string) {
        const sessionId = BigInt(id);
        await this.prisma.agentSession.update({
            where: { id: sessionId },
            data: { status: 'ARCHIVED' },
        });
        return { success: true };
    }

    // ─── 流式对话 ───

    /**
     * 发送对话消息（SSE 流式响应）。
     *
     * POST /api/agent/sessions/:id/chat
     *
     * 返回 text/event-stream 格式的 SSE 流，事件类型包括：
     * - connected: 连接建立
     * - thinking: Agent 思考过程
     * - text_delta: 流式文本增量
     * - tool_use: 工具调用请求
     * - tool_result: 工具返回结果
     * - approval_required: 需要用户审批
     * - complete: 任务完成
     * - error: 错误
     */
    @UsePipes(PromptSanitizerPipe)
    @Post('sessions/:id/chat')
    async chatStream(
        @Param('id') sessionId: string,
        @Body() dto: ChatDto,
        @Res() res: Response,
    ) {
        const sid = BigInt(sessionId);

        // 获取会话信息
        const session = await this.prisma.agentSession.findUnique({
            where: { id: sid },
        });
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        // 持久化用户消息
        const userContent = dto.messages[dto.messages.length - 1]?.content || '';
        await this.sessionManager.appendUserMessage(Number(sid), userContent);

        // 创建 Agent 任务记录
        const task = await this.prisma.agentTask.create({
            data: {
                sessionId: sid,
                type: 'CHAT',
                status: 'PENDING',
                input: JSON.parse(JSON.stringify({ messages: dto.messages.map(m => ({ role: m.role, content: m.content })) })),
                createdAt: new Date(),
            },
        });
        const taskId = Number(task.id);

        // 订阅 SSE 流
        this.streamEmitter.subscribe(taskId, res);

        // 异步执行 Agent（不阻塞响应）
        const prompt = dto.messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const executor = this.agentExecutor.execute({
            taskId,
            sessionId: Number(sid),
            prompt,
            systemPrompt: session.systemPrompt || undefined,
            timeoutMs: dto.timeoutMs,
            maxToolRounds: dto.maxToolRounds,
        });

        // 消费执行事件（StreamEmitter 已自动推送 SSE）
        for await (const _event of executor) {
            // AgentExecutor 内部已通过 StreamEmitter 推送事件
            // 这里仅消费 AsyncGenerator 保持流程推进
        }

        this.logger.log(`[Agent] Chat stream completed taskId=${taskId}`);
    }

    // ─── 异步任务 ───

    /**
     * 创建异步 Agent 任务。
     *
     * POST /api/agent/tasks
     */
    @UsePipes(PromptSanitizerPipe)
    @Post('tasks')
    async createTask(@Body() dto: CreateTaskDto) {
        const task = await this.prisma.agentTask.create({
            data: {
                type: dto.type,
                status: 'PENDING',
                priority: dto.priority ?? 0,
                input: JSON.parse(JSON.stringify(dto.input)),
                sessionId: dto.sessionId ? BigInt(dto.sessionId) : null,
                createdAt: new Date(),
            },
        });
        this.logger.log(`[Agent] Task created id=${task.id} type=${dto.type}`);
        return { taskId: Number(task.id), status: 'PENDING' };
    }

    /**
     * 查询任务列表。
     *
     * GET /api/agent/tasks
     */
    @Get('tasks')
    async listTasks(@Query() dto: QueryTaskDto) {
        const limit = dto.limit ?? 20;
        const offset = dto.offset ?? 0;

        const where: Record<string, unknown> = {};
        if (dto.status) where.status = dto.status;
        if (dto.type) where.type = dto.type;

        const [tasks, total] = await Promise.all([
            this.prisma.agentTask.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.agentTask.count({ where }),
        ]);

        return {
            tasks: tasks.map(t => ({
                id: Number(t.id),
                type: t.type,
                status: t.status,
                priority: t.priority,
                progressPct: t.progressPct,
                createdAt: t.createdAt,
                finishedAt: t.finishedAt,
            })),
            total,
            limit,
            offset,
        };
    }

    /**
     * 获取任务详情。
     *
     * GET /api/agent/tasks/:id
     */
    @Get('tasks/:id')
    async getTask(@Param('id') id: string) {
        const taskId = BigInt(id);
        const task = await this.prisma.agentTask.findUnique({
            where: { id: taskId },
            include: {
                invocations: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!task) {
            throw new NotFoundException('Task not found');
        }
        return {
            task: {
                id: Number(task.id),
                type: task.type,
                status: task.status,
                priority: task.priority,
                input: task.input,
                output: task.output,
                errorMsg: task.errorMsg,
                progressPct: task.progressPct,
                createdAt: task.createdAt,
                startedAt: task.startedAt,
                finishedAt: task.finishedAt,
            },
            invocations: task.invocations.map(inv => ({
                id: Number(inv.id),
                toolName: inv.toolName,
                toolType: inv.toolType,
                status: inv.status,
                durationMs: inv.durationMs,
                createdAt: inv.createdAt,
            })),
        };
    }

    /**
     * 任务 SSE 进度流。
     *
     * GET /api/agent/tasks/:id/stream
     */
    @Get('tasks/:id/stream')
    async taskStream(@Param('id') id: string, @Res() res: Response) {
        const taskId = parseInt(id, 10);
        this.streamEmitter.subscribe(taskId, res);
        // SSE 连接由 StreamEmitter 管理生命周期
    }

    /**
     * 取消任务。
     *
     * POST /api/agent/tasks/:id/cancel
     */
    @Post('tasks/:id/cancel')
    @HttpCode(HttpStatus.OK)
    async cancelTask(@Param('id') id: string) {
        const taskId = BigInt(id);
        await this.prisma.agentTask.update({
            where: { id: taskId },
            data: { status: 'CANCELLED', finishedAt: new Date() },
        });
        this.streamEmitter.emitError(Number(taskId), 'CANCELLED', 'Task cancelled by user');
        return { success: true };
    }

    // ─── 审批操作 ───

    /**
     * 审批通过。
     *
     * POST /api/agent/tasks/:id/approve
     */
    @Post('tasks/:id/approve')
    @HttpCode(HttpStatus.OK)
    async approveTask(@Param('id') id: string, @Body('stepId') stepId: string) {
        const taskId = BigInt(id);
        await this.prisma.agentApproval.updateMany({
            where: { taskId, stepId, status: 'PENDING' },
            data: { status: 'APPROVED', approvedAt: new Date() },
        });
        this.logger.log(`[Agent] Task approved taskId=${id} stepId=${stepId}`);
        return { success: true };
    }

    /**
     * 审批拒绝。
     *
     * POST /api/agent/tasks/:id/deny
     */
    @Post('tasks/:id/deny')
    @HttpCode(HttpStatus.OK)
    async denyTask(@Param('id') id: string, @Body('stepId') stepId: string) {
        const taskId = BigInt(id);
        await this.prisma.agentApproval.updateMany({
            where: { taskId, stepId, status: 'PENDING' },
            data: { status: 'DENIED', approvedAt: new Date() },
        });
        this.logger.log(`[Agent] Task denied taskId=${id} stepId=${stepId}`);
        return { success: true };
    }

    // ─── 审计日志 ───

    /**
     * 查询审计日志。
     *
     * GET /api/agent/audit
     */
    @Get('audit')
    async listAuditLogs(
        @Query('action') action?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        const take = Math.min(parseInt(limit || '50', 10), 200);
        const skip = parseInt(offset || '0', 10);

        const where: Record<string, unknown> = {};
        if (action) where.action = action;

        const [logs, total] = await Promise.all([
            this.prisma.agentAuditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take,
                skip,
            }),
            this.prisma.agentAuditLog.count({ where }),
        ]);

        return {
            logs: logs.map(l => ({
                id: Number(l.id),
                taskId: l.taskId ? Number(l.taskId) : null,
                sessionId: l.sessionId ? Number(l.sessionId) : null,
                action: l.action,
                actor: l.actor,
                detail: l.detail,
                createdAt: l.createdAt,
            })),
            total,
            limit: take,
            offset: skip,
        };
    }

    // ─── 工具管理 ───

    /**
     * 获取已注册的工具清单。
     *
     * GET /api/agent/tools
     */
    @Get('tools')
    getToolList() {
        return {
            tools: this.toolRegistry.getToolList(),
            total: this.toolRegistry.toolCount,
        };
    }

    // ─── 多 Agent 编排 ───

    /**
     * 执行 Fan-Out/Fan-In 多 Agent 工作流。
     *
     * POST /api/agent/workflows/execute
     */
    @UsePipes(PromptSanitizerPipe)
    @Post('workflows/execute')
    async executeWorkflow(
        @Body() body: ExecuteWorkflowDto,
    ) {
        const session = body.sessionId
            ? await this.prisma.agentSession.findUnique({ where: { id: BigInt(body.sessionId) } })
            : await this.prisma.agentSession.create({
                data: {
                    title: 'Multi-Agent Workflow',
                    status: 'ACTIVE',
                    createdAt: new Date(),
                },
            });

        if (!session) throw new NotFoundException('Session not found');

        const sessionId = Number(session.id);

        // 创建任务记录
        const task = await this.prisma.agentTask.create({
            data: {
                sessionId: BigInt(sessionId),
                type: 'CUSTOM',
                status: 'PENDING',
                input: JSON.parse(JSON.stringify(body)),
                createdAt: new Date(),
            },
        });
        const taskId = Number(task.id);

        // 异步执行工作流
        this.workflowEngine.executeFanOutFanIn(
            taskId,
            sessionId,
            body.subTasks,
            body.reportPrompt,
        ).catch(err => {
            this.logger.error(`[Agent] Workflow failed taskId=${taskId}: ${err.message}`);
        });

        return {
            taskId,
            sessionId,
            subTaskCount: body.subTasks.length,
            message: 'Workflow started. Monitor progress via GET /api/agent/tasks/:id/stream',
        };
    }

    // ─── 监控与状态 ───

    /**
     * 获取智能体底座运行状态和指标。
     *
     * GET /api/agent/status
     */
    @Get('status')
    async getStatus() {
        const snapshot = this.telemetry.getSnapshot();
        const dbStats = await this.telemetry.getDbStats();
        const breakers = this.circuitBreaker.getStatus();

        return {
            service: 'agent-platform',
            status: 'running',
            ...snapshot,
            database: dbStats,
            circuitBreakers: breakers,
            tools: {
                registered: this.toolRegistry.toolCount,
                list: this.toolRegistry.getToolList().map(t => t.name),
            },
            sseConnections: this.streamEmitter.activeTaskCount,
        };
    }

    /**
     * 手动重置指定熔断器。
     *
     * POST /api/agent/breakers/:name/reset
     */
    @Post('breakers/:name/reset')
    resetBreaker(@Param('name') name: string) {
        this.circuitBreaker.reset(name);
        return { success: true, message: `Circuit breaker "${name}" reset` };
    }

    /**
     * 获取所有熔断器状态。
     *
     * GET /api/agent/breakers
     */
    @Get('breakers')
    getBreakers() {
        return { breakers: this.circuitBreaker.getStatus() };
    }
}
