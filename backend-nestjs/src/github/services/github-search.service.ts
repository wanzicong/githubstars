import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

const GITHUB_API = 'https://api.github.com';

@Injectable()
export class GithubSearchService {
    private readonly logger = new Logger(GithubSearchService.name);

    constructor(private readonly config: ConfigService) {}

    /**
     * 构建 GitHub API 请求头
     *
     * 包含标准的 Accept 和 User-Agent 头，如果配置了 Token 则附加 Authorization 头。
     *
     * @returns HTTP 请求头对象
     */
    private async buildHeaders(): Promise<Record<string, string>> {
        const token = await this.config.getValueDefault('github.token', '');
        const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'GithubStars-Search' };
        if (token) h['Authorization'] = `Bearer ${token}`;
        return h;
    }

    /**
     * 搜索 GitHub 仓库
     *
     * 支持关键词和语言筛选，调用 GitHub Search API 返回仓库列表。
     * 搜索失败时返回 success: false 和错误信息，不抛出异常。
     *
     * @param keyword 搜索关键词
     * @param language 编程语言
     * @param sort 排序字段，默认 stars
     * @param page 页码，从 1 开始
     * @param perPage 每页数量，默认 20
     * @returns 搜索结果对象，包含 success、total、repos、page、perPage
     */
    async searchRepos(keyword: string, language: string, sort = 'stars', page = 1, perPage = 20) {
        this.logger.log('搜索仓库: keyword=' + keyword + ', language=' + language + ', page=' + page);
        try {
            let q = keyword || '';
            if (language) q += ` language:${language}`;
            if (!q.trim()) q = 'stars:>1';
            const params = new URLSearchParams({ q, sort: sort || 'stars', page: String(page), per_page: String(perPage) });
            const res = await fetch(`${GITHUB_API}/search/repositories?${params}`, { headers: await this.buildHeaders() });
            if (res.status === 200) {
                const data = await res.json();
                const repos = (data.items || []).map((item: any) => ({
                    id: item.id,
                    fullName: item.full_name || '',
                    description: item.description || '',
                    language: item.language || '',
                    starsCount: item.stargazers_count || 0,
                    forksCount: item.forks_count || 0,
                    htmlUrl: item.html_url || '',
                    pushedAt: item.pushed_at || '',
                    createdAt: item.created_at || '',
                    ownerName: item.owner?.login || '',
                    ownerAvatarUrl: item.owner?.avatar_url || '',
                    topics: Array.isArray(item.topics) ? item.topics : [],
                }));
                return { success: true, total: data.total_count || 0, repos, page, perPage };
            }
            if (res.status === 403) throw new Error('GitHub API rate limited');
            throw new Error(`GitHub API error: ${res.status}`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error('搜索仓库失败: ' + msg);
            if (msg.includes('rate limited')) return { success: false, total: 0, repos: [], page, perPage, message: 'GitHub API 限流' };
            return { success: false, total: 0, repos: [], page, perPage, message: `搜索失败: ${msg}` };
        }
    }

    /**
     * Star 一个 GitHub 仓库
     *
     * 向 GitHub API 发送 PUT 请求标记星标。
     *
     * @param owner 仓库所有者
     * @param repo 仓库名
     * @returns 成功返回 true
     */
    async starRepo(owner: string, repo: string): Promise<boolean> {
        this.logger.log('Star 仓库: ' + owner + '/' + repo);
        try {
            const res = await fetch(`${GITHUB_API}/user/starred/${owner}/${repo}`, {
                method: 'PUT',
                headers: { ...(await this.buildHeaders()), 'Content-Length': '0' },
            });
            return res.status === 204 || res.status === 304;
        } catch {
            return false;
        }
    }

    /**
     * 取消 Star 一个 GitHub 仓库
     *
     * 向 GitHub API 发送 DELETE 请求取消星标。
     *
     * @param owner 仓库所有者
     * @param repo 仓库名
     * @returns 成功返回 true
     */
    async unstarRepo(owner: string, repo: string): Promise<boolean> {
        this.logger.log('取消 Star 仓库: ' + owner + '/' + repo);
        try {
            const res = await fetch(`${GITHUB_API}/user/starred/${owner}/${repo}`, {
                method: 'DELETE',
                headers: await this.buildHeaders(),
            });
            return res.status === 204;
        } catch {
            return false;
        }
    }

    /**
     * 检查是否已 Star 某个仓库
     *
     * 向 GitHub API 发送 GET 请求检查星标状态。
     *
     * @param owner 仓库所有者
     * @param repo 仓库名
     * @returns 已 Star 返回 true
     */
    async checkStarred(owner: string, repo: string): Promise<boolean> {
        try {
            const res = await fetch(`${GITHUB_API}/user/starred/${owner}/${repo}`, { headers: await this.buildHeaders() });
            return res.status === 204;
        } catch {
            return false;
        }
    }
}
