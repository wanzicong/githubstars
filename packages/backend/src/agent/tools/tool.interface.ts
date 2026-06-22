/**
 * 工具接口定义。
 *
 * 定义 Agent 工具体系的核心类型，供 ToolRegistry 和内置工具实现。
 *
 * @see tool-registry.service.ts — 工具注册中心
 * @see builtin/ — 内置工具实现
 */

/** 工具风险等级 */
export enum ToolRiskLevel {
    /** 只读查询，自动允许 */
    LOW = 'low',
    /** 数据修改，记录审计 */
    MEDIUM = 'medium',
    /** 系统级操作，需要审批 */
    HIGH = 'high',
}

/** 工具来源 */
export type ToolSource = 'builtin' | 'mcp';

/**
 * 内置工具描述接口。
 *
 * 每个工具实现此接口，由 ToolRegistry 统一注册管理。
 */
export interface ITool {
    /** 工具名称（唯一标识） */
    name: string;
    /** 工具显示名称 */
    displayName: string;
    /** 工具描述（给 LLM 看） */
    description: string;
    /** 输入参数 JSON Schema */
    inputSchema: Record<string, unknown>;
    /** 工具来源 */
    source: ToolSource;
    /** 风险等级 */
    riskLevel: ToolRiskLevel;
    /** 执行函数 */
    execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown>;
}

/**
 * 工具执行上下文。
 *
 * 工具执行时注入的依赖和服务。
 */
export interface ToolExecutionContext {
    taskId: number;
    sessionId?: number;
}
