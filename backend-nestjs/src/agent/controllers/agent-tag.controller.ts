import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AgentTagService, AgentTagStreamEvent } from '../services/agent-tag.service';

/**
 * Agent 智能标签控制器
 *
 * 提供 SSE 流式端点，将 Agent SDK 的标签分析过程实时推送到前端。
 *
 * 端点:
 * - POST /api/agent/tags/stream — 流式自动打标签
 */
@ApiTags('agent')
@Controller('api/agent/tags')
export class AgentTagController {
    constructor(private readonly agentTag: AgentTagService) {}

    @Post('stream')
    @ApiOperation({
        summary: 'Agent 智能标签分析（SSE 流式）',
        description: '使用 Claude Agent SDK 自动分析仓库并打标签，以 SSE 流式推送执行过程。',
    })
    async streamAutoTag(@Body() b: any, @Req() req: Request, @Res() res: Response): Promise<void> {
        const repoIds: number[] = (b.repoIds || []).map(Number).filter((n: number) => !isNaN(n));
        if (!repoIds.length) {
            res.status(400).json({ success: false, message: '请提供仓库ID列表' });
            return;
        }

        // SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const abortController = new AbortController();
        const cleanup = () => abortController.abort();
        req.on('close', cleanup);
        req.on('error', cleanup);

        try {
            const initEvent: AgentTagStreamEvent = { type: 'status', message: 'SSE 连接已建立，正在启动 Agent...' };
            res.write(`event: status\ndata: ${JSON.stringify(initEvent)}\n\n`);

            for await (const event of this.agentTag.streamAutoTag(repoIds, abortController.signal)) {
                if (abortController.signal.aborted) break;
                res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
                if (event.type === 'error') break;
            }
        } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
        } finally {
            res.write(`event: done\ndata: {}\n\n`);
            res.end();
            req.removeListener('close', cleanup);
            req.removeListener('error', cleanup);
        }
    }
}
