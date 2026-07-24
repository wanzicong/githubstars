/**
 * Download 模块 — 批量下载仓库（zip 压缩包）
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerDownloadTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'download-create',
        {
            description: '创建下载任务，批量下载仓库 zip 压缩包',
            inputSchema: z.object({
                repoIds: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表'),
                targetDir: z.string().min(1).max(1000).describe('目标目录'),
                concurrency: z.number().int().positive().optional().describe('并发数（1/2/4/8）'),
                mirrorSources: z.array(z.string()).optional().describe('镜像源列表（按优先级排序）'),
                extractArchive: z.boolean().optional().describe('下载后是否解压'),
                deleteAfterExtract: z.boolean().optional().describe('解压后是否删除原压缩文件'),
            }),
        },
        createToolHandler(client, '/api/download'),
    );

    server.registerTool(
        'download-tasks-list',
        { description: '获取最近下载任务列表', inputSchema: z.object({}) },
        createToolHandler(client, '/api/download/tasks/list'),
    );

    server.registerTool(
        'download-directories',
        { description: '获取常用下载目录列表', inputSchema: z.object({}) },
        createToolHandler(client, '/api/download/directories'),
    );

    server.registerTool(
        'download-tasks-detail',
        {
            description: '查询下载任务进度详情',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/download/tasks/detail'),
    );

    server.registerTool(
        'download-estimate-sizes',
        {
            description: '预估多个仓库的下载大小',
            inputSchema: z.object({
                repoIds: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表'),
            }),
        },
        createToolHandler(client, '/api/download/estimate-sizes'),
    );

    server.registerTool(
        'download-tasks-retry',
        {
            description: '重试下载任务中的失败项',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/download/tasks/retry'),
    );

    server.registerTool(
        'download-tasks-reset',
        {
            description: '重置整个下载任务',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/download/tasks/reset'),
    );

    server.registerTool(
        'download-tasks-retry-item',
        {
            description: '重试单个下载任务项',
            inputSchema: z.object({
                id: z.number().int().positive().describe('任务 ID'),
                fullName: z.string().min(1).describe('仓库全名（owner/repo）'),
            }),
        },
        createToolHandler(client, '/api/download/tasks/retry-item'),
    );

    server.registerTool(
        'download-tasks-delete',
        {
            description: '删除下载任务',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/download/tasks/delete'),
    );

    server.registerTool(
        'download-tasks-extract',
        {
            description: '手动解压下载任务项的压缩包',
            inputSchema: z.object({
                taskId: z.number().int().positive().describe('任务 ID'),
                fullName: z.string().min(1).describe('仓库全名（owner/repo）'),
            }),
        },
        createToolHandler(client, '/api/download/tasks/extract'),
    );

    server.registerTool(
        'download-tasks-delete-item',
        {
            description: '手动删除下载任务项的压缩包',
            inputSchema: z.object({
                taskId: z.number().int().positive().describe('任务 ID'),
                fullName: z.string().min(1).describe('仓库全名（owner/repo）'),
            }),
        },
        createToolHandler(client, '/api/download/tasks/delete-item'),
    );

    server.registerTool(
        'download-tasks-extract-all',
        {
            description: '一键解压下载任务中所有已完成项的压缩包',
            inputSchema: z.object({ taskId: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/download/tasks/extract-all'),
    );

    server.registerTool(
        'download-tasks-extract-all-progress',
        {
            description: '查询批量解压进度',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/download/tasks/extract-all/progress'),
    );
}
