import { githubApiService } from './github-api';

export class DeepSeekApiService {
  /**
   * 调用 DeepSeek Chat API
   */
  async chatCompletion(
    userContent: string,
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      timeout?: number;
    }
  ): Promise<string> {
    const apiKey = githubApiService.getDeepseekApiKey();
    if (!apiKey) throw new Error('请先配置 DeepSeek API Key');

    const apiUrl = githubApiService.getDeepseekApiUrl();
    const model = githubApiService.getDeepseekModel();

    const {
      systemPrompt,
      temperature = 0.3,
      maxTokens = 4096,
      timeout = 180000,
    } = options || {};

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userContent });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`DeepSeek API 错误 (${resp.status}): ${errorText}`);
      }

      const json = await resp.json() as {
        choices?: { message: { content: string } }[];
      };

      if (!json.choices || json.choices.length === 0) {
        throw new Error('DeepSeek API 返回空结果');
      }

      return json.choices[0].message.content;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`DeepSeek API 请求超时 (${timeout / 1000}秒)`);
      }
      throw error;
    }
  }
}

export const deepseekApiService = new DeepSeekApiService();
