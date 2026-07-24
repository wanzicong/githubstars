/**
 * 工具注册辅助 — 统一封装后端 API 调用为 MCP Tool 响应格式
 */

import { BackendClient } from '../client.js';

export function createToolHandler(client: BackendClient, path: string, method: 'GET' | 'POST' | 'DELETE' = 'POST') {
    return async (params: Record<string, unknown>) => {
        try {
            let result: unknown;
            if (method === 'GET') {
                const query = new URLSearchParams(params as Record<string, string>).toString();
                result = await client.get(query ? `${path}?${query}` : path);
            } else if (method === 'DELETE') {
                result = await client.delete(path);
            } else {
                result = await client.post(path, params);
            }
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return {
                content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: msg }) }],
                isError: true,
            };
        }
    };
}
