import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { Subject } from 'rxjs';
import { TranslateTaskService } from './translate-task.service';

/**
 * SSE 进度事件流管理器
 *
 * 封装 SSE 长连接的生命周期管理：
 * - 流注册/清理（streams Map）
 * - 轮询 + 自动关闭（startSseStream）
 */
@Injectable()
export class SseManagerService {
    private readonly streams = new Map<number, Subject<MessageEvent>>();

    constructor(private readonly taskService: TranslateTaskService) {}

    /**
     * 启动 SSE 流：设置响应头、轮询任务进度、任务完成或客户端断开时自动关闭
     *
     * @param taskId 翻译任务 ID
     * @param res    Express Response 对象
     */
    async startSseStream(taskId: number, res: Response) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });

        const subject = new Subject<MessageEvent>();
        this.streams.set(taskId, subject);

        const interval = setInterval(async () => {
            try {
                const progress = await this.taskService.getTaskProgress(taskId);
                res.write(`data: ${JSON.stringify(progress)}\n\n`);
                if (progress.status === 'COMPLETED' || progress.status === 'FAILED' || progress.status === 'PARTIAL') {
                    clearInterval(interval);
                    this.streams.delete(taskId);
                    res.end();
                }
            } catch {
                clearInterval(interval);
                res.end();
            }
        }, 2000);

        res.on('close', () => {
            clearInterval(interval);
            this.streams.delete(taskId);
        });
    }
}
