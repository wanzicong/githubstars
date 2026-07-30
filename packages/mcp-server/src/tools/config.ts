/**
 * Config 模块 — 系统配置管理
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerConfigTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'config-list',
        { description: '获取所有配置项，敏感字段（Token/API Key）自动打码', inputSchema: z.object({}) },
        createToolHandler(client, '/api/config/list'),
    );

    server.registerTool(
        'config-save',
        {
            description: '批量保存配置项，接收键值对集合写入 system_config 表',
            inputSchema: z.record(z.string(), z.string()).describe('键值对配置数据'),
        },
        createToolHandler(client, '/api/config'),
    );
}
