/**
 * Logs 模块 — 日志管理
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerLogTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'logs-files',
        { description: '获取日志文件列表，返回日志目录下所有 .log 文件的名称、大小和修改时间', inputSchema: z.object({}) },
        createToolHandler(client, '/api/logs/files'),
    );

    server.registerTool(
        'logs-view',
        {
            description: '读取指定日志文件的最后 N 行内容',
            inputSchema: z.object({
                file: z.string().min(1).describe('日志文件名'),
                lines: z.number().int().positive().optional().describe('读取行数'),
            }),
        },
        createToolHandler(client, '/api/logs/view'),
    );

    server.registerTool(
        'logs-clear',
        {
            description: '将指定日志文件内容清空（不可恢复）',
            inputSchema: z.object({ file: z.string().min(1).describe('日志文件名') }),
        },
        createToolHandler(client, '/api/logs/clear'),
    );
}
