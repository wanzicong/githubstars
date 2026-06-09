import { Express, Request, Response } from 'express';
import { syncService } from '../services/sync-service';
import { githubApiService } from '../services/github-api';

export function registerSyncRoutes(app: Express): void {
  // POST /sync/manual - 触发手动同步
  app.post('/sync/manual', async (_req: Request, res: Response) => {
    try {
      // 检查是否已有同步进行中
      if (syncService.isSyncing()) {
        res.status(409).json({ error: '同步正在进行中，请稍后再试' });
        return;
      }

      // 异步执行同步，立即返回
      syncService.manualSync().catch((e) => {
        console.error('同步异常:', e);
      });

      res.json({ success: true, message: '同步已开始' });
    } catch (error: any) {
      console.error('触发同步失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /sync/status - 获取同步状态
  app.get('/sync/status', async (_req: Request, res: Response) => {
    try {
      const status = await syncService.getStatus();
      res.json(status);
    } catch (error: any) {
      console.error('获取同步状态失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /sync/logs - 同步日志分页
  app.get('/sync/logs', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = Math.min(parseInt(req.query.size as string) || 10, 100);
      const result = await syncService.getSyncLogs(page, size);
      res.json(result);
    } catch (error: any) {
      console.error('获取同步日志失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/config - 获取配置（脱敏显示，返回 ConfigItem[] 格式，含 id）
  app.get('/api/config', (_req: Request, res: Response) => {
    try {
      const items = githubApiService.getConfig();
      const result = items.map((item, index) => ({ id: index + 1, ...item }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/config - 批量保存配置
  app.post('/api/config', (req: Request, res: Response) => {
    try {
      const updates = req.body as Record<string, string>;
      githubApiService.setConfig(updates);
      res.json({ success: true, message: '配置已保存并生效' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/config/reload - 重新加载配置缓存
  app.post('/api/config/reload', (_req: Request, res: Response) => {
    try {
      res.json({ success: true, message: '配置已刷新（桌面端为文件存储，自动同步）' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
}
