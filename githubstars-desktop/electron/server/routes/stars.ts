import { Express, Request, Response } from 'express';
import { repoService } from '../services/repo-service';

export function registerStarRoutes(app: Express): void {
  // GET /api/stars - 分页查询
  app.get('/api/stars', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = Math.min(parseInt(req.query.size as string) || 20, 500);
      const keyword = req.query.keyword as string | undefined;
      const languageStr = req.query.language as string | undefined;
      const languages = languageStr ? languageStr.split(',').filter(Boolean) : undefined;
      const categoryIdsStr = req.query.categoryIds as string | undefined;
      const categoryIds = categoryIdsStr ? categoryIdsStr.split(',').map(Number).filter(Boolean) : undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as string | undefined;
      const dateField = req.query.dateField as string | undefined;
      const startMonth = req.query.startMonth as string | undefined;
      const endMonth = req.query.endMonth as string | undefined;

      const result = await repoService.findPage(page, size, {
        keyword,
        languages,
        categoryIds,
        sortBy: sortBy || 'starredAt',
        sortOrder: sortOrder || 'desc',
        dateField,
        startMonth,
        endMonth,
      });

      res.json(result);
    } catch (error: any) {
      console.error('查询Star列表失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stars/:id - 单个仓库详情
  app.get('/api/stars/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
        res.status(400).json({ error: '无效的ID' });
        return;
      }
      const repo = await repoService.findById(id);
      if (!repo) {
        res.status(404).json({ error: '仓库不存在' });
        return;
      }
      res.json(repo);
    } catch (error: any) {
      console.error('查询仓库详情失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /stars/export - 导出筛选后的仓库链接
  app.get('/stars/export', async (req: Request, res: Response) => {
    try {
      const keyword = req.query.keyword as string | undefined;
      const languageStr = req.query.language as string | undefined;
      const languages = languageStr ? languageStr.split(',').filter(Boolean) : undefined;
      const categoryIdsStr = req.query.categoryIds as string | undefined;
      const categoryIds = categoryIdsStr ? categoryIdsStr.split(',').map(Number).filter(Boolean) : undefined;

      const urls = await repoService.exportUrls({
        keyword,
        languages,
        categoryIds,
      });

      const content = urls.join('\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=github-stars-links.txt');
      res.send(content);
    } catch (error: any) {
      console.error('导出失败:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
