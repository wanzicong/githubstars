import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { GithubApiService } from '../github/services/github-api.service'
import { GithubRepoService } from '../github/services/github-repo.service'

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name)
  private syncing = false
  private syncStatus = '空闲'
  private lastSyncTime: Date | null = null
  private lastSyncCount = 0

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubApi: GithubApiService,
    private readonly githubRepo: GithubRepoService,
  ) {}

  /**
   * 执行同步
   * @param syncType 同步类型（手动/定时）
   * @param replace REPLACE 模式开关：true=全量替换（删除已取消Star的仓库），false=仅增量更新（不删除本地已有仓库）
   *
   * 同步锁采用 check-then-set 模式：
   * Node.js 单线程事件循环保证同步代码块原子性，避免 TOCTOU 并发问题。
   */
  async doSync(syncType: string, replace: boolean = true) {
    // 同步锁：原子检查-设置，防止并发 doSync 调用
    if (this.syncing) {
      this.logger.warn(`同步锁已被持有，拒绝 ${syncType}`)
      return
    }
    this.syncing = true
    this.syncStatus = '同步中...'

    let syncLog: any = null
    try {
      // P0 FIX: syncLog 创建移入 try，避免异常时锁永久卡死
      syncLog = await this.prisma.syncLog.create({
        data: { syncType, status: '进行中', totalCount: 0, syncedCount: 0, startedAt: new Date(), createdAt: new Date() },
      })

      // 从 GitHub API 拉取所有 Star 仓库
      const remoteRepos = await this.githubApi.fetchAllStarredRepos()
      // 去重：构建远端 map
      const remoteMap = new Map<string, any>()
      for (const r of remoteRepos) {
        if (r.fullName && !remoteMap.has(r.fullName)) remoteMap.set(r.fullName, r)
      }

      // 构建本地 map（用于对比远端，判断哪些被取消Star）
      const localRepos = await this.prisma.githubRepo.findMany({ select: { id: true, fullName: true, createdAt: true } })
      const localMap = new Map<string, { id: bigint; createdAt: Date | null }>()
      for (const r of localRepos) { if (r.fullName) localMap.set(r.fullName, { id: r.id, createdAt: r.createdAt }) }

      // 遍历远端仓库，upsert 到本地
      let synced = 0
      for (const [fullName, data] of remoteMap) {
        const local = localMap.get(fullName)
        await this.githubRepo.upsertRepo({ ...data, createdAt: local?.createdAt || new Date(), updatedAt: new Date() })
        synced++
      }

      // REPLACE 模式：批量删除本地存在但远端已不存在的仓库
      if (replace) {
        const missingFullNames: string[] = []
        for (const [fullName] of localMap) {
          if (!remoteMap.has(fullName)) missingFullNames.push(fullName)
        }
        if (missingFullNames.length > 0) {
          await this.prisma.githubRepo.deleteMany({ where: { fullName: { in: missingFullNames } } })
          this.logger.log(`已删除 ${missingFullNames.length} 个已取消Star的仓库`)
        }
      } else {
        this.logger.log(`非 REPLACE 模式，跳过删除未Star仓库，本地 ${localMap.size} 个`)
      }

      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { status: '成功', totalCount: remoteMap.size, syncedCount: synced, finishedAt: new Date() },
      })
      this.lastSyncTime = new Date(); this.lastSyncCount = remoteMap.size
      this.syncStatus = `同步完成，共 ${remoteMap.size} 个仓库`
      this.logger.log(`${syncType} 完成: ${synced} 个仓库`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (syncLog) {
        await this.prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: '失败', errorMessage: msg, finishedAt: new Date() } })
      }
      this.syncStatus = '同步失败: ' + msg
    } finally {
      this.syncing = false
    }
  }

  /** 手动同步：REPLACE 模式，全量替换 */
  startManualSync() { if (!this.syncing) this.doSync('手动同步', true).catch(e => this.logger.error(e)) }
  /** 定时同步：REPLACE 模式，全量替换 */
  startScheduledSync() { this.doSync('定时同步', true).catch(e => this.logger.error(e)) }
  isSyncing() { return this.syncing }

  async getSyncStatus() {
    const total = await this.prisma.githubRepo.count()
    const lastOk = await this.prisma.syncLog.findFirst({ where: { status: '成功' }, orderBy: { finishedAt: 'desc' } })
    return { syncing: this.syncing, status: this.syncStatus, lastSyncTime: this.lastSyncTime?.toISOString() || null, lastSyncCount: this.lastSyncCount, totalRepos: total, lastSuccessTime: lastOk?.finishedAt?.toISOString() || null, lastSuccessCount: lastOk?.syncedCount || 0 }
  }

  async getSyncLogs(pageNum: number, pageSize: number) {
    const [total, records] = await Promise.all([
      this.prisma.syncLog.count(),
      this.prisma.syncLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * pageSize, take: pageSize }),
    ])
    return { records: records.map(r => ({ ...r, id: Number(r.id) })), total, pages: Math.ceil(total / pageSize), current: pageNum }
  }
}
