// SDK 为纯 ESM 包，Jest（CommonJS）无法直接加载；虚拟 mock 掉，避免 import 链触达 ESM。
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({}), { virtual: true });
jest.mock('../../src/agent/mcp/system-tools', () => ({ createSystemMcpServer: jest.fn() }));

import { AgentController } from '../../src/agent/agent.controller';
import type { AgentBlock } from '../../src/agent/agent-client.service';
import type { AgentSessionService, MessageBlock } from '../../src/agent/agent-session.service';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * 针对「中断后最后一条 assistant 回复丢失」的回归测试。
 *
 * 根因：客户端中断 SSE 流时，已收集的 assistantBlocks 未被持久化（异常路径写死传空数组）。
 * 修复：blocks/draft 提升到 chat 作用域，持久化移到 try/catch 之外，
 *       正常结束 / 客户端中断 / 中途异常三条路径都把已收集内容落库。
 */

/** saveMessage 的调用记录：[sessionId, role, content] */
type SaveCall = [string, string, string | MessageBlock[]];

interface MockSessionService {
    createSession: jest.Mock<Promise<string>, []>;
    getSession: jest.Mock;
    updateSdkSessionId: jest.Mock<Promise<void>, []>;
    saveMessage: jest.Mock<Promise<void>, SaveCall>;
}

interface BlockChunk {
    block: AgentBlock;
    raw: SDKMessage;
}

describe('AgentController — 中断时持久化 assistant 部分回复', () => {
    function createMockRes() {
        const listeners: Record<string, (() => void)[]> = {};
        const res = {
            writeHead: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
            destroyed: false,
            on: jest.fn((event: string, cb: () => void) => {
                const arr = listeners[event] ?? [];
                arr.push(cb);
                listeners[event] = arr;
            }),
        };
        return res;
    }

    function createSessionService(): MockSessionService {
        return {
            createSession: jest.fn<Promise<string>, []>().mockResolvedValue('our-session-1'),
            getSession: jest.fn().mockResolvedValue({ id: 'our-session-1', sdkSessionId: null }),
            updateSdkSessionId: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
            saveMessage: jest.fn<Promise<void>, SaveCall>().mockResolvedValue(undefined),
        };
    }

    /** 流式块源（正常流 / 中断流复用的最小 AgentClientService 形态） */
    function clientWith(chunks: BlockChunk[]) {
        return {
            streamBlocks: async function* (): AsyncGenerator<BlockChunk> {
                for (const chunk of chunks) {
                    if ((chunk.raw as { type?: string }).type === '__throw__') {
                        throw new Error('Claude Code process aborted by user');
                    }
                    yield chunk;
                }
                await Promise.resolve();
            },
        };
    }

    const initRaw = { type: 'system', subtype: 'init', session_id: 'sdk-1' } as unknown as SDKMessage;
    const assistantRaw = { type: 'assistant' } as unknown as SDKMessage;
    const throwRaw = { type: '__throw__' } as unknown as SDKMessage;

    function buildController(client: ReturnType<typeof clientWith>, sessionService: MockSessionService) {
        return new AgentController(client as never, sessionService as unknown as AgentSessionService);
    }

    function getAssistantBlocks(sessionService: MockSessionService): MessageBlock[] {
        const call = sessionService.saveMessage.mock.calls.find((c) => c[1] === 'assistant');
        return (call?.[2] ?? []) as MessageBlock[];
    }

    it('正常结束时持久化 user + 完整 assistant', async () => {
        const sessionService = createSessionService();
        const client = clientWith([
            { block: { type: 'text_start' }, raw: initRaw },
            { block: { type: 'text_delta', text: '你好，' }, raw: assistantRaw },
            { block: { type: 'text_delta', text: '世界' }, raw: assistantRaw },
        ]);
        const controller = buildController(client, sessionService);

        await controller.chat({ message: '你好', session: { type: 'auto' } } as never, createMockRes() as never);

        expect(sessionService.saveMessage.mock.calls.map((c) => c[1])).toEqual(['user', 'assistant']);
        expect(getAssistantBlocks(sessionService)).toEqual([{ type: 'text', text: '你好，世界' }]);
    });

    it('客户端中断/异常时仍持久化已收集的 assistant 部分回复（回归：不再丢失）', async () => {
        const sessionService = createSessionService();
        const client = clientWith([
            { block: { type: 'text_start' }, raw: initRaw },
            { block: { type: 'text_delta', text: '这是部分回复' }, raw: assistantRaw },
            { block: { type: 'system' }, raw: throwRaw }, // 客户端断开后 SDK 流抛错
        ]);
        const controller = buildController(client, sessionService);

        await controller.chat({ message: '你好', session: { type: 'auto' } } as never, createMockRes() as never);

        // 关键断言：即使流异常，user 和「部分 assistant 回复」都必须被持久化
        expect(sessionService.saveMessage.mock.calls.map((c) => c[1])).toEqual(['user', 'assistant']);
        expect(getAssistantBlocks(sessionService)).toEqual([{ type: 'text', text: '这是部分回复' }]);
    });

    it('中断时未收到任何内容则只持久化 user，不写空 assistant', async () => {
        const sessionService = createSessionService();
        const client = clientWith([
            { block: { type: 'text_start' }, raw: initRaw },
            { block: { type: 'system' }, raw: throwRaw },
        ]);
        const controller = buildController(client, sessionService);

        await controller.chat({ message: '你好', session: { type: 'auto' } } as never, createMockRes() as never);

        expect(sessionService.saveMessage.mock.calls.map((c) => c[1])).toEqual(['user']);
    });
});
