/**
 * Trending 模块 — GitHub Trending 趋势仓库
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerTrendingTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'trending-list',
        {
            description: '通过 GitHub Search API 查询指定时间段内创建的高星仓库',
            inputSchema: z.object({
                since: z.string().optional().describe('时间段（如 daily, weekly, monthly）'),
                language: z.string().optional().describe('按语言筛选'),
                perPage: z.number().int().positive().optional().describe('每页数量'),
            }),
        },
        createToolHandler(client, '/api/trending'),
    );

    server.registerTool(
        'trending-download',
        {
            description: '获取趋势仓库列表并创建下载任务',
            inputSchema: z.object({
                since: z.string().optional().describe('时间段'),
                language: z.string().optional().describe('按语言筛选'),
                perPage: z.number().int().positive().optional().describe('每页数量'),
                targetDir: z.string().optional().describe('目标目录'),
                concurrency: z.number().int().positive().optional().describe('并发数'),
                mirrorSources: z.array(z.string()).optional().describe('镜像源列表'),
                extractArchive: z.boolean().optional().describe('下载后是否解压'),
                deleteAfterExtract: z.boolean().optional().describe('解压后是否删除原压缩文件'),
            }),
        },
        createToolHandler(client, '/api/trending/download'),
    );
}
