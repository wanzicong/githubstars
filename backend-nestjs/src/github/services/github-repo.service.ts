import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'

const SORT_MAP: Record<string, string> = {
  stars_count: 'starsCount', forks_count: 'forksCount',
  repo_updated_at: 'repoUpdatedAt', repo_created_at: 'repoCreatedAt',
  repo_pushed_at: 'repoPushedAt', starred_at: 'starredAt',
}
const DATE_MAP: Record<string, string> = {
  starred_at: 'starredAt', repo_created_at: 'repoCreatedAt',
  repo_updated_at: 'repoUpdatedAt', repo_pushed_at: 'repoPushedAt',
}

@Injectable()
export class GithubRepoService {
  constructor(private readonly prisma: PrismaService) {}

  private async expandCategoryIds(str: string): Promise<number[]> {
    if (!str) return []
    const ids = str.split(',').map(Number).filter(n => !isNaN(n))
    if (ids.length === 0) return []
    const result: number[] = []
    for (const id of ids) {
      const cat = await this.prisma.category.findUnique({ where: { id: BigInt(id) } })
      if (cat?.level === 1) {
        const children = await this.prisma.category.findMany({ where: { parentId: BigInt(id) }, select: { id: true } })
        result.push(...(children.length > 0 ? children.map(c => Number(c.id)) : [id]))
      } else result.push(id)
    }
    return result
  }

  private buildWhere(params: {
    keyword?: string; languages?: string[]; categoryIds?: number[]
    dateField?: string; startDate?: string; endDate?: string; untranslatedOnly?: boolean
  }): Prisma.GithubRepoWhereInput {
    const AND: Prisma.GithubRepoWhereInput[] = []
    if (params.categoryIds?.length) {
      AND.push({ repoCategories: { some: { categoryId: { in: params.categoryIds.map(BigInt) } } } })
    }
    if (params.keyword?.trim()) {
      const kw = params.keyword.trim()
      AND.push({ OR: [{ repoName: { contains: kw } }, { description: { contains: kw } }, { ownerName: { contains: kw } }, { fullName: { contains: kw } }] })
    }
    if (params.languages?.length && !params.languages.includes('')) {
      AND.push({ language: { in: params.languages } })
    }
    if (params.untranslatedOnly) {
      AND.push({ OR: [{ readmeCn: null }, { readmeCn: '' }] })
    }
    if (params.dateField && DATE_MAP[params.dateField] && (params.startDate || params.endDate)) {
      const f = DATE_MAP[params.dateField]
      const cond: any = {}
      if (params.startDate) cond.gte = new Date(params.startDate + 'T00:00:00+08:00')
      if (params.endDate) cond.lte = new Date(params.endDate + 'T23:59:59+08:00')
      AND.push({ [f]: cond } as any)
    }
    return AND.length > 0 ? { AND } : {}
  }

  async findPage(params: {
    page?: number; size?: number; keyword?: string; language?: string
    categoryIds?: string; sortBy?: string; sortOrder?: string
    dateField?: string; startDate?: string; endDate?: string; untranslatedOnly?: boolean
  }) {
    const page = params.page || 1, size = params.size || 12
    const languages = params.language ? params.language.split(',').filter(Boolean) : []
    const catIds = await this.expandCategoryIds(params.categoryIds || '')
    const sortField = SORT_MAP[params.sortBy || 'starred_at'] || 'starredAt'
    const sortDir = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
    const where = this.buildWhere({ keyword: params.keyword, languages: languages.length > 0 ? languages : undefined, categoryIds: catIds.length > 0 ? catIds : undefined, dateField: params.dateField, startDate: params.startDate, endDate: params.endDate, untranslatedOnly: params.untranslatedOnly })
    const [total, records] = await Promise.all([
      this.prisma.githubRepo.count({ where }),
      this.prisma.githubRepo.findMany({ where, orderBy: { [sortField]: sortDir }, skip: (page - 1) * size, take: size }),
    ])
    await this.fillCategoryNames(records)
    // 附加翻译状态（前端列表可直接展示翻译徽标）
    const enriched = records.map(r => ({
      ...r,
      translationStatus: {
        description: r.descriptionCn ? 'completed' : (r.description ? 'pending' : 'none'),
        readme: r.readmeCn ? 'completed' : (r.readmeFetched ? 'none' : 'pending'),
      },
    }))
    return { records: enriched, total, size, current: page, pages: Math.ceil(total / size) }
  }

  async findById(id: number) {
    const repo = await this.prisma.githubRepo.findUnique({ where: { id: BigInt(id) } })
    if (!repo) return null
    const result = { ...repo, categoryNames: [] as string[] }
    await this.fillCategoryNames([result])
    return result
  }

  async findAllUrls(params: {
    keyword?: string; language?: string; categoryIds?: string
    sortBy?: string; sortOrder?: string; dateField?: string; startDate?: string; endDate?: string
  }) {
    const languages = params.language ? params.language.split(',').filter(Boolean) : []
    const catIds = await this.expandCategoryIds(params.categoryIds || '')
    const sortField = SORT_MAP[params.sortBy || 'starred_at'] || 'starredAt'
    const sortDir = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
    const where = this.buildWhere({ keyword: params.keyword, languages: languages.length > 0 ? languages : undefined, categoryIds: catIds.length > 0 ? catIds : undefined, dateField: params.dateField, startDate: params.startDate, endDate: params.endDate })
    const repos = await this.prisma.githubRepo.findMany({ where, select: { htmlUrl: true }, orderBy: { [sortField]: sortDir } })
    return repos.map(r => r.htmlUrl).filter(Boolean) as string[]
  }

  async findAll(params: { keyword?: string; language?: string; sortBy?: string; sortOrder?: string }) {
    const languages = params.language ? params.language.split(',').filter(Boolean) : []
    const sortField = SORT_MAP[params.sortBy || 'starred_at'] || 'starredAt'
    const sortDir = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
    const where = this.buildWhere({ keyword: params.keyword, languages: languages.length > 0 ? languages : undefined })
    return this.prisma.githubRepo.findMany({ where, orderBy: { [sortField]: sortDir } })
  }

  /** P0-16 FIX: 使用 INSERT ON DUPLICATE KEY UPDATE (单次 DB 往返) */
  async upsertRepo(data: any) {
    await this.prisma.$executeRaw`
      INSERT INTO github_repo (repo_name, full_name, description, language, owner_name, owner_avatar_url, html_url, homepage,
        stars_count, forks_count, watchers_count, open_issues_count, topics, license_name, is_fork, is_archived,
        repo_created_at, repo_updated_at, repo_pushed_at, starred_at, created_at, updated_at, description_cn, readme_cn, readme_original, readme_fetched)
      VALUES (${data.repoName || ''}, ${data.fullName || ''}, ${data.description}, ${data.language}, ${data.ownerName},
        ${data.ownerAvatarUrl}, ${data.htmlUrl}, ${data.homepage}, ${data.starsCount || 0}, ${data.forksCount || 0},
        ${data.watchersCount || 0}, ${data.openIssuesCount || 0}, ${data.topics || '[]'}, ${data.licenseName},
        ${data.isFork ? 1 : 0}, ${data.isArchived ? 1 : 0}, ${data.repoCreatedAt}, ${data.repoUpdatedAt},
        ${data.repoPushedAt}, ${data.starredAt}, ${data.createdAt || new Date()}, ${data.updatedAt || new Date()},
        ${data.descriptionCn || null}, ${data.readmeCn || null}, ${data.readmeOriginal || null}, ${data.readmeFetched ? 1 : 0})
      ON DUPLICATE KEY UPDATE
        repo_name=VALUES(repo_name), description=VALUES(description), language=VALUES(language),
        owner_name=VALUES(owner_name), owner_avatar_url=VALUES(owner_avatar_url), html_url=VALUES(html_url),
        homepage=VALUES(homepage), stars_count=VALUES(stars_count), forks_count=VALUES(forks_count),
        watchers_count=VALUES(watchers_count), open_issues_count=VALUES(open_issues_count), topics=VALUES(topics),
        license_name=VALUES(license_name), is_fork=VALUES(is_fork), is_archived=VALUES(is_archived),
        repo_created_at=VALUES(repo_created_at), repo_updated_at=VALUES(repo_updated_at),
        repo_pushed_at=VALUES(repo_pushed_at), starred_at=VALUES(starred_at), updated_at=VALUES(updated_at)
    `
  }

  async count(): Promise<number> {
    return this.prisma.githubRepo.count()
  }

  async fillCategoryNames(repos: Array<{ id: bigint; categoryNames?: string[] }>) {
    if (!repos.length) return
    const ids = repos.map(r => r.id)
    const mappings = await this.prisma.repoCategory.findMany({
      where: { repoId: { in: ids } }, include: { category: { select: { name: true } } },
    })
    const map = new Map<bigint, string[]>()
    for (const m of mappings) {
      const list = map.get(m.repoId) || []
      list.push(m.category.name)
      map.set(m.repoId, list)
    }
    for (const r of repos) r.categoryNames = map.get(r.id) || []
  }
}
