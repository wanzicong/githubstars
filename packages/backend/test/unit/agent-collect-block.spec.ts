jest.mock('@anthropic-ai/claude-agent-sdk', () => ({}), { virtual: true });
jest.mock('../../src/agent/mcp/system-tools', () => ({ createSystemMcpServer: jest.fn() }));
import { AgentController } from '../../src/agent/agent.controller';
import type { MessageBlock } from '../../src/agent/agent-session.service';

/** collectBlock 去重：SDK 增量+完整块两套只保留一份 */
describe('AgentController.collectBlock 增量与完整块去重', () => {
    function makeController() {
        return Object.create(AgentController.prototype) as any;
    }

    it('text_delta 后到达完整 text，应只保留完整 text 一份', () => {
        const c = makeController();
        const blocks: MessageBlock[] = [];
        const draft = { text: '', thinking: '' };
        c.collectBlock(blocks, draft, { type: 'text_delta', text: '你好' });
        c.collectBlock(blocks, draft, { type: 'text_delta', text: '世界' });
        c.collectBlock(blocks, draft, { type: 'text', text: '你好世界' }); // SDK 完整块
        const texts = blocks.filter((b) => b.type === 'text');
        expect(texts).toHaveLength(1);
        expect(texts[0]).toEqual({ type: 'text', text: '你好世界' });
    });

    it('thinking_delta 后到达完整 thinking，应只保留完整 thinking 一份', () => {
        const c = makeController();
        const blocks: MessageBlock[] = [];
        const draft = { text: '', thinking: '' };
        c.collectBlock(blocks, draft, { type: 'thinking_delta', thinking: '思考' });
        c.collectBlock(blocks, draft, { type: 'thinking', thinking: '思考完整' });
        const thinks = blocks.filter((b) => b.type === 'thinking');
        expect(thinks).toHaveLength(1);
        expect(thinks[0]).toEqual({ type: 'thinking', thinking: '思考完整' });
    });

    it('同 toolId 的 tool_use 流式 start 与完整块只保留一份', () => {
        const c = makeController();
        const blocks: MessageBlock[] = [];
        const draft = { text: '', thinking: '' };
        // 流式 content_block_start(tool_use)
        c.collectBlock(blocks, draft, { type: 'tool_use', toolName: 'Bash', toolInput: { command: 'ls' }, toolId: 'tool-1' });
        // 完整 assistant 块里的同一 tool_use
        c.collectBlock(blocks, draft, { type: 'tool_use', toolName: 'Bash', toolInput: { command: 'ls' }, toolId: 'tool-1' });
        const tools = blocks.filter((b) => b.type === 'tool_use');
        expect(tools).toHaveLength(1);
        expect(tools[0].toolId).toBe('tool-1');
    });

    it('不同 toolId 的 tool_use 都应保留', () => {
        const c = makeController();
        const blocks: MessageBlock[] = [];
        const draft = { text: '', thinking: '' };
        c.collectBlock(blocks, draft, { type: 'tool_use', toolName: 'Bash', toolInput: {}, toolId: 'tool-1' });
        c.collectBlock(blocks, draft, { type: 'tool_use', toolName: 'Bash', toolInput: {}, toolId: 'tool-2' });
        expect(blocks.filter((b) => b.type === 'tool_use')).toHaveLength(2);
    });
});
