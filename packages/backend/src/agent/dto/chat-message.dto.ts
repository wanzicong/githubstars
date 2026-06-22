import { IsString, IsArray, IsOptional, IsInt, Min, Max, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 聊天消息 DTO。
 *
 * 单条消息，遵循 Anthropic Messages API 的 role/content 格式。
 *
 * @param role — 消息角色: user | assistant | system
 * @param content — 消息内容
 */
export class ChatMessageDto {
    @IsString()
    @IsIn(['user', 'assistant', 'system'])
    role: 'user' | 'assistant' | 'system';

    @IsString()
    content: string;
}

/**
 * 发送对话消息 DTO。
 *
 * 用于 POST /api/agent/sessions/:id/chat 流式对话端点。
 *
 * @param messages — 消息数组
 * @param timeoutMs — 超时时间毫秒（可选，默认 300000 = 5分钟）
 * @param maxToolRounds — 最大工具调用轮次（可选，默认 50）
 */
export class ChatDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ChatMessageDto)
    messages: ChatMessageDto[];

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1800000)
    timeoutMs?: number = 300000;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(200)
    maxToolRounds?: number = 50;
}
