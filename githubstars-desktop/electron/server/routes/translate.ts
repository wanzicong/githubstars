import { Express, Request, Response } from 'express';
import { translateService } from '../services/translate-service';
import { translateTaskService } from '../services/translate-task-service';

export function registerTranslateRoutes(app: Express): void {
  // POST /api/translate/:repoId/description - 翻译单个仓库描述
  app.post('/api/translate/:repoId/description', async (req: Request, res: Response) => {
    try {
      const repoId = parseInt(req.params.repoId as string);
      const result = await translateService.translateDescription(repoId);
      res.json({ success: true, translation: result });
    } catch (error: any) {
      console.error('翻译描述失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/translate/:repoId/readme - 翻译单个仓库 README
  app.post('/api/translate/:repoId/readme', async (req: Request, res: Response) => {
    try {
      const repoId = parseInt(req.params.repoId as string);
      const result = await translateService.translateReadme(repoId);
      res.json({ success: true, translation: result });
    } catch (error: any) {
      console.error('翻译README失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/translate/:repoId - 全量翻译（描述 + README）
  app.post('/api/translate/:repoId', async (req: Request, res: Response) => {
    try {
      const repoId = parseInt(req.params.repoId as string);
      const result = await translateService.translateAll(repoId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('全量翻译失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/translate/batch - 批量翻译描述
  app.post('/api/translate/batch', async (req: Request, res: Response) => {
    try {
      const { repoIds } = req.body;
      if (!repoIds || !Array.isArray(repoIds) || repoIds.length === 0) {
        res.status(400).json({ error: '请提供仓库ID列表' });
        return;
      }
      const { success, failed } = await translateService.batchTranslateDescriptions(repoIds);
      res.json({ success: true, translated: success, failed });
    } catch (error: any) {
      console.error('批量翻译失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/translate/:repoId/status - 获取翻译状态
  app.get('/api/translate/:repoId/status', async (req: Request, res: Response) => {
    try {
      const repoId = parseInt(req.params.repoId as string);
      const status = await translateService.getTranslationStatus(repoId);
      res.json(status);
    } catch (error: any) {
      console.error('获取翻译状态失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/translate/start - 启动全量异步翻译任务
  app.post('/api/translate/start', async (_req: Request, res: Response) => {
    try {
      const taskId = await translateTaskService.createAndStartFullTranslate();
      res.json({ success: true, taskId });
    } catch (error: any) {
      console.error('启动翻译任务失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/translate/task/:taskId - 获取翻译任务进度
  app.get('/api/translate/task/:taskId', async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId as string);
      const task = await translateTaskService.getTaskProgress(taskId);
      if (!task) {
        res.status(404).json({ error: '任务不存在' });
        return;
      }
      res.json(task);
    } catch (error: any) {
      console.error('获取任务进度失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/translate/task/:taskId/retry - 重试失败项
  app.post('/api/translate/task/:taskId/retry', async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId as string);
      await translateTaskService.retryFailures(taskId);
      res.json({ success: true, message: '已开始重试失败项' });
    } catch (error: any) {
      console.error('重试失败项失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/translate/task/:taskId/failures - 获取失败项列表
  app.get('/api/translate/task/:taskId/failures', async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId as string);
      const failures = await translateTaskService.getFailures(taskId);
      res.json(failures);
    } catch (error: any) {
      console.error('获取失败项列表失败:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/translate/tasks - 获取最近任务列表
  app.get('/api/translate/tasks', async (_req: Request, res: Response) => {
    try {
      const tasks = await translateTaskService.getRecentTasks();
      res.json(tasks);
    } catch (error: any) {
      console.error('获取任务列表失败:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
