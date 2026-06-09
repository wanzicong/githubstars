import { Express, Request, Response } from 'express';
import { classifyService } from '../services/classify-service';

export function registerClassifyRoutes(app: Express): void {
  // GET /ai/classify/repos - 加载仓库列表（用于选择待分类仓库）
  app.get('/ai/classify/repos', async (req: Request, res: Response) => {
    try {
      const keyword = req.query.keyword as string | undefined;
      const languageStr = req.query.language as string | undefined;
      const languages = languageStr ? languageStr.split(',').filter(Boolean) : undefined;
      const excludedCategoryIdsStr = req.query.excludedCategoryIds as string | undefined;
      const excludedCategoryIds = excludedCategoryIdsStr
        ? excludedCategoryIdsStr.split(',').map(Number).filter(Boolean)
        : undefined;

      const repos = await classifyService.loadRepos({
        keyword,
        languages,
        excludedCategoryIds,
      });

      res.json(repos);
    } catch (error: any) {
      console.error('加载仓库列表失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /ai/classify/execute - 执行 AI 分类
  app.post('/ai/classify/execute', async (req: Request, res: Response) => {
    try {
      const { repoIds, topN } = req.body;
      if (!repoIds || !Array.isArray(repoIds) || repoIds.length === 0) {
        res.status(400).json({ error: '请选择要分类的仓库' });
        return;
      }

      const result = await classifyService.executeClassify(repoIds, topN);
      res.json(result);
    } catch (error: any) {
      console.error('AI分类失败:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
