import { Express, Request, Response } from 'express';
import { categoryService } from '../services/category-service';
import { classifyService } from '../services/classify-service';

export function registerCategoryRoutes(app: Express): void {
  // POST /categories - 新增分类
  app.post('/categories', async (req: Request, res: Response) => {
    try {
      const { name, description, sortOrder } = req.body;
      if (!name) {
        res.status(400).json({ error: '分类名称不能为空' });
        return;
      }
      const result = await categoryService.create({ name, description, sortOrder });
      res.json(result);
    } catch (error: any) {
      console.error('创建分类失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /categories/:id - 更新分类
  app.put('/categories/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const { name, description, sortOrder } = req.body;
      const result = await categoryService.update(id, { name, description, sortOrder });
      if (!result) {
        res.status(404).json({ error: '分类不存在' });
        return;
      }
      res.json(result);
    } catch (error: any) {
      console.error('更新分类失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /categories/:id - 删除分类
  app.delete('/categories/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const deleted = await categoryService.delete(id);
      if (!deleted) {
        res.status(404).json({ error: '分类不存在' });
        return;
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('删除分类失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /categories/batch - 批量删除分类
  app.delete('/categories/batch', async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: '请提供要删除的分类ID列表' });
        return;
      }
      const count = await categoryService.batchDelete(ids);
      res.json({ success: true, deleted: count });
    } catch (error: any) {
      console.error('批量删除分类失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /categories/:categoryId/repos - 添加仓库到分类
  app.post('/categories/:categoryId/repos', async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.categoryId as string);
      const { repoIds } = req.body;
      if (!repoIds || !Array.isArray(repoIds) || repoIds.length === 0) {
        res.status(400).json({ error: '请提供仓库ID列表' });
        return;
      }
      await categoryService.addRepoToCategory(categoryId, repoIds);
      res.json({ success: true });
    } catch (error: any) {
      console.error('添加仓库到分类失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /categories/:categoryId/repos/:repoId - 从分类移除仓库
  app.delete('/categories/:categoryId/repos/:repoId', async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.categoryId as string);
      const repoId = parseInt(req.params.repoId as string);
      await categoryService.removeRepoFromCategory(categoryId, repoId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('从分类移除仓库失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /categories/:categoryId/repos/transfer - 仓库分类转移
  app.post('/categories/:categoryId/repos/transfer', async (req: Request, res: Response) => {
    try {
      const fromCategoryId = parseInt(req.params.categoryId as string);
      const { repoId, toCategoryId } = req.body;
      if (!repoId || !toCategoryId) {
        res.status(400).json({ error: '请提供仓库ID和目标分类ID' });
        return;
      }
      await categoryService.transferRepo(repoId, fromCategoryId, toCategoryId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('分类转移失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /categories/:id/repos - 获取分类下仓库
  app.get('/categories/:id/repos', async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id as string);
      const repos = await categoryService.getReposByCategory(categoryId);
      res.json(repos);
    } catch (error: any) {
      console.error('获取分类仓库失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /categories/:id/repos/paged - 分页获取分类下仓库
  app.get('/categories/:id/repos/paged', async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id as string);
      const page = parseInt(req.query.page as string) || 1;
      const size = Math.min(parseInt(req.query.size as string) || 20, 500);
      const keyword = req.query.keyword as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as string | undefined;

      const result = await categoryService.getReposByCategoryPaged(categoryId, page, size, {
        keyword,
        sortBy: sortBy || 'starredAt',
        sortOrder: sortOrder || 'desc',
      });
      res.json(result);
    } catch (error: any) {
      console.error('分页获取分类仓库失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /categories/all - 获取所有分类
  app.get('/categories/all', async (_req: Request, res: Response) => {
    try {
      const categories = await categoryService.getAll();
      res.json(categories);
    } catch (error: any) {
      console.error('获取所有分类失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /categories/uncategorized - 获取未分类仓库
  app.get('/categories/uncategorized', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = Math.min(parseInt(req.query.size as string) || 20, 500);
      const result = await categoryService.getUncategorizedRepos(page, size);
      res.json(result);
    } catch (error: any) {
      console.error('获取未分类仓库失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /categories/:id/reclassify - AI 重分类
  app.post('/categories/:id/reclassify', async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id as string);
      const { topN } = req.body;
      const repos = await categoryService.getReposByCategory(categoryId);
      const repoIds = repos.map((r) => r.id);
      if (repoIds.length === 0) {
        res.status(400).json({ error: '该分类下没有仓库' });
        return;
      }
      const result = await classifyService.executeClassify(repoIds, topN);
      res.json(result);
    } catch (error: any) {
      console.error('AI重分类失败:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
