import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

/**
 * Agent 凭据服务 —— 统一从 system_config 表读取 Agent 所需凭据。
 *
 * 恢复并替代原 github-agent/src/index.ts 中被注释的 Anthropic 凭据 DB 加载逻辑：
 * - anthropic.api_key  → process.env.ANTHROPIC_API_KEY（Claude Agent SDK 子进程读取）
 * - anthropic.base_url → process.env.ANTHROPIC_BASE_URL
 * - github.token       → 实例属性，供 GitHub MCP env 注入
 *
 * 优先级：启动环境变量 > 数据库。启动时快照 env；若 env 缺失则以 DB 为准
 * （含用户在设置页清空的情况），每次 Agent 请求前刷新使配置热生效。
 */
@Injectable()
export class AgentCredentialService implements OnApplicationBootstrap {
    private readonly logger = new Logger(AgentCredentialService.name);
    /** 启动时的环境变量快照（存在则永久优先） */
    private readonly envApiKey = process.env.ANTHROPIC_API_KEY;
    private readonly envAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;
    private readonly envBaseUrl = process.env.ANTHROPIC_BASE_URL;
    private readonly envGithubToken = process.env.GITHUB_TOKEN;
    private githubToken = '';

    constructor(private readonly config: ConfigService) {}

    /** 应用启动完成后执行（此时 ConfigService 缓存已加载） */
    async onApplicationBootstrap() {
        await this.refreshCredentials();
    }

    /** 从 ConfigService 刷新凭据（内存缓存读取，开销极小，每次 Agent 请求前调用） */
    async refreshCredentials(): Promise<void> {
        if (this.envApiKey) {
            process.env.ANTHROPIC_API_KEY = this.envApiKey;
        } else {
            const dbKey = await this.config.getValue('anthropic.api_key');
            if (dbKey) {
                process.env.ANTHROPIC_API_KEY = dbKey;
            } else if (!this.envAuthToken) {
                delete process.env.ANTHROPIC_API_KEY;
                this.logger.error('未配置 Anthropic 凭据（anthropic.api_key 或 ANTHROPIC_AUTH_TOKEN），Agent 对话将失败');
            } else {
                delete process.env.ANTHROPIC_API_KEY;
            }
        }

        if (this.envAuthToken) process.env.ANTHROPIC_AUTH_TOKEN = this.envAuthToken;

        // 本地代理模式：ANTHROPIC_BASE_URL 指向本机代理（如 CC Switch），
        // 无需真实 API Key/Token，设占位符让 SDK 子进程能正常启动。
        // 代理本身会处理认证，不接受任意 token 也无妨。
        if (this.isLocalProxyUrl(process.env.ANTHROPIC_BASE_URL) && !process.env.ANTHROPIC_AUTH_TOKEN) {
            process.env.ANTHROPIC_AUTH_TOKEN = 'PROXY_MANAGED';
            this.logger.log('检测到本地代理，使用占位 ANTHROPIC_AUTH_TOKEN');
        }

        if (this.envBaseUrl) {
            process.env.ANTHROPIC_BASE_URL = this.envBaseUrl;
        } else {
            const dbUrl = await this.config.getValue('anthropic.base_url');
            if (dbUrl) {
                process.env.ANTHROPIC_BASE_URL = dbUrl;
            } else {
                delete process.env.ANTHROPIC_BASE_URL;
            }
        }

        this.githubToken = this.envGithubToken ?? (await this.config.getValue('github.token')) ?? '';
        if (!this.githubToken) {
            this.logger.error('未配置 GitHub Token（github.token），GitHub MCP 调用将失败');
        }
    }

    /** 获取当前生效的 GitHub Token（供 GitHub MCP 使用） */
    getGitHubToken(): string {
        return this.githubToken;
    }

    /** 判断 URL 是否为本地代理地址（127.0.0.1 / localhost / host.docker.internal） */
    private isLocalProxyUrl(url: string | undefined): boolean {
        if (!url) return false;
        return url.includes('127.0.0.1') || url.includes('localhost') || url.includes('host.docker.internal');
    }
}
