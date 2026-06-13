import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { AiClassifyService } from '../services/ai-classify.service';
import { GithubRepoService } from '../../github/services/github-repo.service';

@Controller('api')
export class AiClassifyController {
    constructor(
        private readonly classifyService: AiClassifyService,
        private readonly repoService: GithubRepoService,
    ) {}

    /**
     * 获取待分类的仓库列表
     *
     * @param q.keyword 关键词筛选（可选）
     * @param q.language 语言筛选（可选）
     * @returns 仓库列表和总数
     */
    @Get('ai/classify/repos')
    async repos(@Query() q: any) {
        const repos = await this.repoService.findAll({ keyword: q.keyword || '', language: q.language || '' });
        return { repos, total: repos.length };
    }

    /**
     * 执行 AI 普通分类
     *
     * @param b.repoIds 仓库 ID 列表（必填）
     * @param b.topN 最大分类数量（默认 8）
     * @returns 分类结果映射和分类总数
     */
    @Post('ai/classify/execute')
    async execute(@Body() b: any) {
        if (!b.repoIds?.length) return { success: false, message: '请提供仓库ID列表' };
        return this.classifyService.classify(b.repoIds, b.topN || 8);
    }
}
