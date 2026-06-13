import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AgentSimilarService, AgentStreamEvent } from '../services/agent-similar.service';

/**
 * Agent 相似项目搜索控制器
 *
 * 提供 SSE (Server-Sent Events) 流式端点，
 * 将 Agent SDK 的执行过程实时推送到前端。
 *
 * 端点:
 * - GET /api/agent/similar/:repoId/stream — 流式搜索相似项目
 */
@ApiTags('agent')
@Controller('api/agent/similar')
export class AgentSimilarController {
    constructor(private readonly agentSimilar: AgentSimilarService) {}

    /**
     * SSE 流式端点: 启动 Agent 相似项目搜索
     *
     * 使用 text/event-stream 协议将 Agent 的思考过程、
     * 工具调用和最终结果实时推送到前端。
     *
     * 客户端通过 EventSource API 连接此端点即可接收流式事件。
     *
     * 事件类型:
     * - status: 状态更新
     * - thinking: Agent 的推理文本
     * - tool_call: Agent 调用工具
     * - tool_result: 工具执行结果
     * - result: 最终推荐报告
     * - error: 错误信息
     * - done: 流结束
     *
     * @param repoId 源仓库 ID
     * @param req Express 请求对象（用于检测客户端断开）
     * @param res Express 响应对象（用于写入 SSE 数据）
     */
    @Get(':repoId/stream')
    @ApiOperation({
        summary: 'Agent 相似项目搜索（SSE 流式）',
        description:
            '使用 Claude Agent SDK 通过 WebSearch/WebFetch 搜索相似项目，' + '以 SSE 流式推送执行过程。每个事件为 JSON 格式。',
    })
    @ApiParam({ name: 'repoId', description: '源仓库 ID' })
    async streamSearch(@Param('repoId') repoId: string, @Req() req: Request, @Res() res: Response): Promise<void> {
        const numericId = parseInt(repoId, 10);
        if (isNaN(numericId)) {
            res.status(400).json({ success: false, message: '无效的仓库 ID' });
            return;
        }

        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
        res.flushHeaders();

        // 创建 AbortSignal，客户端断开时中止 Agent 执行
        const abortController = new AbortController();

        const cleanup = () => {
            abortController.abort();
        };
        req.on('close', cleanup);
        req.on('error', cleanup);

        try {
            // 发送初始连接事件
            const initEvent: AgentStreamEvent = {
                type: 'status',
                message: 'SSE 连接已建立，正在启动 Agent...',
            };
            res.write(`event: status\ndata: ${JSON.stringify(initEvent)}\n\n`);

            // 流式消费 Agent 执行事件
            for await (const event of this.agentSimilar.streamSimilarSearch(numericId, abortController.signal)) {
                if (abortController.signal.aborted) break;

                const eventName = event.type;
                const data = JSON.stringify(event);
                res.write(`event: ${eventName}\ndata: ${data}\n\n`);

                // 如果发生错误，停止流
                if (event.type === 'error') break;
            }
        } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            const errorEvent: AgentStreamEvent = { type: 'error', message: errMsg };
            res.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
        } finally {
            // 发送流结束事件
            res.write(`event: done\ndata: {}\n\n`);
            res.end();
            req.removeListener('close', cleanup);
            req.removeListener('error', cleanup);
        }
    }
}
