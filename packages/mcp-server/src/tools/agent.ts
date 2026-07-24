/**
 * Agent 模块 — AI Agent 对话与会话管理
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

const sessionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('none') }),
    z.object({ type: z.literal('auto') }),
    z.object({ type: z.literal('resume'), id: z.string().min(1) }),
]);

export function registerAgentTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'agent-query',
        {
            description: 'Agent 一次性查询（非流式），收集全部响应后返回 JSON',
            inputSchema: z.object({
                message: z.string().min(1).describe('用户消息'),
                session: sessionSchema.describe('会话模式：none 一次性 / auto 新建 / resume 恢复'),
                maxTurns: z.number().int().min(1).max(500).optional().describe('最大对话轮次'),
                model: z.string().optional().describe('模型名称'),
            }),
        },
        createToolHandler(client, '/api/agent/query'),
    );

    server.registerTool(
        'agent-sessions-list',
        {
            description: '获取 Agent 会话列表',
            inputSchema: z.object({
                limit: z.string().optional().describe('返回数量限制'),
                offset: z.string().optional().describe('偏移量'),
            }),
        },
        createToolHandler(client, '/api/agent/sessions', 'GET'),
    );

    server.registerTool(
        'agent-sessions-create',
        { description: '创建新 Agent 会话', inputSchema: z.object({}) },
        createToolHandler(client, '/api/agent/sessions'),
    );

    server.registerTool(
        'agent-sessions-get',
        {
            description: '获取 Agent 会话详情与消息历史',
            inputSchema: z.object({ id: z.string().min(1).describe('会话 ID') }),
        },
        async (params: Record<string, unknown>) => {
            try {
                const result = await client.get(`/api/agent/sessions/${params.id}`);
                return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: msg }) }], isError: true };
            }
        },
    );

    server.registerTool(
        'agent-sessions-delete',
        {
            description: '关闭（删除）Agent 会话',
            inputSchema: z.object({ id: z.string().min(1).describe('会话 ID') }),
        },
        async (params: Record<string, unknown>) => {
            try {
                const result = await client.delete(`/api/agent/sessions/${params.id}`);
                return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: msg }) }], isError: true };
            }
        },
    );
}
