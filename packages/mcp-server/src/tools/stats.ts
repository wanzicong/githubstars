/**
 * Stats 模块 — 统计分析
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerStatsTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'stats-languages',
        { description: '返回各编程语言的仓库数量及百分比占比', inputSchema: z.object({}) },
        createToolHandler(client, '/api/stats/languages'),
    );

    server.registerTool(
        'stats-owners',
        {
            description: '按 Star 总数降序返回所有者排名',
            inputSchema: z.object({ topN: z.number().int().positive().optional().describe('返回前 N 名') }),
        },
        createToolHandler(client, '/api/stats/owners'),
    );

    server.registerTool(
        'stats-timeline',
        { description: '按月份聚合的 Star 数量增长趋势', inputSchema: z.object({}) },
        createToolHandler(client, '/api/stats/timeline'),
    );

    server.registerTool(
        'stats-overview',
        { description: '返回仓库总数、Star/Fork 总数、语言/所有者种类数等概览数据', inputSchema: z.object({}) },
        createToolHandler(client, '/api/stats/overview'),
    );

    server.registerTool(
        'stats-top-starred',
        {
            description: '按 starsCount 降序返回 Top N 仓库',
            inputSchema: z.object({ topN: z.number().int().positive().optional().describe('返回前 N 个') }),
        },
        createToolHandler(client, '/api/stats/top-starred'),
    );

    server.registerTool(
        'stats-recent-active',
        {
            description: '按 repoUpdatedAt 降序返回最近更新的仓库',
            inputSchema: z.object({ topN: z.number().int().positive().optional().describe('返回前 N 个') }),
        },
        createToolHandler(client, '/api/stats/recent-active'),
    );
}
