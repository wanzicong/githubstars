jest.mock('@anthropic-ai/claude-agent-sdk', () => ({}), { virtual: true });

import { truncateRepoReadme, README_TRUNCATE_LENGTH } from '../../src/agent/mcp/system-tools';

/**
 * 针对「stars_detail / stars_by_ids / localization_pending 把完整 README 灌进上下文
 * 导致 token 爆炸」的测试：README/readmeCn 字段应被截断到安全长度并标注。
 */
describe('truncateRepoReadme — README 字段截断防 token 爆炸', () => {
    it('超长 README / readmeCn 应被截断并标注截断信息', () => {
        const repo = {
            id: 1,
            fullName: 'a/b',
            readme: 'x'.repeat(README_TRUNCATE_LENGTH + 5000),
            readmeCn: '译'.repeat(README_TRUNCATE_LENGTH + 5000),
        };
        const out = truncateRepoReadme(repo);
        expect(out.readme.length).toBeLessThan(README_TRUNCATE_LENGTH + 200);
        expect(out.readme).toContain('已截断');
        expect(out.readmeCn.length).toBeLessThan(README_TRUNCATE_LENGTH + 200);
        expect(out.readmeCn).toContain('已截断');
        // 其他字段不受影响
        expect(out.fullName).toBe('a/b');
    });

    it('短 README 不应被修改，也不含截断标注', () => {
        const repo = { id: 2, readme: 'short intro', readmeCn: '简短介绍' };
        const out = truncateRepoReadme(repo);
        expect(out.readme).toBe('short intro');
        expect(out.readmeCn).toBe('简短介绍');
    });

    it('缺失/null 字段不应报错', () => {
        const repo = { id: 3, fullName: 'x/y', readme: null, readmeCn: undefined };
        const out = truncateRepoReadme(repo) as Record<string, unknown>;
        expect(out.readme).toBeNull();
        expect(out.fullName).toBe('x/y');
    });

    it('数组形式（localization_pending / stars_by_ids）应逐项截断', () => {
        const repos = [
            { id: 1, readme: 'y'.repeat(README_TRUNCATE_LENGTH + 100) },
            { id: 2, readme: 'short' },
        ];
        const out = truncateRepoReadme(repos) as { id: number; readme: string }[];
        expect(out[0].readme).toContain('已截断');
        expect(out[1].readme).toBe('short');
    });
});
