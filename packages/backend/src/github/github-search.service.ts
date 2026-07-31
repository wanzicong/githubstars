import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { GithubApiService } from './github-api.service';
import { GithubRepoService } from './github-repo.service';

const GITHUB_API = 'https://api.github.com';

/** 未入库仓库详情的内存缓存有效期（10 分钟），降低 GitHub API 限流压力 */
const REPO_DETAIL_CACHE_TTL = 10 * 60 * 1000;
/** 缓存条目上限，超出后整体清空重建 */
const REPO_DETAIL_CACHE_MAX = 200;

@Injectable()
export class GithubSearchService {
    private readonly logger = new Logger(GithubSearchService.name);

    /** 未入库仓库详情缓存：fullName → { data, expiresAt } */
    private readonly repoDetailCache = new Map<string, { data: Record<string, unknown>; expiresAt: number }>();
    constructor(
        private readonly config: ConfigService,
        private readonly githubApi: GithubApiService,
        private readonly repoService: GithubRepoService,
    ) {}

    /**
     * 获取任意 GitHub 仓库详情（统一仓库详情页数据源）
     *
     * 数据策略：
     * 1. 本地库已收录 → 返回 DB 完整数据（含翻译），并按需拉取 README，inLibrary=true
     * 2. 未收录 → 实时调用 GitHub API 获取元数据 + README，组装为与 DB 模型同构的
     *    对象（id=null、无翻译字段），inLibrary=false，结果缓存 10 分钟
     *
     * 未入库的仓库只读展示，不写入数据库，避免污染 Star 列表。
     *
     * @param owner 仓库所有者
     * @param repo 仓库名
     * @returns 仓库详情对象（GithubRepo 同构 + inLibrary 标记）
     */
    async getRepoDetail(owner: string, repo: string): Promise<Record<string, unknown>> {
        const fullName = `${owner}/${repo}`;
        this.logger.log(`获取仓库详情: ${fullName}`);

        // 1. 本地库命中 → DB 数据（含翻译），按需拉取 README
        const local = await this.repoService.findByFullName(fullName);
        if (local) {
            if (!local.readmeFetched) {
                this.logger.log(`详情页触发 README 按需拉取: ${fullName}`);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- ensureReadmeFetched 预存 Promise<any> 返回值
                const updated = await this.repoService.ensureReadmeFetched(Number(local.id));
                return { ...((updated ?? local) as Record<string, unknown>), inLibrary: true };
            }
            return { ...local, inLibrary: true };
        }

        // 2. 内存缓存命中
        const cached = this.repoDetailCache.get(fullName);
        if (cached && cached.expiresAt > Date.now()) {
            this.logger.log(`仓库详情命中缓存: ${fullName}`);
            return cached.data;
        }

        // 3. GitHub API 实时获取；README 失败不阻塞详情返回
        const mapped = await this.githubApi.fetchRepoByFullName(fullName);
        const readmeResult = await this.githubApi.fetchReadmeFromGitHub(fullName).catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(`仓库详情 README 拉取失败: ${fullName}, ${msg}`);
            return null;
        });

        const detail: Record<string, unknown> = {
            id: null,
            ...mapped,
            descriptionCn: null,
            readmeCn: null,
            readmeOriginal: readmeResult?.content ?? null,
            readmeFetched: true,
            inLibrary: false,
        };

        if (this.repoDetailCache.size >= REPO_DETAIL_CACHE_MAX) {
            this.repoDetailCache.clear();
        }
        this.repoDetailCache.set(fullName, { data: detail, expiresAt: Date.now() + REPO_DETAIL_CACHE_TTL });
        return detail;
    }

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
        const token = await this.config.getValueDefault('github.token', '');
        if (!token) {
            this.logger.error('Star 仓库失败: 未配置 github.token');
            return false;
        }
        try {
            const res = await fetch(`${GITHUB_API}/user/starred/${owner}/${repo}`, {
                method: 'PUT',
                headers: { ...(await this.buildHeaders()), 'Content-Length': '0' },
            });
            if (res.status === 204 || res.status === 304) return true;
            this.logger.error(`Star 仓库失败: ${owner}/${repo}, GitHub 响应 status=${res.status}`);
            return false;
        } catch (e) {
            this.logger.error(`Star 仓库异常: ${owner}/${repo}`, e instanceof Error ? e : undefined);
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
        } catch (e) {
            this.logger.error(`取消 Star 仓库失败: ${owner}/${repo}`, e instanceof Error ? e : undefined);
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
        } catch (e) {
            this.logger.error(`检查 Star 状态失败: ${owner}/${repo}`, e instanceof Error ? e : undefined);
            return false;
        }
    }
}
