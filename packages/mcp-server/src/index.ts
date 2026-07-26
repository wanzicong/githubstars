#!/usr/bin/env node

/**
 * GitHub Stars MCP Server — 主入口
 *
 * 将 GitHub Stars 后端 API 封装为 MCP 工具，供外部 AI 调用。
 * 支持两种传输模式：
 *   - stdio（默认）：node dist/index.js
 *   - HTTP Streamable：node dist/index.js --http [--port 10004]
 *
 * HTTP 模式监听 POST /mcp，所有请求通过 HTTP 转发到已运行的 NestJS 后端
 * （默认 http://localhost:10002，由 GITHUBSTARS_API_URL 控制）。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import type { Request, Response } from 'express';
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

function buildServer(client: BackendClient): McpServer {
    const server = new McpServer({
        name: 'githubstars',
        version: '1.0.0',
    });

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

    return server;
}

function startStdio(client: BackendClient): void {
    const server = buildServer(client);
    const transport = new StdioServerTransport();
    server.connect(transport).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[MCP] 启动失败: ${msg}\n`);
        process.exit(1);
    });
    process.stderr.write('[MCP] GitHub Stars MCP Server 已启动 (stdio)\n');
}

function parseHttpPort(argv: string[]): number {
    const idx = argv.indexOf('--port');
    if (idx >= 0) {
        const raw = argv[idx + 1];
        const parsed = Number.parseInt(raw ?? '', 10);
        if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) return parsed;
    }
    const envPort = Number.parseInt(process.env.MCP_PORT ?? '', 10);
    if (Number.isFinite(envPort) && envPort > 0 && envPort < 65536) return envPort;
    return 10004;
}

function startHttp(client: BackendClient, port: number): void {
    // 从环境变量读取允许的 Host，默认允许 localhost 和常见内网 IP
    const allowedHostsEnv = process.env.MCP_ALLOWED_HOSTS;
    const allowedHosts = allowedHostsEnv
        ? allowedHostsEnv.split(',').map((h) => h.trim())
        : ['localhost', '127.0.0.1', '192.168.1.3', '0.0.0.0'];

    const app = createMcpExpressApp({
        host: '0.0.0.0',
        allowedHosts,
    });

    // 无状态模式：每个请求独立创建 server + transport，请求结束即关闭
    app.post('/mcp', async (req: Request, res: Response) => {
        const server = buildServer(client);
        try {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
            });
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
            res.on('close', () => {
                transport.close().catch(() => undefined);
                server.close().catch(() => undefined);
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[MCP] HTTP 请求处理失败: ${msg}\n`);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal server error' },
                    id: null,
                });
            }
        }
    });

    const methodNotAllowed = (_req: Request, res: Response) => {
        res.writeHead(405).end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed.' },
            id: null,
        }));
    };
    app.get('/mcp', methodNotAllowed);
    app.delete('/mcp', methodNotAllowed);

    app.listen(port, '0.0.0.0', () => {
        process.stderr.write(`[MCP] GitHub Stars MCP Server 已启动 (http) — http://0.0.0.0:${port}/mcp\n`);
    });
}

function main(): void {
    const argv = process.argv.slice(2);
    const useHttp = argv.includes('--http');
    const client = new BackendClient();

    if (useHttp) {
        startHttp(client, parseHttpPort(argv));
    } else {
        startStdio(client);
    }
}

main();
