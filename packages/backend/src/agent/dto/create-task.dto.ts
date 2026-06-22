import { IsString, IsObject, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建 Agent 异步任务 DTO。
 *
 * 用于 POST /api/agent/tasks 端点，提交异步 Agent 任务到 BullMQ 队列。
 *
 * @param type — 任务类型: CHAT | ANALYSIS | TRANSLATE | CLASSIFY | EXPORT | CUSTOM
 * @param input — 任务输入（JSON 对象）
 * @param sessionId — 关联会话 ID（可选，独立任务可为空）
 * @param priority — 优先级（0-100，越大越高）
 */
export class CreateTaskDto {
    @IsString()
    @IsIn(['CHAT', 'ANALYSIS', 'TRANSLATE', 'CLASSIFY', 'EXPORT', 'CUSTOM'])
    type: 'CHAT' | 'ANALYSIS' | 'TRANSLATE' | 'CLASSIFY' | 'EXPORT' | 'CUSTOM';

    @IsObject()
    input: Record<string, unknown>;

    @IsOptional()
    @IsInt()
    sessionId?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    priority?: number = 0;
}

/**
 * 查询任务列表 DTO。
 *
 * @param status — 状态过滤
 * @param type — 类型过滤
 * @param limit — 每页条数（默认 20，最大 100）
 * @param offset — 偏移量（默认 0）
 */
export class QueryTaskDto {
    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;
}
