import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { AGENT_DEFAULT_MODEL } from '../agent/agent.constants';

const README_CHUNK_SIZE = 12_000;
const REQUEST_TIMEOUT_MS = 300_000;

/**
 * 按 Markdown 行切分长文档，尽量不在代码围栏内部断开。
 *
 * 超大的单个代码块允许暂时超过限制，以保证 Markdown 结构与代码内容完整。
 */
export function splitMarkdownIntoChunks(markdown: string, maxChars = README_CHUNK_SIZE): string[] {
    if (markdown.length <= maxChars) return [markdown];

    const rawLines = markdown.split('\n');
    const lines = rawLines.map((line, index) => (index < rawLines.length - 1 ? `${line}\n` : line)).filter(Boolean);
    const chunks: string[] = [];
    let current = '';
    let insideFence = false;

    for (const line of lines) {
        if (current && current.length + line.length > maxChars && !insideFence) {
            chunks.push(current);
            current = '';
        }

        current += line;
        if (/^\s*(?:```|~~~)/.test(line)) insideFence = !insideFence;

        if (current.length >= maxChars && !insideFence) {
            chunks.push(current);
            current = '';
        }
    }

    if (current) chunks.push(current);
    return chunks;
}

@Injectable()
export class AgentTranslationClientService {
    constructor(private readonly config: ConfigService) {}

    private loadSdk() {
        // Node 会缓存动态导入的 ESM 模块，无需再维护一个容易触发 NodeNext 类型分裂的 Promise 缓存。
        return import('@anthropic-ai/sdk');
    }

    private async translateChunk(text: string, kind: 'description' | 'readme'): Promise<string> {
        const [sdk, configuredApiKey, configuredBaseUrl] = await Promise.all([
            this.loadSdk(),
            this.config.getValue('anthropic.api_key'),
            this.config.getValue('anthropic.base_url'),
        ]);
        const apiKey = process.env.ANTHROPIC_API_KEY || configuredApiKey;
        const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
        const baseURL = process.env.ANTHROPIC_BASE_URL || configuredBaseUrl || 'https://api.anthropic.com';

        if (!apiKey && !authToken) {
            throw new ServiceUnavailableException('智能体模型凭据未配置，请先配置 anthropic.api_key 或 ANTHROPIC_AUTH_TOKEN');
        }

        const client = new sdk.default({
            apiKey: apiKey || null,
            authToken: authToken || null,
            baseURL,
            timeout: REQUEST_TIMEOUT_MS,
            maxRetries: 2,
        });
        const isReadme = kind === 'readme';
        const response = await client.messages.create({
            model: process.env.AGENT_MODEL || AGENT_DEFAULT_MODEL,
            max_tokens: isReadme ? 8192 : 1024,
            temperature: 0.2,
            system: isReadme
                ? '你是技术文档本地化专家。保持 Markdown 结构、代码块、命令、URL、HTML、徽章和技术标识原样，只翻译自然语言。只输出译文，不要解释。'
                : '你是技术项目本地化专家。将 GitHub 项目描述翻译成简洁准确的中文，保留必要的技术术语。只输出译文，不要解释。',
            messages: [{ role: 'user', content: text }],
        });
        const translated = response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('')
            .trim();

        if (!translated) throw new BadGatewayException('智能体模型返回了空翻译结果');
        return translated;
    }

    async translateDescription(text: string): Promise<string> {
        return this.translateChunk(text, 'description');
    }

    async translateReadme(markdown: string): Promise<string> {
        const chunks = splitMarkdownIntoChunks(markdown);
        const translated: string[] = [];
        for (const chunk of chunks) {
            translated.push(await this.translateChunk(chunk, 'readme'));
        }
        return translated.join('\n\n');
    }
}
