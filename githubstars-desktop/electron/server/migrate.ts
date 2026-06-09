import { Knex } from 'knex';

/**
 * SQLite 自动迁移脚本
 * 从 MySQL schema 迁移为 SQLite 格式
 */
export async function runMigrations(knex: Knex): Promise<void> {
  console.log('📦 开始数据库迁移...');

  // 1. github_repo 表
  const hasGithubRepo = await knex.schema.hasTable('github_repo');
  if (!hasGithubRepo) {
    console.log('  - 创建 github_repo 表');
    await knex.schema.createTable('github_repo', (table) => {
      table.increments('id').primary();
      table.string('repo_name', 255);
      table.string('full_name', 500).unique().notNullable();
      table.text('description');
      table.text('description_cn');
      table.text('readme_cn');
      table.integer('readme_fetched').defaultTo(0);
      table.string('language', 100);
      table.string('owner_name', 255);
      table.string('owner_avatar_url', 1000);
      table.string('html_url', 1000);
      table.string('homepage', 1000);
      table.integer('stars_count').defaultTo(0);
      table.integer('forks_count').defaultTo(0);
      table.integer('watchers_count').defaultTo(0);
      table.integer('open_issues_count').defaultTo(0);
      table.text('topics');
      table.string('license_name', 255);
      table.integer('is_fork').defaultTo(0);
      table.integer('is_archived').defaultTo(0);
      table.string('repo_created_at');
      table.string('repo_updated_at');
      table.string('repo_pushed_at');
      table.string('starred_at');
      table.string('created_at');
      table.string('updated_at');

      // Indexes
      table.index('language', 'idx_github_repo_language');
      table.index('owner_name', 'idx_github_repo_owner');
      table.index('starred_at', 'idx_github_repo_starred');
      table.index('stars_count', 'idx_github_repo_stars');
      table.index('repo_updated_at', 'idx_github_repo_updated');
    });
  }

  // 2. sync_log 表
  const hasSyncLog = await knex.schema.hasTable('sync_log');
  if (!hasSyncLog) {
    console.log('  - 创建 sync_log 表');
    await knex.schema.createTable('sync_log', (table) => {
      table.increments('id').primary();
      table.string('sync_type', 50);
      table.string('status', 50);
      table.integer('total_count');
      table.integer('synced_count');
      table.string('started_at');
      table.string('finished_at');
      table.text('error_message');
      table.string('created_at');

      table.index('status', 'idx_sync_log_status');
      table.index('created_at', 'idx_sync_log_created');
    });
  }

  // 3. category 表
  const hasCategory = await knex.schema.hasTable('category');
  if (!hasCategory) {
    console.log('  - 创建 category 表');
    await knex.schema.createTable('category', (table) => {
      table.increments('id').primary();
      table.string('name', 100).unique().notNullable();
      table.string('description', 500);
      table.integer('sort_order').defaultTo(0);
      table.string('created_at');
      table.string('updated_at');
    });
  }

  // 4. repo_category 关联表
  const hasRepoCategory = await knex.schema.hasTable('repo_category');
  if (!hasRepoCategory) {
    console.log('  - 创建 repo_category 表');
    await knex.schema.createTable('repo_category', (table) => {
      table.increments('id').primary();
      table.integer('repo_id').notNullable();
      table.integer('category_id').notNullable();
      table.string('created_at');

      table.unique(['repo_id', 'category_id'], 'uk_repo_category');
      table.index('category_id', 'idx_rc_category');
      table.index('repo_id', 'idx_rc_repo');
    });
  }

  // 5. translation_task 表
  const hasTranslationTask = await knex.schema.hasTable('translation_task');
  if (!hasTranslationTask) {
    console.log('  - 创建 translation_task 表');
    await knex.schema.createTable('translation_task', (table) => {
      table.increments('id').primary();
      table.string('status', 50).defaultTo('PENDING');
      table.integer('total_items').defaultTo(0);
      table.integer('completed_items').defaultTo(0);
      table.integer('failed_items').defaultTo(0);
      table.integer('desc_total').defaultTo(0);
      table.integer('desc_completed').defaultTo(0);
      table.integer('desc_failed').defaultTo(0);
      table.integer('readme_total').defaultTo(0);
      table.integer('readme_completed').defaultTo(0);
      table.integer('readme_failed').defaultTo(0);
      table.string('created_at');
      table.string('finished_at');
    });
  }

  // 6. translation_task_item 表
  const hasTranslationTaskItem = await knex.schema.hasTable('translation_task_item');
  if (!hasTranslationTaskItem) {
    console.log('  - 创建 translation_task_item 表');
    await knex.schema.createTable('translation_task_item', (table) => {
      table.increments('id').primary();
      table.integer('task_id').notNullable();
      table.integer('repo_id').notNullable();
      table.string('full_name', 500);
      table.string('translate_type', 20).notNullable();
      table.string('status', 50).defaultTo('PENDING');
      table.integer('retry_count').defaultTo(0);
      table.text('error_message');
      table.string('created_at');
      table.string('updated_at');

      table.index('task_id', 'idx_tti_task');
      table.index('repo_id', 'idx_tti_repo');
      table.index('status', 'idx_tti_status');
    });
  }

  console.log('✅ 数据库迁移完成');
}
