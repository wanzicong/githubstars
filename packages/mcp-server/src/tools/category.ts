/**
 * Categories 模块 — 分类管理（树形结构）
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerCategoryTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'category-tree',
        { description: '获取完整分类树（两级树形结构），一级分类包含子分类列表', inputSchema: z.object({}) },
        createToolHandler(client, '/api/category/tree'),
    );

    server.registerTool(
        'category-list',
        {
            description: '获取一级分类列表（分页），支持关键字搜索',
            inputSchema: z.object({
                page: z.number().int().positive().optional().describe('页码'),
                size: z.number().int().positive().optional().describe('每页数量'),
                keyword: z.string().optional().describe('搜索关键字'),
            }),
        },
        createToolHandler(client, '/api/category/list'),
    );

    server.registerTool(
        'category-create',
        {
            description: '创建新分类，支持设置父分类、排序、图标、描述',
            inputSchema: z.object({
                name: z.string().min(1).max(100).describe('分类名称'),
                parentId: z.number().int().positive().optional().nullable().describe('父分类 ID'),
                sortOrder: z.number().int().min(0).optional().describe('排序号'),
                icon: z.string().max(100).optional().nullable().describe('图标'),
                description: z.string().max(1000).optional().nullable().describe('描述'),
            }),
        },
        createToolHandler(client, '/api/category/create'),
    );

    server.registerTool(
        'category-update',
        {
            description: '更新分类信息，支持修改名称、父分类、排序、图标、描述',
            inputSchema: z.object({
                id: z.number().int().positive().describe('分类 ID'),
                name: z.string().min(1).max(100).optional().describe('分类名称'),
                parentId: z.number().int().positive().optional().nullable().describe('父分类 ID'),
                sortOrder: z.number().int().min(0).optional().describe('排序号'),
                icon: z.string().max(100).optional().nullable().describe('图标'),
                description: z.string().max(1000).optional().nullable().describe('描述'),
            }),
        },
        createToolHandler(client, '/api/category/update'),
    );

    server.registerTool(
        'category-delete',
        {
            description: '删除指定分类，如果存在子分类则删除失败',
            inputSchema: z.object({ id: z.number().int().positive().describe('分类 ID') }),
        },
        createToolHandler(client, '/api/category/delete'),
    );

    server.registerTool(
        'category-sort',
        {
            description: '拖拽排序，批量更新分类的 sortOrder',
            inputSchema: z.object({
                items: z
                    .array(z.object({ id: z.number().int().positive(), sortOrder: z.number().int().min(0) }))
                    .min(1)
                    .describe('分类排序项'),
            }),
        },
        createToolHandler(client, '/api/category/sort'),
    );

    server.registerTool(
        'category-repos',
        {
            description: '查询某分类下的仓库列表（分页 + 筛选）',
            inputSchema: z.object({
                categoryId: z.number().int().positive().describe('分类 ID'),
                page: z.number().int().positive().optional().describe('页码'),
                size: z.number().int().positive().optional().describe('每页数量'),
                keyword: z.string().optional().describe('搜索关键字'),
                language: z.string().optional().describe('按语言筛选'),
                sortBy: z.string().optional().describe('排序字段'),
                sortOrder: z.enum(['asc', 'desc']).optional().describe('排序方向'),
            }),
        },
        createToolHandler(client, '/api/category/repos'),
    );

    server.registerTool(
        'category-bind',
        {
            description: '批量绑定仓库到指定分类',
            inputSchema: z.object({
                categoryId: z.number().int().positive().describe('分类 ID'),
                repoIds: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表'),
            }),
        },
        createToolHandler(client, '/api/category/bind'),
    );

    server.registerTool(
        'category-unbind',
        {
            description: '批量解绑仓库从指定分类',
            inputSchema: z.object({
                categoryId: z.number().int().positive().describe('分类 ID'),
                repoIds: z.array(z.number().int().positive()).min(1).describe('仓库 ID 列表'),
            }),
        },
        createToolHandler(client, '/api/category/unbind'),
    );

    server.registerTool(
        'category-batch-ids',
        {
            description: '获取分类下所有仓库信息（用于批量克隆/下载），支持递归包含子分类',
            inputSchema: z.object({
                categoryId: z.number().int().positive().describe('分类 ID'),
                includeChildren: z.boolean().optional().describe('是否包含子分类'),
            }),
        },
        createToolHandler(client, '/api/category/batch-ids'),
    );
}
