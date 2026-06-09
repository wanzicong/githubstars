import knex, { Knex } from 'knex';
import path from 'path';
import os from 'os';

let db: Knex | null = null;

/**
 * 获取数据库文件路径
 * Electron 环境：存储在 userData
 * 开发环境：存储在项目根目录
 */
function getDbPath(): string {
  try {
    const { app } = require('electron');
    if (app && app.getPath) {
      return path.join(app.getPath('userData'), 'githubstars.db');
    }
  } catch {
    // 非 Electron 环境，使用本地路径
  }
  // 开发模式：存储在项目根目录
  return path.join(__dirname, '..', '..', 'githubstars.db');
}

/**
 * 初始化 SQLite 数据库连接
 */
export function initDatabase(): { knex: Knex; dbPath: string } {
  if (db) return { knex: db, dbPath: '' };

  const dbPath = getDbPath();
  console.log(`📂 数据库文件: ${dbPath}`);

  db = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn: any, cb: Function) => {
        // 启用 WAL 模式提高并发读性能
        conn.pragma('journal_mode = WAL');
        // 启用外键约束
        conn.pragma('foreign_keys = ON');
        cb(null, conn);
      },
    },
  });

  return { knex: db, dbPath };
}

export function getDb(): Knex {
  if (!db) throw new Error('数据库未初始化，请先调用 initDatabase()');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.destroy();
    db = null;
  }
}
