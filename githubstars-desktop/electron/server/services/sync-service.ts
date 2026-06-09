import { getDb } from '../db';
import { githubApiService } from './github-api';
import { repoService, GithubRepo } from './repo-service';

export interface SyncStatus {
  syncing: boolean;
  syncType: string | null;
  status: string | null;
  totalCount: number;
  syncedCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  lastSyncLog: any;
}

export class SyncService {
  private syncing = false;

  isSyncing(): boolean {
    return this.syncing;
  }

  async getStatus(): Promise<SyncStatus> {
    const db = getDb();
    const lastSyncLog = await db('sync_log').orderBy('id', 'desc').first();

    if (this.syncing) {
      const currentLog = await db('sync_log')
        .where('status', '进行中')
        .orderBy('id', 'desc')
        .first();

      return {
        syncing: true,
        syncType: currentLog?.sync_type || null,
        status: '进行中',
        totalCount: currentLog?.total_count || 0,
        syncedCount: currentLog?.synced_count || 0,
        startedAt: currentLog?.started_at || null,
        finishedAt: null,
        errorMessage: null,
        lastSyncLog,
      };
    }

    return {
      syncing: false,
      syncType: null,
      status: lastSyncLog?.status || null,
      totalCount: 0,
      syncedCount: 0,
      startedAt: null,
      finishedAt: lastSyncLog?.finished_at || null,
      errorMessage: lastSyncLog?.error_message || null,
      lastSyncLog,
    };
  }

  async manualSync(): Promise<void> {
    if (this.syncing) {
      throw new Error('同步正在进行中，请稍后再试');
    }

    this.syncing = true;
    const db = getDb();
    const startedAt = new Date().toISOString();

    // 创建同步日志
    const [logId] = await db('sync_log').insert({
      sync_type: '手动同步',
      status: '进行中',
      total_count: 0,
      synced_count: 0,
      started_at: startedAt,
      created_at: startedAt,
    });

    try {
      // 调用 GitHub API 获取所有 Star 仓库
      const rawRepos = await githubApiService.fetchAllStarredRepos();
      console.log(`📡 GitHub 返回 ${rawRepos.length} 个 Star 仓库`);

      // 去重（按 full_name 保留首次出现）
      const seen = new Set<string>();
      const repos = rawRepos.filter(r => {
        if (seen.has(r.full_name)) return false;
        seen.add(r.full_name);
        return true;
      });
      if (repos.length < rawRepos.length) {
        console.log(`🔁 去重: ${rawRepos.length} → ${repos.length} (去除 ${rawRepos.length - repos.length} 个重复)`);
      }

      // 更新同步进度
      await db('sync_log').where('id', logId).update({
        total_count: repos.length,
        synced_count: 0,
      });

      // 转换为数据库实体
      const entities: Partial<GithubRepo>[] = repos.map((repo) => ({
        repo_name: repo.repo_name,
        full_name: repo.full_name,
        description: repo.description,
        language: repo.language,
        owner_name: repo.owner_name,
        owner_avatar_url: repo.owner_avatar_url,
        html_url: repo.html_url,
        homepage: repo.homepage,
        stars_count: repo.stars_count,
        forks_count: repo.forks_count,
        watchers_count: repo.watchers_count,
        open_issues_count: repo.open_issues_count,
        topics: repo.topics ? JSON.stringify(repo.topics) : null,
        license_name: repo.license_name,
        is_fork: repo.is_fork ? 1 : 0,
        is_archived: repo.is_archived ? 1 : 0,
        repo_created_at: repo.repo_created_at,
        repo_updated_at: repo.repo_updated_at,
        repo_pushed_at: repo.repo_pushed_at,
        starred_at: repo.starred_at,
      }));

      // 批量 upsert
      const newCount = await repoService.batchUpsert(entities);

      await db('sync_log').where('id', logId).update({
        synced_count: repos.length,
      });

      // 删除已取消 Star 的仓库
      const existingNames = await repoService.getAllFullNames();
      const syncedNames = new Set(repos.map((r) => r.full_name));
      const toDelete = existingNames.filter((name) => !syncedNames.has(name));

      if (toDelete.length > 0) {
        await repoService.deleteByFullNames(toDelete);
        console.log(`🗑️  删除了 ${toDelete.length} 个已取消 Star 的仓库`);
      }

      const finishedAt = new Date().toISOString();
      await db('sync_log').where('id', logId).update({
        status: '成功',
        finished_at: finishedAt,
      });

      console.log(`✅ 同步完成: ${repos.length} 个仓库, ${newCount} 个新增, ${toDelete.length} 个删除`);
    } catch (error: any) {
      const finishedAt = new Date().toISOString();
      await db('sync_log').where('id', logId).update({
        status: '失败',
        error_message: error.message || String(error),
        finished_at: finishedAt,
      });
      console.error(`❌ 同步失败: ${error.message}`);
      throw error;
    } finally {
      this.syncing = false;
    }
  }

  async getSyncLogs(page: number, size: number) {
    const db = getDb();
    const offset = (page - 1) * size;
    const [{ count }] = await db('sync_log').count('* as count');
    const records = await db('sync_log').orderBy('id', 'desc').limit(size).offset(offset);
    return {
      records,
      total: Number(count),
      size,
      current: page,
      pages: Math.ceil(Number(count) / size),
    };
  }
}

export const syncService = new SyncService();
