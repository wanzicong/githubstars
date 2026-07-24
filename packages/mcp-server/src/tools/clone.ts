/**
 * Clone 模块 — 批量 git clone 仓库
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerCloneTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'clone-create',
        {
            description: '创建克隆任务，批量 git clone 仓库',
            inputSchema: z.object({
                repoIds: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表'),
                targetDir: z.string().min(1).max(1000).describe('目标目录'),
                concurrency: z.number().int().positive().optional().describe('并发数'),
                shallow: z.boolean().optional().describe('是否浅克隆（--depth 1）'),
                mirrorSource: z.string().optional().describe('镜像代理源名称，为空或 direct 表示不使用代理'),
            }),
        },
        createToolHandler(client, '/api/clone'),
    );

    server.registerTool(
        'clone-tasks-list',
        { description: '获取最近克隆任务列表', inputSchema: z.object({}) },
        createToolHandler(client, '/api/clone/tasks/list'),
    );

    server.registerTool(
        'clone-directories',
        { description: '获取常用克隆目录列表', inputSchema: z.object({}) },
        createToolHandler(client, '/api/clone/directories'),
    );

    server.registerTool(
        'clone-tasks-detail',
        {
            description: '查询克隆任务进度详情',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/clone/tasks/detail'),
    );

    server.registerTool(
        'clone-tasks-retry',
        {
            description: '重试克隆任务中的失败项',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/clone/tasks/retry'),
    );

    server.registerTool(
        'clone-tasks-reset',
        {
            description: '重置整个克隆任务',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/clone/tasks/reset'),
    );

    server.registerTool(
        'clone-tasks-retry-item',
        {
            description: '重试单个克隆任务项',
            inputSchema: z.object({
                id: z.number().int().positive().describe('任务 ID'),
                fullName: z.string().min(1).describe('仓库全名（owner/repo）'),
            }),
        },
        createToolHandler(client, '/api/clone/tasks/retry-item'),
    );

    server.registerTool(
        'clone-tasks-delete',
        {
            description: '删除克隆任务',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/clone/tasks/delete'),
    );
}
