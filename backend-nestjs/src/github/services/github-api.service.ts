import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '../../config/config.service'

const GITHUB_API = 'https://api.github.com'

/** Link header 解析结果 */
export interface PaginationLinks {
  first?: string
  prev?: string
  next?: string
  last?: string
}

/** DB 映射后的仓库数据，匹配 GithubRepo 表字段 */
export interface MappedRepoData {
  repoName: string
  fullName: string
  description: string | null
  language: string | null
  ownerName: string
  ownerAvatarUrl: string
  htmlUrl: string
  homepage: string | null
  starsCount: number
  forksCount: number
  watchersCount: number
  openIssuesCount: number
  topics: string
  licenseName: string | null
  isFork: boolean
  isArchived: boolean
  repoCreatedAt: Date | null
  repoUpdatedAt: Date | null
  repoPushedAt: Date | null
  starredAt: Date | null
}

/**
 * GitHub REST API 服务
 *
 * 负责从 GitHub API 获取用户星标仓库列表和 README 内容。
 * 每次翻页都有详细的 console.log 进度输出；
 * 解析 Link header 以支持完整的分页导航；
 * 遇到 JSON 解析失败时使用 console.error 输出失败数据。
 */
@Injectable()
export class GithubApiService {
  private readonly logger = new Logger(GithubApiService.name)

  constructor(private readonly config: ConfigService) {}

  // ============================================================
  // 公共方法
  // ============================================================

  /**
   * 获取所有已 Star 的仓库（自动翻页至末尾）
   *
   * 使用 star+json media type 以获取 starred_at 字段。
   * 每一页的进度、数量、Link header 解析结果都通过 console.log 输出。
   *
   * @returns 映射为 DB 友好格式的仓库数组
   */
  async fetchAllStarredRepos(): Promise<MappedRepoData[]> {
    const username = this.config.getValueDefault('github.username', 'wanzicong')
    const token = this.config.getValueDefault('github.token', '')

    console.log('[GithubApi] ===== 开始全量获取星标仓库 =====')
    console.log(`[GithubApi] 用户名: ${username}, 每页大小: 100`)

    const all: MappedRepoData[] = []
    let currentPage = 1
    let nextUrl: string | null = `${GITHUB_API}/users/${encodeURIComponent(username)}/starred?per_page=100&page=1`
    let totalPagesEstimate = '?'
    const startTime = Date.now()

    while (nextUrl) {
      console.log(`[GithubApi] >>>>> 正在获取第 ${currentPage} 页... URL=${nextUrl}`)
      const pageStart = Date.now()

      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3.star+json',
        'User-Agent': 'GithubStars-Manager',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      let response: Response
      try {
        response = await fetch(nextUrl, { headers })
      } catch (fetchErr) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        console.error(`[GithubApi] 网络请求失败! 第${currentPage}页, URL=${nextUrl}, 错误: ${errMsg}`)
        if (all.length > 0) {
          console.log(`[GithubApi] 第${currentPage}页网络失败，但已有${all.length}条数据，停止翻页`)
          break
        }
        throw new Error(`GitHub API 网络请求失败: ${errMsg}`)
      }

      console.log(`[GithubApi] 第${currentPage}页 响应状态: ${response.status} ${response.statusText}`)

      if (response.status !== 200) {
        const errorBody = await response.text().catch(() => '(无法读取响应体)')
        console.error(`[GithubApi] API 响应异常! 状态码=${response.status}, 响应体: ${errorBody.substring(0, 500)}`)
        if (all.length > 0) {
          console.log(`[GithubApi] 第${currentPage}页失败(status=${response.status})，但已有${all.length}条数据，停止翻页`)
          break
        }
        throw new Error(`GitHub API 请求失败 (HTTP ${response.status}): ${errorBody.substring(0, 200)}`)
      }

      // 先获取原始文本，便于 parse 失败时输出
      const rawText = await response.text()
      let pageItems: Record<string, any>[]

      try {
        pageItems = JSON.parse(rawText)
        if (!Array.isArray(pageItems)) {
          throw new Error('响应体不是 JSON 数组')
        }
      } catch (parseErr) {
        console.error(`[GithubApi] ===== JSON 解析失败! 第${currentPage}页 =====`)
        console.error(`[GithubApi] 错误信息: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`)
        console.error(`[GithubApi] 原始响应内容 (前2000字符):`)
        console.error(rawText.substring(0, 2000))
        if (all.length > 0) {
          console.log(`[GithubApi] 第${currentPage}页解析失败，但已有${all.length}条数据，停止翻页`)
          break
        }
        throw new Error(`GitHub API 响应 JSON 解析失败: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`)
      }

      console.log(`[GithubApi] 第${currentPage}页返回 ${pageItems.length} 条数据`)

      // 逐条映射到 DB 格式
      let mappedCount = 0
      for (const item of pageItems) {
        try {
          const mapped = this.mapStarredItem(item)
          if (mapped) {
            all.push(mapped)
            mappedCount++
          }
        } catch (mapErr) {
          console.error(`[GithubApi] 映射单条数据失败, 第${currentPage}页, 原始数据前500字符:`)
          console.error(JSON.stringify(item).substring(0, 500))
          console.error(`[GithubApi] 映射错误: ${mapErr instanceof Error ? mapErr.message : String(mapErr)}`)
        }
      }

      // 解析 Link header 确定下一页
      const linkHeader = response.headers.get('Link') || ''
      const links = this.parseLinkHeader(linkHeader)

      // 首次获取时估算总页数
      if (totalPagesEstimate === '?' && links.last) {
        totalPagesEstimate = String(this.estimateTotalPages(links, currentPage))
        console.log(`[GithubApi] 估算总页数: ${totalPagesEstimate}`)
      }

      if (linkHeader) {
        console.log(`[GithubApi] Link header: ${linkHeader}`)
        console.log(`[GithubApi] 解析分页链接: next=${links.next || '(无)'}, last=${links.last || '(无)'}, first=${links.first || '(无)'}, prev=${links.prev || '(无)'}`)
      } else {
        console.log(`[GithubApi] Link header: (空)`)
      }

      const pageDuration = ((Date.now() - pageStart) / 1000).toFixed(1)
      console.log(`[GithubApi] <<<<< 第${currentPage}页完成: 映射${mappedCount}条, 累计${all.length}条, 耗时${pageDuration}s`)

      // 判断是否还有下一页
      if (links.next && pageItems.length > 0) {
        nextUrl = links.next
        currentPage++
        // 速率限制保护：页间短暂停顿
        await this.delay(300)
      } else {
        const reason = !links.next ? 'next链接不存在' : (pageItems.length === 0 ? '本页无数据' : '未知')
        console.log(`[GithubApi] 翻页终止: ${reason}`)
        nextUrl = null
      }
    }

    // 去重（如果 GitHub API 返回了重复数据）
    const seen = new Set<string>()
    const deduped = all.filter(r => {
      if (seen.has(r.fullName)) return false
      seen.add(r.fullName)
      return true
    })
    if (deduped.length < all.length) {
      console.log(`[GithubApi] 去重: ${all.length} -> ${deduped.length} (移除${all.length - deduped.length}条重复)`)
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[GithubApi] ===== 全量获取完成: 共${deduped.length}个星标仓库, 共${currentPage}页, 总耗时${totalDuration}s =====`)

    return deduped
  }

  /**
   * 获取仓库 README 内容
   *
   * @param fullName 仓库全名，如 "owner/repo"
   * @returns README 文本内容，404 返回 null，其他错误抛出异常
   */
  async fetchReadmeFromGitHub(fullName: string): Promise<string | null> {
    const token = this.config.getValueDefault('github.token', '')

    console.log(`[GithubApi] 获取 README: ${fullName}`)

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3.raw',
      'User-Agent': 'GithubStars-Manager',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const url = `${GITHUB_API}/repos/${encodeURIComponent(fullName)}/readme`

    try {
      const response = await fetch(url, { headers })

      console.log(`[GithubApi] README 响应状态: ${response.status} (${fullName})`)

      if (response.status === 200) {
        const content = await response.text()
        console.log(`[GithubApi] README 获取成功: ${fullName}, 大小=${content.length} 字符`)
        return content
      }

      if (response.status === 404) {
        console.log(`[GithubApi] 仓库 ${fullName} 没有 README 文件`)
        return null
      }

      if (response.status === 403) {
        console.error(`[GithubApi] README API 限流: ${fullName}`)
        throw new Error('GitHub API rate limited')
      }

      const errorBody = await response.text().catch(() => '(无法读取响应体)')
      console.error(`[GithubApi] README 请求失败: ${fullName}, status=${response.status}, body=${errorBody.substring(0, 300)}`)
      throw new Error(`GitHub API error: ${response.status}`)
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('GitHub API')) {
        throw err // 重新抛出已知错误
      }
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[GithubApi] README 请求异常: ${fullName}, ${msg}`)
      throw new Error(`GitHub API 网络错误: ${msg}`)
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
  async searchRepos(
    query: string,
    sort: string = 'stars',
    order: string = 'desc',
    perPage: number = 10,
  ): Promise<any[]> {
    const token = this.config.getValueDefault('github.token', '')

    console.log(`[GithubApi] 搜索仓库: q="${query}", sort=${sort}, order=${order}, perPage=${perPage}`)

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GithubStars-Search',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const params = new URLSearchParams({
      q: query,
      sort,
      order,
      per_page: String(perPage),
    })

    const url = `${GITHUB_API}/search/repositories?${params}`

    try {
      const response = await fetch(url, { headers })

      console.log(`[GithubApi] 搜索响应状态: ${response.status}`)

      if (response.status === 200) {
        const data = (await response.json()) as any
        const items = (data.items || []) as any[]
        console.log(`[GithubApi] 搜索结果: 共${data.total_count || 0}个, 返回${items.length}个`)
        return items
      }

      if (response.status === 403) {
        console.error('[GithubApi] 搜索 API 限流')
        this.logger.warn('GitHub API rate limited')
      } else {
        const errorBody = await response.text().catch(() => '')
        console.error(`[GithubApi] 搜索失败: status=${response.status}, body=${errorBody.substring(0, 300)}`)
      }
      return []
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[GithubApi] 搜索请求异常: ${msg}`)
      return []
    }
  }

  /**
   * 构建 clone URL
   *
   * 如果配置了 clone.proxy.url，则拼接代理前缀；
   * 否则直接返回 htmlUrl + ".git"。
   */
  buildCloneUrl(htmlUrl: string): string {
    const proxyUrl = this.config.getValueDefault('clone.proxy.url', '')
    if (proxyUrl) {
      const sep = proxyUrl.endsWith('/') ? '' : '/'
      return `${proxyUrl}${sep}${htmlUrl}`
    }
    return htmlUrl + '.git'
  }

  // ============================================================
  // 内部工具方法
  // ============================================================

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
   */
  private mapStarredItem(item: Record<string, any>): MappedRepoData | null {
    const repo = item.repo || {}
    if (!repo || !repo.full_name) {
      return null // 无效数据，跳过
    }

    const owner = repo.owner || {}
    const license = repo.license || {}

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
    }
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
    const links: PaginationLinks = {}

    if (!linkHeader || linkHeader.trim() === '') {
      return links
    }

    // 按逗号分割每个 link 条目
    const parts = linkHeader.split(',')

    for (const part of parts) {
      const trimmed = part.trim()
      // 匹配 <url>; rel="type" 的格式
      const match = trimmed.match(/<([^>]+)>;\s*rel="([^"]+)"/)
      if (!match) {
        console.log(`[GithubApi] Link header 中存在无法解析的条目: "${trimmed}"`)
        continue
      }

      const url = match[1]
      const rel = match[2].toLowerCase()

      switch (rel) {
        case 'first':
          links.first = url
          break
        case 'prev':
          links.prev = url
          break
        case 'next':
          links.next = url
          break
        case 'last':
          links.last = url
          break
        default:
          // 忽略不认识的 rel（如 "prev" 在某些版本中拼写不同）
          break
      }
    }

    return links
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
        const url = new URL(links.last)
        const pageParam = url.searchParams.get('page')
        if (pageParam) {
          const total = parseInt(pageParam, 10)
          if (!isNaN(total) && total > 0) {
            return total
          }
        }
      } catch {
        // URL 格式异常，忽略
      }
    }

    // 没有 next 也没有 last：只有一页
    if (!links.next) {
      return currentPage
    }

    // 有 next 但没有 last：无法确定总页数
    return currentPage
  }

  /**
   * Promise 延迟工具，用于 API 速率限制保护
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
