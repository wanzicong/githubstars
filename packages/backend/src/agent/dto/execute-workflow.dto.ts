import { IsString, IsOptional, IsInt, IsArray, ValidateNested, ArrayMaxSize, MaxLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 子任务 DTO。
 */
export class SubTaskDto {
    @IsString()
    @MaxLength(100)
    name: string;

    @IsString()
    @MaxLength(5000)
    systemPrompt: string;

    @IsString()
    @MaxLength(5000)
    prompt: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    maxRounds?: number;
}

/**
 * 执行多 Agent 工作流 DTO。
 *
 * 用于 POST /api/agent/workflows/execute 端点，
 * 提交 Fan-Out/Fan-In 多 Agent 编排任务。
 *
 * @param sessionId — 关联会话 ID（可选，不传则自动创建）
 * @param subTasks — 子任务列表（1-10 个）
 * @param reportPrompt — 汇总报告提示词
 */
export class ExecuteWorkflowDto {
    @IsOptional()
    @IsInt()
    sessionId?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @ArrayMaxSize(10)
    @Type(() => SubTaskDto)
    subTasks: SubTaskDto[];

    @IsString()
    @MaxLength(5000)
    reportPrompt: string;
}
