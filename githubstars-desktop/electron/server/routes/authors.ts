import { Express, Request, Response } from 'express';
import { authorService } from '../services/author-service';
import { repoService } from '../services/repo-service';

export function registerAuthorRoutes(app: Express): void {
  // GET /api/authors - 作者列表分页
  app.get('/api/authors', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = Math.min(parseInt(req.query.size as string) || 20, 100);
      const keyword = req.query.keyword as string | undefined;

      const result = await authorService.getAuthorList(page, size, keyword);
      res.json(result);
    } catch (error: any) {
      console.error('获取作者列表失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/authors/:ownerName - 作者仓库列表
  app.get('/api/authors/:ownerName', async (req: Request, res: Response) => {
    try {
      const ownerName = req.params.ownerName as string;
      const page = parseInt(req.query.page as string) || 1;
      const size = Math.min(parseInt(req.query.size as string) || 20, 500);
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as string | undefined;

      const result = await authorService.getAuthorRepos(ownerName, page, size, sortBy, sortOrder);
      res.json(result);
    } catch (error: any) {
      console.error('获取作者仓库列表失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/authors/:ownerName/export - 导出作者仓库链接
  app.get('/api/authors/:ownerName/export', async (req: Request, res: Response) => {
    try {
      const ownerName = req.params.ownerName as string;
      const urls = await repoService.getAuthorUrls(ownerName);

      const content = urls.join('\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${ownerName}-stars.txt`);
      res.send(content);
    } catch (error: any) {
      console.error('导出作者仓库链接失败:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
