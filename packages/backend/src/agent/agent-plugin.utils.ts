import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const AGENT_PLUGIN_REQUIRED_PATHS = ['.claude-plugin/plugin.json', '.mcp.json', 'server/index.cjs', 'skills'] as const;

/** 判断目录是否包含项目 Agent 运行所需的完整插件产物。 */
export function isAgentPluginDirectory(pluginPath: string): boolean {
    return AGENT_PLUGIN_REQUIRED_PATHS.every((relativePath) => existsSync(resolve(pluginPath, relativePath)));
}

/** 兼容仓库根目录、workspace 开发目录与 Docker /app 运行目录，定位统一 Agent 插件。 */
export function resolveAgentPluginPath(cwd = process.cwd(), configuredPath = process.env.AGENT_PLUGIN_PATH): string | undefined {
    const candidates = [
        configuredPath ? resolve(cwd, configuredPath) : undefined,
        resolve(cwd, 'plugins/githubstars-agent'),
        resolve(cwd, '../../plugins/githubstars-agent'),
        resolve(cwd, 'agent-plugin'),
    ].filter((path): path is string => !!path);

    return [...new Set(candidates)].find(isAgentPluginDirectory);
}
