import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { GithubRepoService } from '../github/services/github-repo.service'

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    const all = await this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } })
    const counts = await this.prisma.repoCategory.groupBy({ by: ['categoryId'], _count: { categoryId: true } })
    const countMap = new Map<string, number>()
    for (const r of counts) countMap.set(String(r.categoryId), r._count.categoryId)

    const enriched = all.map(c => ({ ...c, repoCount: countMap.get(String(c.id)) || 0, children: [] as any[] }))
    const parentMap = new Map<bigint, any>()
    for (const c of enriched) parentMap.set(c.id, c)

    const roots: any[] = []
    for (const c of enriched) {
      if (c.level === 2 && c.parentId) {
        const parent = parentMap.get(c.parentId)
        if (parent) parent.children.push(c)
        else roots.push(c)
      } else roots.push(c)
    }
    for (const root of roots) {
      for (const child of root.children) root.repoCount += child.repoCount
    }
    roots.sort((a: any, b: any) => b.repoCount - a.repoCount)
    return roots
  }

  async getById(id: number) { return this.prisma.category.findUnique({ where: { id: BigInt(id) } }) }

  async create(name: string, description?: string, parentId?: number) {
    const trimmed = name.trim()
    const exist = await this.prisma.category.findUnique({ where: { name: trimmed } })
    if (exist) throw new Error('分类名已存在: ' + trimmed)
    return this.prisma.category.create({
      data: { name: trimmed, description: description || null, parentId: parentId ? BigInt(parentId) : null, level: parentId ? 2 : 1, sortOrder: 0, createdAt: new Date() },
    })
  }

  async update(id: number, name: string, description?: string) {
    const cat = await this.prisma.category.findUnique({ where: { id: BigInt(id) } })
    if (!cat) throw new Error('分类不存在')
    return this.prisma.category.update({ where: { id: BigInt(id) }, data: { name: name.trim(), description: description || null, updatedAt: new Date() } })
  }

  async delete(id: number) {
    await this.prisma.repoCategory.deleteMany({ where: { categoryId: BigInt(id) } })
    await this.prisma.category.delete({ where: { id: BigInt(id) } })
  }

  async batchDelete(ids: number[]) { for (const id of ids) await this.delete(id) }

  async moveToParent(id: number, parentId: number) {
    await this.prisma.category.update({ where: { id: BigInt(id) }, data: { parentId: BigInt(parentId), updatedAt: new Date() } })
  }

  async getReposByCategoryId(catId: number) {
    const mappings = await this.prisma.repoCategory.findMany({ where: { categoryId: BigInt(catId) }, select: { repoId: true } })
    if (!mappings.length) return []
    const repos = await this.prisma.githubRepo.findMany({ where: { id: { in: mappings.map(m => m.repoId) } } })
    repos.sort((a, b) => Number(b.starsCount) - Number(a.starsCount))
    return repos
  }

  async getReposByCategoryIdPaged(params: {
    categoryId: number; page?: number; size?: number; keyword?: string; language?: string; sortBy?: string; sortOrder?: string
  }) {
    const page = params.page || 1; const size = params.size || 12
    const mappings = await this.prisma.repoCategory.findMany({ where: { categoryId: BigInt(params.categoryId) }, select: { repoId: true } })
    const repoIds = mappings.map(m => m.repoId)
    if (!repoIds.length) return { records: [], total: 0, size, current: page, pages: 0 }

    const sortField = (params.sortBy === 'stars_count' ? 'starsCount' : params.sortBy === 'forks_count' ? 'forksCount' : params.sortBy === 'repo_updated_at' ? 'repoUpdatedAt' : 'starredAt') as string
    const sortDir = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
    const where: any = { id: { in: repoIds } }
    if (params.keyword) where.OR = [{ repoName: { contains: params.keyword } }, { description: { contains: params.keyword } }, { fullName: { contains: params.keyword } }, { ownerName: { contains: params.keyword } }]
    if (params.language) where.language = { in: params.language.split(',').filter(Boolean) }

    const [total, records] = await Promise.all([
      this.prisma.githubRepo.count({ where }),
      this.prisma.githubRepo.findMany({ where, orderBy: { [sortField]: sortDir }, skip: (page - 1) * size, take: size }),
    ])
    return { records, total, size, current: page, pages: Math.ceil(total / size) }
  }

  async addRepoToCategory(repoId: number, catId: number) {
    await this.prisma.repoCategory.create({ data: { repoId: BigInt(repoId), categoryId: BigInt(catId), createdAt: new Date() } })
  }

  async batchAddRepos(repoIds: number[], catId: number) {
    const cat = await this.prisma.category.findUnique({ where: { id: BigInt(catId) } })
    if (cat?.level === 1) throw new Error('一级分类不能直接包含仓库')
    await this.prisma.repoCategory.createMany({ data: repoIds.map(r => ({ repoId: BigInt(r), categoryId: BigInt(catId), createdAt: new Date() })), skipDuplicates: true })
  }

  async removeRepoFromCategory(repoId: number, catId: number) {
    await this.prisma.repoCategory.deleteMany({ where: { repoId: BigInt(repoId), categoryId: BigInt(catId) } })
  }

  async batchTransferRepos(repoIds: number[], fromId: number, toId: number) {
    for (const r of repoIds) {
      await this.prisma.repoCategory.deleteMany({ where: { repoId: BigInt(r), categoryId: BigInt(fromId) } })
      await this.prisma.repoCategory.create({ data: { repoId: BigInt(r), categoryId: BigInt(toId), createdAt: new Date() } })
    }
  }

  async clearRepoCategories(repoId: number) { await this.prisma.repoCategory.deleteMany({ where: { repoId: BigInt(repoId) } }) }

  async saveAiClassifyResult(cats: Record<string, number[]>) {
    for (const [name, ids] of Object.entries(cats)) {
      if (!ids.length) continue
      let cat = await this.prisma.category.findUnique({ where: { name } })
      if (!cat) cat = await this.create(name)
      for (const r of ids) { await this.clearRepoCategories(r); await this.addRepoToCategory(r, Number(cat.id)) }
    }
  }

  async applySmartClassifyResult(assignments: Record<string, number[]>) {
    for (const [name, ids] of Object.entries(assignments)) {
      if (!ids.length) continue
      let cat = await this.prisma.category.findUnique({ where: { name } })
      if (!cat) { cat = await this.create(name); await this.prisma.category.update({ where: { id: cat.id }, data: { level: 2 } }) }
      for (const r of ids) { await this.clearRepoCategories(r); await this.addRepoToCategory(r, Number(cat.id)) }
    }
  }

  async getUncategorized() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r.* FROM github_repo r LEFT JOIN repo_category rc ON r.id = rc.repo_id WHERE rc.repo_id IS NULL`
    )
  }

  async expandCategoryIds(ids: number[]): Promise<number[]> {
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
}
