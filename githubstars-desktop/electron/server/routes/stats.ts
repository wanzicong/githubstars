import { Express, Request, Response } from 'express';
import { statsService } from '../services/stats-service';

export function registerStatsRoutes(app: Express): void {
  // GET /api/stats/languages - 语言统计
  app.get('/api/stats/languages', async (_req: Request, res: Response) => {
    try {
      const result = await statsService.getLanguageStats();
      res.json(result);
    } catch (error: any) {
      console.error('获取语言统计失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stats/owners?topN= - 作者排行
  app.get('/api/stats/owners', async (req: Request, res: Response) => {
    try {
      const topN = parseInt(req.query.topN as string) || 20;
      const result = await statsService.getOwnerStats(topN);
      res.json(result);
    } catch (error: any) {
      console.error('获取作者排行失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stats/timeline - 时间线统计
  app.get('/api/stats/timeline', async (_req: Request, res: Response) => {
    try {
      const result = await statsService.getTimelineStats();
      res.json(result);
    } catch (error: any) {
      console.error('获取时间线统计失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stats/overview - 总体概览
  app.get('/api/stats/overview', async (_req: Request, res: Response) => {
    try {
      const result = await statsService.getOverview();
      res.json(result);
    } catch (error: any) {
      console.error('获取总体概览失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stats/top-starred?topN= - 最受欢迎仓库
  app.get('/api/stats/top-starred', async (req: Request, res: Response) => {
    try {
      const topN = parseInt(req.query.topN as string) || 20;
      const result = await statsService.getTopStarred(topN);
      res.json(result);
    } catch (error: any) {
      console.error('获取最受欢迎仓库失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stats/recent-active?topN= - 最近活跃仓库
  app.get('/api/stats/recent-active', async (req: Request, res: Response) => {
    try {
      const topN = parseInt(req.query.topN as string) || 20;
      const result = await statsService.getRecentActive(topN);
      res.json(result);
    } catch (error: any) {
      console.error('获取最近活跃仓库失败:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
