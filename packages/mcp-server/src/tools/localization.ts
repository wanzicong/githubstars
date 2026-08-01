/**
 * Localization 模块 — Star 仓库描述与 README 中文化（纯数据接口：取原文 / 写译文）
 *
 * 翻译由智能体完成：先调 localization-pending 取未翻译原文，
 * 智能体产出译文后调 localization-update 批量写回。本模块不做翻译。
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerLocalizationTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'localization-pending',
        {
            description: '查询未中文化的仓库原文（描述/README），供智能体翻译。返回字段为 null 表示该字段无需翻译',
            inputSchema: z.object({
                limit: z.number().int().min(1).max(200).optional().describe('返回数量上限，默认 50，最大 200'),
                includeDescription: z.boolean().optional().describe('是否包含描述，默认 true'),
                includeReadme: z.boolean().optional().describe('是否包含 README，默认 true'),
            }),
        },
        createToolHandler(client, '/api/localization/pending'),
    );

    server.registerTool(
        'localization-update',
        {
            description: '批量写入智能体产出的译文（只更新，不做翻译）。每项需 repoId 及 descriptionCn/readmeCn 至少其一',
            inputSchema: z.object({
                items: z
                    .array(
                        z.object({
                            repoId: z.number().int().positive().describe('仓库 ID'),
                            descriptionCn: z.string().max(20000).optional().describe('中文描述'),
                            readmeCn: z.string().max(2000000).optional().describe('中文 README'),
                        }),
                    )
                    .min(1)
                    .max(500)
                    .describe('译文列表，单次最多 500 条'),
            }),
        },
        createToolHandler(client, '/api/localization/update'),
    );
}
