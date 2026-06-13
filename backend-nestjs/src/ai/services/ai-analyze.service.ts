import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '../../config/config.service'

const MAX_REPOS = 30

@Injectable()
export class AiAnalyzeService implements OnModuleInit {
  private readonly logger = new Logger(AiAnalyzeService.name)
  private counter = 0

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** 从数据库恢复 counter（避免重启后 ID 冲突） */
  async onModuleInit() {
    const latest = await this.prisma.aiAnalyzeTask.findFirst({
      where: { taskId: { startsWith: 'analyze_' } },
      orderBy: { createdAt: 'desc' },
      select: { taskId: true },
    })
    if (latest) {
      const match = latest.taskId.match(/analyze_(\d+)/)
      if (match) this.counter = parseInt(match[1], 10)
    }
  }

  private async queryRepos(params: { keyword?: string; language?: string; categoryIds?: string; sortBy?: string; sortOrder?: string }) {
    const AND: any[] = []
    if (params.categoryIds) {
      const ids = params.categoryIds.split(',').map(Number).filter(n => !isNaN(n)).map(BigInt)
      AND.push({ repoCategories: { some: { categoryId: { in: ids } } } })
    }
    if (params.keyword) {
      const kw = params.keyword
      AND.push({ OR: [{ repoName: { contains: kw } }, { description: { contains: kw } }, { ownerName: { contains: kw } }, { fullName: { contains: kw } }] })
    }
    if (params.language) {
      const langs = params.language.split(',').filter(Boolean)
      if (langs.length) AND.push({ language: { in: langs } })
    }
    const where: any = AND.length ? { AND } : {}
    const sortField = params.sortBy === 'stars_count' ? 'starsCount' : params.sortBy === 'forks_count' ? 'forksCount' : 'starredAt'
    const sortDir = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
    return this.prisma.githubRepo.findMany({ where, orderBy: { [sortField]: sortDir }, take: MAX_REPOS })
  }

  private buildAnalyzePrompt(repos: any[]) {
    let list = ''
    repos.forEach((r, i) => {
      const desc = String((r.descriptionCn || r.description || '')).substring(0, 200)
      const readme = String((r.readmeCn || r.readmeOriginal || '')).substring(0, 200)
      list += `${i + 1}. **${r.repoName || r.fullName}** (${r.language || '未知'}, ⭐${r.starsCount}, Fork:${r.forksCount})\n`
      list += `   描述: ${desc}\n`
      if (readme) list += `   README: ${readme}\n`
      list += '\n'
    })
    return `请分析以下 GitHub 项目集合：

${list}

请输出结构化报告：1.总体概览 2.技术栈分析 3.应用场景分类 4.热门项目TOP5 5.趋势与洞察 6.总结建议

【重要】用中文输出，直接开始正文，不要加开头语（如"好的"）或结尾语（如"以上是分析"）。`
  }

  private async callDeepSeek(prompt: string): Promise<string | null> {
    const apiKey = this.config.getValue('deepseek.api_key')
    const apiUrl = this.config.getValueDefault('deepseek.api_url', 'https://api.deepseek.com/v1/chat/completions')
    const model = this.config.getValueDefault('deepseek.model', 'deepseek-chat')
    if (!apiKey) return 'DeepSeek API Key 未配置'
    try {
      const res = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, temperature: 0.3, max_tokens: 32768, messages: [{ role: 'system', content: '你是专业的代码分析师。' }, { role: 'user', content: prompt }] }),
      })
      if (!res.ok) return `AI 服务异常 (${res.status})`
      const data = await res.json() as any
      return data.choices?.[0]?.message?.content?.trim() || null
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return msg.includes('timeout') ? '分析超时' : 'AI 异常: ' + msg
    }
  }

  private async executeAnalyze(
    taskId: string, keyword: string, language: string,
    categoryIds: string, sortBy: string, sortOrder: string,
  ) {
    try {
      const repos = await this.queryRepos({ keyword, language, categoryIds, sortBy, sortOrder })
      if (!repos.length) {
        await this.prisma.aiAnalyzeTask.update({
          where: { taskId },
          data: { status: 'COMPLETED', content: '没有找到任何项目', finishedAt: new Date() },
        })
        return
      }
      const prompt = this.buildAnalyzePrompt(repos)
      const result = await this.callDeepSeek(prompt)
      await this.prisma.aiAnalyzeTask.update({
        where: { taskId },
        data: { status: 'COMPLETED', content: result || 'AI 返回空结果', finishedAt: new Date() },
      })
    } catch (e) {
      await this.prisma.aiAnalyzeTask.update({
        where: { taskId },
        data: { status: 'COMPLETED', content: '分析失败: ' + (e instanceof Error ? e.message : String(e)), finishedAt: new Date() },
      })
    }
  }

  async createAnalyzeTask(keyword: string, language: string, categoryIds: string, sortBy: string, sortOrder: string) {
    const taskId = 'analyze_' + (++this.counter)
    await this.prisma.aiAnalyzeTask.create({
      data: {
        taskId, type: 'analyze', status: 'PROCESSING',
        params: JSON.stringify({ keyword, language, categoryIds, sortBy, sortOrder }),
        createdAt: new Date(),
      },
    })
    this.executeAnalyze(taskId, keyword, language, categoryIds, sortBy, sortOrder)
      .catch(e => this.logger.error('分析任务执行失败', e))
    return taskId
  }

  async createTrendingAnalyzeTask(since: string, language: string, repos: any[]) {
    const taskId = 'trending_' + (++this.counter)
    const period = { daily: '今日', weekly: '本周', monthly: '本月' }[since] || since

    if (!repos.length) {
      await this.prisma.aiAnalyzeTask.create({
        data: { taskId, type: 'trending', status: 'COMPLETED', content: '暂无数据', createdAt: new Date(), finishedAt: new Date() },
      })
      return taskId
    }

    await this.prisma.aiAnalyzeTask.create({
      data: {
        taskId, type: 'trending', status: 'PROCESSING',
        params: JSON.stringify({ since, language }),
        createdAt: new Date(),
      },
    })

    const list = repos.map((r: any, i: number) => `${i + 1}. **${r.fullName}** (⭐${r.starsCount}, ${r.language || '未知'})`).join('\n')
    const prompt = `分析 GitHub ${period}趋势：\n\n${language ? '语言: ' + language + '\n' : ''}${list}\n\n分析热门方向、用途分类、最值得关注的3个项目、趋势洞察。\n\n【重要】直接开始正文，不要加开头语或结尾语。`

    ;(async () => {
      try {
        const r = await this.callDeepSeek(prompt)
        await this.prisma.aiAnalyzeTask.update({
          where: { taskId },
          data: { status: 'COMPLETED', content: r || '分析失败', finishedAt: new Date() },
        })
      } catch (e) {
        await this.prisma.aiAnalyzeTask.update({
          where: { taskId },
          data: { status: 'COMPLETED', content: '分析失败', finishedAt: new Date() },
        })
      }
    })().catch(e => this.logger.error('趋势分析任务失败', e))

    return taskId
  }

  /** P0 FIX: 从数据库读取任务状态 */
  async getTaskStatus(taskId: string) {
    const task = await this.prisma.aiAnalyzeTask.findUnique({ where: { taskId } })
    if (!task) return { success: false, taskId, status: 'NOT_FOUND' }
    return {
      success: true,
      taskId: task.taskId,
      status: task.status,
      content: task.status === 'COMPLETED' ? task.content : undefined,
    }
  }
}
