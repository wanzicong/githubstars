import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ITool, ToolRiskLevel, ToolExecutionContext } from './tool.interface';

/**
 * 工具注册中心。
 *
 * 管理所有 Agent 可用工具的注册、查询和执行。
 * 支持内置工具（builtin）和 MCP 工具两种来源。
 *
 * 在模块初始化时自动注册所有内置工具，
 * 启动后可通过 registerTool/unregisterTool 动态增减。
 *
 * @callers
 *   - AgentExecutorService — getSdkTools() 获取 SDK 格式工具列表
 *   - ToolInvokerService — invoke() 执行工具调用
 *   - AgentController — GET /api/agent/tools 查询已注册工具
 *
 * @see tool.interface.ts — ITool 接口定义
 * @see builtin/ — 内置工具实现
 * @see mcp-adapter.service.ts — MCP 工具适配
 */
@Injectable()
export class ToolRegistryService implements OnModuleInit {
    private readonly logger = new Logger(ToolRegistryService.name);

    /** name → ITool */
    private readonly tools = new Map<string, ITool>();

    onModuleInit(): void {
        this.logger.log('[ToolRegistry] Initialized');
    }

    /**
     * 注册工具。
     *
     * @param tool — 工具实例
     * @throws 如果工具名已存在
     */
    registerTool(tool: ITool): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool "${tool.name}" is already registered`);
        }
        this.tools.set(tool.name, tool);
        this.logger.log(`[ToolRegistry] Registered tool: ${tool.name} (${tool.source}, risk=${tool.riskLevel})`);
    }

    /**
     * 批量注册工具。
     */
    registerTools(tools: ITool[]): void {
        for (const tool of tools) {
            this.registerTool(tool);
        }
    }

    /**
     * 注销工具。
     */
    unregisterTool(name: string): boolean {
        const removed = this.tools.delete(name);
        if (removed) {
            this.logger.log(`[ToolRegistry] Unregistered tool: ${name}`);
        }
        return removed;
    }

    /**
     * 检查工具是否已注册。
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * 获取工具实例。
     */
    get(name: string): ITool | undefined {
        return this.tools.get(name);
    }

    /**
     * 获取所有已注册工具。
     */
    getAll(): ITool[] {
        return Array.from(this.tools.values());
    }

    /**
     * 获取所有工具的简化信息（供 API 返回）。
     */
    getToolList(): Array<{ name: string; displayName: string; description: string; riskLevel: ToolRiskLevel; source: string }> {
        return this.getAll().map(t => ({
            name: t.name,
            displayName: t.displayName,
            description: t.description,
            riskLevel: t.riskLevel,
            source: t.source,
        }));
    }

    /**
     * 获取 SDK 格式的工具列表（供 Claude Agent SDK 使用）。
     *
     * 转换为 SDK 期望的 ToolSpec 格式：
     * { name, description, inputSchema }
     */
    getSdkTools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
        return this.getAll().map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
        }));
    }

    /**
     * 执行工具调用。
     *
     * 统一入口：查找工具 → 校验参数 → 记录耗时 → 返回结果
     *
     * @param toolName — 工具名称
     * @param input — 调用参数
     * @param context — 执行上下文（taskId, sessionId 等）
     * @returns 工具执行结果
     * @throws 如果工具不存在
     */
    async invoke(toolName: string, input: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown> {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Unknown tool: ${toolName}`);
        }

        const startTime = Date.now();
        try {
            const result = await tool.execute(input, context);
            const duration = Date.now() - startTime;
            this.logger.log(`[ToolRegistry] Tool "${toolName}" completed in ${duration}ms`);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`[ToolRegistry] Tool "${toolName}" failed after ${duration}ms: ${(error as Error).message}`);
            throw error;
        }
    }

    /** 已注册工具数量 */
    get toolCount(): number {
        return this.tools.size;
    }
}
