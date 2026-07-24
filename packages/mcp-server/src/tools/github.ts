/**
 * GitHub 模块 — GitHub 搜索与 Star 操作
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerGithubTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'github-search',
        {
            description: '通过 GitHub Search API 搜索仓库',
            inputSchema: z.object({
                keyword: z.string().optional().describe('搜索关键字'),
                language: z.string().optional().describe('按语言筛选'),
                sort: z.string().optional().describe('排序方式'),
                page: z.number().int().positive().optional().describe('页码'),
                perPage: z.number().int().positive().optional().describe('每页数量'),
            }),
        },
        createToolHandler(client, '/api/github/search'),
    );

    server.registerTool(
        'github-star',
        {
            description: '通过 GitHub API 给指定仓库添加 Star',
            inputSchema: z.object({
                owner: z.string().min(1).describe('仓库所有者'),
                repo: z.string().min(1).describe('仓库名'),
            }),
        },
        createToolHandler(client, '/api/github/star'),
    );

    server.registerTool(
        'github-unstar',
        {
            description: '通过 GitHub API 取消对指定仓库的 Star',
            inputSchema: z.object({
                owner: z.string().min(1).describe('仓库所有者'),
                repo: z.string().min(1).describe('仓库名'),
            }),
        },
        createToolHandler(client, '/api/github/unstar'),
    );

    server.registerTool(
        'github-check-starred',
        {
            description: '检查当前用户是否已 Star 指定仓库',
            inputSchema: z.object({
                owner: z.string().min(1).describe('仓库所有者'),
                repo: z.string().min(1).describe('仓库名'),
            }),
        },
        createToolHandler(client, '/api/github/starred'),
    );

    server.registerTool(
        'similar-find',
        {
            description: '根据指定仓库的语言查找相似的高 Star 仓库推荐',
            inputSchema: z.object({ repoId: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/similar'),
    );
}
