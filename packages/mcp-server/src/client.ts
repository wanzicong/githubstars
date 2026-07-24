/**
 * GitHub Stars 后端 API HTTP 客户端
 *
 * 所有 MCP 工具通过此客户端调用已运行的 NestJS 后端。
 * 后端默认运行在 http://localhost:10002。
 */

const DEFAULT_BASE_URL = 'http://localhost:10002';
const REQUEST_TIMEOUT_MS = 300_000; // 5 分钟，与前端 Axios 超时一致

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export class BackendClient {
    private readonly baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = (baseUrl ?? process.env.GITHUBSTARS_API_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    }

    /** POST 请求（项目规范：所有 API 使用 POST） */
    async post<T = unknown>(path: string, body?: unknown): Promise<T> {
        return this.request<T>('POST', path, body);
    }

    /** GET 请求（仅 Agent 会话管理使用） */
    async get<T = unknown>(path: string): Promise<T> {
        return this.request<T>('GET', path);
    }

    /** DELETE 请求（仅 Agent 会话删除使用） */
    async delete<T = unknown>(path: string): Promise<T> {
        return this.request<T>('DELETE', path);
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            return (await response.json()) as T;
        } finally {
            clearTimeout(timer);
        }
    }
}
