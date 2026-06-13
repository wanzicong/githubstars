import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '../../config/config.service'

const GITHUB_API = 'https://api.github.com'

@Injectable()
export class GithubSearchService {
  private readonly logger = new Logger(GithubSearchService.name)
  constructor(private readonly config: ConfigService) {}

  private buildHeaders(): Record<string, string> {
    const token = this.config.getValueDefault('github.token', '')
    const h: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'GithubStars-Search' }
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }

  async searchRepos(keyword: string, language: string, sort = 'stars', page = 1, perPage = 20) {
    try {
      let q = keyword || ''
      if (language) q += ` language:${language}`
      if (!q.trim()) q = 'stars:>1'
      const params = new URLSearchParams({ q, sort: sort || 'stars', page: String(page), per_page: String(perPage) })
      const res = await fetch(`${GITHUB_API}/search/repositories?${params}`, { headers: this.buildHeaders() })
      if (res.status === 200) {
        const data = await res.json() as any
        const repos = (data.items || []).map((item: any) => ({
          id: item.id, fullName: item.full_name || '', description: item.description || '',
          language: item.language || '', starsCount: item.stargazers_count || 0,
          forksCount: item.forks_count || 0, htmlUrl: item.html_url || '',
          pushedAt: item.pushed_at || '', createdAt: item.created_at || '',
          ownerName: item.owner?.login || '', ownerAvatarUrl: item.owner?.avatar_url || '',
          topics: Array.isArray(item.topics) ? item.topics : [],
        }))
        return { success: true, total: data.total_count || 0, repos, page, perPage }
      }
      if (res.status === 403) throw new Error('GitHub API rate limited')
      throw new Error(`GitHub API error: ${res.status}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('rate limited')) return { success: false, total: 0, repos: [], page, perPage, message: 'GitHub API 限流' }
      return { success: false, total: 0, repos: [], page, perPage, message: `搜索失败: ${msg}` }
    }
  }

  async starRepo(owner: string, repo: string): Promise<boolean> {
    try {
      const res = await fetch(`${GITHUB_API}/user/starred/${owner}/${repo}`, { method: 'PUT', headers: { ...this.buildHeaders(), 'Content-Length': '0' } })
      return res.status === 204 || res.status === 304
    } catch { return false }
  }

  async unstarRepo(owner: string, repo: string): Promise<boolean> {
    try {
      const res = await fetch(`${GITHUB_API}/user/starred/${owner}/${repo}`, { method: 'DELETE', headers: this.buildHeaders() })
      return res.status === 204
    } catch { return false }
  }

  async checkStarred(owner: string, repo: string): Promise<boolean> {
    try {
      const res = await fetch(`${GITHUB_API}/user/starred/${owner}/${repo}`, { headers: this.buildHeaders() })
      return res.status === 204
    } catch { return false }
  }
}
