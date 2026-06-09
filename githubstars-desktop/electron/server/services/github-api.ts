import { store } from '../utils/store';

/**
 * GitHub star+json API 响应格式
 * Accept: application/vnd.github.v3.star+json 返回的数据结构
 * 注意：repo 字段嵌套在 item.repo 下，starred_at 在外层！
 */
interface GithubStarredApiItem {
  starred_at: string;
  repo: {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    language: string | null;
    owner: { login: string; avatar_url: string };
    html_url: string;
    homepage: string | null;
    stargazers_count: number;
    forks_count: number;
    watchers_count: number;
    open_issues_count: number;
    topics: string[];
    license: { spdx_id: string; name: string } | null;
    fork: boolean;
    archived: boolean;
    created_at: string;
    updated_at: string;
    pushed_at: string;
  };
}

export interface GitHubRepoResult {
  repo_name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  owner_name: string;
  owner_avatar_url: string;
  html_url: string;
  homepage: string | null;
  stars_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  topics: string[];
  license_name: string | null;
  is_fork: boolean;
  is_archived: boolean;
  repo_created_at: string;
  repo_updated_at: string;
  repo_pushed_at: string;
  starred_at: string;
}

/**
 * 脱敏显示值
 */
function maskValue(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

export class GithubApiService {
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3.star+json',
      'User-Agent': 'GithubStars-Desktop',
    };
    const token = store.get('githubToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // ──────── 配置管理 ────────

  setConfig(updates: Record<string, string>): void {
    const keyMap: Record<string, string> = {
      'github.username': 'githubUsername',
      'github.token': 'githubToken',
      'deepseek.api_key': 'deepseekApiKey',
      'deepseek.model': 'deepseekModel',
      'deepseek.api_url': 'deepseekApiUrl',
    };
    for (const [key, value] of Object.entries(updates)) {
      const storeKey = keyMap[key];
      if (storeKey && value !== undefined && value !== '') {
        (store as any).set(storeKey, value);
      }
    }
  }

  getConfig(): {
    configKey: string; configValue: string; displayValue: string;
    description: string; sensitive: boolean;
  }[] {
    const all = store.getAll();
    return [
      { configKey: 'github.username', configValue: all.githubUsername || '', displayValue: all.githubUsername || '', description: 'GitHub 用户名，用于获取 Star 仓库列表', sensitive: false },
      { configKey: 'github.token', configValue: all.githubToken || '', displayValue: maskValue(all.githubToken), description: 'GitHub Personal Access Token（可选），提升 API 速率限制。在 https://github.com/settings/tokens 创建', sensitive: true },
      { configKey: 'deepseek.api_key', configValue: all.deepseekApiKey || '', displayValue: maskValue(all.deepseekApiKey), description: 'DeepSeek API 密钥，用于 AI 分类与中文翻译功能', sensitive: true },
      { configKey: 'deepseek.model', configValue: all.deepseekModel || 'deepseek-chat', displayValue: all.deepseekModel || 'deepseek-chat', description: 'DeepSeek 模型名称', sensitive: false },
      { configKey: 'deepseek.api_url', configValue: all.deepseekApiUrl || 'https://api.deepseek.com/v1/chat/completions', displayValue: all.deepseekApiUrl || 'https://api.deepseek.com/v1/chat/completions', description: 'DeepSeek API 端点地址', sensitive: false },
    ];
  }

  static maskValue = maskValue;

  // ──────── 便捷读取 ────────

  getUsername(): string { return store.get('githubUsername'); }
  getToken(): string { return store.get('githubToken'); }
  getDeepseekApiKey(): string { return store.get('deepseekApiKey'); }
  getDeepseekModel(): string { return store.get('deepseekModel') || 'deepseek-chat'; }
  getDeepseekApiUrl(): string { return store.get('deepseekApiUrl') || 'https://api.deepseek.com/v1/chat/completions'; }

  /**
   * 分页获取用户所有 Star 的仓库
   * 使用 star+json Accept header 获取 starred_at 时间
   */
  async fetchAllStarredRepos(username?: string): Promise<GitHubRepoResult[]> {
    const user = username || store.get('githubUsername');
    if (!user) throw new Error('请先配置 GitHub 用户名');

    const headers = this.getHeaders();
    let url = `https://api.github.com/users/${user}/starred?per_page=100&page=1`;
    const allRepos: GitHubRepoResult[] = [];

    while (url) {
      console.log(`📡 请求: ${url}`);
      const resp = await fetch(url, { headers });

      if (!resp.ok) {
        if (resp.status === 404) {
          throw new Error(`GitHub 用户 ${user} 不存在`);
        }
        if (resp.status === 403) {
          const resetTime = resp.headers.get('x-ratelimit-reset');
          const resetDate = resetTime
            ? new Date(Number(resetTime) * 1000).toLocaleString()
            : '未知';
          throw new Error(`API 速率限制已达上限，将在 ${resetDate} 重置。建议配置 GitHub Token。`);
        }
        const body = await resp.text().catch(() => '');
        throw new Error(`GitHub API 错误: ${resp.status} ${resp.statusText}${body ? ' - ' + body.substring(0, 200) : ''}`);
      }

      const body = (await resp.json()) as GithubStarredApiItem[];

      // star+json 格式：repo 字段嵌套在 item.repo 下
      for (const item of body) {
        const r = item.repo;
        allRepos.push({
          repo_name: r.name,
          full_name: r.full_name,
          description: r.description,
          language: r.language,
          owner_name: r.owner.login,
          owner_avatar_url: r.owner.avatar_url,
          html_url: r.html_url,
          homepage: r.homepage,
          stars_count: r.stargazers_count,
          forks_count: r.forks_count,
          watchers_count: r.watchers_count,
          open_issues_count: r.open_issues_count,
          topics: r.topics || [],
          license_name: r.license?.name || null,
          is_fork: r.fork,
          is_archived: r.archived,
          repo_created_at: r.created_at,
          repo_updated_at: r.updated_at,
          repo_pushed_at: r.pushed_at,
          starred_at: item.starred_at, // 来自外层 item，不是 repo！
        });
      }

      url = this.parseNextPage(resp.headers.get('Link'));
    }

    console.log(`📦 获取到 ${allRepos.length} 个 Star 仓库`);
    return allRepos;
  }

  private parseNextPage(linkHeader: string | null): string {
    if (!linkHeader) return '';
    const links = linkHeader.split(',');
    for (const link of links) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/);
      if (match) return match[1];
    }
    return '';
  }
}

export const githubApiService = new GithubApiService();
