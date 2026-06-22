import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * SSE 流式事件类型。
 */
export type AgentEventType =
    | 'thinking'
    | 'progress'
    | 'tool_use'
    | 'tool_result'
    | 'text_delta'
    | 'approval_required'
    | 'complete'
    | 'error';

/**
 * Agent SSE 事件数据。
 */
export interface AgentStreamEvent {
    taskId: number;
    type: AgentEventType;
    data: Record<string, unknown>;
}

/**
 * 事件驱动 SSE 推送服务。
 *
 * 替代旧的 2 秒轮询 SseManagerService，采用 EventEmitter 驱动模式：
 * 事件发生时立即通过 res.write() 推送到所有订阅的客户端。
 *
 * 核心特性：
 * - 1:N 订阅模型：一个任务可被多个客户端同时监听
 * - 即时推送：事件驱动，延迟 < 50ms（旧模式最高 2 秒）
 * - 断线清理：客户端断开自动移除订阅
 * - 完成收尾：任务完成后自动关闭所有 SSE 连接
 *
 * @callers
 *   - AgentExecutorService — 执行 hooks 中调用各类 emit 方法
 *   - AgentController.chatStream() / taskStream() — 订阅 SSE 流
 *
 * @see translate/sse-manager.service.ts — 旧的轮询模式 SSE（保留兼容）
 */
@Injectable()
export class StreamEmitterService {
    private readonly logger = new Logger(StreamEmitterService.name);

    /**
     * 任务 ID → 订阅的 Response 集合。
     * 一对多关系：同一任务可被多个客户端同时订阅。
     */
    private readonly subscribers = new Map<number, Set<Response>>();

    /**
     * 客户端订阅某任务的 SSE 流。
     *
     * 设置 SSE 响应头（Content-Type: text/event-stream），
     * 注册客户端到订阅表，监听 close 事件自动清理。
     *
     * @param taskId — 任务 ID
     * @param res — Express Response 对象
     */
    subscribe(taskId: number, res: Response): void {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        });

        // 先发一个连接确认事件
        res.write(`event: connected\ndata: {"taskId":${taskId}}\n\n`);

        if (!this.subscribers.has(taskId)) {
            this.subscribers.set(taskId, new Set());
        }
        this.subscribers.get(taskId)!.add(res);

        this.logger.debug(`[SSE] Client subscribed to taskId=${taskId}, total subscribers=${this.subscribers.get(taskId)!.size}`);

        res.on('close', () => this.unsubscribe(taskId, res));
    }

    /**
     * 客户端断开订阅。
     */
    private unsubscribe(taskId: number, res: Response): void {
        const set = this.subscribers.get(taskId);
        if (set) {
            set.delete(res);
            this.logger.debug(`[SSE] Client unsubscribed from taskId=${taskId}, remaining=${set.size}`);
            if (set.size === 0) {
                this.subscribers.delete(taskId);
            }
        }
    }

    /**
     * 广播 SSE 事件到指定任务的所有订阅客户端。
     */
    private emit(taskId: number, event: AgentEventType, data: Record<string, unknown>): void {
        const subs = this.subscribers.get(taskId);
        if (!subs || subs.size === 0) return;

        const payload = JSON.stringify({ taskId, ...data });
        const msg = `event: ${event}\ndata: ${payload}\n\n`;

        for (const res of subs) {
            try {
                res.write(msg);
            } catch {
                // 客户端已断开，移除
                subs.delete(res);
            }
        }
    }

    // ─── 业务事件发送方法 ───

    /** 思考过程 */
    emitThinking(taskId: number, text: string): void {
        this.emit(taskId, 'thinking', { text });
    }

    /** 进度更新 */
    emitProgress(taskId: number, data: {
        step: string;
        current: number;
        total: number;
        msg?: string;
    }): void {
        this.emit(taskId, 'progress', data);
    }

    /** 工具调用 */
    emitToolUse(taskId: number, data: {
        id: string;
        name: string;
        input: unknown;
    }): void {
        this.emit(taskId, 'tool_use', {
            id: data.id,
            name: data.name,
            input: data.input,
        });
    }

    /** 工具返回 */
    emitToolResult(taskId: number, data: {
        id: string;
        name?: string;
        output: unknown;
    }): void {
        this.emit(taskId, 'tool_result', {
            id: data.id,
            name: data.name,
            output: data.output,
        });
    }

    /** 流式文本增量 */
    emitTextDelta(taskId: number, text: string): void {
        this.emit(taskId, 'text_delta', { text });
    }

    /** 需要审批 */
    emitApprovalRequired(taskId: number, data: {
        stepId: string;
        toolName: string;
        description: string;
        input: unknown;
    }): void {
        this.emit(taskId, 'approval_required', data);
    }

    /** 任务完成 */
    emitComplete(taskId: number, summary?: string): void {
        this.emit(taskId, 'complete', { summary });
        this.closeAll(taskId);
    }

    /** 任务错误 */
    emitError(taskId: number, code: string, message: string): void {
        this.emit(taskId, 'error', { code, message });
        this.closeAll(taskId);
    }

    /**
     * 关闭指定任务的所有 SSE 连接。
     */
    private closeAll(taskId: number): void {
        const subs = this.subscribers.get(taskId);
        if (subs) {
            for (const res of subs) {
                try { res.end(); } catch { /* ignore */ }
            }
            this.subscribers.delete(taskId);
            this.logger.debug(`[SSE] All connections closed for taskId=${taskId}`);
        }
    }

    /** 获取当前活跃订阅数（供监控使用） */
    get activeTaskCount(): number {
        return this.subscribers.size;
    }
}
