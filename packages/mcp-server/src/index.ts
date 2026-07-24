#!/usr/bin/env node

/**
 * GitHub Stars MCP Server — 主入口
 *
 * 将 GitHub Stars 后端 API 封装为 MCP 工具，供外部 AI（Claude Code 等）通过 stdio 调用。
 * 所有请求通过 HTTP 转发到已运行的 NestJS 后端（默认 http://localhost:10002）。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BackendClient } from './client.js';
import { registerStarsTools } from './tools/stars.js';
import { registerStatsTools } from './tools/stats.js';
import { registerCategoryTools } from './tools/category.js';
import { registerTranslateTools } from './tools/translate.js';
import { registerSyncTools } from './tools/sync.js';
import { registerGithubTools } from './tools/github.js';
import { registerTrendingTools } from './tools/trending.js';
import { registerAuthorTools } from './tools/authors.js';
import { registerDownloadTools } from './tools/download.js';
import { registerCloneTools } from './tools/clone.js';
import { registerExportTools } from './tools/export.js';
import { registerConfigTools } from './tools/config.js';
import { registerLogTools } from './tools/logs.js';
import { registerAgentTools } from './tools/agent.js';

function main() {
    const client = new BackendClient();
    const server = new McpServer({
        name: 'githubstars',
        version: '1.0.0',
    });

    // 注册全部 15 个模块的 MCP 工具
    registerStarsTools(server, client);
    registerStatsTools(server, client);
    registerCategoryTools(server, client);
    registerTranslateTools(server, client);
    registerSyncTools(server, client);
    registerGithubTools(server, client);
    registerTrendingTools(server, client);
    registerAuthorTools(server, client);
    registerDownloadTools(server, client);
    registerCloneTools(server, client);
    registerExportTools(server, client);
    registerConfigTools(server, client);
    registerLogTools(server, client);
    registerAgentTools(server, client);

    const transport = new StdioServerTransport();
    server.connect(transport).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[MCP] 启动失败: ${msg}\n`);
        process.exit(1);
    });

    process.stderr.write('[MCP] GitHub Stars MCP Server 已启动 (stdio)\n');
}

main();
