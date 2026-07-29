/**
 * Localization 模块 — Star 仓库描述与 README 中文化
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

const fieldsSchema = z.enum(['description', 'readme', 'both']);

export function registerLocalizationTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'localization-run',
        {
            description: '中文化单个 Star 仓库的描述和/或 README，并更新数据库中文字段',
            inputSchema: z.object({
                repoId: z.number().int().positive().describe('仓库 ID'),
                fields: fieldsSchema.optional().describe('处理字段，默认 both'),
                force: z.boolean().optional().describe('是否覆盖已有中文内容，默认 false'),
            }),
        },
        createToolHandler(client, '/api/localization/repository'),
    );

    server.registerTool(
        'localization-batch',
        {
            description: '创建批量 Star 仓库中文化任务',
            inputSchema: z.object({
                repoIds: z.array(z.number().int().positive()).min(1).max(2000).describe('仓库 ID 列表'),
                fields: fieldsSchema.optional().describe('处理字段，默认 both'),
                force: z.boolean().optional().describe('是否覆盖已有中文内容，默认 false'),
                concurrency: z.number().int().min(1).max(5).optional().describe('并发数，默认 2'),
            }),
        },
        createToolHandler(client, '/api/localization/batch'),
    );

    server.registerTool(
        'localization-task-detail',
        {
            description: '查询仓库中文化批量任务进度和有限异常明细（紧凑结果）',
            inputSchema: z.object({
                taskId: z.number().int().positive().describe('任务 ID'),
                itemLimit: z.number().int().min(0).max(100).optional().describe('最多返回的失败/处理中明细数，默认 20'),
            }),
        },
        createToolHandler(client, '/api/localization/task'),
    );

    server.registerTool(
        'localization-task-retry',
        {
            description: '重试仓库中文化批量任务中的失败项',
            inputSchema: z.object({
                taskId: z.number().int().positive().describe('任务 ID'),
            }),
        },
        createToolHandler(client, '/api/localization/retry'),
    );
}
