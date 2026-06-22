import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service';
import { ITool, ToolRiskLevel } from './tool.interface';

/**
 * MCP 服务器配置。
 */
interface McpServerConfig {
    name: string;
    transport: 'stdio' | 'http';
    command?: string;
    args?: string[];
    url?: string;
    headers?: Record<string, string>;
}

/**
 * MCP 协议适配器。
 *
 * 管理 MCP (Model Context Protocol) 服务器的连接和工具发现。
 * 支持 stdio 子进程和 HTTP 两种传输方式。
 *
 * 目前为骨架实现，Phase 3-4 将完善 MCP 协议集成。
 *
 * @callers
 *   - ToolRegistryService — 注册 MCP 工具
 *   - AgentController — POST/DELETE /api/agent/tools/mcp
 */
@Injectable()
export class McpAdapterService {
    private readonly logger = new Logger(McpAdapterService.name);

    /** 活跃的 MCP 服务器连接 */
    private readonly servers = new Map<string, McpServerConfig>();

    constructor(private readonly toolRegistry: ToolRegistryService) {}

    /**
     * 连接 MCP 服务器并发现其工具。
     *
     * @param config MCP 服务器配置
     */
    async connectServer(config: McpServerConfig): Promise<{ name: string; toolCount: number }> {
        this.logger.log(`[MCPAdapter] Connecting to MCP server: ${config.name} (${config.transport})`);

        // 存储服务器配置
        this.servers.set(config.name, config);

        // TODO: Phase 3-4 实现真正的 MCP 协议通信
        // 1. 对于 stdio transport：启动子进程并建立 JSON-RPC 通道
        // 2. 对于 HTTP transport：通过 SSE + HTTP POST 通信
        // 3. 发送 tools/list 请求获取工具列表
        // 4. 为每个发现的工具创建适配的 ITool 实例并注册到 ToolRegistry

        this.logger.log(`[MCPAdapter] Server "${config.name}" connected (skeleton mode)`);
        return { name: config.name, toolCount: 0 };
    }

    /**
     * 断开 MCP 服务器连接。
     */
    disconnectServer(name: string): void {
        this.servers.delete(name);
        // TODO: Phase 3-4 清理子进程和工具注册
        this.logger.log(`[MCPAdapter] Server "${name}" disconnected`);
    }

    /**
     * 获取已连接的 MCP 服务器列表。
     */
    getConnectedServers(): string[] {
        return Array.from(this.servers.keys());
    }

    /**
     * 创建 MCP 工具适配器。
     *
     * 将 MCP 工具包装为 ITool 接口，统一注册到 ToolRegistry。
     */
    createMcpToolAdapter(
        serverName: string,
        toolName: string,
        description: string,
        inputSchema: Record<string, unknown>,
    ): ITool {
        return {
            name: `mcp_${serverName}_${toolName}`,
            displayName: `${serverName}/${toolName}`,
            description: `[MCP:${serverName}] ${description}`,
            inputSchema,
            source: 'mcp',
            riskLevel: ToolRiskLevel.MEDIUM,
            execute: async (_input, _context) => {
                // TODO: Phase 3-4 真正的 MCP tools/call 实现
                throw new Error('MCP tool execution not yet implemented (Phase 3-4)');
            },
        };
    }
}
