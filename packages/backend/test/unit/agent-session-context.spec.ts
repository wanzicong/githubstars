jest.mock('@anthropic-ai/claude-agent-sdk', () => ({}), { virtual: true });

import { AgentSessionService } from '../../src/agent/agent-session.service';

/**
 * 针对「对话上下文（选中的仓库/分类）不落库，resume 会话后丢失」的测试。
 *
 * 期望：首次发送带 context 时写入会话 metadata；resume 时前端未带 context，
 * 可从 metadata 回填，保证注入的仓库元信息不丢。
 */
describe('AgentSessionService — 会话上下文持久化与回填', () => {
    function createSvc(metadata: unknown) {
        const update = jest.fn().mockResolvedValue(undefined);
        const svc = Object.create(AgentSessionService.prototype) as AgentSessionService;
        (svc as unknown as { prisma: unknown }).prisma = {
            agentSession: {
                update,
                findUnique: jest.fn().mockResolvedValue(metadata === undefined ? null : { metadata }),
            },
        };
        return { svc, update };
    }

    it('saveSessionContext 应把上下文写入会话 metadata', async () => {
        const { svc, update } = createSvc(null);
        await svc.saveSessionContext('sess-1', { repoIds: [384, 1], categoryIds: [2] });
        expect(update).toHaveBeenCalledWith({
            where: { id: 'sess-1' },
            data: { metadata: { repoIds: [384, 1], categoryIds: [2] } },
        });
    });

    it('saveSessionContext 空上下文应跳过写入', async () => {
        const { svc, update } = createSvc(null);
        await svc.saveSessionContext('sess-1', {});
        await svc.saveSessionContext('sess-1', { repoIds: [], categoryIds: [] });
        expect(update).not.toHaveBeenCalled();
    });

    it('getSessionContext 应从 metadata 回填上下文', async () => {
        const { svc } = createSvc({ repoIds: [384] });
        expect(await svc.getSessionContext('sess-1')).toEqual({ repoIds: [384] });
    });

    it('getSessionContext 无 metadata 或空上下文时返回 undefined', async () => {
        expect(await createSvc(undefined).svc.getSessionContext('sess-x')).toBeUndefined();
        expect(await createSvc(null).svc.getSessionContext('sess-x')).toBeUndefined();
        expect(await createSvc({}).svc.getSessionContext('sess-x')).toBeUndefined();
    });
});
