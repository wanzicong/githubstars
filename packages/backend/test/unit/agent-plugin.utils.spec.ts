import { resolve } from 'node:path';
import { AGENT_ALLOWED_TOOLS } from '../../src/agent/agent.constants';
import { isAgentPluginDirectory, resolveAgentPluginPath } from '../../src/agent/agent-plugin.utils';

describe('项目内置 Agent 插件接入', () => {
    const repoRoot = resolve(__dirname, '../../../..');
    const pluginPath = resolve(repoRoot, 'plugins/githubstars-agent');

    it('应从仓库根目录和 backend workspace 解析同一个完整插件', () => {
        expect(isAgentPluginDirectory(pluginPath)).toBe(true);
        expect(resolveAgentPluginPath(repoRoot, '')).toBe(pluginPath);
        expect(resolveAgentPluginPath(resolve(repoRoot, 'packages/backend'), '')).toBe(pluginPath);
    });

    it('应允许 Agent 调用插件命名空间下的 MCP 工具', () => {
        expect(AGENT_ALLOWED_TOOLS).toContain('mcp__plugin_githubstars-agent_githubstars__*');
        expect(AGENT_ALLOWED_TOOLS).toContain('Skill');
    });
});
