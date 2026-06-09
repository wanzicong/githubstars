import { getDb } from '../db';
import { translateService } from './translate-service';

// 简单的并发限制器（替代 p-limit，避免 ESM/CJS 兼容问题）
function pLimitSimple(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    running--;
    if (queue.length > 0) {
      queue.shift()!();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        running++;
        fn()
          .then(resolve, reject)
          .finally(next);
      };

      if (running < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

const limit = pLimitSimple(10);

// 最大重试次数
const MAX_RETRIES = 3;

export class TranslateTaskService {
  /**
   * 创建并向步执行全量翻译任务
   */
  async createAndStartFullTranslate(): Promise<number> {
    const db = getDb();
    const now = new Date().toISOString();

    // 获取未翻译描述的仓库
    const noDescRepos = await db('github_repo')
      .whereNull('description_cn')
      .orWhere('description_cn', '')
      .select('id', 'full_name');

    // 获取未翻译 README 的仓库
    const noReadmeRepos = await db('github_repo')
      .where('readme_fetched', 0)
      .select('id', 'full_name');

    // 创建翻译任务
    const [taskId] = await db('translation_task').insert({
      status: 'PENDING',
      total_items: noDescRepos.length + noReadmeRepos.length,
      completed_items: 0,
      failed_items: 0,
      desc_total: noDescRepos.length,
      desc_completed: 0,
      desc_failed: 0,
      readme_total: noReadmeRepos.length,
      readme_completed: 0,
      readme_failed: 0,
      created_at: now,
    });

    // 创建任务项
    const items = [
      ...noDescRepos.map((r: any) => ({
        task_id: taskId,
        repo_id: r.id,
        full_name: r.full_name,
        translate_type: 'description',
        status: 'PENDING',
        retry_count: 0,
        created_at: now,
        updated_at: now,
      })),
      ...noReadmeRepos.map((r: any) => ({
        task_id: taskId,
        repo_id: r.id,
        full_name: r.full_name,
        translate_type: 'readme',
        status: 'PENDING',
        retry_count: 0,
        created_at: now,
        updated_at: now,
      })),
    ];

    if (items.length === 0) {
      // 无需翻译
      await db('translation_task').where('id', taskId).update({
        status: 'COMPLETED',
        finished_at: now,
      });
      return taskId;
    }

    // 批量插入
    await db.batchInsert('translation_task_item', items, 100);

    // 更新任务状态为 PROCESSING
    await db('translation_task').where('id', taskId).update({ status: 'PROCESSING' });

    // 异步执行翻译（不阻塞）
    this.executeTask(taskId).catch((e) => {
      console.error(`翻译任务 ${taskId} 执行出错:`, e);
    });

    return taskId;
  }

  /**
   * 执行翻译任务（10并发 + 3次重试 + 指数退避）
   */
  private async executeTask(taskId: number): Promise<void> {
    const db = getDb();
    console.log(`🔄 开始执行翻译任务 ${taskId}`);

    try {
      const items = await db('translation_task_item')
        .where({ task_id: taskId, status: 'PENDING' });

      console.log(`📋 翻译任务 ${taskId} 共 ${items.length} 项`);

      const promises = items.map((item: any) =>
        limit(async () => {
          // 更新状态为 PROCESSING
          await db('translation_task_item').where('id', item.id).update({
            status: 'PROCESSING',
            updated_at: new Date().toISOString(),
          });

          for (let retry = 0; retry <= MAX_RETRIES; retry++) {
            try {
              if (item.translate_type === 'description') {
                await translateService.translateDescription(item.repo_id);
              } else {
                await translateService.translateReadme(item.repo_id);
              }

              // 成功
              await db('translation_task_item').where('id', item.id).update({
                status: 'SUCCESS',
                updated_at: new Date().toISOString(),
              });

              // 更新任务统计
              const task = await db('translation_task').where('id', taskId).first();
              const updateData: Record<string, any> = {
                completed_items: task.completed_items + 1,
              };
              if (item.translate_type === 'description') {
                updateData.desc_completed = task.desc_completed + 1;
              } else {
                updateData.readme_completed = task.readme_completed + 1;
              }
              await db('translation_task').where('id', taskId).update(updateData);

              return;
            } catch (e) {
              // 最后一次重试也失败
              if (retry >= MAX_RETRIES) {
                await db('translation_task_item').where('id', item.id).update({
                  status: 'FAILED',
                  retry_count: MAX_RETRIES,
                  error_message: (e as Error).message || String(e),
                  updated_at: new Date().toISOString(),
                });

                const task = await db('translation_task').where('id', taskId).first();
                const updateData: Record<string, any> = {
                  failed_items: task.failed_items + 1,
                };
                if (item.translate_type === 'description') {
                  updateData.desc_failed = task.desc_failed + 1;
                } else {
                  updateData.readme_failed = task.readme_failed + 1;
                }
                await db('translation_task').where('id', taskId).update(updateData);

                return;
              }

              // 指数退避
              const backoff = Math.pow(2, retry) * 1000;
              await new Promise((resolve) => setTimeout(resolve, backoff));

              // 更新重试次数
              await db('translation_task_item').where('id', item.id).update({
                retry_count: retry + 1,
                updated_at: new Date().toISOString(),
              });
            }
          }
        })
      );

      await Promise.all(promises);

      // 标记任务完成
      const finishedAt = new Date().toISOString();
      const task = await db('translation_task').where('id', taskId).first();
      const status = task.failed_items === 0 ? 'COMPLETED' : 'FAILED';
      await db('translation_task').where('id', taskId).update({
        status,
        finished_at: finishedAt,
      });

      console.log(`✅ 翻译任务 ${taskId} 完成: ${task.completed_items} 成功, ${task.failed_items} 失败`);
    } catch (e) {
      console.error(`❌ 翻译任务 ${taskId} 异常:`, e);
      await db('translation_task').where('id', taskId).update({
        status: 'FAILED',
        finished_at: new Date().toISOString(),
      });
    }
  }

  /**
   * 获取任务进度
   */
  async getTaskProgress(taskId: number) {
    const db = getDb();
    const task = await db('translation_task').where('id', taskId).first();
    if (!task) throw new Error('任务不存在');
    return task;
  }

  /**
   * 重试失败的任务项
   */
  async retryFailures(taskId: number) {
    const db = getDb();
    const failedItems = await db('translation_task_item')
      .where({ task_id: taskId, status: 'FAILED' });

    if (failedItems.length === 0) return;

    // 重置为 PENDING
    await db('translation_task_item')
      .where({ task_id: taskId, status: 'FAILED' })
      .update({
        status: 'PENDING',
        retry_count: 0,
        error_message: null,
        updated_at: new Date().toISOString(),
      });

    // 重置任务状态
    const task = await db('translation_task').where('id', taskId).first();
    await db('translation_task').where('id', taskId).update({
      status: 'PROCESSING',
      failed_items: Math.max(0, task.failed_items - failedItems
        .filter((i: any) => i.translate_type === 'description').length
        - failedItems.filter((i: any) => i.translate_type === 'readme').length),
      finished_at: null,
    });

    // 重新执行
    this.executeTask(taskId).catch(console.error);
  }

  /**
   * 获取失败项列表
   */
  async getFailures(taskId: number) {
    const db = getDb();
    return db('translation_task_item')
      .where({ task_id: taskId, status: 'FAILED' });
  }

  /**
   * 获取最近任务列表
   */
  async getRecentTasks() {
    const db = getDb();
    return db('translation_task').orderBy('id', 'desc').limit(20);
  }
}

export const translateTaskService = new TranslateTaskService();
