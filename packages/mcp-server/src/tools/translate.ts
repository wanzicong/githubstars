/**
 * Translate 模块 — DeepSeek AI 翻译
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendClient } from '../client.js';
import { createToolHandler } from './helper.js';

export function registerTranslateTools(server: McpServer, client: BackendClient) {
    server.registerTool(
        'translate-create',
        {
            description: '创建翻译任务。支持三种 scope: selected（指定仓库）、all（全量）、filtered（筛选条件）；三种 type: description / readme / both',
            inputSchema: z.object({
                type: z.enum(['description', 'readme', 'both']).describe('翻译类型'),
                scope: z.enum(['selected', 'all', 'filtered']).describe('范围类型'),
                repoIds: z.array(z.number().int().positive()).optional().describe('仓库 ID 列表（scope=selected 时必填）'),
                filters: z.record(z.unknown()).optional().describe('筛选条件（scope=filtered 时使用）'),
            }),
        },
        createToolHandler(client, '/api/translate'),
    );

    server.registerTool(
        'translate-config',
        { description: '检查 DeepSeek API Key 是否已配置', inputSchema: z.object({}) },
        createToolHandler(client, '/api/translate/config'),
    );

    server.registerTool(
        'translate-status',
        {
            description: '返回符合条件的仓库总数及描述/README 的翻译覆盖情况',
            inputSchema: z.object({
                keyword: z.string().optional().describe('搜索关键字'),
                language: z.string().optional().describe('按语言筛选'),
                dateField: z.string().optional().describe('日期字段'),
                startDate: z.string().optional().describe('开始日期'),
                endDate: z.string().optional().describe('结束日期'),
                untranslatedOnly: z.boolean().optional().describe('仅未翻译'),
            }),
        },
        createToolHandler(client, '/api/translate/status'),
    );

    server.registerTool(
        'translate-tasks-list',
        { description: '获取最近 20 条翻译任务摘要', inputSchema: z.object({}) },
        createToolHandler(client, '/api/translate/tasks/list'),
    );

    server.registerTool(
        'translate-tasks-detail',
        {
            description: '获取指定翻译任务的详情和进度信息',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/translate/tasks/detail'),
    );

    server.registerTool(
        'translate-tasks-retry',
        {
            description: '重试指定翻译任务中的失败项，返回新任务 ID',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/translate/tasks/retry'),
    );

    server.registerTool(
        'translate-tasks-failures',
        {
            description: '查询指定翻译任务的失败项列表',
            inputSchema: z.object({ id: z.number().int().positive().describe('任务 ID') }),
        },
        createToolHandler(client, '/api/translate/tasks/failures'),
    );

    server.registerTool(
        'translate-description',
        {
            description: '对指定仓库的描述文本进行实时翻译（旧接口，同步）',
            inputSchema: z.object({ id: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/translate/description'),
    );

    server.registerTool(
        'translate-readme',
        {
            description: '对指定仓库的 README 进行实时翻译（旧接口，同步）',
            inputSchema: z.object({ id: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/translate/readme'),
    );

    server.registerTool(
        'translate-readme-async',
        {
            description: '创建异步 README 翻译任务，返回 taskId（旧接口）',
            inputSchema: z.object({ id: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/translate/readme-async'),
    );

    server.registerTool(
        'translate-retranslate',
        {
            description: '无视已有翻译结果，强制重新翻译指定仓库的 README（旧接口）',
            inputSchema: z.object({ id: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/translate/retranslate'),
    );

    server.registerTool(
        'translate-full',
        {
            description: '同步翻译指定仓库的描述 + README（旧接口，阻塞等待）',
            inputSchema: z.object({ id: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/translate/full'),
    );

    server.registerTool(
        'translate-repo-status',
        {
            description: '查询指定仓库的描述和 README 翻译状态（旧接口）',
            inputSchema: z.object({ id: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/translate/repo-status'),
    );

    server.registerTool(
        'translate-description-original',
        {
            description: '获取指定仓库的 GitHub 原始描述文本',
            inputSchema: z.object({ id: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/translate/description/original'),
    );

    server.registerTool(
        'translate-description-cn',
        {
            description: '获取指定仓库描述的中文翻译（未翻译时返回 null）',
            inputSchema: z.object({ id: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/translate/description/cn'),
    );

    server.registerTool(
        'translate-description-update',
        {
            description: '手动设置指定仓库描述的中文翻译（空字符串视为清除）',
            inputSchema: z.object({
                id: z.number().int().positive().describe('仓库 ID'),
                content: z.string().describe('新的中文描述，空字符串表示清除'),
            }),
        },
        createToolHandler(client, '/api/translate/description/update'),
    );

    server.registerTool(
        'translate-readme-original',
        {
            description: '获取指定仓库 README 的原始 Markdown 内容',
            inputSchema: z.object({ id: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/translate/readme/original'),
    );

    server.registerTool(
        'translate-readme-cn',
        {
            description: '获取指定仓库 README 的中文翻译（未翻译时返回 null）',
            inputSchema: z.object({ id: z.number().int().positive().describe('仓库 ID') }),
        },
        createToolHandler(client, '/api/translate/readme/cn'),
    );

    server.registerTool(
        'translate-readme-update',
        {
            description: '手动设置指定仓库 README 的中文翻译（空字符串视为清除）',
            inputSchema: z.object({
                id: z.number().int().positive().describe('仓库 ID'),
                content: z.string().describe('新的中文 README 内容，空字符串表示清除'),
            }),
        },
        createToolHandler(client, '/api/translate/readme/update'),
    );
}
