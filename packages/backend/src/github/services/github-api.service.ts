import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import type { MappedRepoData } from '../interfaces/repo-data.interface';

const GITHUB_API = 'https://api.github.com';

export type { MappedRepoData } from '../interfaces/repo-data.interface';

/** Link header 解析结果 */
export interface PaginationLinks {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
}

/**
 * GitHub REST API 服务
 *
 * 负责从 GitHub API 获取用户星标仓库列表和 README 内容。
 * 每次翻页都有详细的日志输出；
 * 解析 Link header 以支持完整的分页导航；
 * 遇到 JSON 解析失败时输出失败数据。
 */
@Injectable()
export class GithubApiService {
    private readonly logger = new Logger(GithubApiService.name);

    constructor(private readonly config: ConfigService) {}

    // ============================================================
    // 公共方法
    // ============================================================

    /**
     * 获取所有已 Star 的仓库（自动翻页至末尾）
     *
     * 使用 star+json media type 以获取 starred_at 字段。
     * 每一页的进度、数量、Link header 解析结果都通过 logger 输出。
     *
     * @returns 映射为 DB 友好格式的仓库数组
     */
    async fetchAllStarredRepos(): Promise<MappedRepoData[]> {
        const username = await this.config.getValueDefault('github.username', 'wanzicong');
        const token = await this.config.getValueDefault('github.token', '');

        this.logger.log('===== 开始全量获取星标仓库 =====');
        this.logger.log(`用户名: ${username}, 每页大小: 100`);

        const all: MappedRepoData[] = [];
        let currentPage = 1;
        let nextUrl: string | null = `${GITHUB_API}/users/${encodeURIComponent(username)}/starred?per_page=100&page=1`;
        const startTime = Date.now();

        while (nextUrl) {
            const pageResult = await this.fetchStarredPage(nextUrl, token, currentPage, all.length);
            if (!pageResult) break;

            all.push(...pageResult.mapped);
            this.logger.log(`第${currentPage}页完成: 映射${pageResult.mapped.length}条, 累计${all.length}条, 耗时${pageResult.duration}s`);

            // 首次获取时估算总页数
            if (currentPage === 1 && pageResult.links.last) {
                this.logger.log(`估算总页数: ${this.estimateTotalPages(pageResult.links, currentPage)}`);
            }

            // 判断是否还有下一页
            if (pageResult.links.next && pageResult.rawCount > 0) {
                nextUrl = pageResult.links.next;
                currentPage++;
                await this.sleep(300);
            } else {
                this.logger.log(`翻页终止: ${!pageResult.links.next ? 'next链接不存在' : '本页无数据'}`);
                nextUrl = null;
            }
        }

        const deduped = this.deduplicateRepos(all);
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.logger.log(`===== 全量获取完成: 共${deduped.length}个星标仓库, 共${currentPage}页, 总耗时${totalDuration}s =====`);
        return deduped;
    }

    /**
     * 获取单页星标仓库数据
     *
     * 负责网络请求、JSON 解析和字段映射。
     * 请求失败且已有数据时返回 null（上层应停止翻页）。
     *
     * @param url 请求 URL
     * @param token GitHub Token
     * @param currentPage 当前页码（用于日志）
     * @param existingCount 已获取数量（用于判断是否可容错）
     * @returns 页面结果，或 null 表示应停止翻页
     */
    private async fetchStarredPage(
        url: string,
        token: string,
        currentPage: number,
        existingCount: number,
    ): Promise<{ mapped: MappedRepoData[]; links: PaginationLinks; rawCount: number; duration: string } | null> {
        const pageStart = Date.now();
        this.logger.log(`>>>>> 正在获取第 ${currentPage} 页...`);

        const headers = this.buildGithubHeaders(token, 'application/vnd.github.v3.star+json');
        let response: Response;
        try {
            response = await fetch(url, { headers });
        } catch (fetchErr) {
            const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            this.logger.error(`网络请求失败! 第${currentPage}页, 错误: ${errMsg}`);
            if (existingCount > 0) return null;
            throw new Error(`GitHub API 网络请求失败: ${errMsg}`);
        }

        if (response.status !== 200) {
            const errorBody = await response.text().catch(() => '(无法读取响应体)');
            this.logger.error(`API 响应异常! 第${currentPage}页, 状态码=${response.status}`);
            if (existingCount > 0) return null;
            throw new Error(`GitHub API 请求失败 (HTTP ${response.status}): ${errorBody.substring(0, 200)}`);
        }

        const rawText = await response.text();
        let pageItems: Record<string, any>[];
        try {
            pageItems = JSON.parse(rawText);
            if (!Array.isArray(pageItems)) throw new Error('响应体不是 JSON 数组');
        } catch (parseErr) {
            this.logger.error(`JSON 解析失败! 第${currentPage}页: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
            if (existingCount > 0) return null;
            throw new Error(`GitHub API 响应 JSON 解析失败: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
        }

        // 逐条映射到 DB 格式
        const mapped: MappedRepoData[] = [];
        for (const item of pageItems) {
            try {
                const result = this.mapStarredItem(item);
                if (result) mapped.push(result);
            } catch (mapErr) {
                this.logger.error(`映射单条数据失败, 第${currentPage}页: ${mapErr instanceof Error ? mapErr.message : String(mapErr)}`);
            }
        }

        const links = this.parseLinkHeader(response.headers.get('Link') || '');
        const duration = ((Date.now() - pageStart) / 1000).toFixed(1);
        return { mapped, links, rawCount: pageItems.length, duration };
    }

    /**
     * 对仓库列表按 fullName 去重
     */
    private deduplicateRepos(repos: MappedRepoData[]): MappedRepoData[] {
        const seen = new Set<string>();
        const deduped = repos.filter((r) => {
            if (seen.has(r.fullName)) return false;
            seen.add(r.fullName);
            return true;
        });
        if (deduped.length < repos.length) {
            this.logger.log(`去重: ${repos.length} -> ${deduped.length} (移除${repos.length - deduped.length}条重复)`);
        }
        return deduped;
    }

    /**
     * 获取仓库 README 内容
     *
     * @param fullName 仓库全名，如 "owner/repo"
     * @returns README 文本内容，404 返回 null，其他错误抛出异常
     */
    async fetchReadmeFromGitHub(fullName: string): Promise<{ content: string | null; githubStatus: number; githubBody: string | null }> {
        const token = await this.config.getValueDefault('github.token', '');
        this.logger.log('获取 README: ' + fullName);
    
        const headers = this.buildGithubHeaders(token, 'application/vnd.github.v3.raw');
        const [owner, repo] = fullName.split('/');
        const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`;
    
        const doFetch = async (useAuth: boolean): Promise<{ status: number; body: string | null }> => {
            const controller = new AbortController();
            const readmeTimeout = setTimeout(() => controller.abort(), 30_000);
            try {
                const hdrs = { ...headers };
                if (!useAuth) delete hdrs['Authorization'];
                const response = await fetch(url, { headers: hdrs, signal: controller.signal });
                const body = await response.text();
                return { status: response.status, body };
            } catch (e) {
                if ((e as Error).name === 'AbortError') throw new Error('GitHub API 网络超时');
                const msg = e instanceof Error ? e.message : String(e);
                throw new Error(`GitHub API 网络错误: ${msg}`);
            } finally {
                clearTimeout(readmeTimeout);
            }
        };
    
        try {
            let result = await doFetch(!!token);
            this.logger.log(`README 响应状态: ${result.status} (${fullName})`);
    
            if (result.status === 200) {
                this.logger.log(`README 获取成功: ${fullName}, 大小=${result.body!.length} 字符`);
                return { content: result.body, githubStatus: 200, githubBody: null };
            }
    
            // 带 Token 返回 404 时，可能是 Token 无该组织 SSO 授权，回退到无认证重试
            if (result.status === 404 && token) {
                this.logger.log(`带 Token 返回 404，回退到无认证重试: ${fullName}`);
                result = await doFetch(false);
                if (result.status === 200) {
                    this.logger.log(`README 无认证获取成功: ${fullName}, 大小=${result.body!.length} 字符`);
                    return { content: result.body, githubStatus: 200, githubBody: null };
                }
            }
    
            if (result.status === 404) {
                this.logger.log(`仓库 ${fullName} 没有 README 文件`);
                return { content: null, githubStatus: 404, githubBody: result.body };
            }
    
            if (result.status === 403) {
                return this.handleReadme403(fullName, token, result);
            }
    
            this.logger.error(`README 请求失败: ${fullName}, status=${result.status}`);
            const err = new Error(`GitHub API error: ${result.status}`);
            (err as any).githubBody = result.body;
            throw err;
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('GitHub API')) throw err;
            if ((err as Error).name === 'AbortError') {
                this.logger.error(`README 请求超时 (30s): ${fullName}`);
                throw new Error('GitHub API 网络超时');
            }
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`README 请求异常: ${fullName}, ${msg}`);
            throw new Error(`GitHub API 网络错误: ${msg}`);
        }
    }
    
    /**
     * 处理 README 403 响应
     *
     * 区分真正的 rate limit 和其他原因（大文件、DMCA 等），
     * 非限流时回退到 JSON 格式获取。
     */
    private async handleReadme403(
        fullName: string,
        token: string,
        result: { status: number; body: string | null },
    ): Promise<{ content: string | null; githubStatus: number; githubBody: string | null }> {
        const bodyLower = (result.body || '').toLowerCase();
        const isRealRateLimit =
            bodyLower.includes('rate limit') ||
            bodyLower.includes('api rate limit exceeded') ||
            bodyLower.includes('secondary rate limit');
    
        this.logger.error(`README 403: ${fullName}, 响应体=${result.body?.substring(0, 300)}`);
    
        if (isRealRateLimit) {
            this.logger.error(`README API 真正限流: ${fullName}`);
            const err = new Error('GitHub API rate limited');
            (err as any).githubBody = result.body;
            (err as any).isRateLimit = true;
            throw err;
        }
    
        // 非限流 → 回退到 JSON 格式
        this.logger.log(`403 非限流，回退到 vnd.github.v3+json 格式: ${fullName}`);
        const jsonResult = await this.fetchReadmeAsJson(fullName, token);
        if (jsonResult.content !== null) {
            this.logger.log(`JSON 格式回退成功: ${fullName}, 大小=${jsonResult.content.length} 字符`);
            return { content: jsonResult.content, githubStatus: 200, githubBody: null };
        }
        if (jsonResult.status === 404) {
            return { content: null, githubStatus: 404, githubBody: jsonResult.githubBody };
        }
        const shortBody = (result.body || '无响应体').substring(0, 200);
        const err = new Error(`GitHub API 403 (非速率限制/其他原因): ${shortBody}`);
        (err as any).githubBody = result.body;
        throw err;
    }

    /**
     * 使用 standard JSON API 获取 README（回退方案）
     *
     * 当 vnd.github.v3.raw 格式因文件过大 (>1MB) 返回 403 时，
     * 回退到标准 JSON API，返回 base64 编码的内容，需要解码。
     *
     * @param fullName 仓库全名
     * @param token   GitHub Token
     * @returns 解码后的 README 文本，失败时返回 status 和 body
     */
    private async fetchReadmeAsJson(
        fullName: string,
        token: string,
    ): Promise<{ content: string | null; status: number; githubBody: string | null }> {
        const headers = this.buildGithubHeaders(token);

        const [owner, repo] = fullName.split('/');
        const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`;

        try {
            const response = await fetch(url, { headers });
            const body = await response.text();

            if (response.status === 200) {
                const data = JSON.parse(body);
                // content 是 base64 编码的，需要解码
                if (data.content) {
                    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
                    this.logger.log(`JSON 格式 README 解码成功: ${fullName}, 大小=${decoded.length}`);
                    return { content: decoded, status: 200, githubBody: null };
                }
                return { content: null, status: 200, githubBody: body };
            }

            this.logger.log(`JSON 格式 README 响应: status=${response.status}`);
            return { content: null, status: response.status, githubBody: body };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(`JSON 格式 README 请求失败: ${fullName}, ${msg}`);
            return { content: null, status: 0, githubBody: msg };
        }
    }

    /**
     * 搜索 GitHub 仓库
     *
     * @param query 搜索关键词（支持 GitHub 搜索语法）
     * @param sort 排序字段，默认 stars
     * @param order 排序方向，默认 desc
     * @param perPage 每页数量，默认 10
     */
    async searchRepos(query: string, sort: string = 'stars', order: string = 'desc', perPage: number = 10): Promise<any[]> {
        const token = await this.config.getValueDefault('github.token', '');

        this.logger.log('搜索仓库: q="' + query + '", sort=' + sort + ', order=' + order);
        this.logger.log(`搜索仓库详情: q="${query}", sort=${sort}, order=${order}, perPage=${perPage}`);

        const headers = this.buildGithubHeaders(token);

        const params = new URLSearchParams({
            q: query,
            sort,
            order,
            per_page: String(perPage),
        });

        const url = `${GITHUB_API}/search/repositories?${params}`;

        try {
            const response = await fetch(url, { headers });

            this.logger.log(`搜索响应状态: ${response.status}`);

            if (response.status === 200) {
                const data = await response.json();
                const items = (data.items || []) as any[];
                this.logger.log(`搜索结果: 共${data.total_count || 0}个, 返回${items.length}个`);
                return items;
            }

            if (response.status === 403) {
                this.logger.error('搜索 API 限流');
                this.logger.warn('GitHub API rate limited');
            } else {
                const errorBody = await response.text().catch(() => '');
                this.logger.error(`搜索失败: status=${response.status}, body=${errorBody.substring(0, 300)}`);
            }
            return [];
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error('搜索请求异常: ' + msg);
            return [];
        }
    }

    // ============================================================
    // 内部工具方法
    // ============================================================

    /**
     * 构建 GitHub API 请求头
     *
     * @param token GitHub Token，空则不加 Authorization
     * @param accept Accept header 值，默认 v3+json
     */
    private buildGithubHeaders(token: string, accept = 'application/vnd.github.v3+json'): Record<string, string> {
        const headers: Record<string, string> = { Accept: accept, 'User-Agent': 'GithubStars-Manager' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    /**
     * 将单条 GitHub starred API 返回数据映射为 DB 格式
     *
     * GitHub starred API 返回格式（star+json media type）:
     * {
     *   starred_at: "2024-01-01T00:00:00Z",
     *   repo: {
     *     id, name, full_name, description, language,
     *     owner: { login, avatar_url },
     *     html_url, homepage, stargazers_count, forks_count,
     *     watchers_count, open_issues_count, topics: [],
     *     license: { spdx_id, name } | null,
     *     fork, archived, created_at, updated_at, pushed_at
     *   }
     * }
     *
     * @param item GitHub starred API 返回的单条原始数据
     * @returns 映射后的 MappedRepoData 对象，无效数据返回 null
     */
    private mapStarredItem(item: Record<string, any>): MappedRepoData | null {
        const repo = item.repo || {};
        if (!repo || !repo.full_name) {
            return null; // 无效数据，跳过
        }

        const owner = repo.owner || {};
        const license = repo.license || {};

        return {
            repoName: repo.name || '',
            fullName: repo.full_name || '',
            description: repo.description || null,
            language: repo.language || null,
            ownerName: owner.login || '',
            ownerAvatarUrl: owner.avatar_url || '',
            htmlUrl: repo.html_url || '',
            homepage: repo.homepage || null,
            starsCount: repo.stargazers_count || 0,
            forksCount: repo.forks_count || 0,
            watchersCount: repo.watchers_count || 0,
            openIssuesCount: repo.open_issues_count || 0,
            topics: JSON.stringify(Array.isArray(repo.topics) ? repo.topics : []),
            licenseName: license.name || null,
            isFork: !!repo.fork,
            isArchived: !!repo.archived,
            repoCreatedAt: repo.created_at ? new Date(repo.created_at) : null,
            repoUpdatedAt: repo.updated_at ? new Date(repo.updated_at) : null,
            repoPushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
            starredAt: item.starred_at ? new Date(item.starred_at) : null,
        };
    }

    /**
     * 解析 GitHub API 的 Link header，提取所有分页链接
     *
     * Link header 格式示例:
     * <https://api.github.com/user/123/starred?page=2>; rel="next",
     * <https://api.github.com/user/123/starred?page=10>; rel="last"
     *
     * @param linkHeader 原始 Link header 字符串
     * @returns 包含 first/prev/next/last URL 的对象
     */
    parseLinkHeader(linkHeader: string): PaginationLinks {
        const links: PaginationLinks = {};

        if (!linkHeader || linkHeader.trim() === '') {
            return links;
        }

        // 按逗号分割每个 link 条目
        const parts = linkHeader.split(',');

        for (const part of parts) {
            const trimmed = part.trim();
            // 匹配 <url>; rel="type" 的格式
            const match = trimmed.match(/<([^>]+)>;\s*rel="([^"]+)"/);
            if (!match) {
                this.logger.verbose(`Link header 中存在无法解析的条目: "${trimmed}"`);
                continue;
            }

            const url = match[1];
            const rel = match[2].toLowerCase();

            switch (rel) {
                case 'first':
                    links.first = url;
                    break;
                case 'prev':
                    links.prev = url;
                    break;
                case 'next':
                    links.next = url;
                    break;
                case 'last':
                    links.last = url;
                    break;
                default:
                    // 忽略不认识的 rel（如 "prev" 在某些版本中拼写不同）
                    break;
            }
        }

        return links;
    }

    /**
     * 从分页链接估算总页数
     *
     * 优先从 last 链接提取 page 参数；
     * 没有 last 链接时认为当前是最后一页。
     */
    private estimateTotalPages(links: PaginationLinks, currentPage: number): number {
        if (links.last) {
            try {
                const url = new URL(links.last);
                const pageParam = url.searchParams.get('page');
                if (pageParam) {
                    const total = parseInt(pageParam, 10);
                    if (!isNaN(total) && total > 0) {
                        return total;
                    }
                }
            } catch {
                // URL 格式异常，忽略
            }
        }

        // 没有 next 也没有 last：只有一页
        if (!links.next) {
            return currentPage;
        }

        // 有 next 但没有 last：无法确定总页数
        return currentPage;
    }

    /**
     * Promise 延迟工具，用于 API 速率限制保护
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
