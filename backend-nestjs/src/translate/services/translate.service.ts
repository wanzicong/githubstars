import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '../../config/config.service'
import { GithubApiService } from '../../github/services/github-api.service'
import { GithubRepoService } from '../../github/services/github-repo.service'

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly githubApi: GithubApiService,
    private readonly githubRepo: GithubRepoService,
  ) {}

  /** P1-FIX: 添加 120s 超时 + 429 限流识别 */
  private async callDeepSeek(text: string, isReadme: boolean): Promise<string | null> {
    const apiKey = this.config.getValue('deepseek.api_key')
    const apiUrl = this.config.getValueDefault('deepseek.api_url', 'https://api.deepseek.com/v1/chat/completions')
    const model = this.config.getValueDefault('deepseek.model', 'deepseek-chat')
    if (!apiKey) { this.logger.error('DeepSeek API Key 未配置'); return null }

    const prompt = isReadme
      ? `你是一个专业的技术文档翻译专家。请将以下 GitHub 项目的 README 文档翻译成中文。

翻译要求：
1. 保持 Markdown 格式完整，包括标题、列表、表格、代码块等所有格式标记
2. 代码块内的代码、命令、配置等不翻译，保持原样
3. 技术术语保留原文（如 API、SDK、CLI、JSON 等），或在中译词后括号标注原文
4. URL 链接不翻译
5. 图片 alt 文本不翻译
6. Badge 标记不翻译
7. HTML 标签保留
8. 表格内容只翻译文字部分，代码/链接等保持原样
9. 保持原文的换行和段落结构
10. 整体语言通顺，符合中文技术文档的表达习惯

【重要】只返回翻译结果，不要加任何前缀（如"翻译结果："）、后缀（如"以上是翻译"）或解释说明。

---

请翻译以下 README 内容：`
      : `你是一个专业的技术翻译专家。请将以下 GitHub 项目描述翻译成简洁准确的中文。如果原文包含技术术语，请保留并在必要时用括号标注原文。

【重要】只返回翻译结果，不要加任何前缀后缀或解释。

---

请翻译以下内容：`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000) // 120s 超时

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, temperature: 0.3, max_tokens: isReadme ? 32768 : 1024, messages: [{ role: 'user', content: prompt + '\n\n' + text }] }),
        signal: controller.signal,
      })
      if (res.status === 429) { this.logger.warn('DeepSeek API 限流 (429)，需等待'); return '__RATE_LIMITED__' as any }
      if (!res.ok) { this.logger.error(`DeepSeek API ${res.status}`); return null }
      const data = await res.json() as any
      return data.choices?.[0]?.message?.content?.trim() || null
    } catch (e) {
      if ((e as Error).name === 'AbortError') { this.logger.error('DeepSeek 调用超时 (120s)'); return null }
      this.logger.error('DeepSeek 调用失败', e)
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  async translateDescription(repoId: number): Promise<string | null> {
    const repo = await this.githubRepo.findById(repoId)
    if (!repo) return null
    if (repo.descriptionCn) return repo.descriptionCn  // 幂等
    if (!repo.description) return null
    const result = await this.callDeepSeek(repo.description, false)
    if (result && result !== '__RATE_LIMITED__') {
      await this.prisma.githubRepo.update({ where: { id: BigInt(repoId) }, data: { descriptionCn: result, updatedAt: new Date() } })
    }
    return result === '__RATE_LIMITED__' ? null : result
  }

  /**
   * P0-FIX: 翻译 README
   * - 如果 original 已获取但翻译失败 → 跳过 GitHub 请求，直接重试翻译
   * - 翻译失败时不永久标记 readmeFetched
   */
  async translateReadme(repoId: number): Promise<string | null> {
    const repo = await this.githubRepo.findById(repoId)
    if (!repo) return null

    // 已成功翻译过 → 直接返回缓存
    if (repo.readmeFetched && repo.readmeCn) return repo.readmeCn

    // 已获取原始内容但翻译失败/未翻译 → 直接重试翻译（节省 GitHub API 调用）
    if (repo.readmeOriginal && !repo.readmeCn) {
      this.logger.log(`重试翻译 README: ${repo.fullName} (复用已获取的原始内容)`)
      const result = await this.callDeepSeek(repo.readmeOriginal, true)
      if (result && result !== '__RATE_LIMITED__') {
        await this.prisma.githubRepo.update({ where: { id: BigInt(repoId) }, data: { readmeCn: result, readmeFetched: true, updatedAt: new Date() } })
      }
      return result === '__RATE_LIMITED__' ? null : result
    }

    // 404 过 → 没有 README
    if (repo.readmeFetched && !repo.readmeOriginal && !repo.readmeCn) return ''

    // 首次获取 README
    let content: string | null = null
    try {
      content = await this.githubApi.fetchReadmeFromGitHub(repo.fullName!)
    } catch (e) {
      // 网络/限流异常 → 抛出让上层重试
      throw e
    }

    if (content === null) {
      // 404: 仓库没有 README
      await this.prisma.githubRepo.update({ where: { id: BigInt(repoId) }, data: { readmeFetched: true, readmeCn: null, updatedAt: new Date() } })
      return ''
    }

    // 保存原始内容（先不标记 fetched，等翻译成功再标记）
    await this.prisma.githubRepo.update({ where: { id: BigInt(repoId) }, data: { readmeOriginal: content, updatedAt: new Date() } })

    const result = await this.callDeepSeek(content, true)
    if (result && result !== '__RATE_LIMITED__') {
      // 翻译成功 → 保存结果 + 标记 fetched
      await this.prisma.githubRepo.update({ where: { id: BigInt(repoId) }, data: { readmeCn: result, readmeFetched: true, updatedAt: new Date() } })
      return result
    }

    // 翻译失败 → 不标记 fetched，允许下次重试
    this.logger.warn(`README 翻译失败: ${repo.fullName}，原始内容已保存，可稍后重试`)
    return null
  }

  async translateReadmeForce(repoId: number): Promise<string | null> {
    const repo = await this.githubRepo.findById(repoId)
    if (!repo) return null
    const content = await this.githubApi.fetchReadmeFromGitHub(repo.fullName!)
    if (content === null) {
      await this.prisma.githubRepo.update({ where: { id: BigInt(repoId) }, data: { readmeFetched: true, readmeCn: null, readmeOriginal: null, updatedAt: new Date() } })
      return ''
    }
    await this.prisma.githubRepo.update({ where: { id: BigInt(repoId) }, data: { readmeOriginal: content, updatedAt: new Date() } })
    const result = await this.callDeepSeek(content, true)
    if (result && result !== '__RATE_LIMITED__') {
      await this.prisma.githubRepo.update({ where: { id: BigInt(repoId) }, data: { readmeCn: result, readmeFetched: true, updatedAt: new Date() } })
      return result
    }
    return null
  }

  async translateDescriptionsBatch(repoIds?: number[]): Promise<number> {
    let repos: Array<{ id: bigint; description: string | null }>
    if (repoIds?.length) {
      repos = await this.prisma.githubRepo.findMany({ where: { id: { in: repoIds.map(BigInt) } }, select: { id: true, description: true } })
    } else {
      repos = await this.prisma.githubRepo.findMany({
        where: { description: { not: null }, AND: [{ description: { not: '' } }, { OR: [{ descriptionCn: null }, { descriptionCn: '' }] }] },
        select: { id: true, description: true }, take: 100,
      })
    }
    let count = 0
    for (const r of repos) {
      try {
        if (!r.description) continue
        const result = await this.callDeepSeek(r.description, false)
        if (result && result !== '__RATE_LIMITED__') { await this.prisma.githubRepo.update({ where: { id: r.id }, data: { descriptionCn: result, updatedAt: new Date() } }); count++ }
      } catch (e) { this.logger.error(`翻译描述失败 ${r.id}`) }
    }
    return count
  }

  /** 获取筛选条件下的翻译覆盖统计 */
  async getTranslationSummary(params: {
    keyword?: string; language?: string; categoryIds?: string; dateField?: string; startDate?: string; endDate?: string; untranslatedOnly?: boolean
  }) {
    // 复用 findPage 获取符合条件的仓库总数和翻译状态
    const result = await this.githubRepo.findPage({ ...params, page: 1, size: 1 })
    const total = result.total

    // 统计描述翻译覆盖
    const descResult = await this.githubRepo.findPage({ ...params, page: 1, size: 1 })
    const withDescCn = await this.prisma.githubRepo.count({
      where: { descriptionCn: { not: null }, AND: [{ descriptionCn: { not: '' } }] },
    })

    const withReadmeCn = await this.prisma.githubRepo.count({
      where: { readmeCn: { not: null }, AND: [{ readmeCn: { not: '' } }] },
    })

    return {
      total,
      descCompleted: withDescCn,
      descPending: total - withDescCn,
      readmeCompleted: withReadmeCn,
      readmePending: total - withReadmeCn,
    }
  }
}
