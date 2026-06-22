import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutorService } from '../execution/agent-executor.service';
import { SessionManagerService } from './session-manager.service';
import { StreamEmitterService } from './stream-emitter.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 子 Agent 任务定义。
 */
interface SubAgentTask {
    /** 子任务名称 */
    name: string;
    /** 子 Agent 的系统提示词 */
    systemPrompt: string;
    /** 子 Agent 的用户提示词 */
    prompt: string;
    /** 最大工具调用轮次 */
    maxRounds?: number;
}

/**
 * 子 Agent 执行结果。
 */
interface SubAgentResult {
    name: string;
    success: boolean;
    summary: string;
    output: Record<string, unknown>;
    error?: string;
}

/**
 * 多 Agent 编排引擎。
 *
 * 实现 Fan-Out/Fan-In 模式：
 * 1. Lead Agent 分析任务并分解为子任务
 * 2. 并行启动子 Agent 执行各自的子任务
 * 3. Report Writer Agent 聚合所有子结果，生成最终报告
 *
 * @callers
 *   - OrchestratorService — 编排层入口
 *   - AgentQueueProcessor — 异步任务执行
 */
@Injectable()
export class WorkflowEngineService {
    private readonly logger = new Logger(WorkflowEngineService.name);

    constructor(
        private readonly agentExecutor: AgentExecutorService,
        private readonly sessionManager: SessionManagerService,
        private readonly streamEmitter: StreamEmitterService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * 执行 Fan-Out/Fan-In 多 Agent 工作流。
     *
     * @param taskId — 数据库任务 ID
     * @param sessionId — 关联会话 ID
     * @param subTasks — 子任务列表
     * @param reportPrompt — 报告整合提示词
     */
    async executeFanOutFanIn(
        taskId: number,
        sessionId: number,
        subTasks: SubAgentTask[],
        reportPrompt: string,
    ): Promise<SubAgentResult[]> {
        this.logger.log(`[WorkflowEngine] Fan-Out: ${subTasks.length} sub-tasks for taskId=${taskId}`);

        // 更新进度
        await this.prisma.agentTask.update({
            where: { id: taskId },
            data: {
                progress: `并行执行 ${subTasks.length} 个子任务...`,
                totalSteps: subTasks.length + 1, // +1 for report writer
                completedSteps: 0,
            },
        });

        // Phase 1: Fan-Out — 并行执行子 Agent
        const subResults = await Promise.all(
            subTasks.map((task, index) =>
                this.executeSubAgent(taskId, sessionId, task, index, subTasks.length),
            ),
        );

        let completedCount = subTasks.length;
        await this.prisma.agentTask.update({
            where: { id: taskId },
            data: { completedSteps: completedCount },
        });

        this.streamEmitter.emitProgress(taskId, {
            step: 'aggregating',
            current: completedCount,
            total: subTasks.length + 1,
            msg: '正在整合分析结果...',
        });

        // Phase 2: Fan-In — Report Writer 聚合
        const aggregatedSummary = subResults
            .map(r => `## ${r.name}\n${r.summary}${r.error ? `\n错误: ${r.error}` : ''}`)
            .join('\n\n');

        const reportWriterPrompt = `${reportPrompt}\n\n以下是各子任务的分析结果:\n\n${aggregatedSummary}`;

        try {
            const reportExecutor = this.agentExecutor.execute({
                taskId,
                sessionId,
                prompt: reportWriterPrompt,
                systemPrompt: '你是一个专业的报告撰写 Agent。请基于各子任务的分析结果，生成一份结构清晰、重点突出的综合报告。',
                maxToolRounds: 5,
            });

            let finalReport = '';
            for await (const event of reportExecutor) {
                if (event.type === 'text_delta') {
                    finalReport += (event.data.text as string) || '';
                }
            }

            // 保存最终报告到任务输出
            await this.prisma.agentTask.update({
                where: { id: taskId },
                data: {
                    completedSteps: subTasks.length + 1,
                    progressPct: 100,
                    output: {
                        subResults: subResults.map(r => ({
                            name: r.name,
                            success: r.success,
                            summary: r.summary,
                        })),
                        finalReport,
                    },
                },
            });

            this.streamEmitter.emitComplete(taskId, '多 Agent 工作流执行完成');
            return subResults;

        } catch (error) {
            this.logger.error(`[WorkflowEngine] Report writer failed: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * 执行单个子 Agent 任务。
     */
    private async executeSubAgent(
        taskId: number,
        sessionId: number,
        task: SubAgentTask,
        index: number,
        total: number,
    ): Promise<SubAgentResult> {
        this.logger.log(`[WorkflowEngine] Sub-agent [${index + 1}/${total}] "${task.name}" starting`);

        this.streamEmitter.emitProgress(taskId, {
            step: task.name,
            current: index,
            total: total + 1,
            msg: `正在执行: ${task.name}`,
        });

        try {
            const executor = this.agentExecutor.execute({
                taskId,
                sessionId,
                prompt: task.prompt,
                systemPrompt: task.systemPrompt,
                maxToolRounds: task.maxRounds || 10,
            });

            let summary = '';
            const collectedData: Record<string, unknown> = {};

            for await (const event of executor) {
                if (event.type === 'text_delta') {
                    summary += (event.data.text as string) || '';
                } else if (event.type === 'tool_result') {
                    const data = event.data as { id: string; output: unknown };
                    collectedData[data.id] = data.output;
                }
            }

            this.logger.log(`[WorkflowEngine] Sub-agent [${index + 1}/${total}] "${task.name}" completed`);

            return {
                name: task.name,
                success: true,
                summary: summary.substring(0, 5000),
                output: collectedData,
            };
        } catch (error) {
            this.logger.error(`[WorkflowEngine] Sub-agent "${task.name}" failed: ${(error as Error).message}`);
            return {
                name: task.name,
                success: false,
                summary: `子任务 "${task.name}" 执行失败`,
                output: {},
                error: (error as Error).message,
            };
        }
    }
}
