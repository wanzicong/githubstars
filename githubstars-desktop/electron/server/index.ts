import express from 'express';
import * as path from 'path';
import { initDatabase } from './db';
import { runMigrations } from './migrate';
import { registerStarRoutes } from './routes/stars';
import { registerCategoryRoutes } from './routes/categories';
import { registerSyncRoutes } from './routes/sync';
import { registerStatsRoutes } from './routes/stats';
import { registerAuthorRoutes } from './routes/authors';
import { registerClassifyRoutes } from './routes/classify';
import { registerTranslateRoutes } from './routes/translate';

export interface ServerOptions {
  preferredPort?: number;
  /** 是否为生产模式（托管静态文件） */
  isProduction?: boolean;
}

export async function startServer(options?: ServerOptions): Promise<{ port: number; dbPath: string }> {
  const { preferredPort, isProduction = false } = options || {};
  const app = express();

  // Body 解析
  app.use(express.json({ limit: '10mb' }));

  // CORS（开发模式需要）
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // 初始化数据库
  const { knex, dbPath } = initDatabase();
  await runMigrations(knex);

  // 注册所有 API 路由
  registerStarRoutes(app);
  registerCategoryRoutes(app);
  registerSyncRoutes(app);
  registerStatsRoutes(app);
  registerAuthorRoutes(app);
  registerClassifyRoutes(app);
  registerTranslateRoutes(app);

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 生产模式：托管前端静态文件 + SPA 路由回退
  if (isProduction) {
    const staticDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
    console.log(`📁 静态文件目录: ${staticDir}`);
    app.use(express.static(staticDir));

    // SPA 回退：所有非 API 请求返回 index.html
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  // 监听端口
  const port = preferredPort || 0;
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        resolve({ port: address.port, dbPath });
      } else {
        reject(new Error('无法获取服务器端口'));
      }
    });
    server.on('error', reject);
  });
}
