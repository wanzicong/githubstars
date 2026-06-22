import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

/**
 * Prompt 注入防护管道。
 *
 * 检测用户输入中的常见注入模式，拒绝潜在的攻击请求。
 * 应用于所有 Agent 对话入口点（chatStream / createTask）。
 *
 * 注意：此管道不是完整的 Prompt 注入防御方案，
 * 仅覆盖最常见的注入模式。Phase 3-4 将增加：
 * - 语义分析（检测误导性指令）
 * - Token 级别过滤
 * - 多轮对话注入检测
 *
 * @callers
 *   - AgentController.chatStream()
 *   - AgentController.createTask()
 */
@Injectable()
export class PromptSanitizerPipe implements PipeTransform {
    private readonly injectionPatterns: RegExp[] = [
        // 系统指令注入
        /<system_instruction>/i,
        /<\|im_start\|>/i,
        /<\|im_end\|>/i,

        // 越狱/绕过指令
        /ignore (all |previous |above )?instructions/i,
        /disregard (all |previous |above )?instructions/i,
        /bypass (the |above |all )?(restrictions|rules|limits)/i,
        /override (the |all )?(system |safety )?(prompt|instructions|rules)/i,

        // 角色扮演攻击
        /you are now .*(?:DAN|jailbreak|unfiltered|unrestricted)/i,
        /pretend (you are|to be)/i,

        // 内部标记注入
        /\[SYSTEM\]:/i,
        /<function_calls>/i,
        /<tool_calls>/i,

        // 输出操纵
        /reply (only |just )?with .*(?:exactly|verbatim)/i,
        /output (only |just )?the following/i,
    ];

    transform(value: unknown): unknown {
        const text = this.extractText(value);
        if (!text) return value;

        const lowerText = text.toLowerCase();

        for (const pattern of this.injectionPatterns) {
            if (pattern.test(lowerText)) {
                throw new BadRequestException(
                    '检测到潜在的 Prompt 注入攻击，请求已被拒绝',
                );
            }
        }

        return value;
    }

    /**
     * 从各种可能的值中提取文本内容。
     */
    private extractText(value: unknown): string {
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'object' && value !== null) {
            const obj = value as Record<string, unknown>;
            // 提取 messages 数组中的 content
            if (Array.isArray(obj.messages)) {
                return (obj.messages as Array<{ content?: string }>)
                    .map(m => m.content || '')
                    .join('\n');
            }
            // 提取 input 中的内容
            if (typeof obj.input === 'string') {
                return obj.input;
            }
            if (typeof obj.input === 'object' && obj.input !== null) {
                return JSON.stringify(obj.input);
            }
            return JSON.stringify(value);
        }
        return '';
    }
}
