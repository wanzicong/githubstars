import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import type { MappedRepoData } from './repo-data.interface';
import {
    buildGithubHeaders,
    mapStarredItem,
    parseLinkHeader,
    estimateTotalPages,
    sleep,
    type PaginationLinks,
} from '../common/utils/github-api.util';

const GITHUB_API = 'https://api.github.com';

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
                this.logger.log(`估算总页数: ${estimateTotalPages(pageResult.links, currentPage)}`);
            }

            // 判断是否还有下一页
            if (pageResult.links.next && pageResult.rawCount > 0) {
                nextUrl = pageResult.links.next;
                currentPage++;
                await sleep(300);
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
    /**
     * 执行 GitHub API 网络请求
     *
     * @returns Response 对象，网络异常时根据 existingCount 决定返回 null 或抛出
     */
    private async executeFetch(
        url: string,
        headers: Record<string, string>,
        currentPage: number,
        existingCount: number,
    ): Promise<Response | null> {
        try {
            return await fetch(url, { headers });
        } catch (fetchErr) {
            const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            this.logger.error(`网络请求失败! 第${currentPage}页, 错误: ${errMsg}`);
            if (existingCount > 0) return null;
            throw new Error(`GitHub API 网络请求失败: ${errMsg}`);
        }
    }

    /**
     * 校验 API 响应状态码，非 200 时按容错策略处理
     */
    private async handleNonOkResponse(response: Response, currentPage: number, existingCount: number): Promise<boolean> {
        if (response.status === 200) return true;
        const errorBody = await response.text().catch(() => '(无法读取响应体)');
        this.logger.error(`API 响应异常! 第${currentPage}页, 状态码=${response.status}`);
        if (existingCount > 0) return false;
        throw new Error(`GitHub API 请求失败 (HTTP ${response.status}): ${errorBody.substring(0, 200)}`);
    }

    /**
     * 解析 JSON 响应体为数组
     *
     * @returns 解析后的数组，解析异常时根据 existingCount 决定返回 null 或抛出
     */
    private async parsePageItems(rawText: string, currentPage: number, existingCount: number): Promise<Record<string, any>[] | null> {
        try {
            const items = JSON.parse(rawText);
            if (!Array.isArray(items)) throw new Error('响应体不是 JSON 数组');
            return items;
        } catch (parseErr) {
            this.logger.error(`JSON 解析失败! 第${currentPage}页: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
            if (existingCount > 0) return null;
            throw new Error(`GitHub API 响应 JSON 解析失败: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
        }
    }

    private async fetchStarredPage(
        url: string,
        token: string,
        currentPage: number,
        existingCount: number,
    ): Promise<{ mapped: MappedRepoData[]; links: PaginationLinks; rawCount: number; duration: string } | null> {
        const pageStart = Date.now();
        this.logger.log(`>>>>> 正在获取第 ${currentPage} 页...`);

        const headers = buildGithubHeaders(token, 'application/vnd.github.v3.star+json');
        const response = await this.executeFetch(url, headers, currentPage, existingCount);
        if (!response) return null;

        const isOk = await this.handleNonOkResponse(response, currentPage, existingCount);
        if (!isOk) return null;

        const rawText = await response.text();
        const pageItems = await this.parsePageItems(rawText, currentPage, existingCount);
        if (!pageItems) return null;

        // 逐条映射到 DB 格式
        const mapped: MappedRepoData[] = [];
        for (const item of pageItems) {
            try {
                const result = mapStarredItem(item);
                if (result) mapped.push(result);
            } catch (mapErr) {
                this.logger.error(`映射单条数据失败, 第${currentPage}页: ${mapErr instanceof Error ? mapErr.message : String(mapErr)}`);
            }
        }

        const links = parseLinkHeader(response.headers.get('Link') || '');
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

        const headers = buildGithubHeaders(token, 'application/vnd.github.v3.raw');
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
            bodyLower.includes('rate limit') || bodyLower.includes('api rate limit exceeded') || bodyLower.includes('secondary rate limit');

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
        const headers = buildGithubHeaders(token);

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

        const headers = buildGithubHeaders(token);

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
                this.logger.error('GitHub API rate limited');
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
}
