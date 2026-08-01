jest.mock('@anthropic-ai/claude-agent-sdk', () => ({}), { virtual: true });
jest.mock('../../src/agent/mcp/system-tools', () => ({ createSystemMcpServer: jest.fn() }));

import { AgentSessionService } from '../../src/agent/agent-session.service';

/**
 * loadHistorySource — 把会话历史消息渲染为「生成摘要用」的纯文本。
 * 供 token 超限重开会话时，作为摘要模型的输入。
 */
describe('AgentSessionService — loadHistorySource 历史摘要源', () => {
    function createSvc(messages: { role: string; content: unknown }[]): AgentSessionService {
        const svc = Object.create(AgentSessionService.prototype) as AgentSessionService & {
            prisma: { agentMessage: { findMany: jest.Mock } };
            tryParseJson: (s: string) => unknown;
        };
        svc.prisma = {
            agentMessage: {
                findMany: jest.fn().mockResolvedValue(messages.map((m) => ({ content: JSON.stringify(m.content), role: m.role }))),
            },
        };
        // tryParseJson 是私有方法，这里用真实逻辑
        svc.tryParseJson = (s: string): unknown => {
            try {
                return JSON.parse(s) as unknown;
            } catch {
                return s;
            }
        };
        return svc;
    }

    it('应把 user/assistant 文本块渲染为「角色: 内容」行，忽略 tool 块', async () => {
        const svc = createSvc([
            { role: 'user', content: '帮我整理分类' },
            {
                role: 'assistant',
                content: [
                    { type: 'text', text: '好的，先看一下分类树' },
                    { type: 'tool_use', toolName: 'category_tree', toolInput: {} },
                    { type: 'thinking', thinking: '内部推理…' },
                ],
            },
        ]);
        const text = await svc.loadHistorySource('sess-1');
        expect(text).toContain('用户: 帮我整理分类');
        expect(text).toContain('助手: 好的，先看一下分类树');
        expect(text).not.toContain('category_tree');
        expect(text).not.toContain('内部推理');
    });

    it('历史为空时返回 undefined', async () => {
        const svc = createSvc([]);
        expect(await svc.loadHistorySource('sess-empty')).toBeUndefined();
    });

    it('超长历史应被截断到安全上限', async () => {
        const longText = '很长的消息'.repeat(5000); // ~25000 字符
        const svc = createSvc([{ role: 'user', content: longText }]);
        const text = await svc.loadHistorySource('sess-long');
        expect(text).toBeDefined();
        expect((text ?? '').length).toBeLessThanOrEqual(8100); // 上限 + 省略标记
        expect(text).toContain('…');
    });
});
