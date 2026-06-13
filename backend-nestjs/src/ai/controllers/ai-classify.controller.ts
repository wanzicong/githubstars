import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { AiClassifyService } from '../services/ai-classify.service';
import { GithubRepoService } from '../../github/services/github-repo.service';

@Controller('api')
export class AiClassifyController {
    constructor(
        private readonly classifyService: AiClassifyService,
        private readonly repoService: GithubRepoService,
    ) {}

    @Get('ai/classify/repos')
    async repos(@Query() q: any) {
        const repos = await this.repoService.findAll({ keyword: q.keyword || '', language: q.language || '' });
        return { repos, total: repos.length };
    }

    @Post('ai/classify/execute')
    async execute(@Body() b: any) {
        if (!b.repoIds?.length) return { success: false, message: '请提供仓库ID列表' };
        return this.classifyService.classify(b.repoIds, b.topN || 8);
    }
}
