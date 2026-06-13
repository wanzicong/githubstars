import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { GithubRepoService } from '../../github/services/github-repo.service'
import { TranslateService } from './translate.service'

const MAX_RETRIES = 3
const MAX_CONCURRENT = 10

@Injectable()
export class TranslateTaskService {
  private readonly logger = new Logger(TranslateTaskService.name)
  private semaphore = 0
  private waitQueue: Array<() => void> = []

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubRepo: GithubRepoService,
    private readonly translate: TranslateService,
  ) {}

  private acquire(): Promise<void> {
    return new Promise(resolve => {
      if (this.semaphore < MAX_CONCURRENT) { this.semaphore++; resolve() }
      else this.waitQueue.push(() => { this.semaphore++; resolve() })
    })
  }
  private release() { this.semaphore--; this.waitQueue.shift()?.() }

  private async cleanOld() {
    const old = await this.prisma.translationTask.findMany({ where: { status: { in: ['COMPLETED', 'FAILED'] } }, orderBy: { createdAt: 'desc' }, skip: 10, take: 1000, select: { id: true } })
    for (const t of old) { await this.prisma.translationTaskItem.deleteMany({ where: { taskId: t.id } }); await this.prisma.translationTask.delete({ where: { id: t.id } }) }
  }

  private async processItem(item: any) {
    await this.acquire()
    try {
      let success = false, retries = 0, lastError = ''
      while (retries <= MAX_RETRIES && !success) {
        if (retries > 0) await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000))
        await this.prisma.translationTaskItem.update({ where: { id: item.id }, data: { status: 'PROCESSING' } })
        try {
          const repoId = Number(item.repoId)
          if (item.translateType === 'description') { const r = await this.translate.translateDescription(repoId); if (r !== null) success = true; else lastError = '翻译返回空结果' }
          else { const r = await this.translate.translateReadme(repoId); if (r !== null) success = true; else lastError = '翻译返回空结果' }
        } catch (e) { lastError = e instanceof Error ? e.message : String(e); this.logger.error(`翻译失败 r${retries}: ${lastError}`) }
        if (!success) retries++
      }
      if (success) {
        await this.prisma.translationTaskItem.update({ where: { id: item.id }, data: { status: 'SUCCESS', updatedAt: new Date() } })
        const task = await this.prisma.translationTask.findUnique({ where: { id: item.taskId } })
        if (task) {
          const upd: any = { completedItems: (task.completedItems || 0) + 1 }
          if (item.translateType === 'description') upd.descCompleted = (task.descCompleted || 0) + 1
          else upd.readmeCompleted = (task.readmeCompleted || 0) + 1
          await this.prisma.translationTask.update({ where: { id: item.taskId }, data: upd })
        }
      } else {
        await this.prisma.translationTaskItem.update({ where: { id: item.id }, data: { status: 'FAILED', errorMessage: lastError, retryCount: retries, updatedAt: new Date() } })
        const task = await this.prisma.translationTask.findUnique({ where: { id: item.taskId } })
        if (task) {
          const upd: any = { failedItems: (task.failedItems || 0) + 1 }
          if (item.translateType === 'description') upd.descFailed = (task.descFailed || 0) + 1
          else upd.readmeFailed = (task.readmeFailed || 0) + 1
          await this.prisma.translationTask.update({ where: { id: item.taskId }, data: upd })
        }
      }
    } finally { this.release() }
  }

  private startTaskAsync(taskId: bigint) {
    ;(async () => {
      const task = await this.prisma.translationTask.findUnique({ where: { id: taskId } })
      if (!task) return
      await this.prisma.translationTask.update({ where: { id: taskId }, data: { status: 'PROCESSING' } })
      const items = await this.prisma.translationTaskItem.findMany({ where: { taskId, status: 'PENDING' } })
      await Promise.all(items.map(i => this.processItem(i)))
      await this.prisma.translationTask.update({ where: { id: taskId }, data: { status: 'COMPLETED', finishedAt: new Date() } })
    })().catch(e => this.logger.error(e))
  }

  async createAndStartSingleReadme(repoId: number) {
    const repo = await this.githubRepo.findById(repoId)
    if (!repo) return null
    const task = await this.prisma.translationTask.create({ data: { status: 'PENDING', totalItems: 1, readmeTotal: 1, createdAt: new Date() } })
    await this.prisma.translationTaskItem.create({ data: { taskId: task.id, repoId: BigInt(repoId), fullName: repo.fullName, translateType: 'readme', status: 'PENDING', retryCount: 0, createdAt: new Date() } })
    this.startTaskAsync(task.id); return Number(task.id)
  }

  async createAndStartSingleReadmeForce(repoId: number) {
    await this.prisma.githubRepo.update({ where: { id: BigInt(repoId) }, data: { readmeFetched: false, readmeOriginal: null, readmeCn: null } })
    return this.createAndStartSingleReadme(repoId)
  }

  async createAndStartReadmeBatch() {
    await this.cleanOld()
    const all = await this.githubRepo.findAll({})
    const need = all.filter((r: any) => !r.readmeCn)
    if (!need.length) return null
    const task = await this.prisma.translationTask.create({ data: { status: 'PENDING', totalItems: need.length, readmeTotal: need.length, createdAt: new Date() } })
    await this.prisma.translationTaskItem.createMany({ data: need.map((r: any) => ({ taskId: task.id, repoId: r.id, fullName: r.fullName, translateType: 'readme', status: 'PENDING', retryCount: 0, createdAt: new Date() })) })
    this.startTaskAsync(task.id); return Number(task.id)
  }

  async createAndStartFullTranslate() {
    await this.cleanOld()
    const all = await this.githubRepo.findAll({})
    const needDesc = all.filter((r: any) => r.description && !r.descriptionCn)
    const needReadme = all.filter((r: any) => !r.readmeFetched)
    if (!needDesc.length && !needReadme.length) return null
    const task = await this.prisma.translationTask.create({ data: { status: 'PENDING', totalItems: needDesc.length + needReadme.length, descTotal: needDesc.length, readmeTotal: needReadme.length, createdAt: new Date() } })
    const descItems = needDesc.map((r: any) => ({ taskId: task.id, repoId: r.id, fullName: r.fullName, translateType: 'description', status: 'PENDING', retryCount: 0, createdAt: new Date() }))
    const readmeItems = needReadme.map((r: any) => ({ taskId: task.id, repoId: r.id, fullName: r.fullName, translateType: 'readme', status: 'PENDING', retryCount: 0, createdAt: new Date() }))
    await this.prisma.translationTaskItem.createMany({ data: [...descItems, ...readmeItems] })
    this.startTaskAsync(task.id); return Number(task.id)
  }

  /** P0-3 FIX: FilterBatch translateType 必须是 'readme' */
  async createAndStartFilterBatch(params: {
    keyword?: string; language?: string; categoryIds?: string; sortBy?: string; sortOrder?: string
    dateField?: string; startDate?: string; endDate?: string
  }) {
    await this.cleanOld()
    const result = await this.githubRepo.findPage({ ...params, page: 1, size: 10000, untranslatedOnly: true })
    const repos = result.records as any[]
    if (!repos.length) return null

    const task = await this.prisma.translationTask.create({ data: { status: 'PENDING', totalItems: repos.length, readmeTotal: repos.length, descTotal: 0, createdAt: new Date() } })
    await this.prisma.translationTaskItem.createMany({ data: repos.map((r: any) => ({ taskId: task.id, repoId: r.id, fullName: r.fullName, translateType: 'readme', status: 'PENDING', retryCount: 0, createdAt: new Date() })) })
    this.startTaskAsync(task.id); return Number(task.id)
  }

  async getTaskProgress(taskId: number) {
    const task = await this.prisma.translationTask.findUnique({ where: { id: BigInt(taskId) } })
    if (!task) return { success: false, message: '任务不存在' }
    const total = task.totalItems
    return { success: true, taskId: Number(task.id), status: task.status, totalItems: total, completedItems: task.completedItems, failedItems: task.failedItems, descTotal: task.descTotal, descCompleted: task.descCompleted, descFailed: task.descFailed, readmeTotal: task.readmeTotal, readmeCompleted: task.readmeCompleted, readmeFailed: task.readmeFailed, createdAt: task.createdAt?.toISOString(), finishedAt: task.finishedAt?.toISOString(), progress: total > 0 ? Math.round(((task.completedItems + task.failedItems) * 100) / total) : 0 }
  }

  async retryFailed(taskId: number) {
    const items = await this.prisma.translationTaskItem.findMany({ where: { taskId: BigInt(taskId), status: 'FAILED' } })
    if (!items.length) return null
    const task = await this.prisma.translationTask.create({ data: { status: 'PENDING', totalItems: items.length, descTotal: items.filter(i => i.translateType === 'description').length, readmeTotal: items.filter(i => i.translateType === 'readme').length, createdAt: new Date() } })
    await this.prisma.translationTaskItem.createMany({ data: items.map(i => ({ taskId: task.id, repoId: i.repoId, fullName: i.fullName, translateType: i.translateType, status: 'PENDING', retryCount: 0, createdAt: new Date() })) })
    this.startTaskAsync(task.id); return Number(task.id)
  }

  async getFailures(taskId: number) {
    const items = await this.prisma.translationTaskItem.findMany({ where: { taskId: BigInt(taskId), status: 'FAILED' } })
    return { success: true, failures: items, count: items.length }
  }

  async getRecentTasks() {
    const tasks = await this.prisma.translationTask.findMany({ orderBy: { createdAt: 'desc' }, take: 10 })
    return { success: true, tasks: tasks.map(t => ({ taskId: Number(t.id), status: t.status, totalItems: t.totalItems, completedItems: t.completedItems, failedItems: t.failedItems, createdAt: t.createdAt?.toISOString() })) }
  }
}
