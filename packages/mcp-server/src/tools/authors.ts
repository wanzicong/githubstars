/**
 * Authors 模块 — 作者中心
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerAuthorTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'authors-list',
        {
            description: '分页获取作者列表，支持关键字搜索，按总 Star 数降序排列',
            inputSchema: z.object({
                page: z.number().int().positive().optional().describe('页码'),
                size: z.number().int().positive().optional().describe('每页数量'),
                keyword: z.string().optional().describe('搜索关键字'),
            }),
        },
        createToolHandler(client, '/api/authors/list'),
    );

    server.registerTool(
        'authors-repos',
        {
            description: '分页获取指定作者的所有 Star 仓库，支持多字段排序',
            inputSchema: z.object({
                ownerName: z.string().min(1).describe('作者名'),
                page: z.number().int().positive().optional().describe('页码'),
                size: z.number().int().positive().optional().describe('每页数量'),
                sortBy: z.string().optional().describe('排序字段'),
                sortOrder: z.enum(['asc', 'desc']).optional().describe('排序方向'),
            }),
        },
        createToolHandler(client, '/api/authors/repos'),
    );

    server.registerTool(
        'authors-export',
        {
            description: '以纯文本文件下载指定作者的所有 Star 仓库地址（每行一个）',
            inputSchema: z.object({
                ownerName: z.string().min(1).describe('作者名'),
                sortBy: z.string().optional().describe('排序字段'),
                sortOrder: z.enum(['asc', 'desc']).optional().describe('排序方向'),
            }),
        },
        createToolHandler(client, '/api/authors/export'),
    );
}
