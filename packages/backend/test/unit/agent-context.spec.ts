jest.mock('@anthropic-ai/claude-agent-sdk', () => ({}), { virtual: true });
jest.mock('../../src/agent/mcp/system-tools', () => ({ createSystemMcpServer: jest.fn() }));
import { AgentClientService } from '../../src/agent/agent-client.service';

describe('buildContextSection 上下文注入', () => {
    function createSvc() {
        const svc = Object.create(AgentClientService.prototype) as any;
        svc.githubRepo = { findByIds: jest.fn().mockResolvedValue([
            { fullName: 'public-apis/public-apis', description: 'APIs list', descriptionCn: '免费API合集', language: 'Python', starsCount: 300000 },
        ]) };
        svc.prisma = { category: { findMany: jest.fn().mockResolvedValue([{ name: '视频相关' }]) } };
        return svc;
    }
    it('应把选中仓库/分类解析为元信息上下文段', async () => {
        const section = await createSvc().buildContextSection({ repoIds: [384], categoryIds: [1] });
        expect(section).toContain('public-apis/public-apis');
        expect(section).toContain('免费API合集');
        expect(section).toContain('视频相关');
        expect(section).toContain('用户选中的仓库上下文');
    });
    it('无上下文时返回空串', async () => {
        const svc = createSvc();
        expect(await svc.buildContextSection(undefined)).toBe('');
        expect(await svc.buildContextSection({})).toBe('');
    });
});
