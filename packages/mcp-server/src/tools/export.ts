/**
 * Export 模块 — Markdown 导出
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerExportTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'export-markdown',
        {
            description: '按筛选条件将仓库列表导出为 Markdown 文件下载',
            inputSchema: z.object({
                keyword: z.string().optional().describe('搜索关键字'),
                language: z.string().optional().describe('按语言筛选'),
                sortBy: z.string().optional().describe('排序字段'),
                sortOrder: z.string().optional().describe('排序方向'),
                dateField: z.string().optional().describe('日期字段'),
                startDate: z.string().optional().describe('开始日期'),
                endDate: z.string().optional().describe('结束日期'),
                untranslatedOnly: z.string().optional().describe('仅未翻译'),
                maxCount: z.number().int().positive().max(1000).optional().describe('最大导出数量（上限 1000）'),
            }),
        },
        createToolHandler(client, '/api/export/md'),
    );
}
