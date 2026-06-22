import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

/**
 * 创建 Agent 会话 DTO。
 *
 * @param title — 会话标题（可选，默认为"新对话"）
 * @param systemPrompt — 系统提示词（可选）
 * @param model — 使用的模型（可选，默认从配置读取）
 */
export class CreateSessionDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    systemPrompt?: string;

    @IsOptional()
    @IsString()
    model?: string;
}

/**
 * 查询会话列表 DTO。
 *
 * @param status — 状态过滤（ACTIVE/COMPLETED/ARCHIVED）
 * @param limit — 每页条数（默认 20，最大 100）
 * @param offset — 偏移量（默认 0）
 */
export class QuerySessionDto {
    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @IsOptional()
    @IsInt()
    @Min(0)
    offset?: number = 0;
}
