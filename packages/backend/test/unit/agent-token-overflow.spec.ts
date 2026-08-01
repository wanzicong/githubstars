/* eslint-disable @typescript-eslint/no-unsafe-call --
 * 测试通过 Object.create 构造最小 AgentClientService 形态，mock 方法在类型系统之外，属测试固有写法。
 */
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({}), { virtual: true });
jest.mock('../../src/agent/mcp/system-tools', () => ({ createSystemMcpServer: jest.fn() }));

import { AgentClientService, type AgentQueryOptions } from '../../src/agent/agent-client.service';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/** query 签名（与 SDK 的 query 函数形状一致的最小定义） */
type QueryFn = (args: { prompt: string; options: Record<string, unknown> }) => AsyncGenerator<SDKMessage>;

/** 判断是否为「生成历史摘要」的内部调用（prompt 含摘要指令标记） */
function isDigestPrompt(prompt: string): boolean {
    return prompt.includes('压缩成一段简洁的中文摘要');
}

/**
 * 针对「token 超限（400 exceeded model token limit）后无法自动恢复」的测试。
 *
 * 期望行为：stream() 检测到 token 超限 → 用同一渠道生成历史摘要 →
 * 去掉 resume 重开新会话，并把摘要注入新会话开场 prompt。
 */
describe('AgentClientService — token 超限自动重开 + 摘要续聊', () => {
    const overflowError = new Error(
        'API Error: 400 {"error":{"type":"invalid_request_error","message":"Invalid request: Your request exceeded model token limit: 262144 (requested: 279306)"}}',
    );

    interface MockSvc {
        svc: AgentClientService;
        calls: { prompt: string; options: Record<string, unknown> }[];
    }

    function createSvc(opts: { digestText?: string; digestShouldFail?: boolean }): MockSvc {
        const svc = Object.create(AgentClientService.prototype) as AgentClientService & {
            credentials: { refreshCredentials: jest.Mock };
            logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
            stderrTail: string;
        };
        svc.credentials = { refreshCredentials: jest.fn().mockResolvedValue(undefined) };
        svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
        svc.stderrTail = '';
        // 插件校验依赖 init 消息结构，这里直接跳过
        (svc as unknown as { assertAgentPluginInitialized: () => void }).assertAgentPluginInitialized = () => undefined;
        // 屏蔽 buildQueryOptions 的插件/MCP 组装（保留 resume 删除逻辑的可观测性）
        (svc as unknown as { buildQueryOptions: (o: AgentQueryOptions) => Promise<Record<string, unknown>> }).buildQueryOptions = (
            o: AgentQueryOptions,
        ) => Promise.resolve(o.sessionId ? { resume: o.sessionId } : {});

        const calls: { prompt: string; options: Record<string, unknown> }[] = [];
        const query: QueryFn = ({ prompt, options }) =>
            (async function* (): AsyncGenerator<SDKMessage> {
                await Promise.resolve(); // 标记真实 async 边界
                calls.push({ prompt, options });
                if (isDigestPrompt(prompt)) {
                    if (opts.digestShouldFail) throw new Error('digest channel down');
                    yield {
                        type: 'result',
                        subtype: 'success',
                        result: opts.digestText ?? '之前讨论了仓库分类方案。',
                    } as unknown as SDKMessage;
                    return;
                }
                const isFirstMainCall = calls.filter((c) => !isDigestPrompt(c.prompt)).length === 1;
                if (isFirstMainCall) throw overflowError; // 主会话首次：模拟 token 超限
                // 重开的新会话：正常返回
                yield { type: 'result', subtype: 'success', result: 'OK' } as unknown as SDKMessage;
            })();

        (svc as unknown as { loadSdk: () => Promise<{ query: QueryFn }> }).loadSdk = () => Promise.resolve({ query });
        return { svc, calls };
    }

    const baseOptions: AgentQueryOptions = {
        prompt: '继续帮我整理分类',
        sessionId: 'sdk-session-old',
        historySource: 'user: 帮我整理分类\nassistant: 好的，先看下分类树…',
    };

    it('token 超限后应去掉 resume 重开新会话，并把历史摘要注入开场 prompt', async () => {
        const { svc, calls } = createSvc({});
        const received: SDKMessage[] = [];
        for await (const m of svc.stream({ ...baseOptions })) received.push(m);

        // 应有结果产出（重开的新会话正常返回）
        expect(received.some((m) => m.type === 'result')).toBe(true);

        const mainCalls = calls.filter((c) => !isDigestPrompt(c.prompt));
        // 第一次带 resume（旧会话），第二次重开不带 resume
        expect(mainCalls[0].options.resume).toBe('sdk-session-old');
        expect(mainCalls[1].options.resume).toBeUndefined();
        // 第二次的 prompt 注入了摘要 + 用户当前消息
        expect(mainCalls[1].prompt).toContain('【会话历史摘要】');
        expect(mainCalls[1].prompt).toContain('之前讨论了仓库分类方案。');
        expect(mainCalls[1].prompt).toContain('继续帮我整理分类');
    });

    it('摘要生成失败时应降级为纯重开（不带摘要），对话不中断', async () => {
        const { svc, calls } = createSvc({ digestShouldFail: true });
        const received: SDKMessage[] = [];
        for await (const m of svc.stream({ ...baseOptions })) received.push(m);

        expect(received.some((m) => m.type === 'result')).toBe(true);
        const mainCalls = calls.filter((c) => !isDigestPrompt(c.prompt));
        expect(mainCalls[1].options.resume).toBeUndefined();
        // 降级：prompt 不含摘要块，仍是用户原始消息
        expect(mainCalls[1].prompt).toBe('继续帮我整理分类');
    });

    it('重开后仍超限（isCompactionRetry）不应无限递归，直接抛错', async () => {
        const svc = Object.create(AgentClientService.prototype) as AgentClientService & {
            credentials: { refreshCredentials: jest.Mock };
            logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
        };
        svc.credentials = { refreshCredentials: jest.fn().mockResolvedValue(undefined) };
        svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
        (svc as unknown as { assertAgentPluginInitialized: () => void }).assertAgentPluginInitialized = () => undefined;
        (svc as unknown as { buildQueryOptions: () => Promise<Record<string, unknown>> }).buildQueryOptions = () => Promise.resolve({});
        // 重试路径下 SDK 同步抛超限错误（无需真实流）
        const throwingQuery: QueryFn = () => {
            throw overflowError;
        };
        (svc as unknown as { loadSdk: () => Promise<{ query: QueryFn }> }).loadSdk = () => Promise.resolve({ query: throwingQuery });

        const consume = async () => {
            for await (const m of svc.stream({ ...baseOptions, isCompactionRetry: true })) {
                expect(m).toBeDefined();
            }
        };
        await expect(consume()).rejects.toThrow();
    });
});
