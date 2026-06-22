import { Injectable, Logger } from '@nestjs/common';
import { ITool, ToolRiskLevel, ToolExecutionContext } from '../tool.interface';
import { ConfigService } from '../../../config/config.service';

/**
 * 翻译工具。
 *
 * 直接调用 DeepSeek API 进行文本翻译。
 */
@Injectable()
export class TranslateTextTool implements ITool {
    readonly name = 'translate_text';
    readonly displayName = 'AI 翻译';
    readonly description = '使用 DeepSeek AI 将英文文本翻译为中文。';
    readonly source = 'builtin' as const;
    readonly riskLevel = ToolRiskLevel.LOW;
    readonly inputSchema = {
        type: 'object',
        properties: {
            text: { type: 'string', description: '待翻译的英文文本' },
            isReadme: { type: 'boolean', description: '是否为 README 文档', default: false },
        },
        required: ['text'],
    };

    private readonly logger = new Logger(TranslateTextTool.name);

    constructor(private readonly config: ConfigService) {}

    async execute(input: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
        const text = input.text as string;
        const isReadme = (input.isReadme as boolean) || false;

        if (!text?.trim()) return { error: 'text is required' };

        this.logger.log(`[translate_text] text=${text.substring(0, 50)}... isReadme=${isReadme}`);

        const apiKey = await this.config.getValue('deepseek.api_key');
        const apiUrl = await this.config.getValueDefault('deepseek.api_url', 'https://api.deepseek.com/v1/chat/completions');
        const model = await this.config.getValueDefault('deepseek.model', 'deepseek-chat');

        if (!apiKey) return { success: false, error: 'DeepSeek API Key not configured' };

        const prompt = isReadme
            ? `你是一个专业的技术文档翻译专家。请将以下内容翻译成中文。保持 Markdown 格式。只返回翻译结果。\n\n${text}`
            : `请将以下英文翻译成中文。只返回翻译结果。\n\n${text}`;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 300000);

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model,
                    temperature: 0.3,
                    max_tokens: isReadme ? 32768 : 1024,
                    messages: [{ role: 'user', content: prompt }],
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!res.ok) {
                return { success: false, error: `DeepSeek API: ${res.status}` };
            }

            const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
            const translated = data.choices?.[0]?.message?.content || '';

            return {
                success: true,
                original: text.substring(0, 200),
                translated,
            };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }
}
