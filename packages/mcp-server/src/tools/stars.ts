/**
 * Stars 模块 — 星标仓库列表、详情、导出
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

const sortOrderEnum = z.enum(['asc', 'desc']).optional().describe('排序方向');

const starsFilterFields = {
    keyword: z.string().optional().describe('搜索关键字'),
    language: z.string().optional().describe('按编程语言筛选'),
    sortBy: z.string().optional().describe('排序字段'),
    sortOrder: sortOrderEnum,
    dateField: z.string().optional().describe('日期字段'),
    startDate: z.string().optional().describe('开始日期'),
    endDate: z.string().optional().describe('结束日期'),
    untranslatedOnly: z.boolean().optional().describe('仅未翻译'),
};

export function registerStarsTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'stars-list',
        {
            description: '分页获取 Star 仓库列表，支持多维度筛选、排序和分页',
            inputSchema: z.object({
                page: z.number().int().positive().optional().describe('页码'),
                size: z.number().int().positive().max(100).optional().describe('每页数量'),
                ...starsFilterFields,
            }),
        },
        createToolHandler(client, '/api/stars/list'),
    );

    server.registerTool(
        'stars-detail',
        {
            description: '根据仓库 ID 获取详细信息（含分类名称）',
            inputSchema: z.object({
                id: z.number().int().positive().describe('仓库 ID'),
            }),
        },
        createToolHandler(client, '/api/stars/detail'),
    );

    server.registerTool(
        'stars-export',
        {
            description: '按筛选条件导出仓库 GitHub URL 列表（纯文本下载）',
            inputSchema: z.object({ ...starsFilterFields }),
        },
        createToolHandler(client, '/api/stars/export'),
    );

    server.registerTool(
        'stars-ids',
        {
            description: '按筛选条件获取所有仓库 ID，用于跨页全选',
            inputSchema: z.object({ ...starsFilterFields }),
        },
        createToolHandler(client, '/api/stars/ids'),
    );

    server.registerTool(
        'stars-by-ids',
        {
            description: '根据 ID 列表批量获取仓库信息',
            inputSchema: z.object({
                ids: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表'),
            }),
        },
        createToolHandler(client, '/api/stars/by-ids'),
    );

    server.registerTool(
        'stars-star',
        {
            description: '按仓库 ID Star 仓库，通过数据库仓库 ID 查找 full_name 后调用 GitHub API 添加 Star',
            inputSchema: z.object({
                id: z.number().int().positive().describe('仓库 ID'),
            }),
        },
        createToolHandler(client, '/api/stars/star'),
    );

    server.registerTool(
        'stars-unstar',
        {
            description: '按仓库 ID 取消 Star 仓库，通过数据库仓库 ID 查找 full_name 后调用 GitHub API 取消 Star',
            inputSchema: z.object({
                id: z.number().int().positive().describe('仓库 ID'),
            }),
        },
        createToolHandler(client, '/api/stars/unstar'),
    );

    server.registerTool(
        'stars-check-starred',
        {
            description: '按仓库 ID 检查 Star 状态，通过数据库仓库 ID 查找 full_name 后调用 GitHub API 检查',
            inputSchema: z.object({
                id: z.number().int().positive().describe('仓库 ID'),
            }),
        },
        createToolHandler(client, '/api/stars/starred'),
    );
}
