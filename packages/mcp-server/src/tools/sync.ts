/**
 * Sync 模块 — Star 数据同步
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerSyncTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'sync-manual',
        { description: '从 GitHub API 全量拉取 Star 仓库并同步到数据库', inputSchema: z.object({}) },
        createToolHandler(client, '/api/sync/manual'),
    );

    server.registerTool(
        'sync-status',
        { description: '返回当前是否在同步中、仓库总数、上次成功同步时间等', inputSchema: z.object({}) },
        createToolHandler(client, '/api/sync/status'),
    );

    server.registerTool(
        'sync-logs',
        {
            description: '分页返回历史同步记录',
            inputSchema: z.object({
                pageNum: z.number().int().positive().optional().describe('页码'),
                pageSize: z.number().int().positive().optional().describe('每页数量'),
            }),
        },
        createToolHandler(client, '/api/sync/logs'),
    );
}
